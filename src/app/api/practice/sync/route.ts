import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readVerifiedGuestId } from "@/lib/auth/guest-session";
import { resolveOptionalUserId } from "@/lib/auth/optional-session";
import { syncPracticeAttempt } from "@/lib/services/practice.service";
import {
  ApiError,
  createRateLimitMiddleware,
  withMiddleware,
} from "@/middleware/api";

const practiceSyncSchema = z.object({
  sessionId: z.string().uuid(),
  questionId: z.string().uuid(),
  chatId: z.string().uuid().nullish(),
  selectedOption: z.enum(["A", "B", "C", "D", "E"]),
  usedHint: z.boolean().optional(),
  timeSpentSeconds: z.number().int().min(0).max(7200).optional(),
});

async function handlePostPracticeSync(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    throw new ApiError("Body JSON tidak valid", 400, "INVALID_JSON");
  }

  const payload = practiceSyncSchema.parse(rawBody);
  const userId = await resolveOptionalUserId("POST /api/practice/sync");
  const guestSessionId = userId ? null : await readVerifiedGuestId(request);

  const result = await syncPracticeAttempt({
    sessionId: payload.sessionId,
    questionId: payload.questionId,
    chatId: payload.chatId,
    userId,
    guestSessionId,
    selectedOption: payload.selectedOption,
    usedHint: payload.usedHint,
    timeSpentSeconds: payload.timeSpentSeconds,
  });

  return NextResponse.json({
    success: true,
    data: result,
  });
}

const practiceRateLimit = createRateLimitMiddleware({
  prefix: "practice-sync",
  windowMs: 60_000,
  max: 60,
  guestMax: 60,
});

export const POST = (request: NextRequest) =>
  withMiddleware(practiceRateLimit)(request, handlePostPracticeSync);
