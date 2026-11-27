import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import {
  conversations,
  db,
  quizAttempts,
  quizQuestionMaterials,
  quizQuestions,
  quizSessions,
  studyMaterials,
  type QuizOptions,
  type QuizScoringRubric,
} from "@/lib/db";
import {
  scoreSingleQuestion,
  type OptionKey,
  type SkdCategory,
} from "@/lib/scoring/skd-scoring";
import { ApiError } from "@/middleware/api";

export interface PracticeQuestionMaterialItem {
  id: string;
  slug: string;
  title: string;
  subtopic: string;
  summary: string;
  contentMarkdown: string;
  sourceUrl: string | null;
}

export interface PracticeQuestionItem {
  id: string;
  slug: string;
  category: "TWK" | "TIU" | "TKP";
  subtopic: string;
  difficulty: string;
  stem: string;
  imageUrl: string | null;
  options: QuizOptions;
  hint: string;
  correctOption: "A" | "B" | "C" | "D" | "E" | null;
  scoringRubric: QuizScoringRubric | null;
  optionRationales: QuizOptions;
  reasoningChain: string;
  materials: PracticeQuestionMaterialItem[];
}

export interface CreatePracticePackInput {
  count?: 10 | 15 | 20;
  category?: "TWK" | "TIU" | "TKP";
  subtopic?: string;
  materialSlug?: string;
  wrongOnly?: boolean;
  questionIds?: string[];
  userId?: string | null;
  guestSessionId?: string | null;
  guestChatIds?: string[];
  guestSessionIds?: string[];
}

export interface PracticePackResult {
  sessionId: string;
  mode: "practice";
  totalCount: number;
  questions: PracticeQuestionItem[];
}

export interface SyncPracticeAttemptInput {
  sessionId: string;
  questionId: string;
  chatId?: string | null;
  userId?: string | null;
  selectedOption: "A" | "B" | "C" | "D" | "E";
  usedHint?: boolean;
  timeSpentSeconds?: number;
}

