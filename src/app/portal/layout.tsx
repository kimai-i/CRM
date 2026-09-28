import { eq } from "drizzle-orm";
import { Eye, LogOut } from "lucide-react";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireClientUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { logout } from "@/app/login/actions";
import { Avatar } from "@/components/ui";
import { PortalNav } from "./portal-nav";
import { exitViewAsClient } from "./view-as-actions";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const viewer = await requireClientUser();
  const [client] = await db.select().from(clients).where(eq(clients.id, viewer.clientId));

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {viewer.impersonating && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-orange-500 px-4 py-2 text-sm text-white">
          <span className="flex items-center gap-2">
            <Eye className="h-4 w-4 shrink-0" />
            <span>
              <strong>Acting as {client?.name}</strong> — this is exactly what they see. Anything you submit (like requests) saves as this client.
            </span>
          </span>
          <form action={exitViewAsClient}>
            <button type="submit" className="rounded-md bg-white px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-50">
              Exit preview
            </button>
          </form>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white md:w-60 md:border-b-0 md:border-r">
          <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white">A1</div>
            <span className="font-semibold text-slate-900">{APP_NAME}</span>
          </div>
          <div className="hidden px-4 pt-4 md:block">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Your account</div>
            <div className="mt-1 font-medium text-slate-900">{client?.name}</div>
          </div>
          <PortalNav />
          <div className="hidden items-center gap-2.5 border-t border-slate-200 p-3 md:flex">
            <Avatar initials={viewer.initials} color={viewer.color} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-900">{viewer.name}</div>
              <div className="text-xs text-slate-500">{viewer.impersonating ? "Previewing as client" : "Client"}</div>
            </div>
            {!viewer.impersonating && (
              <form action={logout}>
                <button type="submit" className="btn-ghost p-1.5" aria-label="Log out" title="Log out">
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mb-6 text-sm text-slate-500">{client?.name} portal</div>
          {children}
          {!viewer.impersonating && (
            <form action={logout} className="mt-10 md:hidden">
              <button type="submit" className="btn-secondary w-full"><LogOut className="h-4 w-4" /> Log out</button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
