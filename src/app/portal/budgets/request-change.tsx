"use client";

import { useActionState, useState } from "react";
import { X } from "lucide-react";
import type { SpendChannel } from "@/db/schema";
import { requestBudgetChange, type BudgetState } from "@/app/(admin)/ad-budgets/actions";
import { ActionForm } from "@/components/action-form";

export function RequestBudgetChange({ channel, channelLabel, current }: { channel: SpendChannel; channelLabel: string; current: number | null }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<BudgetState, FormData>(async (prev, fd) => {
    const res = await requestBudgetChange(prev, fd);
    if (res.ok) setOpen(false);
    return res;
  }, {});

  return (
    <>
      {state.ok ? (
        <span className="text-green-700">Request sent</span>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="font-medium text-indigo-600 hover:underline">Request change</button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh]" onMouseDown={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="font-semibold text-slate-900">Change {channelLabel} budget</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost p-1" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <ActionForm action={action} className="space-y-4 p-5 text-sm">
              <input type="hidden" name="channel" value={channel} />
              <label className="block">
                <span className="label">New monthly budget</span>
                <input name="amount" required inputMode="decimal" placeholder={current !== null ? `Now $${current}` : "$0"} className="input mt-1" />
              </label>
              <label className="block">
                <span className="label">Why / when should it change?</span>
                <textarea name="reason" rows={3} maxLength={2000} className="input mt-1" />
              </label>
              {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-red-700">{state.error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={pending} className="btn-primary">{pending ? "Sending…" : "Send request"}</button>
              </div>
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}
