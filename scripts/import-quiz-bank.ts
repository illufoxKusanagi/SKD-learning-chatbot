import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { z } from "zod";
import { eq } from "drizzle-orm";

// 1. Initialize environment variables before importing dependent database & AI modules
const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");

// Precedence: shell env > .env.local > .env (same as Next.js)
let loadedEnv = false;
for (const p of [envLocalPath, envPath]) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    console.log(`[Import] Environment variables loaded from: ${p}`);
    loadedEnv = true;
  }
}

if (!loadedEnv) {
  dotenv.config();
  console.log("[Import] Environment loaded from default process environment");
}

// 2. Canonical Subtopics constant
export const CANONICAL_SUBTOPICS = {
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
} as const;

export type Category = "TWK" | "TIU" | "TKP";
export type BatchCategory = Category | "MIXED";

// 3. Zod Schemas
export const batchMetadataSchema = z.object({
  batchId: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "batchId must be kebab-case (e.g., '2026-11-b01')",
    }),
  category: z.enum(["TWK", "TIU", "TKP", "MIXED"]),
  totalQuestions: z.number().int().positive({
    message: "totalQuestions must be a positive integer",
  }),
  difficulty: z.literal("HOTS"),
});

export type BatchMetadata = z.infer<typeof batchMetadataSchema>;

export const optionSchema = z.object({
  label: z.enum(["A", "B", "C", "D", "E"]),
  text: z.string().trim().min(1, { message: "Option text cannot be empty" }),
  score: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
});

export type OptionItem = z.infer<typeof optionSchema>;

export const questionItemSchema = z
  .object({
    category: z.enum(["TWK", "TIU", "TKP"]),
    subtopic: z.string().trim().min(1, { message: "Subtopic is required" }),
    title: z
      .string()
      .trim()
      .min(1, { message: "Title cannot be empty" })
      .max(120, { message: "Title must not exceed 120 characters" }),
    questionStem: z
      .string()
      .trim()
      .min(1, { message: "questionStem cannot be empty" }),
    reasoningChain: z
      .string()
      .trim()
      .min(1, { message: "reasoningChain cannot be empty" }),
    options: z.array(optionSchema),
    rubricRationale: z
      .string()
      .trim()
      .min(1, { message: "rubricRationale cannot be empty" }),
  })
  .superRefine((q, ctx) => {
    // Check 1: Exactly 5 options
    if (q.options.length !== 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Expected exactly 5 options, received ${q.options.length}`,
        path: ["options"],
      });
      return;
    }

    // Check 2: Labels A..E in sequential order
    const expectedLabels: Array<"A" | "B" | "C" | "D" | "E"> = [
      "A",
      "B",
      "C",
      "D",
      "E",
    ];
    for (let i = 0; i < 5; i++) {
      if (q.options[i].label !== expectedLabels[i]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Option at index ${i} has label '${q.options[i].label}', expected '${expectedLabels[i]}'`,
          path: ["options", i, "label"],
        });
      }
    }

    // Check 3: Scores sorted matching category rules
    const scores = q.options.map((o) => o.score).sort((a, b) => a - b);
    if (q.category === "TWK" || q.category === "TIU") {
      const isBinary5_0 =
        scores.length === 5 &&
        scores[0] === 0 &&
        scores[1] === 0 &&
        scores[2] === 0 &&
        scores[3] === 0 &&
        scores[4] === 5;
      if (!isBinary5_0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${q.category} questions must have exactly one 5-point answer and four 0-point distractors (received: ${q.options.map((o) => o.score).join(", ")})`,
          path: ["options"],
        });
      }
    } else if (q.category === "TKP") {
      const isPermutation1To5 =
        scores.length === 5 &&
        scores[0] === 1 &&
        scores[1] === 2 &&
        scores[2] === 3 &&
        scores[3] === 4 &&
        scores[4] === 5;
      if (!isPermutation1To5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `TKP questions must have graduated scores permuting 1 to 5 (received: ${q.options.map((o) => o.score).join(", ")})`,
          path: ["options"],
        });
      }
    }

    // Check 4: Canonical subtopic
    const canonicalList = CANONICAL_SUBTOPICS[q.category] as readonly string[];
    if (!canonicalList.includes(q.subtopic)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Subtopic "${q.subtopic}" is not in the canonical list for ${q.category}. Allowed: ${canonicalList.join(", ")}`,
        path: ["subtopic"],
      });
    }

    // Check 5: Heuristic check for options leaked into stem
    if (/^\s*[A-E][\.\)]\s+/m.test(q.questionStem)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "questionStem must not contain option list or choices (matches /^\\s*[A-E][\\.\\)]\\s+/m)",
        path: ["questionStem"],
      });
    }
  });

