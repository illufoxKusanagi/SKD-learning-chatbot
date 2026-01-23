import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      const pathname = req.nextUrl.pathname;

      // List of routes that are accessible to guests (Allowlist)
      const publicRoutes = [
        "/",
        "/auth/login",
        "/auth/register",
        "/chat",
        "/chat/[id]",
        "/help",
      ];

      const isPublicRoute = publicRoutes.some((route) =>
        pathname.startsWith(route),
      );

      if (isPublicRoute) {
        return true;
      }

      return !!token;
    },
  },
});

export const config = {
  // Match all request paths except for the ones starting with:
  // - api (API routes are handled by route handlers)
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - favicon.ico (favicon file)
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
