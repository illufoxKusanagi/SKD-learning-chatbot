# SKD Learning Chatbot — Phase 0 Context

## 1. Database Schema (`src/lib/db/schema.ts`, `src/lib/db/index.ts`)

PostgreSQL with `pgvector` (`vector(768)` + HNSW `vector_cosine_ops` indexes), initialized via Drizzle ORM (`ensureDatabaseSchema`).

### Normalized SKD & CAT Tables
- **`study_materials`**:
  - `id` (UUID PK), `slug` (varchar 160 unique), `title` (text), `category` (`"TWK"`, varchar 10), `subtopic` (text), `summary` (text), `content_markdown` (text), `content_hash` (SHA-256 hex, varchar 64), `source_type` (varchar 30), `source_url` (text), `source_meta` (jsonb), `embedding` (`vector(768)`), `created_at`, `updated_at`.
  - Indexes: `study_materials_embedding_idx` (HNSW cosine), `study_materials_subtopic_idx` (`category`, `subtopic`).
- **`quiz_questions`**:
  - `id` (UUID PK), `slug` (varchar 160 unique), `category` (`TWK` | `TIU` | `TKP`), `subtopic` (text), `difficulty` (`medium` | `hots`), `reasoning_chain` (text), `stem` (text), `options` (jsonb `{ A, B, C, D, E }`), `hint` (text), `correct_option` (varchar 5; `A..E` for TWK/TIU, `null` for TKP), `scoring_rubric` (jsonb `{ A..E }` 1..5 for TKP, `null` for TWK/TIU), `option_rationales` (jsonb `{ A, B, C, D, E }`), `source_url` (text), `source_meta` (jsonb), `is_validated` (boolean), `created_at`, `updated_at`.
  - Index: `quiz_questions_cat_subtopic_idx` (`category`, `subtopic`, `is_validated`).
- **`quiz_question_materials`**:
  - Composite PK (`question_id`, `material_id`) linking `quiz_questions.id` and `study_materials.id` (`ON DELETE CASCADE`).
  - Index: `quiz_question_materials_material_idx` (`material_id`).
- **`quiz_sessions`**:
  - `id` (UUID PK), `user_id` (FK -> `users.id`), `guest_session_id` (text), `mode` (varchar 20), `status` (`in_progress`, etc.), `duration_seconds` (int), `started_at`, `completed_at`, `question_order` (jsonb `string[]`), `flagged_question_ids` (jsonb `string[]`), `score_summary` (jsonb), `created_at`.
- **`quiz_attempts`**:
  - `id` (UUID PK), `chat_id` (FK -> `chat_history.id`), `session_id` (FK -> `quiz_sessions.id`), `question_id` (FK -> `quiz_questions.id`, `ON DELETE SET NULL`), `user_id` (FK -> `users.id`), `rag_source_id`, `category`, `subtopic`, `question_stem`, `options`, `correct_option`, `scoring_rubric`, `rubric_rationale`, `user_answer`, `score_earned`, `max_score` (default 5), `ai_explanation`, `status`, `time_spent_seconds`, `used_hint`, `created_at`, `answered_at`.
  - Unique index: `quiz_attempts_session_question_uidx` (`session_id`, `question_id`).
- **`question_access_logs`**:
  - `id` (UUID PK), `actor_key` (text: `user:<uuid>` or `guest:<uuid>`), `user_id` (FK -> `users.id`), `guest_session_id` (text), `question_id` (FK -> `quiz_questions.id`, `ON DELETE CASCADE`), `category` (`TWK` | `TIU` | `TKP`), `is_accessed` (boolean), `access_count` (int), `last_accessed_at` (timestamp), with RLS enabled and 24h expired guest log cleanup.
- **`rate_limits`**:
  - Composite PK (`key`, `window_start`), `count` (int).
- **Existing Core Tables**: `users`, `chat_history` (`conversations`), `messages`, `rag_data` (`vector(768)` + HNSW cosine + `rag_data_external_id_uidx`).

---

## 2. SKD Scoring Engine (`src/lib/scoring/skd-scoring.ts`)