export type QuestionItem = z.infer<typeof questionItemSchema>;

export interface RejectedItem {
  index: number;
  reasons: string[];
}

export interface ValidQuestionWrapper {
  question: QuestionItem;
  index: number;
  nn: string;
}

// 4. Key order verification before Zod parsing
function checkKeyOrder(rawQ: unknown): { valid: boolean; reason?: string } {
  if (typeof rawQ !== "object" || rawQ === null || Array.isArray(rawQ)) {
    return { valid: false, reason: "Question item must be a JSON object" };
  }
  const keys = Object.keys(rawQ);
  const rcIndex = keys.indexOf("reasoningChain");
  const optIndex = keys.indexOf("options");

  if (rcIndex === -1) {
    return {
      valid: false,
      reason: "Missing 'reasoningChain' property in question object",
    };
  }
  if (optIndex === -1) {
    return {
      valid: false,
      reason: "Missing 'options' property in question object",
    };
  }
  if (rcIndex >= optIndex) {
    return {
      valid: false,
      reason: `Key order violation: 'reasoningChain' (key index ${rcIndex}) must appear before 'options' (key index ${optIndex})`,
    };
  }
  return { valid: true };
}

// 5. Path resolution helper
function resolveJsonFiles(targetPaths: string[]): string[] {
  const resolvedPaths: Set<string> = new Set();

  const processPath = (p: string) => {
    const absPath = path.resolve(process.cwd(), p);
    if (!fs.existsSync(absPath)) {
      console.warn(`[Warning] Path does not exist: ${absPath}`);
      return;
    }
    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(absPath);
      for (const entry of entries) {
        if (entry.endsWith(".json")) {
          resolvedPaths.add(path.join(absPath, entry));
        }
      }
    } else if (stat.isFile()) {
      if (absPath.endsWith(".json")) {
        resolvedPaths.add(absPath);
      } else {
        console.warn(`[Warning] Ignoring non-JSON file: ${absPath}`);
      }
    }
  };

  if (targetPaths.length === 0) {
    const defaultDir = path.resolve(process.cwd(), "data/quiz-bank");
    if (fs.existsSync(defaultDir)) {
      processPath(defaultDir);
    }
  } else {
    for (const p of targetPaths) {
      processPath(p);
    }
  }

  return Array.from(resolvedPaths).sort();
}

