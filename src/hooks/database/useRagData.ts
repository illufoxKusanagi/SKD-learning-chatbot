"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface RagDataItem {
  id: string;
  title?: string;
  content: string;
  source?: string;
  data?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function useRagData() {
  const [data, setData] = useState<RagDataItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);

  const fetchData = useCallback(async (query?: string) => {
    const requestId = ++activeRequestIdRef.current;
    try {
      setIsLoading(true);
      setError(null);

      const url = query
        ? `/api/rag/data?q=${encodeURIComponent(query)}`
        : "/api/rag/data";

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (requestId !== activeRequestIdRef.current) return;

      if (!response.ok) {
        throw new Error("Failed to fetch RAG data");
      }

      const result = await response.json();
      if (requestId !== activeRequestIdRef.current) return;

      if (result.success && Array.isArray(result.data)) {
        setData(result.data);
      } else {
        setData([]);
      }
    } catch (err) {
      if (requestId !== activeRequestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to fetch RAG data");
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const searchData = useCallback(
    async (query: string) => {
      fetchData(query);
    },
    [fetchData]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: () => fetchData(),
    search: searchData,
  };
}
