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

    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select(
        `
        id,
        company_name,
        website,
        domain,
        industry,
        employee_count,
        company_phone,
        city,
        state,
        status,
        created_at,
        prospects (
          id,
          priority_score,
          priority_tier,
          fit_rating,
          confidence,
          likely_product_path,
          next_best_action,
          stage,
          status
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (companiesError) throw companiesError;

    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select(
        `
        id,
        company_id,
        first_name,
        last_name,
        full_name,
        title,
        management_level,
        department,
        function_area,
        email,
        direct_phone,
        mobile_phone,
        created_at,
        companies (
          company_name
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (contactsError) throw contactsError;

    const { data: imports, error: importsError } = await supabase
      .from("imports")
      .select(
        `
        id,
        file_name,
        source,
        row_count,
        processed_count,
        duplicate_count,
        error_count,
        status,
        created_at
      `
      )
      .order("created_at", { ascending: false })
      .limit(20);

    if (importsError) throw importsError;

    return NextResponse.json({
      companies: companies ?? [],
      contacts: contacts ?? [],
      imports: imports ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load CRM summary.",
      },
      { status: 500 }
    );
  }
}