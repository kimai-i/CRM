import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getClientsOverview, getLookups } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { ClientsTable } from "./clients-table";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  await requireStaff();
  const [clientRows, lookups] = await Promise.all([getClientsOverview(), getLookups()]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Clients"
        subtitle="Manage your client relationships."
        actions={
          <Link href="/clients/new" className="btn-primary">
            <Plus className="h-4 w-4" /> Add client
          </Link>
        }
      />
      <ClientsTable clients={clientRows} lookups={lookups} />
    </div>
  );
}
