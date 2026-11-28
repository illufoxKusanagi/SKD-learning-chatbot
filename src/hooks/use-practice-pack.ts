"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { QuizOptionKey } from "@/components/chat/quiz/quiz-utils";
import type { PracticeAnswerState } from "@/components/chat/quiz/quiz-utils";
import type {
  PracticePackResult,
  PracticeQuestionItem,
  SyncPracticeAttemptResult,
} from "@/lib/services/practice.service";

const GUEST_PRACTICE_SESSIONS_KEY = "skd_guest_practice_session_ids";
const GUEST_CHAT_IDS_KEY = "skd_guest_chat_ids";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readUuidList(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((id): id is string => typeof id === "string" && UUID_REGEX.test(id.trim()))
      .map((id) => id.trim());
  } catch {
    return [];
  }
}

export function readGuestPracticeSessionIds(): string[] {
  return readUuidList(GUEST_PRACTICE_SESSIONS_KEY);
}

export function recordGuestPracticeSessionId(sessionId: string): void {
  if (typeof window === "undefined" || !UUID_REGEX.test(sessionId.trim())) return;
  try {
    const normalized = sessionId.trim();
    const existing = readUuidList(GUEST_PRACTICE_SESSIONS_KEY).filter(
      (id) => id !== normalized
    );
    existing.unshift(normalized);
    localStorage.setItem(
      GUEST_PRACTICE_SESSIONS_KEY,
      JSON.stringify(existing.slice(0, 30))
    );
  } catch {
    // Ignore storage quota/privacy errors
  }
}

export interface LoadPracticePackConfig {
  count?: 10 | 15 | 20;
  category?: "ALL" | "TWK" | "TIU" | "TKP";
  subtopic?: string;
  materialSlug?: string;
  wrongOnly?: boolean;
  questionIds?: string[];
}

export interface UsePracticePackOptions {
  chatId?: string | null;
}

