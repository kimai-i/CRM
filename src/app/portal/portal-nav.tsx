"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen, Briefcase, Camera, CheckSquare, ClipboardList, FileText, FolderOpen, Home, MessageSquarePlus,
  PhoneCall, Receipt, Sparkles, TrendingUp, UserPlus, Video, Wallet,
} from "lucide-react";

const ITEMS = [
  { label: "Overview", href: "/portal", icon: Home },
  { label: "AI Assistant", href: "/portal/assistant", icon: Sparkles },
  { label: "To-Do", href: "/portal/todo", icon: CheckSquare },
  { label: "Active Work", href: "/portal/work", icon: Briefcase },
  { label: "Meetings", href: "/portal/meetings", icon: Video },
  { label: "Onboarding", href: "/portal/onboarding", icon: ClipboardList },
  { label: "Reports", href: "/portal/reports", icon: FileText },
  { label: "Ad Budgets", href: "/portal/budgets", icon: Wallet },
  { label: "Invoices", href: "/portal/invoices", icon: Receipt },
  { label: "Leads", href: "/portal/leads", icon: PhoneCall },
  { label: "Marketing Results", href: "/portal/results", icon: TrendingUp },
  { label: "Job Applicants", href: "/portal/applicants", icon: UserPlus },
  { label: "Photo Drop", href: "/portal/photos", icon: Camera },
  { label: "Asset Library", href: "/portal/assets", icon: FolderOpen },
  { label: "Help & How-to", href: "/portal/help", icon: BookOpen },
  { label: "Requests", href: "/portal/requests", icon: MessageSquarePlus },
];

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 py-2 md:flex-1 md:flex-col md:overflow-y-auto md:py-3">
      {ITEMS.map(({ label, href, icon: Icon }) => {
        const active = href === "/portal" ? pathname === "/portal" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-sm ${
              active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
