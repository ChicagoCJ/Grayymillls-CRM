import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { enforceApiPermission } from "../_shared/permissions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function cleanAssignmentId(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned || cleaned === "Unassigned") return null;
  return cleaned;
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required." },
        { status: 400 }
      );
    }

    const [companyResponse, usersResponse] = await Promise.all([
      supabase
        .from("companies")
        .select("id, assigned_salesperson_id, assigned_sales_manager_id")
        .eq("id", companyId)
        .single(),
      supabase
        .from("crm_users")
        .select("*")
        .order("display_name", { ascending: true }),
    ]);

    if (companyResponse.error) throw companyResponse.error;
    if (usersResponse.error) throw usersResponse.error;

    const users = (usersResponse.data ?? []).filter((user: any) => {
      return !user.status || user.status === "active";
    });

    return NextResponse.json({
      companyAssignment: companyResponse.data,
      users,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load company sales assignments.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const permission = enforceApiPermission(request, "assign_sales_coverage");
    if (permission.response) return permission.response;

    const supabase = getSupabaseAdmin();
    const payload = await request.json();

    const rawCompanyIds = Array.isArray(payload.companyIds)
      ? payload.companyIds
      : payload.companyId
        ? [payload.companyId]
        : [];

    const companyIds = Array.from(
      new Set(
        rawCompanyIds
          .map((companyId: unknown) => (typeof companyId === "string" ? companyId.trim() : ""))
          .filter(Boolean)
      )
    );

    if (companyIds.length === 0) {
      return NextResponse.json(
        { error: "companyId or companyIds is required." },
        { status: 400 }
      );
    }

    const update: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    };

    if (Object.prototype.hasOwnProperty.call(payload, "assignedSalespersonId")) {
      update.assigned_salesperson_id = cleanAssignmentId(payload.assignedSalespersonId);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "assignedSalesManagerId")) {
      update.assigned_sales_manager_id = cleanAssignmentId(payload.assignedSalesManagerId);
    }

    const { data, error } = await supabase
      .from("companies")
      .update(update)
      .in("id", companyIds)
      .select("id, assigned_salesperson_id, assigned_sales_manager_id");

    if (error) throw error;

    return NextResponse.json({
      status: "updated",
      updatedCount: data?.length ?? 0,
      companyAssignment: data?.[0] ?? null,
      companyAssignments: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update company sales assignments.",
      },
      { status: 500 }
    );
  }
}





