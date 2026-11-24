"use client";

import { useEffect, useState } from "react";
import type { QuizAttemptItem } from "@/hooks/use-chat";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
  PanelRightOpen,
} from "lucide-react";
import { QuizOptionItem } from "./quiz/quiz-option-item";
import { OPTION_KEYS, type QuizCategory, type QuizOptionKey } from "./quiz/quiz-utils";

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
}: QuizCardProps) {
  const isAnswered = quiz.status === "answered";
  const isTKP = quiz.category === "TKP";
  const isCorrect =
    !isTKP &&
    isAnswered &&
    (quiz.scoreEarned === 5 ||
      Boolean(quiz.userAnswer && quiz.correctOption && quiz.userAnswer === quiz.correctOption));

  const [isExplanationOpen, setIsExplanationOpen] = useState(isAnswered);

  useEffect(() => {
    setIsExplanationOpen(quiz.status === "answered");
  }, [quiz.id, quiz.status]);

  const hasRationale = Boolean(quiz.rubricRationale || quiz.aiExplanation);

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
        </div>

        <CardTitle className="text-base leading-snug font-semibold">
          {quiz.subtopic || `Latihan Soal ${quiz.category}`}
        </CardTitle>
        <CardDescription>
          {isAnswered
            ? "Evaluasi terkunci — pilih soal berikutnya atau diskusikan dengan tutor."
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

        {isAnswered && hasRationale && (
          <Collapsible
            open={isExplanationOpen}
            onOpenChange={setIsExplanationOpen}
            className="flex flex-col gap-2"
          >
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit"
              >
                <BookOpen data-icon="inline-start" />
                {isExplanationOpen
                  ? "Sembunyikan Pembahasan"
                  : "Lihat Pembahasan Resmi"}
                {isExplanationOpen ? (
                  <ChevronUp data-icon="inline-end" />
                ) : (
                  <ChevronDown data-icon="inline-end" />
                )}
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <Alert className="bg-muted/40">
                <BookOpen />
                <AlertTitle>Pembahasan & Rasional Rubrik</AlertTitle>
                <AlertDescription className="flex flex-col gap-2 whitespace-pre-line">
                  {quiz.rubricRationale && <p>{quiz.rubricRationale}</p>}
                  {quiz.aiExplanation && <p>{quiz.aiExplanation}</p>}
                </AlertDescription>
              </Alert>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>

      {(onAskTutor || onNextQuiz) && (
        <>
          <Separator />
          <CardFooter className="flex flex-wrap items-center justify-between gap-2">
            {onAskTutor ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isChatLoading}
                onClick={() => onAskTutor(quiz)}
              >
                <MessageSquarePlus data-icon="inline-start" />
                Diskusikan dengan Tutor
              </Button>
            ) : (
              <div />
            )}

            {onNextQuiz && (
              <Button
                type="button"
                size="sm"
                disabled={isGeneratingNext}
                onClick={() => onNextQuiz(quiz.category)}
              >
                {isGeneratingNext && <Spinner data-icon="inline-start" />}
                {nextButtonLabel}
                {!isGeneratingNext && <ArrowRight data-icon="inline-end" />}
              </Button>
            )}
          </CardFooter>
        </>
      )}
    </Card>
  );
}

export function QuizCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("w-full gap-4 py-5", className)}>
      <CardHeader className="gap-2 border-b pb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="flex flex-col gap-2 pt-2">
          {OPTION_KEYS.map((key) => (
            <Skeleton key={key} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
