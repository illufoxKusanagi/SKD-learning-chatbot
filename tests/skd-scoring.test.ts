import { describe, expect, it } from "vitest";
import {
  MINI_TRYOUT_CONFIG,
  OFFICIAL_SKD_CONFIG,
  evaluateCatTryout,
  scoreSingleQuestion,
  type EvaluatedQuestionInput,
  type OptionKey,
} from "@/lib/scoring/skd-scoring";

const SAMPLE_TKP_RUBRIC: Record<OptionKey, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
};

function makeCategoryItems(
  category: "TWK" | "TIU" | "TKP",
  count: number,
  targetScore: number,
  subtopic = "General",
  timePerQuestion = 10
): EvaluatedQuestionInput[] {
  const items: EvaluatedQuestionInput[] = [];
  let remaining = targetScore;
  for (let i = 0; i < count; i++) {
    let earned = 0;
    if (category === "TKP") {
      earned = Math.min(5, remaining);
    } else {
      earned = remaining >= 5 ? 5 : 0;
    }
    remaining -= earned;
    items.push({
      category,
      subtopic,
      scoreEarned: earned,
      maxScore: 5,
      isAnswered: earned > 0,
      timeSpentSeconds: timePerQuestion,
    });
  }
  if (remaining !== 0) {
    throw new Error(`Cannot distribute ${targetScore} across ${count} ${category} items`);
  }
  return items;
}

describe("scoreSingleQuestion", () => {
  it("scores TWK and TIU with +5 for correct, 0 for wrong, and 0 for unanswered", () => {
    expect(
      scoreSingleQuestion({
        category: "TWK",
        selectedOption: "B",
        correctOption: "B",
        scoringRubric: null,
      })
    ).toBe(5);

    expect(
      scoreSingleQuestion({
        category: "TWK",
        selectedOption: "A",
        correctOption: "B",
        scoringRubric: null,
      })
    ).toBe(0);

    expect(
      scoreSingleQuestion({
        category: "TIU",
        selectedOption: "C",
        correctOption: "C",
        scoringRubric: null,
      })
    ).toBe(5);

    expect(
      scoreSingleQuestion({
        category: "TIU",
        selectedOption: "D",
        correctOption: "C",
        scoringRubric: null,
      })
    ).toBe(0);

    expect(
      scoreSingleQuestion({
        category: "TWK",
        selectedOption: null,
        correctOption: "A",
        scoringRubric: null,
      })
    ).toBe(0);

    expect(
      scoreSingleQuestion({
        category: "TIU",
        selectedOption: undefined,
        correctOption: "A",
        scoringRubric: null,
      })
    ).toBe(0);
  });

  it("scores TKP graduated 1..5 when answered and strictly 0 when unanswered", () => {
    for (const [option, expected] of Object.entries(SAMPLE_TKP_RUBRIC) as Array<
      [OptionKey, number]
    >) {
      expect(
        scoreSingleQuestion({
          category: "TKP",
          selectedOption: option,
          correctOption: null,
          scoringRubric: SAMPLE_TKP_RUBRIC,
        })
      ).toBe(expected);
    }

    expect(
      scoreSingleQuestion({
        category: "TKP",
        selectedOption: null,
        correctOption: null,
        scoringRubric: SAMPLE_TKP_RUBRIC,
      })
    ).toBe(0);

    expect(
      scoreSingleQuestion({
        category: "TKP",
        selectedOption: undefined,
        correctOption: null,
        scoringRubric: SAMPLE_TKP_RUBRIC,
      })
    ).toBe(0);
  });

  it("throws an explicit error for TKP when scoringRubric is null, missing, or invalid on answered question", () => {
    expect(() =>
      scoreSingleQuestion({
        category: "TKP",
        selectedOption: "A",
        correctOption: null,
        scoringRubric: null,
      })
    ).toThrow(/Invalid TKP scoringRubric for option A/);

    expect(() =>
      scoreSingleQuestion({
        category: "TKP",
        selectedOption: "B",
        correctOption: null,
        scoringRubric: undefined,
      })
    ).toThrow(/Invalid TKP scoringRubric for option B/);

    expect(() =>
      scoreSingleQuestion({
        category: "TKP",
        selectedOption: "C",
        correctOption: null,
        scoringRubric: { A: 5, B: 4, C: 0, D: 2, E: 1 },
      })
    ).toThrow(/Invalid TKP scoringRubric for option C/);

    expect(() =>
      scoreSingleQuestion({
        category: "TKP",
        selectedOption: "D",
        correctOption: null,
        scoringRubric: { A: 5, B: 4, C: 3, D: 6, E: 1 },
      })
    ).toThrow(/Invalid TKP scoringRubric for option D/);
  });
});

