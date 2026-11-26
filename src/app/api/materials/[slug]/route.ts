import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStudyMaterialBySlug } from '@/lib/services/material.service';
import {
  ApiError,
  createRateLimitMiddleware,
  withMiddleware,
} from '@/middleware/api';

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

    let userId: string | null = null;
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        userId = session.user.id;
      }
    } catch (authErr) {
      console.warn(
        '[GET /api/materials/[slug]] Session retrieval warning:',
        authErr
      );
    }

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
