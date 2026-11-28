'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { QuizOptionKey } from '@/components/chat/quiz/quiz-utils';

interface UseChatUrlActionsParams {
  authStatus: string;
  loadPack: (opts: {
    count?: 10 | 15 | 20;
    category?: 'TWK' | 'TIU' | 'TKP';
    materialSlug?: string;
  }) => Promise<unknown>;
  handleSendMessage: (
    overrideMessage?: string,
    quizAttemptId?: string,
    options?: {
      isRetry?: boolean;
      questionId?: string | null;
      questionSlug?: string | null;
      materialSlugs?: string[];
      selectedAnswer?: QuizOptionKey | null;
      isTutorDiscussion?: boolean;
    }
  ) => Promise<void>;
  onOpenPracticeCanvas: () => void;
}

export function useChatUrlActions({
  authStatus,
  loadPack,
  handleSendMessage,
  onOpenPracticeCanvas,
}: UseChatUrlActionsParams) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const practiceMaterial = searchParams.get('practiceMaterial');
  const discussMaterial = searchParams.get('discussMaterial');
  const discussTitle = searchParams.get('title');
  const discussQuestion = searchParams.get('discussQuestion');
  const selectedAnswerParam = searchParams.get('selectedAnswer');
  const chatIdParam = searchParams.get('id');
  const handledParamRef = useRef<string | null>(null);

  useEffect(() => {
    if (authStatus === 'loading') return;

    if (practiceMaterial) {
      const key = `practice:${practiceMaterial}`;
      if (handledParamRef.current === key) return;
      handledParamRef.current = key;

      onOpenPracticeCanvas();
      loadPack({
        count: 10,
        category: 'TWK',
        materialSlug: practiceMaterial,
      }).finally(() => {
        router.replace(
          chatIdParam ? `/chat?id=${encodeURIComponent(chatIdParam)}` : '/chat'
        );
      });
      return;
    }

    if (discussMaterial) {
      const key = `discuss:${discussMaterial}`;
      if (handledParamRef.current === key) return;
      handledParamRef.current = key;

      const label = discussTitle || discussMaterial;
      if (chatIdParam) {
        router.replace(`/chat?id=${encodeURIComponent(chatIdParam)}`);
      }
      void handleSendMessage(
        `Tolong bedah inti konsep, logika sebab-akibat, dan jebakan soal HOTS pada materi TWK "${label}".`,
        undefined,
        { materialSlugs: [discussMaterial], isTutorDiscussion: true }
      );
      return;
    }

    if (discussQuestion) {
      const normalizedAns = selectedAnswerParam?.trim().toUpperCase();
      const validAnswer: QuizOptionKey | null =
        normalizedAns === 'A' ||
        normalizedAns === 'B' ||
        normalizedAns === 'C' ||
        normalizedAns === 'D' ||
        normalizedAns === 'E'
          ? normalizedAns
          : null;
      const key = `discussQuestion:${discussQuestion}:${validAnswer ?? ''}`;
      if (handledParamRef.current === key) return;
      handledParamRef.current = key;

      router.replace(
        chatIdParam ? `/chat?id=${encodeURIComponent(chatIdParam)}` : '/chat'
      );
      void handleSendMessage(
        `Tolong bedah mendalam soal simulasi CAT (${discussQuestion})${validAnswer ? ` — pilihan saya opsi ${validAnswer}` : ''} beserta analisis pengecoh dan trik cepatnya.`,
        undefined,
        {
          questionSlug: discussQuestion,
          selectedAnswer: validAnswer ?? undefined,
          isTutorDiscussion: true,
        }
      );
    }
  }, [
    authStatus,
    practiceMaterial,
    discussMaterial,
    discussTitle,
    discussQuestion,
    selectedAnswerParam,
    chatIdParam,
    loadPack,
    handleSendMessage,
    onOpenPracticeCanvas,
    router,
  ]);
}
