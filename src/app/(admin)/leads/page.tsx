import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { LEAD_TYPES, type LeadType } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { getLeadsPageData } from "@/lib/lead-queries";
import { parseLeadWindow, type LeadWindow } from "@/lib/lead-windows";
import { EmptyState, PageHeader } from "@/components/ui";
import { LeadFilterBar, LeadSummary } from "@/components/lead-views";
import { LeadTable } from "@/components/lead-table";
import { AddLeadButton } from "./lead-form";

export const metadata: Metadata = { title: "Leads" };

type Filters = { client?: string; window: LeadWindow; type?: LeadType };

function hrefWith(current: Filters, change: { client?: string | null; window?: LeadWindow; type?: LeadType | null }) {
  const next = {
    client: change.client === null ? undefined : (change.client ?? current.client),
    window: change.window ?? current.window,
    type: change.type === null ? undefined : (change.type ?? current.type),
  };
  const params = new URLSearchParams();
  if (next.client) params.set("client", next.client);
  if (next.window !== "30d") params.set("window", next.window);
  if (next.type) params.set("type", next.type);
  const qs = params.toString();
  return qs ? `/leads?${qs}` : "/leads";
}

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  await requireStaff();
  const sp = await searchParams;
  const lookups = await getLookups();

  const leadClients = lookups.clients.filter((c) => !c.isInternal && c.lifecycle !== "churned");
  const filters: Filters = {
    client: typeof sp.client === "string" && lookups.clients.some((c) => c.id === sp.client) ? sp.client : undefined,
    window: parseLeadWindow(sp.window),
    type: typeof sp.type === "string" && LEAD_TYPES.includes(sp.type as LeadType) ? (sp.type as LeadType) : undefined,
  };

  const data = await getLeadsPageData({ clientId: filters.client, window: filters.window, type: filters.type });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Leads"
        subtitle="Calls, form submissions and chats across every client."
        actions={
          <>
            <Link href={filters.client ? `/leads/import?client=${filters.client}` : "/leads/import"} className="btn-secondary">
              <Upload className="h-4 w-4" /> Import CSV
            </Link>
            <AddLeadButton clients={lookups.clients} defaultClientId={filters.client} />
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Pill href={hrefWith(filters, { client: null })} active={!filters.client}>All clients</Pill>
        {leadClients.map((c) => (
          <Pill key={c.id} href={hrefWith(filters, { client: c.id })} active={filters.client === c.id} color={c.color}>
            {c.name}
          </Pill>
        ))}
      </div>

      <LeadFilterBar window={filters.window} type={filters.type} hrefFor={(change) => hrefWith(filters, change)} />

      {data.rows.length === 0 ? (
        <EmptyState>
          No leads in this view yet. Use <strong>Add lead</strong> for a single call, or <strong>Import CSV</strong> to bring in an export.
        </EmptyState>
      ) : (
        <>
          <LeadSummary data={data} />
          <LeadTable key={`${filters.client}-${filters.window}-${filters.type}`} rows={data.rows} showClient={!filters.client} />
        </>
      )}
    </div>
  );
}

function Pill({ href, active, color, children }: { href: string; active: boolean; color?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
        active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active ? "#fff" : color }} />}
      {children}
    </Link>
  );
}
