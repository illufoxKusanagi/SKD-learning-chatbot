import { sql } from "drizzle-orm";
import { embedAndUpsertRagEntry, requireSeedEnv } from "./seed-utils";
import { SKD_KNOWLEDGE_BASE } from "../src/lib/datas/skd-knowledge";

async function main() {
  requireSeedEnv();
  const force = process.argv.includes("--force");
  const { db, ensureDatabaseSchema, closeConnection } = await import("../src/lib/db");
  await ensureDatabaseSchema({ throwOnError: true });

  await db.execute(sql`
    DELETE FROM rag_data
    WHERE (external_id IS NULL OR external_id NOT LIKE 'skd-%')
      AND (content ILIKE '%madiun%' OR title ILIKE '%madiun%')
  `);

  let upserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of SKD_KNOWLEDGE_BASE) {
    try {
      const result = await embedAndUpsertRagEntry(
        {
          externalId: entry.externalId,
          title: entry.title,
          subtopic: entry.subtopic,
          content: entry.content,
          data: {
            category: entry.category,
            subtopic: entry.subtopic,
            docType: entry.docType,
            scoringRule: entry.scoringRule,
            quizPayload: entry.quizPayload ?? null,
          },
        },
        force
      );
      if (result === "skipped") skipped++;
      else upserted++;
      console.log(`[Seed] ✓ ${entry.externalId} (${result})`);
    } catch (err) {
      failed++;
      console.error(`[Seed] ✗ ${entry.externalId}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[Seed] Done: ${upserted} upserted, ${skipped} skipped, ${failed} failed.`);
  await closeConnection();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[Seed] Fatal:", err);
  process.exit(1);
});
