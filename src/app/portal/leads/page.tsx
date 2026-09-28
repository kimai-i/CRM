import type { Metadata } from "next";
import { LEAD_TYPES, type LeadType } from "@/db/schema";
import { requireClientUser } from "@/lib/auth";
import { getLeadsPageData } from "@/lib/lead-queries";
import { parseLeadWindow, type LeadWindow } from "@/lib/lead-windows";
import { EmptyState } from "@/components/ui";
import { LeadFilterBar, LeadSummary } from "@/components/lead-views";
import { LeadTable } from "@/components/lead-table";

export const metadata: Metadata = { title: "Leads" };

function hrefWith(current: { window: LeadWindow; type?: LeadType }, change: { window?: LeadWindow; type?: LeadType | null }) {
  const window = change.window ?? current.window;
  const type = change.type === null ? undefined : (change.type ?? current.type);
  const params = new URLSearchParams();
  if (window !== "30d") params.set("window", window);
  if (type) params.set("type", type);
  const qs = params.toString();
  return qs ? `/portal/leads?${qs}` : "/portal/leads";
}

export default async function PortalLeadsPage({ searchParams }: PageProps<"/portal/leads">) {
  const user = await requireClientUser();
  const sp = await searchParams;
  const filters = {
    window: parseLeadWindow(sp.window),
    type: typeof sp.type === "string" && LEAD_TYPES.includes(sp.type as LeadType) ? (sp.type as LeadType) : undefined,
  };

  // Always scoped to the logged-in client — never taken from the URL.
  const data = await getLeadsPageData({ clientId: user.clientId, window: filters.window, type: filters.type });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
        <p className="mt-1 text-sm text-slate-500">Every call, form and message that came in — and which ones turned into booked jobs.</p>
      </div>

      <LeadFilterBar window={filters.window} type={filters.type} hrefFor={(change) => hrefWith(filters, change)} />

      {data.rows.length === 0 ? (
        <EmptyState>No leads in this date range yet.</EmptyState>
      ) : (
        <>
          <LeadSummary data={data} />
          <LeadTable key={`${filters.window}-${filters.type}`} rows={data.rows} showClient={false} readOnly />
        </>
      )}
    </div>
  );
}
