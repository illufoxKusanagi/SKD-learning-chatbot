// src/lib/auth/config.ts
const isProdLike = process.env.NODE_ENV !== "development";
const JWT_SECRET = process.env.JWT_SECRET;
if (isProdLike && !JWT_SECRET) {
  throw new Error("JWT_SECRET mus tbe set in the environment");
}
export const authConfig = {
  JWT_SECRET: JWT_SECRET ?? "dev-insecure-secret",
  JWT_EXPIRES_IN: "7d",
  BCRYPT_ROUNDS: 12,
  COOKIE_NAME: "auth-token",
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development",
    sameSite: "strict" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  },
};

export const publicRoutes = [
  "/",
  "/auth/login",
  "/auth/register",
  "/api/auth/login",
  "/api/auth/register",
];

export const protectedRoutes = ["/chat", "/dashboard", "/profile", "/settings"];
