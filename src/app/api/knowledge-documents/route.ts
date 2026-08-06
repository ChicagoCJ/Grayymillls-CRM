import { createHash, randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifySignedInAdmin } from "../_shared/verified-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const bucketName = "graymills-knowledge";
const maximumFileSizeBytes = 25 * 1024 * 1024;
const maximumExtractedCharacters = 120_000;
const maximumSummaryCharacters = 12_000;
const signedUrlSeconds = 60 * 60;

const categoryProductAreaByKey: Record<string, string> = {
  parts_washers: "Parts Washers",
  pumps: "Pumps and Metalworking Fluid Systems",
  graphics: "Inking Systems",
  job_shop_fab: "Job Shop / Contract Manufacturing",
};

const extensionMimeTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const allowedMimeTypes = new Set(Object.values(extensionMimeTypes));

const extractableMimeTypes = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

const documentSelect = `
  id,
  title,
  document_type,
  product_area,
  source_file_name,
  source_url,
  summary,
  approved_for_ai,
  version_label,
  status,
  raw_text,
  structured_data,
  notes,
  created_at,
  updated_at,
  archived_at,
  graymills_category_id,
  scope_type,
  category_key_snapshot,
  category_name_snapshot,
  source_kind,
  storage_bucket,
  storage_path,
  file_mime_type,
  file_size_bytes,
  file_sha256,
  extraction_status,
  extraction_error,
  uploaded_by_user_id,
  uploaded_by_name,
  approved_at,
  approved_by_user_id,
  approved_by_name,
  archived_by_user_id,
  archived_by_name,
  restored_at,
  restored_by_user_id,
  restored_by_name
`;

const traceableKnowledgeAnalysisSelect = `
  id,
  company_id,
  prospect_id,
  ai_generated_at,
  analysis_graymills_category_key,
  analysis_graymills_category_name,
  analysis_knowledge_documents,
  analysis_knowledge_document_count,
  analysis_knowledge_captured_at
`;

type TraceableKnowledgeAnalysis = {
  id: string;
  company_id: string | null;
  prospect_id: string | null;
  ai_generated_at: string | null;
  analysis_graymills_category_key: string | null;
  analysis_graymills_category_name: string | null;
  analysis_knowledge_documents: unknown;
  analysis_knowledge_document_count: number | null;
  analysis_knowledge_captured_at: string | null;
};

function isKnowledgeRecord(
  value: unknown
): value is Record<string, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getKnowledgeSnapshotDocuments(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isKnowledgeRecord);
}

async function loadAllTraceableKnowledgeAnalyses(
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const pageSize = 1000;
  const rows: TraceableKnowledgeAnalysis[] = [];
  let from = 0;

  while (true) {
    const { data, error } =
      await supabase
        .from("prospect_intelligence")
        .select(traceableKnowledgeAnalysisSelect)
        .not(
          "analysis_knowledge_captured_at",
          "is",
          null
        )
        .order(
          "analysis_knowledge_captured_at",
          { ascending: false }
        )
        .range(
          from,
          from + pageSize - 1
        );

    if (error) {
      throw error;
    }

    const page =
      (data ?? []) as TraceableKnowledgeAnalysis[];

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

async function loadKnowledgeAuditCompanyNames(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyIds: string[]
) {
  const uniqueCompanyIds =
    Array.from(
      new Set(
        companyIds.filter(Boolean)
      )
    );

  const companyNameById =
    new Map<string, string>();

  const chunkSize = 100;

  for (
    let index = 0;
    index < uniqueCompanyIds.length;
    index += chunkSize
  ) {
    const chunk =
      uniqueCompanyIds.slice(
        index,
        index + chunkSize
      );

    const { data, error } =
      await supabase
        .from("companies")
        .select("id, company_name")
        .in("id", chunk);

    if (error) {
      throw error;
    }

    for (const company of data ?? []) {
      companyNameById.set(
        String(company.id),
        cleanText(company.company_name) ||
          "Unnamed company"
      );
    }
  }

  return companyNameById;
}

function getCurrentKnowledgeLifecycleState(
  document: Record<string, any> | null,
  usageCount: number
) {
  if (!document) {
    return "historical_only";
  }

  if (
    document.status === "archived" ||
    document.archived_at
  ) {
    return "archived";
  }

  if (
    document.status === "active" &&
    document.approved_for_ai
  ) {
    return "active_approved";
  }

  if (
    usageCount > 0 &&
    document.status === "draft" &&
    !document.approved_for_ai
  ) {
    return "approval_revoked";
  }

  if (document.status === "draft") {
    return "draft";
  }

  return "inactive";
}

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

function requireMaximumLength(
  value: string | null,
  maximumLength: number,
  fieldLabel: string
) {
  if (value && value.length > maximumLength) {
    throw new Error(
      `${fieldLabel} cannot exceed ${maximumLength.toLocaleString()} characters.`
    );
  }

  return value;
}

function safeFileName(fileName: string) {
  const cleaned = fileName
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "knowledge-document";
}

function fileExtension(fileName: string) {
  const finalDot = fileName.lastIndexOf(".");

  if (finalDot < 0) {
    return "";
  }

  return fileName.slice(finalDot).toLowerCase();
}

function determineMimeType(file: File) {
  const suppliedMimeType = cleanText(file.type)?.toLowerCase() || "";
  const extension = fileExtension(file.name || "");
  const extensionMimeType = extensionMimeTypes[extension] || "";

  if (allowedMimeTypes.has(suppliedMimeType)) {
    return suppliedMimeType;
  }

  if (extensionMimeType) {
    return extensionMimeType;
  }

  throw new Error(
    "Unsupported document type. Use PDF, TXT, Markdown, CSV, JSON, DOC, DOCX, XLS, or XLSX."
  );
}

function errorResponse(error: unknown, fallbackMessage: string) {
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : fallbackMessage,
    },
    { status: 500 }
  );
}

