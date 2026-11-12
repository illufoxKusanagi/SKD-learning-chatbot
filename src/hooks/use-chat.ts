import { useSession } from "next-auth/react";
import { Message } from "@/lib/types/chat";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface QuizAttemptItem {
  id: string;
  chatId: string;
  chatTitle?: string;
  category: "TWK" | "TIU" | "TKP";
  subtopic: string;
  questionStem: string;
  options: { A: string; B: string; C: string; D: string; E: string };
  correctOption: "A" | "B" | "C" | "D" | "E" | null;
  scoringRubric: { A: number; B: number; C: number; D: number; E: number } | null;
  rubricRationale: string | null;
  userAnswer: "A" | "B" | "C" | "D" | "E" | null;
  scoreEarned: number | null;
  maxScore: number;
  aiExplanation: string | null;
  status: "pending" | "answered";
  createdAt: string;
  answeredAt: string | null;
}

export function recordGuestChatId(chatId: string) {
  if (typeof window === "undefined" || !chatId) return;
  try {
    const raw = localStorage.getItem("skd_guest_chat_ids");
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const filtered = ids.filter((id) => id !== chatId);
    filtered.unshift(chatId);
    const trimmed = filtered.slice(0, 30);
    localStorage.setItem("skd_guest_chat_ids", JSON.stringify(trimmed));
  } catch (error) {
    console.warn("Failed to record guest chat id:", error);
  }
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  chatTitle: string;
}

export function useChat() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
    chatTitle: "Sesi Belajar Baru",
  });
  const [inputMessage, setInputMessage] = useState<string>("");
  const [quizzes, setQuizzes] = useState<QuizAttemptItem[]>([]);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState<boolean>(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const authLoading = status === "loading";
  const chatId = searchParams.get("id");

  const activeChatIdRef = useRef<string | null>(chatId || null);
  const pendingChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeChatIdRef.current = chatId || null;
    if (chatId) {
      pendingChatIdRef.current = null;
    }
  }, [chatId]);

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

  const fetchChatQuizzes = useCallback(
    async (chatIdToFetch?: string | null) => {
      const targetChatId = chatIdToFetch ?? chatId ?? pendingChatIdRef.current;
      if (!targetChatId) {
        setQuizzes([]);
        return;
      }

      setIsLoadingQuizzes(true);
      try {
        const response = await fetch(`/api/quiz?chatId=${targetChatId}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (targetChatId !== activeChatIdRef.current) {
          return;
        }
        if (data.success && Array.isArray(data.data?.quizzes)) {
          setQuizzes(data.data.quizzes);
        }
      } catch (err) {
        if (targetChatId !== activeChatIdRef.current) {
          return;
        }
        console.warn("Failed to fetch quizzes for chat:", err);
      } finally {
        if (targetChatId === activeChatIdRef.current) {
          setIsLoadingQuizzes(false);
        }
      }
    },
    [chatId]
  );

  useEffect(() => {
    let cancelled = false;
    const currentChatId = chatId;

    const loadHistory = async () => {
      if (authLoading) {
        return;
      }

      // Immediately clear quizzes so previous chat quizzes are never visible while loading
      setQuizzes([]);

      if (!currentChatId) {
        if (!isAuthenticated && typeof window !== "undefined" && window.location.pathname === "/chat") {
          const savedMessages = sessionStorage.getItem("guestMessages");
          if (savedMessages) {
            try {
              const parsedMessages = JSON.parse(savedMessages);
              if (cancelled || currentChatId !== activeChatIdRef.current) return;
              setState((prev) => ({ ...prev, messages: parsedMessages, isLoading: false, chatTitle: "Sesi Belajar Baru" }));
              sessionStorage.removeItem("guestMessages");
              return;
            } catch (error) {
              console.error("Failed to parse saved guest messages:", error);
            }
          }
        }
        if (cancelled || currentChatId !== activeChatIdRef.current) return;
        setState((prev) => ({ ...prev, messages: [], isLoading: false, chatTitle: "Sesi Belajar Baru" }));
        return;
      }

      // Record guest chat ID for history tracking
      recordGuestChatId(currentChatId);

      // Load quizzes for this chat
      fetchChatQuizzes(currentChatId);

      if (cancelled || currentChatId !== activeChatIdRef.current) return;
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const data = await apiCall(`/api/chat/${currentChatId}`);
        if (cancelled || currentChatId !== activeChatIdRef.current) return;
        setState((prev) => ({
          ...prev,
          messages: data.data.messages || [],
          chatTitle: data.data?.chat?.title || "Tutor SKD CPNS",
          isLoading: false,
        }));
      } catch (error) {
        if (cancelled || currentChatId !== activeChatIdRef.current) return;
        console.error("Error loading chat history: ", error);
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to load chat",
          isLoading: false,
          messages: [],
          chatTitle: "Tutor SKD CPNS",
        }));
        // Only show toast if user was authenticated or if not 401
        if (isAuthenticated) {
          toast.error("Tidak dapat memuat riwayat percakapan");
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [chatId, isAuthenticated, authLoading, apiCall, fetchChatQuizzes]);

  const handleSendMessage = useCallback(
    async (overrideMessage?: string, quizAttemptId?: string) => {
      const messageContent = (typeof overrideMessage === "string" ? overrideMessage : inputMessage).trim();
      if (!messageContent || state.isLoading) return;

      if (typeof overrideMessage !== "string") {
        setInputMessage("");
      }

      const userMessage: Message = {
        role: "user",
        content: messageContent,
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

      const targetChatId = chatId || pendingChatIdRef.current;
      let resolvedChatId = targetChatId;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: messageContent,
            chatId: targetChatId || undefined,
            ...(quizAttemptId ? { quizAttemptId } : {}),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const newChatId = response.headers.get("X-Chat-Id");
        if (newChatId) {
          resolvedChatId = newChatId;
          pendingChatIdRef.current = newChatId;
          activeChatIdRef.current = newChatId;
          recordGuestChatId(newChatId);
        }

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

        // Refresh quizzes for the chat
        if (resolvedChatId) {
          await fetchChatQuizzes(resolvedChatId);
        }

        // Handle navigation after stream completion
        if (newChatId && !chatId) {
          setTimeout(() => router.push(`/chat?id=${newChatId}`), 100);
        } else if (!chatId && typeof window !== "undefined" && window.location.pathname === "/") {
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
        console.error("Error sending message: ", error);
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Failed to send message",
          isLoading: false,
        }));
        toast.error("Gagal mengirim pesan");
      } finally {
        if (resolvedChatId) {
          fetchChatQuizzes(resolvedChatId);
        }
      }
    },
    [state.isLoading, state.messages, chatId, inputMessage, router, fetchChatQuizzes]
  );

  const submitQuizAnswer = useCallback(
    (quizAttemptId: string, option: "A" | "B" | "C" | "D" | "E") => {
      return handleSendMessage(`Jawaban saya ${option}`, quizAttemptId);
    },
    [handleSendMessage]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    chatTitle: state.chatTitle,
    quizzes,
    isLoadingQuizzes,
    fetchChatQuizzes,
    submitQuizAnswer,
    handleSendMessage,
    clearError,
    inputMessage,
    setInputMessage,
  };
}