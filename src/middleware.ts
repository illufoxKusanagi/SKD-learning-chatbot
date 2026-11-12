import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      const pathname = req.nextUrl.pathname;

      // List of routes that are accessible to guests (Allowlist)
      const publicPrefixes = [
        '/auth/login',
        '/auth/register',
        '/chat',
        '/help',
        '/quiz-history',
      ];

      // Check if the current path is the landing page or matches a public prefix
      const isPublicRoute =
        pathname === '/' ||
        publicPrefixes.some(
          (route) => pathname === route || pathname.startsWith(`${route}/`)
        );

      // If it's a public route, allow access
      if (isPublicRoute) {
        return true;
      }

      // For all other routes (e.g. /profile, /settings), require authentication
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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
