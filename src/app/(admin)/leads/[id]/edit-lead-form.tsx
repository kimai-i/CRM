"use client";

import { useActionState } from "react";
import type { Lookups } from "@/lib/queries";
import { LeadFields, type LeadDefaults } from "../lead-form";
import { updateLead, type LeadFormState } from "../actions";
import { ActionForm } from "@/components/action-form";

export function EditLeadForm({ leadId, clients, defaults }: { leadId: string; clients: Lookups["clients"]; defaults: LeadDefaults }) {
  const [state, action, pending] = useActionState<LeadFormState, FormData>(updateLead.bind(null, leadId), {});
  return (
    <ActionForm action={action}>
      <LeadFields clients={clients} defaults={defaults} />
      <div className="mt-5 flex items-center justify-end gap-3">
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && !pending && <p className="text-sm text-green-600">Saved.</p>}
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save changes"}</button>
      </div>
    </ActionForm>
  );
}
