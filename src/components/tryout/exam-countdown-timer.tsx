"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatExamCountdown } from "./tryout-utils";

interface ExamCountdownTimerProps {
  remainingSeconds: number;
  className?: string;
}

export function ExamCountdownTimer({
  remainingSeconds,
  className,
}: ExamCountdownTimerProps) {
  const isCritical = remainingSeconds < 120;
  const isWarning = !isCritical && remainingSeconds < 600;

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`Sisa waktu ujian ${formatExamCountdown(remainingSeconds)}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs font-semibold tabular-nums transition-colors sm:text-sm",
        isCritical
          ? "animate-pulse border-destructive/50 bg-destructive/10 text-destructive"
          : isWarning
            ? "border-warning/50 bg-warning/10 text-warning"
            : "border-border bg-secondary text-secondary-foreground",
        className
      )}
    >
      <Clock className="size-3.5 shrink-0" />
      <span>{formatExamCountdown(remainingSeconds)}</span>
    </div>
  );
}
