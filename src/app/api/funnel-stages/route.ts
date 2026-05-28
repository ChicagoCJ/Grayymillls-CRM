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
      .from("sales_funnel_stages")
      .select("*")
      .eq("status", "active")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      stages: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load funnel stages.",
      },
      { status: 500 }
    );
  }
}