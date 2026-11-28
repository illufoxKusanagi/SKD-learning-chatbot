import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  attachGuestCookie,
  getOrCreateGuestSession,
} from "@/lib/auth/guest-session";
import { resolveOptionalUserId } from "@/lib/auth/optional-session";
import { createPracticePack } from "@/lib/services/practice.service";
import {
  ApiError,
  createRateLimitMiddleware,
  withMiddleware,
} from "@/middleware/api";

const practicePackSchema = z.object({
  count: z.union([z.literal(10), z.literal(15), z.literal(20)]).optional(),
  category: z.enum(["TWK", "TIU", "TKP"]).optional(),
  subtopic: z.string().trim().max(160).optional(),
  materialSlug: z.string().trim().max(160).optional(),
  wrongOnly: z.boolean().optional(),
  questionIds: z.array(z.string().uuid()).optional(),
  chatIds: z.array(z.string().uuid()).optional(),
  sessionIds: z.array(z.string().uuid()).optional(),
});

async function handlePostPracticePack(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    throw new ApiError("Body JSON tidak valid", 400, "INVALID_JSON");
  }

  const payload = practicePackSchema.parse(rawBody);
  const userId = await resolveOptionalUserId("POST /api/practice/pack");

  let guestSessionId: string | null = null;
  let setCookieHeader: string | null = null;
  if (!userId) {
    const guest = await getOrCreateGuestSession(request);
    guestSessionId = guest.guestId;
    setCookieHeader = guest.setCookieHeader;
  }

  const pack = await createPracticePack({
    count: payload.count ?? 10,
    category: payload.category,
    subtopic: payload.subtopic || undefined,
    materialSlug: payload.materialSlug || undefined,
    wrongOnly: payload.wrongOnly,
    questionIds: payload.questionIds,
    userId,
    guestSessionId,
    guestChatIds: payload.chatIds,
    guestSessionIds: payload.sessionIds,
  });

  const response = NextResponse.json({
    success: true,
    data: pack,
  });

  return attachGuestCookie(response, setCookieHeader);
}

const practiceRateLimit = createRateLimitMiddleware({
  prefix: "practice",
  windowMs: 60_000,
  max: 60,
  guestMax: 60,
});

export const POST = (request: NextRequest) =>
  withMiddleware(practiceRateLimit)(request, handlePostPracticePack);
