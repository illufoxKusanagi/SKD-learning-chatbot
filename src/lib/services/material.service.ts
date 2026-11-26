import {
  and,
  asc,
  eq,
  inArray,
  lt,
  or,
} from "drizzle-orm";
import {
  conversations,
  db,
  quizAttempts,
  quizQuestionMaterials,
  quizQuestions,
  studyMaterials,
  type QuizOptions,
  type QuizScoringRubric,
  type StudyMaterialSourceMeta,
} from "@/lib/db";

export interface StudyMaterialSummaryItem {
  id: string;
  slug: string;
  title: string;
  category: "TWK";
  subtopic: string;
  summary: string;
  sourceType: string;
  sourceUrl: string | null;
  sourceMeta: StudyMaterialSourceMeta | null;
  linkedQuestionCount: number;
  mistakeCount: number;
  updatedAt: string;
}

export interface StudyMaterialDetail extends StudyMaterialSummaryItem {
  contentMarkdown: string;
  linkedQuestionSlugs: string[];
}

export interface DeepTutorMaterialItem {
  id: string;
  slug: string;
  title: string;
  subtopic: string;
  summary: string;
  contentMarkdown: string;
}

export interface DeepTutorQuizContext {
  questionId?: string;
  questionSlug?: string;
  category: "TWK" | "TIU" | "TKP";
  subtopic: string;
  stem: string;
  options?: QuizOptions | null;
  correctOption?: "A" | "B" | "C" | "D" | "E" | null;
  scoringRubric?: QuizScoringRubric | null;
  reasoningChain?: string | null;
  optionRationales?: Partial<QuizOptions> | null;
  selectedAnswer?: "A" | "B" | "C" | "D" | "E" | null;
  materials: DeepTutorMaterialItem[];
}

type OptionLetter = "A" | "B" | "C" | "D" | "E";
const OPTION_LETTERS: readonly OptionLetter[] = ["A", "B", "C", "D", "E"];
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value?: string | null): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

function normalizeCategory(value?: string | null): "TWK" | "TIU" | "TKP" {
  const upper = value?.toUpperCase();
  if (upper === "TIU" || upper === "TKP") return upper;
  return "TWK";
}

function normalizeOption(value?: string | null): OptionLetter | null {
  const upper = value?.trim().toUpperCase();
  if (
    upper === "A" ||
    upper === "B" ||
    upper === "C" ||
    upper === "D" ||
    upper === "E"
  ) {
    return upper;
  }
  return null;
}

