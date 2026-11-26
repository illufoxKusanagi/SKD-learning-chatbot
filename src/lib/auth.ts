import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import {
  checkSignInRateLimit,
  clearSignInPairFailures,
  extractClientIp,
  recordSignInFailure,
} from "@/middleware/api";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const rawIdentifier = credentials?.identifier?.trim();
        if (!rawIdentifier || !credentials?.password) {
          return null;
        }

        const ip = extractClientIp(req?.headers);
        const normalizedIdentifier = rawIdentifier.toLowerCase();

        const limitStatus = await checkSignInRateLimit(ip, normalizedIdentifier);
        if (limitStatus.blocked) {
          throw new Error(`RATE_LIMITED:${limitStatus.retryAfterSeconds}`);
        }

        const user = await db.query.users.findFirst({
          where: or(
            sql`lower(${users.email}) = ${normalizedIdentifier}`,
            eq(users.username, rawIdentifier)
          ),
        });

        if (!user || !(await verifyPassword(credentials.password, user.password))) {
          await recordSignInFailure(ip, normalizedIdentifier);
          throw new Error("INVALID_CREDENTIALS");
        }

        await clearSignInPairFailures(ip, normalizedIdentifier);
        await db
          .update(users)
          .set({ lastLogin: new Date() })
          .where(eq(users.id, user.id))
          .catch(() => {});

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async session({ token, session }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.role = token.role;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
  },
};
