import {
  LayoutDashboard, CalendarClock, ListTodo, Users, Inbox, Timer, MessageSquarePlus, Video,
  Building2, Rocket, FolderOpen, Image, Sparkles, Search, Megaphone, Globe, Send, Workflow,
  Puzzle, BarChart3, Wallet, Mail, Repeat, PhoneCall, Receipt, TrendingUp, Gauge, BookOpen, Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon; ready?: boolean };
export type NavGroup = { title?: string; items: NavItem[] };

// `ready: true` marks pages that are built; the rest show "Coming soon".
export const NAV: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, ready: true },
      { label: "Planner", href: "/planner", icon: CalendarClock },
      { label: "My Work", href: "/my-work", icon: ListTodo, ready: true },
      { label: "Team To-Do's", href: "/team-todos", icon: Users, ready: true },
      { label: "Inbox", href: "/inbox", icon: Inbox, ready: true },
      { label: "Time Tracking", href: "/time", icon: Timer, ready: true },
      { label: "Requests", href: "/requests", icon: MessageSquarePlus, ready: true },
      { label: "Meetings", href: "/meetings", icon: Video, ready: true },
    ],
  },
  {
    title: "Clients",
    items: [
      { label: "Clients", href: "/clients", icon: Building2, ready: true },
      { label: "Onboarding", href: "/onboarding", icon: Rocket, ready: true },
      { label: "Assets", href: "/assets", icon: FolderOpen, ready: true },
      { label: "Content Studio", href: "/content-studio", icon: Image, ready: true },
      { label: "Content Engine", href: "/content-engine", icon: Sparkles },
    ],
  },
  {
    title: "Channels",
    items: [
      { label: "Google Ads", href: "/channels/google-ads", icon: Search, ready: true },
      { label: "Meta Ads", href: "/channels/meta-ads", icon: Megaphone, ready: true },
      { label: "Websites & SEO", href: "/channels/websites-seo", icon: Globe, ready: true },
      { label: "Outreach", href: "/channels/outreach", icon: Send, ready: true },
      { label: "Automations", href: "/channels/automations", icon: Workflow, ready: true },
      { label: "Ad Hoc / Extras", href: "/channels/ad-hoc", icon: Puzzle, ready: true },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3, ready: true },
      { label: "Ad Budgets", href: "/ad-budgets", icon: Wallet, ready: true },
      { label: "Weekly Reports", href: "/weekly-reports", icon: Mail, ready: true },
      { label: "Recurring", href: "/recurring", icon: Repeat, ready: true },
      { label: "Leads", href: "/leads", icon: PhoneCall, ready: true },
      { label: "Jobs", href: "/jobs", icon: Receipt, ready: true },
      { label: "Marketing Results", href: "/marketing-results", icon: TrendingUp, ready: true },
      { label: "SEO Scorecard", href: "/seo-scorecard", icon: Gauge },
      { label: "SOPs & Tutorials", href: "/sops", icon: BookOpen, ready: true },
      { label: "Settings", href: "/settings", icon: Settings, ready: true },
    ],
  },
];

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV.flatMap((g) => g.items).find((i) => i.href === pathname);
}
