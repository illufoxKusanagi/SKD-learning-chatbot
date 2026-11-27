import type { QuizAttemptItem } from "@/hooks/use-chat";
import type { PracticeQuestionItem } from "@/lib/services/practice.service";

export const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;
export type QuizOptionKey = (typeof OPTION_KEYS)[number];
export type QuizCategory = "TWK" | "TIU" | "TKP";

export interface PracticeAnswerState {
  selectedOption: QuizOptionKey;
  scoreEarned: number;
  usedHint: boolean;
  timeSpentSeconds: number;
  syncStatus: "synced" | "syncing" | "failed";
}

export function getBestOptionKey(
  correctOption: QuizOptionKey | null,
  scoringRubric: Record<QuizOptionKey, number> | null
): QuizOptionKey | null {
  if (correctOption) return correctOption;
  if (!scoringRubric) return null;
  for (const key of OPTION_KEYS) {
    if (scoringRubric[key] === 5) return key;
  }
  return null;
}

export function practiceItemToQuizAttempt(
  item: PracticeQuestionItem,
  answer?: PracticeAnswerState,
  sessionId?: string | null
): QuizAttemptItem {
  const isAnswered = Boolean(answer);
  const resolvedCorrect = isAnswered
    ? getBestOptionKey(item.correctOption, item.scoringRubric)
    : null;

  return {
    id: item.id,
    chatId: sessionId || "",
    questionId: item.id,
    ragSourceId: item.slug,
    category: item.category,
    subtopic: item.subtopic,
    questionStem: item.stem,
    imageUrl: item.imageUrl ?? null,
    options: item.options,
    correctOption: resolvedCorrect,
    scoringRubric: isAnswered ? item.scoringRubric : null,
    rubricRationale: null,
    userAnswer: answer?.selectedOption ?? null,
    scoreEarned: answer?.scoreEarned ?? null,
    maxScore: 5,
    aiExplanation: null,
    status: isAnswered ? "answered" : "pending",
    createdAt: new Date(0).toISOString(),
    answeredAt: isAnswered ? new Date().toISOString() : null,
  };
}

export interface ChatStreamErrorPayload {
  code: string;
  title: string;
  message: string;
}

export function parseMessageQuizMarkers(content: string) {
  let attemptId: string | null = null;
  let evalQuizId: string | null = null;
  let evalOption: QuizOptionKey | null = null;
  let evalScore: number | null = null;
  let chatError: ChatStreamErrorPayload | null = null;

  const attemptMatch = content.match(/<!--QUIZ_ATTEMPT:([a-f0-9-]+)-->/i);
  if (attemptMatch?.[1]) {
    attemptId = attemptMatch[1];
  }

  const evalMatch = content.match(
    /<!--QUIZ_EVAL:([a-f0-9-]+):([A-E]):(\d+)-->/i
  );
  if (evalMatch) {
    evalQuizId = evalMatch[1];
    evalOption = evalMatch[2].toUpperCase() as QuizOptionKey;
    evalScore = parseInt(evalMatch[3], 10);
  }

  const errorMatch = content.match(/<!--CHAT_ERROR:([\s\S]*?)-->/i);
  if (errorMatch?.[1]) {
    try {
      const parsed = JSON.parse(errorMatch[1].trim());
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.title === "string" &&
        typeof parsed.message === "string"
      ) {
        chatError = {
          code: typeof parsed.code === "string" ? parsed.code : "AI_STREAM_ERROR",
          title: parsed.title,
          message: parsed.message,
        };
      }
    } catch {
      chatError = {
        code: "AI_STREAM_ERROR",
        title: "Gagal Memuat Respons Tutor AI",
        message: "Terjadi gangguan koneksi ke server AI. Silakan klik Coba Lagi.",
      };
    }
  }

  const cleanContent = content
    .replace(/<!--QUIZ_ATTEMPT:[^>]+-->/gi, "")
    .replace(/<!--QUIZ_EVAL:[^>]+-->/gi, "")
    .replace(/<!--CHAT_ERROR:[\s\S]*?-->/gi, "")
    .trim();

  return {
    cleanContent,
    attemptId,
    evalQuizId,
    evalOption,
    evalScore,
    quizId: attemptId || evalQuizId,
    chatError,
  };
}

