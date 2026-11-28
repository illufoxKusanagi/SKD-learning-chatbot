"use client";

import { Filter } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  QuizCategoryFilter,
  QuizStatusFilter,
} from "@/components/quiz-history/quiz-history-types";

interface QuizHistoryFiltersProps {
  selectedCategory: QuizCategoryFilter;
  onCategoryChange: (value: QuizCategoryFilter) => void;
  selectedStatus: QuizStatusFilter;
  onStatusChange: (value: QuizStatusFilter) => void;
}

const CATEGORIES: QuizCategoryFilter[] = ["ALL", "TWK", "TIU", "TKP"];
const STATUSES: { label: string; value: QuizStatusFilter }[] = [
  { label: "Semua Status", value: "ALL" },
  { label: "Sudah Dijawab", value: "answered" },
  { label: "Belum Dijawab", value: "pending" },
];

export function QuizHistoryFilters({
  selectedCategory,
  onCategoryChange,
  selectedStatus,
  onStatusChange,
}: QuizHistoryFiltersProps) {
  return (
    <section>
      <Card className="gap-3 bg-card/60 py-4 shadow-none">
        <CardHeader className="flex flex-row items-center gap-2 px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Filter className="size-3.5" />
          <span>Filter Soal Latihan</span>
        </CardHeader>

        <CardContent className="flex flex-wrap items-center justify-between gap-4 px-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Materi:</span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={1}
              value={selectedCategory}
              onValueChange={(val) => {
                if (val) onCategoryChange(val as QuizCategoryFilter);
              }}
              className="flex-wrap gap-1.5"
            >
              {CATEGORIES.map((cat) => (
                <ToggleGroupItem
                  key={cat}
                  value={cat}
                  className="cursor-pointer text-xs font-semibold data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground"
                >
                  {cat === "ALL" ? "Semua Kategori" : cat}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={1}
              value={selectedStatus}
              onValueChange={(val) => {
                if (val) onStatusChange(val as QuizStatusFilter);
              }}
              className="flex-wrap gap-1.5"
            >
              {STATUSES.map((st) => (
                <ToggleGroupItem
                  key={st.value}
                  value={st.value}
                  className="cursor-pointer text-xs font-semibold data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground"
                >
                  {st.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
