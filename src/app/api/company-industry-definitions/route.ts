import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type DefinitionStatus = "active" | "archived";

type IndustryDefinitionPayload = {
  action?:
    | "createIndustry"
    | "updateIndustry"
    | "createSubIndustry"
    | "updateSubIndustry";
  id?: string;
  categoryId?: string | null;
  industryId?: string | null;
  name?: string;
  sortOrder?: number;
  status?: DefinitionStatus;
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
  if (typeof value !== "string") return "";
  return value.trim();
}

function cleanNullableText(value: unknown) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function cleanSortOrder(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : 100;
}

function cleanStatus(value: unknown): DefinitionStatus {
  return value === "archived" ? "archived" : "active";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  ) {
    return "That managed Industry or Sub-Industry value already exists under the selected parent.";
  }

  return error instanceof Error ? error.message : fallback;
}

async function verifyManagerAccess(request: Request) {
  const verification = await verifySignedInCrmUser(request);

  if (verification.response) {
    return verification;
  }

  const role = verification.context.crmRole;

  if (role !== "admin" && role !== "sales_manager") {
    return {
      context: null,
      response: NextResponse.json(
        {
          error:
            "Only signed-in CRM Admin or Sales Manager users can manage Graymills Industry definitions.",
        },
        { status: 403 }
      ),
    };
  }

  return verification;
}

