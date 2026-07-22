import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../_shared/verified-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type OpportunityPayload = {
  id?: string;
  companyId?: string;
  primaryContactId?: string | null;
  contactId?: string | null;
  relatedContactIds?: string[];
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
  nextStepDueDate?: string | null;
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
    auth: { persistSession: false, autoRefreshToken: false },
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

function companyIsVisibleToUser(company: any, crmRole: string, crmUserId: string) {
  if (crmRole === "admin" || crmRole === "sales_manager") return true;
  if (crmRole === "sales_rep") {
    return String(company?.assigned_salesperson_id || "") === crmUserId;
  }
  return false;
}

async function verifyCompanyAccess(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyId: string,
  crmRole: string,
  crmUserId: string
) {
  const { data: company, error } = await supabase
    .from("companies")
    .select("id, assigned_salesperson_id, assigned_sales_manager_id")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw error;

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  if (!companyIsVisibleToUser(company, crmRole, crmUserId)) {
    return NextResponse.json(
      { error: "You do not have access to this company opportunity." },
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
  opportunityId: string,
  primaryContactId: string | null,
  relatedContactIds: string[]
) {
  const normalizedIds = Array.from(
    new Set(relatedContactIds.filter((id) => id !== primaryContactId))
  );

  const { error: deleteError } = await supabase
    .from("opportunity_contact_assignments")
    .delete()
    .eq("opportunity_id", opportunityId);

  if (deleteError) throw deleteError;
  if (normalizedIds.length === 0) return;

  const { error: insertError } = await supabase
    .from("opportunity_contact_assignments")
    .insert(
      normalizedIds.map((contactId) => ({
        opportunity_id: opportunityId,
        contact_id: contactId,
      }))
    );

  if (insertError) throw insertError;
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
  const stageKey =
    status === "won" ? "closed_won" : status === "lost" ? "closed_lost" : null;

  if (!stageKey) return null;

  const { data, error } = await supabase
    .from("sales_funnel_stages")
    .select("id")
    .eq("stage_key", stageKey)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function GET(request: Request) {
  const verification = await verifySignedInCrmUser(request);
  if (verification.response) return verification.response;

  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const companyId = cleanText(searchParams.get("companyId"));
    const status = cleanText(searchParams.get("status"));
    const { crmRole, crmUserId } = verification.context;

    if (companyId) {
      const accessResponse = await verifyCompanyAccess(
        supabase,
        companyId,
        crmRole,
        crmUserId
      );
      if (accessResponse) return accessResponse;
    }

    let query = supabase
      .from("sales_opportunities")
      .select(`
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
        opportunity_contact_assignments (
          contact_id,
          contacts (
            id,
            full_name,
            title,
            email
          )
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
      `)
      .order("created_at", { ascending: false });

    if (companyId) query = query.eq("company_id", companyId);
    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    const opportunities = (data ?? [])
      .filter((opportunity: any) =>
        companyIsVisibleToUser(opportunity.companies, crmRole, crmUserId)
      )
      .map((opportunity: any) => ({
        ...opportunity,
        contact: opportunity.contacts ?? null,
        related_contacts: (opportunity.opportunity_contact_assignments ?? [])
          .map((assignment: any) => assignment.contacts)
          .filter(Boolean),
      }));

    return NextResponse.json({ opportunities });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load opportunities.",
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
    const payload = (await request.json()) as OpportunityPayload;
    const companyId = cleanText(payload.companyId);
    const primaryContactId =
      cleanText(payload.primaryContactId) || cleanText(payload.contactId);
    const relatedContactIds = cleanIdArray(payload.relatedContactIds);

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required." }, { status: 400 });
    }

    const accessResponse = await verifyCompanyAccess(
      supabase,
      companyId,
      verification.context.crmRole,
      verification.context.crmUserId
    );
    if (accessResponse) return accessResponse;

    const contactValidation = await validateCompanyContacts(
      supabase,
      companyId,
      primaryContactId,
      relatedContactIds
    );
    if (contactValidation) return contactValidation;

    const opportunityName = cleanText(payload.opportunityName);
    if (!opportunityName) {
      return NextResponse.json(
        { error: "opportunityName is required." },
        { status: 400 }
      );
    }

    const nextStep = cleanText(payload.nextStep);
    const nextStepDueDate = cleanDate(payload.nextStepDueDate);

    if (!nextStep) {
      return NextResponse.json(
        { error: "nextStep is required for an open opportunity." },
        { status: 400 }
      );
    }

    if (!nextStepDueDate) {
      return NextResponse.json(
        { error: "nextStepDueDate is required for an open opportunity." },
        { status: 400 }
      );
    }

    const defaultStageId = await getDefaultStageId(supabase);
    const stageId = cleanText(payload.stageId) || defaultStageId;

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
      (typeof stage?.default_probability === "number"
        ? stage.default_probability
        : null);

    const { data: opportunity, error } = await supabase
      .from("sales_opportunities")
      .insert({
        company_id: companyId,
        contact_id: primaryContactId,
        prospect_id: cleanText(payload.prospectId),
        opportunity_name: opportunityName,
        opportunity_type: cleanText(payload.opportunityType),
        product_line: cleanText(payload.productLine),
        likely_product_path: cleanText(payload.likelyProductPath),
        primary_use_case: cleanText(payload.primaryUseCase),
        stage_id: stageId,
        estimated_value: cleanNumber(payload.estimatedValue),
        probability,
        expected_close_date: cleanDate(payload.expectedCloseDate),
        next_step: nextStep,
        next_step_due_date: nextStepDueDate,
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

    try {
      await replaceRelatedContacts(
        supabase,
        String(opportunity.id),
        primaryContactId,
        relatedContactIds
      );
    } catch (assignmentError) {
      await supabase
        .from("sales_opportunities")
        .delete()
        .eq("id", opportunity.id);
      throw assignmentError;
    }

    return NextResponse.json({
      status: "created",
      opportunity,
      primaryContactId,
      relatedContactIds: relatedContactIds.filter(
        (contactId) => contactId !== primaryContactId
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create opportunity.",
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
    const payload = (await request.json()) as OpportunityPayload;
    const opportunityId = cleanText(payload.id);

    if (!opportunityId) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const { data: currentOpportunity, error: currentError } = await supabase
      .from("sales_opportunities")
      .select("*, companies(id, assigned_salesperson_id, assigned_sales_manager_id)")
      .eq("id", opportunityId)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!currentOpportunity) {
      return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
    }

    if (
      !companyIsVisibleToUser(
        currentOpportunity.companies,
        verification.context.crmRole,
        verification.context.crmUserId
      )
    ) {
      return NextResponse.json(
        { error: "You do not have access to this opportunity." },
        { status: 403 }
      );
    }

    const hasPrimaryContact =
      payload.primaryContactId !== undefined || payload.contactId !== undefined;
    const hasRelatedContacts = payload.relatedContactIds !== undefined;
    const primaryContactId = hasPrimaryContact
      ? cleanText(payload.primaryContactId) || cleanText(payload.contactId)
      : cleanText(currentOpportunity.contact_id);
    const relatedContactIds = hasRelatedContacts
      ? cleanIdArray(payload.relatedContactIds)
      : [];

    if (hasPrimaryContact || hasRelatedContacts) {
      let validationRelatedIds = relatedContactIds;

      if (!hasRelatedContacts) {
        const { data: assignments, error: assignmentsError } = await supabase
          .from("opportunity_contact_assignments")
          .select("contact_id")
          .eq("opportunity_id", opportunityId);

        if (assignmentsError) throw assignmentsError;
        validationRelatedIds = (assignments ?? []).map((row) =>
          String(row.contact_id)
        );
      }

      const validationResponse = await validateCompanyContacts(
        supabase,
        String(currentOpportunity.company_id),
        primaryContactId,
        validationRelatedIds
      );
      if (validationResponse) return validationResponse;
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (hasPrimaryContact) update.contact_id = primaryContactId;
    if (payload.stageId !== undefined) update.stage_id = cleanText(payload.stageId);

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

    if (payload.opportunityType !== undefined)
      update.opportunity_type = cleanText(payload.opportunityType);
    if (payload.productLine !== undefined)
      update.product_line = cleanText(payload.productLine);
    if (payload.likelyProductPath !== undefined)
      update.likely_product_path = cleanText(payload.likelyProductPath);
    if (payload.primaryUseCase !== undefined)
      update.primary_use_case = cleanText(payload.primaryUseCase);
    if (payload.estimatedValue !== undefined)
      update.estimated_value = cleanNumber(payload.estimatedValue);
    if (payload.probability !== undefined)
      update.probability = cleanProbability(payload.probability);
    if (payload.expectedCloseDate !== undefined)
      update.expected_close_date = cleanDate(payload.expectedCloseDate);
    if (payload.nextStep !== undefined)
      update.next_step = cleanText(payload.nextStep);
    if (payload.nextStepDueDate !== undefined)
      update.next_step_due_date = cleanDate(payload.nextStepDueDate);
    if (payload.customerNeed !== undefined)
      update.customer_need = cleanText(payload.customerNeed);
    if (payload.businessCase !== undefined)
      update.business_case = cleanText(payload.businessCase);
    if (payload.competitiveSituation !== undefined)
      update.competitive_situation = cleanText(payload.competitiveSituation);
    if (payload.decisionCriteria !== undefined)
      update.decision_criteria = cleanText(payload.decisionCriteria);
    if (payload.buyingCommitteeNotes !== undefined)
      update.buying_committee_notes = cleanText(payload.buyingCommitteeNotes);
    if (payload.source !== undefined) update.source = cleanText(payload.source);
    if (payload.owner !== undefined) update.owner = cleanText(payload.owner);
    if (payload.lostReason !== undefined)
      update.lost_reason = cleanText(payload.lostReason);

    const resultingStatus = payload.status ?? currentOpportunity.status;
    const resultingNextStep =
      payload.nextStep !== undefined
        ? cleanText(payload.nextStep)
        : cleanText(currentOpportunity.next_step);
    const resultingNextStepDueDate =
      payload.nextStepDueDate !== undefined
        ? cleanDate(payload.nextStepDueDate)
        : cleanDate(currentOpportunity.next_step_due_date);

    if (
      resultingStatus === "open" &&
      (payload.nextStep !== undefined || payload.nextStepDueDate !== undefined)
    ) {
      if (!resultingNextStep) {
        return NextResponse.json(
          { error: "nextStep is required for an open opportunity." },
          { status: 400 }
        );
      }
      if (!resultingNextStepDueDate) {
        return NextResponse.json(
          { error: "nextStepDueDate is required for an open opportunity." },
          { status: 400 }
        );
      }
    }

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

    const { data: opportunity, error } = await supabase
      .from("sales_opportunities")
      .update(update)
      .eq("id", opportunityId)
      .select("*")
      .single();

    if (error) throw error;

    if (hasRelatedContacts) {
      await replaceRelatedContacts(
        supabase,
        opportunityId,
        primaryContactId,
        relatedContactIds
      );
    } else if (hasPrimaryContact) {
      const { data: assignments, error: assignmentsError } = await supabase
        .from("opportunity_contact_assignments")
        .select("contact_id")
        .eq("opportunity_id", opportunityId);

      if (assignmentsError) throw assignmentsError;

      await replaceRelatedContacts(
        supabase,
        opportunityId,
        primaryContactId,
        (assignments ?? []).map((row) => String(row.contact_id))
      );
    }

    return NextResponse.json({ status: "updated", opportunity });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update opportunity.",
      },
      { status: 500 }
    );
  }
}
