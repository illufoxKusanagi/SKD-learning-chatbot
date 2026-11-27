"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import ModeToggleButton from "@/components/ui/mode-toggle-button";
import HelpButton from "@/components/ui/help-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Filter,
  BarChart3,
  Calendar,
  Layers,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizAttemptDetail {
  id: string;
  chatId: string | null;
  chatTitle?: string;
  category: "TWK" | "TIU" | "TKP";
  subtopic: string;
  questionStem: string;
  options: { A: string; B: string; C: string; D: string; E: string };
  correctOption: "A" | "B" | "C" | "D" | "E" | null;
  scoringRubric: { A: number; B: number; C: number; D: number; E: number } | null;
  rubricRationale: string | null;
  userAnswer: "A" | "B" | "C" | "D" | "E" | null;
  scoreEarned: number | null;
  maxScore: number;
  aiExplanation: string | null;
  status: "pending" | "answered";
  createdAt: string;
  answeredAt: string | null;
}

interface CategoryStats {
  total: number;
  answered: number;
  correctCount?: number;
  optimalCount?: number;
  scoreEarned: number;
  maxScore: number;
  accuracyPercent?: number;
  averagePoints?: number;
}

interface QuizStats {
  totalAttempts: number;
  answeredCount: number;
  pendingCount: number;
  totalScoreEarned: number;
  totalMaxScore: number;
  averageScore: number;
  byCategory: {
    TWK: CategoryStats;
    TIU: CategoryStats;
    TKP: CategoryStats;
  };
}

const OPTION_KEYS: ("A" | "B" | "C" | "D" | "E")[] = ["A", "B", "C", "D", "E"];

function isValidChatUuid(val?: string | null): val is string {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    val
  );
}

function readStorageUuidList(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => isValidChatUuid(id));
  } catch {
    return [];
  }
}

