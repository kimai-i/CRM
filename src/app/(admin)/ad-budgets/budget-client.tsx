"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { BudgetRow } from "@/lib/budget-queries";
import type { Lookups } from "@/lib/queries";
import { SPEND_CHANNEL_LABEL } from "@/lib/metrics";
import { timeAgo } from "@/lib/labels";
import { deleteBudget, saveBudget, type BudgetState } from "./actions";
import { ActionForm } from "@/components/action-form";

const money = (n: number | null) => (n === null ? "—" : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);

export function BudgetTable({ rows, clients, today }: { rows: BudgetRow[]; clients: Lookups["clients"]; today: string }) {
  const [editing, setEditing] = useState<BudgetRow | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const total = rows.reduce((s, r) => s + (r.monthlyBudget ?? 0), 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Authorized budgets ({rows.length})</h2>
        <button type="button" onClick={() => setEditing("new")} className="btn-primary"><Plus className="h-4 w-4" /> Add budget</button>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">No budgets yet. Add what each client has authorized you to spend per channel.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-2 py-2 font-medium">Channel</th>
                <th className="px-2 py-2 text-right font-medium">Monthly</th>
                <th className="px-2 py-2 text-right font-medium">Daily</th>
                <th className="px-2 py-2 font-medium">Notes</th>
                <th className="px-2 py-2 font-medium">Last updated</th>
                <th className="px-2 py-2 font-medium">Review by</th>
                <th className="w-20 px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const reviewOverdue = r.reviewDueOn !== null && r.reviewDueOn < today;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2 font-medium text-slate-800">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.clientColor }} />
                        {r.clientName}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{SPEND_CHANNEL_LABEL[r.channel]}</td>
                    <td className="px-2 py-2 text-right font-medium text-slate-900">{money(r.monthlyBudget)}</td>
                    <td className="px-2 py-2 text-right text-slate-700">{money(r.dailyBudget)}</td>
                    <td className="max-w-[220px] truncate px-2 py-2 text-xs text-slate-500" title={r.notes ?? undefined}>{r.notes ?? "—"}</td>
                    <td className="px-2 py-2 text-xs text-slate-500">{timeAgo(r.updatedAt)}{r.updatedBy ? ` by ${r.updatedBy}` : ""}</td>
                    <td className={`px-2 py-2 text-xs ${reviewOverdue ? "font-medium text-red-600" : "text-slate-500"}`}>
                      {r.reviewDueOn ? `${reviewOverdue ? "Review overdue · " : ""}${r.reviewDueOn}` : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => setEditing(r)} className="btn-ghost p-1" aria-label="Edit budget"><Pencil className="h-4 w-4" /></button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm(`Remove the ${SPEND_CHANNEL_LABEL[r.channel]} budget for ${r.clientName}?`)) startTransition(() => deleteBudget(r.id));
                          }}
                          className="btn-ghost p-1 text-red-600 hover:bg-red-50"
                          aria-label="Delete budget"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/60">
                <td colSpan={2} className="px-4 py-2 font-semibold text-slate-700">Total authorized per month</td>
                <td className="px-2 py-2 text-right font-semibold text-slate-900">{money(total)}</td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {editing && <BudgetDialog budget={editing === "new" ? null : editing} clients={clients} onClose={() => setEditing(null)} />}
    </section>
  );
}

function BudgetDialog({ budget, clients, onClose }: { budget: BudgetRow | null; clients: Lookups["clients"]; onClose: () => void }) {
  const [state, action, pending] = useActionState<BudgetState, FormData>(saveBudget, {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-[10vh]" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{budget ? "Edit budget" : "Add budget"}</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <ActionForm action={action} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">Client</span>
              <select name="clientId" required defaultValue={budget?.clientId ?? ""} className="input mt-1">
                <option value="" disabled>Choose a client…</option>
                {clients.filter((c) => !c.isInternal && (c.lifecycle !== "churned" || c.id === budget?.clientId)).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Channel</span>
              <select name="channel" defaultValue={budget?.channel ?? "google_ads"} className="input mt-1">
                {Object.entries(SPEND_CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Monthly budget</span>
              <input name="monthlyBudget" inputMode="decimal" defaultValue={budget?.monthlyBudget ?? ""} placeholder="$0" className="input mt-1" />
            </label>
            <label>
              <span className="label">Daily budget</span>
              <input name="dailyBudget" inputMode="decimal" defaultValue={budget?.dailyBudget ?? ""} placeholder="Optional" className="input mt-1" />
            </label>
            <label className="sm:col-span-2">
              <span className="label">Notes (the client can see these)</span>
              <input name="notes" maxLength={1000} defaultValue={budget?.notes ?? ""} placeholder="e.g. Paused on weekends" className="input mt-1" />
            </label>
            <label>
              <span className="label">Review by</span>
              <input name="reviewDueOn" type="date" defaultValue={budget?.reviewDueOn ?? ""} className="input mt-1" />
            </label>
          </div>
          <p className="text-xs text-slate-500">Each client has one budget per channel — saving the same client and channel again updates it.</p>
          {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save budget"}</button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
