import { NextResponse } from "next/server";
import { enforceApiPermission } from "../_shared/permissions";
import { createClient } from "@supabase/supabase-js";

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
  const permission = enforceApiPermission(
    request,
    "manage_sales_activities"
  );

  if (permission.response) return permission.response;

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

    const normalizedBuyerPersonas = Array.from(new Set(buyerPersonas));

    const supabase = getSupabaseAdminClient();

    const { data: existingCompany, error: existingCompanyError } = await supabase
      .from("companies")
      .select("id, buyer_personas")
      .eq("id", companyId)
      .maybeSingle();

    if (existingCompanyError) {
      return NextResponse.json(
        { error: existingCompanyError.message },
        { status: 500 }
      );
    }

    if (!existingCompany) {
      return NextResponse.json(
        { error: "Company not found." },
        { status: 404 }
      );
    }

    const existingBuyerPersonaNames = new Set(
      Array.isArray(existingCompany.buyer_personas)
        ? existingCompany.buyer_personas
            .map((item: unknown) => String(item || "").trim())
            .filter(Boolean)
        : []
    );

    const { data: definitionRows, error: definitionError } = await supabase
      .from("buyer_persona_definitions")
      .select("persona_name")
      .in("persona_name", normalizedBuyerPersonas);

    if (definitionError) {
      return NextResponse.json(
        { error: definitionError.message },
        { status: 500 }
      );
    }

    const validPersonaNames = new Set(
      (definitionRows ?? []).map((row) => row.persona_name)
    );

    const invalidPersona = normalizedBuyerPersonas.find(
      (persona) =>
        !validPersonaNames.has(persona) &&
        !existingBuyerPersonaNames.has(persona)
    );

    if (invalidPersona) {
      return NextResponse.json(
        { error: `Invalid buyer persona: ${invalidPersona}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("companies")
      .update({ buyer_personas: normalizedBuyerPersonas })
      .eq("id", companyId)
      .select("id, buyer_personas")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    return NextResponse.json({ company: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
