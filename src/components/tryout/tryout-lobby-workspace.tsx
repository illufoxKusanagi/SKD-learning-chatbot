"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { TryoutMode } from "@/lib/scoring/skd-scoring";
import type {
  TryoutBankReadiness,
  TryoutSessionSummaryItem,
} from "@/lib/services/tryout.service";
import { AlertTriangle, ArrowRight, Clock, RotateCcw } from "lucide-react";
import { TryoutHistoryList } from "./tryout-history-list";
import { TryoutModeCards } from "./tryout-mode-cards";
import {
  formatExamCountdown,
  readGuestTryoutSessionIds,
  recordGuestTryoutSessionId,
} from "./tryout-utils";

export function TryoutLobbyWorkspace() {
  const router = useRouter();
  const [readiness, setReadiness] = useState<TryoutBankReadiness | null>(null);
  const [sessions, setSessions] = useState<TryoutSessionSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingMode, setStartingMode] = useState<TryoutMode | null>(null);

  const loadLobby = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const guestIds = readGuestTryoutSessionIds();
      const sessionsUrl =
        guestIds.length > 0
          ? `/api/tryout/sessions?sessionIds=${encodeURIComponent(guestIds.join(","))}`
          : "/api/tryout/sessions";

      const [readinessRes, sessionsRes] = await Promise.all([
        fetch("/api/tryout/readiness", { cache: "no-store" }),
        fetch(sessionsUrl, { cache: "no-store" }),
      ]);

      const [readinessJson, sessionsJson] = await Promise.all([
        readinessRes.json().catch(() => ({})),
        sessionsRes.json().catch(() => ({})),
      ]);

      if (!readinessRes.ok || !readinessJson.success || !readinessJson.data) {
        throw new Error(
          readinessJson.error || "Gagal memuat kesiapan bank soal CAT"
        );
      }

      setReadiness(readinessJson.data as TryoutBankReadiness);
      if (
        sessionsRes.ok &&
        sessionsJson.success &&
        Array.isArray(sessionsJson.data)
      ) {
        setSessions(sessionsJson.data as TryoutSessionSummaryItem[]);
      } else {
        setSessions([]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat lobi Simulasi CAT"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLobby();
  }, [loadLobby]);

  const handleStartTryout = async (mode: TryoutMode) => {
    if (startingMode) return;
    setStartingMode(mode);
    try {
      const guestSessionIds = readGuestTryoutSessionIds();
      const res = await fetch("/api/tryout/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          guestSessionId: guestSessionIds[0] ?? null,
          guestSessionIds,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.data?.id) {
        throw new Error(
          json.error || `Gagal memulai tryout (HTTP ${res.status})`
        );
      }

      recordGuestTryoutSessionId(json.data.id);
      router.push(`/tryout/${json.data.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memulai simulasi CAT"
      );
      setStartingMode(null);
    }
  };

  const activeSession = useMemo(
    () => sessions.find((s) => s.status === "in_progress") ?? null,
    [sessions]
  );
  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === "completed"),
    [sessions]
  );

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !readiness) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center p-6">
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Gagal Memuat Lobi Simulasi CAT</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 pt-1">
            <p>{error || "Data kesiapan bank soal tidak tersedia."}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={loadLobby}
            >
              <RotateCcw data-icon="inline-start" />
              Coba Lagi
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
        {activeSession && (
          <Alert className="border-primary/50 bg-primary/5">
            <Clock className="text-primary" />
            <AlertTitle className="text-foreground">
              Sesi Ujian Masih Berlangsung
            </AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3 pt-1 text-foreground">
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span>
                  {activeSession.mode === "cat_tryout"
                    ? "Full Simulasi CAT BKN"
                    : "Mini CAT Tryout"}
                </span>
                <Badge variant="outline">
                  {activeSession.answeredCount}/{activeSession.totalQuestions}{" "}
                  terjawab
                </Badge>
                <Badge variant="secondary" className="font-mono">
                  Sisa {formatExamCountdown(activeSession.remainingSeconds)}
                </Badge>
              </div>
              <Button asChild size="sm">
                <Link href={`/tryout/${activeSession.id}`}>
                  Lanjutkan Ujian
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <TryoutModeCards
          readiness={readiness}
          startingMode={startingMode}
          onStartTryout={handleStartTryout}
        />

        <TryoutHistoryList sessions={completedSessions} />
      </div>
    </ScrollArea>
  );
}
