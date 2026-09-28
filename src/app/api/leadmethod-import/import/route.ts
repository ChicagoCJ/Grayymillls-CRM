import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type LeadMethodRow = Record<string, string>;

type ImportPayload = {
  row?: LeadMethodRow;
  companyDecision?:
    | { action: "reuse"; companyId: string }
    | { action: "create" };
  contactDecision?:
    | { action: "reuse"; contactId: string }
    | { action: "create" }
    | { action: "none" };
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

function buildHistoryNote(row: LeadMethodRow) {
  const leadNumber = getHeaderValue(row, ["Lead #", "Lead Number", "Lead No"]);
  const comments = getHeaderValue(row, ["Comments"]) ?? "";
  const notes = getHeaderValue(row, ["Notes"]) ?? "";
  const contactedCustomer = getHeaderValue(row, ["Contacted Customer"]) ?? "";

  return [
    `Lead #: ${leadNumber ?? ""}`,
    "",
    "Comments:",
    comments,
    "",
    "Notes:",
    notes,
    "",
    `Contacted Customer: ${contactedCustomer}`,
  ].join("\n");
}

function buildSourceMetadata(row: LeadMethodRow) {
  return {
    date: getHeaderValue(row, ["Date"]),
    leadStatus: getHeaderValue(row, ["Lead Status"]),
    leadScore: getHeaderValue(row, ["Lead Score"]),
    leadType: getHeaderValue(row, ["Lead Type"]),
    leadSource: getHeaderValue(row, ["Lead Source"]),
    contacted: getHeaderValue(row, ["Contacted?"]),
    contactSpeed: getHeaderValue(row, ["Contact Speed"]),
    expired: getHeaderValue(row, ["Expired?"]),
    followupDate: getHeaderValue(row, ["Followup Date", "Follow Up Date"]),
    productGroup: getHeaderValue(row, ["Product Group"]),
    additionalFields: getHeaderValue(row, ["Additional Fields"]),
    assigneeManager: getHeaderValue(row, ["Lead Assignee Manager"]),
    assigneeCompany: getHeaderValue(row, ["Lead Assignee Company"]),
    assigneeName: getHeaderValue(row, ["Lead Assignee Name"]),
    assigneeRole: getHeaderValue(row, ["Lead Assignee Role"]),
    assigneeEmail: getHeaderValue(row, ["Lead Assignee Email"]),
  };
}

function splitName(row: LeadMethodRow) {
  const firstName = getHeaderValue(row, ["First Name"]);
  const lastName = getHeaderValue(row, ["Last Name"]);
  const suppliedFullName = getHeaderValue(row, ["Name", "Full Name"]);
  const fullName =
    suppliedFullName || [firstName, lastName].filter(Boolean).join(" ") || null;

  return { firstName, lastName, fullName };
}

function migrationMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  const details = "details" in error ? String((error as { details?: unknown }).details ?? "") : "";
  const combined = `${message} ${details}`.toLowerCase();
  return combined.includes("source_record_id") || combined.includes("source_metadata");
}

