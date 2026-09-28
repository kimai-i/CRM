"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";
import { APP_NAME } from "@/lib/config";
import { Avatar } from "@/components/ui";

type SidebarUser = { name: string; role: string; initials: string; color: string } | null;

export function Sidebar({ user, badges = {} }: { user: SidebarUser; badges?: Record<string, number> }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white">
          A1
        </div>
        <span className="font-semibold text-slate-900">{APP_NAME}</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((group, gi) => (
          <div key={gi} className="mb-4">
            {group.title && (
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-indigo-50 font-medium text-indigo-700"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {badges[item.href] ? (
                        <span className="ml-auto rounded-full bg-indigo-600 px-1.5 text-[10px] font-semibold text-white">{badges[item.href] > 99 ? "99+" : badges[item.href]}</span>
                      ) : !item.ready ? (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-slate-200" title="Coming soon" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {user && (
        <div className="flex items-center gap-2.5 border-t border-slate-200 p-3">
          <Avatar initials={user.initials} color={user.color} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-900">{user.name}</div>
            <div className="text-xs capitalize text-slate-500">{user.role}</div>
          </div>
        </div>
      )}
    </aside>
  );
}