- **`OFFICIAL_SKD_CONFIG`**: 110 questions, 6000s (100 min), max 550:
  - `TWK`: 30 questions, passing grade `65`, max `150`
  - `TIU`: 35 questions, passing grade `80`, max `175`
  - `TKP`: 45 questions, passing grade `166`, max `225`
- **`MINI_TRYOUT_CONFIG`**: 30 questions, 1620s (27 min), max 150:
  - `TWK`: 8 questions, passing grade `18`, max `40`
  - `TIU`: 10 questions, passing grade `23`, max `50`
  - `TKP`: 12 questions, passing grade `45`, max `60`
- **`scoreSingleQuestion(input)`**:
  - Unanswered (`null`/`undefined`): `0` (including TKP)
  - `TKP`: graduated `1..5` from `scoringRubric[selectedOption]`
  - `TWK` / `TIU`: `5` when `selectedOption === correctOption`, else `0`
- **`evaluateCatTryout(items, mode = "cat_tryout")`**:
  - Computes per-category `SubtestScoreBreakdown` (`questionCount`, `answeredCount`, `scoreEarned`, `maxScore`, `passingGrade`, `passed`, `timeSpentSeconds`), overall `passedOverall` / `verdict` (`"LULUS" | "TIDAK LULUS"`), and `weakSubtopics` (`accuracyRatio < 0.7`, sorted ascending).

---

## 3. Content Validation Contract (`src/lib/validation/content-contract.ts`)

- **`CANONICAL_SUBTOPICS`**:
  - `TWK` (9): `Nasionalisme`, `Integritas`, `Bela Negara`, `Pilar Negara - Pancasila`, `Pilar Negara - UUD NRI 1945`, `Pilar Negara - NKRI`, `Pilar Negara - Bhinneka Tunggal Ika`, `Bahasa Indonesia`, `Sejarah Kebangsaan`
  - `TIU` (7, **strict No-Figural rule**): `Verbal - Analogi`, `Verbal - Silogisme`, `Verbal - Analitis`, `Numerik - Deret`, `Numerik - Perbandingan Kuantitatif`, `Numerik - Aritmetika Sosial`, `Numerik - Soal Cerita`
  - `TKP` (6): `Pelayanan Publik`, `Jejaring Kerja`, `Sosial Budaya`, `TIK`, `Anti-Radikalisme`, `Profesionalisme`
- **`REQUIRED_MATERIAL_HEADINGS`**: `## Inti Konsep`, `## Logika Sebab-Akibat`, `## Jembatan Soal HOTS`, `## Jebakan Klasik`.
- **Schemas & Guards**:
  - `StudyMaterialSeedSchema`: lowercase kebab-case `slug`, `category: "TWK"`, canonical TWK `subtopic`, `summary` (>=20 chars), `contentMarkdown` (>=120 chars + all 4 mandatory headings).
  - `QuizQuestionSeedSchema` (discriminated union by `category`): `reasoningChain` (>=30 chars) must appear strictly before `options` (`verifyReasoningBeforeOptions`); `stem` (>=20 chars, no `A./B.` leak); `options` & `optionRationales` (`A..E` non-empty); `hint` (>=10 chars); `TWK` requires `materialSlugs.length >= 1` resolving to known material slugs; `TIU` & `TKP` require `materialSlugs: []`; `TKP` requires `correctOption: null` and `scoringRubric` as exact permutation of `[1,2,3,4,5]`.
  - Quality warnings: `checkTkpOptionLengthWarning` (>35% above median of other 4 options) and >30% answer-key skew per file (>=10 TWK/TIU items).
  - `computeContentHash(markdown)`: SHA-256 hex of trimmed markdown used for embedding idempotency.

---

## 4. Content CLI Commands

- `npm run validate:content` (`scripts/validate-content.ts`, supports `--with-db`): validates `data/materials/*.json` and `data/quiz-bank/*.json`.
- `npm run import:content` (`scripts/import-content.ts`, supports `--dry-run` and `--force`): ensures DB schema, validates bundles, embeds `study_materials` via Gemini `RETRIEVAL_DOCUMENT` (768-d) only when new or `contentHash` changed, and upserts `quiz_questions` + `quiz_question_materials`.
- `npx tsx scripts/migrate-legacy-quiz-bank.ts`: idempotently moves legacy `data/quiz-bank/2026-11-b01..b06.json` to `data/quiz-bank/legacy/`, promotes valid items from `data/study-material-bank/` and `data/study-material-bank/raw/` to `data/materials/twk-staged.json`, and merges `data/quiz-bank/raw/` + migrated non-Figural legacy items into `data/quiz-bank/{twk,tiu,tkp}-bank.json`.

