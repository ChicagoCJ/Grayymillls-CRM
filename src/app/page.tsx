"use client";


import { getBrowserSupabaseClient, hasBrowserSupabaseConfig } from "../lib/supabase-browser";
import { ChangeEvent, ReactNode, useEffect, useMemo, useState } from "react";

type TabKey = "dashboard" | "companies" | "contacts" | "funnel" | "import" | "releaseNotes" | "admin" | "companyDetail";

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
};

const APP_VERSION = "Rev 2.13 - Backup Export";
const REVISION_NOTE =
  "Added an Admin-only backup export workflow that downloads core CRM operational data as a dated JSON backup file.";

  

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
  return new Date(value).toLocaleDateString();
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
  const today = new Date().toISOString().slice(0, 10);
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
  const [currentUserRole, setCurrentUserRole] = useState<AppUserRole>("admin");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState("Manual Role Test");
  const [currentCoverageType, setCurrentCoverageType] = useState("internal");
  const [applyRoleVisibility, setApplyRoleVisibility] = useState(false);
  const [importAssignedSalespersonId, setImportAssignedSalespersonId] = useState("");
  const [importAssignedSalesManagerId, setImportAssignedSalesManagerId] = useState("");
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
  const [companyOwnerFilter, setCompanyOwnerFilter] = useState("All");
  const [companySalespersonFilter, setCompanySalespersonFilter] = useState("All");
  const [companySalesManagerFilter, setCompanySalesManagerFilter] = useState("All");
  const [companyAssignmentStatusFilter, setCompanyAssignmentStatusFilter] = useState("All");
  const [companyPrimaryIndustryFilter, setCompanyPrimaryIndustryFilter] = useState("All");
  const [companyPrimarySubIndustryFilter, setCompanyPrimarySubIndustryFilter] = useState("All");
  const [companyOwnerOptions, setCompanyOwnerOptions] = useState<CrmUser[]>([]);
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [contactMarketTagFilter, setContactMarketTagFilter] = useState("All");
  const [contactSectorTagFilter, setContactSectorTagFilter] = useState("All");
  const [contactCategoryTagFilter, setContactCategoryTagFilter] = useState("All");
  const [allContactTags, setAllContactTags] = useState<ContactTagSummary[]>([]);
  const [selectedCompanyDetail, setSelectedCompanyDetail] = useState<CompanyDetail | null>(null);
  const [activityForm, setActivityForm] = useState<ActivityForm>({
    activityType: "note",
    subject: "",
    notes: "",
    dueDate: "",
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
    if (!applyRoleVisibility) return true;
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

      return (matchesSearch &&
        matchesMarketTag &&
        matchesSectorTag &&
        matchesCategoryTag &&
        matchesContactRoleVisibility);
    });
    }, [
    crmSummary.contacts,
    crmSummary.companies,
    allContactTags,
    contactSearchTerm,
    contactMarketTagFilter,
    contactSectorTagFilter,
    contactCategoryTagFilter,
    applyRoleVisibility,
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
    applyRoleVisibility,
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
    applyRoleVisibility,
    currentUserId,
    currentUserRole,
  ]);
  const roleVisibilityNeedsUser =
    applyRoleVisibility && currentUserRole !== "admin" && !currentUserId;

  const navigationRole: AppUserRole = applyRoleVisibility ? "admin" : currentUserRole;

  function companyMatchesRoleVisibility(company: CompanySummary) {
    if (!applyRoleVisibility) return true;
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
        matchesAssignmentStatus
      );
    });
  }, [
    crmSummary.companies,
    allCompanyTags,
    companySearchTerm,
    companyTierFilter,
    companyStatusFilter,
    companyProductPathFilter,
    companySalespersonFilter,
    companySalesManagerFilter,
    companyAssignmentStatusFilter,
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
    setCompanyPrimaryIndustryFilter("All");
    setCompanyPrimarySubIndustryFilter("All");
  }

  function clearContactFilters() {
    setContactSearchTerm("");
    setContactMarketTagFilter("All");
    setContactSectorTagFilter("All");
    setContactCategoryTagFilter("All");
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
      const [summaryResponse, tagsResponse, companyTagsResponse, contactTagsResponse] =
        await Promise.all([
          fetch("/api/crm-summary"),
          fetch("/api/tags"),
          fetch("/api/company-tag-summary"),
          fetch("/api/contact-tag-summary"),
        ]);

      const summaryData = await summaryResponse.json();
      const tagsData = await tagsResponse.json();
      const companyTagsData = await companyTagsResponse.json();
      const contactTagsData = await contactTagsResponse.json();

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

      setCrmSummary(summaryData);
      setAllCrmTags(tagsData.tags ?? []);
      setAllCompanyTags(companyTagsData.companyTags ?? []);
      setAllContactTags(contactTagsData.contactTags ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load CRM summary.");
    } finally {
      setIsLoadingSummary(false);
    }
  }

    function returnFromCompanyDetail() {
    setActiveTab(companyDetailReturnTab === "companyDetail" ? "companies" : companyDetailReturnTab);
  }
