import { db } from '@/lib/db';
import { conversations, messages, quizAttempts } from '@/lib/db/schema';
import { findRelevantContents } from '@/lib/services/ai/rag.service';
import {
  ApiError,
  withMiddleware,
  createRateLimitMiddleware,
} from '@/middleware/api';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { eq, desc, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import {
  generateAiResponse,
  generateChatTitle,
  extractQuizMetaFromText,
  ChatHistoryTurn,
  LockedQuizEvaluation,
} from '@/lib/services/ai/gemini.service';

const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message is too long')
    .trim(),
  chatId: z.string().uuid('Invalid chat ID format').optional(),
  quizAttemptId: z.string().uuid('Invalid quiz attempt ID format').optional(),
});

type QuizOption = 'A' | 'B' | 'C' | 'D' | 'E';

function parseQuizOptionChoice(
  message: string,
  hasExplicitQuizId: boolean
): QuizOption | null {
  const trimmed = message.trim();

  if (hasExplicitQuizId) {
    const match = trimmed.match(/\b([A-E])\b/i) ?? trimmed.match(/^([A-E])/i);
    return match ? (match[1].toUpperCase() as QuizOption) : null;
  }

  if (
    trimmed.includes('?') ||
    /^[A-E]\s*[:.,)]?\s*(?:bagaimana|apa|mengapa|kenapa|siapa|kapan|di\s*mana|berapa)\b/i.test(
      trimmed
    )
  ) {
    return null;
  }

  const match =
    trimmed.match(/^([A-E])[.)\s!]*$/i) ??
    trimmed.match(
      /^(?:jawaban(?:\s*(?:saya|ku|nya))?|pilih(?:an)?(?:\s*saya)?|opsi|jawab|menurut\s*saya)\s*[:=\-]?\s*([A-E])\b/i
    ) ??
    trimmed.match(
      /^([A-E])(?:\s+(?:karena|sebab)\b|\s*[:.)]\s+|\s+[—\-]\s+)/i
    );

  return match ? (match[1].toUpperCase() as QuizOption) : null;
}

async function persistGeneratedTitle(
  conversationId: string,
  titlePromise: Promise<string> | null
): Promise<void> {
  if (!titlePromise) return;
  try {
    const title = await titlePromise;
    if (title) {
      await db
        .update(conversations)
        .set({ title })
        .where(eq(conversations.id, conversationId));
    }
  } catch (error) {
    console.error('Failed to persist generated title:', error);
  }
}

