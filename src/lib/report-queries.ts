import "server-only";
import { and, eq, gte, isNull, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { adSpend, clients, leads, services, tasks, timeEntries, users } from "@/db/schema";
import { addDays, toDateString } from "@/lib/dates";
import { computeResults, type DateRange } from "@/lib/metrics";

/** Monday–Friday days in a range (inclusive). */
export function workdaysIn(range: DateRange): number {
  let n = 0;
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) {
    const day = new Date(`${d}T00:00:00`).getDay();
    if (day !== 0 && day !== 6) n++;
  }
  return n;
}

// Monthly targets assume 20 working days (120h target = 6h per workday).
const WORKDAYS_PER_MONTH = 20;

export async function getReportData(range: DateRange) {
  const today = toDateString(new Date());
  const [clientRows, serviceRows, staff, entries, taskRows, leadRows, spendRows] = await Promise.all([
    db.select().from(clients),
    db.select().from(services),
    db.select().from(users).where(and(ne(users.role, "client"), eq(users.isActive, true))),
    db.select({ userId: timeEntries.userId, clientId: timeEntries.clientId, serviceKey: timeEntries.serviceKey, minutes: timeEntries.minutes })
      .from(timeEntries)
      .where(and(gte(timeEntries.date, range.start), lte(timeEntries.date, range.end))),
    db.select({ clientId: tasks.clientId, status: tasks.status, dueDate: tasks.dueDate, completedAt: tasks.completedAt })
      .from(tasks)
      .where(isNull(tasks.parentId)),
    db.select({ clientId: leads.clientId, status: leads.status, source: leads.source, value: leads.value, jobRevenue: leads.jobRevenue, occurredAt: leads.occurredAt }).from(leads),
    db.select().from(adSpend),
  ]);

  const inRange = (iso: string | null) => {
    if (!iso) return false;
    const d = toDateString(new Date(iso));
    return d >= range.start && d <= range.end;
  };
  const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0);
  const workdays = workdaysIn(range);

  // Hours by service
  const serviceByKey = new Map(serviceRows.map((s) => [s.key, s]));
  const byService = [...new Set(entries.map((e) => e.serviceKey))]
    .map((key) => ({
      key,
      name: serviceByKey.get(key)?.name ?? key,
      color: serviceByKey.get(key)?.color ?? "#94a3b8",
      minutes: entries.filter((e) => e.serviceKey === key).reduce((s, e) => s + e.minutes, 0),
    }))
    .sort((a, b) => b.minutes - a.minutes);

  // Team utilization, with each target prorated to the working days in the period
  const team = staff
    .map((u) => {
      const minutes = entries.filter((e) => e.userId === u.id).reduce((s, e) => s + e.minutes, 0);
      const targetHours = Math.round((u.utilizationTargetHours / WORKDAYS_PER_MONTH) * workdays * 10) / 10;
      return { id: u.id, name: u.name, initials: u.initials, color: u.color, minutes, targetHours };
    })
    .sort((a, b) => b.minutes - a.minutes);
  const teamTargetHours = team.reduce((s, u) => s + u.targetHours, 0);

  // Per-client scorecards
  const scorecards = clientRows
    .filter((c) => c.lifecycle !== "churned" || entries.some((e) => e.clientId === c.id))
    .map((c) => {
      const clientEntries = entries.filter((e) => e.clientId === c.id);
      const minutes = clientEntries.reduce((s, e) => s + e.minutes, 0);
      const clientTasks = taskRows.filter((t) => t.clientId === c.id);
      // Same formulas as Marketing Results, so the two pages always agree.
      const results = computeResults({
        range,
        leads: leadRows
          .filter((l) => l.clientId === c.id)
          .map((l) => ({ source: l.source, status: l.status, value: l.jobRevenue ?? l.value, date: toDateString(new Date(l.occurredAt)) })),
        spend: spendRows.filter((s) => s.clientId === c.id),
      }).totals;
      const topServices = [...new Set(clientEntries.map((e) => e.serviceKey))]
        .map((key) => ({ key, name: serviceByKey.get(key)?.name ?? key, color: serviceByKey.get(key)?.color ?? "#94a3b8", minutes: clientEntries.filter((e) => e.serviceKey === key).reduce((s, e) => s + e.minutes, 0) }))
        .sort((a, b) => b.minutes - a.minutes);
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        lifecycle: c.lifecycle,
        isInternal: c.isInternal,
        minutes,
        shareOfHours: totalMinutes ? minutes / totalMinutes : 0,
        topServices,
        tasksCompleted: clientTasks.filter((t) => t.status === "done" && inRange(t.completedAt)).length,
        openTasks: clientTasks.filter((t) => t.status !== "done").length,
        overdueTasks: clientTasks.filter((t) => t.status !== "done" && t.dueDate !== null && t.dueDate < today).length,
        leads: results.leads,
        booked: results.booked,
        spend: results.spend,
        roas: results.roas,
      };
    })
    .sort((a, b) => Number(a.isInternal) - Number(b.isInternal) || b.minutes - a.minutes || a.name.localeCompare(b.name));

  const billable = scorecards.filter((c) => !c.isInternal);
  const activeClients = clientRows.filter((c) => !c.isInternal && c.lifecycle === "active").length;
  const internalMinutes = scorecards.filter((c) => c.isInternal).reduce((s, c) => s + c.minutes, 0);

  return {
    range,
    workdays,
    totals: {
      minutes: totalMinutes,
      teamTargetHours,
      activeClients,
      totalClients: clientRows.filter((c) => !c.isInternal && c.lifecycle !== "churned").length,
      tasksCompleted: taskRows.filter((t) => t.status === "done" && inRange(t.completedAt)).length,
      servicesInFlight: byService.length,
      clientMinutes: totalMinutes - internalMinutes,
      internalMinutes,
      clientsWithTime: billable.filter((c) => c.minutes > 0).length,
      avgMinutesPerClient: billable.some((c) => c.minutes > 0) ? (totalMinutes - internalMinutes) / billable.filter((c) => c.minutes > 0).length : 0,
    },
    byService,
    team,
    scorecards: billable,
    internal: scorecards.filter((c) => c.isInternal),
  };
}

export type ReportData = Awaited<ReturnType<typeof getReportData>>;

/** Hours by client and service as CSV rows, for billing and invoices. */
export async function getHoursCsv(range: DateRange): Promise<string> {
  const rows = await db
    .select({ client: clients.name, service: services.name, user: users.name, minutes: timeEntries.minutes })
    .from(timeEntries)
    .innerJoin(clients, eq(timeEntries.clientId, clients.id))
    .innerJoin(services, eq(timeEntries.serviceKey, services.key))
    .innerJoin(users, eq(timeEntries.userId, users.id))
    .where(and(gte(timeEntries.date, range.start), lte(timeEntries.date, range.end)));

  const totals = new Map<string, { client: string; service: string; user: string; minutes: number }>();
  for (const r of rows) {
    const key = `${r.client}|${r.service}|${r.user}`;
    const t = totals.get(key) ?? { client: r.client, service: r.service, user: r.user, minutes: 0 };
    t.minutes += r.minutes;
    totals.set(key, t);
  }
  const quote = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [...totals.values()]
    .sort((a, b) => a.client.localeCompare(b.client) || a.service.localeCompare(b.service) || a.user.localeCompare(b.user))
    .map((t) => [t.client, t.service, t.user, (t.minutes / 60).toFixed(2)].map(quote).join(","));
  return ["Client,Service,Team member,Hours", ...lines].join("\r\n") + "\r\n";
}
