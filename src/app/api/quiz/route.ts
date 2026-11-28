import { db } from '@/lib/db';
import {
  conversations,
  messages,
  quizAttempts,
  quizQuestionMaterials,
  quizQuestions,
  quizSessions,
  studyMaterials,
} from '@/lib/db/schema';
import {
  attachGuestCookie,
  getOrCreateGuestSession,
  readVerifiedGuestId,
} from '@/lib/auth/guest-session';
import { resolveOptionalUserId } from '@/lib/auth/optional-session';
import { NextRequest, NextResponse } from 'next/server';
import { eq, and, or, inArray, notInArray, isNull, desc } from 'drizzle-orm';
import z from 'zod';
import {
  ApiError,
  withMiddleware,
  createRateLimitMiddleware,
} from '@/middleware/api';
import {
  findRelevantContents,
  SkdQuizMetadata,
} from '@/lib/services/ai/rag.service';
import {
  generateAiResponse,
  extractQuizMetaFromText,
} from '@/lib/services/ai/gemini.service';

export const maxDuration = 60;

function isValidUuid(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    val
  );
}

function sanitizeQuizAttempt(
  quiz: typeof quizAttempts.$inferSelect,
  chatTitle?: string | null
) {
  const isAnswered = quiz.status === 'answered';
  return {
    id: quiz.id,
    chatId: quiz.chatId,
    chatTitle: chatTitle || 'Sesi SKD',
    userId: quiz.userId,
    questionId: quiz.questionId ?? null,
    ragSourceId: quiz.ragSourceId,
    category: quiz.category,
    subtopic: quiz.subtopic,
    questionStem: quiz.questionStem,
    imageUrl: quiz.imageUrl ?? null,
    options: quiz.options,
    maxScore: quiz.maxScore,
    status: quiz.status,
    createdAt: quiz.createdAt,
    // Sensitive fields only revealed once answered
    correctOption: isAnswered ? quiz.correctOption : null,
    scoringRubric: isAnswered ? quiz.scoringRubric : null,
    rubricRationale: isAnswered ? quiz.rubricRationale : null,
    userAnswer: isAnswered ? quiz.userAnswer : null,
    scoreEarned: isAnswered ? quiz.scoreEarned : null,
    aiExplanation: isAnswered ? quiz.aiExplanation : null,
    answeredAt: isAnswered ? quiz.answeredAt : null,
  };
}

const quizPostSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('grade'),
    quizAttemptId: z.string().uuid('Format quizAttemptId tidak valid'),
    selectedOption: z.enum(['A', 'B', 'C', 'D', 'E']),
  }),
  z.object({
    action: z.literal('next'),
    chatId: z.string().uuid().nullish(),
    category: z.enum(['TWK', 'TIU', 'TKP']).optional(),
    subtopic: z.string().trim().max(120).optional(),
    materialSlug: z.string().trim().max(160).optional(),
    insertChatMarker: z.boolean().optional(),
  }),
]);

function getZeroStats() {
  return {
    totalAttempts: 0,
    answeredCount: 0,
    pendingCount: 0,
    totalScoreEarned: 0,
    totalMaxScore: 0,
    averageScore: 0,
    byCategory: {
      TWK: {
        total: 0,
        answered: 0,
        correctCount: 0,
        scoreEarned: 0,
        maxScore: 0,
        accuracyPercent: 0,
      },
      TIU: {
        total: 0,
        answered: 0,
        correctCount: 0,
        scoreEarned: 0,
        maxScore: 0,
        accuracyPercent: 0,
      },
      TKP: {
        total: 0,
        answered: 0,
        optimalCount: 0,
        scoreEarned: 0,
        maxScore: 0,
        averagePoints: 0,
      },
    },
  };
}

