import type { Metadata } from "next";
import { requireClientUser } from "@/lib/auth";
import { getAssets } from "@/lib/asset-queries";
import { EmptyState } from "@/components/ui";
import { PhotoDropUploader } from "./photo-uploader";

export const metadata: Metadata = { title: "Photo Drop" };

// Clients see a simple status; "passed" just means the photo wasn't picked this time.
const STATUS: Record<string, [string, string]> = {
  needs_review: ["Received", "bg-slate-100 text-slate-600"],
  approved: ["Selected", "bg-blue-100 text-blue-700"],
  posted: ["Posted", "bg-green-100 text-green-700"],
  passed: ["Not used", "bg-slate-100 text-slate-400"],
};

export default async function PhotoDropPage() {
  const viewer = await requireClientUser();
  const photos = await getAssets({ clientId: viewer.clientId, purpose: "photo", clientVisibleOnly: true });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Photo Drop</h1>
        <p className="mt-1 text-sm text-slate-500">
          Drop in your job photos and we&apos;ll turn the best ones into posts for your Google, Facebook and Instagram.
        </p>
      </div>
      <PhotoDropUploader />
      {photos.length === 0 ? (
        <EmptyState>No photos yet. Before-and-after shots and crews at work make the best posts.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => {
            const [label, style] = STATUS[p.photoStatus ?? "needs_review"];
            return (
              <figure key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <a href={`/files/${p.id}`} target="_blank" rel="noreferrer">
                  <img src={`/files/${p.id}`} alt={p.notes ?? p.filename} loading="lazy" className="aspect-square w-full object-cover" />
                </a>
                <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="truncate text-[11px] text-slate-500">{p.notes ?? new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${style}`}>{label}</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}
