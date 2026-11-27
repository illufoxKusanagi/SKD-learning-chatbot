import dotenv from "dotenv";
import path from "node:path";
import { and, eq, notInArray, sql } from "drizzle-orm";
import type { StudyMaterialSourceMeta } from "../src/lib/db/schema";
import {
  computeContentHash,
  validateContentDirectories,
} from "../src/lib/validation/content-contract";

dotenv.config({ path: [".env.local", ".env"] });

function requireImportEnv(): void {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.GEMINI_API_KEY) missing.push("GEMINI_API_KEY");
  if (missing.length > 0) {
    console.error(
      `[import-content] Missing required environment variables: ${missing.join(", ")}`
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");

  const materialsDir = path.resolve(process.cwd(), "data/materials");
  const quizDir = path.resolve(process.cwd(), "data/quiz-bank");

  if (dryRun) {
    const report = validateContentDirectories({ materialsDir, quizDir });
    const twkCount = report.questions.filter((q) => q.category === "TWK").length;
    const tiuCount = report.questions.filter((q) => q.category === "TIU").length;
    const tkpCount = report.questions.filter((q) => q.category === "TKP").length;

    console.log(
      `[import-content --dry-run] Materials: ${report.materials.length} | Questions: ${report.questions.length} (TWK: ${twkCount}, TIU: ${tiuCount}, TKP: ${tkpCount})`
    );
    for (const warning of report.warnings) {
      console.warn(`  [warn] ${warning}`);
    }
    if (!report.valid) {
      console.error(`[import-content --dry-run] Validation failed (${report.errors.length} errors):`);
      for (const error of report.errors) {
        console.error(`  - ${error}`);
      }
      process.exit(1);
    }
    console.log("[import-content --dry-run] Validation passed. No DB writes performed.");
    return;
  }

  requireImportEnv();

  const [
    { db, closeConnection, studyMaterials, quizQuestions, quizQuestionMaterials },
    { ensureDatabaseSchema },
    { generateEmbedding },
  ] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/db/ensure-schema"),
    import("../src/lib/services/ai/embeddings.service"),
  ]);

  try {
    await ensureDatabaseSchema({ throwOnError: true });

    const existingRows = await db
      .select({
        id: studyMaterials.id,
        slug: studyMaterials.slug,
        contentHash: studyMaterials.contentHash,
        hasEmbedding: sql<boolean>`${studyMaterials.embedding} IS NOT NULL`,
      })
      .from(studyMaterials);

    const existingBySlug = new Map(existingRows.map((row) => [row.slug, row]));
    const materialIdBySlug = new Map(existingRows.map((row) => [row.slug, row.id]));

    const report = validateContentDirectories({
      materialsDir,
      quizDir,
      existingDbMaterialSlugs: existingRows.map((row) => row.slug),
    });

    for (const warning of report.warnings) {
      console.warn(`[import-content] [warn] ${warning}`);
    }

    if (!report.valid) {
      console.error(
        `[import-content] Validation failed (${report.errors.length} errors). Aborting before any DB writes:`
      );
      for (const error of report.errors) {
        console.error(`  - ${error}`);
      }
      process.exitCode = 1;
      return;
    }

    let materialsUpserted = 0;
    let materialsSkipped = 0;

    for (const mat of report.materials) {
      const contentHash = computeContentHash(mat.contentMarkdown);
      const existing = existingBySlug.get(mat.slug);
      const needsEmbedding =
        !existing ||
        !existing.hasEmbedding ||
        existing.contentHash !== contentHash ||
        force;

      if (!needsEmbedding && existing) {
        materialIdBySlug.set(mat.slug, existing.id);
        materialsSkipped++;
        continue;
      }

      const embeddingInput = `${mat.title}\n${mat.subtopic}\n${mat.summary}\n${mat.contentMarkdown}`;
      const embedding = await generateEmbedding(embeddingInput, {
        taskType: "RETRIEVAL_DOCUMENT",
        title: mat.title,
      });

      const [upserted] = await db
        .insert(studyMaterials)
        .values({
          slug: mat.slug,
          title: mat.title,
          category: mat.category,
          subtopic: mat.subtopic,
          summary: mat.summary,
          contentMarkdown: mat.contentMarkdown,
          contentHash,
          sourceType: mat.source?.type ?? "manual",
          sourceUrl: mat.source?.url ?? null,
          sourceMeta: (mat.source ?? null) as StudyMaterialSourceMeta | null,
          embedding,
        })
        .onConflictDoUpdate({
          target: studyMaterials.slug,
          set: {
            title: mat.title,
            category: mat.category,
            subtopic: mat.subtopic,
            summary: mat.summary,
            contentMarkdown: mat.contentMarkdown,
            contentHash,
            sourceType: mat.source?.type ?? "manual",
            sourceUrl: mat.source?.url ?? null,
            sourceMeta: (mat.source ?? null) as StudyMaterialSourceMeta | null,
            embedding,
            updatedAt: new Date(),
          },
        })
        .returning({ id: studyMaterials.id });

      materialIdBySlug.set(mat.slug, upserted.id);
      materialsUpserted++;
    }

    let questionsUpserted = 0;

    if (report.questions.length > 0) {
      await db.transaction(async (tx) => {
        for (const q of report.questions) {
          const [upsertedQuestion] = await tx
            .insert(quizQuestions)
            .values({
              slug: q.slug,
              category: q.category,
              subtopic: q.subtopic,
              difficulty: q.difficulty,
              reasoningChain: q.reasoningChain,
              stem: q.stem,
              imageUrl: q.imageUrl ?? null,
              options: q.options,
              hint: q.hint,
              correctOption: q.correctOption,
              scoringRubric: q.scoringRubric,
              optionRationales: q.optionRationales,
              sourceUrl: q.source?.url ?? null,
              sourceMeta: (q.source ?? null) as StudyMaterialSourceMeta | null,
              isValidated: true,
            })
            .onConflictDoUpdate({
              target: quizQuestions.slug,
              set: {
                category: q.category,
                subtopic: q.subtopic,
                difficulty: q.difficulty,
                reasoningChain: q.reasoningChain,
                stem: q.stem,
                imageUrl: q.imageUrl ?? null,
                options: q.options,
                hint: q.hint,
                correctOption: q.correctOption,
                scoringRubric: q.scoringRubric,
                optionRationales: q.optionRationales,
                sourceUrl: q.source?.url ?? null,
                sourceMeta: (q.source ?? null) as StudyMaterialSourceMeta | null,
                isValidated: true,
                updatedAt: new Date(),
              },
            })
            .returning({ id: quizQuestions.id });

          const targetMaterialIds = q.materialSlugs.map((slug) => {
            const id = materialIdBySlug.get(slug);
            if (!id) {
              throw new Error(
                `Resolved material ID not found for slug "${slug}" on question "${q.slug}"`
              );
            }
            return id;
          });

          if (targetMaterialIds.length === 0) {
            await tx
              .delete(quizQuestionMaterials)
              .where(eq(quizQuestionMaterials.questionId, upsertedQuestion.id));
          } else {
            await tx
              .delete(quizQuestionMaterials)
              .where(
                and(
                  eq(quizQuestionMaterials.questionId, upsertedQuestion.id),
                  notInArray(quizQuestionMaterials.materialId, targetMaterialIds)
                )
              );

            await tx
              .insert(quizQuestionMaterials)
              .values(
                targetMaterialIds.map((materialId) => ({
                  questionId: upsertedQuestion.id,
                  materialId,
                }))
              )
              .onConflictDoNothing();
          }

          questionsUpserted++;
        }
      });
    }

    console.log(
      `[import-content] Done: ${materialsUpserted} materials upserted, ${materialsSkipped} materials skipped, ${questionsUpserted} questions upserted.`
    );
  } finally {
    await closeConnection();
  }
}

main().catch((err) => {
  console.error("[import-content] Fatal error:", err);
  process.exit(1);
});
