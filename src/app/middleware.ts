import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

const publicRoutes = ["/", "/auth/login", "/auth/register", "/chat"];

// Edited Here: Make /api/chat public but keep /api/chat/history protected
const publicApiRoutes = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/chat", // This allows POST /api/chat for chatting
  "/api/auth/me", // This allows checking auth status
];

// Protected API routes that specifically require authentication
const protectedApiRoutes = ["/api/chat/history", "/api/chat/title", "/api/rag"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all public routes including root
  if (publicRoutes.some((route) => pathname === route)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    // Allow specific public API routes
    if (publicApiRoutes.some((route) => pathname === route)) {
      return NextResponse.next();
    }

    // Protect specific API routes that require authentication
    if (protectedApiRoutes.some((route) => pathname.startsWith(route))) {
      // Check for Bearer token first
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
          jwt.verify(token, JWT_SECRET);
          return NextResponse.next();
        } catch {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      }

      // Check for cookie token
      const token = request.cookies.get("auth-token")?.value;
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      try {
        jwt.verify(token, JWT_SECRET);
        return NextResponse.next();
      } catch {
        const response = NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
        response.cookies.delete("auth-token");
        return response;
      }
    }

    // For other API routes, allow them
    return NextResponse.next();
  }

  // For non-API routes that aren't in publicRoutes, check authentication
  const token = request.cookies.get("auth-token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  try {
    jwt.verify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/auth/login", request.url));
    response.cookies.delete("auth-token");
    return response;
  }
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images).*)"],
};
