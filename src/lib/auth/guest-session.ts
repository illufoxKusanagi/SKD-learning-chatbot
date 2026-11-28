import { NextRequest, NextResponse } from "next/server";

export const GUEST_COOKIE_NAME = "skd_guest_sid";

const GUEST_SESSION_MAX_AGE_SECONDS = 86_400;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSecret(): string {
  return process.env.NEXTAUTH_SECRET || "";
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const keyBytes = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function signGuestId(guestId: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const data = new TextEncoder().encode(guestId);
  const sigBuffer = await crypto.subtle.sign("HMAC", key, data);
  return toBase64Url(new Uint8Array(sigBuffer));
}

export async function readVerifiedGuestId(
  request: NextRequest
): Promise<string | null> {
  const rawCookie = request.cookies.get(GUEST_COOKIE_NAME)?.value;
  if (!rawCookie) {
    return null;
  }

  const dotIndex = rawCookie.indexOf(".");
  if (dotIndex <= 0 || dotIndex === rawCookie.length - 1) {
    return null;
  }

  const guestId = rawCookie.slice(0, dotIndex);
  const providedSig = rawCookie.slice(dotIndex + 1);
  if (!UUID_REGEX.test(guestId) || providedSig.includes(".")) {
    return null;
  }

  const secret = getSecret();
  if (!secret) {
    return null;
  }

  const providedBytes = fromBase64Url(providedSig);
  if (!providedBytes) {
    return null;
  }

  const expectedSig = await signGuestId(guestId, secret);
  const expectedBytes = fromBase64Url(expectedSig);
  if (!expectedBytes) {
    return null;
  }

  return constantTimeEqual(providedBytes, expectedBytes) ? guestId : null;
}

export async function getOrCreateGuestSession(
  request: NextRequest
): Promise<{ guestId: string; setCookieHeader: string | null }> {
  const existingGuestId = await readVerifiedGuestId(request);
  if (existingGuestId) {
    return { guestId: existingGuestId, setCookieHeader: null };
  }

  const guestId = crypto.randomUUID();
  const secret = getSecret();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXTAUTH_SECRET is required for guest session signing");
    }
    return { guestId, setCookieHeader: null };
  }

  const signature = await signGuestId(guestId, secret);
  const cookieValue = `${guestId}.${signature}`;
  const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const setCookieHeader = `${GUEST_COOKIE_NAME}=${cookieValue}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${GUEST_SESSION_MAX_AGE_SECONDS}${secureFlag}`;

  return { guestId, setCookieHeader };
}

export function attachGuestCookie(
  response: NextResponse,
  setCookieHeader: string | null
): NextResponse {
  if (setCookieHeader) {
    response.headers.append("Set-Cookie", setCookieHeader);
  }
  return response;
}
