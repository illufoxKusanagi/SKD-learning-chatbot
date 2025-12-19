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
Based on the [reference article](https://medium.com/@shaikhniamatullah/stream-ai-text-in-real-time-with-googles-gemini-api-using-angular-google-genai-56dc384f7836), we should use the simplified `chunk.text` property if available, which handles the extraction of text from candidates automatically.

```typescript
import { GoogleGenAI } from "@google/genai";

// ... existing code ...

export async function* generateAiResponse(userMessage: string) {
  try {
    const systemPrompt = `...`; // Your system prompt
    const augmentedPrompt = `${systemPrompt}\nPERTANYAAN PENGGUNA: "${userMessage}"\nJAWABAN ANDA:`;

    // Ensure you are using a model that supports the features you need
    // e.g., 'gemini-2.0-flash-thinking-exp-1219' for thinking mode
    const response = await genAI.models.generateContentStream({
      model: generativeModel,
      contents: augmentedPrompt,
      config: {
        // Only include thinkingConfig if using a supported model
        thinkingConfig: { includeThoughts: true }, 
        tools: [{ googleSearch: {} }],
      },
    });

    for await (const chunk of response) {
      // The SDK simplifies text extraction
      if (chunk.text) {
        yield chunk.text;
      }
      
      // For thinking mode, we might need to check candidates if chunk.text doesn't include thoughts
      // But for basic streaming, chunk.text is the safest bet.
      // If you need thoughts, check if the SDK exposes them on the chunk object
      // or inspect chunk.candidates[0].content.parts for 'thought' fields.
    }
  } catch (error) {
    console.error("AI generation error:", error);
    yield "Maaf, terjadi kesalahan dalam memproses pertanyaan Anda.";
  }
}
```

##### Step 3: Update API Route (`src/app/api/chat/route.ts`)
The API route remains largely the same, consuming the generator.

```typescript
// ... inside hybridChatHandler ...

const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    let fullAiResponse = "";
    
    try {
      const generator = generateAiResponse(message);
      
      for await (const chunk of generator) {
        // Send chunk to client
        controller.enqueue(encoder.encode(chunk));
        fullAiResponse += chunk; 
      }
      
      controller.close();

      // Save to Database
      if (currentChatId) {
         await db.insert(messages).values({
            chatId: currentChatId,
            role: "bot",
            content: fullAiResponse,
            createdAt: new Date(),
         });
      }
      
    } catch (error) {
      controller.error(error);
    }
  }
});
// ...
```

##### Step 4: Update Frontend (UI Thinking)
Modify chat components to handle the data stream containing "thought" and "answer" parts.
1.  Update `useChat` hook to parse the stream.
2.  Create a UI component (e.g., Accordion) to hide/show the AI's thinking process.

```
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
