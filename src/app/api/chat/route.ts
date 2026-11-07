import { db, ensureDatabaseSchema } from "@/lib/db";
import { conversations, messages, quizAttempts } from "@/lib/db/schema";
import { findRelevantContents } from "@/lib/services/ai/rag.service";
import {
  ApiError,
  withMiddleware,
  createRateLimitMiddleware,
} from "@/middleware/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";
import {
  generateAiResponse,
  generateChatTitle,
  extractQuizMetaFromText,
  ChatHistoryTurn,
  LockedQuizEvaluation,
} from "@/lib/services/ai/gemini.service";

const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(4000, "Message is too long")
    .trim(),
  chatId: (typeof (z as any).uuid === "function"
    ? (z as any).uuid("Invalid chat ID format")
    : z.string().uuid("Invalid chat ID format")
  ).optional(),
  quizAttemptId: (typeof (z as any).uuid === "function"
    ? (z as any).uuid("Invalid quiz attempt ID format")
    : z.string().uuid("Invalid quiz attempt ID format")
  ).optional(),
});

function isValidUuid(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    val
  );
}

function parseQuizOptionChoice(
  message: string,
  hasExplicitQuizId: boolean
): "A" | "B" | "C" | "D" | "E" | null {
  const trimmed = message.trim();

  if (hasExplicitQuizId) {
    const wordMatch = trimmed.match(/\b([A-Ea-e])\b/i);
    if (wordMatch && wordMatch[1]) {
      const char = wordMatch[1].toUpperCase();
      if (["A", "B", "C", "D", "E"].includes(char)) {
        return char as "A" | "B" | "C" | "D" | "E";
      }
    }
    const startMatch = trimmed.match(/^\s*([A-Ea-e])/i);
    if (startMatch && startMatch[1]) {
      const char = startMatch[1].toUpperCase();
      if (["A", "B", "C", "D", "E"].includes(char)) {
        return char as "A" | "B" | "C" | "D" | "E";
      }
    }
    return null;
  }

  // Exact letter or letter with punctuation: e.g. "A", "B.", "C)", "D!"
  const exactMatch = trimmed.match(/^\s*([A-Ea-e])[\.\)\s!]*$/);
  if (exactMatch && exactMatch[1]) {
    const char = exactMatch[1].toUpperCase();
    if (["A", "B", "C", "D", "E"].includes(char)) {
      return char as "A" | "B" | "C" | "D" | "E";
    }
  }

  // Answer prefix: e.g. "Jawaban saya: B", "Pilihan A", "Opsi C", "Jawab D", "Menurut saya E"
  const prefixMatch = trimmed.match(
    /^\s*(?:jawaban\s*(?:saya|ku|nya)?|pilih(?:an)?(?:\s*saya)?|opsi|jawab|menurut\s*saya)\s*[:=\-]?\s*([A-Ea-e])\b/i
  );
  if (prefixMatch && prefixMatch[1]) {
    const char = prefixMatch[1].toUpperCase();
    if (["A", "B", "C", "D", "E"].includes(char)) {
      return char as "A" | "B" | "C" | "D" | "E";
    }
  }

  // Exclude general question queries (e.g. containing '?' or starting with question words)
  if (
    trimmed.includes("?") ||
    /^\s*[A-Ea-e]\s*[:.,)]?\s*(?:bagaimana|apa|mengapa|kenapa|siapa|kapan|di mana|dimana|berapa)\b/i.test(
      trimmed
    )
  ) {
    return null;
  }

  // Letter followed by reasoning: e.g. "A karena...", "B - ini alasannya", "C: ..."
  // Require word boundary/whitespace, space around dashes, and avoid matching hyphenated terms like "E-KTP"
  const reasoningMatch = trimmed.match(
    /^\s*([A-Ea-e])(?:\s+(?:karena|sebab)\b|\s*[:.)]\s+|\s+[—\-]\s+)/i
  );
  if (reasoningMatch && reasoningMatch[1]) {
    const char = reasoningMatch[1].toUpperCase();
    if (["A", "B", "C", "D", "E"].includes(char)) {
      return char as "A" | "B" | "C" | "D" | "E";
    }
  }

  return null;
}

