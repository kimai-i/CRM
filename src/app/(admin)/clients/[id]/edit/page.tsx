import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientOwners, clients, clientServices } from "@/db/schema";
import { isAdmin, requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { Card, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { ClientForm } from "../../client-form";
import { deleteClient, updateClient } from "../../actions";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  const { id } = await params;
  const user = await requireStaff();
  const [[client], svc, owners, lookups] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, id)),
    db.select().from(clientServices).where(eq(clientServices.clientId, id)),
    db.select().from(clientOwners).where(eq(clientOwners.clientId, id)),
    getLookups(),
  ]);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`Edit ${client.name}`} />
      <Card>
        <ClientForm
          action={updateClient.bind(null, id)}
          lookups={lookups}
          client={client}
          serviceKeys={svc.map((s) => s.serviceKey)}
          ownerIds={owners.map((o) => o.userId)}
          cancelHref={`/clients/${id}?tab=details`}
        />
      </Card>

      {isAdmin(user.role) && (
        <Card title="Danger zone">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Deleting a client permanently removes their tasks, requests and portal logins. To keep history, set the status to Churned instead.
            </p>
            <form action={deleteClient.bind(null, id)}>
              <ConfirmButton
                className="btn-danger"
                message={`Permanently delete ${client.name} and all of their tasks and requests? This can't be undone.`}
              >
                Delete client
              </ConfirmButton>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
}
