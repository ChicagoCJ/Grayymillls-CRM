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

const EXTERNAL_RESEARCH_METHODOLOGY_VERSION =
  "openai_analyze_prospect_rev_3_23_24_web_research_pcg_v1";

type ExternalResearchSource = {
  title: string | null;
  url: string;
  source_type: string | null;
  retrieved_at: string;
};

type ExternalResearchResult = {
  companySummary: string;
  facilityProfile: string;
  whatTheyMake: string[];
  likelyProcesses: Record<string, any>[];
  evidence: Record<string, any>[];
  triggerEvents: Record<string, any>[];
  unknowns: string[];
  researchNotes: string;
};

function externalResearchRecord(
  value: unknown
): Record<string, any> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, any>;
}

function externalResearchText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function externalResearchStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => externalResearchText(item))
    .filter(Boolean);
}

function externalResearchObjectArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => externalResearchRecord(item))
    .filter(
      (item): item is Record<string, any> =>
        Boolean(item)
    );
}

function emptyExternalResearchResult(): ExternalResearchResult {
  return {
    companySummary: "",
    facilityProfile: "",
    whatTheyMake: [],
    likelyProcesses: [],
    evidence: [],
    triggerEvents: [],
    unknowns: [],
    researchNotes: "",
  };
}

function normalizeExternalResearchResult(
  value: unknown
): ExternalResearchResult {
  const record = externalResearchRecord(value);

  if (!record) {
    return emptyExternalResearchResult();
  }

  return {
    companySummary: externalResearchText(
      record.company_summary
    ),
    facilityProfile: externalResearchText(
      record.facility_profile
    ),
    whatTheyMake: externalResearchStringArray(
      record.what_they_make
    ),
    likelyProcesses: externalResearchObjectArray(
      record.likely_processes
    ),
    evidence: externalResearchObjectArray(
      record.evidence
    ),
    triggerEvents: externalResearchObjectArray(
      record.trigger_events
    ),
    unknowns: externalResearchStringArray(
      record.unknowns
    ),
    researchNotes: externalResearchText(
      record.research_notes
    ),
  };
}

function buildExternalCompanyResearchSchema() {
  const evidenceClasses = [
    "verified_external_fact",
    "strong_inference",
    "working_hypothesis",
    "unknown",
  ];

  const confidenceLevels = [
    "high",
    "medium",
    "low",
  ];

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      company_summary: {
        type: "string",
      },
      facility_profile: {
        type: "string",
      },
      what_they_make: {
        type: "array",
        items: {
          type: "string",
        },
      },
      likely_processes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            process_name: {
              type: "string",
            },
            process_location: {
              type: "string",
              enum: [
                "likely_in_house",
                "possibly_outsourced",
                "unknown",
              ],
            },
            evidence_class: {
              type: "string",
              enum: evidenceClasses,
            },
            confidence: {
              type: "string",
              enum: confidenceLevels,
            },
            rationale: {
              type: "string",
            },
          },
          required: [
            "process_name",
            "process_location",
            "evidence_class",
            "confidence",
            "rationale",
          ],
        },
      },
      evidence: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            finding: {
              type: "string",
            },
            facility_scope: {
              type: "string",
            },
            evidence_class: {
              type: "string",
              enum: evidenceClasses,
            },
            confidence: {
              type: "string",
              enum: confidenceLevels,
            },
            supporting_detail: {
              type: "string",
            },
          },
          required: [
            "finding",
            "facility_scope",
            "evidence_class",
            "confidence",
            "supporting_detail",
          ],
        },
      },
      trigger_events: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            event: {
              type: "string",
            },
            status: {
              type: "string",
              enum: [
                "confirmed",
                "suggested",
              ],
            },
            date_or_period: {
              type: "string",
            },
            relevance: {
              type: "string",
            },
            confidence: {
              type: "string",
              enum: confidenceLevels,
            },
          },
          required: [
            "event",
            "status",
            "date_or_period",
            "relevance",
            "confidence",
          ],
        },
      },
      unknowns: {
        type: "array",
        items: {
          type: "string",
        },
      },
      research_notes: {
        type: "string",
      },
    },
    required: [
      "company_summary",
      "facility_profile",
      "what_they_make",
      "likely_processes",
      "evidence",
      "trigger_events",
      "unknowns",
      "research_notes",
    ],
  };
}

