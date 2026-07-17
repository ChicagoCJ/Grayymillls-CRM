import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { enforceApiPermission } from "../_shared/permissions";
import { verifySignedInAdmin } from "../_shared/verified-auth";

type ImportPayload = {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  mapping: Record<string, string>;
  assignedSalespersonId?: string | null;
  assignedSalesManagerId?: string | null;
  selectedProjectListIds?: string[];
};

type CompanyInsert = {
  company_name: string;
  website: string | null;
  domain: string | null;
  industry: string | null;
  naics: string | null;
  sic: string | null;
  employee_count: number | null;
  revenue: string | null;
  company_phone: string | null;
  company_fax: string | null;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  company_type: string | null;
  source: string;
  status: string;
};

type ContactInsert = {
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
  person_city: string | null;
  person_state: string | null;
  person_country: string | null;
  linkedin_url: string | null;
  is_primary: boolean;
  buying_role_hypothesis: string | null;
  source: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalizeImportTagIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    )
  );
}

async function applyImportSalesAssignmentsToCompany(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyId: string,
  assignedSalespersonId?: string,
  assignedSalesManagerId?: string
) {
  const update: Record<string, string | null> = {};

  if (typeof assignedSalespersonId === "string" && assignedSalespersonId.trim().length > 0) {
    update.assigned_salesperson_id = assignedSalespersonId.trim();
  }

  if (typeof assignedSalesManagerId === "string" && assignedSalesManagerId.trim().length > 0) {
    update.assigned_sales_manager_id = assignedSalesManagerId.trim();
  }

  if (Object.keys(update).length === 0) {
    return;
  }

  update.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("companies")
    .update(update)
    .eq("id", companyId);

  if (error) throw error;
}
async function applyImportTagsToCompany(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyId: string,
  tagIds: string[]
) {
  if (tagIds.length === 0) return 0;

  const rows = tagIds.map((tagId) => ({
    company_id: companyId,
    tag_id: tagId,
  }));

  const { error } = await supabase
    .from("company_tags")
    .upsert(rows, { onConflict: "company_id,tag_id" });

  if (error) throw error;

  return rows.length;
}

async function applyImportTagsToContact(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  contactId: string,
  tagIds: string[]
) {
  if (tagIds.length === 0) return 0;

  const rows = tagIds.map((tagId) => ({
    contact_id: contactId,
    tag_id: tagId,
  }));

  const { error } = await supabase
    .from("contact_tags")
    .upsert(rows, { onConflict: "contact_id,tag_id" });

  if (error) throw error;

  return rows.length;
}
function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();

  if (!cleaned) return null;
  if (cleaned.toLowerCase() === "n/a") return null;
  if (cleaned.toLowerCase() === "null") return null;
  if (cleaned.toLowerCase() === "not provided") return null;

  return cleaned;
}

function preferNewValue(existingValue: unknown, newValue: unknown) {
  const existingText =
    typeof existingValue === "string" ? existingValue.trim() : existingValue ?? null;
  const newText = typeof newValue === "string" ? newValue.trim() : newValue ?? null;

  if (newText === null || newText === undefined || newText === "") {
    return existingText;
  }

  if (existingText === null || existingText === undefined || existingText === "") {
    return newText;
  }

  const existingLength = String(existingText).length;
  const newLength = String(newText).length;

  return newLength > existingLength ? newText : existingText;
}
function excelColumnToIndex(column: string) {
  let index = 0;

  for (const char of column.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }

  return index - 1;
}

