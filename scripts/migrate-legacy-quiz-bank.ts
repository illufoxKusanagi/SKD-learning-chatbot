import fs from "node:fs";
import path from "node:path";
import {
  CANONICAL_SUBTOPICS,
  OPTION_KEYS,
  QuizQuestionSeed,
  QuizQuestionSeedSchema,
  StudyMaterialSeed,
  StudyMaterialSeedSchema,
  type OptionKey,
} from "../src/lib/validation/content-contract";

interface LegacyOption {
  label: OptionKey;
  text: string;
  score: number;
}

interface LegacyQuestion {
  category: "TWK" | "TIU" | "TKP";
  subtopic: string;
  title?: string;
  questionStem: string;
  reasoningChain: string;
  options: LegacyOption[];
  rubricRationale?: string;
}

interface LegacyBatchFile {
  batchMetadata?: {
    batchId?: string;
    category?: string;
    totalQuestions?: number;
    difficulty?: string;
  };
  questions?: LegacyQuestion[];
}

const TWK_CORE_SLUG_BY_SUBTOPIC: Record<string, string> = {
  Nasionalisme: "twk-nasionalisme-identitas-kedaulatan",
  Integritas: "twk-integritas-antikorupsi-asn",
  "Bela Negara": "twk-bela-negara-uu23-pengabdian-profesi",
  "Pilar Negara - Pancasila": "twk-pancasila-pengamalan-kontekstual",
  "Pilar Negara - UUD NRI 1945": "twk-uud45-konstitusi-lembaga-negara",
  "Pilar Negara - NKRI": "twk-nkri-otonomi-desentralisasi",
  "Pilar Negara - Bhinneka Tunggal Ika": "twk-bhinneka-integrasi-kebinekaan",
  "Bahasa Indonesia": "twk-bahasa-kalimat-efektif-eyd",
  "Sejarah Kebangsaan": "twk-sejarah-proklamasi-pergerakan",
};

const SPOILER_FREE_HINTS: Record<string, string> = {
  "TWK::Nasionalisme":
    "Identifikasi tindakan yang menjaga kepentingan dan kedaulatan bangsa secara terbuka tanpa terjebak sikap chauvinisme.",
  "TWK::Integritas":
    "Fokus pada kejujuran prosedural, penolakan benturan kepentingan, dan pelaporan resmi sesuai mekanisme pengawasan.",
  "TWK::Bela Negara":
    "Pertimbangkan bagaimana kompetensi profesi sipil digunakan secara terkoordinasi untuk menangkal ancaman nonmiliter.",
  "TWK::Pilar Negara - Pancasila":
    "Tentukan sila Pancasila yang paling presisi menjawab inti dilema antara martabat kemanusiaan, musyawarah, dan keadilan.",
  "TWK::Pilar Negara - UUD NRI 1945":
    "Hubungkan hak konstitusional warga negara dan pembagian kewenangan antarlembaga dalam pasal-pasal UUD NRI 1945.",
  "TWK::Pilar Negara - NKRI":
    "Cermati pembagian kewenangan pemerintah pusat dan daerah berdasarkan prinsip negara kesatuan dan otonomi daerah.",
  "TWK::Pilar Negara - Bhinneka Tunggal Ika":
    "Cari pendekatan inklusif yang menghargai keberagaman sosial budaya sekaligus menjaga keutuhan hukum nasional.",
  "TWK::Bahasa Indonesia":
    "Periksa kejelasan struktur Subjek-Predikat, kehematan kata, serta kebakuan ejaan menurut KBBI dan EYD Edisi V.",
  "TWK::Sejarah Kebangsaan":
    "Tarik makna strategis peristiwa sejarah pergerakan nasional terhadap konsolidasi identitas dan keutuhan bangsa.",
  "TIU::Verbal - Analogi":
    "Rumuskan relasi fungsional atau sebab-akibat yang presisi di antara pasangan kata pada premis terlebih dahulu.",
  "TIU::Verbal - Silogisme":
    "Petakan hubungan antarkelas himpunan menggunakan kontraposisi dan hindari penarikan simpulan di luar cakupan kuantor.",
  "TIU::Verbal - Analitis":
    "Ubah setiap syarat menjadi batasan urutan atau posisi tetap, lalu eliminasi susunan yang melanggar salah satu syarat.",
  "TIU::Numerik - Deret":
    "Periksa selisih atau rasio antarsuku secara bertingkat, termasuk kemungkinan adanya dua larik yang berselang-seling.",
  "TIU::Numerik - Perbandingan Kuantitatif":
    "Sederhanakan kedua kuantitas ke bentuk aljabar atau nilai eksak sebelum membandingkan hubungannya.",
  "TIU::Numerik - Aritmetika Sosial":
    "Hitung basis biaya bersih dan penyusutan unit secara berurutan sebelum menentukan persentase laba atau nilai akhir.",
  "TIU::Numerik - Soal Cerita":
    "Modelkan laju kerja atau komposisi beban per satuan waktu sebagai persamaan linear yang konsisten.",
  "TKP::Pelayanan Publik":
    "Prioritaskan solusi yang ramah, solutif, prosedural, dan tetap menjaga kepuasan serta hak pengguna layanan.",
  "TKP::Jejaring Kerja":
    "Pilih langkah kolaboratif yang menyelaraskan komunikasi lintas unit tanpa mengabaikan tanggung jawab bersama.",
  "TKP::Sosial Budaya":
    "Utamakan sikap inklusif, empatik, dan menghormati keberagaman latar budaya dalam batas aturan kerja yang adil.",
  "TKP::TIK":
    "Lindungi keamanan kredensial, integritas data, dan etika pemanfaatan sistem informasi instansi secara akuntabel.",
  "TKP::Anti-Radikalisme":
    "Kedepankan respons yang tegas terhadap intoleransi, dialogis, dan berlandaskan mekanisme pembinaan resmi.",
  "TKP::Profesionalisme":
    "Jaga akurasi, standar mutu, dan ketuntasan kerja secara mandiri meskipun menghadapi tekanan tenggat waktu.",
};

