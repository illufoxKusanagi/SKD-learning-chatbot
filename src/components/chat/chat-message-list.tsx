'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TextBubble } from '@/components/chat/chat-message-bubble';
import {
  parseMessageQuizMarkers,
  type QuizCategory,
  type QuizOptionKey,
} from '@/components/chat/quiz/quiz-utils';
import type { QuizAttemptItem } from '@/hooks/use-chat';
import type { Message } from '@/lib/types/chat';

interface ChatHistoryProps {
  isLoading: boolean;
  isLoadingQuizzes: boolean;
  messages: Message[];
  quizzes: QuizAttemptItem[];
  gradingQuizId: string | null;
  gradingOption: QuizOptionKey | null;
  isGeneratingQuiz: boolean;
  onSelectQuizOption: (quizId: string, option: QuizOptionKey) => void;
  onOpenCanvas: (quizId: string) => void;
  onAskTutor: (quiz: QuizAttemptItem) => void;
  onNextQuiz: (category: QuizCategory) => void;
  onRetryLastMessage: () => void;
}

export function ChatHistory({
  isLoading,
  isLoadingQuizzes,
  messages,
  quizzes,
  gradingQuizId,
  gradingOption,
  isGeneratingQuiz,
  onSelectQuizOption,
  onOpenCanvas,
  onAskTutor,
  onNextQuiz,
  onRetryLastMessage,
}: ChatHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: isLoading ? 'auto' : 'smooth',
      block: 'end',
    });
  }, [messages, isLoading]);

  const lastMessage = messages[messages.length - 1];
  const showThinking =
    isLoading &&
    (!lastMessage ||
      lastMessage.role === 'user' ||
      (lastMessage.role === 'bot' && !lastMessage.content));

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 sm:p-6">
        {messages.map((msg, index) => {
          if (msg.role === 'bot' && !msg.content && isLoading) return null;

          const { cleanContent, attemptId, quizId, chatError } =
            parseMessageQuizMarkers(msg.content);
          if (
            msg.role === 'bot' &&
            !cleanContent &&
            !attemptId &&
            !quizId &&
            !chatError
          ) {
            return null;
          }
          const matchedQuiz =
            msg.role === 'bot' && quizId
              ? quizzes.find((q) => q.id === quizId)
              : undefined;

          return (
            <TextBubble
              key={index}
              role={msg.role}
              content={cleanContent}
              timestamp={msg.timestamp}
              hasAttemptMarker={Boolean(attemptId)}
              matchedQuiz={matchedQuiz}
              isLoadingQuiz={isLoadingQuizzes}
              onSelectQuizOption={onSelectQuizOption}
              onOpenCanvas={onOpenCanvas}
              onAskTutor={onAskTutor}
              onNextQuiz={onNextQuiz}
              gradingQuizId={gradingQuizId}
              gradingOption={gradingOption}
              isGeneratingNext={isGeneratingQuiz}
              isChatLoading={isLoading}
              chatError={chatError}
              onRetry={onRetryLastMessage}
            />
          );
        })}

        {showThinking && (
          <TextBubble
            role="bot"
            content="Tutor SKD sedang menganalisis dan menyiapkan respon..."
            isThinking
          />
        )}

        <div ref={bottomRef} aria-hidden="true" className="h-px w-full shrink-0" />
      </div>
    </ScrollArea>
  );
}
