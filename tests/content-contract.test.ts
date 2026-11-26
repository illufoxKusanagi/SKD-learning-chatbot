import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CANONICAL_SUBTOPICS,
  QuizQuestionSeedSchema,
  REQUIRED_MATERIAL_HEADINGS,
  SourceMetaSchema,
  StudyMaterialSeedSchema,
  checkTkpOptionLengthWarning,
  computeContentHash,
  validateContentBundles,
  validateContentDirectories,
  verifyReasoningBeforeOptions,
  type QuizQuestionSeed,
  type StudyMaterialSeed,
} from "@/lib/validation/content-contract";

function makeValidMaterial(overrides: Partial<StudyMaterialSeed> = {}): StudyMaterialSeed {
  return {
    slug: "nasionalisme-budi-utomo",
    title: "Nasionalisme dan Kebangkitan Nasional 1908",
    category: "TWK",
    subtopic: "Nasionalisme",
    summary:
      "Ringkasan komprehensif mengenai akar pergerakan nasional modern sejak berdirinya Budi Utomo tahun 1908.",
    contentMarkdown: [
      "## Inti Konsep",
      "Nasionalisme Indonesia lahir dari kesadaran kolektif lintas etnis dan daerah untuk melawan kolonialisme melalui organisasi modern.",
      "",
      "## Logika Sebab-Akibat",
      "Politik Etis memperluas akses pendidikan pribumi sehingga melahirkan golongan terpelajar yang mengubah bentuk perjuangan dari kedaerahan menjadi nasional.",
      "",
      "## Jembatan Soal HOTS",
      "Soal HOTS sering menguji perbedaan strategi perjuangan sebelum dan sesudah 1908 dalam konteks persatuan bangsa.",
      "",
      "## Jebakan Klasik",
      "Peserta kerap tertukar antara Sumpah Pemuda 1928 dan Kebangkitan Nasional 1908 sebagai titik awal organisasi modern.",
    ].join("\n"),
    source: {
      type: "manual",
      title: "Modul Ringkas TWK CPNS",
      url: "https://example.com/materi/nasionalisme",
    },
    ...overrides,
  };
}

function makeValidTwkQuestion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "twk-kebangkitan-nasional-01",
    category: "TWK",
    subtopic: "Nasionalisme",
    difficulty: "hots",
    materialSlugs: ["nasionalisme-budi-utomo"],
    reasoningChain:
      "Analisis perubahan strategi perjuangan pra-1908 yang bersifat kedaerahan menjadi pasca-1908 yang terorganisasi secara modern oleh kaum terpelajar.",
    stem: "Mengapa berdirinya Budi Utomo pada tahun 1908 dianggap sebagai tonggak Kebangkitan Nasional dalam sejarah perjuangan bangsa Indonesia?",
    options: {
      A: "Menandai dimulainya perlawanan bersenjata serentak di seluruh Nusantara",
      B: "Mengubah corak perjuangan menjadi terorganisasi secara modern dan bersifat nasional",
      C: "Menghapuskan seluruh bentuk kerja paksa yang diterapkan pemerintah kolonial",
      D: "Memproklamasikan kemerdekaan Indonesia di hadapan pemerintah Hindia Belanda",
      E: "Mengakui Bahasa Indonesia sebagai satu-satunya bahasa resmi pemerintahan",
    },
    correctOption: "B",
    scoringRubric: null,
    hint: "Fokus pada perubahan bentuk perjuangan dari kedaerahan ke organisasi modern.",
    optionRationales: {
      A: "Salah karena perjuangan pra-1908 justru didominasi perlawanan fisik bersenjata.",
      B: "Benar karena Budi Utomo memelopori pergerakan modern terorganisasi secara nasional.",
      C: "Salah karena politik kolonial tidak langsung hapus pada tahun 1908.",
      D: "Salah karena proklamasi kemerdekaan terjadi pada 17 Agustus 1945.",
      E: "Salah karena pengakuan bahasa persatuan dirumuskan dalam Sumpah Pemuda 1928.",
    },
    source: {
      type: "tryout",
      title: "Bank Soal HOTS TWK",
      url: "https://example.com/soal/twk-01",
    },
    ...overrides,
  };
}

