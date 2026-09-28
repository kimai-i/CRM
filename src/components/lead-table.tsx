"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Repeat, Search } from "lucide-react";
import type { LeadRow } from "@/lib/lead-queries";
import type { LeadSource, LeadStatus } from "@/db/schema";
import {
  formatDuration,
  formatPhone,
  isRealLead,
  LEAD_SOURCE_COLOR,
  LEAD_SOURCE_LABEL,
  LEAD_STATUS_LABEL,
  LEAD_TYPE_LABEL,
} from "@/lib/leads";
import { setLeadStatus } from "@/app/(admin)/leads/actions";

const STATUS_STYLE: Record<LeadStatus, string> = {
  open: "bg-amber-100 text-amber-800",
  booked: "bg-green-100 text-green-700",
  not_a_lead: "bg-slate-100 text-slate-600",
  spam: "bg-red-100 text-red-700",
};
const PAGE_SIZES = [25, 50, 100];

/** `readOnly` is for the client portal: statuses are shown, not editable, and names don't link to the admin page. */
export function LeadTable({ rows, showClient, readOnly = false }: { rows: LeadRow[]; showClient: boolean; readOnly?: boolean }) {
  const [data, setData] = useState(rows);
  useEffect(() => {
    setData(rows);
  }, [rows]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | LeadStatus>("");
  const [source, setSource] = useState<"" | LeadSource>("");
  const [showHidden, setShowHidden] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [, startTransition] = useTransition();

  const q = search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const filtered = useMemo(
    () =>
      data.filter((r) => {
        if (!showHidden && !status && !isRealLead(r.status)) return false;
        if (status && r.status !== status) return false;
        if (source && r.source !== source) return false;
        if (!q) return true;
        return (
          r.contactName?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.summary?.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          (qDigits.length >= 3 && r.phone?.includes(qDigits))
        );
      }),
    [data, showHidden, status, source, q, qDigits],
  );
  const hiddenCount = data.filter((r) => !isRealLead(r.status)).length;

  useEffect(() => {
    setPage(0);
  }, [search, status, source, showHidden, pageSize]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  function changeStatus(id: string, next: LeadStatus) {
    setData((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));
    startTransition(() => setLeadStatus(id, next));
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, email, summary…" className="input pl-8" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus | "")} className="input w-auto py-1.5">
          <option value="">All statuses</option>
          {Object.entries(LEAD_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value as LeadSource | "")} className="input w-auto py-1.5">
          <option value="">All sources</option>
          {Object.entries(LEAD_SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {hiddenCount > 0 && !status && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Show {hiddenCount} not-a-lead / spam
          </label>
        )}
        <span className="ml-auto text-sm text-slate-500">{filtered.length} lead{filtered.length === 1 ? "" : "s"}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">No leads match these filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] table-fixed text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="w-[130px] px-4 py-2 font-medium">Date</th>
                <th className="w-[170px] px-2 py-2 font-medium">Contact</th>
                {showClient && <th className="w-[150px] px-2 py-2 font-medium">Client</th>}
                <th className="w-[80px] px-2 py-2 font-medium">Type</th>
                <th className="w-[140px] px-2 py-2 font-medium">Source</th>
                <th className="px-2 py-2 font-medium">Summary</th>
                <th className="w-[120px] px-2 py-2 font-medium">Status</th>
                <th className="w-[70px] px-2 py-2 font-medium">Length</th>
                <th className="w-[80px] px-4 py-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((r) => (
                <tr key={r.id} className={isRealLead(r.status) ? "" : "text-slate-400"}>
                  <td className="px-4 py-2.5 text-xs text-slate-600" suppressHydrationWarning>
                    {new Date(r.occurredAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </td>
                  <td className="px-2 py-2.5">
                    {readOnly ? (
                      <span className="block truncate font-medium text-slate-900">{r.contactName || formatPhone(r.phone) || r.email || "Unknown"}</span>
                    ) : (
                      <Link href={`/leads/${r.id}`} className="block truncate font-medium text-slate-900 hover:text-indigo-700">
                        {r.contactName || formatPhone(r.phone) || r.email || "Unknown"}
                      </Link>
                    )}
                    <div className="flex items-center gap-1 truncate text-xs text-slate-500">
                      {r.isRepeat && <span title="Has contacted this client before" className="flex items-center gap-0.5 text-indigo-600"><Repeat className="h-3 w-3" />Repeat</span>}
                      {r.contactName && r.phone ? formatPhone(r.phone) : r.contactName ? r.email : ""}
                    </div>
                  </td>
                  {showClient && (
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-1.5 truncate text-xs text-slate-700">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.clientColor }} />
                        {r.clientName}
                      </span>
                    </td>
                  )}
                  <td className="px-2 py-2.5 text-xs text-slate-600">{LEAD_TYPE_LABEL[r.type]}</td>
                  <td className="px-2 py-2.5">
                    <span className="inline-flex max-w-full items-center gap-1.5 truncate text-xs" title={r.sourceDetail ?? undefined}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: LEAD_SOURCE_COLOR[r.source] }} />
                      {LEAD_SOURCE_LABEL[r.source]}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <p className="line-clamp-2 text-xs text-slate-600" title={r.summary ?? undefined}>{r.summary ?? "—"}</p>
                  </td>
                  <td className="px-2 py-2.5">
                    {readOnly ? (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[r.status]}`}>{LEAD_STATUS_LABEL[r.status]}</span>
                    ) : (
                    <select
                      value={r.status}
                      onChange={(e) => changeStatus(r.id, e.target.value as LeadStatus)}
                      className={`rounded-full border-0 px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[r.status]}`}
                    >
                      {Object.entries(LEAD_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-xs text-slate-600">{formatDuration(r.durationSec) || "—"}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-medium text-slate-700">
                    {r.value ? `$${r.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-sm text-slate-600">
          <label className="flex items-center gap-2">
            Rows per page
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="input w-auto py-1">
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <span>Page {page + 1} of {pageCount}</span>
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="btn-ghost p-1 disabled:opacity-40" aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)} className="btn-ghost p-1 disabled:opacity-40" aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
