"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { CheckCircle2, Circle, ListChecks, Plus, Trash2 } from "lucide-react";
import { PROFILE_SECTIONS } from "@/lib/onboarding";
import { ActionForm } from "@/components/action-form";
import {
  addChecklistItem,
  applyStandardChecklist,
  deleteChecklistItem,
  setChecklistItemDone,
  setMyChecklistItemDone,
  type ProfileState,
} from "@/app/(admin)/onboarding/actions";

export type ChecklistItemView = { id: string; title: string; description: string | null; assignee: "agency" | "client"; doneAt: string | null };

export function Checklist({ items, clientId, mode }: { items: ChecklistItemView[]; clientId: string; mode: "team" | "client" }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(items, (state, change: { id: string; done: boolean }) =>
    state.map((i) => (i.id === change.id ? { ...i, doneAt: change.done ? new Date().toISOString() : null } : i)),
  );
  const done = optimistic.filter((i) => i.doneAt).length;

  function toggle(item: ChecklistItemView) {
    const next = !item.doneAt;
    startTransition(async () => {
      setOptimistic({ id: item.id, done: next });
      await (mode === "team" ? setChecklistItemDone(item.id, next) : setMyChecklistItemDone(item.id, next));
    });
  }

  const groups = [
    { key: "client" as const, title: mode === "client" ? "What we need from you" : "Client's to-dos" },
    { key: "agency" as const, title: mode === "client" ? "What we're doing" : "Agency to-dos" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-800">{done} of {optimistic.length} done</span>
          <span className="text-slate-500">{optimistic.length ? Math.round((done / optimistic.length) * 100) : 0}%</span>
        </div>
        <div className="mt-1.5 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${optimistic.length ? (done / optimistic.length) * 100 : 0}%` }} />
        </div>
      </div>

      {optimistic.length === 0 && mode === "team" && (
        <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          No checklist yet.{" "}
          <button type="button" disabled={pending} onClick={() => startTransition(() => applyStandardChecklist(clientId))} className="font-medium text-indigo-600 hover:underline">
            Add the standard onboarding checklist
          </button>
        </div>
      )}

      {groups.map((g) => {
        const groupItems = optimistic.filter((i) => i.assignee === g.key);
        if (groupItems.length === 0) return null;
        return (
          <div key={g.key}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.title}</h3>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {groupItems.map((item) => {
                const canTick = mode === "team" || item.assignee === "client";
                return (
                  <li key={item.id} className="flex items-start gap-3 px-3 py-2.5">
                    <button
                      type="button"
                      disabled={!canTick}
                      onClick={() => toggle(item)}
                      aria-label={item.doneAt ? "Mark not done" : "Mark done"}
                      className="mt-0.5 disabled:cursor-default"
                    >
                      {item.doneAt ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className={`h-5 w-5 ${canTick ? "text-slate-300 hover:text-green-600" : "text-slate-200"}`} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm ${item.doneAt ? "text-slate-400 line-through" : "text-slate-900"}`}>{item.title}</div>
                      {item.description && <div className="text-xs text-slate-500">{item.description}</div>}
                    </div>
                    {mode === "team" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove "${item.title}" from the checklist?`)) startTransition(() => deleteChecklistItem(item.id));
                        }}
                        className="btn-ghost p-1 text-slate-400 hover:text-red-600"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {mode === "team" && (
        <form action={addChecklistItem.bind(null, clientId)} className="flex flex-wrap gap-2">
          <input name="title" required maxLength={300} placeholder="Add a checklist item…" className="input min-w-[200px] flex-1" />
          <select name="assignee" defaultValue="agency" className="input w-auto">
            <option value="agency">Agency does it</option>
            <option value="client">Client does it</option>
          </select>
          <button type="submit" className="btn-secondary"><Plus className="h-4 w-4" /> Add</button>
          {optimistic.length > 0 && (
            <button type="button" disabled={pending} onClick={() => startTransition(() => applyStandardChecklist(clientId))} className="btn-ghost" title="Adds any standard items that are missing">
              <ListChecks className="h-4 w-4" /> Add missing standard items
            </button>
          )}
        </form>
      )}
    </div>
  );
}

export function ProfileForm({
  answers,
  submittedAt,
  action,
  audience,
}: {
  answers: Record<string, string>;
  submittedAt: string | null;
  action: (prev: ProfileState, formData: FormData) => Promise<ProfileState>;
  audience: "team" | "client";
}) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(action, {});

  return (
    <ActionForm action={formAction} className="space-y-6">
      {PROFILE_SECTIONS.map((section) => (
        <fieldset key={section.id} className="rounded-xl border border-slate-200 bg-white p-5">
          <legend className="px-1 text-sm font-semibold text-slate-900">{section.title}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.questions.map((q) => (
              <label key={q.id} className={q.type === "textarea" ? "sm:col-span-2" : ""}>
                <span className="label">{q.label}</span>
                {q.help && <span className="block text-xs text-slate-400">{q.help}</span>}
                {q.type === "textarea" ? (
                  <textarea name={q.id} rows={3} maxLength={5000} defaultValue={answers[q.id] ?? ""} className="input mt-1" />
                ) : (
                  <input name={q.id} maxLength={5000} defaultValue={answers[q.id] ?? ""} className="input mt-1" />
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-1 py-3 backdrop-blur">
        {submittedAt && <span className="mr-auto text-xs text-slate-500">Submitted {new Date(submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && !pending && <span className="text-sm text-green-700">{state.submitted ? "Submitted — thank you!" : "Saved."}</span>}
        <button type="submit" name="intent" value="save" disabled={pending} className="btn-secondary">Save progress</button>
        <button type="submit" name="intent" value="submit" disabled={pending} className="btn-primary">
          {audience === "client" ? "Submit to our team" : "Save and mark submitted"}
        </button>
      </div>
    </ActionForm>
  );
}
