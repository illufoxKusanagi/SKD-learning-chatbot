export type SkdCategory = "TWK" | "TIU" | "TKP";

export type OptionKey = "A" | "B" | "C" | "D" | "E";

export type TryoutMode = "cat_tryout" | "mini_tryout";

export const OFFICIAL_SKD_CONFIG = {
  TWK: { count: 30, passingGrade: 65, maxScore: 150 },
  TIU: { count: 35, passingGrade: 80, maxScore: 175 },
  TKP: { count: 45, passingGrade: 166, maxScore: 225 },
  totalQuestions: 110,
  durationSeconds: 6000,
  maxTotalScore: 550,
} as const;

export const MINI_TRYOUT_CONFIG = {
  TWK: { count: 8, passingGrade: 18, maxScore: 40 },
  TIU: { count: 10, passingGrade: 23, maxScore: 50 },
  TKP: { count: 12, passingGrade: 45, maxScore: 60 },
  totalQuestions: 30,
  durationSeconds: 1620,
  maxTotalScore: 150,
} as const;

export interface SingleScoreInput {
  category: SkdCategory;
  selectedOption: OptionKey | null | undefined;
  correctOption: OptionKey | null | undefined;
  scoringRubric: Record<OptionKey, number> | null | undefined;
}

export interface EvaluatedQuestionInput {
  category: SkdCategory;
  subtopic: string;
  scoreEarned: number;
  maxScore?: number;
  isAnswered?: boolean;
  timeSpentSeconds?: number;
}

export interface SubtestScoreBreakdown {
  questionCount: number;
  answeredCount: number;
  scoreEarned: number;
  maxScore: number;
  passingGrade: number;
  passed: boolean;
  timeSpentSeconds: number;
}

export interface CatScoreSummary {
  mode: TryoutMode;
  totalScoreEarned: number;
  maxTotalScore: number;
  passedOverall: boolean;
  verdict: "LULUS" | "TIDAK LULUS";
  totalTimeSpentSeconds: number;
  byCategory: Record<SkdCategory, SubtestScoreBreakdown>;
  weakSubtopics: Array<{
    category: SkdCategory;
    subtopic: string;
    earned: number;
    max: number;
    accuracyRatio: number;
  }>;
}

const VALID_OPTIONS = new Set<OptionKey>(["A", "B", "C", "D", "E"]);
const CATEGORIES: SkdCategory[] = ["TWK", "TIU", "TKP"];
const WEAK_SUBTOPIC_THRESHOLD = 0.7;

/**
 * Scores a single SKD CPNS question according to BKN rules:
 * - Unanswered: 0 (including TKP)
 * - TKP: graduated 1..5 from scoringRubric
 * - TWK / TIU: +5 when selectedOption matches correctOption, else 0
 */
export function scoreSingleQuestion(input: SingleScoreInput): number {
  if (!input.selectedOption) {
    return 0;
  }

  if (input.category === "TKP") {
    const score = input.scoringRubric?.[input.selectedOption];
    if (
      typeof score !== "number" ||
      !Number.isInteger(score) ||
      score < 1 ||
      score > 5
    ) {
      throw new Error(
        `Invalid TKP scoringRubric for option ${input.selectedOption}`
      );
    }
    return score;
  }

  if (!input.correctOption || !VALID_OPTIONS.has(input.correctOption)) {
    throw new Error(`Invalid correctOption for ${input.category}`);
  }

  return input.selectedOption === input.correctOption ? 5 : 0;
}

function createEmptyBreakdown(passingGrade: number): SubtestScoreBreakdown {
  return {
    questionCount: 0,
    answeredCount: 0,
    scoreEarned: 0,
    maxScore: 0,
    passingGrade,
    passed: false,
    timeSpentSeconds: 0,
  };
}

/**
 * Aggregates question-level scores into category breakdowns, passing-grade
 * verdicts, time spent, and weak subtopics for official or mini SKD tryouts.
 */
export function evaluateCatTryout(
  items: EvaluatedQuestionInput[],
  mode: TryoutMode = "cat_tryout"
): CatScoreSummary {
  const config = mode === "cat_tryout" ? OFFICIAL_SKD_CONFIG : MINI_TRYOUT_CONFIG;

  const byCategory: Record<SkdCategory, SubtestScoreBreakdown> = {
    TWK: createEmptyBreakdown(config.TWK.passingGrade),
    TIU: createEmptyBreakdown(config.TIU.passingGrade),
    TKP: createEmptyBreakdown(config.TKP.passingGrade),
  };

  const subtopicBuckets = new Map<
    string,
    { category: SkdCategory; subtopic: string; earned: number; max: number }
  >();

  for (const item of items) {
    const breakdown = byCategory[item.category];
    const itemMax = item.maxScore ?? 5;
    const isAnswered = item.isAnswered ?? item.scoreEarned > 0;
    const timeSpent = item.timeSpentSeconds ?? 0;

    breakdown.questionCount += 1;
    if (isAnswered) {
      breakdown.answeredCount += 1;
    }
    breakdown.scoreEarned += item.scoreEarned;
    breakdown.maxScore += itemMax;
    breakdown.timeSpentSeconds += timeSpent;

    const bucketKey = `${item.category}::${item.subtopic}`;
    const existing = subtopicBuckets.get(bucketKey);
    if (existing) {
      existing.earned += item.scoreEarned;
      existing.max += itemMax;
    } else {
      subtopicBuckets.set(bucketKey, {
        category: item.category,
        subtopic: item.subtopic,
        earned: item.scoreEarned,
        max: itemMax,
      });
    }
  }

  let totalScoreEarned = 0;
  let totalTimeSpentSeconds = 0;

  for (const cat of CATEGORIES) {
    const breakdown = byCategory[cat];
    breakdown.passed = breakdown.scoreEarned >= breakdown.passingGrade;
    totalScoreEarned += breakdown.scoreEarned;
    totalTimeSpentSeconds += breakdown.timeSpentSeconds;
  }

  const passedOverall =
    byCategory.TWK.passed && byCategory.TIU.passed && byCategory.TKP.passed;

  const weakSubtopics = Array.from(subtopicBuckets.values())
    .map((bucket) => ({
      ...bucket,
      accuracyRatio: bucket.max > 0 ? bucket.earned / bucket.max : 0,
    }))
    .filter((entry) => entry.accuracyRatio < WEAK_SUBTOPIC_THRESHOLD)
    .sort((a, b) => a.accuracyRatio - b.accuracyRatio);

  return {
    mode,
    totalScoreEarned,
    maxTotalScore: config.maxTotalScore,
    passedOverall,
    verdict: passedOverall ? "LULUS" : "TIDAK LULUS",
    totalTimeSpentSeconds,
    byCategory,
    weakSubtopics,
  };
}
