import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  createRateLimitMiddleware,
  createValidationMiddleware,
  withMiddleware,
  RequestWithValidation,
} from "@/middleware/api";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { or, eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import { generateTokens } from "@/lib/auth/jwt";

const loginSchema = z.object({
  identifier: z.string().min(1, "Masukkan email atau username"),
  password: z.string().min(1, "Masukkan password"),
});

async function loginHandler(
  request: RequestWithValidation<z.infer<typeof loginSchema>>
) {
  const { identifier, password } = request.validatedData || {};
  if (!identifier || !password) {
    throw new ApiError(
      "Email/username dan password diperlukan",
      400,
      "MISSING_CREDENTIALS"
      // { received: { identifier: !!identifier, password: !!password } }
    );
  }
  const db = getDb();

  // Find user by email or username
  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, identifier), eq(users.username, identifier)))
    .limit(1);

  if (!user) {
    throw new ApiError("Invalid credentials", 401);
  }

  const isPasswordValid = await verifyPassword(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError("Invalid credentials", 401);
  }

  const { accessToken, refreshToken } = generateTokens(user.id, user.email);

  await db
    .update(users)
    .set({ lastLogin: new Date() })
    .where(eq(users.id, user.id));

  const response = NextResponse.json({
    success: true,
    message: "Login successful",
    data: {
      user: {
        id: user.id,
        name: user.username,
        email: user.email,
        role: user.role,
      },
      accessToken,
    },
  });

  // Set refresh token as HTTP-only cookie
  response.cookies.set("refresh-token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return response;
}

// Edited here: Your original middleware composition approach
export const POST = (request: NextRequest) => {
  return withMiddleware(
    createRateLimitMiddleware(5, 300000),
    createValidationMiddleware(loginSchema)
  )(request, loginHandler);
};
