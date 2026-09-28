import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, MessageSquarePlus, PhoneCall, Minus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getDashboardData, type TaskWithRefs } from "@/lib/dashboard";
import { getMonthUtilization } from "@/lib/time-queries";
import { formatHours } from "@/lib/time";
import { dueLabel, formatLongDate, greeting } from "@/lib/dates";
import { Avatar, Card, EmptyState, Pill, PriorityBadge, StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireStaff();
  const now = new Date();
  const [d, utilization] = await Promise.all([getDashboardData(user, now), getMonthUtilization()]);
  const minutesByUser = new Map(utilization.map((u) => [u.id, u]));
  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Daily brief + needs your eye */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h1 className="text-xl font-semibold text-slate-900">
            {greeting(now.getHours())}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatLongDate(now)} · What changed overnight and who needs your eye today.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <BriefTile icon={<PhoneCall className="h-4 w-4" />} label="New leads today" value={d.brief.newLeadsToday} tone="indigo" />
            <BriefTile icon={<MessageSquarePlus className="h-4 w-4" />} label="Open requests" value={d.brief.openRequests} tone="amber" />
            <BriefTile icon={<CheckCircle2 className="h-4 w-4" />} label="Done yesterday" value={d.brief.doneYesterday} tone="green" />
            <BriefTile icon={<AlertTriangle className="h-4 w-4" />} label="Overdue now" value={d.brief.overdueNow} tone="red" />
          </div>
        </section>

        <Card title="Needs your eye" action={<Link href="/clients" className="text-xs font-medium text-indigo-600 hover:underline">All clients →</Link>}>
          {d.attention.length === 0 ? (
            <EmptyState>Every client is on track.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {d.attention.slice(0, 6).map((a) => (
                <li key={a.client.id} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.client.color }} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/clients/${a.client.id}`} className="text-sm font-medium leading-snug text-slate-900 hover:text-indigo-700">{a.client.name}</Link>
                    <div className="text-xs text-slate-500">
                      {[
                        a.overdueTasks > 0 && `${a.overdueTasks} overdue task${a.overdueTasks === 1 ? "" : "s"}`,
                        a.openRequests > 0 && `${a.openRequests} open request${a.openRequests === 1 ? "" : "s"}`,
                      ].filter(Boolean).join(" · ") || "Lead volume dropped"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-500">
                    <div className="flex items-center justify-end gap-1.5">
                      <TrendBadge pct={a.leadTrendPct} />
                      <span className="font-medium text-slate-700">{a.leads7d}</span>
                    </div>
                    <div>leads / 7d</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Agency hub */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Active clients" value={d.hub.activeClients} sub={`${d.hub.onboardingClients} onboarding`} />
        <KpiCard label="Active tasks" value={d.hub.activeTasks} sub={`${d.hub.oneOffTasks} one-off · ${d.hub.routineTasks} routines`} />
        <KpiCard
          label="Overdue"
          value={d.hub.overdueTasks}
          sub={`Across ${d.hub.overdueClients} client${d.hub.overdueClients === 1 ? "" : "s"}`}
          danger={d.hub.overdueTasks > 0}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <LifecycleChip label="Onboarding" count={d.lifecycleCounts.onboarding} color="#8b5cf6" />
        <LifecycleChip label="Active retainers" count={d.lifecycleCounts.active} color="#22c55e" />
        <LifecycleChip label="Paused / on hold" count={d.lifecycleCounts.paused} color="#eab308" />
        <LifecycleChip label="Churned" count={d.lifecycleCounts.churned} color="#94a3b8" />
      </div>

      {/* Workload + team */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Team workload (est. hours of open tasks)" className="lg:col-span-2">
          <WorkloadChart rows={d.workload} />
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
            {d.services.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
                {s.name}
              </span>
            ))}
          </div>
        </Card>

        <Card title="Hours logged this month" action={<Link href="/time" className="text-xs font-medium text-indigo-600 hover:underline">Time →</Link>}>
          <ul className="space-y-3">
            {d.team.map((u) => {
              const util = minutesByUser.get(u.id);
              const minutes = util?.minutes ?? 0;
              const target = util?.target ?? u.utilizationTargetHours;
              const pct = target > 0 ? Math.min(100, Math.round((minutes / 60 / target) * 100)) : 0;
              return (
                <li key={u.id} className="flex items-center gap-3">
                  <Avatar initials={u.initials} color={u.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="truncate font-medium text-slate-900">{u.name}</span>
                      <span className="text-xs text-slate-500">{formatHours(minutes)} / {target}h</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Overdue + onboarding + routines */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={`Overdue tasks (${d.overdueTasks.length})`} className="lg:col-span-2">
          {d.overdueTasks.length === 0 ? (
            <EmptyState>Nothing overdue. Nice work.</EmptyState>
          ) : (
            <TaskList tasks={d.overdueTasks.slice(0, 8)} today={d.today} />
          )}
          {d.overdueTasks.length > 8 && (
            <p className="mt-3 text-xs text-slate-500">+ {d.overdueTasks.length - 8} more overdue</p>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Active onboardings">
            {d.onboardings.length === 0 ? (
              <EmptyState>No clients are currently onboarding.</EmptyState>
            ) : (
              <ul className="space-y-4">
                {d.onboardings.map((o) => {
                  const pct = o.total === 0 ? 0 : Math.round((o.done / o.total) * 100);
                  return (
                    <li key={o.client.id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-900">{o.client.name}</span>
                        <span className="text-xs text-slate-500">{o.done}/{o.total} tasks</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title={`Overdue routines (${d.overdueRoutines.length})`}>
            {d.overdueRoutines.length === 0 ? (
              <EmptyState>All routines on track.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {d.overdueRoutines.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/tasks/${t.id}`} className="truncate text-slate-700 hover:text-indigo-700">{t.title}</Link>
                    <span className="shrink-0 text-xs font-medium text-red-600">{dueLabel(t.dueDate, d.today).text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* This week */}
      <Card title={`This week's tasks (${d.thisWeekTasks.length})`}>
        {d.thisWeekTasks.length === 0 ? (
          <EmptyState>Nothing due this week.</EmptyState>
        ) : (
          <TaskList tasks={d.thisWeekTasks} today={d.today} />
        )}
      </Card>
    </div>
  );
}

