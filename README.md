# All-in-One CRM

Agency CRM and client portal. Built with Next.js, Tailwind and Drizzle (local SQLite for now).
Full spec: `../docs/all-in-one-crm-build-spec.md`.

No outside platforms, third parties or AI services are connected — all data is typed in or uploaded
as files. Settings → Connections lists where each one can be plugged in later.

## Start using it

```bash
npm install
npm run db:fresh   # create the database, empty, with the default channel list
npm run dev        # open http://localhost:3000
```

On an empty CRM the app opens a **setup screen** to create the owner account. Then add your team in
Settings → Team and your clients on the Clients page.

Want to look around with made-up data first? `npm run db:demo` fills the CRM with a demo agency
(it wipes everything first). Its logins share one local-only password, `SEED_PASSWORD` in
`scripts/seed.ts`. Run `npm run db:fresh` again before real use.

## What's built

### Team side
| Area | Where |
|---|---|
| First-run setup, login / logout, roles (owner, admin, team, client) | `/setup`, `/login`, `src/lib/auth.ts` |
| Dashboard | `/dashboard` |
| Tasks — table/board, filters, grouping, inline edits, subtasks, comments, client to-dos | `/my-work`, `/team-todos`, `/channels/*`, `/tasks/[id]` |
| Team Inbox — direct and group messages, unread counts | `/inbox` |
| Time tracking — timer, manual entries, weekly timesheet, utilization | `/time` |
| Requests — reply, decline, convert to task | `/requests` |
| Meetings — notes, action items, share with the client | `/meetings` |
| Clients — list, details, onboarding, business profile, files, invoices, applicants, portal logins | `/clients`, `/clients/[id]` |
| Onboarding — checklists and business-profile progress | `/onboarding` |
| Assets — files per client | `/assets` |
| Content Studio — review client job photos, brand kits | `/content-studio` |
| Channel boards — Google Ads, Meta Ads, Websites & SEO, Outreach, Automations, Ad Hoc | `/channels/*` |
| Reports — hours, utilization, client scorecards, hours CSV | `/reports` |
| Ad Budgets | `/ad-budgets` |
| Weekly Reports — template drafts from each client's data; review, copy, mark sent | `/weekly-reports` |
| Recurring routines | `/recurring` |
| Leads — list, charts, CSV import | `/leads` |
| Jobs — CSV import, matched to leads for real revenue | `/jobs` |
| Marketing Results — spend, cost per lead / job, ROAS | `/marketing-results` |
| SOPs & Tutorials | `/sops` |
| Settings — profile, password, team, connections overview | `/settings` |
| Planner, Content Engine, SEO Scorecard — pages ready, waiting for a connection | `/planner`, `/content-engine`, `/seo-scorecard` |

### Client portal (`/portal`)
Overview, To-Do, Active Work, Meetings, Onboarding + business profile, Reports (sent weekly updates),
Ad Budgets (request a change), Invoices, Leads, Marketing Results, Job Applicants, Photo Drop,
Asset Library, Help & How-to, Requests. AI Assistant is a placeholder until an AI service is connected.
Owners and admins can preview any client's portal with **View as client**.

## Files

Uploads are stored in the `uploads/` folder (not committed to git) and served only to people allowed to
see them: staff see everything; client users see only their own client's files. `src/lib/files.ts` is the
one place to change to move files to cloud storage later.

## Importing data

- **Leads** → Import CSV. Example: `samples/sample-leads.csv`.
- **Jobs** → Import jobs CSV. Example: `samples/sample-jobs.csv`. Jobs are matched to leads by phone,
  email, or name + ZIP within 180 days; matched job totals become the lead's revenue.
- **Ad spend** → Marketing Results → Import CSV (daily or monthly exports).

Every import is safe to repeat — duplicates are skipped or updated, never doubled.

## Recurring tasks

Routines create real tasks on schedule. With no background scheduler yet, the day's tasks are created
the first time anyone on the team opens the app each day (and on **Run now**). When hosted, call
`materializeRecurring()` from `src/lib/recurring.ts` in a daily job instead.

## Useful commands

| Command | What it does |
|---|---|
| `npm run db:fresh` | Empty the CRM for real use (keeps the default channels) |
| `npm run db:demo` | Wipe and fill with demo data |
| `npm run db:push` | Apply schema changes in `src/db/schema.ts` to the database |
| `npx tsc --noEmit` | Type-check |
