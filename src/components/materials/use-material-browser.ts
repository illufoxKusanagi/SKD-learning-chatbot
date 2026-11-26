'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  readGuestChatIds,
  TWK_SUBTOPICS,
  type MaterialDetail,
  type MaterialSummary,
} from './material-types';

export function useMaterialBrowser() {
  const searchParams = useSearchParams();
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const authLoading = status === 'loading';

  const [search, setSearch] = useState('');
  const [selectedSubtopic, setSelectedSubtopic] = useState(
    () => searchParams.get('subtopic') ?? ''
  );
  const [weakOnly, setWeakOnly] = useState(false);

  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [subtopics, setSubtopics] = useState<readonly string[]>(TWK_SUBTOPICS);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    () => searchParams.get('slug') ?? null
  );
  const [selectedDetail, setSelectedDetail] = useState<MaterialDetail | null>(
    null
  );
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const detailCacheRef = useRef<Map<string, MaterialDetail>>(new Map());

  const fetchMaterials = useCallback(async () => {
    if (authLoading) return;
    setIsLoadingList(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (selectedSubtopic) params.set('subtopic', selectedSubtopic);
      if (search.trim()) params.set('q', search.trim());
      if (weakOnly) params.set('weakOnly', 'true');
      if (!isAuthenticated) {
        const guestIds = readGuestChatIds();
        if (guestIds.length > 0) params.set('chatIds', guestIds.join(','));
      }

      const qs = params.toString();
      const res = await fetch(`/api/materials${qs ? `?${qs}` : ''}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || `Gagal memuat materi (HTTP ${res.status})`);
      }

      const loaded: MaterialSummary[] = json.data.materials ?? [];
      setMaterials(loaded);
      if (Array.isArray(json.data.subtopics)) setSubtopics(json.data.subtopics);

      setSelectedSlug((prev) => {
        if (prev && loaded.some((m) => m.slug === prev)) return prev;
        return loaded[0]?.slug ?? null;
      });
    } catch (err) {
      setListError(
        err instanceof Error ? err.message : 'Gagal memuat daftar materi TWK'
      );
    } finally {
      setIsLoadingList(false);
    }
  }, [authLoading, isAuthenticated, search, selectedSubtopic, weakOnly]);

  useEffect(() => {
    const timer = setTimeout(fetchMaterials, 150);
    return () => clearTimeout(timer);
  }, [fetchMaterials]);

  useEffect(() => {
    if (!selectedSlug || authLoading) {
      if (!selectedSlug) setSelectedDetail(null);
      return;
    }

    const cached = detailCacheRef.current.get(selectedSlug);
    if (cached) {
      setSelectedDetail(cached);
      setDetailError(null);
      setIsLoadingDetail(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadDetail() {
      setIsLoadingDetail(true);
      setDetailError(null);
      try {
        const params = new URLSearchParams();
        if (!isAuthenticated) {
          const guestIds = readGuestChatIds();
          if (guestIds.length > 0) params.set('chatIds', guestIds.join(','));
        }
        const qs = params.toString();
        const res = await fetch(
          `/api/materials/${encodeURIComponent(selectedSlug!)}${qs ? `?${qs}` : ''}`,
          { signal: controller.signal }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success || !json.data?.material) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        const detail: MaterialDetail = json.data.material;
        detailCacheRef.current.set(detail.slug, detail);
        if (!cancelled) setSelectedDetail(detail);
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
        setDetailError(
          err instanceof Error ? err.message : 'Gagal memuat detail materi'
        );
      } finally {
        if (!cancelled) setIsLoadingDetail(false);
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedSlug, authLoading, isAuthenticated]);

  const weakCount = useMemo(
    () => materials.filter((m) => m.mistakeCount > 0).length,
    [materials]
  );

  const resetFilters = useCallback(() => {
    setSearch('');
    setSelectedSubtopic('');
    setWeakOnly(false);
  }, []);

  return {
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
  };
}