---

## 5. Current Seeded Counts (PostgreSQL + `data/` — Full 110q CAT Ready)

- **`study_materials`**: **55** TWK materials (all 55 embedded with 768-d vectors, including `data/materials/twk-hots-batch3.json` [+18])
- **`quiz_questions`**: **405** validated HOTS questions (`125 TWK / 155 TIU / 125 TKP` — Full 110q CAT Ready, including 36 TIU Figural diagrams in `tiu-figural.json` and +150 Batch 3 HOTS items in `data/quiz-bank/{twk,tiu,tkp}-hots-batch3.json`: +60 TWK, +45 TIU, +45 TKP)
  - `TWK`: **125** (including +60 in `data/quiz-bank/twk-hots-batch3.json`)
  - `TIU`: **155** (including 36 Figural diagrams in `tiu-figural.json` and +45 in `data/quiz-bank/tiu-hots-batch3.json`)
  - `TKP`: **125** (including +45 in `data/quiz-bank/tkp-hots-batch3.json`)
- **`quiz_question_materials`**: **126** TWK question-to-material links

---

## 6. Phase 1 Architecture — Bank Materi TWK & Deterministic Deep Tutor

### Services (`src/lib/services/material.service.ts`)
- **`listStudyMaterials(filters)`**: Lists TWK materials (`StudyMaterialSummaryItem[]`) filtered by optional `subtopic`, `search`, and `weakOnly`, enriched with validated `linkedQuestionCount` and user/guest `mistakeCount` (attributing TWK `scoreEarned < 5` attempts via `questionId` -> `ragSourceId` -> `subtopic`).
- **`getStudyMaterialBySlug(slug, opts)`**: Loads full TWK `StudyMaterialDetail` (`contentMarkdown`, `linkedQuestionSlugs`, `mistakeCount`).
- **`getDeterministicTutorContext(input)`**: Resolves `quizQuestions` + `quizAttempts` + linked TWK `studyMaterials` deterministically (returns empty `materials` for TIU/TKP).
- **`buildDeepTutorPrompt(userMessage, context)`**: Builds structured prompts for three modes:
  1. Pure TWK material study mode (4 HOTS pillars without a question)
  2. Pre-answer conceptual hint mode (Anti-Spoiler guard — forbids leaking `A–E` or option scores)
  3. Post-answer deep discussion (`Bedah Bareng Tutor` — 3-part diagnosis, proof, counterfactual & `< 50s` rule)

### API Routes
- **`GET /api/materials`** (`src/app/api/materials/route.ts`): Lists TWK materials with optional `subtopic` (validated against `CANONICAL_SUBTOPICS.TWK`), `q`, `weakOnly`, and guest `chatIds`.
- **`GET /api/materials/[slug]`** (`src/app/api/materials/[slug]/route.ts`): Fetches full material detail by slug (`404 MATERIAL_NOT_FOUND` when missing).
- **`POST /api/quiz`** (`src/app/api/quiz/route.ts`): Supports optional `materialSlug` in `action: "next"` (prefers unattempted validated questions linked to that material, falling back to subtopic TWK questions) and includes `questionId` in `sanitizeQuizAttempt`.
- **`POST /api/chat`** (`src/app/api/chat/route.ts`): Resolves `getDeterministicTutorContext` when `isTutorDiscussion`, `questionId`, `questionSlug`, `materialSlugs`, or answered `quizAttemptId` is passed, bypassing similarity RAG.