export function usePracticePack(options: UsePracticePackOptions = {}) {
  const { chatId = null } = options;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PracticeQuestionItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, PracticeAnswerState>>({});
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [activeIndex, setActiveIndexState] = useState<number>(0);
  const [isLoadingPack, setIsLoadingPack] = useState<boolean>(false);

  const sessionIdRef = useRef<string | null>(null);
  const questionsRef = useRef<PracticeQuestionItem[]>([]);
  const answersRef = useRef<Record<string, PracticeAnswerState>>({});
  const revealedHintsRef = useRef<Record<string, boolean>>({});
  const chatIdRef = useRef<string | null>(chatId);
  const questionEnteredAtRef = useRef<number>(Date.now());

  chatIdRef.current = chatId;

  const setActiveIndex = useCallback((nextIndex: number) => {
    setActiveIndexState(nextIndex);
    questionEnteredAtRef.current = Date.now();
  }, []);

  const syncToBackend = useCallback(
    async (payload: {
      sessionId: string;
      questionId: string;
      chatId?: string | null;
      selectedOption: QuizOptionKey;
      usedHint: boolean;
      timeSpentSeconds: number;
    }) => {
      try {
        const res = await fetch("/api/practice/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: payload.sessionId,
            questionId: payload.questionId,
            ...(payload.chatId ? { chatId: payload.chatId } : {}),
            selectedOption: payload.selectedOption,
            usedHint: payload.usedHint,
            timeSpentSeconds: payload.timeSpentSeconds,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }

        if (sessionIdRef.current !== payload.sessionId) return;

        const syncResult = json.data as SyncPracticeAttemptResult;

        setQuestions((prev) => {
          const next = prev.map((q) =>
            q.id === payload.questionId
              ? {
                  ...q,
                  correctOption: syncResult.correctOption,
                  scoringRubric: syncResult.scoringRubric,
                  optionRationales: syncResult.optionRationales,
                  reasoningChain: syncResult.reasoningChain,
                }
              : q
          );
          questionsRef.current = next;
          return next;
        });

        setAnswers((prev) => {
          const current = prev[payload.questionId];
          if (!current) return prev;
          const updated: Record<string, PracticeAnswerState> = {
            ...prev,
            [payload.questionId]: {
              ...current,
              scoreEarned: syncResult.scoreEarned,
              syncStatus: "synced",
            },
          };
          answersRef.current = updated;
          return updated;
        });
      } catch {
        if (sessionIdRef.current !== payload.sessionId) return;

        setAnswers((prev) => {
          const current = prev[payload.questionId];
          if (!current) return prev;
          const updated: Record<string, PracticeAnswerState> = {
            ...prev,
            [payload.questionId]: { ...current, syncStatus: "failed" },
          };
          answersRef.current = updated;
          return updated;
        });

        toast.error("Gagal menyinkronkan jawaban ke server", {
          action: {
            label: "Coba Lagi",
            onClick: () => {
              const latest = answersRef.current[payload.questionId];
              const activeSession = sessionIdRef.current;
              if (!latest || !activeSession) return;
              setAnswers((prev) => {
                const cur = prev[payload.questionId];
                if (!cur) return prev;
                const next: Record<string, PracticeAnswerState> = {
                  ...prev,
                  [payload.questionId]: { ...cur, syncStatus: "syncing" },
                };
                answersRef.current = next;
                return next;
              });
              void syncToBackend({
                sessionId: activeSession,
                questionId: payload.questionId,
                chatId: chatIdRef.current,
                selectedOption: latest.selectedOption,
                usedHint: latest.usedHint,
                timeSpentSeconds: latest.timeSpentSeconds,
              });
            },
          },
        });
      }
    },
    []
  );

  const retrySync = useCallback(
    (questionId: string) => {
      const answer = answersRef.current[questionId];
      const activeSession = sessionIdRef.current;
      if (!answer || !activeSession) return;

      setAnswers((prev) => {
        const cur = prev[questionId];
        if (!cur) return prev;
        const next: Record<string, PracticeAnswerState> = {
          ...prev,
          [questionId]: { ...cur, syncStatus: "syncing" },
        };
        answersRef.current = next;
        return next;
      });

      void syncToBackend({
        sessionId: activeSession,
        questionId,
        chatId: chatIdRef.current,
        selectedOption: answer.selectedOption,
        usedHint: answer.usedHint,
        timeSpentSeconds: answer.timeSpentSeconds,
      });
    },
    [syncToBackend]
  );

  const loadPack = useCallback(async (config: LoadPracticePackConfig = {}) => {
    setIsLoadingPack(true);
    try {
      const requestBody: Record<string, unknown> = {
        count: config.count ?? 10,
      };

      if (config.category && config.category !== "ALL") {
        requestBody.category = config.category;
      }
      if (config.subtopic?.trim()) {
        requestBody.subtopic = config.subtopic.trim();
      }
      if (config.materialSlug?.trim()) {
        requestBody.materialSlug = config.materialSlug.trim();
      }
      if (config.wrongOnly) {
        requestBody.wrongOnly = true;
      }
      if (config.questionIds && config.questionIds.length > 0) {
        requestBody.questionIds = config.questionIds;
      }

      const guestChatIds = readUuidList(GUEST_CHAT_IDS_KEY);
      if (guestChatIds.length > 0) {
        requestBody.chatIds = guestChatIds;
      }
      const guestSessionIds = readGuestPracticeSessionIds();
      if (guestSessionIds.length > 0) {
        requestBody.sessionIds = guestSessionIds;
      }

      const res = await fetch("/api/practice/pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || `Gagal memuat paket latihan (HTTP ${res.status})`);
      }

      const pack = json.data as PracticePackResult;
      if (!pack.questions || pack.questions.length === 0) {
        if (config.wrongOnly) {
          toast.info("Belum ada riwayat soal yang salah atau belum optimal.");
        } else {
          toast.info("Belum ada soal yang tersedia untuk filter latihan ini.");
        }
        return null;
      }

      sessionIdRef.current = pack.sessionId;
      questionsRef.current = pack.questions;
      answersRef.current = {};
      revealedHintsRef.current = {};
      questionEnteredAtRef.current = Date.now();

      setSessionId(pack.sessionId);
      setQuestions(pack.questions);
      setAnswers({});
      setRevealedHints({});
      setActiveIndexState(0);
      recordGuestPracticeSessionId(pack.sessionId);

      return pack;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memuat paket latihan SKD"
      );
      return null;
    } finally {
      setIsLoadingPack(false);
    }
  }, []);

  const selectOptionInstant = useCallback(
    (questionId: string, option: QuizOptionKey) => {
      if (answersRef.current[questionId]) return;

      const question = questionsRef.current.find((q) => q.id === questionId);
      const activeSession = sessionIdRef.current;
      if (!question || !activeSession) return;

      const timeSpentSeconds = Math.max(
        0,
        Math.round((Date.now() - questionEnteredAtRef.current) / 1000)
      );
      const usedHint = Boolean(revealedHintsRef.current[questionId]);

      const nextEntry: PracticeAnswerState = {
        selectedOption: option,
        scoreEarned: 0,
        usedHint,
        timeSpentSeconds,
        syncStatus: "syncing",
      };

      const nextAnswers: Record<string, PracticeAnswerState> = {
        ...answersRef.current,
        [questionId]: nextEntry,
      };
      answersRef.current = nextAnswers;
      setAnswers(nextAnswers);

      void syncToBackend({
        sessionId: activeSession,
        questionId,
        chatId: chatIdRef.current,
        selectedOption: option,
        usedHint,
        timeSpentSeconds,
      });
    },
    [syncToBackend]
  );

  const revealHint = useCallback((questionId: string) => {
    if (revealedHintsRef.current[questionId]) return;
    const next = { ...revealedHintsRef.current, [questionId]: true };
    revealedHintsRef.current = next;
    setRevealedHints(next);
  }, []);

  const retryWrongQuestions = useCallback(async () => {
    const answersList = Object.values(answersRef.current);
    if (answersList.some((ans) => ans.syncStatus === "syncing")) {
      toast.info("Menunggu penyimpanan jawaban selesai...");
      return null;
    }

    const missedIds = questionsRef.current
      .filter((q) => {
        const ans = answersRef.current[q.id];
        return ans !== undefined && ans.syncStatus === "synced" && ans.scoreEarned < 5;
      })
      .map((q) => q.id);

    if (missedIds.length === 0) {
      if (answersList.some((ans) => ans.syncStatus === "failed")) {
        toast.info(
          "Ada jawaban yang gagal tersinkron. Selesaikan sinkronisasi terlebih dahulu atau belum ada soal salah."
        );
      } else {
        toast.info("Belum ada soal salah atau belum optimal untuk diulang.");
      }
      return null;
    }

    const count: 10 | 15 | 20 =
      missedIds.length <= 10 ? 10 : missedIds.length <= 15 ? 15 : 20;

    return loadPack({ count, questionIds: missedIds });
  }, [loadPack]);

  const resetPack = useCallback(() => {
    sessionIdRef.current = null;
    questionsRef.current = [];
    answersRef.current = {};
    revealedHintsRef.current = {};
    questionEnteredAtRef.current = Date.now();
    setSessionId(null);
    setQuestions([]);
    setAnswers({});
    setRevealedHints({});
    setActiveIndexState(0);
  }, []);

  const activeQuestion = useMemo(
    () => questions[activeIndex] ?? null,
    [questions, activeIndex]
  );

  return {
    sessionId,
    questions,
    answers,
    revealedHints,
    activeIndex,
    activeQuestion,
    isLoadingPack,
    setActiveIndex,
    loadPack,
    selectOptionInstant,
    revealHint,
    retrySync,
    retryWrongQuestions,
    resetPack,
  };
}