function makeValidTiuQuestion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "tiu-silogisme-01",
    category: "TIU",
    subtopic: "Verbal - Silogisme",
    difficulty: "hots",
    materialSlugs: [],
    reasoningChain:
      "Gunakan modus ponens dan silogisme kategoris: semua ASN berintegritas menaati kode etik, sebagian pegawai baru adalah ASN berintegritas.",
    stem: "Semua ASN yang berintegritas menaati kode etik instansi. Sebagian peserta pelatihan hari ini adalah ASN yang berintegritas. Simpulan yang paling tepat adalah...",
    options: {
      A: "Semua peserta pelatihan hari ini menaati kode etik instansi",
      B: "Sebagian peserta pelatihan hari ini menaati kode etik instansi",
      C: "Tidak ada peserta pelatihan hari ini yang menaati kode etik instansi",
      D: "Semua yang menaati kode etik instansi adalah peserta pelatihan hari ini",
      E: "Sebagian ASN yang berintegritas bukan peserta pelatihan dan melanggar kode etik",
    },
    correctOption: "B",
    scoringRubric: null,
    hint: "Perhatikan kuantor 'semua' pada premis mayor dan 'sebagian' pada premis minor.",
    optionRationales: {
      A: "Salah karena premis minor hanya mencakup sebagian peserta pelatihan.",
      B: "Benar karena irisan sebagian peserta yang merupakan ASN berintegritas pasti menaati kode etik.",
      C: "Salah karena bertentangan langsung dengan premis yang diberikan.",
      D: "Salah karena membalik ekuivalensi implikasi secara tidak sah.",
      E: "Salah karena bertentangan dengan premis pertama bahwa semua ASN berintegritas taat kode etik.",
    },
    ...overrides,
  };
}

function makeValidTkpQuestion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "tkp-pelayanan-publik-01",
    category: "TKP",
    subtopic: "Pelayanan Publik",
    difficulty: "hots",
    materialSlugs: [],
    reasoningChain:
      "Evaluasi respons terbaik berdasarkan asas pelayanan publik: responsif, solutif, akuntabel, serta tetap mematuhi prosedur resmi tanpa diskriminasi.",
    stem: "Saat loket pelayanan hampir tutup, seorang warga lansia datang dari desa terpencil membawa berkas yang kurang lengkap untuk mengurus dokumen penting. Sikap Anda yang paling tepat adalah...",
    options: {
      A: "Menjelaskan kekurangan berkas dengan ramah serta memandu solusi pengurusan tercepat sesuai prosedur",
      B: "Menerima berkas seadanya lalu memprosesnya diam-diam meski melanggar ketentuan administrasi",
      C: "Meminta warga tersebut kembali lagi minggu depan tanpa menjelaskan kekurangan berkasnya",
      D: "Menolak melayani karena jam operasional loket sudah hampir berakhir lima menit lagi",
      E: "Menyuruh warga tersebut bertanya sendiri kepada petugas keamanan di depan gedung",
    },
    correctOption: null,
    scoringRubric: { A: 5, B: 2, C: 3, D: 4, E: 1 },
    hint: "Cari sikap yang paling ramah, prosedural, dan membantu memberi solusi jelas.",
    optionRationales: {
      A: "Nilai 5: Menunjukkan empati, profesionalisme, dan solusi jelas sesuai aturan.",
      B: "Nilai 2: Membantu tetapi melanggar prosedur resmi administrasi.",
      C: "Nilai 3: Tidak komunikatif dan kurang memberikan pelayanan informatif.",
      D: "Nilai 4: Berpegang pada jam operasional namun masih kurang solutif (placeholder skor).",
      E: "Nilai 1: Melempar tanggung jawab pelayanan kepada pihak yang tidak berwenang.",
    },
    ...overrides,
  };
}

