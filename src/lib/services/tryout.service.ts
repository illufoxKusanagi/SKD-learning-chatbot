import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import {
  db,
  quizAttempts,
  quizQuestionMaterials,
  quizQuestions,
  quizSessions,
  studyMaterials,
  type QuizOptions,
  type QuizScoringRubric,
  type QuizSession,
} from "@/lib/db";
import {
  evaluateCatTryout,
  MINI_TRYOUT_CONFIG,
  OFFICIAL_SKD_CONFIG,
  scoreSingleQuestion,
  type CatScoreSummary,
  type EvaluatedQuestionInput,
  type OptionKey,
  type SkdCategory,
  type TryoutMode,
} from "@/lib/scoring/skd-scoring";
import type { PracticeQuestionMaterialItem } from "@/lib/services/practice.service";
import { pickAndRecordByCategories } from "@/lib/services/question-access.service";
import { ApiError } from "@/middleware/api";

export interface TryoutBankReadiness {
  counts: { TWK: number; TIU: number; TKP: number; total: number };
  fullCat: {
    ready: boolean;
    required: { TWK: number; TIU: number; TKP: number; total: number };
    deficits: { TWK: number; TIU: number; TKP: number };
    durationSeconds: number;
    passingGrades: { TWK: number; TIU: number; TKP: number };
  };
  miniCat: {
    ready: boolean;
    required: { TWK: number; TIU: number; TKP: number; total: number };
    deficits: { TWK: number; TIU: number; TKP: number };
    durationSeconds: number;
    passingGrades: { TWK: number; TIU: number; TKP: number };
  };
}

export interface TryoutQuestionMaskedItem {
  number: number; // 1-based index in exam (1..110 or 1..30)
  id: string;
  slug: string;
  category: SkdCategory;
  subtopic: string;
  stem: string;
  imageUrl: string | null;
  options: QuizOptions;
  selectedOption: OptionKey | null;
  isFlagged: boolean;
  timeSpentSeconds: number;
}

export interface TryoutQuestionReviewItem extends TryoutQuestionMaskedItem {
  scoreEarned: number;
  maxScore: number;
  correctOption: OptionKey | null;
  scoringRubric: QuizScoringRubric | null;
  hint: string;
  optionRationales: QuizOptions;
  reasoningChain: string;
  materials: PracticeQuestionMaterialItem[];
}

export interface TryoutSessionSummaryItem {
  id: string;
  mode: TryoutMode;
  status: "in_progress" | "completed" | "abandoned";
  durationSeconds: number;
  remainingSeconds: number;
  startedAt: string;
  completedAt: string | null;
  totalQuestions: number;
  answeredCount: number;
  flaggedCount: number;
  scoreSummary: CatScoreSummary | null;
}

export interface TryoutSessionDetail {
  id: string;
  mode: TryoutMode;
  status: "in_progress" | "completed" | "abandoned";
  serverNow: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number;
  remainingSeconds: number;
  totalQuestions: number;
  answeredCount: number;
  flaggedQuestionIds: string[];
  passingGrades: { TWK: number; TIU: number; TKP: number };
  scoreSummary: CatScoreSummary | null;
  questions: Array<TryoutQuestionMaskedItem | TryoutQuestionReviewItem>;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function isTryoutMode(mode: string): mode is TryoutMode {
  return mode === "cat_tryout" || mode === "mini_tryout";
}

function getModeConfig(mode: TryoutMode) {
  return mode === "cat_tryout" ? OFFICIAL_SKD_CONFIG : MINI_TRYOUT_CONFIG;
}

function getPassingGrades(mode: TryoutMode) {
  const cfg = getModeConfig(mode);
  return {
    TWK: cfg.TWK.passingGrade,
    TIU: cfg.TIU.passingGrade,
    TKP: cfg.TKP.passingGrade,
  };
}

function computeRemainingSeconds(
  session: Pick<QuizSession, "status" | "durationSeconds" | "startedAt" | "mode">,
  now: Date
): number {
  const mode: TryoutMode = isTryoutMode(session.mode)
    ? session.mode
    : "cat_tryout";
  const durationSeconds =
    session.durationSeconds ?? getModeConfig(mode).durationSeconds;

  if (session.status !== "in_progress") {
    return 0;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now.getTime() - session.startedAt.getTime()) / 1000)
  );
  return Math.max(0, durationSeconds - elapsedSeconds);
}

