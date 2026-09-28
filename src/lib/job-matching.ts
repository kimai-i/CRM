// Saves job → lead matches for one client. Safe to run any time; it recomputes from scratch.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, leads } from "@/db/schema";
import { toDateString } from "@/lib/dates";
import { isWonJob, matchJobsToLeads } from "@/lib/jobs";

export async function rematchClient(clientId: string): Promise<{ matched: number; jobs: number }> {
  const [jobRows, leadRows] = await Promise.all([
    db.select().from(jobs).where(eq(jobs.clientId, clientId)),
    db.select({
      id: leads.id, phone: leads.phone, email: leads.email, contactName: leads.contactName, zip: leads.zip,
      occurredAt: leads.occurredAt, status: leads.status, jobRevenue: leads.jobRevenue,
    }).from(leads).where(eq(leads.clientId, clientId)),
  ]);

  const matches = matchJobsToLeads(
    jobRows.map((j) => ({ id: j.id, phone: j.phone, email: j.email, customerName: j.customerName, zip: j.zip, createdOn: j.createdOn })),
    leadRows.map((l) => ({ id: l.id, phone: l.phone, email: l.email, contactName: l.contactName, zip: l.zip, date: toDateString(new Date(l.occurredAt)) })),
  );

  // Revenue per lead from its matched won jobs.
  const revenueByLead = new Map<string, number>();
  for (const j of jobRows) {
    const m = matches.get(j.id);
    if (m && isWonJob(j.status)) revenueByLead.set(m.leadId, (revenueByLead.get(m.leadId) ?? 0) + j.total);
  }

  await db.transaction(async (tx) => {
    for (const j of jobRows) {
      const m = matches.get(j.id);
      const leadId = m?.leadId ?? null;
      const matchedBy = m?.matchedBy ?? null;
      if (j.matchedLeadId !== leadId || j.matchedBy !== matchedBy) {
        await tx.update(jobs).set({ matchedLeadId: leadId, matchedBy }).where(eq(jobs.id, j.id));
      }
    }
    for (const l of leadRows) {
      const revenue = revenueByLead.get(l.id) ?? null;
      // A lead that turned into won work is booked, whatever it was marked before.
      const status = revenue !== null && l.status !== "booked" ? "booked" : l.status;
      if (revenue !== l.jobRevenue || status !== l.status) {
        await tx.update(leads).set({ jobRevenue: revenue, status }).where(eq(leads.id, l.id));
      }
    }
  });

  return { matched: matches.size, jobs: jobRows.length };
}

