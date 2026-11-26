import type { OptionKey, SkdCategory } from "@/lib/scoring/skd-scoring";

export const GUEST_TRYOUT_SESSIONS_KEY = "skd_guest_tryout_session_ids";

export const TRYOUT_OPTION_KEYS: readonly OptionKey[] = ["A", "B", "C", "D", "E"];
export const TRYOUT_CATEGORIES: readonly SkdCategory[] = ["TWK", "TIU", "TKP"];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidTryoutUuid(value?: string | null): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

export function readGuestTryoutSessionIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_TRYOUT_SESSIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((id): id is string => isValidTryoutUuid(id))
      .map((id) => id.trim());
  } catch {
    return [];
  }
}

export function recordGuestTryoutSessionId(sessionId: string): void {
  if (typeof window === "undefined" || !isValidTryoutUuid(sessionId)) return;
  try {
    const normalized = sessionId.trim();
    const existing = readGuestTryoutSessionIds().filter(
      (id) => id !== normalized
    );
    existing.unshift(normalized);
    localStorage.setItem(
      GUEST_TRYOUT_SESSIONS_KEY,
      JSON.stringify(existing.slice(0, 20))
    );
  } catch {
    // Ignore storage quota or privacy errors
  }
}

export function formatExamCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function formatDurationMinutesSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}m ${seconds}s`;
}

export function formatTryoutDate(isoString: string): string {
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
