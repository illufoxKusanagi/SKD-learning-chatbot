import { NextRequest, NextResponse } from 'next/server';
import { resolveOptionalUserId } from '@/lib/auth/optional-session';
import { listStudyMaterials } from '@/lib/services/material.service';
import { CANONICAL_SUBTOPICS } from '@/lib/validation/content-contract';
import {
  ApiError,
  createRateLimitMiddleware,
  withMiddleware,
} from '@/middleware/api';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handleGetMaterials(request: NextRequest) {
  const url = new URL(request.url);
  const rawSubtopic = url.searchParams.get('subtopic')?.trim() || undefined;
  const search = url.searchParams.get('q')?.trim() || undefined;
  const weakOnlyParam = url.searchParams.get('weakOnly')?.trim().toLowerCase();
  const weakOnly = weakOnlyParam === 'true' || weakOnlyParam === '1';
  const chatIdsParam = url.searchParams.get('chatIds');

  if (
    rawSubtopic &&
    !(CANONICAL_SUBTOPICS.TWK as readonly string[]).includes(rawSubtopic)
  ) {
    throw new ApiError(
      `Subtopik TWK tidak valid. Pilihan: ${CANONICAL_SUBTOPICS.TWK.join(', ')}`,
      400,
      'INVALID_SUBTOPIC'
    );
  }

  const guestChatIds = chatIdsParam
    ? chatIdsParam
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : undefined;

  if (guestChatIds?.some((id) => !UUID_REGEX.test(id))) {
    throw new ApiError('ID chat tidak valid', 400, 'INVALID_CHAT_ID');
  }

  const userId = await resolveOptionalUserId('GET /api/materials');

  const materials = await listStudyMaterials({
    subtopic: rawSubtopic,
    search,
    weakOnly,
    userId,
    guestChatIds,
  });

  return NextResponse.json({
    success: true,
    data: {
      materials,
      subtopics: CANONICAL_SUBTOPICS.TWK,
    },
  });
}

const materialsRateLimit = createRateLimitMiddleware({
  prefix: 'materials',
  windowMs: 60_000,
  max: 60,
  guestMax: 60,
});

export const GET = (request: NextRequest) =>
  withMiddleware(materialsRateLimit)(request, handleGetMaterials);
