import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type StageMovePayload = {
  opportunityId?: string;
  stageId?: string;
  mode?: "preview" | "execute";
  confirmAutomation?: boolean;
  isUndo?: boolean;
  lostReason?: string;
};

type AutomationRule = {
  id: string;
  rule_key: string;
  rule_name: string;
  trigger_stage_key: string | null;
  trigger_outcome: "won" | "lost" | null;
  enabled: boolean;
  require_confirmation: boolean;
  create_activity: boolean;
  require_lost_reason: boolean;
  activity_type: string | null;
  activity_subject: string | null;
  activity_notes: string | null;
  due_business_days: number;
};

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function addBusinessDays(start: Date, businessDays: number) {
  const result = new Date(start);
  result.setHours(12, 0, 0, 0);
  let remaining = Math.max(0, Math.trunc(businessDays));

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }

  return result.toISOString().slice(0, 10);
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function getOutcome(stage: {
  is_won_stage?: boolean | null;
  is_lost_stage?: boolean | null;
}) {
  if (stage.is_won_stage) return "won";
  if (stage.is_lost_stage) return "lost";
  return null;
}

function buildAutomationPreview(rule: AutomationRule, dueDate: string | null) {
  return {
    ruleId: rule.id,
    ruleKey: rule.rule_key,
    ruleName: rule.rule_name,
    requireConfirmation: Boolean(rule.require_confirmation),
    createActivity: Boolean(rule.create_activity),
    requireLostReason: Boolean(rule.require_lost_reason),
    activityType: cleanText(rule.activity_type) || "task",
    activitySubject: cleanText(rule.activity_subject),
    activityNotes: cleanText(rule.activity_notes),
    dueBusinessDays: Number(rule.due_business_days || 0),
    dueDate,
  };
}

