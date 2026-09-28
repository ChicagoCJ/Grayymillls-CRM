import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type LeadMethodRow = Record<string, string>;

type CompanyCandidate = {
  id: string;
  company_name: string;
  city: string | null;
  state: string | null;
  domain: string | null;
};

type ContactCandidate = {
  id: string;
  company_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
};

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/[\uFEFF"]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getHeaderValue(row: LeadMethodRow, names: string[]) {
  const wanted = new Set(names.map(normalizeHeader));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(normalizeHeader(key))) return cleanText(value);
  }
  return null;
}

function normalizeEmail(value: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeName(value: string | null) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLocation(value: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDomain(value: string | null) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return raw
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim();
  }
}

function domainFromEmail(value: string | null) {
  const email = normalizeEmail(value);
  const at = email.lastIndexOf("@");
  return at > 0 && at < email.length - 1 ? email.slice(at + 1) : "";
}

function displayContactName(contact: ContactCandidate) {
  return (
    cleanText(contact.full_name) ||
    [cleanText(contact.first_name), cleanText(contact.last_name)]
      .filter(Boolean)
      .join(" ") ||
    "Unnamed contact"
  );
}

function dedupeById<T extends { id: string }>(rows: T[]) {
  const map = new Map<string, T>();
  rows.forEach((row) => map.set(row.id, row));
  return Array.from(map.values());
}

function migrationMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { message?: unknown; details?: unknown; hint?: unknown };
  const combined = `${String(record.message ?? "")} ${String(record.details ?? "")} ${String(
    record.hint ?? ""
  )}`.toLowerCase();

  return (
    combined.includes("source_record_id") ||
    combined.includes("source_metadata") ||
    combined.includes("activities.source")
  );
}

