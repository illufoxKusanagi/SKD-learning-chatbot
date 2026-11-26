# PRD v2.0 — SKD Personal Mastery Engine (Interactive Quiz, Bank Materi, CAT Simulator & YouTube Ingestion)

## 1. Product Direction & Scope Reset
This application is a **single-user personal SKD mastery & CAT simulation system** (not a public multi-tenant SaaS). Reliability, speed, deep conceptual grounding, and exam realism take absolute priority over public hardening.

### Explicitly Frozen / Out-of-Scope (Do NOT Implement or Expand)
- Do NOT expand `rate_limits`, guest auth/signed guest cookies, OAuth, password reset, or guest-to-user account merging.
- Do NOT build a multi-user Web Admin Dashboard or add secondary AI providers (keep `@google/genai` only).
- Leave existing auth/guest code untouched unless it directly blocks local single-user usability.

---

## 2. Pre-Requisite Reliability Audit (Phase 0 — Must Verify First)
Before adding any new feature, inspect existing files and fix silent defects:
1. **`pgvector(768)` Embedding Dimension Parity**: Verify every `gemini-embedding-001` call in `src/lib/services/rag.service.ts` and `scripts/*` explicitly passes `outputDimensionality: 768`. Remove any silent `try/catch` that masks vector query failures by quietly falling back to in-memory data; log explicit errors with clear diagnostics.
2. **Atomic Attempt Persistence**: Verify quiz attempt updates cannot double-score or corrupt state on rapid double-clicks.
3. **No Live-LLM Fallback Inside Active Timed Exams**: Remove or strictly guard any automatic live-LLM generation inside timed tryout sessions.

---

## 3. Core Functional Requirements (Unimplemented / Needs Redesign)

### FR-1: Dual-Mode Quiz Architecture
Split quiz behavior into two distinct state machines sharing clean modular UI primitives (avoid monolithic components >250 lines):

#### Mode A: Interactive Practice Mode (Gemini-Style Instant UX)
- **Batch Pre-Fetch**: Fetch a full configurable pack (10, 15, or 20 questions; filterable by `TWK`, `TIU`, `TKP`, subtopic, or `Previously Incorrect`) in a single request.
- **0 ms Client-Side Feedback (No Server-Locked Masking)**: Because this is a personal learning tool, include `correctOption`, `scoringRubric`, `hint`, `optionRationales` (A–E), and linked `materialSlugs` in the pack payload. Clicking an option must render immediate feedback with zero network wait.
- **Background Attempt Sync**: Persist answers asynchronously to `quiz_attempts` in the background with lightweight retry/toast feedback on failure.
- **Interactive Learning Controls**:
  - Top progress bar + `1/N` stepper.
  - Optional **"Tampilkan Petunjuk (Hint)"** toggle available *before* answering.
  - **Per-Option Rationale Cards**: Clearly explain *why* the user's selected option is right/wrong, *why* the correct option (or 5-point TKP option) wins, and show full 1–5 point breakdown for TKP.
  - **"Baca Materi Terkait"** quick drawer (0 ms, reads linked `study_materials` Markdown directly from DB).
  - **"Bedah Bareng Tutor"** button that injects full question + user answer + linked study material into the chat tutor.
- **End-of-Session Summary**: Accuracy, subtest score, weak subtopics list, and 1-click **"Latih Ulang Soal Salah"** action.

#### Mode B: Full CAT BKN Tryout Simulator (`/tryout`)
- **Official SKD Composition**:
  - `TWK`: 30 questions (+5 correct, 0 wrong, Passing Grade: **65**)
  - `TIU`: 35 questions (+5 correct, 0 wrong, Passing Grade: **80**)
  - `TKP`: 45 questions (1–5 graduated scale, 0 unanswered, Passing Grade: **166**)
  - Total: **110 static validated questions**, **100-minute countdown timer**, Max Score **550**.
- **Bank Readiness Guard**:
  - Full CAT mode requires $\ge 30$ TWK, $\ge 35$ TIU, $\ge 45$ TKP validated static questions.
  - If the static bank has fewer than 110 questions, offer a clearly labeled **"Mini CAT Tryout"** (proportional timing, e.g., 30 questions / 27 minutes) instead of falling back to unverified live LLM generation.
