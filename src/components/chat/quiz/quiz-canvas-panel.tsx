"use client";

import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PracticeQuestionMaterialItem } from "@/lib/services/practice.service";
import {
  MaterialDrawer,
  type PreloadedMaterialData,
} from "@/components/materials/material-drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type {
  PracticeCanvasBindings,
  QuizCanvasPanelProps,
} from "./quiz-canvas-types";
import { QuizCanvasWorkspace } from "./quiz-canvas-workspace";
import type { PracticePackConfigInput } from "./quiz-pack-configurator";
import { practiceItemToQuizAttempt, type QuizCategory } from "./quiz-utils";

export type { PracticeCanvasBindings };

export function QuizCanvasPanel({
  open,
  onOpenChange,
  canvasMode,
  onCanvasModeChange,
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
  practice,
}: QuizCanvasPanelProps) {
  const isMobile = useIsMobile();
  const [showSummary, setShowSummary] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [nextCategory, setNextCategory] = useState<"ALL" | QuizCategory>("ALL");
  const [drawerMaterial, setDrawerMaterial] = useState<PreloadedMaterialData | null>(
    null
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const isPracticeActive =
    canvasMode === "practice" || (quizzes.length === 0 && practice.questions.length > 0);

  const practiceAttemptItems = useMemo(
    () =>
      practice.questions.map((q) =>
        practiceItemToQuizAttempt(q, practice.answers[q.id], practice.sessionId)
      ),
    [practice.questions, practice.answers, practice.sessionId]
  );

  const rawChatIndex = activeQuizId
    ? quizzes.findIndex((q) => q.id === activeQuizId)
    : -1;
  const activeChatIndex =
    rawChatIndex >= 0 ? rawChatIndex : quizzes.length > 0 ? quizzes.length - 1 : -1;
  const activeChatQuiz = activeChatIndex >= 0 ? quizzes[activeChatIndex] : null;
  const activePracticeAttempt = isPracticeActive
    ? (practiceAttemptItems[practice.activeIndex] ?? null)
    : null;

  const currentItems = isPracticeActive ? practiceAttemptItems : quizzes;
  const currentIndex = isPracticeActive ? practice.activeIndex : activeChatIndex;
  const showConfigurator =
    isConfiguring ||
    (isPracticeActive && practice.questions.length === 0 && !practice.isLoadingPack);

  const resolvedChatId = chatId || activeChatQuiz?.chatId || quizzes[0]?.chatId || null;
  const quizHistoryHref = resolvedChatId
    ? `/quiz-history?fromChatId=${encodeURIComponent(resolvedChatId)}`
    : "/quiz-history";

  const handleSelectIndex = (idx: number) => {
    setShowSummary(false);
    setIsConfiguring(false);
    if (isPracticeActive) {
      practice.onSelectIndex(idx);
    } else if (quizzes[idx]) {
      onSelectQuizId(quizzes[idx].id);
    }
  };

  const handleStartPack = async (config: PracticePackConfigInput) => {
    onCanvasModeChange("practice");
    const loaded = await practice.onLoadPack(config);
    if (loaded) {
      setIsConfiguring(false);
      setShowSummary(false);
    }
  };

  const handleOpenMaterial = (material: PracticeQuestionMaterialItem) => {
    setDrawerMaterial(material);
    setIsDrawerOpen(true);
  };

  const renderWorkspace = (isMobileSheet: boolean) => (
    <QuizCanvasWorkspace
      isMobileSheet={isMobileSheet}
      isPracticeActive={isPracticeActive}
      showConfigurator={showConfigurator}
      showSummary={showSummary}
      currentItems={currentItems}
      currentIndex={currentIndex}
      nextCategory={nextCategory}
      onNextCategoryChange={setNextCategory}
      quizHistoryHref={quizHistoryHref}
      activePracticeAttempt={activePracticeAttempt}
      activeChatQuiz={activeChatQuiz}
      activeChatIndex={activeChatIndex}
      quizzes={quizzes}
      gradingQuizId={gradingQuizId}
      gradingOption={gradingOption}
      isGeneratingQuiz={isGeneratingQuiz}
      isChatLoading={isChatLoading}
      practice={practice}
      onSelectIndex={handleSelectIndex}
      onToggleSummary={() => {
        setIsConfiguring(false);
        setShowSummary((prev) => !prev);
      }}
      onOpenConfigurator={() => {
        onCanvasModeChange("practice");
        setShowSummary(false);
        setIsConfiguring((prev) => (practice.questions.length > 0 ? !prev : true));
      }}
      onStartPack={handleStartPack}
      onOpenMaterial={handleOpenMaterial}
      onGradeChatOption={onGradeOption}
      onRequestNextChatQuiz={onRequestNextQuiz}
      onAskChatTutor={onAskTutor}
      onClose={() => onOpenChange(false)}
      onSetShowSummary={setShowSummary}
      onSetIsConfiguring={setIsConfiguring}
      onSelectChatQuizId={onSelectQuizId}
    />
  );

  return (
    <>
      {isMobile ? (
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
      ) : (
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
      )}

      <MaterialDrawer
        slug={drawerMaterial?.slug ?? null}
        preloadedMaterial={drawerMaterial}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onStartPractice={(slug) => {
          setIsDrawerOpen(false);
          onCanvasModeChange("practice");
          setShowSummary(false);
          setIsConfiguring(false);
          void practice.onLoadPack({
            count: 10,
            category: "TWK",
            materialSlug: slug,
          });
        }}
        onDiscussWithTutor={(slug, title) => {
          setIsDrawerOpen(false);
          practice.onDiscussMaterial?.(slug, title);
        }}
      />
    </>
  );
}
