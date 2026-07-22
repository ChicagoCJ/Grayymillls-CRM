"use client";


import { getBrowserSupabaseClient, hasBrowserSupabaseConfig } from "../lib/supabase-browser";
import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

type TabKey = "dashboard" | "companies" | "contacts" | "funnel" | "import" | "help" | "releaseNotes" | "admin" | "companyDetail";

type ImportResultsReport = {
  companiesCreated: string[];
  companiesReused: string[];
  companiesEnriched: string[];
  contactsCreated: string[];
  contactsReused: string[];
  skippedRows: string[];
  rowErrors: string[];
};

type ImportResultsSummary = {
  totalRows?: number;
  companiesCreated?: number;
  contactsCreated?: number;
  duplicateCompanies?: number;
  duplicateContacts?: number;
  companiesEnriched?: number;
  errors?: string[];
  report?: ImportResultsReport;
};

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

type ImportResult = any;

type CompanySummary = any;

type ContactSummary = any;

type ImportSummary = any;

type ActivityRecord = {
  id: string;
  company_id: string;
  contact_id: string | null;
  prospect_id: string | null;
  activity_type: string;
  subject: string | null;
  notes: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  companies?: {
    company_name: string;
  } | null;
};

type CrmSummary = {
  companies: CompanySummary[];
  contacts: ContactSummary[];
  imports: ImportSummary[];
  activities: {
    open: ActivityRecord[];
    dueToday: ActivityRecord[];
    overdue: ActivityRecord[];
  };
};

type CrmUser = any;


type CompanyDetail = any;

type ActivityForm = {
  activityType: "note" | "call" | "email" | "meeting" | "task" | "quote_followup";
  subject: string;
  notes: string;
  dueDate: string;
  primaryContactId: string;
  relatedContactIds: string[];
};

type ManualContactForm = {
  firstName: string;
  lastName: string;
  title: string;
  managementLevel: string;
  department: string;
  functionArea: string;
  email: string;
  directPhone: string;
  mobilePhone: string;
  personCity: string;
  personState: string;
  personCountry: string;
  linkedinUrl: string;
  buyingRoleHypothesis: string;
  isPrimary: boolean;
};

const APP_VERSION = "Version 3.15 - Company Detail Layout Cleanup";
const REVISION_NOTE =
  "Moves Sales Coverage below the main Company Detail content and Company Industry Enrichment, preserving the Coverage shortcut, assignment behavior, and Funnel placement.";

type SignedInSessionStatus = {
  state: "checking" | "not_configured" | "signed_out" | "signed_in" | "error";
  email: string;
  userId: string;
  message: string;
};



type SignedInCrmUserMatchStatus = {
  state: "checking" | "not_configured" | "signed_out" | "matched" | "not_matched" | "error";
  authEmail: string;
  authUserId: string;
  crmUserName: string;
  crmUserRole: string;
  crmUserStatus: string;
  crmUserCoverageType: string;
  message: string;
};

type CrmUserMatchRecord = Record<string, unknown>;

function getCrmUserMatchField(user: CrmUserMatchRecord, keys: string[]) {
  for (const key of keys) {
    const value = user[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

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
    aliases: ["company address", "street address", "hq address"],
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
    aliases: [
      "company postal code",
      "company zip code",
      "company zip",
      "company postal",
      "hq postal code",
      "hq zip code"
    ],
  },
  {
    field: "Company Country",
    required: false,
    aliases: ["company country", "hq country", "country"],
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

function formatDate(value: string | null) {
  if (!value) return "No date";

  const normalizedValue = String(value).trim();
  const dateOnlyMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${Number(month)}/${Number(day)}/${year}`;
  }

  return new Date(normalizedValue).toLocaleDateString();
}

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalDateInputValueOffset(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toLocalDateInputValue(date);
}

function getActivityUpdatedTimestamp(activity: any) {
  const updatedValue = String(activity?.updated_at || activity?.modified_at || "").trim();
  const createdValue = String(activity?.created_at || "").trim();

  if (!updatedValue) return "";

  if (updatedValue === createdValue) return "";

  const updatedTime = Date.parse(updatedValue);
  const createdTime = Date.parse(createdValue);

  if (
    !Number.isNaN(updatedTime) &&
    !Number.isNaN(createdTime) &&
    Math.abs(updatedTime - createdTime) < 1000
  ) {
    return "";
  }

  return updatedValue;
}

function getLatestProspect(company: CompanySummary) {
  if (!company.prospects || company.prospects.length === 0) return null;

  return [...company.prospects].sort(
    (a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0)
  )[0];
}

function buildMappingObject(mappingSuggestions: MappingSuggestion[], headers: string[] = []) {
  const mapping = mappingSuggestions.reduce<Record<string, string>>((accumulator, suggestion) => {
    accumulator[suggestion.crmField] = suggestion.suggestedColumn;
    return accumulator;
  }, {});

  const exactHeader = (headerName: string) =>
    headers.find((header) => normalizeHeader(header) === normalizeHeader(headerName));

  const forceIfHeaderExists = (crmFieldNames: string[], csvHeaderName: string) => {
    const matchingHeader = exactHeader(csvHeaderName);
    if (!matchingHeader) return;

    crmFieldNames.forEach((crmFieldName) => {
      mapping[crmFieldName] = matchingHeader;
    });
  };

  forceIfHeaderExists(["Company Address"], "Company Address");
  forceIfHeaderExists(["Company Postal Code"], "Company Postal Code");
  forceIfHeaderExists(["Company Country"], "Company Country");

  return mapping;
}

function applyZoomInfoMappingDefaults(
  mapping: Record<string, string>,
  headers: string[]
) {
  const exactHeader = (headerName: string) =>
    headers.find((header) => normalizeHeader(header) === normalizeHeader(headerName));

  const forcedDefaults: Record<string, string> = {
    "Company Address": "Company Address",
    "Company Postal Code": "Company Postal Code",
    "Company Country": "Company Country",
  };

  const nextMapping = { ...mapping };

  Object.entries(forcedDefaults).forEach(([crmField, csvHeader]) => {
    const matchingHeader = exactHeader(csvHeader);

    if (matchingHeader) {
      nextMapping[crmField] = matchingHeader;
    }
  });

  return nextMapping;
}
function isMapped(value: string | undefined) {
  return Boolean(value && value !== "Not detected" && value !== "__skip__");
}

async function readJsonResponse(response: Response, label: string) {
  const contentType = response.headers.get("content-type") || "";
  const bodyText = await response.text();

  if (!contentType.includes("application/json")) {
    throw new Error(
      `${label} returned ${response.status} ${response.statusText} as ${contentType || "unknown content type"}. Preview: ${bodyText.slice(0, 160)}`
    );
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error(`${label} returned invalid JSON. Preview: ${bodyText.slice(0, 160)}`);
  }
}
function formatUserRole(role: string | null | undefined) {
  if (role === "admin") return "Admin";
  if (role === "sales_manager") return "Sales Manager";
  if (role === "sales_rep") return "Sales Rep";
  return "Sales Rep";
}

function formatCoverageType(type: string | null | undefined) {
  if (type === "outside_rep") return "Outside Rep";
  if (type === "internal") return "Internal";
  return "Internal";
}
type AppUserRole = "admin" | "sales_manager" | "sales_rep";

type AppPermissions = {
  canManageAdminSettings: boolean;
  canImportCsv: boolean;
  canManageFunnelStages: boolean;
  canMoveOpportunityStages: boolean;
  canAssignSalesCoverage: boolean;
};

function getRoleVisibilityReason(role: AppUserRole, userDisplayName: string) {
  if (role === "admin") {
    return "Visible because Admin users can see all CRM records.";
  }

  if (role === "sales_manager") {
    return "Visible because Sales Managers can see all companies and funnel opportunities for oversight.";
  }

  return `Visible only when ${userDisplayName} is assigned as Salesperson / Rep.`;
}
function getRolePermissions(role: AppUserRole): AppPermissions {
  if (role === "admin") {
    return {
      canManageAdminSettings: true,
      canImportCsv: true,
      canManageFunnelStages: true,
      canMoveOpportunityStages: true,
      canAssignSalesCoverage: true,
    };
  }

  if (role === "sales_manager") {
    return {
      canManageAdminSettings: false,
      canImportCsv: true,
      canManageFunnelStages: false,
      canMoveOpportunityStages: true,
      canAssignSalesCoverage: true,
    };
  }

  return {
    canManageAdminSettings: false,
    canImportCsv: false,
    canManageFunnelStages: false,
    canMoveOpportunityStages: true,
    canAssignSalesCoverage: false,
  };
}

function formatAppUserRole(role: AppUserRole) {
  if (role === "admin") return "Admin";
  if (role === "sales_manager") return "Sales Manager";
  return "Sales Rep";
}
function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return [];
}

function getActivityLabel(type: string) {
  const labels: Record<string, string> = {
    note: "Note",
    call: "Call",
    email: "Email",
    meeting: "Meeting",
    task: "Task",
    quote_followup: "Quote Follow-Up",
    import_note: "Import Note",
  };

  return labels[type] || type;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatTitleFromKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isOverdue(activity: ActivityRecord) {
  if (!activity.due_date || activity.completed_at) return false;
  const today = getLocalDateInputValueOffset(0);
  return activity.due_date < today;
}

function normalizeForSearch(value: unknown) {
  return String(value ?? "").toLowerCase().trim();
}

function hasMeaningfulAnalysis(intelligence: Record<string, unknown> | null) {
  return intelligence?.is_ai_generated === true;
}

function isLikelyCorruptedDisplayText(value: unknown) {
  if (typeof value !== "string") return false;

  const text = value.trim();
  if (!text) return false;

  const badTokens = ["\u00c3", "\u00c2", "\u00e2", "\u20ac", "\ufffd", "\u00c6", "\u0192", "\u00a2", "\u00ac"];
  const badTokenCount = badTokens.reduce((count, token) => count + (text.includes(token) ? 1 : 0), 0);
  const nonAsciiCount = Array.from(text).filter((char) => char.charCodeAt(0) > 127).length;

  return badTokenCount >= 2 || nonAsciiCount > 6 || text.length > 160;
}

function safeDisplayText(value: unknown, fallback = "Unavailable") {
  if (value === null || value === undefined) return fallback;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString() : fallback;
  }

  if (typeof value !== "string") return fallback;

  const text = value.trim();
  if (!text || isLikelyCorruptedDisplayText(text)) return fallback;

  return text.length > 90 ? text.slice(0, 87) + "..." : text;
}

type CrmTag = any;
type CompanyTagSummary = any;
type ContactTagSummary = any;
type SalesFunnelStage = any;

type SalesOpportunity = any;

type OpportunityDocument = any;

type SalesOpportunityActivity = any;

type AssignedCompanyTag = any;

type AssignedContactTag = any;
export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [companyDetailReturnTab, setCompanyDetailReturnTab] = useState<TabKey>("companies");
  const [currentUserRole, setCurrentUserRole] = useState<AppUserRole>("sales_rep");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState(
    "Checking signed-in CRM user"
  );
  const [currentCoverageType, setCurrentCoverageType] = useState("internal");
  const [signedInProductionUser, setSignedInProductionUser] = useState({
    state: "checking",
    crmUserId: "",
    displayName: "Checking signed-in CRM user",
    role: "sales_rep" as AppUserRole,
    status: "",
    coverageType: "internal",
    authEmail: "",
    authUserId: "",
    message: "Checking signed-in CRM user role.",
  });

  useEffect(() => {
    let cancelled = false;

    function applyLimitedFallback(message: string, authEmail = "", authUserId = "") {
      if (cancelled) return;

      setSignedInProductionUser({
        state: "restricted",
        crmUserId: "__no_crm_user_match__",
        displayName: "No matched CRM user",
        role: "sales_rep",
        status: "restricted",
        coverageType: "internal",
        authEmail,
        authUserId,
        message,
      });

      setCurrentUserRole("sales_rep");
      setCurrentUserId("__no_crm_user_match__");
      setCurrentUserDisplayName("No matched CRM user");
      setCurrentCoverageType("internal");
    }

    async function loadSignedInProductionUser() {
      try {
        if (!hasBrowserSupabaseConfig()) {
          applyLimitedFallback("Browser Supabase configuration is not available. UI access is restricted.");
          return;
        }

        const supabase = getBrowserSupabaseClient();
        const { data, error } = await supabase.auth.getSession();

        if (cancelled) return;

        if (error) {
          applyLimitedFallback(error.message || "Could not read signed-in Supabase session.");
          return;
        }

        const authUser = data.session?.user;

        if (!authUser) {
          setSignedInProductionUser({
            state: "signed_out",
            crmUserId: "",
            displayName: "Signed out",
            role: "sales_rep",
            status: "",
            coverageType: "internal",
            authEmail: "",
            authUserId: "",
            message: "No signed-in Supabase Auth user session detected.",
          });

          return;
        }

        const authEmail = String(authUser.email || "").trim().toLowerCase();
        const authUserId = String(authUser.id || "").trim();

        const usersResponse = await fetch("/api/crm-users?includeInactive=true");
        const usersData = await usersResponse.json();

        if (cancelled) return;

        if (!usersResponse.ok) {
          applyLimitedFallback(usersData.error || "Could not load CRM Users for production role matching.", authEmail, authUserId);
          return;
        }

        const users: CrmUser[] = Array.isArray(usersData.users) ? usersData.users : [];
        const matchedUser = users.find((candidate: CrmUser) => {
          const candidateEmail = String(candidate.email || "").trim().toLowerCase();
          const candidateAuthId = String(
            candidate.auth_user_id ||
              candidate.supabase_auth_user_id ||
              candidate.supabase_user_id ||
              ""
          ).trim();

          return (
            (authEmail && candidateEmail === authEmail) ||
            (authUserId && candidateAuthId === authUserId)
          );
        });

        if (!matchedUser) {
          applyLimitedFallback("Signed-in Supabase Auth user was detected, but no matching CRM Users record was found.", authEmail, authUserId);
          return;
        }

        const matchedRole = String(matchedUser.user_role || matchedUser.role || "sales_rep").trim();
        const normalizedRole: AppUserRole =
          matchedRole === "admin" || matchedRole === "sales_manager" || matchedRole === "sales_rep"
            ? matchedRole
            : "sales_rep";

        const matchedStatus = String(matchedUser.status || "active").trim();
        const matchedUserId = String(matchedUser.id || "").trim();
        const matchedDisplayName = String(
          matchedUser.display_name ||
            matchedUser.full_name ||
            matchedUser.name ||
            matchedUser.email ||
            "Signed-in CRM user"
        ).trim();
        const matchedCoverageType = String(matchedUser.coverage_type || "internal").trim();

        if (matchedStatus && matchedStatus !== "active") {
          applyLimitedFallback("Matched CRM user is not active. UI access is restricted.", authEmail, authUserId);
          return;
        }

        setSignedInProductionUser({
          state: "ready",
          crmUserId: matchedUserId,
          displayName: matchedDisplayName,
          role: normalizedRole,
          status: matchedStatus || "active",
          coverageType: matchedCoverageType,
          authEmail,
          authUserId,
          message: "Signed-in CRM user role is active and is controlling UI permissions.",
        });

        setCurrentUserRole(normalizedRole);
        setCurrentUserId(matchedUserId);
        setCurrentUserDisplayName(matchedDisplayName);
        setCurrentCoverageType(matchedCoverageType);

        const nextPermissions = getRolePermissions(normalizedRole);

        if (activeTab === "admin" && !nextPermissions.canManageAdminSettings) {
          setActiveTab("dashboard");
        }

        if (activeTab === "import" && !nextPermissions.canImportCsv) {
          setActiveTab("dashboard");
        }
      } catch (error) {
        applyLimitedFallback(
          error instanceof Error
            ? error.message
            : "Could not load signed-in CRM user role for UI enforcement."
        );
      }
    }

    loadSignedInProductionUser();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);
  const [importAssignedSalespersonId, setImportAssignedSalespersonId] = useState("");
  const [importAssignedSalesManagerId, setImportAssignedSalesManagerId] = useState("");
  const [importProjectListOptions, setImportProjectListOptions] = useState<any[]>([]);
  const [importSelectedProjectListIds, setImportSelectedProjectListIds] = useState<string[]>([]);
  const [isLoadingImportProjectLists, setIsLoadingImportProjectLists] = useState(false);
  const [importProjectListError, setImportProjectListError] = useState("");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [bulkAssignedSalespersonId, setBulkAssignedSalespersonId] = useState("");
  const [bulkAssignedSalesManagerId, setBulkAssignedSalesManagerId] = useState("");
  const [isBulkAssigningCompanies, setIsBulkAssigningCompanies] = useState(false);
  const [bulkCompanyAssignmentMessage, setBulkCompanyAssignmentMessage] = useState("");
  const [roleTestUsers, setRoleTestUsers] = useState<CrmUser[]>([]);
  const [showSalesCoverageDiagnostics, setShowSalesCoverageDiagnostics] = useState(true);
  const [diagnosticsCompanySearch, setDiagnosticsCompanySearch] = useState("");
  const [isLoadingRoleUsers, setIsLoadingRoleUsers] = useState(false);
  const [roleUserError, setRoleUserError] = useState("");
  const currentPermissions = useMemo(
    () => getRolePermissions(currentUserRole),
    [currentUserRole]
  );

  const productionRoleEnforcementEnabled =
    signedInProductionUser.state !== "checking" &&
    signedInProductionUser.state !== "signed_out";

  const roleVisibilityEnabled = productionRoleEnforcementEnabled;
  const navigationRole: AppUserRole = currentUserRole;
  const [csvData, setCsvData] = useState<ParsedCsv | null>(null);
  const [manualMapping, setManualMapping] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [lastImportResults, setLastImportResults] = useState<ImportResultsSummary | null>(null);
  const [importTagPanelResetKey, setImportTagPanelResetKey] = useState(0);
  const [importMarketTagIds, setImportMarketTagIds] = useState<string[]>([]);
  const [importSectorTagIds, setImportSectorTagIds] = useState<string[]>([]);
  const [importCategoryTagIds, setImportCategoryTagIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingCompanyDetail, setIsLoadingCompanyDetail] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [isCompletingActivity, setIsCompletingActivity] = useState("");
  const [isAnalyzingProspect, setIsAnalyzingProspect] = useState(false);
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [companyTierFilter, setCompanyTierFilter] = useState("All");
  const [companyStatusFilter, setCompanyStatusFilter] = useState("All");
  const [companyProductPathFilter, setCompanyProductPathFilter] = useState("All");
  const [companyMarketTagFilter, setCompanyMarketTagFilter] = useState("All");
  const [companySectorTagFilter, setCompanySectorTagFilter] = useState("All");
  const [companyCategoryTagFilter, setCompanyCategoryTagFilter] = useState("All");
  const [allCrmTags, setAllCrmTags] = useState<CrmTag[]>([]);
  const [allCompanyTags, setAllCompanyTags] = useState<CompanyTagSummary[]>([]);
  const [allCompanyProjectAssignments, setAllCompanyProjectAssignments] = useState<any[]>([]);
  const [companyProjectListFilter, setCompanyProjectListFilter] = useState("All");
  const [companyOwnerFilter, setCompanyOwnerFilter] = useState("All");
  const [companySalespersonFilter, setCompanySalespersonFilter] = useState("All");
  const [companySalesManagerFilter, setCompanySalesManagerFilter] = useState("All");
  const [companyAssignmentStatusFilter, setCompanyAssignmentStatusFilter] = useState("All");
  const [companyAccountTypeFilter, setCompanyAccountTypeFilter] = useState("All");
  const [companyAccountTypeOverrides, setCompanyAccountTypeOverrides] = useState<Record<string, CompanyAccountTypeLens>>({});
  const [companyBuyerPersonaOverrides, setCompanyBuyerPersonaOverrides] = useState<Record<string, string[]>>({});
  const [companyBuyerPersonaFilter, setCompanyBuyerPersonaFilter] = useState("All");
  const [companyPrimaryIndustryFilter, setCompanyPrimaryIndustryFilter] = useState("All");
  const [companyPrimarySubIndustryFilter, setCompanyPrimarySubIndustryFilter] = useState("All");
  const [companyOwnerOptions, setCompanyOwnerOptions] = useState<CrmUser[]>([]);
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [contactMarketTagFilter, setContactMarketTagFilter] = useState("All");
  const [contactSectorTagFilter, setContactSectorTagFilter] = useState("All");
  const [contactCategoryTagFilter, setContactCategoryTagFilter] = useState("All");
  const [allContactTags, setAllContactTags] = useState<ContactTagSummary[]>([]);
  const [allContactProjectAssignments, setAllContactProjectAssignments] = useState<any[]>([]);
  const [contactProjectListFilter, setContactProjectListFilter] = useState("All");
  const [selectedCompanyDetail, setSelectedCompanyDetail] = useState<CompanyDetail | null>(null);
  const [activityForm, setActivityForm] = useState<ActivityForm>({
    activityType: "note",
    subject: "",
    notes: "",
    dueDate: "",
    primaryContactId: "",
    relatedContactIds: [],
  });
  const [crmSummary, setCrmSummary] = useState<CrmSummary>({
    companies: [],
    contacts: [],
    imports: [],
    activities: {
      open: [],
      dueToday: [],
      overdue: [],
    },
  });

  const mappingSuggestions = useMemo(() => {
    if (!csvData) return [];
    return suggestMappings(csvData.headers);
  }, [csvData]);

  const suggestedMappingObject = useMemo(() => {
    return buildMappingObject(mappingSuggestions, csvData?.headers ?? []);
  }, [csvData, mappingSuggestions]);

  const activeMapping = useMemo(() => {
    const mapping: Record<string, string> = {};

    CRM_FIELDS.forEach((field) => {
      mapping[field.field] =
        manualMapping[field.field] ??
        suggestedMappingObject[field.field] ??
        "Not detected";
    });

    const exactHeader = (headerName: string) =>
      csvData?.headers.find((header) => normalizeHeader(header) === normalizeHeader(headerName));

    const companyAddressHeader =
      exactHeader("Company Street Address") ??
      exactHeader("Company Address");

    const companyPostalHeader =
      exactHeader("Company Postal Code") ??
      exactHeader("Company Zip Code") ??
      exactHeader("Company ZIP Code");

    const companyCountryHeader = exactHeader("Company Country");

    if (companyAddressHeader) {
      mapping["Company Address"] = companyAddressHeader;
    }

    if (companyPostalHeader) {
      mapping["Company Postal Code"] = companyPostalHeader;
    }

    if (companyCountryHeader) {
      mapping["Company Country"] = companyCountryHeader;
    }

    return mapping;
  }, [csvData, manualMapping, suggestedMappingObject]);
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

  const companyTierOptions = useMemo(() => {
    const tiers = crmSummary.companies
      .map((company) => getLatestProspect(company)?.priority_tier)
      .filter((tier): tier is string => Boolean(tier));

    return ["All", ...Array.from(new Set(tiers)).sort()];
  }, [crmSummary.companies]);

  const companyStatusOptions = useMemo(() => {
    const statuses = crmSummary.companies
      .map((company) => company.status || "new")
      .filter(Boolean);

    return ["All", ...Array.from(new Set(statuses)).sort()];
  }, [crmSummary.companies]);

  const companyProductPathOptions = useMemo(() => {
    const paths = crmSummary.companies
      .map((company) => getLatestProspect(company)?.likely_product_path)
      .filter((path): path is string => Boolean(path));

    return ["All", ...Array.from(new Set(paths)).sort()];
  }, [crmSummary.companies]);

  const contactMarketTagOptions = useMemo(() => {
    return [
      "All",
      ...allCrmTags
        .filter((tag) => ["market", "markets"].includes(String(tag.tag_type ?? "").toLowerCase().trim()))
        .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100))
        .map((tag) => String(tag.tag_name || "")).filter(Boolean),
    ];
  }, [allCrmTags]);

  const contactSectorTagOptions = useMemo(() => {
    return [
      "All",
      ...allCrmTags
        .filter((tag) => ["sector", "sectors", "industry", "industries", "segment", "segments"].includes(String(tag.tag_type ?? "").toLowerCase().trim()))
        .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100))
        .map((tag) => String(tag.tag_name || "")).filter(Boolean),
    ];
  }, [allCrmTags]);

  const contactCategoryTagOptions = useMemo(() => {
    return [
      "All",
      ...allCrmTags
        .filter((tag) => ["category", "categories", "workflow", "priority", "status"].includes(String(tag.tag_type ?? "").toLowerCase().trim()))
        .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100))
        .map((tag) => String(tag.tag_name || "")).filter(Boolean),
    ];
  }, [allCrmTags]);
  function contactMatchesRoleVisibility(contact: ContactSummary) {
    if (!roleVisibilityEnabled) return true;
    if (currentUserRole === "admin") return true;
    if (currentUserRole === "sales_manager") return true;
    if (!currentUserId) return true;

    if (currentUserRole === "sales_rep") {
      const relatedCompany = crmSummary.companies.find(
        (company) => String(company.id || company.company_id || "") === String(contact.company_id || "")
      );

      return String(relatedCompany?.assigned_salesperson_id || "") === currentUserId;
    }

    return true;
  }
  const roleVisibleContacts = useMemo(
    () => crmSummary.contacts.filter(contactMatchesRoleVisibility),
    [
      crmSummary.contacts,
      crmSummary.companies,
      roleVisibilityEnabled,
      currentUserId,
      currentUserRole,
    ]
  );

  const filteredContacts = useMemo(() => {
    const search = normalizeForSearch(contactSearchTerm);

    return crmSummary.contacts.filter((contact: any) => {
      const contactTags = allContactTags
        .filter((tag) => tag.contact_id === contact.id)
        .map((tag) => tag.crm_tags)
        .filter((tag): tag is CrmTag => Boolean(tag));

      const contactMarketNames = contactTags
        .filter((tag) => ["market", "markets"].includes(String(tag.tag_type ?? "").toLowerCase().trim()))
        .map((tag) => String(tag.tag_name || "")).filter(Boolean);

      const contactSectorNames = contactTags
        .filter((tag) => ["sector", "sectors", "industry", "industries", "segment", "segments"].includes(String(tag.tag_type ?? "").toLowerCase().trim()))
        .map((tag) => String(tag.tag_name || "")).filter(Boolean);

      const contactCategoryNames = contactTags
        .filter((tag) => ["category", "categories", "workflow", "priority", "status"].includes(String(tag.tag_type ?? "").toLowerCase().trim()))
        .map((tag) => String(tag.tag_name || "")).filter(Boolean);

      const searchableText = [
        contact.full_name,
        contact.first_name,
        contact.last_name,
        contact.title,
        contact.management_level,
        contact.department,
        contact.function_area,
        contact.email,
        contact.direct_phone,
        contact.mobile_phone,
        contact.companies?.company_name,
        ...contactMarketNames,
        ...contactSectorNames,
        ...contactCategoryNames,
      ]
        .map(normalizeForSearch)
        .join(" ");

      const matchesSearch = !search || searchableText.includes(search);
      const matchesContactRoleVisibility = contactMatchesRoleVisibility(contact);

      const matchesMarketTag =
        contactMarketTagFilter === "All" || contactMarketNames.includes(contactMarketTagFilter);
      const matchesSectorTag =
        contactSectorTagFilter === "All" || contactSectorNames.includes(contactSectorTagFilter);
      const matchesCategoryTag =
        contactCategoryTagFilter === "All" ||
        contactCategoryNames.includes(contactCategoryTagFilter);

      const matchesProjectList =
        contactProjectListFilter === "All" ||
        allContactProjectAssignments.some(
          (assignment) =>
            String(assignment.contact_id) === String(contact.id) &&
            String(assignment.project_id) === contactProjectListFilter
        );

      return (matchesSearch &&
        matchesMarketTag &&
        matchesSectorTag &&
        matchesCategoryTag &&
        matchesProjectList &&
        matchesContactRoleVisibility);
    });
    }, [
    crmSummary.contacts,
    crmSummary.companies,
    allContactTags,
    allContactProjectAssignments,
    contactSearchTerm,
    contactMarketTagFilter,
    contactSectorTagFilter,
    contactCategoryTagFilter,
    contactProjectListFilter,
    roleVisibilityEnabled,
    currentUserId,
    currentUserRole,
  ]);
  const companyPrimaryIndustryOptions = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(
          crmSummary.companies
            .map((company) => company.primary_industry)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    ];
    }, [
    crmSummary.contacts,
    crmSummary.companies,
    allContactTags,
    contactSearchTerm,
    contactMarketTagFilter,
    contactSectorTagFilter,
    contactCategoryTagFilter,
    roleVisibilityEnabled,
    currentUserId,
    currentUserRole,
  ]);

  const companyPrimarySubIndustryOptions = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(
          crmSummary.companies
            .map((company) => company.primary_sub_industry)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    ];
    }, [
    crmSummary.contacts,
    crmSummary.companies,
    allContactTags,
    contactSearchTerm,
    contactMarketTagFilter,
    contactSectorTagFilter,
    contactCategoryTagFilter,
    roleVisibilityEnabled,
    currentUserId,
    currentUserRole,
  ]);
  const roleVisibilityNeedsUser =
    roleVisibilityEnabled && currentUserRole !== "admin" && !currentUserId;

  function companyMatchesRoleVisibility(company: CompanySummary) {
    if (!roleVisibilityEnabled) return true;
    if (currentUserRole === "admin") return true;
    if (!currentUserId) return true;

    if (currentUserRole === "sales_manager") {
      return true;
    }

    if (currentUserRole === "sales_rep") {
      return String(company.assigned_salesperson_id || "") === currentUserId;
    }

    return true;
  }
  const filteredCompanies = useMemo(() => {
    const search = normalizeForSearch(companySearchTerm);

    return crmSummary.companies.filter((company) => {
      const prospect = getLatestProspect(company);

      const companyTags = allCompanyTags
        .filter((tag) => tag.company_id === company.id)
        .map((tag) => tag.crm_tags)
        .filter((tag): tag is CrmTag => Boolean(tag));

      const companyMarketNames = companyTags
        .filter((tag) => ["market", "markets"].includes(String(tag.tag_type ?? "").toLowerCase().trim()))
        .map((tag) => String(tag.tag_name || "")).filter(Boolean);

      const companySectorNames = companyTags
        .filter((tag) => ["sector", "sectors", "industry", "industries", "segment", "segments"].includes(String(tag.tag_type ?? "").toLowerCase().trim()))
        .map((tag) => String(tag.tag_name || "")).filter(Boolean);

      const companyCategoryNames = companyTags
        .filter((tag) => ["category", "categories", "workflow", "priority", "status"].includes(String(tag.tag_type ?? "").toLowerCase().trim()))
        .map((tag) => String(tag.tag_name || "")).filter(Boolean);

      const searchableText = [
        company.company_name,
        company.domain,
        company.website,
        company.industry,
        company.city,
        company.state,
        company.status,
        prospect?.priority_tier,
        prospect?.fit_rating,
        prospect?.confidence,
        prospect?.likely_product_path,
        prospect?.next_best_action,
        ...companyMarketNames,
        ...companySectorNames,
        ...companyCategoryNames,
      ]
        .map(normalizeForSearch)
        .join(" ");

      const matchesSearch = !search || searchableText.includes(search);const matchesTier =
        companyTierFilter === "All" || prospect?.priority_tier === companyTierFilter;
      const matchesStatus =
        companyStatusFilter === "All" || (company.status || "new") === companyStatusFilter;
      const matchesProductPath =
        companyProductPathFilter === "All" ||
        prospect?.likely_product_path === companyProductPathFilter;
      const matchesMarketTag =
        companyMarketTagFilter === "All" || companyMarketNames.includes(companyMarketTagFilter);
      const matchesSectorTag =
        companySectorTagFilter === "All" || companySectorNames.includes(companySectorTagFilter);
      const matchesCategoryTag =
        companyCategoryTagFilter === "All" ||
        companyCategoryNames.includes(companyCategoryTagFilter);

      const assignedSalespersonId = String(company.assigned_salesperson_id || "");
      const assignedSalesManagerId = String(company.assigned_sales_manager_id || "");

      const matchesSalespersonCoverage =
        companySalespersonFilter === "All" ||
        (companySalespersonFilter === "Unassigned" && !assignedSalespersonId) ||
        assignedSalespersonId === companySalespersonFilter;

      const matchesSalesManagerCoverage =
        companySalesManagerFilter === "All" ||
        (companySalesManagerFilter === "Unassigned" && !assignedSalesManagerId) ||
        assignedSalesManagerId === companySalesManagerFilter;

      const matchesAssignmentStatus =
        companyAssignmentStatusFilter === "All" ||
        (companyAssignmentStatusFilter === "Unassigned Salesperson" && !assignedSalespersonId) ||
        (companyAssignmentStatusFilter === "Unassigned Sales Manager" && !assignedSalesManagerId) ||
        (companyAssignmentStatusFilter === "Missing Any Coverage" &&
          (!assignedSalespersonId || !assignedSalesManagerId)) ||
        (companyAssignmentStatusFilter === "Fully Assigned" &&
          Boolean(assignedSalespersonId) &&
          Boolean(assignedSalesManagerId));

      const companyAccountTypeLens = getCompanyEffectiveAccountTypeLens(company, companyAccountTypeOverrides);
      const matchesAccountType =
        companyAccountTypeFilter === "All" || companyAccountTypeLens === companyAccountTypeFilter;
const companyBuyerPersonas = getCompanyEffectiveBuyerPersonas(
        companyAccountTypeLens,
        company,
        companyBuyerPersonaOverrides
      );
      const matchesBuyerPersona =
        companyBuyerPersonaFilter === "All" || companyBuyerPersonas.includes(companyBuyerPersonaFilter);

      const companyProjectListIds = allCompanyProjectAssignments
        .filter((assignment) => String(assignment.company_id) === String(company.id))
        .map((assignment) => String(assignment.project_id));

      const matchesProjectList =
        companyProjectListFilter === "All" ||
        companyProjectListIds.includes(companyProjectListFilter);

      return (
        matchesSearch &&
        matchesTier &&
        matchesStatus &&
        matchesProductPath &&
        matchesMarketTag &&
        matchesSectorTag &&
        matchesCategoryTag &&
        matchesSalespersonCoverage &&
        matchesSalesManagerCoverage &&
        matchesAssignmentStatus &&
        matchesAccountType &&
        matchesBuyerPersona &&
        matchesProjectList
      );
    });
  }, [
    crmSummary.companies,
    allCompanyTags,
    allCompanyProjectAssignments,
    companySearchTerm,
    companyTierFilter,
    companyStatusFilter,
    companyProductPathFilter,
    companySalespersonFilter,
    companySalesManagerFilter,
    companyAssignmentStatusFilter,
    
    companyAccountTypeFilter,

    companyBuyerPersonaFilter,
    companyProjectListFilter,
    companyAccountTypeOverrides,
    companyBuyerPersonaOverrides,
    companyMarketTagFilter,
    companySectorTagFilter,
    companyCategoryTagFilter,
  ]);
  function clearCompanyFilters() {
    setCompanySearchTerm("");
    setCompanyTierFilter("All");
    setCompanyStatusFilter("All");
    setCompanyProductPathFilter("All");
    setCompanyOwnerFilter("All");
    setCompanySalespersonFilter("All");
    setCompanySalesManagerFilter("All");
    setCompanyAssignmentStatusFilter("All");
    setCompanyAccountTypeFilter("All");
    setCompanyBuyerPersonaFilter("All");
    setCompanyProjectListFilter("All");
    setCompanyPrimaryIndustryFilter("All");
    setCompanyPrimarySubIndustryFilter("All");
  }

  function clearContactFilters() {
    setContactSearchTerm("");
    setContactMarketTagFilter("All");
    setContactSectorTagFilter("All");
    setContactCategoryTagFilter("All");
    setContactProjectListFilter("All");
  }
  
  useEffect(() => {
    try {
      const savedPreferences = window.localStorage.getItem("graymills-crm-view-preferences");

      if (!savedPreferences) return;

      const preferences = JSON.parse(savedPreferences);

      if (typeof preferences.activeTab === "string") setActiveTab(preferences.activeTab);

      if (typeof preferences.companySearchTerm === "string") setCompanySearchTerm(preferences.companySearchTerm);
      if (typeof preferences.companyTierFilter === "string") setCompanyTierFilter(preferences.companyTierFilter);
      if (typeof preferences.companyStatusFilter === "string") setCompanyStatusFilter(preferences.companyStatusFilter);
      if (typeof preferences.companyProductPathFilter === "string") setCompanyProductPathFilter(preferences.companyProductPathFilter);
      if (typeof preferences.companyOwnerFilter === "string") setCompanyOwnerFilter(preferences.companyOwnerFilter);
      if (typeof preferences.companySalespersonFilter === "string") setCompanySalespersonFilter(preferences.companySalespersonFilter);
      if (typeof preferences.companySalesManagerFilter === "string") setCompanySalesManagerFilter(preferences.companySalesManagerFilter);
      if (typeof preferences.companyAssignmentStatusFilter === "string") setCompanyAssignmentStatusFilter(preferences.companyAssignmentStatusFilter);
      if (typeof preferences.companyAccountTypeFilter === "string") setCompanyAccountTypeFilter(preferences.companyAccountTypeFilter);
      if (typeof preferences.companyBuyerPersonaFilter === "string") setCompanyBuyerPersonaFilter(preferences.companyBuyerPersonaFilter);
      if (typeof preferences.companyProjectListFilter === "string") setCompanyProjectListFilter(preferences.companyProjectListFilter);
      if (typeof preferences.companyPrimaryIndustryFilter === "string") setCompanyPrimaryIndustryFilter(preferences.companyPrimaryIndustryFilter);
      if (typeof preferences.companyPrimarySubIndustryFilter === "string") setCompanyPrimarySubIndustryFilter(preferences.companyPrimarySubIndustryFilter);
      if (typeof preferences.companyMarketTagFilter === "string") setCompanyMarketTagFilter(preferences.companyMarketTagFilter);
      if (typeof preferences.companySectorTagFilter === "string") setCompanySectorTagFilter(preferences.companySectorTagFilter);
      if (typeof preferences.companyCategoryTagFilter === "string") setCompanyCategoryTagFilter(preferences.companyCategoryTagFilter);

      if (typeof preferences.contactSearchTerm === "string") setContactSearchTerm(preferences.contactSearchTerm);
      if (typeof preferences.contactMarketTagFilter === "string") setContactMarketTagFilter(preferences.contactMarketTagFilter);
      if (typeof preferences.contactSectorTagFilter === "string") setContactSectorTagFilter(preferences.contactSectorTagFilter);
      if (typeof preferences.contactCategoryTagFilter === "string") setContactCategoryTagFilter(preferences.contactCategoryTagFilter);
      if (typeof preferences.contactProjectListFilter === "string") setContactProjectListFilter(preferences.contactProjectListFilter);
    } catch {
      // Ignore malformed saved preferences.
    }
  }, []);

  useEffect(() => {
    try {
      const preferences = {
        activeTab,
        companySearchTerm,
        companyTierFilter,
        companyStatusFilter,
        companyProductPathFilter,
        companyOwnerFilter,
        companySalespersonFilter,
        companySalesManagerFilter,
        companyAssignmentStatusFilter,
        companyAccountTypeFilter,
        companyBuyerPersonaFilter,
        companyProjectListFilter,
        companyPrimaryIndustryFilter,
        companyPrimarySubIndustryFilter,
        companyMarketTagFilter,
        companySectorTagFilter,
        companyCategoryTagFilter,
        contactSearchTerm,
        contactMarketTagFilter,
        contactSectorTagFilter,
        contactCategoryTagFilter,
        contactProjectListFilter,
      };

      window.localStorage.setItem("graymills-crm-view-preferences", JSON.stringify(preferences));
    } catch {
      // Ignore local storage issues.
    }
  }, [
    activeTab,
    companySearchTerm,
    companyTierFilter,
    companyStatusFilter,
    companyProductPathFilter,
    companyOwnerFilter,
    companySalespersonFilter,
    companySalesManagerFilter,
    companyAssignmentStatusFilter,
    companyAccountTypeFilter,
    companyBuyerPersonaFilter,
    companyProjectListFilter,
    companyPrimaryIndustryFilter,
    companyPrimarySubIndustryFilter,
    companyMarketTagFilter,
    companySectorTagFilter,
    companyCategoryTagFilter,
    contactSearchTerm,
    contactMarketTagFilter,
    contactSectorTagFilter,
    contactCategoryTagFilter,
    contactProjectListFilter,
  ]);

  function resetSavedViewPreferences() {
    try {
      window.localStorage.removeItem("graymills-crm-view-preferences");
    } catch {
      // Ignore local storage issues.
    }

    setActiveTab("dashboard");

    setCompanySearchTerm("");
    setCompanyTierFilter("All");
    setCompanyStatusFilter("All");
    setCompanyProductPathFilter("All");
    setCompanyOwnerFilter("All");
    setCompanySalespersonFilter("All");
    setCompanySalesManagerFilter("All");
    setCompanyAssignmentStatusFilter("All");
    setCompanyAccountTypeFilter("All");
    setCompanyBuyerPersonaFilter("All");
    setCompanyProjectListFilter("All");
    setCompanyPrimaryIndustryFilter("All");
    setCompanyPrimarySubIndustryFilter("All");
    setCompanyMarketTagFilter("All");
    setCompanySectorTagFilter("All");
    setCompanyCategoryTagFilter("All");

    setContactSearchTerm("");
    setContactMarketTagFilter("All");
    setContactSectorTagFilter("All");
    setContactCategoryTagFilter("All");
    setContactProjectListFilter("All");

    setSelectedCompanyIds([]);
    setBulkAssignedSalespersonId("");
    setBulkAssignedSalesManagerId("");
    setBulkCompanyAssignmentMessage("");
  }

async function loadCompanyOwnerFilterData() {
    try {
      const usersResponse = await fetch("/api/crm-users");
      const usersData = await usersResponse.json();

      if (!usersResponse.ok) {
        throw new Error(usersData.error || "Could not load CRM users.");
      }

      setCompanyOwnerOptions(usersData.users ?? []);
    } catch (error) {
      console.warn("Failed to load CRM users for company coverage filters:", error);
      setCompanyOwnerOptions([]);
    }
  }

  async function loadCrmSummary() {
    setIsLoadingSummary(true);

    try {
      const [summaryResponse, tagsResponse, companyTagsResponse, contactTagsResponse, companyProjectAssignmentsResponse, contactProjectAssignmentsResponse] =
        await Promise.all([
          fetch("/api/crm-summary"),
          fetch("/api/tags"),
          fetch("/api/company-tag-summary"),
          fetch("/api/contact-tag-summary"),
          fetch("/api/company-project-assignment-summary"),
        fetch("/api/contact-project-assignment-summary"),
        ]);

      const summaryData = await summaryResponse.json();
      const tagsData = await tagsResponse.json();
      const companyTagsData = await companyTagsResponse.json();
      const contactTagsData = await contactTagsResponse.json();
      const companyProjectAssignmentsData = await companyProjectAssignmentsResponse.json();
      const contactProjectAssignmentsData = await contactProjectAssignmentsResponse.json();

      if (!summaryResponse.ok) {
        throw new Error(summaryData.error || "Could not load CRM summary.");
      }

      if (!tagsResponse.ok) {
        throw new Error(tagsData.error || "Could not load CRM tags.");
      }

      if (!companyTagsResponse.ok) {
        throw new Error(companyTagsData.error || "Could not load company tags.");
      }

      if (!contactTagsResponse.ok) {
        throw new Error(contactTagsData.error || "Could not load contact tags.");
      }

      if (!companyProjectAssignmentsResponse.ok) {
        throw new Error(
          companyProjectAssignmentsData.error ||
            "Could not load company Project / List assignments."
        );
      }

      if (!contactProjectAssignmentsResponse.ok) {
        throw new Error(
          contactProjectAssignmentsData.error ||
            "Could not load contact Project / List assignments."
        );
      }

      setCrmSummary(summaryData);
      setAllCrmTags(tagsData.tags ?? []);
      setAllCompanyTags(companyTagsData.companyTags ?? []);
      setAllContactTags(contactTagsData.contactTags ?? []);
      setAllCompanyProjectAssignments(
        companyProjectAssignmentsData.companyProjectAssignments ?? []
      );
      setAllContactProjectAssignments(
        contactProjectAssignmentsData.contactProjectAssignments ?? []
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load CRM summary.");
    } finally {
      setIsLoadingSummary(false);
    }
  }

  function getCompanyDetailReturnTab(currentReturnTab: TabKey) {
    return activeTab === "companyDetail" ? currentReturnTab : activeTab;
  }

  function returnFromCompanyDetail() {
    const nextTab = companyDetailReturnTab === "companyDetail" ? "companies" : companyDetailReturnTab;
    setActiveTab(nextTab);
    setCompanyDetailReturnTab("companies");
    setSelectedCompanyDetail(null);
  }

  async function loadCompanyDetail(companyId: string) {
    setCompanyDetailReturnTab(getCompanyDetailReturnTab);
    setIsLoadingCompanyDetail(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/company-detail?id=${companyId}`);
      const data = await readJsonResponse(response, "/api/company-detail");

      if (!response.ok) {
        throw new Error(data.error || "Could not load company detail.");
      }

      setSelectedCompanyDetail(data);
      setActiveTab("companyDetail");

      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: "auto" });
        });
      }
    } catch (error) {
      setSelectedCompanyDetail(null);
      setErrorMessage(error instanceof Error ? error.message : "Could not load company detail.");
    } finally {
      setIsLoadingCompanyDetail(false);
    }
  }

  async function handleCompleteActivity(activityId: string, companyId?: string | null) {
    setIsCompletingActivity(activityId);
    setErrorMessage("");
    setImportMessage("");

    try {
      const response = await fetch("/api/activities", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
        },
        body: JSON.stringify({
          activityId,
          completed: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to complete activity.");
      }

      setImportMessage("Activity marked complete.");
      await loadCrmSummary();

      if (companyId && selectedCompanyDetail?.company?.id === companyId) {
        await loadCompanyDetail(companyId);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to complete activity.");
    } finally {
      setIsCompletingActivity("");
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

    const initialMapping = buildMappingObject(suggestMappings(csvData.headers), csvData.headers);
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
    setManualMapping(
      buildMappingObject(suggestMappings(csvData.headers), csvData.headers)
    );
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
      let importAuthorizationHeader: Record<string, string> = {};

      if (importSelectedProjectListIds.length > 0) {
        const supabase = getBrowserSupabaseClient();
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(
            sessionError.message || "Could not read the signed-in session."
          );
        }

        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          throw new Error(
            "A signed-in Admin session is required for import Project / List assignment."
          );
        }

        importAuthorizationHeader = {
          Authorization: `Bearer ${accessToken}`,
        };
      }

      const response = await fetch("/api/import-zoominfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
          ...importAuthorizationHeader,
        },
        body: JSON.stringify({
          fileName: csvData.fileName,
          headers: csvData.headers,
          rows: csvData.rows,
          mapping: activeMapping,
          selectedMarketTagIds: importMarketTagIds,
          selectedSectorTagIds: importSectorTagIds,
          selectedCategoryTagIds: importCategoryTagIds,
          selectedImportTagIds: [
            ...importMarketTagIds,
            ...importSectorTagIds,
            ...importCategoryTagIds,
          ],
          assignedSalespersonId: importAssignedSalespersonId,
          assignedSalesManagerId: importAssignedSalesManagerId,
          selectedProjectListIds: importSelectedProjectListIds,
        }),
      });

      const data = (await response.json()) as ImportResult & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Import failed.");
      }

      const assignedSalespersonName = importAssignmentUserName(data.assignedSalespersonId);
      const assignedSalesManagerName = importAssignmentUserName(data.assignedSalesManagerId);

      const assignmentSummary =
        data.companiesAssigned && data.companiesAssigned > 0
          ? ` Sales coverage assigned to ${data.companiesAssigned} companies. Salesperson / Rep: ${assignedSalespersonName}. Sales Manager: ${assignedSalesManagerName}.`
          : "";

      const projectListAssignmentSummary =
        data.projectListCompanyAssignments || data.projectListContactAssignments
          ? ` Project / List assignments applied: ${data.projectListCompanyAssignments ?? 0} company memberships and ${data.projectListContactAssignments ?? 0} contact memberships.`
          : "";

      setImportMessage(
        `Import ${data.status}: ${data.processedCount} processed, ${data.duplicateCount} possible duplicates/reused companies, ${data.errorCount} row errors.${assignmentSummary}${projectListAssignmentSummary}`
      );

      await loadCrmSummary();
      setActiveTab("import");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  }

async function handleAnalyzeProspect() {
  if (!selectedCompanyDetail?.company?.id) return;

  const companyId = String(selectedCompanyDetail.company.id);

  setIsAnalyzingProspect(true);
  setErrorMessage("");
  setImportMessage("");

  try {
    const response = await fetch("/api/analyze-prospect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...apiPermissionHeaders(),
      },
      body: JSON.stringify({
        companyId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to analyze prospect.");
    }

    setImportMessage("Prospect analysis completed and saved.");
    await loadCrmSummary();
    await loadCompanyDetail(companyId);
  } catch (error) {
    setErrorMessage(error instanceof Error ? error.message : "Failed to analyze prospect.");
  } finally {
    setIsAnalyzingProspect(false);
  }
}

  async function handleSaveActivity() {
    if (!selectedCompanyDetail?.company?.id) return;

    setIsSavingActivity(true);
    setErrorMessage("");
    setImportMessage("");

    try {
      if (!activityForm.subject.trim() && !activityForm.notes.trim()) {
        throw new Error("Enter a subject or note before saving.");
      }


      if (!hasBrowserSupabaseConfig()) {
        throw new Error("Browser Supabase configuration is not available.");
      }

      const supabase = getBrowserSupabaseClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message || "Could not read the signed-in session.");
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("A signed-in Supabase session is required.");
      }

      const primaryProspect = selectedCompanyDetail.primaryProspect;

      const response = await fetch("/api/activities", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: selectedCompanyDetail.company.id,
          primaryContactId: activityForm.primaryContactId || null,
          relatedContactIds: activityForm.relatedContactIds,
          prospectId: primaryProspect?.id ?? null,
          activityType: activityForm.activityType,
          subject: activityForm.subject,
          notes: activityForm.notes,
          dueDate: activityForm.dueDate || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save activity.");
      }

      setImportMessage("Activity saved.");

      setActivityForm({
        activityType: "note",
        subject: "",
        notes: "",
        dueDate: "",
        primaryContactId: "",
        relatedContactIds: [],
      });

      await loadCompanyDetail(String(selectedCompanyDetail.company.id));
      await loadCrmSummary();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save activity.");
    } finally {
      setIsSavingActivity(false);
    }
  }

  async function handleUpdateActivity(activityId: string, form: ActivityForm) {
    if (!selectedCompanyDetail?.company?.id) return false;

    setIsSavingActivity(true);
    setErrorMessage("");
    setImportMessage("");

    try {
      if (!form.subject.trim() && !form.notes.trim()) {
        throw new Error("Enter a subject or note before saving.");
      }

      const response = await fetch("/api/activities", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
        },
        body: JSON.stringify({
          activityId,
          activityType: form.activityType,
          subject: form.subject,
          notes: form.notes,
          dueDate: form.dueDate || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update activity.");
      }

      setImportMessage("Activity updated.");
      await loadCompanyDetail(String(selectedCompanyDetail.company.id));
      await loadCrmSummary();

      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update activity.");
      return false;
    } finally {
      setIsSavingActivity(false);
    }
  }

  const [isMainNavSigningOut, setIsMainNavSigningOut] = useState(false);

  async function handleMainNavigationSignOut() {
    setIsMainNavSigningOut(true);
    setErrorMessage("");

    try {
      if (!hasBrowserSupabaseConfig()) {
        setErrorMessage(
          "Browser Supabase configuration is not available in this environment."
        );
        return;
      }

      const supabase = getBrowserSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage(error.message || "Could not sign out.");
        return;
      }

      window.location.reload();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not sign out."
      );
    } finally {
      setIsMainNavSigningOut(false);
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "companies", label: "Companies" },
    { key: "contacts", label: "Contacts" },
    { key: "funnel", label: "Funnel" },
    { key: "import", label: "Import ZoomInfo" },
    { key: "admin", label: "Admin" },
    { key: "help", label: "Help" },
    { key: "releaseNotes", label: "Release Notes" },
  ];

  function apiPermissionHeaders() {
    return {
      "x-crm-user-id": String(currentUserId || ""),
      "x-crm-user-role": String(currentUserRole || "sales_rep"),
      "x-crm-user-name": String(currentUserDisplayName || "Signed-in CRM user"),
    };
  }
  function clearImportAssignments() {
    setImportAssignedSalespersonId("");
    setImportAssignedSalesManagerId("");
    setImportSelectedProjectListIds([]);
  }
  function importAssignmentUserName(userId?: string | null) {
    if (!userId) return "Not selected";
    const user = roleTestUsers.find((candidate) => candidate.id === userId);
    return user?.display_name || user?.email || userId;
  }

  async function loadImportProjectLists() {
    setIsLoadingImportProjectLists(true);
    setImportProjectListError("");

    try {
      const response = await fetch("/api/projects-lists");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load Projects / Lists.");
      }

      setImportProjectListOptions(
        Array.isArray(data.projectsLists)
          ? data.projectsLists.filter((item: any) => item.status === "active")
          : []
      );
    } catch (error) {
      setImportProjectListOptions([]);
      setImportProjectListError(
        error instanceof Error
          ? error.message
          : "Could not load Projects / Lists."
      );
    } finally {
      setIsLoadingImportProjectLists(false);
    }
  }

  useEffect(() => {
    if (activeTab === "import") {
      loadImportProjectLists();
    }
  }, [activeTab]);

  async function handleBulkCompanyAssignment() {
    if (!currentPermissions.canAssignSalesCoverage) {
      setBulkCompanyAssignmentMessage("Your current role cannot assign sales coverage.");
      return;
    }

    if (selectedCompanyIds.length === 0) {
      setBulkCompanyAssignmentMessage("Select at least one company before applying bulk assignment.");
      return;
    }

    if (!bulkAssignedSalespersonId && !bulkAssignedSalesManagerId) {
      setBulkCompanyAssignmentMessage("Select a salesperson and/or sales manager before applying bulk assignment.");
      return;
    }

    setIsBulkAssigningCompanies(true);
    setBulkCompanyAssignmentMessage("");

    try {
      const payload: Record<string, unknown> = {
        companyIds: selectedCompanyIds,
      };

      if (bulkAssignedSalespersonId) {
        payload.assignedSalespersonId = bulkAssignedSalespersonId;
      }

      if (bulkAssignedSalesManagerId) {
        payload.assignedSalesManagerId = bulkAssignedSalesManagerId;
      }

      const response = await fetch("/api/company-sales-assignments", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Bulk company assignment failed.");
      }

      const updatedAssignments = Array.isArray(data.companyAssignments)
        ? data.companyAssignments
        : [];

      setCrmSummary((previous: any) => ({
        ...previous,
        companies: previous.companies.map((company: any) => {
          const updatedAssignment = updatedAssignments.find(
            (assignment: any) => String(assignment.id) === String(company.id)
          );

          return updatedAssignment
            ? {
                ...company,
                assigned_salesperson_id: updatedAssignment.assigned_salesperson_id,
                assigned_sales_manager_id: updatedAssignment.assigned_sales_manager_id,
              }
            : company;
        }),
      }));

      setBulkCompanyAssignmentMessage(
        `Bulk assignment updated ${data.updatedCount ?? selectedCompanyIds.length} companies.`
      );
      setSelectedCompanyIds([]);
    } catch (error) {
      setBulkCompanyAssignmentMessage(
        error instanceof Error ? error.message : "Bulk company assignment failed."
      );
    } finally {
      setIsBulkAssigningCompanies(false);
    }
  }
  async function loadRoleTestUsers() {
    setIsLoadingRoleUsers(true);
    setRoleUserError("");

    try {
      const response = await fetch("/api/crm-users");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load CRM users.");
      }

      const activeUsers = (data.users ?? []).filter((user: CrmUser) => {
        return !user.status || user.status === "active";
      });

      setRoleTestUsers(activeUsers);
    } catch (error) {
      setRoleUserError(error instanceof Error ? error.message : "Could not load CRM users.");
    } finally {
      setIsLoadingRoleUsers(false);
    }
  }

  useEffect(() => {
    loadRoleTestUsers();
  }, []);

  function activityRecordMatchesRoleVisibility(activity: ActivityRecord) {
    if (!roleVisibilityEnabled) return true;
    if (currentUserRole === "admin") return true;
    if (currentUserRole === "sales_manager") return true;
    if (!currentUserId) return true;

    if (currentUserRole === "sales_rep") {
      const relatedCompany = crmSummary.companies.find(
        (company) => String(company.id || company.company_id || "") === String(activity.company_id || "")
      );

      return String(relatedCompany?.assigned_salesperson_id || "") === currentUserId;
    }

    return true;
  }

  const roleVisibleOverdueActivities = crmSummary.activities.overdue.filter(activityRecordMatchesRoleVisibility);
  const roleVisibleDueTodayActivities = crmSummary.activities.dueToday.filter(activityRecordMatchesRoleVisibility);
  const roleVisibleOpenActivities = crmSummary.activities.open.filter(activityRecordMatchesRoleVisibility);
  const displayedCompanies = filteredCompanies;
  const visibleCompanyCount = displayedCompanies.length;
  const totalCompanyCount = crmSummary.companies.length;
  const visibleContactCount = filteredContacts.length;
  const totalContactCount = crmSummary.contacts.length;
  const visibleOpenFollowUpCount = roleVisibleOpenActivities.length;
  const totalOpenFollowUpCount = crmSummary.activities.open.length;
  const visibleDueTodayFollowUpCount = roleVisibleDueTodayActivities.length;
  const totalDueTodayFollowUpCount = crmSummary.activities.dueToday.length;
  const visibleOverdueFollowUpCount = roleVisibleOverdueActivities.length;
  const totalOverdueFollowUpCount = crmSummary.activities.overdue.length;
  const assignedSalespersonCompanyCount = crmSummary.companies.filter((company) =>
    Boolean(company.assigned_salesperson_id)
  ).length;
  const unassignedSalespersonCompanyCount = crmSummary.companies.filter(
    (company) => !company.assigned_salesperson_id
  ).length;
  const currentUserAssignedCompanyCount = currentUserId
    ? crmSummary.companies.filter((company) => {
        if (currentUserRole === "sales_manager") {
          return String(company.assigned_sales_manager_id || "") === currentUserId;
        }

        if (currentUserRole === "sales_rep") {
          return String(company.assigned_salesperson_id || "") === currentUserId;
        }

        return (
          String(company.assigned_salesperson_id || "") === currentUserId ||
          String(company.assigned_sales_manager_id || "") === currentUserId
        );
      }).length
    : 0;
  const activeCoverageUserIds = new Set(
    roleTestUsers
      .filter((user) => !user.status || user.status === "active")
      .map((user) => String(user.id))
  );

  const assignedCoverageUserIds = Array.from(
    new Set(
      crmSummary.companies
        .flatMap((company) => [
          company.assigned_salesperson_id,
          company.assigned_sales_manager_id,
        ])
        .filter((userId): userId is string => Boolean(userId))
        .map((userId) => String(userId))
    )
  );

  const inactiveCoverageUserIds = assignedCoverageUserIds.filter(
    (userId) => !activeCoverageUserIds.has(userId)
  );

  const inactiveCoverageCompanyCount = crmSummary.companies.filter((company) => {
    return (
      Boolean(company.assigned_salesperson_id) &&
        !activeCoverageUserIds.has(String(company.assigned_salesperson_id))
    ) || (
      Boolean(company.assigned_sales_manager_id) &&
        !activeCoverageUserIds.has(String(company.assigned_sales_manager_id))
    );
  }).length;

  const inactiveCoverageUserDisplayNames = inactiveCoverageUserIds
    .map((userId) => {
      const matchedUser = roleTestUsers.find((user) => String(user.id) === String(userId));
      return matchedUser?.display_name || matchedUser?.email || userId;
    })
    .join(", ");

  const unassignedSalespersonCompanySamples = crmSummary.companies
    .filter((company) => !company.assigned_salesperson_id)
    .map((company) => ({
      id: company.id,
      name: company.company_name || "Unnamed company",
    }));

  const currentUserCoverageCompanySamples = currentUserId
    ? crmSummary.companies
        .filter((company) => {
          if (currentUserRole === "sales_manager") {
            return String(company.assigned_sales_manager_id || "") === currentUserId;
          }

          if (currentUserRole === "sales_rep") {
            return String(company.assigned_salesperson_id || "") === currentUserId;
          }

          return (
            String(company.assigned_salesperson_id || "") === currentUserId ||
            String(company.assigned_sales_manager_id || "") === currentUserId
          );
        })
        .map((company) => ({
          id: company.id,
          name: company.company_name || "Unnamed company",
        }))
    : [];

  const inactiveCoverageCompanySamples = crmSummary.companies
    .filter((company) => {
      return (
        Boolean(company.assigned_salesperson_id) &&
          !activeCoverageUserIds.has(String(company.assigned_salesperson_id))
      ) || (
        Boolean(company.assigned_sales_manager_id) &&
          !activeCoverageUserIds.has(String(company.assigned_sales_manager_id))
      );
    })
    .map((company) => ({
      id: company.id,
      name: company.company_name || "Unnamed company",
    }));
  const diagnosticsCompanySearchTerm = diagnosticsCompanySearch.trim().toLowerCase();

  function matchesDiagnosticsCompanySearch(company: { name: string }) {
    if (!diagnosticsCompanySearchTerm) return true;
    return company.name.toLowerCase().includes(diagnosticsCompanySearchTerm);
  }

  const filteredUnassignedSalespersonCompanySamples = unassignedSalespersonCompanySamples.filter(
    matchesDiagnosticsCompanySearch
  );
  const filteredCurrentUserCoverageCompanySamples = currentUserCoverageCompanySamples.filter(
    matchesDiagnosticsCompanySearch
  );
  const filteredInactiveCoverageCompanySamples = inactiveCoverageCompanySamples.filter(
    matchesDiagnosticsCompanySearch
  );
  return (
    <LoginRequiredCrmShellGate>
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <header className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                Graymills Prospecting Tool
              </p>
              <img
                src="/graymills-logo.jpg"
                alt="Graymills"
                className="mt-4 max-h-14 w-auto max-w-[190px] object-contain"
              />
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm">
              <p className="font-semibold text-blue-900">{APP_VERSION}</p>
              <p className="mt-1 text-blue-700">{REVISION_NOTE}</p>
            </div>
            <button
              type="button"
              onClick={resetSavedViewPreferences}
              className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Reset saved view preferences
            </button>
          </div>
        </header>

        

        <nav aria-label="Primary CRM navigation" className="sticky top-2 z-40 flex flex-nowrap gap-2 overflow-x-auto rounded-2xl border border-slate-300 bg-slate-100/95 p-2 shadow-md backdrop-blur supports-[backdrop-filter]:bg-slate-100/85">
          {tabs
              .filter((tab) => {
                if (tab.key === "admin") return navigationRole === "admin";
                if (tab.key === "import") {
                  return navigationRole === "admin" || navigationRole === "sales_manager";
                }
                return true;
              })
              .map((tab) => (
            <button
              type="button"
              key={tab.key}
              aria-current={activeTab === tab.key ? "page" : undefined}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                activeTab === tab.key
                  ? "bg-blue-700 text-white shadow-md ring-2 ring-blue-200"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-blue-50 hover:text-blue-800"
              }`}
            >
              {tab.label}
            </button>
          ))}

          <button
            type="button"
            onClick={loadCrmSummary}
            disabled={isLoadingSummary}
            aria-busy={isLoadingSummary}
            className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:text-slate-400"
          >
            {isLoadingSummary ? "Refreshing CRM..." : "Refresh CRM"}
          </button>

          <button
            type="button"
            onClick={handleMainNavigationSignOut}
            disabled={isMainNavSigningOut}
            aria-busy={isMainNavSigningOut}
            className="shrink-0 whitespace-nowrap rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isMainNavSigningOut ? "Signing Out..." : "Sign Out"}
          </button>
        </nav>


        {productionRoleEnforcementEnabled && (
          <section className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-green-700">
                  Production Role Enforcement
                </p>
                <h2 className="mt-1 text-lg font-bold text-green-950">
                  Signed-in CRM user is controlling UI permissions
                </h2>
                <p className="mt-1 text-sm leading-6 text-green-900">
                  Current user: <span className="font-semibold">{currentUserDisplayName}</span>
                  {" "}· Role: <span className="font-semibold">{formatAppUserRole(currentUserRole)}</span>
                  {" "}· Status: <span className="font-semibold">{signedInProductionUser.status || "Not detected"}</span>
                </p>
                <p className="mt-1 text-xs leading-5 text-green-800">
                  {signedInProductionUser.message}
                </p>
              </div>

              <div className="rounded-xl bg-white p-3 text-sm text-green-950 ring-1 ring-green-100 md:max-w-xl">
                <p className="font-bold">Signed-in permissions are active</p>
                <p className="mt-1 leading-5">
                  Navigation, record visibility, administrative controls, imports, and protected API actions follow the matched CRM user role.
                </p>
              </div>
            </div>
          </section>
        )}




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

        

        {activeTab === "dashboard" && (
          <section className="grid max-w-full gap-6 overflow-hidden">
            <MySalesWorkspaceSection onOpenCompany={loadCompanyDetail} />

            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard
                label="Companies in CRM"
                value={crmSummary.companies.length.toString()}
                note={`${displayedCompanies.length} shown after filters`}
              />
              <MetricCard
                label="Open follow-ups"
                value={crmSummary.activities.open.length.toString()}
                note="Incomplete activities"
              />
              <MetricCard
                label="Due today"
                value={crmSummary.activities.dueToday.length.toString()}
                note="Incomplete and due today"
              />
              <MetricCard
                label="Overdue"
                value={crmSummary.activities.overdue.length.toString()}
                note="Incomplete and past due"
              />
            </div>

            <FollowUpDashboard
              title="Overdue Follow-Ups"
              activities={roleVisibleOverdueActivities}
              emptyText="No overdue follow-ups."
              emphasis="overdue"
              onOpenCompany={loadCompanyDetail}
              onCompleteActivity={handleCompleteActivity}
              completingActivityId={isCompletingActivity}
            />

            <FollowUpDashboard
              title="Due Today"
              activities={roleVisibleDueTodayActivities}
              emptyText="No follow-ups due today."
              emphasis="today"
              onOpenCompany={loadCompanyDetail}
              onCompleteActivity={handleCompleteActivity}
              completingActivityId={isCompletingActivity}
            />

            <FollowUpDashboard
              title="All Open Follow-Ups"
              activities={roleVisibleOpenActivities}
              emptyText="No open follow-ups."
              emphasis="open"
              onOpenCompany={loadCompanyDetail}
              onCompleteActivity={handleCompleteActivity}
              completingActivityId={isCompletingActivity}
            />

            <RecentImports imports={crmSummary.imports} />
          </section>
        )}

        {activeTab === "companies" && (
          <CompaniesSection
            companies={displayedCompanies}
            totalCompanyCount={crmSummary.companies.length}
            companySearchTerm={companySearchTerm}
            setCompanySearchTerm={setCompanySearchTerm}
            companyTierFilter={companyTierFilter}
            setCompanyTierFilter={setCompanyTierFilter}
            companyTierOptions={companyTierOptions}
            companyStatusFilter={companyStatusFilter}
            setCompanyStatusFilter={setCompanyStatusFilter}
            companyStatusOptions={companyStatusOptions}
            companyProductPathFilter={companyProductPathFilter}
            setCompanyProductPathFilter={setCompanyProductPathFilter}
            companyProductPathOptions={companyProductPathOptions}
            
            companyOwnerFilter={companyOwnerFilter}
            setCompanyOwnerFilter={setCompanyOwnerFilter}
            companyOwnerOptions={companyOwnerOptions}
            companySalespersonFilter={companySalespersonFilter}
            setCompanySalespersonFilter={setCompanySalespersonFilter}
            companySalesManagerFilter={companySalesManagerFilter}
            setCompanySalesManagerFilter={setCompanySalesManagerFilter}
            companyAssignmentStatusFilter={companyAssignmentStatusFilter}
            setCompanyAssignmentStatusFilter={setCompanyAssignmentStatusFilter}
            companyAccountTypeFilter={companyAccountTypeFilter}
            setCompanyAccountTypeFilter={setCompanyAccountTypeFilter}
            companyBuyerPersonaFilter={companyBuyerPersonaFilter}
            setCompanyBuyerPersonaFilter={setCompanyBuyerPersonaFilter}
            companyProjectListFilter={companyProjectListFilter}
            setCompanyProjectListFilter={setCompanyProjectListFilter}
            companyProjectListOptions={Array.from(
              new Map(
                allCompanyProjectAssignments
                  .filter((assignment) => assignment.crm_projects)
                  .map((assignment) => [
                    String(assignment.project_id),
                    assignment.crm_projects,
                  ])
              ).values()
            )}
            companyAccountTypeOverrides={companyAccountTypeOverrides}
            setCompanyAccountTypeOverrides={setCompanyAccountTypeOverrides}
            apiPermissionHeaders={apiPermissionHeaders}
            companyBuyerPersonaOverrides={companyBuyerPersonaOverrides}
            setCompanyBuyerPersonaOverrides={setCompanyBuyerPersonaOverrides}
            assignmentUserOptions={roleTestUsers}
            companyPrimaryIndustryFilter={companyPrimaryIndustryFilter}
            setCompanyPrimaryIndustryFilter={setCompanyPrimaryIndustryFilter}
            companyPrimaryIndustryOptions={companyPrimaryIndustryOptions}
            companyPrimarySubIndustryFilter={companyPrimarySubIndustryFilter}
            setCompanyPrimarySubIndustryFilter={setCompanyPrimarySubIndustryFilter}
            companyPrimarySubIndustryOptions={companyPrimarySubIndustryOptions}
            clearCompanyFilters={clearCompanyFilters}
            canAssignSalesCoverage={currentPermissions.canAssignSalesCoverage}
            selectedCompanyIds={selectedCompanyIds}
            setSelectedCompanyIds={setSelectedCompanyIds}
            bulkAssignedSalespersonId={bulkAssignedSalespersonId}
            setBulkAssignedSalespersonId={setBulkAssignedSalespersonId}
            bulkAssignedSalesManagerId={bulkAssignedSalesManagerId}
            setBulkAssignedSalesManagerId={setBulkAssignedSalesManagerId}
            isBulkAssigningCompanies={isBulkAssigningCompanies}
            bulkCompanyAssignmentMessage={bulkCompanyAssignmentMessage}
            onApplyBulkCompanyAssignment={handleBulkCompanyAssignment}
            onOpenCompany={loadCompanyDetail}
            isLoadingCompanyDetail={isLoadingCompanyDetail}
          />
        )}

        {activeTab === "contacts" && (
          <section className="grid max-w-full gap-6 overflow-hidden">
            <ContactTagFilterPanel
              contactSearchTerm={contactSearchTerm}
              setContactSearchTerm={setContactSearchTerm}
              contactMarketTagFilter={contactMarketTagFilter}
              setContactMarketTagFilter={setContactMarketTagFilter}
              contactMarketTagOptions={contactMarketTagOptions}
              contactSectorTagFilter={contactSectorTagFilter}
              setContactSectorTagFilter={setContactSectorTagFilter}
              contactSectorTagOptions={contactSectorTagOptions}
              contactCategoryTagFilter={contactCategoryTagFilter}
              setContactCategoryTagFilter={setContactCategoryTagFilter}
              contactCategoryTagOptions={contactCategoryTagOptions}
              contactProjectListFilter={contactProjectListFilter}
              setContactProjectListFilter={setContactProjectListFilter}
              contactProjectListOptions={Array.from(
                new Map(
                  allContactProjectAssignments
                    .filter((assignment) => assignment.crm_projects)
                    .map((assignment) => [
                      String(assignment.project_id),
                      assignment.crm_projects,
                    ])
                ).values()
              )}
              filteredContactCount={filteredContacts.length}
              totalVisibleContactCount={roleVisibleContacts.length}
              clearContactFilters={clearContactFilters}
            />

            <ContactsSection
              contacts={filteredContacts}
              totalContactCount={crmSummary.contacts.length}
            />
          </section>
        )}

        {activeTab === "funnel" && (
          <FunnelDashboardSection
            funnelApplyRoleVisibility={roleVisibilityEnabled}
            funnelCurrentUserId={currentUserId}
            funnelCurrentUserRole={currentUserRole}
            funnelCurrentUserDisplayName={currentUserDisplayName}
            onOpenCompany={(companyId) => {
              loadCompanyDetail(companyId);

              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          />
        )}

        {activeTab === "companyDetail" && (
          <CompanyDetailSection
            detail={selectedCompanyDetail}
            activityForm={activityForm}
            setActivityForm={setActivityForm}
            isSavingActivity={isSavingActivity}
            isCompletingActivity={isCompletingActivity}
            isAnalyzingProspect={isAnalyzingProspect}
            onSaveActivity={handleSaveActivity}
            onUpdateActivity={handleUpdateActivity}
            onCompleteActivity={handleCompleteActivity}
            onAnalyzeProspect={handleAnalyzeProspect}
            onRefreshCompanyDetail={loadCompanyDetail}
            isRefreshingCompanyDetail={isLoadingCompanyDetail}
            onBack={returnFromCompanyDetail}
            salesCoverageCanEdit={
              currentPermissions.canAssignSalesCoverage ||
              String(currentUserRole).toLowerCase() === "admin" ||
              String(currentUserRole).toLowerCase() === "sales_manager" ||
              String(signedInProductionUser.role).toLowerCase() === "admin" ||
              String(signedInProductionUser.role).toLowerCase() === "sales_manager"
            }
            apiPermissionHeaders={apiPermissionHeaders}
            canMoveOpportunityStages={currentPermissions.canMoveOpportunityStages}
            canManageProjectsLists={currentPermissions.canManageAdminSettings}
          />
        )}

        {activeTab === "admin" && (
          <section className="grid max-w-full gap-6 overflow-hidden">
            <UserRolePermissionsReference />
            <AdminUsersSection
              canManageAdminUsers={currentPermissions.canManageAdminSettings}
              apiPermissionHeaders={apiPermissionHeaders}
            />
            <AdminProjectsListsSection
              canManageProjectsLists={currentPermissions.canManageAdminSettings}
            />
            <AdminWorkflowAutomationRulesSection
              canManageWorkflowAutomations={currentPermissions.canManageAdminSettings}
            />
            <AdminFunnelStagesSection
              canManageFunnelStages={currentPermissions.canManageFunnelStages}
              apiPermissionHeaders={apiPermissionHeaders}
            />
            <AdminBuyerPersonaDefinitionsSection
              canManageBuyerPersonas={currentPermissions.canManageAdminSettings}
              apiPermissionHeaders={apiPermissionHeaders}
            />
            <AdminTagsSection
              canManageTags={currentPermissions.canManageAdminSettings}
              apiPermissionHeaders={apiPermissionHeaders}
            />
          </section>
        )}



        {activeTab === "help" && <HelpSection />}

        {activeTab === "releaseNotes" && <ReleaseNotesSection />}

        {activeTab === "import" && (
          <section className="grid max-w-full gap-6 overflow-hidden">
            <ImportTagAssignmentPanel
              resetKey={importTagPanelResetKey}
              selectedMarketTagIds={importMarketTagIds}
              setSelectedMarketTagIds={setImportMarketTagIds}
              selectedSectorTagIds={importSectorTagIds}
              setSelectedSectorTagIds={setImportSectorTagIds}
              selectedCategoryTagIds={importCategoryTagIds}
              setSelectedCategoryTagIds={setImportCategoryTagIds}
            />
            <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-xl font-bold">Import ZoomInfo CSV</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">
                    Upload a ZoomInfo CSV, review and adjust field mapping, then save the
                    data into the Graymills CRM.
                  </p>
                </div>

                <div className="max-w-full overflow-hidden rounded-2xl border border-blue-200 bg-blue-50 p-5">
                  <h3 className="text-lg font-bold text-blue-950">Import Sales Coverage Assignment</h3>
                  <p className="mt-2 text-sm leading-6 text-blue-900">
                    Optional: assign every company created or reused from this import to a Salesperson / Rep and Sales Manager.
                  </p>

                  <div className="mt-5 grid max-w-full gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-semibold text-slate-700">Salesperson / Rep</label>
                      <select
                        value={importAssignedSalespersonId}
                        onChange={(event) => setImportAssignedSalespersonId(event.target.value)}
                        className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">Do not change / leave unassigned</option>
                        {roleTestUsers
                          .filter((user) => user.status === "active")
                          .map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.display_name || user.email || user.id}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-700">Sales Manager</label>
                      <select
                        value={importAssignedSalesManagerId}
                        onChange={(event) => setImportAssignedSalesManagerId(event.target.value)}
                        className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">Do not change / leave unassigned</option>
                        {roleTestUsers
                          .filter((user) => user.status === "active" && (user.user_role === "sales_manager" || user.user_role === "admin"))
                          .map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.display_name || user.email || user.id}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {(importAssignedSalespersonId || importAssignedSalesManagerId) && (
                    <div className="mt-4 rounded-xl border border-blue-300 bg-white p-3 text-sm text-blue-900">
                      <p className="font-semibold">
                        Import assignment is active. Imported/reused companies will be updated with the selected sales coverage.
                      </p>
                      <p className="mt-1 text-xs text-blue-800">
                        Selections stay in place after import so you can process another file for the same coverage team.
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={clearImportAssignments}
                      disabled={!importAssignedSalespersonId && !importAssignedSalesManagerId}
                      className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:text-slate-400"
                    >
                      Clear import assignment
                    </button>
                  </div>
                </div>

                <div className="max-w-full overflow-hidden rounded-2xl border border-violet-200 bg-violet-50 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-violet-950">
                        Import Project / List Assignment
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-violet-900">
                        Admin only: add every company and contact created or reused by this import to one or more active Projects / Lists.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={loadImportProjectLists}
                      disabled={isLoadingImportProjectLists}
                      className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-violet-800 shadow-sm ring-1 ring-violet-200 hover:bg-violet-100 disabled:text-slate-400"
                    >
                      {isLoadingImportProjectLists
                        ? "Refreshing..."
                        : "Refresh Projects / Lists"}
                    </button>
                  </div>

                  {importProjectListError && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      {importProjectListError}
                    </div>
                  )}

                  {currentPermissions.canManageAdminSettings ? (
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {importProjectListOptions.length === 0 ? (
                        <p className="text-sm text-violet-800">
                          No active Projects / Lists are available.
                        </p>
                      ) : (
                        importProjectListOptions.map((item: any) => {
                          const itemId = String(item.id || "");
                          const isSelected = importSelectedProjectListIds.includes(itemId);

                          return (
                            <label
                              key={itemId}
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${
                                isSelected
                                  ? "border-violet-400 bg-white text-violet-950"
                                  : "border-violet-200 bg-violet-100/60 text-violet-900 hover:bg-white"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setImportSelectedProjectListIds((current) =>
                                    isSelected
                                      ? current.filter((id) => id !== itemId)
                                      : [...current, itemId]
                                  );
                                }}
                                className="mt-1 h-4 w-4 rounded border-violet-300 text-violet-700 focus:ring-violet-600"
                              />

                              <span>
                                <span className="font-semibold">
                                  {item.project_kind === "list" ? "List" : "Project"}:{" "}
                                  {item.project_name}
                                </span>
                                {item.description && (
                                  <span className="mt-1 block text-xs leading-5 text-violet-700">
                                    {item.description}
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                      Project / List assignment during import is restricted to CRM Admin users.
                    </p>
                  )}

                  {importSelectedProjectListIds.length > 0 && (
                    <div className="mt-4 rounded-xl border border-violet-300 bg-white p-3 text-sm text-violet-900">
                      <p className="font-semibold">
                        {importSelectedProjectListIds.length} Project / List assignment
                        {importSelectedProjectListIds.length === 1 ? "" : "s"} selected.
                      </p>
                      <p className="mt-1 text-xs text-violet-700">
                        These memberships will be applied to every imported or reused company and contact.
                      </p>
                    </div>
                  )}
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
                    className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:text-slate-400"
                  >
                    Reset Mapping
                  </button>

                  <button
                    onClick={handleImportToCrm}
                    disabled={!csvData || isImporting || !isReadyToImport}
                    className="inline-flex items-center justify-center rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:bg-slate-300"
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

                <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold">Import Review</h3>
                  <div className="mt-4 grid max-w-full gap-4 md:grid-cols-3">
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
<div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold">Manual CRM Field Mapping</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Review each CRM field and choose the correct ZoomInfo CSV column. Use

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

                <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold">First 10 Rows Preview</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Confirm the CSV is being read correctly before saving records into Supabase.
                  </p>

                  <div className="mt-4 max-w-full overflow-x-auto">
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
                                {row[header] || "-"}
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
  
    </LoginRequiredCrmShellGate>);
}

function readSelectedImportTagIds() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem("prospectingTool.selectedImportTagIds");
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
}
function ImportResultsVisibilityPanel({
  importMessage,
  errorMessage,
  results,
}: {
  importMessage: string;
  errorMessage: string;
  results: any | null;
}) {
  if (!importMessage && !errorMessage && !results) return null;

  const report = results?.report;

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Latest Import Status
        </p>

        {importMessage && (
          <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
            {importMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {errorMessage}
          </div>
        )}
      </div>

      {results && (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-900">Companies Created</p>
            <p className="mt-2 text-3xl font-bold text-green-950">
              {results.companiesCreated ?? report?.companiesCreated?.length ?? 0}
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">Companies Reused</p>
            <p className="mt-2 text-3xl font-bold text-blue-950">
              {results.duplicateCompanies ?? report?.companiesReused?.length ?? 0}
            </p>
          </div>

          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <p className="text-sm font-semibold text-purple-900">Companies Enriched</p>
            <p className="mt-2 text-3xl font-bold text-purple-950">
              {results.companiesEnriched ?? report?.companiesEnriched?.length ?? 0}
            </p>
          </div>

          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-900">Contacts Created</p>
            <p className="mt-2 text-3xl font-bold text-green-950">
              {results.contactsCreated ?? report?.contactsCreated?.length ?? 0}
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">Contacts Reused</p>
            <p className="mt-2 text-3xl font-bold text-blue-950">
              {results.duplicateContacts ?? report?.contactsReused?.length ?? 0}
            </p>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900">Errors</p>
            <p className="mt-2 text-3xl font-bold text-red-950">
              {results.errors?.length ?? report?.rowErrors?.length ?? 0}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function ImportResultsReportPanel({
  results,
}: {
  results: ImportResultsSummary;
}) {
  const report = results.report;

  const sections = [
    {
      title: "Companies Created",
      count: results.companiesCreated ?? report?.companiesCreated.length ?? 0,
      items: report?.companiesCreated ?? [],
      tone: "green",
    },
    {
      title: "Companies Reused",
      count: results.duplicateCompanies ?? report?.companiesReused.length ?? 0,
      items: report?.companiesReused ?? [],
      tone: "blue",
    },
    {
      title: "Companies Enriched",
      count: results.companiesEnriched ?? report?.companiesEnriched.length ?? 0,
      items: report?.companiesEnriched ?? [],
      tone: "purple",
    },
    {
      title: "Contacts Created",
      count: results.contactsCreated ?? report?.contactsCreated.length ?? 0,
      items: report?.contactsCreated ?? [],
      tone: "green",
    },
    {
      title: "Contacts Reused",
      count: results.duplicateContacts ?? report?.contactsReused.length ?? 0,
      items: report?.contactsReused ?? [],
      tone: "blue",
    },
    {
      title: "Skipped / Errors",
      count: results.errors?.length ?? report?.rowErrors.length ?? 0,
      items: [...(report?.skippedRows ?? []), ...(report?.rowErrors ?? [])],
      tone: "red",
    },
  ];

  const toneClasses: Record<string, string> = {
    green: "border-green-200 bg-green-50 text-green-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    purple: "border-purple-200 bg-purple-50 text-purple-900",
    red: "border-red-200 bg-red-50 text-red-900",
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Import Results
        </p>
        <h3 className="mt-2 text-xl font-bold">Created, Reused, and Enriched Records</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use this report to confirm whether the CSV created new CRM records, reused existing
          companies or contacts, enriched company records, or skipped rows due to errors.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <div
            key={section.title}
            className={`rounded-xl border p-4 ${toneClasses[section.tone]}`}
          >
            <p className="text-sm font-semibold">{section.title}</p>
            <p className="mt-2 text-3xl font-bold">{section.count}</p>

            {section.items.length > 0 ? (
              <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-xs leading-5">
                {section.items.slice(0, 25).map((item, index) => (
                  <li key={`${section.title}-${item}-${index}`}>{item}</li>
                ))}
                {section.items.length > 25 && (
                  <li className="font-semibold">+ {section.items.length - 25} more</li>
                )}
              </ul>
            ) : (
              <p className="mt-3 text-xs opacity-75">None reported.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ImportTagAssignmentPanel({
  resetKey = 0,
  selectedMarketTagIds,
  setSelectedMarketTagIds,
  selectedSectorTagIds,
  setSelectedSectorTagIds,
  selectedCategoryTagIds,
  setSelectedCategoryTagIds,
}: {
  resetKey?: number;
  selectedMarketTagIds: string[];
  setSelectedMarketTagIds: (value: string[]) => void;
  selectedSectorTagIds: string[];
  setSelectedSectorTagIds: (value: string[]) => void;
  selectedCategoryTagIds: string[];
  setSelectedCategoryTagIds: (value: string[]) => void;
}) {
  const [tags, setTags] = useState<CrmTag[]>([]);
const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [tagError, setTagError] = useState("");

  async function loadImportTags() {
    setIsLoadingTags(true);
    setTagError("");

    try {
      const response = await fetch("/api/tags");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load CRM tags.");
      }

      setTags(data.tags ?? []);
    } catch (error) {
      setTagError(error instanceof Error ? error.message : "Could not load CRM tags.");
    } finally {
      setIsLoadingTags(false);
    }
  }

  useEffect(() => {
    loadImportTags();
  }, []);

  const marketTags = useMemo(() => {
    return tags
      .filter((tag) => ["market", "markets"].includes(String(tag.tag_type ?? "").toLowerCase().trim()))
      .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100));
  }, [tags]);

  const sectorTags = useMemo(() => {
    return tags
      .filter((tag) => ["sector", "sectors", "industry", "industries", "segment", "segments"].includes(String(tag.tag_type ?? "").toLowerCase().trim()))
      .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100));
  }, [tags]);

  const categoryTags = useMemo(() => {
    return tags
      .filter((tag) => ["category", "categories", "workflow", "priority", "status"].includes(String(tag.tag_type ?? "").toLowerCase().trim()))
      .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100));
  }, [tags]);

  const selectedTagCount =
    selectedMarketTagIds.length + selectedSectorTagIds.length + selectedCategoryTagIds.length;

  return (
    <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Import Segmentation
          </p>
          <h2 className="mt-2 text-xl font-bold">Apply Tags to This Imported List</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Choose Market, Sector, and Category tags that describe the list you are about to upload.
            Rev 1.22 saves these selected tags to every company and contact created or reused from the import.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 ring-1 ring-blue-100">
            {selectedTagCount} selected
          </div>
          <button
            onClick={loadImportTags}
            disabled={isLoadingTags}
            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            {isLoadingTags ? "Refreshing..." : "Refresh Tags"}
          </button>
        </div>
      </div>

      {tagError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {tagError}
        </div>
      )}

      <div className="mt-5 grid gap-4">
        <ImportTagPicker
          title="Markets"
          helperText="Broad Graymills commercial arena."
          tags={marketTags}
          selectedTagIds={selectedMarketTagIds}
          setSelectedTagIds={setSelectedMarketTagIds}
        />

        <ImportTagPicker
          title="Sectors"
          helperText="Industry or application segment."
          tags={sectorTags}
          selectedTagIds={selectedSectorTagIds}
          setSelectedTagIds={setSelectedSectorTagIds}
        />

        <ImportTagPicker
          title="Categories"
          helperText="CRM status, role, priority, or workflow label."
          tags={categoryTags}
          selectedTagIds={selectedCategoryTagIds}
          setSelectedTagIds={setSelectedCategoryTagIds}
        />
      </div>

      {selectedTagCount > 0 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          These selections will be applied to every company and contact created or reused during this import.
        </div>
      )}
    </div>
  );
}

function ImportTagPicker({
  title,
  helperText,
  tags,
  selectedTagIds,
  setSelectedTagIds,
}: {
  title: string;
  helperText: string;
  tags: CrmTag[];
  selectedTagIds: string[];
  setSelectedTagIds: (value: string[]) => void;
}) {
  function toggleTag(tagId: string) {
    if (selectedTagIds.includes(tagId)) {
      setSelectedTagIds(selectedTagIds.filter((id) => id !== tagId));
    } else {
      setSelectedTagIds([...selectedTagIds, tagId]);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-slate-600">{helperText}</p>
        </div>

        {selectedTagIds.length > 0 && (
          <button
            onClick={() => setSelectedTagIds([])}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
      </div>

      {tags.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No tags available.</p>
      ) : (
        <div className="mt-4 grid gap-2">
          {tags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);

            return (
              <label
                key={tag.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${
                  isSelected
                    ? "border-blue-300 bg-blue-50 text-blue-950"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleTag(tag.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>
                  <span className="font-semibold">{tag.tag_name}</span>
                  {tag.description && (
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {tag.description}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminBuyerPersonaDefinitionsSection({
  canManageBuyerPersonas = true,
  apiPermissionHeaders = () => ({}),
}: {
  canManageBuyerPersonas?: boolean;
  apiPermissionHeaders?: () => Record<string, string>;
}) {
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [isLoadingDefinitions, setIsLoadingDefinitions] = useState(false);
  const [isSavingDefinition, setIsSavingDefinition] = useState(false);
  const [definitionMessage, setDefinitionMessage] = useState("");
  const [definitionError, setDefinitionError] = useState("");
  const [editingDefinitionId, setEditingDefinitionId] = useState("");
  const [form, setForm] = useState({
    personaName: "",
    description: "",
    sortOrder: "100",
    status: "active" as "active" | "archived",
  });

  async function loadDefinitions() {
    setIsLoadingDefinitions(true);
    setDefinitionError("");

    try {
      const response = await fetch(
        "/api/buyer-persona-definitions?includeInactive=true"
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not load Buyer Persona definitions."
        );
      }

      setDefinitions(data.buyerPersonaDefinitions ?? []);
    } catch (error) {
      setDefinitionError(
        error instanceof Error
          ? error.message
          : "Could not load Buyer Persona definitions."
      );
    } finally {
      setIsLoadingDefinitions(false);
    }
  }

  useEffect(() => {
    loadDefinitions();
  }, []);

  function resetDefinitionForm() {
    setEditingDefinitionId("");
    setForm({
      personaName: "",
      description: "",
      sortOrder: "100",
      status: "active",
    });
  }

  function startEditingDefinition(definition: any) {
    setEditingDefinitionId(definition.id);
    setForm({
      personaName: definition.persona_name ?? "",
      description: definition.description ?? "",
      sortOrder: String(definition.sort_order ?? 100),
      status:
        definition.status === "archived"
          ? "archived"
          : "active",
    });
  }

  async function saveDefinition() {
    if (!canManageBuyerPersonas) {
      setDefinitionError(
        "Your current role cannot create or edit Buyer Persona definitions."
      );
      return;
    }

    setIsSavingDefinition(true);
    setDefinitionMessage("");
    setDefinitionError("");

    try {
      if (!form.personaName.trim()) {
        throw new Error("Buyer Persona name is required.");
      }

      const response = await fetch(
        "/api/buyer-persona-definitions",
        {
          method: editingDefinitionId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...apiPermissionHeaders(),
          },
          body: JSON.stringify({
            id: editingDefinitionId || undefined,
            personaName: form.personaName,
            description: form.description,
            sortOrder: form.sortOrder,
            status: form.status,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not save Buyer Persona definition."
        );
      }

      setDefinitionMessage(
        editingDefinitionId
          ? "Buyer Persona definition updated."
          : "Buyer Persona definition created."
      );

      resetDefinitionForm();
      await loadDefinitions();
    } catch (error) {
      setDefinitionError(
        error instanceof Error
          ? error.message
          : "Could not save Buyer Persona definition."
      );
    } finally {
      setIsSavingDefinition(false);
    }
  }

  async function updateDefinitionStatus(
    definition: any,
    status: "active" | "archived"
  ) {
    if (!canManageBuyerPersonas) {
      setDefinitionError(
        "Your current role cannot archive or reactivate Buyer Persona definitions."
      );
      return;
    }

    setIsSavingDefinition(true);
    setDefinitionMessage("");
    setDefinitionError("");

    try {
      const response = await fetch(
        "/api/buyer-persona-definitions",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...apiPermissionHeaders(),
          },
          body: JSON.stringify({
            id: definition.id,
            status,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not update Buyer Persona definition."
        );
      }

      setDefinitionMessage(
        status === "active"
          ? "Buyer Persona definition reactivated."
          : "Buyer Persona definition archived."
      );

      if (editingDefinitionId === definition.id) {
        resetDefinitionForm();
      }

      await loadDefinitions();
    } catch (error) {
      setDefinitionError(
        error instanceof Error
          ? error.message
          : "Could not update Buyer Persona definition."
      );
    } finally {
      setIsSavingDefinition(false);
    }
  }

  return (
    <section className="grid gap-6">
      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Admin
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Manage Buyer Persona Definitions
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              Maintain the Buyer Persona definitions used to describe likely stakeholders and selling considerations. Archive definitions instead of deleting them when company records may already contain the persona name.
            </p>

            {!canManageBuyerPersonas && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                Your current role can view Buyer Persona definitions but cannot create, edit, archive, or reactivate them.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={loadDefinitions}
            disabled={isLoadingDefinitions}
            className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {isLoadingDefinitions
              ? "Refreshing..."
              : "Refresh Buyer Personas"}
          </button>
        </div>

        {(definitionMessage || definitionError) && (
          <div className="mt-4 grid gap-2">
            {definitionMessage && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                {definitionMessage}
              </div>
            )}

            {definitionError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {definitionError}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">
          {editingDefinitionId
            ? "Edit Buyer Persona"
            : "Create Buyer Persona"}
        </h3>

        <div className="mt-5 grid gap-4 lg:grid-cols-6">
          <div className="lg:col-span-3">
            <label className="text-sm font-semibold text-slate-700">
              Persona Name
            </label>
            <input
              type="text"
              value={form.personaName}
              onChange={(event) =>
                setForm({
                  ...form,
                  personaName: event.target.value,
                })
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              placeholder="Example: Plant Manager"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">
              Sort Order
            </label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(event) =>
                setForm({
                  ...form,
                  sortOrder: event.target.value,
                })
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-slate-700">
              Status
            </label>
            <select
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as
                    | "active"
                    | "archived",
                })
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="lg:col-span-6">
            <label className="text-sm font-semibold text-slate-700">
              Description
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm({
                  ...form,
                  description: event.target.value,
                })
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              placeholder="Describe what this stakeholder typically cares about."
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveDefinition}
            disabled={
              isSavingDefinition || !canManageBuyerPersonas
            }
            className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSavingDefinition
              ? "Saving..."
              : editingDefinitionId
                ? "Save Buyer Persona"
                : "Create Buyer Persona"}
          </button>

          {editingDefinitionId && (
            <button
              type="button"
              onClick={resetDefinitionForm}
              disabled={isSavingDefinition}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">
          Buyer Persona Definitions
        </h3>

        {definitions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No Buyer Persona definitions found.
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {definitions.map((definition) => (
              <div
                key={definition.id}
                className={`rounded-xl border p-4 ${
                  definition.status === "archived"
                    ? "border-slate-200 bg-slate-50 opacity-70"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {definition.persona_name}
                      </p>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          definition.status === "archived"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {definition.status}
                      </span>

                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                        Sort {definition.sort_order}
                      </span>
                    </div>

                    {definition.description && (
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {definition.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        startEditingDefinition(definition)
                      }
                      disabled={
                        isSavingDefinition ||
                        !canManageBuyerPersonas
                      }
                      className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      Edit
                    </button>

                    {definition.status === "archived" ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateDefinitionStatus(
                            definition,
                            "active"
                          )
                        }
                        disabled={
                          isSavingDefinition ||
                          !canManageBuyerPersonas
                        }
                        className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Reactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          updateDefinitionStatus(
                            definition,
                            "archived"
                          )
                        }
                        disabled={
                          isSavingDefinition ||
                          !canManageBuyerPersonas
                        }
                        className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}


function AdminProjectsListsSection({
  canManageProjectsLists = false,
}: {
  canManageProjectsLists?: boolean;
}) {
  const [projectsLists, setProjectsLists] = useState<any[]>([]);
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const formRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    projectName: "",
    projectKind: "project" as "project" | "list",
    description: "",
    ownerUserId: "",
    sortOrder: "100",
    status: "active" as "active" | "archived",
  });

  async function getVerifiedAdminHeaders() {
    const supabase = getBrowserSupabaseClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error(
        error.message || "Could not read the signed-in session."
      );
    }

    const accessToken = data.session?.access_token;

    if (!accessToken) {
      throw new Error("A signed-in Supabase session is required.");
    }

    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  async function loadProjectsLists() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [projectsResponse, usersResponse] = await Promise.all([
        fetch("/api/projects-lists?includeInactive=true"),
        fetch("/api/crm-users"),
      ]);

      const projectsData = await projectsResponse.json();
      const usersData = await usersResponse.json();

      if (!projectsResponse.ok) {
        throw new Error(
          projectsData.error || "Could not load Projects / Lists."
        );
      }

      if (!usersResponse.ok) {
        throw new Error(
          usersData.error || "Could not load CRM users."
        );
      }

      setProjectsLists(projectsData.projectsLists ?? []);
      setUsers(usersData.users ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load Projects / Lists."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProjectsLists();
  }, []);

  function resetForm() {
    setEditingId("");
    setForm({
      projectName: "",
      projectKind: "project",
      description: "",
      ownerUserId: "",
      sortOrder: "100",
      status: "active",
    });
  }

  function startEditing(item: any) {
    setEditingId(String(item.id || ""));
    setForm({
      projectName: String(item.project_name || ""),
      projectKind:
        item.project_kind === "list" ? "list" : "project",
      description: String(item.description || ""),
      ownerUserId: String(item.owner_user_id || ""),
      sortOrder: String(item.sort_order ?? 100),
      status:
        item.status === "archived" ? "archived" : "active",
    });

    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      window.setTimeout(() => {
        nameInputRef.current?.focus({ preventScroll: true });
      }, 350);
    });
  }

  async function saveProjectList() {
    if (!canManageProjectsLists) {
      setErrorMessage(
        "Only CRM Admin users can create or edit Projects / Lists."
      );
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      if (!form.projectName.trim()) {
        throw new Error("Project / List name is required.");
      }

      const headers = await getVerifiedAdminHeaders();

      const response = await fetch("/api/projects-lists", {
        method: editingId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify({
          id: editingId || undefined,
          projectName: form.projectName,
          projectKind: form.projectKind,
          description: form.description,
          ownerUserId: form.ownerUserId || null,
          sortOrder: form.sortOrder,
          status: form.status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not save Project / List."
        );
      }

      setMessage(
        editingId
          ? "Project / List updated."
          : "Project / List created."
      );

      resetForm();
      await loadProjectsLists();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not save Project / List."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function updateStatus(
    item: any,
    status: "active" | "archived"
  ) {
    if (!canManageProjectsLists) {
      setErrorMessage(
        "Only CRM Admin users can archive or reactivate Projects / Lists."
      );
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const headers = await getVerifiedAdminHeaders();

      const response = await fetch("/api/projects-lists", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          id: item.id,
          status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not update Project / List status."
        );
      }

      setMessage(
        status === "active"
          ? "Project / List reactivated."
          : "Project / List archived."
      );

      if (editingId === item.id) {
        resetForm();
      }

      await loadProjectsLists();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not update Project / List status."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const projectCount = projectsLists.filter(
    (item) => item.project_kind === "project"
  ).length;

  const listCount = projectsLists.filter(
    (item) => item.project_kind === "list"
  ).length;

  return (
    <section className="grid gap-6">
      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Admin
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Manage Projects / Lists
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              Create sales projects, campaigns, territory initiatives, and
              flexible lists used to group companies and contacts. Archive
              records instead of deleting them.
            </p>

            {!canManageProjectsLists && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                Your current role can view Projects / Lists but cannot create,
                edit, archive, or reactivate them.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-800">
              {projectCount} Projects
            </span>
            <span className="rounded-full bg-violet-50 px-3 py-1 font-semibold text-violet-800">
              {listCount} Lists
            </span>
          </div>
        </div>

        {message ? (
          <p className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">
            {message}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div
        ref={formRef}
        className="scroll-mt-32 max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm"
      >
        <h3 className="text-xl font-bold">
          {editingId
            ? "Edit Project / List"
            : "Add Project / List"}
        </h3>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Name
            <input
              ref={nameInputRef}
              value={form.projectName}
              disabled={!canManageProjectsLists || isSaving}
              onChange={(event) =>
                setForm({
                  ...form,
                  projectName: event.target.value,
                })
              }
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              placeholder="Example: Aviation MRO Campaign"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Type
            <select
              value={form.projectKind}
              disabled={!canManageProjectsLists || isSaving}
              onChange={(event) =>
                setForm({
                  ...form,
                  projectKind:
                    event.target.value === "list"
                      ? "list"
                      : "project",
                })
              }
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            >
              <option value="project">Project</option>
              <option value="list">List</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Owner
            <select
              value={form.ownerUserId}
              disabled={!canManageProjectsLists || isSaving}
              onChange={(event) =>
                setForm({
                  ...form,
                  ownerUserId: event.target.value,
                })
              }
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={String(user.id)} value={String(user.id)}>
                  {user.display_name || user.email || "Unnamed user"}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Sort order
            <input
              type="number"
              value={form.sortOrder}
              disabled={!canManageProjectsLists || isSaving}
              onChange={(event) =>
                setForm({
                  ...form,
                  sortOrder: event.target.value,
                })
              }
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
            Description
            <textarea
              value={form.description}
              disabled={!canManageProjectsLists || isSaving}
              onChange={(event) =>
                setForm({
                  ...form,
                  description: event.target.value,
                })
              }
              className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 font-normal"
              placeholder="Purpose, scope, or membership guidance"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!canManageProjectsLists || isSaving}
            onClick={saveProjectList}
            className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? "Saving..."
              : editingId
                ? "Save Changes"
                : "Create Project / List"}
          </button>

          {editingId ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={resetForm}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Cancel
            </button>
          ) : null}

          <button
            type="button"
            disabled={isLoading || isSaving}
            onClick={loadProjectsLists}
            className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">
          Existing Projects / Lists
        </h3>

        {isLoading ? (
          <p className="mt-4 text-sm text-slate-600">
            Loading Projects / Lists...
          </p>
        ) : projectsLists.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            No Projects or Lists have been created.
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {projectsLists.map((item) => {
              const ownerName =
                item.owner?.display_name ||
                item.owner?.email ||
                "Unassigned";

              const isArchived = item.status === "archived";

              return (
                <div
                  key={String(item.id)}
                  className={`rounded-xl border p-4 ${
                    isArchived
                      ? "border-slate-200 bg-slate-50"
                      : "border-blue-100 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-950">
                          {item.project_name}
                        </p>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            item.project_kind === "list"
                              ? "bg-violet-100 text-violet-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {item.project_kind === "list"
                            ? "List"
                            : "Project"}
                        </span>
                        {isArchived ? (
                          <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                            Archived
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 text-sm text-slate-600">
                        Owner: {ownerName} · Sort order:{" "}
                        {item.sort_order ?? 100}
                      </p>

                      {item.description ? (
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {item.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!canManageProjectsLists || isSaving}
                        onClick={() => startEditing(item)}
                        className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50"
                      >
                        Edit
                      </button>

                      {isArchived ? (
                        <button
                          type="button"
                          disabled={!canManageProjectsLists || isSaving}
                          onClick={() => updateStatus(item, "active")}
                          className="rounded-lg border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 disabled:opacity-50"
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!canManageProjectsLists || isSaving}
                          onClick={() => updateStatus(item, "archived")}
                          className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function AdminWorkflowAutomationRulesSection({
  canManageWorkflowAutomations = false,
}: {
  canManageWorkflowAutomations?: boolean;
}) {
  const [rules, setRules] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [savingRuleId, setSavingRuleId] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function getVerifiedAdminHeaders() {
    if (!hasBrowserSupabaseConfig()) {
      throw new Error("Browser Supabase configuration is not available.");
    }

    const supabase = getBrowserSupabaseClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error(error.message || "Could not read the signed-in session.");
    }

    const accessToken = data.session?.access_token;

    if (!accessToken) {
      throw new Error("A signed-in Admin session is required.");
    }

    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  function toDraft(rule: any) {
    return {
      enabled: Boolean(rule.enabled),
      requireConfirmation: Boolean(rule.require_confirmation),
      createActivity: Boolean(rule.create_activity),
      requireLostReason: Boolean(rule.require_lost_reason),
      activityType: String(rule.activity_type || "task"),
      activitySubject: String(rule.activity_subject || ""),
      activityNotes: String(rule.activity_notes || ""),
      dueBusinessDays: String(rule.due_business_days ?? 0),
    };
  }

  async function loadRules() {
    setIsLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const headers = await getVerifiedAdminHeaders();
      const response = await fetch("/api/sales-workflow-automation-rules", {
        headers,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load workflow automation rules.");
      }

      const loadedRules = data.rules ?? [];
      setRules(loadedRules);
      setDrafts(
        Object.fromEntries(
          loadedRules.map((rule: any) => [String(rule.id), toDraft(rule)])
        )
      );
    } catch (error) {
      setRules([]);
      setDrafts({});
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load workflow automation rules."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (canManageWorkflowAutomations) {
      void loadRules();
    }
  }, [canManageWorkflowAutomations]);

  function updateDraft(ruleId: string, patch: Record<string, unknown>) {
    setDrafts((current) => ({
      ...current,
      [ruleId]: {
        ...(current[ruleId] ?? {}),
        ...patch,
      },
    }));
  }

  async function saveRule(rule: any) {
    const ruleId = String(rule.id);
    const draft = drafts[ruleId];

    if (!draft) return;

    setSavingRuleId(ruleId);
    setMessage("");
    setErrorMessage("");

    try {
      const dueBusinessDays = Number(draft.dueBusinessDays);

      if (
        !Number.isInteger(dueBusinessDays) ||
        dueBusinessDays < 0 ||
        dueBusinessDays > 365
      ) {
        throw new Error("Due business days must be a whole number from 0 through 365.");
      }

      const headers = await getVerifiedAdminHeaders();
      const response = await fetch("/api/sales-workflow-automation-rules", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          ruleId,
          enabled: Boolean(draft.enabled),
          requireConfirmation: Boolean(draft.requireConfirmation),
          createActivity: Boolean(draft.createActivity),
          requireLostReason: Boolean(draft.requireLostReason),
          activityType: draft.activityType,
          activitySubject: draft.activitySubject || null,
          activityNotes: draft.activityNotes || null,
          dueBusinessDays,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save the workflow automation rule.");
      }

      setMessage(`${rule.rule_name} updated.`);
      await loadRules();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not save the workflow automation rule."
      );
    } finally {
      setSavingRuleId("");
    }
  }

  function describeTrigger(rule: any) {
    if (rule.trigger_stage_key) {
      return `Enter stage: ${formatTitleFromKey(String(rule.trigger_stage_key))}`;
    }

    if (rule.trigger_outcome) {
      return `Outcome: ${formatTitleFromKey(String(rule.trigger_outcome))}`;
    }

    return "No trigger configured";
  }

  return (
    <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Controlled Sales Workflow Automations
          </p>
          <h3 className="mt-2 text-xl font-bold">Workflow Automation Rules</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Configure the follow-up activity proposed when an opportunity enters a stage or closes.
            Triggers are fixed; each rule remains inactive until explicitly enabled.
          </p>
        </div>

        <button
          type="button"
          onClick={loadRules}
          disabled={isLoading || !canManageWorkflowAutomations}
          className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {isLoading ? "Refreshing..." : "Refresh Rules"}
        </button>
      </div>

      {!canManageWorkflowAutomations && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          Only signed-in CRM Admin users can manage workflow automation rules.
        </p>
      )}

      {message && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {canManageWorkflowAutomations && rules.length === 0 && !isLoading ? (
        <p className="mt-5 text-sm text-slate-600">No workflow automation rules found.</p>
      ) : (
        <div className="mt-5 grid gap-4">
          {rules.map((rule: any) => {
            const ruleId = String(rule.id);
            const draft = drafts[ruleId] ?? toDraft(rule);
            const isLostRule = String(rule.trigger_outcome || "") === "lost";

            return (
              <section
                key={ruleId}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-slate-900">{rule.rule_name}</h4>
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                        {describeTrigger(rule)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          draft.enabled
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {draft.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {rule.description || "No description provided."}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.enabled)}
                      onChange={(event) =>
                        updateDraft(ruleId, { enabled: event.target.checked })
                      }
                    />
                    Enable rule
                  </label>

                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.requireConfirmation)}
                      onChange={(event) =>
                        updateDraft(ruleId, {
                          requireConfirmation: event.target.checked,
                        })
                      }
                    />
                    Require confirmation
                  </label>

                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.createActivity)}
                      disabled={isLostRule && Boolean(draft.requireLostReason)}
                      onChange={(event) =>
                        updateDraft(ruleId, { createActivity: event.target.checked })
                      }
                    />
                    Create activity
                  </label>

                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.requireLostReason)}
                      disabled={!isLostRule}
                      onChange={(event) =>
                        updateDraft(ruleId, {
                          requireLostReason: event.target.checked,
                          ...(event.target.checked ? { createActivity: false } : {}),
                        })
                      }
                    />
                    Require lost reason
                  </label>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Activity Type
                    </label>
                    <select
                      value={draft.activityType}
                      disabled={!draft.createActivity}
                      onChange={(event) =>
                        updateDraft(ruleId, { activityType: event.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:bg-slate-100"
                    >
                      <option value="note">Note</option>
                      <option value="call">Call</option>
                      <option value="email">Email</option>
                      <option value="meeting">Meeting</option>
                      <option value="task">Task</option>
                      <option value="quote_followup">Quote Follow-Up</option>
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">
                      Activity Subject
                    </label>
                    <input
                      type="text"
                      value={draft.activitySubject}
                      disabled={!draft.createActivity}
                      onChange={(event) =>
                        updateDraft(ruleId, { activitySubject: event.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Due Business Days
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="365"
                      step="1"
                      value={draft.dueBusinessDays}
                      disabled={!draft.createActivity}
                      onChange={(event) =>
                        updateDraft(ruleId, { dueBusinessDays: event.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:bg-slate-100"
                    />
                  </div>

                  <div className="lg:col-span-4">
                    <label className="text-xs font-semibold text-slate-700">
                      Activity Notes
                    </label>
                    <textarea
                      rows={3}
                      value={draft.activityNotes}
                      disabled={!draft.createActivity}
                      onChange={(event) =>
                        updateDraft(ruleId, { activityNotes: event.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => saveRule(rule)}
                    disabled={savingRuleId === ruleId || !canManageWorkflowAutomations}
                    className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {savingRuleId === ruleId ? "Saving..." : "Save Rule"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setDrafts((current) => ({
                        ...current,
                        [ruleId]: toDraft(rule),
                      }))
                    }
                    disabled={savingRuleId === ruleId}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    Reset Changes
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminFunnelStagesSection({
  canManageFunnelStages = true,
  apiPermissionHeaders = () => ({}),
}: {
  canManageFunnelStages?: boolean;
  apiPermissionHeaders?: any;
}) {
  const [stages, setStages] = useState<SalesFunnelStage[]>([]);
  const [isLoadingStages, setIsLoadingStages] = useState(false);
  const [isSavingStage, setIsSavingStage] = useState(false);
  const [stageMessage, setStageMessage] = useState("");
  const [stageError, setStageError] = useState("");
  const [editingStageId, setEditingStageId] = useState("");
  const stageFormRef = useRef<HTMLDivElement | null>(null);
  const stageNameInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<any>({
    stageName: "",
    stageKey: "",
    description: "",
    sortOrder: "100",
    defaultProbability: "0",
    isOpenStage: true,
    isWonStage: false,
    isLostStage: false,
    status: "active" as "active" | "archived",
  });

  async function loadStages() {
    setIsLoadingStages(true);
    setStageError("");

    try {
      const response = await fetch("/api/funnel-stages?includeInactive=true");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load funnel stages.");
      }

      setStages(data.stages ?? []);
    } catch (error) {
      setStageError(error instanceof Error ? error.message : "Could not load funnel stages.");
    } finally {
      setIsLoadingStages(false);
    }
  }

  useEffect(() => {
    loadStages();
  }, []);

  function resetStageForm() {
    setEditingStageId("");
    setForm({
      stageName: "",
      stageKey: "",
      description: "",
      sortOrder: "100",
      defaultProbability: "0",
      isOpenStage: true,
      isWonStage: false,
      isLostStage: false,
      status: "active",
    });
  }

  function startEditingStage(stage: SalesFunnelStage) {
    setEditingStageId(stage.id);
    setForm({
      stageName: stage.stage_name,
      stageKey: stage.stage_key,
      description: stage.description ?? "",
      sortOrder: String(stage.sort_order ?? 100),
      defaultProbability: String(stage.default_probability ?? 0),
      isOpenStage: Boolean(stage.is_open_stage),
      isWonStage: Boolean(stage.is_won_stage),
      isLostStage: Boolean(stage.is_lost_stage),
      status: stage.status === "archived" ? "archived" : "active",
    });

    window.requestAnimationFrame(() => {
      stageFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      window.setTimeout(() => {
        stageNameInputRef.current?.focus({ preventScroll: true });
      }, 350);
    });
  }

  async function saveStage() {
    if (!canManageFunnelStages) {
      setStageError("Your current role cannot create or edit funnel stages.");
      return;
    }

    setIsSavingStage(true);
    setStageMessage("");
    setStageError("");

    try {
      if (!form.stageName.trim()) {
        throw new Error("Stage name is required.");
      }

      const response = await fetch("/api/funnel-stages", {
        method: editingStageId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
        },
        body: JSON.stringify({
          id: editingStageId || undefined,
          stageName: form.stageName,
          stageKey: form.stageKey,
          description: form.description,
          sortOrder: form.sortOrder,
          defaultProbability: form.defaultProbability,
          isOpenStage: form.isOpenStage,
          isWonStage: form.isWonStage,
          isLostStage: form.isLostStage,
          status: form.status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save funnel stage.");
      }

      setStageMessage(editingStageId ? "Funnel stage updated." : "Funnel stage created.");
      resetStageForm();
      await loadStages();
    } catch (error) {
      setStageError(error instanceof Error ? error.message : "Could not save funnel stage.");
    } finally {
      setIsSavingStage(false);
    }
  }

  async function updateStageStatus(stage: SalesFunnelStage, status: "active" | "archived") {
    if (!canManageFunnelStages) {
      setStageError("Your current role cannot archive or reactivate funnel stages.");
      return;
    }

    setIsSavingStage(true);
    setStageMessage("");
    setStageError("");

    try {
      const response = await fetch("/api/funnel-stages", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
        },
        body: JSON.stringify({
          id: stage.id,
          status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update funnel stage.");
      }

      setStageMessage(status === "active" ? "Funnel stage reactivated." : "Funnel stage archived.");
      await loadStages();
    } catch (error) {
      setStageError(error instanceof Error ? error.message : "Could not update funnel stage.");
    } finally {
      setIsSavingStage(false);
    }
  }

  function handleStageFlagChange(flag: "open" | "won" | "lost") {
    if (flag === "won") {
      setForm({
        ...form,
        isWonStage: true,
        isLostStage: false,
        isOpenStage: false,
        defaultProbability: form.defaultProbability || "100",
      });
      return;
    }

    if (flag === "lost") {
      setForm({
        ...form,
        isWonStage: false,
        isLostStage: true,
        isOpenStage: false,
        defaultProbability: "0",
      });
      return;
    }

    setForm({
      ...form,
      isWonStage: false,
      isLostStage: false,
      isOpenStage: true,
    });
  }

  return (
    <section className="grid gap-6">
      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Admin
            </p>
            <h2 className="mt-2 text-2xl font-bold">Manage Sales Funnel Stages</h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              Maintain the stages used for opportunity tracking. Archive stages instead of deleting them when opportunities may already reference the stage.
            </p>

            {!canManageFunnelStages && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                Your current role can view funnel stages but cannot create, edit, archive, or reactivate them.
              </p>
            )}
          </div>

          <button
            onClick={loadStages}
            disabled={isLoadingStages}
            className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            {isLoadingStages ? "Refreshing..." : "Refresh Stages"}
          </button>
        </div>

        {(stageMessage || stageError) && (
          <div className="mt-4 grid gap-2">
            {stageMessage && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                {stageMessage}
              </div>
            )}
            {stageError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {stageError}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        ref={stageFormRef}
        className="scroll-mt-24 max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm"
      >
        <h3 className="text-xl font-bold">{editingStageId ? "Edit Stage" : "Create Stage"}</h3>

        <div className="mt-5 grid gap-4 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Stage Name</label>
            <input
              ref={stageNameInputRef}
              type="text"
              value={form.stageName}
              onChange={(event) => setForm({ ...form, stageName: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              placeholder="Example: Technical Review"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Stage Key</label>
            <input
              type="text"
              value={form.stageKey}
              onChange={(event) => setForm({ ...form, stageKey: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              placeholder="technical_review"
            />
            <p className="mt-1 text-xs text-slate-500">
              Leave blank when creating to auto-generate from stage name.
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Sort Order</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Probability %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.defaultProbability}
              onChange={(event) => setForm({ ...form, defaultProbability: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Stage Type</label>
            <select
              value={form.isWonStage ? "won" : form.isLostStage ? "lost" : "open"}
              onChange={(event) =>
                handleStageFlagChange(event.target.value as "open" | "won" | "lost")
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">User Role</label>
            <select
              value={form.userRole}
              onChange={(event) => setForm({ ...form, userRole: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="admin">Admin</option>
              <option value="sales_manager">Sales Manager</option>
              <option value="sales_rep">Sales Rep</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Coverage Type</label>
            <select
              value={form.coverageType}
              onChange={(event) => setForm({ ...form, coverageType: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="internal">Internal</option>
              <option value="outside_rep">Outside Rep</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Status</label>
            <select
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value as "active" | "archived" })
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="lg:col-span-6">
            <label className="text-sm font-semibold text-slate-700">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              placeholder="Describe when sales should use this stage."
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={saveStage}
            disabled={isSavingStage || !canManageFunnelStages}
            className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:bg-slate-300"
          >
            {isSavingStage ? "Saving..." : editingStageId ? "Save Stage" : "Create Stage"}
          </button>

          {editingStageId && (
            <button
              onClick={resetStageForm}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">Funnel Stages</h3>

        {stages.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No funnel stages found.</p>
        ) : (
          <div className="mt-5 grid gap-3">
            {stages.map((stage) => (
              <div
                key={stage.id}
                className={`rounded-xl border p-4 ${
                  stage.status === "archived"
                    ? "border-slate-200 bg-slate-50 opacity-70"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{stage.stage_name}</p>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {stage.stage_key}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          stage.status === "archived"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {stage.status}
                      </span>

                      {stage.is_won_stage && (
                        <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                          Won
                        </span>
                      )}

                      {stage.is_lost_stage && (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                          Lost
                        </span>
                      )}

                      {stage.is_open_stage && (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                          Open
                        </span>
                      )}
                    </div>

                    <div className="mt-2 grid gap-1 text-sm text-slate-600 md:grid-cols-3">
                      <p>Sort: {stage.sort_order}</p>
                      <p>Default probability: {stage.default_probability}%</p>
                      <p>Status: {stage.status}</p>
                    </div>

                    {stage.description && (
                      <p className="mt-3 text-sm leading-6 text-slate-700">{stage.description}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => startEditingStage(stage)}
                      disabled={isSavingStage || !canManageFunnelStages}
                      className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                    >Edit Stage</button>

                    {stage.status === "archived" ? (
                      <button
                        onClick={() => updateStageStatus(stage, "active")}
                        disabled={isSavingStage || !canManageFunnelStages}
                        className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:bg-slate-300"
                      >
                        Reactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => updateStageStatus(stage, "archived")}
                        disabled={isSavingStage || !canManageFunnelStages}
                        className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:bg-slate-300"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function UserRolePermissionsReference() {
  const roles = [
    {
      title: "Admin",
      permissions:
        "Full administrative control: users, tags, funnel stage definitions, imports, sales assignments, company/contact records, opportunities, documents, and activities.",
    },
    {
      title: "Sales Manager",
      permissions:
        "Can import CSV files, oversee assigned sales reps and outside reps, assign sales coverage within allowed scope, create and edit opportunities, move opportunities between existing stages, and mark opportunities won or lost. Cannot manage global admin settings unless also an Admin.",
    },
    {
      title: "Sales Rep",
      permissions:
        "Can work assigned records, create opportunities, update opportunities, add activities, notes, and documents, move assigned opportunities between existing funnel stages, and mark opportunities won or lost. Cannot create, edit, archive, or reactivate users, tags, or funnel stage definitions.",
    },
  ];

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
        Permission Reference
      </p>
      <h3 className="mt-2 text-xl font-bold">Admin, Sales Manager, and Sales Rep Roles</h3>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {roles.map((role) => (
          <div key={role.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="font-semibold text-slate-900">{role.title}</h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">{role.permissions}</p>
          </div>
        ))}
      </div>
    </section>
  );
}



type LoginRequiredCrmShellGateProps = {
  children: ReactNode;
};

type LoginRequiredCrmShellStatus = {
  state: "checking" | "not_configured" | "signed_out" | "signed_in" | "error";
  message: string;
};

function LoginRequiredCrmShellGate({ children }: LoginRequiredCrmShellGateProps) {
  const [gateStatus, setGateStatus] = useState<LoginRequiredCrmShellStatus>({
    state: "checking",
    message: "Checking signed-in Supabase session.",
  });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        if (!hasBrowserSupabaseConfig()) {
          if (!cancelled) {
            setGateStatus({
              state: "not_configured",
              message: "Browser Supabase configuration is not available. CRM access is locked.",
            });
          }
          return;
        }

        const supabase = getBrowserSupabaseClient();
        const { data, error } = await supabase.auth.getSession();

        if (cancelled) {
          return;
        }

        if (error) {
          setGateStatus({
            state: "error",
            message: error.message || "Could not read the Supabase session. CRM access is locked.",
          });
          return;
        }

        setGateStatus(
          data.session?.user
            ? {
                state: "signed_in",
                message: "Signed-in Supabase session detected.",
              }
            : {
                state: "signed_out",
                message: "Sign in to access the Graymills CRM workspace.",
              }
        );
      } catch (error) {
        if (!cancelled) {
          setGateStatus({
            state: "error",
            message: error instanceof Error ? error.message : "Could not verify Supabase session. CRM access is locked.",
          });
        }
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLoginRequiredShellSignIn(event: { preventDefault: () => void }) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginMessage("");

    try {
      if (!hasBrowserSupabaseConfig()) {
        setLoginMessage("Browser Supabase configuration is not available.");
        return;
      }

      const supabase = getBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (error) {
        setLoginMessage(error.message || "Could not sign in.");
        return;
      }

      setGateStatus({
        state: "signed_in",
        message: "Signed-in Supabase session detected.",
      });
      setLoginPassword("");
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setLoginBusy(false);
    }
  }

  if (gateStatus.state === "signed_in") {
    return <>{children}</>;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center">
        <section className="w-full rounded-3xl border border-slate-700 bg-white p-6 text-slate-900 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Graymills CRM</p>
          <h1 className="mt-3 text-3xl font-black text-slate-950">Login required</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The CRM workspace is locked until a Supabase Auth user signs in. Use the email and password created for the user in Supabase Authentication.
          </p>

          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-700 ring-1 ring-slate-200">
            <p className="font-bold text-slate-950">Access status</p>
            <p className="mt-1">{gateStatus.message}</p>
            <p className="mt-2 text-slate-500">{APP_VERSION}</p>
          </div>

          <form className="mt-5 grid gap-3" onSubmit={handleLoginRequiredShellSignIn}>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Email
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                placeholder="name@graymills.com"
                autoComplete="email"
              />
            </label>

            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Password
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="Password"
                autoComplete="current-password"
              />
            </label>

            <button
              className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
              type="submit"
              disabled={loginBusy || !loginEmail.trim() || !loginPassword}
            >
              {loginBusy ? "Signing in..." : "Sign in to CRM"}
            </button>
          </form>

          {loginMessage ? (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-100">{loginMessage}</p>
          ) : null}

          <p className="mt-5 text-xs leading-5 text-slate-500">
            After login, CRM role enforcement will still be validated separately through the signed-in CRM user match and role preview workflow.
          </p>
        </section>
      </div>
    </main>
  );
}


function BackupExportPanel() {
  const [backupExportBusy, setBackupExportBusy] = useState(false);
  const [backupExportMessage, setBackupExportMessage] = useState("");

  async function handleBackupExport() {
    setBackupExportBusy(true);
    setBackupExportMessage("");

    try {
      const response = await fetch("/api/backup-export", {
        method: "GET",
        headers: {
          "x-crm-user-role": "admin",
          "x-crm-user-name": "Backup Export",
        },
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorPayload?.error || "Backup export failed.");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") || "";
      const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] || `graymills-crm-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setBackupExportMessage(`Backup export downloaded: ${fileName}`);
    } catch (error) {
      setBackupExportMessage(error instanceof Error ? error.message : "Could not download backup export.");
    } finally {
      setBackupExportBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-cyan-200 bg-white p-3 text-xs leading-5 text-cyan-900 ring-1 ring-cyan-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-cyan-950">Backup Export</p>
        <span className="rounded-full bg-cyan-100 px-2 py-1 text-[11px] font-bold text-cyan-800 ring-1 ring-cyan-200">
          Export only
        </span>
      </div>

      <p className="mt-2">
        Download a dated JSON backup of core CRM operational tables. This does not restore, overwrite, or modify CRM data.
      </p>

      <button
        className="mt-3 rounded-lg bg-cyan-700 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-300"
        type="button"
        onClick={handleBackupExport}
        disabled={backupExportBusy}
      >
        {backupExportBusy ? "Creating backup..." : "Download CRM backup JSON"}
      </button>

      {backupExportMessage ? (
        <p className="mt-3 rounded-lg bg-cyan-50 p-2 text-cyan-900 ring-1 ring-cyan-100">{backupExportMessage}</p>
      ) : null}

      <p className="mt-3 text-cyan-800">
        Restore remains intentionally disabled until preview, row-count validation, Admin confirmation, and overwrite protections are added.
      </p>
    </div>
  );
}

function SignedInSessionStatusPanel() {
  const [sessionStatus, setSessionStatus] = useState<SignedInSessionStatus>({
    state: "checking",
    email: "",
    userId: "",
    message: "Checking browser Supabase session.",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSessionStatus() {
      try {
        if (!hasBrowserSupabaseConfig()) {
          if (!cancelled) {
            setSessionStatus({
              state: "not_configured",
              email: "",
              userId: "",
              message: "Browser Supabase configuration is not available in this environment.",
            });
          }
          return;
        }

        const supabase = getBrowserSupabaseClient();
        const { data, error } = await supabase.auth.getSession();

        if (cancelled) {
          return;
        }

        if (error) {
          setSessionStatus({
            state: "error",
            email: "",
            userId: "",
            message: error.message || "Could not read the browser Supabase session.",
          });
          return;
        }

        const session = data.session;
        const user = session?.user;

        if (!user) {
          setSessionStatus({
            state: "signed_out",
            email: "",
            userId: "",
            message: "No signed-in Supabase user session is currently detected.",
          });
          return;
        }

        setSessionStatus({
          state: "signed_in",
          email: user.email || "",
          userId: user.id || "",
          message: "Signed-in Supabase user session detected. CRM permissions are enforced through the matched CRM Users record.",
        });
      } catch (error) {
        if (!cancelled) {
          setSessionStatus({
            state: "error",
            email: "",
            userId: "",
            message: error instanceof Error ? error.message : "Could not inspect the browser Supabase session.",
          });
        }
      }
    }

    loadSessionStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel =
    sessionStatus.state === "signed_in"
      ? "Signed in"
      : sessionStatus.state === "signed_out"
        ? "Signed out"
        : sessionStatus.state === "not_configured"
          ? "Not configured"
          : sessionStatus.state === "error"
            ? "Error"
            : "Checking";

  const statusClassName =
    sessionStatus.state === "signed_in"
      ? "bg-green-100 text-green-800 ring-green-200"
      : sessionStatus.state === "error"
        ? "bg-red-100 text-red-800 ring-red-200"
        : sessionStatus.state === "not_configured"
          ? "bg-amber-100 text-amber-800 ring-amber-200"
          : "bg-slate-100 text-slate-800 ring-slate-200";

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-800 ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-slate-950">Signed-In Session Status</p>
        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${statusClassName}`}>
          {statusLabel}
        </span>
      </div>
      <p className="mt-2">{sessionStatus.message}</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-2">
          <dt className="font-semibold text-slate-500">Detected email</dt>
          <dd className="mt-1 break-all text-slate-900">{sessionStatus.email || "None detected"}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <dt className="font-semibold text-slate-500">Detected auth user id</dt>
          <dd className="mt-1 break-all text-slate-900">{sessionStatus.userId || "None detected"}</dd>
        </div>
      </dl>
      <p className="mt-3 text-slate-600">
        This panel confirms the browser authentication session used by the production CRM login gate.
      </p>
    </div>
  );
}




type SignedInCrmRolePreviewStatus = {
  state: "checking" | "not_configured" | "signed_out" | "ready" | "blocked" | "not_matched" | "error";
  authEmail: string;
  crmUserName: string;
  crmUserRole: string;
  crmUserStatus: string;
  permissionPreview: string;
  message: string;
};

function normalizeCrmRolePreviewValue(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "admin") {
    return "Admin";
  }

  if (normalized === "sales_manager" || normalized === "sales manager" || normalized === "manager") {
    return "Sales Manager";
  }

  if (normalized === "sales_rep" || normalized === "sales rep" || normalized === "rep") {
    return "Sales Rep";
  }

  return value.trim();
}

function getCrmRolePermissionPreview(role: string) {
  const normalizedRole = normalizeCrmRolePreviewValue(role);

  if (normalizedRole === "Admin") {
    return "Would receive full CRM access, including Admin user management, imports, workflow settings, assignments, and all CRM records.";
  }

  if (normalizedRole === "Sales Manager") {
    return "Would receive broad CRM visibility across companies, contacts, funnel records, and activities for assignment and pipeline oversight, without Admin user management.";
  }

  if (normalizedRole === "Sales Rep") {
    return "Would receive scoped CRM visibility for companies assigned as Salesperson / Rep, with related contacts, funnel records, and activities.";
  }

  return "No recognized production permission preview is available for this CRM role.";
}

function SignedInCrmUserMatchPanel() {
  const [matchStatus, setMatchStatus] = useState<SignedInCrmUserMatchStatus>({
    state: "checking",
    authEmail: "",
    authUserId: "",
    crmUserName: "",
    crmUserRole: "",
    crmUserStatus: "",
    crmUserCoverageType: "",
    message: "Checking signed-in Supabase user against CRM Users.",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSignedInCrmUserMatch() {
      try {
        if (!hasBrowserSupabaseConfig()) {
          if (!cancelled) {
            setMatchStatus({
              state: "not_configured",
              authEmail: "",
              authUserId: "",
              crmUserName: "",
              crmUserRole: "",
              crmUserStatus: "",
              crmUserCoverageType: "",
              message: "Browser Supabase configuration is not available in this environment.",
            });
          }
          return;
        }

        const supabase = getBrowserSupabaseClient();
        const { data, error } = await supabase.auth.getSession();

        if (cancelled) {
          return;
        }

        if (error) {
          setMatchStatus({
            state: "error",
            authEmail: "",
            authUserId: "",
            crmUserName: "",
            crmUserRole: "",
            crmUserStatus: "",
            crmUserCoverageType: "",
            message: error.message || "Could not read the browser Supabase session.",
          });
          return;
        }

        const authUser = data.session?.user;
        const authEmail = authUser?.email?.trim().toLowerCase() || "";
        const authUserId = authUser?.id || "";

        if (!authUser || !authEmail) {
          setMatchStatus({
            state: "signed_out",
            authEmail: "",
            authUserId: "",
            crmUserName: "",
            crmUserRole: "",
            crmUserStatus: "",
            crmUserCoverageType: "",
            message: "No signed-in Supabase Auth user is available to match to CRM Users.",
          });
          return;
        }

        const response = await fetch("/api/crm-users?includeInactive=true");
        const payload = (await response.json()) as unknown;

        if (!response.ok) {
          const apiMessage =
            typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : "Could not load CRM Users.";

          setMatchStatus({
            state: "error",
            authEmail,
            authUserId,
            crmUserName: "",
            crmUserRole: "",
            crmUserStatus: "",
            crmUserCoverageType: "",
            message: apiMessage,
          });
          return;
        }

        const crmUsers =
          Array.isArray(payload)
            ? payload
            : typeof payload === "object" &&
                payload !== null &&
                "users" in payload &&
                Array.isArray((payload as { users?: unknown }).users)
              ? ((payload as { users: unknown[] }).users)
              : [];

        const matchedUser = crmUsers.find((candidate) => {
          if (!candidate || typeof candidate !== "object") {
            return false;
          }

          const record = candidate as CrmUserMatchRecord;
          const crmEmail = getCrmUserMatchField(record, ["email", "user_email", "auth_email"]).toLowerCase();

          return crmEmail === authEmail;
        });

        if (!matchedUser || typeof matchedUser !== "object") {
          setMatchStatus({
            state: "not_matched",
            authEmail,
            authUserId,
            crmUserName: "",
            crmUserRole: "",
            crmUserStatus: "",
            crmUserCoverageType: "",
            message: "Signed-in Supabase Auth email does not currently match a CRM Users record.",
          });
          return;
        }

        const crmUser = matchedUser as CrmUserMatchRecord;
        const crmUserName =
          getCrmUserMatchField(crmUser, ["display_name", "name", "full_name"]) || authEmail;
        const crmUserRole = getCrmUserMatchField(crmUser, ["role", "crm_role", "user_role"]);
        const crmUserStatus = getCrmUserMatchField(crmUser, ["status", "user_status"]);
        const crmUserCoverageType = getCrmUserMatchField(crmUser, ["coverage_type", "coverageType"]);

        setMatchStatus({
          state: "matched",
          authEmail,
          authUserId,
          crmUserName,
          crmUserRole,
          crmUserStatus,
          crmUserCoverageType,
          message: "Signed-in Supabase Auth email matches an active CRM Users record used for production role enforcement.",
        });
      } catch (error) {
        if (!cancelled) {
          setMatchStatus({
            state: "error",
            authEmail: "",
            authUserId: "",
            crmUserName: "",
            crmUserRole: "",
            crmUserStatus: "",
            crmUserCoverageType: "",
            message: error instanceof Error ? error.message : "Could not match signed-in user to CRM Users.",
          });
        }
      }
    }

    loadSignedInCrmUserMatch();

    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel =
    matchStatus.state === "matched"
      ? "Matched"
      : matchStatus.state === "not_matched"
        ? "Not matched"
        : matchStatus.state === "signed_out"
          ? "Signed out"
          : matchStatus.state === "not_configured"
            ? "Not configured"
            : matchStatus.state === "error"
              ? "Error"
              : "Checking";

  const statusClassName =
    matchStatus.state === "matched"
      ? "bg-green-100 text-green-800 ring-green-200"
      : matchStatus.state === "not_matched" || matchStatus.state === "error"
        ? "bg-red-100 text-red-800 ring-red-200"
        : matchStatus.state === "not_configured"
          ? "bg-amber-100 text-amber-800 ring-amber-200"
          : "bg-slate-100 text-slate-800 ring-slate-200";

  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3 text-xs leading-5 text-emerald-900 ring-1 ring-emerald-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-emerald-950">Signed-In CRM User Match</p>
        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${statusClassName}`}>
          {statusLabel}
        </span>
      </div>

      <p className="mt-2">{matchStatus.message}</p>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg bg-emerald-50 p-2">
          <dt className="font-semibold text-emerald-700">Supabase Auth email</dt>
          <dd className="mt-1 break-all text-slate-900">{matchStatus.authEmail || "None detected"}</dd>
        </div>
        <div className="rounded-lg bg-emerald-50 p-2">
          <dt className="font-semibold text-emerald-700">Supabase auth user id</dt>
          <dd className="mt-1 break-all text-slate-900">{matchStatus.authUserId || "None detected"}</dd>
        </div>
        <div className="rounded-lg bg-emerald-50 p-2">
          <dt className="font-semibold text-emerald-700">CRM user</dt>
          <dd className="mt-1 text-slate-900">{matchStatus.crmUserName || "No match"}</dd>
        </div>
        <div className="rounded-lg bg-emerald-50 p-2">
          <dt className="font-semibold text-emerald-700">CRM role</dt>
          <dd className="mt-1 text-slate-900">{matchStatus.crmUserRole || "No role detected"}</dd>
        </div>
        <div className="rounded-lg bg-emerald-50 p-2">
          <dt className="font-semibold text-emerald-700">CRM status</dt>
          <dd className="mt-1 text-slate-900">{matchStatus.crmUserStatus || "No status detected"}</dd>
        </div>
        <div className="rounded-lg bg-emerald-50 p-2">
          <dt className="font-semibold text-emerald-700">Coverage type</dt>
          <dd className="mt-1 text-slate-900">{matchStatus.crmUserCoverageType || "No coverage type detected"}</dd>
        </div>
      </dl>

      <p className="mt-3 text-emerald-800">
        Production permissions, navigation, and record visibility follow the matched CRM user role.
      </p>
    </div>
  );
}


function SignedInCrmRolePreviewPanel() {
  const [rolePreview, setRolePreview] = useState<SignedInCrmRolePreviewStatus>({
    state: "checking",
    authEmail: "",
    crmUserName: "",
    crmUserRole: "",
    crmUserStatus: "",
    permissionPreview: "",
    message: "Checking which CRM role would be applied for the signed-in user.",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSignedInCrmRolePreview() {
      try {
        if (!hasBrowserSupabaseConfig()) {
          if (!cancelled) {
            setRolePreview({
              state: "not_configured",
              authEmail: "",
              crmUserName: "",
              crmUserRole: "",
              crmUserStatus: "",
              permissionPreview: "",
              message: "Browser Supabase configuration is not available in this environment.",
            });
          }
          return;
        }

        const supabase = getBrowserSupabaseClient();
        const { data, error } = await supabase.auth.getSession();

        if (cancelled) {
          return;
        }

        if (error) {
          setRolePreview({
            state: "error",
            authEmail: "",
            crmUserName: "",
            crmUserRole: "",
            crmUserStatus: "",
            permissionPreview: "",
            message: error.message || "Could not read the browser Supabase session.",
          });
          return;
        }

        const authUser = data.session?.user;
        const authEmail = authUser?.email?.trim().toLowerCase() || "";

        if (!authUser || !authEmail) {
          setRolePreview({
            state: "signed_out",
            authEmail: "",
            crmUserName: "",
            crmUserRole: "",
            crmUserStatus: "",
            permissionPreview: "",
            message: "No signed-in Supabase Auth user is available for CRM role preview.",
          });
          return;
        }

        const response = await fetch("/api/crm-users?includeInactive=true");
        const payload = (await response.json()) as unknown;

        if (!response.ok) {
          const apiMessage =
            typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : "Could not load CRM Users.";

          setRolePreview({
            state: "error",
            authEmail,
            crmUserName: "",
            crmUserRole: "",
            crmUserStatus: "",
            permissionPreview: "",
            message: apiMessage,
          });
          return;
        }

        const crmUsers =
          Array.isArray(payload)
            ? payload
            : typeof payload === "object" &&
                payload !== null &&
                "users" in payload &&
                Array.isArray((payload as { users?: unknown }).users)
              ? (payload as { users: unknown[] }).users
              : [];

        const matchedUser = crmUsers.find((candidate) => {
          if (!candidate || typeof candidate !== "object") {
            return false;
          }

          const record = candidate as CrmUserMatchRecord;
          const crmEmail = getCrmUserMatchField(record, ["email", "user_email", "auth_email"]).toLowerCase();

          return crmEmail === authEmail;
        });

        if (!matchedUser || typeof matchedUser !== "object") {
          setRolePreview({
            state: "not_matched",
            authEmail,
            crmUserName: "",
            crmUserRole: "",
            crmUserStatus: "",
            permissionPreview: "",
            message: "No CRM Users record matches the signed-in Supabase Auth email.",
          });
          return;
        }

        const crmUser = matchedUser as CrmUserMatchRecord;
        const crmUserName =
          getCrmUserMatchField(crmUser, ["display_name", "name", "full_name"]) || authEmail;
        const crmUserRole = normalizeCrmRolePreviewValue(
          getCrmUserMatchField(crmUser, ["role", "crm_role", "user_role"])
        );
        const crmUserStatus = getCrmUserMatchField(crmUser, ["status", "user_status"]);
        const normalizedStatus = crmUserStatus.trim().toLowerCase();
        const permissionPreview = getCrmRolePermissionPreview(crmUserRole);
        const roleIsRecognized =
          crmUserRole === "Admin" || crmUserRole === "Sales Manager" || crmUserRole === "Sales Rep";
        const userIsActive = normalizedStatus === "active";

        setRolePreview({
          state: roleIsRecognized && userIsActive ? "ready" : "blocked",
          authEmail,
          crmUserName,
          crmUserRole,
          crmUserStatus,
          permissionPreview,
          message:
            roleIsRecognized && userIsActive
              ? "CRM user is active and has a recognized production role. This role is currently enforced."
              : "CRM user match exists, but role enforcement should remain blocked until the role is recognized and status is Active.",
        });
      } catch (error) {
        if (!cancelled) {
          setRolePreview({
            state: "error",
            authEmail: "",
            crmUserName: "",
            crmUserRole: "",
            crmUserStatus: "",
            permissionPreview: "",
            message: error instanceof Error ? error.message : "Could not preview signed-in CRM role.",
          });
        }
      }
    }

    loadSignedInCrmRolePreview();

    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel =
    rolePreview.state === "ready"
      ? "Ready for enforcement"
      : rolePreview.state === "blocked"
        ? "Blocked"
        : rolePreview.state === "not_matched"
          ? "Not matched"
          : rolePreview.state === "signed_out"
            ? "Signed out"
            : rolePreview.state === "not_configured"
              ? "Not configured"
              : rolePreview.state === "error"
                ? "Error"
                : "Checking";

  const statusClassName =
    rolePreview.state === "ready"
      ? "bg-green-100 text-green-800 ring-green-200"
      : rolePreview.state === "blocked" || rolePreview.state === "not_matched" || rolePreview.state === "error"
        ? "bg-red-100 text-red-800 ring-red-200"
        : rolePreview.state === "not_configured"
          ? "bg-amber-100 text-amber-800 ring-amber-200"
          : "bg-slate-100 text-slate-800 ring-slate-200";

  return (
    <div className="mt-4 rounded-xl border border-purple-200 bg-white p-3 text-xs leading-5 text-purple-900 ring-1 ring-purple-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-purple-950">Signed-In CRM Role Preview</p>
        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${statusClassName}`}>
          {statusLabel}
        </span>
      </div>

      <p className="mt-2">{rolePreview.message}</p>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-purple-50 p-2">
          <dt className="font-semibold text-purple-700">Supabase Auth email</dt>
          <dd className="mt-1 break-all text-slate-900">{rolePreview.authEmail || "None detected"}</dd>
        </div>
        <div className="rounded-lg bg-purple-50 p-2">
          <dt className="font-semibold text-purple-700">CRM user</dt>
          <dd className="mt-1 text-slate-900">{rolePreview.crmUserName || "No match"}</dd>
        </div>
        <div className="rounded-lg bg-purple-50 p-2">
          <dt className="font-semibold text-purple-700">Role to enforce later</dt>
          <dd className="mt-1 text-slate-900">{rolePreview.crmUserRole || "No role detected"}</dd>
        </div>
        <div className="rounded-lg bg-purple-50 p-2">
          <dt className="font-semibold text-purple-700">CRM status</dt>
          <dd className="mt-1 text-slate-900">{rolePreview.crmUserStatus || "No status detected"}</dd>
        </div>
      </dl>

      <div className="mt-3 rounded-lg bg-purple-50 p-3 ring-1 ring-purple-100">
        <p className="font-bold text-purple-950">Permission preview</p>
        <p className="mt-1 text-purple-900">
          {rolePreview.permissionPreview || "No permission preview is available yet."}
        </p>
      </div>

      <p className="mt-3 text-purple-800">
        This panel summarizes the permissions currently applied to the signed-in production CRM user.
      </p>
    </div>
  );
}

function SupabaseEmailPasswordLoginPanel() {
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  async function handleSupabaseEmailPasswordSignIn(event: { preventDefault: () => void }) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");

    try {
      if (!hasBrowserSupabaseConfig()) {
        setAuthMessage("Browser Supabase configuration is not available in this environment.");
        return;
      }

      const supabase = getBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) {
        setAuthMessage(error.message || "Could not sign in with Supabase.");
        return;
      }

      setAuthMessage("Signed in successfully. Refreshing session status.");
      window.location.reload();
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Could not sign in with Supabase.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSupabaseSignOut() {
    setAuthBusy(true);
    setAuthMessage("");

    try {
      if (!hasBrowserSupabaseConfig()) {
        setAuthMessage("Browser Supabase configuration is not available in this environment.");
        return;
      }

      const supabase = getBrowserSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setAuthMessage(error.message || "Could not sign out of Supabase.");
        return;
      }

      setAuthMessage("Signed out successfully. Refreshing session status.");
      window.location.reload();
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Could not sign out of Supabase.");
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-indigo-200 bg-white p-3 text-xs leading-5 text-indigo-900 ring-1 ring-indigo-100">
      <p className="font-bold text-indigo-950">Supabase Email/Password Login</p>
      <p className="mt-1">
        Use this panel to sign in or sign out with a Supabase Authentication account. The email must match an active CRM Users record.
      </p>

      <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={handleSupabaseEmailPasswordSignIn}>
        <input
          className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          type="email"
          value={authEmail}
          onChange={(event) => setAuthEmail(event.target.value)}
          placeholder="Supabase user email"
          autoComplete="email"
        />
        <input
          className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          type="password"
          value={authPassword}
          onChange={(event) => setAuthPassword(event.target.value)}
          placeholder="Password"
          autoComplete="current-password"
        />
        <button
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          type="submit"
          disabled={authBusy || !authEmail.trim() || !authPassword}
        >
          {authBusy ? "Working..." : "Sign in"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={handleSupabaseSignOut}
          disabled={authBusy}
        >
          Sign out
        </button>
        <span className="text-slate-600">
          Match the Supabase Auth email to the CRM Users email before role enforcement is enabled.
        </span>
      </div>

      {authMessage ? (
        <p className="mt-3 rounded-lg bg-indigo-50 p-2 text-indigo-900 ring-1 ring-indigo-100">{authMessage}</p>
      ) : null}
    </div>
  );
}

function AdminUsersSection({
  canManageAdminUsers = false,
  apiPermissionHeaders = () => ({}),
}: {
  canManageAdminUsers?: boolean;
  apiPermissionHeaders?: any;
}) {
  const [users, setUsers] = useState<CrmUser[]>([]);
  const canEditCrmUsers = canManageAdminUsers;
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [userError, setUserError] = useState("");
  const [editingUserId, setEditingUserId] = useState("");
  const [authUsers, setAuthUsers] = useState<any[]>([]);
  const [isLoadingAuthUsers, setIsLoadingAuthUsers] = useState(false);
  const [isSavingAuthUser, setIsSavingAuthUser] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [temporaryPasswords, setTemporaryPasswords] = useState<Record<string, string>>({});
  const [form, setForm] = useState<any>({
    displayName: "",
    roleName: "",
    email: "",
    phone: "",
    notes: "",
    sortOrder: "100",
    status: "active",
    userRole: "sales_rep",
    coverageType: "internal",
  });

  async function loadUsers() {
    setIsLoadingUsers(true);
    setUserError("");

    try {
      const response = await fetch("/api/crm-users?includeInactive=true");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load CRM users.");
      }

      setUsers(data.users ?? []);
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Could not load CRM users.");
    } finally {
      setIsLoadingUsers(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function getVerifiedAuthHeaders() {
    const supabase = getBrowserSupabaseClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error(error.message || "Could not read the signed-in session.");
    }

    const accessToken = data.session?.access_token;

    if (!accessToken) {
      throw new Error("A signed-in Supabase session is required.");
    }

    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  async function loadAuthUsers() {
    if (!canEditCrmUsers) {
      setAuthUsers([]);
      return;
    }

    setIsLoadingAuthUsers(true);
    setAuthError("");

    try {
      const headers = await getVerifiedAuthHeaders();

      const response = await fetch("/api/auth-management", {
        method: "GET",
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load authentication status.");
      }

      setAuthUsers(data.users ?? []);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Could not load authentication status."
      );
    } finally {
      setIsLoadingAuthUsers(false);
    }
  }

  useEffect(() => {
    loadAuthUsers();
  }, [canEditCrmUsers]);

  function authStatusForCrmUser(crmUserId: string) {
    return authUsers.find(
      (authUser) => authUser.crmUserId === crmUserId
    );
  }

  function formatAuthDate(value: unknown) {
    if (!value) return "Never";

    const date = new Date(String(value));

    if (Number.isNaN(date.getTime())) {
      return "Unknown";
    }

    return date.toLocaleString();
  }

  async function createAuthLogin(user: CrmUser) {
    if (!requireAdminPermission()) return;

    const temporaryPassword =
      temporaryPasswords[String(user.id)] || "";

    setIsSavingAuthUser(true);
    setAuthMessage("");
    setAuthError("");

    try {
      if (!temporaryPassword) {
        throw new Error("Enter a temporary password.");
      }

      const headers = await getVerifiedAuthHeaders();

      const response = await fetch("/api/auth-management", {
        method: "POST",
        headers,
        body: JSON.stringify({
          crmUserId: user.id,
          temporaryPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create the Auth login.");
      }

      setTemporaryPasswords((current) => ({
        ...current,
        [String(user.id)]: "",
      }));

      setAuthMessage(
        `Authentication login created for ${user.display_name || user.email}.`
      );

      await loadAuthUsers();
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Could not create the Auth login."
      );
    } finally {
      setIsSavingAuthUser(false);
    }
  }

  async function resetAuthPassword(user: CrmUser) {
    if (!requireAdminPermission()) return;

    const temporaryPassword =
      temporaryPasswords[String(user.id)] || "";

    setIsSavingAuthUser(true);
    setAuthMessage("");
    setAuthError("");

    try {
      if (!temporaryPassword) {
        throw new Error("Enter a new temporary password.");
      }

      const headers = await getVerifiedAuthHeaders();

      const response = await fetch("/api/auth-management", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          crmUserId: user.id,
          temporaryPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not reset the Auth password.");
      }

      setTemporaryPasswords((current) => ({
        ...current,
        [String(user.id)]: "",
      }));

      setAuthMessage(
        `Password reset for ${user.display_name || user.email}.`
      );
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Could not reset the Auth password."
      );
    } finally {
      setIsSavingAuthUser(false);
    }
  }

  function formatCrmUserRoleLabel(role: string) {
    if (role === "admin") return "Admin";
    if (role === "sales_manager") return "Sales Manager";
    if (role === "sales_rep") return "Sales Rep";
    return "User";
  }

  function formatCrmCoverageLabel(coverageType: string) {
    if (coverageType === "outside_rep") return "Outside Rep";
    if (coverageType === "internal") return "Internal";
    return "Internal";
  }

  function resetUserForm() {
    setEditingUserId("");
    setForm({
      displayName: "",
      roleName: "",
      email: "",
      phone: "",
      notes: "",
      sortOrder: "100",
      status: "active",
      userRole: "sales_rep",
      coverageType: "internal",
    });
  }

  function requireAdminPermission() {
    if (canEditCrmUsers) return true;

    setUserMessage("");
    setUserError("CRM user editing is restricted to signed-in Admin users.");
    return false;
  }

  function startEditingUser(user: CrmUser) {
    if (!requireAdminPermission()) return;

    setEditingUserId(user.id);
    setForm({
      displayName: user.display_name,
      roleName: user.role_name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      notes: user.notes ?? "",
      sortOrder: String(user.sort_order ?? 100),
      status: user.status ?? "active",
      userRole: user.user_role ?? "sales_rep",
      coverageType: user.coverage_type ?? "internal",
    });
  }

  async function saveUser() {
    if (!requireAdminPermission()) return;

    setIsSavingUser(true);
    setUserMessage("");
    setUserError("");

    try {
      if (!form.displayName.trim()) {
        throw new Error("Display name is required.");
      }

      const response = await fetch("/api/crm-users", {
        method: editingUserId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
        },
        body: JSON.stringify({
          id: editingUserId || undefined,
          displayName: form.displayName,
          roleName: form.roleName,
          email: form.email,
          phone: form.phone,
          notes: form.notes,
          sortOrder: form.sortOrder,
          status: form.status,
          userRole: form.userRole,
          coverageType: form.coverageType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save CRM user.");
      }

      setUserMessage(editingUserId ? "CRM user updated." : "CRM user created.");
      resetUserForm();
      await loadUsers();
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Could not save CRM user.");
    } finally {
      setIsSavingUser(false);
    }
  }

  async function updateUserStatus(user: CrmUser, status: "active" | "archived") {
    if (!requireAdminPermission()) return;

    setIsSavingUser(true);
    setUserMessage("");
    setUserError("");

    try {
      const response = await fetch("/api/crm-users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
        },
        body: JSON.stringify({
          id: user.id,
          status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update CRM user status.");
      }

      setUserMessage(status === "active" ? "CRM user reactivated." : "CRM user archived.");
      await loadUsers();
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Could not update CRM user status.");
    } finally {
      setIsSavingUser(false);
    }
  }

  const ownerControlsDisabled = !canEditCrmUsers || isSavingUser;

  return (
    <section className="grid gap-6">
      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Admin
            </p>
            <h2 className="mt-2 text-2xl font-bold">Manage CRM Users</h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              Everyone can view CRM users. Creating, editing, archiving, and reactivating CRM users is restricted to signed-in Admin users and backed by server-side API guardrails.
            </p>
          </div>

          <button
            onClick={async () => {
              await loadUsers();
              await loadAuthUsers();
            }}
            disabled={isLoadingUsers || isLoadingAuthUsers}
            className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {isLoadingUsers || isLoadingAuthUsers ? "Refreshing..." : "Refresh Users"}
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-green-950">Signed-In Admin Permission</p>
              <p className="mt-1 text-sm leading-6 text-green-900">
                CRM user editing now depends on the signed-in CRM role. Admin users can create, edit, archive, and reactivate CRM users. Non-admin roles can view users but cannot edit them.
              </p>
            </div>

            <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ring-1 ${
              canEditCrmUsers
                ? "bg-green-100 text-green-800 ring-green-200"
                : "bg-slate-100 text-slate-600 ring-slate-200"
            }`}>
              {canEditCrmUsers ? "Admin permission active" : "View only"}
            </span>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">CRM User Role Guide</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">
              <p className="text-sm font-bold text-blue-950">Admin</p>
              <p className="mt-1 text-xs leading-5 text-blue-900">
                Full CRM access, including users, imports, workflow settings, and sales coverage assignment.
              </p>
            </div>

            <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">
              <p className="text-sm font-bold text-blue-950">Sales Manager</p>
              <p className="mt-1 text-xs leading-5 text-blue-900">
                Broad sales visibility and coverage management, without Admin settings or CRM user administration.
              </p>
            </div>

            <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">
              <p className="text-sm font-bold text-blue-950">Sales Rep</p>
              <p className="mt-1 text-xs leading-5 text-blue-900">
                Assigned-account visibility when role visibility is applied; companies must have Salesperson / Rep coverage.
              </p>
            </div>

            <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">
              <p className="text-sm font-bold text-blue-950">Status</p>
              <p className="mt-1 text-xs leading-5 text-blue-900">
                Active users appear in assignment controls. Archived users are retained for history but should not receive new coverage.
              </p>
            </div>
          </div>
        </div>


        </div>

        {(userMessage || userError || authMessage || authError) && (
          <div className="mt-4 grid gap-2">
            {userMessage && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                {userMessage}
              </div>
            )}
            {authMessage && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                {authMessage}
              </div>
            )}
            {userError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {userError}
              </div>
            )}
            {authError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {authError}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        id="admin-user-form"
        className={
          editingUserId
            ? "fixed inset-y-0 right-0 z-50 w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-2xl ring-1 ring-slate-200"
            : `scroll-mt-24 rounded-2xl bg-white p-6 shadow-sm ${!canEditCrmUsers ? "opacity-75" : ""}`
        }
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-xl font-bold">{editingUserId ? "Edit CRM User" : "Create CRM User"}</h3>
            {editingUserId && (
              <p className="mt-2 text-sm text-slate-600">
                Editing opens in this drawer. Save or cancel to return to the CRM user list.
              </p>
            )}
            {!canEditCrmUsers && (
              <p className="mt-2 text-sm text-slate-600">
                Signed-in Admin permission is required to create or edit CRM users.
              </p>
            )}
          </div>

          {editingUserId && (
            <button
              onClick={resetUserForm}
              disabled={isSavingUser}
              className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              Close
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Display Name</label>
            <input
              type="text"
              value={form.displayName}
              disabled={!canEditCrmUsers}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
              placeholder="Example: Jane Smith"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Role / Function</label>
            <input
              type="text"
              value={form.roleName}
              disabled={!canEditCrmUsers}
              onChange={(event) => setForm({ ...form, roleName: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
              placeholder="Sales"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Sort Order</label>
            <input
              type="number"
              value={form.sortOrder}
              disabled={!canEditCrmUsers}
              onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">User Role</label>
            <select
              value={form.userRole}
              disabled={!canEditCrmUsers}
              onChange={(event) => setForm({ ...form, userRole: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="admin">Admin</option>
              <option value="sales_manager">Sales Manager</option>
              <option value="sales_rep">Sales Rep</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Coverage Type</label>
            <select
              value={form.coverageType}
              disabled={!canEditCrmUsers}
              onChange={(event) => setForm({ ...form, coverageType: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="internal">Internal</option>
              <option value="outside_rep">Outside Rep</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Status</label>
            <select
              value={form.status}
              disabled={!canEditCrmUsers}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Email</label>
            <input
              type="email"
              value={form.email}
              disabled={!canEditCrmUsers}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Phone</label>
            <input
              type="text"
              value={form.phone}
              disabled={!canEditCrmUsers}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          <div className="lg:col-span-5">
            <label className="text-sm font-semibold text-slate-700">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              disabled={!canEditCrmUsers}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
              placeholder="User notes, territory, routing rules, or assignment guidance."
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={saveUser}
            disabled={ownerControlsDisabled}
            className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSavingUser ? "Saving..." : editingUserId ? "Save CRM User" : "Create CRM User"}
          </button>

          {editingUserId && (
            <button
              onClick={resetUserForm}
              disabled={!canEditCrmUsers}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">CRM Users</h3>

        {users.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No CRM users found.</p>
        ) : (
          <div className="mt-5 grid gap-3">
            {users.map((user) => {
              const authStatus = authStatusForCrmUser(String(user.id));

              return (
              <div
                key={user.id}
                className={`rounded-xl border p-4 ${
                  user.status === "archived"
                    ? "border-slate-200 bg-slate-50 opacity-70"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{user.display_name}</p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          user.status === "archived"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {user.status}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          user.user_role === "admin"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {formatCrmUserRoleLabel(user.user_role)}
                      </span>

                      {canEditCrmUsers && (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            authStatus?.hasAuthLogin
                              ? "bg-green-100 text-green-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {authStatus?.hasAuthLogin ? "Login exists" : "No login"}
                        </span>
                      )}

                      {authStatus?.isCurrentAdmin && (
                        <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-800">
                          Current login
                        </span>
                      )}
                    </div>

                    <div className="mt-2 grid gap-1 text-sm text-slate-600">
                      <p>Role / Function: {displayValue(user.role_name)}</p>
                      <p>App Role: {formatCrmUserRoleLabel(user.user_role)}</p>
                      <p>Coverage: {formatCrmCoverageLabel(user.coverage_type)}</p>
                      <p>Email: {displayValue(user.email)}</p>
                      <p>Phone: {displayValue(user.phone)}</p>
                      <p>Sort: {user.sort_order ?? 100}</p>
                    </div>

                    {user.notes && (
                      <p className="mt-3 text-sm leading-6 text-slate-700">{user.notes}</p>
                    )}

                    {canEditCrmUsers && authStatus?.hasAuthLogin && (
                      <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                        <p>
                          Email confirmed: {authStatus.emailConfirmed ? "Yes" : "No"}
                        </p>
                        <p className="mt-1">
                          Last sign-in: {formatAuthDate(authStatus.lastSignInAt)}
                        </p>

                        {user.status === "active" && !authStatus.isCurrentAdmin && (
                          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
                            <label className="text-sm font-semibold text-blue-950">
                              New Temporary Password
                            </label>
                            <input
                              type="password"
                              autoComplete="new-password"
                              value={temporaryPasswords[String(user.id)] || ""}
                              onChange={(event) =>
                                setTemporaryPasswords((current) => ({
                                  ...current,
                                  [String(user.id)]: event.target.value,
                                }))
                              }
                              className="mt-2 w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm"
                              placeholder="Minimum 8 characters"
                            />
                            <button
                              onClick={() => resetAuthPassword(user)}
                              disabled={
                                isSavingAuthUser ||
                                !temporaryPasswords[String(user.id)] ||
                                temporaryPasswords[String(user.id)].length < 8
                              }
                              className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {isSavingAuthUser ? "Resetting Password..." : "Reset Password"}
                            </button>
                            <p className="mt-2 text-xs leading-5 text-blue-900">
                              The new password is sent directly to Supabase and is not stored in the CRM.
                            </p>
                          </div>
                        )}

                        {authStatus.isCurrentAdmin && (
                          <p className="mt-3 rounded-lg border border-purple-200 bg-purple-50 p-2 text-xs font-semibold text-purple-800">
                            Your own password cannot be reset from this Admin page.
                          </p>
                        )}
                      </div>
                    )}

                    {canEditCrmUsers &&
                      user.status === "active" &&
                      !authStatus?.hasAuthLogin && (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                          <label className="text-sm font-semibold text-amber-950">
                            Temporary Password
                          </label>
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={temporaryPasswords[String(user.id)] || ""}
                            onChange={(event) =>
                              setTemporaryPasswords((current) => ({
                                ...current,
                                [String(user.id)]: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                            placeholder="Minimum 8 characters"
                          />
                          <button
                            onClick={() => createAuthLogin(user)}
                            disabled={
                              isSavingAuthUser ||
                              !temporaryPasswords[String(user.id)] ||
                              temporaryPasswords[String(user.id)].length < 8
                            }
                            className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {isSavingAuthUser ? "Creating Login..." : "Create Auth Login"}
                          </button>
                          <p className="mt-2 text-xs leading-5 text-amber-900">
                            The password is sent directly to Supabase and is not stored in the CRM.
                          </p>
                        </div>
                      )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => startEditingUser(user)}
                      disabled={ownerControlsDisabled}
                      className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >Edit User</button>

                    {user.status === "archived" ? (
                      <button
                        onClick={() => updateUserStatus(user, "active")}
                        disabled={ownerControlsDisabled}
                        className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Reactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => updateUserStatus(user, "archived")}
                        disabled={ownerControlsDisabled}
                        className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function AdminTagsSection({
  canManageTags = false,
  apiPermissionHeaders = () => ({}),
}: {
  canManageTags?: boolean;
  apiPermissionHeaders?: any;
}) {
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isSavingTag, setIsSavingTag] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [adminError, setAdminError] = useState("");
  const [editingTagId, setEditingTagId] = useState("");
  const [form, setForm] = useState<any>({
    tagName: "",
    tagType: "market" as "market" | "sector" | "category",
    description: "",
    color: "blue",
    sortOrder: "100",
    status: "active",
  });

  async function loadAdminTags() {
    setIsLoadingTags(true);
    setAdminError("");

    try {
      const response = await fetch("/api/tags?includeInactive=true");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load CRM tags.");
      }

      setTags(data.tags ?? []);
      setSelectedTagIds((current) =>
        current.filter((tagId) => (data.tags ?? []).some((tag: CrmTag) => tag.id === tagId))
      );
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Could not load CRM tags.");
    } finally {
      setIsLoadingTags(false);
    }
  }

  useEffect(() => {
    loadAdminTags();
  }, []);

  const groupedTags = useMemo(() => {
    return {
      market: tags.filter((tag) => tag.tag_type === "market"),
      sector: tags.filter((tag) => tag.tag_type === "sector"),
      category: tags.filter((tag) => tag.tag_type === "category"),
    };
  }, [tags]);

  function resetForm() {
    setEditingTagId("");
    setForm({
      tagName: "",
      tagType: "market",
      description: "",
      color: "blue",
      sortOrder: "100",
      status: "active",
    });
  }

  function startEditingTag(tag: CrmTag) {
    setEditingTagId(tag.id);
    setForm({
      tagName: tag.tag_name,
      tagType: tag.tag_type,
      description: tag.description ?? "",
      color: tag.color ?? "blue",
      sortOrder: String(tag.sort_order ?? 100),
      status: tag.status ?? "active",
    });
  }

  function toggleSelectedTag(tagId: string) {
    setSelectedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId]
    );
  }

  function clearSelectedTags() {
    setSelectedTagIds([]);
  }

  async function saveTag() {
    setIsSavingTag(true);
    setAdminMessage("");
    setAdminError("");

    try {
      if (!form.tagName.trim()) {
        throw new Error("Tag name is required.");
      }

      const response = await fetch("/api/tags", {
        method: editingTagId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
        },
        body: JSON.stringify({
          id: editingTagId || undefined,
          tagName: form.tagName,
          tagType: form.tagType,
          description: form.description,
          color: form.color,
          sortOrder: form.sortOrder,
          status: form.status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save tag.");
      }

      setAdminMessage(editingTagId ? "Tag updated." : "Tag created.");
      resetForm();
      await loadAdminTags();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Could not save tag.");
    } finally {
      setIsSavingTag(false);
    }
  }

  async function updateTagStatus(tagId: string, status: "active" | "archived") {
    const response = await fetch("/api/tags", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...apiPermissionHeaders(),
      },
      body: JSON.stringify({
        id: tagId,
        status,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Could not update tag to ${status}.`);
    }
  }

  async function archiveTag(tag: CrmTag) {
    setIsSavingTag(true);
    setAdminMessage("");
    setAdminError("");

    try {
      await updateTagStatus(tag.id, "archived");
      setAdminMessage("Tag archived.");
      await loadAdminTags();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Could not archive tag.");
    } finally {
      setIsSavingTag(false);
    }
  }

  async function reactivateTag(tag: CrmTag) {
    setIsSavingTag(true);
    setAdminMessage("");
    setAdminError("");

    try {
      await updateTagStatus(tag.id, "active");
      setAdminMessage("Tag reactivated.");
      await loadAdminTags();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Could not reactivate tag.");
    } finally {
      setIsSavingTag(false);
    }
  }

  async function bulkUpdateSelectedTags(status: "active" | "archived") {
    if (selectedTagIds.length === 0) return;

    setIsSavingTag(true);
    setAdminMessage("");
    setAdminError("");

    try {
      await Promise.all(selectedTagIds.map((tagId) => updateTagStatus(tagId, status)));

      setAdminMessage(
        `${selectedTagIds.length} tag${selectedTagIds.length === 1 ? "" : "s"} ${
          status === "archived" ? "archived" : "made active"
        }.`
      );

      setSelectedTagIds([]);
      await loadAdminTags();
    } catch (error) {
      setAdminError(
        error instanceof Error
          ? error.message
          : `Could not update selected tags to ${status}.`
      );
    } finally {
      setIsSavingTag(false);
    }
  }

  return (
    <section className="grid gap-6">
      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Admin
            </p>
            <h2 className="mt-2 text-2xl font-bold">Manage Markets, Sectors, and Categories</h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              Create and maintain the segmentation taxonomy used for company, contact, and import tagging.
              Archive tags instead of deleting them when they may already be attached to CRM records.
            </p>
          </div>

          <button
            onClick={loadAdminTags}
            disabled={isLoadingTags}
            className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {isLoadingTags ? "Refreshing..." : "Refresh Tags"}
          </button>
        </div>

        {(adminMessage || adminError) && (
          <div className="mt-4 grid gap-2">
            {adminMessage && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                {adminMessage}
              </div>
            )}
            {adminError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {adminError}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-bold">Bulk Tag Actions</h3>
            <p className="mt-2 text-sm text-slate-600">
              Select tags in any group below, then archive or reactivate them together.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {selectedTagIds.length} selected
            </span>
            <button
              onClick={() => bulkUpdateSelectedTags("archived")}
              disabled={selectedTagIds.length === 0 || isSavingTag}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Archive Selected
            </button>
            <button
              onClick={() => bulkUpdateSelectedTags("active")}
              disabled={selectedTagIds.length === 0 || isSavingTag}
              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Make Selected Active
            </button>
            <button
              onClick={clearSelectedTags}
              disabled={selectedTagIds.length === 0 || isSavingTag}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              Clear Selection
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">{editingTagId ? "Edit Tag" : "Create Tag"}</h3>

        <div className="mt-5 grid gap-4 lg:grid-cols-5">
          <div>
            <label className="text-sm font-semibold text-slate-700">Type</label>
            <select
              value={form.tagType}
              onChange={(event) =>
                setForm({
                  ...form,
                  tagType: event.target.value as "market" | "sector" | "category",
                })
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="market">Market</option>
              <option value="sector">Sector</option>
              <option value="category">Category</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Name</label>
            <input
              type="text"
              value={form.tagName}
              onChange={(event) => setForm({ ...form, tagName: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              placeholder="Example: Food Processing"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Color</label>
            <input
              type="text"
              value={form.color}
              onChange={(event) => setForm({ ...form, color: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              placeholder="blue"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Sort Order</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">User Role</label>
            <select
              value={form.userRole}
              onChange={(event) => setForm({ ...form, userRole: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="admin">Admin</option>
              <option value="sales_manager">Sales Manager</option>
              <option value="sales_rep">Sales Rep</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Coverage Type</label>
            <select
              value={form.coverageType}
              onChange={(event) => setForm({ ...form, coverageType: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="internal">Internal</option>
              <option value="outside_rep">Outside Rep</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Status</label>
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="lg:col-span-4">
            <label className="text-sm font-semibold text-slate-700">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              placeholder="Describe when this tag should be used."
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={saveTag}
            disabled={isSavingTag}
            className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSavingTag ? "Saving..." : editingTagId ? "Save Changes" : "Create Tag"}
          </button>

          {editingTagId && (
            <button
              onClick={resetForm}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <AdminTagGroup
          title="Markets"
          tags={groupedTags.market}
          selectedTagIds={selectedTagIds}
          isSaving={isSavingTag}
          onToggleSelected={toggleSelectedTag}
          onEdit={startEditingTag}
          onArchive={archiveTag}
          onReactivate={reactivateTag}
        />
        <AdminTagGroup
          title="Sectors"
          tags={groupedTags.sector}
          selectedTagIds={selectedTagIds}
          isSaving={isSavingTag}
          onToggleSelected={toggleSelectedTag}
          onEdit={startEditingTag}
          onArchive={archiveTag}
          onReactivate={reactivateTag}
        />
        <AdminTagGroup
          title="Categories"
          tags={groupedTags.category}
          selectedTagIds={selectedTagIds}
          isSaving={isSavingTag}
          onToggleSelected={toggleSelectedTag}
          onEdit={startEditingTag}
          onArchive={archiveTag}
          onReactivate={reactivateTag}
        />
      </div>
    </section>
  );
}

function AdminTagGroup({
  title,
  tags,
  selectedTagIds,
  isSaving,
  onToggleSelected,
  onEdit,
  onArchive,
  onReactivate,
}: {
  title: string;
  tags: CrmTag[];
  selectedTagIds: string[];
  isSaving: boolean;
  onToggleSelected: (tagId: string) => void;
  onEdit: (tag: CrmTag) => void;
  onArchive: (tag: CrmTag) => void;
  onReactivate: (tag: CrmTag) => void;
}) {

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <h3 className="text-xl font-bold">{title}</h3>

      {tags.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No tags found.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {tags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);

            return (
              <div
                key={tag.id}
                className={`rounded-xl border p-4 ${
                  tag.status === "archived"
                    ? "border-slate-200 bg-slate-50 opacity-70"
                    : isSelected
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelected(tag.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                    aria-label={`Select ${tag.tag_name}`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{tag.tag_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Sort {tag.sort_order ?? 100}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          tag.status === "archived"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {tag.status ?? "active"}
                      </span>
                    </div>

                    {tag.description && (
                      <p className="mt-3 text-sm leading-6 text-slate-600">{tag.description}</p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => onEdit(tag)}
                        disabled={isSaving}
                        className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >Edit Tag</button>

                      {tag.status === "archived" ? (
                        <button
                          onClick={() => onReactivate(tag)}
                          disabled={isSaving}
                          className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => onArchive(tag)}
                          disabled={isSaving}
                          className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OpportunityActivitiesDashboard({
  onOpenCompany,
  opportunityActivityRoleVisibilityActive = false,
  opportunityActivityCurrentUserId = null,
  opportunityActivityCurrentUserRole = "admin",
  opportunityActivityCurrentUserDisplayName = "Signed-in CRM user",
}: {
  onOpenCompany: (companyId: string) => void;
  opportunityActivityRoleVisibilityActive?: boolean;
  opportunityActivityCurrentUserId?: string | null;
  opportunityActivityCurrentUserRole?: AppUserRole;
  opportunityActivityCurrentUserDisplayName?: string;
}) {
  const [activities, setActivities] = useState<Record<string, any>[]>([]);
  const [statusFilter, setStatusFilter] = useState("open");
  const [dueFilter, setDueFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [activityMessage, setActivityMessage] = useState("");
  const [activityError, setActivityError] = useState("");

  function activityApiPermissionHeaders() {
    return {
      "x-crm-user-id": String(opportunityActivityCurrentUserId || ""),
      "x-crm-user-role": String(opportunityActivityCurrentUserRole || "sales_rep"),
      "x-crm-user-name": String(opportunityActivityCurrentUserDisplayName || "Signed-in CRM user"),
    };
  }

  async function loadActivities() {
    setIsLoadingActivities(true);
    setActivityError("");

    try {
      const queryParams = new URLSearchParams();

      if (statusFilter !== "all") queryParams.set("status", statusFilter);
      if (dueFilter !== "all") queryParams.set("due", dueFilter);

      const response = await fetch(`/api/sales-opportunity-activities?${queryParams.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load opportunity activities.");
      }

      setActivities(data.activities ?? []);
    } catch (error) {
      setActivityError(
        error instanceof Error ? error.message : "Could not load opportunity activities."
      );
    } finally {
      setIsLoadingActivities(false);
    }
  }

  useEffect(() => {
    loadActivities();
  }, [statusFilter, dueFilter]);

  const typeOptions = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(
          activities
            .map((activity: any) => activity.activity_type)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    ];
  }, [activities]);

  const filteredActivities = useMemo(() => {
    const search = normalizeForSearch(searchTerm);

    return activities.filter((activity: any) => {
      const opportunity = activity.sales_opportunities;
      const company = activity.companies || opportunity?.companies;
      const contact = activity.contacts;

      const searchableText = [
        activity.activity_type,
        activity.subject,
        activity.notes,
        opportunity?.opportunity_name,
        opportunity?.opportunity_type,
        opportunity?.product_line,
        opportunity?.likely_product_path,
        company?.company_name,
        contact?.full_name,
        contact?.email,
      ]
        .map(normalizeForSearch)
        .join(" ");

      const matchesSearch = !search || searchableText.includes(search);const matchesType = typeFilter === "All" || activity.activity_type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [
    activities,
    searchTerm,
    typeFilter,
    opportunityActivityRoleVisibilityActive,
    opportunityActivityCurrentUserId,
    opportunityActivityCurrentUserRole,
  ]);

  const today = getLocalDateInputValueOffset(0);

  const openCount = activities.filter((activity: any) => !activity.completed_at).length;
  const dueTodayCount = activities.filter(
    (activity) => !activity.completed_at && activity.due_date === today
  ).length;
  const overdueCount = activities.filter(
    (activity) => !activity.completed_at && activity.due_date && activity.due_date < today
  ).length;

  async function completeActivity(activityId: string) {
    setIsSavingActivity(true);
    setActivityMessage("");
    setActivityError("");

    try {
      const response = await fetch("/api/sales-opportunity-activities", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...activityApiPermissionHeaders(),
        },
        body: JSON.stringify({
          activityId,
          completed: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not complete activity.");
      }

      setActivityMessage("Activity completed.");
      await loadActivities();
    } catch (error) {
      setActivityError(error instanceof Error ? error.message : "Could not complete activity.");
    } finally {
      setIsSavingActivity(false);
    }
  }

  function clearActivityFilters() {
    setStatusFilter("open");
    setDueFilter("all");
    setTypeFilter("All");
    setSearchTerm("");
  }

  return (
    <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Opportunity Follow-Ups
          </p>
          <h3 className="mt-2 text-xl font-bold">Activities Dashboard</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Review open tasks, calls, emails, meetings, and quote follow-ups tied to sales opportunities.
          </p>
        </div>

        <button
          onClick={loadActivities}
          disabled={isLoadingActivities}
          className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {isLoadingActivities ? "Refreshing..." : "Refresh Activities"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="Open activities" value={openCount.toString()} note="Not completed" />
        <MetricCard label="Due today" value={dueTodayCount.toString()} note="Open and due today" />
        <MetricCard label="Overdue" value={overdueCount.toString()} note="Open and past due" />
      </div>

      {(activityMessage || activityError) && (
        <div className="mt-4 grid gap-2">
          {activityMessage && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {activityMessage}
            </div>
          )}
          {activityError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {activityError}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-4 lg:grid-cols-5">
<div>
            <label className="text-sm font-semibold text-slate-700">Status</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="open">Open</option>
              <option value="complete">Complete</option>
              <option value="all">All</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Due</label>
            <select
              value={dueFilter}
              onChange={(event) => setDueFilter(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="all">All</option>
              <option value="today">Due Today</option>
              <option value="overdue">Overdue</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Type</label>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              {typeOptions.map((typeOption) => (
                <option key={typeOption} value={typeOption}>
                  {getActivityLabel(typeOption)}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search activity, company, opportunity, contact..."
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            />
          </div>

          <div className="lg:col-span-5">
            <button
              onClick={clearActivityFilters}
              className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
            >
              Clear Activity Filters
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5">
        {filteredActivities.length === 0 ? (
          <p className="text-sm text-slate-600">No opportunity activities match the current filters.</p>
        ) : (
          <div className="grid gap-3">
            {filteredActivities.slice(0, 25).map((activity: any) => {
              const opportunity = activity.sales_opportunities;
              const company = activity.companies || opportunity?.companies;
              const contact = activity.contacts;
              const isOverdue =
                !activity.completed_at && activity.due_date && activity.due_date < today;

              return (
                <div
                  key={activity.id}
                  className={`rounded-xl border p-4 ${
                    activity.completed_at
                      ? "border-slate-200 bg-slate-50 opacity-75"
                      : isOverdue
                        ? "border-red-200 bg-red-50"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                          {getActivityLabel(activity.activity_type)}
                        </span>

                        {activity.due_date && (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isOverdue
                                ? "bg-red-100 text-red-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            Due {formatDate(activity.due_date)}
                          </span>
                        )}

                        {activity.completed_at && (
                          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                            Complete
                          </span>
                        )}
                      </div>

                      <p className="mt-2 font-semibold text-slate-900">
                        {activity.subject || "No subject"}
                      </p>

                      <div className="mt-2 grid gap-1 text-sm text-slate-600">
                        <p>
                          <span className="font-semibold">Company:</span>{" "}
                          {displayValue(company?.company_name)}
                        </p>
                        <p>
                          <span className="font-semibold">Opportunity:</span>{" "}
                          {displayValue(opportunity?.opportunity_name)}
                        </p>
                        <p>
                          <span className="font-semibold">Contact:</span>{" "}
                          {displayValue(contact?.full_name || contact?.email)}
                        </p>
                      </div>

                      {activity.notes && (
                        <p className="mt-3 text-sm leading-6 text-slate-700">{activity.notes}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {company?.id && (
                        <button
                          onClick={() => onOpenCompany(String(company.id))}
                          className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800"
                        >
                          Open Company
                        </button>
                      )}

                      {!activity.completed_at && (
                        <button
                          onClick={() => completeActivity(activity.id)}
                          disabled={isSavingActivity}
                          className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

async function getVerifiedBearerHeaders() {
  if (!hasBrowserSupabaseConfig()) {
    throw new Error("Browser Supabase configuration is not available.");
  }

  const supabase = getBrowserSupabaseClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message || "Could not read the signed-in session.");
  }

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("A signed-in Supabase session is required.");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function FunnelDashboardSection({
  onOpenCompany,
  funnelApplyRoleVisibility = false,
  funnelCurrentUserId = "",
  funnelCurrentUserRole = "admin",
  funnelCurrentUserDisplayName = "Signed-in CRM user",
}: {
  onOpenCompany: (companyId: string) => void;
  funnelApplyRoleVisibility?: boolean;
  funnelCurrentUserId?: string;
  funnelCurrentUserRole?: AppUserRole;
  funnelCurrentUserDisplayName?: string;
}) {
  const [stages, setStages] = useState<SalesFunnelStage[]>([]);
  const [opportunities, setOpportunities] = useState<SalesOpportunity[]>([]);
  const [statusFilter, setStatusFilter] = useState("open");
  const [stageFilter, setStageFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [funnelError, setFunnelError] = useState("");
  const [funnelViewMode, setFunnelViewMode] = useState<"board" | "list">("board");
  const [funnelCardDensity, setFunnelCardDensity] = useState<"comfortable" | "compact">(
    "comfortable"
  );
  const [savedFunnelViews, setSavedFunnelViews] = useState<any[]>([]);
  const [selectedSavedFunnelViewId, setSelectedSavedFunnelViewId] = useState("");
  const [savedFunnelViewName, setSavedFunnelViewName] = useState("");
  const [savedFunnelViewIsDefault, setSavedFunnelViewIsDefault] = useState(false);
  const [isLoadingSavedFunnelViews, setIsLoadingSavedFunnelViews] = useState(false);
  const [isSavingSavedFunnelView, setIsSavingSavedFunnelView] = useState(false);
  const [savedFunnelViewMessage, setSavedFunnelViewMessage] = useState("");
  const [savedFunnelViewError, setSavedFunnelViewError] = useState("");
  const [showSavedFunnelViewManager, setShowSavedFunnelViewManager] = useState(false);
  const [draggedOpportunityId, setDraggedOpportunityId] = useState("");
  const [dragOverStageId, setDragOverStageId] = useState("");
  const [isMovingOpportunity, setIsMovingOpportunity] = useState(false);
  const [stageMoveMessage, setStageMoveMessage] = useState("");
  const [pendingStageAutomation, setPendingStageAutomation] = useState<any | null>(null);
  const [pendingStageAutomationLostReason, setPendingStageAutomationLostReason] = useState("");
  const [isConfirmingStageAutomation, setIsConfirmingStageAutomation] = useState(false);
  const [lastStageMove, setLastStageMove] = useState<{
    opportunityId: string;
    opportunityName: string;
    fromStageId: string;
    fromStageName: string;
    toStageId: string;
    toStageName: string;
  } | null>(null);
  const [isUndoingStageMove, setIsUndoingStageMove] = useState(false);
  const [quickActionOpportunityId, setQuickActionOpportunityId] = useState("");
  const [quickActionMessage, setQuickActionMessage] = useState("");
  const [editingNextStepOpportunityId, setEditingNextStepOpportunityId] = useState("");
  const [quickActionNextStep, setQuickActionNextStep] = useState("");
  const [quickActionNextStepDueDate, setQuickActionNextStepDueDate] = useState("");

  async function loadFunnelDashboard() {
    setIsLoading(true);
    setFunnelError("");

    try {
      const verifiedHeaders = await getVerifiedBearerHeaders();
      const [stagesResponse, opportunitiesResponse] = await Promise.all([
        fetch("/api/funnel-stages"),
        fetch(`/api/sales-opportunities?status=${statusFilter}`, {
          headers: verifiedHeaders,
        }),
      ]);

      const stagesData = await stagesResponse.json();
      const opportunitiesData = await opportunitiesResponse.json();

      if (!stagesResponse.ok) {
        throw new Error(stagesData.error || "Could not load funnel stages.");
      }

      if (!opportunitiesResponse.ok) {
        throw new Error(opportunitiesData.error || "Could not load opportunities.");
      }

      setStages(stagesData.stages ?? []);
      setOpportunities(opportunitiesData.opportunities ?? []);
    } catch (error) {
      setFunnelError(error instanceof Error ? error.message : "Could not load funnel dashboard.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadFunnelDashboard();
  }, [statusFilter]);

  useEffect(() => {
    void loadSavedFunnelViews(true);
  }, []);

  const typeOptions = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(
          opportunities
            .map((opportunity) => opportunity.opportunity_type)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    ];
  }, [
    statusFilter,
    stageFilter,
    typeFilter,
    searchTerm,
  ]);

  function opportunityMatchesRoleVisibility(opportunity: SalesOpportunity) {
    if (!funnelApplyRoleVisibility) return true;
    if (funnelCurrentUserRole === "admin") return true;
    if (funnelCurrentUserRole === "sales_manager") return true;
    if (!funnelCurrentUserId) return true;

    if (funnelCurrentUserRole === "sales_rep") {
      return String(opportunity.companies?.assigned_salesperson_id || "") === funnelCurrentUserId;
    }

    return true;
  }
const filteredOpportunities = useMemo(() => {
    const search = normalizeForSearch(searchTerm);

    return opportunities.filter((opportunity) => {
      const searchableText = [
        opportunity.opportunity_name,
        opportunity.opportunity_type,
        opportunity.product_line,
        opportunity.likely_product_path,
        opportunity.primary_use_case,
        opportunity.next_step,
        opportunity.status,
        opportunity.companies?.company_name,
        opportunity.contacts?.full_name,
        opportunity.contacts?.email,
        ...(Array.isArray(opportunity.related_contacts)
          ? opportunity.related_contacts.flatMap((contact: any) => [
              contact?.full_name,
              contact?.email,
            ])
          : []),
        opportunity.sales_funnel_stages?.stage_name,
      ]
        .map(normalizeForSearch)
        .join(" ");

      const matchesSearch = !search || searchableText.includes(search);const matchesOpportunityRoleVisibility = opportunityMatchesRoleVisibility(opportunity);
      const matchesStage = stageFilter === "All" || opportunity.stage_id === stageFilter;
      const matchesType = typeFilter === "All" || opportunity.opportunity_type === typeFilter;

      return (
        matchesSearch &&
        matchesStage &&
        matchesType &&
        matchesOpportunityRoleVisibility
      );
    });
  }, [
    opportunities,
    searchTerm,
    stageFilter,
    typeFilter,
    funnelApplyRoleVisibility,
    funnelCurrentUserId,
    funnelCurrentUserRole,
  ]);

  const statusCounts = useMemo(() => {
    return {
      open: opportunities.filter((opportunity) => opportunity.status === "open").length,
      won: opportunities.filter((opportunity) => opportunity.status === "won").length,
      lost: opportunities.filter((opportunity) => opportunity.status === "lost").length,
      archived: opportunities.filter((opportunity) => opportunity.status === "archived").length,
      total: opportunities.length,
    };
  }, [
    statusFilter,
    stageFilter,
    typeFilter,
    searchTerm,
  ]);

  const displayedFunnelOpportunities = useMemo(() => {
    if (!funnelApplyRoleVisibility) return filteredOpportunities;
    if (funnelCurrentUserRole === "admin") return filteredOpportunities;
    if (funnelCurrentUserRole === "sales_manager") return filteredOpportunities;
    if (!funnelCurrentUserId) return filteredOpportunities;

    if (funnelCurrentUserRole === "sales_rep") {
      return filteredOpportunities.filter((opportunity) => {
        return String(opportunity.companies?.assigned_salesperson_id || "") === funnelCurrentUserId;
      });
    }

    return filteredOpportunities;
  }, [
    filteredOpportunities,
    funnelApplyRoleVisibility,
    funnelCurrentUserId,
    funnelCurrentUserRole,
  ]);
  const visibleFunnelOpportunityCount = displayedFunnelOpportunities.length;
  const totalFunnelOpportunityCount = filteredOpportunities.length;

  const totalPipelineValue = displayedFunnelOpportunities.reduce((total, opportunity) => {
    return total + Number(opportunity.estimated_value ?? 0);
  }, 0);

  const weightedPipelineValue = displayedFunnelOpportunities.reduce((total, opportunity) => {
    const value = Number(opportunity.estimated_value ?? 0);
    const probability = Number(opportunity.probability ?? 0) / 100;

    return total + value * probability;
  }, 0);

  const averageProbability =
    displayedFunnelOpportunities.length === 0
      ? 0
      : Math.round(
          displayedFunnelOpportunities.reduce((total, opportunity) => {
            return total + Number(opportunity.probability ?? 0);
          }, 0) / displayedFunnelOpportunities.length
        );

  const stageSummaries = useMemo(() => {
    return stages.map((stage) => {
      const stageOpportunities = displayedFunnelOpportunities.filter(
        (opportunity) => opportunity.stage_id === stage.id
      );

      const stageValue = stageOpportunities.reduce((total, opportunity) => {
        return total + Number(opportunity.estimated_value ?? 0);
      }, 0);

      const stageWeightedValue = stageOpportunities.reduce((total, opportunity) => {
        const value = Number(opportunity.estimated_value ?? 0);
        const probability = Number(opportunity.probability ?? stage.default_probability ?? 0) / 100;

        return total + value * probability;
      }, 0);

      return {
        stage,
        count: stageOpportunities.length,
        value: stageValue,
        weightedValue: stageWeightedValue,
      };
    });
  }, [stages, displayedFunnelOpportunities]);

  function formatCurrency(value: number) {
    return value.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  }

  function clearFunnelFilters() {
    setStatusFilter("open");
    setStageFilter("All");
    setTypeFilter("All");
    setSearchTerm("");
    setSelectedSavedFunnelViewId("");
  }

  function applySavedFunnelView(savedView: any) {
    setStatusFilter(String(savedView?.status_filter || "open"));
    setStageFilter(String(savedView?.stage_filter || "All"));
    setTypeFilter(String(savedView?.type_filter || "All"));
    setSearchTerm(String(savedView?.search_term || ""));
    setFunnelViewMode(savedView?.view_mode === "list" ? "list" : "board");
    setFunnelCardDensity(
      savedView?.card_density === "compact" ? "compact" : "comfortable"
    );
    setSelectedSavedFunnelViewId(String(savedView?.id || ""));
    setSavedFunnelViewMessage(
      savedView?.view_name
        ? `Applied saved Funnel view: ${savedView.view_name}.`
        : "Applied saved Funnel view."
    );
    setSavedFunnelViewError("");
  }

  async function loadSavedFunnelViews(applyDefault = false) {
    setIsLoadingSavedFunnelViews(true);
    setSavedFunnelViewError("");

    try {
      const headers = await getVerifiedStageMoveHeaders();
      const response = await fetch("/api/saved-funnel-views", {
        method: "GET",
        headers,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load saved Funnel views.");
      }

      const loadedViews = Array.isArray(data.savedViews) ? data.savedViews : [];
      setSavedFunnelViews(loadedViews);

      if (applyDefault) {
        const defaultView = loadedViews.find((savedView: any) =>
          Boolean(savedView.is_default)
        );

        if (defaultView) {
          applySavedFunnelView(defaultView);
        }
      }
    } catch (error) {
      setSavedFunnelViews([]);
      setSavedFunnelViewError(
        error instanceof Error
          ? error.message
          : "Could not load saved Funnel views."
      );
    } finally {
      setIsLoadingSavedFunnelViews(false);
    }
  }

  async function saveCurrentFunnelView() {
    const viewName = savedFunnelViewName.trim();

    if (!viewName) {
      setSavedFunnelViewError("Enter a name for the saved Funnel view.");
      return;
    }

    setIsSavingSavedFunnelView(true);
    setSavedFunnelViewMessage("");
    setSavedFunnelViewError("");

    try {
      const headers = await getVerifiedStageMoveHeaders();
      const response = await fetch("/api/saved-funnel-views", {
        method: "POST",
        headers,
        body: JSON.stringify({
          viewName,
          isDefault: savedFunnelViewIsDefault,
          viewMode: funnelViewMode,
          cardDensity: funnelCardDensity,
          statusFilter,
          stageFilter,
          typeFilter,
          searchTerm,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save the Funnel view.");
      }

      setSavedFunnelViewName("");
      setSavedFunnelViewIsDefault(false);
      setSavedFunnelViewMessage(`Saved Funnel view: ${viewName}.`);
      await loadSavedFunnelViews(false);
      setSelectedSavedFunnelViewId(String(data.savedView?.id || ""));
    } catch (error) {
      setSavedFunnelViewError(
        error instanceof Error
          ? error.message
          : "Could not save the Funnel view."
      );
    } finally {
      setIsSavingSavedFunnelView(false);
    }
  }

  async function renameSavedFunnelView(savedView: any) {
    const currentName = String(savedView?.view_name || "");
    const nextName =
      typeof window !== "undefined"
        ? window.prompt("Rename saved Funnel view:", currentName)
        : null;

    if (nextName === null) return;

    const cleanedName = nextName.trim();

    if (!cleanedName) {
      setSavedFunnelViewError("Saved Funnel view names cannot be blank.");
      return;
    }

    await updateSavedFunnelView(savedView, {
      viewName: cleanedName,
    });
  }

  async function updateSavedFunnelView(
    savedView: any,
    patch: Record<string, unknown>
  ) {
    setIsSavingSavedFunnelView(true);
    setSavedFunnelViewMessage("");
    setSavedFunnelViewError("");

    try {
      const headers = await getVerifiedStageMoveHeaders();
      const response = await fetch("/api/saved-funnel-views", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          id: savedView.id,
          ...patch,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update the saved Funnel view.");
      }

      setSavedFunnelViewMessage(
        `Updated saved Funnel view: ${data.savedView?.view_name || savedView.view_name}.`
      );
      await loadSavedFunnelViews(false);
    } catch (error) {
      setSavedFunnelViewError(
        error instanceof Error
          ? error.message
          : "Could not update the saved Funnel view."
      );
    } finally {
      setIsSavingSavedFunnelView(false);
    }
  }

  async function saveCurrentSettingsToExistingView(savedView: any) {
    await updateSavedFunnelView(savedView, {
      viewMode: funnelViewMode,
      cardDensity: funnelCardDensity,
      statusFilter,
      stageFilter,
      typeFilter,
      searchTerm,
    });
  }

  async function setDefaultSavedFunnelView(savedView: any) {
    await updateSavedFunnelView(savedView, {
      isDefault: !Boolean(savedView.is_default),
    });
  }

  async function deleteSavedFunnelView(savedView: any) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Delete saved Funnel view "${String(savedView?.view_name || "")}"?`
      )
    ) {
      return;
    }

    setIsSavingSavedFunnelView(true);
    setSavedFunnelViewMessage("");
    setSavedFunnelViewError("");

    try {
      const headers = await getVerifiedStageMoveHeaders();
      const response = await fetch(
        `/api/saved-funnel-views?id=${encodeURIComponent(
          String(savedView.id)
        )}`,
        {
          method: "DELETE",
          headers,
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not delete the saved Funnel view.");
      }

      if (selectedSavedFunnelViewId === String(savedView.id)) {
        setSelectedSavedFunnelViewId("");
      }

      setSavedFunnelViewMessage(
        `Deleted saved Funnel view: ${String(savedView.view_name || "")}.`
      );
      await loadSavedFunnelViews(false);
    } catch (error) {
      setSavedFunnelViewError(
        error instanceof Error
          ? error.message
          : "Could not delete the saved Funnel view."
      );
    } finally {
      setIsSavingSavedFunnelView(false);
    }
  }

  async function getVerifiedStageMoveHeaders() {
    if (!hasBrowserSupabaseConfig()) {
      throw new Error("Browser Supabase configuration is not available.");
    }

    const supabase = getBrowserSupabaseClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error(error.message || "Could not read the signed-in session.");
    }

    const accessToken = data.session?.access_token;

    if (!accessToken) {
      throw new Error("A signed-in Supabase session is required.");
    }

    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  function startQuickNextStepEdit(opportunity: SalesOpportunity) {
    setEditingNextStepOpportunityId(String(opportunity.id));
    setQuickActionNextStep(String(opportunity.next_step || ""));
    setQuickActionNextStepDueDate(String(opportunity.next_step_due_date || ""));
    setQuickActionMessage("");
    setFunnelError("");
  }

  function cancelQuickNextStepEdit() {
    setEditingNextStepOpportunityId("");
    setQuickActionNextStep("");
    setQuickActionNextStepDueDate("");
  }

  async function applyOpportunityQuickAction(
    opportunity: SalesOpportunity,
    action: "mark_won" | "mark_lost" | "update_next_step"
  ) {
    const opportunityId = String(opportunity.id);

    if (action === "mark_won" || action === "mark_lost") {
      const destinationStage = stages.find((stage) =>
        action === "mark_won"
          ? Boolean((stage as any).is_won_stage)
          : Boolean((stage as any).is_lost_stage)
      );

      if (!destinationStage?.id) {
        setFunnelError(
          action === "mark_won"
            ? "No active Won stage is available."
            : "No active Lost stage is available."
        );
        return;
      }

      void moveOpportunityToStage(
        opportunityId,
        String(destinationStage.id),
        {
          forceConfirmation: true,
          outcomeAction: action,
        }
      );
      return;
    }

    if (
      action === "update_next_step" &&
      (!quickActionNextStep.trim() || !quickActionNextStepDueDate)
    ) {
      setFunnelError("Next step and next step due date are required.");
      return;
    }

    setQuickActionOpportunityId(opportunityId);
    setQuickActionMessage("");
    setStageMoveMessage("");
    setFunnelError("");

    try {
      const headers = await getVerifiedStageMoveHeaders();
      const response = await fetch("/api/sales-opportunity-quick-action", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          opportunityId,
          action,
          ...(action === "update_next_step"
            ? {
                nextStep: quickActionNextStep.trim(),
                nextStepDueDate: quickActionNextStepDueDate,
              }
            : {}),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not apply the opportunity quick action.");
      }

      setQuickActionMessage(
        `Next step updated for ${opportunity.opportunity_name}.`
      );

      if (action === "update_next_step") {
        cancelQuickNextStepEdit();
      }

      await loadFunnelDashboard();
    } catch (error) {
      setFunnelError(
        error instanceof Error
          ? error.message
          : "Could not apply the opportunity quick action."
      );
    } finally {
      setQuickActionOpportunityId("");
    }
  }

  async function executeOpportunityStageMove(
    opportunity: any,
    stageId: string,
    confirmAutomation: boolean,
    lostReason = ""
  ) {
    const opportunityId = String(opportunity.id);
    const previousOpportunities = opportunities;
    const previousStageId = String(opportunity.stage_id || "");
    const previousStage = stages.find((stage) => String(stage.id) === previousStageId);
    const destinationStage = stages.find((stage) => String(stage.id) === stageId);

    setFunnelError("");
    setStageMoveMessage("");
    setIsMovingOpportunity(true);

    setOpportunities((current) =>
      current.map((item) =>
        String(item.id) === opportunityId
          ? {
              ...item,
              stage_id: stageId,
              sales_funnel_stages: destinationStage
                ? {
                    ...(item.sales_funnel_stages ?? {}),
                    ...destinationStage,
                  }
                : item.sales_funnel_stages,
            }
          : item
      )
    );

    try {
      const headers = await getVerifiedStageMoveHeaders();
      const response = await fetch("/api/sales-opportunity-stage-move", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          opportunityId,
          stageId,
          mode: "execute",
          confirmAutomation,
          lostReason: lostReason.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not move opportunity.");
      }

      setLastStageMove({
        opportunityId,
        opportunityName: opportunity.opportunity_name,
        fromStageId: previousStageId,
        fromStageName: previousStage?.stage_name || "the previous stage",
        toStageId: stageId,
        toStageName: destinationStage?.stage_name || "the selected stage",
      });

      const activityMessage = data.automation?.activityCreated
        ? ` Follow-up activity created for ${formatDate(data.automation.dueDate)}.`
        : "";

      setStageMoveMessage(
        `Moved ${opportunity.opportunity_name} to ${
          destinationStage?.stage_name || "the selected stage"
        }.${activityMessage}`
      );

      setPendingStageAutomation(null);
      await loadFunnelDashboard();
    } catch (error) {
      setOpportunities(previousOpportunities);
      setFunnelError(
        error instanceof Error ? error.message : "Could not move opportunity."
      );
    } finally {
      setDraggedOpportunityId("");
      setDragOverStageId("");
      setIsMovingOpportunity(false);
      setIsConfirmingStageAutomation(false);
    }
  }

  async function moveOpportunityToStage(
    opportunityId: string,
    stageId: string,
    options?: {
      forceConfirmation?: boolean;
      outcomeAction?: "mark_won" | "mark_lost";
    }
  ) {
    const opportunity = opportunities.find((item) => String(item.id) === opportunityId);

    if (!opportunity || String(opportunity.stage_id || "") === stageId) {
      setDraggedOpportunityId("");
      setDragOverStageId("");
      return;
    }

    setFunnelError("");
    setStageMoveMessage("");
    setIsMovingOpportunity(true);

    try {
      const headers = await getVerifiedStageMoveHeaders();
      const response = await fetch("/api/sales-opportunity-stage-move", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          opportunityId,
          stageId,
          mode: "preview",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not preview opportunity move.");
      }

      if (
        data.automation?.requireConfirmation ||
        data.automation?.requireLostReason ||
        options?.forceConfirmation
      ) {
        setPendingStageAutomationLostReason("");
        setPendingStageAutomation({
          opportunity,
          opportunityId,
          stageId,
          destinationStageName: data.stage?.stageName || "the selected stage",
          automation: data.automation,
          outcomeAction: options?.outcomeAction || null,
        });
        return;
      }

      await executeOpportunityStageMove(
        opportunity,
        stageId,
        Boolean(data.automation)
      );
    } catch (error) {
      setFunnelError(
        error instanceof Error
          ? error.message
          : "Could not preview opportunity move."
      );
    } finally {
      setDraggedOpportunityId("");
      setDragOverStageId("");
      setIsMovingOpportunity(false);
    }
  }

  async function confirmPendingStageAutomation() {
    if (!pendingStageAutomation || isConfirmingStageAutomation) return;

    if (
      pendingStageAutomation.automation?.requireLostReason &&
      !pendingStageAutomationLostReason.trim()
    ) {
      setFunnelError("Enter a lost reason before confirming this move.");
      return;
    }

    setFunnelError("");
    setIsConfirmingStageAutomation(true);

    await executeOpportunityStageMove(
      pendingStageAutomation.opportunity,
      pendingStageAutomation.stageId,
      Boolean(pendingStageAutomation.automation),
      pendingStageAutomationLostReason
    );
  }

  function cancelPendingStageAutomation() {
    if (isConfirmingStageAutomation) return;
    setPendingStageAutomation(null);
    setPendingStageAutomationLostReason("");
    setStageMoveMessage("Stage move cancelled.");
  }

  async function undoLastStageMove() {
    if (!lastStageMove || isUndoingStageMove) return;

    setFunnelError("");
    setStageMoveMessage("");
    setIsUndoingStageMove(true);

    try {
      const headers = await getVerifiedStageMoveHeaders();
      const response = await fetch("/api/sales-opportunity-stage-move", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          opportunityId: lastStageMove.opportunityId,
          stageId: lastStageMove.fromStageId,
          mode: "execute",
          isUndo: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not undo the stage move.");
      setStageMoveMessage(`Returned ${lastStageMove.opportunityName} to ${lastStageMove.fromStageName}.`);
      setLastStageMove(null);
      await loadFunnelDashboard();
    } catch (error) {
      setFunnelError(error instanceof Error ? error.message : "Could not undo the stage move.");
    } finally {
      setIsUndoingStageMove(false);
    }
  }

  function getCloseDateStatus(closeDate: string | null | undefined) {
    if (!closeDate) return { label: "No close date", className: "text-slate-500" };
    const closeDay = new Date(`${closeDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(closeDay.getTime())) return { label: formatDate(closeDate), className: "text-slate-600" };
    if (closeDay.getTime() < today.getTime()) return { label: `Overdue · ${formatDate(closeDate)}`, className: "font-semibold text-red-700" };
    if (closeDay.getTime() === today.getTime()) return { label: `Due today · ${formatDate(closeDate)}`, className: "font-semibold text-amber-700" };
    return { label: formatDate(closeDate), className: "text-slate-600" };
  }

  function handleOpportunityDragStart(event: any, opportunityId: string) {
    setDraggedOpportunityId(opportunityId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", opportunityId);
  }

  function handleStageDrop(event: any, stageId: string) {
    event.preventDefault();
    const opportunityId =
      event.dataTransfer.getData("text/plain") || draggedOpportunityId;

    if (opportunityId) {
      void moveOpportunityToStage(opportunityId, stageId);
    }
  }

  return (
    <section className="grid gap-6">
      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Sales Funnel
            </p>
            <h2 className="mt-2 text-2xl font-bold">Pipeline Dashboard</h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              Track opportunities by stage, status, product path, probability, expected value, and next step.
            </p>
          </div>

          <button
            onClick={loadFunnelDashboard}
            disabled={isLoading}
            className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {isLoading ? "Refreshing..." : "Refresh Funnel"}
          </button>
        </div>

        {funnelError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {funnelError}
          </div>
        )}

        {stageMoveMessage && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {stageMoveMessage}
          </div>
        )}

        {quickActionMessage && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            {quickActionMessage}
          </div>
        )}

        {showSavedFunnelViewManager && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="saved-funnel-view-manager-title"
          >
            <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                    Funnel Preferences
                  </p>
                  <h3
                    id="saved-funnel-view-manager-title"
                    className="mt-1 text-xl font-bold text-slate-900"
                  >
                    Manage Saved Funnel Views
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSavedFunnelViewManager(false)}
                  className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              {savedFunnelViews.length === 0 ? (
                <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  No saved Funnel views yet.
                </p>
              ) : (
                <div className="mt-5 grid gap-3">
                  {savedFunnelViews.map((savedView: any) => (
                    <div
                      key={savedView.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-slate-900">
                              {savedView.view_name}
                            </h4>
                            {savedView.is_default && (
                              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            {savedView.view_mode === "list" ? "List" : "Board"} ·{" "}
                            {savedView.card_density === "compact"
                              ? "Compact"
                              : "Comfortable"}{" "}
                            · Status: {savedView.status_filter} · Stage:{" "}
                            {savedView.stage_filter} · Type: {savedView.type_filter}
                          </p>
                          {savedView.search_term && (
                            <p className="mt-1 text-xs text-slate-600">
                              Search: {savedView.search_term}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              applySavedFunnelView(savedView);
                              setShowSavedFunnelViewManager(false);
                            }}
                            className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              saveCurrentSettingsToExistingView(savedView)
                            }
                            disabled={isSavingSavedFunnelView}
                            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 disabled:bg-slate-100"
                          >
                            Update from Current
                          </button>
                          <button
                            type="button"
                            onClick={() => renameSavedFunnelView(savedView)}
                            disabled={isSavingSavedFunnelView}
                            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 disabled:bg-slate-100"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => setDefaultSavedFunnelView(savedView)}
                            disabled={isSavingSavedFunnelView}
                            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 disabled:bg-slate-100"
                          >
                            {savedView.is_default
                              ? "Clear Default"
                              : "Make Default"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSavedFunnelView(savedView)}
                            disabled={isSavingSavedFunnelView}
                            className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:bg-slate-400"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {pendingStageAutomation && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stage-automation-preview-title"
          >
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                {pendingStageAutomation.automation
                  ? "Workflow Automation Preview"
                  : "Opportunity Outcome Confirmation"}
              </p>
              <h3
                id="stage-automation-preview-title"
                className="mt-2 text-xl font-bold text-slate-900"
              >
                Confirm move to {pendingStageAutomation.destinationStageName}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Confirm this stage change for{" "}
                <span className="font-semibold text-slate-900">
                  {pendingStageAutomation.opportunity?.opportunity_name}
                </span>.
              </p>

              {pendingStageAutomation.automation ? (
                <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div>
                    <span className="font-semibold text-slate-700">Rule:</span>{" "}
                    {pendingStageAutomation.automation.ruleName}
                  </div>
                  {pendingStageAutomation.automation.createActivity && (
                    <>
                      <div>
                        <span className="font-semibold text-slate-700">Activity type:</span>{" "}
                        {formatTitleFromKey(
                          pendingStageAutomation.automation.activityType || "task"
                        )}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700">Subject:</span>{" "}
                        {pendingStageAutomation.automation.activitySubject || "No subject"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700">Due date:</span>{" "}
                        {pendingStageAutomation.automation.dueDate
                          ? formatDate(pendingStageAutomation.automation.dueDate)
                          : "No due date"}
                      </div>
                      {pendingStageAutomation.automation.activityNotes && (
                        <div>
                          <span className="font-semibold text-slate-700">Notes:</span>
                          <p className="mt-1 whitespace-pre-wrap leading-6 text-slate-600">
                            {pendingStageAutomation.automation.activityNotes}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {!pendingStageAutomation.automation.createActivity && (
                    <div className="text-slate-600">
                      This rule changes the opportunity stage without creating an activity.
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No enabled workflow automation applies to this outcome.
                </div>
              )}

              {pendingStageAutomation.automation?.requireLostReason && (
                <div className="mt-5">
                  <label
                    htmlFor="pending-stage-lost-reason"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Lost Reason
                  </label>
                  <textarea
                    id="pending-stage-lost-reason"
                    rows={4}
                    value={pendingStageAutomationLostReason}
                    onChange={(event) =>
                      setPendingStageAutomationLostReason(event.target.value)
                    }
                    placeholder="Explain why this opportunity was lost."
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                  />
                  {!pendingStageAutomationLostReason.trim() && (
                    <p className="mt-2 text-xs font-semibold text-red-700">
                      Lost reason is required.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelPendingStageAutomation}
                  disabled={isConfirmingStageAutomation}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  Cancel Move
                </button>
                <button
                  type="button"
                  onClick={confirmPendingStageAutomation}
                  disabled={
                    isConfirmingStageAutomation ||
                    (pendingStageAutomation.automation?.requireLostReason &&
                      !pendingStageAutomationLostReason.trim())
                  }
                  className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isConfirmingStageAutomation
                    ? "Confirming..."
                    : pendingStageAutomation.automation?.createActivity
                      ? "Confirm Move and Create Activity"
                      : "Confirm Move"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Filtered opportunities"
          value={displayedFunnelOpportunities.length.toString()}
          note={`Open ${statusCounts.open} - Won ${statusCounts.won} - Lost ${statusCounts.lost}`}
        />
        <MetricCard
          label="Pipeline value"
          value={formatCurrency(totalPipelineValue)}
          note="Estimated value before probability"
        />
        <MetricCard
          label="Weighted value"
          value={formatCurrency(weightedPipelineValue)}
          note="Estimated value of open opportunities."
        />
        <MetricCard
          label="Avg. probability"
          value={`${averageProbability}%`}
          note="Average across filtered opportunities"
        />
      </div>

      {funnelApplyRoleVisibility && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-bold">Funnel opportunities are filtered by current role visibility.</p>
          <p className="mt-1">
            Current user: <span className="font-semibold">{funnelCurrentUserDisplayName}</span>
            {" - "}
            <span className="font-semibold">{formatAppUserRole(funnelCurrentUserRole)}</span>
          </p>
          <p className="mt-1 text-xs leading-5">
            Admins and Sales Managers see all funnel opportunities. Sales Reps see opportunities where the related company is assigned to them as Salesperson / Rep.
          </p>
          <p className="mt-2 rounded-lg bg-white p-2 text-xs font-semibold text-blue-900 ring-1 ring-blue-100">
            Funnel visibility reason: {getRoleVisibilityReason(funnelCurrentUserRole, funnelCurrentUserDisplayName)}
          </p>
        </div>
      )}

      <div className="sticky top-2 z-30 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-bold">Funnel Controls</h3>
            <p className="mt-1 text-xs text-slate-500">
              Filters and board controls remain visible while you scroll.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">
              <button
                type="button"
                onClick={() => setFunnelViewMode("board")}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  funnelViewMode === "board"
                    ? "bg-white text-blue-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Board
              </button>
              <button
                type="button"
                onClick={() => setFunnelViewMode("list")}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  funnelViewMode === "list"
                    ? "bg-white text-blue-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                List
              </button>
            </div>

            {funnelViewMode === "board" && (
              <div className="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">
                <button
                  type="button"
                  onClick={() => setFunnelCardDensity("comfortable")}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    funnelCardDensity === "comfortable"
                      ? "bg-white text-blue-800 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Comfortable
                </button>
                <button
                  type="button"
                  onClick={() => setFunnelCardDensity("compact")}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    funnelCardDensity === "compact"
                      ? "bg-white text-blue-800 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Compact
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={loadFunnelDashboard}
              disabled={isLoading}
              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-5">
<div>
            <label className="text-sm font-semibold text-slate-700">Status</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1.5 w-full max-w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Stage</label>
            <select
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value)}
              className="mt-1.5 w-full max-w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="All">All</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.stage_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Opportunity Type</label>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="mt-1.5 w-full max-w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {typeOptions.map((typeOption) => (
                <option key={typeOption} value={typeOption}>
                  {typeOption}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search company, opportunity, product path, contact, next step..."
              className="mt-1.5 w-full max-w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="lg:col-span-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="min-w-[220px] flex-1">
              <label className="text-sm font-semibold text-slate-700">
                Saved Funnel View
              </label>
              <select
                value={selectedSavedFunnelViewId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setSelectedSavedFunnelViewId(nextId);
                  const savedView = savedFunnelViews.find(
                    (item: any) => String(item.id) === nextId
                  );
                  if (savedView) applySavedFunnelView(savedView);
                }}
                disabled={isLoadingSavedFunnelViews}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="">
                  {isLoadingSavedFunnelViews
                    ? "Loading saved views..."
                    : "Choose a saved view"}
                </option>
                {savedFunnelViews.map((savedView: any) => (
                  <option key={savedView.id} value={savedView.id}>
                    {savedView.is_default ? "Default: " : ""}
                    {savedView.view_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[220px] flex-1">
              <label className="text-sm font-semibold text-slate-700">
                Save Current View As
              </label>
              <input
                type="text"
                value={savedFunnelViewName}
                onChange={(event) => setSavedFunnelViewName(event.target.value)}
                placeholder="Example: Open Quotes"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </div>

            <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              <input
                type="checkbox"
                checked={savedFunnelViewIsDefault}
                onChange={(event) =>
                  setSavedFunnelViewIsDefault(event.target.checked)
                }
              />
              Make default
            </label>

            <button
              type="button"
              onClick={saveCurrentFunnelView}
              disabled={isSavingSavedFunnelView}
              className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSavingSavedFunnelView ? "Saving..." : "Save View"}
            </button>

            <button
              type="button"
              onClick={() => setShowSavedFunnelViewManager(true)}
              className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100"
            >
              Manage Views
            </button>

            <button
              type="button"
              onClick={clearFunnelFilters}
              className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-900"
            >
              Clear Funnel Filters
            </button>
          </div>

          {(savedFunnelViewMessage || savedFunnelViewError) && (
            <div className="lg:col-span-5">
              {savedFunnelViewMessage && (
                <p className="text-sm font-semibold text-green-700">
                  {savedFunnelViewMessage}
                </p>
              )}
              {savedFunnelViewError && (
                <p className="text-sm font-semibold text-red-700">
                  {savedFunnelViewError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">Stage Summary</h3>

        {stageSummaries.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No funnel stages loaded.</p>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            {stageSummaries.map((summary) => (
              <button
                key={summary.stage.id}
                onClick={() => setStageFilter(summary.stage.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  stageFilter === summary.stage.id
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-blue-200"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900 break-words">{summary.stage.stage_name}</p>
                <p className="mt-2 text-2xl font-bold">{summary.count}</p>
                <div className="mt-3 grid gap-1 text-xs text-slate-600">
                  <p>Value: {formatCurrency(summary.value)}</p>
                  <p>Weighted: {formatCurrency(summary.weightedValue)}</p>
                  <p>Default probability: {summary.stage.default_probability}%</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <OpportunityActivitiesDashboard
        onOpenCompany={onOpenCompany}
        opportunityActivityRoleVisibilityActive={funnelApplyRoleVisibility}
        opportunityActivityCurrentUserId={funnelCurrentUserId}
        opportunityActivityCurrentUserRole={funnelCurrentUserRole}
        opportunityActivityCurrentUserDisplayName={funnelCurrentUserDisplayName}
      />

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-xl font-bold">Opportunities</h3>
            <p className="mt-2 text-sm text-slate-600">
              Showing {visibleFunnelOpportunityCount} of {totalFunnelOpportunityCount} opportunities under the current filters and role visibility scope.
            </p>
          </div>

          {lastStageMove && (
            <button
              type="button"
              onClick={undoLastStageMove}
              disabled={isUndoingStageMove || isMovingOpportunity}
              className="w-fit rounded-xl bg-green-50 px-4 py-2 text-xs font-bold text-green-800 shadow-sm ring-1 ring-green-300 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUndoingStageMove ? "Undoing..." : `Undo to ${lastStageMove.fromStageName}`}
            </button>
          )}
        </div>

        {funnelViewMode === "board" && (
          <div className="mt-5 max-w-full overflow-x-auto pb-3">
            <div className="flex min-w-max gap-4">
              {stageSummaries.map((summary) => {
                const stageOpportunities = displayedFunnelOpportunities.filter(
                  (opportunity) => String(opportunity.stage_id || "") === String(summary.stage.id)
                );

                return (
                  <section
                    key={summary.stage.id}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverStageId(String(summary.stage.id));
                    }}
                    onDragLeave={() => setDragOverStageId("")}
                    onDrop={(event) => handleStageDrop(event, String(summary.stage.id))}
                    className={`shrink-0 rounded-2xl border transition ${
                      funnelCardDensity === "compact" ? "w-[275px] p-2" : "w-[310px] p-3"
                    } ${
                      dragOverStageId === String(summary.stage.id)
                        ? "border-blue-400 bg-blue-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className={`rounded-xl bg-white shadow-sm ring-1 ring-slate-200 ${
                      funnelCardDensity === "compact" ? "p-2" : "p-3"
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-slate-900">{summary.stage.stage_name}</h4>
                          <p className="mt-1 text-xs text-slate-500">
                            {summary.count} opportunities
                          </p>
                        </div>
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">
                          {formatCurrency(summary.value)}
                        </span>
                      </div>
                    </div>

                    <div className={`grid min-h-[120px] ${
                      funnelCardDensity === "compact" ? "mt-2 gap-2" : "mt-3 gap-3"
                    }`}>
                      {stageOpportunities.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
                          Drop an opportunity here
                        </div>
                      ) : (
                        stageOpportunities.map((opportunity) => {
                          const companyId = opportunity.companies?.id;
                          const value = Number(opportunity.estimated_value ?? 0);
                          const closeDateStatus = getCloseDateStatus(opportunity.expected_close_date);

                          const nextStepMissing = !opportunity.next_step || !opportunity.next_step_due_date;

                          const nextStepOverdue =

                            !nextStepMissing &&

                            String(opportunity.next_step_due_date) < new Date().toISOString().slice(0, 10);

                          return (
                            <article
                              key={opportunity.id}
                              onClick={() => {
                                if (companyId) onOpenCompany(String(companyId));
                              }}
                              className={`rounded-xl border bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md ${
                                funnelCardDensity === "compact" ? "p-3" : "p-4"
                              } ${
                                companyId ? "cursor-pointer" : "cursor-default"
                              } ${
                                draggedOpportunityId === String(opportunity.id)
                                  ? "opacity-50"
                                  : "opacity-100"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="break-words font-bold text-slate-900">
                                    {opportunity.opportunity_name}
                                  </p>
                                  <p className="mt-1 break-words text-xs text-slate-500">
                                    {displayValue(opportunity.companies?.company_name)}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  draggable={!isMovingOpportunity}
                                  onDragStart={(event) => {
                                    event.stopPropagation();
                                    handleOpportunityDragStart(event, String(opportunity.id));
                                  }}
                                  onDragEnd={() => {
                                    setDraggedOpportunityId("");
                                    setDragOverStageId("");
                                  }}
                                  onClick={(event) => event.stopPropagation()}
                                  disabled={isMovingOpportunity}
                                  title="Drag opportunity to another stage"
                                  className="shrink-0 cursor-grab rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 active:cursor-grabbing disabled:cursor-not-allowed"
                                >
                                  <span aria-hidden="true">Drag</span>
                                </button>
                              </div>

                              <div className={`flex flex-wrap gap-2 ${
                                funnelCardDensity === "compact" ? "mt-2" : "mt-3"
                              }`}>
                                <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                                  {formatCurrency(value)}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                  {opportunity.probability ?? 0}%
                                </span>
                              </div>

                              <p className={`break-words text-xs text-slate-600 ${
                                funnelCardDensity === "compact" ? "mt-2 leading-4" : "mt-3 leading-5"
                              }`}>
                                {displayValue(
                                  opportunity.likely_product_path ||
                                    opportunity.product_line ||
                                    opportunity.opportunity_type
                                )}
                              </p>

                              {(opportunity.contact?.full_name ||
                                opportunity.contacts?.full_name ||
                                (Array.isArray(opportunity.related_contacts) &&
                                  opportunity.related_contacts.length > 0)) && (
                                <div className={`rounded-lg bg-slate-50 text-xs text-slate-600 ${
                                  funnelCardDensity === "compact" ? "mt-2 p-2" : "mt-3 p-3"
                                }`}>
                                  <p>
                                    <span className="font-semibold">Primary:</span>{" "}
                                    {opportunity.contact?.full_name ||
                                      opportunity.contacts?.full_name ||
                                      "None selected"}
                                  </p>
                                  <p className="mt-1 break-words">
                                    <span className="font-semibold">Related:</span>{" "}
                                    {Array.isArray(opportunity.related_contacts) &&
                                    opportunity.related_contacts.length > 0
                                      ? opportunity.related_contacts
                                          .map((contact: any) =>
                                            String(contact?.full_name || contact?.email || "")
                                          )
                                          .filter(Boolean)
                                          .join(", ")
                                      : "None selected"}
                                  </p>
                                </div>
                              )}

                              <div className={`border-t border-slate-100 text-xs text-slate-600 ${
                                funnelCardDensity === "compact" ? "mt-2 pt-2" : "mt-3 pt-3"
                              }`}>
                                <p className={closeDateStatus.className}>
                                  <span className="font-semibold">Close:</span>{" "}
                                  {closeDateStatus.label}
                                </p>
                                <p className={`mt-1 break-words ${
                                  nextStepMissing
                                    ? "font-semibold text-red-700"
                                    : nextStepOverdue
                                      ? "font-semibold text-amber-700"
                                      : ""
                                }`}>
                                  <span className="font-semibold">Next:</span>{" "}
                                  {opportunity.next_step || "Missing"}
                                  {" · "}
                                  {opportunity.next_step_due_date ? formatDate(opportunity.next_step_due_date) : "No due date"}
                                </p>
                              </div>

                              <div
                                className={`flex flex-wrap gap-2 border-t border-slate-100 ${
                                  funnelCardDensity === "compact" ? "mt-2 pt-2" : "mt-3 pt-3"
                                }`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                {companyId && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenCompany(String(companyId))}
                                    className="rounded-lg bg-blue-700 px-2.5 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                                  >
                                    Open Company
                                  </button>
                                )}

                                {opportunity.status === "open" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => applyOpportunityQuickAction(opportunity, "mark_won")}
                                      disabled={quickActionOpportunityId === String(opportunity.id)}
                                      className="rounded-lg bg-green-700 px-2.5 py-2 text-xs font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                    >
                                      Mark Won
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => applyOpportunityQuickAction(opportunity, "mark_lost")}
                                      disabled={quickActionOpportunityId === String(opportunity.id)}
                                      className="rounded-lg bg-red-700 px-2.5 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                    >
                                      Mark Lost
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => startQuickNextStepEdit(opportunity)}
                                      disabled={quickActionOpportunityId === String(opportunity.id)}
                                      className="rounded-lg bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                                    >
                                      Edit Next Step
                                    </button>
                                  </>
                                )}
                              </div>

                              {editingNextStepOpportunityId === String(opportunity.id) && (
                                <div
                                  className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <input
                                    value={quickActionNextStep}
                                    onChange={(event) => setQuickActionNextStep(event.target.value)}
                                    placeholder="Next step"
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                                  />
                                  <input
                                    type="date"
                                    value={quickActionNextStepDueDate}
                                    onChange={(event) => setQuickActionNextStepDueDate(event.target.value)}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => applyOpportunityQuickAction(opportunity, "update_next_step")}
                                      disabled={quickActionOpportunityId === String(opportunity.id)}
                                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                    >
                                      {quickActionOpportunityId === String(opportunity.id)
                                        ? "Saving..."
                                        : "Save Next Step"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelQuickNextStepEdit}
                                      disabled={quickActionOpportunityId === String(opportunity.id)}
                                      className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </article>
                          );
                        })
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {funnelViewMode === "list" && (
          displayedFunnelOpportunities.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              No opportunities match the current filter.
            </p>
          ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-3 pr-4 font-semibold">Opportunity</th>
<th className="py-3 pr-4 font-semibold">Company</th>
                  <th className="py-3 pr-4 font-semibold">Stage</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 pr-4 font-semibold">Value</th>
                  <th className="py-3 pr-4 font-semibold">Probability</th>
                  <th className="py-3 pr-4 font-semibold">Weighted</th>
                  <th className="py-3 pr-4 font-semibold">Close Date</th>
                  <th className="py-3 pr-4 font-semibold">Next Step</th>
                  <th className="py-3 pr-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedFunnelOpportunities.map((opportunity) => {
                  const value = Number(opportunity.estimated_value ?? 0);
                  const probability = Number(opportunity.probability ?? 0) / 100;
                  const weighted = value * probability;
                  const companyId = opportunity.companies?.id;

                  return (
                    <tr key={opportunity.id} className="border-b border-slate-100 align-top">
                      <td className="max-w-[260px] py-3 pr-4">
                        <p className="font-semibold">{opportunity.opportunity_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {displayValue(opportunity.likely_product_path || opportunity.product_line || opportunity.opportunity_type)}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        {displayValue(opportunity.companies?.company_name)}
                      </td>
                      <td className="py-3 pr-4">
                        {displayValue(opportunity.sales_funnel_stages?.stage_name)}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {opportunity.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{formatCurrency(value)}</td>
                      <td className="py-3 pr-4">{opportunity.probability ?? 0}%</td>
                      <td className="py-3 pr-4">{formatCurrency(weighted)}</td>
                      <td className="py-3 pr-4">{formatDate(opportunity.expected_close_date)}</td>
                      <td className="max-w-[320px] py-3 pr-4 text-slate-700">
                        <div className={
                          !opportunity.next_step || !opportunity.next_step_due_date
                            ? "font-semibold text-red-700"
                            : String(opportunity.next_step_due_date) < new Date().toISOString().slice(0, 10)
                              ? "font-semibold text-amber-700"
                              : ""
                        }>
                          <p>{opportunity.next_step || "Missing"}</p>
                          <p className="mt-1 text-xs">Due: {opportunity.next_step_due_date ? formatDate(opportunity.next_step_due_date) : "Missing"}</p>
                        </div>
                      </td>
                      <td className="min-w-[250px] py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          {companyId ? (
                            <button
                              type="button"
                              onClick={() => onOpenCompany(String(companyId))}
                              className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800"
                            >
                              Open Company
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">No company</span>
                          )}

                          {opportunity.status === "open" && (
                            <>
                              <button
                                type="button"
                                onClick={() => applyOpportunityQuickAction(opportunity, "mark_won")}
                                disabled={quickActionOpportunityId === String(opportunity.id)}
                                className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                Mark Won
                              </button>
                              <button
                                type="button"
                                onClick={() => applyOpportunityQuickAction(opportunity, "mark_lost")}
                                disabled={quickActionOpportunityId === String(opportunity.id)}
                                className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                Mark Lost
                              </button>
                              <button
                                type="button"
                                onClick={() => startQuickNextStepEdit(opportunity)}
                                disabled={quickActionOpportunityId === String(opportunity.id)}
                                className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                              >
                                Edit Next Step
                              </button>
                            </>
                          )}
                        </div>

                        {editingNextStepOpportunityId === String(opportunity.id) && (
                          <div className="mt-2 grid gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                            <input
                              value={quickActionNextStep}
                              onChange={(event) => setQuickActionNextStep(event.target.value)}
                              placeholder="Next step"
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                            />
                            <input
                              type="date"
                              value={quickActionNextStepDueDate}
                              onChange={(event) => setQuickActionNextStepDueDate(event.target.value)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => applyOpportunityQuickAction(opportunity, "update_next_step")}
                                disabled={quickActionOpportunityId === String(opportunity.id)}
                                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                {quickActionOpportunityId === String(opportunity.id)
                                  ? "Saving..."
                                  : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelQuickNextStepEdit}
                                disabled={quickActionOpportunityId === String(opportunity.id)}
                                className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )
        )}
      </div>
    </section>
  );
}

function renderHelpInlineText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function HelpSection() {
  const [guideText, setGuideText] = useState("");
  const [guideState, setGuideState] = useState<"loading" | "ready" | "error">("loading");
  const [guideMessage, setGuideMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadGuide() {
      try {
        const response = await fetch("/USER_GUIDE.md", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Could not load the user guide (HTTP ${response.status}).`);
        }

        const text = await response.text();

        if (!cancelled) {
          setGuideText(text);
          setGuideState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setGuideState("error");
          setGuideMessage(
            error instanceof Error ? error.message : "Could not load the user guide."
          );
        }
      }
    }

    loadGuide();

    return () => {
      cancelled = true;
    };
  }, []);

  const blocks = useMemo(() => {
    if (!guideText) return [];

    const lines = guideText.replace(/\r\n/g, "\n").split("\n");
    const result: Array<
      | { type: "heading"; level: number; text: string }
      | { type: "paragraph"; text: string }
      | { type: "unordered"; items: string[] }
      | { type: "ordered"; items: string[] }
      | { type: "rule" }
    > = [];

    let paragraphLines: string[] = [];
    let unorderedItems: string[] = [];
    let orderedItems: string[] = [];

    function flushParagraph() {
      if (paragraphLines.length > 0) {
        result.push({
          type: "paragraph",
          text: paragraphLines.join(" "),
        });
        paragraphLines = [];
      }
    }

    function flushUnordered() {
      if (unorderedItems.length > 0) {
        result.push({
          type: "unordered",
          items: unorderedItems,
        });
        unorderedItems = [];
      }
    }

    function flushOrdered() {
      if (orderedItems.length > 0) {
        result.push({
          type: "ordered",
          items: orderedItems,
        });
        orderedItems = [];
      }
    }

    function flushAll() {
      flushParagraph();
      flushUnordered();
      flushOrdered();
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        flushAll();
        continue;
      }

      if (line === "---") {
        flushAll();
        result.push({ type: "rule" });
        continue;
      }

      const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);

      if (headingMatch) {
        flushAll();
        result.push({
          type: "heading",
          level: headingMatch[1].length,
          text: headingMatch[2],
        });
        continue;
      }

      const unorderedMatch = line.match(/^[-*]\s+(.+)$/);

      if (unorderedMatch) {
        flushParagraph();
        flushOrdered();
        unorderedItems.push(unorderedMatch[1]);
        continue;
      }

      const orderedMatch = line.match(/^\d+\.\s+(.+)$/);

      if (orderedMatch) {
        flushParagraph();
        flushUnordered();
        orderedItems.push(orderedMatch[1]);
        continue;
      }

      flushUnordered();
      flushOrdered();
      paragraphLines.push(line);
    }

    flushAll();

    return result;
  }, [guideText]);

  return (
    <section className="grid max-w-full gap-6 overflow-hidden">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Graymills CRM
        </p>
        <h2 className="mt-2 text-2xl font-bold">Help and User Guide</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
          Instructions for signing in, managing companies and contacts, using the sales funnel,
          running prospect analysis, importing CSV files, administering users, and resolving
          common problems.
        </p>
      </div>

      {guideState === "loading" && (
        <div className="rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading the Graymills CRM User Guide...
        </div>
      )}

      {guideState === "error" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm">
          <p className="font-bold">The user guide could not be loaded.</p>
          <p className="mt-2">{guideMessage}</p>
        </div>
      )}

      {guideState === "ready" && (
        <article className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <div className="mx-auto max-w-5xl">
            {blocks.map((block, index) => {
              if (block.type === "heading") {
                if (block.level === 1) {
                  return (
                    <h1 key={index} className="mt-2 text-3xl font-black text-slate-950">
                      {renderHelpInlineText(block.text)}
                    </h1>
                  );
                }

                if (block.level === 2) {
                  return (
                    <h2
                      key={index}
                      className="mt-10 border-b border-slate-200 pb-2 text-2xl font-bold text-slate-950"
                    >
                      {renderHelpInlineText(block.text)}
                    </h2>
                  );
                }

                return (
                  <h3 key={index} className="mt-7 text-xl font-bold text-slate-900">
                    {renderHelpInlineText(block.text)}
                  </h3>
                );
              }

              if (block.type === "unordered") {
                return (
                  <ul
                    key={index}
                    className="mt-4 list-disc space-y-2 pl-6 text-sm leading-6 text-slate-700"
                  >
                    {block.items.map((item, itemIndex) => (
                      <li key={`${item}-${itemIndex}`}>
                        {renderHelpInlineText(item)}
                      </li>
                    ))}
                  </ul>
                );
              }

              if (block.type === "ordered") {
                return (
                  <ol
                    key={index}
                    className="mt-4 list-decimal space-y-2 pl-6 text-sm leading-6 text-slate-700"
                  >
                    {block.items.map((item, itemIndex) => (
                      <li key={`${item}-${itemIndex}`}>
                        {renderHelpInlineText(item)}
                      </li>
                    ))}
                  </ol>
                );
              }

              if (block.type === "rule") {
                return <hr key={index} className="my-8 border-slate-200" />;
              }

              return (
                <p key={index} className="mt-4 text-sm leading-7 text-slate-700">
                  {renderHelpInlineText(block.text)}
                </p>
              );
            })}
          </div>
        </article>
      )}
    </section>
  );
}

function ReleaseNotesSection() {
  const releases = [
    {
      version: "Version 3.15",
      title: "Company Detail Layout Cleanup",
      date: "July 22, 2026",
      summary:
        "Improves Company Detail organization by moving Sales Coverage below the main account detail content and Company Industry Enrichment.",
      changes: [
        "Moved the Sales Coverage panel below the main Company Detail cards.",
        "Kept Company Industry Enrichment immediately before Sales Coverage.",
        "Preserved the Coverage shortcut in the sticky Company Detail header.",
        "Preserved Sales Coverage loading, editing, saving, and role-based behavior.",
        "Kept the Funnel section directly below Sales Coverage.",
        "Cleaned up the Company Detail JSX structure around the detail grid and enrichment panel.",
      ],
      testNotes: [
        "Confirm Company Detail cards appear before Sales Coverage.",
        "Confirm Company Industry Enrichment appears immediately before Sales Coverage.",
        "Confirm the Coverage shortcut scrolls to the Sales Coverage panel.",
        "Confirm Sales Coverage assignments still load and save.",
        "Confirm the Funnel remains directly below Sales Coverage.",
        "Confirm the production build passes.",
      ],
    },
    {
      version: "Version 3.14",
      title: "Contact Management and Multi-Contact Relationships",
      date: "July 22, 2026",
      summary:
        "Adds secure company contact management and supports one Primary Contact plus multiple Related Contacts across company activities, sales opportunities, and opportunity activities.",
      changes: [
        "Added secure creation, editing, and archiving of company contacts from Company Detail.",
        "Added Primary and Related Contact assignments for company activities, sales opportunities, and opportunity activities while preserving legacy single-contact records.",
        "Added database assignment tables with foreign keys, uniqueness constraints, indexes, row-level security, and cascade cleanup.",
        "Added verified bearer-token protection and role-aware access to the new and revised contact-related API routes.",
        "Added contact selectors, editing controls, persistence, card display, and contact-aware search across Company Detail, Funnel views, Opportunity Activities, and the Unified Activity Timeline.",
        "Improved the opportunity card layout so Documents and Activities use the full available width.",
      ],
      testNotes: [
        "Verified company contact creation, editing, archiving, and active-contact filtering.",
        "Verified Primary and multiple Related Contacts can be created, edited, refreshed, completed, and preserved for all supported record types.",
        "Verified Primary Contacts are excluded from Related Contact assignment rows.",
        "Verified legacy single-contact records continue to display correctly.",
        "Verified Unified Activity Timeline display and search include opportunity activity Primary and Related Contacts.",
        "Verified secure API behavior, browser workflows, database persistence, and the production build.",
      ],
    },
    {
      version: "Version 3.13",
      title: "Saved Funnel Views and Filters",
      date: "July 21, 2026",
      summary:
        "Adds secure, user-specific saved Funnel views that preserve Funnel filters, search, Board/List mode, and card density across sessions.",
      changes: [
        "Save the current Funnel configuration under a reusable name.",
        "Apply, rename, update, set as default, clear default, or delete saved views.",
        "Automatically restore the signed-in user’s default Funnel view.",
        "Protect all saved-view reads and writes with verified Supabase authentication and server-side ownership enforcement.",
      ],
      testNotes: [
        "Verified creation, application, rename, update, default restoration, and deletion of saved Funnel views.",
        "Verified Funnel Board/List modes, card density, drag-and-drop, workflow previews, and quick actions remain functional.",
        "Verified the production build passes with the secure saved-funnel-views API route.",
      ],
    },
    {
      version: "Version 3.12",
      title: "Controlled Sales Workflow Automations",
      date: "July 21, 2026",
      summary:
        "Adds secure, configurable sales workflow automations that can preview and create follow-up activities when opportunities move through the Funnel.",
      changes: [
        "Added a protected workflow automation rules API using verified Supabase bearer-token authentication and Admin-only management.",
        "Added fixed workflow triggers for Discovery, Solution / Quote, Technical / Commercial Review, Won, and Lost outcomes.",
        "Added editable activity type, subject, notes, due-business-day offset, confirmation, activity creation, and Lost Reason controls.",
        "Added secure pre-move previews and confirmation before enabled automations execute.",
        "Added server-side follow-up activity creation with deterministic duplicate prevention and workflow audit notes.",
        "Added explicit Undo suppression so reversing a stage move does not create another automated activity.",
        "Routed Funnel Mark Won and Mark Lost through the secure stage-move workflow contract.",
        "Added required Lost Reason entry and persistence when the enabled Lost rule requires it.",
        "Replaced the corrupted Funnel drag-handle text with a stable Drag label.",
      ],
      testNotes: [
        "Confirm only signed-in CRM Admin users can view and update workflow automation rules.",
        "Confirm disabled rules do not interrupt ordinary stage moves.",
        "Confirm enabled rules show the correct preview before moving the opportunity.",
        "Confirm Cancel Move leaves the opportunity unchanged.",
        "Confirm approved moves create no more than one follow-up activity.",
        "Confirm Undo restores the prior stage without creating another automation activity.",
        "Confirm Mark Won follows the configured Won rule.",
        "Confirm Mark Lost requires and saves a Lost Reason when configured.",
        "Confirm Edit Next Step remains functional in Board and List views.",
      ],
    },
    {
      version: "Version 3.11",
      title: "Unified Activity Timeline",
      date: "July 21, 2026",
      summary:
        "Adds a secure, role-aware unified activity timeline to Company Detail and improves the placement of company assignment controls.",
      changes: [
        "Added a protected /api/company-activity-timeline endpoint using verified Supabase bearer-token authentication.",
        "Combined company activities and opportunity activities into one chronological Company Detail timeline.",
        "Added timeline search, source filters, status filters, counts, and manual refresh controls.",
        "Displayed related opportunity names and source labels on opportunity activity entries.",
        "Preserved the existing Company Activity History controls for editing and completing company activities.",
        "Moved company Projects / Lists and Market / Sector / Category Tags below Contacts.",
      ],
      testNotes: [
        "Confirm the unified timeline loads company and opportunity activities together.",
        "Confirm search, source filters, status filters, counts, and Refresh Timeline work.",
        "Confirm opportunity activity entries display the related opportunity name.",
        "Confirm Company Activity History still supports editing and completing company activities.",
        "Confirm Sales Reps cannot load timelines for companies not assigned to them.",
        "Confirm Contacts appears before company Projects / Lists and Market / Sector / Category Tags.",
      ],
    },
    {
      version: "Version 3.10",
      title: "Funnel Card Quick Actions",
      date: "July 20, 2026",
      summary:
        "Adds secure, role-aware quick actions directly to Funnel Board cards and List rows for faster opportunity management.",
      changes: [
        "Added a protected /api/sales-opportunity-quick-action endpoint using verified Supabase bearer-token authentication.",
        "Added Mark Won and Mark Lost actions with confirmation prompts and automatic status, probability, timestamp, and funnel-stage updates.",
        "Added inline Next Step and Next Step Due Date editing in both Board and List views.",
        "Added Open Company actions without interfering with full-card navigation.",
        "Restricted Sales Reps to opportunities attached to companies assigned to them, while Admins and Sales Managers retain broader access.",
        "Added success and error feedback near the Funnel controls.",
      ],
      testNotes: [
        "Confirm Open Company works from Board and List views.",
        "Confirm Mark Won moves the opportunity to the Won stage and sets probability to 100%.",
        "Confirm Mark Lost moves the opportunity to the Lost stage and sets probability to 0%.",
        "Confirm inline Next Step edits require both the step and due date and persist after refresh.",
        "Confirm quick-action button clicks do not accidentally open the company card.",
        "Confirm drag-and-drop stage movement and Undo continue to work.",
      ],
    },
    {
      version: "Version 3.09",
      title: "Mandatory Next Step",
      date: "July 20, 2026",
      summary:
        "Requires open opportunities to include a next step and due date and surfaces missing or overdue action warnings throughout the CRM.",
      changes: [
        "Added the next_step_due_date field and supporting database index.",
        "Required Next Step and Next Step Due Date when creating or editing open opportunities.",
        "Added missing and overdue next-step warnings in Company Detail, Funnel Board, Funnel List, and My Sales Workspace.",
        "Added missing and overdue next-step counts to My Sales Workspace.",
        "Preserved legacy opportunities and existing stage or status quick updates without forcing unrelated edits.",
      ],
      testNotes: [
        "Confirm new open opportunities require both next-step fields.",
        "Confirm edits persist after refresh.",
        "Confirm missing and overdue warnings display correctly.",
        "Confirm My Sales Workspace counts match the visible records.",
        "Confirm Funnel stage movement and Won or Lost actions remain functional.",
      ],
    },
    {
      version: "Version 3.08",
      title: "My Sales Workspace",
      date: "July 20, 2026",
      summary:
        "Adds a secure, role-aware personal sales workspace to the Dashboard so each signed-in user can immediately see the activities and opportunities that need attention.",
      changes: [
        "Added a protected /api/my-sales-workspace endpoint using verified Supabase bearer-token authentication.",
        "Added Admin and Sales Manager visibility across all workspace records and Sales Rep visibility limited to companies assigned to them.",
        "Added overdue, due-today, and upcoming activity queues with company navigation.",
        "Added open-opportunity cards with company, funnel stage, value, probability, expected close date, and next step.",
        "Added workspace summary metrics, loading and error states, and a Refresh Workspace control.",
        "Kept the existing Dashboard metrics and follow-up sections available below the new personal workspace.",
      ],
      testNotes: [
        "Confirm My Sales Workspace appears at the top of Dashboard for a signed-in CRM user.",
        "Confirm the signed-in user name and CRM role are displayed.",
        "Confirm overdue, due-today, upcoming, and open-opportunity counts load without an authentication error.",
        "Confirm Sales Reps only see records tied to companies assigned to them, while Admins and Sales Managers see all applicable records.",
        "Confirm Refresh Workspace reloads the data.",
        "Confirm Open Company opens Company Detail and Back returns to Dashboard.",
        "Confirm directly opening /api/my-sales-workspace without a bearer token returns an authentication error.",
      ],
    },
    {
      version: "Version 3.07",
      title: "Drag-and-Drop Funnel Board",
      date: "July 20, 2026",
      summary:
        "Adds a secure, role-aware drag-and-drop funnel board designed for faster pipeline management.",
      changes: [
        "Added Board and List views for sales opportunities.",
        "Added native drag-and-drop stage movement with optimistic updates and rollback on failure.",
        "Added a verified Supabase bearer-token endpoint for secure stage changes.",
        "Restricted Sales Reps to moving opportunities tied to companies assigned to them.",
        "Added sticky Funnel controls with filters, view selection, refresh, and Comfortable or Compact card density.",
        "Added stage counts, stage value totals, horizontal board scrolling, and full-card company navigation.",
        "Added one-step secure Undo for the most recent stage move.",
        "Added red overdue, amber due-today, and neutral future or missing close-date states.",
      ],
      testNotes: [
        "Confirm Board is the default Funnel view and List remains available.",
        "Confirm opportunities can be dragged between active stages and persist after refresh.",
        "Confirm Undo returns the most recently moved opportunity to its prior stage.",
        "Confirm Sales Reps only see and move opportunities within their assigned-company scope.",
        "Confirm sticky controls, Refresh, filters, Comfortable mode, and Compact mode work.",
        "Confirm clicking a card body opens the related company without interfering with the drag handle.",
        "Confirm overdue dates appear red, due-today dates appear amber, and future or missing dates remain neutral.",
      ],
    },
    {
      version: "Version 3.06",
      title: "Contact Filter Result Count",
      date: "July 20, 2026",
      summary:
        "Adds an at-a-glance contact result count to the Contacts filter block while respecting role visibility.",
      changes: [
        "Added an X of Y Contacts count to the Contact Search and Filters panel.",
        "Defined X as the number of contacts currently passing all active contact filters.",
        "Defined Y as the total number of contacts visible to the signed-in user before contact filters are applied.",
        "Made the count update immediately as search, tag, and Project / List filters change.",
        "Kept role visibility intact so Sales Reps do not see totals that include hidden contacts.",
      ],
      testNotes: [
        "Confirm the Contacts filter block shows X of Y Contacts.",
        "Confirm X changes as search, tag, or Project / List filters are applied.",
        "Confirm Y remains the role-visible contact total.",
        "Confirm Clear Contact Filters restores X to Y.",
        "Confirm Sales Reps do not see totals that include hidden contacts.",
      ],
    },
    {
      version: "Version 3.05",
      title: "Contact Project / List Filter",
      date: "July 17, 2026",
      summary:
        "Adds Project / List membership filtering to the Contacts screen, completing filter parity with Companies.",
      changes: [
        "Added a read-only contact Project / List assignment summary endpoint.",
        "Added Project / List membership filtering to the Contacts screen.",
        "Included archived assigned Projects and Lists in the filter options with Archived labeling.",
        "Added saved preference support for the selected contact Project / List filter.",
        "Updated Clear Contact Filters and Reset Saved View Preferences to reset the new filter.",
      ],
      testNotes: [
        "Confirm the Contacts screen includes a Project / List filter.",
        "Confirm selecting a Project or List shows only assigned contacts.",
        "Confirm All Projects / Lists restores the full contact list.",
        "Confirm Clear Contact Filters resets the Project / List filter.",
        "Confirm the selected filter persists after refresh.",
        "Confirm archived assigned Projects or Lists appear with an Archived label.",
      ],
    },
    {
      version: "Version 3.04",
      title: "Project / List Assignments",
      date: "July 17, 2026",
      summary:
        "Completes company and contact membership workflows for Projects and Lists across import, company detail, contact detail, and company search.",
      changes: [
        "Added protected company and contact Project / List assignment APIs with verified signed-in CRM Admin write protection.",
        "Added company-level Project / List controls on Company Detail, including add, remove, archived-item visibility, and read-only behavior for non-Admins.",
        "Added contact-level Project / List controls inside Company Detail contact cards with verified Admin-only add and remove actions.",
        "Added optional import-time Project / List assignment so imported or reused companies and contacts can be added to selected active Projects or Lists.",
        "Added a company Project / List filter to the Companies screen, including saved filter preferences and archived assignment visibility.",
        "Added a read-only company assignment summary endpoint used by the Companies filter.",
      ],
      testNotes: [
        "Confirm an Admin can add and remove company and contact Project / List assignments and that they persist after refresh.",
        "Confirm archived assigned Projects or Lists remain visible but are not offered for new assignments.",
        "Confirm Sales Managers and Sales Reps can view assignments but cannot change them.",
        "Confirm imports can assign created or reused companies and contacts to selected active Projects or Lists.",
        "Confirm the Companies Project / List filter returns only matching assigned companies and is restored after refresh.",
      ],
    },
    {
      version: "Version 3.03",
      title: "Projects / Lists Foundation",
      date: "July 17, 2026",
      summary:
        "Adds the first production-ready Projects / Lists foundation for grouping companies and contacts around campaigns, initiatives, and reusable lists.",
      changes: [
        "Added Supabase tables for Projects / Lists plus company and contact assignment foundations.",
        "Enabled Row Level Security on the new Projects / Lists tables while keeping server-side access through protected APIs.",
        "Added a Projects / Lists API with public read access and verified signed-in CRM Admin protection for create and update actions.",
        "Added Admin controls to create Projects or Lists, assign an owner, set description and sort order, edit records, and archive or reactivate them.",
        "Added verified Supabase bearer-token handling for all Projects / Lists write actions.",
        "Confirmed Projects / Lists persist after browser refresh and that archive/reactivate workflows function correctly.",
      ],
      testNotes: [
        "Confirm the Admin tab shows Manage Projects / Lists before Manage Sales Funnel Stages.",
        "Confirm an Admin can create both a Project and a List.",
        "Confirm owner assignment, description, and sort order save correctly.",
        "Confirm Edit loads the selected record into the form.",
        "Confirm Archive and Reactivate update status correctly.",
        "Confirm a non-Admin user cannot create, edit, archive, or reactivate Projects / Lists.",
      ],
    },
    {
      version: "Version 3.02",
      title: "Admin Authentication Management",
      date: "July 17, 2026",
      summary:
        "Adds protected Supabase authentication-management tools to the CRM Admin user workflow.",
      changes: [
        "Added a verified server-side Auth-management API that validates the signed-in Supabase session and matches it to an active CRM Admin.",
        "Added login-status badges, email-confirmation status, last-sign-in details, and current-login identification to CRM User cards.",
        "Added protected creation of matching Supabase Auth logins for active CRM Users without an existing login.",
        "Added protected password-reset controls for other active users with an existing Auth login.",
        "Prevented Admin users from resetting their own password from the CRM user-management page.",
        "Temporary passwords are sent directly to Supabase and are not stored in CRM records or browser storage.",
      ],
      testNotes: [
        "Confirm an Admin can view Auth status for every CRM User.",
        "Confirm active CRM Users without a login show Create Auth Login controls.",
        "Confirm active users with a login show password-reset controls.",
        "Confirm the current signed-in Admin cannot reset their own password from this page.",
        "Confirm archived users do not show login-creation or password-reset controls.",
        "Confirm non-Admin users cannot access Auth-management actions.",
      ],
    },
    {
      version: "Version 3.01",
      title: "Funnel Stage Edit Navigation",
      date: "July 17, 2026",
      summary:
        "Improves Admin funnel-stage editing by moving users directly to the selected stage form.",
      changes: [
        "Clicking Edit Stage now scrolls smoothly to the Edit Stage form.",
        "The Stage Name field receives keyboard focus after the form is shown.",
        "Added scroll spacing so the sticky navigation does not cover the form heading.",
      ],
      testNotes: [
        "Open Admin and scroll to the Funnel Stages list.",
        "Click Edit Stage on a stage near the bottom of the list.",
        "Confirm the page scrolls to the Edit Stage form.",
        "Confirm the Stage Name field is focused and ready for editing.",
        "Confirm Cancel Edit, Save Stage, Create Stage, Archive, and Reactivate still work.",
      ],
    },
    {
      version: "Version 3.0",
      title: "Production Release",
      date: "July 15, 2026",
      summary:
        "Promotes the Graymills CRM from the Rev 2.x development series to the Version 3.0 production release.",
      changes: [
        "Enabled Supabase email/password authentication and a login-required CRM shell.",
        "Matched authenticated accounts to active CRM Users records for role-based permissions.",
        "Enforced Admin, Sales Manager, and Sales Rep navigation and record visibility.",
        "Added sales coverage, funnel management, activities, documents, AI prospect analysis, and analysis history.",
        "Added production backup export, a full user guide, and an in-app Help area.",
        "Removed temporary role-testing controls and purged development/test CRM records.",
      ],
      testNotes: [
        "Confirm signed-out users see the login gate.",
        "Confirm Admin, Sales Manager, and Sales Rep accounts receive the correct tabs and record visibility.",
        "Confirm Dashboard, Companies, Contacts, Funnel, Import, Admin, Help, and Release Notes load without errors.",
        "Confirm the application header and login gate display Version 3.0 - Production Release.",
      ],
    },
    {
      version: "Rev 1.20",
      title: "Release Notes Tab",
      date: "Current",
      summary:
        "Adds a dedicated Release Notes tab to keep revision history, testing notes, and roadmap items visible inside the CRM.",
      changes: [
        "Added Release Notes to the main navigation.",
        "Moved revision history into a dedicated app section.",
        "Created a cleaner place to track what changed and what to test.",
      ],
      testNotes: [
        "Confirm the Release Notes button appears beside Dashboard, Companies, Contacts, and Import ZoomInfo.",
        "Open the tab and confirm revision cards display.",
        "Confirm existing Dashboard, Companies, Contacts, Import, and Company Detail workflows still work.",
      ],
    },
    {
      version: "Rev 1.19",
      title: "Contact Tag Filters",
      date: "Completed",
      summary:
        "Contacts can be searched and filtered by assigned Market, Sector, and Category tags.",
      changes: [
        "Added contact tag summary loading.",
        "Added Contact Search and Tag Filters panel.",
        "Contact search now includes assigned tag names.",
      ],
      testNotes: [
        "Assign a category such as Decision Maker to a contact.",
        "Open Contacts and filter by that category.",
        "Confirm the matching contact remains visible and unrelated contacts are filtered out.",
      ],
    },
    {
      version: "Rev 1.18",
      title: "Company Tag Filters",
      date: "Completed",
      summary:
        "Companies can be filtered by Market, Sector, and Category tags assigned on the company detail page.",
      changes: [
        "Added company tag summary loading.",
        "Added Market, Sector, and Category filters above the Companies list.",
        "Company search now includes assigned tag names.",
      ],
      testNotes: [
        "Assign Parts Washing, Aviation MRO, or High Priority to a company.",
        "Filter the Companies list by the assigned tag.",
        "Confirm Clear All Filters resets the list.",
      ],
    },
    {
      version: "Rev 1.17C",
      title: "Contact Tag Assignment UI",
      date: "Completed",
      summary:
        "Contact cards now support Market, Sector, and Category tag assignment.",
      changes: [
        "Added Contact Tags controls inside each contact card.",
        "Added separate controls for contact markets, sectors, and categories.",
        "Contact tags can be added and removed from the company detail page.",
      ],
      testNotes: [
        "Open a company with contacts.",
        "Assign Decision Maker or Technical Influencer to a contact.",
        "Refresh and confirm the tag persists.",
      ],
    },
    {
      version: "Rev 1.17B",
      title: "Company Tag Assignment UI",
      date: "Completed",
      summary:
        "Company detail pages now support Market, Sector, and Category tag assignment.",
      changes: [
        "Added company-level tag panel.",
        "Added separate add controls for Markets, Sectors, and Categories.",
        "Assigned tags can be removed from company records.",
      ],
      testNotes: [
        "Open a company detail page.",
        "Assign one Market, one Sector, and one Category.",
        "Remove one tag and confirm it disappears.",
      ],
    },
    {
      version: "Rev 1.17A",
      title: "Tag API Routes",
      date: "Completed",
      summary:
        "Added backend API routes for loading tags and assigning/removing company and contact tags.",
      changes: [
        "Added /api/tags.",
        "Added /api/company-tags.",
        "Added /api/contact-tags.",
      ],
      testNotes: [
        "Confirm /api/tags returns seeded tags.",
        "Confirm company and contact tag routes can add and remove assignments.",
      ],
    },
    {
      version: "Rev 1.16",
      title: "Market / Sector / Category Tables",
      date: "Completed",
      summary:
        "Added the database foundation for flexible CRM segmentation.",
      changes: [
        "Created crm_tags.",
        "Created company_tags.",
        "Created contact_tags.",
        "Seeded default Market, Sector, and Category values.",
      ],
      testNotes: [
        "Confirm crm_tags contains Market, Sector, and Category rows.",
        "Confirm company_tags and contact_tags accept assignments without duplicates.",
      ],
    },
    {
      version: "Rev 1.15.3",
      title: "AI Intelligence Visibility Guard",
      date: "Completed",
      summary:
        "AI intelligence sections now display only when a record was generated by the Analyze Prospect workflow.",
      changes: [
        "Added explicit AI-generated flag logic.",
        "Prevented default or preloaded text from being mistaken for generated analysis.",
        "Improved CRM trust by showing a clear unanalyzed state.",
      ],
      testNotes: [
        "Open an unanalyzed company and confirm AI intelligence blocks are hidden.",
        "Click Analyze Prospect and confirm blocks appear after analysis.",
      ],
    },
    {
      version: "Rev 1.14",
      title: "Analyze Prospect Button",
      date: "Completed",
      summary:
        "Added the Analyze Prospect button to company detail pages.",
      changes: [
        "Button calls the OpenAI prospect analysis API route.",
        "Company detail refreshes after analysis.",
        "Generated intelligence is saved to Supabase.",
      ],
      testNotes: [
        "Open a company detail page.",
        "Click Analyze Prospect.",
        "Confirm score, product path, and intelligence update.",
      ],
    },
    {
      version: "Rev 1.13",
      title: "OpenAI Prospect Analysis API Route",
      date: "Completed",
      summary:
        "Added the backend route that analyzes a company using CRM data and approved Graymills knowledge context.",
      changes: [
        "Added OpenAI API integration.",
        "Structured JSON analysis is saved into Supabase.",
        "Prospect and prospect intelligence records are updated.",
      ],
      testNotes: [
        "Test /api/analyze-prospect with a company ID.",
        "Confirm prospect_intelligence receives a saved analysis.",
      ],
    },
    {
      version: "Rev 1.12",
      title: "Graymills Knowledge Seed",
      date: "Completed",
      summary:
        "Seeded Graymills product, application, and prompt-guardrail knowledge into Supabase.",
      changes: [
        "Added curated Graymills knowledge documents.",
        "Added product family context.",
        "Added application rules and AI guardrails.",
      ],
      testNotes: [
        "Confirm Graymills knowledge tables are populated.",
        "Confirm approved_for_ai records are active.",
      ],
    },
  ];

  const roadmap = [
    "Import-Level Tag Assignment: choose Market, Sector, and Category tags during CSV upload.",
    "Apply Import Tags: apply selected import tags to every company and contact created or reused from the upload.",
    "Sales Funnel Tables: create opportunity/funnel structure separate from company records.",
    "Funnel Stage Assignment: assign companies or opportunities to sales stages.",
    "Funnel Dashboard: show pipeline counts, value, probability, next steps, and close dates.",
  ];

  return (
    <section className="grid gap-6">
      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Product History
        </p>
        <h2 className="mt-2 text-2xl font-bold">Release Notes</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
          A running record of major revisions to the Graymills prospecting CRM. Use this page to confirm what changed, why it matters, and what should be tested after each update.
        </p>
      </div>

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">Upcoming Roadmap</h3>
        <div className="mt-4 grid gap-3">
          {roadmap.map((item, index) => (
            <div key={item} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900 break-words">
                {index + 1}. {item}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {releases.map((release) => (
          <article key={release.version} className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-700">{release.version}</p>
                <h3 className="mt-1 text-xl font-bold">{release.title}</h3>
              </div>
              <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {release.date}
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-700">{release.summary}</p>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold">What changed</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {release.changes.map((change) => (
                    <li key={change} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold">Test notes</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {release.testNotes.map((note) => (
                    <li key={note} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-600" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

type MySalesWorkspacePayload = {
  user?: {
    crmUserId?: string;
    displayName?: string;
    role?: string;
  };
  activities?: {
    overdue?: any[];
    dueToday?: any[];
    upcoming?: any[];
  };
  opportunities?: {
    open?: any[];
    missingNextStep?: any[];
    overdueNextStep?: any[];
  };
  generatedAt?: string;
};

function MySalesWorkspaceSection({
  onOpenCompany,
}: {
  onOpenCompany: (companyId: string) => void;
}) {
  const [workspace, setWorkspace] = useState<MySalesWorkspacePayload | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");

  async function loadMySalesWorkspace() {
    setIsLoadingWorkspace(true);
    setWorkspaceError("");

    try {
      if (!hasBrowserSupabaseConfig()) {
        throw new Error("Browser Supabase configuration is not available.");
      }

      const supabase = getBrowserSupabaseClient();
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw new Error(error.message || "Could not read the signed-in session.");
      }

      const accessToken = data.session?.access_token;

      if (!accessToken) {
        throw new Error("A signed-in Supabase session is required.");
      }

      const response = await fetch("/api/my-sales-workspace", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not load My Sales Workspace.");
      }

      setWorkspace(payload);
    } catch (error) {
      setWorkspace(null);
      setWorkspaceError(
        error instanceof Error ? error.message : "Could not load My Sales Workspace."
      );
    } finally {
      setIsLoadingWorkspace(false);
    }
  }

  useEffect(() => {
    void loadMySalesWorkspace();
  }, []);

  const overdue = workspace?.activities?.overdue ?? [];
  const dueToday = workspace?.activities?.dueToday ?? [];
  const upcoming = workspace?.activities?.upcoming ?? [];
  const openOpportunities = workspace?.opportunities?.open ?? [];
  const missingNextStepOpportunities = workspace?.opportunities?.missingNextStep ?? [];
  const overdueNextStepOpportunities = workspace?.opportunities?.overdueNextStep ?? [];

  function activityList(
    title: string,
    items: any[],
    emptyText: string,
    tone: "red" | "amber" | "blue"
  ) {
    const toneClass =
      tone === "red"
        ? "border-red-200 bg-red-50"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50"
          : "border-blue-200 bg-blue-50";

    return (
      <div className={`rounded-2xl border p-4 ${toneClass}`}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-950">{title}</h3>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
            {items.length}
          </span>
        </div>

        {items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">{emptyText}</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {items.slice(0, 8).map((activity: any) => (
              <div key={activity.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                    {getActivityLabel(activity.activity_type)}
                  </span>
                  {activity.due_date && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      Due {formatDate(activity.due_date)}
                    </span>
                  )}
                </div>
                <p className="mt-2 font-semibold text-slate-950">
                  {activity.subject || "No subject"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {activity.companies?.company_name || "Company not attached"}
                </p>
                {activity.company_id && (
                  <button
                    type="button"
                    onClick={() => onOpenCompany(String(activity.company_id))}
                    className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    Open Company
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Personal Work Queue
          </p>
          <h2 className="mt-2 text-2xl font-bold">My Sales Workspace</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Prioritized activities and open opportunities for the signed-in CRM user.
          </p>
          {workspace?.user?.displayName && (
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {workspace.user.displayName} · {formatTitleFromKey(workspace.user.role || "")}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={loadMySalesWorkspace}
          disabled={isLoadingWorkspace}
          className="w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isLoadingWorkspace ? "Refreshing..." : "Refresh Workspace"}
        </button>
      </div>

      {workspaceError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {workspaceError}
        </div>
      )}

      {!workspaceError && !workspace && isLoadingWorkspace && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Loading My Sales Workspace...
        </div>
      )}

      {workspace && (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="My overdue" value={overdue.length.toString()} note="Open activities past due" />
            <MetricCard label="Due today" value={dueToday.length.toString()} note="Open activities due today" />
            <MetricCard label="Upcoming" value={upcoming.length.toString()} note="Future dated activities" />
            <MetricCard label="Open opportunities" value={openOpportunities.length.toString()} note="Role-visible active pipeline" />
            <MetricCard label="Missing next step" value={missingNextStepOpportunities.length.toString()} note="Open opportunities needing action details" />
            <MetricCard label="Overdue next step" value={overdueNextStepOpportunities.length.toString()} note="Open opportunities past due" />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {activityList("My Overdue Activities", overdue, "No overdue activities.", "red")}
            {activityList("My Activities Due Today", dueToday, "No activities due today.", "amber")}
            {activityList("My Upcoming Activities", upcoming, "No upcoming activities.", "blue")}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-950">My Open Opportunities</h3>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                {openOpportunities.length}
              </span>
            </div>

            {openOpportunities.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No open opportunities.</p>
            ) : (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {openOpportunities.slice(0, 12).map((opportunity: any) => (
                  <div key={opportunity.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold text-slate-950">
                          {opportunity.opportunity_name || "Unnamed opportunity"}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {opportunity.companies?.company_name || "Company not attached"}
                        </p>
                      </div>
                      <span className="w-fit rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">
                        {opportunity.sales_funnel_stages?.stage_name || "No stage"}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-1 text-sm text-slate-600">
                      <p><span className="font-semibold">Value:</span> {Number(opportunity.estimated_value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</p>
                      <p><span className="font-semibold">Probability:</span> {Number(opportunity.probability || 0)}%</p>
                      <p><span className="font-semibold">Close date:</span> {formatDate(opportunity.expected_close_date || null)}</p>
                      <p><span className="font-semibold">Next step:</span> {opportunity.next_step || "Missing"}</p>
                      <p><span className="font-semibold">Next step due:</span> {opportunity.next_step_due_date ? formatDate(opportunity.next_step_due_date) : "Missing"}</p>
                    </div>

                    {opportunity.company_id && (
                      <button
                        type="button"
                        onClick={() => onOpenCompany(String(opportunity.company_id))}
                        className="mt-4 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
                      >
                        Open Company
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
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

function FollowUpDashboard({
  title,
  activities,
  emptyText,
  emphasis,
  onOpenCompany,
  onCompleteActivity,
  completingActivityId,
}: {
  title: string;
  activities: ActivityRecord[];
  emptyText: string;
  emphasis: "overdue" | "today" | "open";
  onOpenCompany: (companyId: string) => void;
  onCompleteActivity: (activityId: string, companyId?: string | null) => void;
  completingActivityId: string;
}) {
  const titleClass =
    emphasis === "overdue"
      ? "text-red-800"
      : emphasis === "today"
        ? "text-yellow-800"
        : "text-slate-900";

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <h2 className={`text-xl font-bold ${titleClass}`}>{title}</h2>

      {activities.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{emptyText}</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {activities.slice(0, 12).map((activity: any) => (
            <div key={activity.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                      {getActivityLabel(activity.activity_type)}
                    </span>
                    {isOverdue(activity) && (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                        Overdue
                      </span>
                    )}
                    {activity.due_date && !isOverdue(activity) && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        Due {formatDate(activity.due_date)}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 font-semibold">{activity.subject || "No subject"}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {activity.companies?.company_name || "Company not attached"}
                  </p>
                  {activity.notes && (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">
                      {activity.notes}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    onClick={() => onOpenCompany(activity.company_id)}
                    className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    Open Company
                  </button>
                  <button
                    onClick={() => onCompleteActivity(activity.id, activity.company_id)}
                    disabled={completingActivityId === activity.id}
                    className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {completingActivityId === activity.id ? "Completing..." : "Complete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentImports({ imports }: { imports: ImportSummary[] }) {

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Recent Imports</h2>

      {imports.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No imports saved yet.</p>
      ) : (
        <div className="mt-4 max-w-full overflow-x-auto">
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

function CompanyTagFilterPanel({
  companyMarketTagFilter,
  setCompanyMarketTagFilter,
  companyMarketTagOptions,
  companySectorTagFilter,
  setCompanySectorTagFilter,
  companySectorTagOptions,
  companyCategoryTagFilter,
  setCompanyCategoryTagFilter,
  companyCategoryTagOptions,
  clearCompanyFilters,
}: {
  companyMarketTagFilter: string;
  setCompanyMarketTagFilter: (value: string) => void;
  companyMarketTagOptions: string[];
  companySectorTagFilter: string;
  setCompanySectorTagFilter: (value: string) => void;
  companySectorTagOptions: string[];
  companyCategoryTagFilter: string;
  setCompanyCategoryTagFilter: (value: string) => void;
  companyCategoryTagOptions: string[];
  clearCompanyFilters: () => void;
}) {

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-bold">Market / Sector / Category Filters</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Filter the company list by assigned segmentation tags.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        <div>
          <label className="text-sm font-semibold text-slate-700">Market</label>
          <select
            value={companyMarketTagFilter}
            onChange={(event) => setCompanyMarketTagFilter(event.target.value)}
            className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {companyMarketTagOptions.map((option) => (
              <option key={`market-filter-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Sector</label>
          <select
            value={companySectorTagFilter}
            onChange={(event) => setCompanySectorTagFilter(event.target.value)}
            className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {companySectorTagOptions.map((option) => (
              <option key={`sector-filter-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Category</label>
          <select
            value={companyCategoryTagFilter}
            onChange={(event) => setCompanyCategoryTagFilter(event.target.value)}
            className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {companyCategoryTagOptions.map((option) => (
              <option key={`category-filter-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={clearCompanyFilters}
            className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Clear All Filters
          </button>
        </div>
      </div>
    </section>
  );
}


type CompanyAccountTypeLens = "End Customer" | "Distributor" | "Unknown";

function normalizeAccountTypeLensText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getCompanyAccountTypeLens(company: unknown): CompanyAccountTypeLens {
  const record = company as unknown as Record<string, unknown>;

  const searchable = [
    "company_name",
    "website",
    "domain",
    "industry",
    "primary_industry",
    "primary_sub_industry",
    "company_type",
    "source",
    "notes",
  ]
    .map((key) => normalizeAccountTypeLensText(record[key]))
    .filter(Boolean)
    .join(" ");

  const distributorSignals = [
    "distributor",
    "distribution",
    "wholesale",
    "reseller",
    "dealer",
    "industrial supply",
    "mro",
    "printing supply",
    "pressroom supply",
  ];

  if (distributorSignals.some((signal) => searchable.includes(signal))) {
    return "Distributor";
  }

  const endCustomerSignals = [
    "manufacturing",
    "manufacturer",
    "machine shop",
    "fabrication",
    "fabricator",
    "metalworking",
    "aerospace",
    "automotive",
    "medical device",
    "food processing",
    "printing",
    "converter",
    "packaging",
    "plant",
    "production",
  ];

  if (endCustomerSignals.some((signal) => searchable.includes(signal))) {
    return "End Customer";
  }

  return "Unknown";
}

function getCompanyAccountTypeLensClass(value: CompanyAccountTypeLens) {
  if (value === "End Customer") return "bg-green-100 text-green-800 ring-green-200";
  if (value === "Distributor") return "bg-blue-100 text-blue-800 ring-blue-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function isCompanyAccountTypeLens(value: unknown): value is CompanyAccountTypeLens {
  return value === "End Customer" || value === "Distributor" || value === "Unknown";
}

function getCompanyRecordKey(company: unknown) {
  const record = company as unknown as Record<string, unknown>;
  return String(record.id || record.company_id || record.company_name || "").trim();
}

function getCompanyEffectiveAccountTypeLens(
  company: unknown,
  overrides: Record<string, CompanyAccountTypeLens> = {}
): CompanyAccountTypeLens {
  const record = company as unknown as Record<string, unknown>;
  const key = getCompanyRecordKey(company);
  const overrideValue = key ? overrides[key] : undefined;

  if (isCompanyAccountTypeLens(overrideValue)) {
    return overrideValue;
  }

  if (isCompanyAccountTypeLens(record.account_type)) {
    return record.account_type;
  }

  return getCompanyAccountTypeLens(company);
}

function getCompanyBuyerPersonaLenses(accountTypeLens: CompanyAccountTypeLens, company: unknown) {
  const record = company as unknown as Record<string, unknown>;
  const searchable = [
    "company_name",
    "website",
    "domain",
    "industry",
    "primary_industry",
    "primary_sub_industry",
    "company_type",
    "source",
    "notes",
  ]
    .map((key) => normalizeAccountTypeLensText(record[key]))
    .filter(Boolean)
    .join(" ");

  if (accountTypeLens === "Distributor") {
    return ["Principal / Owner", "Outside Sales", "Product Specialist", "Inside Sales"];
  }

  if (accountTypeLens === "End Customer") {
    const personas = ["Operations", "Maintenance", "Purchasing"];

    if (
      searchable.includes("quality") ||
      searchable.includes("process") ||
      searchable.includes("aerospace") ||
      searchable.includes("medical") ||
      searchable.includes("printing") ||
      searchable.includes("packaging")
    ) {
      personas.push("Quality / Process");
    }

    if (
      searchable.includes("safety") ||
      searchable.includes("ehs") ||
      searchable.includes("environment") ||
      searchable.includes("solvent") ||
      searchable.includes("chemical")
    ) {
      personas.push("EHS / Safety");
    }

    return Array.from(new Set(personas)).slice(0, 5);
  }

  return ["Discovery Needed"];
}

function getCompanySavedBuyerPersonas(company: unknown) {
  const record = company as unknown as Record<string, unknown>;
  const value = record.buyer_personas;

  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

function getCompanyEffectiveBuyerPersonas(
  accountTypeLens: CompanyAccountTypeLens,
  company: unknown,
  overrides: Record<string, string[]> = {}
) {
  const key = getCompanyRecordKey(company);
  const overrideValue = key ? overrides[key] : undefined;

  if (Array.isArray(overrideValue) && overrideValue.length > 0) {
    return overrideValue;
  }

  const savedPersonas = getCompanySavedBuyerPersonas(company);

  if (savedPersonas.length > 0) {
    return savedPersonas;
  }

  return getCompanyBuyerPersonaLenses(accountTypeLens, company);
}

function getCompanyBuyerPersonaLensClass(persona: string) {
  if (persona === "Discovery Needed") return "bg-slate-50 text-slate-600 ring-slate-200";
  if (persona.includes("Owner") || persona.includes("Outside Sales")) return "bg-blue-50 text-blue-800 ring-blue-200";
  if (persona.includes("Product") || persona.includes("Inside Sales")) return "bg-cyan-50 text-cyan-800 ring-cyan-200";
  if (persona.includes("Operations")) return "bg-green-50 text-green-800 ring-green-200";
  if (persona.includes("Maintenance")) return "bg-amber-50 text-amber-800 ring-amber-200";
  if (persona.includes("Quality")) return "bg-purple-50 text-purple-800 ring-purple-200";
  if (persona.includes("EHS")) return "bg-red-50 text-red-800 ring-red-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

function CompaniesSection({
  companies,
  totalCompanyCount,
  unfilteredCompanyCount = totalCompanyCount,
  roleVisibilityActive = false,
  roleVisibilityNeedsUser = false,
  currentUserDisplayName = "Signed-in CRM user",
  currentUserRole = "admin",
  currentCoverageType = "internal",
  companySearchTerm,
  setCompanySearchTerm,
  companyTierFilter,
  setCompanyTierFilter,
  companyTierOptions,
  companyStatusFilter,
  setCompanyStatusFilter,
  companyStatusOptions,
  companyProductPathFilter,
  setCompanyProductPathFilter,
  companyProductPathOptions,
  
  companyOwnerFilter,
  setCompanyOwnerFilter,
  companyOwnerOptions,
  companySalespersonFilter = "All",
  setCompanySalespersonFilter = () => {},
  companySalesManagerFilter = "All",
  setCompanySalesManagerFilter = () => {},
  companyAssignmentStatusFilter = "All",
  setCompanyAssignmentStatusFilter = () => {},
  companyAccountTypeFilter = "All",
  setCompanyAccountTypeFilter = () => {},
  companyBuyerPersonaFilter = "All",
  setCompanyBuyerPersonaFilter = () => {},
  companyProjectListFilter = "All",
  setCompanyProjectListFilter = () => {},
  companyProjectListOptions = [],
  companyAccountTypeOverrides = {},
  setCompanyAccountTypeOverrides = () => {},
  apiPermissionHeaders = () => ({}),
  companyBuyerPersonaOverrides = {},
  setCompanyBuyerPersonaOverrides = () => {},
  assignmentUserOptions = [],
  companyPrimaryIndustryFilter = "All",
  setCompanyPrimaryIndustryFilter = () => {},
  companyPrimaryIndustryOptions = ["All"],
  companyPrimarySubIndustryFilter = "All",
  setCompanyPrimarySubIndustryFilter = () => {},
  companyPrimarySubIndustryOptions = ["All"],
  clearCompanyFilters,
  canAssignSalesCoverage = false,
  selectedCompanyIds = [],
  setSelectedCompanyIds = () => {},
  bulkAssignedSalespersonId = "",
  setBulkAssignedSalespersonId = () => {},
  bulkAssignedSalesManagerId = "",
  setBulkAssignedSalesManagerId = () => {},
  isBulkAssigningCompanies = false,
  bulkCompanyAssignmentMessage = "",
  onApplyBulkCompanyAssignment = () => {},
  onOpenCompany,
  isLoadingCompanyDetail,
}: {
  companies: CompanySummary[];
  totalCompanyCount: number;
  unfilteredCompanyCount?: number;
  roleVisibilityActive?: boolean;
  roleVisibilityNeedsUser?: boolean;
  currentUserDisplayName?: string;
  currentUserRole?: AppUserRole;
  currentCoverageType?: string;
  companySearchTerm: string;
  setCompanySearchTerm: (value: string) => void;
  companyTierFilter: string;
  setCompanyTierFilter: (value: string) => void;
  companyTierOptions: string[];
  companyStatusFilter: string;
  setCompanyStatusFilter: (value: string) => void;
  companyStatusOptions: string[];
  companyProductPathFilter: string;
  setCompanyProductPathFilter: (value: string) => void;
  companyProductPathOptions: string[];
  
  companyOwnerFilter: string;
  setCompanyOwnerFilter: (value: string) => void;
  companyOwnerOptions: CrmUser[];
  companySalespersonFilter?: string;
  setCompanySalespersonFilter?: (value: string) => void;
  companySalesManagerFilter?: string;
  setCompanySalesManagerFilter?: (value: string) => void;
  companyAssignmentStatusFilter?: string;
  setCompanyAssignmentStatusFilter?: (value: string) => void;
  companyAccountTypeFilter?: string;
  setCompanyAccountTypeFilter?: (value: string) => void;
  companyBuyerPersonaFilter?: string;
  setCompanyBuyerPersonaFilter?: (value: string) => void;
  companyProjectListFilter?: string;
  setCompanyProjectListFilter?: (value: string) => void;
  companyProjectListOptions?: any[];
  companyAccountTypeOverrides?: Record<string, CompanyAccountTypeLens>;
  setCompanyAccountTypeOverrides?: (
    value:
      | Record<string, CompanyAccountTypeLens>
      | ((current: Record<string, CompanyAccountTypeLens>) => Record<string, CompanyAccountTypeLens>)
  ) => void;
  apiPermissionHeaders?: () => Record<string, string>;
  companyBuyerPersonaOverrides?: Record<string, string[]>;
  setCompanyBuyerPersonaOverrides?: (
    value: Record<string, string[]> | ((current: Record<string, string[]>) => Record<string, string[]>)
  ) => void;
  assignmentUserOptions?: CrmUser[];
  companyPrimaryIndustryFilter: string;
  setCompanyPrimaryIndustryFilter: (value: string) => void;
  companyPrimaryIndustryOptions: string[];
  companyPrimarySubIndustryFilter: string;
  setCompanyPrimarySubIndustryFilter: (value: string) => void;
  companyPrimarySubIndustryOptions: string[];
  clearCompanyFilters: () => void;
  canAssignSalesCoverage?: boolean;
  selectedCompanyIds?: string[];
  setSelectedCompanyIds?: (companyIds: string[]) => void;
  bulkAssignedSalespersonId?: string;
  setBulkAssignedSalespersonId?: (value: string) => void;
  bulkAssignedSalesManagerId?: string;
  setBulkAssignedSalesManagerId?: (value: string) => void;
  isBulkAssigningCompanies?: boolean;
  bulkCompanyAssignmentMessage?: string;
  onApplyBulkCompanyAssignment?: () => void;
  onOpenCompany: (companyId: string) => void;
  isLoadingCompanyDetail: boolean;
}) {

  const visibleCompanyIds = companies.map((company) => String(company.id));
  const bulkAssignmentUsers =
    assignmentUserOptions.length > 0 ? assignmentUserOptions : companyOwnerOptions;
  const activeBulkAssignmentUsers = bulkAssignmentUsers.filter(
    (user) => !user.status || String(user.status).toLowerCase() === "active"
  );

  const missingSalespersonCoverageCount = companies.filter(
    (company) => !String(company.assigned_salesperson_id || "")
  ).length;
  const missingSalesManagerCoverageCount = companies.filter(
    (company) => !String(company.assigned_sales_manager_id || "")
  ).length;
  const fullyAssignedCoverageCount = companies.filter(
    (company) =>
      Boolean(String(company.assigned_salesperson_id || "")) &&
      Boolean(String(company.assigned_sales_manager_id || ""))
  ).length;

  const [buyerPersonaDefinitionOptions, setBuyerPersonaDefinitionOptions] = useState<string[]>([]);
  const [buyerPersonaDefinitionError, setBuyerPersonaDefinitionError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBuyerPersonaDefinitions() {
      try {
        const response = await fetch("/api/buyer-persona-definitions");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Could not load Buyer Persona definitions."
          );
        }

        const options = Array.isArray(data.buyerPersonaDefinitions)
          ? data.buyerPersonaDefinitions
              .map((definition: any) =>
                String(definition?.persona_name || "").trim()
              )
              .filter(Boolean)
          : [];

        if (!cancelled) {
          setBuyerPersonaDefinitionOptions(Array.from(new Set(options)));
          setBuyerPersonaDefinitionError("");
        }
      } catch (error) {
        if (!cancelled) {
          setBuyerPersonaDefinitionOptions([]);
          setBuyerPersonaDefinitionError(
            error instanceof Error
              ? error.message
              : "Could not load Buyer Persona definitions."
          );
        }
      }
    }

    loadBuyerPersonaDefinitions();

    return () => {
      cancelled = true;
    };
  }, []);

  const companyBuyerPersonaOptions = useMemo(() => {
    const savedOptions = companies.flatMap((company) =>
      getCompanySavedBuyerPersonas(company)
    );

    return Array.from(
      new Set([
        ...buyerPersonaDefinitionOptions,
        ...savedOptions,
      ])
    );
  }, [companies, buyerPersonaDefinitionOptions]);

  const coverageFiltersAreActive =
    companySalespersonFilter !== "All" ||
    companySalesManagerFilter !== "All" ||
    companyAssignmentStatusFilter !== "All" ||
    companyAccountTypeFilter !== "All" ||
    companyBuyerPersonaFilter !== "All";

  function clearCoverageFilters() {
    setCompanySalespersonFilter("All");
    setCompanySalesManagerFilter("All");
    setCompanyAssignmentStatusFilter("All");
    setCompanyAccountTypeFilter("All");
    setCompanyBuyerPersonaFilter("All");
  }

  function applyCoverageWorkQueue(queue: "missingRep" | "missingManager" | "missingAny" | "fullyAssigned") {
    setCompanySalespersonFilter("All");
    setCompanySalesManagerFilter("All");

    if (queue === "missingRep") {
      setCompanyAssignmentStatusFilter("Unassigned Salesperson");
      return;
    }

    if (queue === "missingManager") {
      setCompanyAssignmentStatusFilter("Unassigned Sales Manager");
      return;
    }

    if (queue === "missingAny") {
      setCompanyAssignmentStatusFilter("Missing Any Coverage");
      return;
    }

    setCompanyAssignmentStatusFilter("Fully Assigned");
  }

  const bulkManagerUsers = activeBulkAssignmentUsers.filter((user) => {
    const role = String(user.user_role || user.role || user.userRole || "")
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    return role === "admin" || role === "sales_manager" || role === "manager";
  });
  const selectedVisibleCompanyCount = visibleCompanyIds.filter((companyId) =>
    selectedCompanyIds.includes(companyId)
  ).length;
  const allVisibleCompaniesSelected =
    visibleCompanyIds.length > 0 && selectedVisibleCompanyCount === visibleCompanyIds.length;

  function toggleCompanySelection(companyId: string) {
    if (!canAssignSalesCoverage) return;

    setSelectedCompanyIds(
      selectedCompanyIds.includes(companyId)
        ? selectedCompanyIds.filter((selectedCompanyId) => selectedCompanyId !== companyId)
        : [...selectedCompanyIds, companyId]
    );
  }

  function toggleAllVisibleCompanies() {
    if (!canAssignSalesCoverage) return;

    if (allVisibleCompaniesSelected) {
      setSelectedCompanyIds(
        selectedCompanyIds.filter((companyId) => !visibleCompanyIds.includes(companyId))
      );
      return;
    }

    setSelectedCompanyIds(Array.from(new Set([...selectedCompanyIds, ...visibleCompanyIds])));
  }

  function formatEmployeeCount(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString();

    if (typeof value === "string" && /^[0-9]+$/.test(value.trim())) {
      return Number(value.trim()).toLocaleString();
    }

    return "-";
  }

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold">Companies</h2>
          <p className="mt-2 text-sm text-slate-600">
            Company records created from ZoomInfo imports. Click a company name to open the detail view.
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Showing <span className="font-bold">{companies.length}</span> of{" "}
          <span className="font-bold">{totalCompanyCount}</span>
        </div>
      </div>

      {roleVisibilityActive && (
        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-bold">Companies are filtered by current role visibility.</p>
          <p className="mt-1">
            Current user: <span className="font-semibold">{currentUserDisplayName}</span>
            {" - "}
            <span className="font-semibold">{formatAppUserRole(currentUserRole)}</span>
            {" - "}
            <span className="font-semibold">{formatCoverageType(currentCoverageType)}</span>
          </p>
          <p className="mt-1 text-xs leading-5">
            Admins and Sales Managers see all companies.
            Sales Reps see companies where they are assigned as Salesperson / Rep.
          </p>
          <p className="mt-2 rounded-lg bg-white p-2 text-xs font-semibold text-blue-900 ring-1 ring-blue-100">
            Company visibility reason: {getRoleVisibilityReason(currentUserRole, currentUserDisplayName)}
          </p>
        </div>
      )}

      {roleVisibilityNeedsUser && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Apply Role Visibility is on, but no CRM user is selected. Select a CRM user to test Sales Manager or Sales Rep visibility.
        </div>
      )}

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Coverage Snapshot</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{companies.length}</p>
          <p className="mt-1 text-xs text-slate-600">Visible companies in current view</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Missing Rep</p>
          <p className="mt-2 text-2xl font-black text-amber-900">{missingSalespersonCoverageCount}</p>
          <p className="mt-1 text-xs text-amber-800">No Salesperson / Rep assigned</p>
        </div>

        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Missing Manager</p>
          <p className="mt-2 text-2xl font-black text-orange-900">{missingSalesManagerCoverageCount}</p>
          <p className="mt-1 text-xs text-orange-800">No Sales Manager assigned</p>
        </div>

        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-green-700">Fully Assigned</p>
          <p className="mt-2 text-2xl font-black text-green-900">{fullyAssignedCoverageCount}</p>
          <p className="mt-1 text-xs text-green-800">Rep and manager coverage present</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Sales Manager Work Queue</p>
            <h3 className="mt-1 text-lg font-bold text-blue-950">Prioritize company coverage cleanup</h3>
            <p className="mt-1 text-sm leading-6 text-blue-900">
              Use these shortcuts to isolate companies that need rep assignment, manager assignment, or complete coverage before sales follow-up.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyCoverageWorkQueue("missingRep")}
              className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
            >
              Missing Rep Queue
            </button>
            <button
              type="button"
              onClick={() => applyCoverageWorkQueue("missingManager")}
              className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-700"
            >
              Missing Manager Queue
            </button>
            <button
              type="button"
              onClick={() => applyCoverageWorkQueue("missingAny")}
              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700"
            >
              Missing Any Coverage
            </button>
            <button
              type="button"
              onClick={() => applyCoverageWorkQueue("fullyAssigned")}
              className="rounded-lg bg-green-700 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-green-800"
            >
              Fully Assigned
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Search Companies</label>
            <input
              type="text"
              value={companySearchTerm}
              onChange={(event) => setCompanySearchTerm(event.target.value)}
              placeholder="Search name, industry, city, state, website, product path..."
              className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Priority Tier</label>
            <select
              value={companyTierFilter}
              onChange={(event) => setCompanyTierFilter(event.target.value)}
              className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {companyTierOptions.map((option) => (
                <option key={`tier-${option}`} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Status</label>
            <select
              value={companyStatusFilter}
              onChange={(event) => setCompanyStatusFilter(event.target.value)}
              className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {companyStatusOptions.map((option) => (
                <option key={`status-${option}`} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label className="text-sm font-semibold text-slate-700">Product Path</label>
            <select
              value={companyProductPathFilter}
              onChange={(event) => setCompanyProductPathFilter(event.target.value)}
              className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {companyProductPathOptions.map((option) => (
                <option key={`path-${option}`} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Salesperson / Rep</label>
              <select
                value={companySalespersonFilter}
                onChange={(event) => setCompanySalespersonFilter(event.target.value)}
                className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="All">All</option>
                <option value="Unassigned">Unassigned</option>
                {activeBulkAssignmentUsers
                  .filter((user) => {
                    const role = String(user.user_role || user.role || user.userRole || "")
                      .toLowerCase()
                      .replace(/[\s-]+/g, "_");
                    return role !== "sales_manager" && role !== "manager";
                  })
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.display_name || user.email}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Sales Manager</label>
              <select
                value={companySalesManagerFilter}
                onChange={(event) => setCompanySalesManagerFilter(event.target.value)}
                className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="All">All</option>
                <option value="Unassigned">Unassigned</option>
                {bulkManagerUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name || user.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Assignment Status</label>
              <select
                value={companyAssignmentStatusFilter}
                onChange={(event) => setCompanyAssignmentStatusFilter(event.target.value)}
                className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="All">All</option>
                <option value="Unassigned Salesperson">Unassigned Salesperson</option>
                <option value="Unassigned Sales Manager">Unassigned Sales Manager</option>
                <option value="Missing Any Coverage">Missing Any Coverage</option>
                <option value="Fully Assigned">Fully Assigned</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Account Type Lens</label>
              <select
                value={companyAccountTypeFilter}
                onChange={(event) => setCompanyAccountTypeFilter(event.target.value)}
                className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="All">All</option>
                <option value="End Customer">End Customer</option>
                <option value="Distributor">Distributor</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Buyer Persona</label>
              <select
                value={companyBuyerPersonaFilter}
                onChange={(event) => setCompanyBuyerPersonaFilter(event.target.value)}
                className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="All">All</option>
                {companyBuyerPersonaOptions.map((personaOption) => (
                  <option key={personaOption} value={personaOption}>
                    {personaOption}
                  </option>
                ))}
              </select>
            </div>

            {buyerPersonaDefinitionError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-800 lg:col-span-2 xl:col-span-3">
                {buyerPersonaDefinitionError}
              </div>
            )}

            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900 lg:col-span-2 xl:col-span-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p>
                  <span className="font-semibold">Coverage filters:</span> Salesperson / Rep identifies direct account coverage. Sales Manager identifies oversight coverage. Assignment Status helps find coverage gaps such as missing rep assignment, missing manager assignment, or fully assigned accounts. Account Type Lens is a read-only classification for separating likely end customers from distributors before a database-backed account type field is added. Buyer Persona Lens adds read-only persona badges to clarify the likely selling motion for each account. Account Type can now be changed with the visible Edit Account Type control in each company row. Rev 2.19 saves Account Type to the companies table. Rev 2.20 saves editable Buyer Personas to the companies table while still falling back to calculated personas when no saved personas exist.
                </p>
                <button
                  type="button"
                  onClick={clearCoverageFilters}
                  disabled={!coverageFiltersAreActive}
                  className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-800 shadow-sm transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear coverage filters
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Project / List</label>
              <select
                value={companyProjectListFilter}
                onChange={(event) => setCompanyProjectListFilter(event.target.value)}
                className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="All">All Projects / Lists</option>
                {companyProjectListOptions.map((item: any) => (
                  <option key={String(item.id)} value={String(item.id)}>
                    {item.project_kind === "list" ? "List" : "Project"}:{" "}
                    {item.project_name}
                    {item.status === "archived" ? " (Archived)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Primary Industry</label>
              <select
                value={companyPrimaryIndustryFilter}
                onChange={(event) => setCompanyPrimaryIndustryFilter(event.target.value)}
                className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {companyPrimaryIndustryOptions.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Primary Sub-Industry</label>
              <select
                value={companyPrimarySubIndustryFilter}
                onChange={(event) => setCompanyPrimarySubIndustryFilter(event.target.value)}
                className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {companyPrimarySubIndustryOptions.map((subIndustry) => (
                  <option key={subIndustry} value={subIndustry}>
                    {subIndustry}
                  </option>
                ))}
              </select>
            </div>



          <div className="flex items-end">
            <button
              type="button"
              onClick={clearCompanyFilters}
              className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold text-blue-900">Bulk Company Assignment</p>
            <p className="mt-1 text-xs leading-5 text-blue-800">
              Select companies below, then assign the selected records to one salesperson and/or one sales manager.
            </p>
            {!canAssignSalesCoverage && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-semibold leading-5 text-amber-800">
                Assignment controls are available to Admins and Sales Managers only.
              </p>
            )}
            <p className="mt-2 text-xs font-semibold text-blue-900">
              Selected: {selectedCompanyIds.length} total - {selectedVisibleCompanyCount} visible
            </p>
          </div>

          <div className="grid flex-1 gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-blue-900">Salesperson / Rep</label>
              <select
                value={bulkAssignedSalespersonId}
                disabled={!canAssignSalesCoverage || isBulkAssigningCompanies}
                onChange={(event) => setBulkAssignedSalespersonId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">Do not change</option>
                {activeBulkAssignmentUsers
                  .map((user) => (
                    <option key={`bulk-rep-${user.id}`} value={user.id}>
                      {user.display_name || user.email}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-blue-900">Sales Manager</label>
              <select
                value={bulkAssignedSalesManagerId}
                disabled={!canAssignSalesCoverage || isBulkAssigningCompanies}
                onChange={(event) => setBulkAssignedSalesManagerId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">Do not change</option>
                {bulkManagerUsers
                  .map((user) => (
                    <option key={`bulk-manager-${user.id}`} value={user.id}>
                      {user.display_name || user.email}
                    </option>
                  ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onApplyBulkCompanyAssignment}
              disabled={
                !canAssignSalesCoverage ||
                isBulkAssigningCompanies ||
                selectedCompanyIds.length === 0 ||
                (!bulkAssignedSalespersonId && !bulkAssignedSalesManagerId)
              }
              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isBulkAssigningCompanies ? "Assigning..." : "Apply Bulk Assignment"}
            </button>
          </div>
        </div>

        {bulkCompanyAssignmentMessage && (
          <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-blue-900 ring-1 ring-blue-100">
            {bulkCompanyAssignmentMessage}
          </p>
        )}
      </div>

      {companies.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          No companies match the current search or filters.
        </p>
      ) : (
        <div className="mt-4 max-w-full overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 pr-4 font-semibold">
                  <input
                    type="checkbox"
                    checked={allVisibleCompaniesSelected}
                    onChange={toggleAllVisibleCompanies}
                    aria-label="Select all visible companies"
                    className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                  />
                </th>
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
                const companyMissingSalespersonCoverage = !String(company.assigned_salesperson_id || "");
                const companyMissingSalesManagerCoverage = !String(company.assigned_sales_manager_id || "");
                const companyFullyAssignedCoverage =
                  !companyMissingSalespersonCoverage && !companyMissingSalesManagerCoverage;
                const companyMissingAnyCoverage =
                  companyMissingSalespersonCoverage || companyMissingSalesManagerCoverage;
                const rowCompanyKey = getCompanyRecordKey(company);
                const rowAccountTypeLens = getCompanyEffectiveAccountTypeLens(company, companyAccountTypeOverrides);
                const rowBuyerPersonas = getCompanyEffectiveBuyerPersonas(rowAccountTypeLens, company, companyBuyerPersonaOverrides);

                return (
                  <tr key={company.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-4">
                      <input
                        type="checkbox"
                        checked={selectedCompanyIds.includes(String(company.id))}
                        disabled={!canAssignSalesCoverage}
                        onChange={() => toggleCompanySelection(String(company.id))}
                        aria-label={`Select ${company.company_name}`}
                        className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => onOpenCompany(company.id)}
                        disabled={isLoadingCompanyDetail}
                        className="text-left font-semibold text-blue-700 hover:text-blue-900 hover:underline disabled:cursor-wait disabled:text-slate-400"
                      >
                        {company.company_name}
                      </button>
                      <p className="text-xs text-slate-500">
                        {company.domain || company.website || "No website"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {companyMissingSalespersonCoverage && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                            Missing Rep
                          </span>
                        )}
                        {companyMissingSalesManagerCoverage && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-800">
                            Missing Manager
                          </span>
                        )}
                        {companyMissingAnyCoverage && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-red-100">
                            Missing Coverage
                          </span>
                        )}
                        {companyFullyAssignedCoverage && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-800">
                            Fully Assigned
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${getCompanyAccountTypeLensClass(rowAccountTypeLens)}`}>
                          {rowAccountTypeLens}
                        </span>
                        <label className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-900 ring-1 ring-blue-100">
                          <span>Edit Account Type</span>
                          <select
                            value={rowAccountTypeLens}
                            onChange={async (event) => {
                              if (!rowCompanyKey) return;
                              const nextValue = event.target.value;
                              if (!isCompanyAccountTypeLens(nextValue)) return;

                              setCompanyAccountTypeOverrides((current) => ({
                                ...current,
                                [rowCompanyKey]: nextValue,
                              }));

                              try {
                                const response = await fetch("/api/company-account-type", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    ...apiPermissionHeaders(),
                                  },
                                  body: JSON.stringify({
                                    companyId: rowCompanyKey,
                                    accountType: nextValue,
                                  }),
                                });

                                if (!response.ok) {
                                  const payload = await response.json().catch(() => null);
                                  throw new Error(
                                    payload && typeof payload.error === "string"
                                      ? payload.error
                                      : "Failed to save Account Type."
                                  );
                                }
                              } catch (error) {
                                console.error("Failed to save Account Type:", error);
                                window.alert(
                                  "Account Type changed on screen, but it did not save to the database. Please refresh and try again."
                                );
                              }
                            }}
                            className="rounded-md border border-blue-200 bg-white px-1 py-0.5 text-[11px] font-semibold text-blue-900 shadow-sm"
                            title="Session-only Account Type override"
                          >
                            <option value="End Customer">End Customer</option>
                            <option value="Distributor">Distributor</option>
                            <option value="Unknown">Unknown</option>
                          </select>
                        </label>
                        {rowBuyerPersonas.map((persona) => (
                          <span
                            key={persona}
                            className={`inline-flex items-center self-start rounded-full px-2.5 py-1 text-xs font-bold leading-none ring-1 ${getCompanyBuyerPersonaLensClass(persona)}`}
                          >
                            {persona}
                          </span>
                        ))}
                        <details className="self-start rounded-xl border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 shadow-sm">
                          <summary className="cursor-pointer font-bold text-slate-800">Edit Personas</summary>
                          <div className="mt-2 grid gap-1">
                            {Array.from(
                              new Set([
                                ...buyerPersonaDefinitionOptions,
                                ...rowBuyerPersonas,
                              ])
                            ).map((personaOption) => {
                              const checked = rowBuyerPersonas.includes(personaOption);

                              return (
                                <label key={personaOption} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={async (event) => {
                                      if (!rowCompanyKey) return;

                                      const nextPersonas = event.target.checked
                                        ? Array.from(new Set([...rowBuyerPersonas.filter((item) => item !== "Discovery Needed"), personaOption]))
                                        : rowBuyerPersonas.filter((item) => item !== personaOption);

                                      const normalizedPersonas = nextPersonas.length ? nextPersonas : ["Discovery Needed"];

                                      setCompanyBuyerPersonaOverrides((current) => ({
                                        ...current,
                                        [rowCompanyKey]: normalizedPersonas,
                                      }));

                                      try {
                                        const response = await fetch("/api/company-buyer-personas", {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                            ...apiPermissionHeaders(),
                                          },
                                          body: JSON.stringify({
                                            companyId: rowCompanyKey,
                                            buyerPersonas: normalizedPersonas,
                                          }),
                                        });

                                        if (!response.ok) {
                                          const payload = await response.json().catch(() => null);
                                          throw new Error(
                                            payload && typeof payload.error === "string"
                                              ? payload.error
                                              : "Failed to save Buyer Personas."
                                          );
                                        }
                                      } catch (error) {
                                        console.error("Failed to save Buyer Personas:", error);
                                        const message = error instanceof Error ? error.message : "Unknown save error.";
                                        window.alert(
                                          `Buyer Personas changed on screen, but they did not save to the database. Save error: ${message}`
                                        );
                                      }
                                    }}
                                  />
                                  <span>{personaOption}</span>
                                </label>
                              );
                            })}
                          </div>
                        </details>
                      </div>
                    </td>
                    <td className="max-w-[260px] py-3 pr-4 text-slate-700">
                      {company.industry || "Not provided"}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      {[company.city, company.state].filter(Boolean).join(", ") || "Not provided"}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      {formatEmployeeCount(company.employee_count)}
                    </td>
                    <td className="py-3 pr-4 font-semibold">
                      {prospect?.priority_score ?? "-"}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                        {safeDisplayText(prospect?.priority_tier, "-")}
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

function ContactTagFilterPanel({
  contactSearchTerm,
  setContactSearchTerm,
  contactMarketTagFilter,
  setContactMarketTagFilter,
  contactMarketTagOptions,
  contactSectorTagFilter,
  setContactSectorTagFilter,
  contactSectorTagOptions,
  contactCategoryTagFilter,
  setContactCategoryTagFilter,
  contactCategoryTagOptions,
  contactProjectListFilter,
  setContactProjectListFilter,
  contactProjectListOptions,
  filteredContactCount,
  totalVisibleContactCount,
  clearContactFilters,
}: {
  contactSearchTerm: string;
  setContactSearchTerm: (value: string) => void;
  contactMarketTagFilter: string;
  setContactMarketTagFilter: (value: string) => void;
  contactMarketTagOptions: string[];
  contactSectorTagFilter: string;
  setContactSectorTagFilter: (value: string) => void;
  contactSectorTagOptions: string[];
  contactCategoryTagFilter: string;
  setContactCategoryTagFilter: (value: string) => void;
  contactCategoryTagOptions: string[];
  contactProjectListFilter: string;
  setContactProjectListFilter: (value: string) => void;
  contactProjectListOptions: any[];
  filteredContactCount: number;
  totalVisibleContactCount: number;
  clearContactFilters: () => void;
}) {

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Contact Search and Filters</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Filter contacts by name, company, title, function, email, assigned tags, or Project / List membership.
          </p>
        </div>

        <div className="w-fit rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          {filteredContactCount} of {totalVisibleContactCount} Contacts
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label className="text-sm font-semibold text-slate-700">Search Contacts</label>
          <input
            type="text"
            value={contactSearchTerm}
            onChange={(event) => setContactSearchTerm(event.target.value)}
            placeholder="Search name, company, title, email, function, tags..."
            className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Market</label>
          <select
            value={contactMarketTagFilter}
            onChange={(event) => setContactMarketTagFilter(event.target.value)}
            className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {contactMarketTagOptions.map((option) => (
              <option key={`contact-market-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Sector</label>
          <select
            value={contactSectorTagFilter}
            onChange={(event) => setContactSectorTagFilter(event.target.value)}
            className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {contactSectorTagOptions.map((option) => (
              <option key={`contact-sector-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Category</label>
          <select
            value={contactCategoryTagFilter}
            onChange={(event) => setContactCategoryTagFilter(event.target.value)}
            className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {contactCategoryTagOptions.map((option) => (
              <option key={`contact-category-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Project / List</label>
          <select
            value={contactProjectListFilter}
            onChange={(event) => setContactProjectListFilter(event.target.value)}
            className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="All">All Projects / Lists</option>
            {contactProjectListOptions.map((item: any) => (
              <option key={String(item.id)} value={String(item.id)}>
                {item.project_kind === "list" ? "List" : "Project"}:{" "}
                {item.project_name}
                {item.status === "archived" ? " (Archived)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-6 flex justify-start">
          <button
            type="button"
            onClick={clearContactFilters}
            className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Clear Contact Filters
          </button>
        </div>
      </div>
    </section>
  );
}

function ContactsSection({
  contacts,
  totalContactCount,
}: {
  contacts: ContactSummary[];
  totalContactCount: number;
}) {

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Contacts</h2>
      <p className="mt-2 text-sm text-slate-600">
        Contacts attached to imported company records.
      </p>

      {contacts.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          No contacts imported yet.
        </p>
      ) : (
        <div className="mt-4 max-w-full overflow-x-auto">
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
              {contacts.map((contact: any) => (
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
                  <td className="py-3 pr-4 text-slate-700">{contact.email || "-"}</td>
                  <td className="py-3 pr-4 text-slate-700">{contact.direct_phone || "-"}</td>
                  <td className="py-3 pr-4 text-slate-700">{contact.mobile_phone || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CompanyDetailSection({
  detail,
  activityForm,
  setActivityForm,
  isSavingActivity,
  isCompletingActivity,
  isAnalyzingProspect,
  onSaveActivity,
  onUpdateActivity,
  onCompleteActivity,
  onAnalyzeProspect,
  onRefreshCompanyDetail,
  isRefreshingCompanyDetail = false,
  onBack,
  salesCoverageCanEdit = true,
  canMoveOpportunityStages = true,
  canManageProjectsLists = false,
  apiPermissionHeaders = () => ({}),
}: {
  detail: CompanyDetail | null;
  activityForm: ActivityForm;
  setActivityForm: (form: ActivityForm) => void;
  isSavingActivity: boolean;
  isCompletingActivity: string;
  isAnalyzingProspect: boolean;
  onSaveActivity: () => void;
  onUpdateActivity: (activityId: string, form: ActivityForm) => Promise<boolean>;
  onCompleteActivity: (activityId: string, companyId?: string | null) => void;
  onAnalyzeProspect: () => void;
  onRefreshCompanyDetail: (companyId: string) => void;
  isRefreshingCompanyDetail?: boolean;
  onBack: () => void;
  salesCoverageCanEdit?: boolean;
  canMoveOpportunityStages?: boolean;
  canManageProjectsLists?: boolean;
  apiPermissionHeaders?: any;
}) {
  const [companyActivityHistoryFilter, setCompanyActivityHistoryFilter] = useState<
    "All" | "Open" | "Overdue" | "Due Today" | "Completed"
  >("All");
  const [companyActivityHistorySort, setCompanyActivityHistorySort] = useState<
    "Newest first" | "Due date first" | "Open first"
  >("Newest first");
  const [companyActivityHistorySearchTerm, setCompanyActivityHistorySearchTerm] = useState("");
  const [companyActivityHistoryTypeFilter, setCompanyActivityHistoryTypeFilter] = useState("All Types");
  const [expandedCompanyActivityNoteIds, setExpandedCompanyActivityNoteIds] = useState<Record<string, boolean>>({});
  const [editingCompanyActivityId, setEditingCompanyActivityId] = useState("");
  const [confirmDiscardCompanyActivityEdit, setConfirmDiscardCompanyActivityEdit] = useState(false);
  const [companyActivityEditForm, setCompanyActivityEditForm] = useState<ActivityForm>({
    activityType: "note",
    subject: "",
    notes: "",
    dueDate: "",
    primaryContactId: "",
    relatedContactIds: [],
  });
  const [companyDetailBuyerPersonaDefinitions, setCompanyDetailBuyerPersonaDefinitions] = useState<any[]>([]);
  const [companyDetailBuyerPersonaDefinitionError, setCompanyDetailBuyerPersonaDefinitionError] = useState("");
  const [showAiAnalysisHistory, setShowAiAnalysisHistory] = useState(false);
  const [unifiedTimeline, setUnifiedTimeline] = useState<any[]>([]);
  const [isLoadingUnifiedTimeline, setIsLoadingUnifiedTimeline] = useState(false);
  const [unifiedTimelineError, setUnifiedTimelineError] = useState("");
  const [unifiedTimelineSourceFilter, setUnifiedTimelineSourceFilter] = useState<
    "all" | "company" | "opportunity"
  >("all");
  const [unifiedTimelineStatusFilter, setUnifiedTimelineStatusFilter] = useState<
    "all" | "open" | "completed"
  >("all");
  const [unifiedTimelineSearch, setUnifiedTimelineSearch] = useState("");
  const [showAddContactForm, setShowAddContactForm] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [contactError, setContactError] = useState("");
  const [editingContactId, setEditingContactId] = useState("");
  const [archivingContactId, setArchivingContactId] = useState("");
  const [manualContactForm, setManualContactForm] = useState<ManualContactForm>({
    firstName: "",
    lastName: "",
    title: "",
    managementLevel: "",
    department: "",
    functionArea: "",
    email: "",
    directPhone: "",
    mobilePhone: "",
    personCity: "",
    personState: "",
    personCountry: "",
    linkedinUrl: "",
    buyingRoleHypothesis: "",
    isPrimary: false,
  });

  function resetManualContactForm() {
    setManualContactForm({
      firstName: "",
      lastName: "",
      title: "",
      managementLevel: "",
      department: "",
      functionArea: "",
      email: "",
      directPhone: "",
      mobilePhone: "",
      personCity: "",
      personState: "",
      personCountry: "",
      linkedinUrl: "",
      buyingRoleHypothesis: "",
      isPrimary: false,
    });
  }

  async function getVerifiedContactHeaders() {
    if (!hasBrowserSupabaseConfig()) {
      throw new Error("Browser Supabase configuration is not available.");
    }

    const supabase = getBrowserSupabaseClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error(error.message || "Could not read the signed-in session.");
    }

    const accessToken = data.session?.access_token;

    if (!accessToken) {
      throw new Error("A signed-in Supabase session is required.");
    }

    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  function startEditingContact(contact: any) {
    setEditingContactId(String(contact.id || ""));
    setShowAddContactForm(true);
    setContactMessage("");
    setContactError("");
    setManualContactForm({
      firstName: String(contact.first_name || ""),
      lastName: String(contact.last_name || ""),
      title: String(contact.title || ""),
      managementLevel: String(contact.management_level || ""),
      department: String(contact.department || ""),
      functionArea: String(contact.function_area || ""),
      email: String(contact.email || ""),
      directPhone: String(contact.direct_phone || ""),
      mobilePhone: String(contact.mobile_phone || ""),
      personCity: String(contact.person_city || ""),
      personState: String(contact.person_state || ""),
      personCountry: String(contact.person_country || ""),
      linkedinUrl: String(contact.linkedin_url || ""),
      buyingRoleHypothesis: String(contact.buying_role_hypothesis || ""),
      isPrimary: Boolean(contact.is_primary),
    });
  }

  function cancelContactForm() {
    resetManualContactForm();
    setEditingContactId("");
    setShowAddContactForm(false);
    setContactError("");
  }

  async function archiveContact(contactId: string) {
    const companyId = String(detail?.company?.id || "").trim();
    if (!companyId || !contactId || archivingContactId) return;

    const confirmed =
      typeof window === "undefined"
        ? false
        : window.confirm(
            "Archive this contact? The contact will be removed from active company views but retained in the CRM database."
          );

    if (!confirmed) return;

    setArchivingContactId(contactId);
    setContactMessage("");
    setContactError("");

    try {
      const headers = await getVerifiedContactHeaders();
      const response = await fetch("/api/contacts", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          contactId,
          archived: true,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not archive the contact.");
      }

      if (editingContactId === contactId) {
        cancelContactForm();
      }

      setContactMessage("Contact archived successfully.");
      await onRefreshCompanyDetail(companyId);
    } catch (error) {
      setContactError(
        error instanceof Error ? error.message : "Could not archive the contact."
      );
    } finally {
      setArchivingContactId("");
    }
  }

  async function saveManualContact() {
    const companyId = String(detail?.company?.id || "").trim();
    if (!companyId || isSavingContact) return;

    const hasName =
      manualContactForm.firstName.trim().length > 0 ||
      manualContactForm.lastName.trim().length > 0;
    const hasEmail = manualContactForm.email.trim().length > 0;

    if (!hasName && !hasEmail) {
      setContactError("Enter a first or last name, or an email address.");
      return;
    }

    setIsSavingContact(true);
    setContactMessage("");
    setContactError("");

    try {
      const headers = await getVerifiedContactHeaders();
      const response = await fetch("/api/contacts", {
        method: editingContactId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify({
          ...(editingContactId ? { contactId: editingContactId } : { companyId }),
          firstName: manualContactForm.firstName,
          lastName: manualContactForm.lastName,
          title: manualContactForm.title,
          managementLevel: manualContactForm.managementLevel,
          department: manualContactForm.department,
          functionArea: manualContactForm.functionArea,
          email: manualContactForm.email,
          directPhone: manualContactForm.directPhone,
          mobilePhone: manualContactForm.mobilePhone,
          personCity: manualContactForm.personCity,
          personState: manualContactForm.personState,
          personCountry: manualContactForm.personCountry,
          linkedinUrl: manualContactForm.linkedinUrl,
          buyingRoleHypothesis: manualContactForm.buyingRoleHypothesis,
          isPrimary: manualContactForm.isPrimary,
          source: "Manual",
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not create the contact.");
      }

      const wasEditing = Boolean(editingContactId);
      resetManualContactForm();
      setEditingContactId("");
      setShowAddContactForm(false);
      setContactMessage(
        wasEditing ? "Contact updated successfully." : "Contact added successfully."
      );
      await onRefreshCompanyDetail(companyId);
    } catch (error) {
      setContactError(
        error instanceof Error ? error.message : "Could not create the contact."
      );
    } finally {
      setIsSavingContact(false);
    }
  }

  async function loadUnifiedTimeline() {
    const companyId = String(detail?.company?.id || "").trim();
    if (!companyId) return;

    setIsLoadingUnifiedTimeline(true);
    setUnifiedTimelineError("");

    try {
      if (!hasBrowserSupabaseConfig()) {
        throw new Error("Browser Supabase configuration is not available.");
      }

      const supabase = getBrowserSupabaseClient();
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw new Error(error.message || "Could not read the signed-in session.");
      }

      const accessToken = data.session?.access_token;
      if (!accessToken) {
        throw new Error("A signed-in Supabase session is required.");
      }

      const response = await fetch(
        `/api/company-activity-timeline?companyId=${encodeURIComponent(companyId)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not load the unified activity timeline.");
      }

      setUnifiedTimeline(payload.timeline ?? []);
    } catch (error) {
      setUnifiedTimeline([]);
      setUnifiedTimelineError(
        error instanceof Error ? error.message : "Could not load the unified activity timeline."
      );
    } finally {
      setIsLoadingUnifiedTimeline(false);
    }
  }

  useEffect(() => {
    void loadUnifiedTimeline();
  }, [detail?.company?.id, detail?.activities]);

  function getEditableCompanyActivityType(activityType: unknown): ActivityForm["activityType"] {
    const allowedActivityTypes: ActivityForm["activityType"][] = [
      "note",
      "call",
      "email",
      "meeting",
      "task",
      "quote_followup",
    ];

    return allowedActivityTypes.includes(activityType as ActivityForm["activityType"])
      ? (activityType as ActivityForm["activityType"])
      : "note";
  }

  function startEditingCompanyActivity(activity: any) {
    if (isSavingActivity) return;

    setConfirmDiscardCompanyActivityEdit(false);
    setEditingCompanyActivityId(String(activity.id));
    setCompanyActivityEditForm({
      activityType: getEditableCompanyActivityType(activity.activity_type),
      subject: String(activity.subject || ""),
      notes: String(activity.notes || ""),
      dueDate: activity.due_date ? String(activity.due_date).slice(0, 10) : "",
      primaryContactId: String(activity.contact_id || ""),
      relatedContactIds: Array.isArray(activity.related_contacts)
        ? activity.related_contacts.map((contact: any) => String(contact.id))
        : [],
    });
  }

  function cancelEditingCompanyActivity() {
    setConfirmDiscardCompanyActivityEdit(false);
    setEditingCompanyActivityId("");
    setCompanyActivityEditForm({
      activityType: "note",
      subject: "",
      notes: "",
      dueDate: "",
      primaryContactId: "",
      relatedContactIds: [],
    });
  }

  function requestCancelEditingCompanyActivity() {
    if (isSavingActivity) return;

    if (companyActivityEditHasChanges && !confirmDiscardCompanyActivityEdit) {
      setConfirmDiscardCompanyActivityEdit(true);
      return;
    }

    cancelEditingCompanyActivity();
  }

  async function saveEditingCompanyActivity(activityId: string) {
    if (isSavingActivity) return;

    setConfirmDiscardCompanyActivityEdit(false);

    const saved = await onUpdateActivity(activityId, companyActivityEditForm);

    if (saved) {
      cancelEditingCompanyActivity();
    }
  }

  function toggleCompanyActivityNoteExpansion(activityId: string) {
    setExpandedCompanyActivityNoteIds((current) => ({
      ...current,
      [activityId]: !current[activityId],
    }));
  }

  useEffect(() => {
    setShowAiAnalysisHistory(false);
  }, [detail?.company?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadCompanyDetailBuyerPersonaDefinitions() {
      if (!detail?.company?.id) {
        setCompanyDetailBuyerPersonaDefinitions([]);
        setCompanyDetailBuyerPersonaDefinitionError("");
        return;
      }

      try {
        const response = await fetch(
          "/api/buyer-persona-definitions?includeInactive=true"
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Could not load Buyer Persona definitions."
          );
        }

        if (!cancelled) {
          setCompanyDetailBuyerPersonaDefinitions(
            Array.isArray(data.buyerPersonaDefinitions)
              ? data.buyerPersonaDefinitions
              : []
          );
          setCompanyDetailBuyerPersonaDefinitionError("");
        }
      } catch (error) {
        if (!cancelled) {
          setCompanyDetailBuyerPersonaDefinitions([]);
          setCompanyDetailBuyerPersonaDefinitionError(
            error instanceof Error
              ? error.message
              : "Could not load Buyer Persona definitions."
          );
        }
      }
    }

    loadCompanyDetailBuyerPersonaDefinitions();

    return () => {
      cancelled = true;
    };
  }, [detail?.company?.id]);

  if (!detail) {
    return (
      <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <button
          type="button"
          aria-label="Return to previous CRM view"
          title="Return to previous CRM view"
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Back
        </button>
        <p className="mt-4 text-sm text-slate-600">No company detail loaded.</p>
      </section>
    );
  }
  function companyActivityDateOffset(days: number) {
    return getLocalDateInputValueOffset(days);
  }

  function setCompanyActivityDueDate(dueDate: string) {
    setActivityForm({
      ...activityForm,
      dueDate,
    });
  }

  function clearCompanyActivityForm() {
    setActivityForm({
      activityType: "note",
      subject: "",
      notes: "",
      dueDate: "",
      primaryContactId: "",
      relatedContactIds: [],
    });
  }

  function applyCompanyActivityPreset(
    activityType: ActivityForm["activityType"],
    subject: string,
    notes: string,
    dueDate = activityForm.dueDate
  ) {
    setActivityForm({
      ...activityForm,
      activityType,
      subject,
      notes,
      dueDate,
    });
  }



  const company = detail.company;

  const normalizedUnifiedTimelineSearch = normalizeForSearch(unifiedTimelineSearch);
  const filteredUnifiedTimeline = unifiedTimeline.filter((item: any) => {
    const matchesSource =
      unifiedTimelineSourceFilter === "all" || item.source === unifiedTimelineSourceFilter;
    const matchesStatus =
      unifiedTimelineStatusFilter === "all" ||
      (unifiedTimelineStatusFilter === "open"
        ? !item.completed_at
        : Boolean(item.completed_at));
    const searchableText = [
      item.source_label,
      item.activity_type,
      item.subject,
      item.notes,
      item.opportunity_name,
      item.contact?.full_name,
      item.contact?.email,
      ...(Array.isArray(item.related_contacts)
        ? item.related_contacts.flatMap((contact: any) => [
            contact?.full_name,
            contact?.email,
          ])
        : []),
    ]
      .map(normalizeForSearch)
      .join("  ".trim());
    const matchesSearch =
      !normalizedUnifiedTimelineSearch ||
      searchableText.includes(normalizedUnifiedTimelineSearch);

    return matchesSource && matchesStatus && matchesSearch;
  });
  const unifiedTimelineCompanyCount = unifiedTimeline.filter(
    (item: any) => item.source === "company"
  ).length;
  const unifiedTimelineOpportunityCount = unifiedTimeline.filter(
    (item: any) => item.source === "opportunity"
  ).length;
  const unifiedTimelineOpenCount = unifiedTimeline.filter(
    (item: any) => !item.completed_at
  ).length;
  const unifiedTimelineCompletedCount = unifiedTimeline.filter(
    (item: any) => Boolean(item.completed_at)
  ).length;

  const companyActivityToday = getLocalDateInputValueOffset(0);
  const companyActivities = detail.activities ?? [];
  const companyOpenActivities = companyActivities.filter((activity: any) => !activity.completed_at);
  const companyOverdueActivities = companyActivities.filter(
    (activity: any) => !activity.completed_at && activity.due_date && activity.due_date < companyActivityToday
  );
  const companyDueTodayActivities = companyActivities.filter(
    (activity: any) => !activity.completed_at && activity.due_date === companyActivityToday
  );
  const companyCompletedActivities = companyActivities.filter((activity: any) => activity.completed_at);
  const canSaveCompanyActivity =
    Boolean(activityForm.subject.trim()) || Boolean(activityForm.notes.trim());
  const isEditingCompanyActivity = Boolean(editingCompanyActivityId);
  const selectedEditingCompanyActivity = companyActivities.find(
    (activity: any) => String(activity.id) === editingCompanyActivityId
  );
  const companyActivityEditHasChanges = Boolean(
    selectedEditingCompanyActivity &&
      (companyActivityEditForm.activityType !==
        getEditableCompanyActivityType(selectedEditingCompanyActivity.activity_type) ||
        companyActivityEditForm.subject !== String(selectedEditingCompanyActivity.subject || "") ||
        companyActivityEditForm.notes !== String(selectedEditingCompanyActivity.notes || "") ||
        companyActivityEditForm.dueDate !==
          (selectedEditingCompanyActivity.due_date
            ? String(selectedEditingCompanyActivity.due_date).slice(0, 10)
            : ""))
  );
  const companyActivityHistoryTypeFilters = [
    { label: "All Types", value: "All Types" },
    { label: "Notes", value: "note" },
    { label: "Calls", value: "call" },
    { label: "Emails", value: "email" },
    { label: "Meetings", value: "meeting" },
    { label: "Tasks", value: "task" },
    { label: "Quote Follow-Ups", value: "quote_followup" },
  ];

  function clearCompanyActivityHistoryControls() {
    setCompanyActivityHistorySearchTerm("");
    setCompanyActivityHistoryTypeFilter("All Types");
    setCompanyActivityHistoryFilter("All");
    setCompanyActivityHistorySort("Newest first");
  }
  const normalizedCompanyActivitySearch = normalizeForSearch(companyActivityHistorySearchTerm);
  const filteredCompanyActivities = companyActivities.filter((activity: any) => {
    const matchesStatusFilter =
      companyActivityHistoryFilter === "Open"
        ? !activity.completed_at
        : companyActivityHistoryFilter === "Overdue"
          ? !activity.completed_at && activity.due_date && activity.due_date < companyActivityToday
          : companyActivityHistoryFilter === "Due Today"
            ? !activity.completed_at && activity.due_date === companyActivityToday
            : companyActivityHistoryFilter === "Completed"
              ? Boolean(activity.completed_at)
              : true;

    const searchableText = [
      activity.activity_type,
      activity.subject,
      activity.notes,
      activity.contact?.full_name,
      activity.contact?.email,
      ...(Array.isArray(activity.related_contacts)
        ? activity.related_contacts.flatMap((contact: any) => [
            contact?.full_name,
            contact?.email,
          ])
        : []),
    ]
      .map(normalizeForSearch)
      .join(" ");

    const matchesSearch =
      !normalizedCompanyActivitySearch || searchableText.includes(normalizedCompanyActivitySearch);

    const matchesTypeFilter =
      companyActivityHistoryTypeFilter === "All Types" ||
      activity.activity_type === companyActivityHistoryTypeFilter;

    return matchesStatusFilter && matchesSearch && matchesTypeFilter;
  });
  const sortedCompanyActivities = [...filteredCompanyActivities].sort((a: any, b: any) => {
    if (companyActivityHistorySort === "Open first") {
      const aOpen = a.completed_at ? 1 : 0;
      const bOpen = b.completed_at ? 1 : 0;
      if (aOpen !== bOpen) return aOpen - bOpen;
    }

    if (companyActivityHistorySort === "Due date first") {
      const aDue = a.due_date || "9999-12-31";
      const bDue = b.due_date || "9999-12-31";
      if (aDue !== bDue) return aDue.localeCompare(bDue);
    }

    const aCreated = a.created_at || "";
    const bCreated = b.created_at || "";
    return bCreated.localeCompare(aCreated);
  });
  const selectedCompanyActivityTypeLabel =
    companyActivityHistoryTypeFilters.find(
      (typeFilter) => typeFilter.value === companyActivityHistoryTypeFilter
    )?.label || companyActivityHistoryTypeFilter;

  const companyActivityHistoryActiveControls = [
    companyActivityHistoryFilter !== "All" ? `Status: ${companyActivityHistoryFilter}` : "",
    companyActivityHistoryTypeFilter !== "All Types" ? `Type: ${selectedCompanyActivityTypeLabel}` : "",
    companyActivityHistorySearchTerm.trim() ? `Search: ${companyActivityHistorySearchTerm.trim()}` : "",
    companyActivityHistorySort !== "Newest first" ? `Sort: ${companyActivityHistorySort}` : "",
  ].filter(Boolean);

  const companyActivityHistoryTypeCounts = companyActivityHistoryTypeFilters.reduce<Record<string, number>>(
    (counts, typeFilter) => {
      counts[typeFilter.value] =
        typeFilter.value === "All Types"
          ? companyActivities.length
          : companyActivities.filter((activity: any) => activity.activity_type === typeFilter.value).length;

      return counts;
    },
    {}
  );

  const companyActivityHistoryStatusCounts: Record<string, number> = {
    All: companyActivities.length,
    Open: companyOpenActivities.length,
    Overdue: companyOverdueActivities.length,
    "Due Today": companyDueTodayActivities.length,
    Completed: companyCompletedActivities.length,
  };
  const primaryProspect = detail.primaryProspect;
  const intelligence = detail.intelligence;
  const intelligenceHistory = Array.isArray(detail.intelligenceHistory)
    ? detail.intelligenceHistory
    : [];
  const hasAiAnalysis = hasMeaningfulAnalysis(intelligence);
  const currentSavedAccountType = String(company.account_type || "Unknown").trim() || "Unknown";
  const currentSavedBuyerPersonas = getCompanySavedBuyerPersonas(company).sort((a, b) =>
    a.localeCompare(b)
  );
  const analysisAccountType = String(intelligence?.analysis_account_type || "").trim();
  const analysisBuyerPersonas = Array.isArray(intelligence?.analysis_buyer_personas)
    ? intelligence.analysis_buyer_personas
        .map((item: unknown) => String(item || "").trim())
        .filter(Boolean)
        .sort((a: string, b: string) => a.localeCompare(b))
    : [];
  const hasAnalysisContextSnapshot = Boolean(
    hasAiAnalysis &&
      analysisAccountType &&
      Array.isArray(intelligence?.analysis_buyer_personas)
  );
  const analysisAccountTypeChanged = Boolean(
    hasAnalysisContextSnapshot && analysisAccountType !== currentSavedAccountType
  );
  const analysisBuyerPersonasChanged = Boolean(
    hasAnalysisContextSnapshot &&
      JSON.stringify(analysisBuyerPersonas) !== JSON.stringify(currentSavedBuyerPersonas)
  );
  const isAnalysisContextStale =
    analysisAccountTypeChanged || analysisBuyerPersonasChanged;
  const analysisGeneratedAt = intelligence?.ai_generated_at
    ? new Date(String(intelligence.ai_generated_at)).toLocaleString()
    : "Generation time unavailable";
  const analysisGenerationSource = String(
    intelligence?.ai_generation_source || "Source unavailable"
  );
  const analysisBuyerPersonasDisplay =
    analysisBuyerPersonas.length > 0
      ? analysisBuyerPersonas.join(", ")
      : "None saved";
  const currentBuyerPersonasDisplay =
    currentSavedBuyerPersonas.length > 0
      ? currentSavedBuyerPersonas.join(", ")
      : "None saved";

  const discoveryQuestions = hasAiAnalysis
    ? parseJsonArray(intelligence?.discovery_questions)
    : [];
  const recommendedProductPaths = hasAiAnalysis
    ? parseJsonArray(intelligence?.recommended_product_paths)
    : [];
  const likelyObjections = hasAiAnalysis
    ? parseJsonArray(intelligence?.likely_objections)
    : [];

  const detailAccountTypeLens = getCompanyEffectiveAccountTypeLens(company);
  const detailBuyerPersonas = getCompanyEffectiveBuyerPersonas(detailAccountTypeLens, company);
  const detailBuyerPersonaContext = detailBuyerPersonas.map((persona) => {
    const definition = companyDetailBuyerPersonaDefinitions.find(
      (item: any) =>
        String(item?.persona_name || "").trim() === persona
    );

    return {
      persona,
      description: definition?.description
        ? String(definition.description)
        : "No current Buyer Persona definition is available for this saved value.",
      status: definition?.status === "archived"
        ? "archived"
        : definition
          ? "active"
          : "legacy",
    };
  });
  const detailAssignedSalespersonId = String(company.assigned_salesperson_id || "");
  const detailAssignedSalesManagerId = String(company.assigned_sales_manager_id || "");
  const detailSalesCoverageStatus =
    detailAssignedSalespersonId && detailAssignedSalesManagerId
      ? "Salesperson and Sales Manager assigned"
      : detailAssignedSalespersonId
        ? "Salesperson assigned; Sales Manager missing"
        : detailAssignedSalesManagerId
          ? "Sales Manager assigned; Salesperson missing"
          : "Sales coverage missing";

  const detailRecommendedNextStep =
    !detailAssignedSalespersonId
      ? "Assign a Salesperson / Rep before relying on role visibility or rep follow-up."
      : detailAccountTypeLens === "Unknown"
        ? "Confirm whether this account is an end customer, distributor, or unknown before choosing the selling motion."
        : detailBuyerPersonas.includes("Discovery Needed")
          ? "Confirm likely buyer personas and update the persona badges so discovery questions match the real stakeholders."
          : hasAiAnalysis && primaryProspect?.next_best_action
            ? String(primaryProspect.next_best_action)
            : "Open discovery with the listed buyer personas and confirm the most likely Graymills application before quoting.";

  return (
    <section className="grid gap-6">
      <div
        data-testid="company-detail-sticky-header"
        className="sticky top-20 z-30 max-w-full overflow-hidden rounded-2xl border border-slate-300 bg-slate-100/95 p-4 shadow-md backdrop-blur supports-[backdrop-filter]:bg-slate-100/90"
      >
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            aria-label="Return to previous CRM view"
            title="Return to previous CRM view"
            onClick={onBack}
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Back
          </button>

          <a
            href={`/prospect-package?companyId=${String(detail.company.id)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
          >
            Print Package
          </a>

          <button
            onClick={onAnalyzeProspect}
            disabled={isAnalyzingProspect}
            className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isAnalyzingProspect ? "Analyzing..." : "Analyze Prospect"}
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Company Detail
            </p>
            <h2 className="mt-1 text-2xl font-bold">{displayValue(company.company_name)}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {displayValue(company.industry)}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <SmallScoreCard
              label="Priority"
              value={
                hasAiAnalysis && primaryProspect
                  ? `${displayValue(primaryProspect.priority_score)} / 100`
                  : "Not analyzed"
              }
            />
            <SmallScoreCard
              label="Tier"
              value={hasAiAnalysis && primaryProspect ? displayValue(primaryProspect.priority_tier) : "Not analyzed"}
            />
            <SmallScoreCard
              label="Fit"
              value={hasAiAnalysis && primaryProspect ? displayValue(primaryProspect.fit_rating) : "Not analyzed"}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-300 pt-3">
          <a href="#company-detail-snapshot" className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
            Snapshot
          </a>
          <a href="#company-detail-sales-coverage" className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
            Coverage
          </a>
          <a href="#company-detail-funnel" className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
            Funnel
          </a>
          <a href="#company-detail-activity" className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
            Activity
          </a>
        </div>
      </div>

      {hasAiAnalysis && (
        <div
          className={`rounded-2xl border p-4 shadow-sm ${
            isAnalysisContextStale
              ? "border-amber-300 bg-amber-50"
              : hasAnalysisContextSnapshot
                ? "border-green-200 bg-green-50"
                : "border-blue-200 bg-blue-50"
          }`}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p
                className={`text-sm font-bold ${
                  isAnalysisContextStale
                    ? "text-amber-900"
                    : hasAnalysisContextSnapshot
                      ? "text-green-900"
                      : "text-blue-900"
                }`}
              >
                {isAnalysisContextStale
                  ? "AI analysis context has changed"
                  : hasAnalysisContextSnapshot
                    ? "AI analysis context is current"
                    : "AI analysis context snapshot unavailable"}
              </p>
              <p
                className={`mt-1 text-xs leading-5 ${
                  isAnalysisContextStale
                    ? "text-amber-800"
                    : hasAnalysisContextSnapshot
                      ? "text-green-800"
                      : "text-blue-800"
                }`}
              >
                Generated {analysisGeneratedAt}.
                {isAnalysisContextStale
                  ? " Rerun Analyze Prospect before relying on this analysis."
                  : hasAnalysisContextSnapshot
                    ? " The saved Account Type and Buyer Personas still match the current company record."
                    : " This analysis predates Rev 2.95. Rerun Analyze Prospect to save a context snapshot."}
              </p>

              {isAnalysisContextStale && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {analysisAccountTypeChanged && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900 ring-1 ring-amber-300">
                      Account Type changed
                    </span>
                  )}
                  {analysisBuyerPersonasChanged && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900 ring-1 ring-amber-300">
                      Buyer Personas changed
                    </span>
                  )}
                </div>
              )}

              {hasAnalysisContextSnapshot && (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div
                    className={`rounded-xl border p-3 ${
                      analysisAccountTypeChanged
                        ? "border-amber-300 bg-white"
                        : "border-green-200 bg-white"
                    }`}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Account Type
                    </p>
                    <div className="mt-2 grid gap-2 text-xs">
                      <div>
                        <p className="font-semibold text-slate-500">Used by analysis</p>
                        <p className="mt-1 font-bold text-slate-900">
                          {analysisAccountType || "Unavailable"}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-500">Current company value</p>
                        <p
                          className={`mt-1 font-bold ${
                            analysisAccountTypeChanged
                              ? "text-amber-900"
                              : "text-green-800"
                          }`}
                        >
                          {currentSavedAccountType}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`rounded-xl border p-3 ${
                      analysisBuyerPersonasChanged
                        ? "border-amber-300 bg-white"
                        : "border-green-200 bg-white"
                    }`}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Buyer Personas
                    </p>
                    <div className="mt-2 grid gap-2 text-xs">
                      <div>
                        <p className="font-semibold text-slate-500">Used by analysis</p>
                        <p className="mt-1 font-bold leading-5 text-slate-900">
                          {analysisBuyerPersonasDisplay}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-500">Current company values</p>
                        <p
                          className={`mt-1 font-bold leading-5 ${
                            analysisBuyerPersonasChanged
                              ? "text-amber-900"
                              : "text-green-800"
                          }`}
                        >
                          {currentBuyerPersonasDisplay}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                Analysis source: {analysisGenerationSource}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {intelligenceHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAiAnalysisHistory((current) => !current)}
                  aria-expanded={showAiAnalysisHistory}
                  className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  {showAiAnalysisHistory
                    ? "Hide Analysis History"
                    : `Show Analysis History (${intelligenceHistory.length})`}
                </button>
              )}

              {(isAnalysisContextStale || !hasAnalysisContextSnapshot) && (
                <button
                  type="button"
                  onClick={onAnalyzeProspect}
                  disabled={isAnalyzingProspect}
                  className="w-fit rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isAnalyzingProspect ? "Analyzing..." : "Rerun Analyze Prospect"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {intelligenceHistory.length > 0 && showAiAnalysisHistory && (
        <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">AI Analysis History</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Review the most recent saved analysis runs and the company context used by each one.
              </p>
            </div>
            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {intelligenceHistory.length} saved {intelligenceHistory.length === 1 ? "analysis" : "analyses"}
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {intelligenceHistory.map((historyItem: any, historyIndex: number) => {
              const historyAccountType = String(
                historyItem?.analysis_account_type || "Snapshot unavailable"
              );
              const historyBuyerPersonas = Array.isArray(historyItem?.analysis_buyer_personas)
                ? historyItem.analysis_buyer_personas
                    .map((item: unknown) => String(item || "").trim())
                    .filter(Boolean)
                    .sort((a: string, b: string) => a.localeCompare(b))
                : [];
              const historyHasSnapshot = Boolean(
                historyItem?.analysis_account_type &&
                  Array.isArray(historyItem?.analysis_buyer_personas)
              );
              const historyContextMatches = Boolean(
                historyHasSnapshot &&
                  historyAccountType === currentSavedAccountType &&
                  JSON.stringify(historyBuyerPersonas) ===
                    JSON.stringify(currentSavedBuyerPersonas)
              );
              const historyGeneratedAt = historyItem?.ai_generated_at
                ? new Date(String(historyItem.ai_generated_at)).toLocaleString()
                : historyItem?.created_at
                  ? new Date(String(historyItem.created_at)).toLocaleString()
                  : "Generation time unavailable";
              const historyHasMetricSnapshot =
                historyItem?.analysis_priority_score !== null &&
                historyItem?.analysis_priority_score !== undefined;

              return (
                <details
                  key={String(historyItem?.id || historyIndex)}
                  open={historyIndex === 0}
                  className={`rounded-xl border p-4 ${
                    historyIndex === 0
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-slate-900">{historyGeneratedAt}</p>
                          {historyIndex === 0 && (
                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-800 ring-1 ring-blue-200">
                              Current analysis
                            </span>
                          )}
                          {historyHasSnapshot ? (
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
                                historyContextMatches
                                  ? "bg-green-100 text-green-800 ring-green-200"
                                  : "bg-amber-100 text-amber-900 ring-amber-300"
                              }`}
                            >
                              {historyContextMatches
                                ? "Matches current context"
                                : "Different company context"}
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-slate-300">
                              Context snapshot unavailable
                            </span>
                          )}
                          {historyHasMetricSnapshot ? (
                            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-800 ring-1 ring-violet-200">
                              Metric snapshot saved
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-slate-300">
                              Metric snapshot unavailable
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {String(historyItem?.ai_generation_source || "Source unavailable")}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        Open details
                      </span>
                    </div>
                  </summary>

                  <div className="mt-4 border-t border-slate-200 pt-4">
                    {historyHasMetricSnapshot ? (
                      <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
                          Analysis Metrics
                        </p>

                        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                          <div className="rounded-lg bg-white p-3 ring-1 ring-violet-100">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                              Priority
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-900">
                              {displayValue(historyItem?.analysis_priority_score)} / 100
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-3 ring-1 ring-violet-100">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                              Tier
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-900">
                              {displayValue(historyItem?.analysis_priority_tier)}
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-3 ring-1 ring-violet-100">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                              Fit
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-900">
                              {displayValue(historyItem?.analysis_fit_rating)}
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-3 ring-1 ring-violet-100">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                              Confidence
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-900">
                              {displayValue(historyItem?.analysis_confidence)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-lg bg-white p-3 ring-1 ring-violet-100">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Product Line
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-700">
                              {displayValue(historyItem?.analysis_product_line)}
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-3 ring-1 ring-violet-100">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Product Path
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-700">
                              {displayValue(historyItem?.analysis_likely_product_path)}
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-3 ring-1 ring-violet-100">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Primary Use Case
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-700">
                              {displayValue(historyItem?.analysis_primary_use_case)}
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-3 ring-1 ring-violet-100">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Likely Soils
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-700">
                              {displayValue(historyItem?.analysis_likely_soils)}
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-3 ring-1 ring-violet-100">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Cleaning Action
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-700">
                              {displayValue(historyItem?.analysis_likely_cleaning_action)}
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-3 ring-1 ring-violet-100">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Next-Best Action
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-700">
                              {displayValue(historyItem?.analysis_next_best_action)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mb-3 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
                        This analysis predates Rev 2.99, so its score and product-path metrics were not saved with the historical record.
                      </p>
                    )}

                    <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Account Type Used
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {historyAccountType}
                      </p>
                    </div>

                    <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Buyer Personas Used
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">
                        {historyBuyerPersonas.length > 0
                          ? historyBuyerPersonas.join(", ")
                          : "None saved or snapshot unavailable"}
                      </p>
                    </div>

                    <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Analysis Buyer Persona Summary
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        {displayValue(historyItem?.buyer_persona)}
                      </p>
                    </div>

                    <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Reason to Believe
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        {displayValue(historyItem?.reason_to_believe)}
                      </p>
                    </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      <div id="company-detail-snapshot" className="scroll-mt-80"></div>
      <div className="grid gap-6 lg:grid-cols-3">
        <DetailCard title="Company Snapshot">
          <DetailRow label="Website" value={company.website} />
          <DetailRow label="Domain" value={company.domain} />
          <DetailRow label="Employees" value={company.employee_count} />
          <DetailRow label="Phone" value={company.company_phone} />
          <DetailRow
            label="Location"
            value={[company.city, company.state, company.country].filter(Boolean).join(", ")}
          />
          <DetailRow label="Status" value={company.status} />
        </DetailCard>

        <DetailCard title="Sales Action Snapshot">
          <DetailRow label="Account Type" value={detailAccountTypeLens} />
          <DetailRow label="Sales Coverage" value={detailSalesCoverageStatus} />
          <DetailRow label="Primary Industry" value={company.primary_industry} />
          <DetailRow label="Primary Sub-Industry" value={company.primary_sub_industry} />

          <div className="border-b border-slate-100 py-2 text-sm">
            <p className="font-semibold text-slate-700">Buyer Personas</p>

            {companyDetailBuyerPersonaDefinitionError && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-800">
                {companyDetailBuyerPersonaDefinitionError}
              </p>
            )}

            <div className="mt-3 grid gap-3">
              {detailBuyerPersonaContext.map((personaContext) => (
                <div
                  key={personaContext.persona}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getCompanyBuyerPersonaLensClass(personaContext.persona)}`}
                    >
                      {personaContext.persona}
                    </span>

                    {personaContext.status === "archived" && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
                        Archived definition
                      </span>
                    )}

                    {personaContext.status === "legacy" && (
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-slate-300">
                        Legacy value
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {personaContext.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="py-2 text-sm">
            <p className="font-semibold text-slate-700">Recommended Next Step</p>
            <p className="mt-1 text-slate-600">{detailRecommendedNextStep}</p>
          </div>
        </DetailCard>

        <DetailCard title="Prospect Summary">
          {hasAiAnalysis ? (
            <>
              <DetailRow label="Product Line" value={primaryProspect?.product_line} />
              <DetailRow label="Product Path" value={primaryProspect?.likely_product_path} />
              <DetailRow label="Use Case" value={primaryProspect?.primary_use_case} />
              <DetailRow label="Likely Soils" value={primaryProspect?.likely_soils} />
              <DetailRow label="Confidence" value={primaryProspect?.confidence} />
            </>
          ) : (
            <p className="text-sm leading-6 text-slate-600">
              No AI prospect analysis has been generated yet. Click Analyze Prospect to create a Graymills sales hypothesis.
            </p>
          )}
        </DetailCard>

        <DetailCard title="Next Best Action">
          {hasAiAnalysis ? (
            <p className="text-sm leading-6 text-slate-700">
              {displayValue(primaryProspect?.next_best_action)}
            </p>
          ) : (
            <p className="text-sm leading-6 text-slate-600">
              No next-best action is available until analysis is generated.
            </p>
          )}
        </DetailCard>
      </div>

      <CompanyIndustryEnrichmentPanel company={detail.company} />

      <div
        id="company-detail-sales-coverage"
        className="scroll-mt-[260px]"
      >
        <CompanySalesAssignmentPanel
          companyId={String(detail.company.id)}
          canEditSalesCoverage={salesCoverageCanEdit}
          apiPermissionHeaders={apiPermissionHeaders}
        />
      </div>

      <div id="company-detail-funnel" className="scroll-mt-80"></div>
      <CompanyOpportunityPanel
        canMoveOpportunityStages={canMoveOpportunityStages}
        apiPermissionHeaders={apiPermissionHeaders}
        companyId={String(detail.company.id)}
        companyName={displayValue(detail.company.company_name)}
        contacts={detail.contacts}
        prospects={detail.prospects}
        primaryProspect={detail.primaryProspect}
      />



      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div id="company-detail-activity" className="scroll-mt-80"></div>
        <h3 className="text-xl font-bold">Add Activity / Follow-Up</h3>
        <p className="mt-2 text-sm text-slate-600">
          Save notes, calls, emails, meetings, tasks, and quote follow-ups directly to this company record.
        </p>

        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Common follow-up presets</p>
          <p className="mt-1 text-xs leading-5 text-emerald-800">
            Choose a preset to prefill type, due date, subject, and notes. You can edit before saving.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                applyCompanyActivityPreset(
                  "call",
                  "Left voicemail",
                  "Left voicemail. Follow up with a short email and try again if there is no response.",
                  companyActivityDateOffset(2)
                )
              }
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-100 hover:bg-emerald-100"
            >
              Left voicemail
            </button>
            <button
              type="button"
              onClick={() =>
                applyCompanyActivityPreset(
                  "email",
                  "Sent intro email",
                  "Sent introductory email. Follow up on fit, current cleaning or fluid handling needs, and whether there is an active project.",
                  companyActivityDateOffset(5)
                )
              }
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-100 hover:bg-emerald-100"
            >
              Sent intro email
            </button>
            <button
              type="button"
              onClick={() =>
                applyCompanyActivityPreset(
                  "quote_followup",
                  "Quote follow-up",
                  "Follow up on open quote, timing, decision process, technical questions, and any support needed to move forward.",
                  companyActivityDateOffset(3)
                )
              }
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-100 hover:bg-emerald-100"
            >
              Quote follow-up
            </button>
            <button
              type="button"
              onClick={() =>
                applyCompanyActivityPreset(
                  "task",
                  "Distributor review needed",
                  "Review whether this account should be handled directly, through a distributor, or coordinated with an outside rep.",
                  companyActivityDateOffset(7)
                )
              }
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-100 hover:bg-emerald-100"
            >
              Distributor review
            </button>
            <button
              type="button"
              onClick={() =>
                applyCompanyActivityPreset(
                  "meeting",
                  "Schedule discovery call",
                  "Schedule discovery call. Confirm application, current process, pain points, timing, budget, and decision makers.",
                  companyActivityDateOffset(7)
                )
              }
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-100 hover:bg-emerald-100"
            >
              Schedule discovery
            </button>
            <button
              type="button"
              onClick={() =>
                applyCompanyActivityPreset(
                  "task",
                  "Check back in 30 days",
                  "Check back on timing, current need, and whether there is an active parts washing, cleaning, ink handling, or pump project.",
                  companyActivityDateOffset(30)
                )
              }
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-100 hover:bg-emerald-100"
            >
              Check back 30 days
            </button>
          </div>
        </div>

                <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Enter a subject, notes, or both. Activity type and due date are optional context.
        </div>

<div className="mt-4 grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Primary Contact</label>
            <select
              value={activityForm.primaryContactId}
              onChange={(event) =>
                setActivityForm({
                  ...activityForm,
                  primaryContactId: event.target.value,
                  relatedContactIds: activityForm.relatedContactIds.filter(
                    (contactId) => contactId !== event.target.value
                  ),
                })
              }
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="">No primary contact selected</option>
              {detail.contacts.map((contact: any) => (
                <option key={String(contact.id)} value={String(contact.id)}>
                  {displayValue(contact.full_name || contact.email)}
                  {contact.is_primary ? " — Company Primary" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <p className="text-sm font-semibold text-slate-700">Related Contacts</p>
            <div className="mt-2 grid max-h-36 gap-2 overflow-y-auto rounded-lg border border-slate-300 bg-white p-3">
              {detail.contacts.length === 0 ? (
                <p className="text-xs text-slate-500">No active company contacts available.</p>
              ) : (
                detail.contacts.map((contact: any) => {
                  const contactId = String(contact.id);
                  const isPrimarySelection =
                    contactId === activityForm.primaryContactId;
                  const isChecked = activityForm.relatedContactIds.includes(contactId);

                  return (
                    <label
                      key={contactId}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isPrimarySelection}
                        onChange={(event) =>
                          setActivityForm({
                            ...activityForm,
                            relatedContactIds: event.target.checked
                              ? [...activityForm.relatedContactIds, contactId]
                              : activityForm.relatedContactIds.filter(
                                  (selectedId) => selectedId !== contactId
                                ),
                          })
                        }
                      />
                      <span>
                        {displayValue(contact.full_name || contact.email)}
                        {isPrimarySelection ? " — Primary Contact" : ""}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Activity Type</label>
            <select
              value={activityForm.activityType}
              onChange={(event) =>
                setActivityForm({
                  ...activityForm,
                  activityType: event.target.value as ActivityForm["activityType"],
                })
              }
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="note">Note</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="task">Task</option>
              <option value="quote_followup">Quote Follow-Up</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Due Date</label>
            <input
              type="date"
              value={activityForm.dueDate}
              onChange={(event) =>
                setActivityForm({ ...activityForm, dueDate: event.target.value })
              }
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            />
            <div className="mt-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Quick due date</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCompanyActivityDueDate(companyActivityDateOffset(0))}
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setCompanyActivityDueDate(companyActivityDateOffset(1))}
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setCompanyActivityDueDate(companyActivityDateOffset(7))}
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Next week
                </button>
                <button
                  type="button"
                  onClick={() => setCompanyActivityDueDate("")}
                  className="rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Subject <span className="text-slate-500">(or notes required)</span></label>
            <input
              type="text"
              value={activityForm.subject}
              onChange={(event) =>
                setActivityForm({ ...activityForm, subject: event.target.value })
              }
              placeholder="Example: Left voicemail for maintenance manager"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            />
          </div>

          <div className="lg:col-span-4">
            <label className="text-sm font-semibold text-slate-700">Notes <span className="text-slate-500">(or subject required)</span></label>
            <textarea
              value={activityForm.notes}
              onChange={(event) =>
                setActivityForm({ ...activityForm, notes: event.target.value })
              }
              placeholder="Add call notes, follow-up details, discovery findings, or next steps."
              rows={4}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            />
          </div>
        </div>

        {!canSaveCompanyActivity && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            Enter a subject or note before saving.
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-start gap-2">
          <button
            onClick={onSaveActivity}
            disabled={isSavingActivity || !canSaveCompanyActivity}
            className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSavingActivity ? "Saving..." : "Save Activity"}
          </button>
          <button
            type="button"
            onClick={clearCompanyActivityForm}
            disabled={isSavingActivity}
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            Clear form
          </button>
        </div>
      </div>

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-xl font-bold">Unified Activity Timeline</h3>
            <p className="mt-2 text-sm text-slate-600">
              Review company and opportunity activities together in one chronological view.
            </p>
          </div>
          <button
            type="button"
            onClick={loadUnifiedTimeline}
            disabled={isLoadingUnifiedTimeline}
            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-wait disabled:bg-slate-100"
          >
            {isLoadingUnifiedTimeline ? "Refreshing..." : "Refresh Timeline"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">All</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{unifiedTimeline.length}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Company</p>
            <p className="mt-1 text-2xl font-bold text-blue-800">{unifiedTimelineCompanyCount}</p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Opportunity</p>
            <p className="mt-1 text-2xl font-bold text-indigo-800">{unifiedTimelineOpportunityCount}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-green-700">Completed</p>
            <p className="mt-1 text-2xl font-bold text-green-800">{unifiedTimelineCompletedCount}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <input
            type="search"
            value={unifiedTimelineSearch}
            onChange={(event) => setUnifiedTimelineSearch(event.target.value)}
            placeholder="Search timeline..."
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          />
          <select
            value={unifiedTimelineSourceFilter}
            onChange={(event) =>
              setUnifiedTimelineSourceFilter(
                event.target.value as "all" | "company" | "opportunity"
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="all">All sources</option>
            <option value="company">Company activities</option>
            <option value="opportunity">Opportunity activities</option>
          </select>
          <select
            value={unifiedTimelineStatusFilter}
            onChange={(event) =>
              setUnifiedTimelineStatusFilter(
                event.target.value as "all" | "open" | "completed"
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          Showing {filteredUnifiedTimeline.length} of {unifiedTimeline.length} timeline items
          {" · "}
          {unifiedTimelineOpenCount} open
        </div>

        {unifiedTimelineError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {unifiedTimelineError}
          </div>
        )}

        {!unifiedTimelineError && isLoadingUnifiedTimeline && unifiedTimeline.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Loading unified timeline...</p>
        ) : !unifiedTimelineError && filteredUnifiedTimeline.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No timeline items match the current controls.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {filteredUnifiedTimeline.map((item: any) => {
              const isTimelineOverdue =
                !item.completed_at &&
                item.due_date &&
                String(item.due_date) < companyActivityToday;

              return (
                <div
                  key={item.timeline_id}
                  className={`rounded-xl border p-4 ${
                    item.completed_at
                      ? "border-green-200 bg-green-50"
                      : isTimelineOverdue
                        ? "border-red-200 bg-red-50"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            item.source === "opportunity"
                              ? "rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800"
                              : "rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800"
                          }
                        >
                          {item.source_label}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {getActivityLabel(item.activity_type)}
                        </span>
                        {item.completed_at ? (
                          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                            Completed
                          </span>
                        ) : isTimelineOverdue ? (
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                            Overdue
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            Open
                          </span>
                        )}
                      </div>

                      {item.opportunity_name && (
                        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-indigo-700">
                          Opportunity: {item.opportunity_name}
                        </p>
                      )}

                      <p className="mt-2 font-semibold text-slate-900">
                        {item.subject || "No subject"}
                      </p>
                      {item.notes && (
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {item.notes}
                        </p>
                      )}
                      {(item.contact?.full_name ||
                        (Array.isArray(item.related_contacts) &&
                          item.related_contacts.length > 0)) && (
                        <div className="mt-3 grid gap-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                          <p>
                            <span className="font-semibold text-slate-700">Primary Contact:</span>{" "}
                            {item.contact?.full_name || "None selected"}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700">Related Contacts:</span>{" "}
                            {Array.isArray(item.related_contacts) &&
                            item.related_contacts.length > 0
                              ? item.related_contacts
                                  .map((contact: any) =>
                                    String(contact?.full_name || contact?.email || "")
                                  )
                                  .filter(Boolean)
                                  .join(", ")
                              : "None selected"}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid min-w-44 gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200">
                      <div className="flex justify-between gap-3">
                        <span className="font-semibold uppercase tracking-wide text-slate-500">
                          Created
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="font-semibold uppercase tracking-wide text-slate-500">
                          Due
                        </span>
                        <span className={isTimelineOverdue ? "font-bold text-red-700" : "font-bold text-slate-900"}>
                          {item.due_date ? formatDate(item.due_date) : "No due date"}
                        </span>
                      </div>
                      {item.completed_at && (
                        <div className="flex justify-between gap-3">
                          <span className="font-semibold uppercase tracking-wide text-slate-500">
                            Completed
                          </span>
                          <span className="font-bold text-green-700">
                            {formatDate(item.completed_at)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-xl font-bold">Company Activity History</h3>
            <p className="mt-2 text-sm text-slate-600">
              Review saved follow-ups, filter by status, and complete open items from this company record.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <button
              type="button"
              onClick={() => onRefreshCompanyDetail(String(detail.company.id))}
              disabled={isRefreshingCompanyDetail}
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-wait disabled:bg-slate-100 disabled:text-slate-400"
            >
              {isRefreshingCompanyDetail ? "Refreshing..." : "Refresh Activity History"}
            </button>
            <label className="flex w-full max-w-xs flex-col gap-1 text-xs font-semibold text-slate-600 md:items-start">
              Search history
              <input
                type="search"
                value={companyActivityHistorySearchTerm}
                onChange={(event) => setCompanyActivityHistorySearchTerm(event.target.value)}
                placeholder="Search activity history..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
              />
            </label>
            <button
              type="button"
              onClick={clearCompanyActivityHistoryControls}
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Clear Controls
            </button>
            <div className="flex w-full max-w-xl flex-col gap-1 md:items-end">
              <p className="text-xs font-semibold text-slate-600">Type quick filters</p>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {companyActivityHistoryTypeFilters.map((typeFilter) => (
                  <button
                    key={typeFilter.value}
                    type="button"
                    onClick={() => setCompanyActivityHistoryTypeFilter(typeFilter.value)}
                    className={
                      companyActivityHistoryTypeFilter === typeFilter.value
                        ? "inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm"
                        : "inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                    }
                  >
                    <span>{typeFilter.label}</span>
                    <span
                      className={
                        companyActivityHistoryTypeFilter === typeFilter.value
                          ? "rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white"
                          : "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600"
                      }
                    >
                      {companyActivityHistoryTypeCounts[typeFilter.value] ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["All", "Open", "Overdue", "Due Today", "Completed"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setCompanyActivityHistoryFilter(filter)}
                  className={
                    companyActivityHistoryFilter === filter
                      ? "inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm"
                      : "inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                  }
                >
                  <span>{filter}</span>
                  <span
                    className={
                      companyActivityHistoryFilter === filter
                        ? "rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600"
                    }
                  >
                    {companyActivityHistoryStatusCounts[filter] ?? 0}
                  </span>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              Sort
              <select
                value={companyActivityHistorySort}
                onChange={(event) =>
                  setCompanyActivityHistorySort(
                    event.target.value as "Newest first" | "Due date first" | "Open first"
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
              >
                <option value="Newest first">Newest first</option>
                <option value="Due date first">Due date first</option>
                <option value="Open first">Open first</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Open</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{companyOpenActivities.length}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-red-700">Overdue</p>
            <p className="mt-1 text-2xl font-bold text-red-800">{companyOverdueActivities.length}</p>
          </div>
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-yellow-700">Due Today</p>
            <p className="mt-1 text-2xl font-bold text-yellow-800">{companyDueTodayActivities.length}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-green-700">Completed</p>
            <p className="mt-1 text-2xl font-bold text-green-800">{companyCompletedActivities.length}</p>
          </div>
        </div>

        
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600" aria-label="Activity history result summary">
          <span className="font-semibold text-slate-900">
            Showing {sortedCompanyActivities.length} of {companyActivities.length} activities
          </span>
          {companyActivityHistoryActiveControls.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2" aria-label="Active activity history controls">
              {companyActivityHistoryActiveControls.map((activeControl) => (
                <span
                  key={activeControl}
                  className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800"
                >
                  {activeControl}
                </span>
              ))}
            </div>
          )}
        </div>

        {companyActivities.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No activities saved yet.</p>
        ) : sortedCompanyActivities.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">
              No activities match the current search or filters.
            </p>
            <p className="mt-1">
              Use Clear Controls to reset search, type, status, and sort.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {sortedCompanyActivities.map((activity: any) => (
              <div
                key={activity.id}
                className={`rounded-xl border p-4 ${
                  activity.completed_at
                    ? "border-green-200 bg-green-50"
                    : isOverdue(activity)
                      ? "border-red-200 bg-red-50"
                      : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                        {getActivityLabel(activity.activity_type)}
                      </span>
                      {activity.completed_at ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                          Completed
                        </span>
                      ) : isOverdue(activity) ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                          Overdue
                        </span>
                      ) : activity.due_date === companyActivityToday ? (
                        <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-800">
                          Due Today
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          Open
                        </span>
                      )}

                      {editingCompanyActivityId === String(activity.id) && (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                          Editing
                        </span>
                      )}
                    </div>

                    {editingCompanyActivityId === String(activity.id) ? (
                      <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                        <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                              Edit activity draft
                            </p>
                            <p className="mt-1 text-xs text-blue-800">
                              Save Edit updates this activity. Cancel closes without changing the activity.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => saveEditingCompanyActivity(String(activity.id))}
                              disabled={
                                isSavingActivity ||
                                (!companyActivityEditForm.subject.trim() && !companyActivityEditForm.notes.trim()) ||
                                !companyActivityEditHasChanges
                              }
                              className="w-fit rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {isSavingActivity ? "Saving..." : "Save Edit"}
                            </button>
                            <button
                              type="button"
                              onClick={requestCancelEditingCompanyActivity}
                              disabled={isSavingActivity}
                              title={
                                companyActivityEditHasChanges && !confirmDiscardCompanyActivityEdit
                                  ? "Click once to confirm you want to discard changes."
                                  : "Close edit mode without saving."
                              }
                              className="w-fit rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                            >
                              {confirmDiscardCompanyActivityEdit ? "Discard changes?" : "Cancel"}
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-4">
                          <div>
                            <label className="text-xs font-semibold text-slate-700">Type</label>
                            <select
                              value={companyActivityEditForm.activityType}
                              onChange={(event) => {
                                setConfirmDiscardCompanyActivityEdit(false);
                                setCompanyActivityEditForm({
                                  ...companyActivityEditForm,
                                  activityType: event.target.value as ActivityForm["activityType"],
                                });
                              }}
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm"
                            >
                              <option value="note">Note</option>
                              <option value="call">Call</option>
                              <option value="email">Email</option>
                              <option value="meeting">Meeting</option>
                              <option value="task">Task</option>
                              <option value="quote_followup">Quote Follow-Up</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-700">Due Date</label>
                            <input
                              type="date"
                              value={companyActivityEditForm.dueDate}
                              onChange={(event) => {
                                setConfirmDiscardCompanyActivityEdit(false);
                                setCompanyActivityEditForm({
                                  ...companyActivityEditForm,
                                  dueDate: event.target.value,
                                });
                              }}
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-slate-700">Subject</label>
                            <input
                              type="text"
                              value={companyActivityEditForm.subject}
                              onChange={(event) => {
                                setConfirmDiscardCompanyActivityEdit(false);
                                setCompanyActivityEditForm({
                                  ...companyActivityEditForm,
                                  subject: event.target.value,
                                });
                              }}
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm"
                              placeholder="Activity subject"
                            />
                          </div>

                          <div className="md:col-span-4">
                            <label className="text-xs font-semibold text-slate-700">Notes</label>
                            <textarea
                              rows={4}
                              value={companyActivityEditForm.notes}
                              onChange={(event) => {
                                setConfirmDiscardCompanyActivityEdit(false);
                                setCompanyActivityEditForm({
                                  ...companyActivityEditForm,
                                  notes: event.target.value,
                                });
                              }}
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm"
                              placeholder="Activity notes"
                            />
                          </div>
                        </div>

                        {!companyActivityEditForm.subject.trim() && !companyActivityEditForm.notes.trim() && (
                          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                            Enter a subject or note before saving this edit.
                          </p>
                        )}

                        {activity.completed_at && (
                          <p className="mt-3 rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-semibold text-blue-800">
                            Completed activities can still be edited to correct history or notes.
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="mt-3 font-semibold">{activity.subject || "No subject"}</p>
                        <p
                          className={
                            expandedCompanyActivityNoteIds[String(activity.id)]
                              ? "mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700"
                              : "mt-2 whitespace-pre-wrap line-clamp-3 text-sm leading-6 text-slate-700"
                          }
                        >
                          {activity.notes || "No notes"}
                        </p>
                        {(activity.contact?.full_name ||
                          (Array.isArray(activity.related_contacts) &&
                            activity.related_contacts.length > 0)) && (
                          <div className="mt-3 grid gap-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                            <p>
                              <span className="font-semibold text-slate-700">Primary Contact:</span>{" "}
                              {activity.contact?.full_name || "None selected"}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-700">Related Contacts:</span>{" "}
                              {Array.isArray(activity.related_contacts) &&
                              activity.related_contacts.length > 0
                                ? activity.related_contacts
                                    .map((contact: any) =>
                                      String(contact?.full_name || contact?.email || "")
                                    )
                                    .filter(Boolean)
                                    .join(", ")
                                : "None selected"}
                            </p>
                          </div>
                        )}
                        {activity.notes && String(activity.notes).length > 180 && (
                          <button
                            type="button"
                            onClick={() => toggleCompanyActivityNoteExpansion(String(activity.id))}
                            className="mt-1 text-xs font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
                            aria-expanded={Boolean(expandedCompanyActivityNoteIds[String(activity.id)])}
                          >
                            {expandedCompanyActivityNoteIds[String(activity.id)] ? "Hide full note" : "Show full note"}
                          </button>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingCompanyActivity(activity)}
                            disabled={isSavingActivity || (isEditingCompanyActivity && editingCompanyActivityId !== String(activity.id))}
                            title={
                              isEditingCompanyActivity && editingCompanyActivityId !== String(activity.id)
                                ? "Finish or cancel the current edit before editing another activity."
                                : "Edit this activity"
                            }
                            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            {isEditingCompanyActivity && editingCompanyActivityId !== String(activity.id) ? "Editing another" : "Edit"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 text-sm md:items-end md:text-right">
                    <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200 md:min-w-48">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold uppercase tracking-wide text-slate-500">Created</span>
                        <span className="font-bold text-slate-900">{formatDate(activity.created_at)}</span>
                      </div>
                      {getActivityUpdatedTimestamp(activity) && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold uppercase tracking-wide text-slate-500">Updated</span>
                          <span className="font-bold text-blue-700">
                            {formatDate(getActivityUpdatedTimestamp(activity))}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold uppercase tracking-wide text-slate-500">Due</span>
                        <span
                          className={
                            isOverdue(activity)
                              ? "font-bold text-red-700"
                              : activity.due_date === companyActivityToday
                                ? "font-bold text-yellow-700"
                                : "font-bold text-slate-900"
                          }
                        >
                          {activity.due_date ? formatDate(activity.due_date) : "No due date"}
                        </span>
                      </div>
                      {activity.completed_at && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold uppercase tracking-wide text-slate-500">Completed</span>
                          <span className="font-bold text-green-700">{formatDate(activity.completed_at)}</span>
                        </div>
                      )}
                    </div>
                    {!activity.completed_at && (
                      <button
                        onClick={() => onCompleteActivity(activity.id, activity.company_id)}
                        disabled={isCompletingActivity === activity.id || isSavingActivity || isEditingCompanyActivity}
                        title={isEditingCompanyActivity ? "Finish or cancel the current edit before completing an activity." : "Mark this activity complete"}
                        className="mt-2 rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {isCompletingActivity === activity.id ? "Completing..." : isEditingCompanyActivity ? "Finish edit first" : "Complete"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">Contacts</h3>
            <p className="mt-1 text-sm text-slate-600">
              Add and manage people associated with this company.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (showAddContactForm) {
                cancelContactForm();
              } else {
                resetManualContactForm();
                setEditingContactId("");
                setShowAddContactForm(true);
                setContactMessage("");
                setContactError("");
              }
            }}
            disabled={isSavingContact}
            className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {showAddContactForm
              ? editingContactId
                ? "Close Edit Contact"
                : "Close Add Contact"
              : "Add Contact"}
          </button>
        </div>

        {contactMessage ? (
          <p className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {contactMessage}
          </p>
        ) : null}

        {contactError ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {contactError}
          </p>
        ) : null}

        {showAddContactForm ? (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <h4 className="font-bold text-blue-950">
              {editingContactId ? "Edit Contact" : "Add Contact"}
            </h4>
            <p className="mt-1 text-xs leading-5 text-blue-800">
              A first or last name, or an email address, is required.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                First Name
                <input
                  value={manualContactForm.firstName}
                  onChange={(event) =>
                    setManualContactForm({
                      ...manualContactForm,
                      firstName: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Last Name
                <input
                  value={manualContactForm.lastName}
                  onChange={(event) =>
                    setManualContactForm({
                      ...manualContactForm,
                      lastName: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Job Title
                <input
                  value={manualContactForm.title}
                  onChange={(event) =>
                    setManualContactForm({
                      ...manualContactForm,
                      title: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Management Level
                <input
                  value={manualContactForm.managementLevel}
                  onChange={(event) =>
                    setManualContactForm({
                      ...manualContactForm,
                      managementLevel: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Department
                <input
                  value={manualContactForm.department}
                  onChange={(event) =>
                    setManualContactForm({
                      ...manualContactForm,
                      department: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Function
                <input
                  value={manualContactForm.functionArea}
                  onChange={(event) =>
                    setManualContactForm({
                      ...manualContactForm,
                      functionArea: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Email
                <input
                  type="email"
                  value={manualContactForm.email}
                  onChange={(event) =>
                    setManualContactForm({
                      ...manualContactForm,
                      email: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Direct Phone
                <input
                  value={manualContactForm.directPhone}
                  onChange={(event) =>
                    setManualContactForm({
                      ...manualContactForm,
                      directPhone: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Mobile Phone
                <input
                  value={manualContactForm.mobilePhone}
                  onChange={(event) =>
                    setManualContactForm({
                      ...manualContactForm,
                      mobilePhone: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                City
                <input
                  value={manualContactForm.personCity}
                  onChange={(event) =>
                    setManualContactForm({
                      ...manualContactForm,
                      personCity: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                State
                <input
                  value={manualContactForm.personState}
                  onChange={(event) =>
                    setManualContactForm({
                      ...manualContactForm,
                      personState: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Country
                <input
                  value={manualContactForm.personCountry}
                  onChange={(event) =>
                    setManualContactForm({
                      ...manualContactForm,
                      personCountry: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2">
                LinkedIn URL
                <input
                  value={manualContactForm.linkedinUrl}
                  onChange={(event) =>
                    setManualContactForm({
                      ...manualContactForm,
                      linkedinUrl: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2">
                Buying Role / Notes
                <input
                  value={manualContactForm.buyingRoleHypothesis}
                  onChange={(event) =>
                    setManualContactForm({
                      ...manualContactForm,
                      buyingRoleHypothesis: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={manualContactForm.isPrimary}
                  onChange={(event) =>
                    setManualContactForm({
                      ...manualContactForm,
                      isPrimary: event.target.checked,
                    })
                  }
                />
                Set as this company’s primary contact
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveManualContact}
                disabled={isSavingContact}
                className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-green-300"
              >
                {isSavingContact
                  ? "Saving Contact..."
                  : editingContactId
                    ? "Update Contact"
                    : "Save Contact"}
              </button>

              <button
                type="button"
                onClick={cancelContactForm}
                disabled={isSavingContact}
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {detail.contacts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No contacts attached.</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {detail.contacts.map((contact: any) => (
              <div key={String(contact.id)} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{displayValue(contact.full_name)}</p>
                    <p className="mt-1 text-sm text-slate-600">{displayValue(contact.title)}</p>
                  </div>
                  {contact.is_primary ? (
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-800 ring-1 ring-green-200">
                      Primary
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-1 text-sm text-slate-700">
                  <p>Email: {displayValue(contact.email)}</p>
                  <p>Direct: {displayValue(contact.direct_phone)}</p>
                  <p>Mobile: {displayValue(contact.mobile_phone)}</p>
                  <p>Function: {displayValue(contact.function_area || contact.department)}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEditingContact(contact)}
                    disabled={isSavingContact || Boolean(archivingContactId)}
                    className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    Edit Contact
                  </button>

                  <button
                    type="button"
                    onClick={() => archiveContact(String(contact.id))}
                    disabled={
                      isSavingContact ||
                      archivingContactId === String(contact.id)
                    }
                    className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {archivingContactId === String(contact.id)
                      ? "Archiving..."
                      : "Archive Contact"}
                  </button>
                </div>

                <ContactProjectListManager
                  contactId={String(contact.id)}
                  canManageProjectsLists={canManageProjectsLists}
                />

                <ContactTagManager
                  contactId={String(contact.id)}
                  apiPermissionHeaders={apiPermissionHeaders}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <CompanyProjectListManager
        companyId={String(detail.company.id)}
        canManageProjectsLists={canManageProjectsLists}
      />

      <CompanyTagManager
        companyId={String(detail.company.id)}
        apiPermissionHeaders={apiPermissionHeaders}
      />

      {hasAiAnalysis ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <DetailCard title="What They Do">
              <p className="text-sm leading-6 text-slate-700">
                {displayValue(intelligence?.what_they_do)}
              </p>
            </DetailCard>

            <DetailCard title="Likely Graymills Relevance">
              <p className="text-sm leading-6 text-slate-700">
                {displayValue(intelligence?.likely_relevance)}
              </p>
            </DetailCard>

            <DetailCard title="Likely Parts / Components Cleaned">
              <p className="text-sm leading-6 text-slate-700">
                {displayValue(intelligence?.likely_parts_cleaned)}
              </p>
            </DetailCard>

            <DetailCard title="Likely Soils / Contaminants">
              <p className="text-sm leading-6 text-slate-700">
                {displayValue(intelligence?.likely_soils_contaminants)}
              </p>
            </DetailCard>

            <DetailCard title="Likely Cleaning Pain Points">
              <p className="text-sm leading-6 text-slate-700">
                {displayValue(intelligence?.likely_pain_points)}
              </p>
            </DetailCard>

            <DetailCard title="Suggested Sales Angle">
              <p className="text-sm leading-6 text-slate-700">
                {displayValue(intelligence?.suggested_sales_angle)}
              </p>
            </DetailCard>

            <DetailCard title="Buyer Persona">
              <p className="text-sm leading-6 text-slate-700">
                {displayValue(intelligence?.buyer_persona)}
              </p>
            </DetailCard>

            <DetailCard title="Reason to Believe">
              <p className="text-sm leading-6 text-slate-700">
                {displayValue(intelligence?.reason_to_believe)}
              </p>
            </DetailCard>
          </div>

          <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold">Discovery Questions</h3>
            {discoveryQuestions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No discovery questions generated.</p>
            ) : (
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
                {discoveryQuestions.map((question, index) => (
                  <li key={`${String(question)}-${index}`}>{displayValue(question)}</li>
                ))}
              </ol>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <DetailCard title="First Call Opener">
              <p className="text-sm leading-6 text-slate-700">
                {displayValue(intelligence?.first_call_opener)}
              </p>
            </DetailCard>

            <DetailCard title="Email Draft">
              <p className="text-sm font-semibold text-slate-800">
                Subject: {displayValue(intelligence?.email_subject)}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {displayValue(intelligence?.email_message)}
              </p>
            </DetailCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ReadableListCard
              title="Recommended Product Paths"
              items={recommendedProductPaths}
              primaryKeys={["path", "product_path", "name", "title"]}
              secondaryKeys={["when_relevant", "description", "rationale", "notes"]}
            />
            <ReadableListCard
              title="Likely Objections and Responses"
              items={likelyObjections}
              primaryKeys={["objection", "title", "concern"]}
              secondaryKeys={["response", "answer", "recommended_response", "notes"]}
            />
          </div>

          <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold">Copyable Sales Block</h3>
            <p className="mt-2 text-sm text-slate-600">
              Copy this into CRM notes, call prep, or sales handoff.
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800">
              {displayValue(intelligence?.copyable_sales_block)}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <h3 className="text-xl font-bold text-slate-900">No AI analysis generated yet</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Click Analyze Prospect to generate a Graymills sales hypothesis for this company.
            Until analysis is generated, the CRM will not display placeholder intelligence that
            could be mistaken for sales guidance.
          </p>
          <div className="mt-5 flex justify-center">
            <button
              onClick={onAnalyzeProspect}
              disabled={isAnalyzingProspect}
              className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isAnalyzingProspect ? "Analyzing..." : "Analyze Prospect"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function CompanyIndustryEnrichmentPanel({
  company,
}: {
  company: Record<string, string | number | boolean | null>;
}) {
  const fields = [
    {
      label: "Primary Industry",
      value: company.primary_industry,
      emphasis: true,
    },
    {
      label: "Primary Sub-Industry",
      value: company.primary_sub_industry,
      emphasis: true,
    },
    {
      label: "NAICS",
      value: company.naics,
    },
    {
      label: "SIC",
      value: company.sic,
    },
    {
      label: "NAICS Codes",
      value: company.naics_codes,
    },
    {
      label: "NAICS Descriptions",
      value: company.naics_descriptions,
    },
    {
      label: "SIC Codes",
      value: company.sic_codes,
    },
    {
      label: "SIC Descriptions",
      value: company.sic_descriptions,
    },
  ];

  const hasAnyIndustryData = fields.some((field) => {
    const value = field.value;
    return value !== null && value !== undefined && String(value).trim().length > 0;
  });

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Industry Enrichment
        </p>
        <h3 className="mt-2 text-xl font-bold">NAICS, SIC, and ZoomInfo Industry Data</h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
          Imported classification fields used to support segmentation, prospect prioritization,
          application fit, and sales routing.
        </p>
      </div>

      {!hasAnyIndustryData ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
          No imported NAICS, SIC, Primary Industry, or Sub-Industry data is available for this company yet.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {fields.map((field) => (
            <div
              key={field.label}
              className={`rounded-xl border p-4 ${
                field.emphasis
                  ? "border-blue-200 bg-blue-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {field.label}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-900">
                {displayValue(field.value)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CompanySalesAssignmentPanel({
  companyId,
  canEditSalesCoverage = true,
  apiPermissionHeaders = () => ({}),
}: {
  companyId: string;
  canEditSalesCoverage?: boolean;
  apiPermissionHeaders?: any;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [assignedSalespersonId, setAssignedSalespersonId] = useState("Unassigned");
  const [assignedSalesManagerId, setAssignedSalesManagerId] = useState("Unassigned");
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [assignmentError, setAssignmentError] = useState("");

  async function loadCompanySalesAssignments() {
    setIsLoadingAssignments(true);
    setAssignmentError("");

    try {
      const response = await fetch(`/api/company-sales-assignments?companyId=${companyId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load sales assignments.");
      }

      setUsers(data.users ?? []);
      setAssignedSalespersonId(
        data.companyAssignment?.assigned_salesperson_id ?? "Unassigned"
      );
      setAssignedSalesManagerId(
        data.companyAssignment?.assigned_sales_manager_id ?? "Unassigned"
      );
    } catch (error) {
      setAssignmentError(
        error instanceof Error ? error.message : "Could not load sales assignments."
      );
    } finally {
      setIsLoadingAssignments(false);
    }
  }

  useEffect(() => {
    loadCompanySalesAssignments();
  }, [companyId]);

  async function saveCompanySalesAssignments() {
    setIsSavingAssignments(true);
    setAssignmentMessage("");
    setAssignmentError("");

    try {
      const response = await fetch("/api/company-sales-assignments", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
        },
        body: JSON.stringify({
          companyId,
          assignedSalespersonId,
          assignedSalesManagerId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save sales assignments.");
      }

      setAssignmentMessage("Sales assignments saved.");
      await loadCompanySalesAssignments();
    } catch (error) {
      setAssignmentError(
        error instanceof Error ? error.message : "Could not save sales assignments."
      );
    } finally {
      setIsSavingAssignments(false);
    }
  }

  function userLabel(user: any) {
    return user.display_name || user.name || user.email || user.id;
  }

  function selectedName(userId: string) {
    if (!userId || userId === "Unassigned") return "Unassigned";
    const user = users.find((candidate) => candidate.id === userId);
    return user ? userLabel(user) : "Unknown user";
  }

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Sales Coverage
          </p>
          <h3 className="mt-2 text-xl font-bold">Salesperson / Rep and Sales Manager</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Assign the outside or direct salesperson responsible for the account and the internal
            sales manager overseeing follow-up, prioritization, and opportunity progress.
          </p>
        </div>

        <button
          onClick={loadCompanySalesAssignments}
          disabled={isLoadingAssignments}
          className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {isLoadingAssignments ? "Refreshing..." : "Refresh Assignments"}
        </button>
      </div>

      {(assignmentMessage || assignmentError) && (
        <div className="mt-4 grid gap-2">
          {assignmentMessage && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {assignmentMessage}
            </div>
          )}
          {assignmentError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {assignmentError}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 grid max-w-full gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="text-sm font-semibold text-slate-700">Salesperson / Rep</label>
          <select
            value={assignedSalespersonId}
            onChange={(event) => setAssignedSalespersonId(event.target.value)}
            disabled={!canEditSalesCoverage}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="Unassigned">Unassigned</option>
            {users.map((user) => (
              <option key={`salesperson-${user.id}`} value={user.id}>
                {userLabel(user)}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Current selection: {selectedName(assignedSalespersonId)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="text-sm font-semibold text-slate-700">Sales Manager</label>
          <select
            value={assignedSalesManagerId}
            onChange={(event) => setAssignedSalesManagerId(event.target.value)}
            disabled={!canEditSalesCoverage}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="Unassigned">Unassigned</option>
            {users.map((user) => (
              <option key={`sales-manager-${user.id}`} value={user.id}>
                {userLabel(user)}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Current selection: {selectedName(assignedSalesManagerId)}
          </p>
        </div>
      </div>

      {!canEditSalesCoverage && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          Your current role can view sales coverage but cannot edit assignments.
        </p>
      )}

      <button
        onClick={saveCompanySalesAssignments}
        disabled={isSavingAssignments || !canEditSalesCoverage}
        className="mt-5 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isSavingAssignments
          ? "Saving..."
          : canEditSalesCoverage
            ? "Save Sales Assignments"
            : "View Only"}
      </button>
    </section>
  );
}

function CompanyOwnerPanel({
  companyId,
  currentOwnerId,
}: {
  companyId: string;
  currentOwnerId: string;
}) {
  const [owners, setOwners] = useState<CrmUser[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState(currentOwnerId);
  const [isLoadingOwners, setIsLoadingOwners] = useState(false);
  const [isSavingOwner, setIsSavingOwner] = useState(false);
  const [ownerMessage, setOwnerMessage] = useState("");
  const [ownerError, setOwnerError] = useState("");

  async function loadOwners() {
    setIsLoadingOwners(true);
    setOwnerError("");

    try {
      const response = await fetch("/api/crm-users");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load CRM owners.");
      }

      setOwners(data.users ?? []);
    } catch (error) {
      setOwnerError(error instanceof Error ? error.message : "Could not load CRM owners.");
    } finally {
      setIsLoadingOwners(false);
    }
  }

  useEffect(() => {
    loadOwners();
  }, []);

  useEffect(() => {
    setSelectedOwnerId(currentOwnerId);
  }, [currentOwnerId]);

  async function saveOwnerAssignment() {
    setIsSavingOwner(true);
    setOwnerMessage("");
    setOwnerError("");

    try {
      const response = await fetch("/api/company-owner", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          assignedUserId: selectedOwnerId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update company owner.");
      }

      setOwnerMessage("Company owner updated.");
    } catch (error) {
      setOwnerError(error instanceof Error ? error.message : "Could not update company owner.");
    } finally {
      setIsSavingOwner(false);
    }
  }

  const selectedOwner = owners.find((owner) => owner.id === selectedOwnerId);

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Ownership
          </p>
          <h3 className="mt-2 text-xl font-bold">Company Owner</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Assign one accountable CRM owner for follow-up, funnel ownership, and list management.
          </p>
        </div>

        <button
          onClick={loadOwners}
          disabled={isLoadingOwners}
          className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {isLoadingOwners ? "Refreshing..." : "Refresh Users"}
        </button>
      </div>

      {(ownerMessage || ownerError) && (
        <div className="mt-4 grid gap-2">
          {ownerMessage && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {ownerMessage}
            </div>
          )}
          {ownerError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {ownerError}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <label className="text-sm font-semibold text-slate-700">Assigned Owner</label>
          <select
            value={selectedOwnerId}
            onChange={(event) => setSelectedOwnerId(event.target.value)}
            className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Unassigned</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.display_name}
                    {owner.user_role === "admin" ? " Admin" : ""}
              </option>
            ))}
          </select>

          <p className="mt-2 text-xs text-slate-500">
            Current selection: {selectedOwner ? selectedOwner.display_name : "Unassigned"}
          </p>
        </div>

        <div className="flex items-end">
          <button
            onClick={saveOwnerAssignment}
            disabled={isSavingOwner || selectedOwnerId === currentOwnerId}
            className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSavingOwner ? "Saving..." : "Save Owner"}
          </button>
        </div>
      </div>
    </section>
  );
}

function OpportunityDocumentsPanel({
  opportunityId,
  companyId,
  contactId,
  apiPermissionHeaders = () => ({}),
}: {
  opportunityId: string;
  companyId: string;
  contactId: string | null;
  apiPermissionHeaders?: () => Record<string, string>;
}) {
  const [documents, setDocuments] = useState<OpportunityDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("attachment");
  const [description, setDescription] = useState("");
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [documentMessage, setDocumentMessage] = useState("");
  const [documentError, setDocumentError] = useState("");

  async function loadOpportunityDocuments() {
    setIsLoadingDocuments(true);
    setDocumentError("");

    try {
      const response = await fetch(
        `/api/opportunity-documents?opportunityId=${opportunityId}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load opportunity documents.");
      }

      setDocuments(data.documents ?? []);
    } catch (error) {
      setDocumentError(
        error instanceof Error ? error.message : "Could not load opportunity documents."
      );
    } finally {
      setIsLoadingDocuments(false);
    }
  }

  useEffect(() => {
    loadOpportunityDocuments();
  }, [opportunityId]);

  async function uploadOpportunityDocument() {
    setIsUploadingDocument(true);
    setDocumentMessage("");
    setDocumentError("");

    try {
      if (!selectedFile) {
        throw new Error("Choose a file before uploading.");
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("opportunityId", opportunityId);
      formData.append("companyId", companyId);
      if (contactId) formData.append("contactId", contactId);
      formData.append("documentType", documentType);
      formData.append("description", description);

      const response = await fetch("/api/opportunity-documents", {
        method: "POST",
        headers: {
          ...apiPermissionHeaders(),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not upload document.");
      }

      setDocumentMessage("Document uploaded.");
      setSelectedFile(null);
      setDescription("");
      setDocumentType("attachment");
      await loadOpportunityDocuments();
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : "Could not upload document.");
    } finally {
      setIsUploadingDocument(false);
    }
  }

  async function archiveOpportunityDocument(documentId: string) {
    setDocumentMessage("");
    setDocumentError("");

    try {
      const response = await fetch("/api/opportunity-documents", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
        },
        body: JSON.stringify({
          id: documentId,
          status: "archived",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not archive document.");
      }

      setDocumentMessage("Document archived.");
      await loadOpportunityDocuments();
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : "Could not archive document.");
    }
  }

  function formatFileSize(size: number | null) {
    if (!size) return "Unknown size";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h5 className="font-semibold text-slate-900">Opportunity Documents</h5>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Attach quotes, specs, photos, proposals, notes, or customer files to this opportunity.
          </p>
        </div>

        <button
          onClick={loadOpportunityDocuments}
          disabled={isLoadingDocuments}
          className="w-fit rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {isLoadingDocuments ? "Refreshing..." : "Refresh Documents"}
        </button>
      </div>

      {(documentMessage || documentError) && (
        <div className="mt-3 grid gap-2">
          {documentMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
              {documentMessage}
            </div>
          )}
          {documentError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {documentError}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-700">Document</label>
            <input
              type="file"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Type</label>
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm"
            >
              <option value="attachment">Attachment</option>
              <option value="quote">Quote</option>
              <option value="specification">Specification</option>
              <option value="photo">Photo</option>
              <option value="proposal">Proposal</option>
              <option value="customer_file">Customer File</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={uploadOpportunityDocument}
              disabled={isUploadingDocument}
              className="w-full rounded-lg bg-green-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isUploadingDocument ? "Uploading..." : "Upload"}
            </button>
          </div>

          <div className="md:col-span-4">
            <label className="text-xs font-semibold text-slate-700">Description</label>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm"
              placeholder="Optional context for this file."
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        {documents.length === 0 ? (
          <p className="text-sm text-slate-500">No documents attached yet.</p>
        ) : (
          <div className="grid gap-3">
            {documents.map((document) => (
              <div
                key={document.id}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                        {document.document_type || "attachment"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {formatFileSize(document.file_size)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {document.file_name}
                    </p>

                    {document.description && (
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {document.description}
                      </p>
                    )}

                    <p className="mt-2 text-xs text-slate-500">
                      Uploaded {formatDate(document.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {document.signed_url && (
                      <a
                        href={document.signed_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800"
                      >
                        Open
                      </a>
                    )}

                    <button
                      onClick={() => archiveOpportunityDocument(document.id)}
                      className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OpportunityActivitiesPanel({
  opportunityId,
  companyId,
  contactId,
  contacts,
}: {
  opportunityId: string;
  companyId: string;
  contactId: string | null;
  contacts: Record<string, string | boolean | null>[];
}) {
  const [activities, setActivities] = useState<SalesOpportunityActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [activityMessage, setActivityMessage] = useState("");
  const [activityError, setActivityError] = useState("");
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState("");
  const [form, setForm] = useState({
    activityType: "note",
    subject: "",
    notes: "",
    dueDate: "",
    primaryContactId: contactId || "",
    relatedContactIds: [] as string[],
  });

  async function loadOpportunityActivities() {
    setIsLoadingActivities(true);
    setActivityError("");

    try {
      const response = await fetch(
        `/api/sales-opportunity-activities?opportunityId=${opportunityId}`,
        {
          headers: await getVerifiedBearerHeaders(),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load opportunity activities.");
      }

      setActivities(data.activities ?? []);
    } catch (error) {
      setActivityError(
        error instanceof Error ? error.message : "Could not load opportunity activities."
      );
    } finally {
      setIsLoadingActivities(false);
    }
  }

  useEffect(() => {
    loadOpportunityActivities();
  }, [opportunityId]);

  function resetOpportunityActivityForm() {
    setEditingActivityId("");
    setForm({
      activityType: "note",
      subject: "",
      notes: "",
      dueDate: "",
      primaryContactId: contactId || "",
      relatedContactIds: [],
    });
    setShowActivityForm(false);
  }

  function startEditingOpportunityActivity(activity: any) {
    setEditingActivityId(String(activity.id));
    setForm({
      activityType: String(activity.activity_type || "note"),
      subject: String(activity.subject || ""),
      notes: String(activity.notes || ""),
      dueDate: activity.due_date ? String(activity.due_date).slice(0, 10) : "",
      primaryContactId: String(
        activity.contact?.id ||
          activity.contacts?.id ||
          activity.contact_id ||
          ""
      ),
      relatedContactIds: Array.isArray(activity.related_contacts)
        ? activity.related_contacts
            .map((contact: any) => String(contact?.id || ""))
            .filter(Boolean)
        : [],
    });
    setShowActivityForm(true);
    setActivityMessage("");
    setActivityError("");
  }

  async function saveOpportunityActivity() {
    setIsSavingActivity(true);
    setActivityMessage("");
    setActivityError("");

    try {
      if (!form.subject.trim() && !form.notes.trim()) {
        throw new Error("Enter a subject or note before saving.");
      }

      const response = await fetch("/api/sales-opportunity-activities", {
        method: editingActivityId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getVerifiedBearerHeaders()),
        },
        body: JSON.stringify({
          activityId: editingActivityId || undefined,
          opportunityId,
          companyId,
          primaryContactId: form.primaryContactId || null,
          relatedContactIds: form.relatedContactIds,
          activityType: form.activityType,
          subject: form.subject,
          notes: form.notes,
          dueDate: form.dueDate || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            (editingActivityId
              ? "Could not update opportunity activity."
              : "Could not save opportunity activity.")
        );
      }

      setActivityMessage(
        editingActivityId
          ? "Opportunity activity updated."
          : "Opportunity activity saved."
      );
      resetOpportunityActivityForm();
      await loadOpportunityActivities();
    } catch (error) {
      setActivityError(
        error instanceof Error
          ? error.message
          : editingActivityId
            ? "Could not update opportunity activity."
            : "Could not save opportunity activity."
      );
    } finally {
      setIsSavingActivity(false);
    }
  }

  async function completeOpportunityActivity(activityId: string) {
    setIsSavingActivity(true);
    setActivityMessage("");
    setActivityError("");

    try {
      const response = await fetch("/api/sales-opportunity-activities", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getVerifiedBearerHeaders()),
        },
        body: JSON.stringify({
          activityId,
          completed: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not complete opportunity activity.");
      }

      setActivityMessage("Opportunity activity completed.");
      await loadOpportunityActivities();
    } catch (error) {
      setActivityError(
        error instanceof Error ? error.message : "Could not complete opportunity activity."
      );
    } finally {
      setIsSavingActivity(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h5 className="font-semibold text-slate-900">Opportunity Activities</h5>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Track notes, follow-ups, quote steps, and activity history for this opportunity.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadOpportunityActivities}
            disabled={isLoadingActivities}
            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {isLoadingActivities ? "Refreshing..." : "Refresh"}
          </button>

          <button
            onClick={() => {
              if (showActivityForm) {
                resetOpportunityActivityForm();
              } else {
                setEditingActivityId("");
                setForm({
                  activityType: "note",
                  subject: "",
                  notes: "",
                  dueDate: "",
                  primaryContactId: contactId || "",
                  relatedContactIds: [],
                });
                setShowActivityForm(true);
              }
            }}
            className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800"
          >
            {showActivityForm ? "Cancel" : "Add Activity"}
          </button>
        </div>
      </div>

      {(activityMessage || activityError) && (
        <div className="mt-3 grid gap-2">
          {activityMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
              {activityMessage}
            </div>
          )}
          {activityError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {activityError}
            </div>
          )}
        </div>
      )}

      {showActivityForm && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-900">
              {editingActivityId ? "Edit Opportunity Activity" : "Add Opportunity Activity"}
            </p>
            {editingActivityId && (
              <button
                type="button"
                onClick={resetOpportunityActivityForm}
                disabled={isSavingActivity}
                className="w-fit rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Type</label>
              <select
                value={form.activityType}
                onChange={(event) => setForm({ ...form, activityType: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm"
              >
                <option value="note">Note</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="task">Task</option>
                <option value="quote_followup">Quote Follow-Up</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm"
                placeholder="Example: Follow up on washer quote"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Primary Contact</label>
              <select
                value={form.primaryContactId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    primaryContactId: event.target.value,
                    relatedContactIds: form.relatedContactIds.filter(
                      (selectedId) => selectedId !== event.target.value
                    ),
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm"
              >
                <option value="">No primary contact selected</option>
                {contacts.map((contact: any) => (
                  <option key={String(contact.id)} value={String(contact.id)}>
                    {displayValue(contact.full_name || contact.email)}
                    {contact.is_primary ? " — Company Primary" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <p className="text-xs font-semibold text-slate-700">Related Contacts</p>
              <div className="mt-1 grid max-h-32 gap-2 overflow-y-auto rounded-lg border border-slate-300 bg-white p-3">
                {contacts.length === 0 ? (
                  <p className="text-xs text-slate-500">No active company contacts available.</p>
                ) : (
                  contacts.map((contact: any) => {
                    const selectedContactId = String(contact.id);
                    const isPrimarySelection =
                      selectedContactId === form.primaryContactId;
                    const isChecked =
                      form.relatedContactIds.includes(selectedContactId);

                    return (
                      <label
                        key={selectedContactId}
                        className="flex items-center gap-2 text-xs text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isPrimarySelection}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              relatedContactIds: event.target.checked
                                ? [...form.relatedContactIds, selectedContactId]
                                : form.relatedContactIds.filter(
                                    (selectedId) => selectedId !== selectedContactId
                                  ),
                            })
                          }
                        />
                        <span>
                          {displayValue(contact.full_name || contact.email)}
                          {isPrimarySelection ? " — Primary Contact" : ""}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="md:col-span-4">
              <label className="text-xs font-semibold text-slate-700">Notes</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm"
                placeholder="Capture customer context, next step, objections, timing, or quote details."
              />
            </div>
          </div>

          <div className="mt-3 flex justify-start">
            <button
              onClick={saveOpportunityActivity}
              disabled={isSavingActivity}
              className="rounded-lg bg-green-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSavingActivity
                ? "Saving..."
                : editingActivityId
                  ? "Save Changes"
                  : "Save Activity"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4">
        {activities.length === 0 ? (
          <p className="text-sm text-slate-500">No opportunity activities yet.</p>
        ) : (
          <div className="grid gap-3">
            {activities.slice(0, 6).map((activity: any) => (
              <div
                key={activity.id}
                className={`rounded-xl border p-3 ${
                  activity.completed_at
                    ? "border-slate-200 bg-slate-50 opacity-75"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                        {getActivityLabel(activity.activity_type)}
                      </span>

                      {activity.due_date && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          Due {formatDate(activity.due_date)}
                        </span>
                      )}

                      {activity.completed_at && (
                        <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                          Complete
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {activity.subject || "No subject"}
                    </p>

                    {activity.notes && (
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {activity.notes}
                      </p>
                    )}

                    <div className="mt-2 grid gap-1 text-xs text-slate-500">
                      <p>
                        <span className="font-semibold">Primary Contact:</span>{" "}
                        {displayValue(
                          activity.contact?.full_name ||
                            activity.contacts?.full_name ||
                            activity.contact?.email ||
                            activity.contacts?.email
                        )}
                      </p>
                      <p>
                        <span className="font-semibold">Related Contacts:</span>{" "}
                        {Array.isArray(activity.related_contacts) &&
                        activity.related_contacts.length > 0
                          ? activity.related_contacts
                              .map((contact: any) =>
                                String(contact?.full_name || contact?.email || "")
                              )
                              .filter(Boolean)
                              .join(", ")
                          : "None selected"}
                      </p>
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      Created {formatDate(activity.created_at)}
                    </p>
                  </div>

                  <div className="flex w-fit flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEditingOpportunityActivity(activity)}
                      disabled={isSavingActivity}
                      className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      Edit Activity
                    </button>

                    {!activity.completed_at && (
                      <button
                        onClick={() => completeOpportunityActivity(activity.id)}
                        disabled={isSavingActivity}
                        className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyOpportunityPanel({
  companyId,
  companyName,
  contacts,
  prospects,
  primaryProspect,
  canMoveOpportunityStages = true,
  apiPermissionHeaders = () => ({}),
}: {
  companyId: string;
  companyName: string;
  contacts: Record<string, string | boolean | null>[];
  prospects: Record<string, string | number | null>[];
  primaryProspect: Record<string, string | number | null> | null;
  canMoveOpportunityStages?: boolean;
  apiPermissionHeaders?: () => Record<string, string>;
}) {
  const [stages, setStages] = useState<SalesFunnelStage[]>([]);
  const [opportunities, setOpportunities] = useState<SalesOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [opportunityMessage, setOpportunityMessage] = useState("");
  const [opportunityError, setOpportunityError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingOpportunityId, setEditingOpportunityId] = useState("");
  const [editForm, setEditForm] = useState({
    opportunityName: "",
    opportunityType: "",
    primaryContactId: "",
    relatedContactIds: [] as string[],
    productLine: "",
    likelyProductPath: "",
    primaryUseCase: "",
    estimatedValue: "",
    probability: "",
    expectedCloseDate: "",
    nextStep: "",
    nextStepDueDate: "",
    customerNeed: "",
    businessCase: "",
    owner: "",
  });

  const defaultStage = useMemo(() => {
    return stages.find((stage) => stage.stage_key === "new_unqualified") ?? stages[0] ?? null;
  }, [stages]);

  const [form, setForm] = useState({
    opportunityName: "",
    opportunityType: "Parts washer",
    primaryContactId: "",
    relatedContactIds: [] as string[],
    prospectId: "",
    stageId: "",
    productLine: "",
    likelyProductPath: "",
    primaryUseCase: "",
    estimatedValue: "",
    probability: "",
    expectedCloseDate: "",
    nextStep: "",
    nextStepDueDate: "",
    customerNeed: "",
    businessCase: "",
    owner: "",
  });

  async function loadOpportunityData() {
    setIsLoading(true);
    setOpportunityError("");

    try {
      const verifiedHeaders = await getVerifiedBearerHeaders();
      const [stagesResponse, opportunitiesResponse] = await Promise.all([
        fetch("/api/funnel-stages"),
        fetch(`/api/sales-opportunities?companyId=${companyId}`, {
          headers: verifiedHeaders,
        }),
      ]);

      const stagesData = await stagesResponse.json();
      const opportunitiesData = await opportunitiesResponse.json();

      if (!stagesResponse.ok) {
        throw new Error(stagesData.error || "Could not load funnel stages.");
      }

      if (!opportunitiesResponse.ok) {
        throw new Error(opportunitiesData.error || "Could not load opportunities.");
      }

      setStages(stagesData.stages ?? []);
      setOpportunities(opportunitiesData.opportunities ?? []);
    } catch (error) {
      setOpportunityError(
        error instanceof Error ? error.message : "Could not load opportunity data."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadOpportunityData();
  }, [companyId]);

  useEffect(() => {
    if (!showCreateForm) return;

    setForm((current) => ({
      ...current,
      opportunityName:
        current.opportunityName ||
        `${companyName} - ${displayValue(primaryProspect?.likely_product_path || "Sales Opportunity")}`,
      prospectId: current.prospectId || String(primaryProspect?.id ?? ""),
      stageId: current.stageId || defaultStage?.id || "",
      productLine: current.productLine || String(primaryProspect?.product_line ?? ""),
      likelyProductPath:
        current.likelyProductPath || String(primaryProspect?.likely_product_path ?? ""),
      primaryUseCase: current.primaryUseCase || String(primaryProspect?.primary_use_case ?? ""),
      probability:
        current.probability ||
        (typeof defaultStage?.default_probability === "number"
          ? String(defaultStage.default_probability)
          : ""),
      nextStep: current.nextStep || String(primaryProspect?.next_best_action ?? ""),
    }));
  }, [showCreateForm, defaultStage, primaryProspect, companyName]);

  async function handleCreateOpportunity() {
    setIsSaving(true);
    setOpportunityMessage("");
    setOpportunityError("");

    try {
      if (!form.opportunityName.trim()) {
        throw new Error("Opportunity name is required.");
      }

      if (!form.nextStep.trim()) {
        throw new Error("Next step is required for an open opportunity.");
      }

      if (!form.nextStepDueDate) {
        throw new Error("Next step due date is required for an open opportunity.");
      }

      const response = await fetch("/api/sales-opportunities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getVerifiedBearerHeaders()),
        },
        body: JSON.stringify({
          companyId,
          primaryContactId: form.primaryContactId || null,
          relatedContactIds: form.relatedContactIds,
          prospectId: form.prospectId || null,
          stageId: form.stageId || null,
          opportunityName: form.opportunityName,
          opportunityType: form.opportunityType,
          productLine: form.productLine,
          likelyProductPath: form.likelyProductPath,
          primaryUseCase: form.primaryUseCase,
          estimatedValue: form.estimatedValue,
          probability: form.probability,
          expectedCloseDate: form.expectedCloseDate || null,
          nextStep: form.nextStep,
          nextStepDueDate: form.nextStepDueDate || null,
          customerNeed: form.customerNeed,
          businessCase: form.businessCase,
          owner: form.owner,
          source: "company_detail",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create opportunity.");
      }

      setOpportunityMessage("Opportunity created.");
      setShowCreateForm(false);
      setForm({
        opportunityName: "",
        opportunityType: "Parts washer",
        primaryContactId: "",
        relatedContactIds: [],
        prospectId: "",
        stageId: "",
        productLine: "",
        likelyProductPath: "",
        primaryUseCase: "",
        estimatedValue: "",
        probability: "",
        expectedCloseDate: "",
        nextStep: "",
    nextStepDueDate: "",
        customerNeed: "",
        businessCase: "",
        owner: "",
      });

      await loadOpportunityData();
    } catch (error) {
      setOpportunityError(error instanceof Error ? error.message : "Could not create opportunity.");
    } finally {
      setIsSaving(false);
    }
  }

  function startEditingOpportunity(opportunity: SalesOpportunity) {
    setEditingOpportunityId(opportunity.id);
    setOpportunityMessage("");
    setOpportunityError("");

    setEditForm({
      opportunityName: opportunity.opportunity_name ?? "",
      opportunityType: opportunity.opportunity_type ?? "",
      primaryContactId: String(opportunity.contact_id || ""),
      relatedContactIds: Array.isArray((opportunity as any).related_contacts)
        ? (opportunity as any).related_contacts.map((contact: any) => String(contact.id))
        : [],
      productLine: opportunity.product_line ?? "",
      likelyProductPath: opportunity.likely_product_path ?? "",
      primaryUseCase: opportunity.primary_use_case ?? "",
      estimatedValue:
        opportunity.estimated_value !== null && opportunity.estimated_value !== undefined
          ? String(opportunity.estimated_value)
          : "",
      probability:
        opportunity.probability !== null && opportunity.probability !== undefined
          ? String(opportunity.probability)
          : "",
      expectedCloseDate: opportunity.expected_close_date ?? "",
      nextStep: opportunity.next_step ?? "",
      nextStepDueDate: opportunity.next_step_due_date ?? "",
      customerNeed: opportunity.customer_need ?? "",
      businessCase: opportunity.business_case ?? "",
      owner: opportunity.owner ?? "",
    });
  }

  function cancelEditingOpportunity() {
    setEditingOpportunityId("");
    setEditForm({
      opportunityName: "",
      opportunityType: "",
      primaryContactId: "",
      relatedContactIds: [],
      productLine: "",
      likelyProductPath: "",
      primaryUseCase: "",
      estimatedValue: "",
      probability: "",
      expectedCloseDate: "",
      nextStep: "",
    nextStepDueDate: "",
      customerNeed: "",
      businessCase: "",
      owner: "",
    });
  }

  async function saveOpportunityEdit() {
    if (!editingOpportunityId) return;

    setIsSaving(true);
    setOpportunityMessage("");
    setOpportunityError("");

    try {
      if (!editForm.opportunityName.trim()) {
        throw new Error("Opportunity name is required.");
      }

      if (!editForm.nextStep.trim()) {
        throw new Error("Next step is required for an open opportunity.");
      }

      if (!editForm.nextStepDueDate) {
        throw new Error("Next step due date is required for an open opportunity.");
      }

      const response = await fetch("/api/sales-opportunities", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getVerifiedBearerHeaders()),
        },
        body: JSON.stringify({
          id: editingOpportunityId,
          primaryContactId: editForm.primaryContactId || null,
          relatedContactIds: editForm.relatedContactIds,
          opportunityName: editForm.opportunityName,
          opportunityType: editForm.opportunityType,
          productLine: editForm.productLine,
          likelyProductPath: editForm.likelyProductPath,
          primaryUseCase: editForm.primaryUseCase,
          estimatedValue: editForm.estimatedValue,
          probability: editForm.probability,
          expectedCloseDate: editForm.expectedCloseDate || null,
          nextStep: editForm.nextStep,
          nextStepDueDate: editForm.nextStepDueDate || null,
          customerNeed: editForm.customerNeed,
          businessCase: editForm.businessCase,
          owner: editForm.owner,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update opportunity.");
      }

      setOpportunityMessage("Opportunity details updated.");
      cancelEditingOpportunity();
      await loadOpportunityData();
    } catch (error) {
      setOpportunityError(error instanceof Error ? error.message : "Could not update opportunity.");
    } finally {
      setIsSaving(false);
    }
  }
  async function handleUpdateOpportunity(
    opportunityId: string,
    updates: Record<string, string | number | null>
  ) {
    setIsSaving(true);
    setOpportunityMessage("");
    setOpportunityError("");

    try {
      const response = await fetch("/api/sales-opportunities", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getVerifiedBearerHeaders()),
        },
        body: JSON.stringify({
          id: opportunityId,
          ...updates,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update opportunity.");
      }

      setOpportunityMessage("Opportunity updated.");
      await loadOpportunityData();
    } catch (error) {
      setOpportunityError(error instanceof Error ? error.message : "Could not update opportunity.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Sales Funnel
          </p>
          <h3 className="mt-2 text-xl font-bold">Opportunities</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Create and manage sales opportunities for this company. Opportunities are separate from
            company records so one account can have multiple active product paths.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadOpportunityData}
            disabled={isLoading}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            onClick={() => setShowCreateForm((current) => !current)}
            className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
          >
            {showCreateForm ? "Cancel" : "Create Opportunity"}
          </button>
        </div>
      </div>

      {(opportunityMessage || opportunityError) && (
        <div className="mt-4 grid gap-2">
          {opportunityMessage && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {opportunityMessage}
            </div>
          )}
          {opportunityError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {opportunityError}
            </div>
          )}
        </div>
      )}

      {showCreateForm && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h4 className="text-lg font-bold">New Opportunity</h4>

          <div className="mt-4 grid gap-4 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Opportunity Name</label>
              <input
                type="text"
                value={form.opportunityName}
                onChange={(event) =>
                  setForm({ ...form, opportunityName: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Type</label>
              <select
                value={form.opportunityType}
                onChange={(event) =>
                  setForm({ ...form, opportunityType: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="Parts washer">Parts washer</option>
                <option value="Pump / fluid handling">Pump / fluid handling</option>
                <option value="Inking system">Inking system</option>
                <option value="OEM / custom">OEM / custom</option>
                <option value="Cleaning fluid">Cleaning fluid</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Stage</label>
              <select
                value={form.stageId}
                onChange={(event) => {
                  const stage = stages.find((item) => item.id === event.target.value);
                  setForm({
                    ...form,
                    stageId: event.target.value,
                    probability:
                      form.probability ||
                      (typeof stage?.default_probability === "number"
                        ? String(stage.default_probability)
                        : ""),
                  });
                }}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="">Choose stage</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.stage_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Primary Contact</label>
              <select
                value={form.primaryContactId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    primaryContactId: event.target.value,
                    relatedContactIds: form.relatedContactIds.filter(
                      (contactId) => contactId !== event.target.value
                    ),
                  })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="">No primary contact selected</option>
                {contacts.map((contact: any) => (
                  <option key={String(contact.id)} value={String(contact.id)}>
                    {displayValue(contact.full_name || contact.email)}
                    {contact.is_primary ? " — Company Primary" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <p className="text-sm font-semibold text-slate-700">Related Contacts</p>
              <div className="mt-2 grid max-h-36 gap-2 overflow-y-auto rounded-xl border border-slate-300 bg-white p-3">
                {contacts.length === 0 ? (
                  <p className="text-xs text-slate-500">No active company contacts available.</p>
                ) : (
                  contacts.map((contact: any) => {
                    const contactId = String(contact.id);
                    const isPrimarySelection = contactId === form.primaryContactId;
                    const isChecked = form.relatedContactIds.includes(contactId);

                    return (
                      <label
                        key={contactId}
                        className="flex items-center gap-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isPrimarySelection}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              relatedContactIds: event.target.checked
                                ? [...form.relatedContactIds, contactId]
                                : form.relatedContactIds.filter(
                                    (selectedId) => selectedId !== contactId
                                  ),
                            })
                          }
                        />
                        <span>
                          {displayValue(contact.full_name || contact.email)}
                          {isPrimarySelection ? " — Primary Contact" : ""}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Prospect</label>
              <input
                type="text"
                value={form.primaryUseCase}
                onChange={(event) =>
                  setForm({ ...form, primaryUseCase: event.target.value })
                }
                placeholder="Example: Parts washer opportunity, pump replacement, inking system review..."
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                Editable sales focus for this opportunity. The CRM will still link to the primary prospect record when available.
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Estimated Value</label>
              <input
                type="number"
                value={form.estimatedValue}
                onChange={(event) => setForm({ ...form, estimatedValue: event.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Probability %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.probability}
                onChange={(event) => setForm({ ...form, probability: event.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Expected Close</label>
              <input
                type="date"
                value={form.expectedCloseDate}
                onChange={(event) =>
                  setForm({ ...form, expectedCloseDate: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Products</label>
              <input
                type="text"
                value={form.productLine}
                onChange={(event) => setForm({ ...form, productLine: event.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Product Path</label>
              <input
                type="text"
                value={form.likelyProductPath}
                onChange={(event) =>
                  setForm({ ...form, likelyProductPath: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </div>

            <div className="lg:col-span-4">
              <label className="text-sm font-semibold text-slate-700">Next Step <span className="text-red-600">*</span></label>
              <textarea
                rows={3}
                value={form.nextStep}
                onChange={(event) => setForm({ ...form, nextStep: event.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Next Step Due Date <span className="text-red-600">*</span></label>
              <input
                type="date"
                value={form.nextStepDueDate}
                onChange={(event) => setForm({ ...form, nextStepDueDate: event.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Customer Need</label>
              <textarea
                rows={3}
                value={form.customerNeed}
                onChange={(event) => setForm({ ...form, customerNeed: event.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Business Case</label>
              <textarea
                rows={3}
                value={form.businessCase}
                onChange={(event) => setForm({ ...form, businessCase: event.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-start">
            <button
              onClick={handleCreateOpportunity}
              disabled={isSaving}
              className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSaving ? "Saving..." : "Save Opportunity"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5">
        {opportunities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="font-semibold text-slate-900">No opportunities yet</p>
            <p className="mt-2 text-sm text-slate-600">
              Create an opportunity when there is a real product path, application, quote, or sales motion to track.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {opportunities.map((opportunity) => (
              <div key={opportunity.id} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                        {opportunity.sales_funnel_stages?.stage_name || "No stage"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {opportunity.status}
                      </span>
                      {opportunity.probability !== null && (
                        <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                          {opportunity.probability}% probability
                        </span>
                      )}
                    </div>

                    <h4 className="mt-3 text-lg font-bold">{opportunity.opportunity_name}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {displayValue(opportunity.likely_product_path || opportunity.product_line || opportunity.primary_use_case || opportunity.opportunity_type)}
                    </p>

                    <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                      <p>
                        <span className="font-semibold">Value:</span>{" "}
                        {opportunity.estimated_value !== null
                          ? `$${Number(opportunity.estimated_value).toLocaleString()}`
                          : "Not provided"}
                      </p>
                      <p>
                        <span className="font-semibold">Expected close:</span>{" "}
                        {formatDate(opportunity.expected_close_date)}
                      </p>
                      <p>
                        <span className="font-semibold">Primary Contact:</span>{" "}
                        {displayValue(
                          opportunity.contact?.full_name ||
                            opportunity.contacts?.full_name ||
                            opportunity.contact?.email ||
                            opportunity.contacts?.email
                        )}
                      </p>
                      <p>
                        <span className="font-semibold">Related Contacts:</span>{" "}
                        {Array.isArray(opportunity.related_contacts) &&
                        opportunity.related_contacts.length > 0
                          ? opportunity.related_contacts
                              .map((contact: any) =>
                                String(contact?.full_name || contact?.email || "")
                              )
                              .filter(Boolean)
                              .join(", ")
                          : "None selected"}
                      </p>
                      <p>
                        <span className="font-semibold">Source:</span>{" "}
                        {displayValue(opportunity.source)}
                      </p>
                    </div>

                    <div className={`mt-4 rounded-xl p-4 text-sm leading-6 ${
                      !opportunity.next_step || !opportunity.next_step_due_date
                        ? "border border-red-200 bg-red-50 text-red-800"
                        : String(opportunity.next_step_due_date) < new Date().toISOString().slice(0, 10)
                          ? "border border-amber-200 bg-amber-50 text-amber-900"
                          : "bg-slate-50 text-slate-700"
                    }`}>
                      <p><span className="font-semibold">Next step:</span> {opportunity.next_step || "Missing"}</p>
                      <p><span className="font-semibold">Due:</span> {opportunity.next_step_due_date ? formatDate(opportunity.next_step_due_date) : "Missing"}</p>
                    </div>
                  </div>

                  <div className="grid gap-2 lg:min-w-[240px]">
                    {editingOpportunityId === opportunity.id && (
                      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h5 className="text-lg font-bold text-blue-950">Edit Opportunity</h5>
                            <p className="mt-1 text-sm leading-6 text-blue-900">
                              Update opportunity details without changing the company record.
                            </p>
                          </div>
                          <button
                            onClick={cancelEditingOpportunity}
                            className="w-fit rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-blue-200 hover:bg-blue-50"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-4">
                          <div className="lg:col-span-2">
                            <label className="text-sm font-semibold text-slate-700">Opportunity Name</label>
                            <input
                              type="text"
                              value={editForm.opportunityName}
                              onChange={(event) =>
                                setEditForm({ ...editForm, opportunityName: event.target.value })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-semibold text-slate-700">Type</label>
                            <select
                              value={editForm.opportunityType}
                              onChange={(event) =>
                                setEditForm({ ...editForm, opportunityType: event.target.value })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                            >
                              <option value="">Not specified</option>
                              <option value="Parts washer">Parts washer</option>
                              <option value="Pump / fluid handling">Pump / fluid handling</option>
                              <option value="Inking system">Inking system</option>
                              <option value="OEM / custom">OEM / custom</option>
                              <option value="Cleaning fluid">Cleaning fluid</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-sm font-semibold text-slate-700">Owner</label>
                            <input
                              type="text"
                              value={editForm.owner}
                              onChange={(event) =>
                                setEditForm({ ...editForm, owner: event.target.value })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                            />
                          </div>

                          <div className="lg:col-span-2">
                            <label className="text-sm font-semibold text-slate-700">Primary Contact</label>
                            <select
                              value={editForm.primaryContactId}
                              onChange={(event) =>
                                setEditForm({
                                  ...editForm,
                                  primaryContactId: event.target.value,
                                  relatedContactIds: editForm.relatedContactIds.filter(
                                    (contactId) => contactId !== event.target.value
                                  ),
                                })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                            >
                              <option value="">No primary contact selected</option>
                              {contacts.map((contact: any) => (
                                <option key={String(contact.id)} value={String(contact.id)}>
                                  {displayValue(contact.full_name || contact.email)}
                                  {contact.is_primary ? " — Company Primary" : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="lg:col-span-2">
                            <p className="text-sm font-semibold text-slate-700">Related Contacts</p>
                            <div className="mt-2 grid max-h-36 gap-2 overflow-y-auto rounded-xl border border-slate-300 bg-white p-3">
                              {contacts.length === 0 ? (
                                <p className="text-xs text-slate-500">No active company contacts available.</p>
                              ) : (
                                contacts.map((contact: any) => {
                                  const contactId = String(contact.id);
                                  const isPrimarySelection =
                                    contactId === editForm.primaryContactId;
                                  const isChecked =
                                    editForm.relatedContactIds.includes(contactId);

                                  return (
                                    <label
                                      key={contactId}
                                      className="flex items-center gap-2 text-sm text-slate-700"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        disabled={isPrimarySelection}
                                        onChange={(event) =>
                                          setEditForm({
                                            ...editForm,
                                            relatedContactIds: event.target.checked
                                              ? [...editForm.relatedContactIds, contactId]
                                              : editForm.relatedContactIds.filter(
                                                  (selectedId) => selectedId !== contactId
                                                ),
                                          })
                                        }
                                      />
                                      <span>
                                        {displayValue(contact.full_name || contact.email)}
                                        {isPrimarySelection ? " — Primary Contact" : ""}
                                      </span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          <div className="lg:col-span-2">
                            <label className="text-sm font-semibold text-slate-700">Products</label>
                            <input
                              type="text"
                              value={editForm.productLine}
                              onChange={(event) =>
                                setEditForm({ ...editForm, productLine: event.target.value })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                            />
                          </div>

                          <div className="lg:col-span-2">
                            <label className="text-sm font-semibold text-slate-700">Product Path</label>
                            <input
                              type="text"
                              value={editForm.likelyProductPath}
                              onChange={(event) =>
                                setEditForm({ ...editForm, likelyProductPath: event.target.value })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                            />
                          </div>

                          <div className="lg:col-span-2">
                            <label className="text-sm font-semibold text-slate-700">Prospect / Use Case</label>
                            <input
                              type="text"
                              value={editForm.primaryUseCase}
                              onChange={(event) =>
                                setEditForm({ ...editForm, primaryUseCase: event.target.value })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-semibold text-slate-700">Estimated Value</label>
                            <input
                              type="number"
                              value={editForm.estimatedValue}
                              onChange={(event) =>
                                setEditForm({ ...editForm, estimatedValue: event.target.value })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-semibold text-slate-700">Probability %</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={editForm.probability}
                              onChange={(event) =>
                                setEditForm({ ...editForm, probability: event.target.value })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-semibold text-slate-700">Expected Close</label>
                            <input
                              type="date"
                              value={editForm.expectedCloseDate}
                              onChange={(event) =>
                                setEditForm({ ...editForm, expectedCloseDate: event.target.value })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                            />
                          </div>

                          <div className="lg:col-span-4">
                            <label className="text-sm font-semibold text-slate-700">Next Step <span className="text-red-600">*</span></label>
                            <textarea
                              rows={3}
                              value={editForm.nextStep}
                              onChange={(event) =>
                                setEditForm({ ...editForm, nextStep: event.target.value })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                            />
                          </div>

                          <div className="lg:col-span-2">
                            <label className="text-sm font-semibold text-slate-700">Next Step Due Date <span className="text-red-600">*</span></label>
                            <input
                              type="date"
                              value={editForm.nextStepDueDate}
                              onChange={(event) =>
                                setEditForm({ ...editForm, nextStepDueDate: event.target.value })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                            />
                          </div>

                          <div className="lg:col-span-2">
                            <label className="text-sm font-semibold text-slate-700">Customer Need</label>
                            <textarea
                              rows={3}
                              value={editForm.customerNeed}
                              onChange={(event) =>
                                setEditForm({ ...editForm, customerNeed: event.target.value })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                            />
                          </div>

                          <div className="lg:col-span-2">
                            <label className="text-sm font-semibold text-slate-700">Business Case</label>
                            <textarea
                              rows={3}
                              value={editForm.businessCase}
                              onChange={(event) =>
                                setEditForm({ ...editForm, businessCase: event.target.value })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                            />
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          <button
                            onClick={saveOpportunityEdit}
                            disabled={isSaving}
                            className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {isSaving ? "Saving..." : "Save Opportunity Details"}
                          </button>

                          <button
                            onClick={cancelEditingOpportunity}
                            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {!canMoveOpportunityStages && (
                      <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-semibold text-amber-800">
                        Your current role cannot move this opportunity between stages.
                      </p>
                    )}

                    <label className="text-xs font-semibold text-slate-600">Update Stage</label>
                    <select
                      value={opportunity.stage_id || ""}
                      onChange={(event) =>
                        handleUpdateOpportunity(opportunity.id, {
                          stageId: event.target.value || null,
                        })
                      }
                      disabled={isSaving || !canMoveOpportunityStages}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                    >
                      <option value="">No stage</option>
                      {stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.stage_name}
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => startEditingOpportunity(opportunity)}
                        disabled={isSaving}
                        className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Edit Opportunity
                      </button>

                      <button
                        onClick={() => handleUpdateOpportunity(opportunity.id, { status: "won" })}
                        disabled={isSaving}
                        className="rounded-xl bg-green-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Mark Won
                      </button>
                      <button
                        onClick={() => handleUpdateOpportunity(opportunity.id, { status: "lost" })}
                        disabled={isSaving}
                        className="rounded-xl bg-red-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Mark Lost
                      </button>
                    </div>

                    <button
                      onClick={() => handleUpdateOpportunity(opportunity.id, { status: "archived" })}
                      disabled={isSaving}
                      className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      Archive
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-5">
                  <OpportunityDocumentsPanel
                    opportunityId={opportunity.id}
                    companyId={companyId}
                    contactId={opportunity.contact_id}
                    apiPermissionHeaders={apiPermissionHeaders}
                  />

                  <OpportunityActivitiesPanel
                    opportunityId={opportunity.id}
                    companyId={companyId}
                    contactId={opportunity.contact_id}
                    contacts={contacts}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CompanyProjectListManager({
  companyId,
  canManageProjectsLists = false,
}: {
  companyId: string;
  canManageProjectsLists?: boolean;
}) {
  const [projectsLists, setProjectsLists] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function getVerifiedAdminHeaders() {
    const supabase = getBrowserSupabaseClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error(
        error.message || "Could not read the signed-in session."
      );
    }

    const accessToken = data.session?.access_token;

    if (!accessToken) {
      throw new Error("A signed-in Supabase session is required.");
    }

    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  async function loadCompanyProjectAssignments() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [projectsResponse, assignmentsResponse] = await Promise.all([
        fetch("/api/projects-lists"),
        fetch(
          `/api/company-project-assignments?companyId=${encodeURIComponent(
            companyId
          )}`
        ),
      ]);

      const projectsData = await projectsResponse.json();
      const assignmentsData = await assignmentsResponse.json();

      if (!projectsResponse.ok) {
        throw new Error(
          projectsData.error || "Could not load Projects / Lists."
        );
      }

      if (!assignmentsResponse.ok) {
        throw new Error(
          assignmentsData.error ||
            "Could not load company Project / List assignments."
        );
      }

      setProjectsLists(
        Array.isArray(projectsData.projectsLists)
          ? projectsData.projectsLists
          : []
      );

      setAssignments(
        Array.isArray(assignmentsData.companyProjectAssignments)
          ? assignmentsData.companyProjectAssignments
          : []
      );
    } catch (error) {
      setProjectsLists([]);
      setAssignments([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load company Project / List assignments."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCompanyProjectAssignments();
  }, [companyId]);

  const assignedProjectIds = useMemo(
    () =>
      new Set(
        assignments.map((assignment) =>
          String(assignment.project_id || "")
        )
      ),
    [assignments]
  );

  const availableProjectsLists = useMemo(
    () =>
      projectsLists.filter(
        (item) =>
          item.status === "active" &&
          !assignedProjectIds.has(String(item.id))
      ),
    [projectsLists, assignedProjectIds]
  );

  async function addAssignment() {
    if (!selectedProjectId || isSaving) return;

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const headers = await getVerifiedAdminHeaders();
      const response = await fetch("/api/company-project-assignments", {
        method: "POST",
        headers,
        body: JSON.stringify({
          companyId,
          projectId: selectedProjectId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not add Project / List assignment."
        );
      }

      setSelectedProjectId("");
      setMessage("Project / List assignment added.");
      await loadCompanyProjectAssignments();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not add Project / List assignment."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function removeAssignment(projectId: string) {
    if (!projectId || isSaving) return;

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const headers = await getVerifiedAdminHeaders();
      const response = await fetch("/api/company-project-assignments", {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          companyId,
          projectId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not remove Project / List assignment."
        );
      }

      setMessage("Project / List assignment removed.");
      await loadCompanyProjectAssignments();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not remove Project / List assignment."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-xl font-bold">Projects / Lists</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Add this company to active sales projects, campaigns, initiatives,
            and reusable CRM lists.
          </p>
        </div>

        <button
          type="button"
          onClick={loadCompanyProjectAssignments}
          disabled={isLoading}
          className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {isLoading ? "Refreshing..." : "Refresh Assignments"}
        </button>
      </div>

      {(message || errorMessage) && (
        <div className="mt-4 grid gap-2">
          {message && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {message}
            </div>
          )}
          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-800">
          Assigned Projects / Lists
        </p>

        {assignments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            This company is not assigned to any Projects or Lists.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {assignments.map((assignment) => {
              const project = assignment.crm_projects;
              const projectId = String(
                assignment.project_id || project?.id || ""
              );
              const isArchived = project?.status === "archived";

              return (
                <div
                  key={String(assignment.id)}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            project?.project_kind === "list"
                              ? "bg-violet-100 text-violet-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {project?.project_kind === "list"
                            ? "List"
                            : "Project"}
                        </span>

                        {isArchived && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            Archived
                          </span>
                        )}
                      </div>

                      <p className="mt-2 font-semibold text-slate-950">
                        {project?.project_name || "Unknown Project / List"}
                      </p>

                      {project?.description && (
                        <p className="mt-1 text-sm leading-5 text-slate-600">
                          {project.description}
                        </p>
                      )}
                    </div>

                    {canManageProjectsLists && (
                      <button
                        type="button"
                        onClick={() => removeAssignment(projectId)}
                        disabled={isSaving}
                        className="w-fit rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canManageProjectsLists ? (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <label className="text-sm font-semibold text-blue-950">
            Add to Project / List
          </label>

          <div className="mt-2 flex flex-col gap-3 md:flex-row">
            <select
              value={selectedProjectId}
              onChange={(event) =>
                setSelectedProjectId(event.target.value)
              }
              disabled={isLoading || isSaving}
              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Choose an active Project or List</option>
              {availableProjectsLists.map((item) => (
                <option key={String(item.id)} value={String(item.id)}>
                  {item.project_kind === "list" ? "List" : "Project"}:{" "}
                  {item.project_name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={addAssignment}
              disabled={!selectedProjectId || isLoading || isSaving}
              className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSaving ? "Saving..." : "Add Assignment"}
            </button>
          </div>

          {availableProjectsLists.length === 0 && !isLoading && (
            <p className="mt-3 text-xs text-blue-800">
              No additional active Projects or Lists are available.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          Your current role can view Project / List membership but cannot
          change assignments.
        </p>
      )}
    </section>
  );
}


function CompanyTagManager({
  companyId,
  apiPermissionHeaders = () => ({}),
}: {
  companyId: string;
  apiPermissionHeaders?: () => Record<string, string>;
}) {
  const [allTags, setAllTags] = useState<CrmTag[]>([]);
  const [assignedTags, setAssignedTags] = useState<AssignedCompanyTag[]>([]);
  const [selectedMarketTagId, setSelectedMarketTagId] = useState("");
  const [selectedSectorTagId, setSelectedSectorTagId] = useState("");
  const [selectedCategoryTagId, setSelectedCategoryTagId] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [tagError, setTagError] = useState("");
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isSavingTag, setIsSavingTag] = useState(false);

  async function loadTags() {
    setIsLoadingTags(true);
    setTagError("");

    try {
      const [tagsResponse, companyTagsResponse] = await Promise.all([
        fetch("/api/tags"),
        fetch(`/api/company-tags?companyId=${companyId}`),
      ]);

      const tagsData = await tagsResponse.json();
      const companyTagsData = await companyTagsResponse.json();
if (!tagsResponse.ok) {
        throw new Error(tagsData.error || "Could not load CRM tags.");
      }

      if (!companyTagsResponse.ok) {
        throw new Error(companyTagsData.error || "Could not load company tags.");
      }

      if (!companyTagsResponse.ok) {
        throw new Error(companyTagsData.error || "Could not load company tags.");
      }

      setAllTags(tagsData.tags ?? []);
      setAssignedTags(companyTagsData.companyTags ?? []);
    } catch (error) {
      setTagError(error instanceof Error ? error.message : "Could not load tags.");
    } finally {
      setIsLoadingTags(false);
    }
  }

  useEffect(() => {
    loadTags();
  }, [companyId]);

  const assignedTagIds = useMemo(() => {
    return new Set(assignedTags.map((tag) => tag.tag_id));
  }, [assignedTags]);

  const availableTags = useMemo(() => {
    return allTags.filter((tag) => !assignedTagIds.has(tag.id));
  }, [allTags, assignedTagIds]);

  const groupedAssignedTags = useMemo(() => {
    return {
      market: assignedTags.filter((tag) => tag.crm_tags?.tag_type === "market"),
      sector: assignedTags.filter((tag) => tag.crm_tags?.tag_type === "sector"),
      category: assignedTags.filter((tag) => tag.crm_tags?.tag_type === "category"),
    };
  }, [assignedTags]);

  const groupedAvailableTags = useMemo(() => {
    return {
      market: availableTags.filter((tag) => tag.tag_type === "market"),
      sector: availableTags.filter((tag) => tag.tag_type === "sector"),
      category: availableTags.filter((tag) => tag.tag_type === "category"),
    };
  }, [availableTags]);

  async function handleAddTag(tagId: string, label: string, resetSelection: () => void) {
    if (!tagId) return;

    setIsSavingTag(true);
    setTagMessage("");
    setTagError("");

    try {
      const response = await fetch("/api/company-tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
        },
        body: JSON.stringify({
          companyId,
          tagId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Could not add ${label}.`);
      }

      resetSelection();
      setTagMessage(`${label} added.`);
      await loadTags();
    } catch (error) {
      setTagError(error instanceof Error ? error.message : `Could not add ${label}.`);
    } finally {
      setIsSavingTag(false);
    }
  }

  async function handleRemoveTag(tagId: string) {
    setIsSavingTag(true);
    setTagMessage("");
    setTagError("");

    try {
      const response = await fetch("/api/company-tags", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
        },
        body: JSON.stringify({
          companyId,
          tagId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not remove company tag.");
      }

      setTagMessage("Tag removed.");
      await loadTags();
    } catch (error) {
      setTagError(error instanceof Error ? error.message : "Could not remove company tag.");
    } finally {
      setIsSavingTag(false);
    }
  }

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-xl font-bold">Market / Sector / Category Tags</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Assign segmentation tags to this company for prospecting lists, targeting, and future filters.
          </p>
        </div>

        <button
          onClick={loadTags}
          disabled={isLoadingTags}
          className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {isLoadingTags ? "Refreshing..." : "Refresh Tags"}
        </button>
      </div>

      {(tagMessage || tagError) && (
        <div className="mt-4 grid gap-2">
          {tagMessage && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {tagMessage}
            </div>
          )}
          {tagError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {tagError}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-4">
        <TagAssignmentColumn
          title="Markets"
          emptyText="No markets assigned."
          selectLabel="Choose Market"
          addLabel="Add Market"
          selectedTagId={selectedMarketTagId}
          setSelectedTagId={setSelectedMarketTagId}
          availableTags={groupedAvailableTags.market}
          assignedTags={groupedAssignedTags.market}
          isSavingTag={isSavingTag}
          onAddTag={() =>
            handleAddTag(selectedMarketTagId, "Market", () => setSelectedMarketTagId(""))
          }
          onRemoveTag={handleRemoveTag}
        />

        <TagAssignmentColumn
          title="Sectors"
          emptyText="No sectors assigned."
          selectLabel="Choose Sector"
          addLabel="Add Sector"
          selectedTagId={selectedSectorTagId}
          setSelectedTagId={setSelectedSectorTagId}
          availableTags={groupedAvailableTags.sector}
          assignedTags={groupedAssignedTags.sector}
          isSavingTag={isSavingTag}
          onAddTag={() =>
            handleAddTag(selectedSectorTagId, "Sector", () => setSelectedSectorTagId(""))
          }
          onRemoveTag={handleRemoveTag}
        />

        <TagAssignmentColumn
          title="Categories"
          emptyText="No categories assigned."
          selectLabel="Choose Category"
          addLabel="Add Category"
          selectedTagId={selectedCategoryTagId}
          setSelectedTagId={setSelectedCategoryTagId}
          availableTags={groupedAvailableTags.category}
          assignedTags={groupedAssignedTags.category}
          isSavingTag={isSavingTag}
          onAddTag={() =>
            handleAddTag(selectedCategoryTagId, "Category", () => setSelectedCategoryTagId(""))
          }
          onRemoveTag={handleRemoveTag}
        />
      </div>
    </section>
  );
}

function TagAssignmentColumn({
  title,
  emptyText,
  selectLabel,
  addLabel,
  selectedTagId,
  setSelectedTagId,
  availableTags,
  assignedTags,
  isSavingTag,
  onAddTag,
  onRemoveTag,
}: {
  title: string;
  emptyText: string;
  selectLabel: string;
  addLabel: string;
  selectedTagId: string;
  setSelectedTagId: (value: string) => void;
  availableTags: CrmTag[];
  assignedTags: AssignedCompanyTag[];
  isSavingTag: boolean;
  onAddTag: () => void;
  onRemoveTag: (tagId: string) => void;
}) {

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-lg font-bold text-slate-900">{title}</h4>

      {assignedTags.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {assignedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 ring-1 ring-blue-100"
              title={tag.crm_tags?.description || ""}
            >
              {tag.crm_tags?.tag_name || "Unnamed tag"}
              <button
                type="button"
                onClick={() => onRemoveTag(tag.tag_id)}
                disabled={isSavingTag}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-sm font-bold leading-none text-blue-700 hover:bg-red-100 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:text-slate-400"
                aria-label={`Remove ${tag.crm_tags?.tag_name || "tag"}`}
                title={`Remove ${tag.crm_tags?.tag_name || "tag"}`}
              >
                Ãƒâ€”
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-2">
        <select
          value={selectedTagId}
          onChange={(event) => setSelectedTagId(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="">{selectLabel}</option>
          {availableTags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.tag_name}
            </option>
          ))}
        </select>

        <button
          onClick={onAddTag}
          disabled={!selectedTagId || isSavingTag}
          className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSavingTag ? "Saving..." : addLabel}
        </button>
      </div>
    </div>
  );
}


function ContactProjectListManager({
  contactId,
  canManageProjectsLists = false,
}: {
  contactId: string;
  canManageProjectsLists?: boolean;
}) {
  const [projectsLists, setProjectsLists] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadContactProjectsLists() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [projectsResponse, assignmentsResponse] = await Promise.all([
        fetch("/api/projects-lists?includeInactive=true"),
        fetch(`/api/contact-project-assignments?contactId=${encodeURIComponent(contactId)}`),
      ]);

      const projectsData = await projectsResponse.json();
      const assignmentsData = await assignmentsResponse.json();

      if (!projectsResponse.ok) {
        throw new Error(projectsData.error || "Could not load Projects / Lists.");
      }

      if (!assignmentsResponse.ok) {
        throw new Error(
          assignmentsData.error ||
            "Could not load contact Project / List assignments."
        );
      }

      setProjectsLists(projectsData.projectsLists ?? []);
      setAssignments(assignmentsData.contactProjectAssignments ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load contact Project / List assignments."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadContactProjectsLists();
  }, [contactId]);

  const assignedProjectIds = useMemo(
    () => new Set(assignments.map((assignment) => String(assignment.project_id))),
    [assignments]
  );

  const availableProjectsLists = projectsLists.filter(
    (item) =>
      String(item.status || "active") === "active" &&
      !assignedProjectIds.has(String(item.id))
  );

  async function getVerifiedAuthorizationHeader() {
    const supabase = getBrowserSupabaseClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error(error.message || "Could not read the signed-in session.");
    }

    const accessToken = data.session?.access_token;

    if (!accessToken) {
      throw new Error("A signed-in Admin session is required.");
    }

    return { Authorization: `Bearer ${accessToken}` };
  }

  async function addProjectListAssignment() {
    if (!selectedProjectId || !canManageProjectsLists) return;

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const authorizationHeader = await getVerifiedAuthorizationHeader();
      const response = await fetch("/api/contact-project-assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authorizationHeader,
        },
        body: JSON.stringify({
          contactId,
          projectId: selectedProjectId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not add Project / List assignment.");
      }

      setSelectedProjectId("");
      setMessage("Project / List assignment added.");
      await loadContactProjectsLists();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not add Project / List assignment."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function removeProjectListAssignment(projectId: string) {
    if (!canManageProjectsLists) return;

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const authorizationHeader = await getVerifiedAuthorizationHeader();
      const response = await fetch("/api/contact-project-assignments", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authorizationHeader,
        },
        body: JSON.stringify({ contactId, projectId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not remove Project / List assignment.");
      }

      setMessage("Project / List assignment removed.");
      await loadContactProjectsLists();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not remove Project / List assignment."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="font-semibold text-violet-950">Contact Projects / Lists</h4>
          <p className="mt-1 text-xs leading-5 text-violet-700">
            Memberships assigned specifically to this contact.
          </p>
        </div>

        <button
          type="button"
          onClick={loadContactProjectsLists}
          disabled={isLoading || isSaving}
          className="w-fit rounded-lg bg-white px-3 py-2 text-xs font-semibold text-violet-800 shadow-sm ring-1 ring-violet-200 hover:bg-violet-100 disabled:text-slate-400"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {(message || errorMessage) && (
        <div className="mt-3 grid gap-2">
          {message && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-xs text-green-800">
              {message}
            </div>
          )}
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
              {errorMessage}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-2">
        {assignments.length === 0 ? (
          <p className="text-xs text-violet-700">No Projects / Lists assigned.</p>
        ) : (
          assignments.map((assignment) => {
            const item = assignment.crm_projects;
            const projectId = String(assignment.project_id);

            return (
              <div
                key={String(assignment.id)}
                className="flex flex-col gap-2 rounded-lg border border-violet-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-xs text-violet-950">
                  <p className="font-semibold">
                    {item?.project_kind === "list" ? "List" : "Project"}:{" "}
                    {item?.project_name || projectId}
                  </p>
                  {item?.status === "archived" && (
                    <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                      Archived
                    </span>
                  )}
                </div>

                {canManageProjectsLists && (
                  <button
                    type="button"
                    onClick={() => removeProjectListAssignment(projectId)}
                    disabled={isSaving}
                    className="w-fit rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:text-slate-400"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {canManageProjectsLists ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            disabled={isSaving || availableProjectsLists.length === 0}
            className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs shadow-sm disabled:bg-slate-100"
          >
            <option value="">Choose an active Project / List</option>
            {availableProjectsLists.map((item) => (
              <option key={String(item.id)} value={String(item.id)}>
                {item.project_kind === "list" ? "List" : "Project"}:{" "}
                {item.project_name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={addProjectListAssignment}
            disabled={!selectedProjectId || isSaving}
            className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:bg-slate-300"
          >
            {isSaving ? "Saving..." : "Add"}
          </button>
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-semibold text-amber-800">
          Project / List memberships are read-only for your current role.
        </p>
      )}
    </div>
  );
}

function ContactTagManager({
  contactId,
  apiPermissionHeaders = () => ({}),
}: {
  contactId: string;
  apiPermissionHeaders?: () => Record<string, string>;
}) {
  const [allTags, setAllTags] = useState<CrmTag[]>([]);
  const [assignedTags, setAssignedTags] = useState<AssignedContactTag[]>([]);
  const [selectedMarketTagId, setSelectedMarketTagId] = useState("");
  const [selectedSectorTagId, setSelectedSectorTagId] = useState("");
  const [selectedCategoryTagId, setSelectedCategoryTagId] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [tagError, setTagError] = useState("");
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isSavingTag, setIsSavingTag] = useState(false);

  async function loadTags() {
    setIsLoadingTags(true);
    setTagError("");

    try {
      const [tagsResponse, contactTagsResponse] = await Promise.all([
        fetch("/api/tags"),
        fetch(`/api/contact-tags?contactId=${contactId}`),
      ]);

      const tagsData = await tagsResponse.json();
      const contactTagsData = await contactTagsResponse.json();

      if (!tagsResponse.ok) {
        throw new Error(tagsData.error || "Could not load CRM tags.");
      }

      if (!contactTagsResponse.ok) {
        throw new Error(contactTagsData.error || "Could not load contact tags.");
      }

      setAllTags(tagsData.tags ?? []);
      setAssignedTags(contactTagsData.contactTags ?? []);
    } catch (error) {
      setTagError(error instanceof Error ? error.message : "Could not load contact tags.");
    } finally {
      setIsLoadingTags(false);
    }
  }

  useEffect(() => {
    loadTags();
  }, [contactId]);

  const assignedTagIds = useMemo(() => {
    return new Set(assignedTags.map((tag) => tag.tag_id));
  }, [assignedTags]);

  const availableTags = useMemo(() => {
    return allTags.filter((tag) => !assignedTagIds.has(tag.id));
  }, [allTags, assignedTagIds]);

  const groupedAssignedTags = useMemo(() => {
    return {
      market: assignedTags.filter((tag) => tag.crm_tags?.tag_type === "market"),
      sector: assignedTags.filter((tag) => tag.crm_tags?.tag_type === "sector"),
      category: assignedTags.filter((tag) => tag.crm_tags?.tag_type === "category"),
    };
  }, [assignedTags]);

  const groupedAvailableTags = useMemo(() => {
    return {
      market: availableTags.filter((tag) => tag.tag_type === "market"),
      sector: availableTags.filter((tag) => tag.tag_type === "sector"),
      category: availableTags.filter((tag) => tag.tag_type === "category"),
    };
  }, [availableTags]);

  async function handleAddTag(tagId: string, label: string, resetSelection: () => void) {
    if (!tagId) return;

    setIsSavingTag(true);
    setTagMessage("");
    setTagError("");

    try {
      const response = await fetch("/api/contact-tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
        },
        body: JSON.stringify({
          contactId,
          tagId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Could not add ${label}.`);
      }

      resetSelection();
      setTagMessage(`${label} added.`);
      await loadTags();
    } catch (error) {
      setTagError(error instanceof Error ? error.message : `Could not add ${label}.`);
    } finally {
      setIsSavingTag(false);
    }
  }

  async function handleRemoveTag(tagId: string) {
    setIsSavingTag(true);
    setTagMessage("");
    setTagError("");

    try {
      const response = await fetch("/api/contact-tags", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
        },
        body: JSON.stringify({
          contactId,
          tagId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not remove contact tag.");
      }

      setTagMessage("Tag removed.");
      await loadTags();
    } catch (error) {
      setTagError(error instanceof Error ? error.message : "Could not remove contact tag.");
    } finally {
      setIsSavingTag(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="font-semibold text-slate-900">Contact Tags</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Tag this person by market relevance, industry sector, or buying-role category.
          </p>
        </div>

        <button
          onClick={loadTags}
          disabled={isLoadingTags}
          className="w-fit rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {isLoadingTags ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {(tagMessage || tagError) && (
        <div className="mt-3 grid gap-2">
          {tagMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-xs text-green-800">
              {tagMessage}
            </div>
          )}
          {tagError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
              {tagError}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-3">
        <ContactTagAssignmentRow
          title="Markets"
          emptyText="No markets assigned."
          selectLabel="Choose Market"
          addLabel="Add Market"
          selectedTagId={selectedMarketTagId}
          setSelectedTagId={setSelectedMarketTagId}
          availableTags={groupedAvailableTags.market}
          assignedTags={groupedAssignedTags.market}
          isSavingTag={isSavingTag}
          onAddTag={() =>
            handleAddTag(selectedMarketTagId, "Market", () => setSelectedMarketTagId(""))
          }
          onRemoveTag={handleRemoveTag}
        />

        <ContactTagAssignmentRow
          title="Sectors"
          emptyText="No sectors assigned."
          selectLabel="Choose Sector"
          addLabel="Add Sector"
          selectedTagId={selectedSectorTagId}
          setSelectedTagId={setSelectedSectorTagId}
          availableTags={groupedAvailableTags.sector}
          assignedTags={groupedAssignedTags.sector}
          isSavingTag={isSavingTag}
          onAddTag={() =>
            handleAddTag(selectedSectorTagId, "Sector", () => setSelectedSectorTagId(""))
          }
          onRemoveTag={handleRemoveTag}
        />

        <ContactTagAssignmentRow
          title="Categories"
          emptyText="No categories assigned."
          selectLabel="Choose Category"
          addLabel="Add Category"
          selectedTagId={selectedCategoryTagId}
          setSelectedTagId={setSelectedCategoryTagId}
          availableTags={groupedAvailableTags.category}
          assignedTags={groupedAssignedTags.category}
          isSavingTag={isSavingTag}
          onAddTag={() =>
            handleAddTag(selectedCategoryTagId, "Category", () => setSelectedCategoryTagId(""))
          }
          onRemoveTag={handleRemoveTag}
        />
      </div>
    </div>
  );
}

function ContactTagAssignmentRow({
  title,
  emptyText,
  selectLabel,
  addLabel,
  selectedTagId,
  setSelectedTagId,
  availableTags,
  assignedTags,
  isSavingTag,
  onAddTag,
  onRemoveTag,
}: {
  title: string;
  emptyText: string;
  selectLabel: string;
  addLabel: string;
  selectedTagId: string;
  setSelectedTagId: (value: string) => void;
  availableTags: CrmTag[];
  assignedTags: AssignedContactTag[];
  isSavingTag: boolean;
  onAddTag: () => void;
  onRemoveTag: (tagId: string) => void;
}) {

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-800">{title}</p>

      {assignedTags.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">{emptyText}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {assignedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-100"
              title={tag.crm_tags?.description || ""}
            >
              {tag.crm_tags?.tag_name || "Unnamed tag"}
              <button
                type="button"
                onClick={() => onRemoveTag(tag.tag_id)}
                disabled={isSavingTag}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-sm font-bold leading-none text-blue-700 hover:bg-red-100 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:text-slate-400"
                aria-label={`Remove ${tag.crm_tags?.tag_name || "tag"}`}
                title={`Remove ${tag.crm_tags?.tag_name || "tag"}`}
              >
                Ãƒâ€”
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <select
          value={selectedTagId}
          onChange={(event) => setSelectedTagId(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="">{selectLabel}</option>
          {availableTags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.tag_name}
            </option>
          ))}
        </select>

        <button
          onClick={onAddTag}
          disabled={!selectedTagId || isSavingTag}
          className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSavingTag ? "Saving..." : addLabel}
        </button>
      </div>
    </div>
  );
}

function SmallScoreCard({ label, value }: { label: string; value: string }) {

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{label}</p>
      <p className="mt-1 text-lg font-bold text-blue-950">{value}</p>
    </div>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {

  return (
    <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: unknown }) {

  return (
    <div className="border-b border-slate-100 py-2 text-sm last:border-b-0">
      <p className="font-semibold text-slate-700">{label}</p>
      <p className="mt-1 text-slate-600">{displayValue(value)}</p>
    </div>
  );
}

function ReadableListCard({
  title,
  items,
  primaryKeys,
  secondaryKeys,
}: {
  title: string;
  items: unknown[];
  primaryKeys: string[];
  secondaryKeys: string[];
}) {

  return (
    <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold">{title}</h3>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No items generated.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {items.map((item, index) => (
            <ReadableListItem
              key={index}
              item={item}
              primaryKeys={primaryKeys}
              secondaryKeys={secondaryKeys}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReadableListItem({
  item,
  primaryKeys,
  secondaryKeys,
}: {
  item: unknown;
  primaryKeys: string[];
  secondaryKeys: string[];
}) {
  if (!isRecord(item)) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm leading-6 text-slate-700">{displayValue(item)}</p>
      </div>
    );
  }

  const primaryKey = primaryKeys.find((key) => item[key]);
  const secondaryKey = secondaryKeys.find((key) => item[key]);

  const primaryText = primaryKey ? displayValue(item[primaryKey]) : "Item";
  const secondaryText = secondaryKey ? displayValue(item[secondaryKey]) : "";

  const remainingEntries = Object.entries(item).filter(
    ([key]) => key !== primaryKey && key !== secondaryKey
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="font-semibold text-slate-900">{primaryText}</p>

      {secondaryText && (
        <p className="mt-2 text-sm leading-6 text-slate-700">{secondaryText}</p>
      )}

      {remainingEntries.length > 0 && (
        <div className="mt-3 grid gap-2 text-sm text-slate-600">
          {remainingEntries.map(([key, value]) => (
            <div key={key}>
              <span className="font-semibold text-slate-700">
                {formatTitleFromKey(key)}:
              </span>{" "}
              <span>{displayValue(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




















































































































































































































































































