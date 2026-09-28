import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { JobImportWizard } from "./job-import-wizard";

export const metadata: Metadata = { title: "Import jobs" };

export default async function ImportJobsPage({ searchParams }: PageProps<"/jobs/import">) {
  await requireStaff();
  const { client } = await searchParams;
  const lookups = await getLookups();
  const clients = lookups.clients.filter((c) => !c.isInternal && c.lifecycle !== "churned");

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/jobs" className="btn-ghost -ml-2 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to jobs
      </Link>
      <PageHeader
        title="Import jobs"
        subtitle="Export jobs or invoices as CSV — Housecall Pro: Jobs → Export; Jobber: Reports → Jobs → Export CSV; ServiceTitan: Reports → Jobs. Include customer phone and email so jobs can be matched to leads."
      />
      <JobImportWizard clients={clients} defaultClientId={typeof client === "string" ? client : undefined} />
    </div>
  );
}
