'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AppSidebar } from '@/components/ui/app-sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import HelpButton from '@/components/ui/help-button';
import ModeToggleButton from '@/components/ui/mode-toggle-button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import ChatInput from '@/components/chat/chat-input';
import { QuizCard, QuizCardSkeleton } from '@/components/chat/quiz-card';
import { QuizCanvasPanel } from '@/components/chat/quiz/quiz-canvas-panel';
import {
  parseMessageQuizMarkers,
  stripRedundantQuizMarkdown,
  type ChatStreamErrorPayload,
  type QuizCategory,
  type QuizOptionKey,
} from '@/components/chat/quiz/quiz-utils';
import { useChat, type QuizAttemptItem } from '@/hooks/use-chat';
import { usePracticePack } from '@/hooks/use-practice-pack';
import type { PracticeQuestionItem } from '@/lib/services/practice.service';
import type { Message } from '@/lib/types/chat';
import { cn } from '@/lib/utils';
import { AlertTriangle, Award, BookOpen, History, Library, RotateCcw } from 'lucide-react';

interface TextBubbleProps extends Message {
  isThinking?: boolean;
  hasAttemptMarker?: boolean;
  matchedQuiz?: QuizAttemptItem;
  isLoadingQuiz?: boolean;
  onSelectQuizOption?: (quizId: string, option: QuizOptionKey) => void;
  onOpenCanvas?: (quizId: string) => void;
  onAskTutor?: (quiz: QuizAttemptItem) => void;
  onNextQuiz?: (category: QuizCategory) => void;
  gradingQuizId?: string | null;
  gradingOption?: QuizOptionKey | null;
  isGeneratingNext?: boolean;
  isChatLoading?: boolean;
  chatError?: ChatStreamErrorPayload | null;
  onRetry?: () => void;
}