function QuizHistoryContent() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const authLoading = status === "loading";
  const searchParams = useSearchParams();
  const fromChatId = searchParams.get("fromChatId");

  const [storedChatId, setStoredChatId] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizAttemptDetail[]>([]);
  const [stats, setStats] = useState<QuizStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<
    "ALL" | "TWK" | "TIU" | "TKP"
  >("ALL");
  const [selectedStatus, setSelectedStatus] = useState<
    "ALL" | "answered" | "pending"
  >("ALL");
  const [expandedQuizIds, setExpandedQuizIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    try {
      const lastActive = sessionStorage.getItem("skd_last_active_chat_id");
      if (isValidChatUuid(lastActive)) {
        setStoredChatId(lastActive);
        return;
      }
      const rawGuestIds = localStorage.getItem("skd_guest_chat_ids");
      if (rawGuestIds) {
        const ids: string[] = JSON.parse(rawGuestIds);
        if (isValidChatUuid(ids?.[0])) {
          setStoredChatId(ids[0]);
        }
      }
    } catch {
      // Ignore storage access errors
    }
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
      if (next.has(quizId)) {
        next.delete(quizId);
      } else {
        next.add(quizId);
      }
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();

    const fetchQuizHistory = async () => {
      if (authLoading) return;

      setIsLoading(true);
      setError(null);

      try {
        let endpoint = "/api/quiz";

        if (!isAuthenticated && typeof window !== "undefined") {
          const validChatIds = readStorageUuidList("skd_guest_chat_ids");
          const validSessionIds = Array.from(
            new Set([
              ...readStorageUuidList("skd_guest_practice_session_ids"),
              ...readStorageUuidList("skd_guest_tryout_session_ids"),
            ])
          );
          if (validChatIds.length > 0 || validSessionIds.length > 0) {
            const params = new URLSearchParams();
            if (validChatIds.length > 0) {
              params.set("chatIds", validChatIds.join(","));
            }
            if (validSessionIds.length > 0) {
              params.set("sessionIds", validSessionIds.join(","));
            }
            endpoint = `/api/quiz?${params.toString()}`;
          }
        }

        const res = await fetch(endpoint, { signal: abortController.signal });
        if (cancelled) return;

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        if (cancelled) return;

        if (json.success && json.data) {
          setQuizzes(json.data.quizzes || []);
          setStats(json.data.stats || null);
        } else {
          setQuizzes([]);
        }
      } catch (err: unknown) {
        if (cancelled || (err instanceof Error && err.name === "AbortError")) {
          return;
        }
        console.error("Failed to load quiz history:", err);
        setError("Gagal memuat riwayat latihan soal");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchQuizHistory();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [isAuthenticated, authLoading]);

  // Filtered Quizzes
  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => {
      if (selectedCategory !== "ALL" && q.category !== selectedCategory) {
        return false;
      }
      if (selectedStatus !== "ALL" && q.status !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [quizzes, selectedCategory, selectedStatus]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "TWK":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "TIU":
        return "bg-primary/10 text-primary border-primary/20";
      case "TKP":
        return "bg-success/10 text-success border-success/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Banner for Guest Users */}
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
        <div className="flex flex-row w-full min-h-screen">
          {isAuthenticated ? <AppSidebar /> : null}

          <main className="flex flex-col flex-1 min-w-0 overflow-y-auto">
            {/* Top Navigation Header */}
            <header className="flex bg-secondary/50 backdrop-blur min-h-16 border-b border-border w-full items-center justify-between px-4 sm:px-8 sticky top-0 z-20">
              <div className="flex items-center gap-3">
                {isAuthenticated && <SidebarTrigger className="justify-center" />}
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  <h1 className="text-base sm:text-lg font-bold text-foreground">
                    Riwayat Latihan & Evaluasi SKD CPNS
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold"
                >
                  <Link href={returnChatHref}>
                    <MessageSquare className="size-3.5" />
                    <span>Kembali ke Chat</span>
                  </Link>
                </Button>
                <ModeToggleButton />
                <HelpButton />
              </div>
            </header>

            {/* Main Content Area */}
            <div className="p-4 sm:p-8 max-w-6xl mx-auto w-full flex flex-col gap-8">
              {/* Overview & BKN Passing Grade Stats Cards */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Statistik Performa & Target Passing Grade BKN
                    </h2>
                  </div>
                  {stats && (
                    <span className="text-xs text-muted-foreground">
                      Total {stats.totalAttempts} Soal Terdaftar
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Total Overall */}
                  <Card className="gap-3 py-4 shadow-xs">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        Total Latihan
                      </span>
                      <Layers className="w-4 h-4 text-primary" />
                    </CardHeader>
                    <CardContent className="px-4 flex flex-col gap-1">
                      <div className="text-2xl font-extrabold text-foreground">
                        {stats?.answeredCount ?? 0}
                        <span className="text-sm font-normal text-muted-foreground">
                          /{stats?.totalAttempts ?? 0} terjawab
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Skor Akumulasi:{" "}
                        <strong className="text-foreground">
                          {stats?.totalScoreEarned ?? 0}
                        </strong>{" "}
                        / {stats?.totalMaxScore ?? 0} poin
                      </p>
                    </CardContent>
                    <Separator />
                    <CardFooter className="px-4 justify-between text-[11px] text-muted-foreground">
                      <span>Belum Dijawab:</span>
                      <span className="font-semibold text-warning">
                        {stats?.pendingCount ?? 0} soal
                      </span>
                    </CardFooter>
                  </Card>

                  {/* Card 2: TWK */}
                  <Card className="gap-3 py-4 shadow-xs">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
                      <Badge
                        variant="outline"
                        className="rounded-md border-destructive/20 bg-destructive/10 text-destructive font-bold"
                      >
                        TWK (Wawasan Kebangsaan)
                      </Badge>
                      <CheckCircle2 className="w-4 h-4 text-destructive shrink-0" />
                    </CardHeader>
                    <CardContent className="px-4 flex flex-col gap-1">
                      <div className="text-2xl font-extrabold text-foreground">
                        {stats?.byCategory.TWK.accuracyPercent ?? 0}%
                        <span className="text-xs font-normal text-muted-foreground ml-1.5">
                          Akurasi
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Benar (+5):{" "}
                        <strong className="text-success">
                          {stats?.byCategory.TWK.correctCount ?? 0}
                        </strong>{" "}
                        dari {stats?.byCategory.TWK.answered ?? 0} soal
                      </p>
                    </CardContent>
                    <Separator />
                    <CardFooter className="px-4 justify-between text-[11px] text-muted-foreground">
                      <span>Passing Grade BKN:</span>
                      <span className="font-semibold text-foreground">
                        65 Poin (min. 13 benar)
                      </span>
                    </CardFooter>
                  </Card>

                  {/* Card 3: TIU */}
                  <Card className="gap-3 py-4 shadow-xs">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
                      <Badge
                        variant="outline"
                        className="rounded-md border-primary/20 bg-primary/10 text-primary font-bold"
                      >
                        TIU (Inteligensia Umum)
                      </Badge>
                      <Sparkles className="w-4 h-4 text-primary shrink-0" />
                    </CardHeader>
                    <CardContent className="px-4 flex flex-col gap-1">
                      <div className="text-2xl font-extrabold text-foreground">
                        {stats?.byCategory.TIU.accuracyPercent ?? 0}%
                        <span className="text-xs font-normal text-muted-foreground ml-1.5">
                          Akurasi
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Benar (+5):{" "}
                        <strong className="text-success">
                          {stats?.byCategory.TIU.correctCount ?? 0}
                        </strong>{" "}
                        dari {stats?.byCategory.TIU.answered ?? 0} soal
                      </p>
                    </CardContent>
                    <Separator />
                    <CardFooter className="px-4 justify-between text-[11px] text-muted-foreground">
                      <span>Passing Grade BKN:</span>
                      <span className="font-semibold text-foreground">
                        80 Poin (min. 16 benar)
                      </span>
                    </CardFooter>
                  </Card>

                  {/* Card 4: TKP */}
                  <Card className="gap-3 py-4 shadow-xs">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
                      <Badge
                        variant="outline"
                        className="rounded-md border-success/20 bg-success/10 text-success font-bold"
                      >
                        TKP (Karakteristik Pribadi)
                      </Badge>
                      <Award className="w-4 h-4 text-success shrink-0" />
                    </CardHeader>
                    <CardContent className="px-4 flex flex-col gap-1">
                      <div className="text-2xl font-extrabold text-foreground">
                        {stats?.byCategory.TKP.averagePoints ?? 0}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          /5 rata-rata
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Skor Maksimal (5 pt):{" "}
                        <strong className="text-success">
                          {stats?.byCategory.TKP.optimalCount ?? 0}
                        </strong>{" "}
                        soal
                      </p>
                    </CardContent>
                    <Separator />
                    <CardFooter className="px-4 justify-between text-[11px] text-muted-foreground">
                      <span>Passing Grade BKN:</span>
                      <span className="font-semibold text-foreground">
                        166 Poin (skala 1–5)
                      </span>
                    </CardFooter>
                  </Card>
                </div>
              </section>

              {/* Filter Controls Bar */}
              <section>
                <Card className="bg-card/60 gap-3 py-4 shadow-none">
                  <CardHeader className="px-4 flex flex-row items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filter Soal Latihan</span>
                  </CardHeader>

                  <CardContent className="px-4 flex flex-wrap items-center justify-between gap-4">
                    {/* Category Filter Pills */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Materi:
                      </span>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        spacing={1}
                        value={selectedCategory}
                        onValueChange={(val) => {
                          if (val) {
                            setSelectedCategory(
                              val as "ALL" | "TWK" | "TIU" | "TKP"
                            );
                          }
                        }}
                        className="flex-wrap gap-1.5"
                      >
                        {(["ALL", "TWK", "TIU", "TKP"] as const).map((cat) => (
                          <ToggleGroupItem
                            key={cat}
                            value={cat}
                            className="text-xs font-semibold cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground"
                          >
                            {cat === "ALL" ? "Semua Kategori" : cat}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>

                    {/* Status Filter Pills */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Status:
                      </span>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        spacing={1}
                        value={selectedStatus}
                        onValueChange={(val) => {
                          if (val) {
                            setSelectedStatus(
                              val as "ALL" | "answered" | "pending"
                            );
                          }
                        }}
                        className="flex-wrap gap-1.5"
                      >
                        {(
                          [
                            { label: "Semua Status", value: "ALL" },
                            { label: "Sudah Dijawab", value: "answered" },
                            { label: "Belum Dijawab", value: "pending" },
                          ] as const
                        ).map((st) => (
                          <ToggleGroupItem
                            key={st.value}
                            value={st.value}
                            className="text-xs font-semibold cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground"
                          >
                            {st.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Quiz Attempts Review List */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">
                    Daftar Soal ({filteredQuizzes.length})
                  </h3>
                </div>

                {isLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-2 text-center">
                    <Spinner className="size-8 text-primary" />
                    <p className="text-xs text-muted-foreground">
                      Memuat riwayat latihan soal SKD...
                    </p>
                  </div>
                ) : error ? (
                  <Alert
                    variant="destructive"
                    className="border-destructive/30 bg-destructive/5 p-6"
                  >
                    <AlertCircle />
                    <AlertDescription className="flex w-full flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-destructive">
                        {error}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.reload()}
                      >
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
                        Mulai percakapan dengan Tutor SKD CPNS dan minta latihan
                        soal TWK HOTS, TIU Silogisme/Numerik, atau TKP
                        BerAKHLAK untuk menguji kemampuan Anda.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button asChild size="sm" className="font-semibold">
                        <Link href={returnChatHref}>
                          <span>Mulai Latihan di Chat</span>
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </EmptyContent>
                  </Empty>
                ) : (
                  <div className="flex flex-col gap-4">
                    {filteredQuizzes.map((quiz, index) => {
                      const isExpanded = expandedQuizIds.has(quiz.id);
                      const isAnswered = quiz.status === "answered";
                      const isTWKorTIU =
                        quiz.category === "TWK" || quiz.category === "TIU";
                      const isTKP = quiz.category === "TKP";
                      const isCorrect =
                        isTWKorTIU &&
                        (quiz.scoreEarned === 5 ||
                          quiz.userAnswer === quiz.correctOption);

                      return (
                        <Card
                          key={quiz.id}
                          className="gap-0 py-0 shadow-xs overflow-hidden transition-all hover:border-primary/40"
                        >
                          {/* Card Top Info Header */}
                          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-5 py-3 bg-muted/30 border-b border-border [.border-b]:pb-3">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-xs font-mono font-bold text-muted-foreground">
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
                                  className="rounded-md bg-background text-muted-foreground font-medium"
                                >
                                  {quiz.subtopic}
                                </Badge>
                              )}
                              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                {formatDate(quiz.createdAt)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Score / Status Badge */}
                              {isAnswered ? (
                                isTWKorTIU ? (
                                  isCorrect ? (
                                    <Badge
                                      variant="outline"
                                      className="border-success/30 bg-success/15 text-success font-bold"
                                    >
                                      <CheckCircle2 />
                                      +5 Poin (Benar)
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="border-destructive/30 bg-destructive/15 text-destructive font-bold"
                                    >
                                      <XCircle />
                                      0 Poin (Salah)
                                    </Badge>
                                  )
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="border-success/30 bg-success/15 text-success font-bold"
                                  >
                                    <Award />
                                    Skor TKP: {quiz.scoreEarned ?? 0}/5 Poin
                                  </Badge>
                                )
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-warning/30 bg-warning/15 text-warning font-semibold"
                                >
                                  <HelpCircle />
                                  Menunggu Jawaban
                                </Badge>
                              )}

                              {/* Buka di Chat Link */}
                              {isValidChatUuid(quiz.chatId) ? (
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs text-primary hover:text-primary"
                                >
                                  <Link href={`/chat?id=${quiz.chatId}`}>
                                    <span>Buka di Chat</span>
                                    <ArrowRight className="size-3" />
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

                          {/* Card Question Stem */}
                          <CardContent className="p-5 flex flex-col gap-4">
                            <p className="text-sm font-medium leading-relaxed text-foreground whitespace-pre-line">
                              {quiz.questionStem}
                            </p>

                            {/* Options Breakdown */}
                            <div className="flex flex-col gap-2">
                              {OPTION_KEYS.map((opt) => {
                                const optionText = quiz.options
                                  ? quiz.options[opt]
                                  : null;
                                if (!optionText) return null;

                                const isUserChoice = quiz.userAnswer === opt;
                                const isCorrectOpt = quiz.correctOption === opt;
                                const rubricScore = quiz.scoringRubric
                                  ? quiz.scoringRubric[opt]
                                  : undefined;

                                if (!isAnswered) {
                                  return (
                                    <div
                                      key={opt}
                                      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/40 text-xs text-muted-foreground"
                                    >
                                      <span className="w-5 h-5 rounded bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs flex-shrink-0">
                                        {opt}
                                      </span>
                                      <span className="flex-1 text-foreground">
                                        {optionText}
                                      </span>
                                    </div>
                                  );
                                }

                                // Answered state styling
                                let containerStyle =
                                  "border-border bg-card/60 text-muted-foreground";
                                let letterStyle =
                                  "bg-muted text-muted-foreground border-border";

                                if (isTKP) {
                                  if (isUserChoice) {
                                    if (rubricScore === 5) {
                                      containerStyle =
                                        "border-success/60 bg-success/10 text-foreground font-medium shadow-xs";
                                      letterStyle =
                                        "bg-success text-success-foreground border-success font-bold";
                                    } else if (rubricScore === 4) {
                                      containerStyle =
                                        "border-primary/60 bg-primary/10 text-foreground font-medium shadow-xs";
                                      letterStyle =
                                        "bg-primary text-primary-foreground border-primary font-bold";
                                    } else if (rubricScore === 3) {
                                      containerStyle =
                                        "border-warning/60 bg-warning/10 text-foreground font-medium shadow-xs";
                                      letterStyle =
                                        "bg-warning text-warning-foreground border-warning font-bold";
                                    } else {
                                      containerStyle =
                                        "border-destructive/60 bg-destructive/10 text-foreground font-medium shadow-xs";
                                      letterStyle =
                                        "bg-destructive text-white border-destructive font-bold";
                                    }
                                  } else if (rubricScore === 5) {
                                    containerStyle =
                                      "border-success/40 bg-success/5 text-foreground font-medium";
                                    letterStyle =
                                      "bg-success/20 text-success border-success/30 font-bold";
                                  }
                                } else {
                                  if (isCorrectOpt) {
                                    containerStyle =
                                      "border-success/60 bg-success/10 text-foreground font-medium shadow-xs";
                                    letterStyle =
                                      "bg-success text-success-foreground border-success font-bold";
                                  } else if (isUserChoice && !isCorrectOpt) {
                                    containerStyle =
                                      "border-destructive/60 bg-destructive/10 text-foreground font-medium shadow-xs";
                                    letterStyle =
                                      "bg-destructive text-white border-destructive font-bold";
                                  }
                                }

                                return (
                                  <div
                                    key={opt}
                                    className={cn(
                                      "flex items-start gap-3 p-3 rounded-lg border text-xs transition-all",
                                      containerStyle
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0 border",
                                        letterStyle
                                      )}
                                    >
                                      {opt}
                                    </span>
                                    <div className="flex-1 flex items-center justify-between gap-2 flex-wrap">
                                      <span className="text-foreground">
                                        {optionText}
                                      </span>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {isUserChoice && (
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "text-[10px] font-bold",
                                              isTKP
                                                ? rubricScore === 5
                                                  ? "bg-success/15 text-success border-success/40"
                                                  : rubricScore === 4
                                                  ? "bg-primary/15 text-primary border-primary/40"
                                                  : rubricScore === 3
                                                  ? "bg-warning/15 text-warning border-warning/40"
                                                  : "bg-destructive/15 text-destructive border-destructive/40"
                                                : isCorrectOpt
                                                ? "bg-success/15 text-success border-success/40"
                                                : "bg-destructive/15 text-destructive border-destructive/40"
                                            )}
                                          >
                                            {isTKP ? (
                                              (rubricScore ?? 0) >= 4 ? (
                                                <CheckCircle2 />
                                              ) : (
                                                <XCircle />
                                              )
                                            ) : isCorrectOpt ? (
                                              <CheckCircle2 />
                                            ) : (
                                              <XCircle />
                                            )}
                                            Pilihan Anda
                                          </Badge>
                                        )}
                                        {typeof rubricScore === "number" && (
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "text-[10px] font-mono font-bold",
                                              rubricScore === 5
                                                ? "bg-success/15 text-success border-success/30"
                                                : rubricScore === 4
                                                ? "bg-primary/15 text-primary border-primary/30"
                                                : rubricScore === 3
                                                ? "bg-warning/15 text-warning border-warning/30"
                                                : "bg-muted text-muted-foreground border-border"
                                            )}
                                          >
                                            {rubricScore} Poin
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Pending State Prompt */}
                            {!isAnswered && (
                              <Alert className="border-warning/30 bg-warning/10 text-foreground [&>svg]:text-warning">
                                <AlertTriangle />
                                <AlertDescription className="flex w-full flex-wrap items-center justify-between gap-3 text-xs text-foreground">
                                  <span>
                                    Soal ini belum dijawab. Kunci jawaban dan skor disembunyikan sampai Anda menjawab.
                                  </span>
                                  <Button
                                    asChild
                                    size="sm"
                                    className="h-7 text-xs font-semibold shrink-0"
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

                            {/* Answered Explanation Accordion */}
                            {isAnswered &&
                              (quiz.rubricRationale || quiz.aiExplanation) && (
                                <Collapsible
                                  open={isExpanded}
                                  onOpenChange={() => toggleExpand(quiz.id)}
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
                                        <Sparkles className="size-3.5" />
                                        <span>
                                          {isExpanded
                                            ? "Tutup Pembahasan & Rasional Rubrik"
                                            : "Lihat Pembahasan & Rasional Rubrik"}
                                        </span>
                                        {isExpanded ? (
                                          <ChevronUp className="size-3.5" />
                                        ) : (
                                          <ChevronDown className="size-3.5" />
                                        )}
                                      </Button>
                                    </CollapsibleTrigger>
                                  </div>

                                  <CollapsibleContent>
                                    <div className="p-4 rounded-lg bg-muted/50 border border-border text-xs flex flex-col gap-3">
                                      {quiz.rubricRationale && (
                                        <div className="flex flex-col gap-1">
                                          <span className="font-bold text-foreground">
                                            Rasional Skor & Kunci Jawaban:
                                          </span>
                                          <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                                            {quiz.rubricRationale}
                                          </p>
                                        </div>
                                      )}
                                      {quiz.aiExplanation && (
                                        <div className="flex flex-col gap-1">
                                          <span className="font-bold text-foreground">
                                            Penjelasan Lengkap Tutor:
                                          </span>
                                          <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
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
                    })}
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

export default function QuizHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <Spinner className="size-6 text-primary" />
          <span>Memuat riwayat latihan soal...</span>
        </div>
      }
    >
      <QuizHistoryContent />
    </Suspense>
  );
}