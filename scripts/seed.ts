// Fills local.db with DEMO data dated around today (for trying the app — not for real use).
// Run: npm run db:demo   (safe to re-run — it wipes everything first). For real use run npm run db:fresh.
//
// Every sample login uses the same local-only password, SEED_PASSWORD below
// (override with the SEED_PASSWORD environment variable). Sample logins:
//   kim@example.com (owner), alex@example.com (admin),
//   maria@example.com and jon@example.com (team),
//   owner@blueridgeplumbing.example (client portal for Blue Ridge Plumbing).
import { randomUUID } from "node:crypto";
import { db } from "../src/db";
import {
  users, sessions, services, clients, clientServices, clientOwners, tasks, taskComments, leads, requests,
  recurringTemplates, appSettings, adSpend, timeEntries, jobs,
} from "../src/db/schema";
import { rematchClient } from "../src/lib/job-matching";
import { firstOccurrenceOnOrAfter } from "../src/lib/recurrence";
import { materializeRecurring } from "../src/lib/recurring";
import { findPreset } from "../src/lib/recurring-presets";
import { addDays, toDateString } from "../src/lib/dates";
import { hashPassword } from "../src/lib/password";
import { wipeAll } from "./wipe";

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "local-dev-password";

// Deterministic pseudo-random so every seed looks the same.
let state = 42;
function rand(): number {
  state = (state * 1664525 + 1013904223) % 2 ** 32;
  return state / 2 ** 32;
}
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const today = toDateString(new Date());
const nowIso = new Date().toISOString();