- **CAT Exam Interface**:
  - Persistent session state in PostgreSQL (`quiz_sessions`) so browser refresh never resets the timer or answers.
  - Interactive **1–110 Navigation Grid** with visual states: *Belum Dijawab*, *Sudah Dijawab*, and *Ragu-ragu (Flagged)*.
  - All keys, hints, and rationales remain hidden until explicit **"Selesai Ujian"** confirmation or timer reaching `00:00`.
- **Post-Exam Diagnostic Report**:
  - Official **LULUS / TIDAK LULUS** verdict evaluating all three passing grades independently.
  - Time-per-subtest breakdown and full question-by-question review mode connected directly to `study_materials` and the AI Tutor.

---

### FR-2: Deterministic Study Material Bank (*Bank Materi* — TWK-Only) & Deep Tutor Grounding
Solve shallow AI answers and missing causal links for TWK (e.g., counterfactual HOTS questions like *"Apa yang terjadi jika peristiwa Rengasdengklok tidak terjadi?"*).

- **Structured Study Material Schema (`study_materials` — TWK-Only)**:
  - Scoped strictly to **TWK** (`category: "TWK"`). Keep each material concise and exam-focused (~150–250 words of high-signal causal/regulatory briefs—not long encyclopedic lore).
  - **TIU & TKP** questions do NOT require `study_materials` (`materialSlugs: []`); they rely directly on `reasoningChain`, `hint`, and `optionRationales[A..E]` for instant feedback and Tutor grounding.
  - Human-readable deterministic `slug` (e.g., `twk-sejarah-rengasdengklok`, `twk-nkri-uu23-urusan-absolut`).
  - Every TWK material must store structured Markdown with 4 mandatory sections:
    1. **Inti Konsep / Regulasi / Kronologi**
    2. **Logika Sebab-Akibat & Rasionalitas** (why the rule/event matters)
    3. **Jembatan Soal HOTS** (how this concept is tested in case studies & counterfactual scenarios)
    4. **Jebakan Klasik & Pembeda Cepat** (common distractors, e.g., MA vs MK, Desentralisasi vs Tugas Pembantuan)
  - Source attribution metadata: `sourceType` (`manual` | `youtube` | `regulation` | `book`), `sourceTitle`, `sourceUrl`, `timestamps`.
- **Deterministic Foreign-Key Linking**:
  - Link TWK bank questions to one or more `study_materials` via explicit relation (`quiz_question_materials` join table or `materialSlugs[]`, min 1 for TWK), NOT fuzzy `pgvector` guessing. TIU and TKP questions store `materialSlugs: []`.
  - Reserve `pgvector` HNSW cosine search exclusively for open-ended TWK concept chat queries not attached to a specific bank question.
- **Context-Injected Deep Tutor Prompt**:
  - When invoked from a quiz question ("Bedah Bareng Tutor"), inject:
    1. Full question stem, options A–E, user's selected answer, correct answer / TKP 1–5 rubric, plus `reasoningChain` and `optionRationales`.
    2. Full Markdown content of all deterministically linked `study_materials` (present for TWK; omitted for TIU/TKP).
  - System prompt instructions MUST prohibit generic 1–2 sentence replies and require:
    - Direct diagnosis of the user's selected option vs. key.
    - Explicit bridge citing which part of the study material (for TWK) or `reasoningChain` & `optionRationales` (for TIU/TKP) proves the answer.
    - Causal/counterfactual reasoning explaining real-world, logical, or historical consequences.
- **Dedicated Material Browser (`/materi`)**:
  - Clean TWK-only filterable reader covering the **9 canonical TWK subtopics** and **"Topik TWK yang Sering Salah"** (auto-surfaced from `quiz_attempts` errors), with a 1-click **"Latihan Soal dari Materi Ini"** button.

---

 ### FR-3: Source-Agnostic Content Seeding & Validation Contract
The application MUST NOT contain any YouTube fetching, scraping, or media-processing logic. External content generation (e.g., converting YouTube tutorials or tryout reviews into JSON via an external AI) happens strictly outside the codebase. The system only provides a strict **Data Contract** and an **idempotent CLI importer**:

- **Drop-In Directory Structure**:
  - `data/materials/*.json` $\rightarrow$ Structured `study_materials` files.
  - `data/quiz-bank/*.json` $\rightarrow$ Validated `quiz_questions` files referencing `materialSlugs`.
