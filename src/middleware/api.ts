import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

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

export type IpHeaderSource =
  | NextRequest
  | Headers
  | Record<string, string | string[] | undefined>
  | undefined;

function readHeaderValue(
  source: IpHeaderSource,
  name: string
): string | undefined {
  if (!source) return undefined;
  if (typeof (source as Headers).get === 'function') {
    return (source as Headers).get(name) ?? undefined;
  }
  if (
    typeof source === 'object' &&
    'headers' in source &&
    source.headers &&
    typeof (source.headers as Headers).get === 'function'
  ) {
    return (source.headers as Headers).get(name) ?? undefined;
  }
  const record = source as Record<string, string | string[] | undefined>;
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(record)) {
    if (k.toLowerCase() === target) {
      if (Array.isArray(v)) return v[0];
      if (typeof v === 'string') return v;
    }
  }
  return undefined;
}

export function extractClientIp(source?: IpHeaderSource): string {
  const cfConnectingIp = readHeaderValue(source, 'cf-connecting-ip')?.trim();
  if (cfConnectingIp) return cfConnectingIp;

  const realIp = readHeaderValue(source, 'x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwardedFor = readHeaderValue(source, 'x-forwarded-for');
  if (forwardedFor) {
    const forwardedIps = forwardedFor
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (forwardedIps.length > 0) {
      return forwardedIps[0];
    }
  }

  return 'local';
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
  skipWhen?: (req: NextRequest) => boolean;
}

export interface CheckRateLimitBucketOptions {
  increment?: boolean;
  sliding?: boolean;
  now?: number;
}

export const SIGNIN_WINDOW_MS = 10 * 60_000;
export const SIGNIN_PAIR_MAX_FAILURES = 6;
export const SIGNIN_IP_MAX_FAILURES = 20;

export async function checkRateLimitBucket(
  key: string,
  limit: number,
  windowMs: number,
  opts?: CheckRateLimitBucketOptions
): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  const now = opts?.now ?? Date.now();
  const shouldIncrement = opts?.increment !== false;
  const sliding = opts?.sliding !== false;
  const curWindow = Math.floor(now / windowMs) * windowMs;
  const prevWindow = curWindow - windowMs;
  const elapsed = now - curWindow;
  const weight = sliding ? Math.max(0, 1 - elapsed / windowMs) : 0;

  try {
    const rows = await db.execute<{
      window_start: string | number;
      count: string | number;
    }>(sql`
      SELECT window_start, count
      FROM rate_limits
      WHERE key = ${key} AND window_start IN (${prevWindow}, ${curWindow})
    `);

    let cur = 0;
    let prev = 0;
    for (const row of rows) {
      const ws = Number(row.window_start);
      const cnt = Number(row.count) || 0;
      if (ws === curWindow) {
        cur = cnt;
      } else if (ws === prevWindow) {
        prev = cnt;
      }
    }

    const currentEstimated = prev * weight + cur;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowMs - elapsed) / 1000)
    );

    if (!shouldIncrement) {
      if (currentEstimated >= limit) {
        return { blocked: true, retryAfterSeconds };
      }
      return { blocked: false, retryAfterSeconds: 0 };
    }

    if (currentEstimated + 1 > limit) {
      return { blocked: true, retryAfterSeconds };
    }

    await db.execute(sql`
      INSERT INTO rate_limits (key, window_start, count)
      VALUES (${key}, ${curWindow}, 1)
      ON CONFLICT (key, window_start)
      DO UPDATE SET count = rate_limits.count + 1
    `);

    if (Math.random() < 0.02) {
      void db
        .execute(sql`
          DELETE FROM rate_limits
          WHERE key = ${key} AND window_start < ${prevWindow}
        `)
        .catch(() => {});
    }

    return { blocked: false, retryAfterSeconds: 0 };
  } catch (err) {
    console.warn('[RateLimit] Skipping rate-limit check due to DB error:', err);
    return { blocked: false, retryAfterSeconds: 0 };
  }
}

function getSignInBucketKeys(ip: string, identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  return {
    pairKey: `auth-fail:pair:${ip}:${normalizedIdentifier}`,
    ipKey: `auth-fail:ip:${ip}`,
  };
}

export async function checkSignInRateLimit(
  ip: string,
  identifier: string
): Promise<{
  blocked: boolean;
  retryAfterSeconds: number;
  reason?: 'pair' | 'ip';
}> {
  const { pairKey, ipKey } = getSignInBucketKeys(ip, identifier);
  const [ipResult, pairResult] = await Promise.all([
    checkRateLimitBucket(ipKey, SIGNIN_IP_MAX_FAILURES, SIGNIN_WINDOW_MS, {
      increment: false,
    }),
    checkRateLimitBucket(pairKey, SIGNIN_PAIR_MAX_FAILURES, SIGNIN_WINDOW_MS, {
      increment: false,
    }),
  ]);

  if (ipResult.blocked) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(
        ipResult.retryAfterSeconds,
        pairResult.blocked ? pairResult.retryAfterSeconds : 0
      ),
      reason: 'ip',
    };
  }

  if (pairResult.blocked) {
    return {
      blocked: true,
      retryAfterSeconds: pairResult.retryAfterSeconds,
      reason: 'pair',
    };
  }

  return { blocked: false, retryAfterSeconds: 0 };
}

export async function recordSignInFailure(
  ip: string,
  identifier: string
): Promise<void> {
  const { pairKey, ipKey } = getSignInBucketKeys(ip, identifier);
  await Promise.all([
    checkRateLimitBucket(pairKey, SIGNIN_PAIR_MAX_FAILURES, SIGNIN_WINDOW_MS, {
      increment: true,
    }),
    checkRateLimitBucket(ipKey, SIGNIN_IP_MAX_FAILURES, SIGNIN_WINDOW_MS, {
      increment: true,
    }),
  ]);
}

export async function clearSignInPairFailures(
  ip: string,
  identifier: string
): Promise<void> {
  const { pairKey } = getSignInBucketKeys(ip, identifier);
  try {
    await db.execute(sql`DELETE FROM rate_limits WHERE key = ${pairKey}`);
  } catch (err) {
    console.warn('[RateLimit] Skipping sign-in pair clear due to DB error:', err);
  }
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
  return async (req: NextRequest): Promise<NextRequest | null> => {
    if (options.skipWhen?.(req)) {
      return null;
    }

    const ip = extractClientIp(req);

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
      checkRateLimitBucket(key, limit, options.windowMs, {
        increment: true,
        sliding: true,
        now,
      }),
    ];

    if (options.daily) {
      const dailyLimit = isAuthenticated
        ? options.daily.max
        : (options.daily.guestMax ?? options.daily.max);
      const dailyKey = `${key}:daily`;
      checks.push(
        checkRateLimitBucket(dailyKey, dailyLimit, 86_400_000, {
          increment: true,
          sliding: false,
          now,
        })
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
  ...middlewares: Array<(req: NextRequest) => Promise<NextRequest | null | void>>
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
      skipWhen: rateLimit?.skipWhen,
    }),
  ],

  // For endpoints with validation
  validated: <T>(
    schema: z.ZodSchema<T>,
    rateLimit?: Partial<RateLimitOptions>
  ) => [
    createRateLimitMiddleware({
      prefix: rateLimit?.prefix ?? 'validated',
      windowMs: rateLimit?.windowMs ?? 60_000,
      max: rateLimit?.max ?? 60,
      guestMax: rateLimit?.guestMax,
      daily: rateLimit?.daily,
      skipWhen: rateLimit?.skipWhen,
    }),
    createValidationMiddleware(schema),
  ],
};
