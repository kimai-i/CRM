import Link from "next/link";
import { Bell, LogOut, Search, Settings } from "lucide-react";
import { Avatar } from "@/components/ui";
import { logout } from "@/app/login/actions";
import { ROLE_LABEL } from "@/lib/labels";
import { ViewAsClientPicker } from "@/components/view-as-client-picker";
import { RunningTimerPill } from "@/app/(admin)/time/time-client";

type TopbarUser = { name: string; email: string; role: keyof typeof ROLE_LABEL; initials: string; color: string };

export function Topbar({
  user,
  viewableClients,
  timer,
}: {
  user: TopbarUser;
  /** The running time-tracking timer, shown as a live pill. */
  timer: { startedAt: string; label: string } | null;
  /** Clients for the "View as client" picker; null hides it (non-admins). */
  viewableClients: { id: string; name: string }[] | null;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
      <div className="flex max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400" title="Search is coming soon">
        <Search className="h-4 w-4" />
        <span className="truncate">Search clients and tasks…</span>
      </div>
      <div className="ml-auto" />
      {timer && <RunningTimerPill startedAt={timer.startedAt} label={timer.label} />}
      {viewableClients && viewableClients.length > 0 && <ViewAsClientPicker clients={viewableClients} />}
      <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications" title="Notifications are coming soon">
        <Bell className="h-5 w-5" />
      </button>

      <details className="relative">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg p-1 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
          <span className="hidden rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white sm:inline">
            {user.role}
          </span>
          <Avatar initials={user.initials} color={user.color} />
        </summary>
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2">
            <div className="truncate text-sm font-medium text-slate-900">{user.name}</div>
            <div className="truncate text-xs text-slate-500">{user.email}</div>
          </div>
          <Link href="/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <form action={logout}>
            <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </form>
        </div>
      </details>
    </header>
  );
}
