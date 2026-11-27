import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, or, sql } from "drizzle-orm";
import * as schema from "./schema";

// Re-export common drizzle operators
export { eq, or, sql, and, desc } from "drizzle-orm";

type SqlClient = ReturnType<typeof postgres>;
type DbInstance = PostgresJsDatabase<typeof schema>;

let sqlClient: SqlClient | null = null;
let dbInstance: DbInstance | null = null;

function getSqlClient(): SqlClient {
  if (!sqlClient) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set in environment variables");
    }
    sqlClient = postgres(connectionString, {
      prepare: false,
      max: 5,
      idle_timeout: 5,
    });
  }
  return sqlClient;
}

function getDbInstance(): DbInstance {
  if (!dbInstance) {
    dbInstance = drizzle(getSqlClient(), { schema });
  }
  return dbInstance;
}

export const db: DbInstance = new Proxy({} as DbInstance, {
  get(_target, prop) {
    const instance = getDbInstance();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

// Re-export schema entities and types for convenient access
export * from "./schema";

// Ensure pgvector extension, quiz_attempts table, and HNSW index are enabled
let schemaInitialized = false;

export async function ensureDatabaseSchema(opts: { throwOnError?: boolean } = {}) {
  if (schemaInitialized) return;
  try {
    // 1. Ensure pgvector extension is enabled
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

    // 2. Ensure study_materials table and indexes exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS study_materials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(160) NOT NULL UNIQUE,
        title TEXT NOT NULL,
        category VARCHAR(10) NOT NULL DEFAULT 'TWK',
        subtopic TEXT NOT NULL,
        summary TEXT NOT NULL,
        content_markdown TEXT NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        source_type VARCHAR(30) NOT NULL DEFAULT 'manual',
        source_url TEXT,
        source_meta JSONB,
        embedding vector(768),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS study_materials_embedding_idx
      ON study_materials USING hnsw (embedding vector_cosine_ops)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS study_materials_subtopic_idx
      ON study_materials (category, subtopic)
    `);

    // 3. Ensure quiz_questions table and index exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS quiz_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(160) NOT NULL UNIQUE,
        category VARCHAR(10) NOT NULL,
        subtopic TEXT NOT NULL,
        difficulty VARCHAR(20) NOT NULL DEFAULT 'hots',
        reasoning_chain TEXT NOT NULL,
        stem TEXT NOT NULL,
        options JSONB NOT NULL,
        hint TEXT NOT NULL,
        correct_option VARCHAR(5),
        scoring_rubric JSONB,
        option_rationales JSONB NOT NULL,
        source_url TEXT,
        source_meta JSONB,
        is_validated BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS quiz_questions_cat_subtopic_idx
      ON quiz_questions (category, subtopic, is_validated)
    `);

    // 4. Ensure quiz_question_materials join table and index exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS quiz_question_materials (
        question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
        material_id UUID NOT NULL REFERENCES study_materials(id) ON DELETE CASCADE,
        PRIMARY KEY (question_id, material_id)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS quiz_question_materials_material_idx
      ON quiz_question_materials (material_id)
    `);

    // 5. Ensure quiz_sessions table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS quiz_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        guest_session_id TEXT,
        mode VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
        duration_seconds INTEGER,
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP,
        question_order JSONB NOT NULL,
        flagged_question_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        score_summary JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // 6. Ensure quiz_attempts table exists matching updated Drizzle schema
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID REFERENCES chat_history(id) ON DELETE CASCADE,
        session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,
        question_id UUID REFERENCES quiz_questions(id) ON DELETE SET NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        rag_source_id VARCHAR(255),
        category VARCHAR(10) NOT NULL,
        subtopic TEXT NOT NULL,
        question_stem TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_option VARCHAR(5),
        scoring_rubric JSONB,
        rubric_rationale TEXT,
        user_answer VARCHAR(5),
        score_earned INTEGER,
        max_score INTEGER NOT NULL DEFAULT 5,
        ai_explanation TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        time_spent_seconds INTEGER,
        used_hint BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        answered_at TIMESTAMP
      )
    `);

    // Safe idempotent migration for existing quiz_attempts tables
    await getSqlClient()`
      DO $$
      BEGIN
        ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_rag_source_id_fkey;
        ALTER TABLE quiz_attempts ALTER COLUMN rag_source_id TYPE VARCHAR(255) USING rag_source_id::VARCHAR(255);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
    `;
    await db.execute(sql`ALTER TABLE quiz_attempts ALTER COLUMN chat_id DROP NOT NULL`);
    await db.execute(sql`ALTER TABLE quiz_attempts ALTER COLUMN correct_option DROP NOT NULL`);
    await db.execute(sql`ALTER TABLE quiz_attempts ALTER COLUMN scoring_rubric DROP NOT NULL`);
    await db.execute(sql`ALTER TABLE quiz_attempts ALTER COLUMN rubric_rationale DROP NOT NULL`);
    await db.execute(sql`
      ALTER TABLE quiz_attempts
      ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE
    `);
    await db.execute(sql`
      ALTER TABLE quiz_attempts
      ADD COLUMN IF NOT EXISTS question_id UUID REFERENCES quiz_questions(id) ON DELETE SET NULL
    `);
    await db.execute(sql`
      ALTER TABLE quiz_attempts
      ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER
    `);
    await db.execute(sql`
      ALTER TABLE quiz_attempts
      ADD COLUMN IF NOT EXISTS used_hint BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_session_question_uidx
      ON quiz_attempts (session_id, question_id)
    `);

    // 7. Ensure rate_limits table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT NOT NULL,
        window_start BIGINT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (key, window_start)
      )
    `);

    // 8. Ensure HNSW cosine index on rag_data.embedding exists
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
    console.log("[DB] Database schema, normalized SKD tables, quiz_attempts, rate_limits, and pgvector extension ensured");
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
    await getSqlClient()`SELECT 1`;
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
  if (sqlClient) {
    await sqlClient.end();
    sqlClient = null;
    dbInstance = null;
  }
};
