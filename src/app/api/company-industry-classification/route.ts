import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type CompanyGraymillsClassificationPayload = {
  classificationId?: string | null;
  companyIds?: string[];
  categoryId?: string | null;
  industryId?: string | null;
  subIndustryId?: string | null;
  removeCategory?: boolean;
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
  return cleaned || null;
}

function cleanTextArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => cleanText(item))
        .filter((item): item is string => Boolean(item))
    )
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function verifyClassificationWriter(request: Request) {
  const verification = await verifySignedInCrmUser(request);

  if (verification.response) {
    return verification;
  }

  const role = verification.context.crmRole;

  if (
    role !== "admin" &&
    role !== "sales_manager" &&
    role !== "sales_rep"
  ) {
    return {
      context: null,
      response: NextResponse.json(
        {
          error:
            "Your CRM role cannot change Graymills company classification.",
        },
        { status: 403 }
      ),
    };
  }

  return verification;
}

async function verifyCompanyClassificationReadAccess(
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
    return NextResponse.json(
      { error: "Company not found." },
      { status: 404 }
    );
  }

  const canRead =
    crmRole === "admin" ||
    crmRole === "sales_manager" ||
    (crmRole === "sales_rep" &&
      String(company.assigned_salesperson_id || "") === crmUserId);

  if (!canRead) {
    return NextResponse.json(
      {
        error:
          "You do not have access to this company Graymills classification.",
      },
      { status: 403 }
    );
  }

  return null;
}

function oneRelatedRecord(value: unknown) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value && typeof value === "object" ? value : null;
}

