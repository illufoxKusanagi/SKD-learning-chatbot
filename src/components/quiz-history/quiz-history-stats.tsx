"use client";

import { Award, BarChart3, CheckCircle2, Layers, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { QuizStats } from "@/components/quiz-history/quiz-history-types";

interface QuizHistoryStatsProps {
  stats: QuizStats | null;
}

export function QuizHistoryStats({ stats }: QuizHistoryStatsProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Statistik Performa &amp; Target Passing Grade BKN
          </h2>
        </div>
        {stats && (
          <span className="text-xs text-muted-foreground">
            Total {stats.totalAttempts} Soal Terdaftar
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="gap-3 py-4 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Total Latihan
            </span>
            <Layers className="size-4 text-primary" />
          </CardHeader>
          <CardContent className="flex flex-col gap-1 px-4">
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
          <CardFooter className="justify-between px-4 text-[11px] text-muted-foreground">
            <span>Belum Dijawab:</span>
            <span className="font-semibold text-warning">
              {stats?.pendingCount ?? 0} soal
            </span>
          </CardFooter>
        </Card>

        <Card className="gap-3 py-4 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
            <Badge
              variant="outline"
              className="rounded-md border-destructive/20 bg-destructive/10 font-bold text-destructive"
            >
              TWK (Wawasan Kebangsaan)
            </Badge>
            <CheckCircle2 className="size-4 shrink-0 text-destructive" />
          </CardHeader>
          <CardContent className="flex flex-col gap-1 px-4">
            <div className="flex items-baseline gap-1.5 text-2xl font-extrabold text-foreground">
              <span>{stats?.byCategory.TWK.accuracyPercent ?? 0}%</span>
              <span className="text-xs font-normal text-muted-foreground">
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
          <CardFooter className="justify-between px-4 text-[11px] text-muted-foreground">
            <span>Passing Grade BKN:</span>
            <span className="font-semibold text-foreground">
              65 Poin (min. 13 benar)
            </span>
          </CardFooter>
        </Card>

        <Card className="gap-3 py-4 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
            <Badge
              variant="outline"
              className="rounded-md border-primary/20 bg-primary/10 font-bold text-primary"
            >
              TIU (Inteligensia Umum)
            </Badge>
            <Sparkles className="size-4 shrink-0 text-primary" />
          </CardHeader>
          <CardContent className="flex flex-col gap-1 px-4">
            <div className="flex items-baseline gap-1.5 text-2xl font-extrabold text-foreground">
              <span>{stats?.byCategory.TIU.accuracyPercent ?? 0}%</span>
              <span className="text-xs font-normal text-muted-foreground">
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
          <CardFooter className="justify-between px-4 text-[11px] text-muted-foreground">
            <span>Passing Grade BKN:</span>
            <span className="font-semibold text-foreground">
              80 Poin (min. 16 benar)
            </span>
          </CardFooter>
        </Card>

        <Card className="gap-3 py-4 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
            <Badge
              variant="outline"
              className="rounded-md border-success/20 bg-success/10 font-bold text-success"
            >
              TKP (Karakteristik Pribadi)
            </Badge>
            <Award className="size-4 shrink-0 text-success" />
          </CardHeader>
          <CardContent className="flex flex-col gap-1 px-4">
            <div className="flex items-baseline gap-1 text-2xl font-extrabold text-foreground">
              <span>{stats?.byCategory.TKP.averagePoints ?? 0}</span>
              <span className="text-xs font-normal text-muted-foreground">
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
          <CardFooter className="justify-between px-4 text-[11px] text-muted-foreground">
            <span>Passing Grade BKN:</span>
            <span className="font-semibold text-foreground">
              166 Poin (skala 1–5)
            </span>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