async function loadCompanyDetail(companyId: string) {
    setCompanyDetailReturnTab((current) => (activeTab === "companyDetail" ? current : activeTab));
    setIsLoadingCompanyDetail(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/company-detail?id=${companyId}`);
      const data = await readJsonResponse(response, "/api/crm-users");

      if (!response.ok) {
        throw new Error(data.error || "Could not load company detail.");
      }

      setSelectedCompanyDetail(data);
      setActiveTab("companyDetail");
    } catch (error) {
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
      const response = await fetch("/api/import-zoominfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...apiPermissionHeaders(),
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

      setImportMessage(
        `Import ${data.status}: ${data.processedCount} processed, ${data.duplicateCount} possible duplicates/reused companies, ${data.errorCount} row errors.${assignmentSummary}`
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
      const primaryContact = selectedCompanyDetail.contacts?.[0];
      const primaryProspect = selectedCompanyDetail.primaryProspect;

      const response = await fetch("/api/activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: selectedCompanyDetail.company.id,
          contactId: primaryContact?.id ?? null,
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
      });

      await loadCompanyDetail(String(selectedCompanyDetail.company.id));
      await loadCrmSummary();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save activity.");
    } finally {
      setIsSavingActivity(false);
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "companies", label: "Companies" },
    { key: "contacts", label: "Contacts" },
    { key: "funnel", label: "Funnel" },
    { key: "import", label: "Import ZoomInfo" },    { key: "admin", label: "Admin" },

    { key: "releaseNotes", label: "Release Notes" },
  ];

  function apiPermissionHeaders() {
    return {
      "x-crm-user-id": String(currentUserId || ""),
      "x-crm-user-role": String(currentUserRole || "admin"),
      "x-crm-user-name": String(currentUserDisplayName || "Manual Role Test"),
    };
  }
  function clearImportAssignments() {
    setImportAssignedSalespersonId("");
    setImportAssignedSalesManagerId("");
  }
  function importAssignmentUserName(userId?: string | null) {
    if (!userId) return "Not selected";
    const user = roleTestUsers.find((candidate) => candidate.id === userId);
    return user?.display_name || user?.email || userId;
  }

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

  function applyRoleTestUser(userId: string) {
    setCurrentUserId(userId);

    if (!userId) {
      setCurrentUserDisplayName("Manual Role Test");
      setCurrentCoverageType("internal");
      return;
    }

    const selectedUser = roleTestUsers.find((user) => user.id === userId);

    if (!selectedUser) {
      setCurrentUserDisplayName("Unknown User");
      setCurrentCoverageType("internal");
      return;
    }

    setCurrentUserDisplayName(
      selectedUser.display_name || selectedUser.email || "Unnamed User"
    );
    setCurrentCoverageType(selectedUser.coverage_type || "internal");

    if (
      selectedUser.user_role === "admin" ||
      selectedUser.user_role === "sales_manager" ||
      selectedUser.user_role === "sales_rep"
    ) {
      setCurrentUserRole(selectedUser.user_role);
    }
  }
  function getRoleVisibleCompanies(companies: CompanySummary[]) {
    if (!applyRoleVisibility) return companies;
    if (currentUserRole === "admin") return companies;
    if (!currentUserId) return companies;

    return companies.filter((company) => {
      if (currentUserRole === "sales_manager") {
        return true;
      }

      if (currentUserRole === "sales_rep") {
        return String(company.assigned_salesperson_id || "") === currentUserId;
      }

      return true;
    });
  }

  function activityRecordMatchesRoleVisibility(activity: ActivityRecord) {
    if (!applyRoleVisibility) return true;
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
  const displayedCompanies = getRoleVisibleCompanies(filteredCompanies);
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

            <RoleTestingPanel
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          currentUserDisplayName={currentUserDisplayName}
          currentCoverageType={currentCoverageType}
          applyRoleVisibility={applyRoleVisibility}
          setApplyRoleVisibility={setApplyRoleVisibility}
          roleVisibilityNeedsUser={roleVisibilityNeedsUser}
          roleTotalCompanyCount={crmSummary.companies.length}
          roleVisibleCompanyCount={getRoleVisibleCompanies(crmSummary.companies).length}
          roleAssignedCompanyCount={currentUserAssignedCompanyCount}
          roleUnassignedCompanyCount={unassignedSalespersonCompanyCount}
          roleTestUsers={roleTestUsers}
          isLoadingRoleUsers={isLoadingRoleUsers}
          roleUserError={roleUserError}
          onSelectUser={applyRoleTestUser}
          setCurrentUserRole={(role) => {
            const nextPermissions = getRolePermissions(role);

            setCurrentUserRole(role);

            if (activeTab === "admin" && !nextPermissions.canManageAdminSettings) {
              setActiveTab("dashboard");
            }

            if (activeTab === "import" && !nextPermissions.canImportCsv) {
              setActiveTab("dashboard");
            }
          }}
          permissions={currentPermissions}
        />

        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm">
              <p className="font-semibold text-blue-900">{APP_VERSION}</p>
              <p className="mt-1 text-blue-700">{REVISION_NOTE}</p>
            </div>
          </div>
        </header>

        

        <nav aria-label="Primary CRM navigation" className="sticky top-2 z-40 flex flex-nowrap gap-2 overflow-x-auto rounded-2xl border border-slate-300 bg-white/95 p-2 shadow-md backdrop-blur supports-[backdrop-filter]:bg-white/80">
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
        </nav>

        {applyRoleVisibility && (
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                  Role Visibility Scope Banner
                </p>
                <h2 className="mt-1 text-lg font-bold text-blue-950">
                  Role Visibility is ON
                </h2>
                <p className="mt-1 text-sm text-blue-900">
                  Current role:{" "}
                  <span className="font-semibold">
                    {currentUserRole === "sales_rep"
                      ? "Sales Rep"
                      : currentUserRole === "sales_manager"
                        ? "Sales Manager"
                        : "Admin"}
                  </span>
                  {currentUserId ? (
                    <>

                    </>
                  ) : null}
                </p>
              </div>

              <div className="rounded-xl bg-white p-3 text-sm text-blue-950 ring-1 ring-blue-100 md:max-w-xl">
                {currentUserRole === "sales_rep" ? (
                  <p>
                    Sales Rep visibility is scoped by company sales coverage. Companies, contacts,
                    funnel opportunities, and activities are limited to records tied to companies
                    assigned to this rep.
                  </p>
                ) : (
                  <p>
                    Admins and Sales Managers retain full visibility across companies, contacts,
                    funnel opportunities, and activities.
                  </p>
                )}
              </div>
            </div>

            <div data-testid="role-visibility-count-grid" className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Companies</p>
                <p className="mt-1 text-2xl font-bold text-blue-950">
                  {visibleCompanyCount} <span className="text-sm font-semibold text-blue-700">of {totalCompanyCount}</span>
                </p>
                <p className="mt-1 text-xs text-blue-800">Visible under current role scope</p>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Contacts</p>
                <p className="mt-1 text-2xl font-bold text-blue-950">
                  {visibleContactCount} <span className="text-sm font-semibold text-blue-700">of {totalContactCount}</span>
                </p>
                <p className="mt-1 text-xs text-blue-800">Inherited from related company coverage</p>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Open Follow-Ups</p>
                <p className="mt-1 text-2xl font-bold text-blue-950">
                  {visibleOpenFollowUpCount} <span className="text-sm font-semibold text-blue-700">of {totalOpenFollowUpCount}</span>
                </p>
                <p className="mt-1 text-xs text-blue-800">Activities tied to visible companies</p>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Due Today</p>
                <p className="mt-1 text-2xl font-bold text-blue-950">
                  {visibleDueTodayFollowUpCount} <span className="text-sm font-semibold text-blue-700">of {totalDueTodayFollowUpCount}</span>
                </p>
                <p className="mt-1 text-xs text-blue-800">Today and overdue activity counts are visible under current scope.</p>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Overdue</p>
                <p className="mt-1 text-2xl font-bold text-blue-950">
                  {visibleOverdueFollowUpCount} <span className="text-sm font-semibold text-blue-700">of {totalOverdueFollowUpCount}</span>
                </p>
                <p className="mt-1 text-xs text-blue-800">Visible overdue follow-ups</p>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Funnel</p>
                <p className="mt-1 text-sm font-bold text-blue-950">Live counts in Funnel tab</p>
                <p className="mt-1 text-xs text-blue-800">
                  Funnel opportunities and opportunity activities inherit related company coverage. Open Funnel for live visible/total counts.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 rounded-xl bg-white p-3 text-sm text-blue-950 ring-1 ring-blue-100 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-bold">Sales Coverage Diagnostics</p>
                <p className="mt-1 text-xs text-blue-800">
                  Review company assignment health when role visibility is active. Open details to use company-level links.
                </p>
                <p className="mt-1 text-xs font-semibold text-blue-900">
                  Unassigned: {unassignedSalespersonCompanyCount}  - Inactive/Missing: {inactiveCoverageCompanyCount}  - Current User Coverage: {currentUserAssignedCompanyCount}
                </p>
                <p className="mt-1 text-xs font-semibold text-blue-900">
                  Coverage Status:{" "}
                  <span
                    className={
                      unassignedSalespersonCompanyCount + inactiveCoverageCompanyCount === 0
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800"
                        : "rounded-full bg-amber-100 px-2 py-0.5 text-amber-800"
                    }
                  >
                    {unassignedSalespersonCompanyCount + inactiveCoverageCompanyCount === 0
                      ? "All Clear"
                      : "Needs Review"}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSalesCoverageDiagnostics(!showSalesCoverageDiagnostics)}
                className="w-fit rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800"
                aria-expanded={showSalesCoverageDiagnostics}
                aria-label="Toggle Sales Coverage Diagnostics Details"
              >
                {showSalesCoverageDiagnostics ? "Hide Details" : "Show Details"}
              </button>
            </div>

            {showSalesCoverageDiagnostics && (
            <div data-testid="sales-coverage-diagnostics-grid" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                    Coverage Detail
                  </p>
                  <h3 className="mt-1 text-base font-bold text-amber-950">
                    Assignment health and company-level follow-up
                  </h3>
                  <p className="mt-1 text-xs text-amber-800">
                    These diagnostics help identify records that may disappear for Sales Reps because company sales coverage is missing or stale.
                    Click a company name below to open Company Detail.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Assigned Rep Coverage</p>
                  <p className="mt-1 text-2xl font-bold">
                    {assignedSalespersonCompanyCount} <span className="text-sm font-semibold text-amber-700">of {totalCompanyCount}</span>
                  </p>
                  <p className="mt-1 text-xs text-amber-800">Companies with a Salesperson / Rep</p>
                </div>

                <div className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Unassigned</p>
                  <p className="mt-1 text-2xl font-bold">
                    {unassignedSalespersonCompanyCount}
                  </p>
                  <p className="mt-1 text-xs text-amber-800">Companies without Salesperson / Rep coverage</p>
                </div>

                <div className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Current User Coverage</p>
                  <p className="mt-1 text-2xl font-bold">
                    {currentUserAssignedCompanyCount}
                  </p>
                  <p className="mt-1 text-xs text-amber-800">Companies assigned to the selected user as Rep or Manager</p>
                </div>

                <div className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Inactive / Missing User Assignments</p>
                  <p className="mt-1 text-2xl font-bold">
                    {inactiveCoverageCompanyCount}
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    {inactiveCoverageCompanyCount > 0
                      ? `Review inactive or missing coverage: ${inactiveCoverageUserDisplayNames}`
                      : "No inactive or missing-user company assignments detected."}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-white p-3 text-xs text-amber-900 ring-1 ring-amber-100">
                <p className="font-bold text-amber-950">How to fix coverage issues</p>
                <p className="mt-1">
                  Click a company name to open Company Detail, then update Sales Coverage in the company record.
                  This keeps assignment changes inside the existing permission-controlled workflow.
                </p>
              </div>

              <div className="mt-4 rounded-xl bg-white p-3 text-xs text-amber-900 ring-1 ring-amber-100">
                <label className="font-bold text-amber-950" htmlFor="diagnostics-company-search">
                  Search diagnostic company lists
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="diagnostics-company-search"
                    data-testid="sales-coverage-diagnostics-search"
                    type="search"
                    value={diagnosticsCompanySearch}
                    onChange={(event) => setDiagnosticsCompanySearch(event.target.value)}
                    placeholder="Type a company name..."
                    className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  {diagnosticsCompanySearch && (
                    <button
                      type="button"
                      onClick={() => setDiagnosticsCompanySearch("")}
                      className="w-fit rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {diagnosticsCompanySearchTerm && (
                  <p className="mt-2 text-[11px] font-semibold text-amber-800">
                    Filtering visible diagnostic lists by company name.
                  </p>
                )}
              </div>

              <div data-testid="sales-coverage-diagnostics-drilldown" className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Unassigned Companies</p>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      {unassignedSalespersonCompanyCount}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-amber-800">Fix in Company Detail ? Sales Coverage</p>
                  <p className="mt-1 text-[11px] text-amber-700">
                    Showing {filteredUnassignedSalespersonCompanySamples.length} of {unassignedSalespersonCompanyCount}
                  </p>
                  {filteredUnassignedSalespersonCompanySamples.length === 0 ? (
                    <p className="mt-2 text-xs text-amber-800">
                      {diagnosticsCompanySearchTerm && unassignedSalespersonCompanyCount > 0
                        ? "No unassigned companies match this search."
                        : "No unassigned companies detected."}
                    </p>
                  ) : (
                    <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pr-2 pl-4 text-xs text-amber-900">
                      {filteredUnassignedSalespersonCompanySamples.map((company) => (
                        <li key={`unassigned-${company.id}`}>
                          <button
                            type="button"
                            onClick={() => loadCompanyDetail(company.id)}
                            className="inline-flex items-center gap-1 rounded-md px-1 text-left font-semibold text-blue-800 underline decoration-blue-300 underline-offset-2 hover:bg-blue-50 hover:text-blue-950"
                          >
                            <span>{company.name}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Open ?</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Current User Coverage</p>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      {currentUserAssignedCompanyCount}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-amber-800">Open Company Detail to review coverage</p>
                  <p className="mt-1 text-[11px] text-amber-700">
                    Showing {filteredCurrentUserCoverageCompanySamples.length} of {currentUserAssignedCompanyCount}
                  </p>
                  {filteredCurrentUserCoverageCompanySamples.length === 0 ? (
                    <p className="mt-2 text-xs text-amber-800">
                      {diagnosticsCompanySearchTerm && currentUserAssignedCompanyCount > 0
                        ? "No assigned companies match this search."
                        : "No companies assigned to the selected user."}
                    </p>
                  ) : (
                    <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pr-2 pl-4 text-xs text-amber-900">
                      {filteredCurrentUserCoverageCompanySamples.map((company) => (
                        <li key={`current-user-${company.id}`}>
                          <button
                            type="button"
                            onClick={() => loadCompanyDetail(company.id)}
                            className="inline-flex items-center gap-1 rounded-md px-1 text-left font-semibold text-blue-800 underline decoration-blue-300 underline-offset-2 hover:bg-blue-50 hover:text-blue-950"
                          >
                            <span>{company.name}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Open ?</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Inactive / Missing Coverage</p>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      {inactiveCoverageCompanyCount}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-amber-800">Fix stale assignments in Company Detail</p>
                  <p className="mt-1 text-[11px] text-amber-700">
                    Showing {filteredInactiveCoverageCompanySamples.length} of {inactiveCoverageCompanyCount}
                  </p>
                  {filteredInactiveCoverageCompanySamples.length === 0 ? (
                    <p className="mt-2 text-xs text-amber-800">
                      {diagnosticsCompanySearchTerm && inactiveCoverageCompanyCount > 0
                        ? "No inactive or missing coverage records match this search."
                        : "No inactive or missing coverage detected."}
                    </p>
                  ) : (
                    <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pr-2 pl-4 text-xs text-amber-900">
                      {filteredInactiveCoverageCompanySamples.map((company) => (
                        <li key={`inactive-missing-${company.id}`}>
                          <button
                            type="button"
                            onClick={() => loadCompanyDetail(company.id)}
                            className="inline-flex items-center gap-1 rounded-md px-1 text-left font-semibold text-blue-800 underline decoration-blue-300 underline-offset-2 hover:bg-blue-50 hover:text-blue-950"
                          >
                            <span>{company.name}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Open ?</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            )}
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
            onOpenCompany={(companyId) => {
              loadCompanyDetail(companyId);
              setActiveTab("companyDetail");

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
            onCompleteActivity={handleCompleteActivity}
            onAnalyzeProspect={handleAnalyzeProspect}
            onBack={returnFromCompanyDetail}
            salesCoverageCanEdit={currentPermissions.canAssignSalesCoverage}
            canMoveOpportunityStages={currentPermissions.canMoveOpportunityStages}
/>  
        )}        {activeTab === "admin" && (
          <section className="grid max-w-full gap-6 overflow-hidden">
            <UserRolePermissionsReference />
            <AdminUsersSection />
            <AdminFunnelStagesSection
              canManageFunnelStages={currentPermissions.canManageFunnelStages}
              apiPermissionHeaders={apiPermissionHeaders}
            />
            <AdminTagsSection />
          </section>
        )}



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
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
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

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">{editingStageId ? "Edit Stage" : "Create Stage"}</h3>

        <div className="mt-5 grid gap-4 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Stage Name</label>
            <input
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
                    >Edit User</button>

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

function RoleTestingPanel({
  currentUserRole,
  currentUserId,
  currentUserDisplayName,
  currentCoverageType,
  applyRoleVisibility,
  setApplyRoleVisibility,
  roleVisibilityNeedsUser,
  roleTotalCompanyCount,
  roleVisibleCompanyCount,
  roleAssignedCompanyCount,
  roleUnassignedCompanyCount,
  roleTestUsers,
  isLoadingRoleUsers,
  roleUserError,
  onSelectUser,
  setCurrentUserRole,
  permissions,
}: {
  currentUserRole: AppUserRole;
  currentUserId: string;
  currentUserDisplayName: string;
  currentCoverageType: string;
  applyRoleVisibility: boolean;
  setApplyRoleVisibility: (value: boolean) => void;
  roleVisibilityNeedsUser: boolean;
  roleTotalCompanyCount: number;
  roleVisibleCompanyCount: number;
  roleAssignedCompanyCount: number;
  roleUnassignedCompanyCount: number;
  roleTestUsers: CrmUser[];
  isLoadingRoleUsers: boolean;
  roleUserError: string;
  onSelectUser: (userId: string) => void;
  setCurrentUserRole: (role: AppUserRole) => void;
  permissions: AppPermissions;
}) {

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Role Testing Mode
          </p>
          <h3 className="mt-1 text-lg font-bold">
            Current Role: {formatAppUserRole(currentUserRole)}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            UI-only permission testing. API-level enforcement will come in a later revision.
          </p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-bold text-slate-900">Controlled test status</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <p>
                Selected user: <span className="font-semibold">{currentUserDisplayName}</span>
              </p>
              <p>
                Role: <span className="font-semibold">{formatAppUserRole(currentUserRole)}</span>
              </p>
              <p>
                Coverage: <span className="font-semibold">{formatCoverageType(currentCoverageType)}</span>
              </p>
              <p>
                Visibility switch:{" "}
                <span className={applyRoleVisibility ? "font-semibold text-green-700" : "font-semibold text-slate-700"}>
                  {applyRoleVisibility ? "ON" : "OFF"}
                </span>
              </p>
              <p>
                Total companies: <span className="font-semibold">{roleTotalCompanyCount}</span>
              </p>
              <p>
                Visible companies: <span className="font-semibold">{roleVisibleCompanyCount}</span>
              </p>
              <p>
                {currentUserRole === "sales_manager"
                  ? "Companies assigned to this manager"
                  : currentUserRole === "sales_rep"
                    ? "Companies assigned to this rep"
                    : "Companies assigned to selected user"}
                : <span className="font-semibold">{roleAssignedCompanyCount}</span>
              </p>
              <p>
                Unassigned companies: <span className="font-semibold">{roleUnassignedCompanyCount}</span>
              </p>
            </div>

            {currentUserRole === "sales_manager" && (
              <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs font-semibold leading-5 text-blue-900">
                Sales Manager view is intentionally broad: managers see all companies and contacts so they can assign and rebalance sales coverage.
              </p>
            )}

            {currentUserRole === "sales_rep" && (
              <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-2 text-xs font-semibold leading-5 text-green-900">
                Sales Rep view is scoped: reps see companies assigned to them as Salesperson / Rep, with related contacts, funnel, and activities.
              </p>
            )}

            <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-600">
              <li>Keep Apply Role Visibility OFF while selecting and checking test users.</li>
              <li>Use a Sales Manager to confirm broad assignment-management visibility.</li>
              <li>Use a Sales Rep with known company assignments to confirm scoped rep visibility.</li>
              <li>Turn Apply Role Visibility ON only long enough to compare visible Companies, Contacts, Funnel, and Activities.</li>
              <li>Return Apply Role Visibility to OFF after testing.</li>
            </ol>
          </div>
        </div>

        <div className="w-full max-w-xs">
          <label className="text-sm font-semibold text-slate-700">Test as CRM User</label>
          <select
            value={currentUserId}
            onChange={(event) => onSelectUser(event.target.value)}
            className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Manual Role Test</option>
            {roleTestUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.display_name || user.email || user.id}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            {isLoadingRoleUsers
              ? "Loading users..."
              : `Current user: ${currentUserDisplayName}  - ${formatCoverageType(currentCoverageType)}`}
          </p>
          {roleUserError && (
            <p className="mt-2 text-xs font-semibold text-red-700">{roleUserError}</p>
          )}
        </div>

        <div className="w-full max-w-xs">
          <label className="text-sm font-semibold text-slate-700">Test as Role</label>
          <select
            value={currentUserRole}
            onChange={(event) => setCurrentUserRole(event.target.value as AppUserRole)}
            className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="admin">Admin</option>
            <option value="sales_manager">Sales Manager</option>
            <option value="sales_rep">Sales Rep</option>
          </select>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Record Visibility Rules</p>
        <div className="mt-3 grid gap-3 text-xs leading-5 text-slate-600 lg:grid-cols-3">
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <p className="font-bold text-slate-900">Admin</p>
            <p className="mt-1">
              Can view all companies, contacts, opportunities, activities, documents, import history,
              sales assignments, user administration, and admin settings.
            </p>
          </div>

          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <p className="font-bold text-slate-900">Sales Manager</p>
            <p className="mt-1">
              Can view all companies, contacts, opportunities, and activities so they can manage team coverage,
              assign Sales Manager / Sales Rep coverage, and rebalance accounts. Cannot manage admin settings or users.
            </p>
          </div>

          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <p className="font-bold text-slate-900">Sales Rep</p>
            <p className="mt-1">
              Can view only companies assigned to them as Salesperson / Rep, plus related contacts,
              opportunities, activities, notes, and documents. Can create and update opportunities,
              move opportunity stages, and mark opportunities won or lost within their assigned accounts.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-blue-200 bg-white p-3">
          <label className="flex items-start gap-3 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={applyRoleVisibility}
              onChange={(event) => setApplyRoleVisibility(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
            />
            <span>
              Apply Role Visibility
              <span className="mt-1 block text-xs font-normal leading-5 text-slate-600">
                When enabled, the UI applies the selected CRM user's visibility scope.
                Admins and Sales Managers see all records. Sales Reps see records tied to companies where they are assigned as Salesperson / Rep. Sales Reps see companies
                where they are assigned as Salesperson / Rep. Contacts, Funnel, and Activities inherit related company visibility.
              </span>
            </span>
          </label>

          {roleVisibilityNeedsUser && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-semibold text-amber-800">
              Select a CRM user to apply Sales Manager or Sales Rep visibility. No company records are hidden until a user is selected.
            </p>
          )}

          {applyRoleVisibility && !roleVisibilityNeedsUser && (
            <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-2 text-xs font-semibold text-green-800">
              Role visibility is active for Companies, Contacts, Funnel, and Activities.
            </p>
          )}
        </div>

        <p className="mt-3 text-xs font-semibold text-amber-700">
          Role visibility filters Companies, Contacts, Funnel opportunities, and Activities for Sales Reps. Admins and Sales Managers currently see all records.
        </p>

        <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-green-700">Production Role Visibility Review</p>
          <h4 className="mt-2 text-lg font-bold text-green-950">Role model checkpoint</h4>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl bg-white p-3 ring-1 ring-green-100">
              <p className="text-sm font-bold text-green-950">Admin</p>
              <p className="mt-1 text-xs leading-5 text-green-900">
                Sees all CRM records and can manage users, imports, workflow settings, assignments, and admin configuration.
              </p>
            </div>

            <div className="rounded-xl bg-white p-3 ring-1 ring-green-100">
              <p className="text-sm font-bold text-green-950">Sales Manager</p>
              <p className="mt-1 text-xs leading-5 text-green-900">
                Sees all companies, contacts, funnel records, and activities for oversight and coverage management, without user/admin settings.
              </p>
            </div>

            <div className="rounded-xl bg-white p-3 ring-1 ring-green-100">
              <p className="text-sm font-bold text-green-950">Sales Rep</p>
              <p className="mt-1 text-xs leading-5 text-green-900">
                Sees companies assigned as Salesperson / Rep; contacts, funnel opportunities, and activities inherit company visibility.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-white p-3 text-xs leading-5 text-green-900 ring-1 ring-green-100">
            <p className="font-bold text-green-950">Production validation checklist</p>
            <p className="mt-1">
              Confirm Admin broad visibility, Sales Manager broad visibility, Sales Rep scoped visibility, coverage filters, work queue shortcuts, and assignment badges before treating the role model as stable.
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-green-200 bg-white p-3 text-xs leading-5 text-green-900 ring-1 ring-green-100">
            <p className="font-bold text-green-950">Role visibility test pass notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Admin pass: sees all companies, contacts, funnel records, and activities; Admin tab remains available.</li>
              <li>Sales Manager pass: sees all companies, contacts, funnel records, and activities; Admin user management remains unavailable.</li>
              <li>Sales Rep pass: sees only companies assigned as Salesperson / Rep, with related contacts, funnel records, and activities.</li>
              <li>Coverage pass: KPI cards, assignment flags, work queue shortcuts, and coverage filters align with visible company records.</li>
              <li>Cleanup pass: Apply Role Visibility is returned to OFF after testing.</li>
            </ul>
          </div>

          <div className="mt-4 rounded-xl border border-blue-200 bg-white p-3 text-xs leading-5 text-blue-900 ring-1 ring-blue-100">
            <p className="font-bold text-blue-950">Auth / Role Source Review</p>
            <p className="mt-1">
              Manual role testing should remain only until the app uses the signed-in Supabase user as the source of CRM identity.
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Confirm Supabase auth identifies the signed-in user by email or user id.</li>
              <li>Match the signed-in user to the CRM Users table.</li>
              <li>Use CRM User Role to drive Admin, Sales Manager, and Sales Rep permissions.</li>
              <li>Use CRM User Status so archived users cannot receive new assignment coverage.</li>
              <li>Replace Apply Role Visibility with always-on production role enforcement.</li>
              <li>Remove manual role dropdowns, test user selectors, and temporary role visibility controls after signed-in role enforcement is verified.</li>
            </ol>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 ring-1 ring-amber-100">
            <p className="font-bold text-amber-950">Signed-In User Role Inspection Result</p>
            <p className="mt-1">
              Current finding: Supabase data access is implemented through server/API service-role clients. The app does not yet expose a client-side signed-in Supabase user session for production role enforcement.
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Keep Apply Role Visibility and manual role test controls for QA until real auth is added.</li>
              <li>Add Supabase auth/session detection before removing manual controls.</li>
              <li>Match signed-in user email or auth id to CRM Users.</li>
              <li>Use CRM User Role and Status as the production source for permissions.</li>
              <li>Only then remove manual role dropdowns, test user selectors, and temporary role visibility controls.</li>
            </ol>
          </div>

          <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs leading-5 text-indigo-900 ring-1 ring-indigo-100">
            <p className="font-bold text-indigo-950">Browser Supabase Client Foundation</p>
            <p className="mt-1">
              A browser Supabase client foundation has been added so the app can later detect the signed-in user session and map that user to CRM Users.
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>This revision does not change production permissions.</li>
              <li>Manual role testing remains active for QA.</li>
              <li>The next step is to read the signed-in Supabase session safely on the client.</li>
              <li>After session detection works, the app can match signed-in email or auth id to CRM Users.</li>
              <li>Only after that should Apply Role Visibility and manual test controls be removed.</li>
            </ol>
          </div>

          <SignedInSessionStatusPanel />

          <SupabaseEmailPasswordLoginPanel />

          <SignedInCrmUserMatchPanel />

          <SignedInCrmRolePreviewPanel />

          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs leading-5 text-orange-900 ring-1 ring-orange-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-orange-950">Auth Enforcement Readiness Gate</p>
              <span className="rounded-full bg-orange-100 px-2 py-1 text-[11px] font-bold text-orange-800 ring-1 ring-orange-200">
                Not enforced yet
              </span>
            </div>

            <p className="mt-2">
              Do not remove Apply Role Visibility or manual role controls until each readiness item below is confirmed in production.
            </p>

            <ol className="mt-3 list-decimal space-y-1 pl-5">
              <li>Supabase Email/Password Login successfully signs in manually created Auth users.</li>
              <li>Signed-In Session Status shows Signed in with the expected Supabase Auth email and user id.</li>
              <li>Signed-In CRM User Match shows Matched for the same email in CRM Users.</li>
              <li>Signed-In CRM Role Preview shows Ready for enforcement.</li>
              <li>CRM user status is Active.</li>
              <li>CRM role is recognized as Admin, Sales Manager, or Sales Rep.</li>
              <li>Admin, Sales Manager, and Sales Rep test accounts have each passed role visibility testing.</li>
              <li>System access is blocked until login; unauthenticated users must not be able to enter the CRM shell.</li>
              <li>Backup and restore readiness has been reviewed before irreversible permission cleanup.</li>
            </ol>

            <div className="mt-3 rounded-lg bg-white p-3 ring-1 ring-orange-100">
              <p className="font-bold text-orange-950">System Access Lock Requirement</p>
              <p className="mt-1">
                Before production enforcement is complete, the CRM should require a signed-in Supabase Auth session before showing CRM data, navigation, or workspace controls.
              </p>
            </div>

            <div className="mt-3 rounded-lg bg-white p-3 ring-1 ring-orange-100">
              <p className="font-bold text-orange-950">Next enforcement sequence</p>
              <p className="mt-1">
                First add signed-in CRM role as a selectable test source, then compare it against the manual harness, then remove the harness only after parity is confirmed.
              </p>
            </div>

            <div className="mt-3 rounded-lg bg-white p-3 ring-1 ring-orange-100">
              <p className="font-bold text-orange-950">Backup & Restore Readiness</p>
              <p className="mt-1">
                Before removing the manual role harness or adding restore workflows, the CRM needs a controlled backup plan for core operational data.
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Define which tables must be backed up before production permission cleanup.</li>
                <li>Export companies, contacts, prospects, activities, tags, funnel stages, CRM users, assignments, and intelligence records.</li>
                <li>Separate backup export from restore; export should come first and be safer.</li>
                <li>Require Admin-only access for backup and restore actions.</li>
                <li>Require restore preview, row counts, and confirmation before any restore writes data.</li>
                <li>Prevent accidental overwrite of production data without a dated backup file and explicit confirmation.</li>
                <li>Keep manual database backups in Supabase available as the fallback during early restore testing.</li>
              </ol>
            </div>

            <BackupExportPanel />

            <div className="mt-3 rounded-lg bg-white p-3 ring-1 ring-orange-100">
              <p className="font-bold text-orange-950">Future workflow idea: Outlook email drag-and-drop</p>
              <p className="mt-1">
                Evaluate whether users can drag Outlook emails or saved message files into the CRM to create activities, notes, or follow-up records. This should be scoped after auth enforcement and backup/restore planning.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className={`rounded-full px-2.5 py-1 ${permissions.canManageAdminSettings ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"}`}>
          Admin Settings
        </span>
        <span className={`rounded-full px-2.5 py-1 ${permissions.canImportCsv ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"}`}>
          CSV Import
        </span>
        <span className={`rounded-full px-2.5 py-1 ${permissions.canManageFunnelStages ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"}`}>
          Manage Stage Definitions
        </span>
        <span className={`rounded-full px-2.5 py-1 ${permissions.canMoveOpportunityStages ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"}`}>
          Move Opportunity Stages
        </span>
        <span className={`rounded-full px-2.5 py-1 ${permissions.canAssignSalesCoverage ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"}`}>
          Assign Sales Coverage
        </span>
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
          message: "Signed-in Supabase user session detected. Permissions are not yet driven by this session.",
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
        This panel is informational only. Manual role testing remains active until signed-in CRM user role matching is implemented and verified.
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
          message: "Signed-in Supabase Auth email matches a CRM Users record. This is still informational only.",
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
        This panel is informational only. Production permissions are not yet driven by the signed-in CRM user.
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
              ? "CRM user is active and has a recognized production role. This role is ready for future enforcement."
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
        This panel is a preview only. Production permissions are still controlled by the manual role visibility test harness.
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
        Use this panel to test manually created Supabase Auth users. Production permissions are still controlled by the manual role test controls until CRM user matching is implemented.
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

function AdminUsersSection() {
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [userError, setUserError] = useState("");
  const [editingUserId, setEditingUserId] = useState("");
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

  function requireAdminMode() {
    if (isAdminMode) return true;

    setUserMessage("");
    setUserError("CRM user editing is restricted to Admin Mode. Turn on Admin Mode to create, edit, archive, or reactivate CRM users.");
    return false;
  }

  function startEditingUser(user: CrmUser) {
    if (!requireAdminMode()) return;

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
    if (!requireAdminMode()) return;

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
    if (!requireAdminMode()) return;

    setIsSavingUser(true);
    setUserMessage("");
    setUserError("");

    try {
      const response = await fetch("/api/crm-users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
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

  const ownerControlsDisabled = !isAdminMode || isSavingUser;

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
              Everyone can view CRM users. Creating, editing, archiving, and reactivating CRM users is restricted to Admin Mode until formal login-based permissions are added.
            </p>
          </div>

          <button
            onClick={loadUsers}
            disabled={isLoadingUsers}
            className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {isLoadingUsers ? "Refreshing..." : "Refresh Users"}
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-amber-950">Temporary Admin Mode</p>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                This is a temporary UI gate. Later, true permissions should come from the signed-in user account.
              </p>
            </div>

            <label className="flex w-fit cursor-pointer items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-amber-200">
              <input
                type="checkbox"
                checked={isAdminMode}
                onChange={(event) => {
                  setIsAdminMode(event.target.checked);
                  setUserMessage("");
                  setUserError("");
                  if (!event.target.checked) {
                    resetUserForm();
                  }
                }}
                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              Admin Mode {isAdminMode ? "On" : "Off"}
            </label>
          </div>        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">CRM User Role Guide</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">
              <p className="text-sm font-bold text-blue-950">Admin</p>
              <p className="mt-1 text-xs leading-5 text-blue-900">
                Full CRM access, including users, imports, workflow settings, role testing, and sales coverage assignment.
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

        {(userMessage || userError) && (
          <div className="mt-4 grid gap-2">
            {userMessage && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                {userMessage}
              </div>
            )}
            {userError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {userError}
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
            : `scroll-mt-24 rounded-2xl bg-white p-6 shadow-sm ${!isAdminMode ? "opacity-75" : ""}`
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
            {!isAdminMode && (
              <p className="mt-2 text-sm text-slate-600">
                Turn on Admin Mode to create or edit CRM users.
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
              disabled={!isAdminMode}
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
              disabled={!isAdminMode}
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
              disabled={!isAdminMode}
              onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">User Role</label>
            <select
              value={form.userRole}
              disabled={!isAdminMode}
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
              disabled={!isAdminMode}
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
              disabled={!isAdminMode}
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
              disabled={!isAdminMode}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Phone</label>
            <input
              type="text"
              value={form.phone}
              disabled={!isAdminMode}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          <div className="lg:col-span-5">
            <label className="text-sm font-semibold text-slate-700">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              disabled={!isAdminMode}
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
              disabled={!isAdminMode}
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
            {users.map((user) => (
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
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AdminTagsSection() {
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
                      >Edit User</button>

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
}: {
  onOpenCompany: (companyId: string) => void;
  opportunityActivityRoleVisibilityActive?: boolean;
  opportunityActivityCurrentUserId?: string | null;
  opportunityActivityCurrentUserRole?: AppUserRole;
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

  const today = new Date().toISOString().slice(0, 10);

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

function FunnelDashboardSection({
  onOpenCompany,
  funnelApplyRoleVisibility = false,
  funnelCurrentUserId = "",
  funnelCurrentUserRole = "admin",
  funnelCurrentUserDisplayName = "Manual Role Test",
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

  async function loadFunnelDashboard() {
    setIsLoading(true);
    setFunnelError("");

    try {
      const [stagesResponse, opportunitiesResponse] = await Promise.all([
        fetch("/api/funnel-stages"),
        fetch(`/api/sales-opportunities?status=${statusFilter}`),
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

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">Funnel Filters</h3>

        <div className="mt-5 grid gap-4 lg:grid-cols-5">
<div>
            <label className="text-sm font-semibold text-slate-700">Status</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
              className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
              className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
              className="mt-2 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="lg:col-span-5 flex justify-start">
            <button
              onClick={clearFunnelFilters}
              className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
            >
              Clear Funnel Filters
            </button>
          </div>
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

      <OpportunityActivitiesDashboard onOpenCompany={onOpenCompany}
          opportunityActivityRoleVisibilityActive={funnelApplyRoleVisibility}
          opportunityActivityCurrentUserId={funnelCurrentUserId}
          opportunityActivityCurrentUserRole={funnelCurrentUserRole} />

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-xl font-bold">Opportunities</h3>
            <p className="mt-2 text-sm text-slate-600">
              Showing {visibleFunnelOpportunityCount} of {totalFunnelOpportunityCount} opportunities under the current filters and role visibility scope.
            </p>
          </div>
        </div>

        {displayedFunnelOpportunities.length === 0 ? (
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
                        {displayValue(opportunity.next_step)}
                      </td>
                      <td className="py-3 pr-4">
                        {companyId ? (
                          <button
                            onClick={() => onOpenCompany(String(companyId))}
                            className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800"
                          >
                            Open Company
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">No company</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function ReleaseNotesSection() {
  const releases = [
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

function CompaniesSection({
  companies,
  totalCompanyCount,
  unfilteredCompanyCount = totalCompanyCount,
  roleVisibilityActive = false,
  roleVisibilityNeedsUser = false,
  currentUserDisplayName = "Manual Role Test",
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

  const coverageFiltersAreActive =
    companySalespersonFilter !== "All" ||
    companySalesManagerFilter !== "All" ||
    companyAssignmentStatusFilter !== "All";

  function clearCoverageFilters() {
    setCompanySalespersonFilter("All");
    setCompanySalesManagerFilter("All");
    setCompanyAssignmentStatusFilter("All");
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

            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900 lg:col-span-2 xl:col-span-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p>
                  <span className="font-semibold">Coverage filters:</span> Salesperson / Rep identifies direct account coverage. Sales Manager identifies oversight coverage. Assignment Status helps find coverage gaps such as missing rep assignment, missing manager assignment, or fully assigned accounts.
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
  clearContactFilters: () => void;
}) {

  return (
    <section className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-bold">Contact Search and Tag Filters</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Filter contacts by name, company, title, function, email, or assigned Market / Sector / Category tags.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-5">
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

        <div className="lg:col-span-5 flex justify-start">
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
  onCompleteActivity,
  onAnalyzeProspect,
  onBack,
  salesCoverageCanEdit = true,
  canMoveOpportunityStages = true,
}: {
  detail: CompanyDetail | null;
  activityForm: ActivityForm;
  setActivityForm: (form: ActivityForm) => void;
  isSavingActivity: boolean;
  isCompletingActivity: string;
  isAnalyzingProspect: boolean;
  onSaveActivity: () => void;
  onCompleteActivity: (activityId: string, companyId?: string | null) => void;
  onAnalyzeProspect: () => void;
  onBack: () => void;
  salesCoverageCanEdit?: boolean;
  canMoveOpportunityStages?: boolean;
}) {
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

  const company = detail.company;
  const primaryProspect = detail.primaryProspect;
  const intelligence = detail.intelligence;
  const hasAiAnalysis = hasMeaningfulAnalysis(intelligence);

  const discoveryQuestions = hasAiAnalysis
    ? parseJsonArray(intelligence?.discovery_questions)
    : [];
  const recommendedProductPaths = hasAiAnalysis
    ? parseJsonArray(intelligence?.recommended_product_paths)
    : [];
  const likelyObjections = hasAiAnalysis
    ? parseJsonArray(intelligence?.likely_objections)
    : [];

  return (
    <section className="grid gap-6">
      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
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

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Company Detail
            </p>
            <h2 className="mt-2 text-3xl font-bold">{displayValue(company.company_name)}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {displayValue(company.industry)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
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
      </div>

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
      </div>      <CompanyIndustryEnrichmentPanel company={detail.company} />

      <CompanySalesAssignmentPanel
        companyId={String(detail.company.id)}
        canEditSalesCoverage={salesCoverageCanEdit}
      />

      <CompanyTagManager companyId={String(detail.company.id)} />

      <CompanyOpportunityPanel
        canMoveOpportunityStages={canMoveOpportunityStages}
        companyId={String(detail.company.id)}
        companyName={displayValue(detail.company.company_name)}
        contacts={detail.contacts}
        prospects={detail.prospects}
        primaryProspect={detail.primaryProspect}
      />



      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">Add Activity / Follow-Up</h3>
        <p className="mt-2 text-sm text-slate-600">
          Save notes, calls, emails, meetings, tasks, and quote follow-ups directly to this company record.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-4">
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
          </div>

          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Subject</label>
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
            <label className="text-sm font-semibold text-slate-700">Notes</label>
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

        <div className="mt-4 flex justify-start">
          <button
            onClick={onSaveActivity}
            disabled={isSavingActivity}
            className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSavingActivity ? "Saving..." : "Save Activity"}
          </button>
        </div>
      </div>

      <div className="max-w-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">Activity History</h3>

        {detail.activities.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No activities saved yet.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {detail.activities.map((activity: any) => (
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
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          Open
                        </span>
                      )}
                    </div>

                    <p className="mt-3 font-semibold">{activity.subject || "No subject"}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {activity.notes || "No notes"}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 text-sm text-slate-500 md:items-end md:text-right">
                    <p>Created: {formatDate(activity.created_at)}</p>
                    <p>Due: {formatDate(activity.due_date)}</p>
                    {activity.completed_at && <p>Completed: {formatDate(activity.completed_at)}</p>}
                    {!activity.completed_at && (
                      <button
                        onClick={() => onCompleteActivity(activity.id, activity.company_id)}
                        disabled={isCompletingActivity === activity.id}
                        className="mt-2 rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {isCompletingActivity === activity.id ? "Completing..." : "Complete"}
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
        <h3 className="text-xl font-bold">Contacts</h3>

        {detail.contacts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No contacts attached.</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {detail.contacts.map((contact: any) => (
              <div key={String(contact.id)} className="rounded-xl border border-slate-200 p-4">
                <p className="font-semibold">{displayValue(contact.full_name)}</p>
                <p className="mt-1 text-sm text-slate-600">{displayValue(contact.title)}</p>
                <div className="mt-3 grid gap-1 text-sm text-slate-700">
                  <p>Email: {displayValue(contact.email)}</p>
                  <p>Direct: {displayValue(contact.direct_phone)}</p>
                  <p>Mobile: {displayValue(contact.mobile_phone)}</p>
                  <p>Function: {displayValue(contact.function_area || contact.department)}</p>
                </div>

                <ContactTagManager contactId={String(contact.id)} />
              </div>
            ))}
          </div>
        )}
      </div>

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
}: {
  companyId: string;
  canEditSalesCoverage?: boolean;
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
}: {
  opportunityId: string;
  companyId: string;
  contactId: string | null;
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
}: {
  opportunityId: string;
  companyId: string;
  contactId: string | null;
}) {
  const [activities, setActivities] = useState<SalesOpportunityActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [activityMessage, setActivityMessage] = useState("");
  const [activityError, setActivityError] = useState("");
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [form, setForm] = useState({
    activityType: "note",
    subject: "",
    notes: "",
    dueDate: "",
  });

  async function loadOpportunityActivities() {
    setIsLoadingActivities(true);
    setActivityError("");

    try {
      const response = await fetch(
        `/api/sales-opportunity-activities?opportunityId=${opportunityId}`
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

  async function saveOpportunityActivity() {
    setIsSavingActivity(true);
    setActivityMessage("");
    setActivityError("");

    try {
      if (!form.subject.trim() && !form.notes.trim()) {
        throw new Error("Enter a subject or note before saving.");
      }

      const response = await fetch("/api/sales-opportunity-activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          opportunityId,
          companyId,
          contactId,
          activityType: form.activityType,
          subject: form.subject,
          notes: form.notes,
          dueDate: form.dueDate || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save opportunity activity.");
      }

      setActivityMessage("Opportunity activity saved.");
      setForm({
        activityType: "note",
        subject: "",
        notes: "",
        dueDate: "",
      });
      setShowActivityForm(false);
      await loadOpportunityActivities();
    } catch (error) {
      setActivityError(
        error instanceof Error ? error.message : "Could not save opportunity activity."
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
            onClick={() => setShowActivityForm((current) => !current)}
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
              {isSavingActivity ? "Saving..." : "Save Activity"}
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

                    <p className="mt-2 text-xs text-slate-500">
                      Created {formatDate(activity.created_at)}
                    </p>
                  </div>

                  {!activity.completed_at && (
                    <button
                      onClick={() => completeOpportunityActivity(activity.id)}
                      disabled={isSavingActivity}
                      className="w-fit rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Complete
                    </button>
                  )}
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
}: {
  companyId: string;
  companyName: string;
  contacts: Record<string, string | boolean | null>[];
  prospects: Record<string, string | number | null>[];
  primaryProspect: Record<string, string | number | null> | null;
  canMoveOpportunityStages?: boolean;
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
    productLine: "",
    likelyProductPath: "",
    primaryUseCase: "",
    estimatedValue: "",
    probability: "",
    expectedCloseDate: "",
    nextStep: "",
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
    contactId: "",
    prospectId: "",
    stageId: "",
    productLine: "",
    likelyProductPath: "",
    primaryUseCase: "",
    estimatedValue: "",
    probability: "",
    expectedCloseDate: "",
    nextStep: "",
    customerNeed: "",
    businessCase: "",
    owner: "",
  });

  async function loadOpportunityData() {
    setIsLoading(true);
    setOpportunityError("");

    try {
      const [stagesResponse, opportunitiesResponse] = await Promise.all([
        fetch("/api/funnel-stages"),
        fetch(`/api/sales-opportunities?companyId=${companyId}`),
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

      const response = await fetch("/api/sales-opportunities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          contactId: form.contactId || null,
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
        contactId: "",
        prospectId: "",
        stageId: "",
        productLine: "",
        likelyProductPath: "",
        primaryUseCase: "",
        estimatedValue: "",
        probability: "",
        expectedCloseDate: "",
        nextStep: "",
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
      productLine: "",
      likelyProductPath: "",
      primaryUseCase: "",
      estimatedValue: "",
      probability: "",
      expectedCloseDate: "",
      nextStep: "",
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

      const response = await fetch("/api/sales-opportunities", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingOpportunityId,
          opportunityName: editForm.opportunityName,
          opportunityType: editForm.opportunityType,
          productLine: editForm.productLine,
          likelyProductPath: editForm.likelyProductPath,
          primaryUseCase: editForm.primaryUseCase,
          estimatedValue: editForm.estimatedValue,
          probability: editForm.probability,
          expectedCloseDate: editForm.expectedCloseDate || null,
          nextStep: editForm.nextStep,
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

            <div>
              <label className="text-sm font-semibold text-slate-700">Contact</label>
              <select
                value={form.contactId}
                onChange={(event) => setForm({ ...form, contactId: event.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="">No contact selected</option>
                {contacts.map((contact: any) => (
                  <option key={String(contact.id)} value={String(contact.id)}>
                    {displayValue(contact.full_name || contact.email)}
                  </option>
                ))}
              </select>
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
              <label className="text-sm font-semibold text-slate-700">Next Step</label>
              <textarea
                rows={3}
                value={form.nextStep}
                onChange={(event) => setForm({ ...form, nextStep: event.target.value })}
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
                        <span className="font-semibold">Contact:</span>{" "}
                        {displayValue(opportunity.contacts?.full_name)}
                      </p>
                      <p>
                        <span className="font-semibold">Source:</span>{" "}
                        {displayValue(opportunity.source)}
                      </p>
                    </div>

                    {opportunity.next_step && (
                      <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                        <span className="font-semibold">Next step:</span> {opportunity.next_step}
                      </div>
                    )}
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
                            <label className="text-sm font-semibold text-slate-700">Next Step</label>
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
                    <OpportunityDocumentsPanel
                      opportunityId={opportunity.id}
                      companyId={companyId}
                      contactId={opportunity.contact_id}
                    />


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
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CompanyTagManager({ companyId }: { companyId: string }) {
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
                onClick={() => onRemoveTag(tag.tag_id)}
                disabled={isSavingTag}
                className="rounded-full px-1 text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:text-slate-400"
                aria-label={`Remove ${tag.crm_tags?.tag_name || "tag"}`}
              >

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


function ContactTagManager({ contactId }: { contactId: string }) {
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
                onClick={() => onRemoveTag(tag.tag_id)}
                disabled={isSavingTag}
                className="rounded-full px-1 text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:text-slate-400"
                aria-label={`Remove ${tag.crm_tags?.tag_name || "tag"}`}
              >

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
















































































































































































































































































