import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { applicants } from "@/db/schema";
import { requireClientUser } from "@/lib/auth";
import { addDays, toDateString } from "@/lib/dates";
import { ApplicantList } from "@/components/applicant-views";

export const metadata: Metadata = { title: "Job Applicants" };

export default async function PortalApplicantsPage() {
  const viewer = await requireClientUser();
  const rows = await db.select().from(applicants).where(eq(applicants.clientId, viewer.clientId)).orderBy(desc(applicants.submittedAt));
  const today = toDateString(new Date());
  const since = (days: number) => rows.filter((a) => toDateString(new Date(a.submittedAt)) >= addDays(today, -days + 1)).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Job Applicants</h1>
        <p className="mt-1 text-sm text-slate-500">People who applied to work for you. Update their status as you review them.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total applicants" value={rows.length} />
        <Stat label="Last 7 days" value={since(7)} />
        <Stat label="Last 30 days" value={since(30)} />
        <Stat label="With resume" value={rows.filter((a) => a.resumeAssetId).length} />
      </div>
      <section className="rounded-xl border border-slate-200 bg-white">
        <ApplicantList applicants={rows} mode="client" clientId={viewer.clientId} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
