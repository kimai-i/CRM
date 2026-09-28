import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { getResultsData } from "@/lib/results-queries";
import { parseResultWindow, type ResultWindow } from "@/lib/metrics";
import { PageHeader } from "@/components/ui";
import { ResultsSummary, ResultWindowBar } from "@/components/results-views";
import { SpendSection } from "./spend-section";

export const metadata: Metadata = { title: "Marketing Results" };

function hrefWith(client: string | undefined, window: ResultWindow) {
  const params = new URLSearchParams();
  if (client) params.set("client", client);
  if (window !== "30d") params.set("window", window);
  const qs = params.toString();
  return qs ? `/marketing-results?${qs}` : "/marketing-results";
}

export default async function MarketingResultsPage({ searchParams }: PageProps<"/marketing-results">) {
  await requireStaff();
  const sp = await searchParams;
  const lookups = await getLookups();
  const resultClients = lookups.clients.filter((c) => !c.isInternal && c.lifecycle !== "churned");
  const client = typeof sp.client === "string" && lookups.clients.some((c) => c.id === sp.client) ? sp.client : undefined;
  const window = parseResultWindow(sp.window);

  const data = await getResultsData({ clientId: client, window });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Marketing Results"
        subtitle="Where leads come from, what they cost, and what they turn into."
      />

      <div className="flex flex-wrap gap-2">
        <ClientPill href={hrefWith(undefined, window)} active={!client}>All clients</ClientPill>
        {resultClients.map((c) => (
          <ClientPill key={c.id} href={hrefWith(c.id, window)} active={client === c.id} color={c.color}>
            {c.name}
          </ClientPill>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <ResultWindowBar window={window} hrefFor={(w) => hrefWith(client, w)} />
        <span className="text-xs text-slate-400">
          {data.results.range.start} → {data.results.range.end}
        </span>
      </div>

      {!data.hasAnySpend && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
          <strong>Add ad spend to unlock cost per lead and ROAS.</strong> Use <em>Add spend</em> below for a monthly total from the Google Ads
          or Meta dashboard, or <em>Import CSV</em> for a daily export.
        </div>
      )}

      <ResultsSummary data={data} audience="team" />

      <SpendSection key={`${client}-${window}`} entries={data.entries} clients={lookups.clients} clientId={client} showClient={!client} />
    </div>
  );
}

function ClientPill({ href, active, color, children }: { href: string; active: boolean; color?: string; children: ReactNode }) {
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