async function handleGetQuizzes(request: NextRequest) {
  const url = new URL(request.url);
  const chatId = url.searchParams.get('chatId');
  const chatIdsParam = url.searchParams.get('chatIds');
  const sessionIdsParam = url.searchParams.get('sessionIds');
  const categoryParam = url.searchParams.get('category');
  const statusParam = url.searchParams.get('status');

  // Validate parameters if provided
  if (chatId && !isValidUuid(chatId)) {
    throw new ApiError('Format chatId tidak valid', 400, 'INVALID_CHAT_ID');
  }

  let chatIds: string[] = [];
  if (chatIdsParam) {
    chatIds = chatIdsParam
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const id of chatIds) {
      if (!isValidUuid(id)) {
        throw new ApiError(
          `Format chatId tidak valid: ${id}`,
          400,
          'INVALID_CHAT_ID'
        );
      }
    }
  }

  let sessionIds: string[] = [];
  if (sessionIdsParam) {
    sessionIds = sessionIdsParam
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const id of sessionIds) {
      if (!isValidUuid(id)) {
        throw new ApiError(
          `Format sessionId tidak valid: ${id}`,
          400,
          'INVALID_SESSION_ID'
        );
      }
    }
  }

  if (categoryParam) {
    const validCategories = ['TWK', 'TIU', 'TKP'];
    if (!validCategories.includes(categoryParam.toUpperCase())) {
      throw new ApiError(
        'Kategori tidak valid. Pilih TWK, TIU, atau TKP.',
        400,
        'INVALID_CATEGORY'
      );
    }
  }

  if (statusParam) {
    const validStatuses = ['pending', 'answered'];
    if (!validStatuses.includes(statusParam.toLowerCase())) {
      throw new ApiError(
        'Status tidak valid. Pilih pending atau answered.',
        400,
        'INVALID_STATUS'
      );
    }
  }

  // Retrieve user session and guest session
  const authUserId = await resolveOptionalUserId('GET /api/quiz');
  const guestId = authUserId ? null : await readVerifiedGuestId(request);

  type JoinedRow = {
    quiz: typeof quizAttempts.$inferSelect;
    chatTitle: string | null;
  };

  let rows: JoinedRow[] = [];

  if (chatId) {
    // 1. Specific chatId requested
    const [conversation] = await db
      .select({
        id: conversations.id,
        userId: conversations.userId,
        title: conversations.title,
        isGuestChat: conversations.isGuestChat,
        guestSessionId: conversations.guestSessionId,
      })
      .from(conversations)
      .where(eq(conversations.id, chatId))
      .limit(1);

    if (!conversation) {
      throw new ApiError('Chat tidak ditemukan', 404, 'CHAT_NOT_FOUND');
    }

    if (conversation.userId && conversation.userId !== authUserId) {
      throw new ApiError(
        'Anda tidak memiliki akses ke kuis chat ini',
        403,
        'CHAT_ACCESS_DENIED'
      );
    }

    if (!conversation.userId && !conversation.isGuestChat) {
      throw new ApiError(
        'Anda tidak memiliki akses ke kuis chat ini',
        403,
        'CHAT_ACCESS_DENIED'
      );
    }

    if (
      conversation.isGuestChat &&
      conversation.guestSessionId &&
      conversation.guestSessionId !== guestId
    ) {
      throw new ApiError(
        'Anda tidak memiliki akses ke kuis chat ini',
        403,
        'CHAT_ACCESS_DENIED'
      );
    }

    rows = await db
      .select({
        quiz: quizAttempts,
        chatTitle: conversations.title,
      })
      .from(quizAttempts)
      .leftJoin(conversations, eq(quizAttempts.chatId, conversations.id))
      .where(eq(quizAttempts.chatId, chatId))
      .orderBy(desc(quizAttempts.createdAt));
  } else if (authUserId) {
    // 2. Authenticated user: fetch all quiz attempts for this user (including standalone practice/CAT sessions)
    rows = await db
      .select({
        quiz: quizAttempts,
        chatTitle: conversations.title,
      })
      .from(quizAttempts)
      .leftJoin(conversations, eq(quizAttempts.chatId, conversations.id))
      .leftJoin(quizSessions, eq(quizAttempts.sessionId, quizSessions.id))
      .where(
        or(
          eq(quizAttempts.userId, authUserId),
          eq(conversations.userId, authUserId),
          eq(quizSessions.userId, authUserId)
        )
      )
      .orderBy(desc(quizAttempts.createdAt));
  } else if (chatIds.length > 0 || sessionIds.length > 0) {
    // 3. Guest user multi-chat / standalone session history
    const guestConditions = [];
    if (chatIds.length > 0) {
      guestConditions.push(
        and(
          inArray(quizAttempts.chatId, chatIds),
          eq(conversations.isGuestChat, true),
          guestId
            ? or(
                eq(conversations.guestSessionId, guestId),
                isNull(conversations.guestSessionId)
              )
            : isNull(conversations.guestSessionId)
        )
      );
    }
    if (sessionIds.length > 0) {
      guestConditions.push(
        and(
          inArray(quizAttempts.sessionId, sessionIds),
          isNull(quizSessions.userId),
          guestId
            ? or(
                eq(quizSessions.guestSessionId, guestId),
                isNull(quizSessions.guestSessionId)
              )
            : isNull(quizSessions.guestSessionId)
        )
      );
    }

    rows = await db
      .select({
        quiz: quizAttempts,
        chatTitle: conversations.title,
      })
      .from(quizAttempts)
      .leftJoin(conversations, eq(quizAttempts.chatId, conversations.id))
      .leftJoin(quizSessions, eq(quizAttempts.sessionId, quizSessions.id))
      .where(
        guestConditions.length === 1
          ? guestConditions[0]
          : or(...guestConditions)
      )
      .orderBy(desc(quizAttempts.createdAt));
  } else {
    // 4. Unauthenticated with no chatIds specified
    return NextResponse.json({
      success: true,
      data: {
        quizzes: [],
        stats: getZeroStats(),
      },
    });
  }

  // Compute stats across all fetched attempts for the user/chat
  let totalAttempts = 0;
  let answeredCount = 0;
  let pendingCount = 0;
  let totalScoreEarned = 0;
  let totalMaxScore = 0;

  const byCategory = {
    TWK: {
      total: 0,
      answered: 0,
      correctCount: 0,
      scoreEarned: 0,
      maxScore: 0,
      accuracyPercent: 0,
    },
    TIU: {
      total: 0,
      answered: 0,
      correctCount: 0,
      scoreEarned: 0,
      maxScore: 0,
      accuracyPercent: 0,
    },
    TKP: {
      total: 0,
      answered: 0,
      optimalCount: 0,
      scoreEarned: 0,
      maxScore: 0,
      averagePoints: 0,
    },
  };

  for (const { quiz } of rows) {
    totalAttempts++;
    const cat = quiz.category?.toUpperCase() as 'TWK' | 'TIU' | 'TKP';
    const catStats = byCategory[cat];

    if (catStats) {
      catStats.total++;
    }

    if (quiz.status === 'answered') {
      answeredCount++;
      const earned = quiz.scoreEarned ?? 0;
      const max = quiz.maxScore ?? 5;
      totalScoreEarned += earned;
      totalMaxScore += max;

      if (catStats) {
        catStats.answered++;
        catStats.scoreEarned += earned;
        catStats.maxScore += max;

        if (cat === 'TWK' || cat === 'TIU') {
          if (earned === max || quiz.userAnswer === quiz.correctOption) {
            byCategory[cat].correctCount++;
          }
        } else if (cat === 'TKP') {
          if (earned === 5) {
            byCategory.TKP.optimalCount++;
          }
        }
      }
    } else if (quiz.status === 'pending') {
      pendingCount++;
    }
  }

  const averageScore =
    answeredCount > 0
      ? Math.round((totalScoreEarned / answeredCount) * 100) / 100
      : 0;

  byCategory.TWK.accuracyPercent =
    byCategory.TWK.answered > 0
      ? Math.round(
          (byCategory.TWK.correctCount / byCategory.TWK.answered) * 100 * 10
        ) / 10
      : 0;

  byCategory.TIU.accuracyPercent =
    byCategory.TIU.answered > 0
      ? Math.round(
          (byCategory.TIU.correctCount / byCategory.TIU.answered) * 100 * 10
        ) / 10
      : 0;

  byCategory.TKP.averagePoints =
    byCategory.TKP.answered > 0
      ? Math.round(
          (byCategory.TKP.scoreEarned / byCategory.TKP.answered) * 100
        ) / 100
      : 0;

  const stats = {
    totalAttempts,
    answeredCount,
    pendingCount,
    totalScoreEarned,
    totalMaxScore,
    averageScore,
    byCategory,
  };

  // Apply optional category and status filters to returned quiz list
  let filteredRows = rows;
  if (categoryParam) {
    filteredRows = filteredRows.filter(
      (r) => r.quiz.category.toUpperCase() === categoryParam.toUpperCase()
    );
  }
  if (statusParam) {
    filteredRows = filteredRows.filter(
      (r) => r.quiz.status.toLowerCase() === statusParam.toLowerCase()
    );
  }

  // Security Rule: For status === "pending", sanitize correctOption, scoringRubric, and rubricRationale
  const sanitizedQuizzes = filteredRows.map(({ quiz, chatTitle }) =>
    sanitizeQuizAttempt(quiz, chatTitle)
  );

  return NextResponse.json({
    success: true,
    data: {
      quizzes: sanitizedQuizzes,
      stats,
    },
  });
}

