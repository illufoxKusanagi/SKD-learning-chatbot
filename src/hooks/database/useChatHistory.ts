"use client";

import { useCallback, useEffect, useState } from "react";
import { getDb } from "@/lib/db"; // Edited here: Fixed import
import { conversations } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

interface ChatHistoryItem {
  id: number;
  userId: string;
  title: string;
  messages: any[];
  createdAt: Date;
}

export function useChatHistory(userId: string) {
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      setError(null);

      const db = getDb(); // Edited here: Get db instance
      const results = await db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(desc(conversations.createdAt));

      setHistory(results);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch chat history"
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    isLoading,
    error,
    refetch: fetchHistory,
  };
}
