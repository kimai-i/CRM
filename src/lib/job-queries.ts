import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, jobs, leads, type JobStatus, type LeadSource } from "@/db/schema";
import { jobStats, revenueDate } from "@/lib/jobs";
import type { DateRange } from "@/lib/metrics";

export type JobRow = {
  id: string;
  clientId: string;
  clientName: string;
  clientColor: string;
  externalId: string | null;
  customerName: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  status: JobStatus;
  date: string; // revenue date: completed, else scheduled, else created
  total: number;
  paid: number | null;
  leadSource: string | null;
  matchedLead: { id: string; source: LeadSource; date: string } | null;
  matchedBy: "phone" | "email" | "name_zip" | null;
};

export async function getJobsPageData(opts: { clientId?: string; range: DateRange }) {
  const [jobRows, clientRows, leadRows] = await Promise.all([
    db.select().from(jobs).where(opts.clientId ? eq(jobs.clientId, opts.clientId) : undefined).orderBy(desc(jobs.createdOn)),
    db.select({ id: clients.id, name: clients.name, color: clients.color }).from(clients),
    db.select({ id: leads.id, source: leads.source, occurredAt: leads.occurredAt }).from(leads).where(opts.clientId ? eq(leads.clientId, opts.clientId) : undefined),
  ]);
  const clientById = new Map(clientRows.map((c) => [c.id, c]));
  const leadById = new Map(leadRows.map((l) => [l.id, l]));

  const rows: JobRow[] = jobRows
    .map((j) => {
      const lead = j.matchedLeadId ? leadById.get(j.matchedLeadId) : undefined;
      return {
        id: j.id,
        clientId: j.clientId,
        clientName: clientById.get(j.clientId)?.name ?? "Unknown client",
        clientColor: clientById.get(j.clientId)?.color ?? "#94a3b8",
        externalId: j.externalId,
        customerName: j.customerName,
        phone: j.phone,
        email: j.email,
        description: j.description,
        status: j.status,
        date: revenueDate(j),
        total: j.total,
        paid: j.paid,
        leadSource: j.leadSource,
        matchedLead: lead ? { id: lead.id, source: lead.source, date: lead.occurredAt } : null,
        matchedBy: j.matchedBy,
      };
    })
    .filter((j) => j.date >= opts.range.start && j.date <= opts.range.end)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    rows,
    stats: jobStats(jobRows.map((j) => ({ ...j, matched: j.matchedLeadId !== null })), opts.range),
    totalJobsEver: jobRows.length,
  };
}
