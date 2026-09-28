import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { getLeadWithHistory } from "@/lib/lead-queries";
import { formatPhone, LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, LEAD_TYPE_LABEL } from "@/lib/leads";
import { timeAgo } from "@/lib/labels";
import { Card } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteLead } from "../actions";
import { EditLeadForm } from "./edit-lead-form";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  await requireStaff();
  const [found, lookups] = await Promise.all([getLeadWithHistory(id), getLookups()]);
  if (!found) notFound();
  const { lead, history } = found;
  const client = lookups.clients.find((c) => c.id === lead.clientId);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/leads?client=${lead.clientId}`} className="btn-ghost -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back to {client?.name ?? "leads"}
        </Link>
        <form action={deleteLead.bind(null, lead.id)}>
          <ConfirmButton className="btn-danger" message="Delete this lead? This can't be undone. (To hide it instead, set its status to Not a lead.)">
            <Trash2 className="h-4 w-4" /> Delete lead
          </ConfirmButton>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Lead details" className="lg:col-span-2">
          <EditLeadForm
            leadId={lead.id}
            clients={lookups.clients}
            defaults={{
              clientId: lead.clientId,
              occurredAt: lead.occurredAt,
              type: lead.type,
              source: lead.source,
              status: lead.status,
              contactName: lead.contactName,
              phone: lead.phone,
              email: lead.email,
              zip: lead.zip,
              address: lead.address,
              summary: lead.summary,
              durationSec: lead.durationSec,
              value: lead.value,
            }}
          />
        </Card>

        <div className="space-y-6">
          <Card title="Contact">
            <div className="space-y-1 text-sm">
              <div className="font-medium text-slate-900">{lead.contactName ?? "No name"}</div>
              {lead.phone && <a href={`tel:${lead.phone}`} className="block text-indigo-600 hover:underline">{formatPhone(lead.phone)}</a>}
              {lead.email && <a href={`mailto:${lead.email}`} className="block text-indigo-600 hover:underline">{lead.email}</a>}
              {lead.sourceDetail && <div className="pt-2 text-xs text-slate-500">Original source: {lead.sourceDetail}</div>}
              <div className="text-xs text-slate-500">Added {lead.provider === "csv" ? "by CSV import" : "by hand"}</div>
            </div>
          </Card>

          <Card title={`History with ${client?.name ?? "this client"} (${history.length})`}>
            {history.length <= 1 ? (
              <p className="text-sm text-slate-500">This is the first time they've reached out.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((h) => (
                  <li key={h.id} className={`text-sm ${h.id === lead.id ? "font-medium" : ""}`}>
                    <Link href={`/leads/${h.id}`} className="hover:text-indigo-700">
                      {LEAD_TYPE_LABEL[h.type]} · {LEAD_SOURCE_LABEL[h.source]}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {timeAgo(h.occurredAt)} · {LEAD_STATUS_LABEL[h.status]}
                      {h.id === lead.id ? " · this lead" : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
