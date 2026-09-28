import Link from "next/link";
import { Plug } from "lucide-react";

/**
 * Placeholder for features that need an outside service (an AI model, Google Search Console, etc.).
 * The page, menu item and data model are ready; the service gets connected later.
 */
export function ConnectLater({
  title,
  description,
  needs,
  willDo,
  meanwhile,
  audience = "team",
}: {
  title: string;
  description: string;
  needs: string;
  willDo: string[];
  meanwhile?: { label: string; href: string };
  audience?: "team" | "client";
}) {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <span className="inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-600"><Plug className="h-6 w-6" /></span>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-slate-600">{description}</p>
        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {audience === "team" ? "Once connected, it will" : "Coming soon — it will"}
          </div>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            {willDo.map((w) => <li key={w}>• {w}</li>)}
          </ul>
        </div>
        {audience === "team" && (
          <p className="mt-4 text-sm text-slate-500">
            <strong className="text-slate-700">Needs:</strong> {needs}. Nothing is connected yet — see Settings → Connections.
          </p>
        )}
        {meanwhile && (
          <Link href={meanwhile.href} className="btn-secondary mt-6">{meanwhile.label}</Link>
        )}
      </div>
    </div>
  );
}
