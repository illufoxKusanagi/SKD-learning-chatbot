export type QuizOptionKey = "A" | "B" | "C" | "D" | "E";
export type QuizCategoryFilter = "ALL" | "TWK" | "TIU" | "TKP";
export type QuizStatusFilter = "ALL" | "answered" | "pending";

export interface QuizAttemptDetail {
  id: string;
  chatId: string | null;
  chatTitle?: string;
  category: "TWK" | "TIU" | "TKP";
  subtopic: string;
  questionStem: string;
  imageUrl?: string | null;
  options: Record<QuizOptionKey, string>;
  correctOption: QuizOptionKey | null;
  scoringRubric: Record<QuizOptionKey, number> | null;
  rubricRationale: string | null;
  userAnswer: QuizOptionKey | null;
  scoreEarned: number | null;
  maxScore: number;
  aiExplanation: string | null;
  status: "pending" | "answered";
  createdAt: string;
  answeredAt: string | null;
}

export interface CategoryStats {
  total: number;
  answered: number;
  correctCount?: number;
  optimalCount?: number;
  scoreEarned: number;
  maxScore: number;
  accuracyPercent?: number;
  averagePoints?: number;
}

export interface QuizStats {
  totalAttempts: number;
  answeredCount: number;
  pendingCount: number;
  totalScoreEarned: number;
  totalMaxScore: number;
  averageScore: number;
  byCategory: {
    TWK: CategoryStats;
    TIU: CategoryStats;
    TKP: CategoryStats;
  };
}

export const OPTION_KEYS: QuizOptionKey[] = ["A", "B", "C", "D", "E"];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidChatUuid(val?: string | null): val is string {
  return Boolean(val && UUID_REGEX.test(val));
}

export function readStorageUuidList(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => isValidChatUuid(id));
  } catch {
    return [];
  }
}

export function getInitialStoredChatId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const lastActive = sessionStorage.getItem("skd_last_active_chat_id");
    if (isValidChatUuid(lastActive)) return lastActive;
    const guestIds = readStorageUuidList("skd_guest_chat_ids");
    return guestIds[0] ?? null;
  } catch {
    return null;
  }
}

export function buildQuizHistoryEndpoint(isAuthenticated: boolean): string {
  if (isAuthenticated || typeof window === "undefined") {
    return "/api/quiz";
  }
  const validChatIds = readStorageUuidList("skd_guest_chat_ids");
  const validSessionIds = Array.from(
    new Set([
      ...readStorageUuidList("skd_guest_practice_session_ids"),
      ...readStorageUuidList("skd_guest_tryout_session_ids"),
    ])
  );
  if (validChatIds.length === 0 && validSessionIds.length === 0) {
    return "/api/quiz";
  }
  const params = new URLSearchParams();
  if (validChatIds.length > 0) params.set("chatIds", validChatIds.join(","));
  if (validSessionIds.length > 0) {
    params.set("sessionIds", validSessionIds.join(","));
  }
  return `/api/quiz?${params.toString()}`;
}

export function getCategoryColor(category: string): string {
  switch (category) {
    case "TWK":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "TIU":
      return "bg-primary/10 text-primary border-primary/20";
    case "TKP":
      return "bg-success/10 text-success border-success/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function formatQuizDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function getOptionAppearance({
  isTKP,
  isUserChoice,
  isCorrectOpt,
  rubricScore,
}: {
  isTKP: boolean;
  isUserChoice: boolean;
  isCorrectOpt: boolean;
  rubricScore?: number;
}) {
  let containerStyle = "border-border bg-card/60 text-muted-foreground";
  let letterStyle = "bg-muted text-muted-foreground border-border";

  if (isTKP) {
    if (isUserChoice) {
      if (rubricScore === 5) {
        containerStyle = "border-success/60 bg-success/10 text-foreground font-medium shadow-xs";
        letterStyle = "bg-success text-success-foreground border-success font-bold";
      } else if (rubricScore === 4) {
        containerStyle = "border-primary/60 bg-primary/10 text-foreground font-medium shadow-xs";
        letterStyle = "bg-primary text-primary-foreground border-primary font-bold";
      } else if (rubricScore === 3) {
        containerStyle = "border-warning/60 bg-warning/10 text-foreground font-medium shadow-xs";
        letterStyle = "bg-warning text-warning-foreground border-warning font-bold";
      } else {
        containerStyle = "border-destructive/60 bg-destructive/10 text-foreground font-medium shadow-xs";
        letterStyle = "bg-destructive text-white border-destructive font-bold";
      }
    } else if (rubricScore === 5) {
      containerStyle = "border-success/40 bg-success/5 text-foreground font-medium";
      letterStyle = "bg-success/20 text-success border-success/30 font-bold";
    }
  } else if (isCorrectOpt) {
    containerStyle = "border-success/60 bg-success/10 text-foreground font-medium shadow-xs";
    letterStyle = "bg-success text-success-foreground border-success font-bold";
  } else if (isUserChoice) {
    containerStyle = "border-destructive/60 bg-destructive/10 text-foreground font-medium shadow-xs";
    letterStyle = "bg-destructive text-white border-destructive font-bold";
  }

  const userBadgeStyle = isTKP
    ? rubricScore === 5
      ? "bg-success/15 text-success border-success/40"
      : rubricScore === 4
      ? "bg-primary/15 text-primary border-primary/40"
      : rubricScore === 3
      ? "bg-warning/15 text-warning border-warning/40"
      : "bg-destructive/15 text-destructive border-destructive/40"
    : isCorrectOpt
    ? "bg-success/15 text-success border-success/40"
    : "bg-destructive/15 text-destructive border-destructive/40";

  const rubricBadgeStyle =
    rubricScore === 5
      ? "bg-success/15 text-success border-success/30"
      : rubricScore === 4
      ? "bg-primary/15 text-primary border-primary/30"
      : rubricScore === 3
      ? "bg-warning/15 text-warning border-warning/30"
      : "bg-muted text-muted-foreground border-border";

  return { containerStyle, letterStyle, userBadgeStyle, rubricBadgeStyle };
}
