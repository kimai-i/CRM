"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { deleteSop, saveSop, type SopState } from "@/app/(admin)/sops/actions";
import { ActionForm } from "@/components/action-form";

export type SopView = {
  id: string;
  category: string;
  title: string;
  body: string | null;
  videoUrl: string | null;
  visibility: "team" | "client" | "both";
  published: boolean;
  updatedAt: string;
};

const VISIBILITY_LABEL = { team: "Team only", client: "Clients only", both: "Team + clients" } as const;

/** Guides grouped by category. Team mode adds edit/delete; client mode is read-only. */
export function SopLibrary({ sops, mode, categories }: { sops: SopView[]; mode: "team" | "client"; categories: string[] }) {
  const [editing, setEditing] = useState<SopView | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const groups = [...new Set(sops.map((s) => s.category))].sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      {mode === "team" && (
        <div className="flex justify-end">
          <button type="button" onClick={() => setEditing("new")} className="btn-primary"><Plus className="h-4 w-4" /> New guide</button>
        </div>
      )}
      {sops.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          {mode === "team" ? "No guides yet. Write step-by-steps for your team, or how-tos for clients." : "No guides yet. Questions? Send a request and we'll help."}
        </div>
      )}
      {groups.map((cat) => (
        <section key={cat}>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">{cat} <span className="font-normal text-slate-400">· {sops.filter((s) => s.category === cat).length}</span></h2>
          <div className="space-y-2">
            {sops.filter((s) => s.category === cat).map((s) => {
              const open = openId === s.id;
              return (
                <article key={s.id} className="rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-2 px-4 py-3">
                    <button type="button" onClick={() => setOpenId(open ? null : s.id)} className="min-w-0 flex-1 text-left">
                      <div className="truncate font-medium text-slate-900">{s.title}</div>
                      {mode === "team" && (
                        <div className="text-xs text-slate-500">
                          {VISIBILITY_LABEL[s.visibility]}{s.published ? "" : " · Draft"} · updated {new Date(s.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      )}
                    </button>
                    {mode === "team" && (
                      <>
                        <button type="button" onClick={() => setEditing(s)} className="btn-ghost p-1" aria-label="Edit guide"><Pencil className="h-4 w-4" /></button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm(`Delete "${s.title}"?`)) startTransition(() => deleteSop(s.id));
                          }}
                          className="btn-ghost p-1 text-red-600 hover:bg-red-50"
                          aria-label="Delete guide"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                  {open && (
                    <div className="border-t border-slate-100 px-4 py-3">
                      {s.videoUrl && (
                        <a href={s.videoUrl} target="_blank" rel="noreferrer" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
                          Watch the video <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {s.body ? <p className="whitespace-pre-wrap text-sm text-slate-700">{s.body}</p> : !s.videoUrl && <p className="text-sm text-slate-400">No content yet.</p>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {editing && <SopDialog sop={editing === "new" ? null : editing} categories={categories} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SopDialog({ sop, categories, onClose }: { sop: SopView | null; categories: string[]; onClose: () => void }) {
  const [state, action, pending] = useActionState<SopState, FormData>(saveSop.bind(null, sop?.id ?? null), {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[5vh]" onMouseDown={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{sop ? "Edit guide" : "New guide"}</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <ActionForm action={action} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="label">Title</span>
              <input name="title" required maxLength={300} defaultValue={sop?.title} className="input mt-1" />
            </label>
            <label>
              <span className="label">Category</span>
              <input name="category" required maxLength={100} list="sop-categories" defaultValue={sop?.category ?? "General"} className="input mt-1" />
              <datalist id="sop-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label>
              <span className="label">Who can see it</span>
              <select name="visibility" defaultValue={sop?.visibility ?? "team"} className="input mt-1">
                {Object.entries(VISIBILITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="label">Video link (optional)</span>
              <input name="videoUrl" type="url" maxLength={1000} defaultValue={sop?.videoUrl ?? ""} placeholder="https://" className="input mt-1" />
            </label>
            <label className="sm:col-span-2">
              <span className="label">Steps / content</span>
              <textarea name="body" rows={10} maxLength={50000} defaultValue={sop?.body ?? ""} className="input mt-1 font-mono text-[13px]" />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input name="published" type="checkbox" defaultChecked={sop?.published ?? true} className="h-4 w-4 rounded border-slate-300" />
            <span className="text-sm text-slate-700">Published (clients only see published guides)</span>
          </label>
          {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save guide"}</button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
