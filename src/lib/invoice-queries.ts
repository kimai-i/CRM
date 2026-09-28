import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import type { InvoiceView } from "@/lib/invoices";

/** Next invoice number like INV-1001, based on the highest existing INV- number. */
export async function nextInvoiceNumber(): Promise<string> {
  const rows = await db.select({ number: invoices.number }).from(invoices);
  const max = rows.reduce((m, r) => Math.max(m, Number(/^INV-(\d+)$/.exec(r.number)?.[1] ?? 0)), 1000);
  return `INV-${max + 1}`;
}

export async function getClientInvoices(clientId: string): Promise<InvoiceView[]> {
  return db
    .select({
      id: invoices.id, number: invoices.number, description: invoices.description, amount: invoices.amount, issuedOn: invoices.issuedOn,
      dueOn: invoices.dueOn, status: invoices.status, paidOn: invoices.paidOn, paymentUrl: invoices.paymentUrl,
    })
    .from(invoices)
    .where(eq(invoices.clientId, clientId))
    .orderBy(asc(invoices.issuedOn));
}