- **Strict Zod Validation CLI (`npm run validate:content`)**:
  - Verifies required fields, unique slugs, valid `materialSlugs` references (fails fast if a question points to a non-existent study material).
  - Enforces TKP rubric integrity: exact `{1, 2, 3, 4, 5}` score set across `A`–`E` with zero duplicates.
  - Enforces complete `optionRationales` (`A`–`E`) and non-empty `hint` so Interactive Practice Mode never renders blank explanations.
- **Idempotent DB Seeder (`npm run import:content`)**:
  - Runs `validate:content` first; aborts on any schema error.
  - Upserts `study_materials` (generating `768`-dim `gemini-embedding-001` embeddings only when `contentMarkdown` hash changes to avoid redundant API calls).
  - Upserts `quiz_questions` and `quiz_question_materials` join records cleanly without duplicating rows.

---

## 4. Database Schema Evolution (Drizzle ORM / PostgreSQL)
Evolve `src/lib/db/schema.ts` cleanly while preserving existing chat history:

| Table                     | Purpose                                    | Key Columns                                                                                                                                                                                                                                                                     |
| :------------------------ | :----------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `study_materials`         | Normalized *Bank Materi* + `pgvector(768)` | `id`, `slug` (unique), `title`, `category`, `subtopic`, `contentMarkdown`, `sourceType`, `sourceUrl`, `sourceMeta` (JSONB), `embedding` (`vector(768)`), `updatedAt`                                                                                                            |
| `quiz_questions`          | Persistent normalized *Bank Soal*          | `id`, `slug` (unique), `category`, `subtopic`, `difficulty`, `stem`, `options` (JSONB `A`–`E`), `hint`, `correctOption` (nullable for TKP), `scoringRubric` (JSONB `A`–`E` $\rightarrow$ `1..5`), `optionRationales` (JSONB `A`–`E`), `sourceUrl`, `isValidated` (boolean)      |
| `quiz_question_materials` | Deterministic many-to-many link            | `questionId` (FK), `materialId` (FK)                                                                                                                                                                                                                                            |
| `quiz_sessions`           | Tracks Practice & CAT Tryout sessions      | `id`, `userId`, `mode` (`practice` \| `cat_tryout` \| `mini_tryout`), `status` (`in_progress` \| `completed` \| `abandoned`), `durationSeconds`, `startedAt`, `completedAt`, `questionOrder` (JSONB array of questionIds), `flaggedQuestionIds` (JSONB), `scoreSummary` (JSONB) |
| `quiz_attempts`           | Per-question user responses (updated)      | Add nullable `sessionId` (FK $\rightarrow$ `quiz_sessions`), `questionId` (FK $\rightarrow$ `quiz_questions`), `timeSpentSeconds`, `usedHint` (boolean)                                                                                                                         |

*Migration Note*: Migrate existing 60 questions from `data/quiz-bank/*.json` into `quiz_questions` (backfilling `hint` and `optionRationales` via a one-time enrichment script + review) and link them to initial `study_materials` slugs.

---

## 5. Engineering Quality & Verification Guardrails
1. **Clean Modular Decomposition**: Keep App Router `page.tsx` files lean (<150 lines). Extract reusable components (`QuizOptionList`, `QuizHintToggle`, `MaterialDrawer`, `CatNavigationGrid`, `ExamCountdownTimer`) instead of duplicating modal/card markup across `/chat` and `/tryout`.
2. **Automated Test Coverage (Vitest)**:
   - Unit tests for SKD scoring engine (TWK/TIU `+5/0`, TKP `1–5`, official Passing Grade pass/fail edge cases like `TWK=65, TIU=80, TKP=165` $\rightarrow$ FAIL).
   - Unit tests for YouTube staging Zod validator (catches duplicate TKP scores, missing `optionRationales`, invalid `materialSlug`).
   - Unit test verifying deterministic `materialId` lookup returns linked material without invoking vector fallback.
3. **Empirical Completion Gate**: No phase is complete until `npx tsc --noEmit`, `npm test`, and `npm run build` pass with zero errors, and `.context/CONTEXT.md` is updated with schema/route changes.

---

