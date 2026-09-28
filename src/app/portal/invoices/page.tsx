import type { Metadata } from "next";
import type { ReactNode } from "react";
import { and, desc, eq, ne } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { requireClientUser } from "@/lib/auth";
import { toDateString } from "@/lib/dates";
import { invoiceDueText, invoiceTotals, isOverdue } from "@/lib/invoices";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Invoices" };

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function PortalInvoicesPage() {
  const viewer = await requireClientUser();
  const today = toDateString(new Date());
  // Drafts stay internal until they're issued.
  const rows = await db.select().from(invoices).where(and(eq(invoices.clientId, viewer.clientId), ne(invoices.status, "draft"))).orderBy(desc(invoices.issuedOn));
  const open = rows.filter((i) => i.status === "open");
  const paid = rows.filter((i) => i.status === "paid");
  const t = invoiceTotals(rows, today);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
        <p className="mt-1 text-sm text-slate-500">See what you owe and your payment history.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState>No invoices yet.</EmptyState>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-sm text-slate-500">Total due</div>
            <div className="mt-1 text-3xl font-semibold text-slate-900">{money(t.due)}</div>
            <div className="mt-1 text-sm text-slate-500">
              {t.openCount} open{t.overdueCount > 0 && <span className="text-red-600"> · {t.overdueCount} overdue</span>}
            </div>
          </div>
          <Section title={`Open · ${open.length}`}>
            {open.length === 0 ? <p className="px-4 py-4 text-sm text-slate-500">You&apos;re all paid up.</p> : open.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900">{i.number}</div>
                  <div className={`text-xs ${isOverdue(i, today) ? "font-medium text-red-600" : "text-slate-500"}`}>{invoiceDueText(i, today)}{i.description ? ` · ${i.description}` : ""}</div>
                </div>
                <span className="font-semibold text-slate-900">{money(i.amount)}</span>
                {i.paymentUrl && (
                  <a href={i.paymentUrl} target="_blank" rel="noreferrer" className="btn-primary py-1.5">Pay invoice <ExternalLink className="h-3.5 w-3.5" /></a>
                )}
              </li>
            ))}
          </Section>
          {paid.length > 0 && (
            <Section title={`Paid · ${paid.length}`}>
              {paid.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-700">{i.number}</div>
                    <div className="text-xs text-slate-500">{invoiceDueText(i, today)}</div>
                  </div>
                  <span className="text-slate-700">{money(i.amount)}</span>
                </li>
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </section>
  );
}