const TONES = {
  indigo: "bg-indigo-50 text-indigo-700",
  amber: "bg-amber-50 text-amber-700",
  green: "bg-green-50 text-green-700",
  red: "bg-red-50 text-red-700",
} as const;

function BriefTile({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: keyof typeof TONES }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <div className={`inline-flex rounded-md p-1.5 ${TONES[tone]}`}>{icon}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function KpiCard({ label, value, sub, danger = false }: { label: string; value: number; sub: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${danger ? "text-red-600" : "text-slate-900"}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

function LifecycleChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
      <span className="font-semibold text-slate-900">{count}</span>
    </span>
  );
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  if (pct === 0) {
    return (
      <span className="inline-flex items-center text-[11px] text-slate-500">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  }
  const up = pct > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center text-[11px] font-medium ${up ? "text-green-600" : "text-red-600"}`}>
      <Icon className="h-3 w-3" />
      {up ? "+" : ""}{pct}%
    </span>
  );
}

function WorkloadChart({ rows }: { rows: Awaited<ReturnType<typeof getDashboardData>>["workload"] }) {
  const max = Math.max(1, ...rows.map((r) => r.totalHours));
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.user?.id ?? "unassigned"} className="flex items-center gap-3">
          <div className="flex w-32 shrink-0 items-center gap-2">
            {row.user ? (
              <Avatar initials={row.user.initials} color={row.user.color} size="sm" />
            ) : (
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400">?</span>
            )}
            <span className="truncate text-sm text-slate-700">{row.user?.name ?? "Unassigned"}</span>
          </div>
          <div className="flex h-5 flex-1 overflow-hidden rounded bg-slate-100">
            {row.segments.map((seg) => (
              <div
                key={seg.service.key}
                className="h-full"
                style={{ width: `${(seg.hours / max) * 100}%`, backgroundColor: seg.service.color }}
                title={`${seg.service.name}: ${seg.hours}h`}
              />
            ))}
          </div>
          <span className="w-12 shrink-0 text-right text-sm font-medium text-slate-700">{row.totalHours}h</span>
        </li>
      ))}
    </ul>
  );
}

function TaskList({ tasks, today }: { tasks: TaskWithRefs[]; today: string }) {
  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((t) => {
        const due = dueLabel(t.dueDate, today);
        return (
          <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.client.color }} />
            <div className="min-w-0 flex-1">
              <Link href={`/tasks/${t.id}`} className="block truncate text-sm text-slate-900 hover:text-indigo-700">{t.title}</Link>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="truncate">{t.client.name}</span>
                <Pill color={t.service.color}>{t.service.name}</Pill>
              </div>
            </div>
            <PriorityBadge priority={t.priority} />
            <StatusBadge status={t.status} />
            <span className={`w-24 text-right text-xs font-medium ${due.overdue ? "text-red-600" : "text-slate-500"}`}>{due.text}</span>
            {t.owner ? (
              <Avatar initials={t.owner.initials} color={t.owner.color} size="sm" />
            ) : (
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400" title="Unassigned">?</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