export async function POST(request: Request) {
  const created: { companyId: string | null; contactId: string | null } = {
    companyId: null,
    contactId: null,
  };

  try {
    const verification = await verifySignedInCrmUser(request);
    if (verification.response) return verification.response;

    if (
      verification.context.crmRole !== "admin" &&
      verification.context.crmRole !== "sales_manager"
    ) {
      return NextResponse.json(
        { error: "Only CRM Admin and Sales Manager users can import LeadMethod history." },
        { status: 403 }
      );
    }

    const payload = (await request.json()) as ImportPayload;
    const row = payload.row && typeof payload.row === "object" ? payload.row : null;

    if (!row) {
      return NextResponse.json({ error: "A LeadMethod row is required." }, { status: 400 });
    }

    const leadNumber = getHeaderValue(row, ["Lead #", "Lead Number", "Lead No"]);
    if (!leadNumber) {
      return NextResponse.json({ error: "Lead # is required." }, { status: 400 });
    }

    if (!payload.companyDecision) {
      return NextResponse.json(
        { error: "A reviewed company decision is required." },
        { status: 400 }
      );
    }

    if (!payload.contactDecision) {
      return NextResponse.json(
        { error: "A reviewed contact decision is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // The write path deliberately requires the 3.28A1 source-identity migration.
    const { data: existingActivity, error: duplicateError } = await supabase
      .from("activities")
      .select("id, company_id, contact_id, source, source_record_id")
      .eq("source", "LeadMethod")
      .eq("source_record_id", leadNumber)
      .maybeSingle();

    if (duplicateError) {
      if (migrationMissing(duplicateError)) {
        return NextResponse.json(
          {
            error:
              "The 3.28A1 LeadMethod source-identity migration must be applied before importing LeadMethod history.",
            migrationRequired: true,
          },
          { status: 503 }
        );
      }
      throw duplicateError;
    }

    if (existingActivity) {
      return NextResponse.json(
        {
          error: `LeadMethod Lead #${leadNumber} has already been imported.`,
          duplicate: true,
          activity: existingActivity,
        },
        { status: 409 }
      );
    }

    let companyId: string;

    if (payload.companyDecision.action === "reuse") {
      companyId = cleanText(payload.companyDecision.companyId) ?? "";
      if (!companyId) {
        return NextResponse.json({ error: "companyId is required for reuse." }, { status: 400 });
      }

      const { data: company, error } = await supabase
        .from("companies")
        .select("id, archived_at")
        .eq("id", companyId)
        .maybeSingle();

      if (error) throw error;
      if (!company || company.archived_at) {
        return NextResponse.json(
          { error: "The selected company is unavailable or archived." },
          { status: 409 }
        );
      }
    } else {
      const companyName = getHeaderValue(row, ["Company", "Company Name"]);
      if (!companyName) {
        return NextResponse.json(
          { error: "Company is required to create a new CRM company." },
          { status: 400 }
        );
      }

      const city = getHeaderValue(row, ["City"]);
      const state = getHeaderValue(row, ["State", "Province"]);

      // Re-check exact name/location immediately before creating to avoid a race or stale review.
      let duplicateCompanyQuery = supabase
        .from("companies")
        .select("id, company_name, city, state, archived_at")
        .ilike("company_name", companyName)
        .is("archived_at", null);

      if (city) duplicateCompanyQuery = duplicateCompanyQuery.ilike("city", city);
      if (state) duplicateCompanyQuery = duplicateCompanyQuery.ilike("state", state);

      const { data: possibleCompanies, error: possibleCompanyError } =
        await duplicateCompanyQuery.limit(5);

      if (possibleCompanyError) throw possibleCompanyError;

      if ((possibleCompanies ?? []).length > 0) {
        return NextResponse.json(
          {
            error:
              "A matching CRM company now exists. Re-analyze the LeadMethod file and choose the existing company instead of creating another one.",
            requiresReview: true,
            companyCandidates: possibleCompanies,
          },
          { status: 409 }
        );
      }

      const now = new Date().toISOString();
      const { data: company, error } = await supabase
        .from("companies")
        .insert({
          company_name: companyName,
          address_line_1: getHeaderValue(row, ["Address", "Address 1"]),
          address_line_2: getHeaderValue(row, ["Address 2"]),
          city,
          state,
          postal_code: getHeaderValue(row, ["Zip", "Postal Code"]),
          country: getHeaderValue(row, ["Country"]) || "United States",
          status: "new",
          source: "LeadMethod",
          assigned_salesperson_id: null,
          updated_at: now,
        })
        .select("id")
        .single();

      if (error) throw error;
      companyId = String(company.id);
      created.companyId = companyId;
    }

    let contactId: string | null = null;

    if (payload.contactDecision.action === "reuse") {
      contactId = cleanText(payload.contactDecision.contactId);
      if (!contactId) {
        return NextResponse.json({ error: "contactId is required for reuse." }, { status: 400 });
      }

      const { data: contact, error } = await supabase
        .from("contacts")
        .select("id, company_id, archived_at")
        .eq("id", contactId)
        .maybeSingle();

      if (error) throw error;
      if (!contact || contact.archived_at || String(contact.company_id) !== companyId) {
        return NextResponse.json(
          { error: "The selected contact is unavailable, archived, or belongs to a different company." },
          { status: 409 }
        );
      }
    } else if (payload.contactDecision.action === "create") {
      const { firstName, lastName, fullName } = splitName(row);
      const email = getHeaderValue(row, ["Email", "Email Address"]);

      if (!fullName && !email) {
        return NextResponse.json(
          { error: "A contact name or email is required to create a new CRM contact." },
          { status: 400 }
        );
      }

      if (email) {
        const { data: existingContacts, error } = await supabase
          .from("contacts")
          .select("id, company_id, full_name, email")
          .ilike("email", email)
          .is("archived_at", null)
          .limit(5);

        if (error) throw error;

        if ((existingContacts ?? []).length > 0) {
          return NextResponse.json(
            {
              error:
                "A CRM contact with this email now exists. Re-analyze the LeadMethod file and review the contact match before importing.",
              requiresReview: true,
              contactCandidates: existingContacts,
            },
            { status: 409 }
          );
        }
      }

      const now = new Date().toISOString();
      const { data: contact, error } = await supabase
        .from("contacts")
        .insert({
          company_id: companyId,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          email: email ? email.toLowerCase() : null,
          person_city: getHeaderValue(row, ["City"]),
          person_state: getHeaderValue(row, ["State", "Province"]),
          person_country: getHeaderValue(row, ["Country"]),
          source: "LeadMethod",
          is_primary: false,
          created_by: null,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();

      if (error) throw error;
      contactId = String(contact.id);
      created.contactId = contactId;
    }

    const { data: activity, error: activityError } = await supabase
      .from("activities")
      .insert({
        company_id: companyId,
        contact_id: contactId,
        prospect_id: null,
        activity_type: "import_note",
        subject: `LeadMethod Lead #${leadNumber}`,
        notes: buildHistoryNote(row),
        source: "LeadMethod",
        source_record_id: leadNumber,
        source_metadata: buildSourceMetadata(row),
      })
      .select("id, company_id, contact_id, activity_type, subject, source, source_record_id")
      .single();

    if (activityError) {
      if (activityError.code === "23505") {
        if (created.contactId) {
          await supabase.from("contacts").delete().eq("id", created.contactId);
          created.contactId = null;
        }
        if (created.companyId) {
          await supabase.from("companies").delete().eq("id", created.companyId);
          created.companyId = null;
        }

        return NextResponse.json(
          { error: `LeadMethod Lead #${leadNumber} has already been imported.`, duplicate: true },
          { status: 409 }
        );
      }
      throw activityError;
    }

    return NextResponse.json(
      {
        status: "imported",
        leadNumber,
        companyId,
        contactId,
        createdCompany: Boolean(created.companyId),
        createdContact: Boolean(created.contactId),
        activity,
      },
      { status: 201 }
    );
  } catch (error) {
    try {
      const supabase = getSupabaseAdmin();
      if (created.contactId) {
        await supabase.from("contacts").delete().eq("id", created.contactId);
      }
      if (created.companyId) {
        await supabase.from("companies").delete().eq("id", created.companyId);
      }
    } catch {
      // Best-effort cleanup only. The original failure remains the meaningful error.
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to import LeadMethod history.",
      },
      { status: 500 }
    );
  }
}
