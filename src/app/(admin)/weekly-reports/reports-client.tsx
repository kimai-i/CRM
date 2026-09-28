"use client";

import { useActionState, useState, useTransition } from "react";
import { Copy, RotateCcw, Sparkles } from "lucide-react";
import { generateLastWeek, reopenReport, saveReport, type ReportState } from "./actions";
import { ActionForm } from "@/components/action-form";

export function GenerateButton() {
  const [state, action, pending] = useActionState<ReportState, FormData>(async () => generateLastWeek(), {});
  return (
    <ActionForm action={action} className="flex items-center gap-3">
      {state.message && <span className="text-sm text-slate-600">{state.message}</span>}
      <button type="submit" disabled={pending} className="btn-primary"><Sparkles className="h-4 w-4" /> {pending ? "Drafting…" : "Draft last week's reports"}</button>
    </ActionForm>
  );
}

export function ReportEditor({ id, subject, body, status }: { id: string; subject: string; body: string; status: "draft" | "approved" | "sent" | "skipped" }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(saveReport.bind(null, id), {});
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState({ subject, body });
  const [, startTransition] = useTransition();
  const locked = status === "sent" || status === "skipped";

  async function copy() {
    await navigator.clipboard.writeText(`${text.subject}\n\n${text.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ActionForm action={action} className="space-y-3">
      <input name="subject" value={text.subject} onChange={(e) => setText((t) => ({ ...t, subject: e.target.value }))} disabled={locked} maxLength={300} className="input font-medium" />
      <textarea name="body" value={text.body} onChange={(e) => setText((t) => ({ ...t, body: e.target.value }))} disabled={locked} rows={16} maxLength={50000} className="input font-mono text-[13px]" />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {state.error && <span className="mr-auto text-sm text-red-600">{state.error}</span>}
        {state.message && !pending && <span className="mr-auto text-sm text-green-700">{state.message}</span>}
        <button type="button" onClick={copy} className="btn-ghost"><Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy to send"}</button>
        {locked ? (
          <button type="button" onClick={() => startTransition(() => reopenReport(id))} className="btn-secondary"><RotateCcw className="h-4 w-4" /> Reopen</button>
        ) : (
          <>
            <button type="submit" name="intent" value="skip" disabled={pending} className="btn-ghost">Skip this week</button>
            <button type="submit" name="intent" value="save" disabled={pending} className="btn-secondary">Save</button>
            {status === "draft" && <button type="submit" name="intent" value="approve" disabled={pending} className="btn-secondary">Approve</button>}
            <button type="submit" name="intent" value="sent" disabled={pending} className="btn-primary">Mark as sent</button>
          </>
        )}
      </div>
    </ActionForm>
  );
}
