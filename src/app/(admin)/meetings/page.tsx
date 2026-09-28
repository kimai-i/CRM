import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Lock } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { getMeetingList } from "@/lib/meeting-queries";
import { toDateString } from "@/lib/dates";
import { EmptyState, PageHeader } from "@/components/ui";
import { NewMeetingButton } from "./meeting-form";

export const metadata: Metadata = { title: "Meetings" };

export default async function MeetingsPage({ searchParams }: PageProps<"/meetings">) {
  await requireStaff();
  const sp = await searchParams;
  const lookups = await getLookups();
  const client = typeof sp.client === "string" && lookups.clients.some((c) => c.id === sp.client) ? sp.client : undefined;
  const all = await getMeetingList({ clientId: client });

  const thisMonth = toDateString(new Date()).slice(0, 7);
  const stats = {
    total: all.length,
    thisMonth: all.filter((m) => toDateString(new Date(m.startsAt)).startsWith(thisMonth)).length,
    unattributed: all.filter((m) => !m.clientId).length,
    openItems: all.reduce((s, m) => s + m.openItems, 0),
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Meetings"
        subtitle="Call notes and action items. Share a meeting with its client and the summary and their action items show in their portal."
        actions={<NewMeetingButton clients={lookups.clients} defaultClientId={client} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Meetings" value={stats.total} />
        <Stat label="This month" value={stats.thisMonth} />
        <Stat label="No client linked" value={stats.unattributed} tone={stats.unattributed ? "warn" : undefined} />
        <Stat label="Open action items" value={stats.openItems} />
      </div>

      <form className="flex items-center gap-2">
        <select name="client" defaultValue={client ?? ""} className="input w-auto py-1.5">
          <option value="">All clients</option>
          {lookups.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="submit" className="btn-secondary py-1.5">Filter</button>
      </form>

      {all.length === 0 ? (
        <EmptyState>No meetings yet. Use <strong>New meeting</strong> to log notes and action items from a call.</EmptyState>
      ) : (
        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">Meeting</th>
                <th className="px-2 py-2 font-medium">Client</th>
                <th className="px-2 py-2 font-medium">Visibility</th>
                <th className="px-4 py-2 text-right font-medium">Action items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {all.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5">
                    <Link href={`/meetings/${m.id}`} className="font-medium text-slate-900 hover:text-indigo-700">{m.title}</Link>
                    <div className="text-xs text-slate-500" suppressHydrationWarning>
                      {new Date(m.startsAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                      {m.durationMin ? ` · ${m.durationMin} min` : ""}
                      {m.createdBy ? ` · ${m.createdBy}` : ""}
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    {m.clientName ? (
                      <span className="flex items-center gap-1.5 text-xs text-slate-700">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.clientColor ?? undefined }} />
                        {m.clientName}
                      </span>
                    ) : (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">No client</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-xs">
                    {m.visibility === "client" ? (
                      <span className="flex items-center gap-1 text-green-700"><Eye className="h-3.5 w-3.5" /> Shared</span>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-500"><Lock className="h-3.5 w-3.5" /> Internal</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-slate-600">
                    {m.totalItems ? `${m.openItems} open / ${m.totalItems}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-amber-600" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}
