# SKD Learning Chatbot — Engineering TODOs

## 1. Remove Offline / In-Memory RAG & Seed Fallbacks (Strict Online Enforcement)

Currently, the application includes temporary offline/unseeded fallbacks that can mask an unseeded `rag_data` table or missing `GEMINI_API_KEY`:

- [ ] **Remove in-memory `SKD_KNOWLEDGE_BASE` retrieval fallback in `src/lib/services/ai/rag.service.ts` (Lines 271–312)**:
  - Delete `inMemoryCandidates` scoring against `SKD_KNOWLEDGE_BASE` inside `findRelevantContents()`.
  - Query strictly against PostgreSQL `rag_data` via `pgvector` cosine similarity (`1 - (rag_data.embedding <=> query_embedding)`).
  - Surface retrieval or database errors explicitly instead of silently falling back to static in-memory records.
- [ ] **Enforce mandatory `GEMINI_API_KEY` and vector embeddings in `scripts/seed.ts` (Lines 59–93, 159–168)**:
  - Exit with `process.exit(1)` if `GEMINI_API_KEY` is missing (matching `scripts/import-quiz-bank.ts`).
  - Never insert or update a `rag_data` row with `embedding: null`.
- [ ] **Deprecate static benchmark questions in `src/lib/datas/skd-knowledge.ts` once `data/quiz-bank/` batches are imported**:
  - Keep only core curriculum/rubric reference docs (`kisi_kisi_rubrik` and `rumus_trik_cepat`) in `skd-knowledge.ts`, and source all `contoh_soal_hots` benchmark questions from `npm run db:import-quiz`.
