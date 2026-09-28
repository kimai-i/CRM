"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adSpend, clients, SPEND_CHANNELS, type SpendChannel } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { parseMoney } from "@/lib/leads";
import { normalizeSpendRow, type SpendImportRow } from "@/lib/spend-import";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
const optionalCount = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.replace(/,/g, "") : v),
  z.coerce.number().min(0).nullable(),
);

const spendSchema = z.object({
  clientId: z.string().min(1, "Pick a client."),
  channel: z.enum(SPEND_CHANNELS),
  periodStart: date,
  periodEnd: date,
  amount: z.string().min(1, "Enter the amount spent."),
  clicks: optionalCount,
  impressions: optionalCount,
  campaign: z.string().trim().max(200).default(""),
  notes: z.preprocess((v) => (v === "" ? null : v), z.string().max(2000).nullable()),
});

export type SpendFormState = { ok?: boolean; error?: string };

// On a repeat of the same client/channel/period/campaign, update the numbers instead of adding a copy.
const upsertSet = {
  amount: sql`excluded.amount`,
  clicks: sql`excluded.clicks`,
  impressions: sql`excluded.impressions`,
  conversions: sql`excluded.conversions`,
  notes: sql`coalesce(excluded.notes, ${adSpend.notes})`,
};
const upsertTarget = [adSpend.clientId, adSpend.channel, adSpend.periodStart, adSpend.periodEnd, adSpend.campaign];

export async function saveSpend(_prev: SpendFormState, formData: FormData): Promise<SpendFormState> {
  const user = await requireStaff();
  const parsed = spendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const amount = parseMoney(d.amount);
  if (amount === null || amount < 0) return { error: "Enter the amount as a number, like 1250 or $1,250.00." };
  if (d.periodEnd < d.periodStart) return { error: "The end date is before the start date." };

  await db
    .insert(adSpend)
    .values({
      id: randomUUID(),
      clientId: d.clientId,
      channel: d.channel,
      periodStart: d.periodStart,
      periodEnd: d.periodEnd,
      campaign: d.campaign,
      amount,
      clicks: d.clicks === null ? null : Math.round(d.clicks),
      impressions: d.impressions === null ? null : Math.round(d.impressions),
      notes: d.notes,
      provider: "manual",
      createdById: user.id,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({ target: upsertTarget, set: upsertSet });
  refresh();
  return { ok: true };
}

export async function deleteSpend(id: string) {
  await requireStaff();
  await db.delete(adSpend).where(eq(adSpend.id, id));
  refresh();
}

export type SpendImportResult = { saved: number; errors: { row: number; message: string }[] };
const MAX_ROWS_PER_CALL = 500;

export async function importSpendBatch(input: {
  clientId: string;
  channel: SpendChannel;
  rows: SpendImportRow[];
  firstRowNumber: number;
}): Promise<SpendImportResult> {
  const user = await requireStaff();
  const result: SpendImportResult = { saved: 0, errors: [] };
  if (!SPEND_CHANNELS.includes(input.channel)) return { ...result, errors: [{ row: 0, message: "Unknown channel." }] };
  if (input.rows.length > MAX_ROWS_PER_CALL) return { ...result, errors: [{ row: 0, message: "Too many rows in one batch." }] };
  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, input.clientId));
  if (!client) return { ...result, errors: [{ row: 0, message: "That client no longer exists." }] };

  const now = new Date().toISOString();
  const values: (typeof adSpend.$inferInsert)[] = [];
  input.rows.forEach((row, i) => {
    const { spend, error } = normalizeSpendRow(row);
    if (!spend) {
      result.errors.push({ row: input.firstRowNumber + i, message: error ?? "Couldn't read this row" });
      return;
    }
    values.push({
      id: randomUUID(),
      clientId: input.clientId,
      channel: input.channel,
      ...spend,
      provider: "csv",
      createdById: user.id,
      createdAt: now,
    });
  });

  // Rows repeating the same period + campaign within one file are merged by the upsert (last one wins).
  for (const v of values) {
    await db.insert(adSpend).values(v).onConflictDoUpdate({ target: upsertTarget, set: upsertSet });
  }
  result.saved = values.length;
  refresh();
  return result;
}
