"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { TryoutSessionDetail } from "@/lib/services/tryout.service";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  RotateCcw,
  XCircle,
} from "lucide-react";
import {
  formatDurationMinutesSeconds,
  formatTryoutDate,
  TRYOUT_CATEGORIES,
} from "./tryout-utils";

interface CatDiagnosticReportProps {
  session: TryoutSessionDetail;
}

const CATEGORY_LABELS = {
  TWK: "Tes Wawasan Kebangsaan",
  TIU: "Tes Inteligensia Umum",
  TKP: "Tes Karakteristik Pribadi",
} as const;

export function CatDiagnosticReport({ session }: CatDiagnosticReportProps) {
  const summary = session.scoreSummary;
  if (!summary) return null;

  const isPassed = summary.passedOverall;
  const modeLabel =
    session.mode === "cat_tryout"
      ? "Full Simulasi CAT BKN (110 Soal)"
      : "Mini CAT Tryout (30 Soal)";

  return (
    <div className="flex flex-col gap-5">
      <Card
        className={cn(
          "gap-4 py-5 shadow-xs",
          isPassed
            ? "border-success/50 bg-success/5"
            : "border-destructive/50 bg-destructive/5"
        )}
      >
        <CardHeader className="gap-2 border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {isPassed ? (
                <Award className="size-6 shrink-0 text-success" />
              ) : (
                <XCircle className="size-6 shrink-0 text-destructive" />
              )}
              <div className="flex flex-col gap-0.5">
                <CardTitle className="text-lg">
                  Hasil Diagnostik: {summary.verdict}
                </CardTitle>
                <CardDescription>
                  {modeLabel}
                  {session.completedAt
                    ? ` • Selesai ${formatTryoutDate(session.completedAt)}`
                    : ""}
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={isPassed ? "default" : "destructive"}
                className={cn(isPassed && "bg-success text-success-foreground")}
              >
                {isPassed ? "LULUS PASSING GRADE" : "TIDAK LULUS PASSING GRADE"}
              </Badge>
              <Badge variant="outline" className="font-mono">
                <Clock />
                {formatDurationMinutesSeconds(summary.totalTimeSpentSeconds)}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Skor Total SKD
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-foreground">
                  {summary.totalScoreEarned}
                </span>
                <span className="text-sm text-muted-foreground">
                  / {summary.maxTotalScore} poin
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-right">
              <span className="text-xs font-medium text-muted-foreground">
                Soal Terjawab
              </span>
              <span className="text-base font-bold text-foreground">
                {session.answeredCount} / {session.totalQuestions}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {TRYOUT_CATEGORIES.map((cat) => {
              const sub = summary.byCategory[cat];
              const pct =
                sub.maxScore > 0
                  ? Math.min(100, Math.round((sub.scoreEarned / sub.maxScore) * 100))
                  : 0;

              return (
                <Card key={cat} className="gap-3 py-4 shadow-none">
                  <CardHeader className="gap-1 pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">{cat}</Badge>
                      <Badge
                        variant={sub.passed ? "default" : "destructive"}
                        className={cn(
                          sub.passed && "bg-success text-success-foreground"
                        )}
                      >
                        {sub.passed ? (
                          <CheckCircle2 />
                        ) : (
                          <XCircle />
                        )}
                        {sub.passed ? "Lulus PG" : "Belum PG"}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      {CATEGORY_LABELS[cat]}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-2xl font-bold text-foreground">
                        {sub.scoreEarned}
                        <span className="text-xs font-normal text-muted-foreground">
                          /{sub.maxScore}
                        </span>
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        PG: {sub.passingGrade}
                      </span>
                    </div>

                    <Progress value={pct} />

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Dijawab: {sub.answeredCount}/{sub.questionCount}
                      </span>
                      <span>
                        Waktu: {formatDurationMinutesSeconds(sub.timeSpentSeconds)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {summary.weakSubtopics.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Subtopik Prioritas Penguatan (&lt; 70% Skor Maksimal)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {summary.weakSubtopics.map((weak) => (
                    <Badge
                      key={`${weak.category}-${weak.subtopic}`}
                      variant="outline"
                      className="border-warning/50 bg-warning/10 text-foreground"
                    >
                      {weak.category} • {weak.subtopic} (
                      {Math.round(weak.accuracyRatio * 100)}%)
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/tryout">
              <ArrowLeft data-icon="inline-start" />
              Kembali ke Lobi Tryout
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/tryout">
              <RotateCcw data-icon="inline-start" />
              Mulai Tryout Baru
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
