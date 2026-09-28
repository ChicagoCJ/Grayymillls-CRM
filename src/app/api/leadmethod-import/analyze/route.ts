import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type LeadMethodRow = Record<string, string>;

type AnalyzePayload = {
  rows?: LeadMethodRow[];
};

type CompanyCandidate = {
  id: string;
  company_name: string;
  city: string | null;
  state: string | null;
  domain: string | null;
  archived_at: string | null;
};

type ContactCandidate = {
  id: string;
  company_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  archived_at: string | null;
};

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
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
    if (wanted.has(normalizeHeader(key))) {
      return cleanText(value);
    }
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

function normalizeCompanyName(value: string | null) {
  return normalizeName(value);
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
  if (at <= 0 || at >= email.length - 1) return "";
  return email.slice(at + 1);
}

function displayContactName(contact: ContactCandidate) {
  const fullName = cleanText(contact.full_name);
  if (fullName) return fullName;

  return [cleanText(contact.first_name), cleanText(contact.last_name)]
    .filter(Boolean)
    .join(" ") || "Unnamed contact";
}

function dedupeById<T extends { id: string }>(rows: T[]) {
  const map = new Map<string, T>();
  for (const row of rows) map.set(row.id, row);
  return Array.from(map.values());
}

function summarizeCompany(company: CompanyCandidate) {
  return {
    id: company.id,
    companyName: company.company_name,
    city: company.city,
    state: company.state,
    domain: company.domain,
  };
}