function externalResearchUsedWebSearch(response: unknown) {
  const responseRecord = externalResearchRecord(response);
  const output = Array.isArray(responseRecord?.output)
    ? responseRecord.output
    : [];

  return output.some((item) => {
    const itemRecord = externalResearchRecord(item);
    return itemRecord?.type === "web_search_call";
  });
}

function extractExternalResearchSources(
  response: unknown,
  retrievedAt: string
): ExternalResearchSource[] {
  const responseRecord = externalResearchRecord(response);
  const output = Array.isArray(responseRecord?.output)
    ? responseRecord.output
    : [];

  const sourceMap =
    new Map<string, ExternalResearchSource>();

  function addSource(value: unknown) {
    const sourceRecord = externalResearchRecord(value);

    if (!sourceRecord) return;

    const nestedCitation = externalResearchRecord(
      sourceRecord.url_citation
    );

    const citation = nestedCitation || sourceRecord;
    const url = externalResearchText(citation.url);

    if (!/^https?:\/\//i.test(url)) {
      return;
    }

    const normalizedUrl = url.replace(/#.*$/, "");

    if (sourceMap.has(normalizedUrl)) {
      return;
    }

    const title =
      externalResearchText(citation.title) ||
      externalResearchText(sourceRecord.title) ||
      null;

    const sourceType =
      externalResearchText(citation.type) ||
      externalResearchText(sourceRecord.type) ||
      null;

    sourceMap.set(normalizedUrl, {
      title,
      url: normalizedUrl,
      source_type: sourceType,
      retrieved_at: retrievedAt,
    });
  }

  for (const outputItem of output) {
    const item = externalResearchRecord(outputItem);

    if (!item) continue;

    if (item.type === "web_search_call") {
      const action = externalResearchRecord(item.action);
      const sources = Array.isArray(action?.sources)
        ? action.sources
        : [];

      for (const source of sources) {
        addSource(source);
      }
    }

    const content = Array.isArray(item.content)
      ? item.content
      : [];

    for (const contentItem of content) {
      const contentRecord =
        externalResearchRecord(contentItem);

      const annotations =
        Array.isArray(contentRecord?.annotations)
          ? contentRecord.annotations
          : [];

      for (const annotation of annotations) {
        addSource(annotation);
      }
    }
  }

  return Array.from(sourceMap.values());
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

    const { data: activities, error: activitiesError } = await supabase
      .from("activities")
      .select("activity_type, subject, notes, due_date, completed_at, created_at")
      .eq("company_id", payload.companyId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(25);

    if (activitiesError) throw activitiesError;

    const { data: prospects, error: prospectsError } = await supabase
      .from("prospects")
      .select("*")
      .eq("company_id", payload.companyId)
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (prospectsError) throw prospectsError;

    const existingProspect = prospects?.[0] ?? null;

    const { data: companyTags, error: companyTagsError } = await supabase
      .from("company_tags")
      .select("tag_id, crm_tags(*)")
      .eq("company_id", payload.companyId);

    if (companyTagsError) throw companyTagsError;

    const {
      data: classificationRows,
      error: classificationError,
    } = await supabase
      .from("company_graymills_classifications")
      .select(
        `
          id,
          company_id,
          graymills_category_id,
          industry_id,
          sub_industry_id,
          created_at,
          updated_at,
          graymills_category_definitions (
            id,
            category_key,
            category_name,
            sort_order,
            status
          ),
          company_industry_definitions (
            id,
            industry_name,
            status
          ),
          company_sub_industry_definitions (
            id,
            sub_industry_name,
            status
          )
        `
      )
      .eq("company_id", payload.companyId);

    if (classificationError) throw classificationError;

    function oneRelatedRecordForAnalysis(
      value: unknown
    ): Record<string, any> | null {
      if (Array.isArray(value)) {
        const firstRecord = value[0];

        return firstRecord && typeof firstRecord === "object"
          ? (firstRecord as Record<string, any>)
          : null;
      }

      if (value && typeof value === "object") {
        return value as Record<string, any>;
      }

      return null;
    }

    const activeClassificationRows = (classificationRows ?? []).filter(
      (row: any) => {
        const category = oneRelatedRecordForAnalysis(
          row.graymills_category_definitions
        );

        return category?.status === "active";
      }
    );

    if (activeClassificationRows.length === 0) {
      return NextResponse.json(
        {
          error:
            "Assign one active Graymills Category before running AI analysis.",
        },
        { status: 400 }
      );
    }

    if (activeClassificationRows.length > 1) {
      return NextResponse.json(
        {
          error:
            "This company has more than one active Graymills Category. Resolve it to one Category before running AI analysis.",
        },
        { status: 400 }
      );
    }

    const classificationRow = activeClassificationRows[0] as any;

    const category = oneRelatedRecordForAnalysis(
      classificationRow.graymills_category_definitions
    );

    const industry = oneRelatedRecordForAnalysis(
      classificationRow.company_industry_definitions
    );

    const subIndustry = oneRelatedRecordForAnalysis(
      classificationRow.company_sub_industry_definitions
    );

    const categoryKey = String(category?.category_key || "").trim();
    const categoryName = String(
      category?.category_name || "Unknown Graymills Category"
    ).trim();

    const categoryKnowledgeProductAreas: Record<string, string> = {
      parts_washers: "Parts Washers",
      pumps: "Pumps and Metalworking Fluid Systems",
      graphics: "Inking Systems",
      job_shop_fab: "Job Shop / Contract Manufacturing",
    };

    const knowledgeProductArea =
      categoryKnowledgeProductAreas[categoryKey] || null;

    if (!knowledgeProductArea) {
      return NextResponse.json(
        {
          error:
            `No AI knowledge routing is configured for Graymills Category "${categoryName}".`,
        },
        { status: 400 }
      );
    }

    const knowledgeProductAreas = [
      "All",
      knowledgeProductArea,
    ];

    const currentClassification = {
      classificationId: String(classificationRow.id),
      categoryId: String(classificationRow.graymills_category_id),
      categoryKey,
      categoryName,
      categoryStatus: String(category?.status || "unknown"),
      industryId: classificationRow.industry_id
        ? String(classificationRow.industry_id)
        : null,
      industryName: industry?.industry_name
        ? String(industry.industry_name)
        : null,
      industryStatus: industry?.status
        ? String(industry.status)
        : null,
      subIndustryId: classificationRow.sub_industry_id
        ? String(classificationRow.sub_industry_id)
        : null,
      subIndustryName: subIndustry?.sub_industry_name
        ? String(subIndustry.sub_industry_name)
        : null,
      subIndustryStatus: subIndustry?.status
        ? String(subIndustry.status)
        : null,
    };

    const {
      data: activeIndustryOptions,
      error: industryOptionsError,
    } = await supabase
      .from("company_industry_definitions")
      .select(
        "id, graymills_category_id, industry_name, sort_order, status"
      )
      .eq(
        "graymills_category_id",
        classificationRow.graymills_category_id
      )
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("industry_name", { ascending: true });

    if (industryOptionsError) throw industryOptionsError;

    const activeIndustryIds = (activeIndustryOptions ?? [])
      .map((option: any) => String(option.id || ""))
      .filter(Boolean);

    let activeSubIndustryOptions: any[] = [];

    if (activeIndustryIds.length > 0) {
      const {
        data: subIndustryOptionRows,
        error: subIndustryOptionsError,
      } = await supabase
        .from("company_sub_industry_definitions")
        .select(
          "id, industry_id, sub_industry_name, sort_order, status"
        )
        .in("industry_id", activeIndustryIds)
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("sub_industry_name", { ascending: true })
        .limit(250);

      if (subIndustryOptionsError) {
        throw subIndustryOptionsError;
      }

      activeSubIndustryOptions = subIndustryOptionRows ?? [];
    }

    const {
      data: opportunities,
      error: opportunitiesError,
    } = await supabase
      .from("sales_opportunities")
      .select(
        `
          id,
          opportunity_name,
          opportunity_type,
          product_line,
          likely_product_path,
          primary_use_case,
          stage_id,
          estimated_value,
          probability,
          expected_close_date,
          next_step,
          next_step_due_date,
          customer_need,
          business_case,
          competitive_situation,
          decision_criteria,
          buying_committee_notes,
          source,
          owner,
          status,
          created_at,
          updated_at,
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
        `
      )
      .eq("company_id", payload.companyId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (opportunitiesError) throw opportunitiesError;

    const savedBuyerPersonaNames = Array.isArray(company.buyer_personas)
      ? Array.from(
          new Set(
            company.buyer_personas
              .map((item: unknown) => String(item || "").trim())
              .filter(Boolean)
          )
        )
      : [];

    let buyerPersonaDefinitions: any[] = [];

    if (savedBuyerPersonaNames.length > 0) {
      const {
        data: buyerPersonaDefinitionRows,
        error: buyerPersonaDefinitionError,
      } = await supabase
        .from("buyer_persona_definitions")
        .select("persona_name, description, sort_order, status")
        .in("persona_name", savedBuyerPersonaNames)
        .order("sort_order", { ascending: true });

      if (buyerPersonaDefinitionError) {
        throw buyerPersonaDefinitionError;
      }

      buyerPersonaDefinitions = buyerPersonaDefinitionRows ?? [];
    }

    const buyerPersonaContext = savedBuyerPersonaNames.map((personaName) => {
      const definition = buyerPersonaDefinitions.find(
        (item: any) => item.persona_name === personaName
      );

      return {
        persona_name: personaName,
        description:
          definition?.description ||
          "No matching Buyer Persona definition is currently available.",
        status: definition?.status || "legacy",
      };
    });

    const { data: knowledgeDocuments, error: knowledgeDocumentsError } = await supabase
      .from("graymills_knowledge_documents")
      .select("title, product_area, summary, raw_text, structured_data")
      .eq("approved_for_ai", true)
      .eq("status", "active")
      .in("product_area", knowledgeProductAreas)
      .limit(10);

    if (knowledgeDocumentsError) throw knowledgeDocumentsError;

    const { data: productFamilies, error: productFamiliesError } = await supabase
      .from("graymills_product_families")
      .select(
        "product_family, product_area, short_description, best_fit_applications, cleaning_action, common_soils, buyer_value_drivers, discovery_questions, proof_points, caution_language"
      )
      .eq("approved_for_ai", true)
      .eq("status", "active")
      .in("product_area", knowledgeProductAreas)
      .limit(25);

    if (productFamiliesError) throw productFamiliesError;

    const { data: applicationRules, error: applicationRulesError } = await supabase
      .from("graymills_application_rules")
      .select(
        "rule_name, product_area, product_family, when_to_recommend, when_not_to_recommend, required_discovery, risk_or_caution, sales_language"
      )
      .eq("approved_for_ai", true)
      .eq("status", "active")
      .in("product_area", knowledgeProductAreas)
      .limit(25);

    if (applicationRulesError) throw applicationRulesError;

    const { data: promptContext, error: promptContextError } = await supabase
      .from("graymills_prompt_context")
      .select("context_name, context_type, product_area, prompt_text, usage_notes")
      .eq("approved_for_ai", true)
      .eq("status", "active")
      .in("product_area", knowledgeProductAreas)
      .limit(25);

    if (promptContextError) throw promptContextError;

    const researchPerformedAt =
      new Date().toISOString();

    const researchModel =
      process.env.OPENAI_RESEARCH_MODEL?.trim() ||
      "gpt-5.1";

    const companyForResearch =
      company as Record<string, any>;

    const researchCompanyInput = {
      companyName:
        companyForResearch.company_name ?? null,
      website:
        companyForResearch.website ?? null,
      domain:
        companyForResearch.domain ?? null,
      address:
        companyForResearch.address ??
        companyForResearch.address_line_1 ??
        null,
      city:
        companyForResearch.city ?? null,
      state:
        companyForResearch.state ?? null,
      postalCode:
        companyForResearch.postal_code ?? null,
      country:
        companyForResearch.country ?? null,
      naics:
        companyForResearch.naics ??
        companyForResearch.naics_code ??
        companyForResearch.primary_naics ??
        null,
      sic:
        companyForResearch.sic ??
        companyForResearch.sic_code ??
        null,
      importedIndustry:
        companyForResearch.industry ??
        companyForResearch.primary_industry ??
        null,
      importedSubIndustry:
        companyForResearch.primary_sub_industry ??
        null,
    };

    let researchResult =
      emptyExternalResearchResult();

    let researchStatus:
      | "completed"
      | "no_sources"
      | "failed" = "failed";

    let webSearchUsed = false;
    let researchResponseId: string | null = null;
    let researchFailureMessage: string | null = null;

    let researchSources:
      ExternalResearchSource[] = [];

    const researchSystemPrompt = `
You are the external company and facility research pass
for the Graymills industrial B2B CRM.

Research only the company and relevant facility.
Do not recommend Graymills products in this pass.
Do not perform Pain, Claim, or Gain / Proof analysis.

Research priorities:

1. Confirm the company identity.
2. Distinguish the parent company from the specific facility.
3. Determine what the company or facility makes or does.
4. Identify manufacturing or operating processes supported by evidence.
5. Identify likely in-house, possibly outsourced, and unknown processes.
6. Identify current trigger events only when supported by sources.
7. Record important unknowns that require salesperson discovery.

Evidence rules:

- Prefer the official company website and facility pages.
- Then use credible business, trade, government, certification,
  economic-development, and local sources.
- Do not treat NAICS, SIC, directories, or broad industry labels
  as proof of a specific plant process.
- Do not invent equipment, capacity, production volume, pain,
  financial impact, outsourcing, urgency, or customer problems.
- Keep verified facts separate from inference and hypothesis.
- Research business and facility facts, not private personal details.
- Treat similarly named companies as possible identity conflicts.
- When the exact facility cannot be confirmed, say so.
- Use concise paraphrases rather than copied passages.
`;

    const researchUserPrompt = `
Current research date:
${researchPerformedAt.slice(0, 10)}

Research this company and relevant facility.

COMPANY IDENTITY AND LOCATION:
${stringifyForPrompt(researchCompanyInput)}

AUTHORITATIVE GRAYMILLS CLASSIFICATION:
${stringifyForPrompt(currentClassification)}

The Graymills Category is context for relevance only.
Do not change it and do not recommend Graymills products.

Return structured JSON containing:

- Company summary
- Facility profile
- What the company or facility makes
- Likely processes
- Evidence classifications
- Current trigger events
- Important unknowns
- Research notes
`;

    try {
      const researchResponse =
        await openai.responses.create({
          model: researchModel,
          tools: [
            {
              type: "web_search",
              search_context_size: "medium",
            },
          ],
          tool_choice: "auto",
          include: [
            "web_search_call.action.sources",
          ],
          input: [
            {
              role: "system",
              content: researchSystemPrompt,
            },
            {
              role: "user",
              content: researchUserPrompt,
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name:
                "graymills_external_company_research",
              strict: true,
              schema:
                buildExternalCompanyResearchSchema(),
            },
          },
        });

      researchResponseId =
        externalResearchText(
          (researchResponse as any).id
        ) || null;

      webSearchUsed =
        externalResearchUsedWebSearch(
          researchResponse
        );

      researchSources =
        extractExternalResearchSources(
          researchResponse,
          researchPerformedAt
        );

      const rawResearchOutput =
        researchResponse.output_text?.trim();

      if (!rawResearchOutput) {
        throw new Error(
          "The external research pass returned no JSON output."
        );
      }

      const researchJsonText =
        rawResearchOutput
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "");

      researchResult =
        normalizeExternalResearchResult(
          JSON.parse(researchJsonText)
        );

      webSearchUsed =
        webSearchUsed ||
        researchSources.length > 0;

      researchStatus =
        webSearchUsed &&
        researchSources.length > 0
          ? "completed"
          : "no_sources";
    } catch (researchError) {
      researchStatus = "failed";

      researchFailureMessage =
        researchError instanceof Error
          ? researchError.message
          : "External research failed.";

      researchResult = {
        ...emptyExternalResearchResult(),
        researchNotes:
          "External research was attempted but did not complete. " +
          "The commercial analysis must rely on CRM evidence and " +
          "approved Graymills knowledge only.",
      };
    }

    const researchAuditForPrompt = {
      status: researchStatus,
      performedAt: researchPerformedAt,
      model: researchModel,
      responseId: researchResponseId,
      webSearchUsed,
      sourceCount: researchSources.length,
      failureMessage: researchFailureMessage,
    };

    const systemPrompt = `
You are the Graymills prospect analysis engine for an industrial B2B CRM.

Methodology version:
openai_analyze_prospect_rev_3_23_23_category_pcg_v1

Use the supplied CRM evidence, opportunity context, company classifications, approved Graymills knowledge, and the separate external-research package. Treat external research according to its recorded status. When research failed or returned no sources, do not imply that external research was completed.

AUTHORITATIVE CLASSIFICATION RULES:

- Graymills Category is manually assigned and controls the entire analysis route.
- Do not change, question, compare, score, or recommend a different Graymills Category.
- Do not introduce products, applications, language, or proof from another Category.
- The current Industry and Sub-Industry are manually maintained CRM classifications.
- Never state that the Industry or Sub-Industry was changed.
- When the current Industry is supported, recommend retaining it.
- When evidence conflicts with it, recommend human review and explain why.
- When Industry is blank, recommend one active supplied Industry option when a credible fit exists.
- When no active option fits, say that administrator review may be needed.
- Apply the same review logic to Sub-Industry.
- Never invent or silently create a classification.

EVIDENCE RULES:

- Separate verified CRM facts, approved Graymills facts, strong inference, working hypothesis, and unknown information.
- Company tags, NAICS, SIC, imported industry data, contacts, activities, notes, opportunities, and funnel records are evidence inputs, but may be incomplete or outdated.
- NAICS, SIC, and broad industry labels are clues, not proof of a plant process.
- Do not claim that a process, pain, project, stakeholder concern, outsourcing arrangement, trigger event, or urgency exists unless the supplied evidence supports it.
- When evidence is incomplete, identify what needs validation.
- Do not invent names of people. A better contact may be hypothesized only as a job position or role.
- Use actual supplied contacts first and explain how they may participate in the buying process.

PAIN → CLAIM → GAIN / PROOF:

- likely_pain_points is Pain.
- Include relevant operational, business, financial, and personal risks.
- Label those four pain levels clearly.
- Financial and personal risks must remain hypotheses unless directly supported.
- Never invent dollar amounts, ROI, savings, payback, emotional states, career risk, or performance results.

- suggested_sales_angle is Claim.
- State the credible customer improvement Graymills may support.
- Do not make the Claim a list of products or capabilities.
- Keep it within the assigned Graymills Category and the evidence available.

- reason_to_believe is Gain / Proof.
- Use only supplied approved Graymills knowledge and documented CRM facts.
- Explain what the evidence supports and what it does not prove.
- Do not invent models, specifications, dimensions, capacities, chemistry compatibility, certifications, delivery, tolerances, lead times, or guaranteed outcomes.

APPLICATION AND CONTACT RULES:

- Identify one strongest application hypothesis within the assigned Category.
- A secondary path is allowed only when genuinely supported.
- Do not create a catalog-style list of everything Graymills sells.
- Use opportunity customer need, business case, funnel stage, decision criteria, competitive information, next steps, and buying committee notes when present.
- Use the known contact as the starting point.
- When another stakeholder may be better for discovery, recommend a job position and explain why.
- Do not invent a named person.
- Discovery questions must close the most important evidence gaps and identify the role best able to answer when practical.
- next_best_action must be one concrete, low-friction action.
- Trigger events must be confirmed, suggested, or explicitly absent.

OUTPUT FIELD RULES:

- product_line must exactly equal the authoritative Graymills Category name.
- likely_relevance must begin with an Industry review using one of:
  RETAIN, REVIEW RECOMMENDED, or MISSING.
- likely_relevance must state the current Industry, any recommended Industry, confidence, supporting evidence, and important unknowns.
- buyer_persona must identify the known CRM contact first, then any better job-position hypothesis.
- buying_committee_hypothesis must distinguish known contacts from inferred roles.
- likely_pain_points must contain labeled Operational, Business, Financial, and Personal sections.
- suggested_sales_angle must contain the Claim.
- reason_to_believe must contain Gain / Proof.
- copyable_sales_block must be organized as Pain, Claim, Gain / Proof, and Next Step.
- what_they_do must not overstate what the facility makes or does.
- what_not_to_say must prevent unsupported sales claims.
- Write for a Graymills salesperson preparing a credible first conversation.
`;

    const userPrompt = `
Analyze this prospect and return JSON only.

EXTERNAL RESEARCH AUDIT:
${stringifyForPrompt(researchAuditForPrompt)}

EXTERNAL COMPANY AND FACILITY RESEARCH:
${stringifyForPrompt(researchResult)}

EXTERNAL RESEARCH SOURCES:
${stringifyForPrompt(researchSources)}

External research rules:

- Use verified external findings as evidence.
- Label strong inference and working hypothesis accurately.
- Do not treat all URLs consulted as proving every conclusion.
- Do not invent facts when the research status is failed or no_sources.
- Distinguish the relevant facility from the parent company.
- Use trigger events only when the research package supports them.
- Do not let external research change the assigned Graymills Category.

AUTHORITATIVE GRAYMILLS CLASSIFICATION:
${stringifyForPrompt(currentClassification)}

CATEGORY-ROUTED KNOWLEDGE AREA:
${stringifyForPrompt({
  assignedCategory: categoryName,
  categoryKey,
  categorySpecificProductArea: knowledgeProductArea,
  loadedProductAreas: knowledgeProductAreas,
})}

ACTIVE INDUSTRY OPTIONS FOR THIS CATEGORY:
${stringifyForPrompt(activeIndustryOptions ?? [])}

ACTIVE SUB-INDUSTRY OPTIONS FOR THIS CATEGORY:
${stringifyForPrompt(activeSubIndustryOptions ?? [])}

CRM COMPANY:
${stringifyForPrompt(company)}

CRM CONTACTS:
${stringifyForPrompt(contacts ?? [])}

RECENT CRM ACTIVITIES AND USER-ENTERED NOTES:
${stringifyForPrompt(activities ?? [])}

OPPORTUNITIES AND FUNNEL CONTEXT:
${stringifyForPrompt(opportunities ?? [])}

SECONDARY CRM TAGS:
${stringifyForPrompt(companyTags ?? [])}

SAVED ACCOUNT TYPE:
${stringifyForPrompt(company.account_type ?? "Unknown")}

SAVED BUYER PERSONAS:
${stringifyForPrompt(savedBuyerPersonaNames)}

BUYER PERSONA DEFINITIONS:
${stringifyForPrompt(buyerPersonaContext)}

EXISTING PROSPECT RECORD:
${stringifyForPrompt(existingProspect ?? {})}

APPROVED CATEGORY-SCOPED GRAYMILLS KNOWLEDGE DOCUMENTS:
${stringifyForPrompt(knowledgeDocuments ?? [])}

APPROVED CATEGORY-SCOPED PRODUCT FAMILIES:
${stringifyForPrompt(productFamilies ?? [])}

APPROVED CATEGORY-SCOPED APPLICATION RULES:
${stringifyForPrompt(applicationRules ?? [])}

APPROVED SHARED AND CATEGORY-SCOPED PROMPT CONTEXT:
${stringifyForPrompt(promptContext ?? [])}

Analysis sequence:

1. Preserve the authoritative Graymills Category.
2. Review the current Industry and Sub-Industry.
3. Determine what the supplied CRM evidence verifies about the company and facility.
4. Identify likely processes without presenting inference as fact.
5. Review opportunities, activities, contacts, and Buyer Personas.
6. Identify one strongest application hypothesis within the assigned Category.
7. Identify the known contact and any better discovery position.
8. Develop operational, business, financial, and personal Pain.
9. Develop the Claim.
10. Support it with approved Gain / Proof.
11. State unknowns, disqualifiers, discovery questions, and one next action.
12. Keep every output within the assigned Graymills Category.

When category-specific approved knowledge is absent, say so clearly and limit the analysis to shared guardrails, CRM evidence, and discovery questions. Do not fill the gap with general knowledge.
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
        ai_generation_source:
          EXTERNAL_RESEARCH_METHODOLOGY_VERSION,
        research_status: researchStatus,
        research_performed_at: researchPerformedAt,
        web_search_used: webSearchUsed,
        research_model: researchModel,
        research_response_id: researchResponseId,
        research_summary:
          researchResult.companySummary || null,
        research_facility_profile:
          researchResult.facilityProfile || null,
        research_likely_processes:
          researchResult.likelyProcesses,
        research_evidence: {
          whatTheyMake:
            researchResult.whatTheyMake,
          evidence:
            researchResult.evidence,
          triggerEvents:
            researchResult.triggerEvents,
          unknowns:
            researchResult.unknowns,
          researchNotes:
            researchResult.researchNotes,
          failureMessage:
            researchFailureMessage,
        },
        research_sources: researchSources,
        analysis_methodology_version:
          EXTERNAL_RESEARCH_METHODOLOGY_VERSION,
        analysis_graymills_category_key:
          categoryKey,
        analysis_graymills_category_name:
          categoryName,
        analysis_industry_name:
          currentClassification.industryName,
        analysis_sub_industry_name:
          currentClassification.subIndustryName,
        analysis_account_type: String(company.account_type || "Unknown"),
        analysis_buyer_personas: savedBuyerPersonaNames,
        analysis_priority_score: analysis.priority_score,
        analysis_priority_tier: analysis.priority_tier,
        analysis_fit_rating: analysis.fit_rating,
        analysis_confidence: analysis.confidence,
        analysis_product_line: analysis.product_line,
        analysis_likely_product_path: analysis.likely_product_path,
        analysis_primary_use_case: analysis.primary_use_case,
        analysis_likely_soils: analysis.likely_soils,
        analysis_likely_cleaning_action: analysis.likely_cleaning_action,
        analysis_next_best_action: analysis.next_best_action,
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