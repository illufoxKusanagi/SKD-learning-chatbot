import { useSession } from "next-auth/react";
import { Message } from "@/lib/types/chat";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface QuizAttemptItem {
  id: string;
  chatId: string;
  chatTitle?: string;
  ragSourceId?: string | null;
  questionId?: string | null;
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

export function recordLastActiveChatId(chatId: string) {
  if (typeof window === "undefined" || !chatId) return;
  try {
    sessionStorage.setItem("skd_last_active_chat_id", chatId);
  } catch {
    // Ignore storage quota/privacy errors
  }
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

function sortQuizzesChronological(items: QuizAttemptItem[]): QuizAttemptItem[] {
  return [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
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
  const [gradingQuizId, setGradingQuizId] = useState<string | null>(null);
  const [gradingOption, setGradingOption] = useState<"A" | "B" | "C" | "D" | "E" | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState<boolean>(false);

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
      recordLastActiveChatId(chatId);
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
          setQuizzes(sortQuizzesChronological(data.data.quizzes));
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

      // Immediately clear quizzes when switching to a different chat
      if (!currentChatId || currentChatId !== pendingChatIdRef.current) {
        setQuizzes([]);
      }

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
        const loadedMessages: Message[] = Array.isArray(data.data?.messages)
          ? [...data.data.messages]
          : [];
        if (typeof window !== "undefined") {
          try {
            const pendingErrorKey = `skd_ephemeral_error_${currentChatId}`;
            const pendingEphemeralError = sessionStorage.getItem(pendingErrorKey);
            if (pendingEphemeralError) {
              sessionStorage.removeItem(pendingErrorKey);
              loadedMessages.push({
                role: "bot",
                content: pendingEphemeralError,
                timestamp: new Date().toISOString(),
              });
            }
          } catch {
            // Ignore storage access errors
          }
        }
        setState((prev) => ({
          ...prev,
          messages: loadedMessages,
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
    async (
      overrideMessage?: string,
      quizAttemptId?: string,
      options?: {
        isRetry?: boolean;
        questionId?: string | null;
        questionSlug?: string | null;
        materialSlugs?: string[];
        selectedAnswer?: "A" | "B" | "C" | "D" | "E" | null;
        isTutorDiscussion?: boolean;
      }
    ) => {
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

      setState((prev) => {
        const baseMessages = [...prev.messages];
        if (options?.isRetry) {
          if (baseMessages.length > 0 && baseMessages[baseMessages.length - 1].role === "bot") {
            baseMessages[baseMessages.length - 1] = {
              role: "bot",
              content: "",
              timestamp: new Date().toISOString(),
            };
          } else {
            baseMessages.push({
              role: "bot",
              content: "",
              timestamp: new Date().toISOString(),
            });
          }
          return {
            ...prev,
            messages: baseMessages,
            isLoading: true,
            error: null,
          };
        }

        return {
          ...prev,
          messages: [
            ...baseMessages,
            userMessage,
            {
              role: "bot",
              content: "",
              timestamp: new Date().toISOString(),
            },
          ],
          isLoading: true,
          error: null,
        };
      });

      const targetChatId = chatId || pendingChatIdRef.current;
      let resolvedChatId = targetChatId;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(options?.isRetry ? { "X-Chat-Retry": "1" } : {}),
          },
          body: JSON.stringify({
            message: messageContent,
            chatId: targetChatId || undefined,
            ...(quizAttemptId ? { quizAttemptId } : {}),
            ...(options?.isRetry && targetChatId
              ? { skipUserMessageInsert: true }
              : {}),
            ...(options?.questionId ? { questionId: options.questionId } : {}),
            ...(options?.questionSlug ? { questionSlug: options.questionSlug } : {}),
            ...(options?.materialSlugs?.length ? { materialSlugs: options.materialSlugs } : {}),
            ...(options?.selectedAnswer ? { selectedAnswer: options.selectedAnswer } : {}),
            ...(options?.isTutorDiscussion ? { isTutorDiscussion: true } : {}),
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
          recordLastActiveChatId(newChatId);
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
          if (
            typeof window !== "undefined" &&
            accumulatedContent.includes("<!--CHAT_ERROR:")
          ) {
            try {
              sessionStorage.setItem(
                `skd_ephemeral_error_${newChatId}`,
                accumulatedContent
              );
            } catch {
              // Ignore storage quota errors
            }
          }
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
        const errMsg =
          error instanceof Error && error.message
            ? error.message
            : "Terjadi gangguan jaringan saat menghubungi server. Silakan coba lagi.";
        const fallbackErrorMarker = `<!--CHAT_ERROR:${JSON.stringify({
          code: "NETWORK_ERROR",
          title: "Gagal Menghubungi Server",
          message: errMsg,
        })}-->`;

        setState((prev) => {
          const nextMessages = [...prev.messages];
          const lastIdx = nextMessages.length - 1;
          if (
            lastIdx >= 0 &&
            nextMessages[lastIdx].role === "bot" &&
            !nextMessages[lastIdx].content.includes("<!--CHAT_ERROR:")
          ) {
            nextMessages[lastIdx] = {
              ...nextMessages[lastIdx],
              content: nextMessages[lastIdx].content
                ? `${nextMessages[lastIdx].content}\n\n${fallbackErrorMarker}`
                : fallbackErrorMarker,
            };
          }
          return {
            ...prev,
            messages: nextMessages,
            error: errMsg,
            isLoading: false,
          };
        });
        toast.error("Gagal mengirim pesan");
        if (
          resolvedChatId &&
          !chatId &&
          typeof window !== "undefined" &&
          window.location.pathname === "/"
        ) {
          try {
            sessionStorage.setItem(
              `skd_ephemeral_error_${resolvedChatId}`,
              fallbackErrorMarker
            );
          } catch {
            // Ignore storage quota errors
          }
          router.push(`/chat?id=${resolvedChatId}`);
        }
      } finally {
        if (resolvedChatId) {
          fetchChatQuizzes(resolvedChatId);
        }
      }
    },
    [state.isLoading, state.messages, chatId, inputMessage, router, fetchChatQuizzes]
  );

  const submitQuizAnswer = useCallback(
    async (quizAttemptId: string, option: "A" | "B" | "C" | "D" | "E") => {
      if (gradingQuizId === quizAttemptId) return;

      setGradingQuizId(quizAttemptId);
      setGradingOption(option);
      try {
        const response = await fetch("/api/quiz", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "grade",
            quizAttemptId,
            selectedOption: option,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success || !data.data?.quiz) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        const gradedQuiz = data.data.quiz as QuizAttemptItem;
        setQuizzes((prev) =>
          prev.map((item) => (item.id === gradedQuiz.id ? gradedQuiz : item))
        );
      } catch (error) {
        console.error("Error grading quiz in-place:", error);
        toast.error(
          error instanceof Error ? error.message : "Gagal menyimpan jawaban"
        );
      } finally {
        setGradingQuizId(null);
        setGradingOption(null);
      }
    },
    [gradingQuizId]
  );

  const requestNextQuiz = useCallback(
    async (options?: {
      category?: "TWK" | "TIU" | "TKP";
      subtopic?: string;
      materialSlug?: string;
      insertChatMarker?: boolean;
    }): Promise<QuizAttemptItem | null> => {
      if (isGeneratingQuiz) return null;

      setIsGeneratingQuiz(true);
      const targetChatId = chatId || pendingChatIdRef.current;

      try {
        const response = await fetch("/api/quiz", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "next",
            chatId: targetChatId || undefined,
            category: options?.category,
            subtopic: options?.subtopic,
            materialSlug: options?.materialSlug,
            insertChatMarker: options?.insertChatMarker ?? false,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success || !data.data?.quiz) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        const createdQuiz = data.data.quiz as QuizAttemptItem;
        const returnedChatId = data.data.chatId as string | undefined;

        if (returnedChatId && !chatId) {
          pendingChatIdRef.current = returnedChatId;
          activeChatIdRef.current = returnedChatId;
          recordLastActiveChatId(returnedChatId);
          recordGuestChatId(returnedChatId);
          router.replace(`/chat?id=${returnedChatId}`);
        }

        setQuizzes((prev) => {
          if (prev.some((q) => q.id === createdQuiz.id)) {
            return prev;
          }
          return sortQuizzesChronological([...prev, createdQuiz]);
        });

        if (options?.insertChatMarker) {
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "bot",
                content: `<!--QUIZ_ATTEMPT:${createdQuiz.id}-->`,
                timestamp: new Date().toISOString(),
              },
            ],
          }));
        }

        return createdQuiz;
      } catch (error) {
        console.error("Error generating next quiz:", error);
        toast.error(
          error instanceof Error ? error.message : "Gagal memuat soal berikutnya"
        );
        return null;
      } finally {
        setIsGeneratingQuiz(false);
      }
    },
    [chatId, isGeneratingQuiz, router]
  );

  const askTutorAboutQuiz = useCallback(
    (quiz: QuizAttemptItem) => {
      const bestOption =
        quiz.correctOption ||
        (quiz.scoringRubric
          ? (Object.entries(quiz.scoringRubric).find(([, s]) => s === 5)?.[0] ?? "terbaik")
          : "terbaik");
      const prompt = quiz.userAnswer
        ? `Tolong bahas lebih dalam soal ${quiz.category} (${quiz.subtopic}) tadi. Mengapa opsi ${bestOption} paling tepat dibanding pilihan saya (${quiz.userAnswer}) dan apa trik cepat SKD-nya?`
        : `Tolong berikan petunjuk konsep untuk menjawab soal ${quiz.category} (${quiz.subtopic}) tanpa langsung menyebutkan jawabannya.`;
      return handleSendMessage(prompt, quiz.id, {
        questionId: quiz.questionId ?? undefined,
        questionSlug: quiz.ragSourceId ?? undefined,
        selectedAnswer: quiz.userAnswer,
        isTutorDiscussion: true,
      });
    },
    [handleSendMessage]
  );

  const retryLastMessage = useCallback(() => {
    if (state.isLoading) return;
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === "user" && state.messages[i].content.trim()) {
        return handleSendMessage(state.messages[i].content, undefined, {
          isRetry: true,
        });
      }
    }
  }, [state.isLoading, state.messages, handleSendMessage]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    activeChatId: chatId || pendingChatIdRef.current || quizzes[0]?.chatId || null,
    messages: state.messages,
    isLoading: state.isLoading,
    chatTitle: state.chatTitle,
    quizzes,
    isLoadingQuizzes,
    gradingQuizId,
    gradingOption,
    isGeneratingQuiz,
    fetchChatQuizzes,
    submitQuizAnswer,
    requestNextQuiz,
    askTutorAboutQuiz,
    handleSendMessage,
    retryLastMessage,
    clearError,
    inputMessage,
    setInputMessage,
  };
}