"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import type { ClientOverview, Lookups } from "@/lib/queries";
import { LIFECYCLE_LABEL } from "@/lib/labels";
import { setLifecycle } from "./actions";

const GROUPS = [
  { key: "onboarding", title: "Onboarding", match: (c: ClientOverview) => !c.isInternal && c.lifecycle === "onboarding" },
  { key: "active", title: "Active retainers", match: (c: ClientOverview) => !c.isInternal && c.lifecycle === "active" },
  { key: "paused", title: "Paused / on hold", match: (c: ClientOverview) => !c.isInternal && c.lifecycle === "paused" },
  { key: "internal", title: "Internal & catch-all", match: (c: ClientOverview) => c.isInternal && c.lifecycle !== "churned" },
  { key: "churned", title: "Churned", match: (c: ClientOverview) => c.lifecycle === "churned" },
] as const;

export function ClientsTable({ clients, lookups }: { clients: ClientOverview[]; lookups: Lookups }) {
  const [search, setSearch] = useState("");
  const [showChurned, setShowChurned] = useState(false);
  const [, startTransition] = useTransition();

  const serviceByKey = new Map(lookups.services.map((s) => [s.key, s]));
  const staffById = new Map(lookups.staff.map((u) => [u.id, u]));
  const churnedCount = clients.filter((c) => c.lifecycle === "churned").length;

  const q = search.trim().toLowerCase();
  const matches = clients.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || c.contactName?.toLowerCase().includes(q) || c.contactEmail?.toLowerCase().includes(q),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients…" className="input pl-8" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showChurned} onChange={(e) => setShowChurned(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Show churned ({churnedCount})
        </label>
      </div>

      {GROUPS.filter((g) => g.key !== "churned" || showChurned).map((group) => {
        const rows = matches.filter(group.match);
        if (rows.length === 0) return null;
        return (
          <section key={group.key} className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-sm font-semibold text-slate-800">
              {group.title} <span className="font-normal text-slate-400">({rows.length})</span>
            </div>
            <table className="w-full min-w-[800px] table-fixed text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="w-[26%] px-4 py-2 font-medium">Client</th>
                  <th className="w-[10%] px-2 py-2 font-medium">Owners</th>
                  <th className="w-[22%] px-2 py-2 font-medium">Services</th>
                  <th className="w-[14%] px-2 py-2 font-medium">Status</th>
                  <th className="w-[18%] px-2 py-2 font-medium">Contact</th>
                  <th className="w-[10%] px-4 py-2 text-right font-medium">Open tasks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id} style={{ backgroundColor: `${c.color}0d` }}>
                    <td className="px-4 py-2.5">
                      <Link href={`/clients/${c.id}`} className="flex items-center gap-2.5 font-medium text-slate-900 hover:text-indigo-700">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white" style={{ backgroundColor: c.color }}>
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                        {c.name}
                        {c.isInternal && <span className="rounded bg-slate-200 px-1.5 text-[10px] font-semibold uppercase text-slate-600">Internal</span>}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex -space-x-1">
                        {c.ownerIds.length === 0 && <span className="text-xs text-slate-400">—</span>}
                        {c.ownerIds.map((id) => {
                          const u = staffById.get(id);
                          if (!u) return null;
                          return (
                            <span key={id} title={u.name} className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white" style={{ backgroundColor: u.color }}>
                              {u.initials}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.serviceKeys.length === 0 && <span className="text-xs text-slate-400">—</span>}
                        {c.serviceKeys.map((k) => {
                          const s = serviceByKey.get(k);
                          if (!s) return null;
                          return (
                            <span key={k} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${s.color}1a`, color: s.color }}>
                              {s.name}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <select
                        defaultValue={c.lifecycle}
                        onChange={(e) => startTransition(() => setLifecycle(c.id, e.target.value as ClientOverview["lifecycle"]))}
                        className="input-sm"
                      >
                        {Object.entries(LIFECYCLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-slate-600">
                      {c.isInternal ? (
                        <span className="text-slate-400">Not applicable</span>
                      ) : (
                        <>
                          <div className="font-medium text-slate-700">{c.contactName ?? "—"}</div>
                          <div className="truncate">{c.contactEmail}</div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-700">{c.openTasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      {matches.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No clients match “{search}”.
        </div>
      )}
    </div>
  );
}
