"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clients, jobs } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { normalizeJobRow, type JobImportRow } from "@/lib/jobs";
import { rematchClient } from "@/lib/job-matching";

export type JobImportResult = { added: number; updated: number; duplicates: number; errors: { row: number; message: string }[] };
const MAX_ROWS_PER_CALL = 500;

/**
 * Imports one batch of mapped rows. Jobs with a job/invoice number are updated on re-import;
 * jobs without one are skipped if the same customer, date and total is already there.
 */
export async function importJobBatch(input: { clientId: string; rows: JobImportRow[]; firstRowNumber: number; isLastBatch: boolean }): Promise<JobImportResult> {
  await requireStaff();
  const result: JobImportResult = { added: 0, updated: 0, duplicates: 0, errors: [] };
  if (input.rows.length > MAX_ROWS_PER_CALL) return { ...result, errors: [{ row: 0, message: "Too many rows in one batch." }] };
  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, input.clientId));
  if (!client) return { ...result, errors: [{ row: 0, message: "That client no longer exists." }] };

  const existingNoId = await db
    .select({ contactKey: jobs.contactKey, createdOn: jobs.createdOn, total: jobs.total, customerName: jobs.customerName })
    .from(jobs)
    .where(and(eq(jobs.clientId, input.clientId), isNull(jobs.externalId)));
  const noIdKey = (j: { contactKey: string | null; customerName: string | null; createdOn: string; total: number }) =>
    `${j.contactKey ?? j.customerName?.toLowerCase() ?? ""}|${j.createdOn}|${j.total}`;
  const seen = new Set(existingNoId.map(noIdKey));
  const now = new Date().toISOString();

  for (const [i, row] of input.rows.entries()) {
    const { job, error } = normalizeJobRow(row);
    if (!job) {
      result.errors.push({ row: input.firstRowNumber + i, message: error ?? "Couldn't read this row" });
      continue;
    }
    if (job.externalId) {
      const [saved] = await db
        .insert(jobs)
        .values({ id: randomUUID(), clientId: input.clientId, ...job, provider: "csv", createdAt: now })
        .onConflictDoUpdate({
          target: [jobs.clientId, jobs.externalId],
          set: {
            customerName: job.customerName, phone: job.phone, email: job.email, zip: job.zip, contactKey: job.contactKey,
            description: job.description, status: job.status, createdOn: job.createdOn, scheduledOn: job.scheduledOn,
            completedOn: job.completedOn, total: job.total, paid: job.paid, leadSource: job.leadSource,
          },
        })
        // createdAt is only written on insert, so it equals `now` only for new rows.
        .returning({ createdAt: jobs.createdAt });
      if (saved?.createdAt === now) result.added++;
      else result.updated++;
      continue;
    }
    const key = noIdKey(job);
    if (seen.has(key)) {
      result.duplicates++;
      continue;
    }
    seen.add(key);
    await db.insert(jobs).values({ id: randomUUID(), clientId: input.clientId, ...job, provider: "csv", createdAt: now });
    result.added++;
  }

  // Matching only needs to run once the whole file is in.
  if (input.isLastBatch) await rematchClient(input.clientId);
  refresh();
  return result;
}

export async function deleteJob(id: string) {
  await requireStaff();
  const [job] = await db.select({ clientId: jobs.clientId }).from(jobs).where(eq(jobs.id, id));
  if (!job) return;
  await db.delete(jobs).where(eq(jobs.id, id));
  await rematchClient(job.clientId);
  refresh();
}

export async function rerunMatching(clientId: string | null) {
  await requireStaff();
  const ids = clientId ? [clientId] : (await db.select({ clientId: jobs.clientId }).from(jobs).groupBy(jobs.clientId)).map((r) => r.clientId);
  for (const id of ids) await rematchClient(id);
  refresh();
}
