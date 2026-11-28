import { db } from '@/lib/db';
import { conversations, messages, questionAccessLogs } from '@/lib/db/schema';
import {
  ApiError,
  createRateLimitMiddleware,
  withMiddleware,
} from '@/middleware/api';
import { and, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

async function verifyCronAuthorization(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || !authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const providedToken = authHeader.slice('Bearer '.length);
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(providedToken)),
    crypto.subtle.digest('SHA-256', encoder.encode(cronSecret)),
  ]);

  const a = new Uint8Array(providedHash);
  const b = new Uint8Array(expectedHash);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

const cleanupRateLimit = createRateLimitMiddleware({
  prefix: 'cleanup-guest',
  windowMs: 60_000,
  max: 5,
  guestMax: 5,
});

async function handleCleanupGuestChats(request: NextRequest) {
  const authorized = await verifyCronAuthorization(request);
  if (!authorized) {
    throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const now = new Date();
  const guestAccessCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

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
    const deletedAccessLogs = await db
      .delete(questionAccessLogs)
      .where(
        and(
          isNull(questionAccessLogs.userId),
          lt(questionAccessLogs.lastAccessedAt, guestAccessCutoff)
        )
      )
      .returning({ id: questionAccessLogs.id });

    return NextResponse.json({
      success: true,
      message: 'No expired guest chats found',
      deletedCount: 0,
      deletedGuestAccessLogsCount: deletedAccessLogs.length,
    });
  }

  const expiredIds = expiredGuestChats.map((c) => c.id);
  let deletedGuestAccessLogsCount = 0;

  await db.transaction(async (tx) => {
    await tx.delete(messages).where(inArray(messages.chatId, expiredIds));
    await tx
      .delete(conversations)
      .where(inArray(conversations.id, expiredIds));
    const deletedAccessLogs = await tx
      .delete(questionAccessLogs)
      .where(
        and(
          isNull(questionAccessLogs.userId),
          lt(questionAccessLogs.lastAccessedAt, guestAccessCutoff)
        )
      )
      .returning({ id: questionAccessLogs.id });
    deletedGuestAccessLogsCount = deletedAccessLogs.length;
  });

  return NextResponse.json({
    success: true,
    message: `Successfully deleted ${expiredGuestChats.length} expired guest chats`,
    deletedCount: expiredGuestChats.length,
    deletedGuestAccessLogsCount,
  });
}

// This endpoint cleans up expired guest chats
export const DELETE = (request: NextRequest) =>
  withMiddleware(cleanupRateLimit)(request, handleCleanupGuestChats);

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Guest chat cleanup service is running',
    timestamp: new Date().toISOString(),
  });
}
