import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type CompanyPayload = {
  companyId?: string;
  companyName?: string;
  website?: string;
  domain?: string;
  industry?: string;
  employeeCount?: string | number | null;
  companyPhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  companyType?: string;
  status?: string;
  notes?: string;
  archived?: boolean;
  confirmPotentialDuplicate?: boolean;
};

type CompanyAccessRecord = {
  id: string;
  company_name: string;
  assigned_salesperson_id: string | null;
  archived_at: string | null;
};

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase server environment variables."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function hasField(
  payload: CompanyPayload,
  field: keyof CompanyPayload
) {
  return Object.prototype.hasOwnProperty.call(
    payload,
    field
  );
}

function normalizeDomain(value: unknown) {
  const cleaned = cleanText(value);

  if (!cleaned) return null;

  let candidate = cleaned.toLowerCase();

  try {
    const parsed = new URL(
      candidate.includes("://")
        ? candidate
        : "https://" + candidate
    );

    candidate = parsed.hostname.toLowerCase();
  } catch {
    candidate = candidate
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      .split("?")[0]
      .split("#")[0]
      .split(":")[0]
      .toLowerCase();
  }

  candidate = candidate
    .replace(/^www\./i, "")
    .replace(/\.$/, "")
    .trim();

  if (!candidate) return null;

  if (!/^[a-z0-9.-]+$/.test(candidate)) {
    return null;
  }

  return candidate;
}

function cleanEmployeeCount(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numberValue =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/,/g, "").trim());

  if (
    !Number.isInteger(numberValue) ||
    numberValue < 0
  ) {
    return undefined;
  }

  return numberValue;
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  ) {
    return "A company with one of these unique values already exists.";
  }

  return error instanceof Error
    ? error.message
    : fallback;
}

function canManageCompany(
  company: CompanyAccessRecord,
  crmRole: string,
  crmUserId: string
) {
  return (
    crmRole === "admin" ||
    crmRole === "sales_manager" ||
    (
      crmRole === "sales_rep" &&
      String(
        company.assigned_salesperson_id || ""
      ) === crmUserId
    )
  );
}

async function findDomainDuplicate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  normalizedDomain: string,
  excludeCompanyId?: string
) {
  let domainQuery = supabase
    .from("companies")
    .select(
      "id, company_name, domain, website, city, state, archived_at"
    )
    .ilike("domain", normalizedDomain);

  let websiteQuery = supabase
    .from("companies")
    .select(
      "id, company_name, domain, website, city, state, archived_at"
    )
    .ilike(
      "website",
      "%" + normalizedDomain + "%"
    );

  if (excludeCompanyId) {
    domainQuery = domainQuery.neq(
      "id",
      excludeCompanyId
    );

    websiteQuery = websiteQuery.neq(
      "id",
      excludeCompanyId
    );
  }

  const [
    domainResult,
    websiteResult,
  ] = await Promise.all([
    domainQuery.limit(10),
    websiteQuery.limit(10),
  ]);

  if (domainResult.error) {
    throw domainResult.error;
  }

  if (websiteResult.error) {
    throw websiteResult.error;
  }

  const candidates = [
    ...(domainResult.data ?? []),
    ...(websiteResult.data ?? []),
  ];

  const uniqueCandidates = Array.from(
    new Map(
      candidates.map((company) => [
        String(company.id),
        company,
      ])
    ).values()
  );

  return (
    uniqueCandidates.find((company) => {
      const storedDomain = normalizeDomain(
        company.domain || company.website
      );

      return storedDomain === normalizedDomain;
    }) ?? null
  );
}

async function findNameLocationDuplicate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyName: string,
  city: string,
  state: string
) {
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, company_name, domain, website, city, state, archived_at"
    )
    .ilike("company_name", companyName)
    .ilike("city", city)
    .ilike("state", state)
    .limit(5);

  if (error) throw error;

  return data?.[0] ?? null;
}

