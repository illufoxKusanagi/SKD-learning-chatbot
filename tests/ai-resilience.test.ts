import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(async () => {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });
});

vi.mock("@/lib/services/ai/embeddings.service", () => ({
  generateEmbedding: vi.fn(() => {
    throw new Error("generateEmbedding MUST NOT be called");
  }),
}));

import { closeConnection } from "@/lib/db";
import { generateEmbedding } from "@/lib/services/ai/embeddings.service";
import {
  classifyAiStreamError,
  generateChatTitle,
  shouldEnableGoogleSearch,
  streamGeminiWithCascade,
} from "@/lib/services/ai/gemini.service";
import {
  detectSkdCategoryAndIntent,
  findRelevantContents,
} from "@/lib/services/ai/rag.service";

describe("Gemini AI Resilience, RPM/TPM Optimization & 3-Model Cascade", () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalGoogleSearchFlag = process.env.ENABLE_GEMINI_GOOGLE_SEARCH;

  afterEach(() => {
    if (originalGeminiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
    if (originalGoogleSearchFlag === undefined) {
      delete process.env.ENABLE_GEMINI_GOOGLE_SEARCH;
    } else {
      process.env.ENABLE_GEMINI_GOOGLE_SEARCH = originalGoogleSearchFlag;
    }
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await closeConnection();
  });

  it("generateChatTitle runs deterministically in < 5ms with 0 Gemini SDK calls and no GEMINI_API_KEY", async () => {
    delete process.env.GEMINI_API_KEY;

    const start = performance.now();
    const title = await generateChatTitle(
      "Tolong jelaskan **Pancasila** dan *UUD 1945*\ndalam konteks NKRI secara mendalam untuk persiapan CPNS"
    );
    const elapsedMs = performance.now() - start;

    expect(elapsedMs).toBeLessThan(5);
    expect(title).not.toBe("Sesi Belajar SKD");
    expect(title).toContain("Pancasila");
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(45);
    expect(title).not.toContain("**");
    expect(title).not.toContain("\n");
    expect(title.toLowerCase().startsWith("tolong jelaskan")).toBe(false);

    const fallbackTitle = await generateChatTitle("   \n\n  ");
    expect(fallbackTitle).toBe("Sesi Belajar SKD");
  });

  it("shouldEnableGoogleSearch enforces strict opt-in flag and high-precision temporal intent", () => {
    delete process.env.ENABLE_GEMINI_GOOGLE_SEARCH;
    expect(
      shouldEnableGoogleSearch(
        "Jelaskan kebijakan pemerintah daerah dalam otonomi NKRI"
      )
    ).toBe(false);
    expect(shouldEnableGoogleSearch("Buatkan soal TIU silogisme")).toBe(false);
    expect(shouldEnableGoogleSearch("Apa isu terkini IKN terbaru?")).toBe(
      false
    );

    process.env.ENABLE_GEMINI_GOOGLE_SEARCH = "true";
    expect(
      shouldEnableGoogleSearch(
        "Jelaskan kebijakan pemerintah daerah dalam otonomi NKRI"
      )
    ).toBe(false);
    expect(shouldEnableGoogleSearch("Buatkan soal TIU silogisme")).toBe(false);
    expect(shouldEnableGoogleSearch("Apa isu terkini IKN terbaru?")).toBe(true);
  });

  it("detectSkdCategoryAndIntent classifies 'Buatkan soal TIU deret angka' as DB quiz request without new AI variation", () => {
    const result = detectSkdCategoryAndIntent("Buatkan soal TIU deret angka");
    expect(result.detectedCategory).toBe("TIU");
    expect(result.isQuizRequest).toBe(true);
    expect(result.wantsNewVariation).toBe(false);

    const twkResult = detectSkdCategoryAndIntent("minta latihan soal TWK");
    expect(twkResult.detectedCategory).toBe("TWK");
    expect(twkResult.isQuizRequest).toBe(true);
    expect(twkResult.wantsNewVariation).toBe(false);

    const customAiResult = detectSkdCategoryAndIntent(
      "buatkan soal TIU variasi baru"
    );
    expect(customAiResult.isQuizRequest).toBe(true);
    expect(customAiResult.wantsNewVariation).toBe(true);
  });

  it("findRelevantContents resolves unattemptedBenchmark from quiz_questions with 0 generateEmbedding calls", async () => {
    const res = await findRelevantContents("Buatkan soal TIU silogisme");

    expect(res.detectedCategory).toBe("TIU");
    expect(res.isQuizRequest).toBe(true);
    expect(res.wantsNewVariation).toBe(false);
    expect(res.unattemptedBenchmark).not.toBeNull();
    expect(res.unattemptedBenchmark?.category).toBe("TIU");
    expect(generateEmbedding).not.toHaveBeenCalled();
  });

  it("classifyAiStreamError distinguishes TOKEN_LIMIT_EXCEEDED, RATE_LIMITED (429 before 503), and MODEL_OVERLOADED (503)", () => {
    const tokenErr1 = classifyAiStreamError(
      new Error("MAX_TOKENS: Output terpotong karena batas token maksimum tercapai")
    );
    expect(tokenErr1.code).toBe("TOKEN_LIMIT_EXCEEDED");

    const tokenErr2 = classifyAiStreamError(
      new Error("Request exceeds the maximum number of tokens allowed")
    );
    expect(tokenErr2.code).toBe("TOKEN_LIMIT_EXCEEDED");

    const rateLimitWithHighDemand = classifyAiStreamError(
      new Error("429 RESOURCE_EXHAUSTED: high demand quota exceeded")
    );
    expect(rateLimitWithHighDemand.code).toBe("RATE_LIMITED");

    const overloaded503 = classifyAiStreamError(
      new Error("503 UNAVAILABLE: Model is currently overloaded")
    );
    expect(overloaded503.code).toBe("MODEL_OVERLOADED");

    const timeoutErr = classifyAiStreamError(
      new Error("TimeoutError: Request timed out")
    );
    expect(timeoutErr.code).toBe("STREAM_TIMEOUT");
  });

  it("streamGeminiWithCascade falls over Model 1 (503 connect) -> Model 2 (429 pre-first-chunk) -> Model 3 cleanly and strips tools on fallbacks", async () => {
    const seenCalls: Array<{
      model: string;
      hasTools: boolean;
      thinkingBudget?: number;
    }> = [];

    const mockAi = {
      models: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        generateContentStream: vi.fn(async (args: any) => {
          seenCalls.push({
            model: args.model,
            hasTools: Boolean(args.config?.tools?.length),
            thinkingBudget: args.config?.thinkingConfig?.thinkingBudget,
          });

          if (args.model === "gemini-2.5-flash") {
            throw new Error("503 UNAVAILABLE: high demand");
          }

          if (args.model === "gemini-2.5-flash-lite") {
            return {
              async *[Symbol.asyncIterator]() {
                throw new Error("429 RESOURCE_EXHAUSTED: quota exceeded");
                yield { text: "unreachable" };
              },
            };
          }

          return {
            async *[Symbol.asyncIterator]() {
              yield {
                candidates: [{ content: { parts: [{ text: "Halo " }] } }],
              };
              yield {
                candidates: [{ content: { parts: [{ text: "CPNS!" }] } }],
              };
            },
          };
        }),
      },
    };

    const chunks: string[] = [];
    const sleepCalls: number[] = [];
    for await (const chunk of streamGeminiWithCascade({
      ai: mockAi,
      models: [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
      ],
      contents: [{ role: "user", parts: [{ text: "Tes" }] }],
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 256 },
      },
      sleep: async (ms) => {
        sleepCalls.push(ms);
      },
    })) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("Halo CPNS!");
    expect(seenCalls).toEqual([
      { model: "gemini-2.5-flash", hasTools: true, thinkingBudget: 256 },
      { model: "gemini-2.5-flash-lite", hasTools: false, thinkingBudget: 0 },
      { model: "gemini-2.0-flash", hasTools: false, thinkingBudget: undefined },
    ]);
    expect(sleepCalls.length).toBe(2);
    expect(sleepCalls[0]).toBeGreaterThanOrEqual(1000);
    expect(sleepCalls[1]).toBeGreaterThanOrEqual(2000);
  });

  it("streamGeminiWithCascade does NOT fall back or duplicate text if an error occurs after yielding first chunk", async () => {
    const generateContentStream = vi.fn(async () => ({
      async *[Symbol.asyncIterator]() {
        yield { candidates: [{ content: { parts: [{ text: "Halo " }] } }] };
        throw new Error("503 UNAVAILABLE: mid-stream drop");
      },
    }));

    const mockAi = { models: { generateContentStream } };
    const chunks: string[] = [];

    await expect(async () => {
      for await (const chunk of streamGeminiWithCascade({
        ai: mockAi,
        models: [
          "gemini-2.5-flash",
          "gemini-2.5-flash-lite",
          "gemini-2.0-flash",
        ],
        contents: [{ role: "user", parts: [{ text: "Tes" }] }],
        config: {},
        sleep: async () => {},
      })) {
        chunks.push(chunk);
      }
    }).rejects.toThrow("503 UNAVAILABLE");

    expect(chunks).toEqual(["Halo "]);
    expect(generateContentStream).toHaveBeenCalledTimes(1);
  });

  it("streamGeminiWithCascade throws MAX_TOKENS error when quiz output hits MAX_TOKENS with truncated <quiz_meta>", async () => {
    const mockAi = {
      models: {
        generateContentStream: vi.fn(async () => ({
          async *[Symbol.asyncIterator]() {
            yield {
              candidates: [
                {
                  finishReason: "MAX_TOKENS",
                  content: {
                    parts: [
                      {
                        text: '### 📝 Latihan Soal TIU\nSoal...\n<quiz_meta>{"category":"TIU"',
                      },
                    ],
                  },
                },
              ],
            };
          },
        })),
      },
    };

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(async () => {
      for await (const _chunk of streamGeminiWithCascade({
        ai: mockAi,
        models: ["gemini-2.5-flash"],
        contents: [{ role: "user", parts: [{ text: "Tes" }] }],
        config: {},
        isQuizRequest: true,
        sleep: async () => {},
      })) {
        // consume stream
      }
    }).rejects.toThrow("MAX_TOKENS: Output terpotong");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
