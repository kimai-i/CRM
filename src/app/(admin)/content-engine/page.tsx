import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { ConnectLater } from "@/components/connect-later";

export const metadata: Metadata = { title: "Content Engine" };

export default async function ContentEnginePage() {
  await requireStaff();
  return (
    <ConnectLater
      title="Content Engine"
      description="A pipeline for social posts and carousels: Ideas → Drafts → Ready → Posted."
      needs="an AI service for writing and, optionally, an image generator and social accounts for posting"
      willDo={[
        "Research post ideas from industry news, with sources",
        "Write carousel slides and captions in each client's brand voice (from their brand kit)",
        "Turn approved Photo Drop photos into branded posts",
        "Export posts to download, or publish them once social accounts are connected",
      ]}
      meanwhile={{ label: "Review photos in Content Studio", href: "/content-studio" }}
    />
  );
}
