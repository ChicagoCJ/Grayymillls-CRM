"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type TabKey = "dashboard" | "companies" | "contacts" | "import";

type ParsedCsv = {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  rawRowCount: number;
};

type MappingSuggestion = {
  crmField: string;
  suggestedColumn: string;
  confidence: "High" | "Medium" | "Low" | "Not found";
};

type ImportResult = {
  importId: string;
  processedCount: number;
  duplicateCount: number;
  errorCount: number;
  status: string;
};

type CompanySummary = {
  id: string;
  company_name: string;
  website: string | null;
  domain: string | null;
  industry: string | null;
  employee_count: number | null;
  company_phone: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
  created_at: string;
  prospects?: {
    id: string;
    priority_score: number;
    priority_tier: string | null;
    fit_rating: string | null;
    confidence: string | null;
    likely_product_path: string | null;
    next_best_action: string | null;
    stage: string | null;
    status: string | null;
  }[];
};

type ContactSummary = {
  id: string;
  company_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  title: string | null;
  management_level: string | null;
  department: string | null;
  function_area: string | null;
  email: string | null;
  direct_phone: string | null;
  mobile_phone: string | null;
  created_at: string;
  companies?: {
    company_name: string;
  } | null;
};

type ImportSummary = {
  id: string;
  file_name: string;
  source: string;
  row_count: number;
  processed_count: number;
  duplicate_count: number;
  error_count: number;
  status: string;
  created_at: string;
};

type CrmSummary = {
  companies: CompanySummary[];
  contacts: ContactSummary[];
  imports: ImportSummary[];
};

const APP_VERSION = "Rev 1.04 — Manual Column Mapping + Import Review";
const REVISION_NOTE =
  "Manual mapping added before import; required-field validation and import review added.";

const REQUIRED_FIELDS = ["Company Name"];

const CRM_FIELDS = [
  {
    field: "Company Name",
    required: true,
    aliases: ["company name", "company", "account name", "account"],
  },
  {
    field: "Website",
    required: false,
    aliases: ["website", "web site", "company website", "url", "domain"],
  },
  {
    field: "Industry",
    required: false,
    aliases: ["industry", "industries", "primary industry"],
  },
  {
    field: "NAICS",
    required: false,
    aliases: ["naics", "naics code", "primary naics"],
  },
  {
    field: "SIC",
    required: false,
    aliases: ["sic", "sic code", "primary sic"],
  },
  {
    field: "Employee Count",
    required: false,
    aliases: ["employees", "employee count", "company employees", "number of employees"],
  },
  {
    field: "Revenue",
    required: false,
    aliases: ["revenue", "annual revenue", "company revenue"],
  },
  {
    field: "Company Phone",
    required: false,
    aliases: ["company phone", "main phone", "phone", "hq phone"],
  },
  {
    field: "Company Fax",
    required: false,
    aliases: ["fax", "company fax"],
  },
  {
    field: "Company Address",
    required: false,
    aliases: ["company address", "street address", "address", "hq address"],
  },
  {
    field: "Company City",
    required: false,
    aliases: ["company city", "city", "hq city"],
  },
  {
    field: "Company State",
    required: false,
    aliases: ["company state", "state", "hq state"],
  },
  {
    field: "Company Postal Code",
    required: false,
    aliases: ["postal code", "zip", "zip code", "company zip"],
  },
  {
    field: "Company Country",
    required: false,
    aliases: ["country", "company country", "hq country"],
  },
  {
    field: "First Name",
    required: false,
    aliases: ["first name", "contact first name", "person first name"],
  },
  {
    field: "Last Name",
    required: false,
    aliases: ["last name", "contact last name", "person last name"],
  },
  {
    field: "Full Name",
    required: false,
    aliases: ["full name", "contact name", "person name", "name"],
  },
  {
    field: "Job Title",
    required: false,
    aliases: ["title", "job title", "contact title", "person title"],
  },
  {
    field: "Management Level",
    required: false,
    aliases: ["management level", "seniority", "level"],
  },
  {
    field: "Department",
    required: false,
    aliases: ["department", "contact department"],
  },
  {
    field: "Function",
    required: false,
    aliases: ["function", "job function", "contact function"],
  },
  {
    field: "Email",
    required: false,
    aliases: ["email", "email address", "business email", "contact email"],
  },
  {
    field: "Direct Phone",
    required: false,
    aliases: ["direct phone", "direct dial", "contact phone"],
  },
  {
    field: "Mobile Phone",
    required: false,
    aliases: ["mobile", "mobile phone", "cell", "cell phone"],
  },
  {
    field: "Person City",
    required: false,
    aliases: ["person city", "contact city"],
  },
  {
    field: "Person State",
    required: false,
    aliases: ["person state", "contact state"],
  },
  {
    field: "Person Country",
    required: false,
    aliases: ["person country", "contact country"],
  },
  {
    field: "LinkedIn URL",
    required: false,
    aliases: ["linkedin", "linkedin url", "person linkedin url", "contact linkedin"],
  },
];

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s_\-./]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === `"` && insideQuotes && nextChar === `"`) {
      current += `"`;
      i += 1;
    } else if (char === `"`) {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCsv(text: string, fileName: string): ParsedCsv {
  const cleanedText = text.replace(/^\uFEFF/, "");
  const lines = cleanedText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return {
      fileName,
      headers: [],
      rows: [],
      rawRowCount: 0,
    };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });

  return {
    fileName,
    headers,
    rows,
    rawRowCount: rows.length,
  };
}

