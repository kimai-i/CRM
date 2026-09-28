import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { adSpend, clients, leads, tasks, weeklyReports } from "@/db/schema";
import { addDays, startOfWeek, toDateString } from "@/lib/dates";
import { spendInRange } from "@/lib/metrics";

// Template-based drafts. When an AI service is connected later, swap `buildDraft` for an AI writer
// that receives the same data pack.

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export async function buildDataPack(clientId: string, weekStart: string) {
  const weekEnd = addDays(weekStart, 6);
  const nextWeekEnd = addDays(weekEnd, 7);
  const [taskRows, leadRows, spendRows] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.clientId, clientId), isNull(tasks.parentId), eq(tasks.clientVisible, true))),
    db.select({ status: leads.status, occurredAt: leads.occurredAt }).from(leads).where(eq(leads.clientId, clientId)),
    db.select().from(adSpend).where(eq(adSpend.clientId, clientId)),
  ]);
  const inWeek = (iso: string | null) => {
    if (!iso) return false;
    const d = toDateString(new Date(iso));
    return d >= weekStart && d <= weekEnd;
  };
  const weekLeads = leadRows.filter((l) => inWeek(l.occurredAt) && (l.status === "open" || l.status === "booked"));
  const prevStart = addDays(weekStart, -7);
  const prevLeads = leadRows.filter((l) => {
    const d = toDateString(new Date(l.occurredAt));
    return d >= prevStart && d < weekStart && (l.status === "open" || l.status === "booked");
  });
  return {
    weekStart,
    weekEnd,
    completed: taskRows.filter((t) => t.status === "done" && inWeek(t.completedAt)).map((t) => t.title),
    inProgress: taskRows.filter((t) => t.status === "in_progress" && t.assigneeType === "agency").map((t) => t.title),
    comingUp: taskRows
      .filter((t) => t.status !== "done" && t.assigneeType === "agency" && t.dueDate !== null && t.dueDate > weekEnd && t.dueDate <= nextWeekEnd)
      .map((t) => t.title),
    needFromClient: taskRows.filter((t) => t.status !== "done" && t.assigneeType === "client").map((t) => t.title),
    leads: weekLeads.length,
    leadsPrevWeek: prevLeads.length,
    booked: weekLeads.filter((l) => l.status === "booked").length,
    spend: spendInRange(spendRows, { start: weekStart, end: weekEnd }).amount,
  };
}

type DataPack = Awaited<ReturnType<typeof buildDataPack>>;

export function buildDraft(clientName: string, d: DataPack): { subject: string; body: string } {
  // Repeated tasks (e.g. routines) are listed once with a count.
  const list = (items: string[], empty: string) => {
    if (!items.length) return empty;
    const counts = new Map<string, number>();
    for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
    return [...counts].slice(0, 10).map(([title, n]) => `• ${title}${n > 1 ? ` (×${n})` : ""}`).join("\n");
  };
  const change = d.leadsPrevWeek ? Math.round(((d.leads - d.leadsPrevWeek) / d.leadsPrevWeek) * 100) : null;
  const numbers = [
    `• Leads: ${d.leads}${change !== null ? ` (${change >= 0 ? "+" : ""}${change}% vs. the week before)` : ""}`,
    `• Booked jobs: ${d.booked}`,
    ...(d.spend > 0 ? [`• Ad spend: ${money(d.spend)}${d.leads ? ` (${money(d.spend / d.leads)} per lead)` : ""}`] : []),
  ].join("\n");

  return {
    subject: `${clientName} — Weekly update (${fmtDay(d.weekStart)}–${fmtDay(d.weekEnd)})`,
    body: [
      `Hi ${clientName} team,`,
      "",
      "Here's your update for the week.",
      "",
      "WHAT WE COMPLETED",
      list(d.completed, "• (Add highlights here)"),
      "",
      "IN PROGRESS",
      list(d.inProgress, "• Nothing in progress right now"),
      "",
      "THE NUMBERS",
      numbers,
      "",
      "COMING UP NEXT WEEK",
      list(d.comingUp, "• (Add next week's plan here)"),
      ...(d.needFromClient.length ? ["", "WHAT WE NEED FROM YOU", list(d.needFromClient, "")] : []),
      "",
      "Questions? Just reply or send a request from your portal.",
    ].join("\n"),
  };
}

/** Creates drafts for every active client for the week starting `weekStart` (skips ones that exist). */
export async function generateDrafts(weekStart: string): Promise<{ created: number; skipped: number }> {
  const active = await db.select({ id: clients.id, name: clients.name }).from(clients).where(and(eq(clients.lifecycle, "active"), eq(clients.isInternal, false)));
  const existing = new Set(
    (await db.select({ clientId: weeklyReports.clientId }).from(weeklyReports).where(eq(weeklyReports.weekStart, weekStart))).map((r) => r.clientId),
  );
  let created = 0;
  for (const c of active) {
    if (existing.has(c.id)) continue;
    const draft = buildDraft(c.name, await buildDataPack(c.id, weekStart));
    await db.insert(weeklyReports).values({ id: randomUUID(), clientId: c.id, weekStart, ...draft, status: "draft", createdAt: new Date().toISOString() }).onConflictDoNothing();
    created++;
  }
  return { created, skipped: active.length - created };
}

/** Monday of last week — the week a Monday-morning report covers. */
export const lastWeekStart = (today = toDateString(new Date())) => addDays(startOfWeek(today), -7);