export async function POST(request: Request) {
  try {
    const verification = await verifySignedInCrmUser(request);
    if (verification.response) return verification.response;

    if (
      verification.context.crmRole !== "admin" &&
      verification.context.crmRole !== "sales_manager"
    ) {
      return NextResponse.json(
        { error: "Your current CRM role cannot analyze LeadMethod imports." },
        { status: 403 }
      );
    }

    const payload = (await request.json()) as { rows?: LeadMethodRow[] };
    const rows = Array.isArray(payload.rows) ? payload.rows : [];

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "At least one LeadMethod row is required." },
        { status: 400 }
      );
    }

    if (rows.length > 10000) {
      return NextResponse.json(
        { error: "LeadMethod analysis is limited to 10,000 rows per upload." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const [companyResult, contactResult] = await Promise.all([
      supabase
        .from("companies")
        .select("id, company_name, city, state, domain")
        .is("archived_at", null),
      supabase
        .from("contacts")
        .select("id, company_id, first_name, last_name, full_name, email")
        .is("archived_at", null),
    ]);

    if (companyResult.error) throw companyResult.error;
    if (contactResult.error) throw contactResult.error;

    const companies = (companyResult.data ?? []) as CompanyCandidate[];
    const contacts = (contactResult.data ?? []) as ContactCandidate[];
    const companyById = new Map(companies.map((company) => [company.id, company]));
    const contactsByEmail = new Map<string, ContactCandidate[]>();
    const contactsByCompany = new Map<string, ContactCandidate[]>();

    for (const contact of contacts) {
      const email = normalizeEmail(contact.email);
      if (email) {
        contactsByEmail.set(email, [...(contactsByEmail.get(email) ?? []), contact]);
      }
      contactsByCompany.set(contact.company_id, [
        ...(contactsByCompany.get(contact.company_id) ?? []),
        contact,
      ]);
    }

    const leadNumbers = Array.from(
      new Set(
        rows
          .map((row) => getHeaderValue(row, ["Lead #", "Lead Number", "Lead No"]))
          .filter((value): value is string => Boolean(value))
      )
    );

    const importedLeadNumbers = new Set<string>();
    let duplicateCheckAvailable = true;
    let duplicateCheckMessage: string | null = null;

    if (leadNumbers.length > 0) {
      const { data: existingActivities, error: duplicateError } = await supabase
        .from("activities")
        .select("source_record_id")
        .eq("source", "LeadMethod")
        .in("source_record_id", leadNumbers);

      if (duplicateError) {
        if (migrationMissing(duplicateError)) {
          duplicateCheckAvailable = false;
          duplicateCheckMessage =
            "Existing CRM LeadMethod duplicate checking will activate after the 3.28A1 source-identity migration is applied. Import actions remain disabled until the migration is applied.";
        } else {
          throw duplicateError;
        }
      } else {
        for (const activity of existingActivities ?? []) {
          const sourceRecordId = cleanText(activity.source_record_id);
          if (sourceRecordId) importedLeadNumbers.add(sourceRecordId);
        }
      }
    }

    const seenLeadNumbers = new Map<string, number>();

    const analysis = rows.map((row, index) => {
      const rowNumber = index + 2;
      const leadNumber = getHeaderValue(row, ["Lead #", "Lead Number", "Lead No"]);
      const companyName = getHeaderValue(row, ["Company", "Company Name"]);
      const city = getHeaderValue(row, ["City"]);
      const state = getHeaderValue(row, ["State", "Province"]);
      const email = getHeaderValue(row, ["Email", "Email Address"]);
      const firstName = getHeaderValue(row, ["First Name"]);
      const lastName = getHeaderValue(row, ["Last Name"]);
      const fullName =
        getHeaderValue(row, ["Name", "Full Name"]) ||
        [firstName, lastName].filter(Boolean).join(" ") ||
        null;

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!leadNumber) errors.push("Lead # is missing.");
      if (!companyName) warnings.push("Company is missing.");
      if (!email && !fullName) warnings.push("Contact email and name are both missing.");

      let duplicateStatus = duplicateCheckAvailable ? "new" : "not_checked";
      if (leadNumber) {
        const earlierRow = seenLeadNumbers.get(leadNumber);
        if (earlierRow !== undefined) {
          duplicateStatus = "duplicate_in_upload";
          errors.push(`Lead # ${leadNumber} also appears on CSV row ${earlierRow}.`);
        } else {
          seenLeadNumbers.set(leadNumber, rowNumber);
        }

        if (duplicateCheckAvailable && importedLeadNumbers.has(leadNumber)) {
          duplicateStatus = "already_imported";
          errors.push(`Lead # ${leadNumber} has already been imported from LeadMethod.`);
        }
      }

      const exactEmailContacts = email
        ? dedupeById(contactsByEmail.get(normalizeEmail(email)) ?? [])
        : [];

      let contactMethod: string | null = null;
      let contactCandidates: ContactCandidate[] = [];
      if (exactEmailContacts.length > 0) {
        contactMethod = "exact_email";
        contactCandidates = exactEmailContacts;
      }

      const companiesFromExactContact = dedupeById(
        exactEmailContacts
          .map((contact) => companyById.get(contact.company_id))
          .filter((company): company is CompanyCandidate => Boolean(company))
      );

      let companyMethod: string | null = null;
      let companyCandidates: CompanyCandidate[] = [];
      const companyKey = normalizeName(companyName);
      const cityKey = normalizeLocation(city);
      const stateKey = normalizeLocation(state);

      if (companiesFromExactContact.length > 0) {
        companyMethod = "exact_contact_email_company";
        companyCandidates = companiesFromExactContact;
      } else if (companyKey) {
        const exactName = companies.filter(
          (company) => normalizeName(company.company_name) === companyKey
        );
        if (exactName.length > 0) {
          const exactLocation = exactName.filter((company) => {
            if (cityKey && normalizeLocation(company.city) !== cityKey) return false;
            if (stateKey && normalizeLocation(company.state) !== stateKey) return false;
            return Boolean(cityKey || stateKey);
          });
          if (exactLocation.length > 0) {
            companyMethod = "exact_name_location";
            companyCandidates = exactLocation;
          } else {
            companyMethod = "exact_name";
            companyCandidates = exactName;
          }
        }
      }

      const emailDomain = domainFromEmail(email);
      if (companyCandidates.length === 0 && emailDomain) {
        const domainMatches = companies.filter(
          (company) => normalizeDomain(company.domain) === emailDomain
        );
        if (domainMatches.length === 1) {
          companyMethod = "unique_email_domain";
          companyCandidates = domainMatches;
          warnings.push("Company match is based only on a unique email domain and requires review.");
        } else if (domainMatches.length > 1) {
          companyMethod = "ambiguous_email_domain";
          companyCandidates = domainMatches;
          warnings.push("Email domain matches more than one CRM company.");
        }
      }

      const confirmedCompany =
        companyCandidates.length === 1 &&
        companyMethod !== "unique_email_domain" &&
        companyMethod !== "ambiguous_email_domain"
          ? companyCandidates[0]
          : null;

      if (contactCandidates.length === 0 && confirmedCompany && fullName) {
        const nameKey = normalizeName(fullName);
        const nameMatches = (contactsByCompany.get(confirmedCompany.id) ?? []).filter(
          (contact) => normalizeName(displayContactName(contact)) === nameKey
        );
        if (nameMatches.length > 0) {
          contactMethod = "exact_name_confirmed_company";
          contactCandidates = dedupeById(nameMatches);
        }
      }

      const companyStatus =
        companyCandidates.length === 0
          ? "no_match"
          : companyCandidates.length === 1 &&
              companyMethod !== "unique_email_domain" &&
              companyMethod !== "ambiguous_email_domain"
            ? "matched"
            : "needs_review";

      const contactStatus =
        contactCandidates.length === 0
          ? "no_match"
          : contactCandidates.length === 1
            ? "matched"
            : "needs_review";

      const needsReview =
        errors.length > 0 ||
        companyStatus === "needs_review" ||
        contactStatus === "needs_review" ||
        companyMethod === "unique_email_domain";

      const recommendedAction =
        errors.length > 0
          ? "blocked"
          : needsReview
            ? "review"
            : companyStatus === "no_match"
              ? "create_company"
              : contactStatus === "no_match" && (email || fullName)
                ? "create_contact"
                : "import_history";

      return {
        rowNumber,
        leadNumber,
        source: "LeadMethod",
        duplicateStatus,
        recommendedAction,
        needsReview,
        errors,
        warnings,
        lead: {
          companyName,
          city,
          state,
          email,
          fullName,
          comments: getHeaderValue(row, ["Comments"]),
          notes: getHeaderValue(row, ["Notes"]),
          contactedCustomer: getHeaderValue(row, ["Contacted Customer"]),
          leadStatus: getHeaderValue(row, ["Lead Status"]),
          leadScore: getHeaderValue(row, ["Lead Score"]),
          leadType: getHeaderValue(row, ["Lead Type"]),
          leadSource: getHeaderValue(row, ["Lead Source"]),
          followupDate: getHeaderValue(row, ["Followup Date", "Follow Up Date"]),
          productGroup: getHeaderValue(row, ["Product Group"]),
          assigneeManager: getHeaderValue(row, ["Lead Assignee Manager"]),
          assigneeCompany: getHeaderValue(row, ["Lead Assignee Company"]),
          assigneeName: getHeaderValue(row, ["Lead Assignee Name"]),
          assigneeRole: getHeaderValue(row, ["Lead Assignee Role"]),
          assigneeEmail: getHeaderValue(row, ["Lead Assignee Email"]),
        },
        companyMatch: {
          status: companyStatus,
          method: companyMethod,
          candidates: companyCandidates.map((company) => ({
            id: company.id,
            companyName: company.company_name,
            city: company.city,
            state: company.state,
            domain: company.domain,
          })),
        },
        contactMatch: {
          status: contactStatus,
          method: contactMethod,
          candidates: contactCandidates.map((contact) => ({
            id: contact.id,
            companyId: contact.company_id,
            fullName: displayContactName(contact),
            email: contact.email,
          })),
        },
      };
    });

    const summary = analysis.reduce(
      (acc, row) => {
        acc.totalRows += 1;
        if (
          row.duplicateStatus === "duplicate_in_upload" ||
          row.duplicateStatus === "already_imported"
        ) {
          acc.duplicates += 1;
        }
        if (row.errors.length > 0) acc.blocked += 1;
        else if (row.needsReview) acc.needsReview += 1;
        else acc.ready += 1;
        if (row.companyMatch.status === "matched") acc.companyMatches += 1;
        if (row.contactMatch.status === "matched") acc.contactMatches += 1;
        return acc;
      },
      {
        totalRows: 0,
        ready: 0,
        needsReview: 0,
        blocked: 0,
        duplicates: 0,
        companyMatches: 0,
        contactMatches: 0,
      }
    );

    return NextResponse.json({
      status: "analyzed",
      duplicateCheckAvailable,
      duplicateCheckMessage,
      summary,
      analysis,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze LeadMethod import.",
      },
      { status: 500 }
    );
  }
}
