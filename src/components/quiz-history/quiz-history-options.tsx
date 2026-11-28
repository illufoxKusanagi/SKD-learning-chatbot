"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import {
  getOptionAppearance,
  OPTION_KEYS,
  type QuizAttemptDetail,
} from "@/components/quiz-history/quiz-history-types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface QuizHistoryOptionsProps {
  quiz: QuizAttemptDetail;
  isAnswered: boolean;
  isTKP: boolean;
}

export function QuizHistoryOptions({
  quiz,
  isAnswered,
  isTKP,
}: QuizHistoryOptionsProps) {
  return (
    <div className="flex flex-col gap-2">
      {OPTION_KEYS.map((opt) => {
        const optionText = quiz.options?.[opt];
        if (!optionText) return null;

        const isUserChoice = quiz.userAnswer === opt;
        const isCorrectOpt = quiz.correctOption === opt;
        const rubricScore = quiz.scoringRubric?.[opt];

        if (!isAnswered) {
          return (
            <div
              key={opt}
              className="flex items-start gap-3 rounded-lg border border-border bg-card/40 p-3 text-xs text-muted-foreground"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold text-muted-foreground">
                {opt}
              </span>
              <span className="flex-1 text-foreground">{optionText}</span>
            </div>
          );
        }

        const {
          containerStyle,
          letterStyle,
          userBadgeStyle,
          rubricBadgeStyle,
        } = getOptionAppearance({
          isTKP,
          isUserChoice,
          isCorrectOpt,
          rubricScore,
        });

        return (
          <div
            key={opt}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-xs transition-all",
              containerStyle
            )}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded border text-xs",
                letterStyle
              )}
            >
              {opt}
            </span>
            <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
              <span className="text-foreground">{optionText}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                {isUserChoice && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] font-bold", userBadgeStyle)}
                  >
                    {isTKP ? (
                      (rubricScore ?? 0) >= 4 ? (
                        <CheckCircle2 />
                      ) : (
                        <XCircle />
                      )
                    ) : isCorrectOpt ? (
                      <CheckCircle2 />
                    ) : (
                      <XCircle />
                    )}
                    Pilihan Anda
                  </Badge>
                )}
                {typeof rubricScore === "number" && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[10px] font-bold",
                      rubricBadgeStyle
                    )}
                  >
                    {rubricScore} Poin
                  </Badge>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
