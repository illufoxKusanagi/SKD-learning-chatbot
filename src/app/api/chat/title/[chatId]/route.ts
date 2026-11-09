import { getDb } from '@/lib/db';
import { conversations } from '@/lib/db/schema';
import {
  withMiddleware,
  createValidationMiddleware,
  createRateLimitMiddleware,
  ApiError,
  RequestWithValidation,
} from '@/middleware/api';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

interface ChatTitleParams {
  chatId: string;
}

const updateTitleSchema = z.object({
  title: z
    .string()
    .min(1, 'Judul tidak boleh kosong')
    .max(100, 'Judul terlalu panjang (maksimal 100 karakter)')
    .trim(),
});

async function getChatTitleHandler(
  request: NextRequest,
  { params }: { params: Promise<ChatTitleParams> }
) {
  let userId: string | null = null;
  let isAuthenticated = false;

  try {
    const session = await getServerSession(authOptions);
    if (session?.user) {
      userId = session.user.id;
      isAuthenticated = true;
    }
  } catch (error) {
    console.log(`[GET_TITLE] Session check failed:`, error);
  }

  const chatId = (await params).chatId;

  try {
    const db = getDb();

    const [chat] = await db
      .select({
        title: conversations.title,
        userId: conversations.userId,
        isGuestChat: conversations.isGuestChat,
        expiresAt: conversations.expiresAt,
      })
      .from(conversations)
      .where(eq(conversations.id, chatId))
      .limit(1);

    if (!chat) {
      throw new ApiError('Chat tidak ditemukan', 404, 'CHAT_NOT_FOUND');
    }

    if (chat.isGuestChat) {
      if (chat.expiresAt && new Date() > chat.expiresAt) {
        throw new ApiError(
          'Chat sementara telah kedaluwarsa',
          410,
          'CHAT_EXPIRED'
        );
      }
    } else {
      if (!isAuthenticated || !userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (chat.userId !== userId) {
        throw new ApiError(
          'Anda tidak memiliki akses ke chat ini',
          403,
          'CHAT_ACCESS_DENIED'
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        chatId,
        title: chat.title || `Chat #${chatId}`,
      },
    });
  } catch (error) {
    console.error(`[GET_TITLE] Error getting title for chat ${chatId}:`, error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      'Gagal mengambil judul chat',
      500,
      'GET_TITLE_ERROR'
      //    {
      //   chatId,
      //   userId,
      // }
    );
  }
}

async function updateChatTitleHandler(
  request: RequestWithValidation<z.infer<typeof updateTitleSchema>>,
  { params }: { params: Promise<ChatTitleParams> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const chatId = (await params).chatId;
  const { title } = request.validatedData || {};

  // if (isNaN(chatId) || chatId <= 0) {
  //   throw new ApiError("ID chat tidak valid", 400, "INVALID_CHAT_ID");
  // }

  console.log(
    `[UPDATE_TITLE] User ${userId} updating title for chat ${chatId} to: ${title}`
  );

  try {
    const db = getDb();

    // Verify chat exists and user owns it
    const [existingChat] = await db
      .select({ userId: conversations.userId })
      .from(conversations)
      .where(eq(conversations.id, chatId))
      .limit(1);

    if (!existingChat) {
      throw new ApiError('Chat tidak ditemukan', 404, 'CHAT_NOT_FOUND');
    }

    if (existingChat.userId !== userId) {
      throw new ApiError(
        'Anda tidak memiliki akses ke chat ini',
        403,
        'CHAT_ACCESS_DENIED'
      );
    }

    // Update the title
    const [updatedChat] = await db
      .update(conversations)
      .set({
        title,
        // updatedAt: new Date(),
      })
      .where(eq(conversations.id, chatId))
      .returning({
        id: conversations.id,
        title: conversations.title,
        // updatedAt: conversations.updatedAt,
      });

    console.log(`[UPDATE_TITLE] Successfully updated title for chat ${chatId}`);

    return NextResponse.json({
      success: true,
      message: 'Judul chat berhasil diperbarui',
      data: {
        chatId: updatedChat.id,
        title: updatedChat.title,
        // updatedAt: updatedChat.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      `[UPDATE_TITLE] Error updating title for chat ${chatId}:`,
      error
    );

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      'Gagal memperbarui judul chat',
      500,
      'UPDATE_TITLE_ERROR'
      // { chatId, userId, title }
    );
  }
}

const getTitleRateLimit = createRateLimitMiddleware({
  prefix: 'chat-title',
  windowMs: 60_000,
  max: 60,
  guestMax: 60,
});
const updateTitleRateLimit = createRateLimitMiddleware({
  prefix: 'chat-title-update',
  windowMs: 60_000,
  max: 20,
  guestMax: 20,
});
const validateTitle = createValidationMiddleware(updateTitleSchema);

export const GET = (
  request: NextRequest,
  context: { params: Promise<ChatTitleParams> }
) => {
  return withMiddleware(getTitleRateLimit)(request, (req) =>
    getChatTitleHandler(req, context)
  );
};

export const PUT = (
  request: NextRequest,
  context: { params: Promise<ChatTitleParams> }
) => {
  return withMiddleware(updateTitleRateLimit, validateTitle)(request, (req) =>
    updateChatTitleHandler(
      req as unknown as RequestWithValidation<
        z.infer<typeof updateTitleSchema>
      >,
      context
    )
  );
};
