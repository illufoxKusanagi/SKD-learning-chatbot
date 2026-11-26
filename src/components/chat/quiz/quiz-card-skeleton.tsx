"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { OPTION_KEYS } from "./quiz-utils";

export function QuizCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("w-full gap-4 py-5", className)}>
      <CardHeader className="gap-2 border-b pb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="flex flex-col gap-2 pt-2">
          {OPTION_KEYS.map((key) => (
            <Skeleton key={key} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
