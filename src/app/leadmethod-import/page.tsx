"use client";

import { ChangeEvent, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase-browser";

type CsvRow = Record<string, string>;

type ParsedCsv = {
  fileName: string;
  headers: string[];
  rows: CsvRow[];
};

type AnalyzeRow = {
  rowNumber: number;
  leadNumber: string | null;
  duplicateStatus: string;
  recommendedAction: string;
  needsReview: boolean;
  errors: string[];
  warnings: string[];
  lead: {
    companyName: string | null;
    city: string | null;
    state: string | null;
    email: string | null;
    fullName: string | null;
    comments: string | null;
    notes: string | null;
    contactedCustomer: string | null;
    leadStatus: string | null;
    leadScore: string | null;
    leadType: string | null;
    leadSource: string | null;
    followupDate: string | null;
    productGroup: string | null;
    assigneeManager: string | null;
    assigneeCompany: string | null;
    assigneeName: string | null;
    assigneeRole: string | null;
    assigneeEmail: string | null;
  };
  companyMatch: {
    status: string;
    method: string | null;
    candidates: Array<{
      id: string;
      companyName: string;
      city: string | null;
      state: string | null;
      domain: string | null;
    }>;
  };
  contactMatch: {
    status: string;
    method: string | null;
    candidates: Array<{
      id: string;
      companyId: string;
      fullName: string;
      email: string | null;
    }>;
  };
};

type AnalyzeResponse = {
  summary?: Record<string, number>;
  analysis?: AnalyzeRow[];
  duplicateCheckAvailable?: boolean;
  duplicateCheckMessage?: string;
  error?: string;
};

type ImportResponse = {
  status?: string;
  leadNumber?: string;
  createdCompany?: boolean;
  createdContact?: boolean;
  migrationRequired?: boolean;
  error?: string;
};

function parseCsvPreservingMultiline(text: string, fileName: string): ParsedCsv {
  const cleaned = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    const next = cleaned[i + 1];

    if (char === '"') {
      if (inQuotes) {
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else if (field.length === 0) {
        inQuotes = true;
      } else {
        field += '"';
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      record.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      record.push(field);
      field = "";

      if (record.some((value) => value.trim().length > 0)) {
        records.push(record);
      }
      record = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    if (record.some((value) => value.trim().length > 0)) records.push(record);
  }

  if (inQuotes) {
    throw new Error(
      "The CSV ends inside a quoted field. Re-export the LeadMethod file and try again."
    );
  }

  if (records.length < 2) {
    throw new Error("The CSV does not contain a header row and at least one data row.");
  }

  const headers = records[0].map((value) => value.trim());
  const rows = records.slice(1).map((values) => {
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });

  return { fileName, headers, rows };
}

function badgeClass(status: string) {
  if (status === "matched" || status === "new") return "bg-emerald-100 text-emerald-800";
  if (status === "no_match") return "bg-slate-100 text-slate-700";
  if (
    status === "already_imported" ||
    status === "duplicate_in_upload" ||
    status === "blocked"
  ) {
    return "bg-red-100 text-red-800";
  }
  return "bg-amber-100 text-amber-800";
}

function getRowPlan(row: AnalyzeRow) {
  const companyCandidate =
    row.companyMatch.status === "matched" && row.companyMatch.candidates.length === 1
      ? row.companyMatch.candidates[0]
      : null;

  const contactCandidate =
    row.contactMatch.status === "matched" && row.contactMatch.candidates.length === 1
      ? row.contactMatch.candidates[0]
      : null;

  const companyAmbiguous = row.companyMatch.status === "needs_review";
  const contactAmbiguous = row.contactMatch.status === "needs_review";
  const createCompany = row.companyMatch.status === "no_match";
  const createContact =
    row.contactMatch.status === "no_match" && Boolean(row.lead.fullName || row.lead.email);

  if (
    row.errors.length > 0 ||
    row.duplicateStatus === "already_imported" ||
    row.duplicateStatus === "duplicate_in_upload" ||
    companyAmbiguous ||
    contactAmbiguous ||
    (!companyCandidate && !createCompany)
  ) {
    return { allowed: false, label: "Review Required", companyDecision: null, contactDecision: null };
  }

  const companyDecision = companyCandidate
    ? { action: "reuse" as const, companyId: companyCandidate.id }
    : { action: "create" as const };

  const contactDecision = contactCandidate
    ? { action: "reuse" as const, contactId: contactCandidate.id }
    : createContact
      ? { action: "create" as const }
      : { action: "none" as const };

  let label = "Add LeadMethod History";

  if (createCompany && createContact) {
    label = `Create ${row.lead.companyName || "Company"} + ${row.lead.fullName || row.lead.email || "Contact"} + LeadMethod History`;
  } else if (createCompany) {
    label = `Create ${row.lead.companyName || "Company"} + LeadMethod History`;
  } else if (createContact) {
    label = `Add ${row.lead.fullName || row.lead.email || "Contact"} + LeadMethod History`;
  }

  return { allowed: true, label, companyDecision, contactDecision };
}

export default function LeadMethodImportPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [importingRowNumber, setImportingRowNumber] = useState<number | null>(null);
  const [rowMessages, setRowMessages] = useState<Record<number, string>>({});

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    setAnalysis(null);
    setRowMessages({});
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCsvPreservingMultiline(text, file.name);
      setCsv(parsed);
    } catch (caught) {
      setCsv(null);
      setError(caught instanceof Error ? caught.message : "Failed to parse CSV.");
    }
  }

  async function getAccessToken() {
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error("Sign in to the CRM before working with LeadMethod data.");
    }
    return accessToken;
  }

  async function analyzeFile() {
    if (!csv) return;
    setBusy(true);
    setError("");
    setAnalysis(null);
    setRowMessages({});

    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/leadmethod-import/analyze", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows: csv.rows }),
      });

      const payload = (await response.json()) as AnalyzeResponse;
      if (!response.ok) {
        throw new Error(payload.error || "LeadMethod analysis failed.");
      }
      setAnalysis(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "LeadMethod analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  async function importRow(row: AnalyzeRow) {
    if (!csv) return;

    const plan = getRowPlan(row);
    if (!plan.allowed || !plan.companyDecision || !plan.contactDecision) return;

    const sourceRow = csv.rows[row.rowNumber - 2];
    if (!sourceRow) {
      setRowMessages((current) => ({ ...current, [row.rowNumber]: "Could not locate the original CSV row." }));
      return;
    }

    setImportingRowNumber(row.rowNumber);
    setRowMessages((current) => ({ ...current, [row.rowNumber]: "" }));

    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/leadmethod-import/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          row: sourceRow,
          companyDecision: plan.companyDecision,
          contactDecision: plan.contactDecision,
        }),
      });

      const payload = (await response.json()) as ImportResponse;
      if (!response.ok) {
        throw new Error(payload.error || "LeadMethod import failed.");
      }

      const createdParts = [
        payload.createdCompany ? "company" : null,
        payload.createdContact ? "contact" : null,
        "LeadMethod history",
      ].filter(Boolean);

      setRowMessages((current) => ({
        ...current,
        [row.rowNumber]: `Imported Lead #${payload.leadNumber || row.leadNumber || ""}: ${createdParts.join(", ")}.`,
      }));

      await analyzeFile();
    } catch (caught) {
      setRowMessages((current) => ({
        ...current,
        [row.rowNumber]: caught instanceof Error ? caught.message : "LeadMethod import failed.",
      }));
    } finally {
      setImportingRowNumber(null);
    }
  }

  const rows = analysis?.analysis ?? [];
  const summary = analysis?.summary ?? {};

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">LeadMethod Historical Import</h1>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                Version 3.28A5 — Controlled Import Review
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Upload a LeadMethod CSV, review conservative company/contact matches, and then approve each row individually. Ambiguous matches are blocked rather than guessed.
              </p>
            </div>
            <a
              href="/"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Back to CRM
            </a>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="hidden"
          />

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-blue-700 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Choose LeadMethod CSV
            </button>
            <span className="max-w-xl truncate text-sm text-slate-600">
              {csv?.fileName || "No file selected"}
            </span>
            <button
              type="button"
              onClick={analyzeFile}
              disabled={!csv || busy}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Analyzing…" : "Analyze LeadMethod File"}
            </button>
          </div>

          {csv ? (
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <span className="font-semibold">{csv.fileName}</span> —{" "}
              {csv.rows.length.toLocaleString()} rows, {csv.headers.length} columns. Multiline quoted fields are preserved.
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
              {error}
            </div>
          ) : null}

          {analysis?.duplicateCheckAvailable === false ? (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {analysis.duplicateCheckMessage} Import actions remain disabled until the migration is applied.
            </div>
          ) : null}
        </div>

        {analysis ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {[
                ["Rows", summary.totalRows ?? rows.length],
                ["Ready", summary.ready ?? 0],
                ["Needs Review", summary.needsReview ?? 0],
                ["Blocked", summary.blocked ?? 0],
                ["Duplicates", summary.duplicates ?? 0],
                ["Contact Matches", summary.contactMatches ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="mt-1 text-2xl font-bold">{String(value)}</div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              {rows.map((row) => {
                const plan = getRowPlan(row);
                const importDisabled =
                  !plan.allowed ||
                  analysis.duplicateCheckAvailable === false ||
                  importingRowNumber !== null;

                return (
                  <div
                    key={`${row.rowNumber}-${row.leadNumber ?? "none"}`}
                    className="rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold">
                          Lead #{row.leadNumber || "Missing"} — {row.lead.companyName || "Company missing"}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {row.lead.fullName || "Contact name missing"}
                          {row.lead.email ? ` · ${row.lead.email}` : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className={`rounded-full px-2.5 py-1 ${badgeClass(row.duplicateStatus)}`}>
                          {row.duplicateStatus.replaceAll("_", " ")}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 ${badgeClass(row.recommendedAction)}`}>
                          {row.recommendedAction.replaceAll("_", " ")}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="text-sm font-bold">Company match</div>
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(row.companyMatch.status)}`}>
                            {row.companyMatch.status.replaceAll("_", " ")}
                          </span>
                          <span className="text-slate-500">{row.companyMatch.method || "No match method"}</span>
                        </div>
                        <div className="mt-3 space-y-2 text-sm">
                          {row.companyMatch.candidates.length === 0 ? (
                            <div className="text-slate-500">No existing company candidate. A new company will be created if you approve this row.</div>
                          ) : (
                            row.companyMatch.candidates.map((candidate) => (
                              <div key={candidate.id} className="rounded-lg bg-slate-50 p-2">
                                <div className="font-semibold">{candidate.companyName}</div>
                                <div className="text-slate-500">
                                  {[candidate.city, candidate.state, candidate.domain].filter(Boolean).join(" · ")}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="text-sm font-bold">Contact match</div>
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(row.contactMatch.status)}`}>
                            {row.contactMatch.status.replaceAll("_", " ")}
                          </span>
                          <span className="text-slate-500">{row.contactMatch.method || "No match method"}</span>
                        </div>
                        <div className="mt-3 space-y-2 text-sm">
                          {row.contactMatch.candidates.length === 0 ? (
                            <div className="text-slate-500">
                              {row.lead.fullName || row.lead.email
                                ? "No existing contact candidate. A new CRM contact will be created if you approve this row."
                                : "No usable contact name or email. History can be attached to the company without creating a contact."}
                            </div>
                          ) : (
                            row.contactMatch.candidates.map((candidate) => (
                              <div key={candidate.id} className="rounded-lg bg-slate-50 p-2">
                                <div className="font-semibold">{candidate.fullName}</div>
                                <div className="text-slate-500">{candidate.email || "No email"}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {row.errors.length > 0 || row.warnings.length > 0 ? (
                      <div className="mt-4 space-y-2 text-sm">
                        {row.errors.map((item) => (
                          <div key={item} className="rounded-lg bg-red-50 p-2 font-medium text-red-800">{item}</div>
                        ))}
                        {row.warnings.map((item) => (
                          <div key={item} className="rounded-lg bg-amber-50 p-2 text-amber-900">{item}</div>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <div className="text-sm font-bold text-blue-950">CRM action</div>
                      <div className="mt-1 text-sm text-blue-900">
                        {plan.allowed
                          ? plan.label
                          : "This row requires review before CRM records can be written."}
                      </div>
                      <button
                        type="button"
                        onClick={() => importRow(row)}
                        disabled={importDisabled}
                        className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {importingRowNumber === row.rowNumber ? "Importing…" : plan.label}
                      </button>
                      {analysis.duplicateCheckAvailable === false && plan.allowed ? (
                        <div className="mt-2 text-xs text-amber-900">
                          This button will activate after the 3.28A1 source-identity migration is applied.
                        </div>
                      ) : null}
                      {rowMessages[row.rowNumber] ? (
                        <div className="mt-3 rounded-lg bg-white p-2 text-sm font-medium text-slate-800">
                          {rowMessages[row.rowNumber]}
                        </div>
                      ) : null}
                    </div>

                    <details className="mt-4 rounded-xl border border-slate-200 p-4">
                      <summary className="cursor-pointer text-sm font-bold">LeadMethod history preview</summary>
                      <div className="mt-4 space-y-4 text-sm">
                        <div>
                          <div className="font-semibold">Comments</div>
                          <pre className="mt-1 whitespace-pre-wrap font-sans text-slate-700">{row.lead.comments || "—"}</pre>
                        </div>
                        <div>
                          <div className="font-semibold">Notes</div>
                          <pre className="mt-1 whitespace-pre-wrap font-sans text-slate-700">{row.lead.notes || "—"}</pre>
                        </div>
                        <div>
                          <span className="font-semibold">Contacted Customer:</span> {row.lead.contactedCustomer || "—"}
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
