import { describe, expect, it } from "vitest";
import { parseMessageQuizMarkers } from "@/components/chat/quiz/quiz-utils";

describe("parseMessageQuizMarkers", () => {
  it("parses QUIZ_PACK UUIDs in exact order and strips the marker from cleanContent", () => {
    const id1 = "11111111-1111-4111-8111-111111111111";
    const id2 = "22222222-2222-4222-8222-222222222222";
    const content = `Berikut paket latihan soal SKD untuk kamu.\n\n<!--QUIZ_PACK:${id1},${id2}-->`;

    const parsed = parseMessageQuizMarkers(content);

    expect(parsed.packQuizIds).toEqual([id1, id2]);
    expect(parsed.packQuizIds).toHaveLength(2);
    expect(parsed.cleanContent).toBe("Berikut paket latihan soal SKD untuk kamu.");
    expect(parsed.attemptId).toBeNull();
    expect(parsed.quizId).toBeNull();
  });

  it("preserves QUIZ_ATTEMPT, QUIZ_EVAL, and CHAT_ERROR parsing with empty packQuizIds", () => {
    const attemptId = "33333333-3333-4333-8333-333333333333";
    const evalId = "44444444-4444-4444-8444-444444444444";

    const attemptParsed = parseMessageQuizMarkers(
      `Siap, ini soalnya.\n\n<!--QUIZ_ATTEMPT:${attemptId}-->`
    );
    expect(attemptParsed.attemptId).toBe(attemptId);
    expect(attemptParsed.quizId).toBe(attemptId);
    expect(attemptParsed.packQuizIds).toEqual([]);
    expect(attemptParsed.cleanContent).toBe("Siap, ini soalnya.");

    const evalParsed = parseMessageQuizMarkers(
      `Jawaban kamu tepat!\n\n<!--QUIZ_EVAL:${evalId}:c:5-->`
    );
    expect(evalParsed.evalQuizId).toBe(evalId);
    expect(evalParsed.evalOption).toBe("C");
    expect(evalParsed.evalScore).toBe(5);
    expect(evalParsed.quizId).toBe(evalId);
    expect(evalParsed.packQuizIds).toEqual([]);
    expect(evalParsed.cleanContent).toBe("Jawaban kamu tepat!");

    const errorPayload = {
      code: "RATE_LIMIT",
      title: "Terlalu Banyak Permintaan",
      message: "Tunggu sebentar sebelum mencoba lagi.",
    };
    const errorParsed = parseMessageQuizMarkers(
      `Sebagian teks.\n\n<!--CHAT_ERROR:${JSON.stringify(errorPayload)}-->`
    );
    expect(errorParsed.chatError).toEqual(errorPayload);
    expect(errorParsed.packQuizIds).toEqual([]);
    expect(errorParsed.cleanContent).toBe("Sebagian teks.");
  });
});