function formatRubricRationale(optionRationales: QuizOptions): string {
  return Object.entries(optionRationales)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function assertSessionOwner(
  session: QuizSession | undefined,
  userId?: string | null,
  guestSessionId?: string | null
): asserts session is QuizSession {
  if (!session) {
    throw new ApiError(
      "Sesi tryout tidak ditemukan",
      404,
      "SESSION_NOT_FOUND"
    );
  }

  if (!isTryoutMode(session.mode)) {
    throw new ApiError(
      "Sesi ini bukan sesi Tryout CAT",
      400,
      "INVALID_SESSION_MODE"
    );
  }

  const actorUserId = isValidUuid(userId) ? userId.trim() : null;
  if (session.userId && session.userId !== actorUserId) {
    throw new ApiError(
      "Anda tidak memiliki akses ke sesi tryout ini",
      403,
      "SESSION_ACCESS_DENIED"
    );
  }

  if (
    !session.userId &&
    session.guestSessionId &&
    session.guestSessionId !== (guestSessionId ?? null)
  ) {
    throw new ApiError(
      "Anda tidak memiliki akses ke sesi tryout ini",
      403,
      "SESSION_ACCESS_DENIED"
    );
  }
}

async function loadSessionOrThrow(
  sessionId: string,
  userId?: string | null,
  guestSessionId?: string | null
): Promise<QuizSession> {
  if (!isValidUuid(sessionId)) {
    throw new ApiError(
      "Sesi tryout tidak ditemukan",
      404,
      "SESSION_NOT_FOUND"
    );
  }

  const [session] = await db
    .select()
    .from(quizSessions)
    .where(eq(quizSessions.id, sessionId.trim()))
    .limit(1);

  assertSessionOwner(session, userId, guestSessionId);
  return session;
}

async function loadTwkMaterialsMap(
  questionIds: string[]
): Promise<Map<string, PracticeQuestionMaterialItem[]>> {
  const materialsByQuestionId = new Map<
    string,
    PracticeQuestionMaterialItem[]
  >();
  if (questionIds.length === 0) return materialsByQuestionId;

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
    .where(inArray(quizQuestionMaterials.questionId, questionIds));

  for (const row of linkedMaterials) {
    const list = materialsByQuestionId.get(row.questionId) ?? [];
    list.push(row.material);
    materialsByQuestionId.set(row.questionId, list);
  }

  return materialsByQuestionId;
}

function buildReadinessEntry(
  counts: { TWK: number; TIU: number; TKP: number },
  config: typeof OFFICIAL_SKD_CONFIG | typeof MINI_TRYOUT_CONFIG
) {
  const deficits = {
    TWK: Math.max(0, config.TWK.count - counts.TWK),
    TIU: Math.max(0, config.TIU.count - counts.TIU),
    TKP: Math.max(0, config.TKP.count - counts.TKP),
  };

  return {
    ready: deficits.TWK === 0 && deficits.TIU === 0 && deficits.TKP === 0,
    required: {
      TWK: config.TWK.count,
      TIU: config.TIU.count,
      TKP: config.TKP.count,
      total: config.totalQuestions,
    },
    deficits,
    durationSeconds: config.durationSeconds,
    passingGrades: {
      TWK: config.TWK.passingGrade,
      TIU: config.TIU.passingGrade,
      TKP: config.TKP.passingGrade,
    },
  };
}

export async function getTryoutBankReadiness(overrideCounts?: {
  TWK: number;
  TIU: number;
  TKP: number;
}): Promise<TryoutBankReadiness> {
  let counts = { TWK: 0, TIU: 0, TKP: 0 };

  if (overrideCounts) {
    counts = {
      TWK: Math.max(0, Math.trunc(overrideCounts.TWK)),
      TIU: Math.max(0, Math.trunc(overrideCounts.TIU)),
      TKP: Math.max(0, Math.trunc(overrideCounts.TKP)),
    };
  } else {
    const rows = await db
      .select({
        category: quizQuestions.category,
        count: sql<number>`count(*)::int`,
      })
      .from(quizQuestions)
      .where(eq(quizQuestions.isValidated, true))
      .groupBy(quizQuestions.category);

    for (const row of rows) {
      const cat = normalizeCategory(row.category);
      counts[cat] += Number(row.count) || 0;
    }
  }

  return {
    counts: {
      ...counts,
      total: counts.TWK + counts.TIU + counts.TKP,
    },
    fullCat: buildReadinessEntry(counts, OFFICIAL_SKD_CONFIG),
    miniCat: buildReadinessEntry(counts, MINI_TRYOUT_CONFIG),
  };
}

export async function startTryoutSession(input: {
  mode: TryoutMode;
  userId?: string | null;
  guestSessionId?: string | null;
  guestSessionIds?: string[];
}): Promise<TryoutSessionDetail> {
  if (!isTryoutMode(input.mode)) {
    throw new ApiError(
      "Mode tryout tidak valid. Pilih cat_tryout atau mini_tryout.",
      400,
      "INVALID_SESSION_MODE"
    );
  }

  const readiness = await getTryoutBankReadiness();
  const modeReadiness =
    input.mode === "cat_tryout" ? readiness.fullCat : readiness.miniCat;

  if (!modeReadiness.ready) {
    throw new ApiError(
      "Bank soal belum memenuhi kuota minimum mode ini",
      400,
      "BANK_NOT_READY"
    );
  }

  const userId = isValidUuid(input.userId) ? input.userId.trim() : null;
  const guestSessionId = userId ? null : (input.guestSessionId?.trim() || null);

  const allValidated = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.isValidated, true));

  const config = getModeConfig(input.mode);
  const selected = await pickAndRecordByCategories({
    actor: { userId, guestSessionId },
    candidates: allValidated,
    countsByCategory: {
      TWK: config.TWK.count,
      TIU: config.TIU.count,
      TKP: config.TKP.count,
    },
  });

  const questionOrder = selected.map((q) => q.id);
  const startedAt = new Date();

  const [created] = await db
    .insert(quizSessions)
    .values({
      userId,
      guestSessionId,
      mode: input.mode,
      status: "in_progress",
      durationSeconds: config.durationSeconds,
      startedAt,
      questionOrder,
      flaggedQuestionIds: [],
    })
    .returning();

  const maskedQuestions: TryoutQuestionMaskedItem[] = selected.map(
    (q, index) => ({
      number: index + 1,
      id: q.id,
      slug: q.slug,
      category: normalizeCategory(q.category),
      subtopic: q.subtopic,
      stem: q.stem,
      imageUrl: q.imageUrl ?? null,
      options: q.options,
      selectedOption: null,
      isFlagged: false,
      timeSpentSeconds: 0,
    })
  );

  return {
    id: created.id,
    mode: input.mode,
    status: "in_progress",
    serverNow: startedAt.toISOString(),
    startedAt: created.startedAt.toISOString(),
    completedAt: null,
    durationSeconds: config.durationSeconds,
    remainingSeconds: config.durationSeconds,
    totalQuestions: maskedQuestions.length,
    answeredCount: 0,
    flaggedQuestionIds: [],
    passingGrades: getPassingGrades(input.mode),
    scoreSummary: null,
    questions: maskedQuestions,
  };
}

