import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(async () => {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });
});

import { NextRequest } from "next/server";
import { closeConnection, db, ensureDatabaseSchema, rateLimits } from "@/lib/db";
import { like } from "drizzle-orm";
import {
  SIGNIN_IP_MAX_FAILURES,
  SIGNIN_PAIR_MAX_FAILURES,
  SIGNIN_WINDOW_MS,
  checkRateLimitBucket,
  checkSignInRateLimit,
  clearSignInPairFailures,
  createRateLimitMiddleware,
  extractClientIp,
  recordSignInFailure,
} from "@/middleware/api";

const TEST_PREFIX = `test-rl-${Date.now()}`;
const TEST_IPS = ["198.51.100.99", "203.0.113.10", "198.51.100.55"];

async function cleanupTestRateLimits() {
  await db
    .delete(rateLimits)
    .where(like(rateLimits.key, `${TEST_PREFIX}%`));
  for (const ip of TEST_IPS) {
    await db
      .delete(rateLimits)
      .where(like(rateLimits.key, `auth-fail:ip:${ip}%`));
    await db
      .delete(rateLimits)
      .where(like(rateLimits.key, `auth-fail:pair:${ip}:%`));
  }
}

describe("Auth Rate Limiting & Non-Poisoning Sliding Window", () => {
  beforeAll(async () => {
    await ensureDatabaseSchema({ throwOnError: true });
    await cleanupTestRateLimits();
  });

  afterAll(async () => {
    await cleanupTestRateLimits();
    await closeConnection();
  });

  it("extractClientIp returns leftmost client IP from NextRequest and plain object headers", () => {
    const req = new NextRequest("http://localhost:3000/api/auth/callback/credentials", {
      headers: {
        "x-forwarded-for": "203.0.113.5, 10.0.0.1, 172.16.0.1",
      },
    });
    expect(extractClientIp(req)).toBe("203.0.113.5");

    const plainHeaders = {
      "x-forwarded-for": "198.51.100.7, 10.0.0.2",
    };
    expect(extractClientIp(plainHeaders)).toBe("198.51.100.7");

    const cfReq = new Headers({
      "cf-connecting-ip": "203.0.113.9",
      "x-real-ip": "10.0.0.5",
      "x-forwarded-for": "198.51.100.8, 10.0.0.6",
    });
    expect(extractClientIp(cfReq)).toBe("203.0.113.9");

    const realIpHeaders = {
      "x-real-ip": "203.0.113.12",
      "x-forwarded-for": "198.51.100.8, 10.0.0.6",
    };
    expect(extractClientIp(realIpHeaders)).toBe("203.0.113.12");

    expect(extractClientIp(undefined)).toBe("local");
  });

  it("checkRateLimitBucket enforces non-poisoning sliding window without incrementing on blocked retries", async () => {
    const key = `${TEST_PREFIX}:non-poison`;
    const limit = 3;
    const windowMs = 60_000;

    for (let i = 0; i < 3; i++) {
      const res = await checkRateLimitBucket(key, limit, windowMs);
      expect(res.blocked).toBe(false);
    }

    for (let i = 0; i < 3; i++) {
      const res = await checkRateLimitBucket(key, limit, windowMs);
      expect(res.blocked).toBe(true);
      expect(res.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    }

    const rows = await db
      .select()
      .from(rateLimits)
      .where(like(rateLimits.key, key));

    const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
    expect(totalCount).toBe(3);
  });

  it("OWASP dual-bucket isolates attacker IP from legitimate owner on same target account", async () => {
    expect(SIGNIN_WINDOW_MS).toBe(10 * 60_000);
    expect(SIGNIN_PAIR_MAX_FAILURES).toBe(6);
    expect(SIGNIN_IP_MAX_FAILURES).toBe(20);

    const attackerIp = "198.51.100.99";
    const ownerIp = "203.0.113.10";
    const targetIdentifier = "admin_skd";

    for (let i = 0; i < 6; i++) {
      await recordSignInFailure(attackerIp, targetIdentifier);
    }

    const attackerStatus = await checkSignInRateLimit(attackerIp, targetIdentifier);
    expect(attackerStatus.blocked).toBe(true);
    expect(attackerStatus.reason).toBe("pair");
    expect(attackerStatus.retryAfterSeconds).toBeGreaterThanOrEqual(1);

    const ownerStatus = await checkSignInRateLimit(ownerIp, targetIdentifier);
    expect(ownerStatus.blocked).toBe(false);
  });

  it("clearSignInPairFailures resets pair bucket while 20 failures across usernames triggers IP sweep guard", async () => {
    const userIp = "203.0.113.10";
    const identifier = "peserta_skd";

    for (let i = 0; i < 3; i++) {
      await recordSignInFailure(userIp, identifier);
    }

    await clearSignInPairFailures(userIp, identifier);

    // Pair bucket was reset, so 6 fresh failures are allowed before blocking again?
    // Checking right after clear must be unblocked, and recording 5 more should remain unblocked
    const afterClear = await checkSignInRateLimit(userIp, identifier);
    expect(afterClear.blocked).toBe(false);

    for (let i = 0; i < 5; i++) {
      await recordSignInFailure(userIp, identifier);
    }
    expect((await checkSignInRateLimit(userIp, identifier)).blocked).toBe(false);

    // Sweep guard: 20 failures across 20 distinct usernames from same IP
    const sweepIp = "198.51.100.55";
    for (let i = 0; i < 20; i++) {
      await recordSignInFailure(sweepIp, `random_user_${i}`);
    }

    const sweepStatus = await checkSignInRateLimit(sweepIp, "brand_new_target");
    expect(sweepStatus.blocked).toBe(true);
    expect(sweepStatus.reason).toBe("ip");
  });

  it("createRateLimitMiddleware skips bucket check and increment when skipWhen returns true", async () => {
    const prefix = `${TEST_PREFIX}-skip`;
    const mw = createRateLimitMiddleware({
      prefix,
      windowMs: 60_000,
      max: 1,
      guestMax: 1,
      skipWhen: (req) => req.headers.get("x-skip-rl") === "1",
    });

    for (let i = 0; i < 3; i++) {
      const req = new NextRequest("http://localhost:3000/api/test", {
        headers: {
          "x-skip-rl": "1",
          "x-forwarded-for": "203.0.113.44",
        },
      });
      await expect(mw(req)).resolves.toBeNull();
    }

    const rows = await db
      .select()
      .from(rateLimits)
      .where(like(rateLimits.key, `${prefix}:%`));
    expect(rows.length).toBe(0);
  });
});
