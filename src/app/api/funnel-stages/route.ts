import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { enforceApiPermission } from "../_shared/permissions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type FunnelStagePayload = {
  id?: string;
  stageName?: string;
  stageKey?: string;
  description?: string | null;
  sortOrder?: number | string | null;
  defaultProbability?: number | string | null;
  isOpenStage?: boolean;
  isWonStage?: boolean;
  isLostStage?: boolean;
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

function makeStageKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cleanSortOrder(value: unknown) {
  if (value === null || value === undefined || value === "") return 100;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.round(numberValue) : 100;
}

function cleanProbability(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, Math.min(100, Math.round(numberValue)));
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    let query = supabase
      .from("sales_funnel_stages")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("stage_name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("status", "active");
    }

    const { data, error } = await query;

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

export async function POST(request: Request) {
  try {
    const permission = enforceApiPermission(request, "manage_funnel_stage_definition");
    if (permission.response) return permission.response;

    const supabase = getSupabaseAdmin();
    const payload = (await request.json()) as FunnelStagePayload;

    const stageName = cleanText(payload.stageName);

    if (!stageName) {
      return NextResponse.json({ error: "stageName is required." }, { status: 400 });
    }

    const stageKey = cleanText(payload.stageKey) || makeStageKey(stageName);

    if (!stageKey) {
      return NextResponse.json({ error: "stageKey is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("sales_funnel_stages")
      .insert({
        stage_name: stageName,
        stage_key: stageKey,
        description: cleanText(payload.description),
        sort_order: cleanSortOrder(payload.sortOrder),
        default_probability: cleanProbability(payload.defaultProbability),
        is_open_stage: payload.isOpenStage ?? true,
        is_won_stage: payload.isWonStage ?? false,
        is_lost_stage: payload.isLostStage ?? false,
        status: payload.status || "active",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "created",
      stage: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create funnel stage.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const permission = enforceApiPermission(request, "manage_funnel_stage_definition");
    if (permission.response) return permission.response;

    const supabase = getSupabaseAdmin();
    const payload = (await request.json()) as FunnelStagePayload;

    if (!payload.id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.stageName !== undefined) {
      const stageName = cleanText(payload.stageName);

      if (!stageName) {
        return NextResponse.json({ error: "stageName cannot be blank." }, { status: 400 });
      }

      update.stage_name = stageName;
    }

    if (payload.stageKey !== undefined) {
      const stageKey = cleanText(payload.stageKey);

      if (!stageKey) {
        return NextResponse.json({ error: "stageKey cannot be blank." }, { status: 400 });
      }

      update.stage_key = makeStageKey(stageKey);
    }

    if (payload.description !== undefined) update.description = cleanText(payload.description);
    if (payload.sortOrder !== undefined) update.sort_order = cleanSortOrder(payload.sortOrder);
    if (payload.defaultProbability !== undefined) {
      update.default_probability = cleanProbability(payload.defaultProbability);
    }

    if (payload.isOpenStage !== undefined) update.is_open_stage = payload.isOpenStage;
    if (payload.isWonStage !== undefined) update.is_won_stage = payload.isWonStage;
    if (payload.isLostStage !== undefined) update.is_lost_stage = payload.isLostStage;

    if (payload.status !== undefined) {
      update.status = payload.status;
      update.archived_at = payload.status === "archived" ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from("sales_funnel_stages")
      .update(update)
      .eq("id", payload.id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "updated",
      stage: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update funnel stage.",
      },
      { status: 500 }
    );
  }
}




