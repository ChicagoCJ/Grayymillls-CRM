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
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function companyIsVisibleToUser(company: any, crmRole: string, crmUserId: string) {
  if (crmRole === "admin" || crmRole === "sales_manager") return true;
  if (crmRole === "sales_rep") {
    return String(company?.assigned_salesperson_id || "") === crmUserId;
  }
  return false;
}

function normalizeCompanyActivity(activity: any) {
  return {
    timeline_id: `company:${activity.id}`,
    source: "company",
    source_label: "Company Activity",
    id: activity.id,
    company_id: activity.company_id,
    contact_id: activity.contact_id,
    prospect_id: activity.prospect_id,
    opportunity_id: null,
    opportunity_name: null,
    activity_type: activity.activity_type,
    subject: activity.subject,
    notes: activity.notes,
    due_date: activity.due_date,
    completed_at: activity.completed_at,
    created_at: activity.created_at,
    updated_at: activity.updated_at ?? null,
    archived_at: activity.archived_at ?? null,
    contact: activity.contacts ?? null,
  };
}

function normalizeOpportunityActivity(activity: any) {
  const opportunity = activity.sales_opportunities;

  return {
    timeline_id: `opportunity:${activity.id}`,
    source: "opportunity",
    source_label: "Opportunity Activity",
    id: activity.id,
    company_id: activity.company_id || opportunity?.company_id || null,
    contact_id: activity.contact_id,
    prospect_id: null,
    opportunity_id: activity.opportunity_id,
    opportunity_name: opportunity?.opportunity_name || "Unnamed opportunity",
    activity_type: activity.activity_type,
    subject: activity.subject,
    notes: activity.notes,
    due_date: activity.due_date,
    completed_at: activity.completed_at,
    created_at: activity.created_at,
    updated_at: activity.updated_at ?? null,
    archived_at: null,
    contact: activity.contacts ?? null,
  };
}

export async function GET(request: Request) {
  const verification = await verifySignedInCrmUser(request);
  if (verification.response) return verification.response;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = String(searchParams.get("companyId") || "").trim();

    if (!companyId) {
      return NextResponse.json({ error: "Missing company id." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { crmUserId, crmRole } = verification.context;

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, company_name, assigned_salesperson_id, assigned_sales_manager_id")
      .eq("id", companyId)
      .single();

    if (companyError) throw companyError;

    if (!companyIsVisibleToUser(company, crmRole, crmUserId)) {
      return NextResponse.json(
        { error: "You do not have access to this company timeline." },
        { status: 403 }
      );
    }

    const [companyActivitiesResult, opportunityActivitiesResult] = await Promise.all([
      supabase
        .from("activities")
        .select(`
          *,
          contacts (
            id,
            full_name,
            title,
            email
          )
        `)
        .eq("company_id", companyId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("sales_opportunity_activities")
        .select(`
          *,
          sales_opportunities (
            id,
            company_id,
            opportunity_name,
            opportunity_type,
            product_line,
            status
          ),
          contacts (
            id,
            full_name,
            title,
            email
          )
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (companyActivitiesResult.error) throw companyActivitiesResult.error;
    if (opportunityActivitiesResult.error) throw opportunityActivitiesResult.error;

    const companyActivities = (companyActivitiesResult.data ?? []).map(normalizeCompanyActivity);
    const opportunityActivities = (opportunityActivitiesResult.data ?? []).map(normalizeOpportunityActivity);

    const timeline = [...companyActivities, ...opportunityActivities].sort(
      (a: any, b: any) =>
        String(b.created_at || "").localeCompare(String(a.created_at || ""))
    );

    return NextResponse.json({
      company: { id: company.id, companyName: company.company_name },
      timeline,
      counts: {
        all: timeline.length,
        company: companyActivities.length,
        opportunity: opportunityActivities.length,
        open: timeline.filter((item: any) => !item.completed_at).length,
        completed: timeline.filter((item: any) => Boolean(item.completed_at)).length,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load the company activity timeline.",
      },
      { status: 500 }
    );
  }
}
