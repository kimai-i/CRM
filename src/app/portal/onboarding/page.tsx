import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { requireClientUser } from "@/lib/auth";
import { getOnboarding } from "@/lib/onboarding-queries";
import { Checklist } from "@/components/onboarding-views";
import { Card, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Onboarding" };

export default async function PortalOnboardingPage() {
  const viewer = await requireClientUser();
  const { checklist, submittedAt, profilePct } = await getOnboarding(viewer.clientId);
  const pct = Math.round(profilePct * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Onboarding</h1>
        <p className="mt-1 text-sm text-slate-500">Getting set up with your team. Tick off your items as you go.</p>
      </div>

      <Link
        href="/portal/onboarding/profile"
        className="flex items-center gap-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 hover:bg-indigo-100/60"
      >
        <ClipboardList className="h-8 w-8 shrink-0 text-indigo-600" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">Your business profile</div>
          <div className="text-sm text-slate-600">
            {submittedAt
              ? "Submitted — you can update it any time."
              : `The most important part of onboarding: your services, pricing, area and competitors. About 10 minutes. ${pct ? `${pct}% done.` : ""}`}
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-indigo-600" />
      </Link>

      <Card title="Checklist">
        {checklist.length === 0 ? (
          <EmptyState>Nothing to check off right now.</EmptyState>
        ) : (
          <Checklist items={checklist} clientId={viewer.clientId} mode="client" />
        )}
      </Card>
    </div>
  );
}
