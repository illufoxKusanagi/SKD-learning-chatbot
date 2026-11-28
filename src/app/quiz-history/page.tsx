"use client";

import { Suspense } from "react";
import { QuizHistoryWorkspace } from "@/components/quiz-history/quiz-history-workspace";
import { Spinner } from "@/components/ui/spinner";

export default function QuizHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
          <Spinner className="size-6 text-primary" />
          <span>Memuat riwayat latihan soal...</span>
        </div>
      }
    >
      <QuizHistoryWorkspace />
    </Suspense>
  );
}