function slugify(input: string, maxLen = 85): string {
  const normalized = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized.length <= maxLen) return normalized;
  const cut = normalized.slice(0, maxLen).replace(/-+$/g, "");
  return cut;
}

function normalizeStem(stem: string): string {
  return stem.trim().toLowerCase().replace(/\s+/g, " ");
}

function splitSentences(text: string): string[] {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return [];
  // Split at sentence boundary followed by uppercase letter, preserving abbreviations like No. / ayat
  const parts = cleaned.split(/(?<!\bNo)(?<!\bayat)(?<!\bUU)(?<!\bDr)(?<!\bPasal)\.\s+(?=[A-Z])/);
  return parts
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.endsWith(".") ? s : `${s}.`));
}

function extractOptionKeysFromSentence(sentence: string): OptionKey[] {
  const matched = new Set<OptionKey>();

  // Match patterns like "Pilihan A", "Opsi B", "Pilihan A, B, C, dan D", "Pilihan D dan E"
  const groupRegex = /(?:Pilihan|Opsi)\s+([A-E](?:(?:\s*,\s*(?:dan|atau)\s*|\s*,\s*|\s+(?:dan|atau)\s+)[A-E])*)/gi;
  for (const m of sentence.matchAll(groupRegex)) {
    const groupText = m[1];
    for (const letterMatch of groupText.matchAll(/[A-E]/g)) {
      matched.add(letterMatch[0] as OptionKey);
    }
  }

  // Fallback for patterns like "Yusuf (B)" or "Rizal (C), Hendra (D), dan Laras (E)"
  if (matched.size === 0) {
    for (const m of sentence.matchAll(/\(([A-E])\)/g)) {
      matched.add(m[1] as OptionKey);
    }
  }

  return Array.from(matched);
}

function summarizeReasoning(reasoningChain: string): string {
  const sentences = splitSentences(reasoningChain);
  if (sentences.length === 0) {
    return "Evaluasi berdasarkan prinsip dan penalaran pada pembahasan soal.";
  }
  return sentences.slice(0, 2).join(" ");
}

