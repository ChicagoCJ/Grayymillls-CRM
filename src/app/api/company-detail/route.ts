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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("id");

    if (!companyId) {
      return NextResponse.json(
        { error: "Missing company id." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (companyError) throw companyError;

    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("*")
      .eq("company_id", companyId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });

    if (contactsError) throw contactsError;

    const { data: prospects, error: prospectsError } = await supabase
      .from("prospects")
      .select("*")
      .eq("company_id", companyId)
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: false });

    if (prospectsError) throw prospectsError;

    const primaryProspect = prospects?.[0] ?? null;

    let intelligence = null;

    if (primaryProspect) {
      const { data: intelligenceData, error: intelligenceError } = await supabase
        .from("prospect_intelligence")
        .select("*")
        .eq("prospect_id", primaryProspect.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (intelligenceError) throw intelligenceError;

      intelligence = intelligenceData;
    }

    return NextResponse.json({
      company,
      contacts: contacts ?? [],
      prospects: prospects ?? [],
      primaryProspect,
      intelligence,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load company detail.",
      },
      { status: 500 }
    );
  }
}