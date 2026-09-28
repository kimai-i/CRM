"use client";

import { useTransition } from "react";
import { Download, Eye, EyeOff, FileText, Trash2 } from "lucide-react";
import type { AssetView } from "@/lib/asset-queries";
import { deleteAsset, deleteMyAsset, updateAsset } from "@/app/(admin)/assets/actions";

export const CATEGORY_LABEL: Record<string, string> = {
  logo: "Logo",
  photo: "Photo",
  brand_guide: "Brand guidelines",
  ad_creative: "Ad creative",
  document: "Document",
  contract: "Contract",
  report: "Report",
  other: "Other",
};

const isImage = (mime: string) => mime.startsWith("image/");
const sizeText = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/** A list of files. Team mode can recategorize, hide from the client and delete; client mode can delete own uploads. */
export function AssetList({ items, mode, viewerId }: { items: AssetView[]; mode: "team" | "client"; viewerId?: string }) {
  const [pending, startTransition] = useTransition();
  if (items.length === 0) return <p className="py-4 text-center text-sm text-slate-400">No files yet.</p>;

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-3 py-2">
          <a href={`/files/${a.id}`} target="_blank" rel="noreferrer" className="shrink-0">
            {isImage(a.mime) ? (
              <img src={`/files/${a.id}`} alt="" className="h-10 w-10 rounded-md border border-slate-200 object-cover" loading="lazy" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400"><FileText className="h-5 w-5" /></span>
            )}
          </a>
          <div className="min-w-0 flex-1">
            <a href={`/files/${a.id}`} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-slate-900 hover:text-indigo-700" title={a.filename}>
              {a.label || a.filename}
            </a>
            <div className="truncate text-xs text-slate-500">
              {sizeText(a.size)} · {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {a.uploadedBy ? ` · ${a.uploadedByClient && mode === "team" ? "client: " : ""}${a.uploadedBy}` : ""}
              {a.notes ? ` · ${a.notes}` : ""}
            </div>
          </div>
          {mode === "team" ? (
            <>
              <select
                value={a.category}
                disabled={pending}
                onChange={(e) => startTransition(() => updateAsset(a.id, { category: e.target.value as never }))}
                className="input-sm"
              >
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => updateAsset(a.id, { clientVisible: !a.clientVisible }))}
                className="btn-ghost p-1"
                title={a.clientVisible ? "Client can see this — click to hide" : "Hidden from the client — click to share"}
                aria-label={a.clientVisible ? "Hide from client" : "Share with client"}
              >
                {a.clientVisible ? <Eye className="h-4 w-4 text-slate-500" /> : <EyeOff className="h-4 w-4 text-amber-600" />}
              </button>
            </>
          ) : (
            <span className="text-xs text-slate-500">{CATEGORY_LABEL[a.category] ?? a.category}</span>
          )}
          <a href={`/files/${a.id}?download=1`} className="btn-ghost p-1" aria-label="Download"><Download className="h-4 w-4" /></a>
          {(mode === "team" || a.uploadedById === viewerId) && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Delete "${a.filename}"? This can't be undone.`)) startTransition(() => (mode === "team" ? deleteAsset(a.id) : deleteMyAsset(a.id)));
              }}
              className="btn-ghost p-1 text-red-600 hover:bg-red-50"
              aria-label="Delete file"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
