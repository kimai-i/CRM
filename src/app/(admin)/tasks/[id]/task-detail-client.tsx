"use client";

import Link from "next/link";
import { useActionState, useOptimistic, useTransition } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import type { Lookups } from "@/lib/queries";
import { TaskFields, type TaskDefaults } from "@/components/task-form";
import { saveTaskDetails, updateTask, type TaskFormState } from "../actions";
import { ActionForm } from "@/components/action-form";

export function TaskDetailsForm({ taskId, lookups, defaults }: { taskId: string; lookups: Lookups; defaults: TaskDefaults }) {
  const [state, action, pending] = useActionState<TaskFormState, FormData>(saveTaskDetails.bind(null, taskId), {});

  return (
    <ActionForm action={action}>
      <TaskFields lookups={lookups} defaults={defaults} />
      <div className="mt-5 flex items-center justify-end gap-3">
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && !pending && <p className="text-sm text-green-600">Saved.</p>}
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save changes"}</button>
      </div>
    </ActionForm>
  );
}

export function SubtaskItem({ id, title, done }: { id: string; title: string; done: boolean }) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      setOptimisticDone(!optimisticDone);
      await updateTask(id, { status: optimisticDone ? "todo" : "done" });
    });
  }

  return (
    <li className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-50">
      <button type="button" onClick={toggle} aria-label={optimisticDone ? "Mark not done" : "Mark done"}>
        {optimisticDone ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-slate-300" />}
      </button>
      <Link href={`/tasks/${id}`} className={`flex-1 truncate text-sm ${optimisticDone ? "text-slate-400 line-through" : "text-slate-700"}`}>
        {title}
      </Link>
    </li>
  );
}
