"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getBrowserSupabaseClient,
  hasBrowserSupabaseConfig,
} from "../../lib/supabase-browser";

type KnowledgeStatus =
  | "draft"
  | "active"
  | "archived";

type KnowledgeScopeType =
  | "all"
  | "category";

type KnowledgeCategory = {
  id: string;
  category_key: string;
  category_name: string;
  sort_order: number;
  status: "active" | "archived";
};

type KnowledgeDocumentEvent = {
  id: string;
  document_id: string;
  event_type: string;
  actor_user_id: string | null;
  actor_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

type KnowledgeDocument = {
  id: string;
  title: string;
  document_type: string;
  product_area: string | null;
  source_file_name: string | null;
  source_url: string | null;
  summary: string | null;
  approved_for_ai: boolean;
  version_label: string | null;
  status: KnowledgeStatus;
  raw_text: string | null;
  structured_data: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;

  graymills_category_id: string | null;
  scope_type: KnowledgeScopeType;
  category_key_snapshot: string | null;
  category_name_snapshot: string | null;

  source_kind: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  file_mime_type: string | null;
  file_size_bytes: number | null;
  file_sha256: string | null;

  extraction_status: string | null;
  extraction_error: string | null;

  uploaded_by_user_id: string | null;
  uploaded_by_name: string | null;

  approved_at: string | null;
  approved_by_user_id: string | null;
  approved_by_name: string | null;

  archived_by_user_id: string | null;
  archived_by_name: string | null;

  restored_at: string | null;
  restored_by_user_id: string | null;
  restored_by_name: string | null;

  signed_url: string | null;
  signed_url_error?: string | null;
  events: KnowledgeDocumentEvent[];
};

type KnowledgeForm = {
  title: string;
  documentType: string;
  scopeType: KnowledgeScopeType;
  categoryId: string;
  sourceUrl: string;
  summary: string;
  rawText: string;
  notes: string;
  versionLabel: string;
};

function createEmptyKnowledgeForm(): KnowledgeForm {
  return {
    title: "",
    documentType: "reference_document",
    scopeType: "category",
    categoryId: "",
    sourceUrl: "",
    summary: "",
    rawText: "",
    notes: "",
    versionLabel: "",
  };
}

async function readKnowledgeJson(
  response: Response
) {
  const contentType =
    response.headers.get("content-type") || "";

  const bodyText =
    await response.text();

  if (!contentType.includes("application/json")) {
    throw new Error(
      `Knowledge API returned ${response.status} ` +
      `${response.statusText} as ` +
      `${contentType || "unknown content type"}. ` +
      `Preview: ${bodyText.slice(0, 180)}`
    );
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error(
      `Knowledge API returned invalid JSON. ` +
      `Preview: ${bodyText.slice(0, 180)}`
    );
  }
}

async function getKnowledgeAuthorizationHeaders() {
  if (!hasBrowserSupabaseConfig()) {
    throw new Error(
      "Supabase browser authentication is not configured."
    );
  }

  const supabase =
    getBrowserSupabaseClient();

  const {
    data,
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(
      error.message ||
      "Could not read the signed-in Supabase session."
    );
  }

  const accessToken =
    data.session?.access_token;

  if (!accessToken) {
    throw new Error(
      "A signed-in Supabase Admin session is required."
    );
  }

  return {
    Authorization:
      `Bearer ${accessToken}`,
  };
}

function formatKnowledgeDate(
  value: string | null | undefined
) {
  if (!value) return "Not recorded";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatKnowledgeFileSize(
  value: number | null | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "Unknown size";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return (
    `${(value / (1024 * 1024)).toFixed(1)} MB`
  );
}

function formatKnowledgeEventType(
  eventType: string
) {
  return eventType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function knowledgeStatusClass(
  status: KnowledgeStatus
) {
  if (status === "active") {
    return (
      "bg-emerald-100 text-emerald-800 " +
      "ring-emerald-200"
    );
  }

  if (status === "archived") {
    return (
      "bg-slate-200 text-slate-700 " +
      "ring-slate-300"
    );
  }

  return (
    "bg-amber-100 text-amber-800 " +
    "ring-amber-200"
  );
}

export default function AdminKnowledgeLibrarySection({
  canManageKnowledge = false,
}: {
  canManageKnowledge?: boolean;
}) {
  const [documents, setDocuments] =
    useState<KnowledgeDocument[]>([]);

  const [categories, setCategories] =
    useState<KnowledgeCategory[]>([]);

  const [form, setForm] =
    useState<KnowledgeForm>(
      createEmptyKnowledgeForm()
    );

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [fileInputKey, setFileInputKey] =
    useState(0);

  const [
    editingDocumentId,
    setEditingDocumentId,
  ] = useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(false);

  const [isSavingForm, setIsSavingForm] =
    useState(false);

  const [
    busyDocumentId,
    setBusyDocumentId,
  ] = useState<string | null>(null);

  const [message, setMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [searchText, setSearchText] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<
      "all" | KnowledgeStatus
    >("all");

  const [scopeFilter, setScopeFilter] =
    useState<
      "any" | KnowledgeScopeType
    >("any");

  const activeCategories =
    useMemo(
      () =>
        categories.filter(
          (category) =>
            category.status === "active"
        ),
      [categories]
    );

  async function loadKnowledgeLibrary() {
    if (!canManageKnowledge) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const authorizationHeaders =
        await getKnowledgeAuthorizationHeaders();

      const response = await fetch(
        "/api/knowledge-documents",
        {
          method: "GET",
          headers: authorizationHeaders,
          cache: "no-store",
        }
      );

      const data =
        await readKnowledgeJson(response);

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Could not load the Knowledge Library."
        );
      }

      setDocuments(
        Array.isArray(data.documents)
          ? data.documents
          : []
      );

      setCategories(
        Array.isArray(data.categories)
          ? data.categories
          : []
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load the Knowledge Library."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (canManageKnowledge) {
      void loadKnowledgeLibrary();
    }
  }, [canManageKnowledge]);

  useEffect(() => {
    if (
      editingDocumentId ||
      form.scopeType !== "category" ||
      form.categoryId ||
      activeCategories.length === 0
    ) {
      return;
    }

    setForm((current) => ({
      ...current,
      categoryId:
        activeCategories[0].id,
    }));
  }, [
    activeCategories,
    editingDocumentId,
    form.categoryId,
    form.scopeType,
  ]);

  const filteredDocuments =
    useMemo(() => {
      const normalizedSearch =
        searchText.trim().toLowerCase();

      return documents.filter((document) => {
        if (
          statusFilter !== "all" &&
          document.status !== statusFilter
        ) {
          return false;
        }

        if (
          scopeFilter !== "any" &&
          document.scope_type !== scopeFilter
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const searchableText = [
          document.title,
          document.document_type,
          document.product_area,
          document.category_name_snapshot,
          document.source_file_name,
          document.source_url,
          document.summary,
          document.raw_text,
          document.notes,
          document.version_label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          normalizedSearch
        );
      });
    }, [
      documents,
      scopeFilter,
      searchText,
      statusFilter,
    ]);

  const activeDocumentCount =
    documents.filter(
      (document) =>
        document.status === "active" &&
        document.approved_for_ai
    ).length;

  const draftDocumentCount =
    documents.filter(
      (document) =>
        document.status === "draft"
    ).length;

  const archivedDocumentCount =
    documents.filter(
      (document) =>
        document.status === "archived"
    ).length;

  function resetKnowledgeForm() {
    setForm(createEmptyKnowledgeForm());
    setSelectedFile(null);
    setFileInputKey((current) => current + 1);
    setEditingDocumentId(null);
  }

  function beginEditingDocument(
    document: KnowledgeDocument
  ) {
    if (document.status === "archived") {
      setErrorMessage(
        "Restore this document before editing it."
      );
      return;
    }

    setMessage("");
    setErrorMessage("");
    setSelectedFile(null);
    setFileInputKey((current) => current + 1);

    setEditingDocumentId(document.id);

    setForm({
      title: document.title || "",
      documentType:
        document.document_type ||
        "reference_document",
      scopeType:
        document.scope_type === "all"
          ? "all"
          : "category",
      categoryId:
        document.graymills_category_id || "",
      sourceUrl:
        document.source_url || "",
      summary:
        document.summary || "",
      rawText:
        document.raw_text || "",
      notes:
        document.notes || "",
      versionLabel:
        document.version_label || "",
    });

    window.setTimeout(() => {
      window.document
        .getElementById(
          "admin-knowledge-library-form"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 0);
  }

  async function saveKnowledgeDocument() {
    if (!canManageKnowledge) {
      setErrorMessage(
        "Only CRM Admin users can manage approved knowledge."
      );
      return;
    }

    setMessage("");
    setErrorMessage("");

    const cleanedTitle =
      form.title.trim();

    if (!cleanedTitle) {
      setErrorMessage(
        "Document title is required."
      );
      return;
    }

    if (
      form.scopeType === "category" &&
      !form.categoryId
    ) {
      setErrorMessage(
        "Select a Graymills Category."
      );
      return;
    }

    if (
      !editingDocumentId &&
      !selectedFile &&
      !form.rawText.trim()
    ) {
      setErrorMessage(
        "Choose a document file or enter approved knowledge text."
      );
      return;
    }

    setIsSavingForm(true);

    try {
      const authorizationHeaders =
        await getKnowledgeAuthorizationHeaders();

      let response: Response;

      if (editingDocumentId) {
        response = await fetch(
          "/api/knowledge-documents",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              ...authorizationHeaders,
            },
            body: JSON.stringify({
              id: editingDocumentId,
              action: "update",
              title: cleanedTitle,
              documentType:
                form.documentType,
              scopeType:
                form.scopeType,
              categoryId:
                form.scopeType === "category"
                  ? form.categoryId
                  : null,
              sourceUrl:
                form.sourceUrl,
              summary:
                form.summary,
              rawText:
                form.rawText,
              notes:
                form.notes,
              versionLabel:
                form.versionLabel,
            }),
          }
        );
      } else {
        const formData =
          new FormData();

        formData.append(
          "title",
          cleanedTitle
        );

        formData.append(
          "documentType",
          form.documentType
        );

        formData.append(
          "scopeType",
          form.scopeType
        );

        if (
          form.scopeType === "category"
        ) {
          formData.append(
            "categoryId",
            form.categoryId
          );
        }

        formData.append(
          "sourceUrl",
          form.sourceUrl
        );

        formData.append(
          "summary",
          form.summary
        );

        formData.append(
          "rawText",
          form.rawText
        );

        formData.append(
          "notes",
          form.notes
        );

        formData.append(
          "versionLabel",
          form.versionLabel
        );

        if (selectedFile) {
          formData.append(
            "file",
            selectedFile
          );
        }

        response = await fetch(
          "/api/knowledge-documents",
          {
            method: "POST",
            headers:
              authorizationHeaders,
            body: formData,
          }
        );
      }

      const data =
        await readKnowledgeJson(response);

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Could not save the knowledge document."
        );
      }

      setMessage(
        editingDocumentId
          ? "Knowledge document updated. Approved documents return to draft when controlled content or routing is edited."
          : data.message ||
            "Knowledge document uploaded as a draft."
      );

      resetKnowledgeForm();
      await loadKnowledgeLibrary();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not save the knowledge document."
      );
    } finally {
      setIsSavingForm(false);
    }
  }

  async function runDocumentAction(
    document: KnowledgeDocument,
    action:
      | "approve"
      | "revoke_approval"
      | "archive"
      | "restore"
  ) {
    setMessage("");
    setErrorMessage("");

    if (
      action === "archive" &&
      !window.confirm(
        `Archive "${document.title}"? ` +
        "It will immediately stop being available to AI."
      )
    ) {
      return;
    }

    if (
      action === "revoke_approval" &&
      !window.confirm(
        `Revoke AI approval for "${document.title}"? ` +
        "The document will return to draft status."
      )
    ) {
      return;
    }

    setBusyDocumentId(document.id);

    try {
      const authorizationHeaders =
        await getKnowledgeAuthorizationHeaders();

      const response = await fetch(
        "/api/knowledge-documents",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            ...authorizationHeaders,
          },
          body: JSON.stringify({
            id: document.id,
            action,
          }),
        }
      );

      const data =
        await readKnowledgeJson(response);

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Could not update the knowledge document."
        );
      }

      const successMessages = {
        approve:
          "Document approved and available to category-scoped AI analysis.",
        revoke_approval:
          "AI approval revoked. Document returned to draft.",
        archive:
          "Document archived. The file and history were preserved.",
        restore:
          "Document restored as a draft. Approval is required before AI can use it.",
      };

      setMessage(
        successMessages[action]
      );

      if (
        editingDocumentId === document.id &&
        (
          action === "archive" ||
          action === "restore"
        )
      ) {
        resetKnowledgeForm();
      }

      await loadKnowledgeLibrary();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not update the knowledge document."
      );
    } finally {
      setBusyDocumentId(null);
    }
  }

  return (
    <section className="max-w-full overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
      <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">
              Admin · AI Governance
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Controlled Knowledge Library
            </h2>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Upload Graymills reference material as a draft,
              review its scope and AI text, then explicitly
              approve it. Only active approved documents are
              supplied to prospect analysis.
            </p>
          </div>

          <button
            type="button"
            onClick={loadKnowledgeLibrary}
            disabled={
              isLoading ||
              !canManageKnowledge
            }
            className="w-fit rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            {isLoading
              ? "Refreshing..."
              : "Refresh Library"}
          </button>
        </div>

        {!canManageKnowledge && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Only signed-in CRM Admin users can manage
            approved knowledge.
          </div>
        )}
      </div>

      <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Documents
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {documents.length}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            AI Approved
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">
            {activeDocumentCount}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Draft Review
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-800">
            {draftDocumentCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Archived
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-700">
            {archivedDocumentCount}
          </p>
        </div>
      </div>

      {(message || errorMessage) && (
        <div className="grid gap-2 border-b border-slate-200 p-5">
          {message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
              {message}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">
              {errorMessage}
            </div>
          )}
        </div>
      )}

      <div
        id="admin-knowledge-library-form"
        className="border-b border-slate-200 p-5"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-950">
              {editingDocumentId
                ? "Edit Knowledge Draft"
                : "Add Knowledge Document"}
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              New documents always begin as drafts.
              Uploading a file does not automatically approve
              its contents for AI use.
            </p>
          </div>

          {editingDocumentId && (
            <button
              type="button"
              onClick={resetKnowledgeForm}
              disabled={isSavingForm}
              className="w-fit rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed"
            >
              Cancel Edit
            </button>
          )}
        </div>

        {editingDocumentId && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            Saving controlled content or routing changes to an
            approved document automatically revokes approval
            and returns it to draft status.
          </div>
        )}

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Document Title
            <input
              type="text"
              value={form.title}
              disabled={
                isSavingForm ||
                !canManageKnowledge
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title:
                    event.target.value,
                }))
              }
              placeholder="Example: Parts Washer Application Guide"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Document Type
            <select
              value={form.documentType}
              disabled={
                isSavingForm ||
                !canManageKnowledge
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  documentType:
                    event.target.value,
                }))
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal shadow-sm"
            >
              <option value="reference_document">
                Reference Document
              </option>
              <option value="catalog">
                Catalog
              </option>
              <option value="application_guide">
                Application Guide
              </option>
              <option value="sales_playbook">
                Sales Playbook
              </option>
              <option value="technical_specification">
                Technical Specification
              </option>
              <option value="case_study">
                Case Study
              </option>
              <option value="guardrail">
                AI Guardrail
              </option>
              <option value="other">
                Other
              </option>
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Knowledge Scope
            <select
              value={form.scopeType}
              disabled={
                isSavingForm ||
                !canManageKnowledge
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  scopeType:
                    event.target.value === "all"
                      ? "all"
                      : "category",
                  categoryId:
                    event.target.value === "all"
                      ? ""
                      : current.categoryId,
                }))
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal shadow-sm"
            >
              <option value="category">
                One Graymills Category
              </option>
              <option value="all">
                All Categories
              </option>
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Graymills Category
            <select
              value={form.categoryId}
              disabled={
                form.scopeType === "all" ||
                isSavingForm ||
                !canManageKnowledge
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  categoryId:
                    event.target.value,
                }))
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal shadow-sm disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">
                Select Graymills Category
              </option>

              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.category_name}
                  {category.status === "archived"
                    ? " — Archived"
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Version Label
            <input
              type="text"
              value={form.versionLabel}
              disabled={
                isSavingForm ||
                !canManageKnowledge
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  versionLabel:
                    event.target.value,
                }))
              }
              placeholder="Example: 2026 Edition"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal shadow-sm"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Source URL
            <input
              type="url"
              value={form.sourceUrl}
              disabled={
                isSavingForm ||
                !canManageKnowledge
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sourceUrl:
                    event.target.value,
                }))
              }
              placeholder="https://..."
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal shadow-sm"
            />
          </label>

          <div className="xl:col-span-2">
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Document File
              {editingDocumentId ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-normal text-slate-600">
                  Stored files are preserved during metadata
                  edits. Create a new draft to upload a replacement
                  file.
                </div>
              ) : (
                <input
                  key={fileInputKey}
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx"
                  disabled={
                    isSavingForm ||
                    !canManageKnowledge
                  }
                  onChange={(event) =>
                    setSelectedFile(
                      event.target.files?.[0] ??
                      null
                    )
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal shadow-sm"
                />
              )}
            </label>

            {!editingDocumentId && (
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Maximum 25 MB. TXT, Markdown, CSV, and JSON
                text is extracted automatically. PDF, Word, and
                Excel files require a reviewed Summary or AI
                Knowledge Text before approval.
              </p>
            )}
          </div>

          <label className="grid gap-1 text-sm font-semibold text-slate-700 xl:col-span-2">
            Reviewed Summary
            <textarea
              value={form.summary}
              disabled={
                isSavingForm ||
                !canManageKnowledge
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  summary:
                    event.target.value,
                }))
              }
              rows={4}
              placeholder="A reviewed summary of what this document authorizes the AI to use."
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal leading-6 shadow-sm"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700 xl:col-span-2">
            Approved Knowledge Text
            <textarea
              value={form.rawText}
              disabled={
                isSavingForm ||
                !canManageKnowledge
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  rawText:
                    event.target.value,
                }))
              }
              rows={9}
              placeholder="Paste reviewed product facts, proof points, caution language, discovery guidance, and approved sales claims."
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-xs leading-6 shadow-sm"
            />

            <span className="text-xs font-normal text-slate-500">
              AI uses this field, the reviewed Summary, and any
              structured knowledge only after explicit approval.
            </span>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700 xl:col-span-2">
            Internal Notes
            <textarea
              value={form.notes}
              disabled={
                isSavingForm ||
                !canManageKnowledge
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes:
                    event.target.value,
                }))
              }
              rows={3}
              placeholder="Internal review notes, ownership, limitations, or follow-up work."
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal leading-6 shadow-sm"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveKnowledgeDocument}
            disabled={
              isSavingForm ||
              !canManageKnowledge
            }
            className="rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSavingForm
              ? "Saving..."
              : editingDocumentId
                ? "Save Draft Changes"
                : "Upload as Draft"}
          </button>

          {editingDocumentId && (
            <button
              type="button"
              onClick={resetKnowledgeForm}
              disabled={isSavingForm}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-950">
              Knowledge Documents
            </h3>

            <p className="mt-1 text-sm text-slate-600">
              Showing {filteredDocuments.length} of{" "}
              {documents.length} documents.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Search
              <input
                type="search"
                value={searchText}
                onChange={(event) =>
                  setSearchText(
                    event.target.value
                  )
                }
                placeholder="Title, category, text..."
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Status
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | "all"
                      | KnowledgeStatus
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="all">
                  All Statuses
                </option>
                <option value="draft">
                  Draft
                </option>
                <option value="active">
                  Active
                </option>
                <option value="archived">
                  Archived
                </option>
              </select>
            </label>

            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Scope
              <select
                value={scopeFilter}
                onChange={(event) =>
                  setScopeFilter(
                    event.target.value as
                      | "any"
                      | KnowledgeScopeType
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="any">
                  All Scopes
                </option>
                <option value="all">
                  All Categories
                </option>
                <option value="category">
                  One Category
                </option>
              </select>
            </label>
          </div>
        </div>

        {isLoading && documents.length === 0 ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            Loading controlled knowledge...
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            No knowledge documents match the current filters.
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {filteredDocuments.map((document) => {
              const isBusy =
                busyDocumentId === document.id;

              return (
                <article
                  key={document.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                >
                  <div className="p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              "rounded-full px-2.5 py-1 text-xs font-bold capitalize ring-1 " +
                              knowledgeStatusClass(
                                document.status
                              )
                            }
                          >
                            {document.status}
                          </span>

                          <span
                            className={
                              document.approved_for_ai
                                ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200"
                                : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
                            }
                          >
                            {document.approved_for_ai
                              ? "AI Approved"
                              : "Not AI Approved"}
                          </span>

                          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-200">
                            {document.scope_type === "all"
                              ? "All Categories"
                              : document.category_name_snapshot ||
                                document.product_area ||
                                "Category Not Set"}
                          </span>

                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-200">
                            Extraction:{" "}
                            {document.extraction_status ||
                              "unknown"}
                          </span>
                        </div>

                        <h4 className="mt-3 break-words text-lg font-bold text-slate-950">
                          {document.title}
                        </h4>

                        <p className="mt-1 break-words text-sm text-slate-600">
                          {document.document_type ||
                            "reference_document"}
                          {" · "}
                          Updated{" "}
                          {formatKnowledgeDate(
                            document.updated_at
                          )}
                        </p>

                        {document.summary && (
                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                            {document.summary}
                          </p>
                        )}
                      </div>

                      <div className="flex max-w-full flex-wrap gap-2">
                        {document.signed_url && (
                          <a
                            href={document.signed_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                          >
                            Open File
                          </a>
                        )}

                        {document.source_url && (
                          <a
                            href={document.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Source URL
                          </a>
                        )}

                        {document.status !== "archived" && (
                          <button
                            type="button"
                            onClick={() =>
                              beginEditingDocument(
                                document
                              )
                            }
                            disabled={
                              isBusy ||
                              !canManageKnowledge
                            }
                            className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                          >
                            Edit
                          </button>
                        )}

                        {document.status === "draft" &&
                          !document.approved_for_ai && (
                            <button
                              type="button"
                              onClick={() =>
                                runDocumentAction(
                                  document,
                                  "approve"
                                )
                              }
                              disabled={
                                isBusy ||
                                !canManageKnowledge
                              }
                              className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {isBusy
                                ? "Working..."
                                : "Approve for AI"}
                            </button>
                          )}

                        {document.approved_for_ai && (
                          <button
                            type="button"
                            onClick={() =>
                              runDocumentAction(
                                document,
                                "revoke_approval"
                              )
                            }
                            disabled={
                              isBusy ||
                              !canManageKnowledge
                            }
                            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                          >
                            Revoke Approval
                          </button>
                        )}

                        {document.status !== "archived" ? (
                          <button
                            type="button"
                            onClick={() =>
                              runDocumentAction(
                                document,
                                "archive"
                              )
                            }
                            disabled={
                              isBusy ||
                              !canManageKnowledge
                            }
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              runDocumentAction(
                                document,
                                "restore"
                              )
                            }
                            disabled={
                              isBusy ||
                              !canManageKnowledge
                            }
                            className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            Restore as Draft
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-xs text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="font-bold text-slate-700">
                          File
                        </p>
                        <p className="mt-1 break-words">
                          {document.source_file_name ||
                            "Manual text entry"}
                        </p>
                        <p className="mt-1">
                          {formatKnowledgeFileSize(
                            document.file_size_bytes
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="font-bold text-slate-700">
                          Uploaded By
                        </p>
                        <p className="mt-1 break-words">
                          {document.uploaded_by_name ||
                            "Legacy seed"}
                        </p>
                        <p className="mt-1">
                          {formatKnowledgeDate(
                            document.created_at
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="font-bold text-slate-700">
                          Approved By
                        </p>
                        <p className="mt-1 break-words">
                          {document.approved_by_name ||
                            "Not approved"}
                        </p>
                        <p className="mt-1">
                          {formatKnowledgeDate(
                            document.approved_at
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="font-bold text-slate-700">
                          Version
                        </p>
                        <p className="mt-1 break-words">
                          {document.version_label ||
                            "Not specified"}
                        </p>
                        <p className="mt-1">
                          Source:{" "}
                          {document.source_kind ||
                            "legacy"}
                        </p>
                      </div>
                    </div>

                    {document.extraction_error && (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-900">
                        Extraction error:{" "}
                        {document.extraction_error}
                      </div>
                    )}

                    <div className="mt-4 grid gap-3">
                      {document.raw_text && (
                        <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <summary className="cursor-pointer text-sm font-bold text-slate-800">
                            Review AI Knowledge Text
                          </summary>

                          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-xs leading-6 text-slate-700 ring-1 ring-slate-200">
                            {document.raw_text}
                          </pre>
                        </details>
                      )}

                      {document.notes && (
                        <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <summary className="cursor-pointer text-sm font-bold text-slate-800">
                            Internal Notes
                          </summary>

                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                            {document.notes}
                          </p>
                        </details>
                      )}

                      <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <summary className="cursor-pointer text-sm font-bold text-slate-800">
                          Lifecycle History (
                          {document.events?.length || 0})
                        </summary>

                        {!document.events ||
                        document.events.length === 0 ? (
                          <p className="mt-3 text-sm text-slate-500">
                            No lifecycle events have been
                            recorded for this legacy document.
                          </p>
                        ) : (
                          <div className="mt-3 grid gap-2">
                            {document.events.map(
                              (event) => (
                                <div
                                  key={event.id}
                                  className="rounded-lg border border-slate-200 bg-white p-3"
                                >
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs font-bold text-slate-800">
                                      {formatKnowledgeEventType(
                                        event.event_type
                                      )}
                                    </p>

                                    <p className="text-xs text-slate-500">
                                      {formatKnowledgeDate(
                                        event.created_at
                                      )}
                                    </p>
                                  </div>

                                  <p className="mt-1 text-xs text-slate-600">
                                    Actor:{" "}
                                    {event.actor_name ||
                                      "System"}
                                  </p>

                                  {event.details &&
                                    Object.keys(
                                      event.details
                                    ).length > 0 && (
                                      <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-50 p-2 text-[11px] leading-5 text-slate-600">
                                        {JSON.stringify(
                                          event.details,
                                          null,
                                          2
                                        )}
                                      </pre>
                                    )}
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </details>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}