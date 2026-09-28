import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { requireClientUser } from "@/lib/auth";
import { getActionItems, getMeetingList } from "@/lib/meeting-queries";
import { EmptyState } from "@/components/ui";
import { ActionItems } from "@/app/(admin)/meetings/action-items";

export const metadata: Metadata = { title: "Meetings" };

export default async function PortalMeetingsPage() {
  const viewer = await requireClientUser();
  // Only meetings the team chose to share with this client.
  const list = await getMeetingList({ clientId: viewer.clientId, visibleToClientOnly: true });
  const ids = list.map((m) => m.id);
  const [details, items] = await Promise.all([
    ids.length ? db.select({ id: meetings.id, summary: meetings.summary, recordingUrl: meetings.recordingUrl }).from(meetings).where(inArray(meetings.id, ids)) : [],
    getActionItems(ids),
  ]);
  const detailById = new Map(details.map((d) => [d.id, d]));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Meetings</h1>
        <p className="mt-1 text-sm text-slate-500">Summaries and action items from our calls together.</p>
      </div>
      {list.length === 0 ? (
        <EmptyState>No meeting notes shared yet. After our next call, the summary and your action items will show up here.</EmptyState>
      ) : (
        list.map((m) => {
          const d = detailById.get(m.id);
          return (
            <article key={m.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-slate-900">{m.title}</h2>
                <span className="text-xs text-slate-500" suppressHydrationWarning>
                  {new Date(m.startsAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              {d?.summary && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{d.summary}</p>}
              {d?.recordingUrl && (
                <a href={d.recordingUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
                  Watch the recording <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {(items.get(m.id)?.length ?? 0) > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Action items</h3>
                  <ActionItems meetingId={m.id} items={items.get(m.id) ?? []} mode="client" />
                </div>
              )}
            </article>
          );
        })
      )}
    </div>
  );
}
