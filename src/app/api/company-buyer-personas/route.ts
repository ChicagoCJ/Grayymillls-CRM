import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VALID_BUYER_PERSONAS = new Set([
  "Operations",
  "Maintenance",
  "Purchasing",
  "Quality / Process",
  "EHS / Safety",
  "Principal / Owner",
  "Outside Sales",
  "Product Specialist",
  "Inside Sales",
  "Discovery Needed",
]);

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
      buyerPersonas?: unknown;
    };

    const companyId = String(payload.companyId || "").trim();
    const buyerPersonas = Array.isArray(payload.buyerPersonas)
      ? payload.buyerPersonas.map((item) => String(item || "").trim()).filter(Boolean)
      : [];

    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId." }, { status: 400 });
    }

    if (!buyerPersonas.length) {
      return NextResponse.json({ error: "At least one buyer persona is required." }, { status: 400 });
    }

    const invalidPersona = buyerPersonas.find((persona) => !VALID_BUYER_PERSONAS.has(persona));

    if (invalidPersona) {
      return NextResponse.json({ error: `Invalid buyer persona: ${invalidPersona}` }, { status: 400 });
    }

    const normalizedBuyerPersonas = Array.from(new Set(buyerPersonas));

    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("companies")
      .update({ buyer_personas: normalizedBuyerPersonas })
      .eq("id", companyId)
      .select("id, buyer_personas")
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
