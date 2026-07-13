import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { enforceApiPermission } from "../_shared/permissions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type OpportunityActivityPayload = {
  opportunityId?: string;
  companyId?: string | null;
  contactId?: string | null;
  activityType?: string;
  subject?: string | null;
  notes?: string | null;
  dueDate?: string | null;
  completed?: boolean;
  activityId?: string;
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

function cleanDate(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const opportunityId = searchParams.get("opportunityId");

    if (!opportunityId) {
      return NextResponse.json(
        { error: "opportunityId is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("sales_opportunity_activities")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      activities: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load opportunity activities.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const permission = enforceApiPermission(
    request,
    "manage_sales_activities"
  );

  if (permission.response) return permission.response;

  try {
    const supabase = getSupabaseAdmin();
    const payload = (await request.json()) as OpportunityActivityPayload;

    if (!payload.opportunityId) {
      return NextResponse.json(
        { error: "opportunityId is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("sales_opportunity_activities")
      .insert({
        opportunity_id: payload.opportunityId,
        company_id: payload.companyId || null,
        contact_id: payload.contactId || null,
        activity_type: cleanText(payload.activityType) || "note",
        subject: cleanText(payload.subject),
        notes: cleanText(payload.notes),
        due_date: cleanDate(payload.dueDate),
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "created",
      activity: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create opportunity activity.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const permission = enforceApiPermission(
    request,
    "manage_sales_activities"
  );

  if (permission.response) return permission.response;

  try {
    const supabase = getSupabaseAdmin();
    const payload = (await request.json()) as OpportunityActivityPayload;

    if (!payload.activityId) {
      return NextResponse.json({ error: "activityId is required." }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.activityType !== undefined) {
      update.activity_type = cleanText(payload.activityType) || "note";
    }

    if (payload.subject !== undefined) update.subject = cleanText(payload.subject);
    if (payload.notes !== undefined) update.notes = cleanText(payload.notes);
    if (payload.dueDate !== undefined) update.due_date = cleanDate(payload.dueDate);

    if (payload.completed !== undefined) {
      update.completed_at = payload.completed ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from("sales_opportunity_activities")
      .update(update)
      .eq("id", payload.activityId)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "updated",
      activity: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update opportunity activity.",
      },
      { status: 500 }
    );
  }
}