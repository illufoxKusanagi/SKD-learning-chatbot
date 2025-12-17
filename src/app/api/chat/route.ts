import { getDb } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { findRelevantContents } from "@/lib/services/ai/rag.service";
import {
  ApiError,
  withMiddleware,
  createRateLimitMiddleware,
} from "@/middleware/api";
import { verifyToken } from "@/lib/auth/jwt";
import { GoogleGenAI } from "@google/genai";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

const apiKey: string = process.env.GEMINI_API_KEY || "";
const generativeModel: string =
  process.env.GENERATIVE_MODEL || "gemini-2.5-flash-lite";

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY");
  throw new ApiError(
    "Tidak dapat memproses respon chatbot, silahkan hubungi admin.",
    500,
    "API_CONFIG_ERROR"
  );
}

const genAI = new GoogleGenAI({ apiKey });

const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(4000, "Message is too long")
    .trim(),
  chatId: z.string().uuid("Invalid chat ID format").optional(), // Only accept UUID strings
});

// Edited here: Fixed generateChatTitle function that was missing
async function generateChatTitle(message: string): Promise<string> {
  try {
    const result = await genAI.models.generateContent({
      model: generativeModel,
      contents: `Generate a short, descriptive title (max 50 characters) for a chat that starts with: "${message}". Return only the title.`,
    });
    const title = result.text?.trim() || "New Chat";
    return title.length > 50 ? title.substring(0, 47) + "..." : title;
  } catch (error) {
    console.error("Title generation error:", error);
    return "New Chat";
  }
}

// async function chatHandler(
//   request: AuthenticatedRequest & { validatedData?: any }
// ) {
//   const { message, chatId } = request.validatedData || {};
//   const db = getDb();
//   const userId = request.user!.userId;
//   let currentChatId = chatId;
//   if (!message) {
//     throw new ApiError("Pesan tidak boleh kosong", 400, "MISSING_MESSAGE");
//   }
//   try {
//     if (!currentChatId) {
//       const title = await generateChatTitle(message);
//       const [newChat] = await db
//         .insert(conversations)
//         .values({
//           userId: request.user!.userId,
//           title: title || "New Chat",
//           createdAt: new Date(),
//           // updatedAt: new Date(),
//         })
//         .returning({ id: conversations.id });
//       currentChatId = newChat.id;
//     } else {
//       // Edited here: Your original ownership verification
//       const [existingChat] = await db
//         .select({ userId: conversations.userId })
//         .from(conversations)
//         .where(eq(conversations.id, currentChatId))
//         .limit(1);

//       if (!existingChat) {
//         throw new ApiError("Chat tidak ditemukan", 404, "CHAT_NOT_FOUND");
//       }
//       if (existingChat.userId !== userId) {
//         throw new ApiError(
//           "Anda tidak memiliki akses ke chat ini",
//           403,
//           "CHAT_ACCESS_DENIED"
//         );
//       }
//     }

//     const [userMessage] = await db
//       .insert(messages)
//       .values({
//         chatId: currentChatId,
//         role: "user",
//         content: message,
//         createdAt: new Date(),
//       })
//       .returning();

//     // Edited here: Your original RAG implementation
//     const ragResults = await findRelevantContents(message);

//     const aiResponse = await generateAiResponse(message, ragResults);
//     const [aiMessage] = await db
//       .insert(messages)
//       .values({
//         chatId: currentChatId,
//         role: "bot",
//         content: aiResponse,
//         createdAt: new Date(),
//       })
//       .returning();

//     const sources = ragResults.map((r) => ({
//       title: r.title || "Sumber Internal",
//       source: r.source || "INTERNAL",
//       similarity: r.similarity || 0,
//     }));

//     // Edited here: Your original AI message insertion

//     return NextResponse.json({
//       success: true,
//       data: {
//         chatId: currentChatId,
//         userMessage,
//         aiMessage,
//         sources,
//         context: {
//           totalSources: sources.length,
//           hasExternalData: sources.some((s) => s.source !== "INTERNAL"),
//         },
//       },
//     });
//   } catch (error) {
//     console.error("Chat error: ", error);
//     if (error instanceof ApiError) throw error;
//     throw new ApiError(
//       "Failed to process chat message",
//       500,
//       "CHAT_PROCESSING_ERROR"
//     );
//   }
// }

// Edited here: Your original superior AI response generation
async function generateAiResponse(
  userMessage: string,
  contextData: Array<{
    title?: string;
    source?: string;
    content?: string;
    data?: unknown;
    similarity?: number;
  }>
) {
  try {
    // Context disabled - chatbot answers freely without RAG restrictions
    // const context =
    //   contextData.length > 0
    //     ? `
    // KONTEKS INFORMASI:
    // ${contextData
    //   .map(
    //     (item, index) => `
    // [SUMBER ${index + 1}: ${
    //       item.source?.toUpperCase() || "INTERNAL"
    //     } - Relevansi: ${((item.similarity || 0) * 100).toFixed(1)}%]
    // ${
    //   typeof item.data === "object"
    //     ? JSON.stringify(item.data, null, 2)
    //     : item.content
    // }
    // ---`
    //   )
    //   .join("\n")}
    // `
    //     : "KONTEKS: Tidak ada informasi spesifik ditemukan di database untuk pertanyaan ini.";

    const systemPrompt = `
Anda adalah asisten AI yang membantu dan ramah.
Tugas Anda adalah menjawab pertanyaan pengguna dengan akurat dan informatif.

PERATURAN:
1. Gunakan Bahasa Indonesia
2. Berikan jawaban yang terstruktur dan mudah dibaca
3. Jawab pertanyaan pengguna sebaik mungkin
`;

    const augmentedPrompt = `${systemPrompt}\nPERTANYAAN PENGGUNA: "${userMessage}"\nJAWABAN ANDA:`;

    const result = await genAI.models.generateContent({
      model: generativeModel,
      contents: augmentedPrompt,
    });

    return (
      result.text || "Maaf, tidak dapat memproses permintaan Anda saat ini."
    );
  } catch (error) {
    console.error("AI generation error:", error);
    return "Maaf, terjadi kesalahan dalam memproses pertanyaan Anda. Silakan coba lagi.";
  }
}

