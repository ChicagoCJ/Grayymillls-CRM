import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ActivityPayload = {
  companyId: string;
  contactId?: string | null;
  prospectId?: string | null;
  activityType: "note" | "call" | "email" | "meeting" | "task" | "quote_followup" | "import_note";
  subject: string;
  notes: string;
  dueDate?: string | null;
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

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ActivityPayload;

    if (!payload.companyId) {
      return NextResponse.json({ error: "Company id is required." }, { status: 400 });
    }

    if (!payload.activityType) {
      return NextResponse.json({ error: "Activity type is required." }, { status: 400 });
    }

    const subject = cleanText(payload.subject);
    const notes = cleanText(payload.notes);

    if (!subject && !notes) {
      return NextResponse.json(
        { error: "Enter a subject or note before saving activity." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("activities")
      .insert({
        company_id: payload.companyId,
        contact_id: payload.contactId || null,
        prospect_id: payload.prospectId || null,
        activity_type: payload.activityType,
        subject,
        notes,
        due_date: payload.dueDate || null,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ activity: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save activity.",
      },
      { status: 500 }
    );
  }
}