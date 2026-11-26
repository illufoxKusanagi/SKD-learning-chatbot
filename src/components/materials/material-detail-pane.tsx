'use client';

import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { MaterialMarkdownViewer } from './material-markdown-viewer';
import type { MaterialDetail } from './material-types';
import {
  AlertTriangle,
  ExternalLink,
  MessageSquarePlus,
  Sparkles,
} from 'lucide-react';

interface MaterialDetailPaneProps {
  selectedSlug: string | null;
  detail: MaterialDetail | null;
  isLoading: boolean;
  error: string | null;
}

export function MaterialDetailPane({
  selectedSlug,
  detail,
  isLoading,
  error,
}: MaterialDetailPaneProps) {
  if (isLoading && detail?.slug !== selectedSlug) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    );
  }

  if (error && detail?.slug !== selectedSlug) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Gagal Memuat Detail Materi</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!detail) return null;

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{detail.subtopic}</Badge>
          <Badge variant="outline">
            {detail.linkedQuestionCount} soal terkait
          </Badge>
          {detail.mistakeCount > 0 && (
            <Badge variant="destructive">
              {detail.mistakeCount} kali keliru
            </Badge>
          )}
        </div>

        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {detail.title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {detail.summary}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button asChild size="sm">
            <Link
              href={`/chat?practiceMaterial=${encodeURIComponent(detail.slug)}`}
            >
              <Sparkles data-icon="inline-start" />
              Latihan Soal dari Materi Ini
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm">
            <Link
              href={`/chat?discussMaterial=${encodeURIComponent(detail.slug)}&title=${encodeURIComponent(detail.title)}`}
            >
              <MessageSquarePlus data-icon="inline-start" />
              Bedah Bareng Tutor
            </Link>
          </Button>

          {detail.sourceUrl && (
            <Button asChild variant="ghost" size="sm">
              <a
                href={detail.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Sumber Referensi
                <ExternalLink data-icon="inline-end" />
              </a>
            </Button>
          )}
        </div>
      </div>

      <Separator />

      <MaterialMarkdownViewer contentMarkdown={detail.contentMarkdown} />
    </>
  );
}
