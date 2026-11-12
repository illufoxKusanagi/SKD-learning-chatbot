import dotenv from "dotenv";
import { eq, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";

// Load .env.local then .env without overriding shell environment variables
dotenv.config({ path: [".env.local", ".env"] });

export interface RagSeedInput {
  externalId: string;
  title: string;
  subtopic: string;
  content: string;
  data: Record<string, unknown>;
}

export function requireSeedEnv(): void {
  if (!process.env.DATABASE_URL || !process.env.GEMINI_API_KEY) {
    console.error(
      "Missing required DATABASE_URL or GEMINI_API_KEY in environment (.env.local / .env)."
    );
    process.exit(1);
  }
}

export async function embedAndUpsertRagEntry(
  entry: RagSeedInput,
  force: boolean = false
): Promise<"upserted" | "skipped"> {
  const [{ db, ragData }, { generateEmbedding }] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/services/ai/embeddings.service"),
  ]);

  if (!force) {
    const [existing] = await db
      .select({
        content: ragData.content,
        data: ragData.data,
        hasEmbedding: sql<boolean>`${ragData.embedding} IS NOT NULL`,
      })
      .from(ragData)
      .where(eq(ragData.external_id, entry.externalId))
      .limit(1);

    if (existing && existing.content === entry.content && existing.hasEmbedding) {
      const isMetadataEqual =
        isDeepStrictEqual(existing.data, entry.data) ||
        JSON.stringify(existing.data) === JSON.stringify(entry.data);

      if (isMetadataEqual) {
        return "skipped";
      }

      await db
        .update(ragData)
        .set({
          title: entry.title,
          data: entry.data,
          updatedAt: new Date(),
        })
        .where(eq(ragData.external_id, entry.externalId));

      return "upserted";
    }
  }

  const embedding = await generateEmbedding(
    `${entry.title}\n${entry.subtopic}\n${entry.content}`,
    { taskType: "RETRIEVAL_DOCUMENT", title: entry.title }
  );

  const now = new Date();
  await db
    .insert(ragData)
    .values({
      external_id: entry.externalId,
      title: entry.title,
      content: entry.content,
      source: "internal",
      data: entry.data,
      embedding,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: ragData.external_id,
      set: {
        title: entry.title,
        content: entry.content,
        source: "internal",
        data: entry.data,
        embedding,
        updatedAt: now,
      },
    });

  // Gentle pacing for Gemini embedding rate limits
  await new Promise((r) => setTimeout(r, 120));
  return "upserted";
}
