"use client";

import { useState } from "react";
import { Award, ChevronLeft, ChevronRight, ListChecks, PanelRightOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QuizCard } from "@/components/chat/quiz-card";
import { QuizSummaryView } from "@/components/chat/quiz/quiz-summary-view";
import { computeQuizSessionSummary, type QuizCategory, type QuizOptionKey } from "@/components/chat/quiz/quiz-utils";
import type { QuizAttemptItem } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: QuizCategory[] = ["TWK", "TIU", "TKP"];

interface QuizDeckCardProps {
  quizzes: QuizAttemptItem[];
  onSelectOption?: (quizId: string, option: QuizOptionKey) => void;
  onOpenCanvas?: (quizId: string) => void;
  onAskTutor?: (quiz: QuizAttemptItem) => void;
  gradingQuizId?: string | null;
  gradingOption?: QuizOptionKey | null;
  isChatLoading?: boolean;
}

export function QuizDeckCard({
  quizzes,
  onSelectOption,
  onOpenCanvas,
  onAskTutor,
  gradingQuizId = null,
  gradingOption = null,
  isChatLoading = false,
}: QuizDeckCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  const safeIndex = quizzes.length > 0 ? Math.min(activeIndex, quizzes.length - 1) : 0;
  const activeQuiz = quizzes[safeIndex];
  const summary = computeQuizSessionSummary(quizzes);
  const progressPercent = Math.round((summary.answered / Math.max(1, summary.total)) * 100);
  const goToNextOrSummary = () => {
    if (safeIndex < quizzes.length - 1) {
      setActiveIndex(safeIndex + 1);
    } else {
      setShowSummary(true);
    }
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">Paket Kuis SKD</Badge>
            <span className="text-sm font-semibold text-foreground">
              {showSummary
                ? "Ringkasan Hasil"
                : `Soal ${safeIndex + 1} dari ${quizzes.length}`}
            </span>
            {CATEGORY_ORDER.map((cat) => {
              const catSummary = summary.byCategory[cat];
              if (catSummary.total === 0) return null;
              return (
                <Badge
                  key={cat}
                  variant="outline"
                  className="text-xs font-normal"
                >
                  {cat} {catSummary.answered}/{catSummary.total}
                </Badge>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant={showSummary ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowSummary((prev) => !prev)}
            >
              {showSummary ? (
                <ListChecks data-icon="inline-start" />
              ) : (
                <Award data-icon="inline-start" />
              )}
              {showSummary
                ? "Kembali ke Soal"
                : `Ringkasan (${summary.answered}/${summary.total})`}
            </Button>
            {onOpenCanvas && activeQuiz && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenCanvas(activeQuiz.id)}
              >
                <PanelRightOpen data-icon="inline-start" />
                Panel Kuis
              </Button>
            )}
          </div>
        </div>

        <Progress value={progressPercent} className="mt-2.5 h-1.5" />

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {quizzes.map((q, idx) => {
            const isCurrent = !showSummary && idx === safeIndex;
            const isAnswered = q.status === "answered";
            const isOptimal =
              isAnswered && (q.scoreEarned ?? 0) >= (q.maxScore ?? 5);

            return (
              <Button
                key={q.id}
                type="button"
                size="sm"
                variant={isCurrent ? "default" : "outline"}
                onClick={() => {
                  setShowSummary(false);
                  setActiveIndex(idx);
                }}
                className={cn(
                  "h-7 min-w-7 shrink-0 px-2 text-xs",
                  !isCurrent &&
                    isAnswered &&
                    (isOptimal
                      ? "border-success/50 bg-success/10 text-success hover:bg-success/20"
                      : "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20")
                )}
              >
                {idx + 1}
              </Button>
            );
          })}
        </div>
      </div>

      {showSummary ? (
        <QuizSummaryView
          quizzes={quizzes}
          onJumpToIndex={(idx) => {
            setShowSummary(false);
            setActiveIndex(idx);
          }}
        />
      ) : (
        activeQuiz && (
          <>
            <QuizCard
              quiz={activeQuiz}
              showOpenCanvas={false}
              onSelectOption={onSelectOption}
              onAskTutor={onAskTutor}
              gradingOption={gradingQuizId === activeQuiz.id ? gradingOption : null}
              isGrading={gradingQuizId === activeQuiz.id}
              isChatLoading={isChatLoading}
              onNextQuiz={goToNextOrSummary}
              nextButtonLabel={
                safeIndex < quizzes.length - 1 ? `Ke Soal #${safeIndex + 2}` : "Lihat Ringkasan Skor"
              }
            />

            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-xs">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safeIndex === 0}
                onClick={() => setActiveIndex(Math.max(0, safeIndex - 1))}
              >
                <ChevronLeft data-icon="inline-start" />
                Sebelumnya
              </Button>
              <span className="text-xs text-muted-foreground">
                {safeIndex + 1} / {quizzes.length}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={goToNextOrSummary}>
                {safeIndex < quizzes.length - 1 ? "Berikutnya" : "Ringkasan Skor"}
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>
          </>
        )
      )}
    </div>
  );
}