describe("evaluateCatTryout", () => {
  it("exposes official SKD and mini tryout configurations", () => {
    expect(OFFICIAL_SKD_CONFIG).toEqual({
      TWK: { count: 30, passingGrade: 65, maxScore: 150 },
      TIU: { count: 35, passingGrade: 80, maxScore: 175 },
      TKP: { count: 45, passingGrade: 166, maxScore: 225 },
      totalQuestions: 110,
      durationSeconds: 6000,
      maxTotalScore: 550,
    });

    expect(MINI_TRYOUT_CONFIG).toEqual({
      TWK: { count: 8, passingGrade: 18, maxScore: 40 },
      TIU: { count: 10, passingGrade: 23, maxScore: 50 },
      TKP: { count: 12, passingGrade: 45, maxScore: 60 },
      totalQuestions: 30,
      durationSeconds: 1620,
      maxTotalScore: 150,
    });
  });

  it("marks cat_tryout as TIDAK LULUS when TWK=65, TIU=80, TKP=165", () => {
    const items = [
      ...makeCategoryItems("TWK", 30, 65, "Nasionalisme", 20),
      ...makeCategoryItems("TIU", 35, 80, "Silogisme", 30),
      ...makeCategoryItems("TKP", 45, 165, "Pelayanan Publik", 25),
    ];

    const summary = evaluateCatTryout(items, "cat_tryout");

    expect(summary.mode).toBe("cat_tryout");
    expect(summary.byCategory.TWK.scoreEarned).toBe(65);
    expect(summary.byCategory.TWK.passed).toBe(true);
    expect(summary.byCategory.TIU.scoreEarned).toBe(80);
    expect(summary.byCategory.TIU.passed).toBe(true);
    expect(summary.byCategory.TKP.scoreEarned).toBe(165);
    expect(summary.byCategory.TKP.passed).toBe(false);
    expect(summary.totalScoreEarned).toBe(310);
    expect(summary.maxTotalScore).toBe(550);
    expect(summary.passedOverall).toBe(false);
    expect(summary.verdict).toBe("TIDAK LULUS");
  });

  it("marks cat_tryout as LULUS at exact passing boundary TWK=65, TIU=80, TKP=166", () => {
    const items = [
      ...makeCategoryItems("TWK", 30, 65),
      ...makeCategoryItems("TIU", 35, 80),
      ...makeCategoryItems("TKP", 45, 166),
    ];

    const summary = evaluateCatTryout(items, "cat_tryout");

    expect(summary.byCategory.TWK.passed).toBe(true);
    expect(summary.byCategory.TIU.passed).toBe(true);
    expect(summary.byCategory.TKP.passed).toBe(true);
    expect(summary.totalScoreEarned).toBe(311);
    expect(summary.passedOverall).toBe(true);
    expect(summary.verdict).toBe("LULUS");
  });

  it("evaluates mini_tryout passing grades, time aggregation, and weakSubtopics sorting", () => {
    const passingItems: EvaluatedQuestionInput[] = [
      // TWK: 8 questions -> score 20 (passing 18), subtopic Pilar Negara (5/15 = 0.3333) & Bahasa (15/25 = 0.6)
      { category: "TWK", subtopic: "Pilar Negara", scoreEarned: 5, timeSpentSeconds: 12 },
      { category: "TWK", subtopic: "Pilar Negara", scoreEarned: 0, isAnswered: true, timeSpentSeconds: 15 },
      { category: "TWK", subtopic: "Pilar Negara", scoreEarned: 0, isAnswered: false, timeSpentSeconds: 8 },
      { category: "TWK", subtopic: "Bahasa", scoreEarned: 5, timeSpentSeconds: 10 },
      { category: "TWK", subtopic: "Bahasa", scoreEarned: 5, timeSpentSeconds: 10 },
      { category: "TWK", subtopic: "Bahasa", scoreEarned: 5, timeSpentSeconds: 10 },
      { category: "TWK", subtopic: "Bahasa", scoreEarned: 0, timeSpentSeconds: 10 },
      { category: "TWK", subtopic: "Bahasa", scoreEarned: 0, timeSpentSeconds: 10 },
      // TIU: 10 questions -> score 25 (passing 23), subtopic Numerik (25/50 = 0.5)
      ...makeCategoryItems("TIU", 10, 25, "Numerik", 20),
      // TKP: 12 questions -> score 45 (passing 45), subtopic Jejaring Kerja (45/60 = 0.75 -> NOT weak)
      ...makeCategoryItems("TKP", 12, 45, "Jejaring Kerja", 15),
    ];

    const passSummary = evaluateCatTryout(passingItems, "mini_tryout");

    expect(passSummary.mode).toBe("mini_tryout");
    expect(passSummary.maxTotalScore).toBe(150);
    expect(passSummary.byCategory.TWK.passingGrade).toBe(18);
    expect(passSummary.byCategory.TWK.scoreEarned).toBe(20);
    expect(passSummary.byCategory.TWK.answeredCount).toBe(5);
    expect(passSummary.byCategory.TWK.timeSpentSeconds).toBe(85);
    expect(passSummary.byCategory.TWK.passed).toBe(true);

    expect(passSummary.byCategory.TIU.passingGrade).toBe(23);
    expect(passSummary.byCategory.TIU.scoreEarned).toBe(25);
    expect(passSummary.byCategory.TIU.timeSpentSeconds).toBe(200);
    expect(passSummary.byCategory.TIU.passed).toBe(true);

    expect(passSummary.byCategory.TKP.passingGrade).toBe(45);
    expect(passSummary.byCategory.TKP.scoreEarned).toBe(45);
    expect(passSummary.byCategory.TKP.timeSpentSeconds).toBe(180);
    expect(passSummary.byCategory.TKP.passed).toBe(true);

    expect(passSummary.totalTimeSpentSeconds).toBe(465);
    expect(passSummary.passedOverall).toBe(true);
    expect(passSummary.verdict).toBe("LULUS");

    expect(passSummary.weakSubtopics).toEqual([
      { category: "TWK", subtopic: "Pilar Negara", earned: 5, max: 15, accuracyRatio: 5 / 15 },
      { category: "TIU", subtopic: "Numerik", earned: 25, max: 50, accuracyRatio: 0.5 },
      { category: "TWK", subtopic: "Bahasa", earned: 15, max: 25, accuracyRatio: 0.6 },
    ]);

    const failingItems: EvaluatedQuestionInput[] = [
      ...makeCategoryItems("TWK", 8, 15, "TWK Sub"),
      ...makeCategoryItems("TIU", 10, 20, "TIU Sub"),
      ...makeCategoryItems("TKP", 12, 44, "TKP Sub"),
    ];
    const failSummary = evaluateCatTryout(failingItems, "mini_tryout");
    expect(failSummary.byCategory.TWK.passed).toBe(false);
    expect(failSummary.byCategory.TIU.passed).toBe(false);
    expect(failSummary.byCategory.TKP.passed).toBe(false);
    expect(failSummary.passedOverall).toBe(false);
    expect(failSummary.verdict).toBe("TIDAK LULUS");
  });
});
