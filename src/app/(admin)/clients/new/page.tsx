import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "../client-form";
import { createClient } from "../actions";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireStaff();
  const lookups = await getLookups();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New client" />
      <Card>
        <ClientForm action={createClient} lookups={lookups} cancelHref="/clients" />
      </Card>
    </div>
  );
}
