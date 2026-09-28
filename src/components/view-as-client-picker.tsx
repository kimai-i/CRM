"use client";

import { useTransition } from "react";
import { Eye } from "lucide-react";
import { startViewAsClient } from "@/app/portal/view-as-actions";

export function ViewAsClientPicker({ clients }: { clients: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <label className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600 lg:flex">
      <Eye className="h-4 w-4 text-slate-400" />
      <span className="sr-only">View as client</span>
      <select
        value=""
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          if (id) startTransition(() => startViewAsClient(id));
        }}
        className="max-w-[170px] bg-transparent py-0.5 text-sm focus:outline-none"
      >
        <option value="">{pending ? "Opening…" : "View as client"}</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </label>
  );
}