async function computeMistakeCountsByMaterial(
  materials: { id: string; subtopic: string }[],
  opts?: { userId?: string | null; guestChatIds?: string[] }
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (materials.length === 0) return counts;

  const userId = isValidUuid(opts?.userId) ? opts!.userId!.trim() : null;
  const validGuestChatIds = (opts?.guestChatIds || [])
    .map((id) => id.trim())
    .filter((id) => isValidUuid(id));

  if (!userId && validGuestChatIds.length === 0) {
    return counts;
  }

  const ownerConditions = [];
  if (userId) {
    ownerConditions.push(
      or(eq(quizAttempts.userId, userId), eq(conversations.userId, userId))
    );
  }
  if (validGuestChatIds.length > 0) {
    ownerConditions.push(
      and(
        inArray(quizAttempts.chatId, validGuestChatIds),
        eq(conversations.isGuestChat, true)
      )
    );
  }

  const mistakeAttempts = await db
    .select({
      questionId: quizAttempts.questionId,
      ragSourceId: quizAttempts.ragSourceId,
      subtopic: quizAttempts.subtopic,
    })
    .from(quizAttempts)
    .leftJoin(conversations, eq(quizAttempts.chatId, conversations.id))
    .where(
      and(
        eq(quizAttempts.status, "answered"),
        eq(quizAttempts.category, "TWK"),
        lt(quizAttempts.scoreEarned, 5),
        ownerConditions.length === 1
          ? ownerConditions[0]
          : or(...ownerConditions)
      )
    );

  if (mistakeAttempts.length === 0) {
    return counts;
  }

  const materialIdSet = new Set(materials.map((m) => m.id));
  const questionIds = Array.from(
    new Set(
      mistakeAttempts
        .map((a) => a.questionId)
        .filter((id): id is string => isValidUuid(id))
    )
  );
  const ragSourceSlugs = Array.from(
    new Set(
      mistakeAttempts
        .map((a) => a.ragSourceId?.trim())
        .filter((slug): slug is string => Boolean(slug))
    )
  );

  const materialsByQuestionId = new Map<string, string[]>();
  const materialsByQuestionSlug = new Map<string, string[]>();

  if (questionIds.length > 0) {
    const links = await db
      .select({
        questionId: quizQuestionMaterials.questionId,
        materialId: quizQuestionMaterials.materialId,
      })
      .from(quizQuestionMaterials)
      .where(inArray(quizQuestionMaterials.questionId, questionIds));

    for (const link of links) {
      if (!materialIdSet.has(link.materialId)) continue;
      const list = materialsByQuestionId.get(link.questionId) ?? [];
      list.push(link.materialId);
      materialsByQuestionId.set(link.questionId, list);
    }
  }

  if (ragSourceSlugs.length > 0) {
    const slugLinks = await db
      .select({
        slug: quizQuestions.slug,
        materialId: quizQuestionMaterials.materialId,
      })
      .from(quizQuestions)
      .innerJoin(
        quizQuestionMaterials,
        eq(quizQuestions.id, quizQuestionMaterials.questionId)
      )
      .where(inArray(quizQuestions.slug, ragSourceSlugs));

    for (const link of slugLinks) {
      if (!materialIdSet.has(link.materialId)) continue;
      const list = materialsByQuestionSlug.get(link.slug) ?? [];
      list.push(link.materialId);
      materialsByQuestionSlug.set(link.slug, list);
    }
  }

  const materialsBySubtopic = new Map<string, string[]>();
  for (const mat of materials) {
    const key = mat.subtopic.trim().toLowerCase();
    const list = materialsBySubtopic.get(key) ?? [];
    list.push(mat.id);
    materialsBySubtopic.set(key, list);
  }

  for (const attempt of mistakeAttempts) {
    const matchedIds = new Set<string>();

    if (attempt.questionId) {
      for (const matId of materialsByQuestionId.get(attempt.questionId) ?? []) {
        matchedIds.add(matId);
      }
    }

    if (matchedIds.size === 0 && attempt.ragSourceId) {
      for (const matId of materialsByQuestionSlug.get(
        attempt.ragSourceId.trim()
      ) ?? []) {
        matchedIds.add(matId);
      }
    }

    if (matchedIds.size === 0 && attempt.subtopic) {
      const key = attempt.subtopic.trim().toLowerCase();
      for (const matId of materialsBySubtopic.get(key) ?? []) {
        matchedIds.add(matId);
      }
    }

    for (const matId of matchedIds) {
      counts.set(matId, (counts.get(matId) ?? 0) + 1);
    }
  }

  return counts;
}