### Frontend Routes & Modular Components
- **`/materi`** (`src/app/materi/page.tsx`, public in `src/middleware.ts` alongside `/tryout`): Responsive TWK Bank Materi page with `AppSidebar` navigation and `"Kembali ke Chat"` session preservation.
- **`src/components/materials/`**:
  - `material-markdown-viewer.tsx`: Splits the 4 HOTS headings (`Inti Konsep`, `Logika Sebab-Akibat`, `Jembatan Soal HOTS`, `Jebakan Klasik`) into scannable semantic `Card` sections.
  - `material-filter-bar.tsx`: Search input, *"Topik TWK Sering Salah"* toggle with mistake count badge, and 9 canonical TWK subtopic filter pills.
  - `material-drawer.tsx`: Reusable right-side `Sheet` drawer supporting `0 ms` preloaded rendering or `/api/materials/[slug]` fetch with practice & tutor CTAs.
  - `material-browser-workspace.tsx`: Desktop split-view + mobile drawer workspace with `Map`-cached details and `localStorage` guest `chatIds` mistake tracking.
- **`/chat` Deep-Linking** (`src/app/chat/page.tsx`, `src/hooks/use-chat.ts`): Handles `?practiceMaterial=<slug>` (opens `QuizCanvasPanel` and loads a `0 ms` TWK practice pack via `usePracticePack`), `?discussMaterial=<slug>` (sends deterministic `materialSlugs` tutor discussion), and `?discussQuestion=<slug>&selectedAnswer=<A-E>` (triggers Deep Tutor post-exam analysis for CAT review items), plus header links to `/materi` and `/tryout`.

---

## 7. Phase 2 Architecture — Mode A `0 ms` Practice Packs, Hint Toggle, Option Rationales & Tutor Bridge

### Service & Scoring (`src/lib/services/practice.service.ts`, `src/lib/scoring/skd-scoring.ts`)
- **`createPracticePack(input)`**: Creates a `quizSessions` (`mode: "practice"`, `status: "in_progress"`) and returns `PracticePackResult` (`10 | 15 | 20` validated questions prioritized unattempted-first, filtered by `category`, `subtopic`, `materialSlug`, `wrongOnly`, or explicit `questionIds`), pre-attaching TWK `materials` (`PreloadedMaterialData`) for `0 ms` `<MaterialDrawer>` reading, plus `hint`, `correctOption`, `scoringRubric`, and `optionRationales`.
- **`syncPracticeAttempt(input)`**: Idempotently upserts `quizAttempts` (`onConflictDoUpdate` on `(sessionId, questionId)`), computes authoritative BKN score via `scoreSingleQuestion`, and automatically marks `quizSessions.status = "completed"` with `scoreSummary` (`byCategory`, `weakSubtopics`) once all pack items are answered.

### API Routes
- **`GET /api/practice/pack`** (`src/app/api/practice/pack/route.ts`): Query params `count=10|15|20`, `category`, `subtopic`, `materialSlug`, `wrongOnly`, `questionIds`, `chatIds`, `sessionIds` (guest ownership via `skd_guest_chat_ids` + `skd_guest_practice_session_ids`).
- **`POST /api/practice/sync`** (`src/app/api/practice/sync/route.ts`): Zod-validated payload `{ sessionId, questionId, chatId?, selectedOption, usedHint?, timeSpentSeconds? }`.