function suggestMappings(headers: string[]): MappingSuggestion[] {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));

  return CRM_FIELDS.map((crmField) => {
    const exactMatch = normalizedHeaders.find((header) =>
      crmField.aliases.some((alias) => normalizeHeader(alias) === header.normalized)
    );

    if (exactMatch) {
      return {
        crmField: crmField.field,
        suggestedColumn: exactMatch.original,
        confidence: "High",
      };
    }

    const containsMatch = normalizedHeaders.find((header) =>
      crmField.aliases.some((alias) => {
        const normalizedAlias = normalizeHeader(alias);
        return (
          header.normalized.includes(normalizedAlias) ||
          normalizedAlias.includes(header.normalized)
        );
      })
    );

    if (containsMatch) {
      return {
        crmField: crmField.field,
        suggestedColumn: containsMatch.original,
        confidence: "Medium",
      };
    }

    return {
      crmField: crmField.field,
      suggestedColumn: "Not detected",
      confidence: "Not found",
    };
  });
}

function getConfidenceClass(confidence: MappingSuggestion["confidence"]) {
  if (confidence === "High") return "bg-green-100 text-green-800";
  if (confidence === "Medium") return "bg-yellow-100 text-yellow-800";
  if (confidence === "Low") return "bg-orange-100 text-orange-800";
  return "bg-gray-100 text-gray-600";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function getLatestProspect(company: CompanySummary) {
  if (!company.prospects || company.prospects.length === 0) return null;

  return [...company.prospects].sort(
    (a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0)
  )[0];
}

function buildMappingObject(mappingSuggestions: MappingSuggestion[]) {
  return mappingSuggestions.reduce<Record<string, string>>((accumulator, mapping) => {
    accumulator[mapping.crmField] = mapping.suggestedColumn;
    return accumulator;
  }, {});
}

function isMapped(value: string | undefined) {
  return Boolean(value && value !== "Not detected" && value !== "__skip__");
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [csvData, setCsvData] = useState<ParsedCsv | null>(null);
  const [manualMapping, setManualMapping] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [crmSummary, setCrmSummary] = useState<CrmSummary>({
    companies: [],
    contacts: [],
    imports: [],
  });

  const mappingSuggestions = useMemo(() => {
    if (!csvData) return [];
    return suggestMappings(csvData.headers);
  }, [csvData]);

  const suggestedMappingObject = useMemo(() => {
    return buildMappingObject(mappingSuggestions);
  }, [mappingSuggestions]);

  const activeMapping = useMemo(() => {
    const mapping: Record<string, string> = {};

    CRM_FIELDS.forEach((field) => {
      mapping[field.field] =
        manualMapping[field.field] ??
        suggestedMappingObject[field.field] ??
        "Not detected";
    });

    return mapping;
  }, [manualMapping, suggestedMappingObject]);

  const highConfidenceMappings = mappingSuggestions.filter(
    (mapping) => mapping.confidence === "High"
  ).length;

  const missingMappings = CRM_FIELDS.filter(
    (field) => !isMapped(activeMapping[field.field])
  ).length;

  const requiredMissingFields = REQUIRED_FIELDS.filter(
    (field) => !isMapped(activeMapping[field])
  );

  const mappedOptionalFields = CRM_FIELDS.filter(
    (field) => !field.required && isMapped(activeMapping[field.field])
  ).length;

  const isReadyToImport = Boolean(csvData) && requiredMissingFields.length === 0;

  const aTierCompanies = crmSummary.companies.filter((company) => {
    const prospect = getLatestProspect(company);
    return prospect?.priority_tier === "A+" || prospect?.priority_tier === "A";
  }).length;

  async function loadCrmSummary() {
    setIsLoadingSummary(true);

    try {
      const response = await fetch("/api/crm-summary");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load CRM summary.");
      }

      setCrmSummary(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load CRM summary.");
    } finally {
      setIsLoadingSummary(false);
    }
  }

  useEffect(() => {
    loadCrmSummary();
  }, []);

  useEffect(() => {
    if (!csvData) {
      setManualMapping({});
      return;
    }

    const initialMapping = buildMappingObject(suggestMappings(csvData.headers));
    setManualMapping(initialMapping);
  }, [csvData]);

  async function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    setErrorMessage("");
    setImportMessage("");

    const file = event.target.files?.[0];

    if (!file) return;

    const isCsv =
      file.name.toLowerCase().endsWith(".csv") ||
      file.type === "text/csv" ||
      file.type === "application/vnd.ms-excel";

    if (!isCsv) {
      setCsvData(null);
      setErrorMessage("Please upload a CSV file. XLSX support will come in a later revision.");
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCsv(text, file.name);

      if (parsed.headers.length === 0) {
        setCsvData(null);
        setErrorMessage("No headers were found in this CSV.");
        return;
      }

      setCsvData(parsed);
      setActiveTab("import");
    } catch {
      setCsvData(null);
      setErrorMessage("The CSV could not be read. Please check the file and try again.");
    }
  }

  function updateManualMapping(crmField: string, selectedColumn: string) {
    setManualMapping((current) => ({
      ...current,
      [crmField]: selectedColumn,
    }));
  }

  function resetMappingToSuggestions() {
    if (!csvData) return;
    setManualMapping(buildMappingObject(suggestMappings(csvData.headers)));
  }

  async function handleImportToCrm() {
    if (!csvData) return;

    setIsImporting(true);
    setErrorMessage("");
    setImportMessage("");

    if (requiredMissingFields.length > 0) {
      setIsImporting(false);
      setErrorMessage(
        `Required mapping missing: ${requiredMissingFields.join(
          ", "
        )}. Please map required fields before importing.`
      );
      return;
    }

    try {
      const response = await fetch("/api/import-zoominfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: csvData.fileName,
          headers: csvData.headers,
          rows: csvData.rows,
          mapping: activeMapping,
        }),
      });

      const data = (await response.json()) as ImportResult & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Import failed.");
      }

      setImportMessage(
        `Import ${data.status}: ${data.processedCount} processed, ${data.duplicateCount} possible duplicates/reused companies, ${data.errorCount} row errors.`
      );

      await loadCrmSummary();
      setActiveTab("companies");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "companies", label: "Companies" },
    { key: "contacts", label: "Contacts" },
    { key: "import", label: "Import ZoomInfo" },
  ];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                Graymills Prospecting Tool
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                CRM for Application-Driven Sales Prospecting
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Import ZoomInfo prospect data, map it into structured CRM records, and
                prepare Graymills-specific sales intelligence for each company and contact.
              </p>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm">
              <p className="font-semibold text-blue-900">{APP_VERSION}</p>
              <p className="mt-1 text-blue-700">{REVISION_NOTE}</p>
            </div>
          </div>
        </header>

        {(errorMessage || importMessage) && (
          <div className="grid gap-3">
            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {errorMessage}
              </div>
            )}
            {importMessage && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                {importMessage}
              </div>
            )}
          </div>
        )}

        <nav className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "bg-blue-700 text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}

          <button
            onClick={loadCrmSummary}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {isLoadingSummary ? "Refreshing..." : "Refresh CRM"}
          </button>
        </nav>

        {activeTab === "dashboard" && (
          <section className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard
                label="Companies in CRM"
                value={crmSummary.companies.length.toString()}
                note="Loaded from Supabase"
              />
              <MetricCard
                label="Contacts in CRM"
                value={crmSummary.contacts.length.toString()}
                note="Loaded from Supabase"
              />
              <MetricCard
                label="A / A+ prospects"
                value={aTierCompanies.toString()}
                note="Based on current score"
              />
              <MetricCard
                label="Recent imports"
                value={crmSummary.imports.length.toString()}
                note="Last 20 import records"
              />
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Rev 1.04 Objective</h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                This revision adds manual column mapping and an import readiness review before
                records are saved to Supabase. The goal is cleaner ZoomInfo imports and fewer
                bad CRM records.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <InfoPanel
                  title="What works now"
                  items={[
                    "CSV upload and preview",
                    "Manual mapping dropdowns",
                    "Required-field validation",
                    "Import readiness review",
                    "Import to Supabase",
                  ]}
                />
                <InfoPanel
                  title="What comes next"
                  items={[
                    "Company detail pages",
                    "Prospecting package view",
                    "Editable sales notes and follow-ups",
                    "Copyable sales block on company record",
                  ]}
                />
                <InfoPanel
                  title="Future control note"
                  items={[
                    "Add prospect selection radio boxes or checkboxes",
                    "Add modify tools for selected prospects",
                    "Add safe delete/archive controls",
                    "Add bulk actions with confirmation",
                  ]}
                />
              </div>
            </div>

            <RecentImports imports={crmSummary.imports} />
          </section>
        )}

        {activeTab === "companies" && <CompaniesSection companies={crmSummary.companies} />}

        {activeTab === "contacts" && <ContactsSection contacts={crmSummary.contacts} />}

        {activeTab === "import" && (
          <section className="grid gap-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-xl font-bold">Import ZoomInfo CSV</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Upload a ZoomInfo CSV, review and adjust field mapping, then save the
                    data into the Graymills CRM.
                  </p>
                </div>

                <div className="flex flex-wrap justify-start gap-3">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">
                    Choose CSV File
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCsvUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={resetMappingToSuggestions}
                    disabled={!csvData}
                    className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    Reset Mapping
                  </button>

                  <button
                    onClick={handleImportToCrm}
                    disabled={!csvData || isImporting || !isReadyToImport}
                    className="inline-flex items-center justify-center rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isImporting ? "Importing..." : "Import to CRM"}
                  </button>
                </div>

                <p className="text-xs text-slate-500">
                  Future revision note: add prospect selection controls, edit/modify actions,
                  archive/delete safeguards, and bulk prospect management.
                </p>
              </div>
            </div>

            {!csvData && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-lg font-semibold">No CSV uploaded yet</p>
                <p className="mt-2 text-sm text-slate-600">
                  Upload the Aviation MRO ZoomInfo CSV or another prospecting export to preview it.
                </p>
              </div>
            )}

            {csvData && (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <MetricCard label="File" value={csvData.fileName} note="Current preview file" />
                  <MetricCard
                    label="Rows"
                    value={csvData.rawRowCount.toString()}
                    note="Data rows excluding header"
                  />
                  <MetricCard
                    label="Mapped optional fields"
                    value={mappedOptionalFields.toString()}
                    note="Optional CRM fields currently mapped"
                  />
                  <MetricCard
                    label="Import readiness"
                    value={isReadyToImport ? "Ready" : "Blocked"}
                    note={
                      isReadyToImport
                        ? "Required fields are mapped"
                        : `${requiredMissingFields.length} required field missing`
                    }
                  />
                </div>

                <div className="rounded-2xl bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold">Import Review</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <ReviewCard
                      label="Required Mapping"
                      value={isReadyToImport ? "Pass" : "Needs attention"}
                      status={isReadyToImport ? "good" : "bad"}
                      note={
                        isReadyToImport
                          ? "Company Name is mapped."
                          : `Missing: ${requiredMissingFields.join(", ")}`
                      }
                    />
                    <ReviewCard
                      label="Records to Import"
                      value={csvData.rawRowCount.toString()}
                      status="neutral"
                      note="Each row will create or reuse a company and contact."
                    />
                    <ReviewCard
                      label="Mapping Method"
                      value="Manual Review"
                      status="neutral"
                      note="Dropdown selections below will be used for import."
                    />
                  </div>

                  {!isReadyToImport && (
                    <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                      Company Name is required because it anchors the company, contact,
                      prospect, and prospect intelligence records. Map it before importing.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold">Manual CRM Field Mapping</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Review each CRM field and choose the correct ZoomInfo CSV column. Use
                    “Skip / Not mapped” for optional fields you do not want to import.
                  </p>

                  <div className="mt-4 max-w-4xl overflow-x-auto">
                    <table className="w-full table-fixed border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="w-[30%] py-3 pr-3 font-semibold">CRM Field</th>
                          <th className="w-[44%] py-3 pr-3 font-semibold">CSV Column to Use</th>
                          <th className="w-[14%] py-3 pr-3 font-semibold">Required</th>
                          <th className="w-[12%] py-3 pr-3 font-semibold">Auto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {CRM_FIELDS.map((field) => {
                          const suggestion = mappingSuggestions.find(
                            (mapping) => mapping.crmField === field.field
                          );

                          return (
                            <tr key={field.field} className="border-b border-slate-100 align-middle">
                              <td className="py-3 pr-3 font-medium">{field.field}</td>
                              <td className="py-3 pr-3">
                                <select
                                  value={activeMapping[field.field] ?? "Not detected"}
                                  onChange={(event) =>
                                    updateManualMapping(field.field, event.target.value)
                                  }
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                >
                                  <option value="Not detected">Skip / Not mapped</option>
                                  {csvData.headers.map((header) => (
                                    <option key={`${field.field}-${header}`} value={header}>
                                      {header}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-3 pr-3">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    field.required
                                      ? "bg-red-100 text-red-800"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {field.required ? "Required" : "Optional"}
                                </span>
                              </td>
                              <td className="py-3 pr-3">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getConfidenceClass(
                                    suggestion?.confidence ?? "Not found"
                                  )}`}
                                >
                                  {suggestion?.confidence ?? "Not found"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold">First 10 Rows Preview</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Confirm the CSV is being read correctly before saving records into Supabase.
                  </p>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200">
                          {csvData.headers.map((header) => (
                            <th key={header} className="max-w-[220px] px-3 py-3 font-semibold">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.rows.slice(0, 10).map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b border-slate-100">
                            {csvData.headers.map((header) => (
                              <td
                                key={`${rowIndex}-${header}`}
                                className="max-w-[220px] truncate px-3 py-3 text-slate-700"
                                title={row[header]}
                              >
                                {row[header] || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function ReviewCard({
  label,
  value,
  note,
  status,
}: {
  label: string;
  value: string;
  note: string;
  status: "good" | "bad" | "neutral";
}) {
  const statusClass =
    status === "good"
      ? "border-green-200 bg-green-50 text-green-900"
      : status === "bad"
        ? "border-red-200 bg-red-50 text-red-900"
        : "border-slate-200 bg-slate-50 text-slate-900";

  return (
    <div className={`rounded-xl border p-4 ${statusClass}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
      <p className="mt-2 text-xs opacity-80">{note}</p>
    </div>
  );
}

function InfoPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecentImports({ imports }: { imports: ImportSummary[] }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Recent Imports</h2>

      {imports.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No imports saved yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 pr-4 font-semibold">File</th>
                <th className="py-3 pr-4 font-semibold">Rows</th>
                <th className="py-3 pr-4 font-semibold">Processed</th>
                <th className="py-3 pr-4 font-semibold">Duplicates</th>
                <th className="py-3 pr-4 font-semibold">Errors</th>
                <th className="py-3 pr-4 font-semibold">Status</th>
                <th className="py-3 pr-4 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-medium">{item.file_name}</td>
                  <td className="py-3 pr-4">{item.row_count}</td>
                  <td className="py-3 pr-4">{item.processed_count}</td>
                  <td className="py-3 pr-4">{item.duplicate_count}</td>
                  <td className="py-3 pr-4">{item.error_count}</td>
                  <td className="py-3 pr-4">{item.status}</td>
                  <td className="py-3 pr-4">{formatDate(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CompaniesSection({ companies }: { companies: CompanySummary[] }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Companies</h2>
      <p className="mt-2 text-sm text-slate-600">
        Company records created from ZoomInfo imports. Rev 1.05 should add click-through detail pages.
      </p>

      {companies.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          No companies imported yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 pr-4 font-semibold">Company</th>
                <th className="py-3 pr-4 font-semibold">Industry</th>
                <th className="py-3 pr-4 font-semibold">Location</th>
                <th className="py-3 pr-4 font-semibold">Employees</th>
                <th className="py-3 pr-4 font-semibold">Score</th>
                <th className="py-3 pr-4 font-semibold">Tier</th>
                <th className="py-3 pr-4 font-semibold">Product Path</th>
                <th className="py-3 pr-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const prospect = getLatestProspect(company);

                return (
                  <tr key={company.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-4">
                      <p className="font-semibold">{company.company_name}</p>
                      <p className="text-xs text-slate-500">
                        {company.domain || company.website || "No website"}
                      </p>
                    </td>
                    <td className="max-w-[260px] py-3 pr-4 text-slate-700">
                      {company.industry || "Not provided"}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      {[company.city, company.state].filter(Boolean).join(", ") || "Not provided"}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      {company.employee_count ?? "—"}
                    </td>
                    <td className="py-3 pr-4 font-semibold">
                      {prospect?.priority_score ?? "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                        {prospect?.priority_tier ?? "—"}
                      </span>
                    </td>
                    <td className="max-w-[320px] py-3 pr-4 text-slate-700">
                      {prospect?.likely_product_path ?? "Not generated"}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{company.status || "new"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ContactsSection({ contacts }: { contacts: ContactSummary[] }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Contacts</h2>
      <p className="mt-2 text-sm text-slate-600">
        Contacts attached to imported company records.
      </p>

      {contacts.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          No contacts imported yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 pr-4 font-semibold">Contact</th>
                <th className="py-3 pr-4 font-semibold">Company</th>
                <th className="py-3 pr-4 font-semibold">Title</th>
                <th className="py-3 pr-4 font-semibold">Function</th>
                <th className="py-3 pr-4 font-semibold">Email</th>
                <th className="py-3 pr-4 font-semibold">Direct</th>
                <th className="py-3 pr-4 font-semibold">Mobile</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className="border-b border-slate-100 align-top">
                  <td className="py-3 pr-4 font-semibold">
                    {contact.full_name ||
                      [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
                      "Not provided"}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">
                    {contact.companies?.company_name || "Not attached"}
                  </td>
                  <td className="max-w-[260px] py-3 pr-4 text-slate-700">
                    {contact.title || "Not provided"}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">
                    {contact.function_area || contact.department || "Not provided"}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">{contact.email || "—"}</td>
                  <td className="py-3 pr-4 text-slate-700">{contact.direct_phone || "—"}</td>
                  <td className="py-3 pr-4 text-slate-700">{contact.mobile_phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}