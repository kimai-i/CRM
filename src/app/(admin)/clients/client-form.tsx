"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Client } from "@/db/schema";
import type { Lookups } from "@/lib/queries";
import { LIFECYCLE_LABEL } from "@/lib/labels";
import type { ClientFormState } from "./actions";
import { ActionForm } from "@/components/action-form";

type Action = (prev: ClientFormState, formData: FormData) => Promise<ClientFormState>;

export function ClientForm({
  action,
  lookups,
  client,
  serviceKeys = [],
  ownerIds = [],
  cancelHref,
}: {
  action: Action;
  lookups: Lookups;
  client?: Client;
  serviceKeys?: string[];
  ownerIds?: string[];
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(action, {});

  return (
    <ActionForm action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="label">Client name</span>
          <input name="name" required maxLength={200} defaultValue={client?.name} className="input mt-1" autoFocus={!client} />
        </label>
        <label>
          <span className="label">Status</span>
          <select name="lifecycle" defaultValue={client?.lifecycle ?? "onboarding"} className="input mt-1">
            {Object.entries(LIFECYCLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Color</span>
          <div className="mt-1 flex items-center gap-2">
            <input name="color" type="color" defaultValue={client?.color ?? "#6366f1"} className="h-9 w-14 cursor-pointer rounded border border-slate-300" />
            <span className="text-xs text-slate-500">Used to tint this client's rows.</span>
          </div>
        </label>
        <label>
          <span className="label">Main contact name</span>
          <input name="contactName" defaultValue={client?.contactName ?? ""} className="input mt-1" />
        </label>
        <label>
          <span className="label">Main contact email</span>
          <input name="contactEmail" type="email" defaultValue={client?.contactEmail ?? ""} className="input mt-1" />
        </label>
        <label>
          <span className="label">Main contact phone</span>
          <input name="contactPhone" defaultValue={client?.contactPhone ?? ""} className="input mt-1" />
        </label>
        <label>
          <span className="label">Website</span>
          <input name="website" defaultValue={client?.website ?? ""} placeholder="https://" className="input mt-1" />
        </label>
      </div>

      <fieldset>
        <legend className="label">Services we run for them</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {lookups.services.map((s) => (
            <label key={s.key} className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-transparent has-[:checked]:bg-indigo-50 has-[:checked]:text-indigo-700">
              <input type="checkbox" name="services" value={s.key} defaultChecked={serviceKeys.includes(s.key)} className="sr-only" />
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Account owners (your team)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {lookups.staff.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-transparent has-[:checked]:bg-indigo-50 has-[:checked]:text-indigo-700">
              <input type="checkbox" name="owners" value={u.id} defaultChecked={ownerIds.includes(u.id)} className="sr-only" />
              {u.name}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="label">Notes</span>
        <textarea name="notes" rows={4} defaultValue={client?.notes ?? ""} className="input mt-1" />
      </label>

      <label className="flex items-center gap-2">
        <input name="isInternal" type="checkbox" defaultChecked={client?.isInternal ?? false} className="h-4 w-4 rounded border-slate-300" />
        <span className="text-sm text-slate-700">Internal (your agency's own work — not a paying client)</span>
      </label>

      {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className="btn-secondary">Cancel</Link>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : client ? "Save changes" : "Create client"}
        </button>
      </div>
    </ActionForm>
  );
}
