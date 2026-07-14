import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { enforceApiPermission } from "../_shared/permissions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type BuyerPersonaDefinitionPayload = {
  id?: string;
  personaName?: string;
  description?: string | null;
  sortOrder?: number | string | null;
  status?: "active" | "archived";
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

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();

  return cleaned.length > 0 ? cleaned : null;
}

function cleanSortOrder(value: unknown) {
  if (value === null || value === undefined || value === "") return 100;

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? Math.round(numberValue)
    : 100;
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    let query = supabase
      .from("buyer_persona_definitions")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("persona_name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("status", "active");
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      buyerPersonaDefinitions: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load buyer persona definitions.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const permission = enforceApiPermission(
      request,
      "manage_admin_settings"
    );

    if (permission.response) return permission.response;

    const payload =
      (await request.json()) as BuyerPersonaDefinitionPayload;

    const personaName = cleanText(payload.personaName);

    if (!personaName) {
      return NextResponse.json(
        { error: "personaName is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("buyer_persona_definitions")
      .insert({
        persona_name: personaName,
        description: cleanText(payload.description),
        sort_order: cleanSortOrder(payload.sortOrder),
        status: payload.status || "active",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "created",
      buyerPersonaDefinition: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create buyer persona definition.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const permission = enforceApiPermission(
      request,
      "manage_admin_settings"
    );

    if (permission.response) return permission.response;

    const payload =
      (await request.json()) as BuyerPersonaDefinitionPayload;

    if (!payload.id) {
      return NextResponse.json(
        { error: "id is required." },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.personaName !== undefined) {
      const personaName = cleanText(payload.personaName);

      if (!personaName) {
        return NextResponse.json(
          { error: "personaName cannot be blank." },
          { status: 400 }
        );
      }

      update.persona_name = personaName;
    }

    if (payload.description !== undefined) {
      update.description = cleanText(payload.description);
    }

    if (payload.sortOrder !== undefined) {
      update.sort_order = cleanSortOrder(payload.sortOrder);
    }

    if (payload.status !== undefined) {
      update.status = payload.status;
      update.archived_at =
        payload.status === "archived"
          ? new Date().toISOString()
          : null;
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("buyer_persona_definitions")
      .update(update)
      .eq("id", payload.id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "updated",
      buyerPersonaDefinition: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update buyer persona definition.",
      },
      { status: 500 }
    );
  }
}