export async function listStudyMaterials(filters?: {
  subtopic?: string;
  search?: string;
  weakOnly?: boolean;
  userId?: string | null;
  guestChatIds?: string[];
}): Promise<StudyMaterialSummaryItem[]> {
  const conditions = [eq(studyMaterials.category, "TWK")];
  const subtopicFilter = filters?.subtopic?.trim();
  if (subtopicFilter) {
    conditions.push(eq(studyMaterials.subtopic, subtopicFilter));
  }

  const materialRows = await db
    .select({
      id: studyMaterials.id,
      slug: studyMaterials.slug,
      title: studyMaterials.title,
      subtopic: studyMaterials.subtopic,
      summary: studyMaterials.summary,
      sourceType: studyMaterials.sourceType,
      sourceUrl: studyMaterials.sourceUrl,
      sourceMeta: studyMaterials.sourceMeta,
      updatedAt: studyMaterials.updatedAt,
    })
    .from(studyMaterials)
    .where(and(...conditions))
    .orderBy(asc(studyMaterials.subtopic), asc(studyMaterials.title));

  if (materialRows.length === 0) {
    return [];
  }

  const materialIds = materialRows.map((m) => m.id);
  const [linkedRows, mistakeCounts] = await Promise.all([
    db
      .select({
        materialId: quizQuestionMaterials.materialId,
        questionId: quizQuestionMaterials.questionId,
      })
      .from(quizQuestionMaterials)
      .innerJoin(
        quizQuestions,
        eq(quizQuestionMaterials.questionId, quizQuestions.id)
      )
      .where(
        and(
          inArray(quizQuestionMaterials.materialId, materialIds),
          eq(quizQuestions.isValidated, true)
        )
      ),
    computeMistakeCountsByMaterial(
      materialRows.map((m) => ({ id: m.id, subtopic: m.subtopic })),
      { userId: filters?.userId, guestChatIds: filters?.guestChatIds }
    ),
  ]);

  const linkedCountMap = new Map<string, number>();
  for (const row of linkedRows) {
    linkedCountMap.set(
      row.materialId,
      (linkedCountMap.get(row.materialId) ?? 0) + 1
    );
  }

  let items: StudyMaterialSummaryItem[] = materialRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: "TWK",
    subtopic: row.subtopic,
    summary: row.summary,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl ?? null,
    sourceMeta: row.sourceMeta ?? null,
    linkedQuestionCount: linkedCountMap.get(row.id) ?? 0,
    mistakeCount: mistakeCounts.get(row.id) ?? 0,
    updatedAt: row.updatedAt.toISOString(),
  }));

  const searchTerm = filters?.search?.trim().toLowerCase();
  if (searchTerm) {
    items = items.filter((item) =>
      `${item.title} ${item.subtopic} ${item.summary} ${item.slug}`
        .toLowerCase()
        .includes(searchTerm)
    );
  }

  if (filters?.weakOnly) {
    items = items
      .filter((item) => item.mistakeCount > 0)
      .sort(
        (a, b) =>
          b.mistakeCount - a.mistakeCount ||
          a.subtopic.localeCompare(b.subtopic) ||
          a.title.localeCompare(b.title)
      );
  } else {
    items.sort(
      (a, b) =>
        a.subtopic.localeCompare(b.subtopic) || a.title.localeCompare(b.title)
    );
  }

  return items;
}

export async function getStudyMaterialBySlug(
  slug: string,
  opts?: { userId?: string | null; guestChatIds?: string[] }
): Promise<StudyMaterialDetail | null> {
  const trimmedSlug = slug.trim();
  if (!trimmedSlug) return null;

  const [material] = await db
    .select({
      id: studyMaterials.id,
      slug: studyMaterials.slug,
      title: studyMaterials.title,
      subtopic: studyMaterials.subtopic,
      summary: studyMaterials.summary,
      contentMarkdown: studyMaterials.contentMarkdown,
      sourceType: studyMaterials.sourceType,
      sourceUrl: studyMaterials.sourceUrl,
      sourceMeta: studyMaterials.sourceMeta,
      updatedAt: studyMaterials.updatedAt,
    })
    .from(studyMaterials)
    .where(
      and(
        eq(studyMaterials.slug, trimmedSlug),
        eq(studyMaterials.category, "TWK")
      )
    )
    .limit(1);

  if (!material) return null;

  const [linkedQuestionRows, mistakeCounts] = await Promise.all([
    db
      .select({ slug: quizQuestions.slug })
      .from(quizQuestionMaterials)
      .innerJoin(
        quizQuestions,
        eq(quizQuestionMaterials.questionId, quizQuestions.id)
      )
      .where(
        and(
          eq(quizQuestionMaterials.materialId, material.id),
          eq(quizQuestions.isValidated, true)
        )
      )
      .orderBy(asc(quizQuestions.slug)),
    computeMistakeCountsByMaterial(
      [{ id: material.id, subtopic: material.subtopic }],
      opts
    ),
  ]);

  const linkedQuestionSlugs = linkedQuestionRows.map((r) => r.slug);

  return {
    id: material.id,
    slug: material.slug,
    title: material.title,
    category: "TWK",
    subtopic: material.subtopic,
    summary: material.summary,
    contentMarkdown: material.contentMarkdown,
    sourceType: material.sourceType,
    sourceUrl: material.sourceUrl ?? null,
    sourceMeta: material.sourceMeta ?? null,
    linkedQuestionCount: linkedQuestionSlugs.length,
    linkedQuestionSlugs,
    mistakeCount: mistakeCounts.get(material.id) ?? 0,
    updatedAt: material.updatedAt.toISOString(),
  };
}

