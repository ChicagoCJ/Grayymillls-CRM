import {
  timingSafeEqual,
} from "node:crypto";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  NextResponse,
} from "next/server";

import {
  verifySignedInCrmUser,
} from "../../_shared/verified-auth";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const MAILSHAKE_API_HOST =
  "api.mailshake.com";

const MAILSHAKE_API_PREFIX =
  "/2017-04-01/";

type PushSubscription =
  | "message-sent"
  | "replied";

type MailshakePushBody = {
  resource_url?: unknown;
};

type MailshakeRecipient = {
  id?: unknown;
  emailAddress?: unknown;
  fullName?: unknown;
  first?: unknown;
  last?: unknown;
  created?: unknown;
};

type MailshakeCampaign = {
  id?: unknown;
  title?: unknown;
  created?: unknown;
};

type MailshakeMessage = {
  id?: unknown;
  type?: unknown;
  subject?: unknown;
};

type MailshakeSentMessage = {
  object?: unknown;
  id?: unknown;
  actionDate?: unknown;

  recipient?: MailshakeRecipient | null;
  campaign?: MailshakeCampaign | null;
  message?: MailshakeMessage | null;

  type?: unknown;
  subject?: unknown;

  externalID?: unknown;
  externalRawMessageID?: unknown;
};

type MailshakeReply = {
  object?: unknown;
  id?: unknown;
  actionDate?: unknown;

  recipient?: MailshakeRecipient | null;
  campaign?: MailshakeCampaign | null;

  type?: unknown;

  parent?: {
    id?: unknown;
    type?: unknown;
    message?: MailshakeMessage | null;
  } | null;

  subject?: unknown;

  externalID?: unknown;
  externalRawMessageID?: unknown;
};

type NormalizedOutreachEvent = {
  eventType:
    | "message_sent"
    | "replied";

  providerEventKey: string;
  providerMessageId: string | null;

  providerCampaignId: string;
  campaignName: string | null;
  campaignCreatedAt: string | null;

  providerRecipientId: string | null;
  recipientEmail: string;
  recipientFirstName: string | null;
  recipientLastName: string | null;

  occurredAt: string;
  subject: string | null;
};

function cleanText(
  value: unknown
) {
  return typeof value === "string" ||
    typeof value === "number"
    ? String(value).trim()
    : "";
}

function optionalText(
  value: unknown
) {
  const cleaned =
    cleanText(value);

  return cleaned || null;
}

function requiredText(
  value: unknown,
  label: string
) {
  const cleaned =
    cleanText(value);

  if (!cleaned) {
    throw new Error(
      `${label} is required.`
    );
  }

  return cleaned;
}

function normalizedEmail(
  value: unknown
) {
  const email =
    requiredText(
      value,
      "Mailshake recipient email"
    ).toLowerCase();

  if (
    !email.includes("@")
  ) {
    throw new Error(
      "Mailshake recipient email is not valid."
    );
  }

  return email;
}

function normalizedDate(
  value: unknown,
  label: string
) {
  const raw =
    requiredText(
      value,
      label
    );

  const date =
    new Date(raw);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      `${label} is not a valid date.`
    );
  }

  return date.toISOString();
}

function optionalDate(
  value: unknown
) {
  const raw =
    cleanText(value);

  if (!raw) {
    return null;
  }

  const date =
    new Date(raw);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
}

function getRequiredEnvironmentVariable(
  name: string
) {
  const value =
    cleanText(
      process.env[name]
    );

  if (!value) {
    throw new Error(
      `${name} is not configured on the CRM server.`
    );
  }

  return value;
}

