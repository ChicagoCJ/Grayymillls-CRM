import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type TagPayload = {
  contactId?: string;
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
    const contactId = searchParams.get("contactId");

    if (!contactId) {
      return NextResponse.json({ error: "contactId is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("contact_tags")
      .select(
        `
        id,
        contact_id,
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
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      contactTags: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load contact tags.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as TagPayload;

    if (!payload.contactId || !payload.tagId) {
      return NextResponse.json(
        { error: "contactId and tagId are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("contact_tags")
      .upsert(
        {
          contact_id: payload.contactId,
          tag_id: payload.tagId,
        },
        {
          onConflict: "contact_id,tag_id",
        }
      )
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "added",
      contactTag: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add contact tag.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as TagPayload;

    if (!payload.contactId || !payload.tagId) {
      return NextResponse.json(
        { error: "contactId and tagId are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("contact_tags")
      .delete()
      .eq("contact_id", payload.contactId)
      .eq("tag_id", payload.tagId);

    if (error) throw error;

    return NextResponse.json({
      status: "removed",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to remove contact tag.",
      },
      { status: 500 }
    );
  }
}