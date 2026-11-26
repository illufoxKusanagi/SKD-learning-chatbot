"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SkdCategory } from "@/lib/scoring/skd-scoring";
import type { TryoutQuestionMaskedItem } from "@/lib/services/tryout.service";
import { cn } from "@/lib/utils";

type GridFilter = "ALL" | SkdCategory;

interface CatNavigationGridProps {
  questions: TryoutQuestionMaskedItem[];
  activeIndex: number;
  onSelectIndex: (index: number) => void;
}

export function CatNavigationGrid({
  questions,
  activeIndex,
  onSelectIndex,
}: CatNavigationGridProps) {
  const [filter, setFilter] = useState<GridFilter>("ALL");

  const filteredQuestions = useMemo(() => {
    if (filter === "ALL") return questions;
    return questions.filter((q) => q.category === filter);
  }, [questions, filter]);

  const counts = useMemo(() => {
    let answered = 0;
    let flagged = 0;
    for (const q of questions) {
      if (q.selectedOption !== null) answered += 1;
      if (q.isFlagged) flagged += 1;
    }
    return {
      answered,
      flagged,
      unanswered: Math.max(0, questions.length - answered),
    };
  }, [questions]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-col gap-2 px-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Navigasi Soal
          </span>
          <span className="text-xs font-medium text-foreground">
            {counts.answered}/{questions.length} dijawab
          </span>
        </div>

        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={filter}
          onValueChange={(val) => {
            if (val) setFilter(val as GridFilter);
          }}
          className="w-full"
        >
          <ToggleGroupItem value="ALL" className="flex-1 text-xs">
            Semua
          </ToggleGroupItem>
          <ToggleGroupItem value="TWK" className="flex-1 text-xs">
            TWK
          </ToggleGroupItem>
          <ToggleGroupItem value="TIU" className="flex-1 text-xs">
            TIU
          </ToggleGroupItem>
          <ToggleGroupItem value="TKP" className="flex-1 text-xs">
            TKP
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs border border-success/60 bg-success/15" />
            <span>Dijawab ({counts.answered})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs border border-warning bg-warning/20" />
            <span>Ragu ({counts.flagged})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs border border-border bg-background" />
            <span>Kosong ({counts.unanswered})</span>
          </div>
        </div>
      </div>

      <Separator />

      <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
        <div className="grid grid-cols-5 gap-1.5 py-1">
          {filteredQuestions.map((q) => {
            const idx = q.number - 1;
            const isActive = idx === activeIndex;
            const isAnswered = q.selectedOption !== null;

            return (
              <Button
                key={q.id}
                type="button"
                size="sm"
                variant="outline"
                aria-label={`Soal ${q.number} ${q.category}${q.isFlagged ? ", ragu-ragu" : isAnswered ? `, dijawab ${q.selectedOption}` : ", belum dijawab"}`}
                aria-current={isActive ? "step" : undefined}
                onClick={() => onSelectIndex(idx)}
                className={cn(
                  "h-9 w-full px-0 font-mono text-xs font-semibold",
                  q.isFlagged
                    ? "border-warning bg-warning/20 text-foreground hover:bg-warning/30"
                    : isAnswered
                      ? "border-success/60 bg-success/15 text-success hover:bg-success/25"
                      : "text-foreground",
                  isActive && "ring-2 ring-primary ring-offset-1"
                )}
              >
                {q.number}
              </Button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
