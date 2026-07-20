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

async function getStageForStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  status: "won" | "lost"
) {
  const matchColumn = status === "won" ? "is_won_stage" : "is_lost_stage";

  const { data, error } = await supabase
    .from("sales_funnel_stages")
    .select("id")
    .eq("status", "active")
    .eq(matchColumn, true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id ? String(data.id) : null;
}

export async function PATCH(request: Request) {
  try {
    const verification = await verifySignedInCrmUser(request);
    if (verification.response) return verification.response;

    const payload = (await request.json()) as {
      opportunityId?: string;
      action?: "mark_won" | "mark_lost" | "update_next_step";
      nextStep?: string;
      nextStepDueDate?: string;
    };

    const opportunityId = String(payload.opportunityId || "").trim();
    const action = String(payload.action || "").trim();

    if (!opportunityId || !action) {
      return NextResponse.json(
        { error: "opportunityId and action are required." },
        { status: 400 }
      );
    }

    if (!["mark_won", "mark_lost", "update_next_step"].includes(action)) {
      return NextResponse.json(
        { error: "The requested quick action is not supported." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: opportunity, error: opportunityError } = await supabase
      .from("sales_opportunities")
      .select(
        "id, company_id, status, next_step, next_step_due_date, companies(id, assigned_salesperson_id)"
      )
      .eq("id", opportunityId)
      .maybeSingle();

    if (opportunityError) throw opportunityError;
    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
    }

    const company = Array.isArray(opportunity.companies)
      ? opportunity.companies[0]
      : opportunity.companies;

    const role = verification.context.crmRole;
    const canUpdate =
      role === "admin" ||
      role === "sales_manager" ||
      (role === "sales_rep" &&
        String(company?.assigned_salesperson_id || "") ===
          verification.context.crmUserId);

    if (!canUpdate) {
      return NextResponse.json(
        { error: "You do not have permission to update this opportunity." },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updated_at: now };

    if (action === "mark_won") {
      update.status = "won";
      update.probability = 100;
      update.won_at = now;
      update.lost_at = null;
      update.lost_reason = null;

      const wonStageId = await getStageForStatus(supabase, "won");
      if (wonStageId) update.stage_id = wonStageId;
    }

    if (action === "mark_lost") {
      update.status = "lost";
      update.probability = 0;
      update.lost_at = now;
      update.won_at = null;

      const lostStageId = await getStageForStatus(supabase, "lost");
      if (lostStageId) update.stage_id = lostStageId;
    }

    if (action === "update_next_step") {
      const nextStep = String(payload.nextStep || "").trim();
      const nextStepDueDate = String(payload.nextStepDueDate || "").trim();

      if (!nextStep || !nextStepDueDate) {
        return NextResponse.json(
          { error: "Next step and next step due date are required." },
          { status: 400 }
        );
      }

      update.next_step = nextStep;
      update.next_step_due_date = nextStepDueDate;
    }

    const { data, error } = await supabase
      .from("sales_opportunities")
      .update(update)
      .eq("id", opportunityId)
      .select(
        "id, company_id, stage_id, status, probability, next_step, next_step_due_date, won_at, lost_at, updated_at"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "updated",
      action,
      opportunity: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to apply the opportunity quick action.",
      },
      { status: 500 }
    );
  }
}
