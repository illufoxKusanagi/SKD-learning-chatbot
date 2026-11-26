import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPracticePack } from "@/lib/services/practice.service";
import {
  ApiError,
  createRateLimitMiddleware,
  withMiddleware,
} from "@/middleware/api";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseCommaSeparatedUuids(
  raw: string | null,
  fieldName: string,
  errorCode: string
): string[] | undefined {
  if (!raw) return undefined;
  const items = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (items.length === 0) return undefined;

  for (const id of items) {
    if (!UUID_REGEX.test(id)) {
      throw new ApiError(
        `Format ${fieldName} tidak valid: ${id}`,
        400,
        errorCode
      );
    }
  }
  return items;
}

async function handleGetPracticePack(request: NextRequest) {
  const url = new URL(request.url);
  const countParam = url.searchParams.get("count");
  let count: 10 | 15 | 20 = 10;

  if (countParam !== null && countParam.trim() !== "") {
    const parsedCount = Number(countParam);
    if (parsedCount !== 10 && parsedCount !== 15 && parsedCount !== 20) {
      throw new ApiError(
        "Parameter count harus 10, 15, atau 20",
        400,
        "INVALID_COUNT"
      );
    }
    count = parsedCount;
  }

  const categoryParam = url.searchParams.get("category")?.trim().toUpperCase();
  let category: "TWK" | "TIU" | "TKP" | undefined;
  if (categoryParam) {
    if (
      categoryParam !== "TWK" &&
      categoryParam !== "TIU" &&
      categoryParam !== "TKP"
    ) {
      throw new ApiError(
        "Kategori tidak valid. Pilih TWK, TIU, atau TKP.",
        400,
        "INVALID_CATEGORY"
      );
    }
    category = categoryParam;
  }

  const subtopic = url.searchParams.get("subtopic")?.trim() || undefined;
  const materialSlug =
    url.searchParams.get("materialSlug")?.trim() || undefined;
  const wrongOnlyParam = url.searchParams.get("wrongOnly")?.trim().toLowerCase();
  const wrongOnly = wrongOnlyParam === "true" || wrongOnlyParam === "1";

  const questionIds = parseCommaSeparatedUuids(
    url.searchParams.get("questionIds"),
    "questionIds",
    "INVALID_QUESTION_ID"
  );
  const guestChatIds = parseCommaSeparatedUuids(
    url.searchParams.get("chatIds"),
    "chatIds",
    "INVALID_CHAT_ID"
  );
  const guestSessionIds = parseCommaSeparatedUuids(
    url.searchParams.get("sessionIds"),
    "sessionIds",
    "INVALID_SESSION_ID"
  );

  let userId: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      userId = session.user.id;
    }
  } catch (authErr) {
    console.warn("[GET /api/practice/pack] Session retrieval warning:", authErr);
  }

  const pack = await createPracticePack({
    count,
    category,
    subtopic,
    materialSlug,
    wrongOnly,
    questionIds,
    userId,
    guestChatIds,
    guestSessionIds,
  });

  return NextResponse.json({
    success: true,
    data: pack,
  });
}

const practiceRateLimit = createRateLimitMiddleware({
  prefix: "practice",
  windowMs: 60_000,
  max: 60,
  guestMax: 60,
});

export const GET = (request: NextRequest) =>
  withMiddleware(practiceRateLimit)(request, handleGetPracticePack);
