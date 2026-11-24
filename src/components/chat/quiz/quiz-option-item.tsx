"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { Award, Check, CheckCircle2, X, XCircle } from "lucide-react";
import type { QuizOptionKey } from "./quiz-utils";

interface QuizOptionItemProps {
  optionKey: QuizOptionKey;
  optionText: string;
  isAnswered: boolean;
  isTKP: boolean;
  isUserChoice: boolean;
  isCorrectOption: boolean;
  correctOption: QuizOptionKey | null;
  rubricScore?: number;
  isGradingThisOption: boolean;
  disabled: boolean;
  onSelect: (option: QuizOptionKey) => void;
}

export function QuizOptionItem({
  optionKey,
  optionText,
  isAnswered,
  isTKP,
  isUserChoice,
  isCorrectOption,
  correctOption,
  rubricScore,
  isGradingThisOption,
  disabled,
  onSelect,
}: QuizOptionItemProps) {
  const isOptimal = isTKP ? rubricScore === 5 : isCorrectOption;
  const isWrongSelection =
    isUserChoice && (isTKP ? (rubricScore ?? 0) <= 2 : !isCorrectOption);
  const isWarningSelection =
    isUserChoice && isTKP && (rubricScore ?? 0) >= 3 && (rubricScore ?? 0) <= 4;

  const containerStateClass = !isAnswered
    ? "border-border bg-card hover:border-primary/50 hover:bg-accent/50 cursor-pointer"
    : isOptimal
      ? "border-success/50 bg-success/10 text-foreground"
      : isWrongSelection
        ? "border-destructive/50 bg-destructive/10 text-foreground"
        : isWarningSelection
          ? "border-warning/50 bg-warning/10 text-foreground"
          : "border-border/60 bg-muted/30 text-muted-foreground opacity-75";

  const letterBadgeClass = !isAnswered
    ? "border-border bg-muted text-muted-foreground"
    : isOptimal
      ? "border-success bg-success text-success-foreground"
      : isWrongSelection
        ? "border-destructive bg-destructive text-primary-foreground"
        : isWarningSelection
          ? "border-warning bg-warning text-warning-foreground"
          : "border-border bg-muted text-muted-foreground";

  const renderLetterContent = () => {
    if (isGradingThisOption) {
      return <Spinner className="size-3.5" />;
    }
    if (isAnswered && isOptimal) {
      return <Check className="size-3.5" />;
    }
    if (isAnswered && isWrongSelection) {
      return <X className="size-3.5" />;
    }
    return optionKey;
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled || isAnswered}
        aria-pressed={isUserChoice}
        onClick={() => onSelect(optionKey)}
        className={cn(
          "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none",
          containerStateClass
        )}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold transition-colors",
            letterBadgeClass
          )}
        >
          {renderLetterContent()}
        </span>

        <span className="flex-1 leading-relaxed text-foreground">
          {optionText}
        </span>

        {isAnswered && isTKP && typeof rubricScore === "number" && (
          <Badge
            variant={rubricScore === 5 ? "outline" : "secondary"}
            className={cn(
              "shrink-0 font-mono",
              rubricScore === 5 && "border-success/50 text-success"
            )}
          >
            {rubricScore} Poin
          </Badge>
        )}
      </button>

      {isAnswered && isUserChoice && (
        <Alert
          variant={!isTKP && !isCorrectOption ? "destructive" : "default"}
          className={cn(
            isOptimal && "border-success/40 bg-success/10",
            isWarningSelection && "border-warning/40 bg-warning/10"
          )}
        >
          {isOptimal ? (
            <CheckCircle2 className="text-success" />
          ) : isTKP ? (
            <Award className="text-warning" />
          ) : (
            <XCircle />
          )}
          <AlertTitle>
            {isTKP
              ? `Skor Anda: +${rubricScore ?? 0}/5 Poin`
              : isCorrectOption
                ? "Tepat sekali! +5 Poin"
                : "Kurang tepat (0 Poin)"}
          </AlertTitle>
          {((!isTKP && !isCorrectOption && correctOption) || isTKP) && (
            <AlertDescription>
              {isTKP
                ? rubricScore === 5
                  ? "Pilihan paling optimal sesuai nilai dasar ASN BerAKHLAK."
                  : `Opsi paling optimal (5 Poin) adalah Opsi ${correctOption}.`
                : `Kunci jawaban yang benar adalah Opsi ${correctOption}.`}
            </AlertDescription>
          )}
        </Alert>
      )}
    </div>
  );
}
