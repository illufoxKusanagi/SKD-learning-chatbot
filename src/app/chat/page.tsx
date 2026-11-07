"use client";

import { AppSidebar } from "@/components/ui/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Suspense, useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import ChatInput from "@/components/chat/chat-input";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Message } from "@/lib/types/chat";
import { useChat, QuizAttemptItem } from "@/hooks/use-chat";
import { QuizCard } from "@/components/chat/quiz-card";
import { ChatQuizDrawer } from "@/components/chat/chat-quiz-drawer";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { useSearchParams, useRouter } from "next/navigation";
import ModeToggleButton from "@/components/ui/mode-toggle-button";
import HelpButton from "@/components/ui/help-button";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { History, Award } from "lucide-react";

function parseMessageQuizMarkers(content: string) {
  let attemptId: string | null = null;
  let evalQuizId: string | null = null;
  let evalOption: "A" | "B" | "C" | "D" | "E" | null = null;
  let evalScore: number | null = null;

  const attemptMatch = content.match(/<!--QUIZ_ATTEMPT:([a-f0-9-]+)-->/i);
  if (attemptMatch && attemptMatch[1]) {
    attemptId = attemptMatch[1];
  }

  const evalMatch = content.match(
    /<!--QUIZ_EVAL:([a-f0-9-]+):([A-E]):(\d+)-->/i
  );
  if (evalMatch) {
    evalQuizId = evalMatch[1];
    evalOption = evalMatch[2].toUpperCase() as "A" | "B" | "C" | "D" | "E";
    evalScore = parseInt(evalMatch[3], 10);
  }

  const cleanContent = content
    .replace(/<!--QUIZ_ATTEMPT:[^>]+-->/gi, "")
    .replace(/<!--QUIZ_EVAL:[^>]+-->/gi, "")
    .trim();

  return {
    cleanContent,
    attemptId,
    evalQuizId,
    evalOption,
    evalScore,
    quizId: attemptId || evalQuizId,
  };
}

interface TextBubbleProps extends Message {
  isThinking?: boolean;
  matchedQuiz?: QuizAttemptItem;
  onSelectQuizOption?: (
    quizId: string,
    option: "A" | "B" | "C" | "D" | "E"
  ) => void;
  isSubmitting?: boolean;
}

