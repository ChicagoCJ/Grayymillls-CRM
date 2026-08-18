"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getBrowserSupabaseClient,
  hasBrowserSupabaseConfig,
} from "../../lib/supabase-browser";

type ErpRun = {
  id: string;
  file_name: string;
  source: string | null;
  status: string;
  sheet_name: string | null;
  report_title: string | null;
  header_row: number | null;

  source_row_count: number;
  customer_count: number;

  confident_match_count: number;
  likely_match_count: number;
  ambiguous_match_count: number;
  conflict_count: number;
  unmatched_count: number;

  summary?: Record<string, any> | null;

  created_by_name: string | null;
  created_at: string;
  completed_at: string | null;

  signed_url?: string | null;
};

type ErpCandidate = {
  company_id: string;
  company_name: string;

  graymills_customer_number:
    | string
    | null;

  account_type:
    | string
    | null;

  city:
    | string
    | null;

  state:
    | string
    | null;

  postal_code:
    | string
    | null;

  assigned_salesperson_id:
    | string
    | null;

  assigned_sales_manager_id:
    | string
    | null;

  score: number;
  reasons: string[];

  last_crm_activity_at:
    | string
    | null;

  open_activity_count: number;
  open_opportunity_count: number;
};

type ErpCustomer = {
  id: string;
  run_id: string;

  erp_customer_number: string;
  company_name: string;

  address_line_1:
    | string
    | null;

  city:
    | string
    | null;

  state:
    | string
    | null;

  postal_code:
    | string
    | null;

  phone:
    | string
    | null;

  email:
    | string
    | null;

  latest_order_date:
    | string
    | null;

  order_count: number;
  line_count: number;

  order_line_value:
    | number
    | string;

  product_lines:
    string[];

  erp_salespeople:
    string[];

  territories:
    string[];

  order_statuses:
    string[];

  matched_company_id:
    | string
    | null;

  match_status:
    | "confident"
    | "likely"
    | "ambiguous"
    | "conflict"
    | "unmatched";

  match_method:
    | string
    | null;

  match_score:
    | number
    | null;

  match_reasons:
    string[];

  candidate_matches:
    ErpCandidate[];

  review_status:
    | "unreviewed"
    | "needs_review"
    | "confirmed"
    | "rejected";

  reviewed_by_name:
    | string
    | null;

  reviewed_at:
    | string
    | null;

  review_note:
    | string
    | null;
};

type ApiResponse = {
  error?: string;

  status?: string;
  message?: string;

  runs?: ErpRun[];

  selectedRun?:
    | ErpRun
    | null;

  run?:
    | ErpRun
    | null;

  customers?: ErpCustomer[];
};

function cleanText(
  value: unknown
) {
  return String(value ?? "")
    .trim();
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return "None";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString();
}

function formatDateTime(
  value: string | null | undefined
) {
  if (!value) {
    return "None";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

function formatCurrency(
  value: unknown
) {
  const number =
    typeof value === "number"
      ? value
      : Number.parseFloat(
          String(value || "0")
        );

  const safe =
    Number.isFinite(number)
      ? number
      : 0;

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    }
  ).format(safe);
}

