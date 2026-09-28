import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { SpendImportWizard } from "./spend-import-wizard";

export const metadata: Metadata = { title: "Import ad spend" };

export default async function ImportSpendPage({ searchParams }: PageProps<"/marketing-results/import">) {
  await requireStaff();
  const { client } = await searchParams;
  const lookups = await getLookups();
  const clients = lookups.clients.filter((c) => !c.isInternal && c.lifecycle !== "churned");

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/marketing-results" className="btn-ghost -ml-2 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Marketing Results
      </Link>
      <PageHeader
        title="Import ad spend"
        subtitle="Download a report from Google Ads (Campaigns → Download → CSV, segmented by Day) or Meta Ads Manager (Reports → Export → CSV), then upload it here."
      />
      <SpendImportWizard clients={clients} defaultClientId={typeof client === "string" ? client : undefined} />
    </div>
  );
}