export async function GET(request: Request) {
  try {
    const verification =
      await verifySignedInCrmUser(request);

    if (verification.response) {
      return verification.response;
    }

    const role = verification.context.crmRole;

    if (
      role !== "admin" &&
      role !== "sales_manager"
    ) {
      return NextResponse.json(
        {
          error:
            "Only CRM Admin and Sales Manager users can view archived companies.",
        },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("companies")
      .select(
        `
        id,
        company_name,
        website,
        domain,
        industry,
        company_phone,
        city,
        state,
        country,
        status,
        source,
        assigned_salesperson_id,
        assigned_sales_manager_id,
        archived_at,
        updated_at
        `
      )
      .not("archived_at", "is", null)
      .order("archived_at", {
        ascending: false,
      })
      .limit(200);

    if (error) throw error;

    return NextResponse.json({
      archivedCompanies: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to load archived companies."
        ),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const verification =
      await verifySignedInCrmUser(request);

    if (verification.response) {
      return verification.response;
    }

    const payload =
      (await request.json()) as CompanyPayload;

    const companyName = cleanText(
      payload.companyName
    );

    if (!companyName) {
      return NextResponse.json(
        {
          error: "Company Name is required.",
        },
        { status: 400 }
      );
    }

    const employeeCount = cleanEmployeeCount(
      payload.employeeCount
    );

    if (employeeCount === undefined) {
      return NextResponse.json(
        {
          error:
            "Employee Count must be a whole number of zero or greater.",
        },
        { status: 400 }
      );
    }

    const website = cleanText(payload.website);
    const suppliedDomain = cleanText(
      payload.domain
    );

    const normalizedDomain = normalizeDomain(
      suppliedDomain || website
    );

    if (
      suppliedDomain &&
      !normalizedDomain
    ) {
      return NextResponse.json(
        {
          error:
            "Enter a valid company domain, such as example.com.",
        },
        { status: 400 }
      );
    }

    const city = cleanText(payload.city);
    const state = cleanText(payload.state);

    const supabase = getSupabaseAdmin();

    if (normalizedDomain) {
      const domainDuplicate =
        await findDomainDuplicate(
          supabase,
          normalizedDomain
        );

      if (domainDuplicate) {
        return NextResponse.json(
          {
            error:
              "A company with this domain already exists.",
            duplicateType: "domain",
            existingCompany: domainDuplicate,
          },
          { status: 409 }
        );
      }
    }

    if (
      city &&
      state &&
      !payload.confirmPotentialDuplicate
    ) {
      const locationDuplicate =
        await findNameLocationDuplicate(
          supabase,
          companyName,
          city,
          state
        );

      if (locationDuplicate) {
        return NextResponse.json(
          {
            error:
              "A company with the same name, city, and state already exists. Confirm before creating another record.",
            duplicateType: "name_location",
            requiresConfirmation: true,
            existingCompany: locationDuplicate,
          },
          { status: 409 }
        );
      }
    }

    const role = verification.context.crmRole;
    const crmUserId = String(
      verification.context.crmUserId
    );

    const insertRecord = {
      company_name: companyName,
      website,
      domain: normalizedDomain,
      industry: cleanText(payload.industry),
      employee_count: employeeCount,
      company_phone: cleanText(
        payload.companyPhone
      ),
      address_line_1: cleanText(
        payload.addressLine1
      ),
      address_line_2: cleanText(
        payload.addressLine2
      ),
      city,
      state,
      postal_code: cleanText(
        payload.postalCode
      ),
      country:
        cleanText(payload.country) ||
        "United States",
      company_type: cleanText(
        payload.companyType
      ),
      status:
        cleanText(payload.status) || "new",
      notes: cleanText(payload.notes),
      source: "Manual",
      assigned_salesperson_id:
        role === "sales_rep"
          ? crmUserId
          : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("companies")
      .insert(insertRecord)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        status: "created",
        company: data,
        verifiedUser: {
          crmUserId,
          displayName:
            verification.context.crmDisplayName,
          role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to create company."
        ),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const verification =
      await verifySignedInCrmUser(request);

    if (verification.response) {
      return verification.response;
    }

    const payload =
      (await request.json()) as CompanyPayload;

    const companyId = cleanText(
      payload.companyId
    );

    if (!companyId) {
      return NextResponse.json(
        {
          error: "companyId is required.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const {
      data: existingCompany,
      error: companyError,
    } = await supabase
      .from("companies")
      .select(
        "id, company_name, assigned_salesperson_id, archived_at"
      )
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) throw companyError;

    if (!existingCompany) {
      return NextResponse.json(
        {
          error: "Company not found.",
        },
        { status: 404 }
      );
    }

    const role = verification.context.crmRole;
    const crmUserId = String(
      verification.context.crmUserId
    );

    const restoring =
      payload.archived === false &&
      Boolean(existingCompany.archived_at);

    if (
      restoring &&
      role !== "admin" &&
      role !== "sales_manager"
    ) {
      return NextResponse.json(
        {
          error:
            "Only CRM Admin and Sales Manager users can restore archived companies.",
        },
        { status: 403 }
      );
    }

    if (
      !restoring &&
      !canManageCompany(
        existingCompany,
        role,
        crmUserId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to manage this company.",
        },
        { status: 403 }
      );
    }

    if (
      existingCompany.archived_at &&
      payload.archived !== false
    ) {
      return NextResponse.json(
        {
          error:
            "Restore this company before editing it.",
        },
        { status: 409 }
      );
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (hasField(payload, "companyName")) {
      const companyName = cleanText(
        payload.companyName
      );

      if (!companyName) {
        return NextResponse.json(
          {
            error:
              "Company Name cannot be blank.",
          },
          { status: 400 }
        );
      }

      update.company_name = companyName;
    }

    if (
      hasField(payload, "website") ||
      hasField(payload, "domain")
    ) {
      const website = cleanText(
        payload.website
      );

      const suppliedDomain = cleanText(
        payload.domain
      );

      const normalizedDomain =
        normalizeDomain(
          suppliedDomain || website
        );

      if (
        suppliedDomain &&
        !normalizedDomain
      ) {
        return NextResponse.json(
          {
            error:
              "Enter a valid company domain, such as example.com.",
          },
          { status: 400 }
        );
      }

      if (normalizedDomain) {
        const domainDuplicate =
          await findDomainDuplicate(
            supabase,
            normalizedDomain,
            companyId
          );

        if (domainDuplicate) {
          return NextResponse.json(
            {
              error:
                "Another company already uses this domain.",
              duplicateType: "domain",
              existingCompany:
                domainDuplicate,
            },
            { status: 409 }
          );
        }
      }

      update.website = website;
      update.domain = normalizedDomain;
    }

    if (hasField(payload, "industry")) {
      update.industry = cleanText(
        payload.industry
      );
    }

    if (hasField(payload, "employeeCount")) {
      const employeeCount =
        cleanEmployeeCount(
          payload.employeeCount
        );

      if (employeeCount === undefined) {
        return NextResponse.json(
          {
            error:
              "Employee Count must be a whole number of zero or greater.",
          },
          { status: 400 }
        );
      }

      update.employee_count = employeeCount;
    }

    if (hasField(payload, "companyPhone")) {
      update.company_phone = cleanText(
        payload.companyPhone
      );
    }

    if (hasField(payload, "addressLine1")) {
      update.address_line_1 = cleanText(
        payload.addressLine1
      );
    }

    if (hasField(payload, "addressLine2")) {
      update.address_line_2 = cleanText(
        payload.addressLine2
      );
    }

    if (hasField(payload, "city")) {
      update.city = cleanText(payload.city);
    }

    if (hasField(payload, "state")) {
      update.state = cleanText(payload.state);
    }

    if (hasField(payload, "postalCode")) {
      update.postal_code = cleanText(
        payload.postalCode
      );
    }

    if (hasField(payload, "country")) {
      update.country = cleanText(
        payload.country
      );
    }

    if (hasField(payload, "companyType")) {
      update.company_type = cleanText(
        payload.companyType
      );
    }

    if (hasField(payload, "status")) {
      update.status =
        cleanText(payload.status) || "new";
    }

    if (hasField(payload, "notes")) {
      update.notes = cleanText(payload.notes);
    }

    if (payload.archived === true) {
      update.archived_at =
        new Date().toISOString();
    }

    if (payload.archived === false) {
      update.archived_at = null;
    }

    const { data, error } = await supabase
      .from("companies")
      .update(update)
      .eq("id", companyId)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status:
        payload.archived === true
          ? "archived"
          : payload.archived === false
            ? "restored"
            : "updated",
      company: data,
      verifiedUser: {
        crmUserId,
        displayName:
          verification.context.crmDisplayName,
        role,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to update company."
        ),
      },
      { status: 500 }
    );
  }
}