export async function getTryoutSessionState(input: {
  sessionId: string;
  userId?: string | null;
  guestSessionId?: string | null;
  now?: Date;
}): Promise<TryoutSessionDetail> {
  const session = await loadSessionOrThrow(
    input.sessionId,
    input.userId,
    input.guestSessionId
  );
  const now = input.now ?? new Date();
  const mode = session.mode as TryoutMode;
  const durationSeconds =
    session.durationSeconds ?? getModeConfig(mode).durationSeconds;
  const remainingSeconds = computeRemainingSeconds(session, now);

  if (session.status === "in_progress" && remainingSeconds <= 0) {
    return finalizeTryoutSession({
      sessionId: session.id,
      userId: input.userId,
      guestSessionId: input.guestSessionId,
      now,
    });
  }

  const questionOrder = Array.isArray(session.questionOrder)
    ? session.questionOrder
    : [];

  const [questionRows, attemptRows] = await Promise.all([
    questionOrder.length > 0
      ? db
          .select()
          .from(quizQuestions)
          .where(inArray(quizQuestions.id, questionOrder))
      : Promise.resolve([]),
    db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.sessionId, session.id)),
  ]);

  const questionById = new Map(questionRows.map((q) => [q.id, q]));
  const attemptByQuestionId = new Map<
    string,
    typeof quizAttempts.$inferSelect
  >();
  let answeredCount = 0;

  for (const attempt of attemptRows) {
    if (attempt.questionId) {
      attemptByQuestionId.set(attempt.questionId, attempt);
    }
    if (normalizeOption(attempt.userAnswer) !== null) {
      answeredCount += 1;
    }
  }

  const flaggedQuestionIds = Array.isArray(session.flaggedQuestionIds)
    ? Array.from(new Set(session.flaggedQuestionIds))
    : [];
  const flaggedSet = new Set(flaggedQuestionIds);

  const isCompleted = session.status === "completed";
  let materialsByQuestionId = new Map<string, PracticeQuestionMaterialItem[]>();

  if (isCompleted) {
    const twkIds = questionOrder.filter((qId) => {
      const q = questionById.get(qId);
      return q && normalizeCategory(q.category) === "TWK";
    });
    materialsByQuestionId = await loadTwkMaterialsMap(twkIds);
  }

  const questions: Array<TryoutQuestionMaskedItem | TryoutQuestionReviewItem> =
    [];

  questionOrder.forEach((qId, index) => {
    const q = questionById.get(qId);
    if (!q) return;

    const category = normalizeCategory(q.category);
    const attempt = attemptByQuestionId.get(q.id);
    const selectedOption = normalizeOption(attempt?.userAnswer);

    const maskedItem: TryoutQuestionMaskedItem = {
      number: index + 1,
      id: q.id,
      slug: q.slug,
      category,
      subtopic: q.subtopic,
      stem: q.stem,
      imageUrl: q.imageUrl ?? null,
      options: q.options,
      selectedOption,
      isFlagged: flaggedSet.has(q.id),
      timeSpentSeconds: attempt?.timeSpentSeconds ?? 0,
    };

    if (!isCompleted) {
      questions.push(maskedItem);
      return;
    }

    const reviewItem: TryoutQuestionReviewItem = {
      ...maskedItem,
      scoreEarned: attempt?.scoreEarned ?? 0,
      maxScore: attempt?.maxScore ?? 5,
      correctOption: normalizeOption(q.correctOption),
      scoringRubric: q.scoringRubric ?? null,
      hint: q.hint,
      optionRationales: q.optionRationales,
      reasoningChain: q.reasoningChain,
      materials:
        category === "TWK" ? (materialsByQuestionId.get(q.id) ?? []) : [],
    };
    questions.push(reviewItem);
  });

  const status = session.status as TryoutSessionDetail["status"];

  return {
    id: session.id,
    mode,
    status,
    serverNow: now.toISOString(),
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt ? session.completedAt.toISOString() : null,
    durationSeconds,
    remainingSeconds: status === "in_progress" ? remainingSeconds : 0,
    totalQuestions: questionOrder.length,
    answeredCount,
    flaggedQuestionIds,
    passingGrades: getPassingGrades(mode),
    scoreSummary: isCompleted
      ? ((session.scoreSummary as CatScoreSummary | null) ?? null)
      : null,
    questions,
  };
}