### Client Hook & Modular UI Primitives (`< 250` lines per `.tsx` file in `src/components/chat/`)
- **`usePracticePack`** (`src/hooks/use-practice-pack.ts`): Manages `sessionId`, `questions`, `answers`, `revealedHints`, `activeIndex`, and `skd_guest_practice_session_ids` (`localStorage`, max 30). `selectOptionInstant` grades synchronously in `0 ms` via `scoreSingleQuestion` and dispatches background `POST /api/practice/sync` with `"Coba Lagi"` retry toast (`retrySync`), plus `retryWrongQuestions` for 1-click re-practice of suboptimal/wrong items (`scoreEarned < 5`).
- **`src/components/chat/`**:
  - `quiz-card.tsx` + `quiz/quiz-card-skeleton.tsx` + `quiz/quiz-card-footer.tsx` + `quiz/quiz-legacy-rationale.tsx`: Backward-compatible inline chat & Mode A `QuizCard` with sync status, *"Baca Materi Terkait"* (`0 ms` `<MaterialDrawer>`), and *"Bedah Bareng Tutor"*.
  - `quiz/quiz-pack-configurator.tsx`: `ToggleGroup` configurator for `10/15/20` count, `Campuran/TWK/TIU/TKP`, and `Semua Soal` vs. `Pernah Salah (Review)`.
  - `quiz/quiz-hint-toggle.tsx`: Pre-answer conceptual `hint` toggle rendered in a subtle `bg-muted/50` `Alert`.
  - `quiz/quiz-option-rationale-list.tsx`: Instant `A..E` option rationale cards with semantic `success`/`warning`/`destructive`/`secondary` badges.
  - `quiz/quiz-summary-view.tsx` + `quiz/quiz-summary-breakdown.tsx`: Accuracy %, per-subtest breakdown, `weakSubtopics` (`< 70%`), 1-click *"Latih Ulang Soal Salah"*, and *"Paket Latihan Baru"*.
  - `quiz/quiz-canvas-panel.tsx` + `quiz/quiz-canvas-workspace.tsx` + `quiz/quiz-canvas-header.tsx` + `quiz/quiz-canvas-footer.tsx`: Split-panel & mobile `Sheet` workspace supporting both Mode A practice packs (with embedded `0 ms` `<MaterialDrawer>`) and inline chat quiz cards.

---

## 8. Phase 3 Architecture — Mode B Simulasi CAT BKN (`/tryout`), 1–110 Grid, Persistent Timer & Diagnostic Report

### Service Layer (`src/lib/services/tryout.service.ts`)
- **`getTryoutBankReadiness()`**: Queries validated `quizQuestions` counts by category (`TWK`, `TIU`, `TKP`) and computes `fullCat` (`30/35/45 = 110`, 6000s, PG `65/80/166`) and `miniCat` (`8/10/12 = 30`, 1620s, PG `18/23/45`) readiness & per-subtest deficits.
- **`startTryoutSession(input)`**: Enforces bank readiness (`400 BANK_NOT_READY`), prioritizes unattempted validated questions per category (`TWK` -> `TIU` -> `TKP`), creates a `quizSessions` (`mode: "cat_tryout" | "mini_tryout"`, `status: "in_progress"`, `questionOrder`, `flaggedQuestionIds`), and returns masked `TryoutSessionDetail` with zero spoilers.
- **`getTryoutSessionState(input)`**: Computes server-authoritative `remainingSeconds` from `startedAt + durationSeconds`; automatically finalizes expired `in_progress` sessions; returns masked questions while `in_progress` and full `TryoutQuestionReviewItem[]` (`correctOption`, `scoringRubric`, `optionRationales`, `reasoningChain`, preloaded TWK `materials`, and `scoreSummary`) once `completed`.
- **`updateTryoutProgress(input)`**: Transactionally locks `quizSessions` (`FOR UPDATE`), rejects expired/completed sessions (`409 EXAM_TIME_EXPIRED` / `EXAM_ALREADY_FINISHED`), upserts pending `quizAttempts` (`selectedOption`, clamped `timeSpentDeltaSeconds`), and toggles `flaggedQuestionIds`.
- **`finalizeTryoutSession(input)`**: Idempotently grades all `questionOrder` items (`0` for unanswered, graduated `1..5` for TKP, `+5`/`0` for TWK/TIU), evaluates independent subtest passing grades via `evaluateCatTryout`, persists `scoreSummary`, and locks the session as `completed`.
- **`listTryoutSessions(input)`**: Lists up to 20 tryout sessions for authenticated users or guest `sessionIds` (`isNull(userId)`), auto-finalizing any expired `in_progress` rows.

### API Routes
- **`GET /api/tryout/readiness`** (`src/app/api/tryout/readiness/route.ts`): Public readiness summary for Full CAT & Mini CAT.
- **`GET / POST /api/tryout/sessions`** (`src/app/api/tryout/sessions/route.ts`): Lists user/guest tryout sessions (`?sessionIds=...`) or starts a new `cat_tryout` / `mini_tryout` session.
- **`GET / PATCH / POST /api/tryout/sessions/[id]`** (`src/app/api/tryout/sessions/[id]/route.ts`): Polls session state, updates answer/flag/timeSpentDeltaSeconds, or finalizes `{ action: "finish" }`.

