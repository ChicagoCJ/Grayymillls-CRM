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

export async function PATCH(request: Request) {
  try {
    const verification = await verifySignedInCrmUser(request);
    if (verification.response) return verification.response;

    const payload = (await request.json()) as {
      opportunityId?: string;
      stageId?: string;
    };

    const opportunityId = String(payload.opportunityId || "").trim();
    const stageId = String(payload.stageId || "").trim();

    if (!opportunityId || !stageId) {
      return NextResponse.json(
        { error: "opportunityId and stageId are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: opportunity, error: opportunityError } = await supabase
      .from("sales_opportunities")
      .select("id, company_id, stage_id, companies(id, assigned_salesperson_id)")
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
    const canMove =
      role === "admin" ||
      role === "sales_manager" ||
      (role === "sales_rep" &&
        String(company?.assigned_salesperson_id || "") ===
          verification.context.crmUserId);

    if (!canMove) {
      return NextResponse.json(
        { error: "You do not have permission to move this opportunity." },
        { status: 403 }
      );
    }

    const { data: stage, error: stageError } = await supabase
      .from("sales_funnel_stages")
      .select("id, stage_name, status, default_probability, is_won_stage, is_lost_stage")
      .eq("id", stageId)
      .maybeSingle();

    if (stageError) throw stageError;
    if (!stage || stage.status !== "active") {
      return NextResponse.json(
        { error: "The selected funnel stage is not active." },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {
      stage_id: stage.id,
      updated_at: new Date().toISOString(),
    };

    if (stage.is_won_stage) {
      update.status = "won";
      update.probability = 100;
      update.won_at = new Date().toISOString();
      update.lost_at = null;
      update.lost_reason = null;
    } else if (stage.is_lost_stage) {
      update.status = "lost";
      update.probability = 0;
      update.lost_at = new Date().toISOString();
      update.won_at = null;
    } else {
      update.status = "open";
      update.won_at = null;
      update.lost_at = null;
      if (typeof stage.default_probability === "number") {
        update.probability = stage.default_probability;
      }
    }

    const { data, error } = await supabase
      .from("sales_opportunities")
      .update(update)
      .eq("id", opportunityId)
      .select("id, stage_id, status, probability, updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "updated",
      opportunity: data,
      stage: { id: stage.id, stageName: stage.stage_name },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to move the opportunity stage.",
      },
      { status: 500 }
    );
  }
}
