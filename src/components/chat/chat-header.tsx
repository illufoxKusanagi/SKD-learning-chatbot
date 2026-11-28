'use client';

import Link from 'next/link';
import {
  Award,
  BookOpen,
  ClipboardCheck,
  History,
  Library,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import HelpButton from '@/components/ui/help-button';
import ModeToggleButton from '@/components/ui/mode-toggle-button';
import { SidebarTrigger } from '@/components/ui/sidebar';

interface ChatHeaderProps {
  isAuthenticated: boolean;
  userName: string;
  chatTitle: string;
  isCanvasOpen: boolean;
  onToggleCanvas: () => void;
  canvasMode: 'practice' | 'chat';
  practiceCount: number;
  answeredPracticeCount: number;
  quizzesLength: number;
  pendingQuizCount: number;
  quizHistoryHref: string;
}

export function ChatHeader({
  isAuthenticated,
  userName,
  chatTitle,
  isCanvasOpen,
  onToggleCanvas,
  canvasMode,
  practiceCount,
  answeredPracticeCount,
  quizzesLength,
  pendingQuizCount,
  quizHistoryHref,
}: ChatHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2.5">
        {isAuthenticated ? <SidebarTrigger /> : null}
        <Award className="size-4 shrink-0 text-primary" />
        <p className="truncate text-sm font-semibold text-foreground">
          {chatTitle || 'Sesi Belajar Baru'}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant={isCanvasOpen ? 'secondary' : 'outline'}
          size="sm"
          onClick={onToggleCanvas}
        >
          <BookOpen data-icon="inline-start" />
          <span>Panel Kuis</span>
          {(practiceCount > 0 || quizzesLength > 0) && (
            <Badge variant="secondary">
              {canvasMode === 'practice' && practiceCount > 0
                ? `${answeredPracticeCount}/${practiceCount}`
                : quizzesLength}
            </Badge>
          )}
          {pendingQuizCount > 0 && canvasMode === 'chat' && (
            <Badge variant="default">{pendingQuizCount} baru</Badge>
          )}
        </Button>

        {!isAuthenticated && (
          <>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Link href="/materi">
                <Library data-icon="inline-start" />
                Bank Materi
              </Link>
            </Button>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Link href="/tryout">
                <ClipboardCheck data-icon="inline-start" />
                Simulasi CAT
              </Link>
            </Button>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Link href={quizHistoryHref}>
                <History data-icon="inline-start" />
                Riwayat SKD
              </Link>
            </Button>
          </>
        )}

        <ModeToggleButton />
        <HelpButton />

        {isAuthenticated ? (
          <span className="hidden px-1.5 text-xs font-semibold text-foreground md:inline">
            {userName}
          </span>
        ) : (
          <Button asChild size="sm">
            <Link href="/auth/login">Login</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
