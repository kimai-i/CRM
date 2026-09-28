"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, leads, LEAD_SOURCES, LEAD_STATUSES, LEAD_TYPES, type LeadStatus, type LeadType } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { rematchClient } from "@/lib/job-matching";
import {
  contactKeyFor,
  normalizeEmail,
  normalizeImportRow,
  normalizePhone,
  parseDateLoose,
  parseDuration,
  parseMoney,
  type ImportRow,
} from "@/lib/leads";

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());

const leadSchema = z.object({
  clientId: z.string().min(1, "Pick a client."),
  occurredAt: z.string().min(1, "Enter when the lead came in."),
  type: z.enum(LEAD_TYPES),
  source: z.enum(LEAD_SOURCES),
  status: z.enum(LEAD_STATUSES),
  contactName: optionalText(200),
  phone: optionalText(50),
  email: optionalText(200),
  zip: optionalText(20),
  address: optionalText(300),
  summary: optionalText(5000),
  duration: optionalText(20),
  value: optionalText(30),
});

export type LeadFormState = { ok?: boolean; error?: string };

function parseLeadForm(formData: FormData) {
  const parsed = leadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const d = parsed.data;

  const occurredAt = parseDateLoose(d.occurredAt);
  if (!occurredAt) return { error: "That date and time doesn't look right." } as const;
  if (d.email && !normalizeEmail(d.email)) return { error: "That email doesn't look right." } as const;
  if (!d.contactName && !d.phone && !d.email) return { error: "Add at least a name, phone or email." } as const;

  const phone = normalizePhone(d.phone);
  const email = normalizeEmail(d.email);
  return {
    values: {
      clientId: d.clientId,
      occurredAt,
      type: d.type,
      source: d.source,
      status: d.status,
      contactName: d.contactName,
      phone,
      email,
      contactKey: contactKeyFor(phone, email),
      zip: d.zip,
      address: d.address,
      summary: d.summary,
      durationSec: parseDuration(d.duration),
      value: parseMoney(d.value),
    },
  } as const;
}

export async function createLead(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const user = await requireStaff();
  const result = parseLeadForm(formData);
  if ("error" in result) return { error: result.error };

  await db.insert(leads).values({
    id: randomUUID(),
    ...result.values,
    provider: "manual",
    createdById: user.id,
    createdAt: new Date().toISOString(),
  });
  await rematchClient(result.values.clientId);
  refresh();
  return { ok: true };
}

export async function updateLead(id: string, _prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  await requireStaff();
  const result = parseLeadForm(formData);
  if ("error" in result) return { error: result.error };

  const [before] = await db.select({ clientId: leads.clientId }).from(leads).where(eq(leads.id, id));
  await db.update(leads).set(result.values).where(eq(leads.id, id));
  await rematchClient(result.values.clientId);
  if (before && before.clientId !== result.values.clientId) await rematchClient(before.clientId);
  refresh();
  return { ok: true };
}

export async function setLeadStatus(id: string, status: LeadStatus) {
  await requireStaff();
  if (!LEAD_STATUSES.includes(status)) return;
  await db.update(leads).set({ status }).where(eq(leads.id, id));
  refresh();
}

export async function deleteLead(id: string) {
  await requireStaff();
  const [lead] = await db.select({ clientId: leads.clientId }).from(leads).where(eq(leads.id, id));
  await db.delete(leads).where(eq(leads.id, id));
  if (lead) await rematchClient(lead.clientId);
  redirect("/leads");
}

export type ImportResult = {
  imported: number;
  duplicates: number;
  errors: { row: number; message: string }[];
};

const MAX_ROWS_PER_CALL = 500;

/**
 * Imports one batch of already-mapped CSV rows. The browser sends batches so large files
 * stay under the request size limit. Every row is re-validated here.
 */
export async function importLeadBatch(input: {
  clientId: string;
  defaultType: LeadType;
  rows: ImportRow[];
  firstRowNumber: number;
}): Promise<ImportResult> {
  const user = await requireStaff();
  const result: ImportResult = { imported: 0, duplicates: 0, errors: [] };

  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, input.clientId));
  if (!client) return { ...result, errors: [{ row: 0, message: "That client no longer exists." }] };
  if (!LEAD_TYPES.includes(input.defaultType)) return { ...result, errors: [{ row: 0, message: "Unknown lead type." }] };
  if (input.rows.length > MAX_ROWS_PER_CALL) {
    return { ...result, errors: [{ row: 0, message: `Send at most ${MAX_ROWS_PER_CALL} rows at a time.` }] };
  }

  // Existing leads for this client, to skip duplicates:
  // same record ID, or same contact at the same minute.
  const existing = await db
    .select({ externalId: leads.externalId, contactKey: leads.contactKey, occurredAt: leads.occurredAt })
    .from(leads)
    .where(eq(leads.clientId, input.clientId));
  const seenIds = new Set(existing.map((l) => l.externalId).filter(Boolean));
  const minuteKey = (contactKey: string | null, iso: string) => `${contactKey}|${iso.slice(0, 16)}`;
  const seenContacts = new Set(existing.filter((l) => l.contactKey).map((l) => minuteKey(l.contactKey, l.occurredAt)));

  const now = new Date().toISOString();
  const toInsert: (typeof leads.$inferInsert)[] = [];

  input.rows.forEach((row, i) => {
    const rowNumber = input.firstRowNumber + i;
    const { lead, error } = normalizeImportRow(row, input.defaultType);
    if (!lead) {
      result.errors.push({ row: rowNumber, message: error ?? "Couldn't read this row" });
      return;
    }
    const key = lead.contactKey ? minuteKey(lead.contactKey, lead.occurredAt) : null;
    if ((lead.externalId && seenIds.has(lead.externalId)) || (key && seenContacts.has(key))) {
      result.duplicates++;
      return;
    }
    if (lead.externalId) seenIds.add(lead.externalId);
    if (key) seenContacts.add(key);
    toInsert.push({
      id: randomUUID(),
      clientId: input.clientId,
      ...lead,
      provider: "csv",
      createdById: user.id,
      createdAt: now,
    });
  });

  if (toInsert.length) {
    await db.insert(leads).values(toInsert);
    await rematchClient(input.clientId);
  }
  result.imported = toInsert.length;
  return result;
}