## 6. Phased Delivery Plan (Revised — Lean Scope)
- **Phase 0 — Audit & Schema Migration**: Verify `outputDimensionality: 768`, add Drizzle tables (`study_materials`, `quiz_questions`, `quiz_question_materials`, `quiz_sessions`), build `validate:content` + `import:content`, and migrate existing 60 JSON questions.
- **Phase 1 — Bank Materi & Deep Tutor Grounding**: Build `/materi` reader, deterministic `materialId` context injection into `/api/chat` ("Bedah Bareng Tutor"), and enforce deep causal/counterfactual tutor prompts.
- **Phase 2 — Interactive Practice Mode (Gemini-Style)**: Refactor `QuizCanvasPanel` to batch pre-fetch, 0 ms client-side grading, `Hint` toggle, per-option rationales, inline `MaterialDrawer`, and background attempt sync.
- **Phase 3 — Full CAT BKN Simulator (`/tryout`)**: Build persistent 100-minute timer, 1–110 navigation grid with *Ragu-ragu* flags, locked exam state, official PG verdict report, and Vitest suite for scoring & validation rules.

---
## 7. Authoritative JSON Data Contract & Validation Specification

All external content (whether generated from YouTube tutorials, tryout reviews, or manual notes) MUST conform to these two file formats before running `npm run import:content`.

### 7.1 Directory & File Naming Convention
- `data/materials/<category>-<topic>.json` → Array of `StudyMaterialSeed` (e.g., `data/materials/twk-sejarah.json`).
- `data/quiz-bank/<category>-<topic>.json` → Array of `QuizQuestionSeed` (e.g., `data/quiz-bank/twk-sejarah.json`).
- Every `slug` MUST be globally unique, lowercase `kebab-case`, and deterministic so repeated imports perform safe `UPSERT` operations without duplicating rows.

---

### 7.2 Contract A — Study Material (`data/materials/*.json`)
Each `contentMarkdown` field MUST contain all four HOTS headings (`## Inti Konsep`, `## Logika Sebab-Akibat`, `## Jembatan Soal HOTS`, and `## Jebakan Klasik`) so the AI Tutor and `/materi` reader always have causal depth.

#### Example Entry (`data/materials/twk-sejarah.json`)
```json
[
  {
    "slug": "twk-sejarah-rengasdengklok",
    "title": "Peristiwa Rengasdengklok & Kemandirian Proklamasi Kemerdekaan",
    "category": "TWK",
    "subtopic": "Sejarah Kebangsaan",
    "summary": "Latar belakang pengamanan Soekarno-Hatta oleh Golongan Muda pada 16 Agustus 1945 agar Proklamasi Kemerdekaan tidak dianggap sebagai hadiah Jepang oleh Sekutu.",
    "contentMarkdown": "## Inti Konsep\nPada 16 Agustus 1945 dini hari, Golongan Muda (Soekarni, Wikana, Chaerul Saleh, Aidit, dkk.) membawa Soekarno dan Mohammad Hatta ke Rengasdengklok, Karawang, sehari setelah Jepang menyerah tanpa syarat kepada Sekutu (15 Agustus 1945).\n\n## Logika Sebab-Akibat\nTerjadi perbedaan strategi krusial: Golongan Tua ingin memproklamasikan kemerdekaan melalui rapat resmi PPKI agar tidak memicu pertumpahan darah dengan tentara Jepang. Golongan Muda menolak jalur PPKI karena PPKI dibentuk oleh Jepang; jika proklamasi lahir dari PPKI, Sekutu berisiko menganggap RI sebagai negara boneka atau 'hadiah Jepang' sehingga kedaulatan Indonesia mudah dibatalkan pascaperang.\n\n## Jembatan Soal HOTS\nSoal SKD modern jarang menanyakan tanggal kejadian, melainkan dampak kontrafaktual ('apa yang terjadi jika...') atau nilai integritas/kedaulatan. Kuncinya selalu mengarah pada legitimasi kedaulatan murni hasil perjuangan bangsa sendiri dan pentingnya kompromi antargenerasi (disepakati oleh Ahmad Soebardjo).\n\n## Jebakan Klasik\n- Rengasdengklok BUKAN bentuk pemberontakan terhadap Soekarno-Hatta, melainkan upaya mengisolasi mereka dari pengaruh Jepang.\n- Perumusan naskah proklamasi terjadi di rumah Laksamana Maeda (Jakarta), bukan di Rengasdengklok.",
    "source": {
      "type": "youtube",
      "title": "Bedah TWK Full Penalaran: Sejarah Proklamasi & Kedaulatan",
      "channelName": "Privat Al Faiz",
      "url": "https://youtu.be/EXAMPLE_ID",
      "timestamps": ["04:15", "11:30"]
    }
  }
]
```