describe("content-contract", () => {
  it("exposes expected canonical subtopics (9 TWK, 7 TIU without Figural, 6 TKP) and required headings", () => {
    expect(CANONICAL_SUBTOPICS.TWK).toHaveLength(9);
    expect(CANONICAL_SUBTOPICS.TIU).toHaveLength(7);
    expect(CANONICAL_SUBTOPICS.TKP).toHaveLength(6);
    expect(CANONICAL_SUBTOPICS.TIU.some((s) => s.toLowerCase().includes("figural"))).toBe(false);
    expect(REQUIRED_MATERIAL_HEADINGS).toEqual([
      "## Inti Konsep",
      "## Logika Sebab-Akibat",
      "## Jembatan Soal HOTS",
      "## Jebakan Klasik",
    ]);
  });

  it("1. rejects TWK study material missing mandatory HOTS heading (## Logika Sebab-Akibat)", () => {
    const mat = makeValidMaterial({
      contentMarkdown: [
        "## Inti Konsep",
        "Nasionalisme Indonesia berakar dari kesadaran kolektif bangsa melawan penjajahan secara terorganisasi.",
        "## Jembatan Soal HOTS",
        "Soal sering membandingkan perjuangan sebelum dan sesudah tahun 1908.",
        "## Jebakan Klasik",
        "Jangan tertukar antara 1908 dan 1928 dalam konteks pergerakan nasional.",
      ].join("\n"),
    });

    const parsed = StudyMaterialSeedSchema.safeParse(mat);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message).join(" | ");
      expect(messages).toContain("## Logika Sebab-Akibat");
    }
  });

  it("2. rejects non-TWK study material (category: TKP)", () => {
    const mat = {
      ...makeValidMaterial(),
      category: "TKP",
    };

    const parsed = StudyMaterialSeedSchema.safeParse(mat);
    expect(parsed.success).toBe(false);
  });

  it("3. rejects TKP question with duplicate scoringRubric values ({ A: 5, B: 5, C: 3, D: 2, E: 1 })", () => {
    const tkp = makeValidTkpQuestion({
      scoringRubric: { A: 5, B: 5, C: 3, D: 2, E: 1 },
    });

    const parsed = QuizQuestionSeedSchema.safeParse(tkp);
    expect(parsed.success).toBe(false);
  });

  it("4. rejects missing optionRationales.E, short hint (< 10 chars), and options appearing before reasoningChain", () => {
    const validTwk = makeValidTwkQuestion();
    const { E: _omitted, ...incompleteRationales } = validTwk.optionRationales as Record<string, string>;

    const missingRationale = QuizQuestionSeedSchema.safeParse({
      ...validTwk,
      optionRationales: incompleteRationales,
    });
    expect(missingRationale.success).toBe(false);

    const shortHint = QuizQuestionSeedSchema.safeParse({
      ...validTwk,
      hint: "Terlalu",
    });
    expect(shortHint.success).toBe(false);

    const reorderedObj: Record<string, unknown> = {
      slug: validTwk.slug,
      category: validTwk.category,
      subtopic: validTwk.subtopic,
      difficulty: validTwk.difficulty,
      materialSlugs: validTwk.materialSlugs,
      options: validTwk.options,
      reasoningChain: validTwk.reasoningChain,
      stem: validTwk.stem,
      correctOption: validTwk.correctOption,
      scoringRubric: validTwk.scoringRubric,
      hint: validTwk.hint,
      optionRationales: validTwk.optionRationales,
    };
    expect(verifyReasoningBeforeOptions(reorderedObj)).toBe(false);

    const bundleReport = validateContentBundles({
      materialFiles: [{ fileName: "twk.json", items: [makeValidMaterial()] }],
      questionFiles: [{ fileName: "q.json", items: [reorderedObj] }],
    });
    expect(bundleReport.valid).toBe(false);
    expect(bundleReport.errors.some((e) => e.toLowerCase().includes("reasoningchain"))).toBe(true);
  });

  it("5. rejects TIU Figural subtopic ('Figural - Spasial Verbal') per No-Figural rule", () => {
    const figural = makeValidTiuQuestion({
      subtopic: "Figural - Spasial Verbal",
    });

    const parsed = QuizQuestionSeedSchema.safeParse(figural);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message).join(" | ");
      expect(messages.toLowerCase()).toContain("figural");
    }
  });

  it("6. rejects TWK question referencing unknown materialSlugs across bundles", () => {
    const twkMissingMat = makeValidTwkQuestion({
      materialSlugs: ["materi-yang-tidak-ada"],
    });

    const report = validateContentBundles({
      materialFiles: [{ fileName: "materials.json", items: [makeValidMaterial()] }],
      questionFiles: [{ fileName: "questions.json", items: [twkMissingMat] }],
    });

    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes("materi-yang-tidak-ada"))).toBe(true);

    const reportWithDbSlug = validateContentBundles({
      materialFiles: [{ fileName: "materials.json", items: [makeValidMaterial()] }],
      questionFiles: [{ fileName: "questions.json", items: [twkMissingMat] }],
      existingDbMaterialSlugs: ["materi-yang-tidak-ada"],
    });
    expect(reportWithDbSlug.valid).toBe(true);
  });

  it("7. rejects duplicate slug across two files (materials and questions)", () => {
    const matA = makeValidMaterial({ slug: "dup-material-slug" });
    const matB = makeValidMaterial({ slug: "dup-material-slug" });

    const qA = makeValidTiuQuestion({ slug: "dup-question-slug" });
    const qB = makeValidTiuQuestion({ slug: "dup-question-slug" });

    const matDupReport = validateContentBundles({
      materialFiles: [
        { fileName: "m1.json", items: [matA] },
        { fileName: "m2.json", items: [matB] },
      ],
      questionFiles: [],
    });
    expect(matDupReport.valid).toBe(false);
    expect(matDupReport.errors.some((e) => e.includes("dup-material-slug"))).toBe(true);

    const qDupReport = validateContentBundles({
      materialFiles: [],
      questionFiles: [
        { fileName: "q1.json", items: [qA] },
        { fileName: "q2.json", items: [qB] },
      ],
    });
    expect(qDupReport.valid).toBe(false);
    expect(qDupReport.errors.some((e) => e.includes("dup-question-slug"))).toBe(true);
  });

  it("8. emits non-blocking warning when 5-point TKP option exceeds median by >35%, and rejects Markdown-wrapped URL", () => {
    const biasedTkp = QuizQuestionSeedSchema.parse(
      makeValidTkpQuestion({
        options: {
          A: "Menjelaskan kekurangan dokumen secara sangat terperinci, sabar, dan penuh empati lalu mendampingi warga mengisi ulang formulir resmi hingga selesai tepat waktu sesuai SOP",
          B: "Menerima berkas seadanya lalu memprosesnya langsung",
          C: "Meminta warga kembali lagi minggu depan saja",
          D: "Menolak melayani karena loket hampir tutup",
          E: "Menyuruh warga bertanya ke petugas keamanan",
        },
        scoringRubric: { A: 5, B: 2, C: 3, D: 4, E: 1 },
      })
    ) as QuizQuestionSeed;

    const warning = checkTkpOptionLengthWarning(biasedTkp);
    expect(warning).not.toBeNull();
    expect(warning).toContain(biasedTkp.slug);

    const report = validateContentBundles({
      materialFiles: [],
      questionFiles: [{ fileName: "tkp.json", items: [biasedTkp] }],
    });
    expect(report.valid).toBe(true);
    expect(report.warnings.length).toBeGreaterThanOrEqual(1);

    const markdownUrlRes = SourceMetaSchema.safeParse({
      type: "youtube",
      title: "Pembahasan TKP",
      url: "[https://x.com](https://x.com)",
    });
    expect(markdownUrlRes.success).toBe(false);
    if (!markdownUrlRes.success) {
      expect(markdownUrlRes.error.issues[0]?.message).toBe(
        "URL must be a raw plain https:// URL, not Markdown link syntax"
      );
    }
  });

  it("computes deterministic trimmed sha256 content hashes and scans only top-level .json files", () => {
    expect(computeContentHash("  hello world \n")).toBe(computeContentHash("hello world"));
    expect(computeContentHash("hello world")).toHaveLength(64);

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skd-content-test-"));
    try {
      const matDir = path.join(tmpRoot, "materials");
      const quizDir = path.join(tmpRoot, "quiz-bank");
      const rawDir = path.join(quizDir, "raw");
      const legacyDir = path.join(quizDir, "legacy");
      fs.mkdirSync(matDir, { recursive: true });
      fs.mkdirSync(rawDir, { recursive: true });
      fs.mkdirSync(legacyDir, { recursive: true });

      fs.writeFileSync(path.join(matDir, "twk.json"), JSON.stringify([makeValidMaterial()]));
      fs.writeFileSync(
        path.join(quizDir, "questions.json"),
        JSON.stringify([makeValidTwkQuestion(), makeValidTiuQuestion(), makeValidTkpQuestion()])
      );
      // Invalid JSON inside raw/ and legacy/ must NOT be scanned
      fs.writeFileSync(path.join(rawDir, "ignored.json"), "{not-valid-json");
      fs.writeFileSync(path.join(legacyDir, "ignored-legacy.json"), "[{\"broken\":true}]");

      const report = validateContentDirectories({
        materialsDir: matDir,
        quizDir,
      });
      expect(report.valid).toBe(true);
      expect(report.materials).toHaveLength(1);
      expect(report.questions).toHaveLength(3);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
