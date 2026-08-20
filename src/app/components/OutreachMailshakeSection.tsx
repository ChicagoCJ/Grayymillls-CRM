"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  getBrowserSupabaseClient,
  hasBrowserSupabaseConfig,
} from "../../lib/supabase-browser";

const SESSION_CACHE_KEY =
  "graymills-mailshake-campaigns-v3.27";

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

async function getBearerHeaders() {
  if (!hasBrowserSupabaseConfig()) {
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
              Verify the CRM-to-Mailshake connection and review campaign identities before recipient and reply synchronization is enabled.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-bold">
              Read-only connection
            </p>

            <p className="mt-1 text-xs leading-5">
              This screen does not send email, modify Mailshake campaigns, or write outreach events to CRM.
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
    </section>
  );
}