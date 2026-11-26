'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { AlertTriangle, BookOpen, RotateCcw } from 'lucide-react';
import { MaterialDetailPane } from './material-detail-pane';
import { MaterialDrawer } from './material-drawer';
import { MaterialFilterBar } from './material-filter-bar';
import { MaterialListCard } from './material-list-card';
import { useMaterialBrowser } from './use-material-browser';

export function MaterialBrowserWorkspace() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const {
    search,
    setSearch,
    selectedSubtopic,
    setSelectedSubtopic,
    weakOnly,
    setWeakOnly,
    materials,
    subtopics,
    isLoadingList,
    listError,
    fetchMaterials,
    selectedSlug,
    setSelectedSlug,
    selectedDetail,
    isLoadingDetail,
    detailError,
    weakCount,
    resetFilters,
  } = useMaterialBrowser();

  const handleSelectMaterial = (slug: string) => {
    setSelectedSlug(slug);
    if (isMobile) setMobileDrawerOpen(true);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <MaterialFilterBar
        search={search}
        onSearchChange={setSearch}
        selectedSubtopic={selectedSubtopic}
        onSubtopicChange={setSelectedSubtopic}
        weakOnly={weakOnly}
        onWeakOnlyChange={setWeakOnly}
        weakCount={weakCount}
        totalCount={materials.length}
        subtopics={subtopics}
      />

      {listError ? (
        <div className="p-6">
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Gagal Memuat Bank Materi</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 pt-1">
              <p>{listError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchMaterials}
                className="w-fit"
              >
                <RotateCcw data-icon="inline-start" />
                Coba Lagi
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : isLoadingList ? (
        <div className="grid flex-1 gap-4 p-4 md:grid-cols-[20rem_1fr] lg:grid-cols-[24rem_1fr]">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="hidden h-full w-full rounded-xl md:block" />
        </div>
      ) : materials.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <Empty className="max-w-md border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpen />
              </EmptyMedia>
              <EmptyTitle>Materi Tidak Ditemukan</EmptyTitle>
              <EmptyDescription>
                {weakOnly
                  ? 'Belum ada catatan soal TWK keliru pada sesi Anda, atau coba matikan filter topik sering salah.'
                  : 'Coba ubah kata kunci pencarian atau pilih subtopik TWK lainnya.'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                Reset Filter
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full w-full border-r border-border md:w-80 md:shrink-0 lg:w-96">
            <div className="flex flex-col gap-2.5 p-4">
              {materials.map((item) => (
                <MaterialListCard
                  key={item.id}
                  item={item}
                  isActive={item.slug === selectedSlug}
                  onSelect={handleSelectMaterial}
                />
              ))}
            </div>
          </ScrollArea>

          <ScrollArea className="hidden h-full min-w-0 flex-1 md:block">
            <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
              <MaterialDetailPane
                selectedSlug={selectedSlug}
                detail={selectedDetail}
                isLoading={isLoadingDetail}
                error={detailError}
              />
            </div>
          </ScrollArea>
        </div>
      )}

      {isMobile && (
        <MaterialDrawer
          slug={selectedSlug}
          preloadedMaterial={
            selectedDetail?.slug === selectedSlug ? selectedDetail : null
          }
          open={mobileDrawerOpen}
          onOpenChange={setMobileDrawerOpen}
          onStartPractice={(slug) => {
            setMobileDrawerOpen(false);
            router.push(`/chat?practiceMaterial=${encodeURIComponent(slug)}`);
          }}
          onDiscussWithTutor={(slug, title) => {
            setMobileDrawerOpen(false);
            router.push(
              `/chat?discussMaterial=${encodeURIComponent(slug)}&title=${encodeURIComponent(title)}`
            );
          }}
        />
      )}
    </div>
  );
}