---

### 7.3 Contract B — Quiz Question (`data/quiz-bank/*.json`)
Two structural rules are mandatory:
1. **`reasoningChain` before `options`**: Authoring/seeding workflows MUST generate `reasoningChain` first to lock in legal/mathematical correctness and prevent option drift. It is hidden during active CAT exams and injected into the AI Tutor during post-answer review.
2. **Strict Scoring Separation**:
   - `TWK` & `TIU`: Binary scoring (`correctOption`: `"A"|"B"|"C"|"D"|"E"`, `scoringRubric`: `null`).
   - `TKP`: Graduated scoring (`correctOption`: `null`, `scoringRubric`: exact permutation of `{1, 2, 3, 4, 5}` across `A`–`E`; option text lengths should stay balanced so the 5-point answer is not visually obvious).

#### Example Entries (`data/quiz-bank/sample-mixed.json`)
```json
[
  {
    "slug": "twk-sejarah-rengasdengklok-001",
    "category": "TWK",
    "subtopic": "Sejarah Kebangsaan",
    "difficulty": "hots",
    "materialSlugs": ["twk-sejarah-rengasdengklok"],
    "reasoningChain": "Kekalahan Jepang pada 15 Agustus 1945 menciptakan kekosongan kekuasaan. Jika Soekarno-Hatta tetap menunggu sidang PPKI bentukan Jepang, Sekutu dapat mendelegitimasi kemerdekaan RI sebagai negara boneka/hadiah Jepang. Oleh karena itu, konsekuensi geopolitik paling krusial jika peristiwa Rengasdengklok tidak mendorong proklamasi mandiri adalah melemahnya legitimasi kedaulatan RI di mata Sekutu.",
    "stem": "Setelah Jepang menyerah kepada Sekutu pada 15 Agustus 1945, Golongan Muda mendesak Soekarno-Hatta melalui Peristiwa Rengasdengklok agar segera memproklamasikan kemerdekaan di luar mekanisme PPKI. Apabila desakan tersebut tidak terjadi dan proklamasi tetap diproses melalui sidang resmi PPKI, risiko geopolitik paling mendasar bagi Indonesia saat itu adalah...",
    "options": {
      "A": "Tentara Jepang akan segera menyerahkan seluruh persenjataannya secara sukarela kepada rakyat Indonesia.",
      "B": "Belanda tidak akan memiliki dasar hukum untuk melancarkan Agresi Militer I dan II di wilayah Nusantara.",
      "C": "Sekutu berpotensi mendelegitimasi kemerdekaan Indonesia sebagai negara boneka atau hadiah dari Jepang.",
      "D": "Sidang perumusan UUD 1945 tidak dapat dilaksanakan karena PPKI kehilangan kewenangan administratif.",
      "E": "Golongan Tua akan membubarkan BPUPKI sebelum naskah Piagam Jakarta sempat disahkan bersama."
    },
    "hint": "Pikirkan siapa yang membentuk PPKI dan bagaimana cara pandang Sekutu sebagai pemenang Perang Dunia II terhadap lembaga bentukan Jepang.",
    "correctOption": "C",
    "scoringRubric": null,
    "optionRationales": {
      "A": "Salah. Berdasarkan perjanjian menyerah kepada Sekutu, Jepang justru berkewajiban menjaga status quo dan dilarang menyerahkan senjata ke pihak Indonesia.",
      "B": "Salah. Belanda tetap berusaha memulihkan kekuasaan kolonialnya melalui NICA terlepas dari mekanisme PPKI.",
      "C": "Benar. PPKI dibentuk oleh pemerintah militer Jepang; proklamasi melalui lembaga ini berisiko besar dicap sebagai negara boneka oleh Sekutu sehingga kedaulatan RI mudah ditolak secara internasional.",
      "D": "Salah. PPKI tetap berperan mengesahkan UUD 1945 pada 18 Agustus 1945 setelah keanggotaannya diperluas agar mencerminkan representasi bangsa Indonesia.",
      "E": "Salah. BPUPKI sudah resmi dibubarkan sejak 7 Agustus 1945 sebelum Peristiwa Rengasdengklok terjadi."
    },
    "source": {
      "type": "youtube",
      "title": "Bedah TWK Full Penalaran: Sejarah Proklamasi & Kedaulatan",
      "url": "https://youtu.be/EXAMPLE_ID",
      "timestamp": "06:40"
    }
  },
  {
    "slug": "tkp-jejaring-koordinasi-001",
    "category": "TKP",
    "subtopic": "Jejaring Kerja",
    "difficulty": "hots",
    "materialSlugs": [],
    "reasoningChain": "Aspek Jejaring Kerja menilai kolaborasi proaktif antardivisi tanpa langsung melakukan eskalasi konfrontatif. Kontak langsung ke PIC untuk menyepakati jadwal (B=5) paling konstruktif; telepon sambil menawarkan bantuan teknis (C=4) sangat kooperatif tapi sedikit melewati batas kewenangan; melapor ke atasan sambil tetap bekerja (D=3) aman namun terlalu cepat eskalasi; menunda dan minta bukti (A=2) defensif; menyerahkan laporan tidak lengkap sambil menyalahkan unit lain (E=1) merusak sinergi.",
    "stem": "Laporan bulanan tim Anda akan jatuh tempo dalam dua hari, tetapi data pendukung dari divisi lain belum juga diterima meski Anda sudah mengirim surel pengingat kemarin. Tindakan paling tepat yang Anda lakukan adalah...",
    "options": {
      "A": "Meminta rekan tersebut mengirim bukti kendala resmi lalu menunda kompilasi hingga data siap.",
      "B": "Menghubungi langsung penanggung jawab divisi terkait guna menyepakati tenggat pengiriman data.",
      "C": "Menghubungi staf terkait via telepon sambil menawarkan bantuan rekapitulasi awal yang diperlukan.",
      "D": "Melaporkan hambatan data kepada atasan langsung sambil terus menyusun bagian laporan lainnya.",
      "E": "Menyerahkan laporan apa adanya tanpa data pendukung karena kelalaian berasal dari unit lain."
    },
    "hint": "Dalam aspek Jejaring Kerja, utamakan komunikasi langsung yang solutif dengan mitra kerja sebelum melakukan eskalasi ke atasan.",
    "correctOption": null,
    "scoringRubric": {
      "A": 2,
      "B": 5,
      "C": 4,
      "D": 3,
      "E": 1
    },
    "optionRationales": {
      "A": "Poin 2 — Terlalu birokratis dan defensif; hanya menunda pekerjaan tanpa membangun komitmen penyelesaian.",
      "B": "Poin 5 — Menunjukkan inisiatif koordinasi langsung ke PIC untuk mencari kepastian jadwal tanpa memicu konflik lintas unit.",
      "C": "Poin 4 — Proaktif dan suportif, namun sedikit di bawah opsi B karena belum mengunci kesepakatan tenggat resmi dengan PIC.",
      "D": "Poin 3 — Tetap bertanggung jawab pada bagian sendiri, tetapi eskalasi ke atasan sebaiknya dilakukan setelah komunikasi langsung buntu.",
      "E": "Poin 1 — Mengabaikan mutu hasil kerja tim dan bersikap saling menyalahkan antarunit."
    },
    "source": {
      "type": "manual",
      "title": "Adaptasi Kisi-Kisi BerAKHLAK Kolaboratif"
    }
  }
]
```

