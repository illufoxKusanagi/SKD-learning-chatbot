'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { MaterialMarkdownViewer } from './material-markdown-viewer';
import {
  readGuestChatIds,
  type PreloadedMaterialData,
} from './material-types';
import {
  AlertTriangle,
  ExternalLink,
  MessageSquarePlus,
  Sparkles,
} from 'lucide-react';

export type { PreloadedMaterialData };

export interface MaterialDrawerProps {
  slug: string | null;
  preloadedMaterial?: PreloadedMaterialData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartPractice?: (slug: string) => void;
  onDiscussWithTutor?: (slug: string, title: string) => void;
}

export function MaterialDrawer({
  slug,
  preloadedMaterial,
  open,
  onOpenChange,
  onStartPractice,
  onDiscussWithTutor,
}: MaterialDrawerProps) {
  const hasPreload = Boolean(slug && preloadedMaterial?.slug === slug);
  const [fetched, setFetched] = useState<PreloadedMaterialData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !slug || hasPreload) {
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadMaterial() {
      setIsLoading(true);
      setError(null);
      try {
        const guestIds = readGuestChatIds();
        const qs = guestIds.length > 0 ? `?chatIds=${encodeURIComponent(guestIds.join(','))}` : '';
        const res = await fetch(
          `/api/materials/${encodeURIComponent(slug!)}${qs}`,
          { signal: controller.signal }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success || !json.data?.material) {
          throw new Error(json.error || `Gagal memuat materi (HTTP ${res.status})`);
        }
        if (!cancelled) setFetched(json.data.material);
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat materi TWK');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadMaterial();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, slug, hasPreload]);

  const activeMaterial = hasPreload
    ? preloadedMaterial!
    : fetched?.slug === slug
      ? fetched
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border pr-10">
          {activeMaterial && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary">{activeMaterial.subtopic}</Badge>
              {typeof activeMaterial.linkedQuestionCount === 'number' && (
                <Badge variant="outline">
                  {activeMaterial.linkedQuestionCount} soal
                </Badge>
              )}
              {typeof activeMaterial.mistakeCount === 'number' &&
                activeMaterial.mistakeCount > 0 && (
                  <Badge variant="destructive">
                    {activeMaterial.mistakeCount} salah
                  </Badge>
                )}
            </div>
          )}
          <SheetTitle>
            {activeMaterial?.title ?? 'Ringkasan Materi TWK'}
          </SheetTitle>
          <SheetDescription>
            {activeMaterial?.summary ??
              'Pelajari 4 pilar HOTS TWK untuk memperkuat penalaran soal CPNS.'}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-3 p-4">
            {isLoading && !activeMaterial ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
            ) : error && !activeMaterial ? (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Gagal Memuat Materi</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : activeMaterial ? (
              <>
                {activeMaterial.sourceUrl && (
                  <div className="flex items-center justify-end">
                    <Button asChild variant="link" size="sm" className="h-auto p-0">
                      <a
                        href={activeMaterial.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Sumber Referensi
                        <ExternalLink data-icon="inline-end" />
                      </a>
                    </Button>
                  </div>
                )}
                <MaterialMarkdownViewer
                  contentMarkdown={activeMaterial.contentMarkdown}
                />
              </>
            ) : null}
          </div>
        </ScrollArea>

        {activeMaterial && (
          <>
            <Separator />
            <SheetFooter className="flex-row flex-wrap items-center justify-end gap-2 bg-muted/20">
              {onDiscussWithTutor ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onDiscussWithTutor(activeMaterial.slug, activeMaterial.title)
                  }
                >
                  <MessageSquarePlus data-icon="inline-start" />
                  Bedah Bareng Tutor
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/chat?discussMaterial=${encodeURIComponent(activeMaterial.slug)}&title=${encodeURIComponent(activeMaterial.title)}`}
                    onClick={() => onOpenChange(false)}
                  >
                    <MessageSquarePlus data-icon="inline-start" />
                    Bedah Bareng Tutor
                  </Link>
                </Button>
              )}

              {onStartPractice ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onStartPractice(activeMaterial.slug)}
                >
                  <Sparkles data-icon="inline-start" />
                  Latihan Soal Materi Ini
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link
                    href={`/chat?practiceMaterial=${encodeURIComponent(activeMaterial.slug)}`}
                    onClick={() => onOpenChange(false)}
                  >
                    <Sparkles data-icon="inline-start" />
                    Latihan Soal Materi Ini
                  </Link>
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