function buildQuizMetaFromQuestionRow(
  chosen: typeof quizQuestions.$inferSelect
): SkdQuizMetadata {
  const optionKeys = ['A', 'B', 'C', 'D', 'E'] as const;
  const resolvedCorrect =
    chosen.correctOption &&
    optionKeys.includes(chosen.correctOption as (typeof optionKeys)[number])
      ? (chosen.correctOption as (typeof optionKeys)[number])
      : optionKeys.find((opt) => chosen.scoringRubric?.[opt] === 5) ?? 'A';

  const rationalesText = optionKeys
    .map((k) => `${k}: ${chosen.optionRationales[k]}`)
    .join('\n');
  const rubricRationale = chosen.reasoningChain
    ? `${chosen.reasoningChain}\n\n${rationalesText}`
    : rationalesText;

  return {
    ragSourceId: chosen.slug,
    category: (chosen.category as 'TWK' | 'TIU' | 'TKP') || 'TWK',
    subtopic: chosen.subtopic,
    questionStem: chosen.stem,
    imageUrl: chosen.imageUrl ?? null,
    options: chosen.options,
    correctOption: resolvedCorrect,
    scoringRubric: chosen.scoringRubric ?? {
      A: resolvedCorrect === 'A' ? 5 : 0,
      B: resolvedCorrect === 'B' ? 5 : 0,
      C: resolvedCorrect === 'C' ? 5 : 0,
      D: resolvedCorrect === 'D' ? 5 : 0,
      E: resolvedCorrect === 'E' ? 5 : 0,
    },
    rubricRationale,
  };
}

