import type { Metadata } from "next";
import Link from "next/link";
import { requireClientUser } from "@/lib/auth";
import { getAssets } from "@/lib/asset-queries";
import { AssetList } from "@/components/asset-list";
import { AssetUploader } from "@/app/(admin)/assets/asset-uploader";

export const metadata: Metadata = { title: "Asset Library" };

export default async function PortalAssetsPage() {
  const viewer = await requireClientUser();
  const files = await getAssets({ clientId: viewer.clientId, purpose: "asset", clientVisibleOnly: true });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Asset Library</h1>
        <p className="mt-1 text-sm text-slate-500">
          Drop in logos, brand guidelines, ad creative, or any other files your team needs. Job photos go in{" "}
          <Link href="/portal/photos" className="font-medium text-indigo-600 hover:underline">Photo Drop</Link>.
        </p>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <AssetUploader />
        <AssetList items={files} mode="client" viewerId={viewer.impersonating ? undefined : viewer.id} />
      </section>
    </div>
  );
}