// Create a new handler that supports both authenticated and anonymous users
async function hybridChatHandler(request: NextRequest) {
  const body = await request.json();
  const { message, chatId } = chatMessageSchema.parse(body);
  const db = getDb();

  // Try to get user authentication, but don't require it
  let userId = null;

  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (payload.type === "access") {
        userId = payload.userId;
      }
    }
  } catch {
    // No valid auth token, continuing as guest user
  }

  // Convert chatId to ensure it's a valid UUID string for database
  let currentChatId = chatId; // No conversion needed since schema validates UUID format

  // Save user message for authenticated users
  let userMessage = null;
  if (userId) {
    try {
      if (!currentChatId) {
        const title = await generateChatTitle(message);
        const [newChat] = await db
          .insert(conversations)
          .values({
            userId: userId,
            title: title || "New Chat",
            createdAt: new Date(),
            isGuestChat: false,
          })
          .returning({ id: conversations.id });
        currentChatId = newChat.id;
      } else {
        // Verify ownership for authenticated users
        const [existingChat] = await db
          .select({ userId: conversations.userId })
          .from(conversations)
          .where(eq(conversations.id, currentChatId))
          .limit(1);

        if (!existingChat) {
          throw new ApiError("Chat tidak ditemukan", 404, "CHAT_NOT_FOUND");
        }
        if (existingChat.userId !== userId) {
          throw new ApiError(
            "Anda tidak memiliki akses ke chat ini",
            403,
            "CHAT_ACCESS_DENIED"
          );
        }
      }

      // Save user message for authenticated users
      [userMessage] = await db
        .insert(messages)
        .values({
          chatId: currentChatId,
          role: "user",
          content: message,
          createdAt: new Date(),
        })
        .returning();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error("Database error for authenticated user:", error);
      throw new ApiError("Failed to save message", 500);
    }
  }

  // For guest users - create temporary chat with 1-day expiration
  else {
    try {
      if (!currentChatId) {
        const title = await generateChatTitle(message);
        const guestSessionId = `guest_${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 1); // 1 day from now

        const [newGuestChat] = await db
          .insert(conversations)
          .values({
            userId: null, // No user ID for guest chats
            title: title || "Guest Chat",
            createdAt: new Date(),
            isGuestChat: true,
            guestSessionId: guestSessionId,
            expiresAt: expiresAt,
          })
          .returning({ id: conversations.id });
        currentChatId = newGuestChat.id;
      } else {
        // For guest users with existing chatId, verify it's a guest chat
        const [existingChat] = await db
          .select({
            isGuestChat: conversations.isGuestChat,
            expiresAt: conversations.expiresAt,
          })
          .from(conversations)
          .where(eq(conversations.id, currentChatId))
          .limit(1);

        if (!existingChat) {
          throw new ApiError("Chat tidak ditemukan", 404, "CHAT_NOT_FOUND");
        }
        if (!existingChat.isGuestChat) {
          throw new ApiError(
            "Akses ditolak ke chat pengguna terdaftar",
            403,
            "CHAT_ACCESS_DENIED"
          );
        }
        // Check if guest chat has expired
        if (existingChat.expiresAt && new Date() > existingChat.expiresAt) {
          throw new ApiError(
            "Chat sementara telah kedaluwarsa",
            410,
            "CHAT_EXPIRED"
          );
        }
      }

      // Save user message for guest users
      if (!userMessage) {
        [userMessage] = await db
          .insert(messages)
          .values({
            chatId: currentChatId,
            role: "user",
            content: message,
            createdAt: new Date(),
          })
          .returning();
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error("Database error for guest user:", error);
      throw new ApiError("Failed to save guest message", 500);
    }
  }

  // Generate AI response (works for both authenticated and guest users)
  const ragResults = await findRelevantContents(message);
  const aiResponse = await generateAiResponse(message, ragResults);

  // Save AI response for both authenticated and guest users
  let aiMessage = null;
  if (currentChatId) {
    try {
      [aiMessage] = await db
        .insert(messages)
        .values({
          chatId: currentChatId,
          role: "bot",
          content: aiResponse,
          createdAt: new Date(),
        })
        .returning();
    } catch (error) {
      console.error("Error saving AI response:", error);
      // Continue without saving - user still gets response
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      chatId: currentChatId, // Always return chatId for both user types
      userMessage: userMessage
        ? {
            id: userMessage.id,
            role: userMessage.role,
            content: userMessage.content,
            timestamp: userMessage.createdAt,
          }
        : undefined,
      aiMessage: aiMessage
        ? {
            id: aiMessage.id,
            role: aiMessage.role,
            content: aiMessage.content,
            timestamp: aiMessage.createdAt,
          }
        : {
            role: "bot",
            content: aiResponse,
          },
      sources: ragResults.map((r) => ({
        title: r.title || "Internal Source",
        source: r.source || "INTERNAL",
      })),
    },
  });
} // Export the new hybrid handler with rate limiting for guest users
export const POST = (request: NextRequest) =>
  withMiddleware(
    createRateLimitMiddleware(30, 60000) // 30 requests per minute for chat endpoint
  )(request, hybridChatHandler);
