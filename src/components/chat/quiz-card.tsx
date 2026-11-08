"use client";

import { useState } from "react";
import { QuizAttemptItem } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";

interface QuizCardProps {
  quiz: QuizAttemptItem;
  onSelectOption?: (quizId: string, option: "A" | "B" | "C" | "D" | "E") => void;
  disabled?: boolean;
  className?: string;
}

const OPTION_KEYS: ("A" | "B" | "C" | "D" | "E")[] = ["A", "B", "C", "D", "E"];

export function QuizCard({
  quiz,
  onSelectOption,
  disabled = false,
  className,
}: QuizCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  const isAnswered = quiz.status === "answered";
  const isTWKorTIU = quiz.category === "TWK" || quiz.category === "TIU";
  const isTKP = quiz.category === "TKP";
  const isCorrect =
    isTWKorTIU &&
    (quiz.scoreEarned === 5 ||
      (quiz.userAnswer && quiz.correctOption && quiz.userAnswer === quiz.correctOption));

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "TWK":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      case "TIU":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "TKP":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getRubricScoreBadge = (score?: number) => {
    if (typeof score !== "number") return null;
    let colorClass = "bg-muted text-muted-foreground border-border";
    if (score === 5) {
      colorClass = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold";
    } else if (score === 4) {
      colorClass = "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30 font-semibold";
    } else if (score === 3) {
      colorClass = "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-medium";
    } else if (score === 2) {
      colorClass = "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30";
    } else if (score === 1) {
      colorClass = "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
    }

    return (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-mono tracking-tight",
          colorClass
        )}
      >
        {score} Poin
      </span>
    );
  };

  return (
    <div
      className={cn(
        "w-full rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden my-3 transition-all",
        isAnswered
          ? isCorrect || (isTKP && (quiz.scoreEarned ?? 0) >= 4)
            ? "border-emerald-500/40 dark:border-emerald-500/30 shadow-emerald-500/5"
            : "border-border"
          : "border-primary/30 shadow-primary/5",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-md text-xs font-bold border tracking-wider",
              getCategoryBadgeClass(quiz.category)
            )}
          >
            {quiz.category}
          </span>
          {quiz.subtopic && (
            <span className="text-xs px-2.5 py-0.5 rounded-md bg-background border border-border text-muted-foreground font-medium truncate max-w-[220px]">
              {quiz.subtopic}
            </span>
          )}
        </div>

        {/* Status / Score Badge */}
        <div>
          {isAnswered ? (
            isTWKorTIU ? (
              isCorrect ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  +5 Poin (Benar)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                  <XCircle className="w-3.5 h-3.5" />
                  0 Poin (Kurang Tepat)
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <Award className="w-3.5 h-3.5" />
                Skor TKP: {quiz.scoreEarned ?? 0}/5 Poin
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse">
              <HelpCircle className="w-3.5 h-3.5" />
              Pilih Jawaban (A–E)
            </span>
          )}
        </div>
      </div>

      {/* Question Stem */}
      <div className="p-4 space-y-3">
        <p className="text-sm font-medium leading-relaxed text-foreground whitespace-pre-line">
          {quiz.questionStem}
        </p>

        {/* Options List */}
        <div className="space-y-2 pt-1">
          {OPTION_KEYS.map((opt) => {
            const optionText = quiz.options ? quiz.options[opt] : null;
            if (!optionText) return null;

            const isUserChoice = quiz.userAnswer === opt;
            const isCorrectOption = quiz.correctOption === opt;
            const rubricScore = quiz.scoringRubric ? quiz.scoringRubric[opt] : undefined;

            if (!isAnswered) {
              // Interactive button state
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectOption?.(quiz.id, opt)}
                  className={cn(
                    "w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-all text-sm",
                    "hover:bg-primary/5 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    disabled
                      ? "opacity-60 cursor-not-allowed"
                      : "cursor-pointer active:scale-[0.99] border-border bg-card"
                  )}
                >
                  <span className="flex-shrink-0 w-6 h-6 rounded-md bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs border border-border group-hover:bg-primary group-hover:text-primary-foreground">
                    {opt}
                  </span>
                  <span className="flex-1 text-foreground">{optionText}</span>
                </button>
              );
            }

            // Answered / Review State
            let optionContainerStyle = "border-border bg-card/60 text-muted-foreground";
            let letterStyle = "bg-muted text-muted-foreground border-border";

            if (isTKP) {
              if (isUserChoice) {
                if (rubricScore === 5) {
                  optionContainerStyle =
                    "border-emerald-500/60 bg-emerald-50/80 dark:bg-emerald-950/40 text-foreground font-medium shadow-xs";
                  letterStyle =
                    "bg-emerald-500 text-white dark:bg-emerald-600 border-emerald-500 font-bold";
                } else if (rubricScore === 4) {
                  optionContainerStyle =
                    "border-teal-500/60 bg-teal-50/80 dark:bg-teal-950/40 text-foreground font-medium shadow-xs";
                  letterStyle =
                    "bg-teal-500 text-white dark:bg-teal-600 border-teal-500 font-bold";
                } else if (rubricScore === 3) {
                  optionContainerStyle =
                    "border-amber-500/60 bg-amber-50/80 dark:bg-amber-950/40 text-foreground font-medium shadow-xs";
                  letterStyle =
                    "bg-amber-500 text-white dark:bg-amber-600 border-amber-500 font-bold";
                } else {
                  optionContainerStyle =
                    "border-rose-500/60 bg-rose-50/80 dark:bg-rose-950/40 text-foreground font-medium shadow-xs";
                  letterStyle =
                    "bg-rose-500 text-white dark:bg-rose-600 border-rose-500 font-bold";
                }
              } else if (rubricScore === 5) {
                optionContainerStyle =
                  "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/30 text-foreground font-medium";
                letterStyle =
                  "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold";
              }
            } else {
              if (isCorrectOption) {
                optionContainerStyle =
                  "border-emerald-500/60 bg-emerald-50/80 dark:bg-emerald-950/40 text-foreground font-medium shadow-xs";
                letterStyle =
                  "bg-emerald-500 text-white dark:bg-emerald-600 border-emerald-500 font-bold";
              } else if (isUserChoice && !isCorrectOption) {
                optionContainerStyle =
                  "border-rose-500/60 bg-rose-50/80 dark:bg-rose-950/40 text-foreground font-medium shadow-xs";
                letterStyle =
                  "bg-rose-500 text-white dark:bg-rose-600 border-rose-500 font-bold";
              }
            }

            return (
              <div
                key={opt}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-sm",
                  optionContainerStyle
                )}
              >
                <span
                  className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs border",
                    letterStyle
                  )}
                >
                  {opt}
                </span>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-foreground">{optionText}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isUserChoice && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border",
                            isTKP
                              ? rubricScore === 5
                                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                                : rubricScore === 4
                                ? "bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/40"
                                : rubricScore === 3
                                ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40"
                                : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40"
                              : isCorrectOption
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40"
                          )}
                        >
                          {isTKP ? (
                            (rubricScore ?? 0) >= 4 ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )
                          ) : isCorrectOption ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          Pilihan Anda
                        </span>
                      )}
                      {quiz.scoringRubric && getRubricScoreBadge(rubricScore)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Answered Explanation Accordion */}
        {isAnswered && (quiz.rubricRationale || quiz.aiExplanation) && (
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowExplanation(!showExplanation)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {showExplanation
                  ? "Sembunyikan Pembahasan & Rasional Rubrik"
                  : "Lihat Pembahasan & Rasional Rubrik"}
              </span>
              {showExplanation ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showExplanation && (
              <div className="mt-3 p-3.5 rounded-lg bg-muted/60 border border-border text-xs space-y-2.5 animate-in fade-in-50 duration-200">
                {quiz.rubricRationale && (
                  <div>
                    <span className="font-bold text-foreground block mb-1">
                      Rasional Skor & Kunci Jawaban:
                    </span>
                    <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                      {quiz.rubricRationale}
                    </p>
                  </div>
                )}
                {quiz.aiExplanation && (
                  <div>
                    <span className="font-bold text-foreground block mb-1">
                      Penjelasan Tambahan:
                    </span>
                    <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                      {quiz.aiExplanation}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}