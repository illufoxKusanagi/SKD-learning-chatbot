import bcrypt from "bcryptjs";

const PBKDF2_PREFIX = "pbkdf2_sha256";
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_HASH_BITS = 256;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
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

async function derivePbkdf2Bits(
  password: string,
  salt: Uint8Array,
  iterations: number,
  bits: number
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const saltBuffer = new Uint8Array(salt).buffer;
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    bits
  );
  return new Uint8Array(derived);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const derived = await derivePbkdf2Bits(
    password,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_HASH_BITS
  );
  return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(derived)}`;
}

export function needsPasswordRehash(hash: string): boolean {
  return !hash.startsWith(`${PBKDF2_PREFIX}$`);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  if (hashedPassword.startsWith(`${PBKDF2_PREFIX}$`)) {
    const parts = hashedPassword.split("$");
    if (parts.length !== 4) {
      return false;
    }

    const iterations = Number.parseInt(parts[1], 10);
    if (
      !Number.isSafeInteger(iterations) ||
      iterations < 10_000 ||
      iterations > 1_000_000
    ) {
      return false;
    }

    const salt = fromBase64(parts[2]);
    const expectedHash = fromBase64(parts[3]);
    if (!salt || !expectedHash || expectedHash.length === 0) {
      return false;
    }

    const derived = await derivePbkdf2Bits(
      password,
      salt,
      iterations,
      expectedHash.length * 8
    );
    return constantTimeEqual(derived, expectedHash);
  }

  if (
    hashedPassword.startsWith("$2a$") ||
    hashedPassword.startsWith("$2b$") ||
    hashedPassword.startsWith("$2y$")
  ) {
    return bcrypt.compare(password, hashedPassword);
  }

  return false;
}
