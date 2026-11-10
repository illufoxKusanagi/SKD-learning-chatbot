import { authOptions } from "@/lib/auth";
import NextAuth from "next-auth";
import { NextRequest } from "next/server";
import { createRateLimitMiddleware, withMiddleware } from "@/middleware/api";

const handler = NextAuth(authOptions);
const credentialsRateLimit = createRateLimitMiddleware({
  prefix: "auth-credentials",
  windowMs: 300_000,
  max: 5,
  guestMax: 5,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const POST = (req: NextRequest, ctx: any) =>
  req.nextUrl.pathname.endsWith("/callback/credentials")
    ? withMiddleware(credentialsRateLimit)(req, () => handler(req, ctx))
    : handler(req, ctx);

export { handler as GET };
