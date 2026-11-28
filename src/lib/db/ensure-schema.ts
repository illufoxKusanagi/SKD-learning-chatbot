import { sql } from "drizzle-orm";
import { db } from "./index";

// Ensure pgvector extension, core auth/chat/rag tables, normalized SKD tables, quiz_attempts, rate_limits, and HNSW indexes exist
let schemaInitialized = false;

export async function ensureDatabaseSchema(
  opts: { throwOnError?: boolean } = {}
) {
  if (schemaInitialized) return;
  try {
    // 1. Ensure pgvector extension is enabled
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

    // 2. Ensure core users, chat_history, messages, and rag_data tables exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        role VARCHAR NOT NULL DEFAULT 'user',
        avatar TEXT,
        password TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_login TIMESTAMP
      )
    `);
    try {
      const duplicateEmails = await db.execute(sql`
        SELECT lower(email) AS normalized_email, COUNT(*)::int AS cnt
        FROM users
        GROUP BY lower(email)
        HAVING COUNT(*) > 1
        LIMIT 5
      `);
      const rows = Array.isArray(duplicateEmails)
        ? duplicateEmails
        : ((duplicateEmails as { rows?: unknown[] } | null)?.rows ?? []);
      if (rows.length > 0) {
        console.warn(
          "[DB] Skipping users_email_lower_uidx creation: case-variant duplicate emails detected in users table",
          rows
        );
      } else {
        await db.execute(sql`
          CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uidx
          ON users (lower(email))
        `);
      }
    } catch (indexErr) {
      console.warn(
        "[DB] Could not ensure users_email_lower_uidx:",
        indexErr
      );
    }

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        is_guest_chat BOOLEAN DEFAULT FALSE,
        guest_session_id TEXT,
        expires_at TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID NOT NULL REFERENCES chat_history(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rag_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        data JSONB NOT NULL,
        embedding vector(768),
        title TEXT,
        source VARCHAR(50) NOT NULL DEFAULT 'internal',
        external_id VARCHAR(255),
        is_cached BOOLEAN DEFAULT FALSE,
        cache_expires_at TIMESTAMP,
        last_fetched_at TIMESTAMP,
        similarity_score REAL,
        fetch_count INTEGER DEFAULT 0,
        api_response_metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 3. Ensure study_materials table and indexes exist
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
        image_url TEXT,
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
        image_url TEXT,
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
    try {
      await db.execute(
        sql`ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_rag_source_id_fkey`
      );
      await db.execute(
        sql`ALTER TABLE quiz_attempts ALTER COLUMN rag_source_id TYPE VARCHAR(255) USING rag_source_id::VARCHAR(255)`
      );
    } catch (migrationErr) {
      console.warn(
        "[DB] Legacy quiz_attempts rag_source_id migration warning:",
        migrationErr
      );
    }
    await db.execute(
      sql`ALTER TABLE quiz_attempts ALTER COLUMN chat_id DROP NOT NULL`
    );
    await db.execute(
      sql`ALTER TABLE quiz_attempts ALTER COLUMN correct_option DROP NOT NULL`
    );
    await db.execute(
      sql`ALTER TABLE quiz_attempts ALTER COLUMN scoring_rubric DROP NOT NULL`
    );
    await db.execute(
      sql`ALTER TABLE quiz_attempts ALTER COLUMN rubric_rationale DROP NOT NULL`
    );
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
      ALTER TABLE quiz_questions
      ADD COLUMN IF NOT EXISTS image_url TEXT
    `);
    await db.execute(sql`
      ALTER TABLE quiz_attempts
      ADD COLUMN IF NOT EXISTS image_url TEXT
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
    console.log(
      "[DB] Database schema, normalized SKD tables, quiz_attempts, rate_limits, and pgvector extension ensured"
    );
  } catch (error) {
    console.error("[DB] Failed to ensure database schema:", error);
    if (opts.throwOnError) {
      throw error;
    }
  }
}