function parseOptionRationales(
  rubricRationale: string | undefined,
  reasoningChain: string,
  options: LegacyOption[],
  category: "TWK" | "TIU" | "TKP"
): Record<OptionKey, string> {
  const buckets: Record<OptionKey, string[]> = { A: [], B: [], C: [], D: [], E: [] };
  const sentences = splitSentences(rubricRationale ?? "");

  for (const sentence of sentences) {
    const keys = extractOptionKeysFromSentence(sentence);
    for (const key of keys) {
      buckets[key].push(sentence);
    }
  }

  const reasoningSummary = summarizeReasoning(reasoningChain);
  const optByKey = new Map(options.map((o) => [o.label, o]));

  const result = {} as Record<OptionKey, string>;
  for (const key of OPTION_KEYS) {
    if (buckets[key].length > 0) {
      result[key] = buckets[key].join(" ");
      continue;
    }

    const opt = optByKey.get(key);
    if (category === "TKP") {
      const score = opt?.score ?? 1;
      result[key] = `Skor ${score}/5. ${reasoningSummary}`;
    } else if (opt?.score === 5) {
      result[key] = `Benar (skor 5). ${reasoningSummary}`;
    } else {
      result[key] = `Salah (skor 0). Tidak sesuai dengan deduksi utama: ${reasoningSummary}`;
    }
  }

  return result;
}

function orderQuestionKeys(q: QuizQuestionSeed): QuizQuestionSeed {
  // Explicitly preserve reasoningChain before stem and options
  if (q.category === "TWK") {
    return {
      slug: q.slug,
      category: q.category,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      materialSlugs: q.materialSlugs,
      reasoningChain: q.reasoningChain,
      stem: q.stem,
      options: q.options,
      hint: q.hint,
      correctOption: q.correctOption,
      scoringRubric: null,
      optionRationales: q.optionRationales,
      ...(q.source ? { source: q.source } : {}),
    };
  }
  if (q.category === "TIU") {
    return {
      slug: q.slug,
      category: q.category,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      materialSlugs: [],
      reasoningChain: q.reasoningChain,
      stem: q.stem,
      options: q.options,
      hint: q.hint,
      correctOption: q.correctOption,
      scoringRubric: null,
      optionRationales: q.optionRationales,
      ...(q.source ? { source: q.source } : {}),
    };
  }
  return {
    slug: q.slug,
    category: q.category,
    subtopic: q.subtopic,
    difficulty: q.difficulty,
    materialSlugs: [],
    reasoningChain: q.reasoningChain,
    stem: q.stem,
    options: q.options,
    hint: q.hint,
    correctOption: null,
    scoringRubric: q.scoringRubric,
    optionRationales: q.optionRationales,
    ...(q.source ? { source: q.source } : {}),
  };
}

function promoteStagedMaterials(materialsDir: string, stagedBankDir: string): StudyMaterialSeed[] {
  const corePath = path.join(materialsDir, "twk-core.json");
  const coreRaw = JSON.parse(fs.readFileSync(corePath, "utf-8")) as unknown[];
  const coreMaterials = coreRaw.map((item) => StudyMaterialSeedSchema.parse(item));
  const seenSlugs = new Set(coreMaterials.map((m) => m.slug));

  const promoted: StudyMaterialSeed[] = [];
  const stagedDirs = [stagedBankDir, path.join(stagedBankDir, "raw")];

  for (const dir of stagedDirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }

    const files = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith(".json"))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));

    for (const fileName of files) {
      const fullPath = path.join(dir, fileName);
      const items = JSON.parse(fs.readFileSync(fullPath, "utf-8")) as unknown[];
      if (!Array.isArray(items)) continue;
      for (const raw of items) {
        const parsed = StudyMaterialSeedSchema.safeParse(raw);
        if (!parsed.success) {
          console.warn(
            `[migrate] Skipping invalid staged material in ${fileName}: ${parsed.error.issues.map((i) => i.message).join("; ")}`
          );
          continue;
        }
        if (seenSlugs.has(parsed.data.slug)) {
          continue;
        }
        seenSlugs.add(parsed.data.slug);
        promoted.push(parsed.data);
      }
    }
  }

  const stagedOutPath = path.join(materialsDir, "twk-staged.json");
  fs.writeFileSync(stagedOutPath, `${JSON.stringify(promoted, null, 2)}\n`, "utf-8");
  console.log(`[migrate] Core TWK materials: ${coreMaterials.length} | Promoted staged materials: ${promoted.length}`);
  return [...coreMaterials, ...promoted];
}