export async function PATCH(request: Request) {
  try {
    const verification = await verifySignedInCrmUser(request);
    if (verification.response) return verification.response;

    const payload = (await request.json()) as StageMovePayload;
    const opportunityId = String(payload.opportunityId || "").trim();
    const stageId = String(payload.stageId || "").trim();
    const mode = payload.mode === "preview" ? "preview" : "execute";
    const confirmAutomation = payload.confirmAutomation === true;
    const isUndo = payload.isUndo === true;
    const lostReason = cleanText(payload.lostReason);

    if (!opportunityId || !stageId) {
      return NextResponse.json(
        { error: "opportunityId and stageId are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: opportunity, error: opportunityError } = await supabase
      .from("sales_opportunities")
      .select(
        [
          "id",
          "company_id",
          "stage_id",
          "status",
          "probability",
          "won_at",
          "lost_at",
          "lost_reason",
          "updated_at",
          "companies(id, assigned_salesperson_id)",
        ].join(", ")
      )
      .eq("id", opportunityId)
      .maybeSingle();

    if (opportunityError) throw opportunityError;
    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
    }

    const opportunityRecord = opportunity as any;
    const company = Array.isArray(opportunityRecord.companies)
      ? opportunityRecord.companies[0]
      : opportunityRecord.companies;

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
      .select(
        [
          "id",
          "stage_name",
          "stage_key",
          "status",
          "default_probability",
          "is_won_stage",
          "is_lost_stage",
        ].join(", ")
      )
      .eq("id", stageId)
      .maybeSingle();

    if (stageError) throw stageError;

    const stageRecord = stage as any;

    if (!stageRecord || stageRecord.status !== "active") {
      return NextResponse.json(
        { error: "The selected funnel stage is not active." },
        { status: 400 }
      );
    }

    if (String(opportunityRecord.stage_id || "") === String(stageRecord.id)) {
      return NextResponse.json({
        status: "unchanged",
        opportunity: {
          id: opportunityRecord.id,
          stage_id: opportunityRecord.stage_id,
          status: opportunityRecord.status,
          probability: opportunityRecord.probability,
          updated_at: opportunityRecord.updated_at,
        },
        stage: {
          id: stageRecord.id,
          stageName: stageRecord.stage_name,
          stageKey: stageRecord.stage_key,
        },
        automation: null,
      });
    }

    const outcome = getOutcome(stageRecord);
    let automationRule: AutomationRule | null = null;

    if (!isUndo) {
      const { data: rules, error: rulesError } = await supabase
        .from("sales_workflow_automation_rules")
        .select(
          [
            "id",
            "rule_key",
            "rule_name",
            "trigger_stage_key",
            "trigger_outcome",
            "enabled",
            "require_confirmation",
            "create_activity",
            "require_lost_reason",
            "activity_type",
            "activity_subject",
            "activity_notes",
            "due_business_days",
          ].join(", ")
        )
        .eq("status", "active")
        .eq("enabled", true)
        .order("sort_order", { ascending: true });

      if (rulesError) throw rulesError;

      automationRule =
        ((rules ?? []) as unknown as AutomationRule[]).find((rule) =>
          outcome
            ? rule.trigger_outcome === outcome
            : String(rule.trigger_stage_key || "") === String(stageRecord.stage_key || "")
        ) ?? null;
    }

    const automationDueDate =
      automationRule && automationRule.create_activity
        ? addBusinessDays(new Date(), Number(automationRule.due_business_days || 0))
        : null;

    const automationPreview = automationRule
      ? buildAutomationPreview(automationRule, automationDueDate)
      : null;

    if (
      automationRule?.require_lost_reason &&
      outcome === "lost" &&
      mode === "execute" &&
      !lostReason
    ) {
      return NextResponse.json(
        {
          error: "A lost reason is required before moving this opportunity to Lost.",
          status: "lost_reason_required",
          stage: {
            id: stageRecord.id,
            stageName: stageRecord.stage_name,
            stageKey: stageRecord.stage_key,
          },
          automation: automationPreview,
        },
        { status: 409 }
      );
    }

    if (mode === "preview") {
      return NextResponse.json({
        status: automationRule ? "preview" : "no_automation",
        opportunity: {
          id: opportunityRecord.id,
          currentStageId: opportunityRecord.stage_id,
        },
        stage: {
          id: stageRecord.id,
          stageName: stageRecord.stage_name,
          stageKey: stageRecord.stage_key,
        },
        automation: automationPreview,
      });
    }

    if (automationRule?.require_confirmation && !confirmAutomation) {
      return NextResponse.json(
        {
          error: "Automation confirmation is required before moving this opportunity.",
          status: "confirmation_required",
          stage: {
            id: stageRecord.id,
            stageName: stageRecord.stage_name,
            stageKey: stageRecord.stage_key,
          },
          automation: automationPreview,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      stage_id: stageRecord.id,
      updated_at: now,
    };

    if (stageRecord.is_won_stage) {
      update.status = "won";
      update.probability = 100;
      update.won_at = now;
      update.lost_at = null;
      update.lost_reason = null;
    } else if (stageRecord.is_lost_stage) {
      update.status = "lost";
      update.probability = 0;
      update.lost_at = now;
      update.won_at = null;
      update.lost_reason = lostReason || null;
    } else {
      update.status = "open";
      update.won_at = null;
      update.lost_at = null;
      if (typeof stageRecord.default_probability === "number") {
        update.probability = stageRecord.default_probability;
      }
    }

    const previousState = {
      stage_id: opportunityRecord.stage_id,
      status: opportunityRecord.status,
      probability: opportunityRecord.probability,
      won_at: opportunityRecord.won_at,
      lost_at: opportunityRecord.lost_at,
      lost_reason: opportunityRecord.lost_reason,
    };

    const { data: movedOpportunity, error: moveError } = await supabase
      .from("sales_opportunities")
      .update(update)
      .eq("id", opportunityId)
      .select("id, stage_id, status, probability, updated_at")
      .single();

    if (moveError) throw moveError;

    let activity = null;
    let activityWasDuplicate = false;

    if (automationRule?.create_activity) {
      const automationEventKey = [
        "stage-move",
        opportunityRecord.id,
        automationRule.id,
        stageRecord.id,
        String(opportunityRecord.updated_at || "initial"),
      ].join(":");

      const auditText = [
        cleanText(automationRule.activity_notes),
        `Created by workflow automation: ${automationRule.rule_name}.`,
        `Triggered by stage move to ${stageRecord.stage_name}.`,
        `Confirmed by ${verification.context.crmDisplayName}.`,
      ]
        .filter(Boolean)
        .join("\n\n");

      const { data: createdActivity, error: activityError } = await supabase
        .from("sales_opportunity_activities")
        .insert({
          opportunity_id: opportunityRecord.id,
          company_id: opportunityRecord.company_id || null,
          activity_type: cleanText(automationRule.activity_type) || "task",
          subject: cleanText(automationRule.activity_subject),
          notes: auditText,
          due_date: automationDueDate,
          automation_rule_id: automationRule.id,
          automation_event_key: automationEventKey,
        })
        .select("*")
        .single();

      if (activityError && activityError.code !== "23505") {
        const { error: rollbackError } = await supabase
          .from("sales_opportunities")
          .update({
            ...previousState,
            updated_at: new Date().toISOString(),
          })
          .eq("id", opportunityId);

        if (rollbackError) {
          throw new Error(
            `Activity creation failed and stage rollback also failed: ${activityError.message}; rollback: ${rollbackError.message}`
          );
        }

        throw new Error(
          `The stage move was rolled back because the automation activity could not be created: ${activityError.message}`
        );
      }

      activityWasDuplicate = activityError?.code === "23505";
      activity = createdActivity ?? null;
    }

    return NextResponse.json({
      status: "updated",
      opportunity: movedOpportunity,
      stage: {
        id: stageRecord.id,
        stageName: stageRecord.stage_name,
        stageKey: stageRecord.stage_key,
      },
      automation: automationPreview
        ? {
            ...automationPreview,
            activityCreated: Boolean(activity),
            activityWasDuplicate,
            suppressedByUndo: false,
          }
        : isUndo
          ? {
              activityCreated: false,
              activityWasDuplicate: false,
              suppressedByUndo: true,
            }
          : null,
      activity,
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
