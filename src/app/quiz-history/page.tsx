"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import ModeToggleButton from "@/components/ui/mode-toggle-button";
import HelpButton from "@/components/ui/help-button";
import { Button } from "@/components/ui/button";
import {
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
  chatId: string;
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

export default function QuizHistoryPage() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const authLoading = status === "loading";

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
    const fetchQuizHistory = async () => {
      if (authLoading) return;

      setIsLoading(true);
      setError(null);

      try {
        let endpoint = "/api/quiz";

        if (!isAuthenticated && typeof window !== "undefined") {
          const rawGuestIds = localStorage.getItem("skd_guest_chat_ids");
          if (rawGuestIds) {
            try {
              const ids: string[] = JSON.parse(rawGuestIds);
              if (ids.length > 0) {
                endpoint = `/api/quiz?chatIds=${encodeURIComponent(
                  ids.join(",")
                )}`;
              }
            } catch (parseErr) {
              console.warn("Failed to parse guest chat ids:", parseErr);
            }
          }
        }

        const res = await fetch(endpoint);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        if (json.success && json.data) {
          setQuizzes(json.data.quizzes || []);
          setStats(json.data.stats || null);
        } else {
          setQuizzes([]);
        }
      } catch (err) {
        console.error("Failed to load quiz history:", err);
        setError("Gagal memuat riwayat latihan soal");
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuizHistory();
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
        return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
      case "TIU":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
      case "TKP":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
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
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50 px-4 py-2.5 text-center">
          <div className="flex items-center justify-center text-xs text-amber-800 dark:text-amber-300 gap-1.5 flex-wrap">
            <span>
              ⚠️ Mode Tamu: Menampilkan riwayat latihan dari perangkat ini (disimpan hingga 24 jam).
            </span>
            <Link
              href="/auth/login"
              className="underline hover:no-underline font-semibold ml-1"
            >
              Login untuk simpan riwayat permanen
            </Link>
          </div>
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
                <Link href="/chat">
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Kembali ke Chat</span>
                  </Button>
                </Link>
                <ModeToggleButton />
                <HelpButton />
              </div>
            </header>

            {/* Main Content Area */}
            <div className="p-4 sm:p-8 max-w-6xl mx-auto w-full space-y-8">
              {/* Overview & BKN Passing Grade Stats Cards */}
              <section className="space-y-4">
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
                  <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        Total Latihan
                      </span>
                      <Layers className="w-4 h-4 text-primary" />
                    </div>
                    <div className="space-y-1">
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
                    </div>
                    <div className="pt-2 border-t border-border flex justify-between text-[11px] text-muted-foreground">
                      <span>Belum Dijawab:</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {stats?.pendingCount ?? 0} soal
                      </span>
                    </div>
                  </div>

                  {/* Card 2: TWK */}
                  <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                        TWK (Wawasan Kebangsaan)
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-extrabold text-foreground">
                        {stats?.byCategory.TWK.accuracyPercent ?? 0}%
                        <span className="text-xs font-normal text-muted-foreground ml-1.5">
                          Akurasi
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Benar (+5):{" "}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {stats?.byCategory.TWK.correctCount ?? 0}
                        </strong>{" "}
                        dari {stats?.byCategory.TWK.answered ?? 0} soal
                      </p>
                    </div>
                    <div className="pt-2 border-t border-border flex justify-between text-[11px] text-muted-foreground">
                      <span>Passing Grade BKN:</span>
                      <span className="font-semibold text-foreground">
                        65 Poin (min. 13 benar)
                      </span>
                    </div>
                  </div>

                  {/* Card 3: TIU */}
                  <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        TIU (Inteligensia Umum)
                      </span>
                      <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-extrabold text-foreground">
                        {stats?.byCategory.TIU.accuracyPercent ?? 0}%
                        <span className="text-xs font-normal text-muted-foreground ml-1.5">
                          Akurasi
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Benar (+5):{" "}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {stats?.byCategory.TIU.correctCount ?? 0}
                        </strong>{" "}
                        dari {stats?.byCategory.TIU.answered ?? 0} soal
                      </p>
                    </div>
                    <div className="pt-2 border-t border-border flex justify-between text-[11px] text-muted-foreground">
                      <span>Passing Grade BKN:</span>
                      <span className="font-semibold text-foreground">
                        80 Poin (min. 16 benar)
                      </span>
                    </div>
                  </div>

                  {/* Card 4: TKP */}
                  <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        TKP (Karakteristik Pribadi)
                      </span>
                      <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-extrabold text-foreground">
                        {stats?.byCategory.TKP.averagePoints ?? 0}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          /5 rata-rata
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Skor Maksimal (5 pt):{" "}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {stats?.byCategory.TKP.optimalCount ?? 0}
                        </strong>{" "}
                        soal
                      </p>
                    </div>
                    <div className="pt-2 border-t border-border flex justify-between text-[11px] text-muted-foreground">
                      <span>Passing Grade BKN:</span>
                      <span className="font-semibold text-foreground">
                        166 Poin (skala 1–5)
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Filter Controls Bar */}
              <section className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter Soal Latihan</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Category Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1">
                      Materi:
                    </span>
                    {(["ALL", "TWK", "TIU", "TKP"] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                          selectedCategory === cat
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-background text-muted-foreground border-border hover:bg-accent"
                        )}
                      >
                        {cat === "ALL" ? "Semua Kategori" : cat}
                      </button>
                    ))}
                  </div>

                  {/* Status Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1">
                      Status:
                    </span>
                    {(
                      [
                        { label: "Semua Status", value: "ALL" },
                        { label: "Sudah Dijawab", value: "answered" },
                        { label: "Belum Dijawab", value: "pending" },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.value}
                        type="button"
                        onClick={() => setSelectedStatus(st.value)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                          selectedStatus === st.value
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-background text-muted-foreground border-border hover:bg-accent"
                        )}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Quiz Attempts Review List */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">
                    Daftar Soal ({filteredQuizzes.length})
                  </h3>
                </div>

                {isLoading ? (
                  <div className="py-20 text-center space-y-2">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-muted-foreground">
                      Memuat riwayat latihan soal SKD...
                    </p>
                  </div>
                ) : error ? (
                  <div className="p-8 rounded-xl border border-destructive/30 bg-destructive/5 text-center space-y-2">
                    <p className="text-sm font-semibold text-destructive">
                      {error}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.reload()}
                    >
                      Coba Lagi
                    </Button>
                  </div>
                ) : filteredQuizzes.length === 0 ? (
                  <div className="p-12 rounded-xl border border-dashed border-border bg-card/40 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <BookOpen className="w-6 h-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-foreground">
                        Belum Ada Riwayat Soal Latihan
                      </h4>
                      <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                        Mulai percakapan dengan Tutor SKD CPNS dan minta latihan
                        soal TWK HOTS, TIU Silogisme/Numerik, atau TKP
                        BerAKHLAK untuk menguji kemampuan Anda.
                      </p>
                    </div>
                    <Link href="/chat">
                      <Button size="sm" className="gap-2 font-semibold">
                        <span>Mulai Latihan di Chat</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
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
                        <div
                          key={quiz.id}
                          className="rounded-xl border border-border bg-card shadow-xs overflow-hidden transition-all hover:border-primary/40"
                        >
                          {/* Card Top Info Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-muted/30 border-b border-border">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-xs font-mono font-bold text-muted-foreground">
                                #{index + 1}
                              </span>
                              <span
                                className={cn(
                                  "px-2.5 py-0.5 rounded-md text-xs font-bold border tracking-wider",
                                  getCategoryColor(quiz.category)
                                )}
                              >
                                {quiz.category}
                              </span>
                              {quiz.subtopic && (
                                <span className="text-xs px-2.5 py-0.5 rounded-md bg-background border border-border text-muted-foreground font-medium">
                                  {quiz.subtopic}
                                </span>
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
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                      <CheckCircle2 className="w-3 h-3" />
                                      +5 Poin (Benar)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                                      <XCircle className="w-3 h-3" />
                                      0 Poin (Salah)
                                    </span>
                                  )
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                    <Award className="w-3 h-3" />
                                    Skor TKP: {quiz.scoreEarned ?? 0}/5 Poin
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                  <HelpCircle className="w-3 h-3" />
                                  Menunggu Jawaban
                                </span>
                              )}

                              {/* Buka di Chat Link */}
                              <Link href={`/chat?id=${quiz.chatId}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs text-primary hover:text-primary gap-1"
                                >
                                  <span>Buka di Chat</span>
                                  <ArrowRight className="w-3 h-3" />
                                </Button>
                              </Link>
                            </div>
                          </div>

                          {/* Card Question Stem */}
                          <div className="p-5 space-y-4">
                            <p className="text-sm font-medium leading-relaxed text-foreground whitespace-pre-line">
                              {quiz.questionStem}
                            </p>

                            {/* Options Breakdown */}
                            <div className="space-y-2">
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
                                        "border-emerald-500/60 bg-emerald-50/70 dark:bg-emerald-950/40 text-foreground font-medium shadow-xs";
                                      letterStyle =
                                        "bg-emerald-500 text-white font-bold";
                                    } else if (rubricScore === 4) {
                                      containerStyle =
                                        "border-teal-500/60 bg-teal-50/70 dark:bg-teal-950/40 text-foreground font-medium shadow-xs";
                                      letterStyle =
                                        "bg-teal-500 text-white font-bold";
                                    } else if (rubricScore === 3) {
                                      containerStyle =
                                        "border-amber-500/60 bg-amber-50/70 dark:bg-amber-950/40 text-foreground font-medium shadow-xs";
                                      letterStyle =
                                        "bg-amber-500 text-white font-bold";
                                    } else {
                                      containerStyle =
                                        "border-rose-500/60 bg-rose-50/70 dark:bg-rose-950/40 text-foreground font-medium shadow-xs";
                                      letterStyle =
                                        "bg-rose-500 text-white font-bold";
                                    }
                                  } else if (rubricScore === 5) {
                                    containerStyle =
                                      "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 text-foreground font-medium";
                                    letterStyle =
                                      "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold";
                                  }
                                } else {
                                  if (isCorrectOpt) {
                                    containerStyle =
                                      "border-emerald-500/60 bg-emerald-50/70 dark:bg-emerald-950/40 text-foreground font-medium shadow-xs";
                                    letterStyle =
                                      "bg-emerald-500 text-white font-bold";
                                  } else if (isUserChoice && !isCorrectOpt) {
                                    containerStyle =
                                      "border-rose-500/60 bg-rose-50/70 dark:bg-rose-950/40 text-foreground font-medium shadow-xs";
                                    letterStyle =
                                      "bg-rose-500 text-white font-bold";
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
                                          <span
                                            className={cn(
                                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                              isTKP
                                                ? rubricScore === 5
                                                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                                                  : rubricScore === 4
                                                  ? "bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/40"
                                                  : rubricScore === 3
                                                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40"
                                                  : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40"
                                                : isCorrectOpt
                                                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                                                : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40"
                                            )}
                                          >
                                            {isTKP ? (
                                              (rubricScore ?? 0) >= 4 ? (
                                                <CheckCircle2 className="w-3 h-3" />
                                              ) : (
                                                <XCircle className="w-3 h-3" />
                                              )
                                            ) : isCorrectOpt ? (
                                              <CheckCircle2 className="w-3 h-3" />
                                            ) : (
                                              <XCircle className="w-3 h-3" />
                                            )}
                                            Pilihan Anda
                                          </span>
                                        )}
                                        {typeof rubricScore === "number" && (
                                          <span
                                            className={cn(
                                              "px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border",
                                              rubricScore === 5
                                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                                : rubricScore === 4
                                                ? "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30"
                                                : rubricScore === 3
                                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                                : "bg-muted text-muted-foreground border-border"
                                            )}
                                          >
                                            {rubricScore} Poin
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Pending State Prompt */}
                            {!isAnswered && (
                              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                                <span>
                                  Soal ini belum dijawab. Kunci jawaban dan skor disembunyikan sampai Anda menjawab.
                                </span>
                                <Link href={`/chat?id=${quiz.chatId}`}>
                                  <Button size="sm" className="h-7 text-xs font-semibold">
                                    Jawab di Chat
                                  </Button>
                                </Link>
                              </div>
                            )}

                            {/* Answered Explanation Accordion */}
                            {isAnswered &&
                              (quiz.rubricRationale || quiz.aiExplanation) && (
                                <div className="pt-2 border-t border-border">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(quiz.id)}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>
                                      {isExpanded
                                        ? "Tutup Pembahasan & Rasional Rubrik"
                                        : "Lihat Pembahasan & Rasional Rubrik"}
                                    </span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  {isExpanded && (
                                    <div className="mt-3 p-4 rounded-lg bg-muted/50 border border-border text-xs space-y-3 animate-in fade-in-50 duration-200">
                                      {quiz.rubricRationale && (
                                        <div>
                                          <span className="font-bold text-foreground block mb-1">
                                            Rasional Skor & Kunci Jawaban:
                                          </span>
                                          <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                                            {quiz.rubricRationale}
                                          </p>
                                        </div>
                                      )}
                                      {quiz.aiExplanation && (
                                        <div>
                                          <span className="font-bold text-foreground block mb-1">
                                            Penjelasan Lengkap Tutor:
                                          </span>
                                          <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                                            {quiz.aiExplanation}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
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