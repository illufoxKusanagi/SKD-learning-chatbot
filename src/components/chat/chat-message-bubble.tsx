'use client';

import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { QuizCard, QuizCardSkeleton } from '@/components/chat/quiz-card';
import {
  stripRedundantQuizMarkdown,
  type ChatStreamErrorPayload,
  type QuizCategory,
  type QuizOptionKey,
} from '@/components/chat/quiz/quiz-utils';
import type { QuizAttemptItem } from '@/hooks/use-chat';
import type { Message } from '@/lib/types/chat';
import { cn } from '@/lib/utils';

export interface TextBubbleProps extends Message {
  isThinking?: boolean;
  hasAttemptMarker?: boolean;
  matchedQuiz?: QuizAttemptItem;
  isLoadingQuiz?: boolean;
  onSelectQuizOption?: (quizId: string, option: QuizOptionKey) => void;
  onOpenCanvas?: (quizId: string) => void;
  onAskTutor?: (quiz: QuizAttemptItem) => void;
  onNextQuiz?: (category: QuizCategory) => void;
  gradingQuizId?: string | null;
  gradingOption?: QuizOptionKey | null;
  isGeneratingNext?: boolean;
  isChatLoading?: boolean;
  chatError?: ChatStreamErrorPayload | null;
  onRetry?: () => void;
}

export function TextBubble({
  role,
  content,
  isThinking = false,
  hasAttemptMarker = false,
  matchedQuiz,
  isLoadingQuiz = false,
  onSelectQuizOption,
  onOpenCanvas,
  onAskTutor,
  onNextQuiz,
  gradingQuizId = null,
  gradingOption = null,
  isGeneratingNext = false,
  isChatLoading = false,
  chatError = null,
  onRetry,
}: TextBubbleProps) {
  const isUser = role === 'user';
  const displayContent = !isUser
    ? stripRedundantQuizMarkdown(content, hasAttemptMarker)
    : content;

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-3',
        isUser ? 'items-end' : 'items-start'
      )}
    >
      {displayContent.length > 0 && (
        <div
          className={cn(
            'max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[75%]',
            isUser
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'border border-border bg-muted/70 text-foreground',
            isThinking && 'shimmer'
          )}
        >
          <section className="prose prose-sm max-w-none break-words dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkBreaks, remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                h1: ({ ...props }) => (
                  <h1 className="my-2 text-xl font-bold" {...props} />
                ),
                h2: ({ ...props }) => (
                  <h2 className="my-2 text-lg font-bold" {...props} />
                ),
                h3: ({ ...props }) => (
                  <h3 className="my-1.5 text-base font-bold" {...props} />
                ),
                ul: ({ ...props }) => (
                  <ul className="my-2 list-disc pl-4" {...props} />
                ),
                ol: ({ ...props }) => (
                  <ol className="my-2 list-decimal pl-4" {...props} />
                ),
                p: ({ ...props }) => (
                  <p className="mb-2 leading-relaxed last:mb-0" {...props} />
                ),
                a: ({ ...props }) => (
                  <a
                    className="text-primary underline transition-colors hover:text-primary/80"
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                  />
                ),
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  return match ? (
                    <pre className="my-2 overflow-x-auto rounded-lg bg-secondary p-3 text-xs text-secondary-foreground">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  ) : (
                    <code
                      className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {displayContent}
            </ReactMarkdown>
          </section>
        </div>
      )}

      {!isUser && chatError && (
        <Alert variant="destructive" className="max-w-xl bg-destructive/5">
          <AlertTriangle />
          <AlertTitle>{chatError.title}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 pt-1">
            <p>{chatError.message}</p>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isChatLoading}
                onClick={onRetry}
                className="w-fit text-foreground"
              >
                <RotateCcw data-icon="inline-start" />
                Coba Lagi
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!isUser && matchedQuiz && (
        <div className="w-full max-w-2xl">
          <QuizCard
            quiz={matchedQuiz}
            onSelectOption={onSelectQuizOption}
            onOpenCanvas={onOpenCanvas}
            onAskTutor={onAskTutor}
            onNextQuiz={onNextQuiz}
            gradingOption={
              gradingQuizId === matchedQuiz.id ? gradingOption : null
            }
            isGrading={gradingQuizId === matchedQuiz.id}
            isGeneratingNext={isGeneratingNext}
            isChatLoading={isChatLoading}
          />
        </div>
      )}

      {!isUser && !matchedQuiz && hasAttemptMarker && isLoadingQuiz && (
        <div className="w-full max-w-2xl">
          <QuizCardSkeleton />
        </div>
      )}
    </div>
  );
}