async function main() {
  console.log("==================================================");
  console.log("   SKD Learning Chatbot - Quiz Bank Importer      ");
  console.log("==================================================");

  // Require DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error(
      "❌ Error: DATABASE_URL is not defined in environment variables. Please check your .env or .env.local file."
    );
    process.exit(1);
  }

  // Require GEMINI_API_KEY (Online-only requirement)
  if (!process.env.GEMINI_API_KEY) {
    console.error(
      "❌ Error: GEMINI_API_KEY is not defined in environment variables. App is online-only; embedding generation is mandatory."
    );
    process.exit(1);
  }

  // Dynamic imports after env resolution
  const {
    db,
    ensureDatabaseSchema,
    ragData,
    closeConnection,
  } = await import("../src/lib/db/index");
  const { generateEmbedding } = await import(
    "../src/lib/services/ai/embeddings.service"
  );

  console.log("[Import] Ensuring database schema and vector extension...");
  await ensureDatabaseSchema();

  const cliArgs = process.argv.slice(2);
  const targetFiles = resolveJsonFiles(cliArgs);

  if (targetFiles.length === 0) {
    console.log("[Import] No JSON files found to import.");
    await closeConnection();
    process.exit(0);
  }

  console.log(`[Import] Found ${targetFiles.length} file(s) to process.`);

  let globalHasErrors = false;

  for (const filePath of targetFiles) {
    console.log("\n--------------------------------------------------");
    console.log(`[File] Processing: ${filePath}`);
    console.log("--------------------------------------------------");

    let fileContent: string;
    try {
      fileContent = fs.readFileSync(filePath, "utf-8");
    } catch (readErr) {
      console.error(
        `❌ Error reading file ${filePath}:`,
        readErr instanceof Error ? readErr.message : readErr
      );
      globalHasErrors = true;
      continue;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(fileContent);
    } catch (jsonErr) {
      console.error(
        `❌ Invalid JSON syntax in file ${filePath}:`,
        jsonErr instanceof Error ? jsonErr.message : jsonErr
      );
      globalHasErrors = true;
      continue;
    }

    if (
      typeof parsedJson !== "object" ||
      parsedJson === null ||
      Array.isArray(parsedJson)
    ) {
      console.error(
        `❌ File root must be a JSON object with batchMetadata and questions: ${filePath}`
      );
      globalHasErrors = true;
      continue;
    }

    const rawObj = parsedJson as Record<string, unknown>;

    // Validate batchMetadata
    const metadataResult = batchMetadataSchema.safeParse(rawObj.batchMetadata);
    if (!metadataResult.success) {
      console.error(`❌ Invalid batchMetadata in ${filePath}:`);
      for (const issue of metadataResult.error.issues) {
        console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
      }
      globalHasErrors = true;
      continue;
    }

    const batchMetadata = metadataResult.data;

    // Validate questions array
    if (!Array.isArray(rawObj.questions)) {
      console.error(`❌ 'questions' must be an array in ${filePath}`);
      globalHasErrors = true;
      continue;
    }

    const rawQuestions = rawObj.questions;

    // Batch-level check: totalQuestions === questions.length
    if (batchMetadata.totalQuestions !== rawQuestions.length) {
      console.error(
        `❌ Batch count mismatch in ${filePath}: batchMetadata.totalQuestions (${batchMetadata.totalQuestions}) !== questions.length (${rawQuestions.length})`
      );
      globalHasErrors = true;
      continue;
    }

    const rejectedItems: RejectedItem[] = [];
    const validQuestions: ValidQuestionWrapper[] = [];

    // Per-item validation
    for (let i = 0; i < rawQuestions.length; i++) {
      const rawQ = rawQuestions[i];
      const itemIndex = i + 1; // 1-based index
      const nn = String(itemIndex).padStart(2, "0");

      // Key order check
      const keyOrderResult = checkKeyOrder(rawQ);
      if (!keyOrderResult.valid) {
        rejectedItems.push({
          index: itemIndex,
          reasons: [keyOrderResult.reason ?? "Invalid key order"],
        });
        continue;
      }

      // Zod schema check
      const itemResult = questionItemSchema.safeParse(rawQ);
      if (!itemResult.success) {
        const errorMessages = itemResult.error.issues.map(
          (issue) =>
            `${issue.path.length > 0 ? issue.path.join(".") + ": " : ""}${issue.message}`
        );
        rejectedItems.push({
          index: itemIndex,
          reasons: errorMessages,
        });
        continue;
      }

      const validatedQuestion = itemResult.data;

      // Batch category consistency check
      if (
        batchMetadata.category !== "MIXED" &&
        validatedQuestion.category !== batchMetadata.category
      ) {
        rejectedItems.push({
          index: itemIndex,
          reasons: [
            `Question category "${validatedQuestion.category}" does not match batch category "${batchMetadata.category}"`,
          ],
        });
        continue;
      }

      validQuestions.push({
        question: validatedQuestion,
        index: itemIndex,
        nn,
      });
    }

    let fileInsertedCount = 0;
    let fileUpdatedCount = 0;
    let fileFailedCount = 0;

    // Process valid questions
    for (const validItem of validQuestions) {
      const { question, nn } = validItem;
      const externalId = `skd-${question.category.toLowerCase()}-bank-${batchMetadata.batchId}-${nn}`;

      const optionsLines = question.options
        .map((opt) => `${opt.label}. ${opt.text}`)
        .join("\n");
      const content = `Soal Latihan HOTS ${question.category} - ${question.subtopic}:\n${question.questionStem}\n${optionsLines}`;

      const correctOption = (question.options.find((opt) => opt.score === 5)
        ?.label ?? "A") as "A" | "B" | "C" | "D" | "E";

      const optionsMap: {
        A: string;
        B: string;
        C: string;
        D: string;
        E: string;
      } = {
        A: question.options.find((o) => o.label === "A")?.text ?? "",
        B: question.options.find((o) => o.label === "B")?.text ?? "",
        C: question.options.find((o) => o.label === "C")?.text ?? "",
        D: question.options.find((o) => o.label === "D")?.text ?? "",
        E: question.options.find((o) => o.label === "E")?.text ?? "",
      };

      const scoringRubricMap: {
        A: number;
        B: number;
        C: number;
        D: number;
        E: number;
      } = {
        A: question.options.find((o) => o.label === "A")?.score ?? 0,
        B: question.options.find((o) => o.label === "B")?.score ?? 0,
        C: question.options.find((o) => o.label === "C")?.score ?? 0,
        D: question.options.find((o) => o.label === "D")?.score ?? 0,
        E: question.options.find((o) => o.label === "E")?.score ?? 0,
      };

      const payloadData = {
        category: question.category,
        subtopic: question.subtopic,
        docType: "contoh_soal_hots" as const,
        scoringRule:
          question.category === "TKP"
            ? ("scale_1_to_5" as const)
            : ("binary_5_0" as const),
        reasoningChain: question.reasoningChain,
        quizPayload: {
          category: question.category,
          subtopic: question.subtopic,
          questionStem: question.questionStem,
          options: optionsMap,
          correctOption,
          scoringRubric: scoringRubricMap,
          rubricRationale: question.rubricRationale,
        },
        batchId: batchMetadata.batchId,
      };

      // Generate embedding (Online-only)
      let embeddingVector: number[];
      try {
        const textToEmbed = `${question.title}\n${question.subtopic}\n${content}`;
        embeddingVector = await generateEmbedding(textToEmbed, {
          taskType: "RETRIEVAL_DOCUMENT",
          title: question.title,
        });
        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch (embErr) {
        fileFailedCount++;
        console.error(
          `   ❌ Failed to generate embedding for ${externalId}:`,
          embErr instanceof Error ? embErr.message : embErr
        );
        continue; // Do not save without vector
      }

      // Upsert into database
      try {
        const existing = await db
          .select({ id: ragData.id })
          .from(ragData)
          .where(eq(ragData.external_id, externalId))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(ragData)
            .set({
              title: question.title,
              content,
              source: "internal",
              data: payloadData,
              embedding: embeddingVector,
              updatedAt: new Date(),
            })
            .where(eq(ragData.external_id, externalId));

          fileUpdatedCount++;
          console.log(`   ✓ Updated existing entry (${externalId})`);
        } else {
          await db.insert(ragData).values({
            title: question.title,
            content,
            source: "internal",
            external_id: externalId,
            data: payloadData,
            embedding: embeddingVector,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          fileInsertedCount++;
          console.log(`   ✓ Inserted new entry (${externalId})`);
        }
      } catch (dbErr) {
        fileFailedCount++;
        console.error(
          `   ❌ Database error saving ${externalId}:`,
          dbErr instanceof Error ? dbErr.message : dbErr
        );
      }
    }

    // Report answer-key distribution across A–E for valid items
    const distribution: Record<"A" | "B" | "C" | "D" | "E", number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
    };

    for (const { question } of validQuestions) {
      const topOpt = question.options.find((opt) => opt.score === 5);
      if (topOpt) {
        distribution[topOpt.label]++;
      }
    }

    console.log("\n--- Answer Key (5-point) Distribution ---");
    const validCount = validQuestions.length;
    const letters: Array<"A" | "B" | "C" | "D" | "E"> = [
      "A",
      "B",
      "C",
      "D",
      "E",
    ];
    if (validCount > 0) {
      for (const letter of letters) {
        const count = distribution[letter];
        const pct = ((count / validCount) * 100).toFixed(1);
        console.log(`  Option ${letter}: ${count} (${pct}%)`);
      }

      if (validCount >= 5) {
        for (const letter of letters) {
          const count = distribution[letter];
          const ratio = count / validCount;
          if (ratio > 0.3) {
            console.warn(
              `  ⚠️  WARNING: Option '${letter}' holds ${(ratio * 100).toFixed(
                1
              )}% (>30%) of the 5-point answers in this batch (${count}/${validCount})`
            );
          }
        }
      }
    } else {
      console.log("  No valid questions to compute distribution.");
    }

    // Report rejected items
    if (rejectedItems.length > 0) {
      console.log("\n--- Rejected Questions ---");
      for (const r of rejectedItems) {
        console.log(`  • Question #${r.index}:`);
        for (const reason of r.reasons) {
          console.log(`    - ${reason}`);
        }
      }
    }

    // File Summary
    console.log("\n--- File Import Summary ---");
    console.log(`File                    : ${path.basename(filePath)}`);
    console.log(`Total Questions in File : ${rawQuestions.length}`);
    console.log(`Valid Questions         : ${validCount}`);
    console.log(`Inserted                : ${fileInsertedCount}`);
    console.log(`Updated                 : ${fileUpdatedCount}`);
    console.log(`Rejected                : ${rejectedItems.length}`);
    console.log(`Failed                  : ${fileFailedCount}`);

    if (rejectedItems.length > 0 || fileFailedCount > 0) {
      globalHasErrors = true;
    }
  }

  await closeConnection();
  console.log("\n[Import] Database connection closed.");

  if (globalHasErrors) {
    console.log("❌ Finished with errors or rejected items (Exit code 1).");
    process.exit(1);
  } else {
    console.log("✅ All processed files imported cleanly (Exit code 0).");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("❌ Fatal error in import script:", err);
  process.exit(1);
});
