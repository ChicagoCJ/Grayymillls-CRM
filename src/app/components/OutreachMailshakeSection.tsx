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
    label: "Active",
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

      setSelectedContactIds(
        []
      );

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
      setSelectedContactIds([]);
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
              Version 3.27 - Outreach Integration Foundation
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
              Enrollment is still review-only
            </p>

            <p className="mt-1 text-xs leading-5">
              Sent and reply event synchronization is active. The contact selection tools below do not add recipients to Mailshake and cannot send email.
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

              <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                <p className="font-bold">
                  Review-only checkpoint
                </p>

                <p className="mt-1 text-xs leading-5">
                  {selectedContactIds.length} CRM contact
                  {selectedContactIds.length ===
                  1
                    ? ""
                    : "s"}{" "}
                  selected. There is intentionally no Add to Mailshake button in this revision.
                </p>
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