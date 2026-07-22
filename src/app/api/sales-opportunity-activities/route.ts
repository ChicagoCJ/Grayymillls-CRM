import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type OpportunityActivityPayload = {
  opportunityId?: string;
  companyId?: string | null;
  primaryContactId?: string | null;
  contactId?: string | null;
  relatedContactIds?: string[];
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
    auth: { persistSession: false, autoRefreshToken: false },
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

function companyIsVisibleToUser(company: any, crmRole: string, crmUserId: string) {
  if (crmRole === "admin" || crmRole === "sales_manager") return true;
  if (crmRole === "sales_rep") {
    return String(company?.assigned_salesperson_id || "") === crmUserId;
  }
  return false;
}

async function loadOpportunityForAccess(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  opportunityId: string
) {
  const { data, error } = await supabase
    .from("sales_opportunities")
    .select(`
      id,
      company_id,
      companies (
        id,
        company_name,
        assigned_salesperson_id,
        assigned_sales_manager_id
      )
    `)
    .eq("id", opportunityId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function verifyOpportunityAccess(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  opportunityId: string,
  crmRole: string,
  crmUserId: string
) {
  const opportunity = await loadOpportunityForAccess(supabase, opportunityId);

  if (!opportunity) {
    return {
      opportunity: null,
      response: NextResponse.json(
        { error: "Opportunity not found." },
        { status: 404 }
      ),
    };
  }

  if (!companyIsVisibleToUser(opportunity.companies, crmRole, crmUserId)) {
    return {
      opportunity: null,
      response: NextResponse.json(
        { error: "You do not have access to this opportunity activity." },
        { status: 403 }
      ),
    };
  }

  return { opportunity, response: null };
}

async function validateCompanyContacts(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyId: string,
  primaryContactId: string | null,
  relatedContactIds: string[]
) {
  const selectedIds = Array.from(
    new Set([primaryContactId, ...relatedContactIds].filter(Boolean) as string[])
  );

  if (selectedIds.length === 0) return null;

  const { data, error } = await supabase
    .from("contacts")
    .select("id")
    .in("id", selectedIds)
    .eq("company_id", companyId)
    .is("archived_at", null);

  if (error) throw error;

  if ((data ?? []).length !== selectedIds.length) {
    return NextResponse.json(
      {
        error:
          "Every selected contact must be active and belong to the opportunity company.",
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
  const normalizedIds = Array.from(
    new Set(relatedContactIds.filter((id) => id !== primaryContactId))
  );

  const { error: deleteError } = await supabase
    .from("opportunity_activity_contact_assignments")
    .delete()
    .eq("opportunity_activity_id", activityId);

  if (deleteError) throw deleteError;
  if (normalizedIds.length === 0) return;

  const { error: insertError } = await supabase
    .from("opportunity_activity_contact_assignments")
    .insert(
      normalizedIds.map((contactId) => ({
        opportunity_activity_id: activityId,
        contact_id: contactId,
      }))
    );

  if (insertError) throw insertError;
}

export async function GET(request: Request) {
  const verification = await verifySignedInCrmUser(request);
  if (verification.response) return verification.response;

  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const opportunityId = cleanText(searchParams.get("opportunityId"));
    const status = cleanText(searchParams.get("status"));
    const due = cleanText(searchParams.get("due"));

    if (opportunityId) {
      const access = await verifyOpportunityAccess(
        supabase,
        opportunityId,
        verification.context.crmRole,
        verification.context.crmUserId
      );
      if (access.response) return access.response;
    }

    let query = supabase
      .from("sales_opportunity_activities")
      .select(`
        *,
        sales_opportunities (
          id,
          opportunity_name,
          opportunity_type,
          product_line,
          likely_product_path,
          status,
          company_id,
          companies (
            id,
            company_name,
            assigned_salesperson_id,
            assigned_sales_manager_id
          )
        ),
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
        opportunity_activity_contact_assignments (
          contact_id,
          contacts (
            id,
            full_name,
            title,
            email
          )
        )
      `)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (opportunityId) query = query.eq("opportunity_id", opportunityId);
    if (status === "open") query = query.is("completed_at", null);
    if (status === "complete") query = query.not("completed_at", "is", null);

    const today = new Date().toISOString().slice(0, 10);
    if (due === "today") query = query.eq("due_date", today);
    if (due === "overdue") query = query.lt("due_date", today).is("completed_at", null);
    if (due === "upcoming") query = query.gte("due_date", today).is("completed_at", null);

    const { data, error } = await query;
    if (error) throw error;

    const activities = (data ?? [])
      .filter((activity: any) => {
        const company =
          activity.sales_opportunities?.companies || activity.companies;
        return companyIsVisibleToUser(
          company,
          verification.context.crmRole,
          verification.context.crmUserId
        );
      })
      .map((activity: any) => ({
        ...activity,
        contact: activity.contacts ?? null,
        related_contacts: (
          activity.opportunity_activity_contact_assignments ?? []
        )
          .map((assignment: any) => assignment.contacts)
          .filter(Boolean),
      }));

    return NextResponse.json({ activities });
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
  const verification = await verifySignedInCrmUser(request);
  if (verification.response) return verification.response;

  try {
    const supabase = getSupabaseAdmin();
    const payload = (await request.json()) as OpportunityActivityPayload;
    const opportunityId = cleanText(payload.opportunityId);

    if (!opportunityId) {
      return NextResponse.json(
        { error: "opportunityId is required." },
        { status: 400 }
      );
    }

    const access = await verifyOpportunityAccess(
      supabase,
      opportunityId,
      verification.context.crmRole,
      verification.context.crmUserId
    );
    if (access.response) return access.response;

    const companyId = String(access.opportunity?.company_id || "");
    const primaryContactId =
      cleanText(payload.primaryContactId) || cleanText(payload.contactId);
    const relatedContactIds = cleanIdArray(payload.relatedContactIds);

    const contactValidation = await validateCompanyContacts(
      supabase,
      companyId,
      primaryContactId,
      relatedContactIds
    );
    if (contactValidation) return contactValidation;

    const { data: activity, error } = await supabase
      .from("sales_opportunity_activities")
      .insert({
        opportunity_id: opportunityId,
        company_id: companyId || null,
        contact_id: primaryContactId,
        activity_type: cleanText(payload.activityType) || "note",
        subject: cleanText(payload.subject),
        notes: cleanText(payload.notes),
        due_date: cleanDate(payload.dueDate),
      })
      .select("*")
      .single();

    if (error) throw error;

    try {
      await replaceRelatedContacts(
        supabase,
        String(activity.id),
        primaryContactId,
        relatedContactIds
      );
    } catch (assignmentError) {
      await supabase
        .from("sales_opportunity_activities")
        .delete()
        .eq("id", activity.id);
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
          error instanceof Error
            ? error.message
            : "Failed to create opportunity activity.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const verification = await verifySignedInCrmUser(request);
  if (verification.response) return verification.response;

  try {
    const supabase = getSupabaseAdmin();
    const payload = (await request.json()) as OpportunityActivityPayload;
    const activityId = cleanText(payload.activityId);

    if (!activityId) {
      return NextResponse.json(
        { error: "activityId is required." },
        { status: 400 }
      );
    }

    const { data: currentActivity, error: currentError } = await supabase
      .from("sales_opportunity_activities")
      .select("id, opportunity_id, company_id, contact_id")
      .eq("id", activityId)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!currentActivity) {
      return NextResponse.json(
        { error: "Opportunity activity not found." },
        { status: 404 }
      );
    }

    const access = await verifyOpportunityAccess(
      supabase,
      String(currentActivity.opportunity_id),
      verification.context.crmRole,
      verification.context.crmUserId
    );
    if (access.response) return access.response;

    const hasPrimaryContact =
      payload.primaryContactId !== undefined || payload.contactId !== undefined;
    const hasRelatedContacts = payload.relatedContactIds !== undefined;
    const primaryContactId = hasPrimaryContact
      ? cleanText(payload.primaryContactId) || cleanText(payload.contactId)
      : cleanText(currentActivity.contact_id);
    let relatedContactIds = hasRelatedContacts
      ? cleanIdArray(payload.relatedContactIds)
      : [];

    if (hasPrimaryContact || hasRelatedContacts) {
      if (!hasRelatedContacts) {
        const { data: assignments, error: assignmentError } = await supabase
          .from("opportunity_activity_contact_assignments")
          .select("contact_id")
          .eq("opportunity_activity_id", activityId);

        if (assignmentError) throw assignmentError;
        relatedContactIds = (assignments ?? []).map((row) =>
          String(row.contact_id)
        );
      }

      const validation = await validateCompanyContacts(
        supabase,
        String(access.opportunity?.company_id || currentActivity.company_id || ""),
        primaryContactId,
        relatedContactIds
      );
      if (validation) return validation;
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (hasPrimaryContact) update.contact_id = primaryContactId;
    if (payload.activityType !== undefined) {
      update.activity_type = cleanText(payload.activityType) || "note";
    }
    if (payload.subject !== undefined) update.subject = cleanText(payload.subject);
    if (payload.notes !== undefined) update.notes = cleanText(payload.notes);
    if (payload.dueDate !== undefined) update.due_date = cleanDate(payload.dueDate);
    if (payload.completed !== undefined) {
      update.completed_at = payload.completed ? new Date().toISOString() : null;
    }

    const { data: activity, error } = await supabase
      .from("sales_opportunity_activities")
      .update(update)
      .eq("id", activityId)
      .select("*")
      .single();

    if (error) throw error;

    if (hasRelatedContacts || hasPrimaryContact) {
      await replaceRelatedContacts(
        supabase,
        activityId,
        primaryContactId,
        relatedContactIds
      );
    }

    return NextResponse.json({ status: "updated", activity });
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
