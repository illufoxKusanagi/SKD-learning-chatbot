import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "my jwt token";
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "3d";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "15d";

export interface JwtPayload {
  userId: string;
  email: string;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
}

// Edited here: Added your generateTokens function that auth routes expect
export function generateTokens(userId: string, email: string) {
  const accessToken = jwt.sign({ userId, email, type: "access" }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(
    { userId, email, type: "refresh" },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch (error) {
    return null;
  }
}

export function refreshAccessToken(refreshToken: string) {
  const decoded = verifyToken(refreshToken);
  if (decoded.type !== "refresh") {
    throw new Error("Invalid refresh token");
  }
  return generateTokens(decoded.userId, decoded.email);
}
