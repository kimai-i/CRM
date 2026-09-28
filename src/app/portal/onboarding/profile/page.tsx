import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireClientUser } from "@/lib/auth";
import { getOnboarding } from "@/lib/onboarding-queries";
import { ProfileForm } from "@/components/onboarding-views";
import { saveMyProfile } from "@/app/(admin)/onboarding/actions";

export const metadata: Metadata = { title: "Business profile" };

export default async function PortalProfilePage() {
  const viewer = await requireClientUser();
  const { answers, submittedAt } = await getOnboarding(viewer.clientId);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/portal/onboarding" className="btn-ghost -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back to onboarding
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Your business profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          This shapes the strategy we run for you. Answer what you can — you can save and come back, and update it any time.
        </p>
      </div>
      <ProfileForm answers={answers} submittedAt={submittedAt} action={saveMyProfile} audience="client" />
    </div>
  );
}