### Client Hook, Routes & Modular UI (`< 150` lines/page, `< 250` lines/component)
- **`useCatSession`** (`src/hooks/use-cat-session.ts`): Syncs `deadlineMs` against server `remainingSeconds` (surviving tab backgrounding via `visibilitychange`), tracks per-question `timeSpentDeltaSeconds`, performs optimistic answer/flag updates with background `PATCH` + retry toast, and auto-submits once when timer hits `0` or on `409 EXAM_TIME_EXPIRED`. Persists guest session UUIDs in `localStorage` (`skd_guest_tryout_session_ids`, max 20).
- **App Router Pages**:
  - `/tryout` (`src/app/tryout/page.tsx`, public in `src/middleware.ts`): Lobby shell with guest sync notice, `AppSidebar`, and `<TryoutLobbyWorkspace>`.
  - `/tryout/[sessionId]` (`src/app/tryout/[sessionId]/page.tsx`, public in `src/middleware.ts`): Live exam & post-exam diagnostic shell hosting `<CatExamWorkspace>`.
- **Components (`src/components/tryout/`)**:
  - `tryout-utils.ts`: Guest UUID storage (`skd_guest_tryout_session_ids`), `HH:MM:SS`/`MM:SS` countdown formatter, `Xm Ys` duration formatter, and date formatter.
  - `tryout-lobby-workspace.tsx` + `tryout-mode-cards.tsx` + `tryout-history-list.tsx`: Active `in_progress` resume banner, Full CAT vs. Mini CAT readiness cards (with Bank Readiness Guard deficits), and completed tryout history cards.
  - `exam-countdown-timer.tsx`: Semantic timer badge (`secondary` >= 10m, `warning` < 10m, pulsing `destructive` < 2m).
  - `cat-navigation-grid.tsx`: Filterable `1..110` (`1..30`) number grid (`Belum Dijawab`, `Ragu-ragu` `warning`, `Sudah Dijawab` `success`, active `ring-2 ring-primary`), persistent on desktop and inside a mobile `<Sheet>`.
  - `cat-question-stage.tsx` + `cat-finish-dialog.tsx`: Zero-spoiler `A–E` exam stage with `"Ragu-ragu"` toggle, Prev/Next navigation, and confirmation `<Dialog>` summarizing answered/unanswered/flagged counts.
  - `cat-exam-workspace.tsx`: Coordinates `useCatSession`, switching seamlessly from live exam mode to post-exam diagnostic mode.
  - `cat-diagnostic-report.tsx` + `cat-review-list.tsx` + `cat-review-card.tsx`: Official `LULUS` / `TIDAK LULUS` passing-grade breakdown with `<Progress>` bars, per-subtest `Xm Ys` timing, `weakSubtopics`, filterable `1..110` review cards reusing `<QuizOptionRationaleList>`, `0 ms` `<MaterialDrawer>` for TWK items, and `/chat?discussQuestion=<slug>&selectedAnswer=<A-E>` Deep Tutor links.
- **Cross-App Integration**:
  - `src/components/ui/app-sidebar.tsx`, `src/app/chat/page.tsx`, and `src/app/materi/page.tsx` link directly to `/tryout`.
  - `src/app/quiz-history/page.tsx` merges `skd_guest_tryout_session_ids` alongside `skd_guest_practice_session_ids` so guest tryout attempts appear in `/quiz-history`.

---

## 9. Gemini AI Resilience, Domain Guardrails & Multi-Quiz Chat Packs

