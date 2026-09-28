import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isAdmin, requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { getEntries, getMonthUtilization, getOpenTaskOptions, getRunningTimer } from "@/lib/time-queries";
import { addDays, startOfWeek, toDateString } from "@/lib/dates";
import { formatHours, formatMinutes } from "@/lib/time";
import { Avatar, Card, PageHeader } from "@/components/ui";
import { AddTimeButton, EntryList, TimerCard } from "./time-client";

export const metadata: Metadata = { title: "Time Tracking" };

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function TimePage({ searchParams }: PageProps<"/time">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const today = toDateString(new Date());
  const thisWeek = startOfWeek(today);
  const weekStart = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? startOfWeek(sp.week) : thisWeek;
  const weekEnd = addDays(weekStart, 6);

  const [lookups, utilization, taskOptions, running] = await Promise.all([
    getLookups(),
    getMonthUtilization(today),
    getOpenTaskOptions(),
    getRunningTimer(me.id),
  ]);

  // Admins can look at anyone's timesheet; everyone else sees their own.
  const viewedUserId = isAdmin(me.role) && typeof sp.user === "string" && lookups.staff.some((u) => u.id === sp.user) ? sp.user : me.id;
  const viewingSelf = viewedUserId === me.id;
  const viewedUser = lookups.staff.find((u) => u.id === viewedUserId);
  const entries = await getEntries(viewedUserId, weekStart, weekEnd);

  const href = (week: string, user = viewedUserId) => {
    const params = new URLSearchParams();
    if (week !== thisWeek) params.set("week", week);
    if (user !== me.id) params.set("user", user);
    const qs = params.toString();
    return qs ? `/time?${qs}` : "/time";
  };

  // Timesheet grid: one row per client + channel, one column per day.
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const rowKeys = [...new Set(entries.map((e) => `${e.clientId}|${e.serviceKey}`))];
  const grid = rowKeys
    .map((key) => {
      const rowEntries = entries.filter((e) => `${e.clientId}|${e.serviceKey}` === key);
      const first = rowEntries[0];
      return {
        key,
        clientName: first.clientName,
        clientColor: first.clientColor,
        serviceName: first.serviceName,
        perDay: days.map((d) => rowEntries.filter((e) => e.date === d).reduce((s, e) => s + e.minutes, 0)),
        total: rowEntries.reduce((s, e) => s + e.minutes, 0),
      };
    })
    .sort((a, b) => b.total - a.total);
  const dayTotals = days.map((d) => entries.filter((e) => e.date === d).reduce((s, e) => s + e.minutes, 0));
  const weekTotal = dayTotals.reduce((s, n) => s + n, 0);

  const mine = utilization.find((u) => u.id === me.id);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Time Tracking" subtitle="Track time by client and task to see where the team's hours go." />

      {viewingSelf && <TimerCard running={running} lookups={lookups} taskOptions={taskOptions} />}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timesheet */}
        <section className="rounded-xl border border-slate-200 bg-white lg:col-span-2">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-1">
              <Link href={href(addDays(weekStart, -7))} className="btn-ghost p-1" aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Link>
              <span className="text-sm font-semibold text-slate-900">
                {new Date(`${weekStart}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
                {new Date(`${weekEnd}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
              <Link href={href(addDays(weekStart, 7))} className="btn-ghost p-1" aria-label="Next week"><ChevronRight className="h-4 w-4" /></Link>
              {weekStart !== thisWeek && <Link href={href(thisWeek)} className="ml-1 text-xs font-medium text-indigo-600 hover:underline">This week</Link>}
            </div>
            <div className="flex items-center gap-2">
              {isAdmin(me.role) && (
                <div className="flex flex-wrap gap-1">
                  {lookups.staff.map((u) => (
                    <Link
                      key={u.id}
                      href={href(weekStart, u.id)}
                      title={u.name}
                      className={`rounded-full ring-2 ${u.id === viewedUserId ? "ring-indigo-500" : "ring-transparent opacity-60 hover:opacity-100"}`}
                    >
                      <Avatar initials={u.initials} color={u.color} size="sm" />
                    </Link>
                  ))}
                </div>
              )}
              {viewingSelf && <AddTimeButton lookups={lookups} taskOptions={taskOptions} />}
            </div>
          </header>

          {!viewingSelf && <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">Viewing {viewedUser?.name}&apos;s timesheet.</p>}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 text-left font-medium">Client · channel</th>
                  {days.map((d, i) => (
                    <th key={d} className={`w-14 py-2 text-center font-medium ${d === today ? "text-indigo-600" : ""}`}>
                      {DAY_NAMES[i]}
                      <div className="text-[10px] font-normal normal-case">{Number(d.slice(8))}</div>
                    </th>
                  ))}
                  <th className="w-16 px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grid.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-400">Nothing logged this week yet.</td></tr>
                ) : (
                  grid.map((row) => (
                    <tr key={row.key}>
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2 text-slate-800">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.clientColor }} />
                          <span className="truncate">{row.clientName}</span>
                          <span className="text-xs text-slate-400">{row.serviceName}</span>
                        </span>
                      </td>
                      {row.perDay.map((m, i) => (
                        <td key={i} className={`py-2 text-center font-mono tabular-nums ${m ? "text-slate-800" : "text-slate-300"}`}>{m ? formatMinutes(m) : "–"}</td>
                      ))}
                      <td className="px-4 py-2 text-right font-mono font-semibold tabular-nums text-slate-900">{formatMinutes(row.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50/60 font-semibold">
                  <td className="px-4 py-2 text-slate-700">Total</td>
                  {dayTotals.map((m, i) => (
                    <td key={i} className="py-2 text-center font-mono tabular-nums text-slate-800">{m ? formatMinutes(m) : "–"}</td>
                  ))}
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">{formatMinutes(weekTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="border-t border-slate-100">
            <EntryList key={`${viewedUserId}-${weekStart}`} entries={entries} lookups={lookups} taskOptions={taskOptions} editable={viewingSelf || isAdmin(me.role)} />
          </div>
        </section>

        {/* Utilization */}
        <div className="space-y-6">
          {mine && (
            <Card title="Your month">
              <UtilizationBar minutes={mine.minutes} targetHours={mine.target} large />
            </Card>
          )}
          {isAdmin(me.role) && (
            <Card title="Team this month">
              <ul className="space-y-4">
                {utilization.map((u) => (
                  <li key={u.id}>
                    <Link href={href(weekStart, u.id)} className="mb-1 flex items-center gap-2 text-sm text-slate-800 hover:text-indigo-700">
                      <Avatar initials={u.initials} color={u.color} size="sm" /> {u.name}
                    </Link>
                    <UtilizationBar minutes={u.minutes} targetHours={u.target} />
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-slate-400">Monthly target: 120h per person (20 work days × 6h).</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function UtilizationBar({ minutes, targetHours, large = false }: { minutes: number; targetHours: number; large?: boolean }) {
  const pct = targetHours > 0 ? Math.round((minutes / 60 / targetHours) * 100) : 0;
  return (
    <div>
      <div className={`flex items-baseline justify-between ${large ? "mb-2" : "mb-1"}`}>
        <span className={large ? "text-2xl font-semibold text-slate-900" : "text-xs text-slate-600"}>
          {formatHours(minutes)} <span className="text-sm font-normal text-slate-400">of {targetHours}h</span>
        </span>
        <span className={`text-xs font-medium ${pct >= 100 ? "text-green-600" : "text-slate-500"}`}>{pct}%</span>
      </div>
      <div className={`${large ? "h-2.5" : "h-1.5"} rounded-full bg-slate-100`}>
        <div className={`${large ? "h-2.5" : "h-1.5"} rounded-full ${pct >= 100 ? "bg-green-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
