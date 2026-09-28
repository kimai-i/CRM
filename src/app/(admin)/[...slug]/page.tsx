import Link from "next/link";
import { notFound } from "next/navigation";
import { Construction } from "lucide-react";
import { findNavItem } from "@/lib/nav";

export default async function ComingSoon({ params }: PageProps<"/[...slug]">) {
  const { slug } = await params;
  const item = findNavItem(`/${slug.join("/")}`);
  if (!item) notFound();

  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <Construction className="mx-auto h-10 w-10 text-slate-300" />
      <h1 className="mt-4 text-xl font-semibold text-slate-900">{item.label}</h1>
      <p className="mt-2 text-sm text-slate-500">This page is coming soon.</p>
      <Link href="/dashboard" className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline">
        Back to Dashboard
      </Link>
    </div>
  );
}
