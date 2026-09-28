import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Eye, Globe, Mail, Pencil, Phone } from "lucide-react";
import { db } from "@/db";
import { clientOwners, clients, clientServices, users } from "@/db/schema";
import { isAdmin, requireStaff } from "@/lib/auth";
import { startViewAsClient } from "@/app/portal/view-as-actions";
import { getLookups, getRequestViews, getTaskRows } from "@/lib/queries";
import { LIFECYCLE_LABEL } from "@/lib/labels";
import { toDateString } from "@/lib/dates";
import { Avatar, Card, EmptyState } from "@/components/ui";
import { TaskBoard } from "@/components/task-board";
import { RequestCard } from "@/components/request-card";
import { NewRequestButton } from "../../requests/new-request-button";
import { AddPortalUserForm, PortalUserToggle } from "./portal-users";
import { getOnboarding } from "@/lib/onboarding-queries";
import { Checklist, ProfileForm } from "@/components/onboarding-views";
import { saveProfileAsStaff } from "../../onboarding/actions";
import { desc as descOrder } from "drizzle-orm";
import { applicants } from "@/db/schema";
import { getAssets } from "@/lib/asset-queries";
import { AssetList } from "@/components/asset-list";
import { AssetUploader } from "../../assets/asset-uploader";
import { getClientInvoices, nextInvoiceNumber } from "@/lib/invoice-queries";
import { InvoiceManager } from "../../invoices/invoice-manager";
import { AddApplicantForm, ApplicantList } from "@/components/applicant-views";

const TABS = [
  { key: "tasks", label: "Tasks" },
  { key: "requests", label: "Requests" },
  { key: "onboarding", label: "Onboarding" },
  { key: "profile", label: "Business profile" },
  { key: "files", label: "Files" },
  { key: "invoices", label: "Invoices" },
  { key: "applicants", label: "Applicants" },
  { key: "details", label: "Details" },
  { key: "portal", label: "Portal logins" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const LIFECYCLE_STYLE: Record<string, string> = {
  onboarding: "bg-violet-100 text-violet-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-800",
  churned: "bg-slate-100 text-slate-600",
};

export async function generateMetadata({ params }: PageProps<"/clients/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [client] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, id));
  return { title: client?.name ?? "Client" };
}

export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const rawTab = (await searchParams).tab;
  const tab: Tab = TABS.some((t) => t.key === rawTab) ? (rawTab as Tab) : "tasks";
  const user = await requireStaff();

  const [client] = await db.select().from(clients).where(eq(clients.id, id));
  if (!client) notFound();

  const [lookups, svc, owners] = await Promise.all([
    getLookups(),
    db.select().from(clientServices).where(eq(clientServices.clientId, id)),
    db.select().from(clientOwners).where(eq(clientOwners.clientId, id)),
  ]);
  const serviceByKey = new Map(lookups.services.map((s) => [s.key, s]));
  const staffById = new Map(lookups.staff.map((u) => [u.id, u]));

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold text-white" style={{ backgroundColor: client.color }}>
            {client.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{client.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LIFECYCLE_STYLE[client.lifecycle]}`}>
                {LIFECYCLE_LABEL[client.lifecycle]}
              </span>
              {client.isInternal && <span className="rounded bg-slate-200 px-1.5 text-[10px] font-semibold uppercase text-slate-600">Internal</span>}
              {svc.map((s) => {
                const service = serviceByKey.get(s.serviceKey);
                return service ? (
                  <span key={s.serviceKey} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${service.color}1a`, color: service.color }}>
                    {service.name}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin(user.role) && !client.isInternal && (
            <form action={startViewAsClient.bind(null, id)}>
              <button type="submit" className="btn-secondary" title="Open their portal exactly as they see it">
                <Eye className="h-4 w-4" /> View as client
              </button>
            </form>
          )}
          <Link href={`/clients/${id}/edit`} className="btn-secondary">
            <Pencil className="h-4 w-4" /> Edit client
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/clients/${id}?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === t.key ? "border-indigo-600 font-medium text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "tasks" && (
        <TaskBoard
          tasks={await getTaskRows({ clientId: id })}
          lookups={lookups}
          today={toDateString(new Date())}
          currentUserId={user.id}
          defaults={{ clientId: id, serviceKey: svc[0]?.serviceKey }}
          defaultGroup="service"
          hideClient
        />
      )}

      {tab === "requests" && <RequestsTab clientId={id} clients={lookups.clients} />}

      {tab === "onboarding" && <OnboardingTab clientId={id} />}

      {tab === "profile" && <ProfileTab clientId={id} />}

      {tab === "files" && <FilesTab clientId={id} />}

      {tab === "invoices" && (
        <InvoiceManager clientId={id} invoices={await getClientInvoices(id)} today={toDateString(new Date())} nextNumber={await nextInvoiceNumber()} />
      )}

      {tab === "applicants" && <ApplicantsTab clientId={id} />}

      {tab === "details" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Main contact">
            {client.isInternal ? (
              <p className="text-sm text-slate-500">Internal — no client contact.</p>
            ) : (
              <dl className="space-y-2 text-sm">
                <div className="font-medium text-slate-900">{client.contactName ?? "No contact name yet"}</div>
                {client.contactEmail && <div className="flex items-center gap-2 text-slate-600"><Mail className="h-4 w-4 text-slate-400" /><a href={`mailto:${client.contactEmail}`} className="hover:underline">{client.contactEmail}</a></div>}
                {client.contactPhone && <div className="flex items-center gap-2 text-slate-600"><Phone className="h-4 w-4 text-slate-400" />{client.contactPhone}</div>}
                {client.website && <div className="flex items-center gap-2 text-slate-600"><Globe className="h-4 w-4 text-slate-400" /><a href={client.website} target="_blank" rel="noreferrer" className="hover:underline">{client.website}</a></div>}
              </dl>
            )}
          </Card>
          <Card title="Account owners">
            {owners.length === 0 ? (
              <p className="text-sm text-slate-500">No owners assigned. <Link href={`/clients/${id}/edit`} className="text-indigo-600 hover:underline">Assign one</Link>.</p>
            ) : (
              <ul className="space-y-2">
                {owners.map((o) => {
                  const u = staffById.get(o.userId);
                  return u ? (
                    <li key={o.userId} className="flex items-center gap-2 text-sm text-slate-700">
                      <Avatar initials={u.initials} color={u.color} size="sm" /> {u.name}
                    </li>
                  ) : null;
                })}
              </ul>
            )}
          </Card>
          <Card title="Notes" className="lg:col-span-2">
            {client.notes ? <p className="whitespace-pre-wrap text-sm text-slate-700">{client.notes}</p> : <p className="text-sm text-slate-500">No notes yet.</p>}
          </Card>
        </div>
      )}

      {tab === "portal" && <PortalTab clientId={id} clientName={client.name} />}
    </div>
  );
}

