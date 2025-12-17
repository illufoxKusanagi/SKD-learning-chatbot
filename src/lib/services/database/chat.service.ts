import { getDb } from "@/lib/db"; // Edited here: Fixed import
import { messages } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function getChatMessages(chatId: string) {
  const db = getDb(); // Edited here: Get db instance
  return await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt)); // Edited here: Use asc for chronological order
}

export async function addMessage(
  chatId: string,
  role: string,
  content: string
) {
  const db = getDb(); // Edited here: Get db instance
  const [newMessage] = await db
    .insert(messages)
    .values({
      chatId,
      role,
      content,
      createdAt: new Date(),
    })
    .returning();

  return newMessage;
}
