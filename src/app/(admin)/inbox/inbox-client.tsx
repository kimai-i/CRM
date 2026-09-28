"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Plus, Send, X } from "lucide-react";
import { sendMessage, setThreadArchived, startThread, type InboxState } from "./actions";
import { ActionForm } from "@/components/action-form";

/** Re-fetches the page every few seconds so new messages appear without a reload. */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

export function Composer({ threadId }: { threadId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      ref={form}
      action={(fd) =>
        startTransition(async () => {
          await sendMessage(threadId, fd);
          form.current?.reset();
        })
      }
      className="flex items-end gap-2 border-t border-slate-200 p-3"
    >
      <textarea
        name="body"
        required
        rows={2}
        maxLength={10000}
        placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
        className="input flex-1 resize-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            form.current?.requestSubmit();
          }
        }}
      />
      <button type="submit" disabled={pending} className="btn-primary"><Send className="h-4 w-4" /> Send</button>
    </form>
  );
}

export function ScrollToBottom({ dep }: { dep: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "end" });
  }, [dep]);
  return <div ref={ref} />;
}

export function ArchiveButton({ threadId, archived }: { threadId: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => startTransition(() => setThreadArchived(threadId, !archived))} className="btn-ghost text-xs">
      {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} {archived ? "Unarchive" : "Archive"}
    </button>
  );
}

export function NewMessageButton({ team }: { team: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<InboxState, FormData>(startThread, {});
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> New message</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-[10vh]" onMouseDown={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="font-semibold text-slate-900">New message</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost p-1" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <ActionForm action={action} className="space-y-4 p-5">
              {team.length === 0 ? (
                <p className="text-sm text-slate-500">Add team members in Settings → Team to start chatting.</p>
              ) : (
                <fieldset>
                  <legend className="label">To</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {team.map((u) => (
                      <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-transparent has-[:checked]:bg-indigo-50 has-[:checked]:text-indigo-700">
                        <input type="checkbox" name="members" value={u.id} className="sr-only" />
                        {u.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <label className="block">
                <span className="label">Group name (optional)</span>
                <input name="title" maxLength={200} placeholder="Leave empty for a direct message" className="input mt-1" />
              </label>
              <label className="block">
                <span className="label">Message</span>
                <textarea name="body" required rows={4} maxLength={10000} className="input mt-1" />
              </label>
              {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={pending || team.length === 0} className="btn-primary">{pending ? "Sending…" : "Send"}</button>
              </div>
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}