export async function updateTryoutProgress(input: {
  sessionId: string;
  userId?: string | null;
  guestSessionId?: string | null;
  questionId: string;
  selectedOption?: OptionKey | null;
  isFlagged?: boolean;
  timeSpentDeltaSeconds?: number;
  now?: Date;
}): Promise<{
  sessionId: string;
  questionId: string;
  selectedOption: OptionKey | null;
  isFlagged: boolean;
  remainingSeconds: number;
  answeredCount: number;
  flaggedQuestionIds: string[];
}> {
  if (!isValidUuid(input.sessionId)) {
    throw new ApiError(
      "Sesi tryout tidak ditemukan",
      404,
      "SESSION_NOT_FOUND"
    );
  }

  const normalizedSessionId = input.sessionId.trim();
  const now = input.now ?? new Date();
  const actorUserId = isValidUuid(input.userId) ? input.userId.trim() : null;
  const clampedDelta = Math.min(
    600,
    Math.max(0, Math.trunc(input.timeSpentDeltaSeconds ?? 0))
  );

  const txResult = await db.transaction(async (tx) => {
    const [lockedSession] = await tx
      .select()
      .from(quizSessions)
      .where(eq(quizSessions.id, normalizedSessionId))
      .for("update");

    assertSessionOwner(lockedSession, input.userId, input.guestSessionId);

    const questionOrder = Array.isArray(lockedSession.questionOrder)
      ? lockedSession.questionOrder
      : [];

    if (
      !isValidUuid(input.questionId) ||
      !questionOrder.includes(input.questionId)
    ) {
      throw new ApiError(
        "Soal tidak termasuk dalam sesi tryout ini",
        400,
        "QUESTION_NOT_IN_SESSION"
      );
    }

    if (lockedSession.status !== "in_progress") {
      throw new ApiError(
        "Sesi ujian telah selesai dan terkunci",
        409,
        "EXAM_ALREADY_FINISHED"
      );
    }

    const remainingSeconds = computeRemainingSeconds(lockedSession, now);
    if (remainingSeconds <= 0) {
      return { expired: true as const };
    }

    if (input.selectedOption !== undefined || clampedDelta > 0) {
      const [question] = await tx
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.id, input.questionId))
        .limit(1);

      if (!question) {
        throw new ApiError("Soal tidak ditemukan", 404, "QUESTION_NOT_FOUND");
      }

      const updateSet: {
        userAnswer?: string | null;
        timeSpentSeconds: ReturnType<typeof sql>;
        status: string;
        scoreEarned: null;
      } = {
        timeSpentSeconds: sql`COALESCE(${quizAttempts.timeSpentSeconds}, 0) + ${clampedDelta}`,
        status: "pending",
        scoreEarned: null,
      };

      if (input.selectedOption !== undefined) {
        updateSet.userAnswer = input.selectedOption;
      }

      await tx
        .insert(quizAttempts)
        .values({
          sessionId: lockedSession.id,
          questionId: question.id,
          userId: actorUserId ?? lockedSession.userId ?? null,
          ragSourceId: question.slug,
          category: normalizeCategory(question.category),
          subtopic: question.subtopic,
          questionStem: question.stem,
          imageUrl: question.imageUrl ?? null,
          options: question.options,
          correctOption: question.correctOption,
          scoringRubric: question.scoringRubric,
          rubricRationale: formatRubricRationale(question.optionRationales),
          userAnswer: input.selectedOption ?? null,
          scoreEarned: null,
          maxScore: 5,
          status: "pending",
          timeSpentSeconds: clampedDelta,
          usedHint: false,
        })
        .onConflictDoUpdate({
          target: [quizAttempts.sessionId, quizAttempts.questionId],
          set: updateSet,
        });
    }

    const currentFlags = Array.isArray(lockedSession.flaggedQuestionIds)
      ? lockedSession.flaggedQuestionIds
      : [];
    let flaggedQuestionIds = Array.from(new Set(currentFlags));

    if (typeof input.isFlagged === "boolean") {
      const nextSet = new Set(currentFlags);
      if (input.isFlagged) {
        nextSet.add(input.questionId);
      } else {
        nextSet.delete(input.questionId);
      }
      flaggedQuestionIds = Array.from(nextSet);

      await tx
        .update(quizSessions)
        .set({ flaggedQuestionIds })
        .where(eq(quizSessions.id, lockedSession.id));
    }

    const sessionAttempts = await tx
      .select({
        questionId: quizAttempts.questionId,
        userAnswer: quizAttempts.userAnswer,
      })
      .from(quizAttempts)
      .where(eq(quizAttempts.sessionId, lockedSession.id));

    let selectedOption: OptionKey | null = null;
    let answeredCount = 0;

    for (const row of sessionAttempts) {
      const normalized = normalizeOption(row.userAnswer);
      if (normalized !== null) {
        answeredCount += 1;
      }
      if (row.questionId === input.questionId) {
        selectedOption = normalized;
      }
    }

    return {
      expired: false as const,
      sessionId: lockedSession.id,
      questionId: input.questionId,
      selectedOption,
      isFlagged: flaggedQuestionIds.includes(input.questionId),
      remainingSeconds,
      answeredCount,
      flaggedQuestionIds,
    };
  });

  if (txResult.expired) {
    await finalizeTryoutSession({
      sessionId: normalizedSessionId,
      userId: input.userId,
      guestSessionId: input.guestSessionId,
      now,
    });
    throw new ApiError(
      "Waktu ujian telah habis; ujian otomatis diselesaikan",
      409,
      "EXAM_TIME_EXPIRED"
    );
  }

  return {
    sessionId: txResult.sessionId,
    questionId: txResult.questionId,
    selectedOption: txResult.selectedOption,
    isFlagged: txResult.isFlagged,
    remainingSeconds: txResult.remainingSeconds,
    answeredCount: txResult.answeredCount,
    flaggedQuestionIds: txResult.flaggedQuestionIds,
  };
}

