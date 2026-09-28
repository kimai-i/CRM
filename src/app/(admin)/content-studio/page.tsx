import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { brandKits, PHOTO_STATUSES } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { getAssets } from "@/lib/asset-queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { UploadButton } from "@/components/upload-button";
import { BrandKitCard, PhotoGrid } from "./studio-client";

export const metadata: Metadata = { title: "Content Studio" };

const TAB_LABEL: Record<(typeof PHOTO_STATUSES)[number], string> = {
  needs_review: "Needs review",
  approved: "Approved",
  posted: "Posted",
  passed: "Passed",
};

export default async function ContentStudioPage({ searchParams }: PageProps<"/content-studio">) {
  await requireStaff();
  const sp = await searchParams;
  const tab = PHOTO_STATUSES.includes(sp.status as never) ? (sp.status as (typeof PHOTO_STATUSES)[number]) : "needs_review";
  const lookups = await getLookups();
  const client = typeof sp.client === "string" && lookups.clients.some((c) => c.id === sp.client) ? sp.client : undefined;
  const [photos, kits] = await Promise.all([getAssets({ purpose: "photo", clientId: client }), db.select().from(brandKits)]);
  const shown = photos.filter((p) => (p.photoStatus ?? "needs_review") === tab);
  const kitByClient = new Map(kits.map((k) => [k.clientId, k]));
  const qs = (next: { status?: string; client?: string }) => {
    const p = new URLSearchParams();
    const s = next.status ?? tab;
    const c = "client" in next ? next.client : client;
    if (s !== "needs_review") p.set("status", s);
    if (c) p.set("client", c);
    return p.toString() ? `/content-studio?${p}` : "/content-studio";
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Content Studio"
        subtitle="Review job photos clients drop in the portal (or you upload), pick the best, and track what's been posted. Brand kits hold each client's colors and call-to-action for branded posts."
      />

      <div className="flex flex-wrap items-center gap-2">
        <form className="flex items-center gap-2">
          {tab !== "needs_review" && <input type="hidden" name="status" value={tab} />}
          <select name="client" defaultValue={client ?? ""} className="input w-auto py-1.5">
            <option value="">All clients</option>
            {lookups.clients.filter((c) => !c.isInternal).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="submit" className="btn-secondary py-1.5">Filter</button>
        </form>
        {client && <UploadButton fields={{ purpose: "photo", clientId: client }} accept="image/*" label="Upload photos for this client" />}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {PHOTO_STATUSES.map((s) => {
          const count = photos.filter((p) => (p.photoStatus ?? "needs_review") === s).length;
          return (
            <Link key={s} href={qs({ status: s })} className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${tab === s ? "border-indigo-600 font-medium text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              {TAB_LABEL[s]} <span className={`rounded-full px-1.5 text-[11px] ${tab === s ? "bg-indigo-100" : "bg-slate-100"}`}>{count}</span>
            </Link>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <EmptyState>{tab === "needs_review" ? "No photos waiting. Clients add them from Photo Drop in their portal." : `Nothing ${TAB_LABEL[tab].toLowerCase()} yet.`}</EmptyState>
      ) : (
        <PhotoGrid key={`${tab}-${client}`} photos={shown} status={tab} />
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Brand kits</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lookups.clients
            .filter((c) => !c.isInternal && c.lifecycle !== "churned")
            .map((c) => {
              const k = kitByClient.get(c.id);
              return (
                <BrandKitCard
                  key={c.id}
                  clientId={c.id}
                  clientName={c.name}
                  kit={{
                    barColor: k?.barColor ?? null,
                    textColor: k?.textColor ?? null,
                    accentColor: k?.accentColor ?? null,
                    callNowPhone: k?.callNowPhone ?? null,
                    captionVoice: k?.captionVoice ?? null,
                  }}
                  saved={Boolean(k)}
                />
              );
            })}
        </div>
      </section>
    </div>
  );
}