export async function GET(request: Request) {
  try {
    const verification = await verifySignedInCrmUser(request);

    if (verification.response) {
      return verification.response;
    }

    const { searchParams } = new URL(request.url);
    const companyId = cleanText(searchParams.get("companyId"));

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const accessResponse = await verifyCompanyClassificationReadAccess(
      supabase,
      companyId,
      verification.context.crmRole,
      verification.context.crmUserId
    );

    if (accessResponse) return accessResponse;

    const { data, error } = await supabase
      .from("company_graymills_classifications")
      .select(
        `
          id,
          company_id,
          graymills_category_id,
          industry_id,
          sub_industry_id,
          created_at,
          updated_at,
          graymills_category_definitions (
            id,
            category_key,
            category_name,
            sort_order,
            status
          ),
          company_industry_definitions (
            id,
            industry_name,
            status
          ),
          company_sub_industry_definitions (
            id,
            sub_industry_name,
            status
          )
        `
      )
      .eq("company_id", companyId);

    if (error) throw error;

    const graymillsClassifications = (data ?? [])
      .map((row: any) => {
        const category = oneRelatedRecord(
          row.graymills_category_definitions
        ) as any;
        const industry = oneRelatedRecord(
          row.company_industry_definitions
        ) as any;
        const subIndustry = oneRelatedRecord(
          row.company_sub_industry_definitions
        ) as any;

        return {
          id: String(row.id),
          companyId: String(row.company_id),
          categoryId: String(row.graymills_category_id),
          categoryKey: String(category?.category_key || ""),
          categoryName: String(
            category?.category_name || "Unknown Graymills Category"
          ),
          categorySortOrder: Number(category?.sort_order ?? 100),
          categoryStatus:
            category?.status === "archived" ? "archived" : "active",
          industryId: row.industry_id ? String(row.industry_id) : null,
          industryName: industry?.industry_name
            ? String(industry.industry_name)
            : null,
          industryStatus:
            industry?.status === "archived"
              ? "archived"
              : industry
                ? "active"
                : null,
          subIndustryId: row.sub_industry_id
            ? String(row.sub_industry_id)
            : null,
          subIndustryName: subIndustry?.sub_industry_name
            ? String(subIndustry.sub_industry_name)
            : null,
          subIndustryStatus:
            subIndustry?.status === "archived"
              ? "archived"
              : subIndustry
                ? "active"
                : null,
          updatedAt: row.updated_at,
        };
      })
      .sort((a, b) => {
        const orderDifference =
          a.categorySortOrder - b.categorySortOrder;

        return orderDifference !== 0
          ? orderDifference
          : a.categoryName.localeCompare(b.categoryName);
      });

    return NextResponse.json({
      graymillsClassifications,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to load company Graymills classification."
        ),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const verification = await verifyClassificationWriter(request);

    if (verification.response) {
      return verification.response;
    }

    const payload =
      (await request.json()) as CompanyGraymillsClassificationPayload;

    const classificationId = cleanText(payload.classificationId);
    const companyIds = cleanTextArray(payload.companyIds);
    const categoryId = cleanText(payload.categoryId);
    const industryId = cleanText(payload.industryId);
    const subIndustryId = cleanText(payload.subIndustryId);
    const removeCategory = payload.removeCategory === true;

    if (companyIds.length === 0) {
      return NextResponse.json(
        { error: "At least one companyId is required." },
        { status: 400 }
      );
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: "Select a Graymills Category." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: writableCompanies, error: companyAccessError } =
      await supabase
        .from("companies")
        .select("id, assigned_salesperson_id")
        .in("id", companyIds);

    if (companyAccessError) throw companyAccessError;

    if ((writableCompanies ?? []).length !== companyIds.length) {
      return NextResponse.json(
        {
          error:
            "One or more selected companies could not be found.",
        },
        { status: 404 }
      );
    }

    if (
      verification.context.crmRole === "sales_rep" &&
      (writableCompanies ?? []).some(
        (company: any) =>
          String(company.assigned_salesperson_id || "") !==
          String(verification.context.crmUserId)
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Sales Rep users can change Graymills classification only for companies assigned to them as Salesperson / Rep.",
        },
        { status: 403 }
      );
    }

    const { data: category, error: categoryError } = await supabase
      .from("graymills_category_definitions")
      .select("id, category_key, category_name, status")
      .eq("id", categoryId)
      .eq("status", "active")
      .maybeSingle();

    if (categoryError) throw categoryError;

    if (!category) {
      return NextResponse.json(
        { error: "Select an active Graymills Category." },
        { status: 400 }
      );
    }

    if (removeCategory) {
      const { error: deleteError } = await supabase
        .from("company_graymills_classifications")
        .delete()
        .in("company_id", companyIds)
        .eq("graymills_category_id", category.id);

      if (deleteError) throw deleteError;

      return NextResponse.json({
        status: "removed",
        requestedCount: companyIds.length,
        updatedCount: companyIds.length,
        category,
      });
    }

    let industry = null;

    if (industryId) {
      const { data, error } = await supabase
        .from("company_industry_definitions")
        .select(
          "id, graymills_category_id, industry_name, status"
        )
        .eq("id", industryId)
        .eq("status", "active")
        .maybeSingle();

      if (error) throw error;
      industry = data;

      if (
        !industry ||
        industry.graymills_category_id !== category.id
      ) {
        return NextResponse.json(
          {
            error:
              "Select an active Industry that belongs to the chosen Graymills Category.",
          },
          { status: 400 }
        );
      }
    }

    let subIndustry = null;

    if (subIndustryId) {
      if (!industry) {
        return NextResponse.json(
          {
            error:
              "Select an Industry before selecting a Sub-Industry.",
          },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("company_sub_industry_definitions")
        .select("id, industry_id, sub_industry_name, status")
        .eq("id", subIndustryId)
        .eq("status", "active")
        .maybeSingle();

      if (error) throw error;
      subIndustry = data;

      if (!subIndustry || subIndustry.industry_id !== industry.id) {
        return NextResponse.json(
          {
            error:
              "Select an active Sub-Industry that belongs to the chosen Industry.",
          },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    let savedClassifications: any[] = [];

    if (classificationId) {
      if (companyIds.length !== 1) {
        return NextResponse.json(
          {
            error:
              "Editing an existing Graymills classification requires exactly one company.",
          },
          { status: 400 }
        );
      }

      const companyId = companyIds[0];

      const { data: existingClassification, error: existingError } =
        await supabase
          .from("company_graymills_classifications")
          .select("id, company_id, graymills_category_id")
          .eq("id", classificationId)
          .eq("company_id", companyId)
          .maybeSingle();

      if (existingError) throw existingError;

      if (!existingClassification) {
        return NextResponse.json(
          {
            error:
              "Graymills classification not found for this company.",
          },
          { status: 404 }
        );
      }

      if (
        existingClassification.graymills_category_id !== category.id
      ) {
        const {
          data: conflictingClassification,
          error: conflictError,
        } = await supabase
          .from("company_graymills_classifications")
          .select("id")
          .eq("company_id", companyId)
          .eq("graymills_category_id", category.id)
          .neq("id", classificationId)
          .maybeSingle();

        if (conflictError) throw conflictError;

        if (conflictingClassification) {
          return NextResponse.json(
            {
              error:
                "This company already has a classification for the selected Graymills Category.",
            },
            { status: 409 }
          );
        }
      }

      const { data: updatedRows, error: updateError } = await supabase
        .from("company_graymills_classifications")
        .update({
          graymills_category_id: category.id,
          industry_id: industry?.id ?? null,
          sub_industry_id: subIndustry?.id ?? null,
          updated_at: now,
        })
        .eq("id", classificationId)
        .eq("company_id", companyId)
        .select(
          "id, company_id, graymills_category_id, industry_id, sub_industry_id, created_at, updated_at"
        );

      if (updateError) throw updateError;
      savedClassifications = updatedRows ?? [];
    } else {
      const rows = companyIds.map((companyId) => ({
        company_id: companyId,
        graymills_category_id: category.id,
        industry_id: industry?.id ?? null,
        sub_industry_id: subIndustry?.id ?? null,
        updated_at: now,
      }));

      const { data: upsertedRows, error: upsertError } =
        await supabase
          .from("company_graymills_classifications")
          .upsert(rows, {
            onConflict: "company_id,graymills_category_id",
          })
          .select(
            "id, company_id, graymills_category_id, industry_id, sub_industry_id, created_at, updated_at"
          );

      if (upsertError) throw upsertError;
      savedClassifications = upsertedRows ?? [];
    }

    return NextResponse.json({
      status: "updated",
      requestedCount: companyIds.length,
      updatedCount: savedClassifications.length,
      category,
      industry,
      subIndustry,
      classifications: savedClassifications,
      verifiedUser: {
        crmUserId: verification.context.crmUserId,
        displayName: verification.context.crmDisplayName,
        role: verification.context.crmRole,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to update Graymills company classification."
        ),
      },
      { status: 500 }
    );
  }
}
