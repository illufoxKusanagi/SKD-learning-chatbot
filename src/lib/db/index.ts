import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, or, sql } from "drizzle-orm";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

// Edited here: Simple connection setup - removed unnecessary complexity
// Reason: Your original was over-engineered for a typical Next.js app
const client = postgres(connectionString, { prepare: false });

const db = drizzle(client, { schema });

// Ensure pgvector extension is enabled
let extensionInitialized = false;
export async function ensureVectorExtension() {
  if (extensionInitialized) return;
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    extensionInitialized = true;
    console.log("[DB] pgvector extension ensured");
  } catch (error) {
    console.error("[DB] Failed to ensure vector extension:", error);
  }
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
