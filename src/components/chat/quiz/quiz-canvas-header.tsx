"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Award, BarChart3, Layers, X } from "lucide-react";

export interface StepperPillItem {
  id: string;
  isAnswered: boolean;
  isOptimal?: boolean;
}

interface QuizCanvasHeaderProps {
  title: string;
  items: StepperPillItem[];
  activeIndex: number;
  showSummary: boolean;
  isConfiguring: boolean;
  isMobileSheet: boolean;
  onSelectIndex: (index: number) => void;
  onToggleSummary: () => void;
  onOpenConfigurator: () => void;
  onClose: () => void;
}

export function QuizCanvasHeader({
  title,
  items,
  activeIndex,
  showSummary,
  isConfiguring,
  isMobileSheet,
  onSelectIndex,
  onToggleSummary,
  onOpenConfigurator,
  onClose,
}: QuizCanvasHeaderProps) {
  const answeredCount = items.filter((item) => item.isAnswered).length;
  const progressPercent =
    items.length > 0 ? Math.round((answeredCount / items.length) * 100) : 0;

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-4 py-3",
          isMobileSheet && "pr-10"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Award className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold text-foreground">
            {title}
          </span>
          {items.length > 0 && !showSummary && !isConfiguring && activeIndex >= 0 && (
            <Badge variant="secondary">
              {activeIndex + 1}/{items.length}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={isConfiguring ? "secondary" : "ghost"}
            size="sm"
            onClick={onOpenConfigurator}
          >
            <Layers data-icon="inline-start" />
            Paket
          </Button>
          {items.length > 0 && (
            <Button
              type="button"
              variant={showSummary && !isConfiguring ? "secondary" : "ghost"}
              size="sm"
              onClick={onToggleSummary}
            >
              <BarChart3 data-icon="inline-start" />
              Ringkasan
            </Button>
          )}
          {!isMobileSheet && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Tutup panel kuis"
              onClick={onClose}
            >
              <X />
            </Button>
          )}
        </div>
      </div>

      {items.length > 0 && !isConfiguring && (
        <div className="flex flex-col gap-2 px-4 pb-3">
          <Progress value={progressPercent} />
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {items.map((item, idx) => {
              const isCurrent = !showSummary && idx === activeIndex;
              return (
                <Button
                  key={item.id}
                  type="button"
                  variant={isCurrent ? "default" : "outline"}
                  size="sm"
                  onClick={() => onSelectIndex(idx)}
                  className={cn(
                    "h-7 px-2.5 text-xs",
                    !isCurrent && item.isAnswered && "border-success/50 text-success"
                  )}
                >
                  #{idx + 1}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
