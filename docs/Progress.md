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
- **Status**: In Progress
- **Details**: 
  - Since this is a simple learning chatbot, multiple user roles (admin/user) are unnecessary.
  - **Action**: Remove `role` column from `users` table. All users will be treated equally.

### 6. NextAuth.js Migration
- **Task**: Migrate authentication to NextAuth.js (v5).
- **Status**: ✅ Completed
- **Details**:
  - Install `next-auth@beta`.
  - Configure `auth.ts` with Credentials provider (and potentially Google).
  - Replace custom JWT/Middleware logic.
  - Update Login/Register pages.
  - **Note**: Guest user logic will be re-evaluated and implemented *after* the main auth migration is complete.

## 2025-02-20

### 7. Gemini Streaming & Thinking Implementation Guide
- **Task**: Implement real-time streaming with "Thinking" process visibility using Google Gemini 2.0.
- **Status**: 🚧 In Progress
- **Goal**: Create a chatbot that can search for the latest SKD questions, validate information, and provide interactive explanations using Gemini 2.0's native capabilities.

#### 🛠️ Tools & Tech Stack
- **Library**: `@google/genai` (Google Gemini SDK)
- **Features**:
  - **Google Search Tool**: Native Gemini 2.0 tool for automatic web search.
  - **Thinking Mode**: Reasoning step-by-step before answering.

#### 📅 Estimated Work: 2 - 3 Hours

| Phase | Task | Time |
| :--- | :--- | :--- |
| **1. Preparation** | Setup Environment Variable (Gemini API Key) | 15 Mins |
| **2. Backend** | Update `gemini.service.ts` (Streaming & Thinking) | 1 Hour |
| **3. Frontend** | Update UI to display "Thinking Process" | 1 Hour |
| **4. Testing** | Test questions & validate answers | 30 Mins |

#### 🚀 Implementation Steps

##### Step 1: Setup Environment Variable
Ensure `GEMINI_API_KEY` is in `.env`.
```env
GEMINI_API_KEY=AIzaSy...
GENERATIVE_MODEL=gemini-2.0-flash-thinking-exp-1219
```

##### Step 2: Update Service Layer (`src/lib/services/ai/gemini.service.ts`)
We need to handle the streaming response from Google GenAI and safely parse the chunks to avoid TypeScript errors.

```typescript
import { GoogleGenerativeAI, Content } from "@google/genai";

// ... existing code ...

export async function* generateAiResponse(
  history: Content[],
  message: string,
  modelName: string = "gemini-2.0-flash-thinking-exp-1219"
) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ 
    model: modelName,
  });

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(message);

  for await (const chunk of result.stream) {
    // FIX: Check for candidates existence to avoid "possibly undefined" errors
    const candidates = chunk.candidates;
    if (!candidates || candidates.length === 0) continue;
    
    const parts = candidates[0].content.parts;
    for (const part of parts) {
      if (part.text) {
        yield part.text; // Yield text chunks to the caller
      }
    }
  }
}
```

##### Step 3: Update API Route (`src/app/api/chat/route.ts`)
The API route must consume the generator and stream it back to the client using `ReadableStream`.

```typescript
import { generateAiResponse } from "@/lib/services/ai/gemini.service";

// ... inside POST handler ...

const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    try {
      const generator = generateAiResponse(history, message);
      for await (const chunk of generator) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    } catch (error) {
      controller.error(error);
    }
  }
});

return new Response(stream, {
  headers: { 
    'Content-Type': 'text/plain; charset=utf-8',
    'Transfer-Encoding': 'chunked'
  }
});
```

##### Step 4: Update Frontend (UI Thinking)
Modify chat components to handle the data stream containing "thought" and "answer" parts.
1.  Update `useChat` hook to parse the stream.
2.  Create a UI component (e.g., Accordion) to hide/show the AI's thinking process.
