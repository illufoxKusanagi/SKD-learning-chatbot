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
  const { data: session, status } = useSession();
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

      // Always add user message to state (works for both authenticated and guest users)
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isLoading: true,
        error: null,
      }));

      try {
        const data = await apiCall("/api/chat", {
          method: "POST",
          body: JSON.stringify({
            message: newUserMessage.trim(),
            chatId: chatId || undefined,
          }),
        });
        const botMessage: Message = {
          role: "bot",
          content: data.data.aiMessage.content,
          timestamp: new Date().toISOString(),
          sources: data.data.sources,
        };

        // Always update the state with bot response
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, botMessage],
          isLoading: false,
        }));

        // Then handle redirects if needed
        if (data.data.chatId && !chatId) {
          // Both authenticated users and guest users get redirected to their specific chat
          // Small delay to let state update, then redirect
          setTimeout(() => router.push(`/chat?id=${data.data.chatId}`), 100);
        } else if (!chatId && window.location.pathname === "/") {
          // User on root page gets redirected to general chat page
          // Save messages to sessionStorage for persistence across navigation
          const allMessages = [...state.messages, userMessage, botMessage];
          sessionStorage.setItem("guestMessages", JSON.stringify(allMessages));
          setTimeout(() => router.push("/chat"), 100);
        }

        if (data.data.sources && data.data.sources.length > 0) {
          console.log("Data sources used : ", data.data.sources);
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
    [state.isLoading, state.messages, chatId, router, apiCall]
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