export async function finalizeTryoutSession(input: {
  sessionId: string;
  userId?: string | null;
  guestSessionId?: string | null;
  now?: Date;
}): Promise<TryoutSessionDetail> {
  const session = await loadSessionOrThrow(
    input.sessionId,
    input.userId,
    input.guestSessionId
  );

  if (session.status === "completed") {
    return getTryoutSessionState({
      sessionId: session.id,
      userId: input.userId,
      guestSessionId: input.guestSessionId,
      now: input.now,
    });
  }

  const completedTime = input.now ?? new Date();
  const mode = session.mode as TryoutMode;

  await db.transaction(async (tx) => {
    const [lockedSession] = await tx
      .select()
      .from(quizSessions)
      .where(eq(quizSessions.id, session.id))
      .for("update");

    if (!lockedSession || lockedSession.status !== "in_progress") {
      return;
    }

    const questionOrder = Array.isArray(lockedSession.questionOrder)
      ? lockedSession.questionOrder
      : [];

    const [questionRows, attemptRows] = await Promise.all([
      questionOrder.length > 0
        ? tx
            .select()
            .from(quizQuestions)
            .where(inArray(quizQuestions.id, questionOrder))
        : Promise.resolve([]),
      tx
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.sessionId, lockedSession.id)),
    ]);

    const questionById = new Map(questionRows.map((q) => [q.id, q]));
    const attemptByQuestionId = new Map(
      attemptRows
        .filter((a): a is typeof a & { questionId: string } =>
          Boolean(a.questionId)
        )
        .map((a) => [a.questionId, a])
    );

    const evaluatedItems: EvaluatedQuestionInput[] = [];
    const attemptUpdates: Array<Promise<unknown>> = [];

    for (const qId of questionOrder) {
      const question = questionById.get(qId);
      if (!question) continue;

      const category = normalizeCategory(question.category);
      const attempt = attemptByQuestionId.get(qId);
      const selectedOption = normalizeOption(attempt?.userAnswer);
      const isAnswered = selectedOption !== null;

      const scoreEarned = scoreSingleQuestion({
        category,
        selectedOption,
        correctOption: normalizeOption(question.correctOption),
        scoringRubric: question.scoringRubric,
      });

      evaluatedItems.push({
        category,
        subtopic: question.subtopic,
        scoreEarned,
        maxScore: 5,
        isAnswered,
        timeSpentSeconds: attempt?.timeSpentSeconds ?? 0,
      });

      if (attempt && isAnswered) {
        attemptUpdates.push(
          tx
            .update(quizAttempts)
            .set({
              status: "answered",
              scoreEarned,
              answeredAt: completedTime,
            })
            .where(eq(quizAttempts.id, attempt.id))
        );
      }
    }

    if (attemptUpdates.length > 0) {
      await Promise.all(attemptUpdates);
    }

    const scoreSummary = evaluateCatTryout(evaluatedItems, mode);

    await tx
      .update(quizSessions)
      .set({
        status: "completed",
        completedAt: completedTime,
        scoreSummary: scoreSummary as unknown as Record<string, unknown>,
      })
      .where(
        and(
          eq(quizSessions.id, lockedSession.id),
          eq(quizSessions.status, "in_progress")
        )
      );
  });

  return getTryoutSessionState({
    sessionId: session.id,
    userId: input.userId,
    guestSessionId: input.guestSessionId,
    now: completedTime,
  });
}

