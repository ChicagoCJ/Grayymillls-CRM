import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { enforceApiPermission } from "../_shared/permissions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openAiApiKey = process.env.OPENAI_API_KEY;

type AnalyzePayload = {
  companyId: string;
};

type ProspectAnalysis = {
  priority_score: number;
  priority_tier: "A+" | "A" | "B" | "C" | "D";
  fit_rating: "Strong" | "Moderate" | "Weak" | "Unknown";
  confidence: "High" | "Medium" | "Low";
  product_line: string;
  likely_product_path: string;
  primary_use_case: string;
  likely_soils: string;
  likely_cleaning_action: string;
  next_best_action: string;
  what_they_do: string;
  likely_relevance: string;
  likely_parts_cleaned: string;
  likely_soils_contaminants: string;
  likely_pain_points: string;
  suggested_sales_angle: string;
  buyer_persona: string;
  likely_priorities: string;
  reason_to_believe: string;
  discovery_questions: string[];
  first_call_opener: string;
  email_subject: string;
  email_message: string;
  recommended_product_paths: {
    path: string;
    when_relevant: string;
  }[];
  likely_objections: {
    objection: string;
    response: string;
  }[];
  buying_committee_hypothesis: {
    role: string;
    concern: string;
  }[];
  trigger_events: {
    trigger: string;
    reason: string;
  }[];
  what_not_to_say: {
    do_not_say: string;
    say_instead: string;
  }[];
  copyable_sales_block: string;
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

function getOpenAIClient() {
  if (!openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }

  return new OpenAI({
    apiKey: openAiApiKey,
  });
}

function stringifyForPrompt(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function clampScore(value: number) {
  if (Number.isNaN(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeTier(score: number): ProspectAnalysis["priority_tier"] {
  if (score >= 90) return "A+";
  if (score >= 75) return "A";
  if (score >= 55) return "B";
  if (score >= 35) return "C";
  return "D";
}

function coerceText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 10);
}

function coerceObjectArray<T extends Record<string, string>>(
  value: unknown,
  keys: (keyof T)[],
  fallback: T[]
): T[] {
  if (!Array.isArray(value)) return fallback;

  const cleaned = value
    .map((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const output: Record<string, string> = {};

      keys.forEach((key) => {
        output[String(key)] = coerceText(record[String(key)], "Not provided");
      });

      return output as T;
    })
    .filter((item): item is T => Boolean(item))
    .slice(0, 8);

  return cleaned.length > 0 ? cleaned : fallback;
}

function sanitizeAnalysis(raw: Partial<ProspectAnalysis>): ProspectAnalysis {
  const priorityScore = clampScore(Number(raw.priority_score ?? 50));

  return {
    priority_score: priorityScore,
    priority_tier: raw.priority_tier || normalizeTier(priorityScore),
    fit_rating: raw.fit_rating || "Unknown",
    confidence: raw.confidence || "Low",
    product_line: coerceText(raw.product_line, "Unknown"),
    likely_product_path: coerceText(raw.likely_product_path, "Worth validating"),
    primary_use_case: coerceText(raw.primary_use_case, "Requires discovery"),
    likely_soils: coerceText(raw.likely_soils, "Requires discovery"),
    likely_cleaning_action: coerceText(raw.likely_cleaning_action, "Requires discovery"),
    next_best_action: coerceText(
      raw.next_best_action,
      "Validate application details before recommending a product path."
    ),
    what_they_do: coerceText(raw.what_they_do, "Not enough information provided."),
    likely_relevance: coerceText(raw.likely_relevance, "Potential relevance requires discovery."),
    likely_parts_cleaned: coerceText(raw.likely_parts_cleaned, "Requires discovery."),
    likely_soils_contaminants: coerceText(
      raw.likely_soils_contaminants,
      "Requires discovery."
    ),
    likely_pain_points: coerceText(raw.likely_pain_points, "Requires discovery."),
    suggested_sales_angle: coerceText(
      raw.suggested_sales_angle,
      "Lead with application discovery and operating value."
    ),
    buyer_persona: coerceText(raw.buyer_persona, "Operations, maintenance, engineering, or purchasing."),
    likely_priorities: coerceText(raw.likely_priorities, "Uptime, labor, quality, safety, and cost control."),
    reason_to_believe: coerceText(raw.reason_to_believe, "Based on available company and Graymills context."),
    discovery_questions: coerceStringArray(raw.discovery_questions),
    first_call_opener: coerceText(
      raw.first_call_opener,
      "I’m calling to understand how you’re currently handling parts cleaning or fluid handling and whether there may be an opportunity to reduce friction in that process."
    ),
    email_subject: coerceText(raw.email_subject, "Potential Graymills application fit"),
    email_message: coerceText(raw.email_message, "I wanted to compare notes on your current process and see whether Graymills may be relevant."),
    recommended_product_paths: coerceObjectArray(
      raw.recommended_product_paths,
      ["path", "when_relevant"],
      [{ path: "Discovery required", when_relevant: "More application data is needed." }]
    ),
    likely_objections: coerceObjectArray(
      raw.likely_objections,
      ["objection", "response"],
      [{ objection: "We already have a process.", response: "The goal is to validate whether the current process is creating avoidable labor, quality, uptime, or safety friction." }]
    ),
    buying_committee_hypothesis: coerceObjectArray(
      raw.buying_committee_hypothesis,
      ["role", "concern"],
      [{ role: "Operations or maintenance", concern: "Cleaning consistency, uptime, labor, safety, and maintenance simplicity." }]
    ),
    trigger_events: coerceObjectArray(
      raw.trigger_events,
      ["trigger", "reason"],
      [{ trigger: "Process change or capacity pressure", reason: "May expose cleaning, fluid handling, or pressroom bottlenecks." }]
    ),
    what_not_to_say: coerceObjectArray(
      raw.what_not_to_say,
      ["do_not_say", "say_instead"],
      [{ do_not_say: "This model will solve your problem.", say_instead: "This looks like a path worth validating after we understand the parts, soils, throughput, and workflow." }]
    ),
    copyable_sales_block: coerceText(
      raw.copyable_sales_block,
      "Prospect requires discovery. Validate application details before recommending a product path."
    ),
  };
}

function buildSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      priority_score: { type: "number" },
      priority_tier: { type: "string", enum: ["A+", "A", "B", "C", "D"] },
      fit_rating: { type: "string", enum: ["Strong", "Moderate", "Weak", "Unknown"] },
      confidence: { type: "string", enum: ["High", "Medium", "Low"] },
      product_line: { type: "string" },
      likely_product_path: { type: "string" },
      primary_use_case: { type: "string" },
      likely_soils: { type: "string" },
      likely_cleaning_action: { type: "string" },
      next_best_action: { type: "string" },
      what_they_do: { type: "string" },
      likely_relevance: { type: "string" },
      likely_parts_cleaned: { type: "string" },
      likely_soils_contaminants: { type: "string" },
      likely_pain_points: { type: "string" },
      suggested_sales_angle: { type: "string" },
      buyer_persona: { type: "string" },
      likely_priorities: { type: "string" },
      reason_to_believe: { type: "string" },
      discovery_questions: {
        type: "array",
        items: { type: "string" },
      },
      first_call_opener: { type: "string" },
      email_subject: { type: "string" },
      email_message: { type: "string" },
      recommended_product_paths: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            path: { type: "string" },
            when_relevant: { type: "string" },
          },
          required: ["path", "when_relevant"],
        },
      },
      likely_objections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            objection: { type: "string" },
            response: { type: "string" },
          },
          required: ["objection", "response"],
        },
      },
      buying_committee_hypothesis: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            role: { type: "string" },
            concern: { type: "string" },
          },
          required: ["role", "concern"],
        },
      },
      trigger_events: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            trigger: { type: "string" },
            reason: { type: "string" },
          },
          required: ["trigger", "reason"],
        },
      },
      what_not_to_say: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            do_not_say: { type: "string" },
            say_instead: { type: "string" },
          },
          required: ["do_not_say", "say_instead"],
        },
      },
      copyable_sales_block: { type: "string" },
    },
    required: [
      "priority_score",
      "priority_tier",
      "fit_rating",
      "confidence",
      "product_line",
      "likely_product_path",
      "primary_use_case",
      "likely_soils",
      "likely_cleaning_action",
      "next_best_action",
      "what_they_do",
      "likely_relevance",
      "likely_parts_cleaned",
      "likely_soils_contaminants",
      "likely_pain_points",
      "suggested_sales_angle",
      "buyer_persona",
      "likely_priorities",
      "reason_to_believe",
      "discovery_questions",
      "first_call_opener",
      "email_subject",
      "email_message",
      "recommended_product_paths",
      "likely_objections",
      "buying_committee_hypothesis",
      "trigger_events",
      "what_not_to_say",
      "copyable_sales_block",
    ],
  };
}

