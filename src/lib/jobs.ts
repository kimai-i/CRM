// Pure helpers for jobs: CSV import, job → lead matching, and job revenue stats.
import type { JobStatus } from "@/db/schema";
import { addDays, toDateString } from "@/lib/dates";
import { contactKeyFor, normalizeEmail, normalizePhone, parseDateLoose, parseMoney } from "@/lib/leads";

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  estimate: "Estimate",
  scheduled: "Scheduled",
  completed: "Completed",
  canceled: "Canceled",
};

/** Jobs that count as won work (revenue). Estimates and canceled jobs don't. */
export const isWonJob = (status: JobStatus) => status === "scheduled" || status === "completed";

/** How far back a lead can be and still get credit for a job. */
export const MATCH_WINDOW_DAYS = 180;

// ---------- CSV import ----------

export const JOB_FIELDS = [
  { key: "createdOn", label: "Job date / created", required: true, hints: ["job created date", "created date", "created", "date", "job date", "invoice date"] },
  { key: "total", label: "Job total ($)", required: true, hints: ["total amount", "job total", "invoice total", "total", "amount", "revenue", "price"] },
  { key: "externalId", label: "Job / invoice #", hints: ["job #", "job number", "invoice #", "invoice number", "job id", "id", "number"] },
  { key: "customerName", label: "Customer name", hints: ["customer name", "customer", "client name", "name"] },
  { key: "phone", label: "Phone", hints: ["mobile number", "phone", "mobile", "cell", "home number"] },
  { key: "email", label: "Email", hints: ["email", "e-mail"] },
  { key: "zip", label: "ZIP code", hints: ["zip", "postal"] },
  { key: "status", label: "Status", hints: ["job status", "status", "stage", "work status"] },
  { key: "scheduledOn", label: "Scheduled date", hints: ["scheduled start", "scheduled", "appointment", "start date"] },
  { key: "completedOn", label: "Completed date", hints: ["completed date", "completed", "finished", "closed date"] },
  { key: "paid", label: "Amount paid", hints: ["amount paid", "paid", "payments", "collected"] },
  { key: "outstanding", label: "Balance due", hints: ["outstanding balance", "outstanding", "balance due", "balance", "amount due"] },
  { key: "leadSource", label: "Lead source", hints: ["lead source", "source", "marketing source", "referral source"] },
  { key: "description", label: "Description", hints: ["description", "job type", "service", "line items", "notes"] },
] as const;

export type JobFieldKey = (typeof JOB_FIELDS)[number]["key"];
export type JobMapping = Partial<Record<JobFieldKey, number>>;
export type JobImportRow = Partial<Record<JobFieldKey, string>>;

export function guessJobMapping(headers: string[]): JobMapping {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const used = new Set<number>();
  const mapping: JobMapping = {};
  // Exact matches first across all fields, so e.g. "Total amount" isn't taken by a looser hint.
  for (const pass of ["exact", "contains"] as const) {
    for (const field of JOB_FIELDS) {
      if (mapping[field.key] !== undefined) continue;
      const index = norm.findIndex((h, i) =>
        !used.has(i) && (pass === "exact" ? (field.hints as readonly string[]).includes(h) : field.hints.some((hint) => h.includes(hint))),
      );
      if (index !== -1) {
        mapping[field.key] = index;
        used.add(index);
      }
    }
  }
  return mapping;
}

export function guessJobStatus(raw: string | undefined, dates: { scheduledOn: string | null; completedOn: string | null }): JobStatus {
  const v = raw?.trim().toLowerCase() ?? "";
  if (/cancel|void|lost|declin|no.?show/.test(v)) return "canceled";
  if (/estimate|quote|proposal|bid|pending approval/.test(v)) return "estimate";
  if (/complete|done|finish|paid|invoic|closed/.test(v)) return "completed";
  if (/schedul|dispatch|progress|en route|booked|unscheduled|open|active/.test(v)) return "scheduled";
  if (dates.completedOn) return "completed";
  return "scheduled";
}

const dateOnly = (raw: string | undefined) => {
  const iso = parseDateLoose(raw);
  return iso ? toDateString(new Date(iso)) : null;
};
const clean = (v: string | undefined, max: number) => {
  const t = v?.trim();
  return t ? t.slice(0, max) : null;
};

export type NormalizedJob = {
  externalId: string | null;
  customerName: string | null;
  phone: string | null;
  email: string | null;
  zip: string | null;
  contactKey: string | null;
  description: string | null;
  status: JobStatus;
  createdOn: string;
  scheduledOn: string | null;
  completedOn: string | null;
  total: number;
  paid: number | null;
  leadSource: string | null;
};

