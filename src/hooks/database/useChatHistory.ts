"use client";

import { useCallback, useEffect, useState } from "react";

interface ChatHistoryItem {
  id: string;
  title: string;
  createdAt: string;
  messageCount: number;
  lastMessage: string;
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

      const response = await fetch("/api/chat/history", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch chat history");
      }

      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setHistory(result.data);
      } else {
        setHistory([]);
      }
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
