import type { QuizAttemptItem } from "@/hooks/use-chat";
import type { LoadPracticePackConfig } from "@/hooks/use-practice-pack";
import type { PracticeQuestionItem } from "@/lib/services/practice.service";
import type { PracticeAnswerState, QuizCategory, QuizOptionKey } from "./quiz-utils";

export interface PracticeCanvasBindings {
  sessionId: string | null;
  questions: PracticeQuestionItem[];
  answers: Record<string, PracticeAnswerState>;
  revealedHints: Record<string, boolean>;
  activeIndex: number;
  isLoadingPack: boolean;
  onSelectIndex: (index: number) => void;
  onLoadPack: (config: LoadPracticePackConfig) => Promise<unknown>;
  onSelectOption: (questionId: string, option: QuizOptionKey) => void;
  onRevealHint: (questionId: string) => void;
  onRetrySync: (questionId: string) => void;
  onRetryWrongQuestions: () => Promise<unknown>;
  onAskTutor: (
    question: PracticeQuestionItem,
    selectedAnswer: QuizOptionKey | null
  ) => void;
  onDiscussMaterial?: (slug: string, title: string) => void;
}

export interface QuizCanvasPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvasMode: "practice" | "chat";
  onCanvasModeChange: (mode: "practice" | "chat") => void;
  chatId?: string | null;
  quizzes: QuizAttemptItem[];
  activeQuizId: string | null;
  onSelectQuizId: (quizId: string) => void;
  onGradeOption: (quizId: string, option: QuizOptionKey) => void;
  gradingQuizId: string | null;
  gradingOption: QuizOptionKey | null;
  onRequestNextQuiz: (category?: QuizCategory) => Promise<QuizAttemptItem | null>;
  isGeneratingQuiz: boolean;
  onAskTutor: (quiz: QuizAttemptItem) => void;
  isChatLoading: boolean;
  practice: PracticeCanvasBindings;
}
