import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  AuthenticatedRequest,
  createAuthMiddleware,
  withMiddleware,
} from "@/middleware/api";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Edited here: Restored your original middleware-based me handler
async function meHandler(req: AuthenticatedRequest) {
  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, req.user!.userId))
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

// Edited here: Your original middleware composition approach
export const GET = (request: NextRequest) => {
  return withMiddleware(createAuthMiddleware())(request, meHandler);
};