function moveLegacyBatchesToLegacyDir(quizBankDir: string, legacyDir: string): string[] {
  fs.mkdirSync(legacyDir, { recursive: true });

  const topLevelLegacyFiles = fs
    .readdirSync(quizBankDir, { withFileTypes: true })
    .filter((d) => d.isFile() && /^2026-11-b\d+\.json$/.test(d.name))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));

  for (const fileName of topLevelLegacyFiles) {
    const src = path.join(quizBankDir, fileName);
    const dest = path.join(legacyDir, fileName);
    if (!fs.existsSync(dest)) {
      fs.renameSync(src, dest);
      console.log(`[migrate] Moved ${fileName} -> data/quiz-bank/legacy/${fileName}`);
    } else {
      console.log(`[migrate] Legacy file already exists in legacy/: ${fileName}`);
    }
  }

  return fs
    .readdirSync(legacyDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".json"))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
}

function main(): void {
  const rootDir = process.cwd();
  const materialsDir = path.join(rootDir, "data/materials");
  const stagedMatBankDir = path.join(rootDir, "data/study-material-bank");
  const quizBankDir = path.join(rootDir, "data/quiz-bank");
  const legacyDir = path.join(quizBankDir, "legacy");
  const rawQuizDir = path.join(quizBankDir, "raw");

  const allMaterials = promoteStagedMaterials(materialsDir, stagedMatBankDir);
  const validMaterialSlugs = new Set(allMaterials.map((m) => m.slug));

  // Verify TWK core slug map integrity against twk-core.json
  for (const [subtopic, slug] of Object.entries(TWK_CORE_SLUG_BY_SUBTOPIC)) {
    if (!validMaterialSlugs.has(slug)) {
      throw new Error(`Missing core TWK material slug "${slug}" for subtopic "${subtopic}"`);
    }
  }

  const legacyFiles = moveLegacyBatchesToLegacyDir(quizBankDir, legacyDir);

  const seenSlugs = new Set<string>();
  const seenStems = new Set<string>();
  const allQuestions: QuizQuestionSeed[] = [];

  // 1. Load & normalize raw staged questions first (retain handcrafted hints, rationales & micro-concept materialSlugs)
  let rawAccepted = 0;
  let rawSkipped = 0;
  if (fs.existsSync(rawQuizDir)) {
    const rawFiles = fs
      .readdirSync(rawQuizDir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith(".json"))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));

    for (const fileName of rawFiles) {
      const items = JSON.parse(fs.readFileSync(path.join(rawQuizDir, fileName), "utf-8")) as unknown[];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const parsed = QuizQuestionSeedSchema.safeParse(item);
        if (!parsed.success) {
          rawSkipped++;
          console.warn(
            `[migrate] Skipping invalid raw question in ${fileName}: ${parsed.error.issues.map((i) => i.message).join("; ")}`
          );
          continue;
        }
        const qWithSource: QuizQuestionSeed = parsed.data.source
          ? parsed.data
          : {
              ...parsed.data,
              source: {
                type: "manual",
                title: "Adaptasi Kisi-Kisi SKD CPNS BKN",
              },
            };
        const q = orderQuestionKeys(qWithSource);
        if (q.category === "TWK") {
          const unknownMats = q.materialSlugs.filter((s) => !validMaterialSlugs.has(s));
          if (unknownMats.length > 0) {
            rawSkipped++;
            console.warn(
              `[migrate] Skipping raw question ${q.slug} in ${fileName}: unknown materialSlugs [${unknownMats.join(", ")}]`
            );
            continue;
          }
        }
        const normStem = normalizeStem(q.stem);
        if (seenSlugs.has(q.slug) || seenStems.has(normStem)) {
          rawSkipped++;
          continue;
        }
        seenSlugs.add(q.slug);
        seenStems.add(normStem);
        allQuestions.push(q);
        rawAccepted++;
      }
    }
  }

  // 2. Deterministically migrate legacy batches
  let legacyMigrated = 0;
  let excludedFiguralCount = 0;
  let legacyDuplicates = 0;

  for (const fileName of legacyFiles) {
    const batch = JSON.parse(
      fs.readFileSync(path.join(legacyDir, fileName), "utf-8")
    ) as LegacyBatchFile;
    const batchId = batch.batchMetadata?.batchId ?? fileName.replace(/\.json$/, "");
    const shortBatch = batchId.replace(/^2026-11-/, "");
    const questions = batch.questions ?? [];

    for (let idx = 0; idx < questions.length; idx++) {
      const legacy = questions[idx];
      if (
        legacy.subtopic === "Figural - Spasial Verbal" ||
        legacy.subtopic.toLowerCase().includes("figural")
      ) {
        excludedFiguralCount++;
        continue;
      }

      const allowedSubtopics: readonly string[] = CANONICAL_SUBTOPICS[legacy.category];
      if (!allowedSubtopics.includes(legacy.subtopic)) {
        throw new Error(`Non-canonical legacy subtopic "${legacy.subtopic}" in ${fileName}#${idx + 1}`);
      }

      const optionMap = {} as Record<OptionKey, string>;
      const scoreMap = {} as Record<OptionKey, number>;
      for (const opt of legacy.options) {
        optionMap[opt.label] = opt.text.trim();
        scoreMap[opt.label] = opt.score;
      }

      const catLower = legacy.category.toLowerCase();
      const titlePart = slugify(legacy.title ?? legacy.subtopic, 80);
      const numPart = String(idx + 1).padStart(2, "0");
      const slug = `${catLower}-legacy-${shortBatch}-${numPart}-${titlePart}`.slice(0, 160).replace(/-+$/g, "");

      const hintKey = `${legacy.category}::${legacy.subtopic}`;
      const hint =
        SPOILER_FREE_HINTS[hintKey] ??
        `Analisis konteks ${legacy.subtopic} secara sistematis berdasarkan konsep utama pada materi.`;

      const optionRationales = parseOptionRationales(
        legacy.rubricRationale,
        legacy.reasoningChain,
        legacy.options,
        legacy.category
      );

      const materialSlugs =
        legacy.category === "TWK" ? [TWK_CORE_SLUG_BY_SUBTOPIC[legacy.subtopic]] : [];

      let candidate: unknown;
      if (legacy.category === "TKP") {
        candidate = {
          slug,
          category: "TKP",
          subtopic: legacy.subtopic,
          difficulty: "hots",
          materialSlugs: [],
          reasoningChain: legacy.reasoningChain.trim(),
          stem: legacy.questionStem.trim(),
          options: optionMap,
          hint,
          correctOption: null,
          scoringRubric: scoreMap,
          optionRationales,
          source: {
            type: "tryout",
            title: `Legacy SKD HOTS Batch ${batchId}`,
          },
        };
      } else {
        const winner = legacy.options.find((o) => o.score === 5);
        if (!winner) {
          throw new Error(`Legacy ${legacy.category} question ${fileName}#${idx + 1} missing score=5 option`);
        }
        candidate = {
          slug,
          category: legacy.category,
          subtopic: legacy.subtopic,
          difficulty: "hots",
          materialSlugs,
          reasoningChain: legacy.reasoningChain.trim(),
          stem: legacy.questionStem.trim(),
          options: optionMap,
          hint,
          correctOption: winner.label,
          scoringRubric: null,
          optionRationales,
          source: {
            type: "tryout",
            title: `Legacy SKD HOTS Batch ${batchId}`,
          },
        };
      }

      const parsed = QuizQuestionSeedSchema.parse(candidate);
      const ordered = orderQuestionKeys(parsed);
      const normStem = normalizeStem(ordered.stem);

      if (seenSlugs.has(ordered.slug) || seenStems.has(normStem)) {
        legacyDuplicates++;
        continue;
      }

      seenSlugs.add(ordered.slug);
      seenStems.add(normStem);
      allQuestions.push(ordered);
      legacyMigrated++;
    }
  }

  const twkBank = allQuestions.filter((q) => q.category === "TWK");
  const tiuBank = allQuestions.filter((q) => q.category === "TIU");
  const tkpBank = allQuestions.filter((q) => q.category === "TKP");

  fs.writeFileSync(path.join(quizBankDir, "twk-bank.json"), `${JSON.stringify(twkBank, null, 2)}\n`, "utf-8");
  fs.writeFileSync(path.join(quizBankDir, "tiu-bank.json"), `${JSON.stringify(tiuBank, null, 2)}\n`, "utf-8");
  fs.writeFileSync(path.join(quizBankDir, "tkp-bank.json"), `${JSON.stringify(tkpBank, null, 2)}\n`, "utf-8");

  console.log(
    `[migrate] Raw promoted: ${rawAccepted} (skipped: ${rawSkipped}) | Legacy migrated: ${legacyMigrated} | Excluded Figural: ${excludedFiguralCount} | Duplicates skipped: ${legacyDuplicates}`
  );
  console.log(
    `[migrate] Written banks -> TWK: ${twkBank.length}, TIU: ${tiuBank.length}, TKP: ${tkpBank.length} (Total: ${allQuestions.length})`
  );
}

main();
