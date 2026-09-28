import "server-only";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients, leads, LEAD_SOURCES, LEAD_TYPES, type LeadSource, type LeadStatus, type LeadType } from "@/db/schema";
import { addDays, daysBetween, startOfWeek, toDateString } from "@/lib/dates";
import { isRealLead } from "@/lib/leads";

import type { LeadWindow } from "@/lib/lead-windows";
export type { LeadWindow } from "@/lib/lead-windows";

export type LeadRow = {
  id: string;
  clientId: string;
  clientName: string;
  clientColor: string;
  occurredAt: string;
  type: LeadType;
  source: LeadSource;
  sourceDetail: string | null;
  status: LeadStatus;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  summary: string | null;
  durationSec: number | null;
  value: number | null;
  /** True when value is real job revenue from matched jobs. */
  fromJobs: boolean;
  isRepeat: boolean;
};

const localDate = (iso: string) => toDateString(new Date(iso));

function windowStart(window: LeadWindow, today: string): string | null {
  switch (window) {
    case "7d": return addDays(today, -6);
    case "30d": return addDays(today, -29);
    case "90d": return addDays(today, -89);
    case "mtd": return `${today.slice(0, 7)}-01`;
    case "all": return null;
  }
}

export async function getLeadsPageData(opts: { clientId?: string; window: LeadWindow; type?: LeadType }) {
  const today = toDateString(new Date());
  const start = windowStart(opts.window, today);

  const scope: SQL[] = [];
  if (opts.clientId) scope.push(eq(leads.clientId, opts.clientId));

  const [allForScope, clientRows] = await Promise.all([
    db.select().from(leads).where(scope.length ? and(...scope) : undefined).orderBy(desc(leads.occurredAt)),
    db.select({ id: clients.id, name: clients.name, color: clients.color }).from(clients),
  ]);
  const clientById = new Map(clientRows.map((c) => [c.id, c]));

  // First time each contact reached each client, to mark repeats.
  const firstSeen = new Map<string, string>();
  for (const l of allForScope) {
    if (!l.contactKey) continue;
    const key = `${l.clientId}|${l.contactKey}`;
    const prev = firstSeen.get(key);
    if (!prev || l.occurredAt < prev) firstSeen.set(key, l.occurredAt);
  }

  const inRange = allForScope.filter(
    (l) => (!start || localDate(l.occurredAt) >= start) && (!opts.type || l.type === opts.type),
  );

  const rows: LeadRow[] = inRange.map((l) => {
    const c = clientById.get(l.clientId);
    return {
      id: l.id,
      clientId: l.clientId,
      clientName: c?.name ?? "Unknown client",
      clientColor: c?.color ?? "#94a3b8",
      occurredAt: l.occurredAt,
      type: l.type,
      source: l.source,
      sourceDetail: l.sourceDetail,
      status: l.status,
      contactName: l.contactName,
      phone: l.phone,
      email: l.email,
      summary: l.summary,
      durationSec: l.durationSec,
      value: l.jobRevenue ?? l.value,
      fromJobs: l.jobRevenue !== null,
      isRepeat: l.contactKey ? firstSeen.get(`${l.clientId}|${l.contactKey}`) !== l.occurredAt : false,
    };
  });

  const real = rows.filter((r) => isRealLead(r.status));
  const booked = real.filter((r) => r.status === "booked");
  const uniqueContacts = new Set(real.map((r) => (r.phone || r.email ? `${r.clientId}|${r.phone ?? r.email}` : r.id))).size;

  // Chart: one bar per day (or per week for long ranges).
  const firstDay = start ?? (real.length ? localDate(real[real.length - 1].occurredAt) : today);
  const spanDays = daysBetween(firstDay, today) + 1;
  const byWeek = spanDays > 92;
  const bucketOf = (iso: string) => (byWeek ? startOfWeek(localDate(iso)) : localDate(iso));
  const buckets: { date: string; booked: number; open: number }[] = [];
  for (let d = byWeek ? startOfWeek(firstDay) : firstDay; d <= today; d = addDays(d, byWeek ? 7 : 1)) {
    buckets.push({ date: d, booked: 0, open: 0 });
  }
  const bucketIndex = new Map(buckets.map((b, i) => [b.date, i]));
  for (const r of real) {
    const i = bucketIndex.get(bucketOf(r.occurredAt));
    if (i !== undefined) buckets[i][r.status === "booked" ? "booked" : "open"]++;
  }

  const byType = LEAD_TYPES.map((type) => ({ type, count: real.filter((r) => r.type === type).length }));
  const byStatus = (["open", "booked", "not_a_lead", "spam"] as const).map((status) => ({
    status,
    count: rows.filter((r) => r.status === status).length,
  }));
  const bySource = LEAD_SOURCES.map((source) => {
    const s = real.filter((r) => r.source === source);
    const b = s.filter((r) => r.status === "booked");
    return {
      source,
      leads: s.length,
      booked: b.length,
      bookedPct: s.length ? Math.round((b.length / s.length) * 100) : 0,
      value: b.reduce((sum, r) => sum + (r.value ?? 0), 0),
    };
  })
    .filter((s) => s.leads > 0)
    .sort((a, b) => b.leads - a.leads);

  return {
    today,
    rows,
    stats: {
      total: real.length,
      booked: booked.length,
      bookedPct: real.length ? Math.round((booked.length / real.length) * 100) : 0,
      unique: uniqueContacts,
      hidden: rows.length - real.length,
      bookedValue: booked.reduce((sum, r) => sum + (r.value ?? 0), 0),
    },
    chart: { buckets, byWeek },
    byType,
    byStatus,
    bySource,
  };
}

export async function getLeadWithHistory(id: string) {
  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) return null;
  const history = lead.contactKey
    ? await db
        .select()
        .from(leads)
        .where(and(eq(leads.clientId, lead.clientId), eq(leads.contactKey, lead.contactKey)))
        .orderBy(desc(leads.occurredAt))
    : [lead];
  return { lead, history };
}
