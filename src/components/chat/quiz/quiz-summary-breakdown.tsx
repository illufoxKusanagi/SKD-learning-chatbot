"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle } from "lucide-react";
import type { QuizCategory, QuizSessionSummary } from "./quiz-utils";

interface QuizSummaryBreakdownProps {
  summary: QuizSessionSummary;
}

export function QuizSummaryBreakdown({ summary }: QuizSummaryBreakdownProps) {
  const categories: QuizCategory[] = ["TWK", "TIU", "TKP"];
  const activeCategories = categories.filter((c) => summary.byCategory[c].total > 0);
  const visibleCategories = activeCategories.length > 0 ? activeCategories : categories;

  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {visibleCategories.map((cat) => {
          const catData = summary.byCategory[cat];
          const catPercent =
            catData.maxScore > 0
              ? Math.round((catData.scoreEarned / catData.maxScore) * 100)
              : 0;
          return (
            <div
              key={cat}
              className="flex flex-col gap-1 rounded-xl border bg-muted/30 p-3"
            >
              <div className="flex items-center justify-between gap-1">
                <Badge variant="secondary">{cat}</Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  {catData.answered}/{catData.total}
                </span>
              </div>
              <span className="text-base font-bold text-foreground">
                {catPercent}%
              </span>
              <span className="text-xs text-muted-foreground">
                {catData.scoreEarned}/{catData.maxScore} poin
              </span>
            </div>
          );
        })}
      </div>

      {summary.weakSubtopics.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-warning">
              <AlertTriangle className="size-3.5" />
              <span>Subtopik Perlu Penguatan (&lt; 70%)</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {summary.weakSubtopics.map((item) => (
                <div
                  key={`${item.category}-${item.subtopic}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="outline">{item.category}</Badge>
                    <span className="truncate font-medium text-foreground">
                      {item.subtopic}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-warning/50 text-warning"
                  >
                    {item.accuracyPercent}% ({item.earned}/{item.max})
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
