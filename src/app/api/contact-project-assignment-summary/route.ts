import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("contact_project_assignments")
      .select(
        "id, contact_id, project_id, created_at, crm_projects(id, project_name, project_kind, description, owner_user_id, sort_order, status)"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      contactProjectAssignments: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to load contact Project / List assignment summary."
        ),
      },
      { status: 500 }
    );
  }
}
