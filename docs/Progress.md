# Project Progress

## 2025-12-18

### 1. Project Rebranding
- **Task**: Update project documentation to reflect the new purpose.
- **Status**: ✅ Completed
- **Details**: 
  - Updated `README.md` and `README.id.md`.
  - Changed project title to **"SKD CPNS & Sekolah Kedinasan Learning Chatbot"**.
  - Updated description to focus on SKD CPNS and Sekolah Kedinasan learning assistance.

### 2. Authentication Logic Evaluation
- **Task**: Re-evaluate current auth logic and compare with best practices.
- **Status**: ✅ Completed
- **Findings**:
  - Current implementation uses custom JWT with `jsonwebtoken`.
  - Access tokens are stored in `localStorage` (vulnerable to XSS).
  - Middleware relies on Node.js crypto (less compatible with Edge Runtime).
- **Recommendations**:
  - **Migrate to NextAuth.js (v5)**: Best for security, Edge compatibility, and maintainability.
  - **Alternative**: If keeping custom auth, move all tokens to HTTP-only cookies and switch to `jose` library for middleware compatibility.

### 3. Chatbot Logic Evaluation
- **Task**: Re-evaluate chatbot implementation against best practices.
- **Status**: ✅ Completed
- **Findings**:
  - Uses custom `useChat` hook with manual state management.
  - No streaming support (users wait for full response).
  - Manual error handling and retries.
- **Recommendations**:
  - **Adopt Vercel AI SDK**: 
    - Use `useChat` from `ai/react` for automatic state management.
    - Implement `streamText` in API for real-time streaming responses.
    - This will significantly improve UX and reduce code complexity.

### 4. Codebase Audit (Issues Found)
- **Task**: Identify incorrect, unused, inconsistent, ambiguous, and bad code.
- **Status**: ✅ Completed
- **Findings**:

  #### 🔴 Dead / Unused Code
  - **`src/lib/services/auth/auth.service.ts`**: Completely unused. Login/Register logic is duplicated directly in API routes (`src/app/api/auth/...`).
  - **`src/lib/services/ai/search.service.ts`**: `searchWeb` function is unused.
  - **`src/app/api/rag/search/route.ts`**: Contains commented-out code and returns dummy data.
  - **`src/app/api/test/route.ts`**: Test route exposed in production API.

  #### ⚠️ Bad Practices & Ambiguities
  - **Console Logs**: Extensive use of `console.log` in production code (e.g., `auth-context.tsx`, `middleware/api.ts`, `use-chat.ts`).
  - **Confusing Comments**: `auth.service.ts` contains gibberish TODOs (e.g., "why i how to remove user id").
  - **Unsafe Environment Access**: `search.service.ts` uses non-null assertion (`process.env.TAVILY_API_KEY!`) which can crash the app if missing.
  - **Inconsistent Architecture**: Service layer exists (`src/lib/services`) but is bypassed by API routes which implement business logic directly.

  #### 🔄 Inconsistencies
  - **Auth Logic**: `auth.service.ts` (unused) handles only email, while `api/auth/login` handles email OR username.
  - **API Structure**: Mixture of protected and public routes handling in middleware vs individual route logic.

  #### 🧩 RAG & Embedding Complexity (Tavily Context)
  - **Disabled RAG**: `src/lib/services/ai/rag.service.ts` and its usage in `src/app/api/chat/route.ts` are completely commented out. The chatbot currently has **no context awareness**.
  - **Obsolete Caching**: `DynamicEmbeddingCacheHelper` and `ragData` table fields (`is_cached`, `fetch_count`, etc.) are designed for complex search caching. With the switch to Tavily for live context, this is largely redundant and adds unnecessary complexity.
  - **Schema Bloat**: The `ragData` table contains many fields unused by a simple internal document store.
  - **Recommendation**: 
    - Remove `DynamicEmbeddingCacheHelper`.
    - Simplify `ragData` schema to a simple `documents` table for internal knowledge (PDFs).
    - Implement a clean `TavilyService` for external search.
    - Re-enable RAG in `api/chat` using a simple "Internal Vector Search + Tavily" strategy.

### 5. Database Schema Simplification
- **Task**: Simplify user roles.
- **Status**: ✅ Completed
- **Details**: 
  - Since this is a simple learning chatbot, multiple user roles (admin/user) are unnecessary.
  - **Action**: Remove `role` column from `users` table. All users will be treated equally.

### 6. NextAuth.js Migration
- **Task**: Migrate authentication to NextAuth.js (v5).
- **Status**: 🚧 In Progress
- **Details**:
  - Install `next-auth@beta`.
  - Configure `auth.ts` with Credentials provider (and potentially Google).
  - Replace custom JWT/Middleware logic.
  - Update Login/Register pages.
  - **Note**: Guest user logic will be re-evaluated and implemented *after* the main auth migration is complete.
