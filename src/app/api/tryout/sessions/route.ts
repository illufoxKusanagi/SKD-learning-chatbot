import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  listTryoutSessions,
  startTryoutSession,
} from "@/lib/services/tryout.service";
import {
  ApiError,
  createRateLimitMiddleware,
  withMiddleware,
} from "@/middleware/api";

export const maxDuration = 30;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const startTryoutSchema = z.object({
  mode: z.enum(["cat_tryout", "mini_tryout"]),
  guestSessionId: z.string().uuid().nullish(),
  guestSessionIds: z.array(z.string().uuid()).optional(),
});

function parseSessionIdsParam(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const items = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (items.length === 0) return undefined;

  for (const id of items) {
    if (!UUID_REGEX.test(id)) {
      throw new ApiError(
        `Format sessionIds tidak valid: ${id}`,
        400,
        "INVALID_SESSION_ID"
      );
    }
  }
  return items;
}

async function resolveOptionalUserId(logLabel: string): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      return session.user.id;
    }
  } catch (authErr) {
    console.warn(`[${logLabel}] Session retrieval warning:`, authErr);
  }
  return null;
}

async function handleGetTryoutSessions(request: NextRequest) {
  const url = new URL(request.url);
  const guestSessionIds = parseSessionIdsParam(
    url.searchParams.get("sessionIds")
  );
  const userId = await resolveOptionalUserId("GET /api/tryout/sessions");

  const sessions = await listTryoutSessions({
    userId,
    guestSessionIds,
  });

  return NextResponse.json({
    success: true,
    data: sessions,
  });
}

async function handlePostTryoutSessions(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    throw new ApiError("Body JSON tidak valid", 400, "INVALID_JSON");
  }

  const payload = startTryoutSchema.parse(rawBody);
  const userId = await resolveOptionalUserId("POST /api/tryout/sessions");

  const session = await startTryoutSession({
    mode: payload.mode,
    userId,
    guestSessionId: payload.guestSessionId,
    guestSessionIds: payload.guestSessionIds,
  });

  return NextResponse.json(
    {
      success: true,
      data: session,
    },
    { status: 201 }
  );
}

const tryoutSessionsRateLimit = createRateLimitMiddleware({
  prefix: "tryout-sessions",
  windowMs: 60_000,
  max: 60,
  guestMax: 60,
});

export const GET = (request: NextRequest) =>
  withMiddleware(tryoutSessionsRateLimit)(request, handleGetTryoutSessions);

export const POST = (request: NextRequest) =>
  withMiddleware(tryoutSessionsRateLimit)(request, handlePostTryoutSessions);
