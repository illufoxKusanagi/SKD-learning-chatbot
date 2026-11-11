import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ApiError,
  createRateLimitMiddleware,
  createValidationMiddleware,
  withMiddleware,
  RequestWithValidation,
} from '@/middleware/api';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth/password';

const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email('Format email tidak valid'))
    .transform((v) => v.toLowerCase()),
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter')
    .max(20, 'Username maksimal 20 karakter')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username hanya boleh berisi huruf, angka, dan garis bawah (tanpa spasi)'
    ),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

// Edited here: Restored your original middleware-based register handler
async function registerHandler(
  request: RequestWithValidation<z.infer<typeof registerSchema>>
) {
  const { email, password, username } = request.validatedData || {};
  if (!email || !password || !username) {
    throw new ApiError(
      'Data registrasi tidak lengkap',
      400,
      'MISSING_REQUIRED_FIELDS'
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
      throw new ApiError(
        'Email sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda',
        409,
        'EMAIL_ALREADY_REGISTERED'
      );
    }

    // Check if username exists
    const [existingUsername] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUsername) {
      throw new ApiError(
        'Username sudah digunakan. Silakan pilih username lain',
        409,
        'USERNAME_ALREADY_TAKEN'
      );
    }
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error?.code === '23505') {
      throw new ApiError(
        'Email or username already registered',
        409,
        'DUPLICATE_USER'
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
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const response = NextResponse.json(
    {
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          role: newUser.role,
        },
      },
    },
    { status: 201 }
  );

  return response;
}

const registerRateLimit = createRateLimitMiddleware({
  prefix: 'auth-register',
  windowMs: 600_000,
  max: 3,
  guestMax: 3,
  failClosed: true,
});
const validateRegister = createValidationMiddleware(registerSchema);

export function POST(request: NextRequest) {
  return withMiddleware(registerRateLimit, validateRegister)(
    request,
    registerHandler
  );
}