function TextBubble({
  role,
  content,
  isThinking = false,
  matchedQuiz,
  onSelectQuizOption,
  isSubmitting = false,
}: TextBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex w-full mb-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 transition-all",
          isUser
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-muted/70 text-foreground border border-border shadow-xs",
          isThinking && "animate-pulse"
        )}
      >
        {content && content.length > 0 && (
          <section className="prose prose-sm max-w-none dark:prose-invert break-words">
            <ReactMarkdown
              remarkPlugins={[remarkBreaks, remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeHighlight]}
              components={{
                h1: ({ ...props }) => (
                  <h1 className="text-xl font-bold my-2" {...props} />
                ),
                h2: ({ ...props }) => (
                  <h2 className="text-lg font-bold my-2" {...props} />
                ),
                h3: ({ ...props }) => (
                  <h3 className="text-base font-bold my-1.5" {...props} />
                ),
                ul: ({ ...props }) => (
                  <ul className="list-disc my-2 pl-4 space-y-0.5" {...props} />
                ),
                ol: ({ ...props }) => (
                  <ol
                    className="list-decimal my-2 pl-4 space-y-0.5"
                    {...props}
                  />
                ),
                p: ({ ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
                a: ({ ...props }) => (
                  <a
                    className="text-primary underline hover:text-primary/80 transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                  />
                ),
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || "");
                  return match ? (
                    <pre className="bg-slate-900 text-slate-100 p-3 my-2 rounded-lg overflow-x-auto text-xs">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  ) : (
                    <code
                      className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </section>
        )}

        {/* Render Interactive / Reviewed QuizCard */}
        {!isUser && matchedQuiz && (
          <div className="mt-2 pt-1 border-t border-border/50">
            <QuizCard
              quiz={matchedQuiz}
              onSelectOption={onSelectQuizOption}
              disabled={isSubmitting}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ChatHistory({
  isLoading,
  messages,
  quizzes,
  onSelectQuizOption,
}: {
  isLoading: boolean;
  messages: Message[];
  quizzes: QuizAttemptItem[];
  onSelectQuizOption: (
    quizId: string,
    option: "A" | "B" | "C" | "D" | "E"
  ) => void;
}) {
  const lastMessage = messages[messages.length - 1];
  const showThinking =
    isLoading &&
    (!lastMessage ||
      lastMessage.role === "user" ||
      (lastMessage.role === "bot" && !lastMessage.content));

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full">
      {messages.map((msg, index) => {
        if (msg.role === "bot" && !msg.content && isLoading) return null;

        const { cleanContent, quizId } = parseMessageQuizMarkers(msg.content);
        const matchedQuiz =
          msg.role === "bot" && quizId
            ? quizzes.find((q) => q.id === quizId)
            : undefined;

        return (
          <TextBubble
            key={index}
            role={msg.role}
            content={cleanContent}
            timestamp={msg.timestamp}
            matchedQuiz={matchedQuiz}
            onSelectQuizOption={onSelectQuizOption}
            isSubmitting={isLoading}
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
    messages,
    isLoading,
    quizzes,
    submitQuizAnswer,
    handleSendMessage,
  } = useChat();

  const searchParams = useSearchParams();
  const router = useRouter();
  const chatIdParam = searchParams.get("id");
  const chatId = chatIdParam;
  const [chatTitle, setChatTitle] = useState<string>("");
  const [titleLoading, setTitleLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const authLoading = status === "loading";
  const user = session?.user;

  useEffect(() => {
    const fetchTitle = async () => {
      if (authLoading) {
        return;
      }

      if (!chatId || !chatId.trim()) {
        setChatTitle("Sesi Belajar Baru");
        setTitleLoading(false);
        return;
      }

      setTitleLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/chat/title/${chatId}`);
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            if (!isAuthenticated) {
              toast.error(
                "Silakan login terlebih dahulu untuk mengakses riwayat chat ini"
              );
              const returnUrl = encodeURIComponent(`/chat?id=${chatId}`);
              router.replace(`/auth/login?returnUrl=${returnUrl}`);
              return;
            }
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setChatTitle(data.title || "Tutor SKD CPNS");
      } catch (err) {
        console.warn("Could not fetch chat title:", err);
        setChatTitle("Sesi Latihan SKD");
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setTitleLoading(false);
      }
    };

    fetchTitle();
  }, [chatId, isAuthenticated, authLoading, router]);

  return (
    <div className="flex flex-col h-screen relative overflow-hidden bg-background">
      {/* Guest User Notice */}
      {!isAuthenticated && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50 px-4 py-2 text-center">
          <div className="flex items-center justify-center text-xs text-amber-800 dark:text-amber-300 gap-1.5">
            <span>
              ⚠️ Mode Tamu: Percakapan & latihan soal anda disimpan sementara (24 jam).
            </span>
            <Link
              href="/auth/login"
              className="underline hover:no-underline font-semibold"
            >
              Login untuk simpan permanen
            </Link>
          </div>
        </div>
      )}

      {/* Top Floating Controls */}
      <div
        className={cn(
          "flex absolute gap-3 z-10 right-4 items-center",
          isAuthenticated ? "top-3" : "top-12"
        )}
      >
        <ModeToggleButton />
        <HelpButton />
        {isAuthenticated ? (
          <div className="flex items-center gap-2 px-2 py-1">
            <span className="text-xs font-semibold text-foreground">
              {user?.name || user?.email?.split("@")[0] || "User"}
            </span>
          </div>
        ) : (
          <Link href="/auth/login">
            <Button size="sm" className="h-8 text-xs font-semibold">
              Login
            </Button>
          </Link>
        )}
      </div>

      <SidebarProvider defaultOpen={true}>
        <div className="flex flex-row w-full h-full">
          {isAuthenticated ? <AppSidebar /> : null}
          <main className="flex flex-col flex-1 h-full min-w-0 relative">
            {/* Main Header */}
            <div className="flex bg-secondary/60 backdrop-blur min-h-14 border-b border-border w-full items-center justify-between px-4">
              <div className="flex items-center gap-3">
                {isAuthenticated ? (
                  <SidebarTrigger className="justify-center" />
                ) : null}
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold truncate max-w-[280px] sm:max-w-md">
                    {titleLoading
                      ? "Memuat judul..."
                      : error
                      ? "Sesi Belajar SKD"
                      : chatTitle}
                  </p>
                </div>
              </div>
            </div>

            {/* Quiz Quick Access Sub-Header Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border text-xs">
              <div className="flex items-center gap-2">
                <ChatQuizDrawer
                  quizzes={quizzes}
                  onSelectOption={submitQuizAnswer}
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/quiz-history"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Riwayat Latihan SKD</span>
                </Link>
              </div>
            </div>

            {/* Chat Messages */}
            <ScrollArea className="flex-1 overflow-y-auto">
              <Suspense fallback={<div className="p-4 text-xs">Memuat chat...</div>}>
                <ChatHistory
                  isLoading={isLoading}
                  messages={messages}
                  quizzes={quizzes}
                  onSelectQuizOption={submitQuizAnswer}
                />
              </Suspense>
            </ScrollArea>

            {/* Chat Input Bar */}
            <div className="flex pt-2 pb-6 px-4 justify-center w-full">
              <ChatInput
                onSendMessage={handleSendMessage}
                onSendQuickPrompt={(prompt) => handleSendMessage(prompt)}
                isLoading={isLoading}
              />
            </div>

            {/* Footer */}
            <footer className="flex flex-col h-6 w-full justify-center items-center pb-2">
              <p className="text-[11px] text-muted-foreground">
                Tutor SKD CPNS • Dilengkapi Soal HOTS TWK, TIU, TKP & Evaluasi Akurat
              </p>
            </footer>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">Memuat aplikasi...</div>}>
      <ChatContent />
    </Suspense>
  );
}