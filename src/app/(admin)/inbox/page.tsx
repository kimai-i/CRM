import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getTeamForInbox, getThreadMessages, getThreadsFor, markReadNow } from "@/lib/inbox-queries";
import { timeAgo } from "@/lib/labels";
import { Avatar, PageHeader } from "@/components/ui";
import { ArchiveButton, AutoRefresh, Composer, NewMessageButton, ScrollToBottom } from "./inbox-client";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const showArchived = sp.view === "archived";
  const [allThreads, team] = await Promise.all([getThreadsFor(me.id), getTeamForInbox(me.id)]);
  const list = allThreads.filter((t) => t.archived === showArchived);
  const selectedId = typeof sp.thread === "string" ? sp.thread : list[0]?.id;
  const selected = allThreads.find((t) => t.id === selectedId);
  const thread = selected ? await getThreadMessages(selected.id, me.id) : null;
  if (selected && thread) await markReadNow(selected.id, me.id);

  const archivedCount = allThreads.filter((t) => t.archived).length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Inbox" subtitle="Team chat that stays in the CRM." actions={<NewMessageButton team={team} />} />
      <AutoRefresh />
      <div className="grid h-[calc(100vh-14rem)] min-h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white md:grid-cols-[300px_1fr]">
        {/* Thread list */}
        <aside className="flex min-h-0 flex-col border-b border-slate-200 md:border-b-0 md:border-r">
          <div className="flex gap-1 border-b border-slate-100 p-2 text-sm">
            <Link href="/inbox" className={`flex-1 rounded-md px-2 py-1 text-center ${!showArchived ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              Active ({allThreads.length - archivedCount})
            </Link>
            <Link href="/inbox?view=archived" className={`flex-1 rounded-md px-2 py-1 text-center ${showArchived ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              Archived ({archivedCount})
            </Link>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {list.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">{showArchived ? "Nothing archived." : "No conversations yet."}</li>}
            {list.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/inbox?thread=${t.id}${showArchived ? "&view=archived" : ""}`}
                  className={`flex gap-3 border-b border-slate-50 px-3 py-2.5 hover:bg-slate-50 ${t.id === selected?.id ? "bg-indigo-50/60" : ""}`}
                >
                  {t.isGroup || t.people.length !== 1 ? (
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600"><Users className="h-4 w-4" /></span>
                  ) : (
                    <Avatar initials={t.people[0].initials} color={t.people[0].color} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-sm ${t.unread && t.id !== selected?.id ? "font-semibold text-slate-900" : "text-slate-800"}`}>{t.name}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(t.lastMessageAt)}</span>
                    </div>
                    <div className="truncate text-xs text-slate-500">{t.preview ? `${t.previewSender ?? "Someone"}: ${t.preview}` : "No messages"}</div>
                  </div>
                  {t.unread && t.id !== selected?.id && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-600" aria-label="Unread" />}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        {/* Conversation */}
        <section className="flex min-h-0 flex-col">
          {!selected || !thread ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
              {allThreads.length === 0 ? "Start a conversation with New message." : "Pick a conversation."}
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{selected.name}</div>
                  <div className="truncate text-xs text-slate-500">You, {selected.people.map((p) => p.name).join(", ")}</div>
                </div>
                <ArchiveButton threadId={selected.id} archived={selected.archived} />
              </header>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {thread.map((m) => {
                  const mine = m.senderId === me.id;
                  return (
                    <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                      <Avatar initials={m.senderInitials ?? "?"} color={m.senderColor ?? "#94a3b8"} size="sm" />
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                        {!mine && <div className="text-[11px] font-medium text-slate-500">{m.senderName ?? "Former teammate"}</div>}
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <div className={`mt-0.5 text-[10px] ${mine ? "text-indigo-200" : "text-slate-400"}`}>{timeAgo(m.createdAt)}</div>
                      </div>
                    </div>
                  );
                })}
                <ScrollToBottom dep={thread.length} />
              </div>
              <Composer threadId={selected.id} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
