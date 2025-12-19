import { NextRequest, NextResponse } from "next/server";
import { ApiError, withMiddleware } from "@/middleware/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Edited here: Restored your original middleware-based me handler
async function meHandler(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

// Edited here: Your original middleware composition approach
export const GET = (request: NextRequest) => {
  return withMiddleware()(request, meHandler);
};
