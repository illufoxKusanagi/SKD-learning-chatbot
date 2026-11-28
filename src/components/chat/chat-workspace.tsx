'use client';

import { Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { ChatHeader } from '@/components/chat/chat-header';
import ChatInput from '@/components/chat/chat-input';
import { ChatHistory } from '@/components/chat/chat-message-list';
import { QuizCanvasPanel } from '@/components/chat/quiz/quiz-canvas-panel';
import type { QuizCategory, QuizOptionKey } from '@/components/chat/quiz/quiz-utils';
import { useChat } from '@/hooks/use-chat';
import { useChatUrlActions } from '@/hooks/use-chat-url-actions';
import { usePracticePack } from '@/hooks/use-practice-pack';
import type { PracticeQuestionItem } from '@/lib/services/practice.service';

export function ChatWorkspace() {
  const {
    activeChatId,
    messages,
    isLoading,
    chatTitle,
    quizzes,
    isLoadingQuizzes,
    gradingQuizId,
    gradingOption,
    isGeneratingQuiz,
    submitQuizAnswer,
    requestNextQuiz,
    askTutorAboutQuiz,
    handleSendMessage,
    retryLastMessage,
  } = useChat();

  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const user = session?.user;

  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [canvasMode, setCanvasMode] = useState<'practice' | 'chat'>('practice');
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const practicePack = usePracticePack({ chatId: activeChatId });

  const handleOpenPracticeCanvas = useCallback(() => {
    setCanvasMode('practice');
    setIsCanvasOpen(true);
  }, []);

  useChatUrlActions({
    authStatus: status,
    loadPack: practicePack.loadPack,
    handleSendMessage,
    onOpenPracticeCanvas: handleOpenPracticeCanvas,
  });

  const pendingQuizCount = quizzes.filter((q) => q.status === 'pending').length;
  const quizHistoryHref = activeChatId
    ? `/quiz-history?fromChatId=${encodeURIComponent(activeChatId)}`
    : '/quiz-history';

  const openQuizInCanvas = (quizId?: string) => {
    if (quizId) {
      setActiveQuizId(quizId);
      setCanvasMode('chat');
    } else if (practicePack.questions.length > 0 || quizzes.length === 0) {
      setCanvasMode('practice');
    } else {
      setActiveQuizId(quizzes[quizzes.length - 1]?.id ?? null);
      setCanvasMode('chat');
    }
    setIsCanvasOpen(true);
  };

  const handleAskTutorPractice = (
    question: PracticeQuestionItem,
    selectedAnswer: QuizOptionKey | null
  ) => {
    const bestOption =
      question.correctOption ||
      (question.scoringRubric
        ? (Object.entries(question.scoringRubric).find(([, s]) => s === 5)?.[0] ??
          'terbaik')
        : 'terbaik');
    const prompt = selectedAnswer
      ? `Tolong bahas lebih dalam soal ${question.category} (${question.subtopic}) tadi. Mengapa opsi ${bestOption} paling tepat dibanding pilihan saya (${selectedAnswer}) dan apa trik cepat SKD-nya?`
      : `Tolong berikan petunjuk konsep untuk menjawab soal ${question.category} (${question.subtopic}) tanpa langsung menyebutkan jawabannya.`;

    void handleSendMessage(prompt, undefined, {
      questionId: question.id,
      questionSlug: question.slug,
      materialSlugs: question.materials.map((m) => m.slug),
      selectedAnswer,
      isTutorDiscussion: true,
    });
  };

  const handleDiscussMaterialFromDrawer = (slug: string, title: string) => {
    void handleSendMessage(
      `Tolong bedah inti konsep, logika sebab-akibat, dan jebakan soal HOTS pada materi TWK "${title}".`,
      undefined,
      { materialSlugs: [slug], isTutorDiscussion: true }
    );
  };

  const handleNextQuizFromStream = async (category: QuizCategory) => {
    const created = await requestNextQuiz({
      category,
      insertChatMarker: true,
    });
    if (created && isCanvasOpen) {
      setActiveQuizId(created.id);
    }
  };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      {!isAuthenticated && (
        <Alert className="rounded-none border-x-0 border-t-0 bg-warning/10 py-2">
          <AlertTriangle className="text-warning" />
          <AlertDescription className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-foreground">
            <span>
              Mode Tamu: Percakapan &amp; latihan soal disimpan sementara (24 jam).
            </span>
            <Link
              href="/auth/login"
              className="font-semibold text-primary underline hover:no-underline"
            >
              Login untuk simpan permanen
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <SidebarProvider defaultOpen={true} className="!min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full w-full flex-row overflow-hidden">
          {isAuthenticated ? <AppSidebar /> : null}

          <main className="relative flex h-full min-w-0 flex-1 flex-col">
            <ChatHeader
              isAuthenticated={isAuthenticated}
              userName={user?.name || user?.email?.split('@')[0] || 'User'}
              chatTitle={chatTitle}
              isCanvasOpen={isCanvasOpen}
              onToggleCanvas={() =>
                isCanvasOpen ? setIsCanvasOpen(false) : openQuizInCanvas()
              }
              canvasMode={canvasMode}
              practiceCount={practicePack.questions.length}
              answeredPracticeCount={Object.keys(practicePack.answers).length}
              quizzesLength={quizzes.length}
              pendingQuizCount={pendingQuizCount}
              quizHistoryHref={quizHistoryHref}
            />

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <Suspense
                  fallback={
                    <div className="p-4 text-xs text-muted-foreground">
                      Memuat chat...
                    </div>
                  }
                >
                  <ChatHistory
                    isLoading={isLoading}
                    isLoadingQuizzes={isLoadingQuizzes}
                    messages={messages}
                    quizzes={quizzes}
                    gradingQuizId={gradingQuizId}
                    gradingOption={gradingOption}
                    isGeneratingQuiz={isGeneratingQuiz}
                    onSelectQuizOption={submitQuizAnswer}
                    onOpenCanvas={openQuizInCanvas}
                    onAskTutor={askTutorAboutQuiz}
                    onNextQuiz={handleNextQuizFromStream}
                    onRetryLastMessage={retryLastMessage}
                  />
                </Suspense>

                <div className="flex w-full justify-center px-4 pt-2 pb-4">
                  <ChatInput
                    onSendMessage={handleSendMessage}
                    onSendQuickPrompt={(prompt) => handleSendMessage(prompt)}
                    isLoading={isLoading}
                  />
                </div>

                <footer className="flex h-6 w-full shrink-0 items-center justify-center pb-2">
                  <p className="text-[11px] text-muted-foreground">
                    Tutor SKD CPNS • Soal HOTS TWK, TIU, TKP &amp; Evaluasi Terkunci
                  </p>
                </footer>
              </div>

              <QuizCanvasPanel
                open={isCanvasOpen}
                onOpenChange={setIsCanvasOpen}
                canvasMode={canvasMode}
                onCanvasModeChange={setCanvasMode}
                chatId={activeChatId}
                quizzes={quizzes}
                activeQuizId={activeQuizId}
                onSelectQuizId={setActiveQuizId}
                onGradeOption={submitQuizAnswer}
                gradingQuizId={gradingQuizId}
                gradingOption={gradingOption}
                onRequestNextQuiz={(cat) =>
                  requestNextQuiz({ category: cat, insertChatMarker: true })
                }
                isGeneratingQuiz={isGeneratingQuiz}
                onAskTutor={askTutorAboutQuiz}
                isChatLoading={isLoading}
                practice={{
                  sessionId: practicePack.sessionId,
                  questions: practicePack.questions,
                  answers: practicePack.answers,
                  revealedHints: practicePack.revealedHints,
                  activeIndex: practicePack.activeIndex,
                  isLoadingPack: practicePack.isLoadingPack,
                  onSelectIndex: practicePack.setActiveIndex,
                  onLoadPack: practicePack.loadPack,
                  onSelectOption: practicePack.selectOptionInstant,
                  onRevealHint: practicePack.revealHint,
                  onRetrySync: practicePack.retrySync,
                  onRetryWrongQuestions: practicePack.retryWrongQuestions,
                  onAskTutor: handleAskTutorPractice,
                  onDiscussMaterial: handleDiscussMaterialFromDrawer,
                }}
              />
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
