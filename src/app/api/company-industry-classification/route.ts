import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInAdmin } from "../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type CompanyIndustryClassificationPayload = {
  companyIds?: string[];
  primaryIndustry?: string | null;
  primarySubIndustry?: string | null;
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

export async function PATCH(request: Request) {
  try {
    const verification = await verifySignedInAdmin(request);

    if (verification.response) {
      return verification.response;
    }

    const payload =
      (await request.json()) as CompanyIndustryClassificationPayload;

    const companyIds = cleanTextArray(payload.companyIds);

    if (companyIds.length === 0) {
      return NextResponse.json(
        { error: "At least one companyId is required." },
        { status: 400 }
      );
    }

    const hasPrimaryIndustry = Object.prototype.hasOwnProperty.call(
      payload,
      "primaryIndustry"
    );
    const hasPrimarySubIndustry = Object.prototype.hasOwnProperty.call(
      payload,
      "primarySubIndustry"
    );

    if (!hasPrimaryIndustry && !hasPrimarySubIndustry) {
      return NextResponse.json(
        {
          error:
            "Provide primaryIndustry and/or primarySubIndustry for bulk classification.",
        },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (hasPrimaryIndustry) {
      update.primary_industry = cleanText(payload.primaryIndustry);
    }

    if (hasPrimarySubIndustry) {
      update.primary_sub_industry = cleanText(payload.primarySubIndustry);
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("companies")
      .update(update)
      .in("id", companyIds)
      .select("id, primary_industry, primary_sub_industry");

    if (error) throw error;

    return NextResponse.json({
      status: "updated",
      requestedCount: companyIds.length,
      updatedCount: data?.length ?? 0,
      companies: data ?? [],
      verifiedAdmin: {
        crmUserId: verification.context.crmUserId,
        displayName: verification.context.crmDisplayName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to update company industry classification."
        ),
      },
      { status: 500 }
    );
  }
}
