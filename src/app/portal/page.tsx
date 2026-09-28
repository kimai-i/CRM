import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, isNull, ne } from "drizzle-orm";
import { AlertCircle, ArrowRight, ClipboardList } from "lucide-react";
import { db } from "@/db";
import { clients, clientServices, jobs, services, tasks } from "@/db/schema";
import { requireClientUser } from "@/lib/auth";
import { addDays, dueLabel, toDateString } from "@/lib/dates";
import { isWonJob, revenueDate } from "@/lib/jobs";
import { getResultsData } from "@/lib/results-queries";
import { getOnboarding } from "@/lib/onboarding-queries";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Overview" };

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export default async function PortalOverviewPage() {
  const viewer = await requireClientUser();
  const today = toDateString(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;

  const [[client], serviceRows, taskRows, jobRows, results, onboarding] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, viewer.clientId)),
    db.select({ name: services.name, color: services.color }).from(clientServices).innerJoin(services, eq(clientServices.serviceKey, services.key)).where(eq(clientServices.clientId, viewer.clientId)),
    db.select().from(tasks).where(and(eq(tasks.clientId, viewer.clientId), eq(tasks.clientVisible, true), isNull(tasks.parentId), ne(tasks.status, "done"))),
    db.select().from(jobs).where(eq(jobs.clientId, viewer.clientId)),
    getResultsData({ clientId: viewer.clientId, window: "30d" }),
    getOnboarding(viewer.clientId),
  ]);

  const won = jobRows.filter((j) => isWonJob(j.status));
  const soldThisMonth = won.filter((j) => revenueDate(j) >= monthStart && revenueDate(j) <= today).reduce((s, j) => s + j.total, 0);
  const upcoming = jobRows.filter((j) => j.status === "scheduled" && (j.scheduledOn ?? j.createdOn) > today);
  const outstanding = won.filter((j) => j.paid !== null).reduce((s, j) => s + Math.max(0, j.total - (j.paid ?? 0)), 0);

  const todos = taskRows.filter((t) => t.assigneeType === "client");
  const work = taskRows.filter((t) => t.assigneeType === "agency");
  const thisWeek = work.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= addDays(today, 7));
  const t = results.results.totals;
  const showOnboarding = client?.lifecycle === "onboarding" || (!onboarding.submittedAt && onboarding.profilePct < 1);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Welcome, {client?.name}</h1>
        <p className="mt-1 text-sm text-slate-500">Here&apos;s what your team is working on for you.</p>
      </div>

      {showOnboarding && (
        <Link href="/portal/onboarding/profile" className="flex items-center gap-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 hover:bg-indigo-100/60">
          <ClipboardList className="h-8 w-8 shrink-0 text-indigo-600" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900">Set up your business profile</div>
            <div className="text-sm text-slate-600">A quick questionnaire (~10 minutes) that shapes the strategy we run for you. {Math.round(onboarding.profilePct * 100)}% done.</div>
          </div>
          <span className="btn-primary">Start <ArrowRight className="h-4 w-4" /></span>
        </Link>
      )}

      {jobRows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Tile label="Sold this month" value={money(soldThisMonth)} sub="Scheduled and completed jobs" />
          <Tile label="Upcoming on the books" value={money(upcoming.reduce((s, j) => s + j.total, 0))} sub={`${upcoming.length} job${upcoming.length === 1 ? "" : "s"} scheduled ahead`} />
          <Tile label="Outstanding" value={money(outstanding)} sub="Billed, not yet collected" />
        </div>
      )}

      <Card title="Last 30 days" action={<Link href="/portal/results" className="text-xs font-medium text-indigo-600 hover:underline">Marketing Results →</Link>}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Mini label="Leads" value={String(t.leads)} />
          <Mini label="Booked jobs" value={String(t.booked)} sub={t.bookRate === null ? undefined : `${Math.round(t.bookRate * 100)}% of leads`} />
          <Mini label="Booked revenue" value={money(t.revenue)} />
          <Mini label="Ad spend" value={t.spend > 0 ? money(t.spend) : "—"} sub={t.costPerPaidLead ? `${money(t.costPerPaidLead)} per ad lead` : undefined} />
        </div>
      </Card>

      {t.openLeads > 0 && (
        <Link href="/portal/leads" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 hover:bg-amber-100/60">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
          <span className="flex-1"><strong>{t.openLeads} open lead{t.openLeads === 1 ? "" : "s"}</strong> from the last 30 days haven&apos;t booked yet — a quick follow-up often wins them.</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card title="Services we run for you">
          {serviceRows.length === 0 ? <p className="text-sm text-slate-500">—</p> : (
            <div className="flex flex-wrap gap-1.5">
              {serviceRows.map((s) => <span key={s.name} className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${s.color}1a`, color: s.color }}>{s.name}</span>)}
            </div>
          )}
        </Card>
        <Card title={`Your to-dos (${todos.length})`} action={<Link href="/portal/todo" className="text-xs font-medium text-indigo-600 hover:underline">All →</Link>}>
          {todos.length === 0 ? <p className="text-sm text-slate-500">Nothing needed from you right now.</p> : (
            <ul className="space-y-1.5 text-sm">
              {todos.slice(0, 5).map((x) => <li key={x.id} className="truncate text-slate-700">• {x.title}</li>)}
            </ul>
          )}
        </Card>
        <Card title={`Due this week (${thisWeek.length})`} action={<Link href="/portal/work" className="text-xs font-medium text-indigo-600 hover:underline">Active work →</Link>}>
          {thisWeek.length === 0 ? <p className="text-sm text-slate-500">{work.length ? `${work.length} tasks in progress.` : "Nothing scheduled."}</p> : (
            <ul className="space-y-1.5 text-sm">
              {thisWeek.slice(0, 5).map((x) => (
                <li key={x.id} className="flex justify-between gap-2">
                  <span className="truncate text-slate-700">{x.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">{dueLabel(x.dueDate, today).text}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}
