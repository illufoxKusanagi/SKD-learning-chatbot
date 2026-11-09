"use client";

import { useMemo, useState } from "react";
import { QuizAttemptItem } from "@/hooks/use-chat";
import { QuizCard } from "./quiz-card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  HelpCircle,
  Award,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface ChatQuizDrawerProps {
  quizzes: QuizAttemptItem[];
  onSelectOption?: (quizId: string, option: "A" | "B" | "C" | "D" | "E") => void;
  disabled?: boolean;
}

export function ChatQuizDrawer({
  quizzes,
  onSelectOption,
  disabled = false,
}: ChatQuizDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const stats = useMemo(() => {
    const total = quizzes.length;
    const answered = quizzes.filter((q) => q.status === "answered").length;
    const pending = total - answered;

    let scoreEarned = 0;
    let maxScore = 0;

    for (const q of quizzes) {
      if (q.status === "answered") {
        scoreEarned += q.scoreEarned ?? 0;
        maxScore += q.maxScore ?? 5;
      }
    }

    return { total, answered, pending, scoreEarned, maxScore };
  }, [quizzes]);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 px-3 text-xs font-medium border-border hover:bg-accent cursor-pointer transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5 text-primary" />
          <span>Soal di Chat ({quizzes.length})</span>
          {stats.pending > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse">
              {stats.pending} baru
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col p-0 gap-0 overflow-hidden"
      >
        <SheetHeader className="px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              <SheetTitle className="text-base font-bold">
                Latihan Soal Percakapan Ini
              </SheetTitle>
            </div>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Daftar soal SKD yang telah dibuat dan dijawab di sesi ini
          </SheetDescription>

          {/* Quick Chat Stats Bar */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="p-2.5 rounded-lg bg-card border border-border text-center">
              <span className="block text-[11px] text-muted-foreground font-medium">
                Total Soal
              </span>
              <span className="text-lg font-bold text-foreground">
                {stats.total}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-card border border-border text-center">
              <span className="block text-[11px] text-muted-foreground font-medium">
                Terjawab
              </span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {stats.answered}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-card border border-border text-center">
              <span className="block text-[11px] text-muted-foreground font-medium">
                Total Skor
              </span>
              <span className="text-lg font-bold text-primary">
                {stats.scoreEarned}
                <span className="text-xs font-normal text-muted-foreground">
                  /{stats.maxScore}
                </span>
              </span>
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable Quizzes List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {quizzes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <HelpCircle className="w-6 h-6 text-primary" />
              </div>
              <h4 className="text-sm font-semibold text-foreground mb-1">
                Belum Ada Soal di Sesi Ini
              </h4>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Minta bot di kolom chat untuk memberikan 1 soal TWK HOTS, TIU Silogisme/Numerik, atau TKP BerAKHLAK.
              </p>
            </div>
          ) : (
            quizzes.map((quiz, index) => (
              <div key={quiz.id} className="relative">
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-bold text-muted-foreground">
                    #{index + 1}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    • {quiz.category}
                  </span>
                  {quiz.subtopic && (
                    <span className="text-[11px] text-muted-foreground truncate">
                      ({quiz.subtopic})
                    </span>
                  )}
                </div>
                <QuizCard
                  quiz={quiz}
                  onSelectOption={onSelectOption}
                  disabled={disabled}
                />
              </div>
            ))
          )}
        </div>

        {/* Footer Link to Dashboard */}
        <div className="p-4 border-t border-border bg-muted/20">
          <Link
            href="/quiz-history"
            onClick={() => setIsOpen(false)}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <span>Buka Dashboard Riwayat Latihan SKD</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}