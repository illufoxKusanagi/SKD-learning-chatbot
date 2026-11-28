import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readVerifiedGuestId } from "@/lib/auth/guest-session";
import { resolveOptionalUserId } from "@/lib/auth/optional-session";
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

async function handleGetTryoutSession(
  request: NextRequest,
  context: { params: Promise<TryoutSessionParams> }
) {
  const { id } = await context.params;
  const userId = await resolveOptionalUserId("GET /api/tryout/sessions/[id]");
  const guestSessionId = userId ? null : await readVerifiedGuestId(request);
  const state = await getTryoutSessionState({
    sessionId: id,
    userId,
    guestSessionId,
  });

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
  const guestSessionId = userId ? null : await readVerifiedGuestId(request);

  const updated = await updateTryoutProgress({
    sessionId: id,
    userId,
    guestSessionId,
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
  const guestSessionId = userId ? null : await readVerifiedGuestId(request);

  const finalized = await finalizeTryoutSession({
    sessionId: id,
    userId,
    guestSessionId,
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
