import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ActivityPayload = {
  activityId?: string;
  companyId?: string;
  primaryContactId?: string | null;
  contactId?: string | null;
  relatedContactIds?: string[];
  prospectId?: string | null;
  activityType?: "note" | "call" | "email" | "meeting" | "task" | "quote_followup" | "import_note";
  subject?: string;
  notes?: string;
  dueDate?: string | null;
  completed?: boolean;
};

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

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function cleanIdArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => cleanText(item))
        .filter((item): item is string => Boolean(item))
    )
  );
}

function canAccessCompany(
  company: { assigned_salesperson_id?: string | null },
  crmRole: string,
  crmUserId: string
) {
  return (
    crmRole === "admin" ||
    crmRole === "sales_manager" ||
    (crmRole === "sales_rep" &&
      String(company.assigned_salesperson_id || "") === crmUserId)
  );
}

async function verifyCompanyAccess(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyId: string,
  crmRole: string,
  crmUserId: string
) {
  const { data: company, error } = await supabase
    .from("companies")
    .select("id, assigned_salesperson_id")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw error;

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  if (!canAccessCompany(company, crmRole, crmUserId)) {
    return NextResponse.json(
      { error: "You do not have permission to manage activities for this company." },
      { status: 403 }
    );
  }

  return null;
}

async function validateCompanyContacts(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyId: string,
  primaryContactId: string | null,
  relatedContactIds: string[]
) {
  const requestedIds = Array.from(
    new Set([primaryContactId, ...relatedContactIds].filter(Boolean) as string[])
  );

  if (requestedIds.length === 0) return null;

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, company_id, archived_at")
    .in("id", requestedIds);

  if (error) throw error;

  const validIds = new Set(
    (contacts ?? [])
      .filter(
        (contact) =>
          String(contact.company_id) === companyId && !contact.archived_at
      )
      .map((contact) => String(contact.id))
  );

  const invalidIds = requestedIds.filter((id) => !validIds.has(id));

  if (invalidIds.length > 0) {
    return NextResponse.json(
      {
        error:
          "Every selected contact must be active and belong to the activity company.",
      },
      { status: 400 }
    );
  }

  return null;
}

async function replaceRelatedContacts(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  activityId: string,
  primaryContactId: string | null,
  relatedContactIds: string[]
) {
  const normalizedRelatedIds = relatedContactIds.filter(
    (contactId) => contactId !== primaryContactId
  );

  const { error: deleteError } = await supabase
    .from("activity_contact_assignments")
    .delete()
    .eq("activity_id", activityId);

  if (deleteError) throw deleteError;

  if (normalizedRelatedIds.length === 0) return;

  const { error: insertError } = await supabase
    .from("activity_contact_assignments")
    .insert(
      normalizedRelatedIds.map((contactId) => ({
        activity_id: activityId,
        contact_id: contactId,
      }))
    );

  if (insertError) throw insertError;
}

