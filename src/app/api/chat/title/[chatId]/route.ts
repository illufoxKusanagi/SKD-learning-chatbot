import { db } from '@/lib/db';
import { conversations } from '@/lib/db/schema';
import {
  withMiddleware,
  createValidationMiddleware,
  createRateLimitMiddleware,
  ApiError,
  RequestWithValidation,
} from '@/middleware/api';
import { readVerifiedGuestId } from '@/lib/auth/guest-session';
import { resolveOptionalUserId } from '@/lib/auth/optional-session';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const chatId = (await params).chatId?.trim();
  if (!chatId || !UUID_REGEX.test(chatId)) {
    throw new ApiError('ID chat tidak valid', 400, 'INVALID_CHAT_ID');
  }

  const userId = await resolveOptionalUserId('GET_TITLE');
  const isAuthenticated = Boolean(userId);

  try {
    const [chat] = await db
      .select({
        title: conversations.title,
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
      if (!isAuthenticated || !userId) {
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
    );
  }
}

async function updateChatTitleHandler(
  request: RequestWithValidation<z.infer<typeof updateTitleSchema>>,
  { params }: { params: Promise<ChatTitleParams> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new ApiError('Autentikasi diperlukan', 401, 'AUTH_REQUIRED');
  }

  const userId = session.user.id;
  const chatId = (await params).chatId?.trim();
  if (!chatId || !UUID_REGEX.test(chatId)) {
    throw new ApiError('ID chat tidak valid', 400, 'INVALID_CHAT_ID');
  }

  const { title } = request.validatedData || {};

  console.log(
    `[UPDATE_TITLE] User ${userId} updating title for chat ${chatId} to: ${title}`
  );

  try {
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
      })
      .where(eq(conversations.id, chatId))
      .returning({
        id: conversations.id,
        title: conversations.title,
      });

    console.log(`[UPDATE_TITLE] Successfully updated title for chat ${chatId}`);

    return NextResponse.json({
      success: true,
      message: 'Judul chat berhasil diperbarui',
      data: {
        chatId: updatedChat.id,
        title: updatedChat.title,
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
