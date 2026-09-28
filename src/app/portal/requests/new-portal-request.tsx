"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { REQUEST_TYPE_LABEL } from "@/lib/labels";
import { submitRequest, type PortalRequestState } from "../actions";
import { ActionForm } from "@/components/action-form";

export function NewPortalRequest() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<PortalRequestState, FormData>(async (prev, fd) => {
    const res = await submitRequest(prev, fd);
    if (res.ok) setOpen(false);
    return res;
  }, {});

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button type="button" onClick={() => setOpen(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> New request
        </button>
        {state.ok && <p className="text-sm text-green-700">Sent! Your team has it.</p>}
      </div>
    );
  }

  return (
    <ActionForm action={action} className="w-full space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <label className="block">
        <span className="label">What kind of request?</span>
        <select name="type" defaultValue="question" className="input mt-1">
          {Object.entries(REQUEST_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">What do you need?</span>
        <input name="title" required maxLength={300} autoFocus className="input mt-1" />
      </label>
      <label className="block">
        <span className="label">Details (optional)</span>
        <textarea name="body" rows={4} className="input mt-1" />
      </label>
      {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Sending…" : "Send request"}</button>
      </div>
    </ActionForm>
  );
}
