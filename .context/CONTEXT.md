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

- **`study_materials`**: **27** TWK materials (all 27 embedded with 768-d vectors)
  - `data/materials/twk-core.json`: 9 (1 per canonical TWK subtopic)
  - `data/materials/twk-staged.json`: 7 (promoted from `data/study-material-bank/raw/`)
  - `data/materials/twk-notes.json`: 11 (synthesized from verified TWK study notes)
- **`quiz_questions`**: **142** validated HOTS questions (`56 TWK / 41 TIU / 45 TKP` — Full 110q CAT Ready; 0 Figural; 3 legacy Figural questions excluded)
  - `TWK` (`data/quiz-bank/twk-bank.json` [44] + `data/quiz-bank/twk-notes-bank.json` [12]): **56** (26 promoted from `raw/`, 18 migrated from `legacy/`, 12 notes-grounded HOTS)
  - `TIU` (`data/quiz-bank/tiu-bank.json`): **41** (20 promoted from `raw/`, 21 migrated from `legacy/`)
  - `TKP` (`data/quiz-bank/tkp-bank.json` [38] + `data/quiz-bank/tkp-supplement-bank.json` [7]): **45** (20 promoted from `raw/`, 18 migrated from `legacy/`, 7 HOTS supplement)
- **`quiz_question_materials`**: **57** TWK question-to-material links

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
- **`/chat` Deep-Linking** (`src/app/chat/page.tsx`, `src/hooks/use-chat.ts`): Handles `?practiceMaterial=<slug>` (opens `QuizCanvasPanel` + requests linked TWK quiz) and `?discussMaterial=<slug>` (sends deterministic `materialSlugs` tutor discussion), plus header link to `/materi`.
