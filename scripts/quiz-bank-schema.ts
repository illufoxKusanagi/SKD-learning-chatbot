import { z } from "zod";

export const SUBTOPICS: Record<"TWK" | "TIU" | "TKP", readonly string[]> = {
  TWK: [
    "Nasionalisme",
    "Integritas",
    "Bela Negara",
    "Pilar Negara - Pancasila",
    "Pilar Negara - UUD NRI 1945",
    "Pilar Negara - NKRI",
    "Pilar Negara - Bhinneka Tunggal Ika",
    "Bahasa Indonesia",
  ],
  TIU: [
    "Verbal - Analogi",
    "Verbal - Silogisme",
    "Verbal - Analitis",
    "Numerik - Deret",
    "Numerik - Perbandingan Kuantitatif",
    "Numerik - Aritmetika Sosial",
    "Numerik - Soal Cerita",
    "Figural - Spasial Verbal",
  ],
  TKP: [
    "Pelayanan Publik",
    "Jejaring Kerja",
    "Sosial Budaya",
    "TIK",
    "Anti-Radikalisme",
    "Profesionalisme",
  ],
};

export const LABELS = ["A", "B", "C", "D", "E"] as const;

export const questionSchema = z
  .object({
    category: z.enum(["TWK", "TIU", "TKP"]),
    subtopic: z.string().trim().min(1),
    title: z.string().trim().min(1).max(120),
    questionStem: z
      .string()
      .trim()
      .min(1)
      .refine((s) => !/^\s*[A-E][.)]\s+/m.test(s), "Options leaked into stem"),
    reasoningChain: z.string().trim().min(1),
    options: z
      .array(
        z.object({
          label: z.enum(LABELS),
          text: z.string().trim().min(1),
          score: z.number().int().min(0).max(5),
        })
      )
      .length(5),
    rubricRationale: z.string().trim().min(1),
  })
  .superRefine((q, ctx) => {
    if (!SUBTOPICS[q.category].includes(q.subtopic)) {
      ctx.addIssue({
        code: "custom",
        path: ["subtopic"],
        message: `Invalid ${q.category} subtopic "${q.subtopic}"`,
      });
    }
    if (q.options.some((o, idx) => o.label !== LABELS[idx])) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Options must be ordered A..E",
      });
    }
    const sorted = q.options
      .map((o) => o.score)
      .sort((a, b) => a - b)
      .join(",");
    const expected = q.category === "TKP" ? "1,2,3,4,5" : "0,0,0,0,5";
    if (sorted !== expected) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: `Expected score distribution ${expected}, got ${sorted}`,
      });
    }
  });

export const batchSchema = z
  .object({
    batchMetadata: z.object({
      batchId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      category: z.enum(["TWK", "TIU", "TKP", "MIXED"]),
      totalQuestions: z.number().int().positive(),
      difficulty: z.literal("HOTS"),
    }),
    questions: z.array(z.unknown()),
  })
  .refine((b) => b.batchMetadata.totalQuestions === b.questions.length, {
    message: "batchMetadata.totalQuestions does not match questions.length",
  });

export type QuizQuestion = z.infer<typeof questionSchema>;
export type QuizBatch = z.infer<typeof batchSchema>;

export function normalizeStem(stem: string): string {
  return stem
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s+\-*\/=<>^%]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
