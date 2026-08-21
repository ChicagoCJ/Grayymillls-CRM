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
    blockedNowCount?: number;
    missingCrmEnrollmentCount?: number;
    emailChangedCount?: number;
    nonRequestedCount?: number;
    batchIds?: string[];
    providerExecutionAllowed?: boolean;
  };
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
    status === "confirmed"
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
    status === "already_present" ||
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
    providerStatusResult,
    setProviderStatusResult,
  ] =
    useState<
      ProviderStatusResponse | null
    >(null);

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

          selectedContactIds:
            [...selectedContactIds].sort(),

          filterSnapshot:
            enrollmentFilterSnapshot,
        }),
      [
        selectedCampaignId,
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

  function selectAllFiltered() {
    setSelectionUsedSelectAll(
      true
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
      selectedContactIds.length !==
        1 ||
      Number(
        providerReview.readyToSubmitCount ??
          0
      ) !==
        1
    ) {
      setProviderSubmissionError(
        "The initial provider rollout permits exactly one ready CRM enrollment per submission."
      );

      return;
    }

    const campaignName =
      providerReview.providerCampaignTitle ||
      selectedCampaign.title ||
      "the selected campaign";

    const confirmed =
      window.confirm(
        `SUBMIT 1 RECORDED CRM ENROLLMENT TO MAILSHAKE?\n\nCampaign: ${campaignName}\n\nThis is a REAL Mailshake provider action. The server will re-check CRM eligibility and confirm that Mailshake still reports the campaign as PAUSED immediately before submission.\n\nIf Mailshake accepts the recipient, CRM will record the enrollment as submitted. It will NOT be treated as confirmed until the asynchronous Mailshake add-status result is checked.\n\nKEEP THE CAMPAIGN PAUSED until that verification is complete.\n\nContinue?`
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

    setProviderStatusResult(
      null
    );

    setProviderStatusError(
      ""
    );

    try {
      const response =
        await fetch(
          "/api/outreach-mailshake/provider-execution",
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
                providerCampaignId:
                  selectedCampaign.providerCampaignId,

                contactId:
                  selectedContactIds[0],

                confirmationPhrase:
                  "SUBMIT_ONE_TO_PAUSED_MAILSHAKE",
              }),

            cache:
              "no-store",
          }
        );

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
        throw new Error(
          `CRM provider submission endpoint returned an unreadable response with HTTP status ${response.status}.`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "The controlled Mailshake submission did not complete."
        );
      }

      setProviderSubmissionResult(
        data
      );

      /*
       * The provider review is stale as soon as a provider
       * operation is attempted. Require a fresh review before
       * any possible later action.
       */
      setProviderExecutionReviewFingerprint(
        ""
      );
    } catch (error) {
      setProviderExecutionReviewFingerprint(
        ""
      );

      setProviderSubmissionError(
        error instanceof Error
          ? error.message
          : "The controlled Mailshake submission did not complete."
      );
    } finally {
      setIsSubmittingProvider(
        false
      );
    }
  }

  async function checkMailshakeImportStatus() {
    if (!selectedCampaign) {
      setProviderStatusError(
        "Choose the Mailshake campaign first."
      );

      return;
    }

    if (
      selectedContactIds.length !==
      1
    ) {
      setProviderStatusError(
        "Select exactly one recorded CRM enrollment to check its Mailshake import status."
      );

      return;
    }

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
                providerCampaignId:
                  selectedCampaign.providerCampaignId,

                contactId:
                  selectedContactIds[0],
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

      setProviderSubmissionResult(
        null
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
              Version 3.27E-13A - Provider Operations History
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
              Controlled Mailshake submission enabled
            </p>

            <p className="mt-1 text-xs leading-5">
              The CRM can now submit exactly one recorded enrollment to Mailshake only after fresh CRM revalidation and two fresh checks confirming the Mailshake campaign is paused. Provider acceptance remains asynchronous and is not yet confirmation.
            </p>
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
              Provider Operations History
            </h3>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Review recent Mailshake provider operations recorded by CRM. This reads CRM audit records only and does not submit recipients, change Mailshake campaigns, or send email.
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

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-black ring-1 ${providerHistoryStatusClasses(
                          operation.status
                        )}`}
                      >
                        {operation.status ||
                          "unknown"}
                      </span>
                    </div>

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
                      ) =>
                        setProjectFilter(
                          event.target.value
                        )
                      }
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
                  Select All Filtered adds every eligible contact matching the current filters. Existing selections remain selected when you change filters, so you can review or add another filtered group. Clear Selection removes the entire selection.
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
                      Current CRM Selection
                    </p>

                    <p className="mt-1 text-2xl font-black text-violet-950">
                      {selectedContactIds.length}
                    </p>

                    <p className="mt-1 text-xs text-violet-800">
                      {selectionUsedSelectAll
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
                      : "Review Selection on Server"}
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
                      Server-Validated Enrollment Review
                    </h5>

                    {enrollmentReviewFingerprint !==
                      enrollmentSelectionFingerprint && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                        The selection or filters changed after this review. Run Review Selection on Server again before recording.
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
                            : `Record ${Number(
                                enrollmentReview.newEnrollmentCount ??
                                  0
                              )} in CRM — Not Mailshake`}
                      </button>

                      <p className="mt-3 text-xs font-semibold leading-5 text-violet-900">
                        This button creates CRM enrollment records only. There is still no API call here that adds recipients to Mailshake.
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
                      Re-check CRM and Mailshake before any future submission
                    </h5>

                    <p className="mt-2 max-w-4xl text-xs leading-5 text-rose-900">
                      This performs a fresh server-side CRM eligibility check and reads the current campaign directly from Mailshake. It does not add recipients to Mailshake, change enrollment status, or send email.
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

                    <div className="mt-5 rounded-xl border border-sky-300 bg-sky-50 p-5 text-sm text-sky-950">
                      <p className="text-xs font-black uppercase tracking-wide text-sky-700">
                        Asynchronous Import Reconciliation
                      </p>

                      <h5 className="mt-1 text-lg font-bold">
                        Check Mailshake import status
                      </h5>

                      <p className="mt-2 max-w-4xl text-xs leading-5">
                        This checks the existing Mailshake asynchronous import for the selected CRM enrollment. It does not add or re-add the recipient, unpause the campaign, or send email.
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          void checkMailshakeImportStatus()
                        }
                        disabled={
                          isCheckingProviderStatus ||
                          selectedContactIds.length !==
                            1 ||
                          !selectedCampaign
                        }
                        className="mt-4 rounded-xl bg-sky-700 px-5 py-3 text-sm font-black text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {isCheckingProviderStatus
                          ? "Checking Mailshake Import..."
                          : "Check Mailshake Import Status"}
                      </button>

                      {selectedContactIds.length !==
                        1 && (
                        <p className="mt-3 text-xs font-semibold text-sky-900">
                          Select exactly one recorded CRM enrollment before checking its provider status.
                        </p>
                      )}

                      {providerStatusError && (
                        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 font-semibold text-red-950">
                          {providerStatusError}
                        </div>
                      )}

                      {providerStatusResult && (
                        <div
                          className={`mt-4 rounded-xl border p-4 ${
                            providerStatusResult.status ===
                              "confirmed" ||
                            providerStatusResult.enrollmentStatus ===
                              "confirmed"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                              : providerStatusResult.status ===
                                  "processing" ||
                                providerStatusResult.operationStatus ===
                                  "checking"
                                ? "border-blue-300 bg-blue-50 text-blue-950"
                                : providerStatusResult.status ===
                                      "failed" ||
                                    providerStatusResult.status ===
                                      "reconciliation_required" ||
                                    providerStatusResult.enrollmentStatus ===
                                      "failed"
                                  ? "border-red-300 bg-red-50 text-red-950"
                                  : "border-amber-300 bg-amber-50 text-amber-950"
                          }`}
                        >
                          <p className="font-black">
                            {providerStatusResult.status ===
                              "confirmed" ||
                            providerStatusResult.enrollmentStatus ===
                              "confirmed"
                              ? "Recipient confirmed in Mailshake."
                              : providerStatusResult.status ===
                                  "processing"
                                ? "Mailshake import is still processing."
                                : providerStatusResult.status ===
                                    "already_present" ||
                                  providerStatusResult.enrollmentStatus ===
                                    "already_present"
                                  ? "Recipient was already present in Mailshake."
                                  : providerStatusResult.status ===
                                      "unsubscribed" ||
                                    providerStatusResult.enrollmentStatus ===
                                      "unsubscribed"
                                    ? "Mailshake reports this recipient as unsubscribed."
                                    : providerStatusResult.status ===
                                        "failed" ||
                                      providerStatusResult.enrollmentStatus ===
                                        "failed"
                                      ? "Mailshake import failed."
                                      : providerStatusResult.status ===
                                          "reconciliation_required"
                                        ? "Manual reconciliation is required."
                                        : "Mailshake reconciliation result."}
                          </p>

                          <p className="mt-2 leading-6">
                            {providerStatusResult.message}
                          </p>

                          <p className="mt-3 text-xs">
                            CRM enrollment status:{" "}
                            <span className="font-black">
                              {providerStatusResult.enrollmentStatus ||
                                "unknown"}
                            </span>
                          </p>

                          <p className="mt-1 text-xs">
                            Provider operation status:{" "}
                            <span className="font-black">
                              {providerStatusResult.operationStatus ||
                                providerStatusResult.status ||
                                "checked"}
                            </span>
                          </p>

                          {providerStatusResult.operationId && (
                            <p className="mt-1 break-all text-xs">
                              CRM provider operation:{" "}
                              {providerStatusResult.operationId}
                            </p>
                          )}

                          {providerStatusResult.providerCheckStatusId && (
                            <p className="mt-1 break-all text-xs">
                              Mailshake checkStatusID:{" "}
                              {providerStatusResult.providerCheckStatusId}
                            </p>
                          )}

                          {providerStatusResult.providerRecipientId && (
                            <p className="mt-1 break-all text-xs">
                              Mailshake recipient ID:{" "}
                              {providerStatusResult.providerRecipientId}
                            </p>
                          )}

                          <p className="mt-3 text-xs font-black uppercase tracking-wide">
                            Keep this campaign paused until the CRM audit rows are verified.
                          </p>
                        </div>
                      )}
                    </div>

                    {providerExecutionReview?.providerReview && (
                      <div className="mt-5 rounded-xl border border-rose-200 bg-white p-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase text-slate-500">
                              Fresh Mailshake Campaign
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
                          </div>

                          <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                            <p className="text-xs font-bold uppercase text-emerald-700">
                              Ready / Requested
                            </p>
                            <p className="mt-1 text-xl font-black text-emerald-950">
                              {providerExecutionReview.providerReview
                                .readyToSubmitCount ?? 0}
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
                          </div>

                          <div className="rounded-xl bg-orange-50 p-3 ring-1 ring-orange-200">
                            <p className="text-xs font-bold uppercase text-orange-700">
                              Email Changed
                            </p>
                            <p className="mt-1 text-xl font-black text-orange-950">
                              {providerExecutionReview.providerReview
                                .emailChangedCount ?? 0}
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

                        {providerExecutionReview.providerReview
                          .providerExecutionAllowed ? (
                          <div className="mt-4 grid gap-4">
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                              Initial safety policy passed: Mailshake currently reports this campaign as paused and at least one recorded enrollment remains in requested status.
                            </div>

                            <div className="rounded-xl border-2 border-red-300 bg-red-50 p-5">
                              <p className="text-xs font-black uppercase tracking-wide text-red-700">
                                Real Mailshake Action
                              </p>

                              <h6 className="mt-1 font-bold text-red-950">
                                Submit one recorded enrollment to the paused campaign
                              </h6>

                              <p className="mt-2 text-xs leading-5 text-red-900">
                                The initial rollout is limited to exactly one recipient. The server will revalidate CRM eligibility, check whether the recipient already exists in Mailshake, and check the campaign twice. The final provider check must still report Paused.
                              </p>

                              <p className="mt-2 text-xs font-bold leading-5 text-red-950">
                                If Mailshake accepts the request, keep the campaign paused. Acceptance is asynchronous and does not mean the recipient is confirmed yet.
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
                                  providerSubmissionResult !==
                                    null ||
                                  selectedContactIds.length !==
                                    1 ||
                                  Number(
                                    providerExecutionReview.providerReview
                                      ?.readyToSubmitCount ??
                                      0
                                  ) !==
                                    1
                                }
                                className="mt-4 rounded-xl bg-red-700 px-5 py-3 text-sm font-black text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                {isSubmittingProvider
                                  ? "Submitting 1 to Mailshake..."
                                  : "Submit 1 to PAUSED Mailshake Campaign"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
                            Initial safety policy does not currently permit provider submission. Mailshake must report this campaign as paused.
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