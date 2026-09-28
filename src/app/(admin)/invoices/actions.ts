"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, invoices, INVOICE_STATUSES } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { parseMoney } from "@/lib/leads";
import { toDateString } from "@/lib/dates";

export type InvoiceState = { ok?: boolean; error?: string };

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const invoiceSchema = z.object({
  number: z.string().trim().min(1, "Give the invoice a number.").max(50),
  description: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(2000).nullable()),
  amount: z.string().min(1, "Enter the amount."),
  issuedOn: date,
  dueOn: z.preprocess((v) => (v === "" ? null : v), date.nullable()),
  status: z.enum(INVOICE_STATUSES),
  paidOn: z.preprocess((v) => (v === "" ? null : v), date.nullable()),
  paymentUrl: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().url("Payment link must be a full web address.").max(1000).nullable()),
});

export async function saveInvoice(clientId: string, id: string | null, _prev: InvoiceState, formData: FormData): Promise<InvoiceState> {
  await requireStaff();
  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const amount = parseMoney(d.amount);
  if (amount === null || amount < 0) return { error: "Enter the amount as a number, like 1500." };
  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId));
  if (!client) return { error: "That client no longer exists." };

  const [clash] = await db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.number, d.number), id ? ne(invoices.id, id) : undefined));
  if (clash) return { error: `Invoice number ${d.number} is already used.` };

  const values = {
    ...d,
    amount,
    // Marking paid without a date records today; un-marking clears it.
    paidOn: d.status === "paid" ? (d.paidOn ?? toDateString(new Date())) : null,
  };
  if (id) await db.update(invoices).set(values).where(and(eq(invoices.id, id), eq(invoices.clientId, clientId)));
  else await db.insert(invoices).values({ id: randomUUID(), clientId, ...values, createdAt: new Date().toISOString() });
  refresh();
  return { ok: true };
}

export async function markInvoicePaid(id: string) {
  await requireStaff();
  await db.update(invoices).set({ status: "paid", paidOn: toDateString(new Date()) }).where(eq(invoices.id, id));
  refresh();
}

export async function deleteInvoice(id: string) {
  await requireStaff();
  await db.delete(invoices).where(eq(invoices.id, id));
  refresh();
}
