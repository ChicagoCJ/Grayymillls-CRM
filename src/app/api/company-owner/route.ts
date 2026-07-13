import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { enforceApiPermission } from "../_shared/permissions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type CompanyOwnerPayload = {
  companyId?: string;
  assignedUserId?: string | null;
};

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

export async function PATCH(request: Request) {
  const permission = enforceApiPermission(
    request,
    "assign_sales_coverage"
  );

  if (permission.response) return permission.response;

  try {
    const supabase = getSupabaseAdmin();
    const payload = (await request.json()) as CompanyOwnerPayload;

    if (!payload.companyId) {
      return NextResponse.json({ error: "companyId is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("companies")
      .update({
        assigned_user_id: payload.assignedUserId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.companyId)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "updated",
      company: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update company owner.",
      },
      { status: 500 }
    );
  }
}