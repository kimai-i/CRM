"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Lookups } from "@/lib/queries";
import { REQUEST_TYPE_LABEL } from "@/lib/labels";
import { createRequest, type RequestFormState } from "./actions";
import { ActionForm } from "@/components/action-form";

export function NewRequestButton({ clients, defaultClientId }: { clients: Lookups["clients"]; defaultClientId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> Log a request
      </button>
      {open && <NewRequestDialog clients={clients} defaultClientId={defaultClientId} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewRequestDialog({ clients, defaultClientId, onClose }: { clients: Lookups["clients"]; defaultClientId?: string; onClose: () => void }) {
  const [state, action, pending] = useActionState<RequestFormState, FormData>(createRequest, {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-[10vh]" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">Log a client request</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <ActionForm action={action} className="space-y-4 p-5">
          <p className="text-sm text-slate-500">For requests that came in by phone, email or text. Clients can also submit their own from the portal.</p>
          <label className="block">
            <span className="label">Client</span>
            <select name="clientId" required defaultValue={defaultClientId ?? ""} className="input mt-1">
              <option value="" disabled>Choose a client…</option>
              {clients.filter((c) => c.lifecycle !== "churned").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Type</span>
            <select name="type" defaultValue="question" className="input mt-1">
              {Object.entries(REQUEST_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">What do they need?</span>
            <input name="title" required maxLength={300} className="input mt-1" />
          </label>
          <label className="block">
            <span className="label">Details</span>
            <textarea name="body" rows={4} className="input mt-1" />
          </label>
          {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save request"}</button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
