import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../_shared/verified-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAILSHAKE_API_BASE =
  "https://api.mailshake.com/2017-04-01";

const MAILSHAKE_CAMPAIGNS_PER_PAGE = 100;
const MAX_CAMPAIGN_PAGES = 5;

type MailshakeCampaign = {
  object?: string;
  id?: number | string;
  title?: string;
  created?: string;
  isArchived?: boolean;
  isPaused?: boolean;
  sender?: {
    id?: string | number;
    emailAddress?: string;
    fromName?: string;
  } | null;
};

type MailshakeCampaignListResponse = {
  nextToken?: string | null;
  results?: MailshakeCampaign[];
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function getMailshakeApiKey() {
  const apiKey = cleanText(
    process.env.MAILSHAKE_API_KEY
  );

  if (!apiKey) {
    throw new Error(
      "MAILSHAKE_API_KEY is not configured on the CRM server."
    );
  }

  return apiKey;
}

function mailshakeAuthorizationHeader() {
  const apiKey = getMailshakeApiKey();

  const token = Buffer.from(
    `${apiKey}:`,
    "utf8"
  ).toString("base64");

  return `Basic ${token}`;
}

async function verifyIntegrationAccess(
  request: Request
) {
  const verification =
    await verifySignedInCrmUser(request);

  if (verification.response) {
    return {
      response: verification.response,
    };
  }

  const role = cleanText(
    verification.context.crmRole
  ).toLowerCase();

  if (
    role !== "admin" &&
    role !== "sales_manager"
  ) {
    return {
      response: NextResponse.json(
        {
          error:
            "Mailshake integration is restricted to CRM Admin and Sales Manager users.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    response: null,
  };
}

async function readCampaignPage(
  nextToken: string | null
) {
  const body = new URLSearchParams();

  body.set(
    "perPage",
    String(MAILSHAKE_CAMPAIGNS_PER_PAGE)
  );

  if (nextToken) {
    body.set(
      "nextToken",
      nextToken
    );
  }

  const response = await fetch(
    `${MAILSHAKE_API_BASE}/campaigns/list`,
    {
      method: "POST",

      headers: {
        Authorization:
          mailshakeAuthorizationHeader(),

        Accept:
          "application/json",

        "Content-Type":
          "application/x-www-form-urlencoded",
      },

      body: body.toString(),

      cache: "no-store",
    }
  );

  const rawText =
    await response.text();

  let data:
    MailshakeCampaignListResponse &
    Record<string, unknown>;

  try {
    data = rawText
      ? JSON.parse(rawText)
      : {};
  } catch {
    throw new Error(
      `Mailshake returned an unreadable response with HTTP status ${response.status}.`
    );
  }

  if (!response.ok) {
    const providerMessage =
      cleanText(data.message) ||
      cleanText(data.error);

    throw new Error(
      providerMessage
        ? `Mailshake API error: ${providerMessage}`
        : `Mailshake API request failed with HTTP status ${response.status}.`
    );
  }

  return data;
}

function campaignKey(
  campaign: MailshakeCampaign,
  pageNumber: number,
  index: number
) {
  const id =
    cleanText(campaign.id);

  if (id) {
    return `id:${id}`;
  }

  return [
    "fallback",
    cleanText(campaign.title),
    cleanText(campaign.created),
    String(pageNumber),
    String(index),
  ].join(":");
}

async function readAllMailshakeCampaigns() {
  const campaigns =
    new Map<string, MailshakeCampaign>();

  const seenTokens =
    new Set<string>();

  let nextToken:
    string | null = null;

  let pagesRead = 0;

  let paginationComplete =
    false;

  let paginationNote:
    string | null = null;

  while (
    pagesRead <
    MAX_CAMPAIGN_PAGES
  ) {
    const pageNumber =
      pagesRead + 1;

    const data =
      await readCampaignPage(
        nextToken
      );

    pagesRead += 1;

    const pageCampaigns =
      Array.isArray(data.results)
        ? data.results
        : [];

    const countBefore =
      campaigns.size;

    pageCampaigns.forEach(
      (campaign, index) => {
        campaigns.set(
          campaignKey(
            campaign,
            pageNumber,
            index
          ),
          campaign
        );
      }
    );

    const newUniqueCount =
      campaigns.size -
      countBefore;

    const returnedToken =
      cleanText(
        data.nextToken
      ) || null;

    if (!returnedToken) {
      paginationComplete = true;
      break;
    }

    /*
     * Defensive stop:
     * Mailshake supplied another token, but this page
     * produced no new campaigns.
     *
     * Do not claim that more campaigns exist.
     */
    if (
      pagesRead > 1 &&
      newUniqueCount === 0
    ) {
      paginationNote =
        "Mailshake supplied another pagination token, but the next page contained no additional unique campaigns. The CRM stopped safely instead of claiming that more campaigns exist.";

      break;
    }

    if (
      seenTokens.has(
        returnedToken
      )
    ) {
      paginationNote =
        "Mailshake repeated a pagination token. The CRM stopped safely to prevent duplicate requests.";

      break;
    }

    seenTokens.add(
      returnedToken
    );

    nextToken =
      returnedToken;
  }

  if (
    !paginationComplete &&
    !paginationNote &&
    pagesRead >=
      MAX_CAMPAIGN_PAGES
  ) {
    paginationNote =
      `The CRM reached its safety limit of ${MAX_CAMPAIGN_PAGES} Mailshake campaign pages.`;
  }

  return {
    campaigns:
      Array.from(
        campaigns.values()
      ),

    pagesRead,

    paginationComplete,

    paginationNote,
  };
}

export async function GET(
  request: Request
) {
  const access =
    await verifyIntegrationAccess(
      request
    );

  if (access.response) {
    return access.response;
  }

  try {
    const result =
      await readAllMailshakeCampaigns();

    const campaigns =
      result.campaigns.map(
        (campaign) => ({
          providerCampaignId:
            cleanText(
              campaign.id
            ),

          title:
            cleanText(
              campaign.title
            ) ||
            "Untitled campaign",

          createdAt:
            cleanText(
              campaign.created
            ) ||
            null,

          isArchived:
            campaign.isArchived ===
            true,

          isPaused:
            campaign.isPaused ===
            true,

          sender: {
            id:
              cleanText(
                campaign.sender?.id
              ) ||
              null,

            emailAddress:
              cleanText(
                campaign.sender
                  ?.emailAddress
              ) ||
              null,

            fromName:
              cleanText(
                campaign.sender
                  ?.fromName
              ) ||
              null,
          },
        })
      );

    const campaignWord =
      campaigns.length === 1
        ? "campaign"
        : "campaigns";

    const pageWord =
      result.pagesRead === 1
        ? "API page"
        : "API pages";

    return NextResponse.json({
      status: "connected",

      provider: "mailshake",

      campaignCount:
        campaigns.length,

      pagesRead:
        result.pagesRead,

      paginationComplete:
        result.paginationComplete,

      paginationNote:
        result.paginationNote,

      campaigns,

      message:
        `Mailshake connection succeeded. Loaded ${campaigns.length} unique ${campaignWord} from ${result.pagesRead} ${pageWord}. No CRM or Mailshake records were changed.`,
    });
  } catch (error) {
    console.error(
      "[mailshake-campaign-reader]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not read Mailshake campaigns.",
      },
      {
        status: 500,
      }
    );
  }
}