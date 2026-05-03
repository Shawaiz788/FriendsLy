/** Per-user snooze for overlap / hangout suggestion cards (Home). */

export const HANGOUT_SNOOZE_STORAGE_KEY = "friendsly-hangout-snooze-until-by-user";

export function loadHangoutSnoozeMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(HANGOUT_SNOOZE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const now = Date.now();
    const out: Record<string, number> = {};
    for (const [userId, until] of Object.entries(parsed)) {
      if (typeof until === "number" && until > now) {
        out[userId] = until;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveHangoutSnoozeMap(map: Record<string, number>): void {
  localStorage.setItem(HANGOUT_SNOOZE_STORAGE_KEY, JSON.stringify(map));
}

export function formatSnoozeDuration(ms: number): string {
  if (ms >= 86_400_000) return "24 hours";
  if (ms >= 3_600_000) return `${Math.round(ms / 3_600_000)} hours`;
  if (ms >= 60_000) return `${Math.round(ms / 60_000)} minutes`;
  return "a short time";
}
