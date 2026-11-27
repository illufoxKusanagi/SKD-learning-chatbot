"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { QuizOptionRationaleList } from "@/components/chat/quiz/quiz-option-rationale-list";
import { FiguralImageFrame } from "@/components/quiz/figural-image-frame";
import type { PreloadedMaterialData } from "@/components/materials/material-drawer";
import type { TryoutQuestionReviewItem } from "@/lib/services/tryout.service";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquarePlus,
  XCircle,
} from "lucide-react";
import {
  formatDurationMinutesSeconds,
  TRYOUT_OPTION_KEYS,
} from "./tryout-utils";

interface CatReviewCardProps {
  question: TryoutQuestionReviewItem;
  onOpenMaterial: (material: PreloadedMaterialData) => void;
}

export function CatReviewCard({
  question,
  onOpenMaterial,
}: CatReviewCardProps) {
  const isTKP = question.category === "TKP";
  const isOptimal = question.scoreEarned >= 5;
  const [isOpen, setIsOpen] = useState(!isOptimal);

  const bestOption =
    question.correctOption ||
    (question.scoringRubric
      ? (TRYOUT_OPTION_KEYS.find((k) => question.scoringRubric?.[k] === 5) ??
        null)
      : null);

  const tutorHref = `/chat?discussQuestion=${encodeURIComponent(question.slug)}${
    question.selectedOption
      ? `&selectedAnswer=${encodeURIComponent(question.selectedOption)}`
      : ""
  }`;

  return (
    <Card className="gap-4 py-4 shadow-xs">
      <CardHeader className="gap-2 border-b pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-sm font-bold">
              #{question.number}
            </CardTitle>
            <Badge variant="secondary">{question.category}</Badge>
            <Badge variant="outline">{question.subtopic}</Badge>
            <Badge variant="ghost" className="font-mono">
              <Clock />
              {formatDurationMinutesSeconds(question.timeSpentSeconds)}
            </Badge>
          </div>

          {isOptimal ? (
            <Badge className="bg-success text-success-foreground">
              <CheckCircle2 />
              {isTKP ? "5 Poin • Optimal" : "+5 Poin • Benar"}
            </Badge>
          ) : isTKP ? (
            <Badge
              variant={question.scoreEarned <= 2 ? "destructive" : "outline"}
              className={cn(
                question.scoreEarned >= 3 && "border-warning/50 text-warning"
              )}
            >
              {question.scoreEarned}/5 Poin
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle />
              0 Poin ({question.selectedOption ? "Salah" : "Kosong"})
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
          {question.stem}
        </p>

        {question.imageUrl && (
          <FiguralImageFrame
            src={question.imageUrl}
            alt={`Ilustrasi soal ${question.number} (${question.subtopic})`}
          />
        )}

        <div className="flex flex-col gap-2">
          {TRYOUT_OPTION_KEYS.map((key) => {
            const isUserChoice = question.selectedOption === key;
            const isBest = bestOption === key;
            const rubricScore = question.scoringRubric?.[key];

            return (
              <div
                key={key}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border p-2.5 text-xs",
                  isBest
                    ? "border-success/50 bg-success/10 text-foreground"
                    : isUserChoice
                      ? isTKP && (rubricScore ?? 0) >= 3
                        ? "border-warning/50 bg-warning/10 text-foreground"
                        : "border-destructive/50 bg-destructive/10 text-foreground"
                      : "border-border bg-card text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold",
                    isBest
                      ? "border-success bg-success text-success-foreground"
                      : isUserChoice
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground"
                  )}
                >
                  {key}
                </span>
                <span className="flex-1 leading-relaxed text-foreground">
                  {question.options[key]}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {isUserChoice && <Badge variant="outline">Pilihan Anda</Badge>}
                  {isTKP && typeof rubricScore === "number" ? (
                    <Badge variant={rubricScore === 5 ? "default" : "secondary"}>
                      {rubricScore} pt
                    </Badge>
                  ) : isBest ? (
                    <Badge className="bg-success text-success-foreground">
                      Kunci
                    </Badge>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="w-full">
              {isOpen ? (
                <ChevronUp data-icon="inline-start" />
              ) : (
                <ChevronDown data-icon="inline-start" />
              )}
              {isOpen
                ? "Sembunyikan Pembahasan & Rasional A–E"
                : "Lihat Pembahasan & Rasional A–E"}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 p-3 text-xs">
              <span className="font-semibold text-foreground">
                Alur Penalaran &amp; Pembahasan
              </span>
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                {question.reasoningChain}
              </p>
            </div>

            <QuizOptionRationaleList
              optionRationales={question.optionRationales}
              isTKP={isTKP}
              userAnswer={question.selectedOption}
              correctOption={question.correctOption}
              scoringRubric={question.scoringRubric}
            />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      <Separator />

      <CardFooter className="flex flex-wrap items-center justify-end gap-2 pt-0">
        {question.category === "TWK" &&
          question.materials.map((mat) => (
            <Button
              key={mat.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onOpenMaterial({
                  slug: mat.slug,
                  title: mat.title,
                  subtopic: mat.subtopic,
                  summary: mat.summary,
                  contentMarkdown: mat.contentMarkdown,
                  sourceUrl: mat.sourceUrl,
                })
              }
            >
              <BookOpen data-icon="inline-start" />
              Baca Materi Terkait
            </Button>
          ))}

        <Button asChild size="sm">
          <Link href={tutorHref}>
            <MessageSquarePlus data-icon="inline-start" />
            Bedah Bareng Tutor
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