export interface SyncPracticeAttemptResult {
  attemptId: string;
  sessionId: string;
  questionId: string;
  selectedOption: "A" | "B" | "C" | "D" | "E";
  scoreEarned: number;
  maxScore: number;
  sessionCompleted: boolean;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_COUNTS = new Set([10, 15, 20]);

function isValidUuid(value?: string | null): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

function normalizeUuidList(values?: string[]): string[] {
  if (!values || values.length === 0) return [];
  return Array.from(
    new Set(values.map((v) => v.trim()).filter((v) => isValidUuid(v)))
  );
}

function normalizeCategory(value?: string | null): SkdCategory {
  const upper = value?.trim().toUpperCase();
  if (upper === "TIU" || upper === "TKP") return upper;
  return "TWK";
}

function normalizeOption(value?: string | null): OptionKey | null {
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

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildOwnerConditions(opts: {
  userId: string | null;
  validGuestChatIds: string[];
  validGuestSessionIds: string[];
}) {
  const conditions = [];
  if (opts.userId) {
    conditions.push(
      or(
        eq(quizAttempts.userId, opts.userId),
        eq(conversations.userId, opts.userId),
        eq(quizSessions.userId, opts.userId)
      )
    );
  }
  if (opts.validGuestChatIds.length > 0) {
    conditions.push(
      and(
        inArray(quizAttempts.chatId, opts.validGuestChatIds),
        eq(conversations.isGuestChat, true)
      )
    );
  }
  if (opts.validGuestSessionIds.length > 0) {
    conditions.push(
      and(
        inArray(quizAttempts.sessionId, opts.validGuestSessionIds),
        isNull(quizSessions.userId)
      )
    );
  }
  return conditions;
}

export async function createPracticePack(
  input: CreatePracticePackInput = {}
): Promise<PracticePackResult> {
  const count = input.count ?? 10;
  if (!VALID_COUNTS.has(count)) {
    throw new ApiError(
      "Jumlah soal latihan harus 10, 15, atau 20",
      400,
      "INVALID_COUNT"
    );
  }

  const userId = isValidUuid(input.userId) ? input.userId.trim() : null;
  const validQuestionIds = normalizeUuidList(input.questionIds);
  const validGuestChatIds = normalizeUuidList(input.guestChatIds);
  const validGuestSessionIds = normalizeUuidList(input.guestSessionIds);

  if (
    input.questionIds &&
    input.questionIds.length > 0 &&
    validQuestionIds.length === 0
  ) {
    return {
      sessionId: "",
      mode: "practice",
      totalCount: 0,
      questions: [],
    };
  }

  let candidateQuestions: (typeof quizQuestions.$inferSelect)[] = [];

  if (validQuestionIds.length > 0) {
    candidateQuestions = await db
      .select()
      .from(quizQuestions)
      .where(
        and(
          eq(quizQuestions.isValidated, true),
          inArray(quizQuestions.id, validQuestionIds)
        )
      );
  } else if (input.materialSlug?.trim()) {
    const slug = input.materialSlug.trim();
    const [material] = await db
      .select()
      .from(studyMaterials)
      .where(eq(studyMaterials.slug, slug))
      .limit(1);

    if (!material) {
      throw new ApiError(
        `Materi dengan slug '${slug}' tidak ditemukan`,
        404,
        "MATERIAL_NOT_FOUND"
      );
    }

    const linkedRows = await db
      .select({ question: quizQuestions })
      .from(quizQuestions)
      .innerJoin(
        quizQuestionMaterials,
        eq(quizQuestions.id, quizQuestionMaterials.questionId)
      )
      .where(
        and(
          eq(quizQuestions.isValidated, true),
          eq(quizQuestionMaterials.materialId, material.id)
        )
      );

    if (linkedRows.length > 0) {
      candidateQuestions = linkedRows.map((row) => row.question);
    } else {
      candidateQuestions = await db
        .select()
        .from(quizQuestions)
        .where(
          and(
            eq(quizQuestions.isValidated, true),
            eq(quizQuestions.category, "TWK"),
            eq(quizQuestions.subtopic, material.subtopic)
          )
        );
    }
  } else {
    const filterConditions = [eq(quizQuestions.isValidated, true)];
    if (input.category) {
      filterConditions.push(eq(quizQuestions.category, input.category));
    }
    if (input.subtopic?.trim()) {
      filterConditions.push(eq(quizQuestions.subtopic, input.subtopic.trim()));
    }

    candidateQuestions = await db
      .select()
      .from(quizQuestions)
      .where(and(...filterConditions));
  }

  if (candidateQuestions.length === 0) {
    return {
      sessionId: "",
      mode: "practice",
      totalCount: 0,
      questions: [],
    };
  }

  const ownerConditions = buildOwnerConditions({
    userId,
    validGuestChatIds,
    validGuestSessionIds,
  });

  if (input.wrongOnly === true) {
    if (ownerConditions.length === 0) {
      return {
        sessionId: "",
        mode: "practice",
        totalCount: 0,
        questions: [],
      };
    }

    const missedAttempts = await db
      .select({
        questionId: quizAttempts.questionId,
        ragSourceId: quizAttempts.ragSourceId,
      })
      .from(quizAttempts)
      .leftJoin(conversations, eq(quizAttempts.chatId, conversations.id))
      .leftJoin(quizSessions, eq(quizAttempts.sessionId, quizSessions.id))
      .where(
        and(
          eq(quizAttempts.status, "answered"),
          lt(quizAttempts.scoreEarned, 5),
          ownerConditions.length === 1
            ? ownerConditions[0]
            : or(...ownerConditions)
        )
      );

    if (missedAttempts.length === 0) {
      return {
        sessionId: "",
        mode: "practice",
        totalCount: 0,
        questions: [],
      };
    }

    const missedQuestionIds = new Set(
      missedAttempts
        .map((a) => a.questionId)
        .filter((id): id is string => isValidUuid(id))
    );
    const missedSlugs = new Set(
      missedAttempts
        .map((a) => a.ragSourceId?.trim())
        .filter((slug): slug is string => Boolean(slug))
    );

    candidateQuestions = candidateQuestions.filter(
      (q) => missedQuestionIds.has(q.id) || missedSlugs.has(q.slug)
    );

    if (candidateQuestions.length === 0) {
      return {
        sessionId: "",
        mode: "practice",
        totalCount: 0,
        questions: [],
      };
    }
  }

  const attemptedQuestionIds = new Set<string>();
  const attemptedSlugs = new Set<string>();

  if (ownerConditions.length > 0 && validQuestionIds.length === 0) {
    const priorAttempts = await db
      .select({
        questionId: quizAttempts.questionId,
        ragSourceId: quizAttempts.ragSourceId,
      })
      .from(quizAttempts)
      .leftJoin(conversations, eq(quizAttempts.chatId, conversations.id))
      .leftJoin(quizSessions, eq(quizAttempts.sessionId, quizSessions.id))
      .where(
        and(
          eq(quizAttempts.status, "answered"),
          ownerConditions.length === 1
            ? ownerConditions[0]
            : or(...ownerConditions)
        )
      );

    for (const attempt of priorAttempts) {
      if (isValidUuid(attempt.questionId)) {
        attemptedQuestionIds.add(attempt.questionId);
      }
      if (attempt.ragSourceId?.trim()) {
        attemptedSlugs.add(attempt.ragSourceId.trim());
      }
    }
  }

  const unattempted: (typeof quizQuestions.$inferSelect)[] = [];
  const attempted: (typeof quizQuestions.$inferSelect)[] = [];

  for (const question of candidateQuestions) {
    if (
      attemptedQuestionIds.has(question.id) ||
      attemptedSlugs.has(question.slug)
    ) {
      attempted.push(question);
    } else {
      unattempted.push(question);
    }
  }

  const selected = [
    ...shuffleArray(unattempted),
    ...shuffleArray(attempted),
  ].slice(0, count);

  const twkQuestionIds = selected
    .filter((q) => normalizeCategory(q.category) === "TWK")
    .map((q) => q.id);

  const materialsByQuestionId = new Map<
    string,
    PracticeQuestionMaterialItem[]
  >();

  if (twkQuestionIds.length > 0) {
    const linkedMaterials = await db
      .select({
        questionId: quizQuestionMaterials.questionId,
        material: {
          id: studyMaterials.id,
          slug: studyMaterials.slug,
          title: studyMaterials.title,
          subtopic: studyMaterials.subtopic,
          summary: studyMaterials.summary,
          contentMarkdown: studyMaterials.contentMarkdown,
          sourceUrl: studyMaterials.sourceUrl,
        },
      })
      .from(quizQuestionMaterials)
      .innerJoin(
        studyMaterials,
        eq(quizQuestionMaterials.materialId, studyMaterials.id)
      )
      .where(inArray(quizQuestionMaterials.questionId, twkQuestionIds));

    for (const row of linkedMaterials) {
      const list = materialsByQuestionId.get(row.questionId) ?? [];
      list.push(row.material);
      materialsByQuestionId.set(row.questionId, list);
    }
  }

  const [createdSession] = await db
    .insert(quizSessions)
    .values({
      userId,
      guestSessionId: input.guestSessionId ?? null,
      mode: "practice",
      status: "in_progress",
      durationSeconds: null,
      questionOrder: selected.map((q) => q.id),
    })
    .returning({ id: quizSessions.id });

  const questions: PracticeQuestionItem[] = selected.map((q) => {
    const category = normalizeCategory(q.category);
    return {
      id: q.id,
      slug: q.slug,
      category,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      stem: q.stem,
      imageUrl: q.imageUrl ?? null,
      options: q.options,
      hint: q.hint,
      correctOption: normalizeOption(q.correctOption),
      scoringRubric: q.scoringRubric ?? null,
      optionRationales: q.optionRationales,
      reasoningChain: q.reasoningChain,
      materials:
        category === "TWK" ? (materialsByQuestionId.get(q.id) ?? []) : [],
    };
  });

  return {
    sessionId: createdSession.id,
    mode: "practice",
    totalCount: questions.length,
    questions,
  };
}

function buildPracticeScoreSummary(
  rows: Array<{
    category: string;
    subtopic: string;
    scoreEarned: number | null;
    maxScore: number;
    timeSpentSeconds: number | null;
  }>
) {
  const byCategory: Record<
    SkdCategory,
    {
      questionCount: number;
      scoreEarned: number;
      maxScore: number;
      accuracyRatio: number;
      timeSpentSeconds: number;
    }
  > = {
    TWK: {
      questionCount: 0,
      scoreEarned: 0,
      maxScore: 0,
      accuracyRatio: 0,
      timeSpentSeconds: 0,
    },
    TIU: {
      questionCount: 0,
      scoreEarned: 0,
      maxScore: 0,
      accuracyRatio: 0,
      timeSpentSeconds: 0,
    },
    TKP: {
      questionCount: 0,
      scoreEarned: 0,
      maxScore: 0,
      accuracyRatio: 0,
      timeSpentSeconds: 0,
    },
  };

  const subtopicBuckets = new Map<
    string,
    { category: SkdCategory; subtopic: string; earned: number; max: number }
  >();

  let totalScoreEarned = 0;
  let maxScore = 0;

  for (const row of rows) {
    const category = normalizeCategory(row.category);
    const earned = row.scoreEarned ?? 0;
    const itemMax = row.maxScore ?? 5;
    const spent = row.timeSpentSeconds ?? 0;

    totalScoreEarned += earned;
    maxScore += itemMax;

    byCategory[category].questionCount += 1;
    byCategory[category].scoreEarned += earned;
    byCategory[category].maxScore += itemMax;
    byCategory[category].timeSpentSeconds += spent;

    const bucketKey = `${category}::${row.subtopic}`;
    const existing = subtopicBuckets.get(bucketKey);
    if (existing) {
      existing.earned += earned;
      existing.max += itemMax;
    } else {
      subtopicBuckets.set(bucketKey, {
        category,
        subtopic: row.subtopic,
        earned,
        max: itemMax,
      });
    }
  }

  for (const cat of ["TWK", "TIU", "TKP"] as const) {
    const entry = byCategory[cat];
    entry.accuracyRatio =
      entry.maxScore > 0 ? entry.scoreEarned / entry.maxScore : 0;
  }

  const weakSubtopics = Array.from(subtopicBuckets.values())
    .map((bucket) => ({
      ...bucket,
      accuracyRatio: bucket.max > 0 ? bucket.earned / bucket.max : 0,
    }))
    .filter((entry) => entry.accuracyRatio < 0.7)
    .sort((a, b) => a.accuracyRatio - b.accuracyRatio);

  return {
    totalScoreEarned,
    maxScore,
    byCategory,
    weakSubtopics,
  };
}

export async function syncPracticeAttempt(
  input: SyncPracticeAttemptInput
): Promise<SyncPracticeAttemptResult> {
  const [session] = await db
    .select()
    .from(quizSessions)
    .where(eq(quizSessions.id, input.sessionId))
    .limit(1);

  if (!session) {
    throw new ApiError(
      "Sesi latihan tidak ditemukan",
      404,
      "SESSION_NOT_FOUND"
    );
  }

  const actorUserId = isValidUuid(input.userId) ? input.userId.trim() : null;
  if (session.userId && session.userId !== actorUserId) {
    throw new ApiError(
      "Anda tidak memiliki akses ke sesi latihan ini",
      403,
      "SESSION_ACCESS_DENIED"
    );
  }

  if (session.mode !== "practice") {
    throw new ApiError(
      "Sesi ini bukan sesi latihan (practice)",
      400,
      "INVALID_SESSION_MODE"
    );
  }

  const [question] = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.id, input.questionId))
    .limit(1);

