// Pure helpers for time tracking.

/**
 * Reads how people naturally type durations: "1:30", "1.5", "1.5h", "90m", "90 min", "2h 15m", "45".
 * A bare number up to 12 is read as hours; above that, as minutes. Returns whole minutes, or null.
 */
export function parseDuration(raw: string | null | undefined): number | null {
  const v = raw?.trim().toLowerCase();
  if (!v) return null;

  const clock = v.match(/^(\d{1,2}):(\d{2})$/);
  if (clock) {
    const mins = Number(clock[1]) * 60 + Number(clock[2]);
    return Number(clock[2]) < 60 ? mins : null;
  }

  const parts = v.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?$/);
  if (parts && (parts[1] || parts[2])) {
    return Math.round(Number(parts[1] ?? 0) * 60 + Number(parts[2] ?? 0));
  }

  if (/^\d+(\.\d+)?$/.test(v)) {
    const n = Number(v);
    return Math.round(n <= 12 ? n * 60 : n);
  }
  return null;
}

/** 90 → "1:30". */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const m = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/** 90 → "1.5h", 60 → "1h", 0 → "0h". */
export function formatHours(minutes: number): string {
  const h = Math.round((minutes / 60) * 10) / 10;
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}

/** Whole minutes between two ISO timestamps (never negative). */
export function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000));
}

/** Longest a timer can run before stopping it asks for a manual correction. */
export const MAX_TIMER_MINUTES = 12 * 60;
