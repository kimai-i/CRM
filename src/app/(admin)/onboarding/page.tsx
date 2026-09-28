import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { getOnboardingSummary } from "@/lib/onboarding-queries";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  await requireStaff();
  const [lookups, summary] = await Promise.all([getLookups(), getOnboardingSummary()]);
  const onboarding = lookups.clients.filter((c) => c.lifecycle === "onboarding");
  // Clients past onboarding that still have unfinished checklist items.
  const leftovers = lookups.clients.filter((c) => {
    const s = summary.get(c.id);
    return c.lifecycle !== "onboarding" && c.lifecycle !== "churned" && s && s.total > s.done;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Onboarding"
        subtitle="New clients' checklists and business profiles. A client shows here while their status is Onboarding — change it on the Clients page."
      />

      {onboarding.length === 0 ? (
        <EmptyState>No clients are onboarding right now. Set a client&apos;s status to <strong>Onboarding</strong> on the Clients page to start.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {onboarding.map((c) => <OnboardingCard key={c.id} client={c} s={summary.get(c.id)} />)}
        </div>
      )}

      {leftovers.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Past onboarding, items still open</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {leftovers.map((c) => <OnboardingCard key={c.id} client={c} s={summary.get(c.id)} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function OnboardingCard({
  client,
  s,
}: {
  client: { id: string; name: string; color: string };
  s?: { total: number; done: number; clientOpen: number; profilePct: number; submittedAt: string | null };
}) {
  const checklistPct = s && s.total ? Math.round((s.done / s.total) * 100) : 0;
  const profilePct = Math.round((s?.profilePct ?? 0) * 100);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <Link href={`/clients/${client.id}?tab=onboarding`} className="flex items-center gap-2 font-semibold text-slate-900 hover:text-indigo-700">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: client.color }} />
        {client.name}
      </Link>
      <div className="mt-3 space-y-3">
        <Bar
          label="Checklist"
          detail={s?.total ? `${s.done}/${s.total} done${s.clientOpen ? ` · ${s.clientOpen} waiting on client` : ""}` : "Not started"}
          pct={checklistPct}
        />
        <Bar label="Business profile" detail={s?.submittedAt ? "Submitted" : `${profilePct}% answered`} pct={s?.submittedAt ? 100 : profilePct} />
      </div>
      <div className="mt-3 flex gap-3 text-xs">
        <Link href={`/clients/${client.id}?tab=onboarding`} className="font-medium text-indigo-600 hover:underline">Checklist</Link>
        <Link href={`/clients/${client.id}?tab=profile`} className="font-medium text-indigo-600 hover:underline">Business profile</Link>
      </div>
    </div>
  );
}

function Bar({ label, detail, pct }: { label: string; detail: string; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-500">{detail}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
