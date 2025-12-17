import { getDb } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import {
  withMiddleware,
  createAuthMiddleware,
  createValidationMiddleware,
  createRateLimitMiddleware,
  ApiError,
  AuthenticatedRequest,
} from "@/middleware/api";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

interface ChatTitleParams {
  chatId: string;
}

const updateTitleSchema = z.object({
  title: z
    .string()
    .min(1, "Judul tidak boleh kosong")
    .max(100, "Judul terlalu panjang (maksimal 100 karakter)")
    .trim(),
});

async function getChatTitleHandler(
  request: AuthenticatedRequest,
  { params }: { params: ChatTitleParams }
) {
  const userId = request.user!.userId;
  const chatId = params.chatId;

  // if (isNaN(chatId) || chatId <= 0) {
  //   throw new ApiError("ID chat tidak valid", 400, "INVALID_CHAT_ID");
  // }

  try {
    const db = getDb();

    const [chat] = await db
      .select({
        title: conversations.title,
        userId: conversations.userId,
      })
      .from(conversations)
      .where(eq(conversations.id, chatId))
      .limit(1);

    if (!chat) {
      throw new ApiError("Chat tidak ditemukan", 404, "CHAT_NOT_FOUND");
    }

    if (chat.userId !== userId) {
      throw new ApiError(
        "Anda tidak memiliki akses ke chat ini",
        403,
        "CHAT_ACCESS_DENIED"
      );
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
      "Gagal mengambil judul chat",
      500,
      "GET_TITLE_ERROR"
      //    {
      //   chatId,
      //   userId,
      // }
    );
  }
}

async function updateChatTitleHandler(
  request: AuthenticatedRequest & { validatedData?: any },
  { params }: { params: Promise<ChatTitleParams> }
) {
  const userId = request.user!.userId;
  const chatId = (await params).chatId;
  const { title } = request.validatedData;

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
      throw new ApiError("Chat tidak ditemukan", 404, "CHAT_NOT_FOUND");
    }

    if (existingChat.userId !== userId) {
      throw new ApiError(
        "Anda tidak memiliki akses ke chat ini",
        403,
        "CHAT_ACCESS_DENIED"
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
      message: "Judul chat berhasil diperbarui",
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
      "Gagal memperbarui judul chat",
      500,
      "UPDATE_TITLE_ERROR"
      // { chatId, userId, title }
    );
  }
}

export const GET = (
  request: NextRequest,
  context: { params: ChatTitleParams }
) => {
  return withMiddleware(
    createRateLimitMiddleware(60, 60000),
    createAuthMiddleware()
  )(request, (req) => getChatTitleHandler(req, context));
};

export const PUT = (
  request: NextRequest,
  context: { params: Promise<ChatTitleParams> }
) => {
  return withMiddleware(
    createRateLimitMiddleware(20, 60000),
    createAuthMiddleware(),
    createValidationMiddleware(updateTitleSchema)
  )(request, (req) => updateChatTitleHandler(req, context));
};
