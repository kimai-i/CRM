// Pure lead helpers shared by the browser (import preview) and the server (validation).
import type { LeadSource, LeadStatus, LeadType } from "@/db/schema";

export const LEAD_TYPE_LABEL: Record<LeadType, string> = {
  call: "Call",
  form: "Form",
  chat: "Chat / text",
  outreach: "Outreach",
};

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  organic: "Organic search",
  gbp: "Google Business Profile",
  direct: "Direct",
  referral: "Referral",
  outreach: "Outreach",
  other: "Other",
};

export const LEAD_SOURCE_COLOR: Record<LeadSource, string> = {
  google_ads: "#3b82f6",
  meta_ads: "#8b5cf6",
  organic: "#22c55e",
  gbp: "#f59e0b",
  direct: "#64748b",
  referral: "#ec4899",
  outreach: "#14b8a6",
  other: "#a3a3a3",
};

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  open: "Open",
  booked: "Booked",
  not_a_lead: "Not a lead",
  spam: "Spam",
};

export const isRealLead = (status: LeadStatus) => status === "open" || status === "booked";

// ---------- Normalizers ----------

/** Digits only; US numbers reduced to their last 10 digits. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function formatPhone(raw: string | null | undefined): string {
  const p = normalizePhone(raw);
  if (!p) return raw ?? "";
  return p.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const e = raw?.trim().toLowerCase();
  return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** Same person across leads: phone first, then email. */
export function contactKeyFor(phone: string | null | undefined, email: string | null | undefined): string | null {
  const p = normalizePhone(phone);
  if (p) return `p:${p}`;
  const e = normalizeEmail(email);
  return e ? `e:${e}` : null;
}

export function guessType(raw: string | null | undefined, fallback: LeadType = "call"): LeadType {
  const v = raw?.toLowerCase() ?? "";
  if (/call|phone|voice/.test(v)) return "call";
  if (/form|web ?lead|submission|quote/.test(v)) return "form";
  if (/chat|sms|text|message|conversation|webchat|facebook messenger/.test(v)) return "chat";
  if (/outreach|cold|email|instantly/.test(v)) return "outreach";
  return fallback;
}

export function guessSource(raw: string | null | undefined): LeadSource {
  const v = raw?.toLowerCase() ?? "";
  if (!v) return "other";
  if (/google ?ads|adwords|ppc|cpc|paid search|gclid|lsa|local services/.test(v)) return "google_ads";
  if (/facebook|meta|instagram|\bfb\b|\big\b/.test(v)) return "meta_ads";
  if (/gbp|gmb|business profile|google my business|maps/.test(v)) return "gbp";
  if (/organic|seo|search|google/.test(v)) return "organic";
  if (/referr|partner|word of mouth/.test(v)) return "referral";
  if (/outreach|cold|instantly/.test(v)) return "outreach";
  if (/direct|website|none/.test(v)) return "direct";
  return "other";
}

export function guessStatus(raw: string | null | undefined): LeadStatus {
  const v = raw?.toLowerCase() ?? "";
  if (/spam|robo|scam/.test(v)) return "spam";
  if (/not a lead|junk|wrong number|existing customer|solicit|vendor|no answer|hang ?up|hung up/.test(v)) return "not_a_lead";
  if (/book|won|sold|scheduled|appointment|closed ?won|job/.test(v)) return "booked";
  return "open";
}

/** "1:05", "01:02:03", "65", "65s", "2 min" → seconds. */
export function parseDuration(raw: string | null | undefined): number | null {
  const v = raw?.trim().toLowerCase();
  if (!v) return null;
  if (/^\d+(:\d{1,2}){1,2}$/.test(v)) {
    return v.split(":").map(Number).reduce((total, part) => total * 60 + part, 0);
  }
  const n = parseFloat(v);
  if (Number.isNaN(n)) return null;
  return Math.round(/min/.test(v) ? n * 60 : n);
}

