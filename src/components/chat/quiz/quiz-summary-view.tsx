"use client";

import type { QuizAttemptItem } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { Award, CheckCircle2, Plus, RotateCcw, XCircle } from "lucide-react";
import { QuizSummaryBreakdown } from "./quiz-summary-breakdown";
import { computeQuizSessionSummary, type QuizCategory } from "./quiz-utils";

interface QuizSummaryViewProps {
  quizzes: QuizAttemptItem[];
  selectedCategory?: "ALL" | QuizCategory;
  onCategoryChange?: (cat: "ALL" | QuizCategory) => void;
  onJumpToIndex: (index: number) => void;
  onRequestNextQuiz?: (category?: QuizCategory) => void;
  onRetryWrongQuestions?: () => void;
  onNewPack?: () => void;
  isGeneratingQuiz?: boolean;
}

export function QuizSummaryView({
  quizzes,
  selectedCategory = "ALL",
  onCategoryChange,
  onJumpToIndex,
  onRequestNextQuiz,
  onRetryWrongQuestions,
  onNewPack,
  isGeneratingQuiz = false,
}: QuizSummaryViewProps) {
  const summary = computeQuizSessionSummary(quizzes);
  const isPracticeMode = Boolean(onNewPack || onRetryWrongQuestions);

  return (
    <Card className="w-full gap-4 py-5 shadow-xs">
      <CardHeader className="gap-2 border-b pb-4">
        <div className="flex items-center gap-2">
          <Award className="size-5 text-primary" />
          <CardTitle className="text-base">Ringkasan Sesi Latihan</CardTitle>
        </div>
        <CardDescription>
          {summary.answered} dari {summary.total} soal telah dikerjakan
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Akurasi & Perolehan Skor
            </span>
            <span className="text-xl font-bold text-foreground">
              {summary.scoreEarned}
              <span className="text-sm font-normal text-muted-foreground">
                /{summary.maxScore} Poin ({summary.accuracyPercent}%)
              </span>
            </span>
          </div>
          <Progress value={summary.accuracyPercent} />
        </div>

        <QuizSummaryBreakdown summary={summary} />

        <Separator />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Navigasi Cepat Butir Soal
          </span>
          <div className="flex flex-wrap gap-2">
            {quizzes.map((q, index) => {
              const isAnswered = q.status === "answered";
              const isOptimal = isAnswered && (q.scoreEarned ?? 0) >= (q.maxScore ?? 5);
              return (
                <Button
                  key={q.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onJumpToIndex(index)}
                  className={cn(
                    isAnswered &&
                      (isOptimal
                        ? "border-success/50 text-success"
                        : "border-destructive/40 text-destructive")
                  )}
                >
                  {isAnswered &&
                    (isOptimal ? (
                      <CheckCircle2 data-icon="inline-start" />
                    ) : (
                      <XCircle data-icon="inline-start" />
                    ))}
                  #{index + 1}
                </Button>
              );
            })}
          </div>
        </div>

        {!isPracticeMode && onCategoryChange && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Pilih Subtes untuk Soal Berikutnya
              </span>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={selectedCategory}
                onValueChange={(val) => {
                  if (val) onCategoryChange(val as "ALL" | QuizCategory);
                }}
              >
                <ToggleGroupItem value="ALL">Acak SKD</ToggleGroupItem>
                <ToggleGroupItem value="TWK">TWK</ToggleGroupItem>
                <ToggleGroupItem value="TIU">TIU</ToggleGroupItem>
                <ToggleGroupItem value="TKP">TKP</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        {isPracticeMode ? (
          <>
            {summary.wrongOrSuboptimalIndices.length > 0 && onRetryWrongQuestions ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isGeneratingQuiz}
                onClick={onRetryWrongQuestions}
              >
                <RotateCcw data-icon="inline-start" />
                Latih Ulang Soal Salah ({summary.wrongOrSuboptimalIndices.length})
              </Button>
            ) : (
              <div />
            )}
            {onNewPack && (
              <Button
                type="button"
                size="sm"
                disabled={isGeneratingQuiz}
                onClick={onNewPack}
              >
                {isGeneratingQuiz ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Plus data-icon="inline-start" />
                )}
                Paket Latihan Baru
              </Button>
            )}
          </>
        ) : (
          <>
            {summary.wrongOrSuboptimalIndices.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onJumpToIndex(summary.wrongOrSuboptimalIndices[0])}
              >
                <RotateCcw data-icon="inline-start" />
                Tinjau Belum Optimal ({summary.wrongOrSuboptimalIndices.length})
              </Button>
            ) : (
              <div />
            )}
            {onRequestNextQuiz && (
              <Button
                type="button"
                size="sm"
                disabled={isGeneratingQuiz}
                onClick={() =>
                  onRequestNextQuiz(
                    selectedCategory === "ALL" ? undefined : selectedCategory
                  )
                }
              >
                {isGeneratingQuiz ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Plus data-icon="inline-start" />
                )}
                Soal Berikutnya
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
}
