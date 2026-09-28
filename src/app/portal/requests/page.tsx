import type { Metadata } from "next";
import { CornerDownRight } from "lucide-react";
import { requireClientUser } from "@/lib/auth";
import { getRequestViews } from "@/lib/queries";
import { REQUEST_TYPE_LABEL, timeAgo } from "@/lib/labels";
import { EmptyState } from "@/components/ui";
import { NewPortalRequest } from "./new-portal-request";

export const metadata: Metadata = { title: "Requests" };

// Clients see a simpler status than the team: "converted" just means we're on it.
const CLIENT_STATUS: Record<string, [string, string]> = {
  open: ["Received", "bg-amber-100 text-amber-800"],
  replied: ["Answered", "bg-blue-100 text-blue-700"],
  converted: ["In progress", "bg-green-100 text-green-700"],
  declined: ["Closed", "bg-slate-100 text-slate-600"],
};

export default async function PortalRequestsPage() {
  const user = await requireClientUser();
  const rows = await getRequestViews({ clientId: user.clientId });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            Submit ad changes, content updates, new campaigns, or general questions — your account team gets notified.
          </p>
        </div>
        <NewPortalRequest />
      </div>

      {rows.length === 0 ? (
        <EmptyState>No requests yet. Use “New request” to ask your team for anything.</EmptyState>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const [label, style] = CLIENT_STATUS[r.status];
            return (
              <article key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-500">
                      {REQUEST_TYPE_LABEL[r.type]} · {timeAgo(r.createdAt)}
                    </div>
                    <h3 className="mt-1 font-medium text-slate-900">{r.title}</h3>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${style}`}>{label}</span>
                </div>
                {r.body && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{r.body}</p>}
                {r.reply && (
                  <div className="mt-3 flex gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                    <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500">
                        {r.repliedBy ?? "Your team"}{r.repliedAt ? ` · ${timeAgo(r.repliedAt)}` : ""}
                      </div>
                      <p className="whitespace-pre-wrap text-slate-700">{r.reply}</p>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
