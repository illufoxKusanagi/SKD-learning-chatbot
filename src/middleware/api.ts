import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { z } from "zod";

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
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createAuthMiddleware() {
  return async (req: AuthenticatedRequest) => {
    try {
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        throw new ApiError(
          "Missing or invalid authorization header",
          401,
          "UNAUTHORIZED"
        );
      }

      const token = authHeader.substring(7);
      const payload = verifyToken(token);

      if (payload.type !== "access") {
        throw new ApiError("Invalid token type", 401, "INVALID_TOKEN");
      }

      req.user = {
        userId: payload.userId,
        email: payload.email,
      };

      return req;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Authentication failed", 401, "AUTH_FAILED");
    }
  };
}

export function createValidationMiddleware<T>(
  schema: z.ZodSchema<T>,
  options: { field?: "body" | "query" | "params" } = { field: "body" }
) {
  return async (req: NextRequest): Promise<NextRequest> => {
    try {
      let dataToValidate;

      switch (options.field) {
        case "query":
          const url = new URL(req.url);
          dataToValidate = Object.fromEntries(url.searchParams.entries());
          break;
        case "params":
          dataToValidate = {};
          break;
        case "body":
        default:
          try {
            dataToValidate = await req.json();
            // Edited here: Add debug logging
            console.log("[VALIDATION] Raw data received:", dataToValidate);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (error) {
            throw new ApiError(
              "Request body harus berupa JSON yang valid",
              400,
              "INVALID_JSON"
            );
          }
      }

      const validatedData = schema.parse(dataToValidate);

      // Edited here: Add debug logging
      console.log("[VALIDATION] Validated data:", validatedData);

      // Attach validated data to the request object
      (req as RequestWithValidation<T>).validatedData = validatedData;

      return req;
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Edited here: Add debug logging for validation errors
        console.error("[VALIDATION] Zod validation error:", error);

        // const errorMessages = error.errors.map((err) => ({
        //   field: err.path.join("."),
        //   message: err.message,
        //   code: err.code,
        // }));

        throw new ApiError(
          "Data yang dikirim tidak valid",
          400,
          "VALIDATION_ERROR"
          // errorMessages
        );
      }

      if (error instanceof ApiError) throw error;

      throw new ApiError("Gagal memvalidasi request", 400, "VALIDATION_FAILED");
    }
  };
}

export function createRateLimitMiddleware(
  maxRequests: number = 60,
  windowMs: number = 60000
) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of requests.entries()) {
      if (now > data.resetTime) requests.delete(ip);
    }
  }, windowMs);
  if (cleanup.unref) cleanup.unref();

  return async (req: NextRequest): Promise<NextRequest> => {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const now = Date.now();
    let current = requests.get(ip);

    if (!current || now > current.resetTime) {
      current = { count: 0, resetTime: now + windowMs };
    }

    current.count++;
    requests.set(ip, current);

    if (current.count > maxRequests) {
      console.warn(`[RateLimit] IP ${ip} blocked.`);
      throw new ApiError(
        "Terlalu banyak permintaan. Silakan coba lagi nanti.",
        429,
        "RATE_LIMIT_EXCEEDED"
      );
    }

    return req;
  };
}

// export function createRateLimitMiddleware(
//   maxRequests: number = 60,
//   windowMs: number = 60000
// ) {
//   const requests = new Map<string, { count: number; resetTime: number }>();

//   return async (req: NextRequest): Promise<NextRequest> => {
//     // Edited here: Robust IP detection using standard headers to avoid type errors
//     const forwardedFor = req.headers.get("x-forwarded-for");
//     const realIp = req.headers.get("x-real-ip");
//     const ip =
//       forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "unknown";
//     const now = Date.now();
//     const resetTime = now + windowMs;

//     const current = requests.get(ip);

//     if (!current) {
//       requests.set(ip, { count: 1, resetTime });
//       return req;
//     }

//     if (now > current.resetTime) {
//       requests.set(ip, { count: 1, resetTime });
//       return req;
//     }

//     if (current.count >= maxRequests) {
//       throw new ApiError("Rate limit exceeded", 429, "RATE_LIMIT");
//     }

//     current.count++;
//     return req;
//   };
// }

export function handleApiError(error: unknown): NextResponse {
  console.error("API Error:", error);

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        details: error.issues,
        code: "VALIDATION_ERROR",
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: "Internal server error",
      code: "INTERNAL_ERROR",
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
  public: (rateLimit?: { maxRequests?: number; windowMs?: number }) => [
    createRateLimitMiddleware(rateLimit?.maxRequests, rateLimit?.windowMs),
  ],

  // For authenticated endpoints
  authenticated: (rateLimit?: { maxRequests?: number; windowMs?: number }) => [
    createRateLimitMiddleware(rateLimit?.maxRequests, rateLimit?.windowMs),
    createAuthMiddleware(),
  ],

  // For admin-only endpoints
  // TODO : Apply this for admins
  admin: (rateLimit?: { maxRequests?: number; windowMs?: number }) => [
    createRateLimitMiddleware(rateLimit?.maxRequests, rateLimit?.windowMs),
    createAuthMiddleware(),
  ],

  // For endpoints with validation
  validated: <T>(
    schema: z.ZodSchema<T>,
    auth = false,
    rateLimit?: { maxRequests?: number; windowMs?: number }
  ) => [
    createRateLimitMiddleware(rateLimit?.maxRequests, rateLimit?.windowMs),
    ...(auth ? [createAuthMiddleware()] : []),
    createValidationMiddleware(schema),
  ],
};
