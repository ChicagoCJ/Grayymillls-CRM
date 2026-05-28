import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type TagPayload = {
  id?: string;
  tagName?: string;
  tagType?: "market" | "sector" | "category";
  description?: string | null;
  color?: string | null;
  sortOrder?: number | string | null;
  status?: string | null;
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
  return Number.isFinite(numberValue) ? Math.round(numberValue) : 100;
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    let query = supabase
      .from("crm_tags")
      .select("*")
      .order("tag_type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("tag_name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("status", "active");
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      tags: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load tags.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const payload = (await request.json()) as TagPayload;

    const tagName = cleanText(payload.tagName);

    if (!tagName) {
      return NextResponse.json({ error: "tagName is required." }, { status: 400 });
    }

    if (!payload.tagType || !["market", "sector", "category"].includes(payload.tagType)) {
      return NextResponse.json(
        { error: "tagType must be market, sector, or category." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("crm_tags")
      .insert({
        tag_name: tagName,
        tag_type: payload.tagType,
        description: cleanText(payload.description),
        color: cleanText(payload.color) || "blue",
        sort_order: cleanSortOrder(payload.sortOrder),
        status: cleanText(payload.status) || "active",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "created",
      tag: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create tag.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const payload = (await request.json()) as TagPayload;

    if (!payload.id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.tagName !== undefined) {
      const tagName = cleanText(payload.tagName);
      if (!tagName) {
        return NextResponse.json({ error: "tagName cannot be blank." }, { status: 400 });
      }
      update.tag_name = tagName;
    }

    if (payload.tagType !== undefined) {
      if (!["market", "sector", "category"].includes(payload.tagType)) {
        return NextResponse.json(
          { error: "tagType must be market, sector, or category." },
          { status: 400 }
        );
      }
      update.tag_type = payload.tagType;
    }

    if (payload.description !== undefined) update.description = cleanText(payload.description);
    if (payload.color !== undefined) update.color = cleanText(payload.color) || "blue";
    if (payload.sortOrder !== undefined) update.sort_order = cleanSortOrder(payload.sortOrder);

    if (payload.status !== undefined) {
      update.status = cleanText(payload.status) || "active";
      update.archived_at = update.status === "archived" ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from("crm_tags")
      .update(update)
      .eq("id", payload.id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "updated",
      tag: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update tag.",
      },
      { status: 500 }
    );
  }
}