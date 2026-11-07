import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { eq, sql } from "drizzle-orm";

// 1. Initialize environment variables before importing dependent database & AI modules
const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
  console.log(`[Seed] Environment variables loaded from: ${envLocalPath}`);
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
  console.log(`[Seed] Environment variables loaded from: ${envPath}`);
} else {
  dotenv.config();
  console.log("[Seed] Environment loaded from default process environment");
}

async function main() {
  console.log("==================================================");
  console.log("   SKD Learning Chatbot - Database Seed Script    ");
  console.log("==================================================");

  if (!process.env.DATABASE_URL) {
    console.error(
      "❌ Error: DATABASE_URL is not defined in environment variables. Please check your .env or .env.local file."
    );
    process.exit(1);
  }

  // Dynamic import after dotenv has resolved DATABASE_URL
  const {
    db,
    ensureDatabaseSchema,
    ragData,
    closeConnection,
  } = await import("../src/lib/db/index");
  const { SKD_KNOWLEDGE_BASE } = await import(
    "../src/lib/datas/skd-knowledge"
  );

  console.log("[Seed] Ensuring database schema and vector extension...");
  await ensureDatabaseSchema();

  console.log("[Seed] Cleaning legacy non-SKD records...");
  try {
    const deleteResult = await db.execute(sql`
      DELETE FROM rag_data 
      WHERE (external_id IS NOT NULL AND (external_id NOT LIKE 'skd-%' AND (content ILIKE '%madiun%' OR title ILIKE '%madiun%')))
         OR (external_id IS NULL AND (content ILIKE '%madiun%' OR title ILIKE '%madiun%'))
    `);
    console.log("[Seed] Legacy records cleaned successfully");
  } catch (cleanErr) {
    console.warn("[Seed] Warning while cleaning legacy records:", cleanErr);
  }

  // Check if GEMINI_API_KEY is available for embedding generation
  let generateEmbeddingFn:
    | ((
        text: string,
        options?: {
          taskType?: import("../src/lib/services/ai/embeddings.service").EmbeddingTaskType;
          title?: string;
        }
      ) => Promise<number[]>)
    | null = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      const embeddingsModule = await import(
        "../src/lib/services/ai/embeddings.service"
      );
      generateEmbeddingFn = embeddingsModule.generateEmbedding;
      console.log(
        `[Seed] Gemini API Key detected. Model: ${
          process.env.EMBEDDING_MODEL ?? "text-embedding-004"
        }`
      );
    } catch (importErr) {
      console.warn(
        "[Seed] Could not initialize Gemini embedding service:",
        importErr
      );
    }
  } else {
    console.warn(
      "⚠️  WARNING: GEMINI_API_KEY is not defined in environment variables."
    );
    console.warn(
      "   Embeddings will be skipped or seeded without vectors. Run seed again once GEMINI_API_KEY is provided."
    );
  }

  console.log(
    `[Seed] Processing ${SKD_KNOWLEDGE_BASE.length} SKD benchmark knowledge entries...`
  );

  let insertedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < SKD_KNOWLEDGE_BASE.length; i++) {
    const entry = SKD_KNOWLEDGE_BASE[i];
    const prefix = `[${i + 1}/${SKD_KNOWLEDGE_BASE.length}]`;
    console.log(`${prefix} Seeding: "${entry.title}" (${entry.externalId})...`);

    let embeddingVector: number[] | null = null;

    if (generateEmbeddingFn) {
      try {
        const textToEmbed = `${entry.title}\n${entry.subtopic}\n${entry.content}`;
        embeddingVector = await generateEmbeddingFn(textToEmbed, {
          taskType: "RETRIEVAL_DOCUMENT",
          title: entry.title,
        });
        // Small delay to prevent hitting aggressive rate limits on API
        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch (embErr) {
        console.error(
          `   ⚠️  Failed to generate embedding for ${entry.externalId}:`,
          embErr instanceof Error ? embErr.message : embErr
        );
      }
    }

    try {
      // Check if entry already exists
      const existing = await db
        .select({ id: ragData.id })
        .from(ragData)
        .where(eq(ragData.external_id, entry.externalId))
        .limit(1);

      const payloadData = {
        category: entry.category,
        subtopic: entry.subtopic,
        docType: entry.docType,
        scoringRule: entry.scoringRule,
        quizPayload: entry.quizPayload ?? null,
      };

      if (existing.length > 0) {
        await db
          .update(ragData)
          .set({
            title: entry.title,
            content: entry.content,
            source: "internal",
            data: payloadData,
            ...(embeddingVector ? { embedding: embeddingVector } : {}),
            updatedAt: new Date(),
          })
          .where(eq(ragData.external_id, entry.externalId));

        updatedCount++;
        console.log(`   ✓ Updated existing entry (${entry.externalId})`);
      } else {
        await db.insert(ragData).values({
          title: entry.title,
          content: entry.content,
          source: "internal",
          external_id: entry.externalId,
          data: payloadData,
          embedding: embeddingVector ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        insertedCount++;
        console.log(`   ✓ Inserted new entry (${entry.externalId})`);
      }
    } catch (insertErr) {
      failedCount++;
      console.error(
        `   ❌ Error saving ${entry.externalId}:`,
        insertErr instanceof Error ? insertErr.message : insertErr
      );
    }
  }

  console.log("==================================================");
  console.log("               Seed Summary Report                ");
  console.log("==================================================");
  console.log(`Total Entries Processed : ${SKD_KNOWLEDGE_BASE.length}`);
  console.log(`Inserted                : ${insertedCount}`);
  console.log(`Updated                 : ${updatedCount}`);
  console.log(`Failed                  : ${failedCount}`);
  console.log("==================================================");

  await closeConnection();
  console.log("[Seed] Database connection closed. Done!");
}

main().catch((err) => {
  console.error("❌ Fatal error in seed script:", err);
  process.exit(1);
});
