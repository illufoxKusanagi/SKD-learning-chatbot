import { NextRequest, NextResponse } from 'next/server';
import { resolveOptionalUserId } from '@/lib/auth/optional-session';
import { getStudyMaterialBySlug } from '@/lib/services/material.service';
import {
  ApiError,
  createRateLimitMiddleware,
  withMiddleware,
} from '@/middleware/api';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const materialDetailRateLimit = createRateLimitMiddleware({
  prefix: 'materials-detail',
  windowMs: 60_000,
  max: 60,
  guestMax: 60,
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  return withMiddleware(materialDetailRateLimit)(request, async (req) => {
    const { slug } = await context.params;
    const url = new URL(req.url);
    const chatIdsParam = url.searchParams.get('chatIds');
    const guestChatIds = chatIdsParam
      ? chatIdsParam
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : undefined;

    if (guestChatIds?.some((id) => !UUID_REGEX.test(id))) {
      throw new ApiError('ID chat tidak valid', 400, 'INVALID_CHAT_ID');
    }

    const userId = await resolveOptionalUserId('GET /api/materials/[slug]');

    const material = await getStudyMaterialBySlug(slug, {
      userId,
      guestChatIds,
    });

    if (!material) {
      throw new ApiError('Materi tidak ditemukan', 404, 'MATERIAL_NOT_FOUND');
    }

    return NextResponse.json({
      success: true,
      data: { material },
    });
  });
}
