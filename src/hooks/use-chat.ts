import { useSession } from "next-auth/react";
import { Message } from "@/lib/types/chat";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export function useChat() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
  });
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const authLoading = status === "loading";
  const chatId = searchParams.get("id");

  const apiCall = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      const response = await fetch(endpoint, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      return response.json();
    },
    []
  );

  useEffect(() => {
    const loadHistory = async () => {
      // Wait for auth to finish loading before making API calls
      if (authLoading) {
        return;
      }

      if (!chatId) {
        // For guest users on /chat page, try to load from sessionStorage
        if (!isAuthenticated && window.location.pathname === "/chat") {
          const savedMessages = sessionStorage.getItem("guestMessages");
          if (savedMessages) {
            try {
              const messages = JSON.parse(savedMessages);
              setState((prev) => ({ ...prev, messages, isLoading: false }));
              // Clear the saved messages after loading
              sessionStorage.removeItem("guestMessages");
              return;
            } catch (error) {
              console.error("Failed to parse saved guest messages:", error);
            }
          }
        }
        setState((prev) => ({ ...prev, messages: [], isLoading: false }));
        return;
      }

      // Don't try to fetch chat history if user is not authenticated
      // The page component will handle the redirect
      if (!isAuthenticated) {
        setState((prev) => ({ ...prev, messages: [], isLoading: false }));
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const data = await apiCall(`/api/chat/${chatId}`);
        setState((prev) => ({
          ...prev,
          messages: data.data.messages || [],
          isLoading: false,
        }));
      } catch (error) {
        console.error("Error loading chat history: ", error);
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to load chat",
          isLoading: false,
          messages: [],
        }));
        toast.error("Tidak dapat memuat riwayat percakapan");
      }
    };
    loadHistory();
  }, [chatId, isAuthenticated, authLoading, apiCall]);

  const handleSendMessage = useCallback(
    async (newUserMessage: string) => {
      if (!newUserMessage.trim() || state.isLoading) return;
      const userMessage: Message = {
        role: "user",
        content: newUserMessage,
        timestamp: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          userMessage,
          {
            role: "bot",
            content: "",
            timestamp: new Date().toISOString(),
          },
        ],
        isLoading: true,
        error: null,
      }));

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: newUserMessage.trim(),
            chatId: chatId || undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const newChatId = response.headers.get("X-Chat-Id");
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let accumulatedContent = "";

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          const chunkValue = decoder.decode(value, { stream: !done });
          accumulatedContent += chunkValue;

          setState((prev) => {
            const newMessages = [...prev.messages];
            const lastMessageIndex = newMessages.length - 1;
            if (lastMessageIndex >= 0) {
              newMessages[lastMessageIndex] = {
                ...newMessages[lastMessageIndex],
                content: accumulatedContent,
              };
            }
            return {
              ...prev,
              messages: newMessages,
            };
          });
        }

        setState((prev) => ({ ...prev, isLoading: false }));

        // Handle redirects after stream is complete
        if (newChatId && !chatId) {
          setTimeout(() => router.push(`/chat?id=${newChatId}`), 100);
        } else if (!chatId && window.location.pathname === "/") {
          const allMessages = [
            ...state.messages,
            userMessage,
            {
              role: "bot",
              content: accumulatedContent,
              timestamp: new Date().toISOString(),
            } as Message,
          ];
          sessionStorage.setItem("guestMessages", JSON.stringify(allMessages));
          setTimeout(() => router.push("/chat"), 100);
        }
      } catch (error) {
        console.error("error sending message: ", error);
        if (chatId) {
          setState((prev) => ({
            ...prev,
            error:
              error instanceof Error ? error.message : "Failed to send message",
            isLoading: false,
          }));
        }
        toast.error("Gagal mengirim pesan");
      }
    },
    [state.isLoading, state.messages, chatId, router]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);
  return {
    messages: state.messages,
    isLoading: state.isLoading,
    handleSendMessage,
    clearError,
  };
}