async function handleChatPost(request: NextRequest) {
  await ensureDatabaseSchema();

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
      console.error("Error retrieving session in handleChatPost:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      const messageLower = error.message.toLowerCase();
      const isAuthError =
        error.name === "AuthError" ||
        messageLower.includes("auth") ||
        messageLower.includes("credential") ||
        messageLower.includes("unauthorized") ||
        messageLower.includes("forbidden");

      if (!isAuthError) {
        throw new ApiError(
          "Failed to retrieve session",
          500,
          "SESSION_RETRIEVAL_ERROR"
        );
      }

      console.warn(
        "Proceeding as guest user due to authentication-related session error."
      );
    } else {
      console.error(
        "Non-Error value thrown during session retrieval in handleChatPost:",
        error
      );
      throw new ApiError(
        "Failed to retrieve session",
        500,
        "SESSION_RETRIEVAL_ERROR"
      );
    }
  }

  let conversationId = chatId;

  // Manage conversation for authenticated vs guest user
  if (userId) {
    try {
      if (!conversationId) {
        const title = await generateChatTitle(message);
        const [newChat] = await db
          .insert(conversations)
          .values({
            userId: userId,
            title: title || "New Chat",
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
          throw new ApiError("Chat tidak ditemukan", 404, "CHAT_NOT_FOUND");
        }
        if (existingChat.userId !== userId) {
          throw new ApiError(
            "Anda tidak memiliki akses ke chat ini",
            403,
            "CHAT_ACCESS_DENIED"
          );
        }
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error("Database error for authenticated user:", error);
      throw new ApiError("Failed to save message", 500);
    }
  } else {
    try {
      if (!conversationId) {
        const title = await generateChatTitle(message);
        const guestSessionId = `guest_${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 1);

        const [newGuestChat] = await db
          .insert(conversations)
          .values({
            userId: null,
            title: title || "Guest Chat",
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
          throw new ApiError("Chat tidak ditemukan", 404, "CHAT_NOT_FOUND");
        }
        if (!existingChat.isGuestChat) {
          throw new ApiError(
            "Akses ditolak ke chat pengguna terdaftar",
            403,
            "CHAT_ACCESS_DENIED"
          );
        }
        if (existingChat.expiresAt && new Date() > existingChat.expiresAt) {
          throw new ApiError(
            "Chat sementara telah kedaluwarsa",
            410,
            "CHAT_EXPIRED"
          );
        }
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error("Database error for guest user:", error);
      throw new ApiError("Failed to save guest message", 500);
    }
  }

  // 1. Load multi-turn conversation history before inserting the new user message
  const recentDbMessages = await db
    .select({
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.chatId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(16);

  recentDbMessages.reverse();

  const history: ChatHistoryTurn[] = recentDbMessages.map((msg) => ({
    role: msg.role === "user" ? "user" : "bot",
    content: msg.content,
  }));

  // Insert the current user message into database
  await db.insert(messages).values({
    chatId: conversationId,
    role: "user",
    content: message,
    createdAt: new Date(),
  });

  // 2. Query quiz state for this conversation
  const chatQuizzes = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.chatId, conversationId))
    .orderBy(desc(quizAttempts.createdAt));

  let pendingQuiz: (typeof quizAttempts.$inferSelect) | null = null;
  if (quizAttemptId) {
    pendingQuiz = chatQuizzes.find((q) => q.id === quizAttemptId) || null;
  } else {
    pendingQuiz = chatQuizzes.find((q) => q.status === "pending") || null;
  }

  const attemptedSourceSet = new Set<string>();
  for (const q of chatQuizzes) {
    if (q.ragSourceId) {
      attemptedSourceSet.add(q.ragSourceId);
    }
  }

  if (userId) {
    const userQuizzes = await db
      .select({ ragSourceId: quizAttempts.ragSourceId })
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId));

    for (const q of userQuizzes) {
      if (q.ragSourceId) {
        attemptedSourceSet.add(q.ragSourceId);
      }
    }
  }

  const attemptedSourceIds = Array.from(attemptedSourceSet);

  // 3. Detect Turn-2 Quiz Answer Submission
  const hasExplicitQuizId = Boolean(quizAttemptId);
  const selectedOption =
    pendingQuiz && pendingQuiz.status === "pending"
      ? parseQuizOptionChoice(message, hasExplicitQuizId)
      : null;

  const isAnsweringPendingQuiz = Boolean(
    pendingQuiz && pendingQuiz.status === "pending" && selectedOption !== null
  );

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        if (isAnsweringPendingQuiz && pendingQuiz && selectedOption) {
          // ==================== TURN 2: ANSWER EVALUATION ====================
          const rubric = pendingQuiz.scoringRubric as Record<string, number>;
          const scoreEarned =
            typeof rubric?.[selectedOption] === "number"
              ? rubric[selectedOption]
              : selectedOption === pendingQuiz.correctOption
              ? 5
              : 0;

          const lockedQuizEvaluation: LockedQuizEvaluation = {
            quizId: pendingQuiz.id,
            category: pendingQuiz.category as "TWK" | "TIU" | "TKP",
            subtopic: pendingQuiz.subtopic,
            questionStem: pendingQuiz.questionStem,
            options: pendingQuiz.options,
            correctOption: pendingQuiz.correctOption as
              | "A"
              | "B"
              | "C"
              | "D"
              | "E",
            scoringRubric: pendingQuiz.scoringRubric,
            rubricRationale: pendingQuiz.rubricRationale,
            userAnswer: selectedOption,
            scoreEarned,
            maxScore: pendingQuiz.maxScore ?? 5,
          };

          const generator = generateAiResponse(message, {
            history,
            lockedQuizEvaluation,
          });

          let fullAiResponse = "";
          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(chunk));
            fullAiResponse += chunk;
          }

          const { visibleText } = extractQuizMetaFromText(fullAiResponse);

          await db
            .update(quizAttempts)
            .set({
              userAnswer: selectedOption,
              scoreEarned,
              aiExplanation: visibleText,
              status: "answered",
              answeredAt: new Date(),
            })
            .where(eq(quizAttempts.id, pendingQuiz.id));

          const evalMarker = `\n\n<!--QUIZ_EVAL:${pendingQuiz.id}:${selectedOption}:${scoreEarned}-->`;
          controller.enqueue(encoder.encode(evalMarker));

          const finalBotContent = `${visibleText}${evalMarker}`;
          await db.insert(messages).values({
            chatId: conversationId,
            role: "bot",
            content: finalBotContent,
            createdAt: new Date(),
          });

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

          let rawAccumulated = "";
          let streamedLength = 0;

          for await (const chunk of generator) {
            rawAccumulated += chunk;
            const metaIdx = rawAccumulated.indexOf("<quiz_meta");

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
              const lastLtIdx = tail.lastIndexOf("<");
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

          if (visibleText.length > streamedLength) {
            controller.enqueue(
              encoder.encode(visibleText.slice(streamedLength))
            );
            streamedLength = visibleText.length;
          }

          let finalBotContent = visibleText;

          if (quizMeta) {
            if (
              ragResult.unattemptedBenchmark?.ragSourceId &&
              !quizMeta.ragSourceId
            ) {
              quizMeta.ragSourceId =
                ragResult.unattemptedBenchmark.ragSourceId;
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
                status: "pending",
              })
              .returning();

            const attemptMarker = `\n\n<!--QUIZ_ATTEMPT:${insertedQuiz.id}-->`;
            controller.enqueue(encoder.encode(attemptMarker));
            finalBotContent = `${visibleText}${attemptMarker}`;
          }

          await db.insert(messages).values({
            chatId: conversationId,
            role: "bot",
            content: finalBotContent,
            createdAt: new Date(),
          });

          controller.close();
        }
      } catch (streamError) {
        console.error("Streaming error in chat route:", streamError);
        controller.error(streamError);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Chat-Id": conversationId || "",
    },
  });
}

export const POST = (request: NextRequest) =>
  withMiddleware(
    createRateLimitMiddleware(30, 60000)
  )(request, handleChatPost);
