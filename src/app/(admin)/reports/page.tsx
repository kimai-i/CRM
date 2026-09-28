import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Download } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { toDateString } from "@/lib/dates";
import { RESULT_WINDOWS, rangeFor, type ResultWindow } from "@/lib/metrics";
import { getReportData } from "@/lib/report-queries";
import { formatHours } from "@/lib/time";
import { Avatar, Card, PageHeader } from "@/components/ui";
import { money, ResultWindowBar } from "@/components/results-views";

export const metadata: Metadata = { title: "Reports" };

// Utilization is usually read month by month, so this page opens on "This month".
const parseWindow = (raw: unknown): ResultWindow => (typeof raw === "string" && raw in RESULT_WINDOWS ? (raw as ResultWindow) : "mtd");
const hrefFor = (w: ResultWindow) => (w === "mtd" ? "/reports" : `/reports?window=${w}`);

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await requireStaff();
  const window = parseWindow((await searchParams).window);
  const range = rangeFor(window, toDateString(new Date()));
  const data = await getReportData(range);
  const t = data.totals;

  const teamPct = t.teamTargetHours > 0 ? Math.round((t.minutes / 60 / t.teamTargetHours) * 100) : 0;
  const serviceMax = Math.max(1, ...data.byService.map((s) => s.minutes));
  const clientMax = Math.max(1, ...data.scorecards.map((c) => c.minutes));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Where the team's time goes and how every client is doing."
        actions={
          <a href={`/reports/export?window=${window}`} className="btn-secondary">
            <Download className="h-4 w-4" /> Download hours (CSV)
          </a>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <ResultWindowBar window={window} hrefFor={hrefFor} />
        <span className="text-xs text-slate-400">
          {range.start} → {range.end} · {data.workdays} working day{data.workdays === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Team hours" value={formatHours(t.minutes)} sub={`${teamPct}% of ${Math.round(t.teamTargetHours)}h target`} />
        <Kpi label="Active clients" value={String(t.activeClients)} sub={`${t.totalClients} total (not churned)`} />
        <Kpi label="Tasks completed" value={String(t.tasksCompleted)} sub={`${t.servicesInFlight} services with time logged`} />
        <Kpi
          label="Hours per client"
          value={formatHours(t.avgMinutesPerClient)}
          sub={`Across ${t.clientsWithTime} clients · ${formatHours(t.internalMinutes)} internal`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Hours by service" className="lg:col-span-2">
          {data.byService.length === 0 ? (
            <p className="text-sm text-slate-500">No time logged in this period.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.byService.map((s) => (
                <li key={s.key} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-slate-700">{s.name}</span>
                  <div className="h-3 flex-1 rounded bg-slate-100">
                    <div className="h-3 rounded" style={{ width: `${(s.minutes / serviceMax) * 100}%`, backgroundColor: s.color }} />
                  </div>
                  <span className="w-16 text-right font-medium text-slate-800">{formatHours(s.minutes)}</span>
                  <span className="w-10 text-right text-xs text-slate-400">{t.minutes ? Math.round((s.minutes / t.minutes) * 100) : 0}%</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Team utilization">
          <ul className="space-y-4">
            {data.team.map((u) => {
              const pct = u.targetHours > 0 ? Math.round((u.minutes / 60 / u.targetHours) * 100) : 0;
              return (
                <li key={u.id}>
                  <Link href={`/time?user=${u.id}`} className="mb-1 flex items-center justify-between gap-2 text-sm hover:text-indigo-700">
                    <span className="flex items-center gap-2 text-slate-800">
                      <Avatar initials={u.initials} color={u.color} size="sm" /> {u.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatHours(u.minutes)} / {u.targetHours}h
                    </span>
                  </Link>
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : pct < 60 ? "bg-amber-400" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className="mt-0.5 text-right text-[11px] text-slate-400">{pct}% utilized</div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-slate-400">Targets are prorated: 6h per working day ({data.workdays} in this period).</p>
        </Card>
      </div>

      <Card title="Hours by client">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 font-medium">Client</th>
                <th className="py-2 font-medium">Hours</th>
                <th className="py-2 text-right font-medium">Share</th>
                <th className="py-2 pl-6 font-medium">Mostly</th>
                <th className="py-2 text-right font-medium">Tasks done</th>
                <th className="py-2 text-right font-medium">Open</th>
                <th className="py-2 text-right font-medium">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...data.scorecards, ...data.internal].map((c) => (
                <tr key={c.id}>
                  <td className="py-2">
                    <Link href={`/clients/${c.id}`} className="flex items-center gap-2 font-medium text-slate-800 hover:text-indigo-700">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                      {c.isInternal && <span className="rounded bg-slate-200 px-1 text-[10px] font-semibold uppercase text-slate-600">Internal</span>}
                    </Link>
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 rounded bg-slate-100">
                        <div className="h-2 rounded bg-indigo-400" style={{ width: `${(c.minutes / clientMax) * 100}%` }} />
                      </div>
                      <span className="font-medium text-slate-800">{formatHours(c.minutes)}</span>
                    </div>
                  </td>
                  <td className="py-2 text-right text-slate-600">{Math.round(c.shareOfHours * 100)}%</td>
                  <td className="py-2 pl-6">
                    <div className="flex flex-wrap gap-1">
                      {c.topServices.slice(0, 3).map((s) => (
                        <span key={s.key} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${s.color}1a`, color: s.color }}>
                          {s.name} {formatHours(s.minutes)}
                        </span>
                      ))}
                      {c.topServices.length === 0 && <span className="text-xs text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="py-2 text-right text-slate-700">{c.tasksCompleted}</td>
                  <td className="py-2 text-right text-slate-700">{c.openTasks}</td>
                  <td className={`py-2 text-right font-medium ${c.overdueTasks ? "text-red-600" : "text-slate-400"}`}>{c.overdueTasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Client scorecards</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.scorecards.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/clients/${c.id}`} className="flex items-center gap-2 font-semibold text-slate-900 hover:text-indigo-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </Link>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] capitalize text-slate-600">{c.lifecycle}</span>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-y-3 text-center">
                <Stat label="Hours" value={formatHours(c.minutes)} />
                <Stat label="Tasks done" value={String(c.tasksCompleted)} />
                <Stat label="Overdue" value={String(c.overdueTasks)} tone={c.overdueTasks ? "bad" : undefined} />
                <Stat label="Leads" value={String(c.leads)} />
                <Stat label="Booked" value={String(c.booked)} />
                <Stat
                  label="ROAS"
                  value={c.roas === null ? "—" : `${c.roas.toFixed(1)}×`}
                  tone={c.roas === null ? undefined : c.roas >= 3 ? "good" : c.roas < 1 ? "bad" : undefined}
                />
              </dl>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <span className="text-slate-500">{c.spend > 0 ? `${money(c.spend)} ad spend` : "No ad spend"}</span>
                <span className="flex gap-3">
                  <Link href={`/marketing-results?client=${c.id}`} className="font-medium text-indigo-600 hover:underline">Results</Link>
                  <Link href={`/clients/${c.id}`} className="font-medium text-indigo-600 hover:underline">Tasks</Link>
                </span>
              </div>
              {c.overdueTasks > 0 && c.minutes === 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Overdue work but no time logged this period.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`text-lg font-semibold ${tone === "good" ? "text-green-600" : tone === "bad" ? "text-red-600" : "text-slate-900"}`}>{value}</dd>
    </div>
  );
}
