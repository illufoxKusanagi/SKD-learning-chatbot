"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { TryoutSessionSummaryItem } from "@/lib/services/tryout.service";
import { cn } from "@/lib/utils";
import { ArrowRight, Award, History } from "lucide-react";
import { formatTryoutDate } from "./tryout-utils";

interface TryoutHistoryListProps {
  sessions: TryoutSessionSummaryItem[];
}

export function TryoutHistoryList({ sessions }: TryoutHistoryListProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="size-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Riwayat Simulasi CAT Selesai
          </h2>
        </div>
        <Badge variant="secondary">{sessions.length} sesi</Badge>
      </div>

      {sessions.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Award />
            </EmptyMedia>
            <EmptyTitle>Belum Ada Riwayat Simulasi CAT</EmptyTitle>
            <EmptyDescription>
              Mulai Full Simulasi CAT BKN atau Mini CAT di atas untuk melihat
              skor passing grade dan pembahasan lengkap.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((item) => {
            const passed = item.scoreSummary?.passedOverall ?? false;
            return (
              <Card key={item.id} className="gap-3 py-4 shadow-xs">
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {item.mode === "cat_tryout"
                          ? "Full Simulasi CAT BKN"
                          : "Mini CAT Tryout"}
                      </span>
                      <Badge
                        variant={passed ? "default" : "destructive"}
                        className={cn(
                          passed && "bg-success text-success-foreground"
                        )}
                      >
                        {item.scoreSummary?.verdict ?? "SELESAI"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTryoutDate(item.completedAt ?? item.startedAt)} •{" "}
                      {item.answeredCount}/{item.totalQuestions} terjawab
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {item.scoreSummary && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-foreground">
                          {item.scoreSummary.totalScoreEarned}/
                          {item.scoreSummary.maxTotalScore}
                        </span>
                        <Badge variant="outline">
                          TWK {item.scoreSummary.byCategory.TWK.scoreEarned}
                        </Badge>
                        <Badge variant="outline">
                          TIU {item.scoreSummary.byCategory.TIU.scoreEarned}
                        </Badge>
                        <Badge variant="outline">
                          TKP {item.scoreSummary.byCategory.TKP.scoreEarned}
                        </Badge>
                      </div>
                    )}

                    <Button asChild variant="outline" size="sm">
                      <Link href={`/tryout/${item.id}`}>
                        Lihat Pembahasan
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