function TextBubble({
  role,
  content,
  isThinking = false,
  hasAttemptMarker = false,
  matchedQuiz,
  isLoadingQuiz = false,
  onSelectQuizOption,
  onOpenCanvas,
  onAskTutor,
  onNextQuiz,
  gradingQuizId = null,
  gradingOption = null,
  isGeneratingNext = false,
  isChatLoading = false,
  chatError = null,
  onRetry,
}: TextBubbleProps) {
  const isUser = role === 'user';
  const displayContent = !isUser
    ? stripRedundantQuizMarkdown(content, hasAttemptMarker)
    : content;

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-3',
        isUser ? 'items-end' : 'items-start'
      )}
    >
      {displayContent.length > 0 && (
        <div
          className={cn(
            'max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[75%]',
            isUser
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'border border-border bg-muted/70 text-foreground',
            isThinking && 'shimmer'
          )}
        >
          <section className="prose prose-sm max-w-none break-words dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkBreaks, remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeHighlight]}
              components={{
                h1: ({ ...props }) => (
                  <h1 className="my-2 text-xl font-bold" {...props} />
                ),
                h2: ({ ...props }) => (
                  <h2 className="my-2 text-lg font-bold" {...props} />
                ),
                h3: ({ ...props }) => (
                  <h3 className="my-1.5 text-base font-bold" {...props} />
                ),
                ul: ({ ...props }) => (
                  <ul className="my-2 list-disc pl-4" {...props} />
                ),
                ol: ({ ...props }) => (
                  <ol className="my-2 list-decimal pl-4" {...props} />
                ),
                p: ({ ...props }) => (
                  <p className="mb-2 leading-relaxed last:mb-0" {...props} />
                ),
                a: ({ ...props }) => (
                  <a
                    className="text-primary underline transition-colors hover:text-primary/80"
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                  />
                ),
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  return match ? (
                    <pre className="my-2 overflow-x-auto rounded-lg bg-secondary p-3 text-xs text-secondary-foreground">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  ) : (
                    <code
                      className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {displayContent}
            </ReactMarkdown>
          </section>
        </div>
      )}

      {!isUser && chatError && (
        <Alert variant="destructive" className="max-w-xl bg-destructive/5">
          <AlertTriangle />
          <AlertTitle>{chatError.title}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 pt-1">
            <p>{chatError.message}</p>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isChatLoading}
                onClick={onRetry}
                className="w-fit text-foreground"
              >
                <RotateCcw data-icon="inline-start" />
                Coba Lagi
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Standalone Gemini-style Interactive Quiz Card outside the grey bubble */}
      {!isUser && matchedQuiz && (
        <div className="w-full max-w-2xl">
          <QuizCard
            quiz={matchedQuiz}
            onSelectOption={onSelectQuizOption}
            onOpenCanvas={onOpenCanvas}
            onAskTutor={onAskTutor}
            onNextQuiz={onNextQuiz}
            gradingOption={
              gradingQuizId === matchedQuiz.id ? gradingOption : null
            }
            isGrading={gradingQuizId === matchedQuiz.id}
            isGeneratingNext={isGeneratingNext}
            isChatLoading={isChatLoading}
          />
        </div>
      )}

      {!isUser && !matchedQuiz && hasAttemptMarker && isLoadingQuiz && (
        <div className="w-full max-w-2xl">
          <QuizCardSkeleton />
        </div>
      )}
    </div>
  );
}

function ChatHistory({
  isLoading,
  isLoadingQuizzes,
  messages,
  quizzes,
  gradingQuizId,
  gradingOption,
  isGeneratingQuiz,
  onSelectQuizOption,
  onOpenCanvas,
  onAskTutor,
  onNextQuiz,
  onRetryLastMessage,
}: {
  isLoading: boolean;
  isLoadingQuizzes: boolean;
  messages: Message[];
  quizzes: QuizAttemptItem[];
  gradingQuizId: string | null;
  gradingOption: QuizOptionKey | null;
  isGeneratingQuiz: boolean;
  onSelectQuizOption: (quizId: string, option: QuizOptionKey) => void;
  onOpenCanvas: (quizId: string) => void;
  onAskTutor: (quiz: QuizAttemptItem) => void;
  onNextQuiz: (category: QuizCategory) => void;
  onRetryLastMessage: () => void;
}) {
  const lastMessage = messages[messages.length - 1];
  const showThinking =
    isLoading &&
    (!lastMessage ||
      lastMessage.role === 'user' ||
      (lastMessage.role === 'bot' && !lastMessage.content));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 sm:p-6">
      {messages.map((msg, index) => {
        if (msg.role === 'bot' && !msg.content && isLoading) return null;

        const { cleanContent, attemptId, quizId, chatError } =
          parseMessageQuizMarkers(msg.content);
        if (
          msg.role === 'bot' &&
          !cleanContent &&
          !attemptId &&
          !quizId &&
          !chatError
        ) {
          return null;
        }
        const matchedQuiz =
          msg.role === 'bot' && quizId
            ? quizzes.find((q) => q.id === quizId)
            : undefined;

        return (
          <TextBubble
            key={index}
            role={msg.role}
            content={cleanContent}
            timestamp={msg.timestamp}
            hasAttemptMarker={Boolean(attemptId)}
            matchedQuiz={matchedQuiz}
            isLoadingQuiz={isLoadingQuizzes}
            onSelectQuizOption={onSelectQuizOption}
            onOpenCanvas={onOpenCanvas}
            onAskTutor={onAskTutor}
            onNextQuiz={onNextQuiz}
            gradingQuizId={gradingQuizId}
            gradingOption={gradingOption}
            isGeneratingNext={isGeneratingQuiz}
            isChatLoading={isLoading}
            chatError={chatError}
            onRetry={onRetryLastMessage}
          />
        );
      })}

      {showThinking && (
        <TextBubble
          role="bot"
          content="Tutor SKD sedang menganalisis dan menyiapkan respon..."
          isThinking
        />
      )}
    </div>
  );
}

