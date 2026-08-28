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

const SESSION_CACHE_KEY =
  "graymills-mailshake-campaigns-v3.27";

const CONTACT_PAGE_SIZE = 50;

type MailshakeCampaign = {
  providerCampaignId: string;
  title: string;
  createdAt: string | null;
  isArchived: boolean;
  isPaused: boolean;
  sender: {
    id: string | null;
    emailAddress: string | null;
    fromName: string | null;
  };
};

type MailshakeResponse = {
  status?: string;
  provider?: string;
  campaignCount?: number;
  pagesRead?: number;
  paginationComplete?: boolean;
  paginationNote?: string | null;
  campaigns?: MailshakeCampaign[];
  message?: string;
  error?: string;
};

type CachedOutreachState = {
  campaigns: MailshakeCampaign[];
  pagesRead: number;
  paginationComplete: boolean;
  paginationNote: string | null;
  successMessage: string;
  loadedAt: string;
};

type FilterOption = {
  id: string;
  label: string;
};

type ProjectFilterOption =
  FilterOption & {
    kind: "project" | "list";
  };

type OutreachContact = {
  contactId: string;
  companyId: string;
  companyName: string;
  firstName: string;
  lastName: string;
  fullName: string;
  title: string;
  managementLevel: string;
  department: string;
  functionArea: string;
  state: string;
  email: string;
  phoneNumber: string;
  marketTags: FilterOption[];
  sectorTags: FilterOption[];
  categoryTags: FilterOption[];
  projects: ProjectFilterOption[];
  doNotContact: boolean;
  duplicateEmailInCrm: boolean;
  eligibleForMailshake: boolean;
  eligibilityReason: string;
};

type OutreachContactResponse = {
  status?: string;
  provider?: string;
  mode?: string;
  selectionSafe?: boolean;
  dncControlAvailable?: boolean;
  totalActiveContacts?: number;
  eligibleCount?: number;
  blockedCount?: number;
  pagesRead?: number;
  blockedCounts?: {
    doNotContact?: number;
    missingEmail?: number;
    duplicateEmail?: number;
  };
  filterOptions?: {
    companies?: FilterOption[];
    states?: string[];
    managementLevels?: string[];
    functions?: string[];
    marketTags?: FilterOption[];
    sectorTags?: FilterOption[];
    categoryTags?: FilterOption[];
    projects?: ProjectFilterOption[];
  };
  contacts?: OutreachContact[];
  message?: string;
  error?: string;
};

type EnrollmentRequestResponse = {
  status?: string;
  mode?: string;
  batchId?: string | null;
  recordedEnrollmentCount?: number;
  requestedCount?: number;
  eligibleCount?: number;
  blockedCount?: number;
  alreadyRecordedCount?: number;
  newEnrollmentCount?: number;
  sourceListId?: string | null;
  sourceListName?: string | null;
  listMemberCount?: number | null;
  listEligibleCount?: number | null;
  listBlockedCount?: number | null;
  blocked?: {
    contactId: string;
    reason: string;
  }[];
  alreadyRecordedContactIds?: string[];
  providerReview?: {
    readOnly?: boolean;
    providerCampaignId?: string;
    providerCampaignTitle?: string;
    providerCampaignState?:
      | "paused"
      | "not_paused"
      | "archived";
    isArchived?: boolean;
    isPaused?: boolean;
    recordedEnrollmentCount?: number;
    readyToSubmitCount?: number;
    readyContactIds?: string[];
    blockedNowCount?: number;
    missingCrmEnrollmentCount?: number;
    emailChangedCount?: number;
    nonRequestedCount?: number;
    batchIds?: string[];
    providerExecutionAllowed?: boolean;
    providerWritePolicyAllowed?: boolean;
    providerWritePolicyMode?: string;
    providerWriteEnvironment?: string;
    providerWritePolicyReason?: string;
  };
  message?: string;
  error?: string;
};

type ProductionAuthorizationReviewResponse = {
  status?: string;
  mode?: string;
  reviewedAt?: string;
  environment?: string;
  providerCampaignId?: string;
  providerCampaignTitle?: string;
  providerCampaignState?: string;
  serverReadyCount?: number;
  proposedCount?: number;
  verifiedProposedCount?: number;
  blockedProposedCount?: number;
  maxControlledAuthorizationCount?: number;
  authorizationDurationMinutes?: number;
  createConfirmationPhrase?: string | null;
  authorizationCreated?: boolean;
  safetyChecksPassedForProposedSet?: boolean;
  eligibleForLaterProductionAuthorization?: boolean;
  activeProviderOperationCount?: number;
  existingProviderRecipientCount?: number;
  activeAuthorization?: {
    status?: string;
    authorizedCount?: number;
    authorizedAt?: string | null;
    expiresAt?: string | null;
    expiredByClock?: boolean;
  } | null;
  blockedReasons?: string[];
  providerWritePolicyAllowed?: boolean;
  providerWritePolicyMode?: string;
  providerWritePolicyReason?: string;
  message?: string;
  error?: string;
};
type ProductionAuthorizationLifecycleResponse = {
  status?: string;
  authorizationCreated?: boolean;
  authorizationCancelled?: boolean;
  providerExecutionUnlocked?: boolean;

  authorization?: {
    id?: string;
    status?: string;
    authorized_count?: number;
    expires_at?: string | null;
    cancelled_at?: string | null;
    stop_reason?: string | null;
  } | null;

  cancelConfirmationPhrase?: string | null;
  message?: string;
  error?: string;
};
type ProviderSubmissionResponse = {
  status?: string;
  mode?: string;
  provider?: string;
  providerCampaignId?: string;
  providerCampaignTitle?: string;
  providerCampaignState?: string;
  operationId?: string;
  enrollmentId?: string;
  providerCheckStatusId?: string | null;
  submittedCount?: number;
  enrollmentStatus?: string;
  providerRecipientId?: string | null;
  warning?: string | null;
  message?: string;
  error?: string;
};

type ProviderBatchSubmissionItem = {
  sequence: number;
  contactId: string;
  status: string;
  httpStatus?: number;
  operationId?: string;
  providerCheckStatusId?: string | null;
  message?: string;
  error?: string;
};

const MAX_CONTROLLED_PROVIDER_RUN_SIZE = 10;

type ProviderStatusResponse = {
  status?: string;
  mode?: string;
  operationId?: string;
  operationStatus?: string;
  providerCheckStatusId?: string | null;
  isFinished?: boolean;
  enrollmentStatus?: string;
  providerRecipientId?: string | null;
  message?: string;
  error?: string;
};

type ProviderHistoryRecipient = {
  enrollmentId?: string | null;
  batchId?: string | null;
  batchStatus?: string | null;
  campaignName?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  submittedEmail?: string | null;
  enrollmentStatus?: string | null;
  mappingStatus?: string | null;
  providerRecipientId?: string | null;
  providerStatus?: string | null;
  providerMessage?: string | null;
  requestedAt?: string | null;
  submittedAt?: string | null;
  confirmedAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
};

type ProviderHistoryOperation = {
  id?: string;
  provider?: string;
  operationType?: string;
  outreachCampaignId?: string | null;
  providerCampaignId?: string;
  campaignName?: string | null;
  status?: string;
  providerCheckStatusId?: string | null;
  requestedByCrmUserId?: string | null;
  requestedByDisplayName?: string | null;
  requestedCount?: number;
  submittedCount?: number;
  confirmedCount?: number;
  alreadyPresentCount?: number;
  unsubscribedCount?: number;
  failedCount?: number;
  providerMessage?: string | null;
  errorMessage?: string | null;
  requestedAt?: string | null;
  submittedAt?: string | null;
  lastCheckedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  recipients?: ProviderHistoryRecipient[];
};

type ProviderHistoryResponse = {
  mode?: string;
  readOnly?: boolean;
  provider?: string;
  count?: number;
  operations?: ProviderHistoryOperation[];
  message?: string;
  error?: string;
};

function formatProviderHistoryTime(
  value: string | null | undefined
) {
  if (!value) {
    return "—";
  }

  const parsed =
    new Date(
      value
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return value;
  }

  return parsed.toLocaleString();
}