export function formatDuration(sec: number | null | undefined): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseMoney(raw: string | null | undefined): number | null {
  const v = raw?.replace(/[$,\s]/g, "");
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Accepts ISO strings, "2026-09-28 14:05", "9/28/2026", "09/28/2026 2:05 PM", etc.
 * Times without a timezone are read as local time. Returns an ISO string or null.
 */
export function parseDateLoose(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;

  // M/D/YYYY or M/D/YY with optional time
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i);
  if (us) {
    const [, mo, d, yRaw, hRaw, mi, s, ampm] = us;
    let y = Number(yRaw);
    if (y < 100) y += 2000;
    let h = hRaw ? Number(hRaw) : 12;
    if (ampm) h = (h % 12) + (ampm.toLowerCase() === "pm" ? 12 : 0);
    const date = new Date(y, Number(mo) - 1, Number(d), h, mi ? Number(mi) : 0, s ? Number(s) : 0);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  // YYYY-MM-DD with optional time and no timezone → local time
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (iso) {
    const [, y, mo, d, h, mi, s] = iso;
    const date = new Date(Number(y), Number(mo) - 1, Number(d), h ? Number(h) : 12, mi ? Number(mi) : 0, s ? Number(s) : 0);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const date = new Date(v);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ---------- CSV ----------

/** RFC 4180-style parser: handles quoted fields, escaped quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// ---------- Import mapping ----------

export const IMPORT_FIELDS = [
  { key: "occurredAt", label: "Date / time", required: true, hints: ["date", "time", "created", "timestamp", "start"] },
  { key: "contactName", label: "Contact name", hints: ["name", "contact", "caller", "customer", "full name"] },
  { key: "phone", label: "Phone", hints: ["phone", "number", "caller id", "mobile", "tel"] },
  { key: "email", label: "Email", hints: ["email", "e-mail"] },
  { key: "type", label: "Lead type", hints: ["type", "channel", "medium", "kind"] },
  { key: "source", label: "Source", hints: ["source", "campaign", "utm_source", "tracking", "attribution", "referrer"] },
  { key: "status", label: "Status", hints: ["status", "outcome", "result", "disposition", "stage"] },
  { key: "summary", label: "Summary / message", hints: ["summary", "message", "notes", "note", "comment", "transcript", "description"] },
  { key: "duration", label: "Call duration", hints: ["duration", "length", "talk time"] },
  { key: "value", label: "Value ($)", hints: ["value", "revenue", "amount", "price", "total"] },
  { key: "zip", label: "ZIP code", hints: ["zip", "postal"] },
  { key: "address", label: "Address", hints: ["address", "street"] },
  { key: "externalId", label: "Record ID (for duplicates)", hints: ["id", "call id", "lead id", "record id", "uuid"] },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type ImportMapping = Partial<Record<ImportFieldKey, number>>;
export type ImportRow = Partial<Record<ImportFieldKey, string>>;

/** Picks the best-matching column for each field from the CSV headers. */
export function guessMapping(headers: string[]): ImportMapping {
  const used = new Set<number>();
  const mapping: ImportMapping = {};
  const norm = headers.map((h) => h.trim().toLowerCase());

  for (const field of IMPORT_FIELDS) {
    // Exact header match first, then "header contains hint".
    let index = norm.findIndex((h, i) => !used.has(i) && (field.hints as readonly string[]).includes(h));
    if (index === -1) index = norm.findIndex((h, i) => !used.has(i) && field.hints.some((hint) => h.includes(hint)));
    if (index !== -1) {
      mapping[field.key] = index;
      used.add(index);
    }
  }
  return mapping;
}

export type NormalizedLead = {
  occurredAt: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  contactKey: string | null;
  type: LeadType;
  source: LeadSource;
  sourceDetail: string | null;
  status: LeadStatus;
  summary: string | null;
  durationSec: number | null;
  value: number | null;
  zip: string | null;
  address: string | null;
  externalId: string | null;
};

const clean = (v: string | undefined, max: number) => {
  const t = v?.trim();
  return t ? t.slice(0, max) : null;
};

/** Turns one mapped CSV row into a lead, or explains why it can't be imported. */
export function normalizeImportRow(row: ImportRow, defaultType: LeadType): { lead?: NormalizedLead; error?: string } {
  const occurredAt = parseDateLoose(row.occurredAt);
  if (!occurredAt) return { error: row.occurredAt ? `Couldn't read the date "${row.occurredAt}"` : "Missing date" };

  const phone = normalizePhone(row.phone);
  const email = normalizeEmail(row.email);
  const contactName = clean(row.contactName, 200);
  if (!phone && !email && !contactName) return { error: "Needs at least a name, phone or email" };

  return {
    lead: {
      occurredAt,
      contactName,
      phone,
      email,
      contactKey: contactKeyFor(phone, email),
      type: row.type ? guessType(row.type, defaultType) : defaultType,
      source: guessSource(row.source),
      sourceDetail: clean(row.source, 200),
      status: guessStatus(row.status),
      summary: clean(row.summary, 5000),
      durationSec: parseDuration(row.duration),
      value: parseMoney(row.value),
      zip: clean(row.zip, 20),
      address: clean(row.address, 300),
      externalId: clean(row.externalId, 200),
    },
  };
}
