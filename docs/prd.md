# PRD: SKD CPNS 2026 HOTS Question Bank Seeding Specification

## 1. Role & Objective (For Stage-2 Frontier Reasoning LLM)
You are an expert **Indonesian Civil Service Exam (SKD CPNS) Psychometrician and Subject-Matter Specialist** operating in accordance with **PermenPAN-RB** and **BKN (Badan Kepegawaian Negara) CAT 2026** standards.

Your objective is to generate a high-precision, production-ready batch of **HOTS (Higher-Order Thinking Skills)** SKD CPNS questions in strict JSON format for database seeding. Every single question must require analytical reasoning, multi-step deduction, contextual application, or mathematical proof—never shallow rote memorization.

---

## 2. Domain Taxonomy & Subtest Specifications

### 2.1. TWK (Tes Wawasan Kebangsaan)
* **Core Pillars:** Nasionalisme, Integritas, Bela Negara, Pilar Negara (Pancasila, UUD 1945, NKRI, Bhinneka Tunggal Ika), dan Bahasa Indonesia.
* **HOTS Standard:**
  * Do **NOT** ask direct trivia (e.g., *"Pada tanggal berapa BPUPKI dibentuk?"* or *"Bunyi Pasal 27 ayat 1 adalah..."*).
  * Present a concrete **case study, policy dilemma, social phenomenon, or historical conflict** (2–4 sentences), then ask the candidate to identify:
    * Which specific *butir pengamalan Pancasila* or constitutional article is being upheld/violated.
    * The Distinction between overlapping concepts (e.g., *Nasionalisme* vs *Patriotisme* vs *Bela Negara*; or *Integritas* vs *Kepatuhan Hukum*).
  * **No Strawman / Self-Refuting Distractors:** Every distractor option (A–E) must state a **true, conceptually accurate definition** of its legal article or national pillar. Candidates must eliminate distractors because they are less specific to the **case scenario in the stem**, never because the option contains a false definition (e.g., never define *Nasionalisme* as chauvinism or *Patriotisme* as passive symbolism). When testing constitutional articles (`UUD NRI 1945`), include the explicit article/verse citation (`Pasal ... ayat (...)`) in the options.
  * **Bahasa Indonesia:** Focus on effective sentences (*kalimat efektif*), main ideas (*ide pokok*), PUEBI/EYD V spelling & punctuation, and standard vocabulary (*kata baku* KBBI) embedded within short academic/policy paragraphs.
* **Scoring Rule:** Single correct answer (`5` points for correct, `0` points for the 4 distractors).

### 2.2. TIU (Tes Intelegensi Umum)
* **Core Pillars:**
  1. *Kemampuan Verbal:* Analogi hubungan kalimat/kata, Silogisme (2–3 premis dengan kuantor *Semua/Sebagian/Sementara*), dan Analitik (urutan posisi/jadwal/syarat).
  2. *Kemampuan Numerik:* Deret angka/huruf (1–3 larik), Perbandingan Kuantitatif ($X$ vs $Y$), Aritmetika Sosial, dan Soal Cerita (kecepatan, debit, perbandingan berbalik nilai, kombinasi kerja).
  3. *Kemampuan Figural (Text-Adapted):* Since this is a text-based JSON seed without external SVG assets, replace visual figural questions with **Spatial-Logical Verbal Representations** (e.g., matrix coordinate rotations or pattern transformations describable via symbolic notation) OR allocate the quota to Verbal Analytical & Numerical Quantitative Comparison.
* **HOTS Standard:**
  * Distractors must reflect **common calculation or logical traps** (e.g., forgetting to invert a work-rate fraction, or falling for *fallacy of the converse* in syllogisms).
* **Scoring Rule:** Single correct answer (`5` points for correct, `0` points for the 4 distractors).

