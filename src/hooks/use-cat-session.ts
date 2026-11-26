"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { OptionKey } from "@/lib/scoring/skd-scoring";
import type {
  TryoutQuestionMaskedItem,
  TryoutQuestionReviewItem,
  TryoutSessionDetail,
} from "@/lib/services/tryout.service";
import {
  isValidTryoutUuid,
  recordGuestTryoutSessionId,
} from "@/components/tryout/tryout-utils";

interface PatchTryoutPayload {
  questionId: string;
  selectedOption?: OptionKey | null;
  isFlagged?: boolean;
  timeSpentDeltaSeconds?: number;
}

export function useCatSession(sessionId: string) {
  const [session, setSession] = useState<TryoutSessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const sessionRef = useRef<TryoutSessionDetail | null>(null);
  const activeIndexRef = useRef(0);
  const deadlineMsRef = useRef<number | null>(null);
  const questionEnteredAtRef = useRef<number>(Date.now());
  const finishingRef = useRef(false);
  const pendingCountRef = useRef(0);

  sessionRef.current = session;
  activeIndexRef.current = activeQuestionIndex;

  const consumeQuestionDeltaSeconds = useCallback((): number => {
    const now = Date.now();
    const delta = Math.max(
      0,
      Math.round((now - questionEnteredAtRef.current) / 1000)
    );
    questionEnteredAtRef.current = now;
    return Math.min(600, delta);
  }, []);

  const loadSession = useCallback(async () => {
    if (!isValidTryoutUuid(sessionId)) {
      setError("ID sesi tryout tidak valid");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tryout/sessions/${sessionId}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.data) {
        throw new Error(
          json.error || `Gagal memuat sesi tryout (HTTP ${res.status})`
        );
      }

      const detail = json.data as TryoutSessionDetail;
      recordGuestTryoutSessionId(detail.id);
      setSession(detail);
      sessionRef.current = detail;
      questionEnteredAtRef.current = Date.now();

      if (detail.status === "in_progress") {
        deadlineMsRef.current = Date.now() + detail.remainingSeconds * 1000;
        setRemainingSeconds(detail.remainingSeconds);
        finishingRef.current = false;
      } else {
        deadlineMsRef.current = null;
        setRemainingSeconds(0);
        finishingRef.current = true;
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat sesi tryout CAT"
      );
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const finishExam = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || current.status !== "in_progress") return;
    if (finishingRef.current) return;

    finishingRef.current = true;
    setIsFinishing(true);

    try {
      const activeQ = current.questions[activeIndexRef.current];
      const delta = consumeQuestionDeltaSeconds();
      if (activeQ && delta > 0) {
        await fetch(`/api/tryout/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: activeQ.id,
            timeSpentDeltaSeconds: delta,
          }),
        }).catch(() => undefined);
      }

      const res = await fetch(`/api/tryout/sessions/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finish" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.data) {
        throw new Error(
          json.error || `Gagal menyelesaikan ujian (HTTP ${res.status})`
        );
      }

      const completed = json.data as TryoutSessionDetail;
      deadlineMsRef.current = null;
      setRemainingSeconds(0);
      setSession(completed);
      sessionRef.current = completed;
    } catch (err) {
      finishingRef.current = false;
      toast.error(
        err instanceof Error ? err.message : "Gagal mengumpulkan ujian"
      );
    } finally {
      setIsFinishing(false);
    }
  }, [consumeQuestionDeltaSeconds, sessionId]);

  useEffect(() => {
    if (session?.status !== "in_progress") return;

    const syncClock = () => {
      if (deadlineMsRef.current === null) return;
      const nextRemaining = Math.max(
        0,
        Math.ceil((deadlineMsRef.current - Date.now()) / 1000)
      );
      setRemainingSeconds(nextRemaining);
      if (nextRemaining <= 0 && !finishingRef.current) {
        void finishExam();
      }
    };

    syncClock();
    const interval = window.setInterval(syncClock, 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        syncClock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session?.status, finishExam]);

  const patchProgress = useCallback(
    async (payload: PatchTryoutPayload) => {
      pendingCountRef.current += 1;
      setIsSyncing(true);

      try {
        const res = await fetch(`/api/tryout/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));

        if (res.status === 409) {
          if (
            json?.code === "EXAM_TIME_EXPIRED" ||
            json?.code === "EXAM_ALREADY_FINISHED"
          ) {
            await finishExam();
            return;
          }
        }

        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }

        const serverRemaining = json.data.remainingSeconds;
        if (
          typeof serverRemaining === "number" &&
          sessionRef.current?.status === "in_progress"
        ) {
          const nextDeadline = Date.now() + serverRemaining * 1000;
          if (
            deadlineMsRef.current === null ||
            Math.abs(deadlineMsRef.current - nextDeadline) > 3000
          ) {
            deadlineMsRef.current = nextDeadline;
          }
        }
      } catch {
        toast.error("Gagal menyinkronkan progres soal ke server", {
          action: {
            label: "Coba Lagi",
            onClick: () => {
              void patchProgress({
                questionId: payload.questionId,
                selectedOption: payload.selectedOption,
                isFlagged: payload.isFlagged,
              });
            },
          },
        });
      } finally {
        pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
        setIsSyncing(pendingCountRef.current > 0);
      }
    },
    [finishExam, sessionId]
  );

  const goToQuestion = useCallback(
    (nextIndex: number) => {
      const current = sessionRef.current;
      if (!current) return;
      const clamped = Math.max(
        0,
        Math.min(current.questions.length - 1, nextIndex)
      );
      if (clamped === activeIndexRef.current) return;

      if (current.status === "in_progress") {
        const prevQuestion = current.questions[activeIndexRef.current];
        const delta = consumeQuestionDeltaSeconds();
        if (prevQuestion && delta > 0) {
          void patchProgress({
            questionId: prevQuestion.id,
            timeSpentDeltaSeconds: delta,
          });
        }
      }

      setActiveQuestionIndex(clamped);
      questionEnteredAtRef.current = Date.now();
    },
    [consumeQuestionDeltaSeconds, patchProgress]
  );

  const updateActiveOption = useCallback(
    (option: OptionKey | null) => {
      const current = sessionRef.current;
      if (!current || current.status !== "in_progress") return;
      const target = current.questions[activeIndexRef.current];
      if (!target) return;

      const delta = consumeQuestionDeltaSeconds();
      const updatedQuestions = current.questions.map((q, idx) =>
        idx === activeIndexRef.current
          ? {
              ...q,
              selectedOption: option,
              timeSpentSeconds: q.timeSpentSeconds + delta,
            }
          : q
      );
      const answeredCount = updatedQuestions.filter(
        (q) => q.selectedOption !== null
      ).length;

      const nextSession: TryoutSessionDetail = {
        ...current,
        answeredCount,
        questions: updatedQuestions,
      };
      sessionRef.current = nextSession;
      setSession(nextSession);

      void patchProgress({
        questionId: target.id,
        selectedOption: option,
        timeSpentDeltaSeconds: delta,
      });
    },
    [consumeQuestionDeltaSeconds, patchProgress]
  );

  const toggleFlag = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.status !== "in_progress") return;
    const target = current.questions[activeIndexRef.current];
    if (!target) return;

    const nextFlagged = !target.isFlagged;
    const nextFlaggedIds = nextFlagged
      ? Array.from(new Set([...current.flaggedQuestionIds, target.id]))
      : current.flaggedQuestionIds.filter((id) => id !== target.id);

    const updatedQuestions = current.questions.map((q, idx) =>
      idx === activeIndexRef.current ? { ...q, isFlagged: nextFlagged } : q
    );

    const nextSession: TryoutSessionDetail = {
      ...current,
      flaggedQuestionIds: nextFlaggedIds,
      questions: updatedQuestions,
    };
    sessionRef.current = nextSession;
    setSession(nextSession);

    void patchProgress({
      questionId: target.id,
      isFlagged: nextFlagged,
    });
  }, [patchProgress]);

  const activeQuestion = useMemo<
    TryoutQuestionMaskedItem | TryoutQuestionReviewItem | null
  >(() => {
    if (!session) return null;
    return session.questions[activeQuestionIndex] ?? null;
  }, [session, activeQuestionIndex]);

  return {
    session,
    isLoading,
    error,
    remainingSeconds,
    activeQuestionIndex,
    activeQuestion,
    isSyncing,
    isFinishing,
    goToQuestion,
    selectOption: (option: OptionKey) => updateActiveOption(option),
    clearOption: () => updateActiveOption(null),
    toggleFlag,
    finishExam,
    reload: loadSession,
  };
}
