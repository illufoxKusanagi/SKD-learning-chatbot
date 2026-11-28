import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema';
import {
  withMiddleware,
  createRateLimitMiddleware,
  ApiError,
} from '@/middleware/api';
import { readVerifiedGuestId } from '@/lib/auth/guest-session';
import { resolveOptionalUserId } from '@/lib/auth/optional-session';
import { eq, asc, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CHAT_PAGE = 10000;

interface ChatParams {
  chatId: string;
}

async function getChatHandler(
  request: NextRequest,
  { params }: { params: Promise<ChatParams> }
) {
  const chatId = (await params).chatId?.trim();
  if (!chatId || !UUID_REGEX.test(chatId)) {
    throw new ApiError('ID chat tidak valid', 400, 'INVALID_CHAT_ID');
  }

  const url = new URL(request.url);
  const rawPage = Number.parseInt(url.searchParams.get('page') || '1', 10);
  const rawLimit = Number.parseInt(url.searchParams.get('limit') || '50', 10);
  const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
  if (page > MAX_CHAT_PAGE) {
    throw new ApiError('Halaman chat tidak valid', 400, 'INVALID_PAGE');
  }
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, rawLimit), 100)
    : 50;
  const offset = (page - 1) * limit;

  const userId = await resolveOptionalUserId('GET_CHAT');
  const isAuthenticated = Boolean(userId);
  if (isAuthenticated) {
    console.log(`[GET_CHAT] Authenticated user: ${userId}`);
  }

  try {
    const [chat] = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        userId: conversations.userId,
        isGuestChat: conversations.isGuestChat,
        guestSessionId: conversations.guestSessionId,
        expiresAt: conversations.expiresAt,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(eq(conversations.id, chatId))
      .limit(1);

    if (!chat) {
      throw new ApiError('Chat tidak ditemukan', 404, 'CHAT_NOT_FOUND');
    }

    if (chat.isGuestChat) {
      const guestId = await readVerifiedGuestId(request);
      if (chat.guestSessionId && chat.guestSessionId !== guestId) {
        throw new ApiError(
          'Anda tidak memiliki akses ke chat ini',
          403,
          'CHAT_ACCESS_DENIED'
        );
      }
      if (chat.expiresAt && new Date() > chat.expiresAt) {
        throw new ApiError(
          'Chat sementara telah kedaluwarsa',
          410,
          'CHAT_EXPIRED'
        );
      }
    } else {
      // For user chats, must be authenticated and own the chat
      if (!isAuthenticated) {
        throw new ApiError(
          'Autentikasi diperlukan untuk chat pengguna',
          401,
          'AUTH_REQUIRED'
        );
      }
      if (chat.userId !== userId) {
        throw new ApiError(
          'Anda tidak memiliki akses ke chat ini',
          403,
          'CHAT_ACCESS_DENIED'
        );
      }
    }

    const [{ totalMessages }] = await db
      .select({
        totalMessages: sql<number>`COUNT(*)`.as('total_messages'),
      })
      .from(messages)
      .where(eq(messages.chatId, chatId));

    const totalCount = Number(totalMessages) || 0;

    const chatMessages = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(asc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(totalCount / limit);

    console.log(
      `[GET_CHAT] Found ${
        chat.isGuestChat ? 'guest' : 'user'
      } chat ${chatId} with ${
        chatMessages.length
      }/${totalCount} messages (page ${page}/${totalPages})`
    );

    return NextResponse.json({
      success: true,
      data: {
        chat: {
          id: chat.id,
          title: chat.title,
          createdAt: chat.createdAt,
          isGuestChat: chat.isGuestChat || false,
          expiresAt: chat.expiresAt,
        },
        messages: chatMessages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.createdAt,
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalMessages: totalCount,
          messagesPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error(`[GET_CHAT] Error fetching chat ${chatId}:`, error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Gagal mengambil data chat', 500, 'GET_CHAT_ERROR');
  }
}

// Hybrid delete handler
async function deleteChatHandler(
  request: NextRequest,
  { params }: { params: Promise<ChatParams> }
) {
  const chatId = (await params).chatId?.trim();
  if (!chatId || !UUID_REGEX.test(chatId)) {
    throw new ApiError('ID chat tidak valid', 400, 'INVALID_CHAT_ID');
  }

  const userId = await resolveOptionalUserId('DELETE_CHAT');
  const isAuthenticated = Boolean(userId);

  console.log(
    `[DELETE_CHAT] ${
      isAuthenticated ? 'User ' + userId : 'Guest'
    } deleting chat ${chatId}`
  );

  try {
    // Get chat details to verify access
    const [chat] = await db
      .select({
        userId: conversations.userId,
        isGuestChat: conversations.isGuestChat,
        guestSessionId: conversations.guestSessionId,
        expiresAt: conversations.expiresAt,
      })
      .from(conversations)
      .where(eq(conversations.id, chatId))
      .limit(1);

    if (!chat) {
      throw new ApiError('Chat tidak ditemukan', 404, 'CHAT_NOT_FOUND');
    }

    // Check permissions
    if (chat.isGuestChat) {
      const guestId = await readVerifiedGuestId(request);
      if (chat.guestSessionId && chat.guestSessionId !== guestId) {
        throw new ApiError(
          'Anda tidak memiliki akses ke chat ini',
          403,
          'CHAT_ACCESS_DENIED'
        );
      }
      if (chat.expiresAt && new Date() > chat.expiresAt) {
        console.log('Deleting expired guest chat');
      }
    } else {
      // User chats require authentication and ownership
      if (!isAuthenticated) {
        throw new ApiError('Autentikasi diperlukan', 401, 'AUTH_REQUIRED');
      }
      if (chat.userId !== userId) {
        throw new ApiError(
          'Anda tidak memiliki akses ke chat ini',
          403,
          'CHAT_ACCESS_DENIED'
        );
      }
    }

    // Delete messages and conversation atomically
    const deletedMessages = await db.transaction(async (tx) => {
      const removedMessages = await tx
        .delete(messages)
        .where(eq(messages.chatId, chatId))
        .returning({ id: messages.id });

      await tx.delete(conversations).where(eq(conversations.id, chatId));
      return removedMessages;
    });

    console.log(
      `[DELETE_CHAT] Deleted ${
        chat.isGuestChat ? 'guest' : 'user'
      } chat ${chatId} and ${deletedMessages.length} messages`
    );

    return NextResponse.json({
      success: true,
      message: 'Chat berhasil dihapus',
      data: {
        deletedChatId: chatId,
        deletedMessageCount: deletedMessages.length,
      },
    });
  } catch (error) {
    console.error(`[DELETE_CHAT] Error deleting chat ${chatId}:`, error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Gagal menghapus chat', 500, 'DELETE_CHAT_ERROR');
  }
}

const getChatRateLimit = createRateLimitMiddleware({
  prefix: 'chat-get',
  windowMs: 60_000,
  max: 60,
  guestMax: 60,
});
const deleteChatRateLimit = createRateLimitMiddleware({
  prefix: 'chat-delete',
  windowMs: 60_000,
  max: 10,
  guestMax: 10,
});

export const GET = (
  request: NextRequest,
  context: { params: Promise<ChatParams> }
) => {
  return withMiddleware(getChatRateLimit)(request, (req) =>
    getChatHandler(req, context)
  );
};

export const DELETE = (
  request: NextRequest,
  context: { params: Promise<ChatParams> }
) => {
  return withMiddleware(deleteChatRateLimit)(request, (req) =>
    deleteChatHandler(req, context)
  );
};