/**
 * Strips duplicate question stems and A-E option lists from bot Markdown
 * when an interactive QuizCard is rendered for the message, preserving only
 * genuine conversational lead-in text.
 */
export function stripRedundantQuizMarkdown(
  cleanContent: string,
  hasAttemptMarker: boolean
): string {
  if (!hasAttemptMarker || !cleanContent) {
    return cleanContent;
  }

  const headingIdx = cleanContent.search(/^#{1,6}\s*📝?\s*Latihan Soal\b/im);
  if (headingIdx === 0) {
    return "";
  }
  if (headingIdx > 0) {
    return cleanContent.slice(0, headingIdx).trim();
  }

  const firstOptionIdx = cleanContent.search(/^A\.\s+/m);
  if (firstOptionIdx >= 0) {
    const beforeOptions = cleanContent.slice(0, firstOptionIdx).trim();
    const lines = beforeOptions.split("\n");
    if (lines.length <= 2) {
      return "";
    }
    return lines.slice(0, -1).join("\n").trim();
  }

  return cleanContent;
}

export interface CategorySummary {
  total: number;
  answered: number;
  scoreEarned: number;
  maxScore: number;
  optimalCount: number;
}

export interface WeakSubtopicSummary {
  category: QuizCategory;
  subtopic: string;
  earned: number;
  max: number;
  accuracyPercent: number;
}

export interface QuizSessionSummary {
  total: number;
  answered: number;
  pending: number;
  scoreEarned: number;
  maxScore: number;
  accuracyPercent: number;
  wrongOrSuboptimalIndices: number[];
  weakSubtopics: WeakSubtopicSummary[];
  byCategory: Record<QuizCategory, CategorySummary>;
}

export function computeQuizSessionSummary(
  quizzes: QuizAttemptItem[]
): QuizSessionSummary {
  const byCategory: Record<QuizCategory, CategorySummary> = {
    TWK: { total: 0, answered: 0, scoreEarned: 0, maxScore: 0, optimalCount: 0 },
    TIU: { total: 0, answered: 0, scoreEarned: 0, maxScore: 0, optimalCount: 0 },
    TKP: { total: 0, answered: 0, scoreEarned: 0, maxScore: 0, optimalCount: 0 },
  };
  const subtopicBuckets = new Map<
    string,
    { category: QuizCategory; subtopic: string; earned: number; max: number }
  >();

  let answered = 0;
  let scoreEarned = 0;
  let maxScore = 0;
  const wrongOrSuboptimalIndices: number[] = [];

  quizzes.forEach((quiz, index) => {
    const cat = quiz.category;
    const catStats = byCategory[cat];
    if (catStats) {
      catStats.total += 1;
    }

    if (quiz.status === "answered") {
      answered += 1;
      const earned = quiz.scoreEarned ?? 0;
      const max = quiz.maxScore ?? 5;
      scoreEarned += earned;
      maxScore += max;

      if (catStats) {
        catStats.answered += 1;
        catStats.scoreEarned += earned;
        catStats.maxScore += max;
        if (earned >= max) {
          catStats.optimalCount += 1;
        }
      }

      if (quiz.subtopic) {
        const key = `${cat}::${quiz.subtopic}`;
        const bucket = subtopicBuckets.get(key);
        if (bucket) {
          bucket.earned += earned;
          bucket.max += max;
        } else {
          subtopicBuckets.set(key, {
            category: cat,
            subtopic: quiz.subtopic,
            earned,
            max,
          });
        }
      }

      if (earned < max) {
        wrongOrSuboptimalIndices.push(index);
      }
    }
  });

  const weakSubtopics: WeakSubtopicSummary[] = Array.from(subtopicBuckets.values())
    .map((bucket) => ({
      ...bucket,
      accuracyPercent:
        bucket.max > 0 ? Math.round((bucket.earned / bucket.max) * 100) : 0,
    }))
    .filter((entry) => entry.max > 0 && entry.earned / entry.max < 0.7)
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent);

  const accuracyPercent =
    maxScore > 0 ? Math.round((scoreEarned / maxScore) * 100) : 0;

  return {
    total: quizzes.length,
    answered,
    pending: quizzes.length - answered,
    scoreEarned,
    maxScore,
    accuracyPercent,
    wrongOrSuboptimalIndices,
    weakSubtopics,
    byCategory,
  };
}