- **`src/lib/services/ai/gemini.service.ts`**:
  - **2-Model `.env` Cascade (`streamGeminiWithCascade`)**: Uses official `@google/genai` types (`GenerateContentConfig`, `GenerateContentResponse`, `Content`) with zero `any` types; deduplicated cascade `[GENERATIVE_MODEL || FALLBACK_GENERATIVE_MODEL, FALLBACK_GENERATIVE_MODEL]` defaulting to `GENERATIVE_MODEL="gemini-4-hydrogen"` and `FALLBACK_GENERATIVE_MODEL="gemini-3.5-flash-lite"`; strips `tools` on fallback, parses `retry in`/`retryDelay` (`900..3500ms`) or uses jittered backoff only **before** any text chunk is yielded, guards `MAX_TOKENS` on quiz generation, and formats Cloudflare Workers-readable error logs (`[name (status)]: message`).
  - **Strict SKD Scope & Curated-Only Quiz Constraint**: `SKD_SYSTEM_INSTRUCTION` enforces strict SKD CPNS domain boundaries, anti-prompt-injection rules, and forbids fabricating multiple-choice questions (`A–E`) or `<quiz_meta>` blocks in chat text; `QUIZ_GENERATION_INSTRUCTION` and LLM quiz-generation prompts are removed. All single and batch quizzes in `/api/chat` (including `"soal baru"` / `wantsNewVariation` requests, which prepend an accuracy notice) and `/api/quiz` (`action: "next"`) are served exclusively from validated `quiz_questions` via `question-access.service.ts` (zero LLM-invented quizzes; `isBlockedInjection` triggers a deterministic polite Indonesian refusal before any model call).
  - **0-RPM Synchronous `generateChatTitle`**: Deterministic synchronous Indonesian title formatter (`<= 45` chars, word-boundary truncation, fallback `'Sesi Belajar SKD'`, 0 Gemini calls).
  - **Strict `shouldEnableGoogleSearch(userMessage)`**: Requires `ENABLE_GEMINI_GOOGLE_SEARCH === 'true'` AND explicit current-affairs regex (`berita terbaru`, `isu terkini`, `aturan terbaru`, `regulasi terbaru`, `ikn terkini`, `cpns 2025-2029`).
  - **Token & History Bounds**: History cleaned of `<!--QUIZ_ATTEMPT:...-->`, `<!--QUIZ_EVAL:...-->`, `<!--QUIZ_PACK:...-->`, `<!--CHAT_ERROR:...-->`, and `<quiz_meta>` markers, capped to last **8 turns**, **1,600 chars/turn**, **9,000 total chars**; Turn-2 supplementary stream uses compact `TURN2_SYSTEM_INSTRUCTION` and emits an Indonesian fallback notice (`*Catatan: Ringkasan trik cepat tambahan gagal dimuat karena batas waktu/kuota. Pembahasan inti di atas tetap valid.*`) on timeout/quota failure.
  - **`classifyAiStreamError`**: Classifies `TOKEN_LIMIT_EXCEEDED` first, then `RATE_LIMITED` (`429` / `RESOURCE_EXHAUSTED` / `RPM` / `TPM` / `RPD` before `503`), then `MODEL_OVERLOADED` (`503`), `STREAM_TIMEOUT`, and `AI_STREAM_ERROR`.
- **`src/lib/services/question-access.service.ts`, `quiz-intent.ts`, `rag.service.ts` & `embeddings.service.ts`**:
  - `question-access.service.ts` exports `pickAndRecordFromPool` and `pickAndRecordByCategories` backed by `question_access_logs`: prioritizes `is_accessed = false` items with subtopic diversity, silently resets `is_accessed = false` for the pool/category when `unaccessed < needed` (cycle wrap-around), and atomically upserts `is_accessed = true` + `access_count + 1` across Chat, `/api/quiz`, `practice.service.ts`, and `tryout.service.ts`.
  - `quiz-intent.ts` handles bilingual prompt-injection detection (`isPromptInjectionAttempt` / `isBlockedInjection`), strict SKD-only follow-up inheritance (`FOLLOW_UP_PATTERN` guard preventing off-topic queries from inheriting prior subtest history), and per-category quiz count parsing (`TWK`/`TIU`/`TKP`) proportionally capped at `MAX_CHAT_QUIZ_BATCH = 30` with an explicit AI cap notice when `> 30` is requested.
  - `rag.service.ts` short-circuits immediately on `isBlockedInjection`, queries up to 260 validated `quiz_questions` in 1 fast DB call (0 embeddings) for **all** `isQuizRequest` turns (including `wantsNewVariation`) using `pickAndRecordByCategories` / `pickAndRecordFromPool` and populating `questionId`, filters `dbChunks` with `RAG_SIMILARITY_THRESHOLD` (default `0.42`, capped to **3** chunks / **1,600** chars), and filters in-memory `SKD_KNOWLEDGE_BASE` fallback/supplement chunks to `similarity >= 0.25`.
  - `embeddings.service.ts` uses typed `EmbedContentResponse` from `@google/genai` and retries transient `429`/`503`/`UNAVAILABLE`/`RESOURCE_EXHAUSTED` errors up to 2 times with jittered `900..1400ms` backoff.