export async function getDeterministicTutorContext(input: {
  questionId?: string | null;
  questionSlug?: string | null;
  quizAttemptId?: string | null;
  materialSlugs?: string[];
  selectedAnswer?: "A" | "B" | "C" | "D" | "E" | null;
}): Promise<DeepTutorQuizContext | null> {
  type QuestionRow = typeof quizQuestions.$inferSelect;
  type AttemptRow = typeof quizAttempts.$inferSelect;

  let question: QuestionRow | null = null;
  let attempt: AttemptRow | null = null;

  // Step A: Resolve quizQuestions row by questionId or questionSlug
  if (isValidUuid(input.questionId)) {
    const [row] = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.id, input.questionId.trim()))
      .limit(1);
    question = row ?? null;
  } else if (input.questionSlug?.trim()) {
    const slugOrId = input.questionSlug.trim();
    const [row] = await db
      .select()
      .from(quizQuestions)
      .where(
        isValidUuid(slugOrId)
          ? or(
              eq(quizQuestions.slug, slugOrId),
              eq(quizQuestions.id, slugOrId)
            )
          : eq(quizQuestions.slug, slugOrId)
      )
      .limit(1);
    question = row ?? null;
  }

  // Step B: Resolve quizAttempts row and enrich question if not loaded yet
  if (isValidUuid(input.quizAttemptId)) {
    const [row] = await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.id, input.quizAttemptId.trim()))
      .limit(1);
    attempt = row ?? null;

    if (!question && attempt) {
      if (isValidUuid(attempt.questionId)) {
        const [qById] = await db
          .select()
          .from(quizQuestions)
          .where(eq(quizQuestions.id, attempt.questionId))
          .limit(1);
        question = qById ?? null;
      }

      if (!question && attempt.ragSourceId?.trim()) {
        const ref = attempt.ragSourceId.trim();
        const [qByRef] = await db
          .select()
          .from(quizQuestions)
          .where(
            isValidUuid(ref)
              ? or(eq(quizQuestions.slug, ref), eq(quizQuestions.id, ref))
              : eq(quizQuestions.slug, ref)
          )
          .limit(1);
        question = qByRef ?? null;
      }
    }
  }

  // Step C: Load deterministic TWK materials (empty for TIU / TKP)
  const resolvedCategory = question
    ? normalizeCategory(question.category)
    : attempt
      ? normalizeCategory(attempt.category)
      : "TWK";

  const materials: DeepTutorMaterialItem[] = [];
  if (resolvedCategory === "TWK") {
    const seenSlugs = new Set<string>();

    if (question) {
      const linkedMaterials = await db
        .select({
          id: studyMaterials.id,
          slug: studyMaterials.slug,
          title: studyMaterials.title,
          subtopic: studyMaterials.subtopic,
          summary: studyMaterials.summary,
          contentMarkdown: studyMaterials.contentMarkdown,
        })
        .from(quizQuestionMaterials)
        .innerJoin(
          studyMaterials,
          eq(quizQuestionMaterials.materialId, studyMaterials.id)
        )
        .where(
          and(
            eq(quizQuestionMaterials.questionId, question.id),
            eq(studyMaterials.category, "TWK")
          )
        )
        .orderBy(asc(studyMaterials.title));

      for (const mat of linkedMaterials) {
        if (!seenSlugs.has(mat.slug)) {
          seenSlugs.add(mat.slug);
          materials.push(mat);
        }
      }
    }

    const cleanSlugs = Array.from(
      new Set(
        (input.materialSlugs || [])
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !seenSlugs.has(s))
      )
    );

    if (cleanSlugs.length > 0) {
      const explicitMaterials = await db
        .select({
          id: studyMaterials.id,
          slug: studyMaterials.slug,
          title: studyMaterials.title,
          subtopic: studyMaterials.subtopic,
          summary: studyMaterials.summary,
          contentMarkdown: studyMaterials.contentMarkdown,
        })
        .from(studyMaterials)
        .where(
          and(
            inArray(studyMaterials.slug, cleanSlugs),
            eq(studyMaterials.category, "TWK")
          )
        )
        .orderBy(asc(studyMaterials.title));

      for (const mat of explicitMaterials) {
        if (!seenSlugs.has(mat.slug)) {
          seenSlugs.add(mat.slug);
          materials.push(mat);
        }
      }
    }
  }

  // Step D: Build returned DeepTutorQuizContext
  const selectedAnswer =
    normalizeOption(input.selectedAnswer) ??
    normalizeOption(attempt?.userAnswer);

  if (question) {
    return {
      questionId: question.id,
      questionSlug: question.slug,
      category: normalizeCategory(question.category),
      subtopic: question.subtopic,
      stem: question.stem,
      options: question.options,
      correctOption: normalizeOption(question.correctOption),
      scoringRubric: question.scoringRubric ?? null,
      reasoningChain: question.reasoningChain,
      optionRationales: question.optionRationales,
      selectedAnswer,
      materials,
    };
  }

  if (attempt) {
    return {
      questionId: attempt.questionId ?? undefined,
      questionSlug: attempt.ragSourceId ?? undefined,
      category: normalizeCategory(attempt.category),
      subtopic: attempt.subtopic,
      stem: attempt.questionStem,
      options: attempt.options,
      correctOption: normalizeOption(attempt.correctOption),
      scoringRubric: attempt.scoringRubric ?? null,
      reasoningChain: attempt.rubricRationale ?? null,
      optionRationales: null,
      selectedAnswer,
      materials,
    };
  }

  if (materials.length > 0) {
    return {
      category: "TWK",
      subtopic: materials[0].subtopic,
      stem: "",
      materials,
    };
  }

  return null;
}

