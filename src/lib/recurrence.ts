// Pure schedule math for recurring tasks. Dates are "YYYY-MM-DD" strings.
import { addDays, startOfWeek } from "@/lib/dates";
import type { RecurrenceFrequency } from "@/db/schema";

export type Schedule = {
  frequency: RecurrenceFrequency;
  interval: number; // every N weeks / months
  weekdays: number[]; // weekly only: 0 = Sunday … 6 = Saturday
  dayOfMonth: number | null; // monthly only: 1–31, or -1 for the last day
  startsOn: string;
};

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Friendly presets for the "Repeats" dropdown. */
export const REPEAT_OPTIONS = [
  { key: "w1", label: "Every week", frequency: "weekly", interval: 1 },
  { key: "w2", label: "Every 2 weeks", frequency: "weekly", interval: 2 },
  { key: "m1", label: "Every month", frequency: "monthly", interval: 1 },
  { key: "m3", label: "Every 3 months (quarterly)", frequency: "monthly", interval: 3 },
  { key: "m6", label: "Every 6 months", frequency: "monthly", interval: 6 },
  { key: "m12", label: "Every year", frequency: "monthly", interval: 12 },
] as const;
export type RepeatKey = (typeof REPEAT_OPTIONS)[number]["key"];

export function repeatKeyFor(frequency: RecurrenceFrequency, interval: number): RepeatKey {
  return REPEAT_OPTIONS.find((o) => o.frequency === frequency && o.interval === interval)?.key ?? (frequency === "weekly" ? "w1" : "m1");
}

export function parseWeekdays(raw: string | null | undefined): number[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
}

const toDate = (s: string) => new Date(`${s}T00:00:00`);
const daysInMonth = (year: number, month0: number) => new Date(year, month0 + 1, 0).getDate();
const pad = (n: number) => String(n).padStart(2, "0");

function monthlyDate(year: number, month0: number, dayOfMonth: number): string {
  const last = daysInMonth(year, month0);
  const day = dayOfMonth === -1 ? last : Math.min(dayOfMonth, last);
  return `${year}-${pad(month0 + 1)}-${pad(day)}`;
}

/** The first scheduled date strictly after `after`. Returns null if the schedule is empty. */
export function nextOccurrence(s: Schedule, after: string): string | null {
  const interval = Math.max(1, Math.floor(s.interval));
  const from = after < s.startsOn ? addDays(s.startsOn, -1) : after;

  if (s.frequency === "weekly") {
    if (s.weekdays.length === 0) return null;
    const anchorWeek = startOfWeek(s.startsOn);
    // Look ahead far enough to cover any interval.
    for (let i = 1; i <= 7 * interval + 7; i++) {
      const d = addDays(from, i);
      const weeks = Math.round((toDate(startOfWeek(d)).getTime() - toDate(anchorWeek).getTime()) / (7 * 86_400_000));
      if (weeks % interval === 0 && s.weekdays.includes(toDate(d).getDay())) return d;
    }
    return null;
  }

  if (s.dayOfMonth === null) return null;
  const start = toDate(s.startsOn);
  const startIndex = start.getFullYear() * 12 + start.getMonth();
  const fromDate = toDate(from);
  // Walk month by month from the month of `from`, keeping only months on the interval.
  for (let idx = fromDate.getFullYear() * 12 + fromDate.getMonth(); idx < fromDate.getFullYear() * 12 + fromDate.getMonth() + 12 * interval + 2; idx++) {
    if (idx < startIndex || (idx - startIndex) % interval !== 0) continue;
    const candidate = monthlyDate(Math.floor(idx / 12), idx % 12, s.dayOfMonth);
    if (candidate > from && candidate >= s.startsOn) return candidate;
  }
  return null;
}

/** The first scheduled date on or after `date`. */
export function firstOccurrenceOnOrAfter(s: Schedule, date: string): string | null {
  return nextOccurrence(s, addDays(date, -1));
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** "Every Monday", "Every 2 weeks on Tue & Thu", "Monthly on the 1st", "Every 3 months on the last day". */
export function describeSchedule(s: Pick<Schedule, "frequency" | "interval" | "weekdays" | "dayOfMonth">): string {
  if (s.frequency === "weekly") {
    const days = s.weekdays.length === 7 ? "every day"
      : s.weekdays.join(",") === "1,2,3,4,5" ? "weekdays"
      : s.weekdays.map((d) => WEEKDAY_SHORT[d]).join(" & ");
    if (s.interval === 1) {
      if (s.weekdays.length === 1) return `Every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][s.weekdays[0]]}`;
      return days === "every day" ? "Every day" : `Every week on ${days}`;
    }
    return `Every ${s.interval} weeks on ${days}`;
  }
  const day = s.dayOfMonth === -1 ? "the last day" : `the ${ordinal(s.dayOfMonth ?? 1)}`;
  if (s.interval === 1) return `Monthly on ${day}`;
  if (s.interval === 3) return `Quarterly on ${day}`;
  if (s.interval === 12) return `Yearly on ${day}`;
  return `Every ${s.interval} months on ${day}`;
}