function providerHistoryStatusClasses(
  value: string | null | undefined
) {
  const status =
    String(
      value || ""
    ).toLowerCase();

  if (
    status === "completed" ||
    status === "confirmed" ||
    status === "already_present"
  ) {
    return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  }

  if (
    status === "submitted" ||
    status === "submitting" ||
    status === "checking" ||
    status === "prepared"
  ) {
    return "bg-blue-100 text-blue-800 ring-blue-200";
  }

  if (
    status === "failed" ||
    status === "submission_unknown"
  ) {
    return "bg-red-100 text-red-800 ring-red-200";
  }

  if (
    status === "partial" ||
    status === "unsubscribed" ||
    status === "cancelled"
  ) {
    return "bg-amber-100 text-amber-900 ring-amber-200";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

async function getBearerHeaders() {
  if (
    !hasBrowserSupabaseConfig()
  ) {
    throw new Error(
      "Browser Supabase configuration is not available."
    );
  }

  const supabase =
    getBrowserSupabaseClient();

  const {
    data,
    error,
  } =
    await supabase.auth.getSession();

  if (error) {
    throw new Error(
      error.message ||
        "Could not read the signed-in CRM session."
    );
  }

  const accessToken =
    data.session?.access_token;

  if (!accessToken) {
    throw new Error(
      "A signed-in CRM session is required."
    );
  }

  return {
    Authorization:
      `Bearer ${accessToken}`,
  };
}

function campaignStatus(
  campaign: MailshakeCampaign
) {
  if (campaign.isArchived) {
    return {
      label: "Archived",
      classes:
        "bg-slate-200 text-slate-700 ring-slate-300",
    };
  }

  if (campaign.isPaused) {
    return {
      label: "Paused",
      classes:
        "bg-amber-100 text-amber-800 ring-amber-200",
    };
  }

  return {
    label: "Not Paused",
    classes:
      "bg-emerald-100 text-emerald-800 ring-emerald-200",
  };
}

function formatLoadedTime(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function normalizeSearch(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function hasOption(
  values: FilterOption[],
  id: string
) {
  return values.some(
    (value) =>
      value.id === id
  );
}

export default function OutreachMailshakeSection({
  canAccess,
}: {
  canAccess: boolean;
}) {
  const [
    campaigns,
    setCampaigns,
  ] =
    useState<
      MailshakeCampaign[]
    >([]);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(false);

  const [
    hasLoaded,
    setHasLoaded,
  ] =
    useState(false);

  const [
    pagesRead,
    setPagesRead,
  ] =
    useState(0);

  const [
    paginationComplete,
    setPaginationComplete,
  ] =
    useState(false);

  const [
    paginationNote,
    setPaginationNote,
  ] =
    useState<
      string | null
    >(null);

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    restoredFromSession,
    setRestoredFromSession,
  ] =
    useState(false);

  const [
    cachedAt,
    setCachedAt,
  ] =
    useState("");

  const [
    contacts,
    setContacts,
  ] =
    useState<
      OutreachContact[]
    >([]);

  const [
    contactResponse,
    setContactResponse,
  ] =
    useState<
      OutreachContactResponse | null
    >(null);

  const [
    isLoadingContacts,
    setIsLoadingContacts,
  ] =
    useState(false);

  const [
    contactsLoaded,
    setContactsLoaded,
  ] =
    useState(false);

  const [
    contactError,
    setContactError,
  ] =
    useState("");

  const [
    contactMessage,
    setContactMessage,
  ] =
    useState("");

  const [
    contactSearch,
    setContactSearch,
  ] =
    useState("");

  const [
    companyFilter,
    setCompanyFilter,
  ] =
    useState("All");

  const [
    stateFilter,
    setStateFilter,
  ] =
    useState("All");

  const [
    managementFilter,
    setManagementFilter,
  ] =
    useState("All");

  const [
    functionFilter,
    setFunctionFilter,
  ] =
    useState("All");

  const [
    marketFilter,
    setMarketFilter,
  ] =
    useState("All");

  const [
    sectorFilter,
    setSectorFilter,
  ] =
    useState("All");

  const [
    categoryFilter,
    setCategoryFilter,
  ] =
    useState("All");

  const [
    projectFilter,
    setProjectFilter,
  ] =
    useState("All");

  const [
    eligibilityFilter,
    setEligibilityFilter,
  ] =
    useState("All");

  const [
    selectedContactIds,
    setSelectedContactIds,
  ] =
    useState<string[]>(
      []
    );

  const [
    selectedCampaignId,
    setSelectedCampaignId,
  ] =
    useState("");

  const [
    selectionUsedSelectAll,
    setSelectionUsedSelectAll,
  ] =
    useState(false);

  const [
    listBatchSourceListId,
    setListBatchSourceListId,
  ] =
    useState("");

  const [
    enrollmentReview,
    setEnrollmentReview,
  ] =
    useState<
      EnrollmentRequestResponse | null
    >(null);

  const [
    enrollmentReviewFingerprint,
    setEnrollmentReviewFingerprint,
  ] =
    useState("");

  const [
    recordedEnrollmentFingerprint,
    setRecordedEnrollmentFingerprint,
  ] =
    useState("");

  const [
    isReviewingEnrollment,
    setIsReviewingEnrollment,
  ] =
    useState(false);

  const [
    isRecordingEnrollment,
    setIsRecordingEnrollment,
  ] =
    useState(false);

  const [
    enrollmentError,
    setEnrollmentError,
  ] =
    useState("");

  const [
    enrollmentMessage,
    setEnrollmentMessage,
  ] =
    useState("");

  const [
    providerExecutionReview,
    setProviderExecutionReview,
  ] =
    useState<
      EnrollmentRequestResponse | null
    >(null);

  const [
    providerExecutionReviewFingerprint,
    setProviderExecutionReviewFingerprint,
  ] =
    useState("");

  const [
    isReviewingProviderExecution,
    setIsReviewingProviderExecution,
  ] =
    useState(false);

  const [
    providerExecutionError,
    setProviderExecutionError,
  ] =
    useState("");

  const [
    providerExecutionMessage,
    setProviderExecutionMessage,
  ] =
    useState("");

  const [
    authorizationReview,
    setAuthorizationReview,
  ] =
    useState<
      ProductionAuthorizationReviewResponse | null
    >(null);

  const [
    authorizationReviewFingerprint,
    setAuthorizationReviewFingerprint,
  ] =
    useState("");

  const [
    isReviewingAuthorization,
    setIsReviewingAuthorization,
  ] =
    useState(false);

  const [
    authorizationReviewError,
    setAuthorizationReviewError,
  ] =
    useState("");
  const [
    authorizationLifecycle,
    setAuthorizationLifecycle,
  ] =
    useState<
      ProductionAuthorizationLifecycleResponse | null
    >(null);

  const [
    authorizationCreateConfirmation,
    setAuthorizationCreateConfirmation,
  ] =
    useState("");

  const [
    authorizationCancelConfirmation,
    setAuthorizationCancelConfirmation,
  ] =
    useState("");

  const [
    authorizationCancellationReason,
    setAuthorizationCancellationReason,
  ] =
    useState("");

  const [
    authorizationLifecycleError,
    setAuthorizationLifecycleError,
  ] =
    useState("");

  const [
    isCreatingAuthorization,
    setIsCreatingAuthorization,
  ] =
    useState(false);

  const [
    isCancellingAuthorization,
    setIsCancellingAuthorization,
  ] =
    useState(false);
  const [
    providerSubmissionResult,
    setProviderSubmissionResult,
  ] =
    useState<
      ProviderSubmissionResponse | null
    >(null);

  const [
    providerSubmissionError,
    setProviderSubmissionError,
  ] =
    useState("");

  const [
    isSubmittingProvider,
    setIsSubmittingProvider,
  ] =
    useState(false);

  const [
    providerBatchSubmissionResults,
    setProviderBatchSubmissionResults,
  ] =
    useState<
      ProviderBatchSubmissionItem[]
    >([]);

  const [
    providerBatchPlannedCount,
    setProviderBatchPlannedCount,
  ] =
    useState(0);

  const [
    providerBatchMessage,
    setProviderBatchMessage,
  ] =
    useState("");
  const [
    providerStatusResult,
    setProviderStatusResult,
  ] =
    useState<
      ProviderStatusResponse | null
    >(null);

  const [
    providerStatusTargetOperationId,
    setProviderStatusTargetOperationId,
  ] =
    useState("");

  const [
    providerStatusError,
    setProviderStatusError,
  ] =
    useState("");

  const [
    isCheckingProviderStatus,
    setIsCheckingProviderStatus,
  ] =
    useState(false);

  const [
    providerHistory,
    setProviderHistory,
  ] =
    useState<
      ProviderHistoryOperation[]
    >([]);

  const [
    providerHistoryMessage,
    setProviderHistoryMessage,
  ] =
    useState("");

  const [
    providerHistoryError,
    setProviderHistoryError,
  ] =
    useState("");

  const [
    isLoadingProviderHistory,
    setIsLoadingProviderHistory,
  ] =
    useState(false);

  const [
    hasLoadedProviderHistory,
    setHasLoadedProviderHistory,
  ] =
    useState(false);

  const [
    contactPage,
    setContactPage,
  ] =
    useState(1);

  useEffect(() => {
    try {
      const raw =
        window.sessionStorage.getItem(
          SESSION_CACHE_KEY
        );

      if (!raw) {
        return;
      }

      const cached =
        JSON.parse(
          raw
        ) as CachedOutreachState;

      if (
        !Array.isArray(
          cached.campaigns
        )
      ) {
        return;
      }

      setCampaigns(
        cached.campaigns
      );

      setPagesRead(
        Number(
          cached.pagesRead || 0
        )
      );

      setPaginationComplete(
        cached.paginationComplete ===
          true
      );

      setPaginationNote(
        cached.paginationNote ||
          null
      );

      setSuccessMessage(
        cached.successMessage ||
          `Restored ${cached.campaigns.length} Mailshake campaigns from this browser session.`
      );

      setCachedAt(
        cached.loadedAt || ""
      );

      setRestoredFromSession(
        true
      );

      setHasLoaded(true);
    } catch {
      window.sessionStorage.removeItem(
        SESSION_CACHE_KEY
      );
    }
  }, []);

  useEffect(() => {
    setContactPage(1);
  }, [
    contactSearch,
    companyFilter,
    stateFilter,
    managementFilter,
    functionFilter,
    marketFilter,
    sectorFilter,
    categoryFilter,
    projectFilter,
    eligibilityFilter,
  ]);

  async function loadCampaigns() {
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    setRestoredFromSession(false);
    setCachedAt("");

    try {
      const response =
        await fetch(
          "/api/outreach-mailshake",
          {
            method: "GET",

            headers:
              await getBearerHeaders(),

            cache:
              "no-store",
          }
        );

      const rawText =
        await response.text();

      let data:
        MailshakeResponse;

      try {
        data =
          rawText
            ? JSON.parse(
                rawText
              )
            : {};
      } catch {
        throw new Error(
          `CRM Mailshake endpoint returned an unreadable response with HTTP status ${response.status}.`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not read Mailshake campaigns."
        );
      }

      const nextCampaigns =
        Array.isArray(
          data.campaigns
        )
          ? data.campaigns
          : [];

      const nextPagesRead =
        Number(
          data.pagesRead || 0
        );

      const nextPaginationComplete =
        data.paginationComplete ===
        true;

      const nextPaginationNote =
        data.paginationNote ||
        null;

      const nextSuccessMessage =
        data.message ||
        `Mailshake connection succeeded. Loaded ${nextCampaigns.length} campaigns.`;

      const loadedAt =
        new Date().toISOString();

      setCampaigns(
        nextCampaigns
      );

      setPagesRead(
        nextPagesRead
      );

      setPaginationComplete(
        nextPaginationComplete
      );

      setPaginationNote(
        nextPaginationNote
      );

      setSuccessMessage(
        nextSuccessMessage
      );

      setCachedAt(
        loadedAt
      );

      setHasLoaded(true);

      const cachedState:
        CachedOutreachState = {
          campaigns:
            nextCampaigns,

          pagesRead:
            nextPagesRead,

          paginationComplete:
            nextPaginationComplete,

          paginationNote:
            nextPaginationNote,

          successMessage:
            nextSuccessMessage,

          loadedAt,
        };

      window.sessionStorage.setItem(
        SESSION_CACHE_KEY,
        JSON.stringify(
          cachedState
        )
      );
    } catch (error) {
      setCampaigns([]);
      setPagesRead(0);
      setPaginationComplete(false);
      setPaginationNote(null);
      setHasLoaded(true);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not connect to Mailshake."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadContacts() {
    setIsLoadingContacts(true);
    setContactError("");
    setContactMessage("");

    try {
      const response =
        await fetch(
          "/api/outreach-mailshake/contacts",
          {
            method: "GET",

            headers:
              await getBearerHeaders(),

            cache:
              "no-store",
          }
        );

      const rawText =
        await response.text();

      let data:
        OutreachContactResponse;

      try {
        data =
          rawText
            ? JSON.parse(
                rawText
              )
            : {};
      } catch {
        throw new Error(
          `CRM outreach contact endpoint returned an unreadable response with HTTP status ${response.status}.`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not prepare CRM contacts for outreach."
        );
      }

      if (
        data.selectionSafe !==
        true
      ) {
        throw new Error(
          "CRM outreach selection was not marked safe and complete."
        );
      }

      const nextContacts =
        Array.isArray(
          data.contacts
        )
          ? data.contacts
          : [];

      setContacts(
        nextContacts
      );

      setContactResponse(
        data
      );

      clearSelection();

      setContactPage(1);

      setContactsLoaded(
        true
      );

      setContactMessage(
        data.message ||
          `Loaded ${nextContacts.length} active CRM contacts for outreach review.`
      );
    } catch (error) {
      setContacts([]);
      setContactResponse(null);
      clearSelection();
      setContactsLoaded(true);

      setContactError(
        error instanceof Error
          ? error.message
          : "Could not prepare CRM contacts for outreach."
      );
    } finally {
      setIsLoadingContacts(false);
    }
  }

  const filterOptions =
    contactResponse?.filterOptions;

  const filteredContacts =
    useMemo(
      () => {
        const search =
          normalizeSearch(
            contactSearch
          );

        return contacts.filter(
          (contact) => {
            if (search) {
              const searchable =
                [
                  contact.fullName,
                  contact.firstName,
                  contact.lastName,
                  contact.companyName,
                  contact.title,
                  contact.managementLevel,
                  contact.department,
                  contact.functionArea,
                  contact.state,
                  contact.email,
                  contact.phoneNumber,
                  ...contact.marketTags.map(
                    (tag) =>
                      tag.label
                  ),
                  ...contact.sectorTags.map(
                    (tag) =>
                      tag.label
                  ),
                  ...contact.categoryTags.map(
                    (tag) =>
                      tag.label
                  ),
                  ...contact.projects.map(
                    (project) =>
                      project.label
                  ),
                ]
                  .join(" ")
                  .toLowerCase();

              if (
                !searchable.includes(
                  search
                )
              ) {
                return false;
              }
            }

            if (
              companyFilter !==
                "All" &&
              contact.companyId !==
                companyFilter
            ) {
              return false;
            }

            if (
              stateFilter !==
                "All" &&
              contact.state !==
                stateFilter
            ) {
              return false;
            }

            if (
              managementFilter !==
                "All" &&
              contact.managementLevel !==
                managementFilter
            ) {
              return false;
            }

            if (
              functionFilter !==
              "All"
            ) {
              if (
                contact.functionArea !==
                  functionFilter &&
                contact.department !==
                  functionFilter
              ) {
                return false;
              }
            }

            if (
              marketFilter !==
                "All" &&
              !hasOption(
                contact.marketTags,
                marketFilter
              )
            ) {
              return false;
            }

            if (
              sectorFilter !==
                "All" &&
              !hasOption(
                contact.sectorTags,
                sectorFilter
              )
            ) {
              return false;
            }

            if (
              categoryFilter !==
                "All" &&
              !hasOption(
                contact.categoryTags,
                categoryFilter
              )
            ) {
              return false;
            }

            if (
              projectFilter !==
                "All" &&
              !contact.projects.some(
                (project) =>
                  project.id ===
                  projectFilter
              )
            ) {
              return false;
            }

            if (
              eligibilityFilter ===
                "Eligible" &&
              !contact.eligibleForMailshake
            ) {
              return false;
            }

            if (
              eligibilityFilter ===
                "Blocked" &&
              contact.eligibleForMailshake
            ) {
              return false;
            }

            return true;
          }
        );
      },
      [
        contacts,
        contactSearch,
        companyFilter,
        stateFilter,
        managementFilter,
        functionFilter,
        marketFilter,
        sectorFilter,
        categoryFilter,
        projectFilter,
        eligibilityFilter,
      ]
    );

  const eligibleFilteredContacts =
    useMemo(
      () =>
        filteredContacts.filter(
          (contact) =>
            contact.eligibleForMailshake
        ),
      [
        filteredContacts,
      ]
    );

  const blockedFilteredCount =
    filteredContacts.length -
    eligibleFilteredContacts.length;

  const selectedContactSet =
    useMemo(
      () =>
        new Set(
          selectedContactIds
        ),
      [
        selectedContactIds,
      ]
    );

  const selectedFilteredCount =
    filteredContacts.filter(
      (contact) =>
        selectedContactSet.has(
          contact.contactId
        )
    ).length;

  const selectedListFilterOption =
    useMemo(
      () =>
        (
          filterOptions?.projects ??
          []
        ).find(
          (option) =>
            option.id ===
              projectFilter &&
            option.kind ===
              "list"
        ) ??
        null,
      [
        filterOptions,
        projectFilter,
      ]
    );

  const selectedListContacts =
    useMemo(
      () =>
        selectedListFilterOption
          ? contacts.filter(
              (contact) =>
                contact.projects.some(
                  (project) =>
                    project.id ===
                      selectedListFilterOption.id &&
                    project.kind ===
                      "list"
                )
            )
          : [],
      [
        contacts,
        selectedListFilterOption,
      ]
    );

  const selectedListEligibleContacts =
    useMemo(
      () =>
        selectedListContacts.filter(
          (contact) =>
            contact.eligibleForMailshake
        ),
      [
        selectedListContacts,
      ]
    );

  const selectedListBlockedCount =
    selectedListContacts.length -
    selectedListEligibleContacts.length;

  const selectedCampaign =
    useMemo(
      () =>
        campaigns.find(
          (campaign) =>
            campaign.providerCampaignId ===
            selectedCampaignId
        ) ??
        null,
      [
        campaigns,
        selectedCampaignId,
      ]
    );

  const enrollmentFilterSnapshot =
    useMemo(
      () => ({
        search:
          contactSearch,

        companyId:
          companyFilter,

        state:
          stateFilter,

        managementLevel:
          managementFilter,

        functionOrDepartment:
          functionFilter,

        marketTagId:
          marketFilter,

        sectorTagId:
          sectorFilter,

        categoryTagId:
          categoryFilter,

        projectOrListId:
          projectFilter,

        eligibility:
          eligibilityFilter,

        selectAllFilteredUsed:
          selectionUsedSelectAll,
      }),
      [
        contactSearch,
        companyFilter,
        stateFilter,
        managementFilter,
        functionFilter,
        marketFilter,
        sectorFilter,
        categoryFilter,
        projectFilter,
        eligibilityFilter,
        selectionUsedSelectAll,
      ]
    );

  const enrollmentSelectionFingerprint =
    useMemo(
      () =>
        JSON.stringify({
          campaignId:
            selectedCampaignId,

          sourceListId:
            listBatchSourceListId ||
            null,

          selectedContactIds:
            [...selectedContactIds].sort(),

          filterSnapshot:
            enrollmentFilterSnapshot,
        }),
      [
        selectedCampaignId,
        listBatchSourceListId,
        selectedContactIds,
        enrollmentFilterSnapshot,
      ]
    );

  const pageCount =
    Math.max(
      1,
      Math.ceil(
        filteredContacts.length /
          CONTACT_PAGE_SIZE
      )
    );

  const safeContactPage =
    Math.min(
      contactPage,
      pageCount
    );

  const visibleContacts =
    filteredContacts.slice(
      (
        safeContactPage -
        1
      ) *
        CONTACT_PAGE_SIZE,

      safeContactPage *
        CONTACT_PAGE_SIZE
    );

  function toggleContact(
    contact:
      OutreachContact
  ) {
    if (
      !contact.eligibleForMailshake
    ) {
      return;
    }

    setListBatchSourceListId(
      ""
    );

    setSelectionUsedSelectAll(
      false
    );

    setSelectedContactIds(
      (previous) =>
        previous.includes(
          contact.contactId
        )
          ? previous.filter(
              (id) =>
                id !==
                contact.contactId
            )
          : [
              ...previous,
              contact.contactId,
            ]
    );
  }

  function selectAllEligibleFromList() {
    if (
      !selectedListFilterOption
    ) {
      return;
    }

    setSelectionUsedSelectAll(
      true
    );

    setListBatchSourceListId(
      selectedListFilterOption.id
    );

    setSelectedContactIds(
      selectedListEligibleContacts.map(
        (contact) =>
          contact.contactId
      )
    );
  }

  function selectAllFiltered() {
    setSelectionUsedSelectAll(
      true
    );

    setListBatchSourceListId(
      ""
    );

    setSelectedContactIds(
      (previous) =>
        Array.from(
          new Set([
            ...previous,

            ...eligibleFilteredContacts.map(
              (contact) =>
                contact.contactId
            ),
          ])
        )
    );
  }

  function clearSelection() {
    setSelectedContactIds(
      []
    );

    setListBatchSourceListId(
      ""
    );

    setSelectionUsedSelectAll(
      false
    );

    setEnrollmentReview(
      null
    );

    setEnrollmentReviewFingerprint(
      ""
    );

    setRecordedEnrollmentFingerprint(
      ""
    );

    setEnrollmentError(
      ""
    );

    setEnrollmentMessage(
      ""
    );

    setProviderExecutionReview(
      null
    );

    setProviderExecutionReviewFingerprint(
      ""
    );

    setProviderExecutionError(
      ""
    );

    setProviderExecutionMessage(
      ""
    );

    setProviderSubmissionResult(
      null
    );

    setProviderStatusResult(
      null
    );

    setProviderStatusError(
      ""
    );

    setProviderSubmissionError(
      ""
    );
  }

  function clearFilters() {
    setContactSearch("");
    setCompanyFilter("All");
    setStateFilter("All");
    setManagementFilter("All");
    setFunctionFilter("All");
    setMarketFilter("All");
    setSectorFilter("All");
    setCategoryFilter("All");
    setProjectFilter("All");
    setEligibilityFilter("All");
  }

  function selectedCampaignStatus() {
    if (
      !selectedCampaign
    ) {
      return "";
    }

    if (
      selectedCampaign.isArchived
    ) {
      return "archived";
    }

    if (
      selectedCampaign.isPaused
    ) {
      return "paused";
    }

    return "active";
  }

  async function submitEnrollmentAction(
    action:
      | "review"
      | "record"
  ) {
    if (
      !selectedCampaign
    ) {
      setEnrollmentError(
        "Choose a Mailshake campaign first."
      );

      return;
    }

    if (
      selectedContactIds.length ===
      0
    ) {
      setEnrollmentError(
        "Select at least one eligible CRM contact first."
      );

      return;
    }

    if (
      selectedCampaign.isArchived
    ) {
      setEnrollmentError(
        "Archived Mailshake campaigns cannot receive new CRM enrollment instructions."
      );

      return;
    }

    if (
      action === "review"
    ) {
      setIsReviewingEnrollment(
        true
      );
    } else {
      setIsRecordingEnrollment(
        true
      );
    }

    setEnrollmentError(
      ""
    );

    setEnrollmentMessage(
      ""
    );

    setProviderExecutionReview(
      null
    );

    setProviderExecutionReviewFingerprint(
      ""
    );

    setProviderExecutionError(
      ""
    );

    setProviderExecutionMessage(
      ""
    );

    setAuthorizationReview(
      null
    );

    setAuthorizationReviewFingerprint(
      ""
    );

    setAuthorizationReviewError(
      ""
    );

    try {
      const response =
        await fetch(
          "/api/outreach-mailshake/enrollment-requests",
          {
            method:
              "POST",

            headers: {
              ...(await getBearerHeaders()),

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action,

                providerCampaignId:
                  selectedCampaign.providerCampaignId,

                campaignName:
                  selectedCampaign.title,

                campaignStatus:
                  selectedCampaignStatus(),

                selectionMode:
                  selectionUsedSelectAll
                    ? "select_all_filtered"
                    : "individual",

                sourceListId:
                  listBatchSourceListId ||
                  undefined,

                filterSnapshot:
                  enrollmentFilterSnapshot,

                contactIds:
                  selectedContactIds,
              }),

            cache:
              "no-store",
          }
        );

      const rawText =
        await response.text();

      let data:
        EnrollmentRequestResponse;

      try {
        data =
          rawText
            ? JSON.parse(
                rawText
              )
            : {};
      } catch {
        throw new Error(
          `CRM enrollment endpoint returned an unreadable response with HTTP status ${response.status}.`
        );
      }

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Could not review or record the CRM outreach enrollment."
        );
      }

      setEnrollmentReview(
        data
      );

      setEnrollmentReviewFingerprint(
        enrollmentSelectionFingerprint
      );

      if (
        action === "review"
      ) {
        setRecordedEnrollmentFingerprint(
          ""
        );
      } else if (
        data.status ===
          "recorded_in_crm"
      ) {
        setRecordedEnrollmentFingerprint(
          enrollmentSelectionFingerprint
        );
      }

      setEnrollmentMessage(
        data.message ||
          (
            action === "review"
              ? "CRM enrollment review completed."
              : "CRM enrollment instruction recorded."
          )
      );
    } catch (error) {
      setEnrollmentReview(
        null
      );

      setEnrollmentReviewFingerprint(
        ""
      );

      setEnrollmentError(
        error instanceof Error
          ? error.message
          : "Could not review or record the CRM outreach enrollment."
      );
    } finally {
      if (
        action === "review"
      ) {
        setIsReviewingEnrollment(
          false
        );
      } else {
        setIsRecordingEnrollment(
          false
        );
      }
    }
  }

  async function reviewEnrollment() {
    await submitEnrollmentAction(
      "review"
    );
  }

  async function recordEnrollmentInCrm() {
    if (
      enrollmentReviewFingerprint !==
      enrollmentSelectionFingerprint
    ) {
      setEnrollmentError(
        "The campaign, contact selection, or filters changed after the last server review. Review the selection again before recording it."
      );

      return;
    }

    const newCount =
      Number(
        enrollmentReview?.newEnrollmentCount ??
        0
      );

    if (
      newCount <= 0
    ) {
      setEnrollmentError(
        "The server review found no new CRM enrollment records to create."
      );

      return;
    }

    const campaignName =
      selectedCampaign?.title ||
      "the selected campaign";

    const confirmed =
      window.confirm(
        `Record ${newCount} CRM outreach enrollment${newCount === 1 ? "" : "s"} for "${campaignName}"? This records the instruction in CRM only. Nothing will be submitted to Mailshake and no email will be sent.`
      );

    if (!confirmed) {
      return;
    }

    await submitEnrollmentAction(
      "record"
    );
  }

  async function reviewProviderExecution() {
    if (
      !selectedCampaign
    ) {
      setProviderExecutionError(
        "Choose a Mailshake campaign first."
      );

      return;
    }

    if (
      selectedContactIds.length ===
      0
    ) {
      setProviderExecutionError(
        "Select at least one CRM contact first."
      );

      return;
    }

    if (
      enrollmentReviewFingerprint !==
      enrollmentSelectionFingerprint
    ) {
      setProviderExecutionError(
        "The campaign, contact selection, or filters changed after the last CRM server review. Review the CRM selection again first."
      );

      return;
    }

    setIsReviewingProviderExecution(
      true
    );

    setProviderExecutionError(
      ""
    );

    setProviderExecutionMessage(
      ""
    );

    setProviderExecutionReview(
      null
    );

    setProviderSubmissionResult(
      null
    );

    setProviderStatusResult(
      null
    );

    setProviderStatusError(
      ""
    );

    setProviderSubmissionError(
      ""
    );

    setProviderBatchSubmissionResults(
      []
    );

    setProviderBatchPlannedCount(
      0
    );

    setProviderBatchMessage(
      ""
    );
    try {
      const response =
        await fetch(
          "/api/outreach-mailshake/enrollment-requests",
          {
            method:
              "POST",

            headers: {
              ...(await getBearerHeaders()),

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "provider_review",

                providerCampaignId:
                  selectedCampaign.providerCampaignId,

                campaignName:
                  selectedCampaign.title,

                campaignStatus:
                  selectedCampaignStatus(),

                selectionMode:
                  selectionUsedSelectAll
                    ? "select_all_filtered"
                    : "individual",

                sourceListId:
                  listBatchSourceListId ||
                  undefined,

                filterSnapshot:
                  enrollmentFilterSnapshot,

                contactIds:
                  selectedContactIds,
              }),

            cache:
              "no-store",
          }
        );

      const rawText =
        await response.text();

      let data:
        EnrollmentRequestResponse;

      try {
        data =
          rawText
            ? JSON.parse(
                rawText
              )
            : {};
      } catch {
        throw new Error(
          `CRM provider review endpoint returned an unreadable response with HTTP status ${response.status}.`
        );
      }

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Could not review the recorded CRM enrollment for Mailshake execution."
        );
      }

      setProviderExecutionReview(
        data
      );

      setProviderExecutionReviewFingerprint(
        enrollmentSelectionFingerprint
      );

      setProviderExecutionMessage(
        data.message ||
          "Provider execution review completed."
      );
    } catch (error) {
      setProviderExecutionReview(
        null
      );

      setProviderExecutionReviewFingerprint(
        ""
      );

      setProviderExecutionError(
        error instanceof Error
          ? error.message
          : "Could not review the recorded CRM enrollment for Mailshake execution."
      );
    } finally {
      setIsReviewingProviderExecution(
        false
      );
    }
  }

  async function reviewProductionAuthorization() {
    setAuthorizationLifecycle(
      null
    );

    setAuthorizationCreateConfirmation(
      ""
    );

    setAuthorizationCancelConfirmation(
      ""
    );

    setAuthorizationCancellationReason(
      ""
    );

    setAuthorizationLifecycleError(
      ""
    );
    if (
      !selectedCampaign ||
      !providerExecutionReview?.providerReview
    ) {
      setAuthorizationReviewError(
        "Run Step 3 — Check Recorded Enrollment & Mailshake Readiness first."
      );

      return;
    }

    if (
      providerExecutionReviewFingerprint !==
      enrollmentSelectionFingerprint
    ) {
      setAuthorizationReviewError(
        "The campaign, contact selection, or filters changed after Step 3. Run Step 3 again before reviewing a Production authorization."
      );

      return;
    }

    setIsReviewingAuthorization(
      true
    );

    setAuthorizationReviewError(
      ""
    );

    setAuthorizationReview(
      null
    );

    setAuthorizationReviewFingerprint(
      ""
    );

    try {
      const response =
        await fetch(
          "/api/outreach-mailshake/run-authorization",
          {
            method:
              "POST",

            headers: {
              ...(await getBearerHeaders()),

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "review",

                providerCampaignId:
                  selectedCampaign.providerCampaignId,

                campaignName:
                  selectedCampaign.title,

                campaignStatus:
                  selectedCampaignStatus(),

                selectionMode:
                  selectionUsedSelectAll
                    ? "select_all_filtered"
                    : "individual",

                sourceListId:
                  listBatchSourceListId ||
                  undefined,

                filterSnapshot:
                  enrollmentFilterSnapshot,

                contactIds:
                  selectedContactIds,
              }),

            cache:
              "no-store",
          }
        );

      const rawText =
        await response.text();

      let data:
        ProductionAuthorizationReviewResponse;

      try {
        data =
          rawText
            ? JSON.parse(
                rawText
              )
            : {};
      } catch {
        throw new Error(
          `CRM Production authorization review returned an unreadable response with HTTP status ${response.status}.`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not complete the read-only Production authorization review."
        );
      }

      setAuthorizationReview(
        data
      );

      setAuthorizationReviewFingerprint(
        enrollmentSelectionFingerprint
      );
    } catch (error) {
      setAuthorizationReview(
        null
      );

      setAuthorizationReviewFingerprint(
        ""
      );

      setAuthorizationReviewError(
        error instanceof Error
          ? error.message
          : "Could not complete the read-only Production authorization review."
      );
    } finally {
      setIsReviewingAuthorization(
        false
      );
    }
  }
  async function createProductionAuthorization() {
    const requiredPhrase =
      authorizationReview?.createConfirmationPhrase?.trim() ||
      "";

    if (
      !requiredPhrase ||
      !authorizationReview?.safetyChecksPassedForProposedSet
    ) {
      setAuthorizationLifecycleError(
        "The current review is not eligible to create a controlled run authorization."
      );

      return;
    }

    if (
      authorizationReviewFingerprint !==
      enrollmentSelectionFingerprint
    ) {
      setAuthorizationLifecycleError(
        "The authorization review is stale. Run Step 3 and the read-only authorization review again."
      );

      return;
    }

    if (
      authorizationCreateConfirmation.trim() !==
      requiredPhrase
    ) {
      setAuthorizationLifecycleError(
        `Type the confirmation exactly as shown: ${requiredPhrase}`
      );

      return;
    }

    if (!selectedCampaign) {
      setAuthorizationLifecycleError(
        "No Mailshake campaign is selected."
      );

      return;
    }

    setIsCreatingAuthorization(true);
    setAuthorizationLifecycleError("");

    try {
      const response =
        await fetch(
          "/api/outreach-mailshake/run-authorization",
          {
            method: "POST",

            headers: {
              ...(await getBearerHeaders()),
              "Content-Type": "application/json",
            },

            body:
              JSON.stringify({
                action: "create",

                providerCampaignId:
                  selectedCampaign.providerCampaignId,

                campaignName:
                  selectedCampaign.title,

                campaignStatus:
                  selectedCampaignStatus(),

                selectionMode:
                  selectionUsedSelectAll
                    ? "select_all_filtered"
                    : "individual",

                sourceListId:
                  listBatchSourceListId ||
                  undefined,

                filterSnapshot:
                  enrollmentFilterSnapshot,

                contactIds:
                  selectedContactIds,

                confirmationPhrase:
                  authorizationCreateConfirmation.trim(),
              }),

            cache: "no-store",
          }
        );

      const rawText =
        await response.text();

      let data:
        ProductionAuthorizationLifecycleResponse;

      try {
        data =
          rawText
            ? JSON.parse(rawText)
            : {};
      } catch {
        throw new Error(
          `CRM authorization creation returned an unreadable response with HTTP status ${response.status}.`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "The controlled run authorization could not be created."
        );
      }

      if (data.authorizationCreated !== true) {
        throw new Error(
          "The server did not confirm authorization creation."
        );
      }

      setAuthorizationLifecycle(data);

      setAuthorizationCreateConfirmation("");
      setAuthorizationCancelConfirmation("");
      setAuthorizationCancellationReason("");
    } catch (error) {
      setAuthorizationLifecycleError(
        error instanceof Error
          ? error.message
          : "The controlled run authorization could not be created."
      );
    } finally {
      setIsCreatingAuthorization(false);
    }
  }

  async function cancelProductionAuthorization() {
    const authorizationId =
      authorizationLifecycle?.authorization?.id?.trim() ||
      "";

    const requiredPhrase =
      authorizationLifecycle?.cancelConfirmationPhrase?.trim() ||
      "";

    const reason =
      authorizationCancellationReason.trim();

    if (
      !authorizationId ||
      !requiredPhrase
    ) {
      setAuthorizationLifecycleError(
        "There is no cancellable run authorization loaded."
      );

      return;
    }

    if (reason.length < 8) {
      setAuthorizationLifecycleError(
        "Enter a cancellation reason of at least 8 characters."
      );

      return;
    }

    if (
      authorizationCancelConfirmation.trim() !==
      requiredPhrase
    ) {
      setAuthorizationLifecycleError(
        `Type the cancellation confirmation exactly as shown: ${requiredPhrase}`
      );

      return;
    }

    setIsCancellingAuthorization(true);
    setAuthorizationLifecycleError("");

    try {
      const response =
        await fetch(
          "/api/outreach-mailshake/run-authorization",
          {
            method: "POST",

            headers: {
              ...(await getBearerHeaders()),
              "Content-Type": "application/json",
            },

            body:
              JSON.stringify({
                action: "cancel",
                authorizationId,
                cancellationReason: reason,

                confirmationPhrase:
                  authorizationCancelConfirmation.trim(),
              }),

            cache: "no-store",
          }
        );

      const rawText =
        await response.text();

      let data:
        ProductionAuthorizationLifecycleResponse;

      try {
        data =
          rawText
            ? JSON.parse(rawText)
            : {};
      } catch {
        throw new Error(
          `CRM authorization cancellation returned an unreadable response with HTTP status ${response.status}.`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "The run authorization could not be cancelled."
        );
      }

      if (data.authorizationCancelled !== true) {
        throw new Error(
          "The server did not confirm cancellation."
        );
      }

      setAuthorizationLifecycle(data);

      setAuthorizationReview(null);
      setAuthorizationReviewFingerprint("");

      setAuthorizationCreateConfirmation("");
      setAuthorizationCancelConfirmation("");
      setAuthorizationCancellationReason("");
    } catch (error) {
      setAuthorizationLifecycleError(
        error instanceof Error
          ? error.message
          : "The run authorization could not be cancelled."
      );
    } finally {
      setIsCancellingAuthorization(false);
    }
  }
  async function submitRecordedEnrollmentToMailshake() {
    const providerReview =
      providerExecutionReview?.providerReview;

    if (
      !selectedCampaign ||
      !providerReview
    ) {
      setProviderSubmissionError(
        "Run the Provider Execution Review first."
      );

      return;
    }

    if (
      providerExecutionReviewFingerprint !==
      enrollmentSelectionFingerprint
    ) {
      setProviderSubmissionError(
        "The campaign, contact selection, or filters changed after the provider review. Review again before submission."
      );

      return;
    }

    if (
      providerReview.providerExecutionAllowed !==
        true ||
      providerReview.providerCampaignState !==
        "paused"
    ) {
      setProviderSubmissionError(
        "The latest provider review does not permit Mailshake submission."
      );

      return;
    }

    if (
      providerReview.providerWritePolicyAllowed !==
      true
    ) {
      setProviderSubmissionError(
        providerReview.providerWritePolicyReason ||
          "Mailshake provider writes are disabled by the current server safety policy."
      );

      return;
    }

    const readyContactIds =
      Array.from(
        new Set(
          (
            providerReview.readyContactIds ??
            []
          )
            .map(
              (contactId) =>
                String(
                  contactId ||
                    ""
                ).trim()
            )
            .filter(Boolean)
        )
      );

    const readyToSubmitCount =
      Number(
        providerReview.readyToSubmitCount ??
          0
      );

    if (
      readyContactIds.length ===
        0 ||
      readyContactIds.length !==
        readyToSubmitCount
    ) {
      setProviderSubmissionError(
        "The server-verified ready contact set does not match the reviewed ready count. Run Step 3 again before any provider action."
      );

      return;
    }

    const runContactIds =
      readyContactIds.slice(
        0,
        MAX_CONTROLLED_PROVIDER_RUN_SIZE
      );

    const campaignName =
      providerReview.providerCampaignTitle ||
      selectedCampaign.title ||
      "the selected campaign";

    const confirmed =
      window.confirm(
        `SUBMIT A CONTROLLED MAILSHAKE BATCH?\n\nCampaign: ${campaignName}\n\nServer-verified ready recipients: ${readyContactIds.length}\nRecipients in this controlled run: ${runContactIds.length}\n\nThis is a REAL Mailshake provider action. Recipients are processed ONE AT A TIME. Each recipient gets a separate CRM provider-operation record and the server re-checks eligibility, existing Mailshake membership, and PAUSED campaign status for every recipient.\n\nThe controller STOPS on the first blocked, failed, unreadable, or uncertain result. It never automatically retries an uncertain recipient.\n\nA campaign may contain 100+ recipients. The ${MAX_CONTROLLED_PROVIDER_RUN_SIZE}-recipient run size is only a controlled processing increment, not a campaign limit.\n\nKEEP THE CAMPAIGN PAUSED until asynchronous results are reconciled.\n\nContinue?`
      );

    if (!confirmed) {
      return;
    }

    setIsSubmittingProvider(
      true
    );

    setProviderSubmissionError(
      ""
    );

    setProviderSubmissionResult(
      null
    );

    setProviderBatchSubmissionResults(
      []
    );

    setProviderBatchPlannedCount(
      runContactIds.length
    );

    setProviderBatchMessage(
      ""
    );

    setProviderStatusResult(
      null
    );

    setProviderStatusError(
      ""
    );

    const batchResults:
      ProviderBatchSubmissionItem[] = [];

    let submittedCount =
      0;

    let stopped =
      false;

    try {
      const bearerHeaders =
        await getBearerHeaders();

      /*
       * The Step 3 review becomes stale as soon as this controlled
       * run begins. The run itself uses the immutable server-reviewed
       * contact ID snapshot captured above.
       */
      setProviderExecutionReviewFingerprint(
        ""
      );

      for (
        let index = 0;
        index < runContactIds.length;
        index += 1
      ) {
        const contactId =
          runContactIds[index];

        let response:
          Response;

        try {
          response =
            await fetch(
              "/api/outreach-mailshake/provider-execution",
              {
                method:
                  "POST",

                headers: {
                  ...bearerHeaders,

                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    providerCampaignId:
                      selectedCampaign.providerCampaignId,

                    contactId,

                    confirmationPhrase:
                      "SUBMIT_ONE_TO_PAUSED_MAILSHAKE",
                  }),

                cache:
                  "no-store",
              }
            );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "The browser did not receive a response from the CRM provider endpoint.";

          batchResults.push({
            sequence:
              index + 1,

            contactId,

            status:
              "client_transport_unknown",

            error:
              message,
          });

          setProviderBatchSubmissionResults(
            [...batchResults]
          );

          setProviderSubmissionError(
            `Controlled batch stopped on recipient ${index + 1}. The browser did not receive a definitive CRM response. Do not retry this recipient automatically. Run a fresh Step 3 review and inspect Existing Operations before deciding what to do next. ${message}`
          );

          stopped =
            true;

          break;
        }

        const rawText =
          await response.text();

        let data:
          ProviderSubmissionResponse;

        try {
          data =
            rawText
              ? JSON.parse(
                  rawText
                )
              : {};
        } catch {
          batchResults.push({
            sequence:
              index + 1,

            contactId,

            status:
              "client_response_unreadable",

            httpStatus:
              response.status,

            error:
              `CRM returned an unreadable response with HTTP status ${response.status}.`,
          });

          setProviderBatchSubmissionResults(
            [...batchResults]
          );

          setProviderSubmissionError(
            `Controlled batch stopped on recipient ${index + 1} because the CRM response could not be read. Do not retry this recipient automatically. Run Step 3 again and inspect Existing Operations first.`
          );

          stopped =
            true;

          break;
        }

        const item:
          ProviderBatchSubmissionItem = {
            sequence:
              index + 1,

            contactId,

            status:
              String(
                data.status ||
                  (response.ok
                    ? "unknown"
                    : "blocked")
              ),

            httpStatus:
              response.status,

            operationId:
              data.operationId,

            providerCheckStatusId:
              data.providerCheckStatusId,

            message:
              data.message,

            error:
              data.error,
          };

        batchResults.push(
          item
        );

        setProviderBatchSubmissionResults(
          [...batchResults]
        );

        if (
          data.operationId
        ) {
          setProviderSubmissionResult(
            data
          );
        }

        if (
          !response.ok
        ) {
          setProviderSubmissionError(
            `Controlled batch stopped on recipient ${index + 1}. ${data.error || "The CRM provider endpoint blocked this recipient."} Run a fresh Step 3 review before taking another provider action.`
          );

          stopped =
            true;

          break;
        }

        if (
          data.status !==
          "submitted"
        ) {
          setProviderSubmissionError(
            `Controlled batch stopped on recipient ${index + 1} because its provider status is "${data.status || "unknown"}". Do not automatically retry this recipient. Reconcile the exact provider operation first.`
          );

          stopped =
            true;

          break;
        }

        submittedCount +=
          1;
      }

      if (
        !stopped &&
        submittedCount ===
          runContactIds.length
      ) {
        const remainingAfterRun =
          Math.max(
            0,
            readyContactIds.length -
              submittedCount
          );

        setProviderBatchMessage(
          remainingAfterRun > 0
            ? `${submittedCount} recipient${submittedCount === 1 ? "" : "s"} in this controlled run were accepted asynchronously by Mailshake. ${remainingAfterRun} recipient${remainingAfterRun === 1 ? "" : "s"} were in the prior server-ready set but were not attempted in this run. Run Step 3 again before continuing.`
            : `${submittedCount} recipient${submittedCount === 1 ? "" : "s"} in this controlled run were accepted asynchronously by Mailshake. Run Step 3 again to verify the CRM batch state before any further provider action.`
        );
      } else if (
        stopped &&
        submittedCount >
          0
      ) {
        setProviderBatchMessage(
          `${submittedCount} recipient${submittedCount === 1 ? "" : "s"} were accepted before the controlled run stopped. The remaining recipients were not automatically attempted after the stop condition.`
        );
      }
    } catch (error) {
      setProviderExecutionReviewFingerprint(
        ""
      );

      setProviderSubmissionError(
        error instanceof Error
          ? `Controlled batch stopped. ${error.message}`
          : "Controlled batch stopped before completion. Run Step 3 again before another provider action."
      );
    } finally {
      setIsSubmittingProvider(
        false
      );
    }
  }

  async function checkMailshakeImportStatus(
    providerOperationId: string
  ) {
    const normalizedProviderOperationId =
      String(
        providerOperationId ||
        ""
      ).trim();

    if (
      !normalizedProviderOperationId
    ) {
      setProviderStatusError(
        "Choose an exact CRM provider operation to reconcile."
      );

      return;
    }

    setProviderStatusTargetOperationId(
      normalizedProviderOperationId
    );

    setIsCheckingProviderStatus(
      true
    );

    setProviderStatusError(
      ""
    );

    setProviderStatusResult(
      null
    );

    try {
      const response =
        await fetch(
          "/api/outreach-mailshake/provider-status",
          {
            method:
              "POST",

            headers: {
              ...(await getBearerHeaders()),

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                providerOperationId:
                  normalizedProviderOperationId,
              }),

            cache:
              "no-store",
          }
        );

      const rawText =
        await response.text();

      let data:
        ProviderStatusResponse;

      try {
        data =
          rawText
            ? JSON.parse(
                rawText
              )
            : {};
      } catch {
        throw new Error(
          `CRM provider-status endpoint returned an unreadable response with HTTP status ${response.status}.`
        );
      }

      /*
       * Some final reconciliation outcomes intentionally use
       * HTTP 409 because they require attention rather than
       * representing a successful import. If the endpoint
       * returned a structured provider status, show it instead
       * of discarding the useful reconciliation result.
       */
      if (
        !response.ok &&
        !data.status &&
        !data.operationStatus
      ) {
        throw new Error(
          data.error ||
            data.message ||
            "Could not reconcile the Mailshake recipient import."
        );
      }

      setProviderStatusResult(
        data
      );

      /*
       * Any provider-status check can change CRM operation
       * state. A previous provider execution review must no
       * longer be relied upon for a submission action.
       */
      setProviderExecutionReview(
        null
      );

      setProviderExecutionReviewFingerprint(
        ""
      );

      setProviderExecutionMessage(
        ""
      );

      setProviderSubmissionError(
        ""
      );
    } catch (error) {
      setProviderStatusError(
        error instanceof Error
          ? error.message
          : "Could not reconcile the Mailshake recipient import."
      );
    } finally {
      setIsCheckingProviderStatus(
        false
      );
    }
  }

  async function loadProviderHistory() {
    if (
      isLoadingProviderHistory
    ) {
      return;
    }

    setIsLoadingProviderHistory(
      true
    );

    setProviderHistoryError(
      ""
    );

    setProviderHistoryMessage(
      ""
    );

    try {
      const response =
        await fetch(
          "/api/outreach-mailshake/provider-history?limit=25",
          {
            method:
              "GET",

            headers: {
              ...(await getBearerHeaders()),
            },

            cache:
              "no-store",
          }
        );

      const rawText =
        await response.text();

      let data:
        ProviderHistoryResponse;

      try {
        data =
          rawText
            ? JSON.parse(
                rawText
              )
            : {};
      } catch {
        throw new Error(
          `CRM provider-history endpoint returned an unreadable response with HTTP status ${response.status}.`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not load CRM provider operation history."
        );
      }

      setProviderHistory(
        Array.isArray(
          data.operations
        )
          ? data.operations
          : []
      );

      setProviderHistoryMessage(
        data.message ||
          "CRM provider operation history loaded."
      );

      setHasLoadedProviderHistory(
        true
      );
    } catch (error) {
      setProviderHistoryError(
        error instanceof Error
          ? error.message
          : "Could not load CRM provider operation history."
      );
    } finally {
      setIsLoadingProviderHistory(
        false
      );
    }
  }

  if (!canAccess) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
        <h2 className="text-xl font-bold">
          Outreach
        </h2>

        <p className="mt-2 text-sm">
          Outreach is restricted to CRM Admin and Sales Manager users.
        </p>
      </section>
    );
  }

  return (
    <section className="grid max-w-full gap-6 overflow-hidden">
      <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">
              Version 3.27H3B2B2 - Create / Cancel Production Authorization
            </p>

            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              Mailshake Outreach
            </h2>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              CRM remains the source of truth. Mailshake executes email campaigns and reports machine-generated outreach events back to CRM.
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <p className="font-bold">
              Controlled Mailshake submission testing
            </p>

            <p className="mt-1 text-xs leading-5">
              Provider submission remains limited to exactly one recorded enrollment, a paused Mailshake campaign, and an explicit server-side recipient allowlist, and is enabled only on Vercel Preview deployments. Provider-status reconciliation remains available in Preview and Production for existing CRM-tracked provider operations and now requires an explicit CRM provider operation ID.
            </p>

            <details className="mt-4 rounded-xl border border-blue-200 bg-white/80 p-4">
              <summary className="cursor-pointer font-black text-blue-950">
                How Outreach Works — workflow, safety, and terminology
              </summary>

              <div className="mt-4 space-y-5 text-xs leading-5 text-slate-700">
                <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="font-black text-slate-950">
                    New Outreach Workflow
                  </p>

                  <ol className="mt-3 space-y-3">
                    <li><span className="font-black text-slate-900">0. Choose campaign and recipients.</span>{" "}Selecting contacts does not create a CRM enrollment and does not change Mailshake.</li>
                    <li><span className="font-black text-blue-800">1. Review Selection on Server — CHECK ONLY.</span>{" "}Re-validates the current selection against CRM data. Nothing is submitted to Mailshake.</li>
                    <li><span className="font-black text-violet-800">2. Record Enrollment in CRM — CRM WRITE.</span>{" "}Creates CRM enrollment and batch tracking records. It does not add a recipient to Mailshake and does not send email.</li>
                    <li><span className="font-black text-rose-800">3. Check Recorded Enrollment and Mailshake Readiness — CHECK ONLY.</span>{" "}Re-checks CRM eligibility and reads the current Mailshake campaign state immediately before any provider action.</li>
                    <li><span className="font-black text-red-800">4. Submit to Mailshake — MAILSHAKE WRITE.</span>{" "}This is the first step that can actually add a recipient to Mailshake. Current rollout permits one server-approved recipient on Vercel Preview only, and the campaign must remain paused.</li>
                    <li><span className="font-black text-sky-800">5. Reconcile the Mailshake Result — STATUS / CRM SYNC.</span>{" "}Checks the exact existing CRM-tracked provider operation and records the provider result. Reconcile never means submit again.</li>
                    <li><span className="font-black text-emerald-800">6. Understand the Final CRM Outcome.</span>{" "}Review the final enrollment, provider-operation, and batch statuses before considering the outreach action complete.</li>
                  </ol>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                    <p className="font-black text-slate-950">What the terms mean</p>
                    <dl className="mt-3 space-y-3">
                      <div><dt className="font-bold text-slate-900">CRM Enrollment</dt><dd>CRM record saying that a contact is intended for an outreach campaign.</dd></div>
                      <div><dt className="font-bold text-slate-900">Batch</dt><dd>CRM record grouping one or more enrollment instructions.</dd></div>
                      <div><dt className="font-bold text-slate-900">Provider Operation</dt><dd>CRM audit record for one specific attempted Mailshake provider action.</dd></div>
                      <div><dt className="font-bold text-slate-900">Mailshake checkStatusID</dt><dd>Mailshake identifier used to check its asynchronous recipient import.</dd></div>
                      <div><dt className="font-bold text-slate-900">Reconcile</dt><dd>Check an existing provider operation and synchronize the result into CRM. It does not create another Mailshake submission.</dd></div>
                    </dl>
                  </div>

                  <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                    <p className="font-black text-slate-950">Final outcome guide</p>
                    <dl className="mt-3 space-y-3">
                      <div><dt className="font-bold text-emerald-800">Confirmed / Enrolled</dt><dd>Mailshake confirms the recipient exists in the intended campaign.</dd></div>
                      <div><dt className="font-bold text-emerald-800">Already in campaign</dt><dd>No new add was required. CRM treats this as successful / no action needed.</dd></div>
                      <div><dt className="font-bold text-amber-800">Unsubscribed</dt><dd>Mailshake did not enroll the recipient because the address is unsubscribed.</dd></div>
                      <div><dt className="font-bold text-red-800">Failed</dt><dd>The requested provider action could not be completed.</dd></div>
                      <div><dt className="font-bold text-amber-800">Submitted / Processing</dt><dd>The provider operation is not final yet. Reconcile the same operation again later; do not resubmit.</dd></div>
                      <div><dt className="font-bold text-amber-800">Reconciliation required</dt><dd>CRM cannot safely classify the provider result automatically. Stop and investigate; do not retry the original submission.</dd></div>
                    </dl>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              void loadCampaigns()
            }
            disabled={isLoading}
            className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isLoading
              ? "Checking Mailshake..."
              : hasLoaded
                ? "Refresh Mailshake Campaigns"
                : "Check Mailshake Connection / Load Campaigns"}
          </button>

          {hasLoaded &&
            !errorMessage && (
              <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
                Connected
              </span>
            )}
        </div>

        {restoredFromSession &&
          cachedAt && (
            <p className="mt-3 text-xs text-slate-500">
              Campaign cards restored from this browser session. Last refreshed at{" "}
              {formatLoadedTime(
                cachedAt
              )}.
            </p>
          )}

        {errorMessage && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            {successMessage}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              CRM Audit Trail
            </p>

            <h3 className="mt-1 text-xl font-bold text-slate-950">
              Existing Operations / Reconciliation
            </h3>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Use this area for Mailshake operations that CRM already tracks. Loading history is read-only. Reconcile This Operation checks the exact existing provider operation and synchronizes its result into CRM; it never submits or re-adds a recipient, changes campaign state, or sends email.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadProviderHistory()
            }
            disabled={
              isLoadingProviderHistory
            }
            className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-bold text-white hover:bg-slate-900 disabled:cursor-wait disabled:bg-slate-400"
          >
            {isLoadingProviderHistory
              ? "Loading Provider History..."
              : hasLoadedProviderHistory
                ? "Refresh Provider History"
                : "Load Provider History"}
          </button>
        </div>

        {providerHistoryError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
            {providerHistoryError}
          </div>
        )}

        {providerHistoryMessage &&
          !providerHistoryError && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs font-semibold text-blue-900">
            {providerHistoryMessage}
          </div>
        )}

        {hasLoadedProviderHistory &&
          providerHistory.length ===
            0 && (
            <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
              No Mailshake provider operations are recorded in CRM yet.
            </div>
          )}

        {providerHistory.length >
          0 && (
          <div className="mt-5 grid gap-4">
            {providerHistory.map(
              (
                operation,
                operationIndex
              ) => {
                const recipients =
                  operation.recipients ??
                  [];

                return (
                  <article
                    key={
                      operation.id ||
                      `provider-operation-${operationIndex}`
                    }
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          {operation.campaignName ||
                            "Mailshake Campaign"}
                        </p>

                        <h4 className="mt-1 text-lg font-bold text-slate-950">
                          Campaign ID{" "}
                          {operation.providerCampaignId ||
                            "—"}
                        </h4>

                        <p className="mt-1 break-all text-xs text-slate-500">
                          CRM provider operation:{" "}
                          {operation.id ||
                            "—"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-black ring-1 ${providerHistoryStatusClasses(
                            operation.status
                          )}`}
                        >
                          {operation.status ||
                            "unknown"}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            void checkMailshakeImportStatus(
                              operation.id ||
                                ""
                            )
                          }
                          disabled={
                            isCheckingProviderStatus ||
                            !operation.id
                          }
                          className="rounded-xl bg-sky-700 px-4 py-2 text-xs font-black text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {isCheckingProviderStatus &&
                          providerStatusTargetOperationId ===
                            operation.id
                            ? "Checking..."
                            : "Reconcile This Operation"}
                        </button>
                      </div>
                    </div>

                    {providerStatusTargetOperationId ===
                      operation.id &&
                      providerStatusError && (
                        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-5 text-red-950">
                          <p className="font-black">
                            Reconciliation did not complete
                          </p>

                          <p className="mt-2">
                            {providerStatusError}
                          </p>

                          <p className="mt-2 break-all font-semibold">
                            CRM provider operation:{" "}
                            {operation.id}
                          </p>
                        </div>
                      )}

                    {providerStatusTargetOperationId ===
                      operation.id &&
                      providerStatusResult && (
                        <div
                          className={`mt-4 rounded-xl border p-4 text-xs leading-5 ${
                            providerStatusResult.status ===
                              "confirmed" ||
                            providerStatusResult.status ===
                              "already_present" ||
                            providerStatusResult.enrollmentStatus ===
                              "confirmed" ||
                            providerStatusResult.enrollmentStatus ===
                              "already_present"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                              : providerStatusResult.status ===
                                    "processing" ||
                                  providerStatusResult.status ===
                                    "submitted" ||
                                  providerStatusResult.operationStatus ===
                                    "checking" ||
                                  providerStatusResult.operationStatus ===
                                    "submitted"
                                ? "border-blue-200 bg-blue-50 text-blue-950"
                                : providerStatusResult.status ===
                                      "failed" ||
                                    providerStatusResult.status ===
                                      "reconciliation_required" ||
                                    providerStatusResult.operationStatus ===
                                      "submission_unknown" ||
                                    providerStatusResult.enrollmentStatus ===
                                      "failed"
                                  ? "border-red-200 bg-red-50 text-red-950"
                                  : "border-amber-200 bg-amber-50 text-amber-950"
                          }`}
                        >
                          <p className="font-black">
                            {providerStatusResult.status ===
                              "confirmed" ||
                            providerStatusResult.enrollmentStatus ===
                              "confirmed"
                              ? "Confirmed / Enrolled — final successful outcome"
                              : providerStatusResult.status ===
                                    "already_present" ||
                                  providerStatusResult.enrollmentStatus ===
                                    "already_present"
                                ? "Already in campaign — final successful outcome"
                                : providerStatusResult.status ===
                                      "unsubscribed" ||
                                    providerStatusResult.enrollmentStatus ===
                                      "unsubscribed"
                                  ? "Unsubscribed — final no-enrollment outcome"
                                  : providerStatusResult.status ===
                                        "processing" ||
                                      providerStatusResult.status ===
                                        "submitted" ||
                                      providerStatusResult.operationStatus ===
                                        "checking" ||
                                      providerStatusResult.operationStatus ===
                                        "submitted"
                                    ? "Submitted / Processing — not final"
                                    : providerStatusResult.status ===
                                          "reconciliation_required" ||
                                        providerStatusResult.operationStatus ===
                                          "submission_unknown"
                                      ? "Reconciliation required — stop and investigate"
                                      : providerStatusResult.status ===
                                            "failed" ||
                                          providerStatusResult.enrollmentStatus ===
                                            "failed"
                                        ? "Failed — final provider failure"
                                        : "Reconciliation result for this operation"}
                          </p>

                          <p className="mt-2">
                            {providerStatusResult.message ||
                              "CRM checked this provider operation."}
                          </p>

                          {(providerStatusResult.status ===
                            "processing" ||
                            providerStatusResult.status ===
                              "submitted" ||
                            providerStatusResult.operationStatus ===
                              "checking" ||
                            providerStatusResult.operationStatus ===
                              "submitted") && (
                            <p className="mt-3 rounded-lg bg-white/70 p-3 font-black">
                              NOT FINAL — reconcile this same operation again later. DO NOT RESUBMIT.
                            </p>
                          )}

                          {(providerStatusResult.status ===
                            "reconciliation_required" ||
                            providerStatusResult.operationStatus ===
                              "submission_unknown") && (
                            <p className="mt-3 rounded-lg bg-white/70 p-3 font-black">
                              INVESTIGATION REQUIRED — CRM cannot safely prove the provider outcome. DO NOT automatically retry the original submission.
                            </p>
                          )}

                          {(providerStatusResult.status ===
                            "confirmed" ||
                            providerStatusResult.status ===
                              "already_present" ||
                            providerStatusResult.enrollmentStatus ===
                              "confirmed" ||
                            providerStatusResult.enrollmentStatus ===
                              "already_present") && (
                            <p className="mt-3 rounded-lg bg-white/70 p-3 font-black">
                              FINAL — no additional Mailshake submission is needed for this enrollment.
                            </p>
                          )}

                          {(providerStatusResult.status ===
                            "unsubscribed" ||
                            providerStatusResult.enrollmentStatus ===
                              "unsubscribed") && (
                            <p className="mt-3 rounded-lg bg-white/70 p-3 font-black">
                              FINAL — the recipient was not enrolled because Mailshake reports the address as unsubscribed.
                            </p>
                          )}

                          <p className="mt-3 break-all">
                            <span className="font-black">
                              CRM provider operation:
                            </span>{" "}
                            {providerStatusResult.operationId ||
                              operation.id}
                          </p>

                          <p className="mt-1">
                            <span className="font-black">
                              CRM enrollment status:
                            </span>{" "}
                            {providerStatusResult.enrollmentStatus ||
                              "unknown"}
                          </p>

                          <p className="mt-1">
                            <span className="font-black">
                              Provider operation status:
                            </span>{" "}
                            {providerStatusResult.operationStatus ||
                              providerStatusResult.status ||
                              "checked"}
                          </p>

                          {providerStatusResult.providerCheckStatusId && (
                            <p className="mt-1 break-all">
                              <span className="font-black">
                                Mailshake checkStatusID:
                              </span>{" "}
                              {providerStatusResult.providerCheckStatusId}
                            </p>
                          )}

                          {providerStatusResult.providerRecipientId && (
                            <p className="mt-1 break-all">
                              <span className="font-black">
                                Mailshake recipient ID:
                              </span>{" "}
                              {providerStatusResult.providerRecipientId}
                            </p>
                          )}
                        </div>
                      )}

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                      <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                        <p className="text-xs font-semibold text-slate-500">
                          Requested
                        </p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                          {operation.requestedCount ??
                            0}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                        <p className="text-xs font-semibold text-slate-500">
                          Submitted
                        </p>
                        <p className="mt-1 text-lg font-black text-blue-800">
                          {operation.submittedCount ??
                            0}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                        <p className="text-xs font-semibold text-slate-500">
                          Confirmed
                        </p>
                        <p className="mt-1 text-lg font-black text-emerald-800">
                          {operation.confirmedCount ??
                            0}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                        <p className="text-xs font-semibold text-slate-500">
                          Already Present
                        </p>
                        <p className="mt-1 text-lg font-black text-amber-800">
                          {operation.alreadyPresentCount ??
                            0}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                        <p className="text-xs font-semibold text-slate-500">
                          Unsubscribed
                        </p>
                        <p className="mt-1 text-lg font-black text-amber-800">
                          {operation.unsubscribedCount ??
                            0}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                        <p className="text-xs font-semibold text-slate-500">
                          Failed
                        </p>
                        <p className="mt-1 text-lg font-black text-red-800">
                          {operation.failedCount ??
                            0}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                      <p>
                        <span className="font-bold text-slate-800">
                          Requested by:
                        </span>{" "}
                        {operation.requestedByDisplayName ||
                          "—"}
                      </p>

                      <p>
                        <span className="font-bold text-slate-800">
                          checkStatusID:
                        </span>{" "}
                        {operation.providerCheckStatusId ||
                          "—"}
                      </p>

                      <p>
                        <span className="font-bold text-slate-800">
                          Requested:
                        </span>{" "}
                        {formatProviderHistoryTime(
                          operation.requestedAt
                        )}
                      </p>

                      <p>
                        <span className="font-bold text-slate-800">
                          Submitted:
                        </span>{" "}
                        {formatProviderHistoryTime(
                          operation.submittedAt
                        )}
                      </p>

                      <p>
                        <span className="font-bold text-slate-800">
                          Last checked:
                        </span>{" "}
                        {formatProviderHistoryTime(
                          operation.lastCheckedAt
                        )}
                      </p>

                      <p>
                        <span className="font-bold text-slate-800">
                          Completed:
                        </span>{" "}
                        {formatProviderHistoryTime(
                          operation.completedAt
                        )}
                      </p>
                    </div>

                    {operation.providerMessage && (
                      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-950">
                        {operation.providerMessage}
                      </div>
                    )}

                    {operation.errorMessage && (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold leading-5 text-red-900">
                        {operation.errorMessage}
                      </div>
                    )}

                    <div className="mt-4 grid gap-3">
                      {recipients.length ===
                        0 ? (
                        <div className="rounded-xl bg-white p-4 text-xs text-slate-500 ring-1 ring-slate-200">
                          No provider-operation enrollment mappings were found for this operation.
                        </div>
                      ) : (
                        recipients.map(
                          (
                            recipient,
                            recipientIndex
                          ) => (
                            <div
                              key={
                                recipient.enrollmentId ||
                                `${operation.id}-recipient-${recipientIndex}`
                              }
                              className="rounded-xl bg-white p-4 ring-1 ring-slate-200"
                            >
                              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <p className="font-bold text-slate-950">
                                    {recipient.contactName ||
                                      recipient.submittedEmail ||
                                      "CRM recipient"}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-600">
                                    {recipient.companyName
                                      ? `${recipient.companyName} · `
                                      : ""}
                                    {recipient.submittedEmail ||
                                      "No email recorded"}
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${providerHistoryStatusClasses(
                                      recipient.enrollmentStatus
                                    )}`}
                                  >
                                    CRM:{" "}
                                    {recipient.enrollmentStatus ||
                                      "unknown"}
                                  </span>

                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${providerHistoryStatusClasses(
                                      recipient.mappingStatus
                                    )}`}
                                  >
                                    Provider:{" "}
                                    {recipient.mappingStatus ||
                                      "unknown"}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2 xl:grid-cols-3">
                                <p className="break-all">
                                  <span className="font-bold text-slate-800">
                                    Enrollment:
                                  </span>{" "}
                                  {recipient.enrollmentId ||
                                    "—"}
                                </p>

                                <p className="break-all">
                                  <span className="font-bold text-slate-800">
                                    Mailshake recipient ID:
                                  </span>{" "}
                                  {recipient.providerRecipientId ||
                                    "—"}
                                </p>

                                <p>
                                  <span className="font-bold text-slate-800">
                                    Batch:
                                  </span>{" "}
                                  {recipient.batchStatus ||
                                    "—"}
                                </p>

                                <p>
                                  <span className="font-bold text-slate-800">
                                    Submitted:
                                  </span>{" "}
                                  {formatProviderHistoryTime(
                                    recipient.submittedAt
                                  )}
                                </p>

                                <p>
                                  <span className="font-bold text-slate-800">
                                    Confirmed:
                                  </span>{" "}
                                  {formatProviderHistoryTime(
                                    recipient.confirmedAt
                                  )}
                                </p>

                                <p>
                                  <span className="font-bold text-slate-800">
                                    Failed:
                                  </span>{" "}
                                  {formatProviderHistoryTime(
                                    recipient.failedAt
                                  )}
                                </p>
                              </div>

                              {recipient.providerMessage && (
                                <p className="mt-3 text-xs leading-5 text-slate-700">
                                  {recipient.providerMessage}
                                </p>
                              )}

                              {recipient.failureReason && (
                                <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-900 ring-1 ring-red-200">
                                  {recipient.failureReason}
                                </p>
                              )}
                            </div>
                          )
                        )
                      )}
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </div>

      {hasLoaded &&
        !errorMessage && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-950">
                  Mailshake Campaigns
                </h3>

                <p className="mt-1 text-sm text-slate-600">
                  {campaigns.length} unique campaign
                  {campaigns.length === 1
                    ? ""
                    : "s"} loaded.
                </p>
              </div>

              {pagesRead > 0 && (
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                  {pagesRead} API page
                  {pagesRead === 1
                    ? ""
                    : "s"} checked
                </span>
              )}
            </div>

            {paginationComplete && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-900">
                Mailshake pagination completed normally. No additional campaign page was reported.
              </div>
            )}

            {paginationNote && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                {paginationNote}
              </div>
            )}

            {campaigns.length === 0 ? (
              <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
                Mailshake authenticated successfully, but no campaigns were returned.
              </div>
            ) : (
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {campaigns.map(
                  (
                    campaign,
                    index
                  ) => {
                    const status =
                      campaignStatus(
                        campaign
                      );

                    return (
                      <article
                        key={
                          campaign.providerCampaignId ||
                          `${campaign.title}-${index}`
                        }
                        className="rounded-xl border border-slate-200 bg-slate-50 p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Mailshake Campaign
                            </p>

                            <h4 className="mt-1 text-lg font-bold text-slate-950">
                              {campaign.title}
                            </h4>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${status.classes}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-bold uppercase text-slate-500">
                              Campaign ID
                            </p>

                            <p className="mt-1 break-words text-slate-800">
                              {campaign.providerCampaignId ||
                                "Not reported"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase text-slate-500">
                              Sender
                            </p>

                            <p className="mt-1 break-words text-slate-800">
                              {campaign.sender.fromName ||
                                campaign.sender.emailAddress ||
                                "Not reported"}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </div>
        )}

      <div className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-violet-700">
              CRM Outreach Selection
            </p>

            <h3 className="mt-1 text-xl font-bold text-slate-950">
              Filter and Select CRM Contacts
            </h3>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Selection comes from the complete active CRM contact population, not the 100-contact dashboard summary. Select All Filtered always selects every eligible CRM contact matching the current filters, even when the table spans multiple pages.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadContacts()
            }
            disabled={
              isLoadingContacts
            }
            className="rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isLoadingContacts
              ? "Loading CRM Contacts..."
              : contactsLoaded
                ? "Refresh CRM Outreach Contacts"
                : "Load CRM Outreach Contacts"}
          </button>
        </div>

        {contactError && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {contactError}
          </div>
        )}

        {contactMessage &&
          !contactError && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              {contactMessage}
            </div>
          )}

        {contactsLoaded &&
          !contactError && (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Active CRM Contacts
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {contactResponse?.totalActiveContacts ??
                      contacts.length}
                  </p>
                </div>

                <div className="rounded-xl bg-blue-50 p-4 ring-1 ring-blue-200">
                  <p className="text-xs font-bold uppercase text-blue-700">
                    Filtered
                  </p>
                  <p className="mt-1 text-2xl font-black text-blue-950">
                    {filteredContacts.length}
                  </p>
                </div>

                <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                  <p className="text-xs font-bold uppercase text-emerald-700">
                    Eligible Filtered
                  </p>
                  <p className="mt-1 text-2xl font-black text-emerald-950">
                    {eligibleFilteredContacts.length}
                  </p>
                </div>

                <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
                  <p className="text-xs font-bold uppercase text-amber-700">
                    Blocked Filtered
                  </p>
                  <p className="mt-1 text-2xl font-black text-amber-950">
                    {blockedFilteredCount}
                  </p>
                </div>

                <div className="rounded-xl bg-violet-50 p-4 ring-1 ring-violet-200">
                  <p className="text-xs font-bold uppercase text-violet-700">
                    Selected
                  </p>
                  <p className="mt-1 text-2xl font-black text-violet-950">
                    {selectedContactIds.length}
                  </p>
                  <p className="mt-1 text-xs text-violet-800">
                    {selectedFilteredCount} in current filter
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="grid gap-4 lg:grid-cols-4">
                  <div className="lg:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                      Search Contacts
                    </label>

                    <input
                      type="text"
                      value={
                        contactSearch
                      }
                      onChange={(
                        event
                      ) =>
                        setContactSearch(
                          event.target.value
                        )
                      }
                      placeholder="Name, company, title, email, function, state, tags, Project / List..."
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
                    />
                  </div>

                  <FilterSelect
                    label="Company"
                    value={
                      companyFilter
                    }
                    onChange={
                      setCompanyFilter
                    }
                    options={
                      filterOptions?.companies ??
                      []
                    }
                  />

                  <StringFilterSelect
                    label="State"
                    value={
                      stateFilter
                    }
                    onChange={
                      setStateFilter
                    }
                    options={
                      filterOptions?.states ??
                      []
                    }
                  />

                  <StringFilterSelect
                    label="Management Level"
                    value={
                      managementFilter
                    }
                    onChange={
                      setManagementFilter
                    }
                    options={
                      filterOptions?.managementLevels ??
                      []
                    }
                  />

                  <StringFilterSelect
                    label="Function / Department"
                    value={
                      functionFilter
                    }
                    onChange={
                      setFunctionFilter
                    }
                    options={
                      filterOptions?.functions ??
                      []
                    }
                  />

                  <FilterSelect
                    label="Market"
                    value={
                      marketFilter
                    }
                    onChange={
                      setMarketFilter
                    }
                    options={
                      filterOptions?.marketTags ??
                      []
                    }
                  />

                  <FilterSelect
                    label="Sector"
                    value={
                      sectorFilter
                    }
                    onChange={
                      setSectorFilter
                    }
                    options={
                      filterOptions?.sectorTags ??
                      []
                    }
                  />

                  <FilterSelect
                    label="Category"
                    value={
                      categoryFilter
                    }
                    onChange={
                      setCategoryFilter
                    }
                    options={
                      filterOptions?.categoryTags ??
                      []
                    }
                  />

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                      Project / List
                    </label>

                    <select
                      value={
                        projectFilter
                      }
                      onChange={(
                        event
                      ) => {
                        const nextValue =
                          event.target.value;

                        setProjectFilter(
                          nextValue
                        );

                        if (
                          listBatchSourceListId &&
                          nextValue !==
                            listBatchSourceListId
                        ) {
                          clearSelection();
                        }
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm shadow-sm"
                    >
                      <option value="All">
                        All
                      </option>

                      {(filterOptions?.projects ??
                        []).map(
                        (option) => (
                          <option
                            key={
                              option.id
                            }
                            value={
                              option.id
                            }
                          >
                            {option.kind ===
                            "list"
                              ? "List"
                              : "Project"}
                            :{" "}
                            {option.label}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                      Eligibility
                    </label>

                    <select
                      value={
                        eligibilityFilter
                      }
                      onChange={(
                        event
                      ) =>
                        setEligibilityFilter(
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm shadow-sm"
                    >
                      <option value="All">
                        All
                      </option>
                      <option value="Eligible">
                        Eligible only
                      </option>
                      <option value="Blocked">
                        Blocked only
                      </option>
                    </select>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  {selectedListFilterOption && (
                    <div className="w-full rounded-xl border border-violet-200 bg-violet-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-violet-700">
                        CRM List Batch Mode
                      </p>

                      <p className="mt-1 font-black text-violet-950">
                        {selectedListFilterOption.label}
                      </p>

                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg bg-white p-3 ring-1 ring-violet-100">
                          <p className="text-xs font-bold text-slate-500">
                            List Members
                          </p>
                          <p className="mt-1 text-xl font-black text-slate-950">
                            {selectedListContacts.length}
                          </p>
                        </div>

                        <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-200">
                          <p className="text-xs font-bold text-emerald-700">
                            Eligible
                          </p>
                          <p className="mt-1 text-xl font-black text-emerald-950">
                            {selectedListEligibleContacts.length}
                          </p>
                        </div>

                        <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
                          <p className="text-xs font-bold text-amber-700">
                            Blocked
                          </p>
                          <p className="mt-1 text-xl font-black text-amber-950">
                            {selectedListBlockedCount}
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 text-xs leading-5 text-violet-900">
                        Whole-List selection ignores the other contact filters and replaces any previous selection. The server will independently verify current List membership and eligibility again before CRM records can be created.
                      </p>
                    </div>
                  )}

                  {selectedListFilterOption ? (
                    <button
                      type="button"
                      onClick={
                        selectAllEligibleFromList
                      }
                      disabled={
                        selectedListEligibleContacts.length ===
                        0
                      }
                      className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Select All Eligible From This List (
                      {selectedListEligibleContacts.length}
                      )
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={
                        selectAllFiltered
                      }
                      disabled={
                        eligibleFilteredContacts.length ===
                        0
                      }
                      className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Select All Filtered (
                      {eligibleFilteredContacts.length}
                      )
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={
                      clearSelection
                    }
                    disabled={
                      selectedContactIds.length ===
                      0
                    }
                    className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    Clear Selection
                  </button>

                  <button
                    type="button"
                    onClick={
                      clearFilters
                    }
                    className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50"
                  >
                    Clear Filters
                  </button>
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-600">
                  {selectedListFilterOption
                    ? "For a CRM List, use Select All Eligible From This List. It replaces previous selections and creates a protected whole-List selection that the server verifies again before CRM recording."
                    : "Select All Filtered adds every eligible contact matching the current filters. Existing selections remain selected when you change filters, so you can review or add another filtered group. Clear Selection removes the entire selection."}
                </p>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[1150px] border-collapse text-left text-sm">
                  <thead className="bg-slate-100">
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 font-bold text-slate-700">
                        Select
                      </th>
                      <th className="px-4 py-3 font-bold text-slate-700">
                        Contact
                      </th>
                      <th className="px-4 py-3 font-bold text-slate-700">
                        Company
                      </th>
                      <th className="px-4 py-3 font-bold text-slate-700">
                        Title / Function
                      </th>
                      <th className="px-4 py-3 font-bold text-slate-700">
                        Email
                      </th>
                      <th className="px-4 py-3 font-bold text-slate-700">
                        State
                      </th>
                      <th className="px-4 py-3 font-bold text-slate-700">
                        Outreach Eligibility
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleContacts.map(
                      (contact) => {
                        const selected =
                          selectedContactSet.has(
                            contact.contactId
                          );

                        return (
                          <tr
                            key={
                              contact.contactId
                            }
                            className={`border-b border-slate-100 align-top ${
                              contact.eligibleForMailshake
                                ? "bg-white"
                                : "bg-amber-50/50"
                            }`}
                          >
                            <td className="px-4 py-4">
                              <input
                                type="checkbox"
                                checked={
                                  selected
                                }
                                disabled={
                                  !contact.eligibleForMailshake
                                }
                                onChange={() =>
                                  toggleContact(
                                    contact
                                  )
                                }
                                aria-label={`Select ${contact.fullName || contact.email || "contact"}`}
                                className="h-4 w-4 rounded border-slate-300 text-violet-700 focus:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                              />
                            </td>

                            <td className="px-4 py-4">
                              <p className="font-bold text-slate-900">
                                {contact.fullName ||
                                  "Name not provided"}
                              </p>

                              {contact.managementLevel && (
                                <p className="mt-1 text-xs text-slate-500">
                                  {contact.managementLevel}
                                </p>
                              )}
                            </td>

                            <td className="px-4 py-4 text-slate-700">
                              {contact.companyName ||
                                "Company not provided"}
                            </td>

                            <td className="px-4 py-4 text-slate-700">
                              <p>
                                {contact.title ||
                                  "Title not provided"}
                              </p>

                              {(contact.functionArea ||
                                contact.department) && (
                                <p className="mt-1 text-xs text-slate-500">
                                  {contact.functionArea ||
                                    contact.department}
                                </p>
                              )}
                            </td>

                            <td className="px-4 py-4 text-slate-700">
                              {contact.email ||
                                "No email"}
                            </td>

                            <td className="px-4 py-4 text-slate-700">
                              {contact.state ||
                                "-"}
                            </td>

                            <td className="px-4 py-4">
                              {contact.eligibleForMailshake ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
                                  Eligible
                                </span>
                              ) : (
                                <>
                                  <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-200">
                                    Blocked
                                  </span>

                                  <p className="mt-2 max-w-[320px] text-xs leading-5 text-amber-900">
                                    {contact.eligibilityReason}
                                  </p>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>

                {filteredContacts.length ===
                  0 && (
                  <div className="p-8 text-center text-sm text-slate-600">
                    No CRM contacts match the current filters.
                  </div>
                )}
              </div>

              {filteredContacts.length >
                0 && (
                <div className="mt-4 flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-700">
                    Showing{" "}
                    {(safeContactPage -
                      1) *
                      CONTACT_PAGE_SIZE +
                      1}
                    -
                    {Math.min(
                      safeContactPage *
                        CONTACT_PAGE_SIZE,
                      filteredContacts.length
                    )}{" "}
                    of{" "}
                    {filteredContacts.length}{" "}
                    filtered contacts.
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={
                        safeContactPage <=
                        1
                      }
                      onClick={() =>
                        setContactPage(
                          Math.max(
                            1,
                            safeContactPage -
                              1
                          )
                        )
                      }
                      className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
                    >
                      Previous
                    </button>

                    <span className="text-xs font-bold text-slate-600">
                      Page{" "}
                      {safeContactPage}{" "}
                      of {pageCount}
                    </span>

                    <button
                      type="button"
                      disabled={
                        safeContactPage >=
                        pageCount
                      }
                      onClick={() =>
                        setContactPage(
                          Math.min(
                            pageCount,
                            safeContactPage +
                              1
                          )
                        )
                      }
                      className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-5 rounded-2xl border border-violet-300 bg-violet-50 p-5 text-sm text-violet-950">
                <p className="text-xs font-black uppercase tracking-wide text-violet-700">
                  CRM Enrollment Review
                </p>

                <h4 className="mt-1 text-lg font-bold text-violet-950">
                  Review the CRM instruction before recording it
                </h4>

                <p className="mt-2 max-w-4xl text-xs leading-5 text-violet-900">
                  This workflow records the salesperson or manager's enrollment decision in CRM first. Nothing on this panel adds a recipient to Mailshake or sends email.
                </p>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-violet-800">
                      Existing Mailshake Campaign
                    </label>

                    <select
                      value={
                        selectedCampaignId
                      }
                      onChange={(
                        event
                      ) => {
                        setSelectedCampaignId(
                          event.target.value
                        );

                        setEnrollmentReview(
                          null
                        );

                        setEnrollmentReviewFingerprint(
                          ""
                        );

                        setRecordedEnrollmentFingerprint(
                          ""
                        );

                        setEnrollmentMessage(
                          ""
                        );

                        setEnrollmentError(
                          ""
                        );

                        setProviderExecutionReview(
                          null
                        );

                        setProviderExecutionReviewFingerprint(
                          ""
                        );

                        setProviderExecutionMessage(
                          ""
                        );

                        setProviderExecutionError(
                          ""
                        );
                      }}
                      disabled={
                        campaigns.filter(
                          (campaign) =>
                            !campaign.isArchived &&
                            Boolean(
                              campaign.providerCampaignId
                            )
                        ).length ===
                        0
                      }
                      className="mt-2 w-full rounded-xl border border-violet-300 bg-white px-4 py-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="">
                        Choose a Mailshake campaign
                      </option>

                      {campaigns
                        .filter(
                          (campaign) =>
                            !campaign.isArchived &&
                            Boolean(
                              campaign.providerCampaignId
                            )
                        )
                        .map(
                          (
                            campaign
                          ) => (
                            <option
                              key={
                                campaign.providerCampaignId
                              }
                              value={
                                campaign.providerCampaignId
                              }
                            >
                              {campaign.title} —{" "}
                              {campaign.isPaused
                                ? "Paused"
                                : "Not Paused"}
                            </option>
                          )
                        )}
                    </select>

                    {!hasLoaded && (
                      <p className="mt-2 text-xs text-violet-800">
                        Load Mailshake campaigns above before choosing the execution campaign.
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-violet-200 bg-white p-4">
                    <p className="text-xs font-bold uppercase text-violet-700">
                      Step 0 — Current CRM Selection
                    </p>

                    <p className="mt-1 text-2xl font-black text-violet-950">
                      {selectedContactIds.length}
                    </p>

                    <p className="mt-1 text-xs text-violet-800">
                      {listBatchSourceListId
                        ? `Protected whole-List selection: ${
                            selectedListFilterOption?.label || "CRM List"
                          }.`
                        : selectionUsedSelectAll
                          ? "Selection includes Select All Filtered."
                          : "Selection was made individually."}
                    </p>
                  </div>
                </div>

                {selectedCampaign && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-950">
                    <p className="font-bold">
                      Selected campaign: {selectedCampaign.title}
                    </p>

                    <p className="mt-1">
                      Mailshake Campaign ID: {selectedCampaign.providerCampaignId}
                    </p>

                    <p className="mt-1">
                      Current provider status:{" "}
                      {selectedCampaign.isPaused
                        ? "Paused"
                        : "Not Paused"}
                    </p>

                    {selectedCampaign.isPaused ? (
                      <p className="mt-2 font-semibold">
                        Recording the CRM enrollment does not unpause this campaign.
                      </p>
                    ) : (
                      <p className="mt-2 font-semibold">
                        This campaign is not paused. This revision still records CRM intent only; provider submission will require a separate later confirmation.
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      void reviewEnrollment()
                    }
                    disabled={
                      isReviewingEnrollment ||
                      isRecordingEnrollment ||
                      !selectedCampaign ||
                      selectedContactIds.length ===
                        0
                    }
                    className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isReviewingEnrollment
                      ? "Reviewing CRM Selection..."
                      : "Step 1 — Review Selection on Server"}
                  </button>
                </div>

                {enrollmentError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
                    {enrollmentError}
                  </div>
                )}

                {enrollmentMessage && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                    {enrollmentMessage}
                  </div>
                )}

                {enrollmentReview && (
                  <div className="mt-5 rounded-2xl border border-violet-200 bg-white p-5">
                    <h5 className="font-bold text-slate-950">
                      Step 1 Result — Server-Validated Enrollment Review
                    </h5>

                    {enrollmentReviewFingerprint !==
                      enrollmentSelectionFingerprint && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                        The selection or filters changed after Step 1. Run Step 1 — Review Selection on Server again before recording anything in CRM.
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        <p className="text-xs font-bold uppercase text-slate-500">
                          Requested
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-950">
                          {enrollmentReview.requestedCount ?? 0}
                        </p>
                      </div>

                      <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                        <p className="text-xs font-bold uppercase text-emerald-700">
                          Eligible Now
                        </p>
                        <p className="mt-1 text-xl font-black text-emerald-950">
                          {enrollmentReview.eligibleCount ?? 0}
                        </p>
                      </div>

                      <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
                        <p className="text-xs font-bold uppercase text-amber-700">
                          Blocked Now
                        </p>
                        <p className="mt-1 text-xl font-black text-amber-950">
                          {enrollmentReview.blockedCount ?? 0}
                        </p>
                      </div>

                      <div className="rounded-xl bg-blue-50 p-3 ring-1 ring-blue-200">
                        <p className="text-xs font-bold uppercase text-blue-700">
                          Already in CRM
                        </p>
                        <p className="mt-1 text-xl font-black text-blue-950">
                          {enrollmentReview.alreadyRecordedCount ?? 0}
                        </p>
                      </div>

                      <div className="rounded-xl bg-violet-100 p-3 ring-1 ring-violet-300">
                        <p className="text-xs font-bold uppercase text-violet-700">
                          New CRM Records
                        </p>
                        <p className="mt-1 text-xl font-black text-violet-950">
                          {enrollmentReview.newEnrollmentCount ?? 0}
                        </p>
                      </div>
                    </div>

                    {(enrollmentReview.blocked?.length ?? 0) > 0 && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-bold uppercase text-amber-800">
                          Server-Blocked Contacts
                        </p>

                        <div className="mt-2 grid gap-2">
                          {(enrollmentReview.blocked ?? [])
                            .slice(0, 8)
                            .map(
                              (
                                blocked,
                                index
                              ) => (
                                <p
                                  key={`${blocked.contactId}-${index}`}
                                  className="text-xs leading-5 text-amber-900"
                                >
                                  {blocked.reason}
                                </p>
                              )
                            )}

                          {(enrollmentReview.blocked?.length ?? 0) >
                            8 && (
                            <p className="text-xs font-semibold text-amber-900">
                              Plus{" "}
                              {(enrollmentReview.blocked?.length ?? 0) -
                                8}{" "}
                              additional blocked contact(s).
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-5 border-t border-violet-200 pt-5">
                      <button
                        type="button"
                        onClick={() =>
                          void recordEnrollmentInCrm()
                        }
                        disabled={
                          isReviewingEnrollment ||
                          isRecordingEnrollment ||
                          enrollmentReviewFingerprint !==
                            enrollmentSelectionFingerprint ||
                          recordedEnrollmentFingerprint ===
                            enrollmentSelectionFingerprint ||
                          Number(
                            enrollmentReview.newEnrollmentCount ??
                              0
                          ) <= 0
                        }
                        className="rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {isRecordingEnrollment
                          ? "Recording in CRM..."
                          : recordedEnrollmentFingerprint ===
                              enrollmentSelectionFingerprint
                            ? "Recorded in CRM"
                            : `Step 2 — Record ${Number(
                                enrollmentReview.newEnrollmentCount ??
                                  0
                              )} in CRM — Not Mailshake`}
                      </button>

                      <p className="mt-3 text-xs font-semibold leading-5 text-violet-900">
                        CRM WRITE — NO MAILSHAKE ACTION — NO EMAIL SENT. Step 2 creates the CRM enrollment and batch tracking records only. After recording, continue to Step 3 and run a fresh readiness review before any provider submission.
                      </p>

                      {enrollmentReview.batchId && (
                        <p className="mt-2 break-all text-xs text-slate-500">
                          CRM enrollment batch: {enrollmentReview.batchId}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {enrollmentReview &&
                  (
                    Number(
                      enrollmentReview.alreadyRecordedCount ??
                        0
                    ) +
                    Number(
                      enrollmentReview.recordedEnrollmentCount ??
                        0
                    )
                  ) >
                    0 && (
                  <div className="mt-5 rounded-2xl border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950">
                    <p className="text-xs font-black uppercase tracking-wide text-rose-700">
                      Provider Execution — Controlled
                    </p>

                    <h5 className="mt-1 text-lg font-bold text-rose-950">
                      Step 3 — Check Recorded Enrollment & Mailshake Readiness
                    </h5>

                    <p className="mt-2 max-w-4xl text-xs leading-5 text-rose-900">
                      CHECK ONLY — Step 3 re-validates the recorded CRM enrollment and reads the current campaign directly from Mailshake. It does not add a recipient, change the enrollment outcome, or send email. Run this immediately before Step 4 because CRM or campaign conditions may have changed.
                    </p>

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() =>
                          void reviewProviderExecution()
                        }
                        disabled={
                          isReviewingProviderExecution ||
                          isReviewingEnrollment ||
                          isRecordingEnrollment ||
                          enrollmentReviewFingerprint !==
                            enrollmentSelectionFingerprint
                        }
                        className="rounded-xl bg-rose-700 px-5 py-3 text-sm font-bold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {isReviewingProviderExecution
                          ? "Checking CRM and Mailshake..."
                          : "Review Recorded Enrollment for Mailshake"}
                      </button>
                    </div>

                    {providerExecutionReviewFingerprint &&
                      providerExecutionReviewFingerprint !==
                        enrollmentSelectionFingerprint && (
                        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                          The campaign, contact selection, or filters changed after this provider review. Run the CRM server review again before relying on these results.
                        </div>
                      )}

                    {providerExecutionError && (
                      <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900">
                        {providerExecutionError}
                      </div>
                    )}

                    {providerExecutionMessage && (
                      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-950">
                        {providerExecutionMessage}
                      </div>
                    )}

                    {providerExecutionReview?.providerReview && (
                      <div className="mt-5 rounded-xl border border-rose-200 bg-white p-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase text-slate-500">
                              Step 4 — Mailshake Submission Readiness
                            </p>

                            <p className="mt-1 font-bold text-slate-950">
                              {providerExecutionReview.providerReview.providerCampaignTitle ||
                                "Campaign name not reported"}
                            </p>

                            <p className="mt-1 text-xs text-slate-600">
                              Campaign ID:{" "}
                              {providerExecutionReview.providerReview.providerCampaignId ||
                                "Not reported"}
                            </p>
                          </div>

                          <span
                            className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
                              providerExecutionReview.providerReview
                                .providerCampaignState ===
                              "paused"
                                ? "bg-amber-100 text-amber-900 ring-amber-200"
                                : providerExecutionReview.providerReview
                                      .providerCampaignState ===
                                    "archived"
                                  ? "bg-slate-200 text-slate-800 ring-slate-300"
                                  : "bg-red-100 text-red-900 ring-red-200"
                            }`}
                          >
                            {providerExecutionReview.providerReview
                              .providerCampaignState ===
                            "paused"
                              ? "Paused"
                              : providerExecutionReview.providerReview
                                    .providerCampaignState ===
                                  "archived"
                                ? "Archived"
                                : "Not Paused"}
                          </span>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                          <div className="rounded-xl bg-blue-50 p-3 ring-1 ring-blue-200">
                            <p className="text-xs font-bold uppercase text-blue-700">
                              Recorded in CRM
                            </p>
                            <p className="mt-1 text-xl font-black text-blue-950">
                              {providerExecutionReview.providerReview
                                .recordedEnrollmentCount ?? 0}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-blue-900">
                              CRM enrollment records exist for this selection. This does not mean Mailshake was changed.
                            </p>
                          </div>

                          <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                            <p className="text-xs font-bold uppercase text-emerald-700">
                              Ready / Requested
                            </p>
                            <p className="mt-1 text-xl font-black text-emerald-950">
                              {providerExecutionReview.providerReview
                                .readyToSubmitCount ?? 0}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-emerald-900">
                              Eligible right now for the controlled provider submission. A Mailshake write is possible only if every server safety rule also passes.
                            </p>
                          </div>

                          <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
                            <p className="text-xs font-bold uppercase text-amber-700">
                              Blocked Now
                            </p>
                            <p className="mt-1 text-xl font-black text-amber-950">
                              {providerExecutionReview.providerReview
                                .blockedNowCount ?? 0}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-amber-900">
                              A recorded enrollment exists, but current CRM or Mailshake conditions prevent submission. Review the server message before taking action.
                            </p>
                          </div>

                          <div className="rounded-xl bg-orange-50 p-3 ring-1 ring-orange-200">
                            <p className="text-xs font-bold uppercase text-orange-700">
                              Email Changed
                            </p>
                            <p className="mt-1 text-xl font-black text-orange-950">
                              {providerExecutionReview.providerReview
                                .emailChangedCount ?? 0}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-orange-900">
                              The contact email no longer matches the email recorded with the enrollment. Stop and review before any provider action.
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-100 p-3 ring-1 ring-slate-200">
                            <p className="text-xs font-bold uppercase text-slate-600">
                              Already Processed / Not Requested
                            </p>
                            <p className="mt-1 text-xl font-black text-slate-950">
                              {providerExecutionReview.providerReview
                                .nonRequestedCount ?? 0}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-slate-700">
                              No new Mailshake add is requested. The enrollment has already moved beyond the requested state or is otherwise not eligible for a new submission.
                            </p>
                          </div>
                        </div>

                        {(providerExecutionReview.providerReview
                          .missingCrmEnrollmentCount ?? 0) >
                          0 && (
                          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                            {
                              providerExecutionReview.providerReview
                                .missingCrmEnrollmentCount
                            }{" "}
                            currently eligible selected contact(s) do not have a CRM enrollment record for this campaign.
                          </div>
                        )}

                        <div className="mt-4 rounded-xl border border-indigo-300 bg-indigo-50 p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-indigo-700">
                            H3B2B2 — Admin Production Authorization Lifecycle
                          </p>

                          <h6 className="mt-1 font-bold text-indigo-950">
                            Read-only controlled-run authorization review
                          </h6>

                          <p className="mt-2 text-xs leading-5 text-indigo-900">
                            Admin only. The server independently reruns the current CRM and Mailshake readiness review, then checks the first proposed controlled set for unresolved provider operations, existing Mailshake recipients, and an existing run authorization.
                          </p>

                          <p className="mt-2 text-xs font-black text-indigo-950">
                            This action does not create an authorization, add a Mailshake recipient, or send email.
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              void reviewProductionAuthorization()
                            }
                            disabled={
                              isReviewingAuthorization ||
                              isReviewingProviderExecution ||
                              providerExecutionReviewFingerprint !==
                                enrollmentSelectionFingerprint
                            }
                            className="mt-4 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-black text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {isReviewingAuthorization
                              ? "Reviewing Production Authorization..."
                              : "Review Production Authorization — Read Only"}
                          </button>

                          {authorizationReviewError && (
                            <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-950">
                              {authorizationReviewError}
                            </div>
                          )}

                          {authorizationReviewFingerprint &&
                            authorizationReviewFingerprint !==
                              enrollmentSelectionFingerprint && (
                              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-950">
                                This review is stale because the CRM selection changed. Run Step 3 again.
                              </div>
                            )}

                          {authorizationReview && (
                            <div className="mt-4 rounded-xl border border-indigo-200 bg-white p-4">
                              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                                  <p className="text-xs font-bold uppercase text-slate-500">
                                    Environment
                                  </p>
                                  <p className="mt-1 font-black text-slate-950">
                                    {authorizationReview.environment ||
                                      "Unknown"}
                                  </p>
                                </div>

                                <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-200">
                                  <p className="text-xs font-bold uppercase text-emerald-700">
                                    Server Ready
                                  </p>
                                  <p className="mt-1 text-xl font-black text-emerald-950">
                                    {authorizationReview.serverReadyCount ??
                                      0}
                                  </p>
                                </div>

                                <div className="rounded-lg bg-indigo-50 p-3 ring-1 ring-indigo-200">
                                  <p className="text-xs font-bold uppercase text-indigo-700">
                                    Proposed Now
                                  </p>
                                  <p className="mt-1 text-xl font-black text-indigo-950">
                                    {authorizationReview.proposedCount ??
                                      0}
                                  </p>
                                  <p className="mt-1 text-xs text-indigo-800">
                                    Initial cap:{" "}
                                    {authorizationReview.maxControlledAuthorizationCount ??
                                      2}
                                  </p>
                                </div>

                                <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
                                  <p className="text-xs font-bold uppercase text-amber-700">
                                    Authorization
                                  </p>
                                  <p className="mt-1 font-black text-amber-950">
                                    {authorizationReview.authorizationCreated
                                      ? "CREATED"
                                      : "NOT CREATED"}
                                  </p>
                                </div>
                              </div>

                              <p className="mt-4 text-sm font-semibold leading-6 text-slate-900">
                                {authorizationReview.message}
                              </p>

                              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                                <p>
                                  Verified proposed:{" "}
                                  <span className="font-black">
                                    {authorizationReview.verifiedProposedCount ??
                                      0}
                                  </span>
                                </p>

                                <p>
                                  Active/unresolved provider operations:{" "}
                                  <span className="font-black">
                                    {authorizationReview.activeProviderOperationCount ??
                                      0}
                                  </span>
                                </p>

                                <p>
                                  Existing Mailshake recipients:{" "}
                                  <span className="font-black">
                                    {authorizationReview.existingProviderRecipientCount ??
                                      0}
                                  </span>
                                </p>

                                <p>
                                  Planned authorization lifetime:{" "}
                                  <span className="font-black">
                                    {authorizationReview.authorizationDurationMinutes ??
                                      15}{" "}
                                    minutes
                                  </span>
                                </p>

                                <p>
                                  Eligible for later Production authorization creation:{" "}
                                  <span className="font-black">
                                    {authorizationReview.eligibleForLaterProductionAuthorization
                                      ? "YES"
                                      : "NO"}
                                  </span>
                                </p>
                              </div>

                              {(authorizationReview.blockedReasons?.length ??
                                0) > 0 && (
                                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                                  <p className="text-xs font-black uppercase text-amber-800">
                                    Safety Findings
                                  </p>

                                  {(authorizationReview.blockedReasons ??
                                    []).map(
                                    (
                                      reason,
                                      index
                                    ) => (
                                      <p
                                        key={`${reason}-${index}`}
                                        className="mt-1 text-xs leading-5 text-amber-950"
                                      >
                                        {reason}
                                      </p>
                                    )
                                  )}
                                </div>
                              )}

                              <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs font-semibold leading-5 text-violet-950">
                                Provider-write policy:{" "}
                                {authorizationReview.providerWritePolicyAllowed
                                  ? "allowed by the existing deployment policy"
                                  : "blocked"}
                                .{" "}
                                {authorizationReview.providerWritePolicyReason}
                                {" "}H3B2B2 authorization lifecycle still never invokes the provider-write endpoint.
                              </div>
                            </div>
                          )}
                        </div>
                        {authorizationLifecycleError && (
                          <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-950">
                            {authorizationLifecycleError}
                          </div>
                        )}

                        {authorizationReview?.createConfirmationPhrase &&
                          authorizationReview.safetyChecksPassedForProposedSet &&
                          !authorizationLifecycle?.authorizationCreated && (
                            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                              <p className="text-xs font-black uppercase tracking-wide text-amber-800">
                                H3B2B2 — Controlled Authorization Creation
                              </p>

                              <p className="mt-2 text-xs leading-5 text-amber-950">
                                This creates only the short-lived CRM run authorization and its exact enrollment items. It does not add a Mailshake recipient, send email, or unlock provider execution.
                              </p>

                              <p className="mt-3 text-xs font-bold text-amber-950">
                                Type exactly:
                              </p>

                              <div className="mt-1 rounded-lg border border-amber-300 bg-white px-3 py-2 font-mono text-sm font-black text-slate-950">
                                {authorizationReview.createConfirmationPhrase}
                              </div>

                              <input
                                type="text"
                                value={authorizationCreateConfirmation}
                                onChange={(event) =>
                                  setAuthorizationCreateConfirmation(
                                    event.target.value
                                  )
                                }
                                autoComplete="off"
                                spellCheck={false}
                                className="mt-3 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950"
                                placeholder="Type the authorization confirmation"
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  void createProductionAuthorization()
                                }
                                disabled={
                                  isCreatingAuthorization ||
                                  authorizationCreateConfirmation.trim() !==
                                    authorizationReview.createConfirmationPhrase
                                }
                                className="mt-3 rounded-xl bg-amber-700 px-5 py-3 text-sm font-black text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                {isCreatingAuthorization
                                  ? "Creating Authorization..."
                                  : "Create Controlled Run Authorization"}
                              </button>
                            </div>
                          )}

                        {authorizationLifecycle?.authorizationCreated &&
                          authorizationLifecycle.authorization?.id && (
                            <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
                              <p className="text-xs font-black uppercase tracking-wide text-emerald-800">
                                Authorization Created — Provider Execution Still Locked
                              </p>

                              <p className="mt-2 text-sm font-semibold text-emerald-950">
                                {authorizationLifecycle.message}
                              </p>

                              <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-3 text-xs leading-5 text-slate-800">
                                <p>
                                  Authorization ID:{" "}
                                  <span className="font-mono font-black">
                                    {authorizationLifecycle.authorization.id}
                                  </span>
                                </p>

                                <p>
                                  Status:{" "}
                                  <span className="font-black">
                                    {authorizationLifecycle.authorization.status ||
                                      "authorized"}
                                  </span>
                                </p>

                                <p>
                                  Authorized count:{" "}
                                  <span className="font-black">
                                    {authorizationLifecycle.authorization
                                      .authorized_count ?? 0}
                                  </span>
                                </p>

                                <p>
                                  Expires:{" "}
                                  <span className="font-black">
                                    {authorizationLifecycle.authorization
                                      .expires_at || "Unknown"}
                                  </span>
                                </p>

                                <p>
                                  Provider execution unlocked:{" "}
                                  <span className="font-black">
                                    {authorizationLifecycle.providerExecutionUnlocked
                                      ? "YES"
                                      : "NO"}
                                  </span>
                                </p>
                              </div>

                              {authorizationLifecycle.cancelConfirmationPhrase && (
                                <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3">
                                  <p className="text-xs font-black uppercase text-red-800">
                                    Cancel Unused Authorization
                                  </p>

                                  <p className="mt-2 text-xs text-red-950">
                                    Cancellation is audit-preserving and is refused after any provider operation has been linked.
                                  </p>

                                  <input
                                    type="text"
                                    value={authorizationCancellationReason}
                                    onChange={(event) =>
                                      setAuthorizationCancellationReason(
                                        event.target.value
                                      )
                                    }
                                    className="mt-3 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950"
                                    placeholder="Cancellation reason — at least 8 characters"
                                  />

                                  <p className="mt-3 text-xs font-bold text-red-950">
                                    Type exactly:
                                  </p>

                                  <div className="mt-1 rounded-lg border border-red-300 bg-white px-3 py-2 font-mono text-sm font-black text-slate-950">
                                    {authorizationLifecycle.cancelConfirmationPhrase}
                                  </div>

                                  <input
                                    type="text"
                                    value={authorizationCancelConfirmation}
                                    onChange={(event) =>
                                      setAuthorizationCancelConfirmation(
                                        event.target.value
                                      )
                                    }
                                    autoComplete="off"
                                    spellCheck={false}
                                    className="mt-3 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950"
                                    placeholder="Type the cancellation confirmation"
                                  />

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void cancelProductionAuthorization()
                                    }
                                    disabled={
                                      isCancellingAuthorization ||
                                      authorizationCancellationReason.trim()
                                        .length < 8 ||
                                      authorizationCancelConfirmation.trim() !==
                                        authorizationLifecycle.cancelConfirmationPhrase
                                    }
                                    className="mt-3 rounded-xl bg-red-700 px-5 py-3 text-sm font-black text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                  >
                                    {isCancellingAuthorization
                                      ? "Cancelling Authorization..."
                                      : "Cancel Unused Authorization"}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                        {authorizationLifecycle?.authorizationCancelled && (
                          <div className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase text-slate-700">
                              Authorization Cancelled
                            </p>

                            <p className="mt-2 text-sm font-semibold text-slate-900">
                              {authorizationLifecycle.message}
                            </p>

                            <p className="mt-2 text-xs font-black text-slate-700">
                              Run Step 3 and the read-only authorization review again before creating another authorization.
                            </p>
                          </div>
                        )}
                        {providerExecutionReview.providerReview
                          .providerExecutionAllowed ? (
                          <div className="mt-4 grid gap-4">
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                              Initial safety policy passed: Mailshake currently reports this campaign as paused and at least one recorded enrollment remains in requested status.
                            </div>

                            <div className="rounded-xl border-2 border-red-300 bg-red-50 p-5">
                              <p className="text-xs font-black uppercase tracking-wide text-red-700">
                                Step 4 — Real Mailshake Write
                              </p>

                              <h6 className="mt-1 font-bold text-red-950">
                                Submit the next controlled group to the paused campaign
                              </h6>

                              <p className="mt-2 text-xs leading-5 text-red-900">
                                Version 3.27H3B2B2 preserves CRM/List batches containing 100+ recipients. A controlled run processes up to {MAX_CONTROLLED_PROVIDER_RUN_SIZE} server-verified ready recipients sequentially. Each recipient still receives a separate CRM provider operation and a separate one-recipient Mailshake request. The run stops immediately on the first abnormal or uncertain result.
                              </p>

                              <p className="mt-2 text-xs font-black text-red-950">
                                Server-verified ready set:{" "}
                                {providerExecutionReview.providerReview
                                  .readyContactIds?.length ?? 0}{" "}
                                contact(s).
                              </p>

                              <p className="mt-1 text-xs font-bold text-red-950">
                                Next controlled run: up to{" "}
                                {Math.min(
                                  providerExecutionReview.providerReview
                                    .readyContactIds?.length ?? 0,
                                  MAX_CONTROLLED_PROVIDER_RUN_SIZE
                                )}{" "}
                                contact(s). This is not a campaign-size limit.
                              </p>

                              {providerExecutionReview.providerReview
                                .providerWritePolicyAllowed ? (
                                <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-900">
                                  Controlled Preview provider-write policy confirmed. The server still applies the recipient allowlist and all per-recipient safety checks.
                                </div>
                              ) : (
                                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-950">
                                  {providerExecutionReview.providerReview
                                    .providerWritePolicyReason ||
                                    "Mailshake provider writes are disabled by the current server safety policy."}
                                </div>
                              )}

                              <p className="mt-3 text-xs font-bold leading-5 text-red-950">
                                Keep the campaign paused. Mailshake acceptance is asynchronous and does not mean recipients are confirmed yet.
                              </p>

                              <button
                                type="button"
                                onClick={() =>
                                  void submitRecordedEnrollmentToMailshake()
                                }
                                disabled={
                                  isSubmittingProvider ||
                                  providerExecutionReviewFingerprint !==
                                    enrollmentSelectionFingerprint ||
                                  providerExecutionReview.providerReview
                                    .providerWritePolicyAllowed !==
                                    true ||
                                  (providerExecutionReview.providerReview
                                    .readyContactIds?.length ??
                                    0) ===
                                    0 ||
                                  Number(
                                    providerExecutionReview.providerReview
                                      .readyToSubmitCount ??
                                      0
                                  ) !==
                                    (providerExecutionReview.providerReview
                                      .readyContactIds?.length ??
                                      0)
                                }
                                className="mt-4 rounded-xl bg-red-700 px-5 py-3 text-sm font-black text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                {isSubmittingProvider
                                  ? `Submitting controlled run — ${providerBatchSubmissionResults.length} of ${providerBatchPlannedCount} attempted...`
                                  : `Step 4 — Submit Next ${Math.min(
                                      providerExecutionReview.providerReview
                                        .readyContactIds?.length ?? 0,
                                      MAX_CONTROLLED_PROVIDER_RUN_SIZE
                                    )} to PAUSED Mailshake`}
                              </button>

                              {(isSubmittingProvider ||
                                providerBatchSubmissionResults.length >
                                  0) && (
                                <div className="mt-4 rounded-xl border border-red-200 bg-white p-4">
                                  <p className="text-xs font-black uppercase tracking-wide text-red-700">
                                    Controlled Run Progress
                                  </p>

                                  <p className="mt-2 text-sm font-bold text-slate-950">
                                    Attempted:{" "}
                                    {providerBatchSubmissionResults.length}
                                    {" / "}
                                    {providerBatchPlannedCount}
                                    {" · "}
                                    Accepted asynchronously:{" "}
                                    {
                                      providerBatchSubmissionResults.filter(
                                        (item) =>
                                          item.status ===
                                          "submitted"
                                      ).length
                                    }
                                  </p>

                                  {providerBatchSubmissionResults.length >
                                    0 && (
                                    <div className="mt-3 grid gap-2">
                                      {providerBatchSubmissionResults.map(
                                        (item) => (
                                          <div
                                            key={`${item.sequence}-${item.contactId}`}
                                            className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                                          >
                                            <p className="font-bold text-slate-900">
                                              Recipient {item.sequence}:{" "}
                                              {item.status}
                                            </p>

                                            <p className="mt-1 break-all text-slate-600">
                                              CRM contact: {item.contactId}
                                            </p>

                                            {item.operationId && (
                                              <p className="mt-1 break-all text-slate-600">
                                                Provider operation:{" "}
                                                {item.operationId}
                                              </p>
                                            )}

                                            {item.providerCheckStatusId && (
                                              <p className="mt-1 break-all text-slate-600">
                                                Mailshake checkStatusID:{" "}
                                                {item.providerCheckStatusId}
                                              </p>
                                            )}

                                            {(item.error ||
                                              item.message) && (
                                              <p className="mt-1 text-slate-700">
                                                {item.error ||
                                                  item.message}
                                              </p>
                                            )}
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {providerBatchMessage && (
                                <div className="mt-4 rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm font-semibold text-blue-950">
                                  {providerBatchMessage}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
                            MAILSHAKE WRITE is not permitted by the current server safety policy for this state. Controlled provider submission is enabled only on Vercel Preview, only for server-approved allowlisted recipients, and only while Mailshake reports the campaign as paused. A controlled run may process up to 10 ready recipients sequentially, while each provider operation still handles exactly one recipient. Production may review and reconcile existing operations but cannot create a new Mailshake recipient through this control.
                          </div>
                        )}

                        {providerSubmissionError && (
                          <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-950">
                            {providerSubmissionError}
                          </div>
                        )}

                        {providerSubmissionResult && (
                          <div
                            className={`mt-4 rounded-xl border p-4 text-sm ${
                              providerSubmissionResult.status ===
                              "submitted"
                                ? "border-blue-300 bg-blue-50 text-blue-950"
                                : "border-amber-300 bg-amber-50 text-amber-950"
                            }`}
                          >
                            <p className="font-black">
                              {providerSubmissionResult.status ===
                              "submitted"
                                ? "Mailshake accepted the asynchronous request."
                                : "Provider outcome requires reconciliation."}
                            </p>

                            <p className="mt-2 leading-6">
                              {providerSubmissionResult.message}
                            </p>

                            {providerSubmissionResult.operationId && (
                              <p className="mt-3 break-all text-xs">
                                CRM provider operation:{" "}
                                {providerSubmissionResult.operationId}
                              </p>
                            )}

                            {providerSubmissionResult.providerCheckStatusId && (
                              <p className="mt-1 break-all text-xs">
                                Mailshake checkStatusID:{" "}
                                {providerSubmissionResult.providerCheckStatusId}
                              </p>
                            )}

                            {providerSubmissionResult.warning && (
                              <p className="mt-3 font-bold text-amber-900">
                                {providerSubmissionResult.warning}
                              </p>
                            )}

                            <p className="mt-3 text-xs font-black uppercase tracking-wide">
                              Do not unpause this campaign yet.
                            </p>
                          </div>
                        )}

                        {(providerExecutionReview.providerReview.batchIds
                          ?.length ??
                          0) > 0 && (
                          <p className="mt-4 break-all text-xs text-slate-500">
                            CRM enrollment batch
                            {(providerExecutionReview.providerReview.batchIds
                              ?.length ??
                              0) === 1
                              ? ""
                              : "es"}
                            :{" "}
                            {providerExecutionReview.providerReview.batchIds?.join(
                              ", "
                            )}
                          </p>
                        )}
                      </div>
                    )}

                    {providerSubmissionResult?.operationId && (
                    <div className="mt-5 rounded-xl border border-sky-300 bg-sky-50 p-5 text-sm text-sky-950">
                      <p className="text-xs font-black uppercase tracking-wide text-sky-700">
                        Asynchronous Import Reconciliation
                      </p>

                      <h5 className="mt-1 text-lg font-bold">
                        Step 5 — Reconcile the Mailshake Result
                      </h5>

                      <p className="mt-2 max-w-4xl text-xs leading-5">
                        STATUS / CRM SYNC — Step 5 checks the exact existing CRM-tracked Mailshake provider operation and synchronizes its result into CRM. It does not submit or re-add the recipient, unpause the campaign, or send email. If processing is not final, check this same operation again later; do not resubmit. A final reconciliation result is Step 6 — the final CRM outcome.
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          void checkMailshakeImportStatus(
                            providerSubmissionResult?.operationId ||
                              ""
                          )
                        }
                        disabled={
                          isCheckingProviderStatus ||
                          !providerSubmissionResult?.operationId
                        }
                        className="mt-4 rounded-xl bg-sky-700 px-5 py-3 text-sm font-black text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {isCheckingProviderStatus
                          ? "Checking Exact Provider Operation..."
                          : "Check This Provider Operation"}
                      </button>



                      {providerStatusError && (
                        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 font-semibold text-red-950">
                          {providerStatusError}
                        </div>
                      )}

                      {providerStatusResult && (
                        <div
                          className={`mt-5 rounded-xl border-2 p-5 ${
                            providerStatusResult.status ===
                              "confirmed" ||
                            providerStatusResult.status ===
                              "already_present" ||
                            providerStatusResult.enrollmentStatus ===
                              "confirmed" ||
                            providerStatusResult.enrollmentStatus ===
                              "already_present"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                              : providerStatusResult.status ===
                                    "processing" ||
                                  providerStatusResult.status ===
                                    "submitted" ||
                                  providerStatusResult.operationStatus ===
                                    "checking" ||
                                  providerStatusResult.operationStatus ===
                                    "submitted"
                                ? "border-blue-300 bg-blue-50 text-blue-950"
                                : providerStatusResult.status ===
                                      "failed" ||
                                    providerStatusResult.status ===
                                      "reconciliation_required" ||
                                    providerStatusResult.operationStatus ===
                                      "submission_unknown" ||
                                    providerStatusResult.enrollmentStatus ===
                                      "failed"
                                  ? "border-red-300 bg-red-50 text-red-950"
                                  : "border-amber-300 bg-amber-50 text-amber-950"
                          }`}
                        >
                          <p className="text-xs font-black uppercase tracking-wide">
                            Step 6 — Final CRM Outcome
                          </p>

                          <h6 className="mt-1 text-lg font-black">
                            {providerStatusResult.status ===
                              "confirmed" ||
                            providerStatusResult.enrollmentStatus ===
                              "confirmed"
                              ? "Confirmed / Enrolled"
                              : providerStatusResult.status ===
                                    "already_present" ||
                                  providerStatusResult.enrollmentStatus ===
                                    "already_present"
                                ? "Already in Campaign"
                                : providerStatusResult.status ===
                                      "unsubscribed" ||
                                    providerStatusResult.enrollmentStatus ===
                                      "unsubscribed"
                                  ? "Unsubscribed"
                                  : providerStatusResult.status ===
                                        "processing" ||
                                      providerStatusResult.status ===
                                        "submitted" ||
                                      providerStatusResult.operationStatus ===
                                        "checking" ||
                                      providerStatusResult.operationStatus ===
                                        "submitted"
                                    ? "Submitted / Processing — Not Final"
                                    : providerStatusResult.status ===
                                          "reconciliation_required" ||
                                        providerStatusResult.operationStatus ===
                                          "submission_unknown"
                                      ? "Reconciliation Required"
                                      : providerStatusResult.status ===
                                            "failed" ||
                                          providerStatusResult.enrollmentStatus ===
                                            "failed"
                                        ? "Failed"
                                        : "Provider Result Recorded"}
                          </h6>

                          {(providerStatusResult.status ===
                            "confirmed" ||
                            providerStatusResult.enrollmentStatus ===
                              "confirmed") && (
                            <p className="mt-2 font-bold leading-6">
                              FINAL — Mailshake confirms the recipient exists in the intended campaign. No additional provider submission is needed.
                            </p>
                          )}

                          {(providerStatusResult.status ===
                            "already_present" ||
                            providerStatusResult.enrollmentStatus ===
                              "already_present") && (
                            <p className="mt-2 font-bold leading-6">
                              FINAL — the recipient was already in the intended campaign. CRM treats this as successful / no additional action needed.
                            </p>
                          )}

                          {(providerStatusResult.status ===
                            "unsubscribed" ||
                            providerStatusResult.enrollmentStatus ===
                              "unsubscribed") && (
                            <p className="mt-2 font-bold leading-6">
                              FINAL — Mailshake reports this address as unsubscribed. The recipient was not enrolled.
                            </p>
                          )}

                          {(providerStatusResult.status ===
                            "processing" ||
                            providerStatusResult.status ===
                              "submitted" ||
                            providerStatusResult.operationStatus ===
                              "checking" ||
                            providerStatusResult.operationStatus ===
                              "submitted") && (
                            <p className="mt-2 font-bold leading-6">
                              NOT FINAL — Mailshake is still processing this exact provider operation. Reconcile this same operation again later. DO NOT RESUBMIT.
                            </p>
                          )}

                          {(providerStatusResult.status ===
                            "reconciliation_required" ||
                            providerStatusResult.operationStatus ===
                              "submission_unknown") && (
                            <p className="mt-2 font-bold leading-6">
                              STOP AND INVESTIGATE — CRM cannot safely prove the provider outcome. DO NOT automatically retry the original submission.
                            </p>
                          )}

                          {(providerStatusResult.status ===
                            "failed" ||
                            providerStatusResult.enrollmentStatus ===
                              "failed") && (
                            <p className="mt-2 font-bold leading-6">
                              FINAL FAILURE — the provider action did not complete successfully. Review the CRM audit details before deciding on any next action.
                            </p>
                          )}

                          {providerStatusResult.message && (
                            <p className="mt-3 leading-6">
                              {providerStatusResult.message}
                            </p>
                          )}

                          <div className="mt-4 rounded-xl bg-white/70 p-4 text-xs">
                            <p>
                              CRM enrollment status:{" "}
                              <span className="font-black">
                                {providerStatusResult.enrollmentStatus ||
                                  "unknown"}
                              </span>
                            </p>

                            <p className="mt-1">
                              Provider operation status:{" "}
                              <span className="font-black">
                                {providerStatusResult.operationStatus ||
                                  providerStatusResult.status ||
                                  "checked"}
                              </span>
                            </p>

                            {providerStatusResult.operationId && (
                              <p className="mt-1 break-all">
                                CRM provider operation:{" "}
                                {providerStatusResult.operationId}
                              </p>
                            )}

                            {providerStatusResult.providerCheckStatusId && (
                              <p className="mt-1 break-all">
                                Mailshake checkStatusID:{" "}
                                {providerStatusResult.providerCheckStatusId}
                              </p>
                            )}

                            {providerStatusResult.providerRecipientId && (
                              <p className="mt-1 break-all">
                                Mailshake recipient ID:{" "}
                                {providerStatusResult.providerRecipientId}
                              </p>
                            )}
                          </div>

                          <p className="mt-4 text-xs font-black uppercase tracking-wide">
                            Keep this campaign paused until the CRM audit rows are verified.
                          </p>
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  options: FilterOption[];
}) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-600">
        {label}
      </label>

      <select
        value={value}
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm shadow-sm"
      >
        <option value="All">
          All
        </option>

        {options.map(
          (option) => (
            <option
              key={
                option.id
              }
              value={
                option.id
              }
            >
              {option.label}
            </option>
          )
        )}
      </select>
    </div>
  );
}

function StringFilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-600">
        {label}
      </label>

      <select
        value={value}
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm shadow-sm"
      >
        <option value="All">
          All
        </option>

        {options.map(
          (option) => (
            <option
              key={
                option
              }
              value={
                option
              }
            >
              {option}
            </option>
          )
        )}
      </select>
    </div>
  );
}