export async function POST(request: Request) {
  const permission = enforceApiPermission(
    request,
    "manage_sales_activities"
  );

  if (permission.response) return permission.response;

  try {
    const payload = (await request.json()) as AnalyzePayload;

    if (!payload.companyId) {
      return NextResponse.json({ error: "companyId is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const openai = getOpenAIClient();

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", payload.companyId)
      .single();

    if (companyError) throw companyError;

    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("*")
      .eq("company_id", payload.companyId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);

    if (contactsError) throw contactsError;

    const { data: prospects, error: prospectsError } = await supabase
      .from("prospects")
      .select("*")
      .eq("company_id", payload.companyId)
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (prospectsError) throw prospectsError;

    const existingProspect = prospects?.[0] ?? null;

    const { data: knowledgeDocuments, error: knowledgeDocumentsError } = await supabase
      .from("graymills_knowledge_documents")
      .select("title, product_area, summary, raw_text, structured_data")
      .eq("approved_for_ai", true)
      .eq("status", "active")
      .limit(10);

    if (knowledgeDocumentsError) throw knowledgeDocumentsError;

    const { data: productFamilies, error: productFamiliesError } = await supabase
      .from("graymills_product_families")
      .select(
        "product_family, product_area, short_description, best_fit_applications, cleaning_action, common_soils, buyer_value_drivers, discovery_questions, proof_points, caution_language"
      )
      .eq("approved_for_ai", true)
      .eq("status", "active")
      .limit(25);

    if (productFamiliesError) throw productFamiliesError;

    const { data: applicationRules, error: applicationRulesError } = await supabase
      .from("graymills_application_rules")
      .select(
        "rule_name, product_area, product_family, when_to_recommend, when_not_to_recommend, required_discovery, risk_or_caution, sales_language"
      )
      .eq("approved_for_ai", true)
      .eq("status", "active")
      .limit(25);

    if (applicationRulesError) throw applicationRulesError;

    const { data: promptContext, error: promptContextError } = await supabase
      .from("graymills_prompt_context")
      .select("context_name, context_type, product_area, prompt_text, usage_notes")
      .eq("approved_for_ai", true)
      .eq("status", "active")
      .limit(25);

    if (promptContextError) throw promptContextError;

    const systemPrompt = `
You are the Graymills prospect analysis engine for an industrial B2B CRM.

Use the provided CRM data and approved Graymills knowledge context only.
Return a careful sales hypothesis, not a final engineering recommendation.

Hard rules:
- Do not invent Graymills model numbers, specifications, certifications, capacities, dimensions, regulatory claims, chemistry compatibility, or guaranteed savings.
- Use careful language: likely, may, potential fit, worth validating, depending on parts, soils, throughput, chemistry, safety, and workflow.
- If data is missing, say what must be validated.
- Prioritize real operating value: uptime, labor, cleaning consistency, print quality, contamination control, maintenance simplicity, EHS support, total cost of ownership, and payback logic.
- Make the output useful for a Graymills salesperson preparing a first call.
`;

    const userPrompt = `
Analyze this prospect and return JSON only.

CRM COMPANY:
${stringifyForPrompt(company)}

CRM CONTACTS:
${stringifyForPrompt(contacts ?? [])}

EXISTING PROSPECT RECORD:
${stringifyForPrompt(existingProspect ?? {})}

APPROVED GRAYMILLS KNOWLEDGE DOCUMENTS:
${stringifyForPrompt(knowledgeDocuments ?? [])}

APPROVED PRODUCT FAMILY CONTEXT:
${stringifyForPrompt(productFamilies ?? [])}

APPROVED APPLICATION RULES:
${stringifyForPrompt(applicationRules ?? [])}

APPROVED PROMPT CONTEXT:
${stringifyForPrompt(promptContext ?? [])}

Scoring guidance:
- A+ / 90-100: unusually strong likely fit with clear product path and buyer relevance.
- A / 75-89: strong likely fit, enough signal for prioritized outreach.
- B / 55-74: plausible fit, needs discovery.
- C / 35-54: weak or unclear fit.
- D / 0-34: likely poor fit based on available data.

Keep all language commercially useful, technically cautious, and application-driven.
`;

    const response = await openai.responses.create({
      model: "gpt-5.1",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "graymills_prospect_analysis",
          strict: true,
          schema: buildSchema(),
        },
      },
    });

    const rawText = response.output_text;

    if (!rawText) {
      throw new Error("OpenAI returned no output text.");
    }

    const parsed = JSON.parse(rawText) as Partial<ProspectAnalysis>;
    const analysis = sanitizeAnalysis(parsed);

    let prospectId = existingProspect?.id as string | undefined;

    if (prospectId) {
      const { error: updateProspectError } = await supabase
        .from("prospects")
        .update({
          priority_score: analysis.priority_score,
          priority_tier: analysis.priority_tier,
          fit_rating: analysis.fit_rating,
          confidence: analysis.confidence,
          product_line: analysis.product_line,
          likely_product_path: analysis.likely_product_path,
          primary_use_case: analysis.primary_use_case,
          likely_soils: analysis.likely_soils,
          likely_cleaning_action: analysis.likely_cleaning_action,
          next_best_action: analysis.next_best_action,
        })
        .eq("id", prospectId);

      if (updateProspectError) throw updateProspectError;
    } else {
      const { data: newProspect, error: insertProspectError } = await supabase
        .from("prospects")
        .insert({
          company_id: payload.companyId,
          priority_score: analysis.priority_score,
          priority_tier: analysis.priority_tier,
          fit_rating: analysis.fit_rating,
          confidence: analysis.confidence,
          product_line: analysis.product_line,
          likely_product_path: analysis.likely_product_path,
          primary_use_case: analysis.primary_use_case,
          likely_soils: analysis.likely_soils,
          likely_cleaning_action: analysis.likely_cleaning_action,
          next_best_action: analysis.next_best_action,
          stage: "analyzed",
          status: "open",
        })
        .select("id")
        .single();

      if (insertProspectError) throw insertProspectError;

      prospectId = newProspect.id;
    }

    const { data: intelligence, error: intelligenceError } = await supabase
      .from("prospect_intelligence")
      .insert({
        company_id: payload.companyId,
        prospect_id: prospectId,
        is_ai_generated: true,
        ai_generated_at: new Date().toISOString(),
        ai_generation_source: "openai_analyze_prospect_rev_1_15_3",
        what_they_do: analysis.what_they_do,
        likely_relevance: analysis.likely_relevance,
        likely_parts_cleaned: analysis.likely_parts_cleaned,
        likely_soils_contaminants: analysis.likely_soils_contaminants,
        likely_pain_points: analysis.likely_pain_points,
        suggested_sales_angle: analysis.suggested_sales_angle,
        buyer_persona: analysis.buyer_persona,
        likely_priorities: analysis.likely_priorities,
        reason_to_believe: analysis.reason_to_believe,
        discovery_questions: analysis.discovery_questions,
        first_call_opener: analysis.first_call_opener,
        email_subject: analysis.email_subject,
        email_message: analysis.email_message,
        recommended_product_paths: analysis.recommended_product_paths,
        likely_objections: analysis.likely_objections,
        buying_committee_hypothesis: analysis.buying_committee_hypothesis,
        trigger_events: analysis.trigger_events,
        what_not_to_say: analysis.what_not_to_say,
        copyable_sales_block: analysis.copyable_sales_block,
      })
      .select("*")
      .single();

    if (intelligenceError) throw intelligenceError;

    return NextResponse.json({
      status: "analyzed",
      companyId: payload.companyId,
      prospectId,
      analysis,
      intelligence,
    });
  } catch (error) {
    console.error("Analyze prospect error:", error);

    let message = "Failed to analyze prospect.";

    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "string") {
      message = error;
    } else {
      try {
        message = JSON.stringify(error, null, 2);
      } catch {
        message = "Failed to analyze prospect. Non-serializable error object.";
      }
    }

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}