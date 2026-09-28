import { asc, eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { isAdmin, requireStaff } from "@/lib/auth";
import { runRecurringIfDue } from "@/lib/recurring";
import { getRunningTimer } from "@/lib/time-queries";
import { countUnreadThreads } from "@/lib/inbox-queries";
import { requests } from "@/db/schema";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const user = await requireStaff();
  // No background scheduler yet: the first team page view each day creates that day's routine tasks.
  await runRecurringIfDue();

  // "View as client" is for owners and admins only.
  const viewableClients = isAdmin(user.role)
    ? await db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(and(eq(clients.isInternal, false), ne(clients.lifecycle, "churned")))
        .orderBy(asc(clients.name))
    : null;

  const [running, unreadThreads, [openRequests]] = await Promise.all([
    getRunningTimer(user.id),
    countUnreadThreads(user.id),
    db.select({ n: sql<number>`count(*)` }).from(requests).where(eq(requests.status, "open")),
  ]);
  const badges = { "/inbox": unreadThreads, "/requests": Number(openRequests?.n ?? 0) };
  const timer = running ? { startedAt: running.startedAt, label: running.clientName } : null;

  const shellUser = { name: user.name, role: user.role, initials: user.initials, color: user.color, email: user.email };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={shellUser} badges={badges} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={shellUser} viewableClients={viewableClients} timer={timer} />
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
