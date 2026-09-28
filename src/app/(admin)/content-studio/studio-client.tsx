"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Download, Send, X } from "lucide-react";
import type { AssetView } from "@/lib/asset-queries";
import { saveBrandKit, setPhotoStatus, type BrandKitState } from "../assets/actions";
import { ActionForm } from "@/components/action-form";

type Status = "needs_review" | "approved" | "passed" | "posted";

export function PhotoGrid({ photos, status }: { photos: AssetView[]; status: Status }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const move = (ids: string[], to: Status) => startTransition(async () => {
    await setPhotoStatus(ids, to);
    setSelected(new Set());
  });
  const toggle = (id: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const ids = [...selected];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => setSelected(selected.size === photos.length ? new Set() : new Set(photos.map((p) => p.id)))} className="btn-ghost">
          {selected.size === photos.length ? "Clear selection" : `Select all (${photos.length})`}
        </button>
        {ids.length > 0 && (
          <>
            <span className="text-slate-500">{ids.length} selected:</span>
            {status !== "approved" && <button type="button" disabled={pending} onClick={() => move(ids, "approved")} className="btn-secondary"><Check className="h-4 w-4" /> Approve</button>}
            {status !== "posted" && <button type="button" disabled={pending} onClick={() => move(ids, "posted")} className="btn-secondary"><Send className="h-4 w-4" /> Mark posted</button>}
            {status !== "passed" && <button type="button" disabled={pending} onClick={() => move(ids, "passed")} className="btn-ghost text-slate-600"><X className="h-4 w-4" /> Pass</button>}
            {status !== "needs_review" && <button type="button" disabled={pending} onClick={() => move(ids, "needs_review")} className="btn-ghost">Back to review</button>}
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {photos.map((p) => {
          const isSelected = selected.has(p.id);
          return (
            <figure key={p.id} className={`overflow-hidden rounded-xl border-2 bg-white ${isSelected ? "border-indigo-500" : "border-transparent ring-1 ring-slate-200"}`}>
              <button type="button" onClick={() => toggle(p.id)} className="relative block w-full" aria-pressed={isSelected} aria-label="Select photo">
                <img src={`/files/${p.id}`} alt={p.notes ?? p.filename} loading="lazy" className="aspect-square w-full object-cover" />
                {isSelected && <span className="absolute right-1.5 top-1.5 rounded-full bg-indigo-600 p-0.5 text-white"><Check className="h-3.5 w-3.5" /></span>}
              </button>
              <figcaption className="space-y-1 px-2 py-1.5">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.clientColor ?? undefined }} />
                  <span className="truncate">{p.clientName}</span>
                </div>
                {p.notes && <div className="truncate text-[11px] text-slate-500" title={p.notes}>{p.notes}</div>}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  <span className="flex gap-0.5">
                    {status === "needs_review" && (
                      <>
                        <button type="button" disabled={pending} onClick={() => move([p.id], "approved")} className="rounded p-1 text-green-600 hover:bg-green-50" aria-label="Approve"><Check className="h-3.5 w-3.5" /></button>
                        <button type="button" disabled={pending} onClick={() => move([p.id], "passed")} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Pass"><X className="h-3.5 w-3.5" /></button>
                      </>
                    )}
                    <a href={`/files/${p.id}?download=1`} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Download"><Download className="h-3.5 w-3.5" /></a>
                  </span>
                </div>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

type Kit = { barColor: string | null; textColor: string | null; accentColor: string | null; callNowPhone: string | null; captionVoice: string | null };

export function BrandKitCard({ clientId, clientName, kit, saved }: { clientId: string; clientName: string; kit: Kit; saved: boolean }) {
  const [state, action, pending] = useActionState<BrandKitState, FormData>(saveBrandKit.bind(null, clientId), {});
  const [bar, setBar] = useState(kit.barColor ?? "#1e293b");
  const [text, setText] = useState(kit.textColor ?? "#ffffff");
  const [accent, setAccent] = useState(kit.accentColor ?? "#f97316");
  const [phone, setPhone] = useState(kit.callNowPhone ?? "");

  return (
    <ActionForm action={action} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold text-slate-900">{clientName}</span>
        {(saved || state.ok) && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">Saved</span>}
      </div>
      {/* Preview of the bar that goes along the bottom of a branded post. */}
      <div className="mb-3 overflow-hidden rounded-lg border border-slate-200">
        <div className="flex h-20 items-center justify-center bg-slate-200 text-xs text-slate-500">Job photo</div>
        <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold" style={{ backgroundColor: bar, color: text }}>
          <span>{clientName}</span>
          <span className="rounded px-2 py-0.5" style={{ backgroundColor: accent, color: text }}>CALL NOW {phone}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <ColorField name="barColor" label="Bar" value={bar} onChange={setBar} />
        <ColorField name="textColor" label="Text" value={text} onChange={setText} />
        <ColorField name="accentColor" label="Accent" value={accent} onChange={setAccent} />
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-slate-600">&ldquo;Call now&rdquo; phone</span>
        <input name="callNowPhone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} className="input mt-1 py-1.5" />
      </label>
      <label className="mt-2 block">
        <span className="text-xs font-medium text-slate-600">Caption voice</span>
        <input name="captionVoice" defaultValue={kit.captionVoice ?? ""} maxLength={1000} placeholder="e.g. friendly, local, no jargon" className="input mt-1 py-1.5" />
      </label>
      <div className="mt-3 flex items-center justify-end gap-2">
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        <button type="submit" disabled={pending} className="btn-secondary py-1.5">{pending ? "Saving…" : "Save kit"}</button>
      </div>
    </ActionForm>
  );
}

function ColorField({ name, label, value, onChange }: { name: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <span className="mt-1 flex items-center gap-1.5 rounded-lg border border-slate-300 px-1.5 py-1">
        <input type="color" name={name} value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
        <span className="font-mono text-[11px] text-slate-500">{value}</span>
      </span>
    </label>
  );
}
