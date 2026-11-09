import { db, ensureDatabaseSchema } from '@/lib/db';
import { conversations, quizAttempts } from '@/lib/db/schema';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { eq, and, or, inArray, desc } from 'drizzle-orm';
import {
  ApiError,
  withMiddleware,
  createRateLimitMiddleware,
} from '@/middleware/api';

function isValidUuid(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    val
  );
}

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
  await ensureDatabaseSchema();

  const url = new URL(request.url);
  const chatId = url.searchParams.get('chatId');
  const chatIdsParam = url.searchParams.get('chatIds');
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

  // Retrieve user session
  let authUserId: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      authUserId = session.user.id;
    }
  } catch (authErr) {
    console.warn('[GET /api/quiz] Session retrieval warning:', authErr);
  }

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

    rows = await db
      .select({
        quiz: quizAttempts,
        chatTitle: conversations.title,
      })
      .from(quizAttempts)
      .innerJoin(conversations, eq(quizAttempts.chatId, conversations.id))
      .where(eq(quizAttempts.chatId, chatId))
      .orderBy(desc(quizAttempts.createdAt));
  } else if (authUserId) {
    // 2. Authenticated user: fetch all quiz attempts for this user
    rows = await db
      .select({
        quiz: quizAttempts,
        chatTitle: conversations.title,
      })
      .from(quizAttempts)
      .innerJoin(conversations, eq(quizAttempts.chatId, conversations.id))
      .where(
        or(
          eq(quizAttempts.userId, authUserId),
          eq(conversations.userId, authUserId)
        )
      )
      .orderBy(desc(quizAttempts.createdAt));
  } else if (chatIds.length > 0) {
    // 3. Guest user multi-chat history: fetch attempts belonging to guest chats
    rows = await db
      .select({
        quiz: quizAttempts,
        chatTitle: conversations.title,
      })
      .from(quizAttempts)
      .innerJoin(conversations, eq(quizAttempts.chatId, conversations.id))
      .where(
        and(
          inArray(quizAttempts.chatId, chatIds),
          eq(conversations.isGuestChat, true)
        )
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
  const sanitizedQuizzes = filteredRows.map(({ quiz, chatTitle }) => {
    const isAnswered = quiz.status === 'answered';
    return {
      id: quiz.id,
      chatId: quiz.chatId,
      chatTitle: chatTitle || 'Sesi SKD',
      userId: quiz.userId,
      ragSourceId: quiz.ragSourceId,
      category: quiz.category,
      subtopic: quiz.subtopic,
      questionStem: quiz.questionStem,
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
  });

  return NextResponse.json({
    success: true,
    data: {
      quizzes: sanitizedQuizzes,
      stats,
    },
  });
}

const quizRateLimit = createRateLimitMiddleware(60, 60000);

export const GET = (request: NextRequest) =>
  withMiddleware(quizRateLimit)(request, handleGetQuizzes);
