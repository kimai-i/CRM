import type { Metadata } from "next";
import { requireClientUser } from "@/lib/auth";
import { getResultsData } from "@/lib/results-queries";
import { parseResultWindow, type ResultWindow } from "@/lib/metrics";
import { ResultsSummary, ResultWindowBar } from "@/components/results-views";

export const metadata: Metadata = { title: "Marketing Results" };

const hrefFor = (w: ResultWindow) => (w === "30d" ? "/portal/results" : `/portal/results?window=${w}`);

export default async function PortalResultsPage({ searchParams }: PageProps<"/portal/results">) {
  const viewer = await requireClientUser();
  const window = parseResultWindow((await searchParams).window);
  // Always scoped to the client being viewed — never taken from the URL.
  const data = await getResultsData({ clientId: viewer.clientId, window });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Marketing Results</h1>
        <p className="mt-1 text-sm text-slate-500">Where your leads come from, what they cost, and what they turn into.</p>
      </div>
      <div className="border-b border-slate-200 pb-2">
        <ResultWindowBar window={window} hrefFor={hrefFor} />
      </div>
      <ResultsSummary data={data} audience="client" />
    </div>
  );
}
