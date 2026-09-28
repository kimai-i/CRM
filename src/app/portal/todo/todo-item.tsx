"use client";

import { useOptimistic, useTransition } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { setMyTaskDone } from "./actions";

export function TodoItem({
  id,
  title,
  description,
  done,
  dueText,
  overdue,
}: {
  id: string;
  title: string;
  description: string | null;
  done: boolean;
  dueText: string | null;
  overdue: boolean;
}) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [, startTransition] = useTransition();
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <button
        type="button"
        aria-label={optimisticDone ? "Mark not done" : "Mark done"}
        onClick={() =>
          startTransition(async () => {
            setOptimisticDone(!optimisticDone);
            await setMyTaskDone(id, !optimisticDone);
          })
        }
        className="mt-0.5"
      >
        {optimisticDone ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-slate-300 hover:text-green-600" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-sm ${optimisticDone ? "text-slate-400 line-through" : "text-slate-900"}`}>{title}</div>
        {description && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-500">{description}</p>}
      </div>
      {dueText && <span className={`shrink-0 text-xs ${overdue ? "font-medium text-red-600" : "text-slate-500"}`}>{dueText}</span>}
    </li>
  );
}
