import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, or, sql } from "drizzle-orm";
import * as schema from "./schema";

// Re-export common drizzle operators
export { eq, or, sql, and, desc } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

// Edited here: Simple connection setup - removed unnecessary complexity
// Reason: Your original was over-engineered for a typical Next.js app
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });

// Re-export schema entities and types for convenient access
export * from "./schema";

// Ensure pgvector extension, quiz_attempts table, and HNSW index are enabled
let schemaInitialized = false;

export async function ensureDatabaseSchema(opts: { throwOnError?: boolean } = {}) {
  if (schemaInitialized) return;
  try {
    // 1. Ensure pgvector extension is enabled
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

    // 2. Ensure quiz_attempts table exists matching Drizzle schema
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID NOT NULL REFERENCES chat_history(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        rag_source_id VARCHAR(255),
        category VARCHAR(10) NOT NULL,
        subtopic TEXT NOT NULL,
        question_stem TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_option VARCHAR(5) NOT NULL,
        scoring_rubric JSONB NOT NULL,
        rubric_rationale TEXT NOT NULL,
        user_answer VARCHAR(5),
        score_earned INTEGER,
        max_score INTEGER NOT NULL DEFAULT 5,
        ai_explanation TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        answered_at TIMESTAMP
      )
    `);

    // Safe idempotent migration to allow external string IDs
    await client`
      DO $$
      BEGIN
        ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_rag_source_id_fkey;
        ALTER TABLE quiz_attempts ALTER COLUMN rag_source_id TYPE VARCHAR(255) USING rag_source_id::VARCHAR(255);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
    `;

    // 3. Ensure rate_limits table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT NOT NULL,
        window_start BIGINT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (key, window_start)
      )
    `);

    // 4. Ensure HNSW cosine index on rag_data.embedding exists
    try {
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS rag_data_external_id_uidx
        ON rag_data (external_id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS rag_data_embedding_idx 
        ON rag_data USING hnsw (embedding vector_cosine_ops)
      `);
    } catch (indexErr) {
      console.warn("[DB] Could not ensure rag_data_embedding_idx:", indexErr);
    }

    schemaInitialized = true;
    console.log("[DB] Database schema, quiz_attempts table, rate_limits table, and pgvector extension ensured");
  } catch (error) {
    console.error("[DB] Failed to ensure database schema:", error);
    if (opts.throwOnError) {
      throw error;
    }
  }
}

export async function ensureVectorExtension() {
  return ensureDatabaseSchema();
}

// Edited here: Simple getDb function - clear intent without complexity
// Reason: Provides abstraction you prefer while keeping it simple
export const getDb = () => db;

// Edited here: Also export db directly for flexibility
// Reason: Some developers prefer direct access
// export { db };

// Edited here: Restored your useful helper functions in functional style
// Reason: These are actually useful utilities that your routes need
export async function findUserByEmail(email: string) {
  const result = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email));
  return result[0] || null;
}

export async function findUserByIdentifier(identifier: string) {
  const result = await db
    .select()
    .from(schema.users)
    .where(
      or(
        eq(schema.users.email, identifier),
        eq(schema.users.username, identifier)
      )
    );
  return result[0] || null;
}

export async function findUserById(id: string) {
  const result = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id));
  return result[0] || null;
}

// Edited here: Simple connection test function
// Reason: Useful for debugging without the verbose logging
export const testConnection = async (): Promise<boolean> => {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
};

// Edited here: Restored insertRagData function - it's actually useful
// Reason: Your RAG system needs this, but simplified the validation
export async function insertRagData(
  data: schema.InsertRagData | schema.InsertRagData[]
) {
  try {
    if (!data) {
      throw new Error("No data provided for insertion");
    }

    const dataArray = Array.isArray(data) ? data : [data];
    const EXPECTED_DIM = 768;

    // Edited here: Simplified validation - less verbose logging
    for (const record of dataArray) {
      if (!record.content?.trim()) {
        throw new Error("Content is required and cannot be empty");
      }
      if (!record.data) {
        throw new Error("Data field is required");
      }
      if (!record.embedding || record.embedding.length !== EXPECTED_DIM) {
        throw new Error(`Embedding must be exactly ${EXPECTED_DIM} dimensions`);
      }
    }

    const insertedData = await db
      .insert(schema.ragData)
      .values(dataArray)
      .returning();

    return {
      success: true,
      count: insertedData.length,
      data: insertedData,
    };
  } catch (error) {
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Edited here: Optional cleanup function for graceful shutdown
export const closeConnection = async (): Promise<void> => {
  await client.end();
};
