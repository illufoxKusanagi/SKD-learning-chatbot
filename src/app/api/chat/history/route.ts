import { getDb } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import {
  withMiddleware,
  createRateLimitMiddleware,
  ApiError,
} from "@/middleware/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

async function getChatHistoryHandler(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  console.log(`[CHAT_HISTORY] Fetching history for user: ${userId}`);

  try {
    const db = getDb();

    // Get chat history with message counts
    const chats = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        createdAt: conversations.createdAt,
        // updatedAt: conversations.updatedAt,
        messageCount: sql<number>`(
          SELECT COUNT(*) FROM ${messages} 
          WHERE ${messages.chatId} = ${conversations.id}
        )`.as("message_count"),
        lastMessage: sql<string>`(
          SELECT ${messages.content} FROM ${messages} 
          WHERE ${messages.chatId} = ${conversations.id}
          ORDER BY ${messages.createdAt} DESC 
          LIMIT 1
        )`.as("last_message"),
      })
      .from(conversations)
      .where(eq(conversations.userId, userId))
      // .orderBy(desc(conversations.updatedAt))
      .limit(50); // Limit to last 50 chats

    console.log(
      `[CHAT_HISTORY] Found ${chats.length} chats for user ${userId}`
    );

    return NextResponse.json({
      success: true,
      data: {
        chats: chats.map((chat) => ({
          id: chat.id,
          title: chat.title,
          messageCount: Number(chat.messageCount) || 0,
          lastMessage: chat.lastMessage
            ? chat.lastMessage.length > 100
              ? chat.lastMessage.substring(0, 97) + "..."
              : chat.lastMessage
            : null,
          createdAt: chat.createdAt,
          // updatedAt: chat.updatedAt,
        })),
        total: chats.length,
      },
    });
  } catch (error) {
    console.error(`[CHAT_HISTORY] Error fetching history:`, error);
    throw new ApiError(
      "Gagal mengambil riwayat chat",
      500,
      "CHAT_HISTORY_ERROR"
      // { userId }
    );
  }
}

export const GET = (request: NextRequest) => {
  return withMiddleware(
    createRateLimitMiddleware(30, 60000) // 30 requests per minute
  )(request, getChatHistoryHandler);
};
