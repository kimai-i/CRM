// Lead summary sections shared by the admin Leads page and the client portal.
import Link from "next/link";
import { LEAD_TYPES, type LeadType } from "@/db/schema";
import type { getLeadsPageData, LeadWindow } from "@/lib/lead-queries";
import { LEAD_WINDOWS } from "@/lib/lead-windows";
import { LEAD_SOURCE_COLOR, LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, LEAD_TYPE_LABEL } from "@/lib/leads";
import { Card } from "@/components/ui";

type LeadsData = Awaited<ReturnType<typeof getLeadsPageData>>;

const TYPE_TAB_LABEL: Record<LeadType, string> = { call: "Calls", form: "Forms", chat: "Chats & texts", outreach: "Outreach" };
const STATUS_COLOR = { open: "#f59e0b", booked: "#22c55e", not_a_lead: "#94a3b8", spam: "#ef4444" } as const;

export const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** Type tabs on the left, date-range buttons on the right. */
export function LeadFilterBar({
  window,
  type,
  hrefFor,
}: {
  window: LeadWindow;
  type?: LeadType;
  hrefFor: (change: { window?: LeadWindow; type?: LeadType | null }) => string;
}) {
  const tab = (active: boolean) =>
    `-mb-px border-b-2 px-3 py-2 text-sm ${active ? "border-indigo-600 font-medium text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
      <div className="flex flex-wrap gap-1">
        <Link href={hrefFor({ type: null })} className={tab(!type)}>All</Link>
        {LEAD_TYPES.map((t) => (
          <Link key={t} href={hrefFor({ type: t })} className={tab(type === t)}>{TYPE_TAB_LABEL[t]}</Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 pb-2">
        {(Object.keys(LEAD_WINDOWS) as LeadWindow[]).map((w) => (
          <Link
            key={w}
            href={hrefFor({ window: w })}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${window === w ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {LEAD_WINDOWS[w]}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** KPI tiles, the leads-over-time chart, type/status breakdowns and the source table. */
export function LeadSummary({ data }: { data: LeadsData }) {
  const max = Math.max(1, ...data.chart.buckets.map((b) => b.booked + b.open));
  const typeMax = Math.max(1, ...data.byType.map((t) => t.count));
  const statusMax = Math.max(1, ...data.byStatus.map((s) => s.count));

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total leads" value={data.stats.total} sub={data.stats.hidden ? `${data.stats.hidden} not-a-lead / spam hidden` : "Real leads only"} />
        <Kpi label="Booked" value={data.stats.booked} sub={`${data.stats.bookedPct}% of leads`} />
        <Kpi label="Unique contacts" value={data.stats.unique} sub={`${Math.max(0, data.stats.total - data.stats.unique)} repeat`} />
        <Kpi label="Booked value" value={money(data.stats.bookedValue)} sub="From lead values entered" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={`Leads by ${data.chart.byWeek ? "week" : "day"}`} className="lg:col-span-2">
          <div className="flex h-48 items-end gap-[2px]">
            {data.chart.buckets.map((b) => (
              <div key={b.date} className="flex h-full flex-1 flex-col justify-end" title={`${b.date}: ${b.booked + b.open} leads (${b.booked} booked)`}>
                <div className="w-full rounded-t-sm bg-indigo-200" style={{ height: `${(b.open / max) * 100}%` }} />
                <div className="w-full bg-green-500" style={{ height: `${(b.booked / max) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-400">
            <span>{data.chart.buckets[0]?.date}</span>
            <span>{data.chart.buckets[data.chart.buckets.length - 1]?.date}</span>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-green-500" />Booked</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-indigo-200" />Open</span>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="By type">
            <Bars rows={data.byType.map((t) => ({ label: LEAD_TYPE_LABEL[t.type], count: t.count, color: "#6366f1" }))} max={typeMax} />
          </Card>
          <Card title="By status">
            <Bars rows={data.byStatus.map((s) => ({ label: LEAD_STATUS_LABEL[s.status], count: s.count, color: STATUS_COLOR[s.status] }))} max={statusMax} />
          </Card>
        </div>
      </div>

      <Card title="Leads by source">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 font-medium">Source</th>
                <th className="py-2 text-right font-medium">Leads</th>
                <th className="py-2 text-right font-medium">Booked</th>
                <th className="py-2 text-right font-medium">Booked %</th>
                <th className="py-2 text-right font-medium">Booked value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.bySource.map((s) => (
                <tr key={s.source}>
                  <td className="py-2">
                    <span className="flex items-center gap-2 text-slate-800">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LEAD_SOURCE_COLOR[s.source] }} />
                      {LEAD_SOURCE_LABEL[s.source]}
                    </span>
                  </td>
                  <td className="py-2 text-right font-medium text-slate-900">{s.leads}</td>
                  <td className="py-2 text-right text-slate-700">{s.booked}</td>
                  <td className="py-2 text-right text-slate-700">{s.bookedPct}%</td>
                  <td className="py-2 text-right text-slate-700">{s.value ? money(s.value) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

function Bars({ rows, max }: { rows: { label: string; count: number; color: string }[]; max: number }) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-slate-600">{r.label}</span>
          <div className="h-2 flex-1 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${(r.count / max) * 100}%`, backgroundColor: r.color }} />
          </div>
          <span className="w-8 text-right font-medium text-slate-800">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}
