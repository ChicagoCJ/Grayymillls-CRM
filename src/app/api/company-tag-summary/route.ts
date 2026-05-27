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
      .from("company_tags")
      .select(
        `
        id,
        company_id,
        tag_id,
        created_at,
        crm_tags (
          id,
          tag_name,
          tag_type,
          description,
          color,
          sort_order,
          status
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      companyTags: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load company tag summary.",
      },
      { status: 500 }
    );
  }
}