function formatMaterialsBlock(materials: DeepTutorMaterialItem[]): string {
  if (materials.length === 0) return "";
  const formatted = materials
    .map(
      (mat, idx) =>
        `### Materi ${idx + 1}: ${mat.title} (slug: ${mat.slug} | Subtopik: ${mat.subtopic})\n${mat.contentMarkdown}`
    )
    .join("\n\n---\n\n");
  return `[REFERENSI BANK MATERI TWK TERKAIT]\n${formatted}`;
}

export function buildDeepTutorPrompt(
  userMessage: string,
  context: DeepTutorQuizContext
): string {
  const materialsBlock = formatMaterialsBlock(context.materials);

  // Pure TWK material study mode (from /materi without a question)
  if (!context.stem.trim() && context.materials.length > 0) {
    return `${userMessage}

${materialsBlock}

[INSTRUKSI TUTOR BANK MATERI TWK]
Jawab pertanyaan pengguna secara kausal, terstruktur, dan mendalam dengan berlandaskan secara ketat pada 4 bagian HOTS materi di atas (Inti Konsep, Logika Sebab-Akibat, Jembatan Soal HOTS, dan Jebakan Klasik). Jelaskan hubungan sebab-akibat antarkonsep agar pengguna siap menghadapi variasi soal HOTS TWK.`;
  }

  const optionsBlock = context.options
    ? OPTION_LETTERS.map((opt) => `${opt}. ${context.options![opt]}`).join("\n")
    : "-";

  // Pre-answer conceptual hint mode (Spoiler Guard)
  if (!context.selectedAnswer) {
    return `${userMessage}

[KONTEKS BEDAH SOAL TERKUNCI — DETERMINISTIK]
Kategori & Subtopik: ${context.category} — ${context.subtopic}
Narasi Soal:
${context.stem}

Opsi Jawaban:
${optionsBlock}

Status Jawaban Pengguna: Pengguna BELUM menjawab soal ini (permintaan petunjuk konsep).
${materialsBlock ? `\n${materialsBlock}\n` : ""}
ATURAN ANTI-SPOILER WAJIB:
- DILARANG KERAS membocorkan huruf kunci jawaban (A/B/C/D/E), skor opsi mana pun, ataupun membeberkan eliminasi eksplisit yang langsung menunjuk satu opsi benar.
- Berikan petunjuk konsep, kata kunci pembeda dalam narasi soal, dan kerangka berpikir analitis agar pengguna dapat menyimpulkan jawabannya sendiri.`;
  }

  // Answered quiz deep discussion mode ("Bedah Bareng Tutor")
  let answerKeySection = "";
  if (context.category === "TKP") {
    const bestOption =
      context.correctOption ??
      OPTION_LETTERS.find((opt) => context.scoringRubric?.[opt] === 5) ??
      null;
    const rubricLines = context.scoringRubric
      ? OPTION_LETTERS.map(
          (opt) => `  - Opsi ${opt}: ${context.scoringRubric![opt]} poin`
        ).join("\n")
      : "  - Rubrik tidak tersedia";
    answerKeySection = `Pilihan Pengguna: Opsi ${context.selectedAnswer}
Opsi Terbaik (5 Poin): ${bestOption ? `Opsi ${bestOption}` : "-"}
Skor Rubrik TKP 1–5:
${rubricLines}`;
  } else {
    answerKeySection = `Pilihan Pengguna: Opsi ${context.selectedAnswer}
Kunci Jawaban: Opsi ${context.correctOption ?? "-"}`;
  }

  const reasoningSection = context.reasoningChain
    ? `\nRantai Penalaran Resmi:\n${context.reasoningChain}`
    : "";

  const rationalesEntries = context.optionRationales
    ? OPTION_LETTERS.filter((opt) => Boolean(context.optionRationales?.[opt]))
        .map((opt) => `- Opsi ${opt}: ${context.optionRationales![opt]}`)
        .join("\n")
    : "";
  const rationalesSection = rationalesEntries
    ? `\nRasional Tiap Opsi:\n${rationalesEntries}`
    : "";

  const proofInstruction =
    context.category === "TWK"
      ? "Untuk TWK, kutip dan rujuk secara eksplisit bagian yang relevan dari `[REFERENSI BANK MATERI TWK TERKAIT]` (beserta pasal/regulasi/konsep terkait)."
      : "Untuk TIU/TKP, uraikan langkah pembuktian matematis/logis atau hierarki indikator perilaku Core Values BerAKHLAK secara eksplisit dari `Rantai Penalaran Resmi`.";

  return `${userMessage}

[KONTEKS BEDAH SOAL TERKUNCI — DETERMINISTIK]
Kategori & Subtopik: ${context.category} — ${context.subtopic}
Narasi Soal:
${context.stem}

Opsi Jawaban:
${optionsBlock}

Status Jawaban Pengguna:
${answerKeySection}${reasoningSection}${rationalesSection}
${materialsBlock ? `\n${materialsBlock}\n` : ""}
[INSTRUKSI WAJIB STRUKTUR JAWABAN TUTOR — 3 BAGIAN]
Berikan pembahasan yang mendalam dan terstruktur dalam 3 bagian wajib berikut (DILARANG menjawab singkat 1–2 kalimat):
1. **Diagnosis Pilihan Anda vs Kunci Utama** — Jelaskan secara langsung mengapa Pilihan Pengguna (${context.selectedAnswer}) tepat atau keliru (atau mengapa skor TKP-nya berbeda dibanding opsi bernilai 5 poin).
2. **Bukti Konsep / Regulasi** — ${proofInstruction}
3. **Logika Sebab-Akibat, Skenario Kontrafaktual & Trik < 50 Detik** — Jelaskan konsekuensi konstitusional/operasional/logis apabila jalur opsi pengecoh dipilih (skenario kontrafaktual), lalu berikan aturan eliminasi tajam \`< 50 detik\` untuk soal serupa.`;
}
