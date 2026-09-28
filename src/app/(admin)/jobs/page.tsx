import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { getJobsPageData } from "@/lib/job-queries";
import { toDateString } from "@/lib/dates";
import { parseResultWindow, rangeFor, type ResultWindow } from "@/lib/metrics";
import { EmptyState, PageHeader } from "@/components/ui";
import { money, ResultWindowBar } from "@/components/results-views";
import { JobTable } from "./job-table";

export const metadata: Metadata = { title: "Jobs" };

function hrefWith(client: string | undefined, window: ResultWindow) {
  const params = new URLSearchParams();
  if (client) params.set("client", client);
  if (window !== "30d") params.set("window", window);
  const qs = params.toString();
  return qs ? `/jobs?${qs}` : "/jobs";
}

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  await requireStaff();
  const sp = await searchParams;
  const lookups = await getLookups();
  const jobClients = lookups.clients.filter((c) => !c.isInternal && c.lifecycle !== "churned");
  const client = typeof sp.client === "string" && lookups.clients.some((c) => c.id === sp.client) ? sp.client : undefined;
  const window = parseResultWindow(sp.window);
  const range = rangeFor(window, toDateString(new Date()));
  const data = await getJobsPageData({ clientId: client, range });
  const s = data.stats;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Jobs"
        subtitle="Jobs and invoices from your clients' field-service software, matched back to the leads that produced them."
        actions={
          <Link href={client ? `/jobs/import?client=${client}` : "/jobs/import"} className="btn-primary">
            <Upload className="h-4 w-4" /> Import jobs CSV
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Pill href={hrefWith(undefined, window)} active={!client}>All clients</Pill>
        {jobClients.map((c) => (
          <Pill key={c.id} href={hrefWith(c.id, window)} active={client === c.id} color={c.color}>{c.name}</Pill>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <ResultWindowBar window={window} hrefFor={(w) => hrefWith(client, w)} />
        <span className="text-xs text-slate-400">Jobs dated by completion (or scheduled, or created) date</span>
      </div>

      {data.totalJobsEver === 0 ? (
        <EmptyState>
          No jobs imported {client ? "for this client " : ""}yet. Export jobs or invoices from Housecall Pro, Jobber, ServiceTitan or a spreadsheet as CSV, then use
          <strong> Import jobs CSV</strong>. Each job is matched to the lead that brought it in, and Marketing Results switches to real revenue.
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Kpi label="Job revenue" value={money(s.revenue)} sub={`${s.jobs} scheduled or completed`} />
            <Kpi label="Average job" value={money(s.avgTicket)} sub="Revenue ÷ jobs" />
            <Kpi label="Traced to a lead" value={s.matchRate === null ? "—" : `${Math.round(s.matchRate * 100)}%`} sub={`${s.matchedJobs} of ${s.jobs} jobs`} />
            <Kpi label="Open estimates" value={money(s.estimateValue)} sub={`${s.openEstimates} estimates`} />
            <Kpi label="Balance due" value={money(s.outstanding)} sub="Billed, not yet paid" />
          </div>
          <JobTable key={`${client}-${window}`} rows={data.rows} showClient={!client} clientId={client} />
        </>
      )}
    </div>
  );
}

function Pill({ href, active, color, children }: { href: string; active: boolean; color?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
        active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active ? "#fff" : color }} />}
      {children}
    </Link>
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
