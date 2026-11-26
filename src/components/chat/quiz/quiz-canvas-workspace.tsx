"use client";

import type { QuizAttemptItem } from "@/hooks/use-chat";
import type { PracticeQuestionMaterialItem } from "@/lib/services/practice.service";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { QuizCard, QuizCardSkeleton } from "../quiz-card";
import { QuizCanvasFooter } from "./quiz-canvas-footer";
import { QuizCanvasHeader } from "./quiz-canvas-header";
import type { PracticeCanvasBindings } from "./quiz-canvas-types";
import {
  QuizPackConfigurator,
  type PracticePackConfigInput,
} from "./quiz-pack-configurator";
import { QuizSummaryView } from "./quiz-summary-view";
import type { QuizCategory, QuizOptionKey } from "./quiz-utils";

interface QuizCanvasWorkspaceProps {
  isMobileSheet: boolean;
  isPracticeActive: boolean;
  showConfigurator: boolean;
  showSummary: boolean;
  currentItems: QuizAttemptItem[];
  currentIndex: number;
  nextCategory: "ALL" | QuizCategory;
  onNextCategoryChange: (cat: "ALL" | QuizCategory) => void;
  quizHistoryHref: string;
  activePracticeAttempt: QuizAttemptItem | null;
  activeChatQuiz: QuizAttemptItem | null;
  activeChatIndex: number;
  quizzes: QuizAttemptItem[];
  gradingQuizId: string | null;
  gradingOption: QuizOptionKey | null;
  isGeneratingQuiz: boolean;
  isChatLoading: boolean;
  practice: PracticeCanvasBindings;
  onSelectIndex: (idx: number) => void;
  onToggleSummary: () => void;
  onOpenConfigurator: () => void;
  onStartPack: (config: PracticePackConfigInput) => void;
  onOpenMaterial: (material: PracticeQuestionMaterialItem) => void;
  onGradeChatOption: (quizId: string, option: QuizOptionKey) => void;
  onRequestNextChatQuiz: (category?: QuizCategory) => Promise<QuizAttemptItem | null>;
  onAskChatTutor: (quiz: QuizAttemptItem) => void;
  onClose: () => void;
  onSetShowSummary: (val: boolean) => void;
  onSetIsConfiguring: (val: boolean) => void;
  onSelectChatQuizId: (id: string) => void;
}

