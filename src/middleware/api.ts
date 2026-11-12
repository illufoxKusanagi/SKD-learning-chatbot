import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { z } from 'zod';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string;
    email: string;
  };
}

export interface RequestWithValidation<T = unknown> extends NextRequest {
  validatedData?: T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public code?: string,
    public retryAfterSeconds?: number,
    public details?: Array<{ field: string; message: string; code?: string }>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createAuthMiddleware() {
  return async (req: AuthenticatedRequest) => {
    try {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        throw new ApiError(
          'Missing or invalid authorization header',
          401,
          'UNAUTHORIZED'
        );
      }

      const token = authHeader.substring(7);
      const payload = verifyToken(token);

      if (payload.type !== 'access') {
        throw new ApiError('Invalid token type', 401, 'INVALID_TOKEN');
      }

      req.user = {
        userId: payload.userId,
        email: payload.email,
      };

      return req;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Authentication failed', 401, 'AUTH_FAILED');
    }
  };
}

export function createValidationMiddleware<T>(
  schema: z.ZodSchema<T>,
  options: { field?: 'body' | 'query' | 'params' } = { field: 'body' }
) {
  return async (req: NextRequest): Promise<NextRequest> => {
    try {
      let dataToValidate;

      switch (options.field) {
        case 'query':
          const url = new URL(req.url);
          dataToValidate = Object.fromEntries(url.searchParams.entries());
          break;
        case 'params':
          dataToValidate = {};
          break;
        case 'body':
        default:
          try {
            dataToValidate = await req.json();
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (error) {
            throw new ApiError(
              'Request body harus berupa JSON yang valid',
              400,
              'INVALID_JSON'
            );
          }
      }

      const validatedData = schema.parse(dataToValidate);

      // Attach validated data to the request object
      (req as RequestWithValidation<T>).validatedData = validatedData;

      return req;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('[VALIDATION] Zod validation error:', error);

        const errorMessages = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        const firstDetail = errorMessages[0]
          ? `: ${errorMessages[0].field ? `${errorMessages[0].field} — ` : ''}${errorMessages[0].message}`
          : '';

        throw new ApiError(
          `Data yang dikirim tidak valid${firstDetail}`,
          400,
          'VALIDATION_ERROR',
          undefined,
          errorMessages
        );
      }

      if (error instanceof ApiError) throw error;

      throw new ApiError('Gagal memvalidasi request', 400, 'VALIDATION_FAILED');
    }
  };
}

export interface RateLimitOptions {
  prefix: string; // unique per route, e.g. "chat", "quiz"
  windowMs: number;
  max: number; // limit for authenticated users
  guestMax?: number; // limit for guests / unauthenticated (defaults to max)
  daily?: { max: number; guestMax?: number }; // optional fixed 24h cap
  failClosed?: boolean;
}

async function checkRateLimitBucket(
  key: string,
  limit: number,
  windowMs: number,
  sliding: boolean,
  now: number,
  failClosed = false
): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  const curStart = Math.floor(now / windowMs) * windowMs;
  const prevStart = curStart - windowMs;
  const elapsed = now - curStart;

  let cur = 0;
  let prev = 0;

  try {
    const result = await db.execute<{ cur: string | number; prev: string | number }>(sql`
      WITH cur AS (
        INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, ${curStart}, 1)
        ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
        RETURNING count
      )
      SELECT (SELECT count FROM cur) AS cur,
             COALESCE((SELECT count FROM rate_limits WHERE key = ${key} AND window_start = ${prevStart}), 0) AS prev
    `);

    const row = result[0];
    cur = Number(row?.cur) || 0;
    prev = Number(row?.prev) || 0;
  } catch (error) {
    console.error('[RateLimit] Database error while checking rate limit:', error);
    if (failClosed) {
      return { blocked: true, retryAfterSeconds: 5 };
    }
    // Fail open: allow request if DB fails
    return { blocked: false, retryAfterSeconds: 0 };
  }

  const estimated = sliding ? prev * (1 - elapsed / windowMs) + cur : cur;
  if (estimated > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
    return { blocked: true, retryAfterSeconds };
  }

  return { blocked: false, retryAfterSeconds: 0 };
}

