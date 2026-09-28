import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { getAssets } from "@/lib/asset-queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { AssetList } from "@/components/asset-list";
import { AssetUploader } from "./asset-uploader";

export const metadata: Metadata = { title: "Assets" };

export default async function AssetsPage({ searchParams }: PageProps<"/assets">) {
  await requireStaff();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const [lookups, all] = await Promise.all([getLookups(), getAssets({ purpose: "asset" })]);
  const matches = all.filter((a) => !q || a.filename.toLowerCase().includes(q) || a.label?.toLowerCase().includes(q) || a.notes?.toLowerCase().includes(q));
  const clients = lookups.clients.filter((c) => c.lifecycle !== "churned" || matches.some((a) => a.clientId === c.id));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Assets"
        subtitle="Logos, brand guidelines, ad creative, documents and contracts for each client. Files marked visible also show in the client's Asset Library."
      />
      <form className="flex items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Search file names and notes…" className="input max-w-xs" />
        <button type="submit" className="btn-secondary">Search</button>
        <span className="ml-2 text-sm text-slate-500">{matches.length} file{matches.length === 1 ? "" : "s"} across {new Set(matches.map((a) => a.clientId)).size} clients</span>
      </form>

      {clients.length === 0 ? (
        <EmptyState>Add a client first, then upload their files here.</EmptyState>
      ) : (
        <div className="columns-1 gap-4 md:columns-2 xl:columns-3 [&>*]:mb-4">
          {clients.map((c) => {
            const files = matches.filter((a) => a.clientId === c.id);
            if (q && files.length === 0) return null;
            return (
              <section key={c.id} className="break-inside-avoid rounded-xl border border-slate-200 bg-white p-4">
                <header className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold text-slate-900">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </span>
                  <span className="text-xs text-slate-400">{files.length}</span>
                </header>
                <AssetUploader clientId={c.id} />
                <AssetList items={files} mode="team" />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