export function normalizeJobRow(row: JobImportRow): { job?: NormalizedJob; error?: string } {
  const createdOn = dateOnly(row.createdOn);
  if (!createdOn) return { error: row.createdOn ? `Not a date: "${row.createdOn}"` : "No job date (a totals or blank row)" };
  const total = parseMoney(row.total);
  if (total === null) return { error: row.total ? `Not an amount: "${row.total}"` : "No job total" };
  if (total < 0) return { error: "Negative job total (a refund?) — skipped" };

  const scheduledOn = dateOnly(row.scheduledOn);
  const completedOn = dateOnly(row.completedOn);
  const phone = normalizePhone(row.phone);
  const email = normalizeEmail(row.email);

  // Amount paid: use the paid column, or work it out from the balance due.
  const paidRaw = parseMoney(row.paid);
  const outstanding = parseMoney(row.outstanding);
  const paid = paidRaw ?? (outstanding !== null ? Math.max(0, total - outstanding) : null);

  return {
    job: {
      externalId: clean(row.externalId, 100),
      customerName: clean(row.customerName, 200),
      phone,
      email,
      zip: clean(row.zip, 20)?.slice(0, 5) ?? null,
      contactKey: contactKeyFor(phone, email),
      description: clean(row.description, 1000),
      status: guessJobStatus(row.status, { scheduledOn, completedOn }),
      createdOn,
      scheduledOn,
      completedOn,
      total,
      paid,
      leadSource: clean(row.leadSource, 200),
    },
  };
}

// ---------- Matching ----------

export type MatchJob = {
  id: string;
  phone: string | null;
  email: string | null;
  customerName: string | null;
  zip: string | null;
  createdOn: string;
};
export type MatchLead = {
  id: string;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  zip: string | null;
  date: string; // local date the lead came in
};
export type MatchResult = { leadId: string; matchedBy: "phone" | "email" | "name_zip" };

const normalizeName = (n: string | null) => n?.toLowerCase().replace(/[^a-z]/g, "") || null;

/**
 * Credits each job to the earliest lead from the same person that arrived within
 * MATCH_WINDOW_DAYS before the job (phone first, then email, then name + ZIP).
 */
export function matchJobsToLeads(jobs: MatchJob[], leads: MatchLead[]): Map<string, MatchResult> {
  const sorted = [...leads].sort((a, b) => a.date.localeCompare(b.date));
  const result = new Map<string, MatchResult>();

  for (const job of jobs) {
    const earliest = addDays(job.createdOn, -MATCH_WINDOW_DAYS);
    const candidates = sorted.filter((l) => l.date <= job.createdOn && l.date >= earliest);
    const phone = normalizePhone(job.phone);
    const email = normalizeEmail(job.email);
    const name = normalizeName(job.customerName);

    const byPhone = phone ? candidates.find((l) => normalizePhone(l.phone) === phone) : undefined;
    if (byPhone) { result.set(job.id, { leadId: byPhone.id, matchedBy: "phone" }); continue; }
    const byEmail = email ? candidates.find((l) => normalizeEmail(l.email) === email) : undefined;
    if (byEmail) { result.set(job.id, { leadId: byEmail.id, matchedBy: "email" }); continue; }
    const byName = name && job.zip ? candidates.find((l) => normalizeName(l.contactName) === name && l.zip === job.zip) : undefined;
    if (byName) result.set(job.id, { leadId: byName.id, matchedBy: "name_zip" });
  }
  return result;
}

// ---------- Stats ----------

export type StatJob = { status: JobStatus; total: number; paid: number | null; createdOn: string; completedOn: string | null; scheduledOn: string | null; matched: boolean };

/** The date a job's revenue counts on: completed, else scheduled, else created. */
export const revenueDate = (j: Pick<StatJob, "completedOn" | "scheduledOn" | "createdOn">) => j.completedOn ?? j.scheduledOn ?? j.createdOn;

export function jobStats(jobs: StatJob[], range: { start: string; end: string }) {
  const won = jobs.filter((j) => isWonJob(j.status) && revenueDate(j) >= range.start && revenueDate(j) <= range.end);
  const revenue = won.reduce((s, j) => s + j.total, 0);
  const matched = won.filter((j) => j.matched);
  const matchedRevenue = matched.reduce((s, j) => s + j.total, 0);
  const estimates = jobs.filter((j) => j.status === "estimate" && j.createdOn >= range.start && j.createdOn <= range.end);
  // Balance due is across all won jobs, not just this period — money is owed until it's paid.
  const outstanding = jobs
    .filter((j) => isWonJob(j.status) && j.paid !== null)
    .reduce((s, j) => s + Math.max(0, j.total - (j.paid ?? 0)), 0);
  return {
    jobs: won.length,
    revenue,
    avgTicket: won.length ? revenue / won.length : null,
    matchedJobs: matched.length,
    matchRate: won.length ? matched.length / won.length : null,
    matchedRevenue,
    unmatchedRevenue: revenue - matchedRevenue,
    openEstimates: estimates.length,
    estimateValue: estimates.reduce((s, j) => s + j.total, 0),
    outstanding,
  };
}
