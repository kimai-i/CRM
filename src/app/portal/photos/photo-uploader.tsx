"use client";

import { useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { UploadButton } from "@/components/upload-button";

export function PhotoDropUploader() {
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<number | null>(null);
  const done = (saved: { id: string }[]) => {
    setSent(saved.length);
    setNote("");
  };
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <label className="block">
        <span className="label">Add a note (optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. New sewer line job in Riverside" className="input mt-1" />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <UploadButton fields={{ purpose: "photo", note }} accept="image/*" label="Add photos" icon={<ImagePlus className="h-4 w-4" />} className="btn-primary" onUploaded={done} />
        <UploadButton fields={{ purpose: "photo", note }} accept="image/*" capture="environment" multiple={false} label="Take a photo" icon={<Camera className="h-4 w-4" />} onUploaded={done} />
      </div>
      {sent !== null && <p className="mt-2 text-sm text-green-700">Thanks! {sent} photo{sent === 1 ? "" : "s"} sent to your team.</p>}
    </section>
  );
}
