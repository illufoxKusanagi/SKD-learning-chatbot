"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import HelpButton from "@/components/ui/help-button";
import ModeToggleButton from "@/components/ui/mode-toggle-button";
import { CatExamWorkspace } from "@/components/tryout/cat-exam-workspace";
import { ArrowLeft, ClipboardCheck } from "lucide-react";

export default function TryoutSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = typeof params?.sessionId === "string" ? params.sessionId : "";

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button asChild variant="outline" size="sm">
            <Link href="/tryout">
              <ArrowLeft data-icon="inline-start" />
              <span className="hidden sm:inline">Lobi Tryout</span>
            </Link>
          </Button>
          <ClipboardCheck className="size-4 shrink-0 text-primary" />
          <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
            Simulasi CAT BKN
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ModeToggleButton />
          <HelpButton />
        </div>
      </header>

      <CatExamWorkspace sessionId={sessionId} />
    </div>
  );
}
