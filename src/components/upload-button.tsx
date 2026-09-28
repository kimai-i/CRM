"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

/** Posts files to /files/upload with extra fields, then refreshes the page. */
export function UploadButton({
  fields,
  accept,
  multiple = true,
  capture,
  label = "Upload files",
  icon,
  className = "btn-secondary",
  onUploaded,
}: {
  fields: Record<string, string>;
  accept?: string;
  multiple?: boolean;
  capture?: "environment" | "user";
  label?: string;
  icon?: ReactNode;
  className?: string;
  onUploaded?: (saved: { id: string; filename: string }[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    for (const f of Array.from(files)) form.append("files", f);
    try {
      const res = await fetch("/files/upload", { method: "POST", body: form });
      const body = (await res.json()) as { error?: string; saved?: { id: string; filename: string }[] };
      if (!res.ok || body.error) setError(body.error ?? "Upload failed.");
      else {
        onUploaded?.(body.saved ?? []);
        router.refresh();
      }
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className={className}>
        {icon ?? <Upload className="h-4 w-4" />} {busy ? "Uploading…" : label}
      </button>
      <input
        ref={input}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        capture={capture}
        onChange={(e) => upload(e.target.files)}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