---

### 7.4 Reference Zod Validator (`src/lib/validation/content-contract.ts`)
Use this exact schema in both `scripts/validate-content.ts` and `scripts/import-content.ts`:

```ts
import { z } from "zod";

const OptionKeySchema = z.enum(["A", "B", "C", "D", "E"]);
const SlugSchema = z
  .string()
  .min(4)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

const OptionMapSchema = z.object({
  A: z.string().min(1),
  B: z.string().min(1),
  C: z.string().min(1),
  D: z.string().min(1),
  E: z.string().min(1),
});

const SourceMetaSchema = z
  .object({
    type: z.enum(["youtube", "tryout", "regulation", "book", "manual"]),
    title: z.string().min(2),
    channelName: z.string().optional(),
    url: z.string().url().optional(),
    timestamp: z.string().optional(),
    timestamps: z.array(z.string()).optional(),
  })
  .optional();

const REQUIRED_MATERIAL_HEADINGS = [
  "## Inti Konsep",
  "## Logika Sebab-Akibat",
  "## Jembatan Soal HOTS",
  "## Jebakan Klasik",
] as const;

export const StudyMaterialSeedSchema = z
  .object({
    slug: SlugSchema,
    title: z.string().min(5),
    category: z.literal("TWK"),
    subtopic: z.string().min(2),
    summary: z.string().min(20),
    contentMarkdown: z.string().min(120),
    source: SourceMetaSchema,
  })
  .superRefine((data, ctx) => {
    for (const heading of REQUIRED_MATERIAL_HEADINGS) {
      if (!data.contentMarkdown.includes(heading)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contentMarkdown"],
          message: `Missing mandatory HOTS heading: "${heading}"`,
        });
      }
    }
  });

const BaseQuestionFields = {
  slug: SlugSchema,
  subtopic: z.string().min(2),
  difficulty: z.enum(["medium", "hots"]).default("hots"),
  reasoningChain: z.string().min(30),
  stem: z.string().min(20),
  options: OptionMapSchema,
  hint: z.string().min(10),
  optionRationales: OptionMapSchema,
  source: SourceMetaSchema,
};

const BinaryQuestionBase = {
  ...BaseQuestionFields,
  correctOption: OptionKeySchema,
  scoringRubric: z.null(),
};

const TwkQuestionSchema = z.object({
  ...BinaryQuestionBase,
  category: z.literal("TWK"),
  materialSlugs: z.array(SlugSchema).min(1, "TWK question must link to at least one study material"),
});

const TiuQuestionSchema = z.object({
  ...BinaryQuestionBase,
  category: z.literal("TIU"),
  materialSlugs: z.array(SlugSchema).default([]),
});

const TkpQuestionSchema = z
  .object({
    ...BaseQuestionFields,
    category: z.literal("TKP"),
    materialSlugs: z.array(SlugSchema).default([]),
    correctOption: z.null(),
    scoringRubric: z.object({
      A: z.number().int().min(1).max(5),
      B: z.number().int().min(1).max(5),
      C: z.number().int().min(1).max(5),
      D: z.number().int().min(1).max(5),
      E: z.number().int().min(1).max(5),
    }),
  })
  .superRefine((data, ctx) => {
    const scores = Object.values(data.scoringRubric).sort((a, b) => a - b);
    const isExactPermutation = scores.every((val, idx) => val === idx + 1);
    if (!isExactPermutation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scoringRubric"],
        message: "TKP scoringRubric must be an exact permutation of [1, 2, 3, 4, 5]",
      });
    }
  });

export const QuizQuestionSeedSchema = z.discriminatedUnion("category", [
  TwkQuestionSchema,
  TiuQuestionSchema,
  TkpQuestionSchema,
]);

export type StudyMaterialSeed = z.infer<typeof StudyMaterialSeedSchema>;
export type QuizQuestionSeed = z.infer<typeof QuizQuestionSeedSchema>;
```

### 7.5 Importer Integrity Rules (`scripts/validate-content.ts` & `scripts/import-content.ts`)
1. **Cross-File Referential Integrity**: Load all `data/materials/*.json` first and build a `Set<string>` of valid slugs (merged with existing DB `study_materials.slug`). Fail the entire validation pass if any question references an unknown `materialSlug`.
2. **Duplicate Slug Guard**: Abort immediately if two entries across any files share the same `slug`.
3. **Content-Hash Embedding Skip**: Compute `sha256(contentMarkdown)` on each material and store it in `contentHash` (column on `study_materials`). Only call `gemini-embedding-001` (`outputDimensionality: 768`) when a material is new or its hash changed.
4. **TKP Length-Bias Warning (Non-Blocking)**: Log a console warning during `validate:content` if the 5-point TKP option is >35% longer than the median length of the other four options so the author can rebalance it.