export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/chat/:path*"], // Add protected routes here
};