- **`src/app/api/chat/route.ts`, `src/app/api/quiz/route.ts`, `src/hooks/use-chat.ts` & `src/components/chat/quiz-deck-card.tsx`**:
  - `chat` uses `resolveOptionalUserId`, `getOrCreateGuestSession` (`resolvedGuestSessionId`) + `attachGuestCookie` (`skd_guest_sid`), and `readVerifiedGuestId` for guest chat ownership; persists both single-question (`<!--QUIZ_ATTEMPT:id-->`) and multi-question (`<!--QUIZ_PACK:id1,id2,...-->`) curated quizzes directly from `ragResult.unattemptedBenchmarks` with `question_id` populated on `quiz_attempts` (rendered via `src/components/chat/quiz-deck-card.tsx`); enforces strict `parseQuizOptionChoice` answer syntax matching (`^[A-E]$` and explicit `opsi|pilihan|jawaban|pilih` forms even with `quizAttemptId`); fetches last `10` DB messages and server-verifies `isDuplicateRetriedTurn` before skipping user message insertion/slicing history; `chatRateLimit` (`max: 30`, `guestMax: 20`, `daily: { max: 300, guestMax: 100 }`) skips when `X-Chat-Retry: 1` is sent by `useChat` retry, while bounded `chatRetryRateLimit` (`max: 10`, `guestMax: 6`, `daily: { max: 60, guestMax: 25 }`) caps retries against header spoofing.
  - `POST /api/quiz` (`action: "next"`) resolves `effectiveGuestSessionId`, queries validated `quiz_questions` (supporting `materialSlug`, `category`, and `subtopic`), and selects 1 question exclusively via `pickAndRecordFromPool` (0 Gemini calls, 0 LLM hallucinations).

---

## 10. Security Hardening, Cloudflare Edge Support & Frontend Modularization

- **PBKDF2 Web Crypto Auth (`src/lib/auth/password.ts`, `src/lib/auth.ts`)**:
  - Uses Web Crypto `PBKDF2` (`SHA-256`, `100,000` iterations, 16-byte random salt, 256-bit key in `pbkdf2_sha256$<iterations>$<salt>$<hash>` format with constant-time comparison) for Edge/Cloudflare Workers compatibility, while verifying legacy `bcryptjs` hashes and transparently rehashing on login (`needsPasswordRehash`).
- **Signed Guest Session Cookie (`src/lib/auth/guest-session.ts`, `src/lib/auth/optional-session.ts`)**:
  - Issues and verifies HMAC-SHA256 signed `HttpOnly; SameSite=Lax` cookie `skd_guest_sid` (`<uuid>.<base64url-sig>`, 24h `Max-Age`, `Secure` in production, signed via `NEXTAUTH_SECRET`) across `/api/chat`, `/api/quiz`, `/api/practice/*`, and `/api/tryout/*`, paired with `resolveOptionalUserId` for fail-closed production session handling.
- **Cloudflare Workers & Hyperdrive Support (`src/lib/db/index.ts`)**:
  - Uses request-scoped `WeakMap` DB/client caching keyed by `getCloudflareContext({ async: false }).ctx`, resolving `env.HYPERDRIVE.connectionString` first, then `env.DATABASE_URL` and `process.env.DATABASE_URL` (`prepare: false`, `fetch_types: false`, `max: 1`, `idle_timeout: 2`), with a singleton pool fallback on Node.js.
- **XSS Removal & Modularized Pages**:
  - Removed `rehype-raw` from chat Markdown rendering to block raw HTML injection / XSS payloads while retaining `remark-gfm`, `remark-breaks`, and `rehype-highlight`.
  - Modularized `src/app/chat/page.tsx` and `src/app/quiz-history/page.tsx` into focused UI components and hooks.
