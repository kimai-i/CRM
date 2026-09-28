import type { Metadata } from "next";
import { asc, ne } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isAdmin, requireStaff } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/labels";
import { Avatar, Card, PageHeader } from "@/components/ui";
import { AddTeamMemberForm, ChangePasswordForm, TeamMemberControls } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

// Where outside services can plug in later. Today each of these works by manual entry or CSV upload.
const CONNECTIONS = [
  { name: "AI service", powers: "Client AI Assistant, Planner, Content Engine, AI-written weekly reports, automatic lead grading" },
  { name: "Lead sources (call tracking, forms, chat)", powers: "Leads arrive automatically instead of by CSV import" },
  { name: "Field-service software", powers: "Jobs, estimates and invoices sync automatically instead of by CSV import" },
  { name: "Ad platforms", powers: "Ad spend, clicks and conversions sync to Marketing Results" },
  { name: "Search Console, Analytics, Business Profile", powers: "SEO Scorecard and website traffic in Marketing Results" },
  { name: "Meeting recorder", powers: "Meeting notes and action items arrive automatically" },
  { name: "Email sending", powers: "Send weekly reports and notifications from the CRM" },
  { name: "Payments", powers: "Clients pay invoices from the portal" },
];

export default async function SettingsPage() {
  const me = await requireStaff();
  const admin = isAdmin(me.role);
  const team = admin ? await db.select().from(users).where(ne(users.role, "client")).orderBy(asc(users.name)) : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Settings" />

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Your profile">
          <div className="flex items-center gap-3">
            <Avatar initials={me.initials} color={me.color} />
            <div>
              <div className="font-medium text-slate-900">{me.name}</div>
              <div className="text-sm text-slate-500">{me.email}</div>
              <div className="mt-1 text-xs font-medium text-slate-600">{ROLE_LABEL[me.role]}</div>
            </div>
          </div>
        </Card>
        <Card title="Change password">
          <ChangePasswordForm />
        </Card>
      </div>

      {admin && (
        <>
          <Card title={`Team (${team.length})`}>
            <ul className="divide-y divide-slate-100">
              {team.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar initials={u.initials} color={u.color} />
                    <div>
                      <div className={`text-sm font-medium ${u.isActive ? "text-slate-900" : "text-slate-400 line-through"}`}>{u.name}</div>
                      <div className="text-xs text-slate-500">{u.email} · {ROLE_LABEL[u.role]}{u.isActive ? "" : " · access off"}</div>
                    </div>
                  </div>
                  <TeamMemberControls
                    userId={u.id}
                    role={u.role as "owner" | "admin" | "team"}
                    isActive={u.isActive}
                    editable={u.id !== me.id && u.role !== "owner"}
                  />
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Add a team member">
            <AddTeamMemberForm />
          </Card>

          <Card title="Connections">
            <p className="mb-4 text-sm text-slate-500">
              Nothing is connected to outside services — all data is typed in or uploaded as files. These are the places a connection can be added
              later; each one already has a page and data waiting for it.
            </p>
            <ul className="divide-y divide-slate-100">
              {CONNECTIONS.map((c) => (
                <li key={c.name} className="flex items-start justify-between gap-4 py-2.5">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.powers}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Not connected</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