async function handlePostQuiz(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    throw new ApiError('Body JSON tidak valid', 400, 'INVALID_JSON');
  }

  const payload = quizPostSchema.parse(rawBody);

  const authUserId = await resolveOptionalUserId('POST /api/quiz');
  const guestId = authUserId ? null : await readVerifiedGuestId(request);

  if (payload.action === 'grade') {
    const [row] = await db
      .select({
        quiz: quizAttempts,
        chatTitle: conversations.title,
        chatUserId: conversations.userId,
        isGuestChat: conversations.isGuestChat,
        chatGuestSessionId: conversations.guestSessionId,
        expiresAt: conversations.expiresAt,
      })
      .from(quizAttempts)
      .innerJoin(conversations, eq(quizAttempts.chatId, conversations.id))
      .where(eq(quizAttempts.id, payload.quizAttemptId))
      .limit(1);

    if (!row) {
      throw new ApiError('Soal kuis tidak ditemukan', 404, 'QUIZ_NOT_FOUND');
    }

    if (row.chatUserId && row.chatUserId !== authUserId) {
      throw new ApiError(
        'Anda tidak memiliki akses ke kuis chat ini',
        403,
        'CHAT_ACCESS_DENIED'
      );
    }

    if (!row.chatUserId && !row.isGuestChat) {
      throw new ApiError(
        'Anda tidak memiliki akses ke kuis chat ini',
        403,
        'CHAT_ACCESS_DENIED'
      );
    }

    if (
      row.isGuestChat &&
      row.chatGuestSessionId &&
      row.chatGuestSessionId !== guestId
    ) {
      throw new ApiError(
        'Anda tidak memiliki akses ke kuis chat ini',
        403,
        'CHAT_ACCESS_DENIED'
      );
    }

    if (row.isGuestChat && row.expiresAt && new Date() > row.expiresAt) {
      throw new ApiError(
        'Sesi kuis tamu telah kedaluwarsa',
        410,
        'CHAT_EXPIRED'
      );
    }

    if (row.quiz.status === 'answered') {
      return NextResponse.json({
        success: true,
        data: {
          quiz: sanitizeQuizAttempt(row.quiz, row.chatTitle),
          alreadyAnswered: true,
        },
      });
    }

    const rubric = row.quiz.scoringRubric as Record<string, number> | null;
    const scoreEarned =
      typeof rubric?.[payload.selectedOption] === 'number'
        ? rubric[payload.selectedOption]
        : payload.selectedOption === row.quiz.correctOption
          ? 5
          : 0;

    const [updatedQuiz] = await db
      .update(quizAttempts)
      .set({
        userAnswer: payload.selectedOption,
        scoreEarned,
        status: 'answered',
        answeredAt: new Date(),
      })
      .where(
        and(
          eq(quizAttempts.id, row.quiz.id),
          eq(quizAttempts.status, 'pending')
        )
      )
      .returning();

    if (!updatedQuiz) {
      const [latestQuiz] = await db
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.id, row.quiz.id))
        .limit(1);

      if (!latestQuiz) {
        throw new ApiError('Soal kuis tidak ditemukan', 404, 'QUIZ_NOT_FOUND');
      }

      return NextResponse.json({
        success: true,
        data: {
          quiz: sanitizeQuizAttempt(latestQuiz, row.chatTitle),
          alreadyAnswered: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        quiz: sanitizeQuizAttempt(updatedQuiz, row.chatTitle),
        alreadyAnswered: false,
      },
    });
  }

  // Branch: action === 'next'
  const conversationId = payload.chatId ?? null;
  let chatTitle = payload.category
    ? `Latihan ${payload.category}`
    : 'Latihan SKD Interaktif';

  if (conversationId) {
    const [existingChat] = await db
      .select({
        id: conversations.id,
        userId: conversations.userId,
        title: conversations.title,
        isGuestChat: conversations.isGuestChat,
        guestSessionId: conversations.guestSessionId,
        expiresAt: conversations.expiresAt,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!existingChat) {
      throw new ApiError('Chat tidak ditemukan', 404, 'CHAT_NOT_FOUND');
    }

    if (existingChat.userId && existingChat.userId !== authUserId) {
      throw new ApiError(
        'Anda tidak memiliki akses ke chat ini',
        403,
        'CHAT_ACCESS_DENIED'
      );
    }

    if (!existingChat.userId && !existingChat.isGuestChat) {
      throw new ApiError(
        'Akses ditolak ke chat pengguna terdaftar',
        403,
        'CHAT_ACCESS_DENIED'
      );
    }

    if (
      existingChat.isGuestChat &&
      existingChat.guestSessionId &&
      existingChat.guestSessionId !== guestId
    ) {
      throw new ApiError(
        'Anda tidak memiliki akses ke chat ini',
        403,
        'CHAT_ACCESS_DENIED'
      );
    }

    if (
      existingChat.isGuestChat &&
      existingChat.expiresAt &&
      new Date() > existingChat.expiresAt
    ) {
      throw new ApiError(
        'Chat sementara telah kedaluwarsa',
        410,
        'CHAT_EXPIRED'
      );
    }

    chatTitle = existingChat.title || chatTitle;
  }

  const [chatQuizzes, userQuizzes] = await Promise.all([
    conversationId
      ? db
          .select({
            ragSourceId: quizAttempts.ragSourceId,
            questionId: quizAttempts.questionId,
          })
          .from(quizAttempts)
          .where(eq(quizAttempts.chatId, conversationId))
      : Promise.resolve(
          [] as { ragSourceId: string | null; questionId: string | null }[]
        ),
    authUserId
      ? db
          .select({
            ragSourceId: quizAttempts.ragSourceId,
            questionId: quizAttempts.questionId,
          })
          .from(quizAttempts)
          .where(eq(quizAttempts.userId, authUserId))
      : Promise.resolve(
          [] as { ragSourceId: string | null; questionId: string | null }[]
        ),
  ]);

  const attemptedSourceSet = new Set<string>();
  const attemptedQuestionIdSet = new Set<string>();
  for (const q of [...chatQuizzes, ...userQuizzes]) {
    if (q.ragSourceId) attemptedSourceSet.add(q.ragSourceId);
    if (q.questionId) attemptedQuestionIdSet.add(q.questionId);
  }
  const attemptedSourceIds = Array.from(attemptedSourceSet);

  let quizMeta: SkdQuizMetadata | null = null;
  let chosenQuestionId: string | null = null;
  let resolvedSubtopicFilter = payload.subtopic;

  if (payload.materialSlug) {
    const [material] = await db
      .select({
        id: studyMaterials.id,
        title: studyMaterials.title,
        subtopic: studyMaterials.subtopic,
      })
      .from(studyMaterials)
      .where(
        and(
          eq(studyMaterials.slug, payload.materialSlug),
          eq(studyMaterials.category, 'TWK')
        )
      )
      .limit(1);

    if (!material) {
      throw new ApiError(
        'Materi TWK tidak ditemukan',
        404,
        'MATERIAL_NOT_FOUND'
      );
    }

    if (!conversationId) {
      chatTitle = `Latihan TWK: ${material.title}`;
    }
    resolvedSubtopicFilter = resolvedSubtopicFilter || material.subtopic;

    const linkedRows = await db
      .select({ question: quizQuestions })
      .from(quizQuestions)
      .innerJoin(
        quizQuestionMaterials,
        eq(quizQuestions.id, quizQuestionMaterials.questionId)
      )
      .where(
        and(
          eq(quizQuestionMaterials.materialId, material.id),
          eq(quizQuestions.isValidated, true)
        )
      );

    let pool = linkedRows.map((r) => r.question);
    if (pool.length === 0) {
      pool = await db
        .select()
        .from(quizQuestions)
        .where(
          and(
            eq(quizQuestions.category, 'TWK'),
            eq(quizQuestions.subtopic, material.subtopic),
            eq(quizQuestions.isValidated, true)
          )
        );
    }

    if (pool.length > 0) {
      const unattemptedPool = pool.filter(
        (q) => !attemptedSourceSet.has(q.slug) && !attemptedQuestionIdSet.has(q.id)
      );
      const candidates = unattemptedPool.length > 0 ? unattemptedPool : pool;
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];

      chosenQuestionId = chosen.id;
      quizMeta = buildQuizMetaFromQuestionRow(chosen);
    }
  }

  if (!quizMeta) {
    // Zero-Gemini direct DB bank lookup before falling back to RAG/Gemini
    const directConditions = [eq(quizQuestions.isValidated, true)];
    if (payload.category) {
      directConditions.push(eq(quizQuestions.category, payload.category));
    }
    if (resolvedSubtopicFilter) {
      directConditions.push(eq(quizQuestions.subtopic, resolvedSubtopicFilter));
    }
    if (attemptedSourceIds.length > 0) {
      directConditions.push(
        notInArray(quizQuestions.slug, attemptedSourceIds)
      );
    }
    const attemptedQuestionIds = Array.from(attemptedQuestionIdSet);
    if (attemptedQuestionIds.length > 0) {
      directConditions.push(
        notInArray(quizQuestions.id, attemptedQuestionIds)
      );
    }

    const directPool = await db
      .select()
      .from(quizQuestions)
      .where(and(...directConditions))
      .limit(60);

    if (directPool.length > 0) {
      const chosen = directPool[Math.floor(Math.random() * directPool.length)];
      chosenQuestionId = chosen.id;
      quizMeta = buildQuizMetaFromQuestionRow(chosen);
    }
  }

  if (!quizMeta) {
    const retrievalQuery = `Berikan 1 soal latihan ${payload.category || 'SKD'} HOTS ${resolvedSubtopicFilter || ''}`.trim();
    const ragResult = await findRelevantContents(retrievalQuery, {
      attemptedSourceIds,
    });

    quizMeta = ragResult.unattemptedBenchmark;

    if (!quizMeta) {
      let generatedText = '';
      for await (const chunk of generateAiResponse(retrievalQuery, { ragResult })) {
        generatedText += chunk;
      }
      quizMeta = extractQuizMetaFromText(generatedText).quizMeta;
    }
  }

  if (!quizMeta) {
    throw new ApiError(
      'Gagal membuat soal baru. Silakan coba lagi.',
      502,
      'QUIZ_GENERATION_FAILED'
    );
  }

  const resolvedQuizMeta = quizMeta;
  let newGuestSessionId: string | null = null;
  let newGuestSetCookie: string | null = null;
  if (!conversationId && !authUserId) {
    const guest = await getOrCreateGuestSession(request);
    newGuestSessionId = guest.guestId;
    newGuestSetCookie = guest.setCookieHeader;
  }

  const { created, finalChatId, finalChatTitle } = await db.transaction(
    async (tx) => {
      let finalChatId: string;
      let finalChatTitle: string;

      if (!conversationId) {
        if (authUserId) {
          const [newChat] = await tx
            .insert(conversations)
            .values({
              userId: authUserId,
              title: chatTitle,
              createdAt: new Date(),
              isGuestChat: false,
            })
            .returning({ id: conversations.id, title: conversations.title });
          finalChatId = newChat.id;
          finalChatTitle = newChat.title || chatTitle;
        } else {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 1);

          const [newGuestChat] = await tx
            .insert(conversations)
            .values({
              userId: null,
              title: chatTitle,
              createdAt: new Date(),
              isGuestChat: true,
              guestSessionId: newGuestSessionId,
              expiresAt,
            })
            .returning({ id: conversations.id, title: conversations.title });
          finalChatId = newGuestChat.id;
          finalChatTitle = newGuestChat.title || chatTitle;
        }
      } else {
        finalChatId = conversationId;
        finalChatTitle = chatTitle;
      }

      const [created] = await tx
        .insert(quizAttempts)
        .values({
          chatId: finalChatId,
          questionId: chosenQuestionId,
          userId: authUserId ?? null,
          ragSourceId: resolvedQuizMeta.ragSourceId
            ? String(resolvedQuizMeta.ragSourceId).slice(0, 255)
            : null,
          category: resolvedQuizMeta.category,
          subtopic: resolvedQuizMeta.subtopic,
          questionStem: resolvedQuizMeta.questionStem,
          imageUrl: resolvedQuizMeta.imageUrl ?? null,
          options: resolvedQuizMeta.options,
          correctOption: resolvedQuizMeta.correctOption,
          scoringRubric: resolvedQuizMeta.scoringRubric,
          rubricRationale: resolvedQuizMeta.rubricRationale,
          maxScore: 5,
          status: 'pending',
        })
        .returning();

      if (payload.insertChatMarker) {
        await tx.insert(messages).values({
          chatId: finalChatId,
          role: 'bot',
          content: `<!--QUIZ_ATTEMPT:${created.id}-->`,
          createdAt: new Date(),
        });
      }

      return { created, finalChatId, finalChatTitle };
    }
  );

  const response = NextResponse.json({
    success: true,
    data: {
      quiz: sanitizeQuizAttempt(created, finalChatTitle),
      chatId: finalChatId,
    },
  });

  return attachGuestCookie(response, newGuestSetCookie);
}

const quizRateLimit = createRateLimitMiddleware({
  prefix: 'quiz',
  windowMs: 60_000,
  max: 60,
  guestMax: 60,
});

export const GET = (request: NextRequest) =>
  withMiddleware(quizRateLimit)(request, handleGetQuizzes);

export const POST = (request: NextRequest) =>
  withMiddleware(quizRateLimit)(request, handlePostQuiz);
