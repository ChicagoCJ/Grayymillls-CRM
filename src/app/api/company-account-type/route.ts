import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VALID_ACCOUNT_TYPES = new Set(["End Customer", "Distributor", "Unknown"]);

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      companyId?: unknown;
      accountType?: unknown;
    };

    const companyId = String(payload.companyId || "").trim();
    const accountType = String(payload.accountType || "").trim();

    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId." }, { status: 400 });
    }

    if (!VALID_ACCOUNT_TYPES.has(accountType)) {
      return NextResponse.json({ error: "Invalid accountType." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("companies")
      .update({ account_type: accountType })
      .eq("id", companyId)
      .select("id, account_type")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ company: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
