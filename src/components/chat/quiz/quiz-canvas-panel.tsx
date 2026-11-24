"use client";

import { useState } from "react";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import type { QuizAttemptItem } from "@/hooks/use-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  ExternalLink,
  HelpCircle,
  X,
} from "lucide-react";
import { QuizCard } from "../quiz-card";
import { QuizSummaryView } from "./quiz-summary-view";
import type { QuizCategory, QuizOptionKey } from "./quiz-utils";

interface QuizCanvasPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId?: string | null;
  quizzes: QuizAttemptItem[];
  activeQuizId: string | null;
  onSelectQuizId: (quizId: string) => void;
  onGradeOption: (quizId: string, option: QuizOptionKey) => void;
  gradingQuizId: string | null;
  gradingOption: QuizOptionKey | null;
  onRequestNextQuiz: (category?: QuizCategory) => Promise<QuizAttemptItem | null>;
  isGeneratingQuiz: boolean;
  onAskTutor: (quiz: QuizAttemptItem) => void;
  isChatLoading: boolean;
}

export function QuizCanvasPanel({
  open,
  onOpenChange,
  chatId,
  quizzes,
  activeQuizId,
  onSelectQuizId,
  onGradeOption,
  gradingQuizId,
  gradingOption,
  onRequestNextQuiz,
  isGeneratingQuiz,
  onAskTutor,
  isChatLoading,
}: QuizCanvasPanelProps) {
  const isMobile = useIsMobile();
  const [showSummary, setShowSummary] = useState(false);
  const [nextCategory, setNextCategory] = useState<"ALL" | QuizCategory>("ALL");

  const rawIndex = activeQuizId
    ? quizzes.findIndex((q) => q.id === activeQuizId)
    : -1;
  const activeIndex =
    rawIndex >= 0 ? rawIndex : quizzes.length > 0 ? quizzes.length - 1 : -1;
  const activeQuiz = activeIndex >= 0 ? quizzes[activeIndex] : null;
  const resolvedChatId = chatId || activeQuiz?.chatId || quizzes[0]?.chatId || null;
  const quizHistoryHref = resolvedChatId
    ? `/quiz-history?fromChatId=${encodeURIComponent(resolvedChatId)}`
    : "/quiz-history";
  const answeredCount = quizzes.filter((q) => q.status === "answered").length;
  const progressPercent =
    quizzes.length > 0 ? Math.round((answeredCount / quizzes.length) * 100) : 0;

  const handleGenerateNext = async (category?: QuizCategory) => {
    const created = await onRequestNextQuiz(category);
    if (created) {
      onSelectQuizId(created.id);
      setShowSummary(false);
    }
  };

  const handleCardNext = async (category: QuizCategory) => {
    if (activeIndex >= 0 && activeIndex < quizzes.length - 1) {
      onSelectQuizId(quizzes[activeIndex + 1].id);
      return;
    }
    await handleGenerateNext(category);
  };

  const renderWorkspace = (isMobileSheet: boolean) => (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-4 py-3",
          isMobileSheet && "pr-10"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Award className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold text-foreground">
            Panel Latihan SKD
          </span>
          {quizzes.length > 0 && !showSummary && (
            <Badge variant="secondary">
              {activeIndex + 1}/{quizzes.length}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {quizzes.length > 0 && (
            <Button
              type="button"
              variant={showSummary ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowSummary((prev) => !prev)}
            >
              <BarChart3 data-icon="inline-start" />
              Ringkasan
            </Button>
          )}
          {!isMobileSheet && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Tutup panel kuis"
              onClick={() => onOpenChange(false)}
            >
              <X />
            </Button>
          )}
        </div>
      </div>

      {/* Stepper Progress & Question Pills */}
      {quizzes.length > 0 && (
        <div className="flex flex-col gap-2 px-4 pb-3">
          <Progress value={progressPercent} />
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {quizzes.map((q, idx) => {
              const isCurrent = !showSummary && idx === activeIndex;
              const isDone = q.status === "answered";
              return (
                <Button
                  key={q.id}
                  type="button"
                  variant={isCurrent ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    onSelectQuizId(q.id);
                    setShowSummary(false);
                  }}
                  className={cn(
                    "h-7 px-2.5 text-xs",
                    !isCurrent && isDone && "border-success/50 text-success"
                  )}
                >
                  #{idx + 1}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <Separator />

      {/* Main Content */}
      <ScrollArea className="min-h-0 flex-1 overflow-hidden">
        <div className="p-4">
          {quizzes.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HelpCircle />
                </EmptyMedia>
                <EmptyTitle>Belum Ada Soal di Sesi Ini</EmptyTitle>
                <EmptyDescription>
                  Pilih subtes di bawah untuk langsung memulai latihan interaktif 1 soal per langkah.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex-row flex-wrap justify-center gap-2">
                {(["TWK", "TIU", "TKP"] as const).map((cat) => (
                  <Button
                    key={cat}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isGeneratingQuiz}
                    onClick={() => handleGenerateNext(cat)}
                  >
                    {isGeneratingQuiz && <Spinner data-icon="inline-start" />}
                    Latihan {cat}
                  </Button>
                ))}
              </EmptyContent>
            </Empty>
          ) : showSummary ? (
            <QuizSummaryView
              quizzes={quizzes}
              selectedCategory={nextCategory}
              onCategoryChange={setNextCategory}
              onJumpToIndex={(idx) => {
                const target = quizzes[idx];
                if (target) {
                  onSelectQuizId(target.id);
                  setShowSummary(false);
                }
              }}
              onRequestNextQuiz={handleGenerateNext}
              isGeneratingQuiz={isGeneratingQuiz}
            />
          ) : activeQuiz ? (
            <QuizCard
              quiz={activeQuiz}
              showOpenCanvas={false}
              onSelectOption={onGradeOption}
              gradingOption={gradingQuizId === activeQuiz.id ? gradingOption : null}
              isGrading={gradingQuizId === activeQuiz.id}
              onAskTutor={onAskTutor}
              isChatLoading={isChatLoading}
              onNextQuiz={handleCardNext}
              isGeneratingNext={isGeneratingQuiz}
              nextButtonLabel={
                activeIndex < quizzes.length - 1
                  ? `Ke Soal #${activeIndex + 2}`
                  : "Soal Berikutnya"
              }
            />
          ) : null}
        </div>
      </ScrollArea>

      <Separator />

      {/* Sticky Stepper Footer */}
      <div className="flex items-center justify-between gap-2 bg-muted/20 px-4 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={showSummary || activeIndex <= 0}
          onClick={() => {
            if (activeIndex > 0) {
              onSelectQuizId(quizzes[activeIndex - 1].id);
            }
          }}
        >
          <ArrowLeft data-icon="inline-start" />
          Sebelumnya
        </Button>

        <Button asChild variant="ghost" size="sm">
          <Link href={quizHistoryHref} onClick={() => onOpenChange(false)}>
            Riwayat
            <ExternalLink data-icon="inline-end" />
          </Link>
        </Button>

        {quizzes.length > 0 && activeIndex < quizzes.length - 1 && !showSummary ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelectQuizId(quizzes[activeIndex + 1].id)}
          >
            Selanjutnya
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={quizzes.length === 0}
            onClick={() => setShowSummary((prev) => !prev)}
          >
            <BarChart3 data-icon="inline-start" />
            {showSummary ? "Kembali ke Soal" : "Ringkasan"}
          </Button>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-lg [&>button]:top-3.5 [&>button]:right-3.5"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Panel Latihan SKD</SheetTitle>
            <SheetDescription>
              Latihan soal interaktif SKD CPNS langkah demi langkah
            </SheetDescription>
          </SheetHeader>
          {renderWorkspace(true)}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      aria-label="Panel Latihan SKD"
      aria-hidden={!open || undefined}
      inert={!open || undefined}
      className={cn(
        "hidden h-full shrink-0 overflow-hidden bg-background transition-[width,border-color] duration-300 ease-in-out md:flex",
        open
          ? "w-[380px] border-l border-border lg:w-[440px] xl:w-[490px]"
          : "w-0 border-l-0"
      )}
    >
      <div
        className={cn(
          "flex h-full w-[380px] shrink-0 flex-col transition-[transform,opacity] duration-300 ease-in-out lg:w-[440px] xl:w-[490px]",
          open
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-6 opacity-0"
        )}
      >
        {renderWorkspace(false)}
      </div>
    </aside>
  );
}
