import { NextRequest, NextResponse } from "next/server";
import { getTryoutBankReadiness } from "@/lib/services/tryout.service";
import { createRateLimitMiddleware, withMiddleware } from "@/middleware/api";

async function handleGetTryoutReadiness() {
  const readiness = await getTryoutBankReadiness();
  return NextResponse.json({
    success: true,
    data: readiness,
  });
}

const readinessRateLimit = createRateLimitMiddleware({
  prefix: "tryout-readiness",
  windowMs: 60_000,
  max: 60,
  guestMax: 60,
});

export const GET = (request: NextRequest) =>
  withMiddleware(readinessRateLimit)(request, handleGetTryoutReadiness);
