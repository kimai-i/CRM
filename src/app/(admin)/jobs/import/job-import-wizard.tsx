"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp } from "lucide-react";
import type { Lookups } from "@/lib/queries";
import { formatPhone, parseCsv } from "@/lib/leads";
import { guessJobMapping, JOB_FIELDS, JOB_STATUS_LABEL, normalizeJobRow, type JobImportRow, type JobMapping } from "@/lib/jobs";
import { importJobBatch, type JobImportResult } from "../actions";

const BATCH_SIZE = 200;
const MAX_ROWS = 20_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Parsed = { fileName: string; headers: string[]; rows: string[][] };

export function JobImportWizard({ clients, defaultClientId }: { clients: Lookups["clients"]; defaultClientId?: string }) {
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<JobMapping>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<JobImportResult | null>(null);

  async function onFile(file: File | undefined) {
    setFileError(null);
    setParsed(null);
    setResult(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setFileError("That file is over 10 MB. Export a shorter date range.");
    const all = parseCsv(await file.text());
    if (all.length < 2) return setFileError("That file has no data rows. Make sure it's a CSV with a header row.");
    const [headers, ...rows] = all;
    if (rows.length > MAX_ROWS) return setFileError(`That file has ${rows.length.toLocaleString()} rows. Import at most ${MAX_ROWS.toLocaleString()} at a time.`);
    setParsed({ fileName: file.name, headers: headers.map((h) => h.trim()), rows });
    setMapping(guessJobMapping(headers));
  }

  const mappedRows: JobImportRow[] = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((cells) => {
      const row: JobImportRow = {};
      for (const f of JOB_FIELDS) {
        const index = mapping[f.key];
        if (index !== undefined) row[f.key] = (cells[index] ?? "").slice(0, 1000);
      }
      return row;
    });
  }, [parsed, mapping]);

  const check = useMemo(() => {
    const normalized = mappedRows.map((r) => normalizeJobRow(r));
    const errors = normalized
      .map((n, i) => (n.error ? { row: i + 2, message: n.error } : null))
      .filter((e): e is { row: number; message: string } => e !== null);
    const ok = normalized.flatMap((n) => (n.job ? [n.job] : []));
    return {
      normalized,
      errors,
      okCount: ok.length,
      total: ok.filter((j) => j.status !== "canceled" && j.status !== "estimate").reduce((s, j) => s + j.total, 0),
      withContact: ok.filter((j) => j.contactKey).length,
    };
  }, [mappedRows]);

  const canImport = parsed && clientId && mapping.createdOn !== undefined && mapping.total !== undefined && check.okCount > 0 && !progress;

  async function runImport() {
    if (!canImport) return;
    const totals: JobImportResult = { added: 0, updated: 0, duplicates: 0, errors: [] };
    setProgress({ done: 0, total: mappedRows.length });
    for (let start = 0; start < mappedRows.length; start += BATCH_SIZE) {
      const batch = mappedRows.slice(start, start + BATCH_SIZE);
      try {
        const res = await importJobBatch({ clientId, rows: batch, firstRowNumber: start + 2, isLastBatch: start + BATCH_SIZE >= mappedRows.length });
        totals.added += res.added;
        totals.updated += res.updated;
        totals.duplicates += res.duplicates;
        totals.errors.push(...res.errors);
      } catch {
        totals.errors.push({ row: start + 2, message: "A batch failed to upload. Import the file again — jobs already saved are updated, not doubled." });
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
          <li><strong>{result.added.toLocaleString()}</strong> new job{result.added === 1 ? "" : "s"} added</li>
          <li><strong>{result.updated.toLocaleString()}</strong> existing job{result.updated === 1 ? "" : "s"} updated (same job #)</li>
          {result.duplicates > 0 && <li><strong>{result.duplicates.toLocaleString()}</strong> skipped as duplicates</li>}
          {result.errors.length > 0 && <li><strong>{result.errors.length.toLocaleString()}</strong> row{result.errors.length === 1 ? "" : "s"} couldn&apos;t be read</li>}
        </ul>
        <p className="text-sm text-slate-500">Jobs were matched to this client&apos;s leads. Marketing Results now uses the matched job totals.</p>
        {result.errors.length > 0 && <ErrorList errors={result.errors} done />}
        <div className="flex gap-2">
          <Link href={`/jobs?client=${clientId}&window=ytd`} className="btn-primary">View jobs</Link>
          <Link href={`/marketing-results?client=${clientId}`} className="btn-secondary">Marketing Results</Link>
          <button type="button" className="btn-ghost" onClick={() => { setResult(null); setParsed(null); }}>Import another file</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">1. Choose the client and file</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Client</span>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input mt-1">
              <option value="" disabled>Choose a client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              <strong>Job date</strong> and <strong>Job total</strong> are required. Phone and email let us match jobs to leads; the job # lets re-imports update jobs instead of duplicating them.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {JOB_FIELDS.map((field) => (
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
              <strong>{check.okCount.toLocaleString()}</strong> jobs ready ({money(check.total)} in scheduled or completed work).{" "}
              {check.withContact < check.okCount && (
                <span className="text-amber-700">{check.okCount - check.withContact} have no phone or email, so they can only match a lead by name + ZIP.</span>
              )}
              {check.errors.length > 0 && <> {check.errors.length} row{check.errors.length === 1 ? "" : "s"} will be skipped.</>}
            </p>

            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[760px] text-xs">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Job #</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">Paid</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {check.normalized.slice(0, 6).map((n, i) =>
                    n.job ? (
                      <tr key={i}>
                        <td className="px-3 py-2">{n.job.externalId ?? "—"}</td>
                        <td className="px-3 py-2">{n.job.createdOn}</td>
                        <td className="px-3 py-2">{n.job.customerName ?? "—"}<div className="text-slate-400">{n.job.phone ? formatPhone(n.job.phone) : n.job.email}</div></td>
                        <td className="px-3 py-2">{JOB_STATUS_LABEL[n.job.status]}</td>
                        <td className="px-3 py-2 text-right">{money(n.job.total)}</td>
                        <td className="px-3 py-2 text-right">{n.job.paid === null ? "—" : money(n.job.paid)}</td>
                        <td className="max-w-[220px] truncate px-3 py-2">{n.job.description ?? "—"}</td>
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
            {check.errors.length > 0 && <ErrorList errors={check.errors} />}

            {(mapping.createdOn === undefined || mapping.total === undefined) && (
              <p className="mt-4 flex items-center gap-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" /> Choose the job date and total columns.</p>
            )}
            {!clientId && (
              <p className="mt-4 flex items-center gap-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" /> Choose a client in step 1.</p>
            )}

            <div className="mt-5 flex items-center gap-4">
              <button type="button" disabled={!canImport} onClick={runImport} className="btn-primary">
                {progress ? "Importing…" : `Import ${check.okCount.toLocaleString()} jobs`}
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