async function getActiveCategory(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  categoryId: string
) {
  const { data, error } = await supabase
    .from("graymills_category_definitions")
    .select("id, category_key, category_name, sort_order, status")
    .eq("id", categoryId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getIndustry(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  industryId: string
) {
  const { data, error } = await supabase
    .from("company_industry_definitions")
    .select(
      "id, graymills_category_id, industry_name, sort_order, status"
    )
    .eq("id", industryId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function GET(request: Request) {
  try {
    const verification = await verifySignedInCrmUser(request);

    if (verification.response) {
      return verification.response;
    }

    const supabase = getSupabaseAdmin();

    const [
      { data: categories, error: categoriesError },
      { data: industries, error: industriesError },
      { data: subIndustries, error: subIndustriesError },
    ] = await Promise.all([
      supabase
        .from("graymills_category_definitions")
        .select(
          "id, category_key, category_name, sort_order, status, created_at, updated_at"
        )
        .order("sort_order", { ascending: true })
        .order("category_name", { ascending: true }),
      supabase
        .from("company_industry_definitions")
        .select(
          "id, graymills_category_id, industry_name, sort_order, status, created_at, updated_at"
        )
        .order("sort_order", { ascending: true })
        .order("industry_name", { ascending: true }),
      supabase
        .from("company_sub_industry_definitions")
        .select(
          "id, industry_id, sub_industry_name, sort_order, status, created_at, updated_at"
        )
        .order("sort_order", { ascending: true })
        .order("sub_industry_name", { ascending: true }),
    ]);

    if (categoriesError) throw categoriesError;
    if (industriesError) throw industriesError;
    if (subIndustriesError) throw subIndustriesError;

    return NextResponse.json({
      categories: categories ?? [],
      industries: industries ?? [],
      subIndustries: subIndustries ?? [],
      canManage:
        verification.context.crmRole === "admin" ||
        verification.context.crmRole === "sales_manager",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to load Graymills Category / Industry definitions."
        ),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const verification = await verifyManagerAccess(request);

    if (verification.response) {
      return verification.response;
    }

    const payload = (await request.json()) as IndustryDefinitionPayload;
    const action = cleanText(payload.action);
    const name = cleanText(payload.name);
    const supabase = getSupabaseAdmin();

    if (action === "createIndustry") {
      const categoryId = cleanNullableText(payload.categoryId);

      if (!categoryId) {
        return NextResponse.json(
          { error: "Select a Graymills Category for the new Industry." },
          { status: 400 }
        );
      }

      if (!name) {
        return NextResponse.json(
          { error: "Industry name is required." },
          { status: 400 }
        );
      }

      const category = await getActiveCategory(supabase, categoryId);

      if (!category) {
        return NextResponse.json(
          { error: "Select an active Graymills Category." },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("company_industry_definitions")
        .insert({
          graymills_category_id: category.id,
          industry_name: name,
          sort_order: cleanSortOrder(payload.sortOrder),
          status: cleanStatus(payload.status),
          updated_at: new Date().toISOString(),
        })
        .select(
          "id, graymills_category_id, industry_name, sort_order, status"
        )
        .single();

      if (error) throw error;

      return NextResponse.json({
        status: "created",
        type: "industry",
        definition: data,
      });
    }

    if (action === "createSubIndustry") {
      const industryId = cleanNullableText(payload.industryId);

      if (!industryId) {
        return NextResponse.json(
          { error: "Select a parent Industry for the new Sub-Industry." },
          { status: 400 }
        );
      }

      if (!name) {
        return NextResponse.json(
          { error: "Sub-Industry name is required." },
          { status: 400 }
        );
      }

      const industry = await getIndustry(supabase, industryId);

      if (
        !industry ||
        industry.status !== "active" ||
        !industry.graymills_category_id
      ) {
        return NextResponse.json(
          {
            error:
              "Select an active Industry that belongs to a Graymills Category.",
          },
          { status: 400 }
        );
      }

      const category = await getActiveCategory(
        supabase,
        industry.graymills_category_id
      );

      if (!category) {
        return NextResponse.json(
          { error: "The parent Industry belongs to an inactive Category." },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("company_sub_industry_definitions")
        .insert({
          industry_id: industry.id,
          sub_industry_name: name,
          sort_order: cleanSortOrder(payload.sortOrder),
          status: cleanStatus(payload.status),
          updated_at: new Date().toISOString(),
        })
        .select(
          "id, industry_id, sub_industry_name, sort_order, status"
        )
        .single();

      if (error) throw error;

      return NextResponse.json({
        status: "created",
        type: "subIndustry",
        definition: data,
      });
    }

    return NextResponse.json(
      { error: "Unsupported create action." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to create Graymills Industry definition."
        ),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const verification = await verifyManagerAccess(request);

    if (verification.response) {
      return verification.response;
    }

    const payload = (await request.json()) as IndustryDefinitionPayload;
    const action = cleanText(payload.action);
    const id = cleanText(payload.id);
    const supabase = getSupabaseAdmin();

    if (!id) {
      return NextResponse.json(
        { error: "A definition id is required." },
        { status: 400 }
      );
    }

    if (action === "updateIndustry") {
      const existing = await getIndustry(supabase, id);

      if (!existing) {
        return NextResponse.json(
          { error: "Industry definition not found." },
          { status: 404 }
        );
      }

      const update: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (Object.prototype.hasOwnProperty.call(payload, "categoryId")) {
        const nextCategoryId = cleanNullableText(payload.categoryId);

        if (!nextCategoryId) {
          return NextResponse.json(
            { error: "Graymills Category cannot be blank." },
            { status: 400 }
          );
        }

        const category = await getActiveCategory(supabase, nextCategoryId);

        if (!category) {
          return NextResponse.json(
            { error: "Select an active Graymills Category." },
            { status: 400 }
          );
        }

        if (
          existing.graymills_category_id &&
          existing.graymills_category_id !== category.id
        ) {
          const { count, error: usageError } = await supabase
            .from("company_graymills_classifications")
            .select("id", { count: "exact", head: true })
            .eq("industry_id", existing.id);

          if (usageError) throw usageError;

          if ((count ?? 0) > 0) {
            return NextResponse.json(
              {
                error:
                  "This Industry is already used by company classifications. Remove or change those classifications before moving the Industry to another Graymills Category.",
              },
              { status: 409 }
            );
          }
        }

        update.graymills_category_id = category.id;
      }

      if (Object.prototype.hasOwnProperty.call(payload, "name")) {
        const nextName = cleanText(payload.name);

        if (!nextName) {
          return NextResponse.json(
            { error: "Industry name cannot be blank." },
            { status: 400 }
          );
        }

        update.industry_name = nextName;
      }

      if (Object.prototype.hasOwnProperty.call(payload, "sortOrder")) {
        update.sort_order = cleanSortOrder(payload.sortOrder);
      }

      if (Object.prototype.hasOwnProperty.call(payload, "status")) {
        update.status = cleanStatus(payload.status);
      }

      const { data, error } = await supabase
        .from("company_industry_definitions")
        .update(update)
        .eq("id", id)
        .select(
          "id, graymills_category_id, industry_name, sort_order, status"
        )
        .single();

      if (error) throw error;

      return NextResponse.json({
        status: "updated",
        type: "industry",
        definition: data,
      });
    }

    if (action === "updateSubIndustry") {
      const { data: existing, error: existingError } = await supabase
        .from("company_sub_industry_definitions")
        .select(
          "id, industry_id, sub_industry_name, sort_order, status"
        )
        .eq("id", id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (!existing) {
        return NextResponse.json(
          { error: "Sub-Industry definition not found." },
          { status: 404 }
        );
      }

      const update: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (Object.prototype.hasOwnProperty.call(payload, "name")) {
        const nextName = cleanText(payload.name);

        if (!nextName) {
          return NextResponse.json(
            { error: "Sub-Industry name cannot be blank." },
            { status: 400 }
          );
        }

        update.sub_industry_name = nextName;
      }

      if (Object.prototype.hasOwnProperty.call(payload, "sortOrder")) {
        update.sort_order = cleanSortOrder(payload.sortOrder);
      }

      if (Object.prototype.hasOwnProperty.call(payload, "status")) {
        update.status = cleanStatus(payload.status);
      }

      const { data, error } = await supabase
        .from("company_sub_industry_definitions")
        .update(update)
        .eq("id", id)
        .select(
          "id, industry_id, sub_industry_name, sort_order, status"
        )
        .single();

      if (error) throw error;

      return NextResponse.json({
        status: "updated",
        type: "subIndustry",
        definition: data,
      });
    }

    return NextResponse.json(
      { error: "Unsupported update action." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to update Graymills Industry definition."
        ),
      },
      { status: 500 }
    );
  }
}