function ChatContent() {
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

  const router = useRouter();
  const searchParams = useSearchParams();
  const practiceMaterial = searchParams.get('practiceMaterial');
  const discussMaterial = searchParams.get('discussMaterial');
  const discussTitle = searchParams.get('title');
  const chatIdParam = searchParams.get('id');
  const handledMaterialParamRef = useRef<string | null>(null);

  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [canvasMode, setCanvasMode] = useState<'practice' | 'chat'>('practice');
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const practicePack = usePracticePack({ chatId: activeChatId });
  const { loadPack } = practicePack;

  useEffect(() => {
    if (status === 'loading') return;

    if (practiceMaterial) {
      const key = `practice:${practiceMaterial}`;
      if (handledMaterialParamRef.current === key) return;
      handledMaterialParamRef.current = key;

      setCanvasMode('practice');
      setIsCanvasOpen(true);
      loadPack({
        count: 10,
        category: 'TWK',
        materialSlug: practiceMaterial,
      }).finally(() => {
        router.replace(
          chatIdParam ? `/chat?id=${encodeURIComponent(chatIdParam)}` : '/chat'
        );
      });
      return;
    }

    if (discussMaterial) {
      const key = `discuss:${discussMaterial}`;
      if (handledMaterialParamRef.current === key) return;
      handledMaterialParamRef.current = key;

      const label = discussTitle || discussMaterial;
      if (chatIdParam) {
        router.replace(`/chat?id=${encodeURIComponent(chatIdParam)}`);
      }
      handleSendMessage(
        `Tolong bedah inti konsep, logika sebab-akibat, dan jebakan soal HOTS pada materi TWK "${label}".`,
        undefined,
        { materialSlugs: [discussMaterial], isTutorDiscussion: true }
      );
    }
  }, [
    status,
    practiceMaterial,
    discussMaterial,
    discussTitle,
    chatIdParam,
    loadPack,
    handleSendMessage,
    router,
  ]);

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
        ? (Object.entries(question.scoringRubric).find(([, s]) => s === 5)?.[0] ?? 'terbaik')
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
      {/* Guest User Notice */}
      {!isAuthenticated && (
        <Alert className="rounded-none border-x-0 border-t-0 bg-warning/10 py-2">
          <AlertTriangle className="text-warning" />
          <AlertDescription className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-foreground">
            <span>
              Mode Tamu: Percakapan & latihan soal disimpan sementara (24 jam).
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

      <SidebarProvider
        defaultOpen={true}
        className="!min-h-0 flex-1 overflow-hidden"
      >
        <div className="flex h-full w-full flex-row overflow-hidden">
          {isAuthenticated ? <AppSidebar /> : null}

          <main className="relative flex h-full min-w-0 flex-1 flex-col">
            {/* Unified Single Top Header */}
            <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur">
              <div className="flex min-w-0 items-center gap-2.5">
                {isAuthenticated ? <SidebarTrigger /> : null}
                <Award className="size-4 shrink-0 text-primary" />
                <p className="truncate text-sm font-semibold text-foreground">
                  {chatTitle || 'Sesi Belajar Baru'}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant={isCanvasOpen ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() =>
                    isCanvasOpen ? setIsCanvasOpen(false) : openQuizInCanvas()
                  }
                >
                  <BookOpen data-icon="inline-start" />
                  <span>Panel Kuis</span>
                  {(practicePack.questions.length > 0 || quizzes.length > 0) && (
                    <Badge variant="secondary">
                      {canvasMode === 'practice' && practicePack.questions.length > 0
                        ? `${Object.keys(practicePack.answers).length}/${practicePack.questions.length}`
                        : quizzes.length}
                    </Badge>
                  )}
                  {pendingQuizCount > 0 && canvasMode === 'chat' && (
                    <Badge variant="default">{pendingQuizCount} baru</Badge>
                  )}
                </Button>

                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                >
                  <Link href="/materi">
                    <Library data-icon="inline-start" />
                    Bank Materi
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                >
                  <Link href={quizHistoryHref}>
                    <History data-icon="inline-start" />
                    Riwayat SKD
                  </Link>
                </Button>

                <ModeToggleButton />
                <HelpButton />

                {isAuthenticated ? (
                  <span className="hidden px-1.5 text-xs font-semibold text-foreground md:inline">
                    {user?.name || user?.email?.split('@')[0] || 'User'}
                  </span>
                ) : (
                  <Button asChild size="sm">
                    <Link href="/auth/login">Login</Link>
                  </Button>
                )}
              </div>
            </header>

            {/* Split Workspace: Chat Stream + Side-by-Side Quiz Canvas */}
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <ScrollArea className="min-h-0 flex-1">
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
                </ScrollArea>

                <div className="flex w-full justify-center px-4 pt-2 pb-4">
                  <ChatInput
                    onSendMessage={handleSendMessage}
                    onSendQuickPrompt={(prompt) => handleSendMessage(prompt)}
                    isLoading={isLoading}
                  />
                </div>

                <footer className="flex h-6 w-full shrink-0 items-center justify-center pb-2">
                  <p className="text-[11px] text-muted-foreground">
                    Tutor SKD CPNS • Soal HOTS TWK, TIU, TKP & Evaluasi Terkunci
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
                  requestNextQuiz({
                    category: cat,
                    insertChatMarker: true,
                  })
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

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted-foreground">
          Memuat aplikasi...
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
