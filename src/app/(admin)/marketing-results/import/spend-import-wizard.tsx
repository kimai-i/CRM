"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp } from "lucide-react";
import type { Lookups } from "@/lib/queries";
import type { SpendChannel } from "@/db/schema";
import { parseCsv } from "@/lib/leads";
import { SPEND_CHANNEL_LABEL } from "@/lib/metrics";
import {
  detectHeaderRow,
  guessSpendMapping,
  normalizeSpendRow,
  SPEND_FIELDS,
  type SpendImportRow,
  type SpendMapping,
} from "@/lib/spend-import";
import { importSpendBatch, type SpendImportResult } from "../actions";

const BATCH_SIZE = 200;
const MAX_ROWS = 20_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

type Parsed = { fileName: string; headers: string[]; rows: string[][]; headerRowNumber: number };

const money2 = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SpendImportWizard({ clients, defaultClientId }: { clients: Lookups["clients"]; defaultClientId?: string }) {
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [channel, setChannel] = useState<SpendChannel>("google_ads");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<SpendMapping>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<SpendImportResult | null>(null);

  async function onFile(file: File | undefined) {
    setFileError(null);
    setParsed(null);
    setResult(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setFileError("That file is over 10 MB. Export a shorter date range.");
    const all = parseCsv(await file.text());
    const headerIndex = detectHeaderRow(all);
    const headers = all[headerIndex] ?? [];
    const rows = all.slice(headerIndex + 1);
    if (rows.length === 0) return setFileError("That file has no data rows under the header.");
    if (rows.length > MAX_ROWS) return setFileError(`That file has ${rows.length.toLocaleString()} rows. Import at most ${MAX_ROWS.toLocaleString()} at a time.`);
    if (/meta|facebook/i.test(file.name)) setChannel("meta_ads");
    setParsed({ fileName: file.name, headers: headers.map((h) => h.trim()), rows, headerRowNumber: headerIndex + 1 });
    setMapping(guessSpendMapping(headers));
  }

  const mappedRows: SpendImportRow[] = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((cells) => {
      const row: SpendImportRow = {};
      for (const f of SPEND_FIELDS) {
        const index = mapping[f.key];
        if (index !== undefined) row[f.key] = (cells[index] ?? "").slice(0, 300);
      }
      return row;
    });
  }, [parsed, mapping]);

  const check = useMemo(() => {
    const normalized = mappedRows.map((r) => normalizeSpendRow(r));
    const firstDataRow = (parsed?.headerRowNumber ?? 1) + 1;
    const errors = normalized
      .map((n, i) => (n.error ? { row: firstDataRow + i, message: n.error } : null))
      .filter((e): e is { row: number; message: string } => e !== null);
    const ok = normalized.filter((n) => n.spend);
    const total = ok.reduce((s, n) => s + (n.spend?.amount ?? 0), 0);
    const dates = ok.flatMap((n) => [n.spend!.periodStart, n.spend!.periodEnd]).sort();
    return { normalized, errors, okCount: ok.length, total, from: dates[0], to: dates[dates.length - 1] };
  }, [mappedRows, parsed]);

  const canImport = parsed && clientId && mapping.startDate !== undefined && mapping.amount !== undefined && check.okCount > 0 && !progress;

  async function runImport() {
    if (!canImport || !parsed) return;
    const totals: SpendImportResult = { saved: 0, errors: [] };
    setProgress({ done: 0, total: mappedRows.length });
    for (let start = 0; start < mappedRows.length; start += BATCH_SIZE) {
      const batch = mappedRows.slice(start, start + BATCH_SIZE);
      try {
        const res = await importSpendBatch({ clientId, channel, rows: batch, firstRowNumber: parsed.headerRowNumber + 1 + start });
        totals.saved += res.saved;
        totals.errors.push(...res.errors);
      } catch {
        totals.errors.push({ row: start, message: "A batch failed to upload. Import again — rows already saved are updated, not doubled." });
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
        <p className="text-sm text-slate-700">
          Saved <strong>{result.saved.toLocaleString()}</strong> spend row{result.saved === 1 ? "" : "s"} for {SPEND_CHANNEL_LABEL[channel]}.
          Rows that were already in the CRM were updated with the new numbers.
          {result.errors.length > 0 && <> {result.errors.length} row{result.errors.length === 1 ? " was" : "s were"} skipped.</>}
        </p>
        {result.errors.length > 0 && <ErrorList errors={result.errors} done />}
        <div className="flex gap-2">
          <Link href={`/marketing-results?client=${clientId}`} className="btn-primary">View results</Link>
          <button type="button" className="btn-secondary" onClick={() => { setResult(null); setParsed(null); }}>Import another file</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">1. Choose the client, channel and file</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label>
            <span className="label">Client</span>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input mt-1">
              <option value="" disabled>Choose a client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Channel</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value as SpendChannel)} className="input mt-1">
              {Object.entries(SPEND_CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">2. Match your columns</h2>
            <p className="mt-1 text-sm text-slate-500">
              Using row {parsed.headerRowNumber} as the header. <strong>Date</strong> and <strong>Cost</strong> are required.
              For monthly or weekly exports, also pick the period end column.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SPEND_FIELDS.map((field) => (
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
                    <option value="">— Don&apos;t import —</option>
                    {parsed.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">3. Check and import</h2>
            <p className="mt-1 text-sm text-slate-600">
              <strong>{check.okCount.toLocaleString()}</strong> rows totalling <strong>{money2(check.total)}</strong>
              {check.from && <> from {check.from} to {check.to}</>}.
              {check.errors.length > 0 && <> {check.errors.length} will be skipped.</>}
            </p>

            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Period</th>
                    <th className="px-3 py-2 font-medium">Campaign</th>
                    <th className="px-3 py-2 text-right font-medium">Cost</th>
                    <th className="px-3 py-2 text-right font-medium">Clicks</th>
                    <th className="px-3 py-2 text-right font-medium">Impressions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {check.normalized.slice(0, 6).map((n, i) =>
                    n.spend ? (
                      <tr key={i}>
                        <td className="px-3 py-2">{n.spend.periodStart === n.spend.periodEnd ? n.spend.periodStart : `${n.spend.periodStart} → ${n.spend.periodEnd}`}</td>
                        <td className="px-3 py-2">{n.spend.campaign || "—"}</td>
                        <td className="px-3 py-2 text-right">{money2(n.spend.amount)}</td>
                        <td className="px-3 py-2 text-right">{n.spend.clicks?.toLocaleString() ?? "—"}</td>
                        <td className="px-3 py-2 text-right">{n.spend.impressions?.toLocaleString() ?? "—"}</td>
                      </tr>
                    ) : (
                      <tr key={i} className="bg-red-50/50 text-red-700">
                        <td colSpan={5} className="px-3 py-2">Row {(parsed.headerRowNumber ?? 1) + 1 + i}: {n.error}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            {check.errors.length > 0 && <ErrorList errors={check.errors} />}

            {(mapping.startDate === undefined || mapping.amount === undefined) && (
              <p className="mt-4 flex items-center gap-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" /> Choose the date and cost columns.</p>
            )}
            {!clientId && (
              <p className="mt-4 flex items-center gap-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" /> Choose a client in step 1.</p>
            )}

            <div className="mt-5 flex items-center gap-4">
              <button type="button" disabled={!canImport} onClick={runImport} className="btn-primary">
                {progress ? "Importing…" : `Import ${check.okCount.toLocaleString()} rows`}
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

function ErrorList({ errors, done = false }: { errors: { row: number; message: string }[]; done?: boolean }) {
  return (
    <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <summary className="cursor-pointer font-medium">See rows that {done ? "were" : "will be"} skipped ({errors.length.toLocaleString()})</summary>
      <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-xs">
        {errors.slice(0, 200).map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
        {errors.length > 200 && <li>…and {errors.length - 200} more</li>}
      </ul>
    </details>
  );
}
