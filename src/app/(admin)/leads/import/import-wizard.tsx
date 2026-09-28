"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp } from "lucide-react";
import type { Lookups } from "@/lib/queries";
import type { LeadType } from "@/db/schema";
import {
  formatDuration,
  formatPhone,
  guessMapping,
  IMPORT_FIELDS,
  LEAD_SOURCE_LABEL,
  LEAD_STATUS_LABEL,
  LEAD_TYPE_LABEL,
  normalizeImportRow,
  parseCsv,
  type ImportMapping,
  type ImportRow,
} from "@/lib/leads";
import { importLeadBatch, type ImportResult } from "../actions";

// Small batches keep each upload well under the server request size limit, even with long transcripts.
const BATCH_SIZE = 100;
const MAX_CELL_CHARS = 5000;
const MAX_ROWS = 20_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

type Parsed = { fileName: string; headers: string[]; rows: string[][] };

export function ImportWizard({ clients, defaultClientId }: { clients: Lookups["clients"]; defaultClientId?: string }) {
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [defaultType, setDefaultType] = useState<LeadType>("call");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFile(file: File | undefined) {
    setFileError(null);
    setParsed(null);
    setResult(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setFileError("That file is over 10 MB. Split it into smaller files.");
    const all = parseCsv(await file.text());
    if (all.length < 2) return setFileError("That file has no data rows. Make sure it's a CSV with a header row.");
    const [headers, ...rows] = all;
    if (rows.length > MAX_ROWS) return setFileError(`That file has ${rows.length.toLocaleString()} rows. Import at most ${MAX_ROWS.toLocaleString()} at a time.`);
    setParsed({ fileName: file.name, headers: headers.map((h) => h.trim()), rows });
    setMapping(guessMapping(headers));
  }

  const mappedRows: ImportRow[] = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((cells) => {
      const row: ImportRow = {};
      for (const field of IMPORT_FIELDS) {
        const index = mapping[field.key];
        if (index !== undefined) row[field.key] = (cells[index] ?? "").slice(0, MAX_CELL_CHARS);
      }
      return row;
    });
  }, [parsed, mapping]);

  const check = useMemo(() => {
    const normalized = mappedRows.map((r) => normalizeImportRow(r, defaultType));
    const errors = normalized
      .map((n, i) => (n.error ? { row: i + 2, message: n.error } : null))
      .filter((e): e is { row: number; message: string } => e !== null);
    return { normalized, errors, ok: normalized.length - errors.length };
  }, [mappedRows, defaultType]);

  const canImport = parsed && clientId && mapping.occurredAt !== undefined && check.ok > 0 && !progress;

  async function runImport() {
    if (!canImport) return;
    const totals: ImportResult = { imported: 0, duplicates: 0, errors: [] };
    setProgress({ done: 0, total: mappedRows.length });
    for (let start = 0; start < mappedRows.length; start += BATCH_SIZE) {
      const batch = mappedRows.slice(start, start + BATCH_SIZE);
      try {
        const res = await importLeadBatch({ clientId, defaultType, rows: batch, firstRowNumber: start + 2 });
        totals.imported += res.imported;
        totals.duplicates += res.duplicates;
        totals.errors.push(...res.errors);
      } catch {
        totals.errors.push({ row: start + 2, message: `Rows ${start + 2}–${start + 1 + batch.length} failed to upload. Try importing again — duplicates are skipped.` });
      }
      setProgress({ done: Math.min(start + BATCH_SIZE, mappedRows.length), total: mappedRows.length });
    }
    setProgress(null);
    setResult(totals);
  }

  if (result) {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <CheckCircle2 className="h-6 w-6 text-green-600" /> Import finished
        </div>
        <ul className="space-y-1 text-sm text-slate-700">
          <li><strong>{result.imported.toLocaleString()}</strong> {plural(result.imported, "lead")} imported</li>
          <li><strong>{result.duplicates.toLocaleString()}</strong> skipped because {result.duplicates === 1 ? "it was" : "they were"} already in the CRM</li>
          <li><strong>{result.errors.length.toLocaleString()}</strong> {plural(result.errors.length, "row")} couldn't be read</li>
        </ul>
        {result.errors.length > 0 && <ErrorList errors={result.errors} done />}
        <div className="flex gap-2">
          <Link href={`/leads?client=${clientId}&window=all`} className="btn-primary">View leads</Link>
          <button type="button" className="btn-secondary" onClick={() => { setResult(null); setParsed(null); }}>Import another file</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">1. Choose the client and file</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label>
            <span className="label">Client</span>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input mt-1">
              <option value="" disabled>Choose a client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            <span className="label">If a row has no type, treat it as</span>
            <select value={defaultType} onChange={(e) => setDefaultType(e.target.value as LeadType)} className="input mt-1">
              {Object.entries(LEAD_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>
            <span className="label">CSV file</span>
            <span className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-indigo-400 hover:bg-indigo-50/40">
              <FileUp className="h-4 w-4" />
              <span className="truncate">{parsed ? parsed.fileName : "Choose a .csv file…"}</span>
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </span>
          </label>
        </div>
        {fileError && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{fileError}</p>}
      </section>

      {parsed && (
        <>
          {/* Step 2 */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">2. Match your columns</h2>
            <p className="mt-1 text-sm text-slate-500">
              We guessed which column is which — check them. Only <strong>Date / time</strong> is required, plus at least a name, phone or email in each row.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {IMPORT_FIELDS.map((field) => (
                <label key={field.key}>
                  <span className="label">
                    {field.label}
                    {"required" in field && field.required && <span className="text-red-600"> *</span>}
                  </span>
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                    className="input mt-1"
                  >
                    <option value="">— Don't import —</option>
                    {parsed.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </section>

          {/* Step 3 */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">3. Check and import</h2>
            <p className="mt-1 text-sm text-slate-600">
              <strong>{check.ok.toLocaleString()}</strong> of {parsed.rows.length.toLocaleString()} rows are ready.
              {check.errors.length > 0 && <> <strong>{check.errors.length.toLocaleString()}</strong> will be skipped.</>} Rows already in the CRM are skipped automatically.
            </p>

            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[800px] text-xs">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Contact</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Length</th>
                    <th className="px-3 py-2 font-medium">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {check.normalized.slice(0, 6).map((n, i) =>
                    n.lead ? (
                      <tr key={i}>
                        <td className="whitespace-nowrap px-3 py-2">{new Date(n.lead.occurredAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                        <td className="px-3 py-2">{n.lead.contactName || formatPhone(n.lead.phone) || n.lead.email}<div className="text-slate-400">{n.lead.contactName ? formatPhone(n.lead.phone) || n.lead.email : ""}</div></td>
                        <td className="px-3 py-2">{LEAD_TYPE_LABEL[n.lead.type]}</td>
                        <td className="px-3 py-2">{LEAD_SOURCE_LABEL[n.lead.source]}{n.lead.sourceDetail && <div className="text-slate-400">{n.lead.sourceDetail}</div>}</td>
                        <td className="px-3 py-2">{LEAD_STATUS_LABEL[n.lead.status]}</td>
                        <td className="px-3 py-2">{formatDuration(n.lead.durationSec) || "—"}</td>
                        <td className="max-w-[260px] truncate px-3 py-2">{n.lead.summary ?? "—"}</td>
                      </tr>
                    ) : (
                      <tr key={i} className="bg-red-50/50 text-red-700">
                        <td colSpan={7} className="px-3 py-2">Row {i + 2}: {n.error}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-400">Showing the first 6 rows as they'll be saved. Sources and statuses are matched from your text (e.g. "PPC" → Google Ads, "Scheduled" → Booked).</p>

            {check.errors.length > 0 && <ErrorList errors={check.errors} />}

            {mapping.occurredAt === undefined && (
              <p className="mt-4 flex items-center gap-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" /> Choose which column has the date.</p>
            )}
            {!clientId && (
              <p className="mt-4 flex items-center gap-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" /> Choose a client in step 1.</p>
            )}

            <div className="mt-5 flex items-center gap-4">
              <button type="button" disabled={!canImport} onClick={runImport} className="btn-primary">
                {progress ? "Importing…" : `Import ${check.ok.toLocaleString()} leads`}
              </button>
              {progress && (
                <div className="flex flex-1 items-center gap-3">
                  <div className="h-2 flex-1 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                  </div>
                  <span className="text-sm text-slate-500">{progress.done.toLocaleString()} / {progress.total.toLocaleString()}</span>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`);

function ErrorList({ errors, done = false }: { errors: { row: number; message: string }[]; done?: boolean }) {
  return (
    <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <summary className="cursor-pointer font-medium">See rows that {done ? "were" : "will be"} skipped ({errors.length.toLocaleString()})</summary>
      <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-xs">
        {errors.slice(0, 200).map((e, i) => (
          <li key={i}>Row {e.row}: {e.message}</li>
        ))}
        {errors.length > 200 && <li>…and {errors.length - 200} more</li>}
      </ul>
    </details>
  );
}
