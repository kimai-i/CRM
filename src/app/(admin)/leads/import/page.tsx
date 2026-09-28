import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Import leads" };

export default async function ImportLeadsPage({ searchParams }: PageProps<"/leads/import">) {
  await requireStaff();
  const { client } = await searchParams;
  const lookups = await getLookups();
  const clients = lookups.clients.filter((c) => !c.isInternal && c.lifecycle !== "churned");

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/leads" className="btn-ghost -ml-2 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>
      <PageHeader
        title="Import leads from a spreadsheet"
        subtitle="Export calls, forms or contacts as a CSV file (from GoHighLevel, CallRail, your website forms, or a spreadsheet), then upload it here."
      />
      <ImportWizard clients={clients} defaultClientId={typeof client === "string" ? client : undefined} />
    </div>
  );
}