function summarizeContact(contact: ContactCandidate) {
  return {
    id: contact.id,
    companyId: contact.company_id,
    fullName: displayContactName(contact),
    email: contact.email,
  };
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

    const payload = (await request.json()) as AnalyzePayload;
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

    const [{ data: companies, error: companyError }, { data: contacts, error: contactError }] =
      await Promise.all([
        supabase
          .from("companies")
          .select("id, company_name, city, state, domain, archived_at")
          .is("archived_at", null),
        supabase
          .from("contacts")
          .select("id, company_id, first_name, last_name, full_name, email, archived_at")
          .is("archived_at", null),
      ]);

    if (companyError) throw companyError;
    if (contactError) throw contactError;

    const activeCompanies = (companies ?? []) as CompanyCandidate[];
    const activeContacts = (contacts ?? []) as ContactCandidate[];

    const companyById = new Map(activeCompanies.map((company) => [company.id, company]));
    const contactsByEmail = new Map<string, ContactCandidate[]>();
    const contactsByCompany = new Map<string, ContactCandidate[]>();

    for (const contact of activeContacts) {
      const emailKey = normalizeEmail(contact.email);
      if (emailKey) {
        contactsByEmail.set(emailKey, [
          ...(contactsByEmail.get(emailKey) ?? []),
          contact,
        ]);
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

    const duplicateLeadNumbers = new Set<string>();

    if (leadNumbers.length > 0) {
      const { data: duplicateActivities, error: duplicateError } = await supabase
        .from("activities")
        .select("source_record_id")
        .eq("source", "LeadMethod")
        .in("source_record_id", leadNumbers);

      if (duplicateError) throw duplicateError;

      for (const activity of duplicateActivities ?? []) {
        const sourceRecordId = cleanText(activity.source_record_id);
        if (sourceRecordId) duplicateLeadNumbers.add(sourceRecordId);
      }
    }

    const seenLeadNumbers = new Map<string, number>();

    const analysis = rows.map((row, index) => {
      const csvRowNumber = index + 2;
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

      const comments = getHeaderValue(row, ["Comments"]);
      const notes = getHeaderValue(row, ["Notes"]);
      const contactedCustomer = getHeaderValue(row, ["Contacted Customer"]);
      const emailKey = normalizeEmail(email);
      const companyKey = normalizeCompanyName(companyName);
      const cityKey = normalizeLocation(city);
      const stateKey = normalizeLocation(state);
      const nameKey = normalizeName(fullName);
      const emailDomain = domainFromEmail(email);

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!leadNumber) errors.push("Lead # is missing.");
      if (!companyName) warnings.push("Company is missing.");
      if (!email && !fullName) warnings.push("Contact email and name are both missing.");

      let duplicateStatus: "new" | "already_imported" | "duplicate_in_upload" = "new";

      if (leadNumber) {
        const earlierRow = seenLeadNumbers.get(leadNumber);
        if (earlierRow !== undefined) {
          duplicateStatus = "duplicate_in_upload";
          errors.push(`Lead # ${leadNumber} also appears on CSV row ${earlierRow}.`);
        } else {
          seenLeadNumbers.set(leadNumber, csvRowNumber);
        }

        if (duplicateLeadNumbers.has(leadNumber)) {
          duplicateStatus = "already_imported";
          errors.push(`Lead # ${leadNumber} has already been imported from LeadMethod.`);
        }
      }

      const exactEmailContacts = emailKey
        ? dedupeById(contactsByEmail.get(emailKey) ?? [])
        : [];

      let contactMatchMethod: string | null = null;
      let contactCandidates: ContactCandidate[] = [];

      if (exactEmailContacts.length > 0) {
        contactMatchMethod = "exact_email";
        contactCandidates = exactEmailContacts;
      }

      const companiesFromExactContact = dedupeById(
        exactEmailContacts
          .map((contact) => companyById.get(contact.company_id))
          .filter((company): company is CompanyCandidate => Boolean(company))
      );

      let companyMatchMethod: string | null = null;
      let companyCandidates: CompanyCandidate[] = [];

      if (companiesFromExactContact.length > 0) {
        companyMatchMethod = "exact_contact_email_company";
        companyCandidates = companiesFromExactContact;
      } else if (companyKey) {
        const exactNameCompanies = activeCompanies.filter(
          (company) => normalizeCompanyName(company.company_name) === companyKey
        );

        if (exactNameCompanies.length > 0) {
          const exactNameLocationCompanies = exactNameCompanies.filter((company) => {
            if (cityKey && normalizeLocation(company.city) !== cityKey) return false;
            if (stateKey && normalizeLocation(company.state) !== stateKey) return false;
            return Boolean(cityKey || stateKey);
          });

          if (exactNameLocationCompanies.length > 0) {
            companyMatchMethod = "exact_name_location";
            companyCandidates = exactNameLocationCompanies;
          } else {
            companyMatchMethod = "exact_name";
            companyCandidates = exactNameCompanies;
          }
        }
      }

      if (companyCandidates.length === 0 && emailDomain) {
        const domainCompanies = activeCompanies.filter(
          (company) => normalizeDomain(company.domain) === emailDomain
        );

        if (domainCompanies.length === 1) {
          companyMatchMethod = "unique_email_domain";
          companyCandidates = domainCompanies;
          warnings.push("Company match is based only on a unique email domain and requires review.");
        } else if (domainCompanies.length > 1) {
          companyMatchMethod = "ambiguous_email_domain";
          companyCandidates = domainCompanies;
          warnings.push("Email domain matches more than one CRM company.");
        }
      }

      const confirmedCompany =
        companyCandidates.length === 1 &&
        companyMatchMethod !== "unique_email_domain" &&
        companyMatchMethod !== "ambiguous_email_domain"
          ? companyCandidates[0]
          : null;

      if (contactCandidates.length === 0 && confirmedCompany && nameKey) {
        const companyContacts = contactsByCompany.get(confirmedCompany.id) ?? [];
        const nameMatches = companyContacts.filter(
          (contact) => normalizeName(displayContactName(contact)) === nameKey
        );

        if (nameMatches.length > 0) {
          contactMatchMethod = "exact_name_confirmed_company";
          contactCandidates = dedupeById(nameMatches);
        }
      }

      const companyStatus =
        companyCandidates.length === 0
          ? "no_match"
          : companyCandidates.length === 1 &&
              companyMatchMethod !== "unique_email_domain" &&
              companyMatchMethod !== "ambiguous_email_domain"
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
        companyMatchMethod === "unique_email_domain";

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
        rowNumber: csvRowNumber,
        leadNumber,
        source: "LeadMethod",
        duplicateStatus,
        lead: {
          companyName,
          city,
          state,
          email,
          fullName,
          comments,
          notes,
          contactedCustomer,
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
          method: companyMatchMethod,
          candidates: companyCandidates.map(summarizeCompany),
        },
        contactMatch: {
          status: contactStatus,
          method: contactMatchMethod,
          candidates: contactCandidates.map(summarizeContact),
        },
        recommendedAction,
        errors,
        warnings,
        needsReview,
      };
    });

    const summary = analysis.reduce(
      (acc, row) => {
        acc.totalRows += 1;
        if (row.duplicateStatus !== "new") acc.duplicates += 1;
        if (row.errors.length > 0) acc.blocked += 1;
        else if (row.needsReview) acc.needsReview += 1;
        else acc.ready += 1;

        if (row.companyMatch.status === "matched") acc.companyMatches += 1;
        if (row.contactMatch.status === "matched") acc.contactMatches += 1;
        if (row.recommendedAction === "create_company") acc.newCompanies += 1;
        if (row.recommendedAction === "create_contact") acc.newContacts += 1;

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
        newCompanies: 0,
        newContacts: 0,
      }
    );

    return NextResponse.json({
      version: "3.28A2",
      source: "LeadMethod",
      mode: "analyze_only",
      summary,
      rows: analysis,
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
