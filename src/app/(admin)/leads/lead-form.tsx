"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Lookups } from "@/lib/queries";
import { formatDuration, LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, LEAD_TYPE_LABEL } from "@/lib/leads";
import { createLead, type LeadFormState } from "./actions";
import { ActionForm } from "@/components/action-form";

export type LeadDefaults = {
  clientId?: string;
  occurredAt?: string; // ISO
  type?: keyof typeof LEAD_TYPE_LABEL;
  source?: keyof typeof LEAD_SOURCE_LABEL;
  status?: keyof typeof LEAD_STATUS_LABEL;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  zip?: string | null;
  address?: string | null;
  summary?: string | null;
  durationSec?: number | null;
  value?: number | null;
};

/** ISO timestamp → value for <input type="datetime-local"> in the browser's timezone. */
function toLocalInput(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LeadFields({ clients, defaults = {} }: { clients: Lookups["clients"]; defaults?: LeadDefaults }) {
  // Rendered only after mount so the default time uses the browser's clock and timezone.
  const [when, setWhen] = useState("");
  useEffect(() => {
    setWhen(toLocalInput(defaults.occurredAt));
  }, [defaults.occurredAt]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label>
        <span className="label">Client</span>
        <select name="clientId" required defaultValue={defaults.clientId ?? ""} className="input mt-1">
          <option value="" disabled>Choose a client…</option>
          {clients.filter((c) => !c.isInternal && (c.lifecycle !== "churned" || c.id === defaults.clientId)).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">When</span>
        <input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} className="input mt-1" />
        {/* Sent as an exact moment so the server's timezone doesn't matter. */}
        <input type="hidden" name="occurredAt" value={when && !Number.isNaN(new Date(when).getTime()) ? new Date(when).toISOString() : ""} />
      </label>
      <label>
        <span className="label">Type</span>
        <select name="type" defaultValue={defaults.type ?? "call"} className="input mt-1">
          {Object.entries(LEAD_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>
        <span className="label">Source</span>
        <select name="source" defaultValue={defaults.source ?? "google_ads"} className="input mt-1">
          {Object.entries(LEAD_SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>
        <span className="label">Contact name</span>
        <input name="contactName" defaultValue={defaults.contactName ?? ""} className="input mt-1" />
      </label>
      <label>
        <span className="label">Phone</span>
        <input name="phone" type="tel" defaultValue={defaults.phone ?? ""} className="input mt-1" />
      </label>
      <label>
        <span className="label">Email</span>
        <input name="email" type="email" defaultValue={defaults.email ?? ""} className="input mt-1" />
      </label>
      <label>
        <span className="label">Status</span>
        <select name="status" defaultValue={defaults.status ?? "open"} className="input mt-1">
          {Object.entries(LEAD_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>
        <span className="label">Call length (m:ss)</span>
        <input name="duration" placeholder="2:30" defaultValue={formatDuration(defaults.durationSec)} className="input mt-1" />
      </label>
      <label>
        <span className="label">Value ($)</span>
        <input name="value" inputMode="decimal" placeholder="0" defaultValue={defaults.value ?? ""} className="input mt-1" />
      </label>
      <label>
        <span className="label">ZIP code</span>
        <input name="zip" defaultValue={defaults.zip ?? ""} className="input mt-1" />
      </label>
      <label>
        <span className="label">Address</span>
        <input name="address" defaultValue={defaults.address ?? ""} className="input mt-1" />
      </label>
      <label className="sm:col-span-2">
        <span className="label">Summary</span>
        <textarea name="summary" rows={3} defaultValue={defaults.summary ?? ""} placeholder="What did they need?" className="input mt-1" />
      </label>
    </div>
  );
}

export function AddLeadButton({ clients, defaultClientId }: { clients: Lookups["clients"]; defaultClientId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> Add lead
      </button>
      {open && <AddLeadDialog clients={clients} defaultClientId={defaultClientId} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddLeadDialog({ clients, defaultClientId, onClose }: { clients: Lookups["clients"]; defaultClientId?: string; onClose: () => void }) {
  const [state, action, pending] = useActionState<LeadFormState, FormData>(createLead, {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[6vh]" onMouseDown={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">Add a lead</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <ActionForm action={action} className="p-5">
          <LeadFields clients={clients} defaults={{ clientId: defaultClientId }} />
          {state.error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save lead"}</button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
