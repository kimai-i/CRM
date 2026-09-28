"use client";

import { useState } from "react";
import { UploadButton } from "@/components/upload-button";
import { CATEGORY_LABEL } from "@/components/asset-list";

/** Category picker + upload button. `clientId` is ignored for client users (they always upload to their own). */
export function AssetUploader({ clientId }: { clientId?: string }) {
  const [category, setCategory] = useState("other");
  return (
    <div className="mb-2 flex flex-wrap items-start gap-2">
      <select value={category} onChange={(e) => setCategory(e.target.value)} className="input w-auto py-1.5 text-sm" aria-label="Upload as">
        {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <UploadButton fields={{ purpose: "asset", category, ...(clientId ? { clientId } : {}) }} label="Upload" />
    </div>
  );
}
