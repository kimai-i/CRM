"use client";

import { useActionState, useRef, useTransition } from "react";
import { FileText, Trash2 } from "lucide-react";
import type { Applicant } from "@/db/schema";
import { formatPhone } from "@/lib/leads";
import { UploadButton } from "@/components/upload-button";
import { addApplicant, attachResume, deleteApplicant, setApplicantStatus, type ApplicantState } from "@/app/(admin)/applicants/actions";
import { ActionForm } from "@/components/action-form";

export type ApplicantView = Pick<Applicant, "id" | "name" | "email" | "phone" | "role" | "notes" | "status" | "submittedAt" | "resumeAssetId">;

const STATUS_LABEL = { new: "New", reviewed: "Reviewed", interviewing: "Interviewing", hired: "Hired", rejected: "Not a fit" } as const;
const STATUS_STYLE = { new: "bg-amber-100 text-amber-800", reviewed: "bg-slate-100 text-slate-700", interviewing: "bg-blue-100 text-blue-700", hired: "bg-green-100 text-green-700", rejected: "bg-slate-100 text-slate-400" } as const;

export function ApplicantList({ applicants, mode, clientId }: { applicants: ApplicantView[]; mode: "team" | "client"; clientId: string }) {
  const [pending, startTransition] = useTransition();
  if (applicants.length === 0) return <p className="px-4 py-8 text-center text-sm text-slate-500">No applicants yet.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {applicants.map((a) => (
        <li key={a.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-slate-900">{a.name}{a.role && <span className="font-normal text-slate-500"> · {a.role}</span>}</div>
            <div className="text-xs text-slate-500">
              {[a.email, a.phone ? formatPhone(a.phone) : null, new Date(a.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })].filter(Boolean).join(" · ")}
            </div>
            {a.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{a.notes}</p>}
          </div>
          {a.resumeAssetId ? (
            <a href={`/files/${a.resumeAssetId}`} target="_blank" rel="noreferrer" className="btn-ghost text-xs"><FileText className="h-4 w-4" /> Resume</a>
          ) : mode === "team" ? (
            <UploadButton
              fields={{ purpose: "resume", clientId }}
              multiple={false}
              accept=".pdf,.doc,.docx,.txt,.rtf"
              label="Attach resume"
              className="btn-ghost text-xs"
              onUploaded={(saved) => saved[0] && startTransition(() => attachResume(a.id, saved[0].id))}
            />
          ) : null}
          <select
            value={a.status}
            disabled={pending}
            onChange={(e) => startTransition(() => setApplicantStatus(a.id, e.target.value as ApplicantView["status"], mode))}
            className={`rounded-full border-0 px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[a.status]}`}
          >
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {mode === "team" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Delete ${a.name}'s application?`)) startTransition(() => deleteApplicant(a.id));
              }}
              className="btn-ghost p-1 text-red-600 hover:bg-red-50"
              aria-label="Delete applicant"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AddApplicantForm({ clientId }: { clientId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ApplicantState, FormData>(async (prev, fd) => {
    const res = await addApplicant(clientId, prev, fd);
    if (res.ok) form.current?.reset();
    return res;
  }, {});
  return (
    <ActionForm ref={form} action={action} className="grid gap-3 sm:grid-cols-2">
      <input name="name" required maxLength={200} placeholder="Name" className="input" />
      <input name="role" maxLength={200} placeholder="Position applied for" className="input" />
      <input name="email" type="email" maxLength={200} placeholder="Email" className="input" />
      <input name="phone" maxLength={50} placeholder="Phone" className="input" />
      <textarea name="notes" rows={2} maxLength={5000} placeholder="Notes" className="input sm:col-span-2" />
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-secondary">{pending ? "Adding…" : "Add applicant"}</button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </ActionForm>
  );
}
