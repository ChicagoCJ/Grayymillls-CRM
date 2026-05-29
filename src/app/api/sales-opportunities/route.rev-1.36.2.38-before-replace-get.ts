import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type OpportunityPayload = {
  id?: string;
  companyId?: string;
  contactId?: string | null;
  prospectId?: string | null;
  stageId?: string | null;
  opportunityName?: string;
  opportunityType?: string | null;
  productLine?: string | null;
  likelyProductPath?: string | null;
  primaryUseCase?: string | null;
  estimatedValue?: number | string | null;
  probability?: number | string | null;
  expectedCloseDate?: string | null;
  nextStep?: string | null;
  customerNeed?: string | null;
  businessCase?: string | null;
  competitiveSituation?: string | null;
  decisionCriteria?: string | null;
  buyingCommitteeNotes?: string | null;
  source?: string | null;
  owner?: string | null;
  status?: "open" | "won" | "lost" | "archived";
  lostReason?: string | null;
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

function cleanNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function cleanProbability(value: unknown) {
  const numberValue = cleanNumber(value);
  if (numberValue === null) return null;
  return Math.max(0, Math.min(100, Math.round(numberValue)));
}

function cleanDate(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

async function getDefaultStageId(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabase
    .from("sales_funnel_stages")
    .select("id")
    .eq("stage_key", "new_unqualified")
    .maybeSingle();

  if (error) throw error;

  return data?.id ?? null;
}

async function getStageForStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  status: OpportunityPayload["status"]
) {
  if (status === "won") {
    const { data, error } = await supabase
      .from("sales_funnel_stages")
      .select("id")
      .eq("stage_key", "closed_won")
      .maybeSingle();

    if (error) throw error;
    return data?.id ?? null;
  }

  if (status === "lost") {
    const { data, error } = await supabase
      .from("sales_funnel_stages")
      .select("id")
      .eq("stage_key", "closed_lost")
      .maybeSingle();

    if (error) throw error;
    return data?.id ?? null;
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const companyId = searchParams.get("companyId");
    const status = searchParams.get("status");

    let query = supabase
      .from("sales_opportunities")
      .select(
        `
        *,
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
        prospects (
          id,
          priority_score,
          priority_tier,
          fit_rating
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
      `
      )
      .order("created_at", { ascending: false });

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) throw error;    const opportunities = data ?? [];

    const companyIds = Array.from(
      new Set(
        opportunities
          .map((opportunity: any) => opportunity.company_id)
          .filter((companyId: unknown): companyId is string => {
            return typeof companyId === "string" && companyId.length > 0;
          })
      )
    );

    const companyAssignmentsById = new Map<string, any>();

    if (companyIds.length > 0) {
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("id, company_name, assigned_salesperson_id, assigned_sales_manager_id")
        .in("id", companyIds);

      if (companiesError) throw companiesError;

      for (const company of companiesData ?? []) {
        companyAssignmentsById.set(company.id, company);
      }
    }

    const opportunitiesWithCompanyAssignments = opportunities.map((opportunity: any) => {
      const companyAssignment = companyAssignmentsById.get(opportunity.company_id);

      return {
        ...opportunity,
        companies: {
          ...(opportunity.companies ?? {}),
          ...(companyAssignment ?? {}),
        },
      };
    });

    return NextResponse.json({
      opportunities: opportunitiesWithCompanyAssignments,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load opportunities.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const payload = (await request.json()) as OpportunityPayload;

    if (!payload.companyId) {
      return NextResponse.json({ error: "companyId is required." }, { status: 400 });
    }

    const opportunityName = cleanText(payload.opportunityName);

    if (!opportunityName) {
      return NextResponse.json(
        { error: "opportunityName is required." },
        { status: 400 }
      );
    }

    const defaultStageId = await getDefaultStageId(supabase);
    const stageId = payload.stageId || defaultStageId;

    const { data: stage, error: stageError } = stageId
      ? await supabase
          .from("sales_funnel_stages")
          .select("default_probability")
          .eq("id", stageId)
          .maybeSingle()
      : { data: null, error: null };

    if (stageError) throw stageError;

    const probability =
      cleanProbability(payload.probability) ??
      (typeof stage?.default_probability === "number" ? stage.default_probability : null);

    const { data, error } = await supabase
      .from("sales_opportunities")
      .insert({
        company_id: payload.companyId,
        contact_id: payload.contactId || null,
        prospect_id: payload.prospectId || null,
        opportunity_name: opportunityName,
        opportunity_type: cleanText(payload.opportunityType),
        product_line: cleanText(payload.productLine),
        likely_product_path: cleanText(payload.likelyProductPath),
        primary_use_case: cleanText(payload.primaryUseCase),
        stage_id: stageId,
        estimated_value: cleanNumber(payload.estimatedValue),
        probability,
        expected_close_date: cleanDate(payload.expectedCloseDate),
        next_step: cleanText(payload.nextStep),
        customer_need: cleanText(payload.customerNeed),
        business_case: cleanText(payload.businessCase),
        competitive_situation: cleanText(payload.competitiveSituation),
        decision_criteria: cleanText(payload.decisionCriteria),
        buying_committee_notes: cleanText(payload.buyingCommitteeNotes),
        source: cleanText(payload.source) || "manual",
        owner: cleanText(payload.owner),
        status: payload.status || "open",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "created",
      opportunity: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create opportunity.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const payload = (await request.json()) as OpportunityPayload;

    if (!payload.id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.stageId !== undefined) update.stage_id = payload.stageId || null;
    if (payload.opportunityName !== undefined) {
      const opportunityName = cleanText(payload.opportunityName);
      if (!opportunityName) {
        return NextResponse.json(
          { error: "opportunityName cannot be blank." },
          { status: 400 }
        );
      }
      update.opportunity_name = opportunityName;
    }

    if (payload.opportunityType !== undefined) update.opportunity_type = cleanText(payload.opportunityType);
    if (payload.productLine !== undefined) update.product_line = cleanText(payload.productLine);
    if (payload.likelyProductPath !== undefined) update.likely_product_path = cleanText(payload.likelyProductPath);
    if (payload.primaryUseCase !== undefined) update.primary_use_case = cleanText(payload.primaryUseCase);
    if (payload.estimatedValue !== undefined) update.estimated_value = cleanNumber(payload.estimatedValue);
    if (payload.probability !== undefined) update.probability = cleanProbability(payload.probability);
    if (payload.expectedCloseDate !== undefined) update.expected_close_date = cleanDate(payload.expectedCloseDate);
    if (payload.nextStep !== undefined) update.next_step = cleanText(payload.nextStep);
    if (payload.customerNeed !== undefined) update.customer_need = cleanText(payload.customerNeed);
    if (payload.businessCase !== undefined) update.business_case = cleanText(payload.businessCase);
    if (payload.competitiveSituation !== undefined) update.competitive_situation = cleanText(payload.competitiveSituation);
    if (payload.decisionCriteria !== undefined) update.decision_criteria = cleanText(payload.decisionCriteria);
    if (payload.buyingCommitteeNotes !== undefined) update.buying_committee_notes = cleanText(payload.buyingCommitteeNotes);
    if (payload.source !== undefined) update.source = cleanText(payload.source);
    if (payload.owner !== undefined) update.owner = cleanText(payload.owner);
    if (payload.lostReason !== undefined) update.lost_reason = cleanText(payload.lostReason);

    if (payload.status !== undefined) {
      update.status = payload.status;

      if (payload.status === "won") {
        update.won_at = new Date().toISOString();
        update.lost_at = null;
        update.lost_reason = null;
        update.probability = 100;

        const wonStageId = await getStageForStatus(supabase, "won");
        if (wonStageId) update.stage_id = wonStageId;
      }

      if (payload.status === "lost") {
        update.lost_at = new Date().toISOString();
        update.won_at = null;
        update.probability = 0;

        const lostStageId = await getStageForStatus(supabase, "lost");
        if (lostStageId) update.stage_id = lostStageId;
      }

      if (payload.status === "open") {
        update.won_at = null;
        update.lost_at = null;
      }

      if (payload.status === "archived") {
        update.archived_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from("sales_opportunities")
      .update(update)
      .eq("id", payload.id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "updated",
      opportunity: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update opportunity.",
      },
      { status: 500 }
    );
  }
}