### 2.3. TKP (Tes Karakteristik Pribadi)
* **Core Pillars:** Pelayanan Publik, Jejaring Kerja, Sosial Budaya, Teknologi Informasi & Komunikasi (TIK), Anti-Radikalisme, Profesionalisme.
* **HOTS Standard:**
  * Frame realistic workplace dilemmas in government/corporate settings where **at least 3 options look positive and reasonable**.
  * The `5`-point option must strictly align with the **core indicator of the tested pillar** (e.g., if the pillar is *Jejaring Kerja*, the 5-point answer must prioritize cross-unit collaboration; if the pillar is *Pelayanan Publik*, the 5-point answer must prioritize fast, empathetic, rule-compliant public service).
  * **Balanced Option Length (No "Length Tell"):** All 5 options (A–E) must have comparable word and character counts (within ±25% of the question's mean option length) and similar clause complexity. NEVER stuff 3–4 compound actions into the `5`-point option while keeping the `1`–`4` point options short.
* **Scoring Rule:** Weighted graduated scoring across all 5 options (`5`, `4`, `3`, `2`, `1` — every value from 1 to 5 must be used exactly once per question).

---

## 3. Strict Anti-Slop & Quality Guardrails

1. **Anti-Mode-Collapse (Scenario Diversity):**
   * Never reuse character names (banned default names: *Budi, Ani, Andi, Siti, Tono*), workplace settings, or constitutional articles within the same batch.
   * Vary the settings across ministries, hospitals, regional infrastructure agencies, state-owned enterprises (BUMN), public schools, and border security.
2. **Balanced Answer Key Distribution:**
   * Across any generated batch, the `5`-point correct option must be evenly distributed among `"A"`, `"B"`, `"C"`, `"D"`, and `"E"`. Do not cluster `5`-point answers on `"C"` or `"D"`. In addition to an even count across `"A"`, `"B"`, `"C"`, `"D"`, and `"E"`, the sequence of `5`-point answers from Q1 to QN must be **randomized** (never a predictable cycle like `A, B, C, D, E, A, B, C, D, E`).
3. **Mandatory Autoregressive Verification (`reasoningChain` First):**
   * You MUST populate the `reasoningChain` / verification field **BEFORE** generating the `options` array and assigning scores.
   * For **TIU**: Write out the exact algebraic equations and step-by-step arithmetic inside `reasoningChain`, verify that the final number matches exactly one option, and prove why the other 4 options are wrong.
   * For **TWK/TKP**: Explicitly state the exact legal article or KemenPAN-RB rubric indicator inside `reasoningChain` before scoring the options.
4. **Language & Tone:**
   * All questions, options, and explanations must be written in formal, natural **Bahasa Indonesia** (*ragam baku kedinasan*) matching official BKN CAT exams.

---

## 4. Target Schema & JSON Contract

Each question in the batch becomes one quiz bank row in `rag_data` (`docType: "contoh_soal_hots"`). The local importer converts `options[]` into `options {A..E}`, `scoringRubric {A..E}`, and `correctOption`. Use field names exactly as defined below. Key order matters: `reasoningChain` MUST appear before `options` in each question object.

```typescript
export interface SKDSeedPayload {
  batchMetadata: {
    batchId: string;          // kebab-case, unique per batch, e.g. "2026-11-b01"
    category: "TWK" | "TIU" | "TKP" | "MIXED";
    totalQuestions: number;   // must equal questions.length
    difficulty: "HOTS";
  };
  questions: Array<{
    category: "TWK" | "TIU" | "TKP";
    subtopic: string;         // one value from the canonical subtopic list below
    title: string;            // max 120 chars, descriptive, must not reveal the answer
    questionStem: string;     // scenario + question sentence; do NOT include the options
    reasoningChain: string;   // verification written BEFORE options (equations / legal article / BKN rubric indicator)
    options: Array<{
      label: "A" | "B" | "C" | "D" | "E";
      text: string;
      score: 0 | 1 | 2 | 3 | 4 | 5; // TWK/TIU: one 5 and four 0 | TKP: permutation of 1,2,3,4,5
    }>;                       // exactly 5 items, labels A to E in order
    rubricRationale: string;  // user-facing pembahasan covering why each of the 5 options gets its score
  }>;
}
```

### Canonical Subtopics
* **TWK:** `Nasionalisme`, `Integritas`, `Bela Negara`, `Pilar Negara - Pancasila`, `Pilar Negara - UUD NRI 1945`, `Pilar Negara - NKRI`, `Pilar Negara - Bhinneka Tunggal Ika`, `Bahasa Indonesia`
* **TIU:** `Verbal - Analogi`, `Verbal - Silogisme`, `Verbal - Analitis`, `Numerik - Deret`, `Numerik - Perbandingan Kuantitatif`, `Numerik - Aritmetika Sosial`, `Numerik - Soal Cerita`, `Figural - Spasial Verbal`
* **TKP:** `Pelayanan Publik`, `Jejaring Kerja`, `Sosial Budaya`, `TIK`, `Anti-Radikalisme`, `Profesionalisme`

### Validation Rules (items breaking these are rejected by the importer)
1. **Option Format:** Exactly 5 options with labels `A`–`E` in order, with non-empty text.
2. **TWK/TIU Scoring:** Exactly one score `5`, four scores `0`.
3. **TKP Scoring:** Scores are a strict permutation of `1`–`5`.
4. **Key Order:** `reasoningChain` key appears before `options` in each question object.
5. **Stem & Title Hygiene:** `questionStem` must not contain the option list, and `title` must not reveal the answer.
6. **Total Count Match:** `totalQuestions` equals `questions.length`.
7. **Canonical Subtopic:** `subtopic` must match the canonical list for its category.
8. **Option Length Balance:** Option texts within each question should maintain balanced length so the `5`-point answer cannot be guessed by picking the longest option.

> **Note:** A batch where one letter holds more than 30% of the 5-point answers triggers a distribution warning during import.

### Example JSON Payload (TKP - Pelayanan Publik)
```json
{
  "batchMetadata": {
    "batchId": "2026-11-b01",
    "category": "TKP",
    "totalQuestions": 1,
    "difficulty": "HOTS"
  },
  "questions": [
    {
      "category": "TKP",
      "subtopic": "Pelayanan Publik",
      "title": "Penanganan Antrean Layanan Publik Saat Gangguan Server Teknis",
      "questionStem": "Anda bertugas sebagai penanggung jawab loket pelayanan terpadu di kantor instansi daerah. Pada pukul 10.00 WIB, jaringan server pusat mengalami gangguan tak terduga yang menyebabkan seluruh proses verifikasi berkas daring terhenti. Antrean warga mulai menumpuk di ruang tunggu dan beberapa pemohon mengajukan keluhan keras karena memiliki batas waktu perizinan hari ini. Tindakan prioritas paling tepat yang Anda ambil adalah...",
      "reasoningChain": "Indikator utama pilar Pelayanan Publik PermenPAN-RB adalah daya tanggap (responsiveness), ketenangan menghadapi komplain publik, transparansi informasi, serta inisiatif menyediakan solusi darurat tanpa melanggar prosedur. Opsi terbaik bernilai 5 adalah menyampaikan permohonan maaf terbuka secara empatik, membagikan nomor antrean manual darurat, dan menghimpun berkas fisik pemohon untuk pra-verifikasi agar proses langsung berlanjut begitu sistem pulih. Opsi yang menawarkan solusi proaktif dan kepastian mendapat nilai 5, mendahulukan berkas mendesak mendapat 4, sekadar meminta bersabar mendapat 3, menutup loket mendapat 2, dan menyuruh pulang mendapat 1.",
      "options": [
        {
          "label": "A",
          "text": "Menjelaskan kendala teknis jaringan secara sopan kepada seluruh pemohon dan meminta mereka bersabar menunggu hingga perbaikan server selesai.",
          "score": 3
        },
        {
          "label": "B",
          "text": "Menyampaikan permohonan maaf atas kendala sistem secara transparan, menerbitkan nomor antrean manual darurat, serta menghimpun berkas fisik pemohon untuk pra-verifikasi agar langsung diproses saat sistem pulih.",
          "score": 5
        },
        {
          "label": "C",
          "text": "Menutup sementara loket pendaftaran untuk meredam kegaduhan dan berkoordinasi dengan tim IT pusat guna memastikan perkiraan durasi perbaikan.",
          "score": 2
        },
        {
          "label": "D",
          "text": "Mendahulukan pemohon yang memiliki batas waktu dokumen paling mendesak untuk diperiksa kelengkapan berkasnya secara manual terlebih dahulu.",
          "score": 4
        },
        {
          "label": "E",
          "text": "Menyarankan pemohon yang dokumennya belum terlalu mendesak untuk kembali esok hari agar ruangan loket tidak semakin padat.",
          "score": 1
        }
      ],
      "rubricRationale": "Pilihan B (skor 5) merefleksikan pelayanan prima dengan inisiatif cepat, transparan, dan mitigasi manual yang menjaga kepastian layanan bagi semua pemohon. Pilihan D (skor 4) menunjukkan empati dan skala prioritas, namun belum mengakomodasi seluruh antrean yang hadir. Pilihan A (skor 3) sopan tetapi pasif tanpa langkah mitigasi nyata. Pilihan C (skor 2) menutup akses pelayanan publik dan menciptakan ketidakpastian. Pilihan E (skor 1) bersikap lepas tangan dan membebankan masalah instansi kepada warga."
    }
  ]
}
```

---

## 5. Batch Execution Parameters (Fill Before Running)

* Batch ID: [e.g., 2026-11-b01]
* Target Batch Size: [e.g., 10 questions]
* Category & Subtopic Distribution:
    > [e.g., 3 TWK (1 Bela Negara, 1 Pilar Negara UUD 1945, 1 Bahasa Indonesia)]
    > [e.g., 4 TIU (1 Silogisme 3 Premis, 1 Analitik Posisi, 1 Perbandingan Kuantitatif, 1 Aritmetika Kecepatan/Kerja)]
    > [e.g., 3 TKP (1 Pelayanan Publik, 1 Anti-Radikalisme, 1 Profesionalisme)]
* Output Format: Return ONLY a valid, raw JSON object matching Section 4. Do not wrap with conversational filler before or after the JSON block.
