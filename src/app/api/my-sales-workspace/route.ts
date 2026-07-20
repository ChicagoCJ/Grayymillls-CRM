import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../_shared/verified-auth";

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

function companyIsVisibleToUser(company: any, crmRole: string, crmUserId: string) {
  if (crmRole === "admin" || crmRole === "sales_manager") return true;

  if (crmRole === "sales_rep") {
    return String(company?.assigned_salesperson_id || "") === crmUserId;
  }

  return false;
}

export async function GET(request: Request) {
  const verification = await verifySignedInCrmUser(request);
  if (verification.response) return verification.response;

  try {
    const supabase = getSupabaseAdmin();
    const { crmUserId, crmRole, crmDisplayName } = verification.context;
    const today = new Date().toISOString().slice(0, 10);

    const activitySelect = `
      id,
      company_id,
      contact_id,
      prospect_id,
      activity_type,
      subject,
      notes,
      due_date,
      completed_at,
      created_at,
      companies (
        id,
        company_name,
        assigned_salesperson_id,
        assigned_sales_manager_id
      )
    `;

    const opportunitySelect = `
      id,
      company_id,
      contact_id,
      prospect_id,
      opportunity_name,
      opportunity_type,
      product_line,
      likely_product_path,
      stage_id,
      estimated_value,
      probability,
      expected_close_date,
      next_step,
      status,
      created_at,
      updated_at,
      companies (
        id,
        company_name,
        assigned_salesperson_id,
        assigned_sales_manager_id
      ),
      contacts (
        id,
        full_name,
        title,
        email
      ),
      sales_funnel_stages (
        id,
        stage_name,
        stage_key,
        sort_order,
        default_probability,
        is_open_stage,
        is_won_stage,
        is_lost_stage
      )
    `;

    const [
      overdueResult,
      dueTodayResult,
      upcomingResult,
      opportunitiesResult,
    ] = await Promise.all([
      supabase
        .from("activities")
        .select(activitySelect)
        .is("archived_at", null)
        .is("completed_at", null)
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(100),
      supabase
        .from("activities")
        .select(activitySelect)
        .is("archived_at", null)
        .is("completed_at", null)
        .eq("due_date", today)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("activities")
        .select(activitySelect)
        .is("archived_at", null)
        .is("completed_at", null)
        .gt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(100),
      supabase
        .from("sales_opportunities")
        .select(opportunitySelect)
        .eq("status", "open")
        .order("expected_close_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (overdueResult.error) throw overdueResult.error;
    if (dueTodayResult.error) throw dueTodayResult.error;
    if (upcomingResult.error) throw upcomingResult.error;
    if (opportunitiesResult.error) throw opportunitiesResult.error;

    const filterActivities = (activities: any[]) =>
      (activities ?? []).filter((activity: any) =>
        companyIsVisibleToUser(activity.companies, crmRole, crmUserId)
      );

    const visibleOpportunities = (opportunitiesResult.data ?? []).filter(
      (opportunity: any) =>
        companyIsVisibleToUser(opportunity.companies, crmRole, crmUserId)
    );

    return NextResponse.json({
      user: {
        crmUserId,
        displayName: crmDisplayName,
        role: crmRole,
      },
      activities: {
        overdue: filterActivities(overdueResult.data),
        dueToday: filterActivities(dueTodayResult.data),
        upcoming: filterActivities(upcomingResult.data),
      },
      opportunities: {
        open: visibleOpportunities,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load My Sales Workspace.",
      },
      { status: 500 }
    );
  }
}
