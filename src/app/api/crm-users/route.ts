import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { canManageAdminSettings, getPermissionContext, logSoftPermissionCheck } from "../_shared/permissions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type CrmUserPayload = {
  id?: string;
  displayName?: string;
  roleName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  sortOrder?: number | string | null;
  userRole?: string | null;
  coverageType?: string | null;
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
  return Number.isFinite(numberValue) ? Math.round(numberValue) : 100;
}

function cleanUserRole(value: unknown) {
  if (value === "admin" || value === "sales_manager" || value === "sales_rep") {
    return value;
  }

  return "sales_rep";
}

function cleanCoverageType(value: unknown) {
  if (value === "internal" || value === "outside_rep") {
    return value;
  }

  return "internal";
}
export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    let query = supabase
      .from("crm_users")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("display_name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("status", "active");
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      users: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load CRM users.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const permissionContext = getPermissionContext(request);
    const userCreateAllowed = canManageAdminSettings(permissionContext.userRole);

    logSoftPermissionCheck(
      "manage_crm_users",
      permissionContext,
      userCreateAllowed
    );

    if (!userCreateAllowed) {
      return NextResponse.json(
        {
          error: "Your current role cannot create or edit CRM users.",
          permission: {
            action: "manage_crm_users",
            userRole: permissionContext.userRole,
            softMode: false,
          },
        },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();
    const payload = (await request.json()) as CrmUserPayload;

    const displayName = cleanText(payload.displayName);

    if (!displayName) {
      return NextResponse.json({ error: "displayName is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("crm_users")
      .insert({
        display_name: displayName,
        role_name: cleanText(payload.roleName),
        email: cleanText(payload.email),
        phone: cleanText(payload.phone),
        notes: cleanText(payload.notes),
        sort_order: cleanSortOrder(payload.sortOrder),
        user_role: cleanUserRole(payload.userRole),
        coverage_type: cleanCoverageType(payload.coverageType),
        status: payload.status || "active",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "created",
      user: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create CRM user.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const permissionContext = getPermissionContext(request);
    const userUpdateAllowed = canManageAdminSettings(permissionContext.userRole);

    logSoftPermissionCheck(
      "manage_crm_users",
      permissionContext,
      userUpdateAllowed
    );

    if (!userUpdateAllowed) {
      return NextResponse.json(
        {
          error: "Your current role cannot create, edit, archive, or reactivate CRM users.",
          permission: {
            action: "manage_crm_users",
            userRole: permissionContext.userRole,
            softMode: false,
          },
        },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();
    const payload = (await request.json()) as CrmUserPayload;

    if (!payload.id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.displayName !== undefined) {
      const displayName = cleanText(payload.displayName);

      if (!displayName) {
        return NextResponse.json(
          { error: "displayName cannot be blank." },
          { status: 400 }
        );
      }

      update.display_name = displayName;
    }

    if (payload.roleName !== undefined) update.role_name = cleanText(payload.roleName);
    if (payload.email !== undefined) update.email = cleanText(payload.email);
    if (payload.phone !== undefined) update.phone = cleanText(payload.phone);
    if (payload.notes !== undefined) update.notes = cleanText(payload.notes);
    if (payload.sortOrder !== undefined) update.sort_order = cleanSortOrder(payload.sortOrder);

    if (payload.userRole !== undefined) {
      update.user_role = cleanUserRole(payload.userRole);
    }

    if (payload.coverageType !== undefined) {
      update.coverage_type = cleanCoverageType(payload.coverageType);
    }

    if (payload.status !== undefined) {
      update.status = payload.status;
      update.archived_at = payload.status === "archived" ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from("crm_users")
      .update(update)
      .eq("id", payload.id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "updated",
      user: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update CRM user.",
      },
      { status: 500 }
    );
  }
}




