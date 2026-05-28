import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("companies")
      .select(
        `
        id,
        assigned_user_id,
        crm_users (
          id,
          display_name,
          role_name,
          user_role,
          status
        )
      `
      );

    if (error) throw error;

    const companyOwners = (data ?? []).map((company) => ({
      company_id: company.id,
      assigned_user_id: company.assigned_user_id,
      crm_users: company.crm_users ?? null,
    }));

    return NextResponse.json({
      companyOwners,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load company owner summary.",
      },
      { status: 500 }
    );
  }
}