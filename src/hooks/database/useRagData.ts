"use client";

import { useCallback, useEffect, useState } from "react";
import { getDb } from "@/lib/db"; // Edited here: Fixed import
import { ragData } from "@/lib/db/schema";
import { desc, eq, like } from "drizzle-orm";

interface RagDataItem {
  id: string;
  title?: string;
  content: string;
  source?: string;
  data?: any;
  createdAt: Date;
  updatedAt: Date;
}

export function useRagData() {
  const [data, setData] = useState<RagDataItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const db = getDb(); // Edited here: Get db instance
      const results = await db
        .select()
        .from(ragData)
        .orderBy(desc(ragData.createdAt));

      setData(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch RAG data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchData = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        fetchData();
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const db = getDb(); // Edited here: Get db instance
        const results = await db
          .select()
          .from(ragData)
          .where(like(ragData.content, `%${query}%`))
          .orderBy(desc(ragData.createdAt));

        setData(results);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to search RAG data"
        );
      } finally {
        setIsLoading(false);
      }
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
    refetch: fetchData,
    search: searchData,
  };
}
