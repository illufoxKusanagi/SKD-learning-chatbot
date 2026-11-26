import dotenv from "dotenv";
import path from "node:path";
import { validateContentDirectories } from "../src/lib/validation/content-contract";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const withDb = args.includes("--with-db");

  const materialsDir = path.resolve(process.cwd(), "data/materials");
  const quizDir = path.resolve(process.cwd(), "data/quiz-bank");

  let existingDbMaterialSlugs: string[] | undefined;
  let closeConnection: (() => Promise<void>) | null = null;

  if (withDb) {
    dotenv.config({ path: [".env.local", ".env"] });
    if (!process.env.DATABASE_URL) {
      console.error("[validate-content] --with-db requires DATABASE_URL in environment.");
      process.exit(1);
    }
    const dbModule = await import("../src/lib/db");
    closeConnection = dbModule.closeConnection;
    const rows = await dbModule.db
      .select({ slug: dbModule.studyMaterials.slug })
      .from(dbModule.studyMaterials);
    existingDbMaterialSlugs = rows.map((r) => r.slug);
  }

  try {
    const report = validateContentDirectories({
      materialsDir,
      quizDir,
      existingDbMaterialSlugs,
    });

    const twkCount = report.questions.filter((q) => q.category === "TWK").length;
    const tiuCount = report.questions.filter((q) => q.category === "TIU").length;
    const tkpCount = report.questions.filter((q) => q.category === "TKP").length;

    console.log(
      `[validate-content] Materials: ${report.materials.length} | Questions: ${report.questions.length} (TWK: ${twkCount}, TIU: ${tiuCount}, TKP: ${tkpCount})`
    );

    if (report.warnings.length > 0) {
      console.warn(`[validate-content] Warnings (${report.warnings.length}):`);
      for (const warning of report.warnings) {
        console.warn(`  - ${warning}`);
      }
    }

    if (!report.valid) {
      console.error(`[validate-content] Errors (${report.errors.length}):`);
      for (const error of report.errors) {
        console.error(`  - ${error}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log("[validate-content] All content bundles are valid.");
  } finally {
    if (closeConnection) {
      await closeConnection();
    }
  }
}

main().catch((err) => {
  console.error("[validate-content] Fatal error:", err);
  process.exit(1);
});
