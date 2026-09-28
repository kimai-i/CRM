"use client";

import { useActionState, useEffect } from "react";
import { X } from "lucide-react";
import type { Lookups } from "@/lib/queries";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/labels";
import { createTask, type TaskFormState } from "@/app/(admin)/tasks/actions";
import { ActionForm } from "@/components/action-form";

export type TaskDefaults = {
  title?: string;
  description?: string | null;
  clientId?: string;
  serviceKey?: string;
  ownerId?: string | null;
  status?: keyof typeof STATUS_LABEL;
  priority?: keyof typeof PRIORITY_LABEL;
  dueDate?: string | null;
  estHours?: number | null;
  clientVisible?: boolean;
  assigneeType?: "agency" | "client";
};

/** The shared set of task inputs, used by the add dialog and the task detail page. */
export function TaskFields({ lookups, defaults = {} }: { lookups: Lookups; defaults?: TaskDefaults }) {
  const selectableClients = lookups.clients.filter((c) => c.lifecycle !== "churned" || c.id === defaults.clientId);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="label">Title</span>
        <input name="title" required maxLength={300} defaultValue={defaults.title} className="input mt-1" autoFocus={!defaults.title} />
      </label>
      <label>
        <span className="label">Client</span>
        <select name="clientId" required defaultValue={defaults.clientId ?? ""} className="input mt-1">
          <option value="" disabled>Choose a client…</option>
          {selectableClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>
        <span className="label">Channel</span>
        <select name="serviceKey" required defaultValue={defaults.serviceKey ?? ""} className="input mt-1">
          <option value="" disabled>Choose a channel…</option>
          {lookups.services.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
      </label>
      <label>
        <span className="label">Who does it?</span>
        <select name="assigneeType" defaultValue={defaults.assigneeType ?? "agency"} className="input mt-1">
          <option value="agency">Our team</option>
          <option value="client">The client (shows on their portal To-Do)</option>
        </select>
      </label>
      <label>
        <span className="label">Owner</span>
        <select name="ownerId" defaultValue={defaults.ownerId ?? ""} className="input mt-1">
          <option value="">Unassigned</option>
          {lookups.staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </label>
      <label>
        <span className="label">Due date</span>
        <input name="dueDate" type="date" defaultValue={defaults.dueDate ?? ""} className="input mt-1" />
      </label>
      <label>
        <span className="label">Status</span>
        <select name="status" defaultValue={defaults.status ?? "todo"} className="input mt-1">
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>
        <span className="label">Priority</span>
        <select name="priority" defaultValue={defaults.priority ?? "medium"} className="input mt-1">
          {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>
        <span className="label">Estimated hours</span>
        <input name="estHours" type="number" min={0} step={0.25} defaultValue={defaults.estHours ?? ""} className="input mt-1" />
      </label>
      <label className="flex items-center gap-2 self-end pb-2">
        <input name="clientVisible" type="checkbox" defaultChecked={defaults.clientVisible ?? true} className="h-4 w-4 rounded border-slate-300" />
        <span className="text-sm text-slate-700">Client can see this task</span>
      </label>
      <label className="sm:col-span-2">
        <span className="label">Description</span>
        <textarea name="description" rows={4} defaultValue={defaults.description ?? ""} className="input mt-1" placeholder="Details, links, notes…" />
      </label>
    </div>
  );
}

export function AddTaskDialog({
  lookups,
  defaults,
  onClose,
}: {
  lookups: Lookups;
  defaults?: TaskDefaults;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<TaskFormState, FormData>(createTask, {});

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">New task</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ActionForm action={action} className="p-5">
          <TaskFields lookups={lookups} defaults={defaults} />
          {state.error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Create task"}</button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
