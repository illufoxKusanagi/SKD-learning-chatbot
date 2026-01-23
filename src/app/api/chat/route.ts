import { getDb } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
// import { findRelevantContents } from "@/lib/services/ai/rag.service";
import {
  ApiError,
  withMiddleware,
  createRateLimitMiddleware,
} from "@/middleware/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";
import {
  generateAiResponse,
  generateChatTitle,
} from "@/lib/services/ai/gemini.service";
// const genAI = new GoogleGenAI({ apiKey });

const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(4000, "Message is too long")
    .trim(),
  chatId: z.uuid("Invalid chat ID format").optional(), // Only accept UUID strings
});

// Edited here: Fixed generateChatTitle function that was missing
// async function generateChatTitle(message: string): Promise<string> {
//   try {
//     const result = await genAI.models.generateContent({
//       model: generativeModel,
//       contents: `Generate a short, descriptive title (max 50 characters) for a chat that starts with: "${message}". Return only the title.`,
//     });
//     const title = result.text?.trim() || "New Chat";
//     return title.length > 50 ? title.substring(0, 47) + "..." : title;
//   } catch (error) {
//     console.error("Title generation error:", error);
//     return "New Chat";
//   }
// }

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
// async function generateAiResponse(userMessage: string) {
//   try {
//     // Context disabled - chatbot answers freely without RAG restrictions
//     // const context =
//     //   contextData.length > 0
//     //     ? `
//     // KONTEKS INFORMASI:
//     // ${contextData
//     //   .map(
//     //     (item, index) => `
//     // [SUMBER ${index + 1}: ${
//     //       item.source?.toUpperCase() || "INTERNAL"
//     //     } - Relevansi: ${((item.similarity || 0) * 100).toFixed(1)}%]
//     // ${
//     //   typeof item.data === "object"
//     //     ? JSON.stringify(item.data, null, 2)
//     //     : item.content
//     // }
//     // ---`
//     //   )
//     //   .join("\n")}
//     // `
//     //     : "KONTEKS: Tidak ada informasi spesifik ditemukan di database untuk pertanyaan ini.";

//     const systemPrompt = `
// "Kamu adalah Tutor SKD CPNS yang ahli dan up-to-date. Tugasmu adalah membantu pengguna berlatih soal-soal SKD (TWK, TIU, TKP).

// ATURAN PENTING:

// - Jika pengguna meminta soal 'terbaru' atau bertanya tentang isu terkini (seperti IKN, kebijakan pemerintah baru), JANGAN mengarang jawaban. GUNAKAN tool googleSearch() untuk mencari referensi valid.
// - Berikan pembahasan yang jelas dan mendidik.
// - Sertakan sumber informasi jika kamu mengambil data dari internet."
// `;

//     const augmentedPrompt = `${systemPrompt}\nPERTANYAAN PENGGUNA: "${userMessage}"\nJAWABAN ANDA:`;

//     const result = await genAI.models.generateContent({
//       model: generativeModel,
//       contents: augmentedPrompt,
//       config: {
//         tools: [{ googleSearch: {} }],
//       },
//     });

//     return (
//       result.text || "Maaf, tidak dapat memproses permintaan Anda saat ini."
//     );
//   } catch (error) {
//     console.error("AI generation error:", error);
//     return "Maaf, terjadi kesalahan dalam memproses pertanyaan Anda. Silakan coba lagi.";
//   }
// }

// Create a new handler that supports both authenticated and anonymous users
async function hybridChatHandler(request: NextRequest) {
  const body = await request.json();
  const { message, chatId } = chatMessageSchema.parse(body);
  const db = getDb();

  // Try to get user authentication, but don't require it
  let userId = null;

  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      userId = session.user.id;
    }
  } catch (error) {
    // Distinguish between expected auth failures and unexpected internal errors
    if (error instanceof Error) {
      console.error("Error retrieving session in hybridChatHandler:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      const messageLower = error.message.toLowerCase();
      const isAuthError =
        error.name === "AuthError" ||
        messageLower.includes("auth") ||
        messageLower.includes("credential") ||
        messageLower.includes("unauthorized") ||
        messageLower.includes("forbidden");

      if (!isAuthError) {
        // Treat non-auth-related failures as internal errors instead of silently
        // falling back to a guest user, to avoid masking configuration issues.
        throw new ApiError(
          "Failed to retrieve session",
          500,
          "SESSION_RETRIEVAL_ERROR",
        );
      }

      // Auth-related error: continue as guest user
      console.warn(
        "Proceeding as guest user due to authentication-related session error.",
      );
    } else {
      console.error(
        "Non-Error value thrown during session retrieval in hybridChatHandler:",
        error,
      );
      throw new ApiError(
        "Failed to retrieve session",
        500,
        "SESSION_RETRIEVAL_ERROR",
      );
    }
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
            "CHAT_ACCESS_DENIED",
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
            "CHAT_ACCESS_DENIED",
          );
        }
        // Check if guest chat has expired
        if (existingChat.expiresAt && new Date() > existingChat.expiresAt) {
          throw new ApiError(
            "Chat sementara telah kedaluwarsa",
            410,
            "CHAT_EXPIRED",
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

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullAiResponse = "";

      try {
        const generator = generateAiResponse(message);

        for await (const chunk of generator) {
          // Send chunk to client
          controller.enqueue(encoder.encode(chunk));
          fullAiResponse += chunk;
        }
        controller.close();
        if (currentChatId) {
          try {
            await db.insert(messages).values({
              chatId: currentChatId,
              role: "bot",
              content: fullAiResponse,
              createdAt: new Date(),
            });
          } catch (error) {
            console.error("Error saving AI response:", error);
          }
        }
      } catch (error) {
        console.error("Streaming error:", error);
        controller.error(error);
      }
    },
  });

  const response = new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Chat-Id": currentChatId || "", // Send Chat ID in header
    },
  });

  return response;
}
export const POST = (request: NextRequest) =>
  withMiddleware(
    createRateLimitMiddleware(30, 60000), // 30 requests per minute for chat endpoint
  )(request, hybridChatHandler);