type KnowledgeScope = {
  scopeType: "all" | "category";
  graymillsCategoryId: string | null;
  productArea: string;
  categoryKeySnapshot: string | null;
  categoryNameSnapshot: string | null;
};

async function resolveKnowledgeScope(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  scopeTypeValue: unknown,
  categoryIdValue: unknown
): Promise<KnowledgeScope> {
  const scopeType =
    cleanText(scopeTypeValue)?.toLowerCase() === "all"
      ? "all"
      : "category";

  if (scopeType === "all") {
    return {
      scopeType: "all",
      graymillsCategoryId: null,
      productArea: "All",
      categoryKeySnapshot: null,
      categoryNameSnapshot: "All",
    };
  }

  const categoryId = cleanText(categoryIdValue);

  if (!categoryId) {
    throw new Error(
      "Select a Graymills Category or choose the All-category scope."
    );
  }

  const { data: category, error } = await supabase
    .from("graymills_category_definitions")
    .select("id, category_key, category_name, status")
    .eq("id", categoryId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!category) {
    throw new Error("The selected Graymills Category was not found.");
  }

  if (category.status !== "active") {
    throw new Error(
      "The selected Graymills Category is archived and cannot receive new knowledge."
    );
  }

  const categoryKey = String(category.category_key || "").trim();
  const productArea = categoryProductAreaByKey[categoryKey];

  if (!productArea) {
    throw new Error(
      `No AI knowledge routing is configured for Graymills Category "${category.category_name}".`
    );
  }

  return {
    scopeType: "category",
    graymillsCategoryId: String(category.id),
    productArea,
    categoryKeySnapshot: categoryKey,
    categoryNameSnapshot: String(category.category_name || "").trim(),
  };
}

async function addDocumentEvents(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  events: Array<Record<string, unknown>>
) {
  if (events.length === 0) return;

  const { error } = await supabase
    .from("graymills_knowledge_document_events")
    .insert(events);

  if (error) {
    throw error;
  }
}

async function addSignedUrl(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  document: Record<string, any>
): Promise<Record<string, any>> {
  if (!document.storage_path) {
    return {
      ...document,
      signed_url: null,
    };
  }

  const storageBucket =
    cleanText(document.storage_bucket) || bucketName;

  const { data, error } = await supabase.storage
    .from(storageBucket)
    .createSignedUrl(
      String(document.storage_path),
      signedUrlSeconds
    );

  return {
    ...document,
    signed_url: error
      ? null
      : data?.signedUrl ?? null,
    signed_url_error: error?.message ?? null,
  };
}