function getCsvValueByExcelColumn(
  row: Record<string, string>,
  headers: string[],
  column: string
) {
  const index = excelColumnToIndex(column);
  const header = headers[index];

  if (!header) return null;

  const value = row[header];

  if (typeof value !== "string") return null;

  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function firstNonBlank(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}
function normalizeHeaderName(value: string) {
  return value
    .toLowerCase()
    .replace(/[\uFEFF"]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getValueByHeaderNames(row: Record<string, string>, headerNames: string[]) {
  const wanted = headerNames.map(normalizeHeaderName);

  for (const [key, value] of Object.entries(row)) {
    if (wanted.includes(normalizeHeaderName(key))) {
      const cleaned = typeof value === "string" ? value.trim() : "";
      if (cleaned.length > 0) return cleaned;
    }
  }

  return null;
}

function getMappedValue(
  row: Record<string, string>,
  mapping: Record<string, string>,
  crmField: string
): string | null {
  const csvColumn = mapping[crmField];

  if (!csvColumn || csvColumn === "Not detected") return null;

  return cleanText(row[csvColumn]);
}

function parseInteger(value: string | null): number | null {
  if (!value) return null;

  const cleaned = value.replace(/[^0-9]/g, "");
  if (!cleaned) return null;

  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDomain(website: string | null): string | null {
  if (!website) return null;

  try {
    const withProtocol = website.startsWith("http") ? website : `https://${website}`;
    const url = new URL(withProtocol);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return website
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .toLowerCase()
      .trim();
  }
}

function combineName(firstName: string | null, lastName: string | null, fullName: string | null) {
  if (fullName) return fullName;
  return [firstName, lastName].filter(Boolean).join(" ").trim() || null;
}

function splitFullName(fullName: string | null) {
  if (!fullName) {
    return {
      firstName: null,
      lastName: null,
    };
  }

  const parts = fullName.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: null,
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function getPriorityTier(score: number) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function getFitRating(score: number) {
  if (score >= 85) return "Very High";
  if (score >= 70) return "High";
  if (score >= 55) return "Medium";
  return "Low";
}

function getConfidence(score: number) {
  if (score >= 12) return "High";
  if (score >= 7) return "Medium";
  return "Low";
}

function scoreIndustryFit(industry: string | null, naics: string | null): number {
  const value = `${industry ?? ""} ${naics ?? ""}`.toLowerCase();

  if (
    value.includes("aviation") ||
    value.includes("aerospace") ||
    value.includes("aircraft") ||
    value.includes("mro") ||
    value.includes("maintenance") ||
    value.includes("repair") ||
    value.includes("overhaul")
  ) {
    return 23;
  }

  if (
    value.includes("manufacturing") ||
    value.includes("machine") ||
    value.includes("machining") ||
    value.includes("industrial") ||
    value.includes("transportation")
  ) {
    return 18;
  }

  if (value.includes("distributor") || value.includes("wholesale")) {
    return 12;
  }

  return 8;
}

function scoreCleaningPain(industry: string | null): number {
  const value = `${industry ?? ""}`.toLowerCase();

  if (
    value.includes("aviation") ||
    value.includes("aerospace") ||
    value.includes("aircraft") ||
    value.includes("mro") ||
    value.includes("maintenance") ||
    value.includes("repair") ||
    value.includes("overhaul")
  ) {
    return 22;
  }

  if (
    value.includes("manufacturing") ||
    value.includes("machining") ||
    value.includes("metal") ||
    value.includes("industrial")
  ) {
    return 18;
  }

  return 10;
}

function scoreBuyerRelevance(title: string | null, managementLevel: string | null): number {
  const value = `${title ?? ""} ${managementLevel ?? ""}`.toLowerCase();

  if (
    value.includes("owner") ||
    value.includes("president") ||
    value.includes("chief") ||
    value.includes("coo") ||
    value.includes("vp") ||
    value.includes("vice president")
  ) {
    return 20;
  }

  if (
    value.includes("plant") ||
    value.includes("operations") ||
    value.includes("maintenance") ||
    value.includes("manufacturing") ||
    value.includes("production") ||
    value.includes("quality") ||
    value.includes("engineering") ||
    value.includes("manager") ||
    value.includes("director")
  ) {
    return 17;
  }

  if (
    value.includes("purchasing") ||
    value.includes("procurement") ||
    value.includes("sourcing") ||
    value.includes("buyer")
  ) {
    return 12;
  }

  return 7;
}

function scoreCompanySize(employeeCount: number | null): number {
  if (!employeeCount) return 7;
  if (employeeCount < 10) return 5;
  if (employeeCount < 50) return 10;
  if (employeeCount < 250) return 14;
  return 15;
}

function scoreConfidence(companyName: string, website: string | null, industry: string | null, title: string | null) {
  let score = 3;

  if (companyName) score += 3;
  if (website) score += 3;
  if (industry) score += 3;
  if (title) score += 3;

  return Math.min(score, 15);
}

function inferProductPath(industry: string | null, title: string | null) {
  const value = `${industry ?? ""} ${title ?? ""}`.toLowerCase();

  if (
    value.includes("aviation") ||
    value.includes("aerospace") ||
    value.includes("aircraft") ||
    value.includes("mro") ||
    value.includes("maintenance") ||
    value.includes("repair") ||
    value.includes("overhaul")
  ) {
    return "Tempest high-pressure spray / immersion-agitation / ultrasonic validation";
  }

  if (value.includes("machining") || value.includes("manufacturing") || value.includes("metal")) {
    return "Manual parts washer / immersion-agitation / ultrasonic validation";
  }

  return "Manual parts washer / application discovery";
}

function inferPrimaryUseCase(industry: string | null) {
  const value = `${industry ?? ""}`.toLowerCase();

  if (
    value.includes("aviation") ||
    value.includes("aerospace") ||
    value.includes("aircraft") ||
    value.includes("mro")
  ) {
    return "Aircraft component maintenance, repair, inspection-prep, and rebuild cleaning";
  }

  if (value.includes("manufacturing") || value.includes("machining")) {
    return "Production or maintenance parts cleaning before inspection, assembly, or shipment";
  }

  return "General maintenance or production parts cleaning";
}

function inferLikelySoils(industry: string | null) {
  const value = `${industry ?? ""}`.toLowerCase();

  if (
    value.includes("aviation") ||
    value.includes("aerospace") ||
    value.includes("aircraft") ||
    value.includes("mro")
  ) {
    return "Oil, grease, hydraulic fluid, carbon residue, shop dirt, metal fines, corrosion residue";
  }

  if (value.includes("manufacturing") || value.includes("machining")) {
    return "Oil, coolant, chips, cutting fluid, grease, metal fines, shop dirt";
  }

  return "Oil, grease, dirt, maintenance residue, and process soils";
}

function inferCleaningAction(industry: string | null) {
  const value = `${industry ?? ""}`.toLowerCase();

  if (
    value.includes("aviation") ||
    value.includes("aerospace") ||
    value.includes("aircraft") ||
    value.includes("mro")
  ) {
    return "Validate whether high-pressure spray, immersion/agitation, or ultrasonic cleaning best fits the parts, soils, and inspection requirements.";
  }

  return "Validate current cleaning method, part size, soil load, throughput, and whether manual, immersion, spray, or ultrasonic cleaning is the right path.";
}

function getBuyerPersona(title: string | null, fullName: string | null) {
  const value = `${title ?? ""}`.toLowerCase();
  const nameLabel = fullName || "This contact";

  if (
    value.includes("operations") ||
    value.includes("plant") ||
    value.includes("maintenance") ||
    value.includes("production")
  ) {
    return `${nameLabel} is likely to care about uptime, throughput, cleaning consistency, operator workflow, and whether a washer reduces manual cleaning burden without creating maintenance complexity.`;
  }

  if (value.includes("quality") || value.includes("engineering")) {
    return `${nameLabel} is likely to care about clean parts before inspection, repeatability, part geometry, material compatibility, and avoiding overclaims before the application is validated.`;
  }

  if (value.includes("purchasing") || value.includes("procurement") || value.includes("buyer")) {
    return `${nameLabel} is likely to care about total cost, vendor reliability, lead time, support, and whether the recommended solution has been properly qualified by operations.`;
  }

  if (
    value.includes("owner") ||
    value.includes("president") ||
    value.includes("chief") ||
    value.includes("vp") ||
    value.includes("director")
  ) {
    return `${nameLabel} is likely to evaluate the opportunity through productivity, operating risk, payback, floor-space fit, and whether the recommendation is practical for the business.`;
  }

  return `${nameLabel} may be an influencer or evaluator. The first call should clarify their role in cleaning equipment decisions and identify operations, maintenance, quality, and purchasing stakeholders.`;
}

function buildCopyableSalesBlock(input: {
  companyName: string;
  fullName: string | null;
  title: string | null;
  email: string | null;
  directPhone: string | null;
  mobilePhone: string | null;
  industry: string | null;
  priorityScore: number;
  priorityTier: string;
  productPath: string;
  nextBestAction: string;
}) {
  const contactPieces = [
    input.fullName || "Contact not provided",
    input.title || "title not provided",
    input.email ? `email: ${input.email}` : null,
    input.directPhone ? `direct: ${input.directPhone}` : null,
    input.mobilePhone ? `mobile: ${input.mobilePhone}` : null,
  ].filter(Boolean);

  return `${input.companyName} â€” ${contactPieces.join(", ")}. ${
    input.industry ? `Company is listed in/around ${input.industry}. ` : ""
  }Graymills fit hypothesis: likely parts-cleaning opportunity worth validating through discovery; potential product path is ${input.productPath}. Priority ${input.priorityScore}/100 (${input.priorityTier}). Next best action: ${input.nextBestAction}`;
}

async function updateCompanyIndustryEnrichment(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyId: string,
  enrichment: Record<string, unknown>
) {
  let changed = false;
  const cleanedEntries = Object.entries(enrichment).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string" && value.trim().length === 0) return false;
    return true;
  });

  if (cleanedEntries.length === 0) return false;

  const { data: existingCompany, error: loadError } = await supabase
    .from("companies")
    .select(
      "industry, naics, sic, naics_codes, naics_descriptions, sic_codes, sic_descriptions, primary_industry, primary_sub_industry"
    )
    .eq("id", companyId)
    .single();

  if (loadError) throw loadError;

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  for (const [key, value] of cleanedEntries as [keyof typeof update, (typeof update)[keyof typeof update]][]) {
    const preferredValue = preferNewValue((existingCompany as Partial<typeof update> | null)?.[key], value);
    update[key] = preferredValue;

    const existingValue = (existingCompany as Partial<typeof update> | null)?.[key];
    const existingText =
      existingValue === null || existingValue === undefined ? "" : String(existingValue).trim();
    const preferredText =
      preferredValue === null || preferredValue === undefined ? "" : String(preferredValue).trim();

    if (preferredText.length > 0 && preferredText !== existingText) {
      changed = true;
    }
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update(update)
    .eq("id", companyId);

  if (updateError) throw updateError;

  return changed;
}
async function findOrCreateCompany(supabase: ReturnType<typeof getSupabaseAdmin>, company: CompanyInsert) {
  if (company.domain) {
    const { data: existingByDomain, error } = await supabase
      .from("companies")
      .select("*")
      .eq("domain", company.domain)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (existingByDomain) return existingByDomain;
  }

  if (company.state) {
    const { data: existingByNameState, error } = await supabase
      .from("companies")
      .select("*")
      .ilike("company_name", company.company_name)
      .eq("state", company.state)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (existingByNameState) return existingByNameState;
  }

  const { data: insertedCompany, error: insertError } = await supabase
    .from("companies")
    .insert(company)
    .select("*")
    .single();

  if (insertError) throw insertError;
  return insertedCompany;
}

async function findOrCreateContact(supabase: ReturnType<typeof getSupabaseAdmin>, contact: ContactInsert) {
  if (contact.email) {
    const { data: existingByEmail, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("email", contact.email)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (existingByEmail) return existingByEmail;
  }

  if (contact.full_name) {
    const { data: existingByNameCompany, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("company_id", contact.company_id)
      .ilike("full_name", contact.full_name)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (existingByNameCompany) return existingByNameCompany;
  }

  const { data: insertedContact, error: insertError } = await supabase
    .from("contacts")
    .insert(contact)
    .select("*")
    .single();

  if (insertError) throw insertError;
  return insertedContact;
}

function normalizeProjectListIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    )
  );
}

async function applyProjectListAssignments(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tableName: "company_project_assignments" | "contact_project_assignments",
  recordKey: "company_id" | "contact_id",
  recordId: string,
  projectListIds: string[]
) {
  if (!recordId || projectListIds.length === 0) return 0;

  const rows = projectListIds.map((projectId) => ({
    [recordKey]: recordId,
    project_id: projectId,
  }));

  const conflictTarget =
    recordKey === "company_id"
      ? "project_id,company_id"
      : "project_id,contact_id";

  const { error } = await supabase
    .from(tableName)
    .upsert(rows, { onConflict: conflictTarget });

  if (error) throw error;

  return rows.length;
}

function collectSelectedImportTagIds(payload: any) {
  const ids = [
    ...(Array.isArray(payload.selectedImportTagIds) ? payload.selectedImportTagIds : []),
    ...(Array.isArray(payload.selectedMarketTagIds) ? payload.selectedMarketTagIds : []),
    ...(Array.isArray(payload.selectedSectorTagIds) ? payload.selectedSectorTagIds : []),
    ...(Array.isArray(payload.selectedCategoryTagIds) ? payload.selectedCategoryTagIds : []),
  ];

  return Array.from(
    new Set(
      ids
        .filter((id) => typeof id === "string")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    )
  );
}

export async function POST(request: Request) {
  try {
    const permission = enforceApiPermission(request, "import_csv");
    if (permission.response) return permission.response;

const payload = (await request.json()) as ImportPayload;
    const selectedImportTagIds = collectSelectedImportTagIds(payload);
    const selectedProjectListIds = normalizeProjectListIds(
      payload.selectedProjectListIds
    );

    if (selectedProjectListIds.length > 0) {
      const verification = await verifySignedInAdmin(request);

      if (verification.response) {
        return verification.response;
      }
    }

    if (!payload.fileName || !Array.isArray(payload.rows) || payload.rows.length === 0) {
      return NextResponse.json(
        { error: "Missing file name or CSV rows." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: importRecord, error: importError } = await supabase
      .from("imports")
      .insert({
        file_name: payload.fileName,
        source: "ZoomInfo",
        import_type: "prospecting_csv",
        row_count: payload.rows.length,
        status: "processing",
        column_mapping: payload.mapping,
      })
      .select("*")
      .single();

    if (importError) throw importError;

    let processedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const assignedCompanyIds = new Set<string>();
    let companiesAssigned = 0;
    let projectListCompanyAssignments = 0;
    let projectListContactAssignments = 0;

    for (let index = 0; index < payload.rows.length; index += 1) {
      const row = payload.rows[index];

      try {
        const mappedFullName = getMappedValue(row, payload.mapping, "Full Name");
        const splitName = splitFullName(mappedFullName);

        const firstName =
          getMappedValue(row, payload.mapping, "First Name") ?? splitName.firstName;
        const lastName =
          getMappedValue(row, payload.mapping, "Last Name") ?? splitName.lastName;
        const fullName = combineName(firstName, lastName, mappedFullName);

        const companyName = getMappedValue(row, payload.mapping, "Company Name");
        const website = getMappedValue(row, payload.mapping, "Website");
        const domain = normalizeDomain(website);
        const industry = getMappedValue(row, payload.mapping, "Industry");
        const naics = getMappedValue(row, payload.mapping, "NAICS");
        const sic = getMappedValue(row, payload.mapping, "SIC");
        const employeeCount = parseInteger(getMappedValue(row, payload.mapping, "Employee Count"));
        const title = getMappedValue(row, payload.mapping, "Job Title");
        const managementLevel = getMappedValue(row, payload.mapping, "Management Level");
        const email = getMappedValue(row, payload.mapping, "Email");
        const directPhone = getMappedValue(row, payload.mapping, "Direct Phone");
        const mobilePhone = getMappedValue(row, payload.mapping, "Mobile Phone");

        if (!companyName) {
          throw new Error("Company Name is missing after mapping.");
        }

        const zoomInfoSicCode1 = firstNonBlank(
          getValueByHeaderNames(row, ["SIC Code 1"]),
          getCsvValueByExcelColumn(row, payload.headers, "AM")
        );

        const zoomInfoSicCodes = firstNonBlank(
          getValueByHeaderNames(row, ["SIC Codes"]),
          getCsvValueByExcelColumn(row, payload.headers, "AO"),
          zoomInfoSicCode1
        );

        const zoomInfoNaicsCode1 = firstNonBlank(
          getValueByHeaderNames(row, ["NAICS Code 1"]),
          getCsvValueByExcelColumn(row, payload.headers, "AP")
        );

        const zoomInfoNaicsCodes = firstNonBlank(
          getValueByHeaderNames(row, ["NAICS Codes"]),
          getCsvValueByExcelColumn(row, payload.headers, "AR"),
          zoomInfoNaicsCode1
        );

        const zoomInfoPrimaryIndustry = firstNonBlank(
          getValueByHeaderNames(row, ["Primary Industry"]),
          getCsvValueByExcelColumn(row, payload.headers, "AS")
        );

        const zoomInfoPrimarySubIndustry = firstNonBlank(
          getValueByHeaderNames(row, [
            "Primary Sub-Industry",
            "Primary Sub Industry",
            "Primary SubIndustry"
          ]),
          getCsvValueByExcelColumn(row, payload.headers, "AT")
        );

        const companyBeforeInsert = {
          company_name: companyName,
          website,
          domain,
          industry,
          naics,
          sic,
          employee_count: employeeCount,
          revenue: getMappedValue(row, payload.mapping, "Revenue"),
          company_phone: getMappedValue(row, payload.mapping, "Company Phone"),
          company_fax: getMappedValue(row, payload.mapping, "Company Fax"),
          address_line_1: getMappedValue(row, payload.mapping, "Company Address"),
          city: getMappedValue(row, payload.mapping, "Company City"),
          state: getMappedValue(row, payload.mapping, "Company State"),
          postal_code: getMappedValue(row, payload.mapping, "Company Postal Code"),
          country: getMappedValue(row, payload.mapping, "Company Country") ?? "United States",
          company_type: "Prospect",
          source: "ZoomInfo",
          naics_codes: zoomInfoNaicsCodes,
          sic_codes: zoomInfoSicCodes,
          primary_industry: zoomInfoPrimaryIndustry,
          primary_sub_industry: zoomInfoPrimarySubIndustry,
          status: "new",
        };

        const company = await findOrCreateCompany(supabase, companyBeforeInsert);

        if (payload.assignedSalespersonId || undefined || payload.assignedSalesManagerId || undefined) {
          await applyImportSalesAssignmentsToCompany(
            supabase,
            company.id,
            payload.assignedSalespersonId || undefined,
            payload.assignedSalesManagerId || undefined
          );

          assignedCompanyIds.add(company.id);
        }

        const companyWasEnriched = await updateCompanyIndustryEnrichment(supabase, company.id, {
          naics,
          sic,
          naics_codes: zoomInfoNaicsCodes,
          sic_codes: zoomInfoSicCodes,
          primary_industry: zoomInfoPrimaryIndustry,
          primary_sub_industry: zoomInfoPrimarySubIndustry,
        });

        if (companyWasEnriched) {
        }
const companyWasDuplicate = company.created_at !== company.updated_at;

        const contactBeforeInsert = {
          company_id: company.id,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          title,
          management_level: managementLevel,
          department: getMappedValue(row, payload.mapping, "Department"),
          function_area: getMappedValue(row, payload.mapping, "Function"),
          email,
          direct_phone: directPhone,
          mobile_phone: mobilePhone,
          person_city: getMappedValue(row, payload.mapping, "Person City"),
          person_state: getMappedValue(row, payload.mapping, "Person State"),
          person_country: getMappedValue(row, payload.mapping, "Person Country"),
          linkedin_url: getMappedValue(row, payload.mapping, "LinkedIn URL"),
          is_primary: true,
          buying_role_hypothesis: getBuyerPersona(title, fullName),
          source: "ZoomInfo",
        };

        const contact = await findOrCreateContact(supabase, contactBeforeInsert);

        projectListCompanyAssignments += await applyProjectListAssignments(
          supabase,
          "company_project_assignments",
          "company_id",
          company.id,
          selectedProjectListIds
        );

        projectListContactAssignments += await applyProjectListAssignments(
          supabase,
          "contact_project_assignments",
          "contact_id",
          contact.id,
          selectedProjectListIds
        );

        
        await applyImportTagsToCompany(supabase, company.id, selectedImportTagIds);
        await applyImportTagsToContact(supabase, contact?.id, selectedImportTagIds);
const industryFitScore = scoreIndustryFit(industry, naics);
        const cleaningPainScore = scoreCleaningPain(industry);
        const buyerRelevanceScore = scoreBuyerRelevance(title, managementLevel);
        const companySizeScore = scoreCompanySize(employeeCount);
        const confidenceScore = scoreConfidence(companyName, website, industry, title);
        const priorityScore =
          industryFitScore +
          cleaningPainScore +
          buyerRelevanceScore +
          companySizeScore +
          confidenceScore;

        const priorityTier = getPriorityTier(priorityScore);
        const fitRating = getFitRating(priorityScore);
        const confidence = getConfidence(confidenceScore);
        const productPath = inferProductPath(industry, title);
        const primaryUseCase = inferPrimaryUseCase(industry);
        const likelySoils = inferLikelySoils(industry);
        const likelyCleaningAction = inferCleaningAction(industry);
        const nextBestAction =
          "Call the contact to validate current cleaning method, parts cleaned, soils, part size/weight, throughput, and whether a Graymills cleaning test or product recommendation is appropriate.";

        const { data: prospect, error: prospectError } = await supabase
          .from("prospects")
          .insert({
            company_id: company.id,
            primary_contact_id: contact.id,
            import_id: importRecord.id,
            product_line: "Parts Washers",
            likely_product_path: productPath,
            primary_use_case: primaryUseCase,
            likely_soils: likelySoils,
            likely_cleaning_action: likelyCleaningAction,
            industry_fit_score: industryFitScore,
            cleaning_pain_score: cleaningPainScore,
            buyer_relevance_score: buyerRelevanceScore,
            company_size_score: companySizeScore,
            confidence_score: confidenceScore,
            priority_score: priorityScore,
            priority_tier: priorityTier,
            fit_rating: fitRating,
            confidence,
            recommended_sales_motion:
              priorityScore >= 80
                ? "Call first and qualify application details."
                : priorityScore >= 60
                  ? "Work into sequence and qualify early."
                  : "Selective pursuit unless new trigger appears.",
            next_best_action: nextBestAction,
            stage: "new",
            status: "active",
          })
          .select("*")
          .single();

        if (prospectError) throw prospectError;

        const copyableSalesBlock = buildCopyableSalesBlock({
          companyName,
          fullName,
          title,
          email,
          directPhone,
          mobilePhone,
          industry,
          priorityScore,
          priorityTier,
          productPath,
          nextBestAction,
        });

        const { error: intelligenceError } = await supabase.from("prospect_intelligence").insert({
          prospect_id: prospect.id,
          company_id: company.id,
          contact_id: contact.id,
          what_they_do: industry
            ? `${companyName} appears in or adjacent to ${industry}. Validate actual operations through the company website and first-call discovery.`
            : `${companyName} requires additional research to confirm what it manufactures, repairs, services, or supports.`,
          likely_relevance:
            "Sales hypothesis: this account may have parts cleaning requirements tied to maintenance, repair, inspection, assembly, production, or rebuild workflows. Validate actual parts, soils, process flow, and throughput before recommending a specific washer.",
          likely_parts_cleaned:
            "Potential parts may include housings, brackets, fittings, hydraulic or mechanical components, tooling, fixtures, maintenance parts, and other components depending on the operation.",
          likely_soils_contaminants: likelySoils,
          likely_pain_points:
            "Potential pain points may include manual cleaning labor, inconsistent cleaning results, bottlenecks before inspection or assembly, operator exposure, fluid maintenance, housekeeping, and downtime.",
          potential_graymills_fit: productPath,
          suggested_sales_angle:
            "Frame the conversation around cleaning consistency, labor reduction, workflow fit, and validating the right cleaning action before proposing a specific washer.",
          buyer_persona: getBuyerPersona(title, fullName),
          likely_priorities:
            "Uptime, clean parts before inspection or assembly, safe and practical workflow, equipment reliability, maintenance simplicity, and total cost of ownership.",
          persona_interpretation:
            "Start with the current cleaning process and operating pain rather than a product pitch. Use discovery to identify parts, soils, throughput, and handling requirements.",
          discovery_questions: [
            "What types of parts or components are you cleaning today?",
            "What soils are you trying to remove?",
            "How are those parts cleaned now?",
            "What happens immediately before and after cleaning?",
            "What part sizes and weights are typical?",
            "How many parts or batches are cleaned per shift or per day?",
            "Where does cleaning create delays, rework, or operator frustration?",
            "Are you using solvent, water-based chemistry, or both?",
            "Do parts have blind holes, threads, internal passages, or complex geometry?",
            "Would a cleaning test help validate the right equipment path?",
          ],
          buying_committee_hypothesis: [
            {
              role: "Operations / Maintenance",
              concern: "Uptime, cleaning speed, operator workflow, equipment reliability.",
            },
            {
              role: "Quality / Engineering",
              concern: "Cleanliness before inspection, repeatability, part compatibility.",
            },
            {
              role: "Purchasing / Management",
              concern: "Cost, payback, vendor reliability, lead time, support.",
            },
          ],
          trigger_events: [
            "Expansion of maintenance or rebuild activity",
            "Quality problems tied to dirty parts",
            "Solvent handling or housekeeping concerns",
            "Manual cleaning bottlenecks",
            "New production, inspection, or repair workflow",
          ],
          first_call_opener:
            "Iâ€™m calling because Graymills helps industrial maintenance and production teams improve parts cleaning workflows. I wanted to understand how youâ€™re cleaning parts today and whether cleaning is creating any bottlenecks before inspection, assembly, repair, or return-to-service.",
          email_subject: "Parts cleaning workflow question",
          email_message:
            "Iâ€™m reaching out from Graymills. We work with industrial teams on parts washing applications where cleaning consistency, labor, workflow, and maintenance practicality matter. Iâ€™d like to understand how your team currently cleans parts and whether there may be a fit for a manual, immersion, ultrasonic, high-pressure spray, or custom cleaning approach.",
          likely_objections: [
            {
              objection: "We already have a parts washer.",
              response:
                "That makes sense. The useful question may be whether the current method is keeping up with your parts, soils, throughput, and inspection or maintenance requirements.",
            },
            {
              objection: "We are not looking right now.",
              response:
                "Understood. It may still be worth documenting your current cleaning method so we know whether Graymills is relevant when a washer needs replacement or when throughput changes.",
            },
          ],
          recommended_product_paths: [
            {
              path: "Manual parts washer",
              when_relevant:
                "Flexible lower-volume cleaning, maintenance work, brushing, or directed stream cleaning.",
            },
            {
              path: "Immersion / agitation",
              when_relevant:
                "Batch cleaning, soak time, moderate volume, and parts that benefit from fluid movement.",
            },
            {
              path: "Ultrasonic",
              when_relevant:
                "Precision parts, blind holes, threads, complex geometry, or higher cleanliness expectations.",
            },
            {
              path: "Tempest high-pressure spray",
              when_relevant:
                "Heavier soils, operator-directed cleaning, maintenance/rebuild parts, and enclosed high-pressure cleaning.",
            },
            {
              path: "Custom / OEM system",
              when_relevant:
                "Unusual workflow, large parts, multi-stage cleaning, special handling, or requirements outside standard equipment.",
            },
          ],
          what_not_to_say: [
            {
              do_not_say: "This exact model will solve your problem.",
              say_instead:
                "Based on what we know, this product path may be worth validating after we confirm parts, soils, throughput, and workflow.",
            },
            {
              do_not_say: "We can guarantee labor savings.",
              say_instead:
                "The opportunity may be to reduce manual cleaning burden and improve consistency, depending on the current process.",
            },
          ],
          crm_fields: {
            primary_use_case: primaryUseCase,
            likely_soil: likelySoils,
            likely_cleaning_action: likelyCleaningAction,
            primary_buyer: title,
            priority: priorityTier,
            next_step: nextBestAction,
            recommended_sales_motion:
              priorityScore >= 80
                ? "Call first"
                : priorityScore >= 60
                  ? "Work into sequence"
                  : "Selective pursuit",
            product_path: productPath,
            confidence,
          },
          reason_to_believe:
            "Graymills has a strong fit where industrial buyers need practical parts washing equipment selected around actual parts, soils, cleaning action, throughput, and workflow rather than a generic washer recommendation.",
          copyable_sales_block: copyableSalesBlock,
          generated_version: "Rev 1.03",
        });

        if (intelligenceError) throw intelligenceError;

        const { error: importRowError } = await supabase.from("import_rows").insert({
          import_id: importRecord.id,
          row_number: index + 1,
          raw_data: row,
          normalized_data: {
            company_name: companyName,
            full_name: fullName,
            title,
            email,
            website,
            domain,
            industry,
            priority_score: priorityScore,
            priority_tier: priorityTier,
            product_path: productPath,
          },
          company_id: company.id,
          contact_id: contact.id,
          prospect_id: prospect.id,
          status: "processed",
        });

        if (importRowError) throw importRowError;

        if (companyWasDuplicate) duplicateCount += 1;
        processedCount += 1;
      } catch (rowError) {
        errorCount += 1;

        await supabase.from("import_rows").insert({
          import_id: importRecord.id,
          row_number: index + 1,
          raw_data: row,
          status: "error",
          error_message:
            rowError instanceof Error ? rowError.message : "Unknown row processing error.",
        });
      }
    }

    const finalStatus = errorCount === payload.rows.length ? "failed" : "completed";

    const { error: updateError } = await supabase
      .from("imports")
      .update({
        processed_count: processedCount,
        duplicate_count: duplicateCount,
        error_count: errorCount,
        status: finalStatus,
      })
      .eq("id", importRecord.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      importId: importRecord.id,
      processedCount,
      duplicateCount,
      errorCount,
      companiesAssigned: assignedCompanyIds.size,
      assignedSalespersonId: payload.assignedSalespersonId || undefined || null,
      assignedSalesManagerId: payload.assignedSalesManagerId || undefined || null,
      selectedProjectListIds,
      projectListCompanyAssignments,
      projectListContactAssignments,
      status: finalStatus,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Import failed.",
      },
      { status: 500 }
    );
  }
}




























