import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  createRateLimitMiddleware,
  withMiddleware,
} from "@/middleware/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function meHandler() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  return NextResponse.json({
    success: true,
    message: "User authenticated",
    data: { user },
  });
}

const authMeRateLimit = createRateLimitMiddleware({
  prefix: "auth-me",
  windowMs: 60_000,
  max: 60,
  guestMax: 30,
});

export const GET = (request: NextRequest) => {
  return withMiddleware(authMeRateLimit)(request, meHandler);
};
