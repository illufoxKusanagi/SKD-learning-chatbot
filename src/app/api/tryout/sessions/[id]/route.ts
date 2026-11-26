import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  finalizeTryoutSession,
  getTryoutSessionState,
  updateTryoutProgress,
} from "@/lib/services/tryout.service";
import {
  ApiError,
  createRateLimitMiddleware,
  withMiddleware,
} from "@/middleware/api";

export const maxDuration = 30;

interface TryoutSessionParams {
  id: string;
}

const patchTryoutSchema = z.object({
  questionId: z.string().uuid(),
  selectedOption: z.enum(["A", "B", "C", "D", "E"]).nullable().optional(),
  isFlagged: z.boolean().optional(),
  timeSpentDeltaSeconds: z.number().int().min(0).max(86400).optional(),
});

const postTryoutActionSchema = z.object({
  action: z.literal("finish"),
});

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

async function handleGetTryoutSession(
  _request: NextRequest,
  context: { params: Promise<TryoutSessionParams> }
) {
  const { id } = await context.params;
  const userId = await resolveOptionalUserId("GET /api/tryout/sessions/[id]");
  const state = await getTryoutSessionState({ sessionId: id, userId });

  return NextResponse.json({
    success: true,
    data: state,
  });
}

async function handlePatchTryoutSession(
  request: NextRequest,
  context: { params: Promise<TryoutSessionParams> }
) {
  const { id } = await context.params;
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    throw new ApiError("Body JSON tidak valid", 400, "INVALID_JSON");
  }

  const payload = patchTryoutSchema.parse(rawBody);
  const userId = await resolveOptionalUserId("PATCH /api/tryout/sessions/[id]");

  const updated = await updateTryoutProgress({
    sessionId: id,
    userId,
    questionId: payload.questionId,
    selectedOption: payload.selectedOption,
    isFlagged: payload.isFlagged,
    timeSpentDeltaSeconds: payload.timeSpentDeltaSeconds,
  });

  return NextResponse.json({
    success: true,
    data: updated,
  });
}

async function handlePostTryoutSession(
  request: NextRequest,
  context: { params: Promise<TryoutSessionParams> }
) {
  const { id } = await context.params;
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    throw new ApiError("Body JSON tidak valid", 400, "INVALID_JSON");
  }

  postTryoutActionSchema.parse(rawBody);
  const userId = await resolveOptionalUserId("POST /api/tryout/sessions/[id]");

  const finalized = await finalizeTryoutSession({
    sessionId: id,
    userId,
  });

  return NextResponse.json({
    success: true,
    data: finalized,
  });
}

const tryoutSessionRateLimit = createRateLimitMiddleware({
  prefix: "tryout-session",
  windowMs: 60_000,
  max: 60,
  guestMax: 60,
});

export const GET = (
  request: NextRequest,
  context: { params: Promise<TryoutSessionParams> }
) =>
  withMiddleware(tryoutSessionRateLimit)(request, (req) =>
    handleGetTryoutSession(req, context)
  );

export const PATCH = (
  request: NextRequest,
  context: { params: Promise<TryoutSessionParams> }
) =>
  withMiddleware(tryoutSessionRateLimit)(request, (req) =>
    handlePatchTryoutSession(req, context)
  );

export const POST = (
  request: NextRequest,
  context: { params: Promise<TryoutSessionParams> }
) =>
  withMiddleware(tryoutSessionRateLimit)(request, (req) =>
    handlePostTryoutSession(req, context)
  );
