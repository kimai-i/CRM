import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getLookups, getRequestViews } from "@/lib/queries";
import { REQUEST_STATUS_LABEL } from "@/lib/labels";
import { EmptyState, PageHeader } from "@/components/ui";
import { RequestCard } from "@/components/request-card";
import { NewRequestButton } from "./new-request-button";

export const metadata: Metadata = { title: "Requests" };

const TABS = ["open", "replied", "converted", "declined", "all"] as const;
type Tab = (typeof TABS)[number];

export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  await requireStaff();
  const raw = (await searchParams).status;
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "open";

  const [all, lookups] = await Promise.all([getRequestViews(), getLookups()]);
  const shown = tab === "all" ? all : all.filter((r) => r.status === tab);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Requests"
        subtitle="Client-submitted asks. Triage → reply, decline, or convert to a task."
        actions={<NewRequestButton clients={lookups.clients} />}
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const count = t === "all" ? all.length : all.filter((r) => r.status === t).length;
          const active = t === tab;
          return (
            <Link
              key={t}
              href={`/requests?status=${t}`}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${
                active ? "border-indigo-600 font-medium text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t === "all" ? "All" : REQUEST_STATUS_LABEL[t]}
              <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-indigo-100" : "bg-slate-100"}`}>{count}</span>
            </Link>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <EmptyState>{tab === "open" ? "No open requests. You're all caught up." : "No requests here yet."}</EmptyState>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => <RequestCard key={r.id} request={r} />)}
        </div>
      )}
    </div>
  );
}