function getSupabaseAdmin() {
  const supabaseUrl =
    getRequiredEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_URL"
    );

  const serviceRoleKey =
    getRequiredEnvironmentVariable(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function mailshakeAuthorizationHeader() {
  const apiKey =
    getRequiredEnvironmentVariable(
      "MAILSHAKE_API_KEY"
    );

  const token =
    Buffer.from(
      `${apiKey}:`,
      "utf8"
    ).toString(
      "base64"
    );

  return `Basic ${token}`;
}

function safeSecretMatches(
  suppliedSecret: string,
  expectedSecret: string
) {
  const supplied =
    Buffer.from(
      suppliedSecret,
      "utf8"
    );

  const expected =
    Buffer.from(
      expectedSecret,
      "utf8"
    );

  if (
    supplied.length !==
    expected.length
  ) {
    return false;
  }

  return timingSafeEqual(
    supplied,
    expected
  );
}

function validSubscription(
  value: string
): value is PushSubscription {
  return (
    value === "message-sent" ||
    value === "replied"
  );
}

function validateMailshakeResourceUrl(
  rawUrl: string
) {
  let url: URL;

  try {
    url =
      new URL(
        rawUrl
      );
  } catch {
    throw new Error(
      "Mailshake push resource_url is not a valid URL."
    );
  }

  if (
    url.protocol !== "https:"
  ) {
    throw new Error(
      "Mailshake push resource_url must use HTTPS."
    );
  }

  if (
    url.hostname.toLowerCase() !==
    MAILSHAKE_API_HOST
  ) {
    throw new Error(
      "Mailshake push resource_url must use api.mailshake.com."
    );
  }

  if (
    !url.pathname.startsWith(
      MAILSHAKE_API_PREFIX
    )
  ) {
    throw new Error(
      "Mailshake push resource_url is outside the supported API path."
    );
  }

  if (
    url.username ||
    url.password
  ) {
    throw new Error(
      "Mailshake push resource_url must not contain embedded credentials."
    );
  }

  /*
   * Do not allow a resource_url to redirect our authenticated
   * request to some other host.
   */
  return url;
}

async function fetchMailshakeResource(
  resourceUrl: URL
) {
  const response =
    await fetch(
      resourceUrl.toString(),
      {
        method: "POST",

        headers: {
          Authorization:
            mailshakeAuthorizationHeader(),

          Accept:
            "application/json",

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({}),

        cache:
          "no-store",

        redirect:
          "manual",
      }
    );

  if (
    response.status >= 300 &&
    response.status < 400
  ) {
    throw new Error(
      "Mailshake resource request attempted an unexpected redirect."
    );
  }

  const rawText =
    await response.text();

  let data:
    Record<string, unknown>;

  try {
    data =
      rawText
        ? JSON.parse(
            rawText
          )
        : {};
  } catch {
    throw new Error(
      `Mailshake resource response was unreadable. HTTP ${response.status}.`
    );
  }

  if (!response.ok) {
    const providerMessage =
      cleanText(
        data.message
      ) ||
      cleanText(
        data.error
      );

    throw new Error(
      providerMessage
        ? `Mailshake resource error: ${providerMessage}`
        : `Mailshake resource request failed with HTTP ${response.status}.`
    );
  }


  /*
   * Mailshake push resource URLs may resolve either to
   * a direct resource model or to a paginated response.
   *
   * For a push notification we require exactly one model.
   * Never guess which result belongs to the push.
   */
  if (
    typeof data.object === "string" &&
    data.object.trim()
  ) {
    return data;
  }

  const results =
    data.results;

  if (
    !Array.isArray(results)
  ) {
    throw new Error(
      "Mailshake resource response did not contain a direct resource or results array."
    );
  }

  if (
    results.length !== 1
  ) {
    throw new Error(
      `Mailshake paginated resource response must contain exactly one result; received ${results.length}.`
    );
  }

  const resource =
    results[0];

  if (
    resource === null ||
    typeof resource !== "object" ||
    Array.isArray(resource)
  ) {
    throw new Error(
      "Mailshake paginated resource result must be an object."
    );
  }

  return resource as Record<string, unknown>;
}

function normalizeSentMessage(
  resource:
    MailshakeSentMessage
): NormalizedOutreachEvent {
  const objectType =
    requiredText(
      resource.object,
      "Mailshake resource object"
    );

  if (
    objectType !==
    "sent-message"
  ) {
    throw new Error(
      `Expected Mailshake sent-message resource but received ${objectType}.`
    );
  }

  const eventId =
    requiredText(
      resource.id,
      "Mailshake sent-message id"
    );

  const campaignId =
    requiredText(
      resource.campaign?.id,
      "Mailshake campaign id"
    );

  return {
    eventType:
      "message_sent",

    providerEventKey:
      `sent-message:${eventId}`,

    providerMessageId:
      eventId,

    providerCampaignId:
      campaignId,

    campaignName:
      optionalText(
        resource.campaign?.title
      ),

    campaignCreatedAt:
      optionalDate(
        resource.campaign?.created
      ),

    providerRecipientId:
      optionalText(
        resource.recipient?.id
      ),

    recipientEmail:
      normalizedEmail(
        resource.recipient
          ?.emailAddress
      ),

    recipientFirstName:
      optionalText(
        resource.recipient?.first
      ),

    recipientLastName:
      optionalText(
        resource.recipient?.last
      ),

    occurredAt:
      normalizedDate(
        resource.actionDate,
        "Mailshake sent-message actionDate"
      ),

    subject:
      optionalText(
        resource.subject
      ) ||
      optionalText(
        resource.message?.subject
      ),
  };
}

function normalizeReply(
  resource:
    MailshakeReply
): {
  ignored: boolean;
  ignoredReplyType: string | null;
  event: NormalizedOutreachEvent | null;
} {
  const objectType =
    requiredText(
      resource.object,
      "Mailshake resource object"
    );

  if (
    objectType !==
    "reply"
  ) {
    throw new Error(
      `Expected Mailshake reply resource but received ${objectType}.`
    );
  }

  const replyType =
    requiredText(
      resource.type,
      "Mailshake reply type"
    );

  /*
   * Version 3.27 initially treats only a true human-style
   * Mailshake "reply" as a CRM sales response.
   *
   * Bounce, out-of-office, unsubscribe, and delay-notification
   * are intentionally acknowledged but not inserted as replied.
   */
  if (
    replyType !==
    "reply"
  ) {
    return {
      ignored: true,
      ignoredReplyType:
        replyType,
      event: null,
    };
  }

  const eventId =
    requiredText(
      resource.id,
      "Mailshake reply id"
    );

  const campaignId =
    requiredText(
      resource.campaign?.id,
      "Mailshake campaign id"
    );

  return {
    ignored: false,
    ignoredReplyType: null,

    event: {
      eventType:
        "replied",

      providerEventKey:
        `reply:${eventId}`,

      providerMessageId:
        optionalText(
          resource.parent?.id
        ),

      providerCampaignId:
        campaignId,

      campaignName:
        optionalText(
          resource.campaign?.title
        ),

      campaignCreatedAt:
        optionalDate(
          resource.campaign?.created
        ),

      providerRecipientId:
        optionalText(
          resource.recipient?.id
        ),

      recipientEmail:
        normalizedEmail(
          resource.recipient
            ?.emailAddress
        ),

      recipientFirstName:
        optionalText(
          resource.recipient?.first
        ),

      recipientLastName:
        optionalText(
          resource.recipient?.last
        ),

      occurredAt:
        normalizedDate(
          resource.actionDate,
          "Mailshake reply actionDate"
        ),

      subject:
        optionalText(
          resource.subject
        ) ||
        optionalText(
          resource.parent
            ?.message?.subject
        ),
    },
  };
}

async function ingestNormalizedEvent(
  event:
    NormalizedOutreachEvent
) {
  const supabase =
    getSupabaseAdmin();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "ingest_mailshake_outreach_event",
      {
        p_event_type:
          event.eventType,

        p_provider_event_key:
          event.providerEventKey,

        p_provider_message_id:
          event.providerMessageId,

        p_provider_campaign_id:
          event.providerCampaignId,

        p_campaign_name:
          event.campaignName,

        p_campaign_created_at:
          event.campaignCreatedAt,

        p_provider_recipient_id:
          event.providerRecipientId,

        p_recipient_email:
          event.recipientEmail,

        p_recipient_first_name:
          event.recipientFirstName,

        p_recipient_last_name:
          event.recipientLastName,

        p_occurred_at:
          event.occurredAt,

        p_subject:
          event.subject,
      }
    );

  if (error) {
    throw new Error(
      `CRM outreach ingestion failed: ${error.message}`
    );
  }

  return data;
}

/*
 * Signed-in Admin / Sales Manager diagnostic.
 * This does not expose webhook secrets.
 */
export async function GET(
  request: Request
) {
  const verification =
    await verifySignedInCrmUser(
      request
    );

  if (verification.response) {
    return verification.response;
  }

  const role =
    cleanText(
      verification.context.crmRole
    ).toLowerCase();

  if (
    role !== "admin" &&
    role !== "sales_manager"
  ) {
    return NextResponse.json(
      {
        error:
          "Mailshake webhook diagnostics are restricted to Admin and Sales Manager users.",
      },
      {
        status: 403,
      }
    );
  }

  const configured =
    Boolean(
      cleanText(
        process.env
          .MAILSHAKE_API_KEY
      )
    ) &&
    Boolean(
      cleanText(
        process.env
          .MAILSHAKE_WEBHOOK_SECRET
      )
    ) &&
    Boolean(
      cleanText(
        process.env
          .SUPABASE_SERVICE_ROLE_KEY
      )
    );

  return NextResponse.json({
    status:
      configured
        ? "receiver_ready"
        : "configuration_incomplete",

    provider:
      "mailshake",

    ingestionEnabled:
      true,

    configurationComplete:
      configured,

    supportedSubscriptions: [
      "message-sent",
      "replied",
    ],

    message:
      configured
        ? "Mailshake push receiver is ready to ingest MessageSent and normal Reply events."
        : "Mailshake push receiver exists, but one or more server-side environment variables are missing.",
  });
}

export async function POST(
  request: Request
) {
  try {
    const expectedSecret =
      getRequiredEnvironmentVariable(
        "MAILSHAKE_WEBHOOK_SECRET"
      );

    const requestUrl =
      new URL(
        request.url
      );

    const suppliedSecret =
      cleanText(
        requestUrl
          .searchParams
          .get(
            "secret"
          )
      );

    if (
      !suppliedSecret ||
      !safeSecretMatches(
        suppliedSecret,
        expectedSecret
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Mailshake webhook authentication failed.",
        },
        {
          status: 401,
        }
      );
    }

    const subscription =
      cleanText(
        requestUrl
          .searchParams
          .get(
            "subscription"
          )
      );

    if (
      !validSubscription(
        subscription
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Unknown Mailshake webhook subscription.",
        },
        {
          status: 400,
        }
      );
    }

    const contentType =
      cleanText(
        request.headers.get(
          "content-type"
        )
      ).toLowerCase();

    if (
      !contentType.includes(
        "application/json"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Mailshake webhook requires application/json.",
        },
        {
          status: 415,
        }
      );
    }

    let pushBody:
      MailshakePushBody;

    try {
      pushBody =
        (await request.json()) as
          MailshakePushBody;
    } catch {
      return NextResponse.json(
        {
          error:
            "Mailshake webhook body is not valid JSON.",
        },
        {
          status: 400,
        }
      );
    }

    const resourceUrl =
      validateMailshakeResourceUrl(
        requiredText(
          pushBody.resource_url,
          "Mailshake resource_url"
        )
      );

    const resource =
      await fetchMailshakeResource(
        resourceUrl
      );

    if (
      subscription ===
      "message-sent"
    ) {
      const event =
        normalizeSentMessage(
          resource as
            MailshakeSentMessage
        );

      const ingestion =
        await ingestNormalizedEvent(
          event
        );

      console.info(
        "[mailshake-push] MessageSent processed.",
        {
          providerEventKey:
            event.providerEventKey,

          campaignId:
            event.providerCampaignId,

          recipientEmail:
            event.recipientEmail,

          ingestionStatus:
            cleanText(
              (
                ingestion as
                  Record<
                    string,
                    unknown
                  >
              )?.status
            ),
        }
      );

      return NextResponse.json({
        status:
          "processed",

        subscription,

        eventType:
          event.eventType,

        ingestion,
      });
    }

    const reply =
      normalizeReply(
        resource as
          MailshakeReply
      );

    if (
      reply.ignored ||
      !reply.event
    ) {
      console.info(
        "[mailshake-push] Non-sales reply safely ignored.",
        {
          replyType:
            reply.ignoredReplyType,
        }
      );

      /*
       * This event was intentionally handled according
       * to our Version 3.27 rules, so acknowledge it.
       */
      return NextResponse.json({
        status:
          "ignored",

        subscription,

        reason:
          "non_sales_reply_type",

        replyType:
          reply.ignoredReplyType,

        message:
          "Mailshake reply resource was handled but is not counted as a CRM sales reply.",
      });
    }

    const ingestion =
      await ingestNormalizedEvent(
        reply.event
      );

    console.info(
      "[mailshake-push] Reply processed.",
      {
        providerEventKey:
          reply.event
            .providerEventKey,

        campaignId:
          reply.event
            .providerCampaignId,

        recipientEmail:
          reply.event
            .recipientEmail,

        ingestionStatus:
          cleanText(
            (
              ingestion as
                Record<
                  string,
                  unknown
                >
            )?.status
          ),
      }
    );

    return NextResponse.json({
      status:
        "processed",

      subscription,

      eventType:
        reply.event
          .eventType,

      ingestion,
    });
  } catch (error) {
    console.error(
      "[mailshake-push]",
      error
    );

    /*
     * Do not return 200 when retrieval or persistence failed.
     * Mailshake documents retries for non-200 responses.
     */
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mailshake webhook event could not be processed.",
      },
      {
        status: 503,
      }
    );
  }
}
