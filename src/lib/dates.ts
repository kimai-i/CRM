// Calendar-date helpers. All dates are "YYYY-MM-DD" strings in the server's local timezone.

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const offset = (d.getDay() + 6) % 7;
  return addDays(date, -offset);
}

/** Context-aware due label: "Due today", "Due in 3d", "3d overdue". */
export function dueLabel(dueDate: string | null, today: string): { text: string; overdue: boolean } {
  if (!dueDate) return { text: "No date", overdue: false };
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return { text: `${-diff}d overdue`, overdue: true };
  if (diff === 0) return { text: "Due today", overdue: false };
  if (diff === 1) return { text: "Due tomorrow", overdue: false };
  return { text: `Due in ${diff}d`, overdue: false };
}

export function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function formatLongDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
