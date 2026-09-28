import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { weeklyReports } from "@/db/schema";
import { requireClientUser } from "@/lib/auth";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Reports" };

export default async function PortalReportsPage() {
  const viewer = await requireClientUser();
  // Only reports the team marked as sent.
  const rows = await db
    .select()
    .from(weeklyReports)
    .where(and(eq(weeklyReports.clientId, viewer.clientId), eq(weeklyReports.status, "sent")))
    .orderBy(desc(weeklyReports.weekStart));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Your weekly updates from the team. For live numbers, see Marketing Results.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState>No updates yet. Your weekly reports will be collected here.</EmptyState>
      ) : (
        rows.map((r, i) => (
          <details key={r.id} open={i === 0} className="rounded-xl border border-slate-200 bg-white">
            <summary className="cursor-pointer px-5 py-3 font-medium text-slate-900">{r.subject}</summary>
            <div className="whitespace-pre-wrap border-t border-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-700">{r.body}</div>
          </details>
        ))
      )}
    </div>
  );
}
