"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { QuizHistoryCard } from "@/components/quiz-history/quiz-history-card";
import { QuizHistoryFilters } from "@/components/quiz-history/quiz-history-filters";
import { QuizHistoryStats } from "@/components/quiz-history/quiz-history-stats";
import {
  buildQuizHistoryEndpoint,
  getInitialStoredChatId,
  isValidChatUuid,
  type QuizAttemptDetail,
  type QuizCategoryFilter,
  type QuizStats,
  type QuizStatusFilter,
} from "@/components/quiz-history/quiz-history-types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import HelpButton from "@/components/ui/help-button";
import ModeToggleButton from "@/components/ui/mode-toggle-button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";

export function QuizHistoryWorkspace() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const authLoading = status === "loading";
  const fromChatId = useSearchParams().get("fromChatId");

  const [storedChatId, setStoredChatId] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizAttemptDetail[]>([]);
  const [stats, setStats] = useState<QuizStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<QuizCategoryFilter>("ALL");
  const [selectedStatus, setSelectedStatus] =
    useState<QuizStatusFilter>("ALL");
  const [expandedQuizIds, setExpandedQuizIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    setStoredChatId(getInitialStoredChatId());
  }, []);

  const returnChatHref = useMemo(() => {
    if (isValidChatUuid(fromChatId)) return `/chat?id=${fromChatId}`;
    if (isValidChatUuid(storedChatId)) return `/chat?id=${storedChatId}`;
    if (isValidChatUuid(quizzes[0]?.chatId)) return `/chat?id=${quizzes[0].chatId}`;
    return "/chat";
  }, [fromChatId, storedChatId, quizzes]);

  const toggleExpand = (quizId: string) => {
    setExpandedQuizIds((prev) => {
      const next = new Set(prev);
      if (next.has(quizId)) next.delete(quizId);
      else next.add(quizId);
      return next;
    });
  };

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch(buildQuizHistoryEndpoint(isAuthenticated), { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setQuizzes(json.success && json.data ? json.data.quizzes || [] : []);
        setStats(json.success && json.data ? json.data.stats || null : null);
      })
      .catch((err: unknown) => {
        if (cancelled || (err instanceof Error && err.name === "AbortError")) return;
        console.error("Failed to load quiz history:", err);
        setError("Gagal memuat riwayat latihan soal");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isAuthenticated, authLoading]);

  const filteredQuizzes = useMemo(
    () =>
      quizzes.filter((q) => {
        if (selectedCategory !== "ALL" && q.category !== selectedCategory) return false;
        if (selectedStatus !== "ALL" && q.status !== selectedStatus) return false;
        return true;
      }),
    [quizzes, selectedCategory, selectedStatus]
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!isAuthenticated && (
        <div className="border-b border-warning/30 bg-warning/10 px-4 py-2.5">
          <Alert className="mx-auto w-fit border-0 bg-transparent p-0 text-foreground [&>svg]:text-warning">
            <AlertTriangle />
            <AlertDescription className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-foreground">
              <span>
                Mode Tamu: Menampilkan riwayat latihan dari perangkat ini (disimpan hingga 24 jam).
              </span>
              <Link
                href="/auth/login"
                className="font-semibold text-primary underline underline-offset-4 hover:no-underline"
              >
                Login untuk simpan riwayat permanen
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen w-full flex-row">
          {isAuthenticated ? <AppSidebar /> : null}

          <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
            <header className="sticky top-0 z-20 flex min-h-16 w-full items-center justify-between border-b border-border bg-secondary/50 px-4 backdrop-blur sm:px-8">
              <div className="flex items-center gap-3">
                {isAuthenticated && <SidebarTrigger className="justify-center" />}
                <div className="flex items-center gap-2">
                  <Award className="size-5 text-primary" />
                  <h1 className="text-base font-bold text-foreground sm:text-lg">
                    Riwayat Latihan &amp; Evaluasi SKD CPNS
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button asChild variant="outline" size="sm" className="text-xs font-semibold">
                  <Link href={returnChatHref}>
                    <MessageSquare data-icon="inline-start" />
                    <span>Kembali ke Chat</span>
                  </Link>
                </Button>
                <ModeToggleButton />
                <HelpButton />
              </div>
            </header>

            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-4 sm:p-8">
              <QuizHistoryStats stats={stats} />
              <QuizHistoryFilters
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                selectedStatus={selectedStatus}
                onStatusChange={setSelectedStatus}
              />

              <section className="flex flex-col gap-4">
                <h3 className="text-sm font-bold text-foreground">
                  Daftar Soal ({filteredQuizzes.length})
                </h3>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
                    <Spinner className="size-8 text-primary" />
                    <p className="text-xs text-muted-foreground">
                      Memuat riwayat latihan soal SKD...
                    </p>
                  </div>
                ) : error ? (
                  <Alert variant="destructive" className="border-destructive/30 bg-destructive/5 p-6">
                    <AlertCircle />
                    <AlertDescription className="flex w-full flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-destructive">{error}</span>
                      <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                        Coba Lagi
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : filteredQuizzes.length === 0 ? (
                  <Empty className="border border-border bg-card/40">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <BookOpen className="text-primary" />
                      </EmptyMedia>
                      <EmptyTitle className="text-base font-bold">
                        Belum Ada Riwayat Soal Latihan
                      </EmptyTitle>
                      <EmptyDescription className="text-xs leading-relaxed">
                        Mulai percakapan dengan Tutor SKD CPNS dan minta latihan soal TWK HOTS,
                        TIU Silogisme/Numerik, atau TKP BerAKHLAK untuk menguji kemampuan Anda.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button asChild size="sm" className="font-semibold">
                        <Link href={returnChatHref}>
                          <span>Mulai Latihan di Chat</span>
                          <ArrowRight data-icon="inline-end" />
                        </Link>
                      </Button>
                    </EmptyContent>
                  </Empty>
                ) : (
                  <div className="flex flex-col gap-4">
                    {filteredQuizzes.map((quiz, index) => (
                      <QuizHistoryCard
                        key={quiz.id}
                        quiz={quiz}
                        index={index}
                        isExpanded={expandedQuizIds.has(quiz.id)}
                        onToggleExpand={toggleExpand}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
