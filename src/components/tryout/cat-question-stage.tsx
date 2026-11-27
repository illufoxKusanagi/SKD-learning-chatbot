"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FiguralImageFrame } from "@/components/quiz/figural-image-frame";
import type { OptionKey } from "@/lib/scoring/skd-scoring";
import type { TryoutQuestionMaskedItem } from "@/lib/services/tryout.service";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Flag,
} from "lucide-react";
import { TRYOUT_OPTION_KEYS } from "./tryout-utils";

interface CatQuestionStageProps {
  question: TryoutQuestionMaskedItem;
  activeIndex: number;
  totalQuestions: number;
  onSelectOption: (option: OptionKey) => void;
  onClearOption: () => void;
  onToggleFlag: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRequestFinish: () => void;
}

export function CatQuestionStage({
  question,
  activeIndex,
  totalQuestions,
  onSelectOption,
  onClearOption,
  onToggleFlag,
  onPrev,
  onNext,
  onRequestFinish,
}: CatQuestionStageProps) {
  const isFirst = activeIndex === 0;
  const isLast = activeIndex >= totalQuestions - 1;

  return (
    <Card className="w-full gap-4 py-5 shadow-xs">
      <CardHeader className="gap-3 border-b pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">
              Soal {question.number} dari {totalQuestions}
            </CardTitle>
            <Badge variant="secondary">{question.category}</Badge>
            <Badge variant="outline">{question.subtopic}</Badge>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={question.isFlagged}
            onClick={onToggleFlag}
            className={cn(
              question.isFlagged &&
                "border-warning bg-warning/20 text-foreground hover:bg-warning/30"
            )}
          >
            <Flag data-icon="inline-start" />
            {question.isFlagged ? "Ditandai Ragu-ragu" : "Ragu-ragu"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground sm:text-base">
          {question.stem}
        </p>

        {question.imageUrl && (
          <FiguralImageFrame
            src={question.imageUrl}
            alt={`Ilustrasi soal ${question.number} (${question.subtopic})`}
          />
        )}

        <div
          role="radiogroup"
          aria-label={`Pilihan jawaban soal ${question.number}`}
          className="flex flex-col gap-2.5"
        >
          {TRYOUT_OPTION_KEYS.map((key) => {
            const text = question.options[key];
            const isSelected = question.selectedOption === key;

            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectOption(key)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  isSelected
                    ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                    : "border-border bg-card text-foreground hover:bg-accent/50"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-muted-foreground"
                  )}
                >
                  {key}
                </span>
                <span className="flex-1 leading-relaxed">{text}</span>
                {isSelected && (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                )}
              </button>
            );
          })}
        </div>

        {question.selectedOption !== null && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearOption}
            >
              <Eraser data-icon="inline-start" />
              Kosongkan Pilihan
            </Button>
          </div>
        )}
      </CardContent>

      <Separator />

      <CardFooter className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isFirst}
          onClick={onPrev}
        >
          <ChevronLeft data-icon="inline-start" />
          Sebelumnya
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {!isLast ? (
            <Button type="button" size="sm" onClick={onNext}>
              Simpan &amp; Lanjutkan
              <ChevronRight data-icon="inline-end" />
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={onRequestFinish}>
              <CheckCircle2 data-icon="inline-start" />
              Selesai Ujian
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
