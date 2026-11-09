import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { embedAndUpsertRagEntry, requireSeedEnv } from "./seed-utils";

const SUBTOPICS: Record<"TWK" | "TIU" | "TKP", readonly string[]> = {
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

const LABELS = ["A", "B", "C", "D", "E"] as const;

const questionSchema = z
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

const batchSchema = z
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

function resolveJsonFiles(args: string[]): string[] {
  const targets = args.length > 0 ? args : ["data/quiz-bank"];
  const files = new Set<string>();
  for (const target of targets) {
    const abs = path.resolve(process.cwd(), target);
    if (!fs.existsSync(abs)) continue;
    if (fs.statSync(abs).isDirectory()) {
      for (const f of fs.readdirSync(abs)) {
        if (f.endsWith(".json")) files.add(path.join(abs, f));
      }
    } else if (abs.endsWith(".json")) {
      files.add(abs);
    }
  }
  return [...files].sort();
}

async function main() {
  requireSeedEnv();
  const rawArgs = process.argv.slice(2);
  const force = rawArgs.includes("--force");
  const pathArgs = rawArgs.filter((a) => a !== "--force");

  const { ensureDatabaseSchema, closeConnection } = await import("../src/lib/db");
  await ensureDatabaseSchema();

  const files = resolveJsonFiles(pathArgs);
  if (files.length === 0) {
    console.log("[Import] No JSON files found.");
    await closeConnection();
    return;
  }

  let hasErrors = false;

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
    const batchRes = batchSchema.safeParse(raw);
    if (!batchRes.success) {
      console.error(`[Reject File] ${path.basename(file)}:`, batchRes.error.issues);
      hasErrors = true;
      continue;
    }

    const { batchMetadata, questions } = batchRes.data;
    let upserted = 0;
    let skipped = 0;

    for (let i = 0; i < questions.length; i++) {
      const parsed = questionSchema.safeParse(questions[i]);
      if (!parsed.success) {
        console.error(`[Reject #${i + 1}] ${path.basename(file)}:`, parsed.error.issues);
        hasErrors = true;
        continue;
      }
      const q = parsed.data;
      if (batchMetadata.category !== "MIXED" && q.category !== batchMetadata.category) {
        console.error(`[Reject #${i + 1}] Category ${q.category} !== ${batchMetadata.category}`);
        hasErrors = true;
        continue;
      }

      const externalId = `skd-${q.category.toLowerCase()}-bank-${batchMetadata.batchId}-${String(i + 1).padStart(2, "0")}`;
      const content = `Soal Latihan HOTS ${q.category} - ${q.subtopic}:\n${q.questionStem}\n${q.options.map((o) => `${o.label}. ${o.text}`).join("\n")}`;
      const options = Object.fromEntries(q.options.map((o) => [o.label, o.text])) as Record<(typeof LABELS)[number], string>;
      const scoringRubric = Object.fromEntries(q.options.map((o) => [o.label, o.score])) as Record<(typeof LABELS)[number], number>;
      const correctOption = q.options.find((o) => o.score === 5)!.label;

      try {
        const result = await embedAndUpsertRagEntry(
          {
            externalId,
            title: q.title,
            subtopic: q.subtopic,
            content,
            data: {
              category: q.category,
              subtopic: q.subtopic,
              docType: "contoh_soal_hots",
              scoringRule: q.category === "TKP" ? "scale_1_to_5" : "binary_5_0",
              reasoningChain: q.reasoningChain,
              batchId: batchMetadata.batchId,
              quizPayload: {
                category: q.category,
                subtopic: q.subtopic,
                questionStem: q.questionStem,
                options,
                correctOption,
                scoringRubric,
                rubricRationale: q.rubricRationale,
              },
            },
          },
          force
        );
        if (result === "skipped") skipped++;
        else upserted++;
      } catch (err) {
        console.error(`[Error] ${externalId}:`, err instanceof Error ? err.message : err);
        hasErrors = true;
      }
    }
    console.log(
      `[Import] ${path.basename(file)}: ${upserted} upserted, ${skipped} unchanged/skipped.`
    );
  }

  await closeConnection();
  process.exit(hasErrors ? 1 : 0);
}

main().catch((err) => {
  console.error("[Import] Fatal:", err);
  process.exit(1);
});