  if (!question) {
    throw new ApiError("Soal tidak ditemukan", 404, "QUESTION_NOT_FOUND");
  }

  if (
    !Array.isArray(session.questionOrder) ||
    !session.questionOrder.includes(question.id)
  ) {
    throw new ApiError(
      "Soal tidak termasuk dalam paket latihan ini",
      400,
      "QUESTION_NOT_IN_SESSION"
    );
  }

  let validChatId: string | null = null;
  if (isValidUuid(input.chatId)) {
    const [conversation] = await db
      .select({ id: conversations.id, userId: conversations.userId })
      .from(conversations)
      .where(eq(conversations.id, input.chatId.trim()))
      .limit(1);

    if (!conversation) {
      throw new ApiError("Chat tidak ditemukan", 404, "CHAT_NOT_FOUND");
    }
    if (conversation.userId && conversation.userId !== actorUserId) {
      throw new ApiError("Akses ke chat ditolak", 403, "CHAT_ACCESS_DENIED");
    }
    validChatId = conversation.id;
  }

  const category = normalizeCategory(question.category);
  const scoreEarned = scoreSingleQuestion({
    category,
    selectedOption: input.selectedOption,
    correctOption: normalizeOption(question.correctOption),
    scoringRubric: question.scoringRubric,
  });

