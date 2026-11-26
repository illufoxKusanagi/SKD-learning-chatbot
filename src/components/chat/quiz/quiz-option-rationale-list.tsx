"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BookOpen } from "lucide-react";
import {
  getBestOptionKey,
  OPTION_KEYS,
  type QuizOptionKey,
} from "./quiz-utils";

interface QuizOptionRationaleListProps {
  optionRationales: Record<QuizOptionKey, string>;
  isTKP: boolean;
  userAnswer: QuizOptionKey | null;
  correctOption: QuizOptionKey | null;
  scoringRubric: Record<QuizOptionKey, number> | null;
}

export function QuizOptionRationaleList({
  optionRationales,
  isTKP,
  userAnswer,
  correctOption,
  scoringRubric,
}: QuizOptionRationaleListProps) {
  const bestOption = getBestOptionKey(correctOption, scoringRubric);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <BookOpen className="size-3.5 text-primary" />
        <span>Rasional Setiap Opsi (A–E)</span>
      </div>

      <div className="flex flex-col gap-2">
        {OPTION_KEYS.map((key) => {
          const rationale = optionRationales[key];
          if (!rationale) return null;

          const score = isTKP ? (scoringRubric?.[key] ?? 0) : key === bestOption ? 5 : 0;
          const isOptimal = key === bestOption;
          const isUserChoice = key === userAnswer;

          return (
            <div
              key={key}
              className={cn(
                "flex flex-col gap-1.5 rounded-lg border p-3 text-xs",
                isOptimal
                  ? "border-success/40 bg-success/5"
                  : isUserChoice
                    ? isTKP && score >= 3
                      ? "border-warning/40 bg-warning/5"
                      : "border-destructive/40 bg-destructive/5"
                    : "border-border bg-card"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">Opsi {key}</span>
                  {isUserChoice && (
                    <Badge variant="outline">Pilihan Anda</Badge>
                  )}
                </div>

                {isOptimal ? (
                  <Badge className="bg-success text-success-foreground">
                    {isTKP ? "5 Poin • Optimal" : "+5 Poin • Kunci"}
                  </Badge>
                ) : isTKP ? (
                  <Badge
                    variant={score <= 2 ? "destructive" : "outline"}
                    className={cn(
                      score >= 3 && "border-warning/50 text-warning"
                    )}
                  >
                    {score} Poin
                  </Badge>
                ) : isUserChoice ? (
                  <Badge variant="destructive">0 Poin</Badge>
                ) : (
                  <Badge variant="secondary">0 Poin</Badge>
                )}
              </div>

              <p className="leading-relaxed text-muted-foreground">{rationale}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