export function QuizCanvasWorkspace({
  isMobileSheet,
  isPracticeActive,
  showConfigurator,
  showSummary,
  currentItems,
  currentIndex,
  nextCategory,
  onNextCategoryChange,
  quizHistoryHref,
  activePracticeAttempt,
  activeChatQuiz,
  activeChatIndex,
  quizzes,
  gradingQuizId,
  gradingOption,
  isGeneratingQuiz,
  isChatLoading,
  practice,
  onSelectIndex,
  onToggleSummary,
  onOpenConfigurator,
  onStartPack,
  onOpenMaterial,
  onGradeChatOption,
  onRequestNextChatQuiz,
  onAskChatTutor,
  onClose,
  onSetShowSummary,
  onSetIsConfiguring,
  onSelectChatQuizId,
}: QuizCanvasWorkspaceProps) {
  const activeQuestion = isPracticeActive
    ? (practice.questions[practice.activeIndex] ?? null)
    : null;
  const stepperItems = currentItems.map((item) => ({
    id: item.id,
    isAnswered: item.status === "answered",
  }));

  return (
    <div className="flex h-full flex-col bg-background">
      <QuizCanvasHeader
        title={isPracticeActive ? "Paket Latihan SKD" : "Panel Latihan SKD"}
        items={stepperItems}
        activeIndex={currentIndex}
        showSummary={showSummary}
        isConfiguring={showConfigurator}
        isMobileSheet={isMobileSheet}
        onSelectIndex={onSelectIndex}
        onToggleSummary={onToggleSummary}
        onOpenConfigurator={onOpenConfigurator}
        onClose={onClose}
      />

      <Separator />

      <ScrollArea className="min-h-0 flex-1 overflow-hidden">
        <div className="p-4">
          {practice.isLoadingPack ? (
            <QuizCardSkeleton />
          ) : showConfigurator ? (
            <QuizPackConfigurator
              isLoading={practice.isLoadingPack}
              onStartPack={onStartPack}
            />
          ) : showSummary && currentItems.length > 0 ? (
            <QuizSummaryView
              quizzes={currentItems}
              selectedCategory={nextCategory}
              onCategoryChange={onNextCategoryChange}
              onJumpToIndex={onSelectIndex}
              onRetryWrongQuestions={
                isPracticeActive
                  ? async () => {
                      const res = await practice.onRetryWrongQuestions();
                      if (res) onSetShowSummary(false);
                    }
                  : undefined
              }
              onNewPack={
                isPracticeActive
                  ? () => {
                      onSetShowSummary(false);
                      onSetIsConfiguring(true);
                    }
                  : undefined
              }
              onRequestNextQuiz={
                !isPracticeActive
                  ? async (cat) => {
                      const created = await onRequestNextChatQuiz(cat);
                      if (created) {
                        onSelectChatQuizId(created.id);
                        onSetShowSummary(false);
                      }
                    }
                  : undefined
              }
              isGeneratingQuiz={
                isPracticeActive ? practice.isLoadingPack : isGeneratingQuiz
              }
            />
          ) : isPracticeActive && activeQuestion && activePracticeAttempt ? (
            <QuizCard
              quiz={activePracticeAttempt}
              showOpenCanvas={false}
              hint={activeQuestion.hint}
              isHintRevealed={Boolean(practice.revealedHints[activeQuestion.id])}
              onRevealHint={() => practice.onRevealHint(activeQuestion.id)}
              optionRationales={activeQuestion.optionRationales}
              materials={activeQuestion.materials}
              onOpenMaterial={onOpenMaterial}
              syncStatus={practice.answers[activeQuestion.id]?.syncStatus}
              onRetrySync={() => practice.onRetrySync(activeQuestion.id)}
              onSelectOption={practice.onSelectOption}
              onAskTutor={() => {
                practice.onAskTutor(
                  activeQuestion,
                  practice.answers[activeQuestion.id]?.selectedOption ?? null
                );
                if (isMobileSheet) onClose();
              }}
              isChatLoading={isChatLoading}
              onNextQuiz={() => {
                if (currentIndex < currentItems.length - 1) {
                  onSelectIndex(currentIndex + 1);
                } else {
                  onSetShowSummary(true);
                }
              }}
              nextButtonLabel={
                currentIndex < currentItems.length - 1
                  ? `Ke Soal #${currentIndex + 2}`
                  : "Lihat Ringkasan"
              }
            />
          ) : activeChatQuiz ? (
            <QuizCard
              quiz={activeChatQuiz}
              showOpenCanvas={false}
              onSelectOption={onGradeChatOption}
              gradingOption={gradingQuizId === activeChatQuiz.id ? gradingOption : null}
              isGrading={gradingQuizId === activeChatQuiz.id}
              onAskTutor={onAskChatTutor}
              isChatLoading={isChatLoading}
              onNextQuiz={async (cat) => {
                if (activeChatIndex < quizzes.length - 1) {
                  onSelectChatQuizId(quizzes[activeChatIndex + 1].id);
                  return;
                }
                const created = await onRequestNextChatQuiz(cat);
                if (created) {
                  onSelectChatQuizId(created.id);
                  onSetShowSummary(false);
                }
              }}
              isGeneratingNext={isGeneratingQuiz}
              nextButtonLabel={
                activeChatIndex < quizzes.length - 1
                  ? `Ke Soal #${activeChatIndex + 2}`
                  : "Soal Berikutnya"
              }
            />
          ) : null}
        </div>
      </ScrollArea>

      <Separator />

      <QuizCanvasFooter
        totalItems={currentItems.length}
        activeIndex={currentIndex}
        showSummary={showSummary}
        isConfiguring={showConfigurator}
        quizHistoryHref={quizHistoryHref}
        onPrev={() => onSelectIndex(Math.max(0, currentIndex - 1))}
        onNext={() =>
          onSelectIndex(Math.min(currentItems.length - 1, currentIndex + 1))
        }
        onToggleSummary={onToggleSummary}
        onCloseSheet={onClose}
      />
    </div>
  );
}
