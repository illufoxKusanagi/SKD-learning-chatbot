"use client";

import { useCallback, useEffect, useState } from "react";

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

  const fetchData = useCallback(async (query?: string) => {
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

      if (!response.ok) {
        throw new Error("Failed to fetch RAG data");
      }

      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setData(result.data);
      } else {
        setData([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch RAG data");
    } finally {
      setIsLoading(false);
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