export async function POST(request: Request) {
  try {
    const verification = await verifySignedInCrmUser(request);
    if (verification.response) return verification.response;

    const payload = (await request.json()) as ActivityPayload;
    const companyId = cleanText(payload.companyId);
    const primaryContactId =
      cleanText(payload.primaryContactId) || cleanText(payload.contactId);
    const relatedContactIds = cleanIdArray(payload.relatedContactIds);
    const subject = cleanText(payload.subject);
    const notes = cleanText(payload.notes);

    if (!companyId) {
      return NextResponse.json(
        { error: "Company id is required." },
        { status: 400 }
      );
    }

    if (!payload.activityType) {
      return NextResponse.json(
        { error: "Activity type is required." },
        { status: 400 }
      );
    }

    if (!subject && !notes) {
      return NextResponse.json(
        { error: "Enter a subject or note before saving activity." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const accessResponse = await verifyCompanyAccess(
      supabase,
      companyId,
      verification.context.crmRole,
      verification.context.crmUserId
    );

    if (accessResponse) return accessResponse;

    const contactValidationResponse = await validateCompanyContacts(
      supabase,
      companyId,
      primaryContactId,
      relatedContactIds
    );

    if (contactValidationResponse) return contactValidationResponse;

    const { data: activity, error: activityError } = await supabase
      .from("activities")
      .insert({
        company_id: companyId,
        contact_id: primaryContactId,
        prospect_id: cleanText(payload.prospectId),
        activity_type: payload.activityType,
        subject,
        notes,
        due_date: cleanText(payload.dueDate),
      })
      .select("*")
      .single();

    if (activityError) throw activityError;

    try {
      await replaceRelatedContacts(
        supabase,
        String(activity.id),
        primaryContactId,
        relatedContactIds
      );
    } catch (assignmentError) {
      await supabase.from("activities").delete().eq("id", activity.id);
      throw assignmentError;
    }

    return NextResponse.json({
      status: "created",
      activity,
      primaryContactId,
      relatedContactIds: relatedContactIds.filter(
        (contactId) => contactId !== primaryContactId
      ),
    });
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

export async function PATCH(request: Request) {
  try {
    const verification = await verifySignedInCrmUser(request);
    if (verification.response) return verification.response;

    const payload = (await request.json()) as ActivityPayload;
    const activityId = cleanText(payload.activityId);

    if (!activityId) {
      return NextResponse.json(
        { error: "Activity id is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: existingActivity, error: existingError } = await supabase
      .from("activities")
      .select("id, company_id, contact_id")
      .eq("id", activityId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existingActivity) {
      return NextResponse.json(
        { error: "Activity not found." },
        { status: 404 }
      );
    }

    const companyId = String(existingActivity.company_id);
    const accessResponse = await verifyCompanyAccess(
      supabase,
      companyId,
      verification.context.crmRole,
      verification.context.crmUserId
    );

    if (accessResponse) return accessResponse;

    const hasPrimaryContact =
      Object.prototype.hasOwnProperty.call(payload, "primaryContactId") ||
      Object.prototype.hasOwnProperty.call(payload, "contactId");
    const hasRelatedContacts = Object.prototype.hasOwnProperty.call(
      payload,
      "relatedContactIds"
    );

    const primaryContactId = hasPrimaryContact
      ? cleanText(payload.primaryContactId) || cleanText(payload.contactId)
      : cleanText(existingActivity.contact_id);
    const relatedContactIds = hasRelatedContacts
      ? cleanIdArray(payload.relatedContactIds)
      : [];

    if (hasPrimaryContact || hasRelatedContacts) {
      let validationRelatedIds = relatedContactIds;

      if (!hasRelatedContacts) {
        const { data: existingAssignments, error: assignmentsError } =
          await supabase
            .from("activity_contact_assignments")
            .select("contact_id")
            .eq("activity_id", activityId);

        if (assignmentsError) throw assignmentsError;

        validationRelatedIds = (existingAssignments ?? []).map((row) =>
          String(row.contact_id)
        );
      }

      const contactValidationResponse = await validateCompanyContacts(
        supabase,
        companyId,
        primaryContactId,
        validationRelatedIds
      );

      if (contactValidationResponse) return contactValidationResponse;
    }

    const update: Record<string, unknown> = {};

    if (typeof payload.completed === "boolean") {
      update.completed_at = payload.completed
        ? new Date().toISOString()
        : null;
    }

    if (payload.activityType !== undefined) {
      if (!payload.activityType) {
        return NextResponse.json(
          { error: "Activity type is required." },
          { status: 400 }
        );
      }

      update.activity_type = payload.activityType;
    }

    if (payload.subject !== undefined || payload.notes !== undefined) {
      const subject =
        payload.subject !== undefined
          ? cleanText(payload.subject)
          : undefined;
      const notes =
        payload.notes !== undefined ? cleanText(payload.notes) : undefined;

      const nextSubject =
        subject !== undefined ? subject : null;
      const nextNotes =
        notes !== undefined ? notes : null;

      if (
        payload.subject !== undefined &&
        payload.notes !== undefined &&
        !nextSubject &&
        !nextNotes
      ) {
        return NextResponse.json(
          { error: "Enter a subject or note before saving activity." },
          { status: 400 }
        );
      }

      if (payload.subject !== undefined) update.subject = subject;
      if (payload.notes !== undefined) update.notes = notes;
    }

    if (payload.dueDate !== undefined) {
      update.due_date = cleanText(payload.dueDate);
    }

    if (hasPrimaryContact) {
      update.contact_id = primaryContactId;
    }

    let activity = existingActivity;

    if (Object.keys(update).length > 0) {
      const { data, error } = await supabase
        .from("activities")
        .update(update)
        .eq("id", activityId)
        .select("*")
        .single();

      if (error) throw error;
      activity = data;
    }

    if (hasRelatedContacts) {
      await replaceRelatedContacts(
        supabase,
        activityId,
        primaryContactId,
        relatedContactIds
      );
    } else if (hasPrimaryContact) {
      const { data: existingAssignments, error: assignmentsError } =
        await supabase
          .from("activity_contact_assignments")
          .select("contact_id")
          .eq("activity_id", activityId);

      if (assignmentsError) throw assignmentsError;

      await replaceRelatedContacts(
        supabase,
        activityId,
        primaryContactId,
        (existingAssignments ?? []).map((row) => String(row.contact_id))
      );
    }

    return NextResponse.json({
      status: "updated",
      activity,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update activity.",
      },
      { status: 500 }
    );
  }
}
