import { getDb } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// This endpoint cleans up expired guest chats
export async function DELETE(request: NextRequest) {
  try {
    const db = getDb();
    const now = new Date();

    // Find expired guest chats
    const expiredGuestChats = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.isGuestChat, true),
          isNotNull(conversations.expiresAt),
          lt(conversations.expiresAt, now)
        )
      );

    if (expiredGuestChats.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No expired guest chats found",
        deletedCount: 0,
      });
    }

    // Delete messages associated with expired guest chats
    for (const chat of expiredGuestChats) {
      await db.delete(messages).where(eq(messages.chatId, chat.id));
    }

    // Delete the expired guest chats themselves
    const deletedChats = await db
      .delete(conversations)
      .where(
        and(
          eq(conversations.isGuestChat, true),
          isNotNull(conversations.expiresAt),
          lt(conversations.expiresAt, now)
        )
      );

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${expiredGuestChats.length} expired guest chats`,
      deletedCount: expiredGuestChats.length,
    });
  } catch (error) {
    console.error("Error cleaning up guest chats:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to cleanup guest chats",
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Guest chat cleanup service is running",
    timestamp: new Date().toISOString(),
  });
}