  const rubricRationale = Object.entries(question.optionRationales)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  const now = new Date();
  const [upserted] = await db
    .insert(quizAttempts)
    .values({
      sessionId: session.id,
      questionId: question.id,
      chatId: validChatId,
      userId: actorUserId ?? session.userId ?? null,
      ragSourceId: question.slug,
      category,
      subtopic: question.subtopic,
      questionStem: question.stem,
      imageUrl: question.imageUrl ?? null,
      options: question.options,
      correctOption: question.correctOption,
      scoringRubric: question.scoringRubric,
      rubricRationale,
      userAnswer: input.selectedOption,
      scoreEarned,
      maxScore: 5,
      status: "answered",
      usedHint: Boolean(input.usedHint),
      timeSpentSeconds: input.timeSpentSeconds ?? null,
      answeredAt: now,
    })
    .onConflictDoUpdate({
      target: [quizAttempts.sessionId, quizAttempts.questionId],
      set: {
        imageUrl: question.imageUrl ?? null,
        userAnswer: input.selectedOption,
        scoreEarned,
        usedHint: sql`${quizAttempts.usedHint} OR ${Boolean(input.usedHint)}`,
        timeSpentSeconds: input.timeSpentSeconds ?? null,
        status: "answered",
        answeredAt: now,
      },
    })
    .returning({ id: quizAttempts.id });

  const answeredRows = await db
    .select({
      category: quizAttempts.category,
      subtopic: quizAttempts.subtopic,
      scoreEarned: quizAttempts.scoreEarned,
      maxScore: quizAttempts.maxScore,
      timeSpentSeconds: quizAttempts.timeSpentSeconds,
    })
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.sessionId, session.id),
        eq(quizAttempts.status, "answered")
      )
    );

  const expectedCount = Array.isArray(session.questionOrder)
    ? session.questionOrder.length
    : 0;
  const sessionCompleted =
    expectedCount > 0 && answeredRows.length >= expectedCount;

  if (sessionCompleted) {
    const scoreSummary = buildPracticeScoreSummary(answeredRows);
    await db
      .update(quizSessions)
      .set({
        status: "completed",
        completedAt: new Date(),
        scoreSummary,
      })
      .where(eq(quizSessions.id, session.id));
  }

  return {
    attemptId: upserted.id,
    sessionId: session.id,
    questionId: question.id,
    selectedOption: input.selectedOption,
    scoreEarned,
    maxScore: 5,
    sessionCompleted,
  };
}
