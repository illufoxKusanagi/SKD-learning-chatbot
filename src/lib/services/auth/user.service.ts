import { eq, or } from "drizzle-orm";
import { getDb } from "@/lib/db"; // Edited here: Fixed import
import { users } from "@/lib/db/schema";

export async function findByEmail(email: string) {
  if (!email || typeof email !== "string") {
    return null;
  }
  const db = getDb(); // Edited here: Get db instance
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);

  return result[0] || null;
}

export async function findByUsername(username: string) {
  if (!username || typeof username !== "string") {
    return null;
  }
  const db = getDb(); // Edited here: Get db instance
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username.trim()))
    .limit(1);

  return result[0] || null;
}

export async function findById(id: string) {
  if (!id || typeof id !== "string") {
    return null;
  }
  const db = getDb(); // Edited here: Get db instance
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result[0] || null;
}

export async function findByIdentifier(identifier: string) {
  // Edited here: Add validation check
  if (!identifier || typeof identifier !== "string") {
    return null;
  }
  const db = getDb();
  const cleanIdentifier = identifier.trim().toLowerCase();

  // Try to find by email or username
  const result = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.email, cleanIdentifier),
        eq(users.username, identifier.trim())
      )
    )
    .limit(1);
  return result[0] || null;
}
