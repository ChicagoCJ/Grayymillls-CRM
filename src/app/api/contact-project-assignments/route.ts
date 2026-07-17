import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInAdmin } from "../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();

  return cleaned.length > 0 ? cleaned : null;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type ContactProjectAssignmentPayload = {
  contactId?: string;
  projectId?: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = cleanText(searchParams.get("contactId"));

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("contact_project_assignments")
      .select(
        "id, contact_id, project_id, created_at, crm_projects(id, project_name, project_kind, description, owner_user_id, sort_order, status)"
      )
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      contactProjectAssignments: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to load contact Project / List assignments."
        ),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const verification = await verifySignedInAdmin(request);

    if (verification.response) {
      return verification.response;
    }

    const payload =
      (await request.json()) as ContactProjectAssignmentPayload;

    const contactId = cleanText(payload.contactId);
    const projectId = cleanText(payload.projectId);

    if (!contactId || !projectId) {
      return NextResponse.json(
        { error: "contactId and projectId are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("contact_project_assignments")
      .upsert(
        {
          contact_id: contactId,
          project_id: projectId,
        },
        {
          onConflict: "project_id,contact_id",
        }
      )
      .select(
        "id, contact_id, project_id, created_at, crm_projects(id, project_name, project_kind, description, owner_user_id, sort_order, status)"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "added",
      contactProjectAssignment: data,
      verifiedAdmin: {
        crmUserId: verification.context.crmUserId,
        displayName: verification.context.crmDisplayName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to add contact Project / List assignment."
        ),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const verification = await verifySignedInAdmin(request);

    if (verification.response) {
      return verification.response;
    }

    const payload =
      (await request.json()) as ContactProjectAssignmentPayload;

    const contactId = cleanText(payload.contactId);
    const projectId = cleanText(payload.projectId);

    if (!contactId || !projectId) {
      return NextResponse.json(
        { error: "contactId and projectId are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("contact_project_assignments")
      .delete()
      .eq("contact_id", contactId)
      .eq("project_id", projectId);

    if (error) throw error;

    return NextResponse.json({
      status: "removed",
      verifiedAdmin: {
        crmUserId: verification.context.crmUserId,
        displayName: verification.context.crmDisplayName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to remove contact Project / List assignment."
        ),
      },
      { status: 500 }
    );
  }
}