async function handleChatPost(request: NextRequest) {
  const body = await request.json();
  const { message, chatId, quizAttemptId } = chatMessageSchema.parse(body);

  // Authenticate user session if available
  let userId: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      userId = session.user.id;
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error retrieving session in handleChatPost:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      const messageLower = error.message.toLowerCase();
      const isAuthError =
        error.name === 'AuthError' ||
        messageLower.includes('auth') ||
        messageLower.includes('credential') ||
        messageLower.includes('unauthorized') ||
        messageLower.includes('forbidden');

      if (!isAuthError) {
        throw new ApiError(
          'Failed to retrieve session',
          500,
          'SESSION_RETRIEVAL_ERROR'
        );
      }

      console.warn(
        'Proceeding as guest user due to authentication-related session error.'
      );
    } else {
      console.error(
        'Non-Error value thrown during session retrieval in handleChatPost:',
        error
      );
      throw new ApiError(
        'Failed to retrieve session',
        500,
        'SESSION_RETRIEVAL_ERROR'
      );
    }
  }

  let conversationId = chatId;
  let titlePromise: Promise<string> | null = null;

  // Manage conversation for authenticated vs guest user
  if (userId) {
    try {
      if (!conversationId) {
        titlePromise = generateChatTitle(message);
        const initialTitle =
          message.trim().replace(/\s+/g, ' ').slice(0, 40) || 'New Chat';
        const [newChat] = await db
          .insert(conversations)
          .values({
            userId: userId,
            title: initialTitle,
            createdAt: new Date(),
            isGuestChat: false,
          })
          .returning({ id: conversations.id });
        conversationId = newChat.id;
      } else {
        const [existingChat] = await db
          .select({ userId: conversations.userId })
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .limit(1);

        if (!existingChat) {
          throw new ApiError('Chat tidak ditemukan', 404, 'CHAT_NOT_FOUND');
        }
        if (existingChat.userId !== userId) {
          throw new ApiError(
            'Anda tidak memiliki akses ke chat ini',
            403,
            'CHAT_ACCESS_DENIED'
          );
        }
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error('Database error for authenticated user:', error);
      throw new ApiError('Failed to save message', 500);
    }
  } else {
    try {
      if (!conversationId) {
        titlePromise = generateChatTitle(message);
        const initialTitle =
          message.trim().replace(/\s+/g, ' ').slice(0, 40) || 'Guest Chat';
        const guestSessionId = `guest_${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 1);

        const [newGuestChat] = await db
          .insert(conversations)
          .values({
            userId: null,
            title: initialTitle,
            createdAt: new Date(),
            isGuestChat: true,
            guestSessionId: guestSessionId,
            expiresAt: expiresAt,
          })
          .returning({ id: conversations.id });
        conversationId = newGuestChat.id;
      } else {
        const [existingChat] = await db
          .select({
            isGuestChat: conversations.isGuestChat,
            expiresAt: conversations.expiresAt,
          })
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .limit(1);

        if (!existingChat) {
          throw new ApiError('Chat tidak ditemukan', 404, 'CHAT_NOT_FOUND');
        }
        if (!existingChat.isGuestChat) {
          throw new ApiError(
            'Akses ditolak ke chat pengguna terdaftar',
            403,
            'CHAT_ACCESS_DENIED'
          );
        }
        if (existingChat.expiresAt && new Date() > existingChat.expiresAt) {
          throw new ApiError(
            'Chat sementara telah kedaluwarsa',
            410,
            'CHAT_EXPIRED'
          );
        }
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error('Database error for guest user:', error);
      throw new ApiError('Failed to save guest message', 500);
    }
  }

  // 1. Parallelise independent reads: conversation history, conversation quizzes, and user quizzes
  const [recentDbMessages, chatQuizzes, userQuizzes] = await Promise.all([
    db
      .select({
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.chatId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(16),
    db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.chatId, conversationId))
      .orderBy(desc(quizAttempts.createdAt)),
    userId
      ? db
          .select({ ragSourceId: quizAttempts.ragSourceId })
          .from(quizAttempts)
          .where(eq(quizAttempts.userId, userId))
      : Promise.resolve([] as { ragSourceId: string | null }[]),
  ]);

  recentDbMessages.reverse();

  const history: ChatHistoryTurn[] = recentDbMessages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'bot',
    content: msg.content,
  }));

  // 2. Query quiz state for this conversation
  let pendingQuiz: typeof quizAttempts.$inferSelect | null = null;
  if (quizAttemptId) {
    pendingQuiz = chatQuizzes.find((q) => q.id === quizAttemptId) || null;
  } else {
    const lastBotMsg = [...recentDbMessages]
      .reverse()
      .find((m) => m.role === 'bot');
    const markerId = lastBotMsg?.content.match(
      /<!--QUIZ_ATTEMPT:([a-f0-9-]+)-->/i
    )?.[1];
    pendingQuiz = markerId
      ? chatQuizzes.find((q) => q.id === markerId && q.status === 'pending') ||
        null
      : null;
  }

  const attemptedSourceSet = new Set<string>();
  for (const q of chatQuizzes) {
    if (q.ragSourceId) {
      attemptedSourceSet.add(q.ragSourceId);
    }
  }

  for (const q of userQuizzes) {
    if (q.ragSourceId) {
      attemptedSourceSet.add(q.ragSourceId);
    }
  }

  const attemptedSourceIds = Array.from(attemptedSourceSet);

  // 3. Detect Turn-2 Quiz Answer Submission
  const hasExplicitQuizId = Boolean(quizAttemptId);
  const selectedOption =
    pendingQuiz && pendingQuiz.status === 'pending'
      ? parseQuizOptionChoice(message, hasExplicitQuizId)
      : null;

  const isAnsweringPendingQuiz = Boolean(
    pendingQuiz && pendingQuiz.status === 'pending' && selectedOption !== null
  );

  let lockedQuizEvaluation: LockedQuizEvaluation | null = null;
  let scoreEarned = 0;

  if (isAnsweringPendingQuiz && pendingQuiz && selectedOption) {
    const rubric = pendingQuiz.scoringRubric as Record<string, number>;
    scoreEarned =
      typeof rubric?.[selectedOption] === 'number'
        ? rubric[selectedOption]
        : selectedOption === pendingQuiz.correctOption
          ? 5
          : 0;

    const [locked] = await db
      .update(quizAttempts)
      .set({
        userAnswer: selectedOption,
        scoreEarned,
        status: 'answered',
        answeredAt: new Date(),
      })
      .where(
        and(
          eq(quizAttempts.id, pendingQuiz.id),
          eq(quizAttempts.status, 'pending')
        )
      )
      .returning({ id: quizAttempts.id });

    if (!locked) {
      throw new ApiError(
        'Soal ini sudah dijawab',
        409,
        'QUIZ_ALREADY_ANSWERED'
      );
    }

    lockedQuizEvaluation = {
      quizId: pendingQuiz.id,
      category: pendingQuiz.category as 'TWK' | 'TIU' | 'TKP',
      subtopic: pendingQuiz.subtopic,
      questionStem: pendingQuiz.questionStem,
      options: pendingQuiz.options,
      correctOption: pendingQuiz.correctOption as 'A' | 'B' | 'C' | 'D' | 'E',
      scoringRubric: pendingQuiz.scoringRubric,
      rubricRationale: pendingQuiz.rubricRationale,
      userAnswer: selectedOption,
      scoreEarned,
      maxScore: pendingQuiz.maxScore ?? 5,
    };
  }

  // Insert the current user message into database
  await db.insert(messages).values({
    chatId: conversationId,
    role: 'user',
    content: message,
    createdAt: new Date(),
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let explanationPersisted = false;

      try {
        if (
          isAnsweringPendingQuiz &&
          pendingQuiz &&
          selectedOption &&
          lockedQuizEvaluation
        ) {
          // ==================== TURN 2: ANSWER EVALUATION ====================
          const generator = generateAiResponse(message, {
            history,
            lockedQuizEvaluation,
          });

          let fullAiResponse = '';
          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(chunk));
            fullAiResponse += chunk;
          }

          const { visibleText } = extractQuizMetaFromText(fullAiResponse);

          await db
            .update(quizAttempts)
            .set({ aiExplanation: visibleText })
            .where(eq(quizAttempts.id, pendingQuiz.id));
          explanationPersisted = true;

          const evalMarker = `\n\n<!--QUIZ_EVAL:${pendingQuiz.id}:${selectedOption}:${scoreEarned}-->`;
          controller.enqueue(encoder.encode(evalMarker));

          const finalBotContent = `${visibleText}${evalMarker}`;
          await db.insert(messages).values({
            chatId: conversationId,
            role: 'bot',
            content: finalBotContent,
            createdAt: new Date(),
          });

          await persistGeneratedTitle(conversationId, titlePromise);

          controller.close();
        } else {
          // ==================== TURN 1: QUESTION OR DISCUSSION ====================
          const ragResult = await findRelevantContents(message, {
            history,
            attemptedSourceIds,
          });

          const generator = generateAiResponse(message, {
            history,
            ragResult,
          });

          let rawAccumulated = '';
          let streamedLength = 0;

          for await (const chunk of generator) {
            rawAccumulated += chunk;
            const metaIdx = rawAccumulated.indexOf('<quiz_meta');

            if (metaIdx !== -1) {
              if (metaIdx > streamedLength) {
                const sliceToSend = rawAccumulated.slice(
                  streamedLength,
                  metaIdx
                );
                controller.enqueue(encoder.encode(sliceToSend));
                streamedLength = metaIdx;
              }
              // Do NOT stream anything from metaIdx onward
            } else {
              // Hold back last 12 chars if containing '<' to avoid partial tag leaks
              const tail = rawAccumulated.slice(-12);
              const lastLtIdx = tail.lastIndexOf('<');
              if (lastLtIdx !== -1) {
                const safeBoundary =
                  rawAccumulated.length - (tail.length - lastLtIdx);
                if (safeBoundary > streamedLength) {
                  const sliceToSend = rawAccumulated.slice(
                    streamedLength,
                    safeBoundary
                  );
                  controller.enqueue(encoder.encode(sliceToSend));
                  streamedLength = safeBoundary;
                }
              } else {
                if (rawAccumulated.length > streamedLength) {
                  const sliceToSend = rawAccumulated.slice(streamedLength);
                  controller.enqueue(encoder.encode(sliceToSend));
                  streamedLength = rawAccumulated.length;
                }
              }
            }
          }

          const { visibleText, quizMeta } =
            extractQuizMetaFromText(rawAccumulated);

          const untrimmedVisible = rawAccumulated
            .replace(/<quiz_meta>[\s\S]*?<\/quiz_meta>/gi, '')
            .replace(/<quiz_meta>[\s\S]*$/gi, '');
          if (untrimmedVisible.length > streamedLength) {
            controller.enqueue(
              encoder.encode(untrimmedVisible.slice(streamedLength))
            );
            streamedLength = untrimmedVisible.length;
          }

          let finalBotContent = visibleText;

          if (quizMeta) {
            if (
              ragResult.unattemptedBenchmark?.ragSourceId &&
              !quizMeta.ragSourceId
            ) {
              quizMeta.ragSourceId = ragResult.unattemptedBenchmark.ragSourceId;
            }

            const [insertedQuiz] = await db
              .insert(quizAttempts)
              .values({
                chatId: conversationId,
                userId: userId ?? null,
                ragSourceId: quizMeta.ragSourceId
                  ? String(quizMeta.ragSourceId).slice(0, 255)
                  : null,
                category: quizMeta.category,
                subtopic: quizMeta.subtopic,
                questionStem: quizMeta.questionStem,
                options: quizMeta.options,
                correctOption: quizMeta.correctOption,
                scoringRubric: quizMeta.scoringRubric,
                rubricRationale: quizMeta.rubricRationale,
                maxScore: 5,
                status: 'pending',
              })
              .returning();

            const attemptMarker = `\n\n<!--QUIZ_ATTEMPT:${insertedQuiz.id}-->`;
            controller.enqueue(encoder.encode(attemptMarker));
            finalBotContent = `${visibleText}${attemptMarker}`;
          }

          await db.insert(messages).values({
            chatId: conversationId,
            role: 'bot',
            content: finalBotContent,
            createdAt: new Date(),
          });

          await persistGeneratedTitle(conversationId, titlePromise);

          controller.close();
        }
      } catch (streamError) {
        console.error('Streaming error in chat route:', streamError);
        if (isAnsweringPendingQuiz && pendingQuiz && !explanationPersisted) {
          await db
            .update(quizAttempts)
            .set({
              userAnswer: null,
              scoreEarned: null,
              aiExplanation: null,
              status: 'pending',
              answeredAt: null,
            })
            .where(eq(quizAttempts.id, pendingQuiz.id))
            .catch((rollbackErr) =>
              console.error('Failed to roll back quiz lock:', rollbackErr)
            );
        }
        controller.error(streamError);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Chat-Id': conversationId || '',
    },
  });
}

const chatRateLimit = createRateLimitMiddleware({
  prefix: 'chat',
  windowMs: 60_000,
  max: 15,
  guestMax: 8,
  daily: { max: 150, guestMax: 40 },
});

export const POST = (request: NextRequest) =>
  withMiddleware(chatRateLimit)(request, handleChatPost);
