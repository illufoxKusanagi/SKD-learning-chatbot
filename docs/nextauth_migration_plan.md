# NextAuth.js Migration Plan

This document outlines the step-by-step process to migrate the SKD Chatbot application from custom JWT authentication to NextAuth.js (v4/v5).

## Phase 1: Setup & Configuration

### 1. Install Dependencies
Ensure `next-auth` is installed.
```bash
npm install next-auth
```

### 2. Environment Variables
Add the following to your `.env` file:
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_generated_openssl_string
```

### 3. Type Definitions
**File:** `src/types/next-auth.d.ts`
**Purpose:** TypeScript by default doesn't know that our users have an `id` or `role` in the session. This file extends the default types so we don't get "Property 'id' does not exist" errors.

```typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: string;
  }
}
```

### 4. NextAuth Configuration
**File:** `src/lib/auth.ts`
**Purpose:** This is the core configuration. It defines:
1.  **Providers**: We use `CredentialsProvider` to allow login with email/password.
2.  **Authorize**: The logic that finds the user in your Drizzle DB and checks the password (using `bcrypt`).
3.  **Callbacks**: Ensures the user's `id` is passed from the token to the session, so it's available in the frontend.

```typescript
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs"; // Ensure bcryptjs is installed

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/login", // Redirect here if not authenticated
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Find user in DB
        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email),
        });

        if (!user) {
          return null;
        }

        // Verify password
        const isPasswordValid = await compare(credentials.password, user.password);

        if (!isPasswordValid) {
          return null;
        }

        // Return user object (saved to JWT)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // role: user.role, // Uncomment if role is added back
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
        // session.user.role = token.role;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // token.role = user.role;
      }
      return token;
    },
  },
};
```

## Phase 2: Core Implementation

### 5. API Route Handler
**File:** `src/app/api/auth/[...nextauth]/route.ts`
**Purpose:** This creates the API endpoints that NextAuth needs to function (e.g., `/api/auth/signin`, `/api/auth/signout`, `/api/auth/session`). It's a "catch-all" route.

```typescript
import { authOptions } from "@/lib/auth";
import NextAuth from "next-auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

### 6. Session Provider Component
**File:** `src/components/providers/session-provider.tsx`
**Purpose:** This component wraps your app. It allows any component inside your app to use `useSession()` to check if the user is logged in.

```typescript
"use client";

import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

### 7. Root Layout Integration
**File:** `src/app/layout.tsx`
**Purpose:** Wraps the entire application with the provider we just created.

```typescript
import Providers from "@/components/providers/session-provider";

// ... inside RootLayout function ...
return (
  <html lang="en">
    <body>
      <Providers>
        {children}
      </Providers>
    </body>
  </html>
);
```

## Phase 3: Application Logic Updates

### 8. Middleware Protection
**File:** `src/middleware.ts`
**Purpose:** Protects routes. If a user tries to visit `/chat` without being logged in, this middleware will automatically redirect them to `/auth/login`.

```typescript
export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/chat/:path*", "/dashboard/:path*"], // Add protected routes here
};
```

### 9. Login Page Refactor
**File:** `src/app/auth/login/page.tsx`
**Purpose:** Updates the login form to use NextAuth's `signIn` function instead of a custom fetch call.

```typescript
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

// ... inside your form submit handler ...
const onSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);

  const result = await signIn("credentials", {
    email,
    password,
    redirect: false, // Prevent auto-redirect to handle errors manually
  });

  if (result?.error) {
    setError("Invalid email or password");
  } else {
    router.push("/chat"); // Redirect on success
  }
  setIsLoading(false);
};
```

### 10. Chat API Refactor
**File:** `src/app/api/chat/route.ts`
**Purpose:** Secure the chat API. Instead of looking for a manual header, we ask the server "Who is the user for this session cookie?".

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  // If session exists, use the real User ID
  // If not, fall back to Guest logic (if you want to allow guests)
  const userId = session?.user?.id || "guest_user_id"; 

  // ... rest of your chat logic ...
}
```

### 11. Chat Hook Refactor
**File:** `src/hooks/use-chat.ts`
**Purpose:** Simplifies the frontend hook. We no longer need to manually manage tokens or headers.

```typescript
import { useSession } from "next-auth/react";

export function useChat() {
  const { data: session, status } = useSession();
  
  // ... inside your sendMessage function ...
  // No need to add Authorization header anymore!
  const response = await fetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
```

## Phase 4: Cleanup

### 12. Remove Legacy Code
Once verified, remove:
- `src/lib/auth/jwt.ts` (Old JWT logic)
- `src/context/auth-context.tsx` (Old context provider)
- Any manual `Authorization` header logic in other components.
