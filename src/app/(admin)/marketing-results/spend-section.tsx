"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Trash2, Upload, X } from "lucide-react";
import type { SpendEntry } from "@/lib/results-queries";
import type { Lookups } from "@/lib/queries";
import { SPEND_CHANNEL_LABEL } from "@/lib/metrics";
import { addDays, toDateString } from "@/lib/dates";
import { deleteSpend, saveSpend, type SpendFormState } from "./actions";
import { ActionForm } from "@/components/action-form";

const money2 = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function periodLabel(start: string, end: string) {
  if (start === end) return shortDate(start);
  const s = new Date(`${start}T00:00:00`);
  const lastOfMonth = toDateString(new Date(s.getFullYear(), s.getMonth() + 1, 0));
  if (start.endsWith("-01") && end === lastOfMonth) return s.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return `${shortDate(start)} – ${shortDate(end)}`;
}

export function SpendSection({
  entries,
  clients,
  clientId,
  showClient,
}: {
  entries: SpendEntry[];
  clients: Lookups["clients"];
  clientId?: string;
  showClient: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  // Many daily rows from an import would swamp the list, so show the latest 50.
  const shown = entries.slice(0, 50);

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Ad spend in this period ({entries.length})</h2>
        <div className="flex gap-2">
          <Link href={clientId ? `/marketing-results/import?client=${clientId}` : "/marketing-results/import"} className="btn-secondary">
            <Upload className="h-4 w-4" /> Import CSV
          </Link>
          <button type="button" onClick={() => setAdding(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Add spend
          </button>
        </div>
      </header>

      {entries.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No ad spend entered for this period. Add a monthly total from the Google Ads or Meta dashboard, or import a daily export.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">Period</th>
                {showClient && <th className="px-2 py-2 font-medium">Client</th>}
                <th className="px-2 py-2 font-medium">Channel</th>
                <th className="px-2 py-2 font-medium">Campaign</th>
                <th className="px-2 py-2 text-right font-medium">Amount</th>
                <th className="px-2 py-2 text-right font-medium">Clicks</th>
                <th className="px-2 py-2 font-medium">Added by</th>
                <th className="w-10 px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 text-slate-700">{periodLabel(e.periodStart, e.periodEnd)}</td>
                  {showClient && (
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-1.5 text-xs text-slate-700">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.clientColor }} />
                        {e.clientName}
                      </span>
                    </td>
                  )}
                  <td className="px-2 py-2 text-slate-700">{SPEND_CHANNEL_LABEL[e.channel]}</td>
                  <td className="max-w-[220px] truncate px-2 py-2 text-xs text-slate-500" title={e.notes ?? undefined}>{e.campaign || "—"}</td>
                  <td className="px-2 py-2 text-right font-medium text-slate-900">{money2(e.amount)}</td>
                  <td className="px-2 py-2 text-right text-slate-600">{e.clicks?.toLocaleString() ?? "—"}</td>
                  <td className="px-2 py-2 text-xs text-slate-500">{e.provider === "csv" ? "CSV import" : "By hand"}</td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm("Delete this spend entry?")) startTransition(() => deleteSpend(e.id));
                      }}
                      className="btn-ghost p-1 text-red-600 hover:bg-red-50"
                      aria-label="Delete spend entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length > shown.length && (
            <p className="px-4 py-2 text-xs text-slate-400">Showing the latest {shown.length} of {entries.length} entries. Totals above include all of them.</p>
          )}
        </div>
      )}

      {adding && <AddSpendDialog clients={clients} defaultClientId={clientId} onClose={() => setAdding(false)} />}
    </section>
  );
}

type PeriodMode = "month" | "day" | "range";

function AddSpendDialog({ clients, defaultClientId, onClose }: { clients: Lookups["clients"]; defaultClientId?: string; onClose: () => void }) {
  const [state, action, pending] = useActionState<SpendFormState, FormData>(saveSpend, {});
  const today = toDateString(new Date());
  const [mode, setMode] = useState<PeriodMode>("month");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState(today);
  const [start, setStart] = useState(addDays(today, -6));
  const [end, setEnd] = useState(today);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const [y, m] = month.split("-").map(Number);
  const period =
    mode === "month" && y && m
      ? { start: `${month}-01`, end: toDateString(new Date(y, m, 0)) }
      : mode === "day"
        ? { start: day, end: day }
        : { start, end };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">Add ad spend</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <ActionForm action={action} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">Client</span>
              <select name="clientId" required defaultValue={defaultClientId ?? ""} className="input mt-1">
                <option value="" disabled>Choose a client…</option>
                {clients.filter((c) => !c.isInternal && c.lifecycle !== "churned").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Channel</span>
              <select name="channel" defaultValue="google_ads" className="input mt-1">
                {Object.entries(SPEND_CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>

          <div>
            <span className="label">Period</span>
            <div className="mt-1 flex overflow-hidden rounded-lg border border-slate-300 text-sm">
              {(["month", "day", "range"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMode(p)}
                  className={`flex-1 px-3 py-1.5 ${mode === p ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  {p === "month" ? "Whole month" : p === "day" ? "One day" : "Date range"}
                </button>
              ))}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {mode === "month" && <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} required className="input" />}
              {mode === "day" && <input type="date" value={day} onChange={(e) => setDay(e.target.value)} required className="input" />}
              {mode === "range" && (
                <>
                  <input type="date" value={start} onChange={(e) => setStart(e.target.value)} required className="input" aria-label="Start date" />
                  <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required className="input" aria-label="End date" />
                </>
              )}
            </div>
            <input type="hidden" name="periodStart" value={period.start} />
            <input type="hidden" name="periodEnd" value={period.end} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label>
              <span className="label">Amount spent</span>
              <input name="amount" required inputMode="decimal" placeholder="$0.00" className="input mt-1" />
            </label>
            <label>
              <span className="label">Clicks</span>
              <input name="clicks" inputMode="numeric" placeholder="Optional" className="input mt-1" />
            </label>
            <label>
              <span className="label">Impressions</span>
              <input name="impressions" inputMode="numeric" placeholder="Optional" className="input mt-1" />
            </label>
          </div>
          <label className="block">
            <span className="label">Campaign (optional)</span>
            <input name="campaign" maxLength={200} className="input mt-1" />
          </label>
          <label className="block">
            <span className="label">Notes</span>
            <input name="notes" maxLength={2000} className="input mt-1" />
          </label>
          <p className="text-xs text-slate-500">Adding the same client, channel, period and campaign again replaces the earlier amount.</p>

          {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save spend"}</button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
