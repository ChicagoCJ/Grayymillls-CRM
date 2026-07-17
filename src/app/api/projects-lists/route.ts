import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInAdmin } from "../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ProjectKind = "project" | "list";
type ProjectStatus = "active" | "archived";

type ProjectListPayload = {
  id?: string;
  projectName?: string;
  projectKind?: ProjectKind;
  description?: string | null;
  ownerUserId?: string | null;
  sortOrder?: number | string | null;
  status?: ProjectStatus;
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

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();

  return cleaned.length > 0 ? cleaned : null;
}

function cleanSortOrder(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return 100;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? Math.round(numericValue)
    : 100;
}

function cleanProjectKind(value: unknown): ProjectKind {
  return value === "list" ? "list" : "project";
}

function cleanOwnerUserId(value: unknown) {
  return cleanText(value);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const includeInactive =
      searchParams.get("includeInactive") === "true";

    const projectKind = searchParams.get("projectKind");

    let query = supabase
      .from("crm_projects")
      .select(
        "*, owner:crm_users!crm_projects_owner_user_id_fkey(id, display_name, email, status)"
      )
      .order("sort_order", { ascending: true })
      .order("project_name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("status", "active");
    }

    if (projectKind === "project" || projectKind === "list") {
      query = query.eq("project_kind", projectKind);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      projectsLists: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to load Projects / Lists."
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
      (await request.json()) as ProjectListPayload;

    const projectName = cleanText(payload.projectName);

    if (!projectName) {
      return NextResponse.json(
        {
          error: "projectName is required.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("crm_projects")
      .insert({
        project_name: projectName,
        project_kind: cleanProjectKind(
          payload.projectKind
        ),
        description: cleanText(payload.description),
        owner_user_id: cleanOwnerUserId(
          payload.ownerUserId
        ),
        sort_order: cleanSortOrder(payload.sortOrder),
        status:
          payload.status === "archived"
            ? "archived"
            : "active",
        archived_at:
          payload.status === "archived"
            ? new Date().toISOString()
            : null,
      })
      .select(
        "*, owner:crm_users!crm_projects_owner_user_id_fkey(id, display_name, email, status)"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "created",
      projectList: data,
      verifiedAdmin: {
        crmUserId: verification.context.crmUserId,
        displayName:
          verification.context.crmDisplayName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to create Project / List."
        ),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const verification = await verifySignedInAdmin(request);

    if (verification.response) {
      return verification.response;
    }

    const payload =
      (await request.json()) as ProjectListPayload;

    const id = cleanText(payload.id);

    if (!id) {
      return NextResponse.json(
        {
          error: "id is required.",
        },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.projectName !== undefined) {
      const projectName = cleanText(
        payload.projectName
      );

      if (!projectName) {
        return NextResponse.json(
          {
            error: "projectName cannot be blank.",
          },
          { status: 400 }
        );
      }

      update.project_name = projectName;
    }

    if (payload.projectKind !== undefined) {
      update.project_kind = cleanProjectKind(
        payload.projectKind
      );
    }

    if (payload.description !== undefined) {
      update.description = cleanText(
        payload.description
      );
    }

    if (payload.ownerUserId !== undefined) {
      update.owner_user_id = cleanOwnerUserId(
        payload.ownerUserId
      );
    }

    if (payload.sortOrder !== undefined) {
      update.sort_order = cleanSortOrder(
        payload.sortOrder
      );
    }

    if (payload.status !== undefined) {
      update.status =
        payload.status === "archived"
          ? "archived"
          : "active";

      update.archived_at =
        payload.status === "archived"
          ? new Date().toISOString()
          : null;
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("crm_projects")
      .update(update)
      .eq("id", id)
      .select(
        "*, owner:crm_users!crm_projects_owner_user_id_fkey(id, display_name, email, status)"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "updated",
      projectList: data,
      verifiedAdmin: {
        crmUserId: verification.context.crmUserId,
        displayName:
          verification.context.crmDisplayName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          error,
          "Failed to update Project / List."
        ),
      },
      { status: 500 }
    );
  }
}
