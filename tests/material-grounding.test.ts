import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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

import { eq } from "drizzle-orm";
import { closeConnection, db, quizQuestionMaterials, quizQuestions } from "@/lib/db";
import { generateEmbedding } from "@/lib/services/ai/embeddings.service";
import {
  buildDeepTutorPrompt,
  getDeterministicTutorContext,
  getStudyMaterialBySlug,
  listStudyMaterials,
} from "@/lib/services/material.service";

describe("Deterministic Material Grounding & Deep Tutor Context", () => {
  let seededTwkSlug: string;
  let seededTiuSlug: string;
  let seededTkpSlug: string;

  beforeAll(async () => {
    const [twkRow] = await db
      .select({ slug: quizQuestions.slug })
      .from(quizQuestions)
      .innerJoin(
        quizQuestionMaterials,
        eq(quizQuestions.id, quizQuestionMaterials.questionId)
      )
      .where(eq(quizQuestions.category, "TWK"))
      .limit(1);

    const [tiuRow] = await db
      .select({ slug: quizQuestions.slug })
      .from(quizQuestions)
      .where(eq(quizQuestions.category, "TIU"))
      .limit(1);

    const [tkpRow] = await db
      .select({ slug: quizQuestions.slug })
      .from(quizQuestions)
      .where(eq(quizQuestions.category, "TKP"))
      .limit(1);

    if (!twkRow || !tiuRow || !tkpRow) {
      throw new Error(
        "Seeded TWK, TIU, and TKP quiz_questions rows are required in PostgreSQL"
      );
    }

    seededTwkSlug = twkRow.slug;
    seededTiuSlug = tiuRow.slug;
    seededTkpSlug = tkpRow.slug;
  });

  afterAll(async () => {
    await closeConnection();
  });

  it("resolves seeded TWK question with linked study_materials and 0 generateEmbedding calls", async () => {
    const ctx = await getDeterministicTutorContext({
      questionSlug: seededTwkSlug,
      selectedAnswer: "A",
    });

    expect(ctx).not.toBeNull();
    expect(ctx!.category).toBe("TWK");
    expect(ctx!.questionSlug).toBe(seededTwkSlug);
    expect(ctx!.selectedAnswer).toBe("A");
    expect(ctx!.reasoningChain).toBeTruthy();
    expect(ctx!.optionRationales).toBeTruthy();
    expect(ctx!.materials.length).toBeGreaterThanOrEqual(1);
    expect(ctx!.materials[0].contentMarkdown).toContain("## Inti Konsep");
    expect(generateEmbedding).not.toHaveBeenCalled();
  });

  it("resolves seeded TIU and TKP questions with reasoningChain & optionRationales, empty materials, and 0 generateEmbedding calls", async () => {
    const tiuCtx = await getDeterministicTutorContext({
      questionSlug: seededTiuSlug,
      selectedAnswer: "B",
    });
    expect(tiuCtx).not.toBeNull();
    expect(tiuCtx!.category).toBe("TIU");
    expect(tiuCtx!.reasoningChain).toBeTruthy();
    expect(tiuCtx!.optionRationales).toBeTruthy();
    expect(tiuCtx!.materials).toEqual([]);

    const tkpCtx = await getDeterministicTutorContext({
      questionSlug: seededTkpSlug,
      selectedAnswer: "C",
    });
    expect(tkpCtx).not.toBeNull();
    expect(tkpCtx!.category).toBe("TKP");
    expect(tkpCtx!.scoringRubric).toBeTruthy();
    expect(tkpCtx!.reasoningChain).toBeTruthy();
    expect(tkpCtx!.optionRationales).toBeTruthy();
    expect(tkpCtx!.materials).toEqual([]);

    expect(generateEmbedding).not.toHaveBeenCalled();
  });

  it("resolves pure TWK material context from /materi without a question and 0 generateEmbedding calls", async () => {
    const ctx = await getDeterministicTutorContext({
      materialSlugs: ["twk-sejarah-proklamasi-pergerakan"],
    });

    expect(ctx).not.toBeNull();
    expect(ctx!.category).toBe("TWK");
    expect(ctx!.stem).toBe("");
    expect(ctx!.materials).toHaveLength(1);
    expect(ctx!.materials[0].slug).toBe("twk-sejarah-proklamasi-pergerakan");
    expect(generateEmbedding).not.toHaveBeenCalled();
  });

  it("buildDeepTutorPrompt for answered TWK question includes stem, options A-E, user choice vs correctOption, reasoningChain, full contentMarkdown, and 3 diagnostic sections", async () => {
    const ctx = await getDeterministicTutorContext({
      questionSlug: seededTwkSlug,
      selectedAnswer: "A",
    });
    expect(ctx).not.toBeNull();

    const prompt = buildDeepTutorPrompt(
      "Tolong bahas soal ini secara mendalam.",
      ctx!
    );

    expect(prompt).toContain("[KONTEKS BEDAH SOAL TERKUNCI — DETERMINISTIK]");
    expect(prompt).toContain(ctx!.stem);
    expect(prompt).toContain(ctx!.options!.A);
    expect(prompt).toContain(ctx!.options!.E);
    expect(prompt).toContain("Pilihan Pengguna: Opsi A");
    expect(prompt).toContain(`Kunci Jawaban: Opsi ${ctx!.correctOption}`);
    expect(prompt).toContain(ctx!.reasoningChain!);
    expect(prompt).toContain("[REFERENSI BANK MATERI TWK TERKAIT]");
    expect(prompt).toContain("## Inti Konsep");
    expect(prompt).toContain("## Logika Sebab-Akibat");
    expect(prompt).toContain("Diagnosis Pilihan Anda vs Kunci Utama");
    expect(prompt).toContain("Bukti Konsep / Regulasi");
    expect(prompt).toContain(
      "Logika Sebab-Akibat, Skenario Kontrafaktual & Trik < 50 Detik"
    );
  });

  it("buildDeepTutorPrompt masks correctOption and optionRationales when selectedAnswer is null (spoiler guard)", async () => {
    const ctx = await getDeterministicTutorContext({
      questionSlug: seededTwkSlug,
      selectedAnswer: null,
    });
    expect(ctx).not.toBeNull();

    const prompt = buildDeepTutorPrompt(
      "Berikan petunjuk konsep tanpa membocorkan jawaban.",
      ctx!
    );

    expect(prompt).toContain("[KONTEKS BEDAH SOAL TERKUNCI — DETERMINISTIK]");
    expect(prompt).toContain(ctx!.stem);
    expect(prompt).not.toContain(`Kunci Jawaban: Opsi ${ctx!.correctOption}`);
    expect(prompt).not.toContain("Rasional Tiap Opsi");
    expect(prompt).not.toContain(ctx!.optionRationales!.A!);
    expect(prompt).not.toContain(ctx!.optionRationales!.B!);
    expect(prompt).toMatch(/JANGAN.*membocorkan|DILARANG.*membocorkan/i);
  });

  it("buildDeepTutorPrompt for answered TKP question includes TKP 1-5 scoring rubric and 3 diagnostic sections", async () => {
    const ctx = await getDeterministicTutorContext({
      questionSlug: seededTkpSlug,
      selectedAnswer: "C",
    });
    expect(ctx).not.toBeNull();

    const prompt = buildDeepTutorPrompt(
      "Mengapa opsi saya bukan skor 5?",
      ctx!
    );

    expect(prompt).toContain("[KONTEKS BEDAH SOAL TERKUNCI — DETERMINISTIK]");
    expect(prompt).toContain("Skor Rubrik TKP 1–5:");
    expect(prompt).toContain("Pilihan Pengguna: Opsi C");
    expect(prompt).toContain("Diagnosis Pilihan Anda vs Kunci Utama");
    expect(prompt).toContain("Bukti Konsep / Regulasi");
    expect(prompt).toContain("BerAKHLAK");
  });

  it("listStudyMaterials returns >= 24 seeded TWK materials and getStudyMaterialBySlug returns full detail", async () => {
    const materials = await listStudyMaterials();
    expect(materials.length).toBeGreaterThanOrEqual(24);
    expect(materials.every((m) => m.category === "TWK")).toBe(true);

    const detail = await getStudyMaterialBySlug(
      "twk-sejarah-proklamasi-pergerakan"
    );
    expect(detail).not.toBeNull();
    expect(detail!.slug).toBe("twk-sejarah-proklamasi-pergerakan");
    expect(detail!.contentMarkdown).toContain("## Inti Konsep");
    expect(typeof detail!.linkedQuestionCount).toBe("number");
    expect(Array.isArray(detail!.linkedQuestionSlugs)).toBe(true);

    const linkedMaterial = materials.find((m) => m.linkedQuestionCount >= 1);
    expect(linkedMaterial).toBeDefined();
    const linkedDetail = await getStudyMaterialBySlug(linkedMaterial!.slug);
    expect(linkedDetail).not.toBeNull();
    expect(linkedDetail!.linkedQuestionCount).toBeGreaterThanOrEqual(1);
    expect(linkedDetail!.linkedQuestionSlugs.length).toBe(
      linkedDetail!.linkedQuestionCount
    );

    const filtered = await listStudyMaterials({ search: "proklamasi" });
    expect(
      filtered.some((m) => m.slug === "twk-sejarah-proklamasi-pergerakan")
    ).toBe(true);

    const missing = await getStudyMaterialBySlug("slug-tidak-ada-9999");
    expect(missing).toBeNull();
  });
});
