"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, CornerDownRight, RotateCcw } from "lucide-react";
import { REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL, timeAgo } from "@/lib/labels";
import { ActionForm } from "@/components/action-form";
import {
  convertRequestToTask,
  reopenRequest,
  replyToRequest,
  type RequestFormState,
} from "@/app/(admin)/requests/actions";

export type RequestView = {
  id: string;
  type: keyof typeof REQUEST_TYPE_LABEL;
  status: keyof typeof REQUEST_STATUS_LABEL;
  title: string;
  body: string | null;
  reply: string | null;
  createdAt: string;
  repliedAt: string | null;
  convertedTaskId: string | null;
  client: { id: string; name: string; color: string };
  submittedBy: string | null;
  repliedBy: string | null;
};

const STATUS_STYLE: Record<RequestView["status"], string> = {
  open: "bg-amber-100 text-amber-800",
  replied: "bg-blue-100 text-blue-700",
  declined: "bg-slate-100 text-slate-600",
  converted: "bg-green-100 text-green-700",
};

export function RequestCard({ request, showClient = true }: { request: RequestView; showClient?: boolean }) {
  const [mode, setMode] = useState<"none" | "reply" | "decline">("none");
  const [pendingConvert, startConvert] = useTransition();
  const [state, action, pending] = useActionState<RequestFormState, FormData>(
    async (prev, formData) => {
      const res = await replyToRequest(request.id, prev, formData);
      if (res.ok) setMode("none");
      return res;
    },
    {},
  );

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {showClient && (
              <Link href={`/clients/${request.client.id}?tab=requests`} className="flex items-center gap-1.5 font-medium text-slate-700 hover:text-indigo-700">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: request.client.color }} />
                {request.client.name}
              </Link>
            )}
            <span className="rounded bg-slate-100 px-1.5 py-0.5">{REQUEST_TYPE_LABEL[request.type]}</span>
            <span>{timeAgo(request.createdAt)}{request.submittedBy ? ` · by ${request.submittedBy}` : ""}</span>
          </div>
          <h3 className="mt-1.5 font-medium text-slate-900">{request.title}</h3>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[request.status]}`}>
          {REQUEST_STATUS_LABEL[request.status]}
        </span>
      </div>

      {request.body && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{request.body}</p>}

      {request.reply && (
        <div className="mt-3 flex gap-2 rounded-lg bg-slate-50 p-3 text-sm">
          <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <div>
            <div className="text-xs text-slate-500">
              {request.status === "declined" ? "Declined" : "Reply"}
              {request.repliedBy ? ` by ${request.repliedBy}` : ""}
              {request.repliedAt ? ` · ${timeAgo(request.repliedAt)}` : ""}
            </div>
            <p className="whitespace-pre-wrap text-slate-700">{request.reply}</p>
          </div>
        </div>
      )}

      {request.status === "converted" && request.convertedTaskId && (
        <Link href={`/tasks/${request.convertedTaskId}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
          <CheckCircle2 className="h-4 w-4" /> Open the task <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}

      {mode !== "none" ? (
        <ActionForm action={action} className="mt-3 space-y-2">
          <input type="hidden" name="decline" value={mode === "decline" ? "1" : "0"} />
          <textarea
            name="reply"
            rows={3}
            autoFocus
            className="input"
            placeholder={mode === "decline" ? "Let the client know why…" : "Write your reply to the client…"}
          />
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMode("none")} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={pending} className={mode === "decline" ? "btn-danger" : "btn-primary"}>
              {pending ? "Sending…" : mode === "decline" ? "Decline request" : "Send reply"}
            </button>
          </div>
        </ActionForm>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {request.status === "open" && (
            <>
              <button type="button" onClick={() => setMode("reply")} className="btn-secondary">Reply</button>
              <button
                type="button"
                disabled={pendingConvert}
                onClick={() => startConvert(() => convertRequestToTask(request.id))}
                className="btn-primary"
              >
                {pendingConvert ? "Converting…" : "Convert to task"}
              </button>
              <button type="button" onClick={() => setMode("decline")} className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700">
                Decline
              </button>
            </>
          )}
          {(request.status === "replied" || request.status === "declined") && (
            <button type="button" onClick={() => startConvert(() => reopenRequest(request.id))} className="btn-ghost">
              <RotateCcw className="h-4 w-4" /> Reopen
            </button>
          )}
        </div>
      )}
    </article>
  );
}
