import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ContactPayload = {
  contactId?: string;
  companyId?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  title?: string;
  managementLevel?: string;
  department?: string;
  functionArea?: string;
  email?: string;
  directPhone?: string;
  mobilePhone?: string;
  personCity?: string;
  personState?: string;
  personCountry?: string;
  linkedinUrl?: string;
  isPrimary?: boolean;
  buyingRoleHypothesis?: string;
  source?: string;
  archived?: boolean;
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

function cleanEmail(value: unknown) {
  const cleaned = cleanText(value);
  return cleaned ? cleaned.toLowerCase() : null;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function verifyCompanyAccess(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyId: string,
  crmRole: string,
  crmUserId: string
) {
  const { data: company, error } = await supabase
    .from("companies")
    .select("id, assigned_salesperson_id")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw error;

  if (!company) {
    return {
      response: NextResponse.json(
        { error: "Company not found." },
        { status: 404 }
      ),
      company: null,
    };
  }

  const canManage =
    crmRole === "admin" ||
    crmRole === "sales_manager" ||
    (crmRole === "sales_rep" &&
      String(company.assigned_salesperson_id || "") === crmUserId);

  if (!canManage) {
    return {
      response: NextResponse.json(
        { error: "You do not have permission to manage contacts for this company." },
        { status: 403 }
      ),
      company: null,
    };
  }

  return { response: null, company };
}

async function clearOtherPrimaryContacts(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyId: string,
  excludeContactId?: string
) {
  let query = supabase
    .from("contacts")
    .update({
      is_primary: false,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId)
    .eq("is_primary", true);

  if (excludeContactId) {
    query = query.neq("id", excludeContactId);
  }

  const { error } = await query;
  if (error) throw error;
}

export async function POST(request: Request) {
  try {
    const verification = await verifySignedInCrmUser(request);

    if (verification.response) {
      return verification.response;
    }

    const payload = (await request.json()) as ContactPayload;
    const companyId = cleanText(payload.companyId);

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required." },
        { status: 400 }
      );
    }

    const firstName = cleanText(payload.firstName);
    const lastName = cleanText(payload.lastName);
    const suppliedFullName = cleanText(payload.fullName);
    const fullName =
      suppliedFullName ||
      [firstName, lastName].filter(Boolean).join(" ").trim() ||
      null;
    const email = cleanEmail(payload.email);

    if (!fullName && !email) {
      return NextResponse.json(
        { error: "A contact name or email address is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const access = await verifyCompanyAccess(
      supabase,
      companyId,
      verification.context.crmRole,
      verification.context.crmUserId
    );

    if (access.response) {
      return access.response;
    }

    if (email) {
      const { data: duplicate, error: duplicateError } = await supabase
        .from("contacts")
        .select("id")
        .eq("company_id", companyId)
        .ilike("email", email)
        .is("archived_at", null)
        .maybeSingle();

      if (duplicateError) throw duplicateError;

      if (duplicate) {
        return NextResponse.json(
          { error: "An active contact with this email already exists for the company." },
          { status: 409 }
        );
      }
    }

    if (payload.isPrimary === true) {
      await clearOtherPrimaryContacts(supabase, companyId);
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("contacts")
      .insert({
        company_id: companyId,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        title: cleanText(payload.title),
        management_level: cleanText(payload.managementLevel),
        department: cleanText(payload.department),
        function_area: cleanText(payload.functionArea),
        email,
        direct_phone: cleanText(payload.directPhone),
        mobile_phone: cleanText(payload.mobilePhone),
        person_city: cleanText(payload.personCity),
        person_state: cleanText(payload.personState),
        person_country: cleanText(payload.personCountry),
        linkedin_url: cleanText(payload.linkedinUrl),
        is_primary: payload.isPrimary === true,
        buying_role_hypothesis: cleanText(payload.buyingRoleHypothesis),
        source: cleanText(payload.source) || "Manual",
        created_by: null,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "created",
      contact: data,
      verifiedUser: {
        crmUserId: verification.context.crmUserId,
        displayName: verification.context.crmDisplayName,
        role: verification.context.crmRole,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to create the contact."),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const verification = await verifySignedInCrmUser(request);

    if (verification.response) {
      return verification.response;
    }

    const payload = (await request.json()) as ContactPayload;
    const contactId = cleanText(payload.contactId);

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: existingContact, error: existingError } = await supabase
      .from("contacts")
      .select(
        "id, company_id, first_name, last_name, full_name, email, is_primary, archived_at"
      )
      .eq("id", contactId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existingContact) {
      return NextResponse.json(
        { error: "Contact not found." },
        { status: 404 }
      );
    }

    const companyId = String(existingContact.company_id);
    const access = await verifyCompanyAccess(
      supabase,
      companyId,
      verification.context.crmRole,
      verification.context.crmUserId
    );

    if (access.response) {
      return access.response;
    }

    const hasField = (field: keyof ContactPayload) =>
      Object.prototype.hasOwnProperty.call(payload, field);

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const nameFieldsChanged =
      hasField("firstName") ||
      hasField("lastName") ||
      hasField("fullName");

    if (nameFieldsChanged) {
      const firstName = hasField("firstName")
        ? cleanText(payload.firstName)
        : existingContact.first_name;
      const lastName = hasField("lastName")
        ? cleanText(payload.lastName)
        : existingContact.last_name;
      const suppliedFullName = hasField("fullName")
        ? cleanText(payload.fullName)
        : null;
      const fullName =
        suppliedFullName ||
        [firstName, lastName].filter(Boolean).join(" ").trim() ||
        null;

      update.first_name = firstName;
      update.last_name = lastName;
      update.full_name = fullName;
    }

    if (hasField("email")) {
      const email = cleanEmail(payload.email);

      if (email) {
        const { data: duplicate, error: duplicateError } = await supabase
          .from("contacts")
          .select("id")
          .eq("company_id", companyId)
          .ilike("email", email)
          .neq("id", contactId)
          .is("archived_at", null)
          .maybeSingle();

        if (duplicateError) throw duplicateError;

        if (duplicate) {
          return NextResponse.json(
            { error: "Another active contact with this email already exists for the company." },
            { status: 409 }
          );
        }
      }

      update.email = email;
    }

    if (hasField("title")) update.title = cleanText(payload.title);
    if (hasField("managementLevel")) {
      update.management_level = cleanText(payload.managementLevel);
    }
    if (hasField("department")) update.department = cleanText(payload.department);
    if (hasField("functionArea")) {
      update.function_area = cleanText(payload.functionArea);
    }
    if (hasField("directPhone")) {
      update.direct_phone = cleanText(payload.directPhone);
    }
    if (hasField("mobilePhone")) {
      update.mobile_phone = cleanText(payload.mobilePhone);
    }
    if (hasField("personCity")) {
      update.person_city = cleanText(payload.personCity);
    }
    if (hasField("personState")) {
      update.person_state = cleanText(payload.personState);
    }
    if (hasField("personCountry")) {
      update.person_country = cleanText(payload.personCountry);
    }
    if (hasField("linkedinUrl")) {
      update.linkedin_url = cleanText(payload.linkedinUrl);
    }
    if (hasField("buyingRoleHypothesis")) {
      update.buying_role_hypothesis = cleanText(payload.buyingRoleHypothesis);
    }
    if (hasField("source")) {
      update.source = cleanText(payload.source);
    }

    if (hasField("isPrimary")) {
      if (payload.isPrimary === true) {
        await clearOtherPrimaryContacts(supabase, companyId, contactId);
      }

      update.is_primary = payload.isPrimary === true;
    }

    if (hasField("archived")) {
      update.archived_at = payload.archived
        ? new Date().toISOString()
        : null;

      if (payload.archived === true) {
        update.is_primary = false;
      }
    }

    if (Object.keys(update).length === 1) {
      return NextResponse.json(
        { error: "No contact fields were provided to update." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("contacts")
      .update(update)
      .eq("id", contactId)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: payload.archived === true ? "archived" : "updated",
      contact: data,
      verifiedUser: {
        crmUserId: verification.context.crmUserId,
        displayName: verification.context.crmDisplayName,
        role: verification.context.crmRole,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to update the contact."),
      },
      { status: 500 }
    );
  }
}
