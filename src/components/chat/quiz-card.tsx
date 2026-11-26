"use client";

import type { QuizAttemptItem } from "@/hooks/use-chat";
import type { PracticeQuestionMaterialItem } from "@/lib/services/practice.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { PanelRightOpen, RotateCcw } from "lucide-react";
import { QuizCardFooter } from "./quiz/quiz-card-footer";
import { QuizHintToggle } from "./quiz/quiz-hint-toggle";
import { QuizLegacyRationale } from "./quiz/quiz-legacy-rationale";
import { QuizOptionItem } from "./quiz/quiz-option-item";
import { QuizOptionRationaleList } from "./quiz/quiz-option-rationale-list";
import { OPTION_KEYS, type QuizCategory, type QuizOptionKey } from "./quiz/quiz-utils";

export { QuizCardSkeleton } from "./quiz/quiz-card-skeleton";

interface QuizCardProps {
  quiz: QuizAttemptItem;
  onSelectOption?: (quizId: string, option: QuizOptionKey) => void;
  onOpenCanvas?: (quizId: string) => void;
  onAskTutor?: (quiz: QuizAttemptItem) => void;
  onNextQuiz?: (category: QuizCategory) => void;
  gradingOption?: QuizOptionKey | null;
  isGrading?: boolean;
  isGeneratingNext?: boolean;
  isChatLoading?: boolean;
  showOpenCanvas?: boolean;
  nextButtonLabel?: string;
  className?: string;
  hint?: string | null;
  isHintRevealed?: boolean;
  onRevealHint?: () => void;
  optionRationales?: Record<QuizOptionKey, string> | null;
  materials?: PracticeQuestionMaterialItem[];
  onOpenMaterial?: (material: PracticeQuestionMaterialItem) => void;
  syncStatus?: "synced" | "syncing" | "failed";
  onRetrySync?: () => void;
}

export function QuizCard({
  quiz,
  onSelectOption,
  onOpenCanvas,
  onAskTutor,
  onNextQuiz,
  gradingOption = null,
  isGrading = false,
  isGeneratingNext = false,
  isChatLoading = false,
  showOpenCanvas = true,
  nextButtonLabel = "Soal Berikutnya",
  className,
  hint,
  isHintRevealed = false,
  onRevealHint,
  optionRationales = null,
  materials,
  onOpenMaterial,
  syncStatus,
  onRetrySync,
}: QuizCardProps) {
  const isAnswered = quiz.status === "answered";
  const isTKP = quiz.category === "TKP";
  const isCorrect =
    !isTKP &&
    isAnswered &&
    (quiz.scoreEarned === 5 ||
      Boolean(quiz.userAnswer && quiz.correctOption && quiz.userAnswer === quiz.correctOption));

  return (
    <Card className={cn("w-full gap-4 py-5 shadow-xs", className)}>
      <CardHeader className="gap-2 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{quiz.category}</Badge>
          {isAnswered && (
            <Badge
              variant={isTKP ? "outline" : isCorrect ? "default" : "destructive"}
              className={cn(
                isCorrect && "bg-success text-success-foreground",
                isTKP && "border-success/50 text-success"
              )}
            >
              {isTKP
                ? `Skor ${quiz.scoreEarned ?? 0}/${quiz.maxScore ?? 5}`
                : isCorrect
                  ? "+5 Poin (Benar)"
                  : "0 Poin (Salah)"}
            </Badge>
          )}
          {syncStatus === "syncing" && (
            <Badge variant="outline">
              <Spinner />
              Menyimpan
            </Badge>
          )}
          {syncStatus === "failed" && onRetrySync && (
            <Button type="button" variant="destructive" size="sm" onClick={onRetrySync}>
              <RotateCcw data-icon="inline-start" />
              Gagal Sinkron • Ulangi
            </Button>
          )}
        </div>

        <CardTitle className="text-base leading-snug font-semibold">
          {quiz.subtopic || `Latihan Soal ${quiz.category}`}
        </CardTitle>
        <CardDescription>
          {isAnswered
            ? "Evaluasi terkunci — pelajari rasional opsi atau bedah bersama tutor."
            : "Pilih satu jawaban terbaik (A–E) untuk melihat pembahasan instan."}
        </CardDescription>

        {showOpenCanvas && onOpenCanvas && (
          <CardAction>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenCanvas(quiz.id)}
            >
              <PanelRightOpen data-icon="inline-start" />
              Panel Kuis
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
          {quiz.questionStem}
        </p>

        {hint && onRevealHint && (
          <QuizHintToggle
            hint={hint}
            isRevealed={isHintRevealed}
            isAnswered={isAnswered}
            onReveal={onRevealHint}
          />
        )}

        <div
          role="group"
          aria-label="Pilihan jawaban A sampai E"
          className="flex flex-col gap-2.5"
        >
          {OPTION_KEYS.map((opt) => {
            const optionText = quiz.options?.[opt];
            if (!optionText) return null;

            return (
              <QuizOptionItem
                key={opt}
                optionKey={opt}
                optionText={optionText}
                isAnswered={isAnswered}
                isTKP={isTKP}
                isUserChoice={quiz.userAnswer === opt}
                isCorrectOption={quiz.correctOption === opt}
                correctOption={quiz.correctOption}
                rubricScore={quiz.scoringRubric?.[opt]}
                isGradingThisOption={isGrading && gradingOption === opt}
                disabled={isGrading}
                onSelect={(selected) => onSelectOption?.(quiz.id, selected)}
              />
            );
          })}
        </div>

        {isAnswered && optionRationales ? (
          <QuizOptionRationaleList
            optionRationales={optionRationales}
            isTKP={isTKP}
            userAnswer={quiz.userAnswer}
            correctOption={quiz.correctOption}
            scoringRubric={quiz.scoringRubric}
          />
        ) : (
          isAnswered && (
            <QuizLegacyRationale
              quizId={quiz.id}
              rubricRationale={quiz.rubricRationale}
              aiExplanation={quiz.aiExplanation}
            />
          )
        )}
      </CardContent>

      <QuizCardFooter
        quiz={quiz}
        materials={materials}
        onOpenMaterial={onOpenMaterial}
        onAskTutor={onAskTutor}
        onNextQuiz={onNextQuiz}
        isChatLoading={isChatLoading}
        isGeneratingNext={isGeneratingNext}
        nextButtonLabel={nextButtonLabel}
      />
    </Card>
  );
}
