"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCatSession } from "@/hooks/use-cat-session";
import type { TryoutQuestionReviewItem } from "@/lib/services/tryout.service";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Grid3X3,
  RotateCcw,
} from "lucide-react";
import { CatDiagnosticReport } from "./cat-diagnostic-report";
import { CatFinishDialog } from "./cat-finish-dialog";
import { CatNavigationGrid } from "./cat-navigation-grid";
import { CatQuestionStage } from "./cat-question-stage";
import { CatReviewList } from "./cat-review-list";
import { ExamCountdownTimer } from "./exam-countdown-timer";

interface CatExamWorkspaceProps {
  sessionId: string;
}

export function CatExamWorkspace({ sessionId }: CatExamWorkspaceProps) {
  const {
    session,
    isLoading,
    error,
    remainingSeconds,
    activeQuestionIndex,
    activeQuestion,
    isSyncing,
    isFinishing,
    goToQuestion,
    selectOption,
    clearOption,
    toggleFlag,
    finishExam,
    reload,
  } = useCatSession(sessionId);

  const [mobileGridOpen, setMobileGridOpen] = useState(false);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 p-6">
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Gagal Memuat Sesi Tryout</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 pt-1">
            <p>{error || "Sesi tryout tidak ditemukan."}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={reload}>
                <RotateCcw data-icon="inline-start" />
                Coba Lagi
              </Button>
              <Button asChild size="sm">
                <Link href="/tryout">
                  <ArrowLeft data-icon="inline-start" />
                  Kembali ke Lobi
                </Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (session.status === "completed" && session.scoreSummary) {
    return (
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
          <CatDiagnosticReport session={session} />
          <CatReviewList
            questions={session.questions as TryoutQuestionReviewItem[]}
          />
        </div>
      </ScrollArea>
    );
  }

  const modeTitle =
    session.mode === "cat_tryout"
      ? "Full Simulasi CAT BKN"
      : "Mini CAT Tryout";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {modeTitle}
          </span>
          <Badge variant="secondary">
            {session.answeredCount}/{session.totalQuestions} terjawab
          </Badge>
          {isSyncing && (
            <Badge variant="outline">
              <Spinner />
              Menyimpan
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExamCountdownTimer remainingSeconds={remainingSeconds} />

          <Sheet open={mobileGridOpen} onOpenChange={setMobileGridOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="md:hidden"
              >
                <Grid3X3 data-icon="inline-start" />
                Daftar Nomor Soal
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-80 flex-col gap-0 p-0">
              <SheetHeader className="border-b pr-10">
                <SheetTitle>Daftar Nomor Soal</SheetTitle>
              </SheetHeader>
              <CatNavigationGrid
                questions={session.questions}
                activeIndex={activeQuestionIndex}
                onSelectIndex={(idx) => {
                  goToQuestion(idx);
                  setMobileGridOpen(false);
                }}
              />
            </SheetContent>
          </Sheet>

          <Button
            type="button"
            size="sm"
            disabled={isFinishing}
            onClick={() => setFinishDialogOpen(true)}
          >
            <CheckCircle2 data-icon="inline-start" />
            Selesai Ujian
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
            {activeQuestion && (
              <CatQuestionStage
                question={activeQuestion}
                activeIndex={activeQuestionIndex}
                totalQuestions={session.totalQuestions}
                onSelectOption={selectOption}
                onClearOption={clearOption}
                onToggleFlag={toggleFlag}
                onPrev={() => goToQuestion(activeQuestionIndex - 1)}
                onNext={() => goToQuestion(activeQuestionIndex + 1)}
                onRequestFinish={() => setFinishDialogOpen(true)}
              />
            )}
          </div>
        </ScrollArea>

        <aside className="hidden h-full w-80 shrink-0 border-l border-border bg-card md:flex md:flex-col">
          <CatNavigationGrid
            questions={session.questions}
            activeIndex={activeQuestionIndex}
            onSelectIndex={goToQuestion}
          />
        </aside>
      </div>

      <CatFinishDialog
        open={finishDialogOpen}
        onOpenChange={setFinishDialogOpen}
        totalQuestions={session.totalQuestions}
        answeredCount={session.answeredCount}
        flaggedCount={session.flaggedQuestionIds.length}
        isFinishing={isFinishing}
        onConfirmFinish={async () => {
          await finishExam();
          setFinishDialogOpen(false);
        }}
      />
    </div>
  );
}
