import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type SavedFunnelViewPayload = {
  id?: string;
  viewName?: string;
  isDefault?: boolean;
  viewMode?: "board" | "list";
  cardDensity?: "comfortable" | "compact";
  statusFilter?: string;
  stageFilter?: string;
  typeFilter?: string;
  searchTerm?: string;
  sortOrder?: number | string;
};

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

function cleanRequiredText(value: unknown, fieldName: string, maxLength = 120) {
  const cleaned = String(value || "").trim();

  if (!cleaned) {
    throw new Error(`${fieldName} is required.`);
  }

  if (cleaned.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or fewer.`);
  }

  return cleaned;
}

function cleanOptionalText(value: unknown, maxLength = 500) {
  const cleaned = String(value || "").trim();

  if (cleaned.length > maxLength) {
    throw new Error(`Text must be ${maxLength} characters or fewer.`);
  }

  return cleaned;
}

function cleanViewMode(value: unknown) {
  return value === "list" ? "list" : "board";
}

function cleanCardDensity(value: unknown) {
  return value === "compact" ? "compact" : "comfortable";
}

function cleanSortOrder(value: unknown) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : 100;

  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 100000) {
    throw new Error("sortOrder must be a whole number from 0 through 100000.");
  }

  return numeric;
}

function getErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return "";
}

function duplicateNameResponse() {
  return NextResponse.json(
    { error: "A saved Funnel view with that name already exists." },
    { status: 409 }
  );
}

async function clearExistingDefault(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  crmUserId: string,
  excludedId?: string
) {
  let query = supabase
    .from("saved_funnel_views")
    .update({
      is_default: false,
      updated_at: new Date().toISOString(),
    })
    .eq("crm_user_id", crmUserId)
    .eq("is_default", true);

  if (excludedId) {
    query = query.neq("id", excludedId);
  }

  const { error } = await query;
  if (error) throw error;
}

const savedViewSelect = [
  "id",
  "crm_user_id",
  "view_name",
  "is_default",
  "view_mode",
  "card_density",
  "status_filter",
  "stage_filter",
  "type_filter",
  "search_term",
  "sort_order",
  "created_at",
  "updated_at",
].join(", ");

export async function GET(request: Request) {
  const verification = await verifySignedInCrmUser(request);
  if (verification.response) return verification.response;

  try {
    const supabase = getSupabaseAdmin();
    const { crmUserId, crmDisplayName } = verification.context;

    const { data, error } = await supabase
      .from("saved_funnel_views")
      .select(savedViewSelect)
      .eq("crm_user_id", crmUserId)
      .order("is_default", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("view_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      savedViews: data ?? [],
      signedInUser: {
        id: crmUserId,
        displayName: crmDisplayName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load saved Funnel views.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const verification = await verifySignedInCrmUser(request);
  if (verification.response) return verification.response;

  try {
    const payload = (await request.json()) as SavedFunnelViewPayload;
    const supabase = getSupabaseAdmin();
    const { crmUserId, crmDisplayName } = verification.context;

    const viewName = cleanRequiredText(payload.viewName, "viewName");
    const isDefault = payload.isDefault === true;

    if (isDefault) {
      await clearExistingDefault(supabase, crmUserId);
    }

    const { data, error } = await supabase
      .from("saved_funnel_views")
      .insert({
        crm_user_id: crmUserId,
        view_name: viewName,
        is_default: isDefault,
        view_mode: cleanViewMode(payload.viewMode),
        card_density: cleanCardDensity(payload.cardDensity),
        status_filter: cleanOptionalText(payload.statusFilter || "open", 80) || "open",
        stage_filter: cleanOptionalText(payload.stageFilter || "All", 120) || "All",
        type_filter: cleanOptionalText(payload.typeFilter || "All", 120) || "All",
        search_term: cleanOptionalText(payload.searchTerm || "", 500),
        sort_order: cleanSortOrder(payload.sortOrder),
        updated_at: new Date().toISOString(),
      })
      .select(savedViewSelect)
      .single();

    if (error) {
      if (getErrorCode(error) === "23505") return duplicateNameResponse();
      throw error;
    }

    return NextResponse.json({
      status: "created",
      savedView: data,
      createdBy: {
        id: crmUserId,
        displayName: crmDisplayName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create the saved Funnel view.",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const verification = await verifySignedInCrmUser(request);
  if (verification.response) return verification.response;

  try {
    const payload = (await request.json()) as SavedFunnelViewPayload;
    const supabase = getSupabaseAdmin();
    const { crmUserId, crmDisplayName } = verification.context;
    const id = cleanRequiredText(payload.id, "id");

    const { data: existingView, error: existingViewError } = await supabase
      .from("saved_funnel_views")
      .select(savedViewSelect)
      .eq("id", id)
      .eq("crm_user_id", crmUserId)
      .maybeSingle();

    if (existingViewError) throw existingViewError;

    if (!existingView) {
      return NextResponse.json(
        { error: "Saved Funnel view not found." },
        { status: 404 }
      );
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.viewName !== undefined) {
      update.view_name = cleanRequiredText(payload.viewName, "viewName");
    }

    if (payload.isDefault !== undefined) {
      update.is_default = payload.isDefault === true;

      if (payload.isDefault === true) {
        await clearExistingDefault(supabase, crmUserId, id);
      }
    }

    if (payload.viewMode !== undefined) {
      update.view_mode = cleanViewMode(payload.viewMode);
    }

    if (payload.cardDensity !== undefined) {
      update.card_density = cleanCardDensity(payload.cardDensity);
    }

    if (payload.statusFilter !== undefined) {
      update.status_filter =
        cleanOptionalText(payload.statusFilter, 80) || "open";
    }

    if (payload.stageFilter !== undefined) {
      update.stage_filter =
        cleanOptionalText(payload.stageFilter, 120) || "All";
    }

    if (payload.typeFilter !== undefined) {
      update.type_filter =
        cleanOptionalText(payload.typeFilter, 120) || "All";
    }

    if (payload.searchTerm !== undefined) {
      update.search_term = cleanOptionalText(payload.searchTerm, 500);
    }

    if (payload.sortOrder !== undefined) {
      update.sort_order = cleanSortOrder(payload.sortOrder);
    }

    if (Object.keys(update).length === 1) {
      return NextResponse.json(
        { error: "No supported saved-view changes were provided." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("saved_funnel_views")
      .update(update)
      .eq("id", id)
      .eq("crm_user_id", crmUserId)
      .select(savedViewSelect)
      .single();

    if (error) {
      if (getErrorCode(error) === "23505") return duplicateNameResponse();
      throw error;
    }

    return NextResponse.json({
      status: "updated",
      savedView: data,
      updatedBy: {
        id: crmUserId,
        displayName: crmDisplayName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update the saved Funnel view.",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const verification = await verifySignedInCrmUser(request);
  if (verification.response) return verification.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = cleanRequiredText(searchParams.get("id"), "id");
    const supabase = getSupabaseAdmin();
    const { crmUserId, crmDisplayName } = verification.context;

    const { data: existingView, error: existingViewError } = await supabase
      .from("saved_funnel_views")
      .select("id, view_name, is_default")
      .eq("id", id)
      .eq("crm_user_id", crmUserId)
      .maybeSingle();

    if (existingViewError) throw existingViewError;

    if (!existingView) {
      return NextResponse.json(
        { error: "Saved Funnel view not found." },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("saved_funnel_views")
      .delete()
      .eq("id", id)
      .eq("crm_user_id", crmUserId);

    if (error) throw error;

    return NextResponse.json({
      status: "deleted",
      deletedView: {
        id: existingView.id,
        viewName: existingView.view_name,
        wasDefault: Boolean(existingView.is_default),
      },
      deletedBy: {
        id: crmUserId,
        displayName: crmDisplayName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete the saved Funnel view.",
      },
      { status: 400 }
    );
  }
}