export async function GET(request: Request) {
  try {
    const verifiedAdmin =
      await verifySignedInAdmin(request);

    if (verifiedAdmin.response) {
      return verifiedAdmin.response;
    }

    const supabase = getSupabaseAdmin();

    const [
      categoriesResult,
      documentsResult,
      eventsResult,
      traceableAnalyses,
      legacyAnalysisCountResult,
    ] = await Promise.all([
      supabase
        .from("graymills_category_definitions")
        .select(
          "id, category_key, category_name, sort_order, status"
        )
        .order("sort_order", { ascending: true })
        .order("category_name", { ascending: true }),

      supabase
        .from("graymills_knowledge_documents")
        .select(documentSelect)
        .order("updated_at", { ascending: false })
        .limit(250),

      supabase
        .from("graymills_knowledge_document_events")
        .select(
          "id, document_id, event_type, actor_user_id, actor_name, details, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(1000),

      loadAllTraceableKnowledgeAnalyses(
        supabase
      ),

      supabase
        .from("prospect_intelligence")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .is(
          "analysis_knowledge_captured_at",
          null
        ),
    ]);

    if (categoriesResult.error) {
      throw categoriesResult.error;
    }

    if (documentsResult.error) {
      throw documentsResult.error;
    }

    if (eventsResult.error) {
      throw eventsResult.error;
    }

    if (legacyAnalysisCountResult.error) {
      throw legacyAnalysisCountResult.error;
    }

    const eventsByDocument = new Map<string, any[]>();

    for (const event of eventsResult.data ?? []) {
      const documentId = String(event.document_id || "");
      const currentEvents =
        eventsByDocument.get(documentId) ?? [];

      currentEvents.push(event);
      eventsByDocument.set(documentId, currentEvents);
    }

    const documents: Array<Record<string, any>> = await Promise.all(
      (documentsResult.data ?? []).map(
        async (document: Record<string, any>) => {
          const documentWithUrl =
            await addSignedUrl(supabase, document);

          return {
            ...documentWithUrl,
            events:
              eventsByDocument.get(String(document.id)) ??
              [],
          };
        }
      )
    );

    const companyNameById =
      await loadKnowledgeAuditCompanyNames(
        supabase,
        traceableAnalyses
          .map((analysis) =>
            cleanText(
              analysis.company_id
            )
          )
          .filter(
            (companyId): companyId is string =>
              Boolean(companyId)
          )
      );

    const currentDocumentById =
      new Map<string, Record<string, any>>();

    for (const document of documents) {
      currentDocumentById.set(
        String(document.id),
        document
      );
    }

    type UsageAccumulator = {
      documentId: string;
      titleSnapshot: string;
      productAreaSnapshot: string | null;
      versionLabelSnapshot: string | null;
      sourceFileNameSnapshot: string | null;
      fileSha256Snapshot: string | null;
      usageCount: number;
      lastUsedAt: string | null;
      categoryNames: Set<string>;
      categoryKeys: Set<string>;
    };

    const usageByDocument =
      new Map<string, UsageAccumulator>();

    let totalDocumentUsages = 0;

    for (const analysis of traceableAnalyses) {
      const categoryName =
        cleanText(
          analysis.analysis_graymills_category_name
        ) ||
        "Not recorded";

      const categoryKey =
        cleanText(
          analysis.analysis_graymills_category_key
        );

      const usedAt =
        cleanText(
          analysis.analysis_knowledge_captured_at
        ) ||
        cleanText(
          analysis.ai_generated_at
        );

      const snapshotDocuments =
        getKnowledgeSnapshotDocuments(
          analysis.analysis_knowledge_documents
        );

      for (const snapshot of snapshotDocuments) {
        const documentId =
          cleanText(snapshot.documentId) ||
          cleanText(snapshot.id);

        if (!documentId) {
          continue;
        }

        totalDocumentUsages += 1;

        const existing =
          usageByDocument.get(documentId) ?? {
            documentId,
            titleSnapshot:
              cleanText(snapshot.title) ||
              "Historical knowledge document",
            productAreaSnapshot:
              cleanText(snapshot.productArea) ||
              cleanText(snapshot.product_area),
            versionLabelSnapshot:
              cleanText(snapshot.versionLabel) ||
              cleanText(snapshot.version_label),
            sourceFileNameSnapshot:
              cleanText(snapshot.sourceFileName) ||
              cleanText(snapshot.source_file_name),
            fileSha256Snapshot:
              cleanText(snapshot.fileSha256) ||
              cleanText(snapshot.file_sha256),
            usageCount: 0,
            lastUsedAt: null,
            categoryNames:
              new Set<string>(),
            categoryKeys:
              new Set<string>(),
          };

        existing.usageCount += 1;

        if (
          usedAt &&
          (
            !existing.lastUsedAt ||
            new Date(usedAt).getTime() >
              new Date(
                existing.lastUsedAt
              ).getTime()
          )
        ) {
          existing.lastUsedAt =
            usedAt;
        }

        existing.categoryNames.add(
          categoryName
        );

        if (categoryKey) {
          existing.categoryKeys.add(
            categoryKey
          );
        }

        usageByDocument.set(
          documentId,
          existing
        );
      }
    }

    const usageAuditDocuments:
      Array<Record<string, unknown>> = [];

    for (const document of documents) {
      const documentId =
        String(document.id);

      const historicalUsage =
        usageByDocument.get(documentId);

      const usageCount =
        historicalUsage?.usageCount ?? 0;

      usageAuditDocuments.push({
        documentId,
        title:
          cleanText(document.title) ||
          historicalUsage?.titleSnapshot ||
          "Untitled knowledge document",
        titleSnapshot:
          historicalUsage?.titleSnapshot ??
          null,
        productArea:
          cleanText(document.product_area) ||
          historicalUsage?.productAreaSnapshot ||
          null,
        versionLabel:
          cleanText(document.version_label) ||
          historicalUsage?.versionLabelSnapshot ||
          null,
        sourceFileName:
          cleanText(
            document.source_file_name
          ) ||
          historicalUsage
            ?.sourceFileNameSnapshot ||
          null,
        fileSha256:
          cleanText(document.file_sha256) ||
          historicalUsage?.fileSha256Snapshot ||
          null,
        usageCount,
        lastUsedAt:
          historicalUsage?.lastUsedAt ??
          null,
        categoryNames:
          historicalUsage
            ? Array.from(
                historicalUsage.categoryNames
              ).sort()
            : [],
        categoryKeys:
          historicalUsage
            ? Array.from(
                historicalUsage.categoryKeys
              ).sort()
            : [],
        currentStatus:
          document.status,
        currentApprovedForAi:
          Boolean(
            document.approved_for_ai
          ),
        currentArchivedAt:
          document.archived_at ?? null,
        currentLifecycleState:
          getCurrentKnowledgeLifecycleState(
            document,
            usageCount
          ),
        historicalOnly: false,
      });

      usageByDocument.delete(
        documentId
      );
    }

    for (
      const historicalUsage
      of usageByDocument.values()
    ) {
      usageAuditDocuments.push({
        documentId:
          historicalUsage.documentId,
        title:
          historicalUsage.titleSnapshot,
        titleSnapshot:
          historicalUsage.titleSnapshot,
        productArea:
          historicalUsage
            .productAreaSnapshot,
        versionLabel:
          historicalUsage
            .versionLabelSnapshot,
        sourceFileName:
          historicalUsage
            .sourceFileNameSnapshot,
        fileSha256:
          historicalUsage
            .fileSha256Snapshot,
        usageCount:
          historicalUsage.usageCount,
        lastUsedAt:
          historicalUsage.lastUsedAt,
        categoryNames:
          Array.from(
            historicalUsage.categoryNames
          ).sort(),
        categoryKeys:
          Array.from(
            historicalUsage.categoryKeys
          ).sort(),
        currentStatus: null,
        currentApprovedForAi: false,
        currentArchivedAt: null,
        currentLifecycleState:
          "historical_only",
        historicalOnly: true,
      });
    }

    usageAuditDocuments.sort(
      (left, right) => {
        const usageDifference =
          Number(right.usageCount || 0) -
          Number(left.usageCount || 0);

        if (usageDifference !== 0) {
          return usageDifference;
        }

        return String(
          left.title || ""
        ).localeCompare(
          String(
            right.title || ""
          )
        );
      }
    );

    const neverUsedApprovedDocumentCount =
      usageAuditDocuments.filter(
        (document) =>
          document.currentLifecycleState ===
            "active_approved" &&
          Number(
            document.usageCount || 0
          ) === 0
      ).length;

    const historicalInactiveUsedDocumentCount =
      usageAuditDocuments.filter(
        (document) =>
          Number(
            document.usageCount || 0
          ) > 0 &&
          [
            "approval_revoked",
            "archived",
            "historical_only",
          ].includes(
            String(
              document.currentLifecycleState ||
                ""
            )
          )
      ).length;

    const recentAnalyses =
      traceableAnalyses
        .slice(0, 25)
        .map((analysis) => {
          const companyId =
            cleanText(
              analysis.company_id
            );

          const knowledgeDocuments =
            getKnowledgeSnapshotDocuments(
              analysis
                .analysis_knowledge_documents
            ).map((document) => ({
              documentId:
                cleanText(
                  document.documentId
                ) ||
                cleanText(document.id),
              title:
                cleanText(document.title) ||
                "Knowledge document",
              productArea:
                cleanText(
                  document.productArea
                ) ||
                cleanText(
                  document.product_area
                ),
              versionLabel:
                cleanText(
                  document.versionLabel
                ) ||
                cleanText(
                  document.version_label
                ),
              fileSha256:
                cleanText(
                  document.fileSha256
                ) ||
                cleanText(
                  document.file_sha256
                ),
            }));

          return {
            analysisId:
              String(analysis.id),
            companyId,
            companyName:
              companyId
                ? companyNameById.get(
                    companyId
                  ) ||
                  "Company name unavailable"
                : "Company unavailable",
            prospectId:
              cleanText(
                analysis.prospect_id
              ),
            categoryKey:
              cleanText(
                analysis
                  .analysis_graymills_category_key
              ),
            categoryName:
              cleanText(
                analysis
                  .analysis_graymills_category_name
              ) ||
              "Not recorded",
            aiGeneratedAt:
              analysis.ai_generated_at,
            knowledgeCapturedAt:
              analysis
                .analysis_knowledge_captured_at,
            knowledgeDocumentCount:
              Number(
                analysis
                  .analysis_knowledge_document_count ??
                  knowledgeDocuments.length
              ),
            knowledgeDocuments,
          };
        });

    return NextResponse.json({
      categories: categoriesResult.data ?? [],
      documents,
      usageAudit: {
        traceableAnalysisCount:
          traceableAnalyses.length,
        legacyAnalysisCount:
          legacyAnalysisCountResult.count ??
          0,
        totalDocumentUsages,
        neverUsedApprovedDocumentCount,
        historicalInactiveUsedDocumentCount,
        documents:
          usageAuditDocuments,
        recentAnalyses,
      },
      access: {
        role: verifiedAdmin.context.crmRole,
        userId: verifiedAdmin.context.crmUserId,
        userName:
          verifiedAdmin.context.crmDisplayName,
      },
    });
  } catch (error) {
    return errorResponse(
      error,
      "Failed to load the Graymills Knowledge Library."
    );
  }
}

export async function POST(request: Request) {
  const verifiedAdmin =
    await verifySignedInAdmin(request);

  if (verifiedAdmin.response) {
    return verifiedAdmin.response;
  }

  const supabase = getSupabaseAdmin();
  let uploadedStoragePath: string | null = null;

  try {
    const formData = await request.formData();

    const fileEntry = formData.get("file");
    const file =
      fileEntry instanceof File
        ? fileEntry
        : null;

    const title = requireMaximumLength(
      cleanText(formData.get("title")),
      240,
      "Title"
    );

    const documentType = requireMaximumLength(
      cleanText(formData.get("documentType")) ||
        "reference_document",
      80,
      "Document type"
    );

    const sourceUrl = requireMaximumLength(
      cleanText(formData.get("sourceUrl")),
      2_000,
      "Source URL"
    );

    const summary = requireMaximumLength(
      cleanText(formData.get("summary")),
      maximumSummaryCharacters,
      "Summary"
    );

    let rawText = requireMaximumLength(
      cleanText(formData.get("rawText")),
      maximumExtractedCharacters,
      "Approved knowledge text"
    );

    const notes = requireMaximumLength(
      cleanText(formData.get("notes")),
      20_000,
      "Notes"
    );

    const versionLabel = requireMaximumLength(
      cleanText(formData.get("versionLabel")),
      120,
      "Version label"
    );

    if (!title) {
      return NextResponse.json(
        { error: "Document title is required." },
        { status: 400 }
      );
    }

    if (!file && !rawText) {
      return NextResponse.json(
        {
          error:
            "Choose a document file or enter approved knowledge text.",
        },
        { status: 400 }
      );
    }

    const scope = await resolveKnowledgeScope(
      supabase,
      formData.get("scopeType"),
      formData.get("categoryId")
    );

    let sourceFileName: string | null = null;
    let fileMimeType: string | null = null;
    let fileSizeBytes: number | null = null;
    let fileSha256: string | null = null;
    let extractionStatus:
      | "not_required"
      | "pending"
      | "completed"
      | "manual"
      | "failed" =
      rawText
        ? "manual"
        : "not_required";

    if (file) {
      if (file.size <= 0) {
        return NextResponse.json(
          { error: "The selected file is empty." },
          { status: 400 }
        );
      }

      if (file.size > maximumFileSizeBytes) {
        return NextResponse.json(
          {
            error:
              "Knowledge documents cannot exceed 25 MB.",
          },
          { status: 400 }
        );
      }

      sourceFileName =
        file.name || "knowledge-document";

      fileMimeType = determineMimeType(file);
      fileSizeBytes = file.size;

      const fileBuffer =
        Buffer.from(await file.arrayBuffer());

      fileSha256 = createHash("sha256")
        .update(fileBuffer)
        .digest("hex");

      if (
        extractableMimeTypes.has(fileMimeType) &&
        !rawText
      ) {
        const extractedText =
          fileBuffer.toString("utf8").trim();

        if (
          extractedText.length >
          maximumExtractedCharacters
        ) {
          return NextResponse.json(
            {
              error:
                `The extracted text contains ${extractedText.length.toLocaleString()} characters. ` +
                `Reduce it to ${maximumExtractedCharacters.toLocaleString()} characters before uploading.`,
            },
            { status: 400 }
          );
        }

        rawText = extractedText || null;
        extractionStatus =
          rawText
            ? "completed"
            : "failed";
      } else if (!rawText) {
        extractionStatus = "pending";
      }

      const cleanedFileName =
        safeFileName(sourceFileName);

      const scopeFolder =
        scope.scopeType === "all"
          ? "all"
          : scope.categoryKeySnapshot ||
            "category";

      uploadedStoragePath =
        `documents/${scopeFolder}/` +
        `${Date.now()}-${randomUUID()}-${cleanedFileName}`;

      const { error: uploadError } =
        await supabase.storage
          .from(bucketName)
          .upload(
            uploadedStoragePath,
            fileBuffer,
            {
              contentType: fileMimeType,
              upsert: false,
            }
          );

      if (uploadError) {
        throw uploadError;
      }
    }

    const now = new Date().toISOString();

    const { data: document, error: insertError } =
      await supabase
        .from("graymills_knowledge_documents")
        .insert({
          title,
          document_type: documentType,
          product_area: scope.productArea,
          source_file_name: sourceFileName,
          source_url: sourceUrl,
          summary,
          approved_for_ai: false,
          version_label: versionLabel,
          status: "draft",
          raw_text: rawText,
          structured_data: null,
          notes,
          updated_at: now,
          archived_at: null,

          graymills_category_id:
            scope.graymillsCategoryId,
          scope_type: scope.scopeType,
          category_key_snapshot:
            scope.categoryKeySnapshot,
          category_name_snapshot:
            scope.categoryNameSnapshot,

          source_kind: file
            ? "upload"
            : "manual",

          storage_bucket: file
            ? bucketName
            : null,

          storage_path:
            uploadedStoragePath,

          file_mime_type:
            fileMimeType,

          file_size_bytes:
            fileSizeBytes,

          file_sha256:
            fileSha256,

          extraction_status:
            extractionStatus,

          extraction_error:
            extractionStatus === "failed"
              ? "No readable text was found in the uploaded text file."
              : null,

          uploaded_by_user_id:
            verifiedAdmin.context.crmUserId,

          uploaded_by_name:
            verifiedAdmin.context.crmDisplayName,

          approved_at: null,
          approved_by_user_id: null,
          approved_by_name: null,
        })
        .select(documentSelect)
        .single();

    if (insertError) {
      throw insertError;
    }

    const baseEvent = {
      document_id: document.id,
      actor_user_id:
        verifiedAdmin.context.crmUserId,
      actor_name:
        verifiedAdmin.context.crmDisplayName,
    };

    const events: Array<Record<string, unknown>> = [
      {
        ...baseEvent,
        event_type: "created",
        details: {
          status: "draft",
          scopeType: scope.scopeType,
          categoryKey:
            scope.categoryKeySnapshot,
          categoryName:
            scope.categoryNameSnapshot,
          sourceKind: file
            ? "upload"
            : "manual",
        },
      },
    ];

    if (file) {
      events.push({
        ...baseEvent,
        event_type: "file_uploaded",
        details: {
          fileName: sourceFileName,
          fileMimeType,
          fileSizeBytes,
          fileSha256,
          storageBucket: bucketName,
          storagePath:
            uploadedStoragePath,
          extractionStatus,
        },
      });
    }

    await addDocumentEvents(
      supabase,
      events
    );

    const documentWithUrl =
      await addSignedUrl(
        supabase,
        document
      );

    return NextResponse.json({
      status: "created",
      document: {
        ...documentWithUrl,
        events,
      },
      message:
        "Knowledge document uploaded as a draft. Review it before approving it for AI.",
    });
  } catch (error) {
    if (uploadedStoragePath) {
      const { error: cleanupError } =
        await supabase.storage
          .from(bucketName)
          .remove([uploadedStoragePath]);

      if (cleanupError) {
        console.error(
          "[knowledge-document-upload-cleanup]",
          cleanupError
        );
      }
    }

    return errorResponse(
      error,
      "Failed to create the knowledge document."
    );
  }
}

export async function PATCH(request: Request) {
  const verifiedAdmin =
    await verifySignedInAdmin(request);

  if (verifiedAdmin.response) {
    return verifiedAdmin.response;
  }

  try {
    const supabase = getSupabaseAdmin();
    const payload = await request.json();

    const documentId =
      cleanText(payload.id);

    const action =
      cleanText(payload.action)?.toLowerCase();

    if (!documentId) {
      return NextResponse.json(
        { error: "Document id is required." },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: "Document action is required." },
        { status: 400 }
      );
    }

    const { data: existingDocument, error: loadError } =
      await supabase
        .from("graymills_knowledge_documents")
        .select(documentSelect)
        .eq("id", documentId)
        .maybeSingle();

    if (loadError) {
      throw loadError;
    }

    if (!existingDocument) {
      return NextResponse.json(
        { error: "Knowledge document was not found." },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    const actor = {
      actor_user_id:
        verifiedAdmin.context.crmUserId,
      actor_name:
        verifiedAdmin.context.crmDisplayName,
    };

    let update: Record<string, unknown> = {
      updated_at: now,
    };

    const events: Array<Record<string, unknown>> = [];

    if (action === "update") {
      const approvalSensitiveFields = [
        "title",
        "documentType",
        "scopeType",
        "categoryId",
        "sourceUrl",
        "summary",
        "rawText",
      ];

      const approvalSensitiveChange =
        approvalSensitiveFields.some((field) =>
          Object.prototype.hasOwnProperty.call(
            payload,
            field
          )
        );

      if (
        Object.prototype.hasOwnProperty.call(
          payload,
          "title"
        )
      ) {
        const title = requireMaximumLength(
          cleanText(payload.title),
          240,
          "Title"
        );

        if (!title) {
          return NextResponse.json(
            {
              error:
                "Document title cannot be blank.",
            },
            { status: 400 }
          );
        }

        update.title = title;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          payload,
          "documentType"
        )
      ) {
        update.document_type =
          requireMaximumLength(
            cleanText(payload.documentType) ||
              "reference_document",
            80,
            "Document type"
          );
      }

      if (
        Object.prototype.hasOwnProperty.call(
          payload,
          "sourceUrl"
        )
      ) {
        update.source_url =
          requireMaximumLength(
            cleanText(payload.sourceUrl),
            2_000,
            "Source URL"
          );
      }

      if (
        Object.prototype.hasOwnProperty.call(
          payload,
          "summary"
        )
      ) {
        update.summary =
          requireMaximumLength(
            cleanText(payload.summary),
            maximumSummaryCharacters,
            "Summary"
          );
      }

      if (
        Object.prototype.hasOwnProperty.call(
          payload,
          "rawText"
        )
      ) {
        const rawText =
          requireMaximumLength(
            cleanText(payload.rawText),
            maximumExtractedCharacters,
            "Approved knowledge text"
          );

        update.raw_text = rawText;
        update.extraction_status =
          rawText
            ? "manual"
            : existingDocument.storage_path
              ? "pending"
              : "not_required";

        update.extraction_error = null;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          payload,
          "notes"
        )
      ) {
        update.notes =
          requireMaximumLength(
            cleanText(payload.notes),
            20_000,
            "Notes"
          );
      }

      if (
        Object.prototype.hasOwnProperty.call(
          payload,
          "versionLabel"
        )
      ) {
        update.version_label =
          requireMaximumLength(
            cleanText(payload.versionLabel),
            120,
            "Version label"
          );
      }

      if (
        Object.prototype.hasOwnProperty.call(
          payload,
          "scopeType"
        ) ||
        Object.prototype.hasOwnProperty.call(
          payload,
          "categoryId"
        )
      ) {
        const scope =
          await resolveKnowledgeScope(
            supabase,
            payload.scopeType ??
              existingDocument.scope_type,
            payload.categoryId ??
              existingDocument.graymills_category_id
          );

        update.scope_type =
          scope.scopeType;

        update.graymills_category_id =
          scope.graymillsCategoryId;

        update.product_area =
          scope.productArea;

        update.category_key_snapshot =
          scope.categoryKeySnapshot;

        update.category_name_snapshot =
          scope.categoryNameSnapshot;
      }

      if (
        approvalSensitiveChange &&
        existingDocument.approved_for_ai
      ) {
        update.approved_for_ai = false;
        update.status = "draft";
        update.approved_at = null;
        update.approved_by_user_id = null;
        update.approved_by_name = null;

        events.push({
          document_id: documentId,
          event_type: "approval_revoked",
          ...actor,
          details: {
            reason:
              "Approval was automatically revoked because controlled document content or routing was edited.",
          },
        });
      }

      const contentChanged =
        Object.prototype.hasOwnProperty.call(
          payload,
          "summary"
        ) ||
        Object.prototype.hasOwnProperty.call(
          payload,
          "rawText"
        );

      events.push({
        document_id: documentId,
        event_type: contentChanged
          ? "content_updated"
          : "metadata_updated",
        ...actor,
        details: {
          fields: Object.keys(payload).filter(
            (field) =>
              !["id", "action"].includes(field)
          ),
          approvalRevoked:
            approvalSensitiveChange &&
            Boolean(
              existingDocument.approved_for_ai
            ),
        },
      });
    } else if (action === "approve") {
      if (
        existingDocument.status === "archived" ||
        existingDocument.archived_at
      ) {
        return NextResponse.json(
          {
            error:
              "Restore this document before approving it.",
          },
          { status: 400 }
        );
      }

      const hasApprovedContent =
        Boolean(
          cleanText(existingDocument.raw_text)
        ) ||
        Boolean(
          cleanText(existingDocument.summary)
        ) ||
        Boolean(
          existingDocument.structured_data &&
          Object.keys(
            existingDocument.structured_data
          ).length > 0
        );

      if (!hasApprovedContent) {
        return NextResponse.json(
          {
            error:
              "Add a summary or approved knowledge text before approving this document for AI.",
          },
          { status: 400 }
        );
      }

      if (
        existingDocument.scope_type ===
          "category" &&
        !existingDocument.graymills_category_id
      ) {
        return NextResponse.json(
          {
            error:
              "Select a Graymills Category before approving this document.",
          },
          { status: 400 }
        );
      }

      update = {
        ...update,
        status: "active",
        approved_for_ai: true,
        approved_at: now,
        approved_by_user_id:
          verifiedAdmin.context.crmUserId,
        approved_by_name:
          verifiedAdmin.context.crmDisplayName,
        archived_at: null,
      };

      events.push({
        document_id: documentId,
        event_type: "approved",
        ...actor,
        details: {
          scopeType:
            existingDocument.scope_type,
          categoryName:
            existingDocument.category_name_snapshot,
          productArea:
            existingDocument.product_area,
        },
      });
    } else if (
      action === "revoke_approval"
    ) {
      update = {
        ...update,
        status: "draft",
        approved_for_ai: false,
        approved_at: null,
        approved_by_user_id: null,
        approved_by_name: null,
      };

      events.push({
        document_id: documentId,
        event_type: "approval_revoked",
        ...actor,
        details: {
          reason:
            cleanText(payload.reason) ||
            "Approval was revoked by an administrator.",
        },
      });
    } else if (action === "archive") {
      if (
        existingDocument.status === "archived"
      ) {
        return NextResponse.json(
          {
            error:
              "This knowledge document is already archived.",
          },
          { status: 400 }
        );
      }

      update = {
        ...update,
        status: "archived",
        approved_for_ai: false,
        archived_at: now,
        archived_by_user_id:
          verifiedAdmin.context.crmUserId,
        archived_by_name:
          verifiedAdmin.context.crmDisplayName,
      };

      events.push({
        document_id: documentId,
        event_type: "archived",
        ...actor,
        details: {
          previousStatus:
            existingDocument.status,
          wasApproved:
            Boolean(
              existingDocument.approved_for_ai
            ),
        },
      });
    } else if (action === "restore") {
      if (
        existingDocument.status !== "archived" &&
        !existingDocument.archived_at
      ) {
        return NextResponse.json(
          {
            error:
              "This knowledge document is not archived.",
          },
          { status: 400 }
        );
      }

      update = {
        ...update,
        status: "draft",
        approved_for_ai: false,
        archived_at: null,
        restored_at: now,
        restored_by_user_id:
          verifiedAdmin.context.crmUserId,
        restored_by_name:
          verifiedAdmin.context.crmDisplayName,
      };

      events.push({
        document_id: documentId,
        event_type: "restored",
        ...actor,
        details: {
          restoredAs: "draft",
          approvalRequired: true,
        },
      });
    } else {
      return NextResponse.json(
        {
          error:
            "Unsupported knowledge-document action.",
        },
        { status: 400 }
      );
    }

    const { data: updatedDocument, error: updateError } =
      await supabase
        .from("graymills_knowledge_documents")
        .update(update)
        .eq("id", documentId)
        .select(documentSelect)
        .single();

    if (updateError) {
      throw updateError;
    }

    await addDocumentEvents(
      supabase,
      events
    );

    const documentWithUrl =
      await addSignedUrl(
        supabase,
        updatedDocument
      );

    return NextResponse.json({
      status: "updated",
      action,
      document: {
        ...documentWithUrl,
        events,
      },
    });
  } catch (error) {
    return errorResponse(
      error,
      "Failed to update the knowledge document."
    );
  }
}