function matchBadgeClasses(
  status: ErpCustomer["match_status"]
) {
  switch (status) {
    case "confident":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";

    case "likely":
      return "border-blue-200 bg-blue-50 text-blue-800";

    case "ambiguous":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "conflict":
      return "border-red-200 bg-red-50 text-red-800";

    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function matchCardClasses(
  status: ErpCustomer["match_status"]
) {
  switch (status) {
    case "confident":
      return "border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-100";

    case "likely":
      return "border-blue-300 bg-blue-50/50 ring-1 ring-blue-100";

    case "ambiguous":
      return "border-amber-300 bg-amber-50/50 ring-1 ring-amber-100";

    case "conflict":
      return "border-red-300 bg-red-50/50 ring-1 ring-red-100";

    default:
      return "border-slate-200 bg-white";
  }
}
function reviewBadgeClasses(
  status: ErpCustomer["review_status"]
) {
  switch (status) {
    case "confirmed":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";

    case "rejected":
      return "border-red-200 bg-red-50 text-red-800";

    case "needs_review":
      return "border-amber-200 bg-amber-50 text-amber-800";

    default:
      return "border-slate-200 bg-white text-slate-600";
  }
}

function friendlyMatchMethod(
  value: string | null
) {
  switch (value) {
    case "graymills_customer_number":
      return "Graymills customer number";

    case "exact_name_location":
      return "Company name + location";

    case "exact_name":
      return "Exact company name";

    case "domain":
      return "Domain";

    case "contact_email":
      return "Contact email";

    case "phone":
      return "Phone";

    case "duplicate_customer_number":
      return "Duplicate CRM customer number";

    case "fuzzy_company_name":
      return "Company-name similarity";

    default:
      return value || "No proposed method";
  }
}

function candidateForCustomer(
  customer: ErpCustomer,
  selectedCompanyId: string
) {
  if (selectedCompanyId) {
    const selected =
      customer.candidate_matches.find(
        (candidate) =>
          candidate.company_id ===
          selectedCompanyId
      );

    if (selected) {
      return selected;
    }
  }

  if (customer.matched_company_id) {
    const proposed =
      customer.candidate_matches.find(
        (candidate) =>
          candidate.company_id ===
          customer.matched_company_id
      );

    if (proposed) {
      return proposed;
    }
  }

  return (
    customer.candidate_matches[0] ??
    null
  );
}

async function bearerHeaders() {
  if (
    !hasBrowserSupabaseConfig()
  ) {
    throw new Error(
      "Browser Supabase configuration is not available."
    );
  }

  const supabase =
    getBrowserSupabaseClient();

  const {
    data,
    error,
  } =
    await supabase.auth.getSession();

  if (error) {
    throw new Error(
      error.message ||
        "Could not read the signed-in session."
    );
  }

  const accessToken =
    data.session?.access_token;

  if (!accessToken) {
    throw new Error(
      "A signed-in Admin or Sales Manager session is required for ERP reconciliation."
    );
  }

  return {
    Authorization:
      `Bearer ${accessToken}`,
  };
}

export default function ErpReconciliationSection({
  canAccess,
  onOpenCompany,
}: {
  canAccess: boolean;
  onOpenCompany: (companyId: string) => void;
}) {
  const [
    runs,
    setRuns,
  ] =
    useState<ErpRun[]>([]);

  const [
    selectedRun,
    setSelectedRun,
  ] =
    useState<ErpRun | null>(
      null
    );

  const [
    customers,
    setCustomers,
  ] =
    useState<ErpCustomer[]>([]);

  const [
    selectedFile,
    setSelectedFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    uploadInputKey,
    setUploadInputKey,
  ] =
    useState(0);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(false);

  const [
    isUploading,
    setIsUploading,
  ] =
    useState(false);

  const [
    savingReviewIds,
    setSavingReviewIds,
  ] =
    useState<string[]>([]);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  const [
    matchFilter,
    setMatchFilter,
  ] =
    useState("all");

  const [
    reviewFilter,
    setReviewFilter,
  ] =
    useState("all");

  const [
    candidateSelections,
    setCandidateSelections,
  ] =
    useState<
      Record<string, string>
    >({});

  const [
    reviewNotes,
    setReviewNotes,
  ] =
    useState<
      Record<string, string>
    >({});

  const [
    reviewActionMessages,
    setReviewActionMessages,
  ] =
    useState<
      Record<string, string>
    >({});

  const filteredCustomers =
    useMemo(
      () => {
        const matchPriority:
          Record<
            ErpCustomer["match_status"],
            number
          > = {
            confident: 0,
            likely: 1,
            ambiguous: 2,
            conflict: 3,
            unmatched: 4,
          };

        return customers
          .filter(
            (customer) => {
              const matchesStatus =
                matchFilter === "all" ||
                customer.match_status ===
                  matchFilter;

              const matchesReview =
                reviewFilter === "all" ||
                customer.review_status ===
                  reviewFilter;

              return (
                matchesStatus &&
                matchesReview
              );
            }
          )
          .sort(
            (left, right) => {
              const statusDifference =
                matchPriority[
                  left.match_status
                ] -
                matchPriority[
                  right.match_status
                ];

              if (
                statusDifference !== 0
              ) {
                return statusDifference;
              }

              const leftScore =
                left.match_score ?? -1;

              const rightScore =
                right.match_score ?? -1;

              if (
                leftScore !== rightScore
              ) {
                return (
                  rightScore -
                  leftScore
                );
              }

              return left.company_name.localeCompare(
                right.company_name
              );
            }
          );
      },
      [
        customers,
        matchFilter,
        reviewFilter,
      ]
    );
  const visibleValue =
    useMemo(
      () =>
        filteredCustomers.reduce(
          (
            total,
            customer
          ) => {
            const parsed =
              Number.parseFloat(
                String(
                  customer.order_line_value ||
                    0
                )
              );

            return (
              total +
              (
                Number.isFinite(parsed)
                  ? parsed
                  : 0
              )
            );
          },
          0
        ),
      [filteredCustomers]
    );

  async function loadReconciliation(
    runId?: string
  ) {
    if (!canAccess) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const headers =
        await bearerHeaders();

      const query =
        runId
          ? `?runId=${encodeURIComponent(
              runId
            )}`
          : "";

      const response =
        await fetch(
          `/api/erp-reconciliation${query}`,
          {
            headers,
          }
        );

      const data =
        (await response.json()) as
          ApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not load ERP reconciliation data."
        );
      }

      setRuns(
        Array.isArray(data.runs)
          ? data.runs
          : []
      );

      setSelectedRun(
        data.selectedRun ?? null
      );

      const nextCustomers =
        Array.isArray(
          data.customers
        )
          ? data.customers
          : [];

      setCustomers(
        nextCustomers
      );

      const selections:
        Record<string, string> =
          {};

      const notes:
        Record<string, string> =
          {};

      for (
        const customer of
        nextCustomers
      ) {
        selections[
          customer.id
        ] =
          cleanText(
            customer.matched_company_id
          ) ||
          cleanText(
            customer
              .candidate_matches?.[0]
              ?.company_id
          );

        notes[
          customer.id
        ] =
          cleanText(
            customer.review_note
          );
      }

      setCandidateSelections(
        selections
      );

      setReviewNotes(notes);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load ERP reconciliation data."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (canAccess) {
      void loadReconciliation();
    }
  }, [canAccess]);

  async function uploadWorkbook() {
    if (!selectedFile) {
      setErrorMessage(
        "Choose an ERP .xlsx workbook first."
      );
      return;
    }

    if (
      !selectedFile.name
        .toLowerCase()
        .endsWith(".xlsx")
    ) {
      setErrorMessage(
        "Version 3.26 accepts .xlsx ERP workbooks."
      );
      return;
    }

    setIsUploading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const headers =
        await bearerHeaders();

      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile
      );

      const response =
        await fetch(
          "/api/erp-reconciliation",
          {
            method: "POST",
            headers,
            body: formData,
          }
        );

      const data =
        (await response.json()) as
          ApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "ERP reconciliation failed."
        );
      }

      const createdRun =
        data.run ?? null;

      setSuccessMessage(
        data.message ||
          "ERP workbook processed for review. No CRM records were changed."
      );

      setSelectedFile(null);
      setUploadInputKey(
        (current) =>
          current + 1
      );

      await loadReconciliation(
        createdRun?.id
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "ERP reconciliation failed."
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function reviewCustomer(
    customer: ErpCustomer,
    action:
      | "link"
      | "reject"
  ) {
    const selectedCompanyId =
      candidateSelections[
        customer.id
      ] || "";

    if (
      action === "link" &&
      !selectedCompanyId
    ) {
      setErrorMessage(
        "Select a CRM company candidate before linking the account."
      );
      return;
    }

    if (action === "link") {
      const selectedCandidate =
        candidateForCustomer(
          customer,
          selectedCompanyId
        );

      const crmCompanyName =
        selectedCandidate
          ?.company_name ||
        "the selected CRM company";

      const erpCustomerNumber =
        cleanText(
          customer.erp_customer_number
        );

      const approved =
        window.confirm(
          [
            `Link ERP account "${customer.company_name}" to CRM company "${crmCompanyName}"?`,
            "",
            `ERP customer number: ${erpCustomerNumber || "Not recorded"}`,
            "",
            "This will write that ERP customer number to the CRM company's Graymills customer number.",
            "",
            "No ownership, category, classification, address, contact, activity, opportunity, or tag fields will be changed.",
          ].join("\n")
        );

      if (!approved) {
        return;
      }
    }

    setSavingReviewIds(
      (current) =>
        Array.from(
          new Set([
            ...current,
            customer.id,
          ])
        )
    );

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const headers =
        await bearerHeaders();

      const response =
        await fetch(
          "/api/erp-reconciliation",
          {
            method: "PATCH",

            headers: {
              ...headers,
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                reconciliationCustomerId:
                  customer.id,

                action,

                companyId:
                  action ===
                  "link"
                    ? selectedCompanyId
                    : null,

                reviewNote:
                  reviewNotes[
                    customer.id
                  ] || null,
              }),
          }
        );

      const data =
        (await response.json()) as
          ApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            (
              action === "link"
                ? "Could not link the ERP account to the CRM company."
                : "Could not reject the proposed reconciliation match."
            )
        );
      }

      const resultMessage =
        data.message ||
          (
            action === "link"
              ? "ERP account linked to the CRM company."
              : "Proposed match rejected."
          );

      setSuccessMessage(
        resultMessage
      );

      setReviewActionMessages(
        (current) => ({
          ...current,
          [customer.id]:
            resultMessage,
        })
      );

      await loadReconciliation(
        selectedRun?.id
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : (
              action === "link"
                ? "Could not link the ERP account to the CRM company."
                : "Could not reject the proposed reconciliation match."
            )
      );
    } finally {
      setSavingReviewIds(
        (current) =>
          current.filter(
            (id) =>
              id !== customer.id
          )
      );
    }
  }
  if (!canAccess) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
        <h2 className="text-xl font-bold">
          ERP Reconciliation
        </h2>

        <p className="mt-2 text-sm leading-6">
          ERP reconciliation is restricted to CRM Admin and Sales Manager users.
        </p>
      </section>
    );
  }

  return (
    <section className="grid max-w-full gap-6 overflow-hidden">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              ERP-to-CRM Reconciliation
            </h2>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Compare Graymills ERP order activity with CRM companies, activities, and opportunities.
              Matching remains review-first. Accept Link is the only action here that can write an ERP customer number to a CRM company.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-bold">
              Controlled linking workflow
            </p>

            <p className="mt-1 text-xs leading-5">
              No automatic CRM changes. Accept Link writes only the reviewed Graymills customer number.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {successMessage}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-950">
          Upload ERP Order Report
        </h3>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
          Upload the standard Graymills order-line XLSX report. Version 3.26 finds the header row automatically,
          preserves the untouched workbook privately, aggregates lines by Cust #, and proposes CRM matches.
        </p>

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label className="text-sm font-semibold text-slate-700">
              ERP XLSX workbook
            </label>

            <input
              key={uploadInputKey}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) =>
                setSelectedFile(
                  event.target.files?.[0] ??
                    null
                )
              }
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            />

            {selectedFile && (
              <p className="mt-2 text-xs text-slate-500">
                Selected:{" "}
                <span className="font-semibold">
                  {selectedFile.name}
                </span>
                {" - "}
                {(
                  selectedFile.size /
                  1024
                ).toFixed(1)}
                {" KB"}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              void uploadWorkbook()
            }
            disabled={
              !selectedFile ||
              isUploading
            }
            className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isUploading
              ? "Processing ERP Workbook..."
              : "Upload & Reconcile"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <label className="text-sm font-semibold text-slate-700">
              Reconciliation run
            </label>

            <select
              value={
                selectedRun?.id || ""
              }
              onChange={(event) =>
                void loadReconciliation(
                  event.target.value
                )
              }
              disabled={
                runs.length === 0 ||
                isLoading
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
            >
              {runs.length === 0 && (
                <option value="">
                  No ERP reconciliation runs yet
                </option>
              )}

              {runs.map(
                (run) => (
                  <option
                    key={run.id}
                    value={run.id}
                  >
                    {run.file_name}
                    {" - "}
                    {formatDateTime(
                      run.created_at
                    )}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                void loadReconciliation(
                  selectedRun?.id
                )
              }
              disabled={isLoading}
              className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:text-slate-400"
            >
              {isLoading
                ? "Refreshing..."
                : "Refresh"}
            </button>

            {selectedRun?.signed_url && (
              <button
                type="button"
                onClick={() =>
                  window.open(
                    selectedRun.signed_url || "",
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
                className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-900"
              >
                Open Original Workbook
              </button>
            )}
          </div>
        </div>

        {selectedRun && (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Metric
                label="ERP customers"
                value={String(
                  selectedRun.customer_count
                )}
              />

              <Metric
                label="Confident"
                value={String(
                  selectedRun.confident_match_count
                )}
                tone="green"
              />

              <Metric
                label="Likely"
                value={String(
                  selectedRun.likely_match_count
                )}
                tone="blue"
              />

              <Metric
                label="Ambiguous"
                value={String(
                  selectedRun.ambiguous_match_count
                )}
                tone="amber"
              />

              <Metric
                label="Conflicts"
                value={String(
                  selectedRun.conflict_count
                )}
                tone="red"
              />

              <Metric
                label="Unmatched"
                value={String(
                  selectedRun.unmatched_count
                )}
              />
            </div>

            <div className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  File
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {selectedRun.file_name}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Report
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {selectedRun.report_title ||
                    "ERP Order Lines"}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Source rows
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {selectedRun.source_row_count}
                  {" rows"}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Uploaded by
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {selectedRun.created_by_name ||
                    "Unknown"}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedRun && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-950">
                Customer Match Review
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Review the ERP customer, proposed CRM evidence, and current CRM follow-up before confirming or rejecting the reconciliation match.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Match
                <select
                  value={matchFilter}
                  onChange={(event) =>
                    setMatchFilter(
                      event.target.value
                    )
                  }
                  className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700"
                >
                  <option value="all">
                    All matches
                  </option>
                  <option value="confident">
                    Confident
                  </option>
                  <option value="likely">
                    Likely
                  </option>
                  <option value="ambiguous">
                    Ambiguous
                  </option>
                  <option value="conflict">
                    Conflict
                  </option>
                  <option value="unmatched">
                    Unmatched
                  </option>
                </select>
              </label>

              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Review
                <select
                  value={reviewFilter}
                  onChange={(event) =>
                    setReviewFilter(
                      event.target.value
                    )
                  }
                  className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-700"
                >
                  <option value="all">
                    All review states
                  </option>
                  <option value="unreviewed">
                    Unreviewed
                  </option>
                  <option value="needs_review">
                    Needs review
                  </option>
                  <option value="confirmed">
                    Confirmed
                  </option>
                  <option value="rejected">
                    Rejected
                  </option>
                </select>
              </label>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric
              label="Visible customers"
              value={String(
                filteredCustomers.length
              )}
            />

            <Metric
              label="Visible ERP order-line value"
              value={formatCurrency(
                visibleValue
              )}
              tone="blue"
            />

            <Metric
              label="CRM customer numbers absent from this ERP file"
              value={String(
                selectedRun.summary
                  ?.crm_customer_numbers_not_in_erp_count ??
                  0
              )}
            />
          </div>

          {filteredCustomers.length ===
          0 ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
              No ERP customers match the current filters.
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {filteredCustomers.map(
                (customer) => {
                  const selectedCandidateId =
                    candidateSelections[
                      customer.id
                    ] ||
                    customer.matched_company_id ||
                    customer
                      .candidate_matches?.[0]
                      ?.company_id ||
                    "";

                  const candidate =
                    candidateForCustomer(
                      customer,
                      selectedCandidateId
                    );

                  const isSaving =
                    savingReviewIds.includes(
                      customer.id
                    );

                  const hasFollowUpGap =
                    Boolean(
                      candidate &&
                        candidate.open_activity_count ===
                          0 &&
                        candidate.open_opportunity_count ===
                          0
                    );

                  const crmIsProspect =
                    cleanText(
                      candidate?.account_type
                    )
                      .toLowerCase() ===
                    "prospect";

                  return (
                    <details
                      key={customer.id}
                      className={`group rounded-2xl border shadow-sm ${matchCardClasses(customer.match_status)}`}
                    >
                      <summary className="cursor-pointer list-none p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-base font-bold text-slate-950">
                                {customer.company_name}
                              </h4>

                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
                                Cust #{" "}
                                {customer.erp_customer_number}
                              </span>

                              <span
                                className={`rounded-full border px-2.5 py-1 text-xs font-bold ${matchBadgeClasses(
                                  customer.match_status
                                )}`}
                              >
                                {customer.match_status}
                                {customer.match_score !==
                                  null &&
                                  ` ${customer.match_score}%`}
                              </span>

                              <span
                                className={`rounded-full border px-2.5 py-1 text-xs font-bold ${reviewBadgeClasses(
                                  customer.review_status
                                )}`}
                              >
                                {customer.review_status.replace(
                                  /_/g,
                                  " "
                                )}
                              </span>

                              {crmIsProspect && (
                                <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-800">
                                  CRM Prospect
                                </span>
                              )}

                              {hasFollowUpGap && (
                                <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800">
                                  Follow-Up Gap
                                </span>
                              )}
                            </div>

                            <p className="mt-2 text-sm text-slate-600">
                              {[
                                customer.city,
                                customer.state,
                                customer.postal_code,
                              ]
                                .filter(Boolean)
                                .join(", ") ||
                                "Location not supplied"}
                            </p>
                          </div>

                          <div className="grid min-w-fit grid-cols-3 gap-4 text-right text-sm">
                            <div>
                              <p className="text-xs text-slate-500">
                                Last ERP order
                              </p>
                              <p className="font-semibold text-slate-900">
                                {formatDate(
                                  customer.latest_order_date
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-slate-500">
                                Orders
                              </p>
                              <p className="font-semibold text-slate-900">
                                {customer.order_count}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-slate-500">
                                ERP value
                              </p>
                              <p className="font-semibold text-slate-900">
                                {formatCurrency(
                                  customer.order_line_value
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </summary>

                      <div className="border-t border-slate-200 p-5">
                        <div className="grid gap-5 xl:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <h5 className="font-bold text-slate-950">
                              ERP Customer Evidence
                            </h5>

                            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                              <Field
                                label="Customer #"
                                value={
                                  customer.erp_customer_number
                                }
                              />

                              <Field
                                label="Address"
                                value={[
                                  customer.address_line_1,
                                  customer.city,
                                  customer.state,
                                  customer.postal_code,
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                              />

                              <Field
                                label="Phone"
                                value={
                                  customer.phone ||
                                  ""
                                }
                              />

                              <Field
                                label="Email"
                                value={
                                  customer.email ||
                                  ""
                                }
                              />

                              <Field
                                label="Product lines"
                                value={
                                  customer.product_lines.join(
                                    ", "
                                  )
                                }
                              />

                              <Field
                                label="ERP salesperson"
                                value={
                                  customer.erp_salespeople.join(
                                    ", "
                                  )
                                }
                              />

                              <Field
                                label="Territory"
                                value={
                                  customer.territories.join(
                                    ", "
                                  )
                                }
                              />

                              <Field
                                label="Order statuses"
                                value={
                                  customer.order_statuses.join(
                                    ", "
                                  )
                                }
                              />
                            </div>
                          </div>

                          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                            <h5 className="font-bold text-blue-950">
                              Proposed CRM Match
                            </h5>

                            <p className="mt-2 text-sm text-blue-800">
                              Method:{" "}
                              <span className="font-semibold">
                                {friendlyMatchMethod(
                                  customer.match_method
                                )}
                              </span>
                            </p>

                            {customer.candidate_matches.length >
                            0 ? (
                              <>
                                <label className="mt-4 block text-sm font-semibold text-blue-950">
                                  CRM candidate
                                  <select
                                    value={
                                      selectedCandidateId
                                    }
                                    onChange={(event) =>
                                      setCandidateSelections(
                                        (current) => ({
                                          ...current,
                                          [customer.id]:
                                            event.target.value,
                                        })
                                      )
                                    }
                                    className="mt-2 w-full rounded-xl border border-blue-300 bg-white px-3 py-2 text-sm text-slate-800"
                                  >
                                    {customer.candidate_matches.map(
                                      (
                                        candidateOption
                                      ) => (
                                        <option
                                          key={
                                            candidateOption.company_id
                                          }
                                          value={
                                            candidateOption.company_id
                                          }
                                        >
                                          {
                                            candidateOption.company_name
                                          }
                                          {" - "}
                                          {
                                            candidateOption.score
                                          }
                                          %
                                          {candidateOption.graymills_customer_number
                                            ? ` - Cust # ${candidateOption.graymills_customer_number}`
                                            : ""}
                                        </option>
                                      )
                                    )}
                                  </select>
                                </label>

                                {candidate && (
                                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                                    <Field
                                      label="CRM company"
                                      value={
                                        candidate.company_name
                                      }
                                    />

                                    <Field
                                      label="CRM customer #"
                                      value={
                                        candidate.graymills_customer_number ||
                                        "Not recorded"
                                      }
                                    />

                                    <Field
                                      label="Account type"
                                      value={
                                        candidate.account_type ||
                                        "Not recorded"
                                      }
                                    />

                                    <Field
                                      label="CRM location"
                                      value={[
                                        candidate.city,
                                        candidate.state,
                                        candidate.postal_code,
                                      ]
                                        .filter(Boolean)
                                        .join(", ")}
                                    />

                                    <Field
                                      label="Last CRM activity"
                                      value={
                                        candidate.last_crm_activity_at
                                          ? formatDateTime(
                                              candidate.last_crm_activity_at
                                            )
                                          : "No activity found"
                                      }
                                    />

                                    <Field
                                      label="Open CRM activities"
                                      value={String(
                                        candidate.open_activity_count
                                      )}
                                    />

                                    <Field
                                      label="Open opportunities"
                                      value={String(
                                        candidate.open_opportunity_count
                                      )}
                                    />

                                    <Field
                                      label="Match score"
                                      value={`${candidate.score}%`}
                                    />
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                                No CRM candidate met the matching threshold.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 grid gap-5 xl:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 p-4">
                            <h5 className="font-bold text-slate-950">
                              Match Evidence
                            </h5>

                            <div className="mt-3 space-y-2">
                              {(customer.match_reasons.length >
                              0
                                ? customer.match_reasons
                                : [
                                    "No matching evidence recorded.",
                                  ]
                              ).map(
                                (
                                  reason,
                                  index
                                ) => (
                                  <p
                                    key={`${customer.id}-reason-${index}`}
                                    className="text-sm leading-5 text-slate-700"
                                  >
                                    • {reason}
                                  </p>
                                )
                              )}
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 p-4">
                            <h5 className="font-bold text-slate-950">
                              Human Review
                            </h5>

                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              Accept Link permanently connects the reviewed ERP customer number to the selected CRM company.
                              No other CRM company fields are changed.
                            </p>

                            <label className="mt-4 block text-sm font-semibold text-slate-700">
                              Review note
                              <textarea
                                value={
                                  reviewNotes[
                                    customer.id
                                  ] || ""
                                }
                                onChange={(event) =>
                                  setReviewNotes(
                                    (current) => ({
                                      ...current,
                                      [customer.id]:
                                        event.target.value,
                                    })
                                  )
                                }
                                rows={3}
                                placeholder="Optional note about why this ERP-to-CRM match was accepted or rejected."
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                              />
                            </label>

                            {customer.reviewed_at && (
                              <p className="mt-3 text-xs text-slate-500">
                                Last reviewed{" "}
                                {formatDateTime(
                                  customer.reviewed_at
                                )}
                                {customer.reviewed_by_name
                                  ? ` by ${customer.reviewed_by_name}`
                                  : ""}
                              </p>
                            )}

                            {reviewActionMessages[
                              customer.id
                            ] && (
                              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                                {
                                  reviewActionMessages[
                                    customer.id
                                  ]
                                }
                              </div>
                            )}

                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenCompany(
                                    selectedCandidateId
                                  )
                                }
                                disabled={
                                  isSaving ||
                                  !selectedCandidateId
                                }
                                className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                Open Company
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void reviewCustomer(
                                    customer,
                                    "link"
                                  )
                                }
                                disabled={
                                  isSaving ||
                                  !selectedCandidateId
                                }
                                className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                {isSaving
                                  ? "Saving..."
                                  : "Accept Link"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void reviewCustomer(
                                    customer,
                                    "reject"
                                  )
                                }
                                disabled={isSaving}
                                className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:text-slate-400"
                              >
                                No - Not This Account
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </details>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?:
    | "slate"
    | "green"
    | "blue"
    | "amber"
    | "red";
}) {
  const classes =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "blue"
        ? "border-blue-200 bg-blue-50"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50"
          : tone === "red"
            ? "border-red-200 bg-red-50"
            : "border-slate-200 bg-slate-50";

  return (
    <div
      className={`rounded-xl border p-4 ${classes}`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-xl font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words font-medium text-slate-900">
        {value || "Not recorded"}
      </p>
    </div>
  );
}