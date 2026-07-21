import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInAdmin } from "../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const allowedActivityTypes = new Set([
  "note",
  "call",
  "email",
  "meeting",
  "task",
  "quote_followup",
]);

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

function cleanOptionalText(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function cleanBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function cleanDueBusinessDays(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(numericValue)) return undefined;
  if (numericValue < 0 || numericValue > 365) return undefined;

  return numericValue;
}

export async function GET(request: Request) {
  try {
    const verification = await verifySignedInAdmin(request);
    if (verification.response) return verification.response;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("sales_workflow_automation_rules")
      .select(
        [
          "id",
          "rule_key",
          "rule_name",
          "description",
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
          "sort_order",
          "status",
          "created_at",
          "updated_at",
        ].join(", ")
      )
      .order("sort_order", { ascending: true })
      .order("rule_name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      rules: data ?? [],
      signedInAdmin: {
        id: verification.context.crmUserId,
        displayName: verification.context.crmDisplayName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load workflow automation rules.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const verification = await verifySignedInAdmin(request);
    if (verification.response) return verification.response;

    const payload = (await request.json()) as {
      ruleId?: string;
      enabled?: boolean;
      requireConfirmation?: boolean;
      createActivity?: boolean;
      requireLostReason?: boolean;
      activityType?: string;
      activitySubject?: string | null;
      activityNotes?: string | null;
      dueBusinessDays?: number | string;
    };

    const ruleId = String(payload.ruleId || "").trim();

    if (!ruleId) {
      return NextResponse.json(
        { error: "ruleId is required." },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const enabled = cleanBoolean(payload.enabled);
    if (enabled !== undefined) update.enabled = enabled;

    const requireConfirmation = cleanBoolean(payload.requireConfirmation);
    if (requireConfirmation !== undefined) {
      update.require_confirmation = requireConfirmation;
    }

    const createActivity = cleanBoolean(payload.createActivity);
    if (createActivity !== undefined) update.create_activity = createActivity;

    const requireLostReason = cleanBoolean(payload.requireLostReason);
    if (requireLostReason !== undefined) {
      update.require_lost_reason = requireLostReason;
    }

    if (payload.activityType !== undefined) {
      const activityType = String(payload.activityType || "").trim();

      if (!allowedActivityTypes.has(activityType)) {
        return NextResponse.json(
          { error: "The selected activity type is not supported." },
          { status: 400 }
        );
      }

      update.activity_type = activityType;
    }

    if (payload.activitySubject !== undefined) {
      const subject = cleanOptionalText(payload.activitySubject);

      if (subject === undefined) {
        return NextResponse.json(
          { error: "activitySubject must be text or null." },
          { status: 400 }
        );
      }

      update.activity_subject = subject;
    }

    if (payload.activityNotes !== undefined) {
      const notes = cleanOptionalText(payload.activityNotes);

      if (notes === undefined) {
        return NextResponse.json(
          { error: "activityNotes must be text or null." },
          { status: 400 }
        );
      }

      update.activity_notes = notes;
    }

    if (payload.dueBusinessDays !== undefined) {
      const dueBusinessDays = cleanDueBusinessDays(payload.dueBusinessDays);

      if (dueBusinessDays === undefined) {
        return NextResponse.json(
          { error: "dueBusinessDays must be a whole number from 0 through 365." },
          { status: 400 }
        );
      }

      update.due_business_days = dueBusinessDays;
    }

    if (Object.keys(update).length === 1) {
      return NextResponse.json(
        { error: "No supported rule changes were provided." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: existingRule, error: existingRuleError } = await supabase
      .from("sales_workflow_automation_rules")
      .select(
        "id, rule_key, trigger_outcome, create_activity, require_lost_reason, status"
      )
      .eq("id", ruleId)
      .maybeSingle();

    if (existingRuleError) throw existingRuleError;

    if (!existingRule) {
      return NextResponse.json(
        { error: "Workflow automation rule not found." },
        { status: 404 }
      );
    }

    if (existingRule.status !== "active") {
      return NextResponse.json(
        { error: "Archived workflow automation rules cannot be edited." },
        { status: 400 }
      );
    }

    const resultingCreateActivity =
      typeof update.create_activity === "boolean"
        ? update.create_activity
        : Boolean(existingRule.create_activity);

    const resultingRequireLostReason =
      typeof update.require_lost_reason === "boolean"
        ? update.require_lost_reason
        : Boolean(existingRule.require_lost_reason);

    if (
      existingRule.trigger_outcome === "lost" &&
      resultingCreateActivity &&
      resultingRequireLostReason
    ) {
      return NextResponse.json(
        {
          error:
            "The lost-reason rule cannot create an activity while lost-reason enforcement is enabled.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("sales_workflow_automation_rules")
      .update(update)
      .eq("id", ruleId)
      .select(
        [
          "id",
          "rule_key",
          "rule_name",
          "description",
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
          "sort_order",
          "status",
          "updated_at",
        ].join(", ")
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "updated",
      rule: data,
      updatedBy: {
        id: verification.context.crmUserId,
        displayName: verification.context.crmDisplayName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update the workflow automation rule.",
      },
      { status: 500 }
    );
  }
}