async function FilesTab({ clientId }: { clientId: string }) {
  const files = await getAssets({ clientId, purpose: "asset" });
  return (
    <div className="max-w-3xl">
      <Card title={`Files (${files.length})`}>
        <AssetUploader clientId={clientId} />
        <AssetList items={files} mode="team" />
      </Card>
    </div>
  );
}

async function ApplicantsTab({ clientId }: { clientId: string }) {
  const rows = await db.select().from(applicants).where(eq(applicants.clientId, clientId)).orderBy(descOrder(applicants.submittedAt));
  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-3">
      <Card title={`Applicants (${rows.length})`} className="lg:col-span-2">
        <div className="-mx-4 -my-4"><ApplicantList applicants={rows} mode="team" clientId={clientId} /></div>
      </Card>
      <Card title="Add an applicant">
        <p className="mb-3 text-xs text-slate-500">For applications that come in by email or from a careers-page export. The client sees these on their portal.</p>
        <AddApplicantForm clientId={clientId} />
      </Card>
    </div>
  );
}

async function OnboardingTab({ clientId }: { clientId: string }) {
  const { checklist } = await getOnboarding(clientId);
  return (
    <div className="max-w-3xl">
      <Card title="Onboarding checklist">
        <Checklist items={checklist} clientId={clientId} mode="team" />
      </Card>
    </div>
  );
}

async function ProfileTab({ clientId }: { clientId: string }) {
  const { answers, submittedAt, profilePct } = await getOnboarding(clientId);
  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-sm text-slate-500">
        {submittedAt ? "The client submitted this profile." : `${Math.round(profilePct * 100)}% answered.`} The client fills this in from their portal
        (Onboarding page); your team can edit it here too.
      </p>
      <ProfileForm answers={answers} submittedAt={submittedAt} action={saveProfileAsStaff.bind(null, clientId)} audience="team" />
    </div>
  );
}

async function RequestsTab({ clientId, clients: clientList }: { clientId: string; clients: Awaited<ReturnType<typeof getLookups>>["clients"] }) {
  const requestRows = await getRequestViews({ clientId });
  return (
    <div className="max-w-4xl space-y-3">
      <div className="flex justify-end">
        <NewRequestButton clients={clientList} defaultClientId={clientId} />
      </div>
      {requestRows.length === 0 ? (
        <EmptyState>No requests from this client yet.</EmptyState>
      ) : (
        requestRows.map((r) => <RequestCard key={r.id} request={r} showClient={false} />)
      )}
    </div>
  );
}

async function PortalTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const portalUsers = await db
    .select()
    .from(users)
    .where(and(eq(users.clientId, clientId), eq(users.role, "client")))
    .orderBy(asc(users.name));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="People who can log in to the client portal">
        {portalUsers.length === 0 ? (
          <EmptyState>No one from {clientName} can log in yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {portalUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <div className={`text-sm font-medium ${u.isActive ? "text-slate-900" : "text-slate-400 line-through"}`}>{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </div>
                <PortalUserToggle clientId={clientId} userId={u.id} isActive={u.isActive} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Add a portal login">
        <p className="mb-4 text-sm text-slate-500">
          They'll see their tasks and can send requests. Share the temporary password with them privately.
        </p>
        <AddPortalUserForm clientId={clientId} />
      </Card>
    </div>
  );
}
