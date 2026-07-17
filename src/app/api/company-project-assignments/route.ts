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

type CompanyProjectAssignmentPayload = {
  companyId?: string;
  projectId?: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = cleanText(searchParams.get("companyId"));

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("company_project_assignments")
      .select(
        "id, company_id, project_id, created_at, crm_projects(id, project_name, project_kind, description, owner_user_id, sort_order, status)"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      companyProjectAssignments: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to load company Project / List assignments."
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
      (await request.json()) as CompanyProjectAssignmentPayload;

    const companyId = cleanText(payload.companyId);
    const projectId = cleanText(payload.projectId);

    if (!companyId || !projectId) {
      return NextResponse.json(
        { error: "companyId and projectId are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("company_project_assignments")
      .upsert(
        {
          company_id: companyId,
          project_id: projectId,
        },
        {
          onConflict: "project_id,company_id",
        }
      )
      .select(
        "id, company_id, project_id, created_at, crm_projects(id, project_name, project_kind, description, owner_user_id, sort_order, status)"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "added",
      companyProjectAssignment: data,
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
          "Failed to add company Project / List assignment."
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
      (await request.json()) as CompanyProjectAssignmentPayload;

    const companyId = cleanText(payload.companyId);
    const projectId = cleanText(payload.projectId);

    if (!companyId || !projectId) {
      return NextResponse.json(
        { error: "companyId and projectId are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("company_project_assignments")
      .delete()
      .eq("company_id", companyId)
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
          "Failed to remove company Project / List assignment."
        ),
      },
      { status: 500 }
    );
  }
}
