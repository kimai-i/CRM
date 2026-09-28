"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Lookups } from "@/lib/queries";
import { createMeeting, updateMeeting, type MeetingState } from "./actions";
import { ActionForm } from "@/components/action-form";

export type MeetingDefaults = {
  title?: string;
  clientId?: string | null;
  startsAt?: string;
  durationMin?: number | null;
  attendees?: string | null;
  summary?: string | null;
  internalNotes?: string | null;
  visibility?: "internal" | "client";
  recordingUrl?: string | null;
};

function toLocalInput(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MeetingFields({ clients, defaults = {} }: { clients: Lookups["clients"]; defaults?: MeetingDefaults }) {
  // Filled after mount so the default time uses the browser's clock and timezone.
  const [when, setWhen] = useState("");
  useEffect(() => {
    setWhen(toLocalInput(defaults.startsAt));
  }, [defaults.startsAt]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="label">Title</span>
        <input name="title" required maxLength={300} defaultValue={defaults.title} placeholder="e.g. Monthly review" className="input mt-1" />
      </label>
      <label>
        <span className="label">Client</span>
        <select name="clientId" defaultValue={defaults.clientId ?? ""} className="input mt-1">
          <option value="">No client (internal)</option>
          {clients.filter((c) => c.lifecycle !== "churned" || c.id === defaults.clientId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>
        <span className="label">When</span>
        <input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} className="input mt-1" />
        <input type="hidden" name="startsAt" value={when && !Number.isNaN(new Date(when).getTime()) ? new Date(when).toISOString() : ""} />
      </label>
      <label>
        <span className="label">Length (minutes)</span>
        <input name="durationMin" type="number" min={0} max={1440} defaultValue={defaults.durationMin ?? ""} className="input mt-1" />
      </label>
      <label>
        <span className="label">Who was there</span>
        <input name="attendees" maxLength={1000} defaultValue={defaults.attendees ?? ""} className="input mt-1" />
      </label>
      <label className="sm:col-span-2">
        <span className="label">Summary (shared with the client if you share this meeting)</span>
        <textarea name="summary" rows={5} maxLength={20000} defaultValue={defaults.summary ?? ""} className="input mt-1" />
      </label>
      <label className="sm:col-span-2">
        <span className="label">Internal notes (team only)</span>
        <textarea name="internalNotes" rows={3} maxLength={20000} defaultValue={defaults.internalNotes ?? ""} className="input mt-1" />
      </label>
      <label>
        <span className="label">Recording link</span>
        <input name="recordingUrl" type="url" maxLength={1000} defaultValue={defaults.recordingUrl ?? ""} placeholder="https://" className="input mt-1" />
      </label>
      <label>
        <span className="label">Visibility</span>
        <select name="visibility" defaultValue={defaults.visibility ?? "internal"} className="input mt-1">
          <option value="internal">Internal — team only</option>
          <option value="client">Shared with the client</option>
        </select>
      </label>
    </div>
  );
}

export function NewMeetingButton({ clients, defaultClientId }: { clients: Lookups["clients"]; defaultClientId?: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<MeetingState, FormData>(createMeeting, {});
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> New meeting</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[5vh]" onMouseDown={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="font-semibold text-slate-900">New meeting</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost p-1" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <ActionForm action={action} className="p-5">
              <MeetingFields clients={clients} defaults={{ clientId: defaultClientId }} />
              {state.error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save meeting"}</button>
              </div>
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}

export function EditMeetingForm({ id, clients, defaults }: { id: string; clients: Lookups["clients"]; defaults: MeetingDefaults }) {
  const [state, action, pending] = useActionState<MeetingState, FormData>(updateMeeting.bind(null, id), {});
  return (
    <ActionForm action={action}>
      <MeetingFields clients={clients} defaults={defaults} />
      <div className="mt-5 flex items-center justify-end gap-3">
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && !pending && <span className="text-sm text-green-700">Saved.</span>}
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save changes"}</button>
      </div>
    </ActionForm>
  );
}
