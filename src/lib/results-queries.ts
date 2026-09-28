import "server-only";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { adSpend, clients, jobs, leads } from "@/db/schema";
import { jobStats } from "@/lib/jobs";
import { toDateString } from "@/lib/dates";
import { computeResults, monthlyTrend, rangeFor, type MetricLead, type MetricSpend, type ResultWindow } from "@/lib/metrics";

export async function getResultsData(opts: { clientId?: string; window: ResultWindow }) {
  const today = toDateString(new Date());
  const range = rangeFor(opts.window, today);

  const leadScope: SQL[] = [];
  const spendScope: SQL[] = [];
  const jobScope: SQL[] = [];
  if (opts.clientId) {
    leadScope.push(eq(leads.clientId, opts.clientId));
    spendScope.push(eq(adSpend.clientId, opts.clientId));
    jobScope.push(eq(jobs.clientId, opts.clientId));
  }

  const [leadRows, spendRows, clientRows, jobRows] = await Promise.all([
    db.select({ source: leads.source, status: leads.status, value: leads.value, jobRevenue: leads.jobRevenue, occurredAt: leads.occurredAt })
      .from(leads).where(leadScope.length ? and(...leadScope) : undefined),
    db.select().from(adSpend).where(spendScope.length ? and(...spendScope) : undefined).orderBy(desc(adSpend.periodStart)),
    db.select({ id: clients.id, name: clients.name, color: clients.color }).from(clients),
    db.select({
      status: jobs.status, total: jobs.total, paid: jobs.paid, createdOn: jobs.createdOn,
      scheduledOn: jobs.scheduledOn, completedOn: jobs.completedOn, matchedLeadId: jobs.matchedLeadId,
    }).from(jobs).where(jobScope.length ? and(...jobScope) : undefined),
  ]);

  const metricLeads: MetricLead[] = leadRows.map((l) => ({
    source: l.source,
    status: l.status,
    // Real job revenue when the lead matched jobs, otherwise the value typed on the lead.
    value: l.jobRevenue ?? l.value,
    date: toDateString(new Date(l.occurredAt)),
  }));
  const metricSpend: MetricSpend[] = spendRows;

  const clientById = new Map(clientRows.map((c) => [c.id, c]));
  // Entries that touch the selected range, for the spend list.
  const entries = spendRows
    .filter((r) => r.periodEnd >= range.start && r.periodStart <= range.end)
    .map((r) => ({
      id: r.id,
      clientName: clientById.get(r.clientId)?.name ?? "Unknown client",
      clientColor: clientById.get(r.clientId)?.color ?? "#94a3b8",
      channel: r.channel,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      campaign: r.campaign,
      amount: r.amount,
      clicks: r.clicks,
      provider: r.provider,
      notes: r.notes,
    }));

  return {
    today,
    results: computeResults({ leads: metricLeads, spend: metricSpend, range }),
    trend: monthlyTrend({ leads: metricLeads, spend: metricSpend, months: 6, today }),
    // Job revenue by job date (all jobs, matched to a lead or not). Null when no jobs are imported.
    jobs: jobRows.length ? jobStats(jobRows.map((j) => ({ ...j, matched: j.matchedLeadId !== null })), range) : null,
    entries,
    hasAnySpend: spendRows.length > 0,
  };
}

export type ResultsData = Awaited<ReturnType<typeof getResultsData>>;
export type SpendEntry = ResultsData["entries"][number];
