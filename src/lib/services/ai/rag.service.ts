// import { conversations, ragData } from "@/lib/db/schema";
// import { sql, gt, desc, eq, and } from "drizzle-orm";
// import { getDb, ensureVectorExtension } from "@/lib/db/index"; // Edited here: Fixed import
// import { generateEmbedding } from "./embeddings.service";
// import { createDynamicEmbeddingCache } from "./dynamic-embedding-cache.service"; // Edited here: Fixed import to use functional approach

// // Edited here: Use functional approach instead of class instantiation
// const embeddingCache = createDynamicEmbeddingCache();

// export async function findRelevantContents(userQuery: string) {
//   try {
//     // Ensure vector extension is enabled before any vector operations
//     await ensureVectorExtension();

//     console.log("[RAG SERVICE] Mencari konten relevan untuk:", userQuery);

//     // Edited here: Use functional cache search instead of class method
//     const results = await embeddingCache.search(userQuery);

//     if (results && results.length > 0) {
//       console.log(`[RAG SERVICE] Ditemukan ${results.length} hasil relevan`);

//       // Format results for consistency
//       return results.map((result) => ({
//         content: result.content,
//         data: result.data,
//         similarity: result.similarity,
//         source: result.source || "internal",
//         title: result.title || "Internal Source", // Edited here: Added title field
//       }));
//     }

//     console.log("[RAG SERVICE] Tidak ada hasil relevan ditemukan");
//     return [];
//   } catch (error) {
//     console.error("Failed to search relevant contents:", error);

//     // Fallback to traditional search
//     return await traditionalSearch(userQuery);
//   }
// }

// // Edited here: Fixed traditional search with proper db import
// async function traditionalSearch(userQuery: string) {
//   try {
//     console.log("[RAG SERVICE] Using traditional search as fallback");
//     const db = getDb(); // Edited here: Get db instance properly

//     const embedding = await generateEmbedding(userQuery);
//     if (!Array.isArray(embedding) || embedding.length !== 768) {
//       console.error(
//         "Invalid embedding dimension:",
//         Array.isArray(embedding) ? embedding.length : "n/a"
//       );
//       return [];
//     }

//     // Edited here: Define cosineDistance function properly
//     const similarity = sql<number>`1 - (${
//       ragData.embedding
//     } <=> ${JSON.stringify(embedding)})`;

//     const relevantContent = await db
//       .select({
//         content: ragData.content,
//         data: ragData.data,
//         similarity: similarity,
//         source: ragData.source,
//         title: ragData.title, // Edited here: Added title field
//       })
//       .from(ragData)
//       .where(
//         gt(
//           similarity,
//           parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || "0.55")
//         )
//       )
//       .orderBy(desc(similarity))
//       .limit(parseInt(process.env.RAG_MAX_RESULTS || "5"));

//     return relevantContent;
//   } catch (error) {
//     console.error("Failed in traditional search:", error);
//     return [];
//   }
// }

// export async function getChatHistoryTitle(
//   chatId: string,
//   userId: string
// ): Promise<string> {
//   try {
//     const db = getDb(); // Edited here: Get db instance properly

//     const [chat] = await db
//       .select({
//         title: conversations.title,
//       })
//       .from(conversations)
//       .where(
//         and(eq(conversations.id, chatId), eq(conversations.userId, userId))
//       )
//       .limit(1);

//     if (!chat || !chat.title || chat.title.trim() === "") {
//       return `Chat #${chatId}`;
//     }

//     return chat.title.trim();
//   } catch (error) {
//     console.error("Failed to get chat history title:", error);
//     return `Chat #${chatId}`;
//   }
// }

// export async function getChatHistoryTitleWithAuth(
//   chatId: string,
//   userId: string
// ): Promise<{
//   title: string;
//   success: boolean;
//   error?: string;
// }> {
//   try {
//     console.log("getChatHistoryTitleWithAuth called with:", { chatId, userId });
//     if (!chatId) {
//       console.log("Invalid chatId:", chatId);
//       return {
//         title: "New Chat",
//         success: false,
//         error: "Invalid chat ID",
//       };
//     }
//     if (!userId) {
//       console.log("Invalid userId:", userId);
//       return {
//         title: `Chat #${chatId}`,
//         success: false,
//         error: "User ID is required",
//       };
//     }

//     const db = getDb(); // Edited here: Get db instance properly

//     const [chat] = await db
//       .select({
//         title: conversations.title,
//       })
//       .from(conversations)
//       .where(
//         and(eq(conversations.id, chatId), eq(conversations.userId, userId))
//       )
//       .limit(1);

//     if (!chat) {
//       console.log("Chat not found or access denied");
//       return {
//         title: `Chat #${chatId}`,
//         success: false,
//         error: "Chat not found or access denied",
//       };
//     }

//     const title = chat.title;
//     if (!title || title.trim() === "") {
//       console.log("Chat found but title is empty");
//       return {
//         title: `Chat #${chatId}`,
//         success: true,
//       };
//     }

//     console.log("Successfully retrieved title:", title);
//     return {
//       title: title.trim(),
//       success: true,
//     };
//   } catch (error) {
//     console.error("Failed to get chat history title with auth:", error);
//     return {
//       title: `Chat #${chatId}`,
//       success: false,
//       error: error instanceof Error ? error.message : "Unknown error",
//     };
//   }
// }
