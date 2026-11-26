"use client";

import { useMemo, useState } from "react";
import {
  MaterialDrawer,
  type PreloadedMaterialData,
} from "@/components/materials/material-drawer";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SkdCategory } from "@/lib/scoring/skd-scoring";
import type { TryoutQuestionReviewItem } from "@/lib/services/tryout.service";
import { CheckCircle2, FileSearch } from "lucide-react";
import { CatReviewCard } from "./cat-review-card";

type ReviewFilter = "ALL" | "SUBOPTIMAL" | SkdCategory;

interface CatReviewListProps {
  questions: TryoutQuestionReviewItem[];
}

export function CatReviewList({ questions }: CatReviewListProps) {
  const [filter, setFilter] = useState<ReviewFilter>("ALL");
  const [drawerMaterial, setDrawerMaterial] =
    useState<PreloadedMaterialData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const suboptimalCount = useMemo(
    () => questions.filter((q) => q.scoreEarned < 5).length,
    [questions]
  );

  const filteredQuestions = useMemo(() => {
    if (filter === "ALL") return questions;
    if (filter === "SUBOPTIMAL") {
      return questions.filter((q) => q.scoreEarned < 5);
    }
    return questions.filter((q) => q.category === filter);
  }, [questions, filter]);

  const handleOpenMaterial = (material: PreloadedMaterialData) => {
    setDrawerMaterial(material);
    setDrawerOpen(true);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSearch className="size-4 text-primary" />
          <h2 className="text-base font-bold text-foreground">
            Pembahasan Per Soal
          </h2>
          <Badge variant="secondary">{filteredQuestions.length} soal</Badge>
        </div>

        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={filter}
          onValueChange={(val) => {
            if (val) setFilter(val as ReviewFilter);
          }}
          className="flex-wrap"
        >
          <ToggleGroupItem value="ALL">Semua ({questions.length})</ToggleGroupItem>
          <ToggleGroupItem value="SUBOPTIMAL">
            Salah / Belum Optimal ({suboptimalCount})
          </ToggleGroupItem>
          <ToggleGroupItem value="TWK">TWK</ToggleGroupItem>
          <ToggleGroupItem value="TIU">TIU</ToggleGroupItem>
          <ToggleGroupItem value="TKP">TKP</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {filteredQuestions.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckCircle2 />
            </EmptyMedia>
            <EmptyTitle>Tidak Ada Soal di Filter Ini</EmptyTitle>
            <EmptyDescription>
              Semua soal pada kategori ini sudah meraih skor maksimal 5 poin.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredQuestions.map((question) => (
            <CatReviewCard
              key={question.id}
              question={question}
              onOpenMaterial={handleOpenMaterial}
            />
          ))}
        </div>
      )}

      <MaterialDrawer
        slug={drawerMaterial?.slug ?? null}
        preloadedMaterial={drawerMaterial}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </section>
  );
}
