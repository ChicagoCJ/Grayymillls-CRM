import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  ) {
    return "That Graymills Customer Number is already assigned to another company.";
  }

  return error instanceof Error ? error.message : fallback;
}

export async function PATCH(request: Request) {
  try {
    const verification = await verifySignedInCrmUser(request);

    if (verification.response) {
      return verification.response;
    }

    const payload = (await request.json()) as {
      companyId?: string;
      graymillsCustomerNumber?: string | null;
    };

    const companyId = cleanText(payload.companyId);
    const graymillsCustomerNumber = cleanText(
      payload.graymillsCustomerNumber
    );

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, assigned_salesperson_id")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) throw companyError;

    if (!company) {
      return NextResponse.json(
        { error: "Company not found." },
        { status: 404 }
      );
    }

    const role = verification.context.crmRole;
    const canEdit =
      role === "admin" ||
      role === "sales_manager" ||
      (role === "sales_rep" &&
        String(company.assigned_salesperson_id || "") ===
          String(verification.context.crmUserId));

    if (!canEdit) {
      return NextResponse.json(
        {
          error:
            "Sales Rep users can change Graymills Customer Number only for companies assigned to them as Salesperson / Rep.",
        },
        { status: 403 }
      );
    }

    const { data: updatedCompany, error: updateError } = await supabase
      .from("companies")
      .update({
        graymills_customer_number: graymillsCustomerNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", companyId)
      .select("id, graymills_customer_number")
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      status: "updated",
      companyId: updatedCompany.id,
      graymillsCustomerNumber:
        updatedCompany.graymills_customer_number ?? null,
      verifiedUser: {
        crmUserId: verification.context.crmUserId,
        displayName: verification.context.crmDisplayName,
        role: verification.context.crmRole,
      },
    });
  } catch (error) {
    const isDuplicate =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505";

    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to update Graymills Customer Number."
        ),
      },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}