async function cleanupRateLimits(
  prefix: string,
  windowMs: number,
  hasDaily: boolean,
  now: number
): Promise<void> {
  try {
    const windowCutoff = now - 2 * windowMs;
    if (hasDaily) {
      const dailyCutoff = now - 2 * 86_400_000;
      await db.execute(sql`
        DELETE FROM rate_limits
        WHERE key LIKE ${prefix + ':%'}
          AND key NOT LIKE ${'%:daily'}
          AND window_start < ${windowCutoff}
      `);
      await db.execute(sql`
        DELETE FROM rate_limits
        WHERE key LIKE ${prefix + ':%:daily'}
          AND window_start < ${dailyCutoff}
      `);
    } else {
      await db.execute(sql`
        DELETE FROM rate_limits
        WHERE key LIKE ${prefix + ':%'}
          AND window_start < ${windowCutoff}
      `);
    }
  } catch (error) {
    console.error('[RateLimit] Database error during cleanup:', error);
  }
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  const { failClosed = false } = options;
  return async (req: NextRequest): Promise<NextRequest> => {
    // Extract client IP securely under single-proxy assumption:
    // Prefer x-real-ip set by trusted reverse proxy (Vercel/Nginx ingress).
    // Fall back to the last hop of x-forwarded-for (appended by reverse proxy, not client-controlled),
    // or "unknown" to prevent client header spoofing rate-limit bypass.
    const realIp = req.headers.get('x-real-ip')?.trim();
    const forwardedFor = req.headers.get('x-forwarded-for');
    const forwardedIps = forwardedFor
      ? forwardedFor
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const ip =
      realIp ||
      (forwardedIps.length > 0
        ? forwardedIps[forwardedIps.length - 1]
        : 'unknown');

    let userId: string | null = null;
    try {
      const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
      });
      if (token?.id && typeof token.id === 'string') {
        userId = token.id;
      } else if (token?.sub && typeof token.sub === 'string') {
        userId = token.sub;
      }
    } catch {
      userId = null;
    }

    const isAuthenticated = Boolean(userId);
    const key = isAuthenticated
      ? `${options.prefix}:user:${userId}`
      : `${options.prefix}:ip:${ip}`;
    const limit = isAuthenticated
      ? options.max
      : (options.guestMax ?? options.max);

    const now = Date.now();

    if (Math.random() < 0.01) {
      await cleanupRateLimits(
        options.prefix,
        options.windowMs,
        Boolean(options.daily),
        now
      );
    }

    const checks: Promise<{ blocked: boolean; retryAfterSeconds: number }>[] = [
      checkRateLimitBucket(key, limit, options.windowMs, true, now, failClosed),
    ];

    if (options.daily) {
      const dailyLimit = isAuthenticated
        ? options.daily.max
        : (options.daily.guestMax ?? options.daily.max);
      const dailyKey = `${key}:daily`;
      checks.push(
        checkRateLimitBucket(dailyKey, dailyLimit, 86_400_000, false, now, failClosed)
      );
    }

    const [windowResult, dailyResult] = await Promise.all(checks);

    if (windowResult?.blocked || dailyResult?.blocked) {
      const retryAfterSeconds = Math.max(
        windowResult?.blocked ? windowResult.retryAfterSeconds : 0,
        dailyResult?.blocked ? dailyResult.retryAfterSeconds : 0
      );
      throw new ApiError(
        'Rate limit exceeded',
        429,
        'RATE_LIMIT',
        retryAfterSeconds
      );
    }

    return req;
  };
}

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  if (error instanceof ApiError) {
    const headers: Record<string, string> = {};
    if (error.retryAfterSeconds !== undefined) {
      headers['Retry-After'] = String(error.retryAfterSeconds);
    }
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
      { status: error.statusCode, headers }
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: 'Validation failed',
        details: error.issues,
        code: 'VALIDATION_ERROR',
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
    { status: 500 }
  );
}

export function withMiddleware(
  ...middlewares: Array<(req: NextRequest) => Promise<NextRequest>>
) {
  return async (
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ) => {
    try {
      let processedReq = req;

      for (const middleware of middlewares) {
        processedReq = (await middleware(processedReq)) || processedReq;
      }

      return await handler(processedReq);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

export const commonMiddleware = {
  // For public endpoints with just rate limiting
  public: (rateLimit?: Partial<RateLimitOptions>) => [
    createRateLimitMiddleware({
      prefix: rateLimit?.prefix ?? 'public',
      windowMs: rateLimit?.windowMs ?? 60_000,
      max: rateLimit?.max ?? 60,
      guestMax: rateLimit?.guestMax,
      daily: rateLimit?.daily,
    }),
  ],

  // For authenticated endpoints
  authenticated: (rateLimit?: Partial<RateLimitOptions>) => [
    createRateLimitMiddleware({
      prefix: rateLimit?.prefix ?? 'auth',
      windowMs: rateLimit?.windowMs ?? 60_000,
      max: rateLimit?.max ?? 60,
      guestMax: rateLimit?.guestMax,
      daily: rateLimit?.daily,
    }),
    createAuthMiddleware(),
  ],

  // For admin-only endpoints
  // TODO : Apply this for admins
  admin: (rateLimit?: Partial<RateLimitOptions>) => [
    createRateLimitMiddleware({
      prefix: rateLimit?.prefix ?? 'admin',
      windowMs: rateLimit?.windowMs ?? 60_000,
      max: rateLimit?.max ?? 60,
      guestMax: rateLimit?.guestMax,
      daily: rateLimit?.daily,
    }),
    createAuthMiddleware(),
  ],

  // For endpoints with validation
  validated: <T>(
    schema: z.ZodSchema<T>,
    auth = false,
    rateLimit?: Partial<RateLimitOptions>
  ) => [
    createRateLimitMiddleware({
      prefix: rateLimit?.prefix ?? 'validated',
      windowMs: rateLimit?.windowMs ?? 60_000,
      max: rateLimit?.max ?? 60,
      guestMax: rateLimit?.guestMax,
      daily: rateLimit?.daily,
    }),
    ...(auth ? [createAuthMiddleware()] : []),
    createValidationMiddleware(schema),
  ],
};
