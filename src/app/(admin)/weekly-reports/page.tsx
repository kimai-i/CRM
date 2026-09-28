import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, weeklyReports } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui";
import { GenerateButton, ReportEditor } from "./reports-client";

export const metadata: Metadata = { title: "Weekly Reports" };

const STATUS_STYLE = {
  draft: ["Needs review", "bg-amber-100 text-amber-800"],
  approved: ["Approved", "bg-blue-100 text-blue-700"],
  sent: ["Sent", "bg-green-100 text-green-700"],
  skipped: ["Skipped", "bg-slate-100 text-slate-500"],
} as const;

export default async function WeeklyReportsPage({ searchParams }: PageProps<"/weekly-reports">) {
  await requireStaff();
  const sp = await searchParams;
  const rows = await db
    .select({ report: weeklyReports, clientName: clients.name, clientColor: clients.color })
    .from(weeklyReports)
    .innerJoin(clients, eq(weeklyReports.clientId, clients.id))
    .orderBy(desc(weeklyReports.weekStart), clients.name);
  const selectedId = typeof sp.report === "string" ? sp.report : rows.find((r) => r.report.status === "draft")?.report.id ?? rows[0]?.report.id;
  const selected = rows.find((r) => r.report.id === selectedId);
  const weeks = [...new Set(rows.map((r) => r.report.weekStart))];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Weekly Reports"
        subtitle="Weekly update drafts for each active client, built from their tasks, leads and ad spend. Review and edit, then copy it into your email and mark it sent — sent reports show in the client's portal."
        actions={<GenerateButton />}
      />
      {rows.length === 0 ? (
        <EmptyState>No reports yet. <strong>Draft last week&apos;s reports</strong> creates one for every active client.</EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            {weeks.map((w) => (
              <section key={w}>
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Week of {new Date(`${w}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </h2>
                <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {rows.filter((r) => r.report.weekStart === w).map(({ report, clientName, clientColor }) => {
                    const [label, style] = STATUS_STYLE[report.status];
                    return (
                      <li key={report.id} className="border-b border-slate-100 last:border-0">
                        <Link href={`/weekly-reports?report=${report.id}`} className={`flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${report.id === selectedId ? "bg-indigo-50/60" : ""}`}>
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: clientColor }} />
                            <span className="truncate text-slate-800">{clientName}</span>
                          </span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${style}`}>{label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </aside>
          {selected && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">{selected.clientName}</h2>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[selected.report.status][1]}`}>{STATUS_STYLE[selected.report.status][0]}</span>
              </div>
              <ReportEditor key={selected.report.id} id={selected.report.id} subject={selected.report.subject} body={selected.report.body} status={selected.report.status} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