function isoAt(date: string, hour: number): string {
  const d = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(between(0, 59)).padStart(2, "0")}:00`);
  // Never create sample data in the future (e.g. "today at 5pm" when it's 2am).
  const now = Date.now();
  return new Date(Math.min(d.getTime(), now - between(5, 120) * 60_000)).toISOString();
}

async function main() {
  // Start from an empty CRM (this also restores the default channel list).
  await wipeAll();

  const passwordHash = await hashPassword(SEED_PASSWORD);

  const team = [
    { name: "Kim", email: "kim@example.com", role: "owner", initials: "K", color: "#6366f1" },
    { name: "Alex Carter", email: "alex@example.com", role: "admin", initials: "AC", color: "#0ea5e9" },
    { name: "Maria Santos", email: "maria@example.com", role: "team", initials: "MS", color: "#f59e0b" },
    { name: "Jon Reyes", email: "jon@example.com", role: "team", initials: "JR", color: "#10b981" },
  ] as const;
  const userRows = team.map((u) => ({ id: randomUUID(), ...u, passwordHash, utilizationTargetHours: 120, createdAt: nowIso }));


  const clientDefs = [
    { name: "Blue Ridge Plumbing", color: "#3b82f6", lifecycle: "active", services: ["google_ads", "seo", "website"] },
    { name: "Apex Trenchless", color: "#f97316", lifecycle: "active", services: ["google_ads", "meta_ads", "seo", "automations"] },
    { name: "ClearFlow Drains", color: "#14b8a6", lifecycle: "active", services: ["seo", "website", "outreach"] },
    { name: "Northside Restoration", color: "#ef4444", lifecycle: "active", services: ["google_ads", "meta_ads"] },
    { name: "Peak Roofing Co.", color: "#8b5cf6", lifecycle: "onboarding", services: ["website", "seo"] },
    { name: "Evergreen HVAC", color: "#22c55e", lifecycle: "onboarding", services: ["google_ads"] },
    { name: "Harbor Electric", color: "#eab308", lifecycle: "paused", services: ["meta_ads"] },
    { name: "Summit Pest Control", color: "#78716c", lifecycle: "churned", services: ["seo"] },
    { name: "Agency (Internal)", color: "#64748b", lifecycle: "active", services: ["internal", "ad_hoc"], internal: true },
  ] as const;

  const clientRows = clientDefs.map((c) => ({
    id: randomUUID(),
    name: c.name,
    color: c.color,
    lifecycle: c.lifecycle,
    isInternal: "internal" in c ? c.internal : false,
    contactName: "internal" in c ? null : "Owner",
    contactEmail: "internal" in c ? null : `owner@${c.name.toLowerCase().replace(/[^a-z]/g, "")}.example`,
    createdAt: addDays(today, -between(30, 400)),
  }));
  await db.insert(clients).values(clientRows);
  await db.insert(users).values(userRows);
  // A sample client-portal login for the first client.
  await db.insert(users).values({
    id: randomUUID(),
    name: "Blue Ridge Owner",
    email: "owner@blueridgeplumbing.example",
    role: "client",
    clientId: clientRows[0].id,
    initials: "BR",
    color: "#64748b",
    passwordHash,
    createdAt: nowIso,
  });
  // One or two account owners per client.
  await db.insert(clientOwners).values(
    clientRows.flatMap((c, i) => {
      const first = userRows[i % userRows.length];
      const second = userRows[(i + 2) % userRows.length];
      return i % 3 === 0
        ? [{ clientId: c.id, userId: first.id }, { clientId: c.id, userId: second.id }]
        : [{ clientId: c.id, userId: first.id }];
    }),
  );
  await db.insert(clientServices).values(
    clientDefs.flatMap((c, i) => c.services.map((s) => ({ clientId: clientRows[i].id, serviceKey: s }))),
  );

  const taskTitles: Record<string, string[]> = {
    google_ads: ["Review search terms and add negatives", "Refresh ad copy for spring promo", "Check conversion tracking", "Adjust bids on top campaigns", "Monthly budget pacing check"],
    meta_ads: ["Launch retargeting campaign", "Swap out tired creative", "Build lookalike audience", "Review lead form quality"],
    seo: ["Publish 2 local service pages", "Fix pages not indexed in Search Console", "Update Google Business Profile posts", "Write monthly blog post", "Build 5 local citations"],
    website: ["Speed up homepage load time", "Add financing page", "Fix mobile menu bug", "Update service area map"],
    outreach: ["Send referral ask campaign", "Clean up outreach list", "Write follow-up sequence"],
    automations: ["Build missed-call text-back workflow", "Set up review request automation", "Fix lead routing rule"],
    internal: ["Prepare monthly client reports", "Update SOP for onboarding", "Team planning meeting notes", "Review EOD reports"],
    ad_hoc: ["Help client set up email signature", "Design one-off flyer", "Quick logo tweak"],
  };

  const statuses = ["todo", "todo", "in_progress", "in_progress", "blocked"] as const;
  const priorities = ["low", "medium", "medium", "high", "urgent"] as const;
  const taskRows: (typeof tasks.$inferInsert)[] = [];

  for (const [i, def] of clientDefs.entries()) {
    if (def.lifecycle === "churned") continue;
    const client = clientRows[i];
    const count = def.lifecycle === "paused" ? 2 : between(5, 9);
    for (let n = 0; n < count; n++) {
      const serviceKey = pick(def.services);
      const done = rand() < 0.3;
      // Spread due dates from 3 weeks ago to 3 weeks ahead, some without a date.
      const dueDate = rand() < 0.15 ? null : addDays(today, between(-20, 21));
      const completedAt = done
        ? isoAt(rand() < 0.35 ? addDays(today, -1) : addDays(today, -between(2, 10)), between(9, 18))
        : null;
      taskRows.push({
        id: randomUUID(),
        clientId: client.id,
        serviceKey,
        ownerId: rand() < 0.1 ? null : pick(userRows).id,
        title: pick(taskTitles[serviceKey]),
        status: done ? "done" : pick(statuses),
        priority: pick(priorities),
        dueDate,
        completedAt,
        estHours: pick([0.5, 1, 1.5, 2, 3, 4, 6]),
        clientVisible: serviceKey !== "internal" && rand() > 0.15,
        isRoutine: false,
        createdAt: isoAt(addDays(today, -between(5, 40)), 10),
      });
    }
  }
  await db.insert(tasks).values(taskRows);

  // Subtasks and comments on the first few open tasks, so the task page has something to show.
  const openParents = taskRows.filter((t) => t.status !== "done").slice(0, 4);
  const subtaskTitles = ["Gather data", "Draft changes", "Get client approval", "Publish and check"];
  for (const parent of openParents) {
    await db.insert(tasks).values(
      subtaskTitles.slice(0, between(2, 4)).map((title, i) => ({
        id: randomUUID(),
        parentId: parent.id,
        clientId: parent.clientId,
        serviceKey: parent.serviceKey,
        ownerId: parent.ownerId,
        title,
        status: i === 0 ? ("done" as const) : ("todo" as const),
        priority: parent.priority,
        completedAt: i === 0 ? isoAt(addDays(today, -2), 11) : null,
        clientVisible: parent.clientVisible,
        createdAt: parent.createdAt,
      })),
    );
    await db.insert(taskComments).values([
      { id: randomUUID(), taskId: parent.id, authorId: userRows[1].id, body: "Can you take a look at this before Friday?", createdAt: isoAt(addDays(today, -3), 10) },
      { id: randomUUID(), taskId: parent.id, authorId: userRows[0].id, body: "On it — will update here once it's done.", createdAt: isoAt(addDays(today, -2), 15) },
    ]);
  }

  // Recurring routines from presets, started three weeks ago so some routine tasks are already overdue.
  const routineStart = addDays(today, -21);
  const presetAssignments = [
    { client: 0, preset: "google_ads_standard" },
    { client: 0, preset: "seo_standard" },
    { client: 1, preset: "google_ads_standard" },
    { client: 1, preset: "meta_ads_standard" },
    { client: 8, preset: "agency_internal" },
  ];
  let templateCount = 0;
  for (const { client, preset: key } of presetAssignments) {
    const preset = findPreset(key)!;
    for (const p of preset.templates) {
      const schedule = { frequency: p.frequency, interval: p.interval, weekdays: p.weekdays ?? [], dayOfMonth: p.dayOfMonth ?? null, startsOn: routineStart };
      await db.insert(recurringTemplates).values({
        id: randomUUID(),
        clientId: clientRows[client].id,
        serviceKey: preset.serviceKey,
        ownerId: userRows[(client + templateCount) % userRows.length].id,
        title: p.title,
        priority: p.priority,
        estHours: p.estHours,
        clientVisible: p.clientVisible ?? true,
        frequency: p.frequency,
        interval: p.interval,
        weekdays: p.weekdays?.join(",") ?? null,
        dayOfMonth: p.dayOfMonth ?? null,
        startsOn: routineStart,
        nextDueOn: firstOccurrenceOnOrAfter(schedule, routineStart)!,
        leadDays: p.leadDays ?? 0,
        active: true,
        presetKey: preset.key,
        createdAt: nowIso,
      });
      templateCount++;
    }
  }
  const routineRun = await materializeRecurring({ today });

  // Leads: last 60 days, busier clients get more. Some callers call back more than once.
  const leadRows: (typeof leads.$inferInsert)[] = [];
  const firstNames = ["James", "Maria", "Robert", "Linda", "Michael", "Sarah", "David", "Karen", "Chris", "Nancy", "Daniel", "Lisa"];
  const lastNames = ["Smith", "Garcia", "Johnson", "Brown", "Miller", "Davis", "Wilson", "Moore", "Taylor", "Clark"];
  const summaries = {
    booked: ["Sewer backup in basement, booked camera inspection for tomorrow.", "Water heater leaking, scheduled replacement estimate.", "Needs drain cleaning for kitchen line — booked Thursday AM."],
    open: ["Asked for a quote on repiping, will call back after talking to spouse.", "Wants pricing for trenchless sewer repair.", "Left voicemail about a slow drain.", "Asked about financing options."],
    not_a_lead: ["Existing customer calling about an invoice.", "Vendor selling SEO services.", "Wrong number."],
    spam: ["Robocall — extended warranty.", "Spam form submission."],
  } as const;
  const repeatPool: { clientId: string; name: string; phone: string }[] = [];
  const fakePhone = () => `555${String(between(1000000, 9999999))}`;

  for (const [i, def] of clientDefs.entries()) {
    if (def.lifecycle !== "active" || "internal" in def) continue;
    const perDay = i === 0 ? 3 : i === 1 ? 4 : 2;
    for (let d = 0; d < 60; d++) {
      // Make the most recent week busier for some clients and quieter for others.
      const trend = d < 7 ? (i % 2 === 0 ? 1.4 : 0.6) : 1;
      const count = Math.round(between(0, perDay) * trend);
      for (let n = 0; n < count; n++) {
        const r = rand();
        const status = r < 0.35 ? "booked" : r < 0.8 ? "open" : r < 0.93 ? "not_a_lead" : "spam";
        const type = pick(["call", "call", "call", "form", "chat"] as const);
        const repeat = repeatPool.filter((p) => p.clientId === clientRows[i].id);
        const person = repeat.length && rand() < 0.12
          ? pick(repeat)
          : { clientId: clientRows[i].id, name: `${pick(firstNames)} ${pick(lastNames)}`, phone: fakePhone() };
        if (!repeatPool.includes(person)) repeatPool.push(person);
        leadRows.push({
          id: randomUUID(),
          clientId: clientRows[i].id,
          type,
          source: pick(["google_ads", "google_ads", "organic", "gbp", "direct", "meta_ads", "referral"] as const),
          contactName: person.name,
          phone: person.phone,
          contactKey: `p:${person.phone}`,
          summary: pick(summaries[status]),
          durationSec: type === "call" ? between(20, 600) : null,
          value: status === "booked" ? pick([250, 450, 800, 1500, 4200, 9800]) : null,
          status,
          occurredAt: isoAt(addDays(today, -d), between(8, 19)),
          provider: "manual",
          createdAt: nowIso,
        });
      }
    }
  }
  for (let i = 0; i < leadRows.length; i += 200) await db.insert(leads).values(leadRows.slice(i, i + 200));

  // Ad spend: daily Google Ads rows for 60 days, monthly Meta totals for 3 months.
  const spendRows: (typeof adSpend.$inferInsert)[] = [];
  const adClients = [
    { client: 0, googleDaily: 55 },
    { client: 1, googleDaily: 80, metaMonthly: 1500 },
    { client: 3, googleDaily: 45, metaMonthly: 900 },
    { client: 5, googleDaily: 30 },
  ];
  for (const a of adClients) {
    for (let d = 1; d <= 60; d++) {
      const amount = Math.round(a.googleDaily * (0.6 + rand() * 0.8) * 100) / 100;
      spendRows.push({
        id: randomUUID(), clientId: clientRows[a.client].id, channel: "google_ads",
        periodStart: addDays(today, -d), periodEnd: addDays(today, -d), campaign: "Search - Local Services",
        amount, clicks: Math.round(amount / (4 + rand() * 4)), impressions: Math.round(amount * (15 + rand() * 20)),
        provider: "csv", createdAt: nowIso,
      });
    }
    if (a.metaMonthly) {
      const [y, m] = today.split("-").map(Number);
      for (let i = 0; i < 3; i++) {
        const first = new Date(y, m - 1 - i, 1);
        const start = toDateString(first);
        const end = i === 0 ? today : toDateString(new Date(y, m - i, 0));
        spendRows.push({
          id: randomUUID(), clientId: clientRows[a.client].id, channel: "meta_ads",
          periodStart: start, periodEnd: end, campaign: "",
          amount: i === 0 ? Math.round(a.metaMonthly * 0.9) : a.metaMonthly, clicks: null, impressions: null,
          notes: "Monthly total from Ads Manager", provider: "manual", createdAt: nowIso,
        });
      }
    }
  }
  for (let i = 0; i < spendRows.length; i += 200) await db.insert(adSpend).values(spendRows.slice(i, i + 200));

  // Time entries: each team member logs 4–7 hours on most weekdays for the last 6 weeks.
  const timeRows: (typeof timeEntries.$inferInsert)[] = [];
  const billableClients = clientDefs.map((c, i) => ({ ...c, id: clientRows[i].id })).filter((c) => c.lifecycle !== "churned");
  const timeNotes = ["Campaign review", "Client call", "Reporting", "Content updates", "Fixes and QA", null, null];
  for (const u of userRows) {
    for (let d = 1; d <= 42; d++) {
      const date = addDays(today, -d);
      const weekday = new Date(`${date}T00:00:00`).getDay();
      if (weekday === 0 || weekday === 6 || rand() < 0.08) continue;
      let remaining = between(240, 420);
      while (remaining >= 15) {
        const client = pick(billableClients);
        const serviceKey = pick(client.services);
        const minutes = Math.min(remaining, pick([15, 30, 45, 60, 90, 120]));
        const task = taskRows.find((t) => t.clientId === client.id && t.serviceKey === serviceKey && rand() < 0.5);
        timeRows.push({
          id: randomUUID(), userId: u.id, clientId: client.id, serviceKey, taskId: task?.id ?? null,
          date, minutes, note: pick(timeNotes), createdAt: nowIso,
        });
        remaining -= minutes;
      }
    }
  }
  for (let i = 0; i < timeRows.length; i += 200) await db.insert(timeEntries).values(timeRows.slice(i, i + 200));

  // Jobs for three clients: most booked leads became a job (matched by phone), plus repeat
  // customers and referrals with no lead, a few estimates, and some unpaid balances.
  const jobRows: (typeof jobs.$inferInsert)[] = [];
  const jobTypes = ["Sewer line replacement", "Drain cleaning", "Water heater install", "Camera inspection", "Trenchless repair", "Leak repair"];
  let jobNumber = 5000;
  for (const clientIndex of [0, 1, 3]) {
    const clientId = clientRows[clientIndex].id;
    const booked = leadRows.filter((l) => l.clientId === clientId && l.status === "booked");
    for (const lead of booked) {
      if (rand() < 0.15) continue; // booked but never turned into a job in the software
      const leadDate = toDateString(new Date(lead.occurredAt!));
      const createdOn = addDays(leadDate, between(0, 3));
      if (createdOn > today) continue;
      const scheduledOn = addDays(createdOn, between(1, 10));
      const done = scheduledOn < today;
      const total = Math.round((lead.value ?? 800) * (0.8 + rand() * 0.7));
      jobRows.push({
        id: randomUUID(), clientId, externalId: String(jobNumber++), customerName: lead.contactName ?? null,
        phone: lead.phone ?? null, contactKey: lead.contactKey ?? null, description: pick(jobTypes),
        status: done ? "completed" : "scheduled", createdOn, scheduledOn, completedOn: done ? scheduledOn : null,
        total, paid: done ? (rand() < 0.8 ? total : Math.round(total * 0.5)) : 0, leadSource: pick(["Google", "Website", "GBP", "Facebook"]),
        provider: "csv", createdAt: nowIso,
      });
    }
    for (let n = 0; n < 8; n++) {
      const createdOn = addDays(today, -between(1, 55));
      const estimate = n < 3;
      const total = estimate ? pick([4800, 9500, 14200]) : pick([350, 600, 1200, 2400]);
      jobRows.push({
        id: randomUUID(), clientId, externalId: String(jobNumber++), customerName: `${pick(firstNames)} ${pick(lastNames)}`,
        phone: fakePhone(), contactKey: null, description: pick(jobTypes),
        status: estimate ? "estimate" : "completed", createdOn, scheduledOn: null, completedOn: estimate ? null : createdOn,
        total, paid: estimate ? null : total, leadSource: estimate ? "Website" : pick(["Repeat customer", "Referral", "Yard sign"]),
        provider: "csv", createdAt: nowIso,
      });
    }
  }
  for (const j of jobRows) j.contactKey = j.phone ? `p:${j.phone}` : null;
  for (let i = 0; i < jobRows.length; i += 200) await db.insert(jobs).values(jobRows.slice(i, i + 200));
  for (const clientIndex of [0, 1, 3]) await rematchClient(clientRows[clientIndex].id);

  const requestDefs = [
    { client: 0, type: "ad_change", title: "Pause the drain cleaning ads this weekend", body: "We're fully booked Saturday and Sunday. Please turn them back on Monday morning.", status: "open", daysAgo: 0 },
    { client: 1, type: "content", title: "Add new photos to the website gallery", body: "I uploaded 12 photos from last week's jobs to the shared folder.", status: "open", daysAgo: 1 },
    { client: 2, type: "question", title: "Why did calls drop last week?", body: null, status: "open", daysAgo: 2 },
    { client: 3, type: "budget_change", title: "Increase Google Ads budget to $4,000", body: "Starting next month.", status: "replied", daysAgo: 4 },
    { client: 0, type: "question", title: "Can we add financing info to the website?", body: "Customers keep asking about payment plans.", status: "replied", daysAgo: 6 },
  ] as const;
  await db.insert(requests).values(
    requestDefs.map((r) => ({
      id: randomUUID(),
      clientId: clientRows[r.client].id,
      type: r.type,
      title: r.title,
      body: r.body,
      status: r.status,
      reply: r.status === "replied" ? "Thanks — we'll take care of this and confirm here once it's live." : null,
      repliedById: r.status === "replied" ? userRows[1].id : null,
      repliedAt: r.status === "replied" ? isoAt(addDays(today, -r.daysAgo + 1), 11) : null,
      createdAt: isoAt(addDays(today, -r.daysAgo), 9),
    })),
  );

  console.log(
    `Seeded ${userRows.length} users, ${clientRows.length} clients, ${taskRows.length} tasks, ${templateCount} routines (${routineRun.created} routine tasks), ${leadRows.length} leads, ${spendRows.length} spend rows, ${timeRows.length} time entries, ${jobRows.length} jobs, ${requestDefs.length} requests (as of ${nowIso}).`,
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
