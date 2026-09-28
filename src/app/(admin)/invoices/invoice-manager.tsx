"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { invoiceDueText, invoiceTotals, isOverdue, type InvoiceView } from "@/lib/invoices";
import { deleteInvoice, markInvoicePaid, saveInvoice, type InvoiceState } from "./actions";
import { ActionForm } from "@/components/action-form";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STATUS_STYLE = { draft: "bg-slate-100 text-slate-600", open: "bg-blue-100 text-blue-700", paid: "bg-green-100 text-green-700", void: "bg-slate-100 text-slate-400" } as const;

export function InvoiceManager({ clientId, invoices, today, nextNumber }: { clientId: string; invoices: InvoiceView[]; today: string; nextNumber: string }) {
  const [editing, setEditing] = useState<InvoiceView | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const t = invoiceTotals(invoices, today);

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          <strong>{money(t.due)}</strong> due across {t.openCount} open invoice{t.openCount === 1 ? "" : "s"}
          {t.overdueCount > 0 && <span className="text-red-600"> · {t.overdueCount} overdue</span>}
        </p>
        <button type="button" onClick={() => setEditing("new")} className="btn-primary"><Plus className="h-4 w-4" /> New invoice</button>
      </div>
      {invoices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No invoices yet. Record invoices here so the client can see what they owe in their portal. Paste a payment link from your billing tool if you have one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">Invoice</th>
                <th className="px-2 py-2 font-medium">Issued</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Due</th>
                <th className="px-2 py-2 text-right font-medium">Amount</th>
                <th className="w-40 px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-900">{i.number}</div>
                    {i.description && <div className="max-w-[260px] truncate text-xs text-slate-500">{i.description}</div>}
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-600">{i.issuedOn}</td>
                  <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLE[i.status]}`}>{i.status}</span></td>
                  <td className={`px-2 py-2 text-xs ${isOverdue(i, today) ? "font-medium text-red-600" : "text-slate-600"}`}>{invoiceDueText(i, today)}</td>
                  <td className="px-2 py-2 text-right font-medium text-slate-900">{money(i.amount)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {i.status === "open" && (
                        <button type="button" disabled={pending} onClick={() => startTransition(() => markInvoicePaid(i.id))} className="btn-ghost px-2 py-1 text-xs text-green-700">Mark paid</button>
                      )}
                      {i.paymentUrl && <a href={i.paymentUrl} target="_blank" rel="noreferrer" className="btn-ghost p-1" aria-label="Payment link"><ExternalLink className="h-4 w-4" /></a>}
                      <button type="button" onClick={() => setEditing(i)} className="btn-ghost p-1" aria-label="Edit invoice"><Pencil className="h-4 w-4" /></button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm(`Delete invoice ${i.number}?`)) startTransition(() => deleteInvoice(i.id));
                        }}
                        className="btn-ghost p-1 text-red-600 hover:bg-red-50"
                        aria-label="Delete invoice"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <InvoiceDialog clientId={clientId} invoice={editing === "new" ? null : editing} nextNumber={nextNumber} today={today} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function InvoiceDialog({ clientId, invoice, nextNumber, today, onClose }: { clientId: string; invoice: InvoiceView | null; nextNumber: string; today: string; onClose: () => void }) {
  const [state, action, pending] = useActionState<InvoiceState, FormData>(saveInvoice.bind(null, clientId, invoice?.id ?? null), {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{invoice ? `Edit ${invoice.number}` : "New invoice"}</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <ActionForm action={action} className="grid gap-4 p-5 sm:grid-cols-2">
          <label>
            <span className="label">Number</span>
            <input name="number" required maxLength={50} defaultValue={invoice?.number ?? nextNumber} className="input mt-1" />
          </label>
          <label>
            <span className="label">Amount</span>
            <input name="amount" required inputMode="decimal" defaultValue={invoice?.amount ?? ""} placeholder="$0.00" className="input mt-1" />
          </label>
          <label className="sm:col-span-2">
            <span className="label">Description</span>
            <input name="description" maxLength={2000} defaultValue={invoice?.description ?? ""} placeholder="e.g. October retainer" className="input mt-1" />
          </label>
          <label>
            <span className="label">Issued</span>
            <input name="issuedOn" type="date" required defaultValue={invoice?.issuedOn ?? today} className="input mt-1" />
          </label>
          <label>
            <span className="label">Due</span>
            <input name="dueOn" type="date" defaultValue={invoice?.dueOn ?? ""} className="input mt-1" />
          </label>
          <label>
            <span className="label">Status</span>
            <select name="status" defaultValue={invoice?.status ?? "open"} className="input mt-1">
              <option value="draft">Draft (client can&apos;t see it)</option>
              <option value="open">Open</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
          </label>
          <label>
            <span className="label">Paid on</span>
            <input name="paidOn" type="date" defaultValue={invoice?.paidOn ?? ""} className="input mt-1" />
          </label>
          <label className="sm:col-span-2">
            <span className="label">Payment link (optional)</span>
            <input name="paymentUrl" type="url" maxLength={1000} defaultValue={invoice?.paymentUrl ?? ""} placeholder="https:// — from your billing tool" className="input mt-1" />
          </label>
          {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{state.error}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save invoice"}</button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
