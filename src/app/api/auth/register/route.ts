import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  createRateLimitMiddleware,
  createValidationMiddleware,
  withMiddleware,
} from "@/middleware/api";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { generateTokens } from "@/lib/auth/jwt";

const registerSchema = z.object({
  email: z.email("Invalid email format").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
});

// Edited here: Restored your original middleware-based register handler
async function registerHandler(request: NextRequest & { validatedData?: any }) {
  const { email, password, username } = request.validatedData || {};
  if (!email || !password || !username) {
    throw new ApiError(
      "Data registrasi tidak lengkap",
      400,
      "MISSING_REQUIRED_FIELDS"
    );
  }
  const db = getDb();

  try {
    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      throw new ApiError("Email already registered", 409);
    }

    // Check if username exists
    const [existingUsername] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUsername) {
      throw new ApiError("Username already taken", 409);
    }
  } catch (e: any) {
    if (e?.code === "23505") {
      throw new ApiError(
        "Email or username already registered",
        409,
        "DUPLICATE_USER"
      );
    }
    throw e;
  }

  const hashedPassword = await hashPassword(password);

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      username,
      password: hashedPassword,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const { accessToken, refreshToken } = generateTokens(
    newUser.id,
    newUser.email
    // newUser.role
  );

  const response = NextResponse.json(
    {
      success: true,
      message: "Registration successful",
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          role: newUser.role,
        },
        accessToken,
      },
    },
    { status: 201 }
  );

  // Set refresh token as HTTP-only cookie
  response.cookies.set("refresh-token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60, // 7 days (seconds)
    // ensure cookie is sent to all routes
  });

  return response;
}

export function POST(request: NextRequest) {
  return withMiddleware(
    createRateLimitMiddleware(3, 600000), // 3 requests per 10 minutes for registration
    createValidationMiddleware(registerSchema)
  )(request, registerHandler);
}
