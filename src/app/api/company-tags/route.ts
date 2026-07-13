import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { enforceApiPermission } from "../_shared/permissions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type TagPayload = {
  companyId?: string;
  tagId?: string;
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

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("company_tags")
      .select(
        `
        id,
        company_id,
        tag_id,
        created_at,
        crm_tags (
          id,
          tag_name,
          tag_type,
          description,
          color,
          sort_order,
          status
        )
      `
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      companyTags: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load company tags.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const permission = enforceApiPermission(
    request,
    "manage_sales_activities"
  );

  if (permission.response) return permission.response;

  try {
    const payload = (await request.json()) as TagPayload;

    if (!payload.companyId || !payload.tagId) {
      return NextResponse.json(
        { error: "companyId and tagId are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("company_tags")
      .upsert(
        {
          company_id: payload.companyId,
          tag_id: payload.tagId,
        },
        {
          onConflict: "company_id,tag_id",
        }
      )
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "added",
      companyTag: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add company tag.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const permission = enforceApiPermission(
    request,
    "manage_sales_activities"
  );

  if (permission.response) return permission.response;

  try {
    const payload = (await request.json()) as TagPayload;

    if (!payload.companyId || !payload.tagId) {
      return NextResponse.json(
        { error: "companyId and tagId are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("company_tags")
      .delete()
      .eq("company_id", payload.companyId)
      .eq("tag_id", payload.tagId);

    if (error) throw error;

    return NextResponse.json({
      status: "removed",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to remove company tag.",
      },
      { status: 500 }
    );
  }
}