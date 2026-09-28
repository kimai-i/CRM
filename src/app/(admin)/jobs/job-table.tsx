"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Link2, Link2Off, RefreshCw, Search, Trash2 } from "lucide-react";
import type { JobRow } from "@/lib/job-queries";
import type { JobStatus } from "@/db/schema";
import { JOB_STATUS_LABEL } from "@/lib/jobs";
import { formatPhone, LEAD_SOURCE_LABEL } from "@/lib/leads";
import { deleteJob, rerunMatching } from "./actions";

const STATUS_STYLE: Record<JobStatus, string> = {
  estimate: "bg-slate-100 text-slate-600",
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  canceled: "bg-red-100 text-red-700",
};
const MATCH_LABEL = { phone: "phone", email: "email", name_zip: "name + ZIP" } as const;
const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const PAGE = 50;

export function JobTable({ rows, showClient, clientId }: { rows: JobRow[]; showClient: boolean; clientId?: string }) {
  const [search, setSearch] = useState("");
  const [match, setMatch] = useState<"" | "matched" | "unmatched">("");
  const [status, setStatus] = useState<"" | JobStatus>("");
  const [limit, setLimit] = useState(PAGE);
  const [pending, startTransition] = useTransition();

  const q = search.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (match === "matched" && !r.matchedLead) return false;
        if (match === "unmatched" && r.matchedLead) return false;
        if (status && r.status !== status) return false;
        if (!q) return true;
        return (
          r.customerName?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.externalId?.toLowerCase().includes(q) ||
          (digits.length >= 3 && r.phone?.includes(digits))
        );
      }),
    [rows, match, status, q, digits],
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Customer, phone, job #, description…" className="input pl-8" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as JobStatus | "")} className="input w-auto py-1.5">
          <option value="">All statuses</option>
          {Object.entries(JOB_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={match} onChange={(e) => setMatch(e.target.value as typeof match)} className="input w-auto py-1.5">
          <option value="">Matched or not</option>
          <option value="matched">Traced to a lead</option>
          <option value="unmatched">No lead found</option>
        </select>
        <span className="ml-auto text-sm text-slate-500">{filtered.length} job{filtered.length === 1 ? "" : "s"}</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => rerunMatching(clientId ?? null))}
          className="btn-ghost text-sm"
          title="Match jobs to leads again (runs automatically after every import)"
        >
          <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} /> Re-match
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">No jobs match these filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-2 py-2 font-medium">Customer</th>
                {showClient && <th className="px-2 py-2 font-medium">Client</th>}
                <th className="px-2 py-2 font-medium">Job</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 text-right font-medium">Total</th>
                <th className="px-2 py-2 text-right font-medium">Due</th>
                <th className="px-2 py-2 font-medium">Came from</th>
                <th className="w-10 px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, limit).map((r) => {
                const due = r.paid === null ? null : Math.max(0, r.total - r.paid);
                return (
                  <tr key={r.id} className={r.status === "canceled" ? "text-slate-400" : ""}>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-600">
                      {new Date(`${r.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-medium text-slate-900">{r.customerName ?? "—"}</div>
                      <div className="text-xs text-slate-500">{r.phone ? formatPhone(r.phone) : r.email}</div>
                    </td>
                    {showClient && (
                      <td className="px-2 py-2">
                        <span className="flex items-center gap-1.5 text-xs text-slate-700">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.clientColor }} />
                          {r.clientName}
                        </span>
                      </td>
                    )}
                    <td className="max-w-[240px] px-2 py-2">
                      <div className="truncate text-xs text-slate-700" title={r.description ?? undefined}>{r.description ?? "—"}</div>
                      {r.externalId && <div className="text-[11px] text-slate-400">#{r.externalId}</div>}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[r.status]}`}>{JOB_STATUS_LABEL[r.status]}</span>
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-slate-900">{money(r.total)}</td>
                    <td className={`px-2 py-2 text-right text-xs ${due ? "font-medium text-amber-700" : "text-slate-400"}`}>{due === null ? "—" : due ? money(due) : "Paid"}</td>
                    <td className="px-2 py-2 text-xs">
                      {r.matchedLead ? (
                        <Link href={`/leads/${r.matchedLead.id}`} className="flex items-center gap-1 text-indigo-700 hover:underline" title={`Matched by ${MATCH_LABEL[r.matchedBy ?? "phone"]}`}>
                          <Link2 className="h-3.5 w-3.5" /> {LEAD_SOURCE_LABEL[r.matchedLead.source]} lead
                        </Link>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-400" title={r.leadSource ? `Source in your software: ${r.leadSource}` : undefined}>
                          <Link2Off className="h-3.5 w-3.5" /> No lead{r.leadSource ? ` · "${r.leadSource}"` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm("Delete this job? Its revenue will be removed from reports.")) startTransition(() => deleteJob(r.id));
                        }}
                        className="btn-ghost p-1 text-red-600 hover:bg-red-50"
                        aria-label="Delete job"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > limit && (
            <div className="border-t border-slate-100 px-4 py-2 text-center">
              <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="btn-ghost text-sm">Show {Math.min(PAGE, filtered.length - limit)} more</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
