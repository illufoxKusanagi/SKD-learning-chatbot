"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Sparkles,
  XCircle,
} from "lucide-react";
import { FiguralImageFrame } from "@/components/quiz/figural-image-frame";
import { QuizHistoryOptions } from "@/components/quiz-history/quiz-history-options";
import {
  formatQuizDate,
  getCategoryColor,
  isValidChatUuid,
  type QuizAttemptDetail,
} from "@/components/quiz-history/quiz-history-types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface QuizHistoryCardProps {
  quiz: QuizAttemptDetail;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (quizId: string) => void;
}

export function QuizHistoryCard({
  quiz,
  index,
  isExpanded,
  onToggleExpand,
}: QuizHistoryCardProps) {
  const isAnswered = quiz.status === "answered";
  const isTWKorTIU = quiz.category === "TWK" || quiz.category === "TIU";
  const isTKP = quiz.category === "TKP";
  const isCorrect =
    isTWKorTIU &&
    (quiz.scoreEarned === 5 || quiz.userAnswer === quiz.correctOption);

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-xs transition-all hover:border-primary/40">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-5 py-3 [.border-b]:pb-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-xs font-bold text-muted-foreground">
            #{index + 1}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "rounded-md font-bold tracking-wider",
              getCategoryColor(quiz.category)
            )}
          >
            {quiz.category}
          </Badge>
          {quiz.subtopic && (
            <Badge
              variant="outline"
              className="rounded-md bg-background font-medium text-muted-foreground"
            >
              {quiz.subtopic}
            </Badge>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="size-3" />
            {formatQuizDate(quiz.createdAt)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isAnswered ? (
            isTWKorTIU ? (
              <Badge
                variant="outline"
                className={cn(
                  "font-bold",
                  isCorrect
                    ? "border-success/30 bg-success/15 text-success"
                    : "border-destructive/30 bg-destructive/15 text-destructive"
                )}
              >
                {isCorrect ? <CheckCircle2 /> : <XCircle />}
                {isCorrect ? "+5 Poin (Benar)" : "0 Poin (Salah)"}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-success/30 bg-success/15 font-bold text-success"
              >
                <Award />
                Skor TKP: {quiz.scoreEarned ?? 0}/5 Poin
              </Badge>
            )
          ) : (
            <Badge
              variant="outline"
              className="border-warning/30 bg-warning/15 font-semibold text-warning"
            >
              <HelpCircle />
              Menunggu Jawaban
            </Badge>
          )}

          {isValidChatUuid(quiz.chatId) ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs text-primary hover:text-primary"
            >
              <Link href={`/chat?id=${quiz.chatId}`}>
                <span>Buka di Chat</span>
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          ) : (
            <Badge
              variant="outline"
              className="rounded-md bg-background text-[11px] font-medium text-muted-foreground"
            >
              Sesi Latihan Mandiri
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 p-5">
        <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-foreground">
          {quiz.questionStem}
        </p>

        {quiz.imageUrl && (
          <FiguralImageFrame
            src={quiz.imageUrl}
            alt={`Ilustrasi soal ${quiz.subtopic || quiz.category}`}
          />
        )}

        <QuizHistoryOptions quiz={quiz} isAnswered={isAnswered} isTKP={isTKP} />

        {!isAnswered && (
          <Alert className="border-warning/30 bg-warning/10 text-foreground [&>svg]:text-warning">
            <AlertTriangle />
            <AlertDescription className="flex w-full flex-wrap items-center justify-between gap-3 text-xs text-foreground">
              <span>
                Soal ini belum dijawab. Kunci jawaban dan skor disembunyikan
                sampai Anda menjawab.
              </span>
              <Button
                asChild
                size="sm"
                className="h-7 shrink-0 text-xs font-semibold"
              >
                <Link
                  href={
                    isValidChatUuid(quiz.chatId)
                      ? `/chat?id=${quiz.chatId}`
                      : "/chat"
                  }
                >
                  {isValidChatUuid(quiz.chatId)
                    ? "Jawab di Chat"
                    : "Buka Tutor Chat"}
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isAnswered && (quiz.rubricRationale || quiz.aiExplanation) && (
          <Collapsible
            open={isExpanded}
            onOpenChange={() => onToggleExpand(quiz.id)}
            className="flex flex-col gap-3"
          >
            <Separator />
            <div>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-xs font-semibold text-primary hover:text-primary"
                >
                  <Sparkles data-icon="inline-start" />
                  <span>
                    {isExpanded
                      ? "Tutup Pembahasan & Rasional Rubrik"
                      : "Lihat Pembahasan & Rasional Rubrik"}
                  </span>
                  {isExpanded ? (
                    <ChevronUp data-icon="inline-end" />
                  ) : (
                    <ChevronDown data-icon="inline-end" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent>
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/50 p-4 text-xs">
                {quiz.rubricRationale && (
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-foreground">
                      Rasional Skor &amp; Kunci Jawaban:
                    </span>
                    <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                      {quiz.rubricRationale}
                    </p>
                  </div>
                )}
                {quiz.aiExplanation && (
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-foreground">
                      Penjelasan Lengkap Tutor:
                    </span>
                    <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                      {quiz.aiExplanation}
                    </p>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