export async function listTryoutSessions(input: {
  userId?: string | null;
  guestSessionId?: string | null;
  guestSessionIds?: string[];
  now?: Date;
}): Promise<TryoutSessionSummaryItem[]> {
  const actorUserId = isValidUuid(input.userId) ? input.userId.trim() : null;
  const actorGuestSessionId = input.guestSessionId?.trim() || null;
  const validGuestSessionIds = normalizeUuidList(input.guestSessionIds);

  if (!actorUserId && !actorGuestSessionId && validGuestSessionIds.length === 0) {
    return [];
  }

  let ownerFilter;
  if (actorUserId) {
    ownerFilter = eq(quizSessions.userId, actorUserId);
  } else {
    const guestFilters = [];
    if (actorGuestSessionId) {
      guestFilters.push(
        and(
          eq(quizSessions.guestSessionId, actorGuestSessionId),
          isNull(quizSessions.userId)
        )
      );
    }
    if (validGuestSessionIds.length > 0) {
      guestFilters.push(
        and(
          inArray(quizSessions.id, validGuestSessionIds),
          isNull(quizSessions.userId),
          actorGuestSessionId
            ? or(
                eq(quizSessions.guestSessionId, actorGuestSessionId),
                isNull(quizSessions.guestSessionId)
              )
            : isNull(quizSessions.guestSessionId)
        )
      );
    }
    ownerFilter =
      guestFilters.length === 1 ? guestFilters[0] : or(...guestFilters);
  }

  const sessions = await db
    .select()
    .from(quizSessions)
    .where(
      and(
        inArray(quizSessions.mode, ["cat_tryout", "mini_tryout"]),
        ownerFilter
      )
    )
    .orderBy(desc(quizSessions.startedAt))
    .limit(20);

  if (sessions.length === 0) {
    return [];
  }

  const now = input.now ?? new Date();
  const finalizedById = new Map<string, TryoutSessionDetail>();

  for (const session of sessions) {
    if (
      session.status === "in_progress" &&
      computeRemainingSeconds(session, now) <= 0
    ) {
      const finalized = await finalizeTryoutSession({
        sessionId: session.id,
        userId: actorUserId,
        guestSessionId: session.guestSessionId,
        now,
      });
      finalizedById.set(session.id, finalized);
    }
  }

  const sessionIds = sessions.map((s) => s.id);
  const answeredCountRows = await db
    .select({
      sessionId: quizAttempts.sessionId,
      count: sql<number>`count(*)::int`,
    })
    .from(quizAttempts)
    .where(
      and(
        inArray(quizAttempts.sessionId, sessionIds),
        isNotNull(quizAttempts.userAnswer)
      )
    )
    .groupBy(quizAttempts.sessionId);

  const answeredCountBySessionId = new Map<string, number>();
  for (const row of answeredCountRows) {
    if (row.sessionId) {
      answeredCountBySessionId.set(row.sessionId, Number(row.count) || 0);
    }
  }

  return sessions.map((session) => {
    const finalized = finalizedById.get(session.id);
    if (finalized) {
      return {
        id: finalized.id,
        mode: finalized.mode,
        status: finalized.status,
        durationSeconds: finalized.durationSeconds,
        remainingSeconds: 0,
        startedAt: finalized.startedAt,
        completedAt: finalized.completedAt,
        totalQuestions: finalized.totalQuestions,
        answeredCount: finalized.answeredCount,
        flaggedCount: finalized.flaggedQuestionIds.length,
        scoreSummary: finalized.scoreSummary,
      };
    }

    const mode = session.mode as TryoutMode;
    const durationSeconds =
      session.durationSeconds ?? getModeConfig(mode).durationSeconds;
    const remainingSeconds = computeRemainingSeconds(session, now);
    const totalQuestions = Array.isArray(session.questionOrder)
      ? session.questionOrder.length
      : 0;
    const flaggedCount = Array.isArray(session.flaggedQuestionIds)
      ? new Set(session.flaggedQuestionIds).size
      : 0;

    return {
      id: session.id,
      mode,
      status: session.status as TryoutSessionSummaryItem["status"],
      durationSeconds,
      remainingSeconds,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt
        ? session.completedAt.toISOString()
        : null,
      totalQuestions,
      answeredCount: answeredCountBySessionId.get(session.id) ?? 0,
      flaggedCount,
      scoreSummary:
        session.status === "completed"
          ? ((session.scoreSummary as CatScoreSummary | null) ?? null)
          : null,
    };
  });
}
