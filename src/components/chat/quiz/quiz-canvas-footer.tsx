"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, BarChart3, ExternalLink } from "lucide-react";

interface QuizCanvasFooterProps {
  totalItems: number;
  activeIndex: number;
  showSummary: boolean;
  isConfiguring: boolean;
  quizHistoryHref: string;
  onPrev: () => void;
  onNext: () => void;
  onToggleSummary: () => void;
  onCloseSheet: () => void;
}

export function QuizCanvasFooter({
  totalItems,
  activeIndex,
  showSummary,
  isConfiguring,
  quizHistoryHref,
  onPrev,
  onNext,
  onToggleSummary,
  onCloseSheet,
}: QuizCanvasFooterProps) {
  return (
    <div className="flex items-center justify-between gap-2 bg-muted/20 px-4 py-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isConfiguring || showSummary || activeIndex <= 0}
        onClick={onPrev}
      >
        <ArrowLeft data-icon="inline-start" />
        Sebelumnya
      </Button>

      <Button asChild variant="ghost" size="sm">
        <Link href={quizHistoryHref} onClick={onCloseSheet}>
          Riwayat
          <ExternalLink data-icon="inline-end" />
        </Link>
      </Button>

      {totalItems > 0 && activeIndex < totalItems - 1 && !showSummary && !isConfiguring ? (
        <Button type="button" variant="outline" size="sm" onClick={onNext}>
          Selanjutnya
          <ArrowRight data-icon="inline-end" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={totalItems === 0 || isConfiguring}
          onClick={onToggleSummary}
        >
          <BarChart3 data-icon="inline-start" />
          {showSummary ? "Kembali ke Soal" : "Ringkasan"}
        </Button>
      )}
    </div>
  );
}
