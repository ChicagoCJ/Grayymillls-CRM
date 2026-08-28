import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { verifySignedInCrmUser } from "../../_shared/verified-auth";
import { getMailshakeProviderWritePolicy } from "../_shared/provider-write-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAILSHAKE_API_BASE =
  "https://api.mailshake.com/2017-04-01";

const PAGE_SIZE = 500;
const MAX_PAGES = 50;

/*
 * Initial rollout safety policy.
 *
 * Do not increase this until the complete asynchronous
 * Mailshake round trip has been proven.
 */
const MAX_RECIPIENTS_PER_OPERATION = 1;


const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProviderExecutionPayload = {
  action?: string;
  providerCampaignId?: string;
  contactId?: string;
  authorizationItemId?: string;
  confirmationPhrase?: string;
};

type ContactRow = {
  id?: string;
  company_id?: string;
  email?: string | null;
};

type EnrollmentRow = {
  id?: string;
  batch_id?: string;
  outreach_campaign_id?: string;
  provider_campaign_id?: string;
  contact_id?: string;
  company_id?: string;
  normalized_email?: string;
  status?: string;
  provider_recipient_id?: string | null;
  submitted_at?: string | null;
};

type MailshakeCampaign = {
  id?: number | string;
  title?: string;
  isArchived?: boolean;
  isPaused?: boolean;
  code?: string;
  error?: string;
  message?: string;
};

type MailshakeRecipient = {
  id?: number | string;
  emailAddress?: string;
  code?: string;
  error?: string;
  message?: string;
};

type MailshakeAddResponse = {
  invalidEmails?: unknown;
  isEmpty?: boolean;
  checkStatusID?: number | string;
  code?: string;
  error?: string;
  message?: string;
};

function cleanText(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function normalizeEmail(
  value: unknown
) {
  return cleanText(
    value
  ).toLowerCase();
}

function getSupabaseAdmin() {
  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      "Missing Supabase server environment variables."
    );
  }

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

function getMailshakeApiKey() {
  const apiKey =
    cleanText(
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
  const apiKey =
    getMailshakeApiKey();

  const token =
    Buffer.from(
      `${apiKey}:`,
      "utf8"
    ).toString(
      "base64"
    );

  return `Basic ${token}`;
}

async function verifyIntegrationAccess(
  request: Request
) {
  const verification =
    await verifySignedInCrmUser(
      request
    );

  if (verification.response) {
    return {
      response:
        verification.response,

      context:
        null,
    };
  }

  const role =
    cleanText(
      verification.context.crmRole
    ).toLowerCase();

  if (
    role !== "admin" &&
    role !== "sales_manager"
  ) {
    return {
      response:
        NextResponse.json(
          {
            error:
              "Mailshake provider execution is restricted to CRM Admin and Sales Manager users.",
          },
          {
            status:
              403,
          }
        ),

      context:
        null,
    };
  }

  return {
    response:
      null,

    context:
      verification.context,
  };
}

function parseJsonRecord(
  rawText: string
) {
  if (!rawText) {
    return {} as Record<
      string,
      unknown
    >;
  }

  return JSON.parse(
    rawText
  ) as Record<
    string,
    unknown
  >;
}

function providerErrorMessage(
  data:
    Record<
      string,
      unknown
    >,
  fallback: string
) {
  return (
    cleanText(
      data.message
    ) ||
    cleanText(
      data.error
    ) ||
    fallback
  );
}

async function readMailshakeCampaign(
  providerCampaignId: string
) {
  const body =
    new URLSearchParams();

  body.set(
    "campaignID",
    providerCampaignId
  );

  const response =
    await fetch(
      `${MAILSHAKE_API_BASE}/campaigns/get`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            mailshakeAuthorizationHeader(),

          Accept:
            "application/json",

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          body.toString(),

        cache:
          "no-store",
      }
    );

  const rawText =
    await response.text();

  let data:
    MailshakeCampaign &
    Record<
      string,
      unknown
    >;

  try {
    data =
      parseJsonRecord(
        rawText
      ) as
        MailshakeCampaign &
        Record<
          string,
          unknown
        >;
  } catch {
    throw new Error(
      `Mailshake returned an unreadable campaign response with HTTP status ${response.status}.`
    );
  }

  if (!response.ok) {
    throw new Error(
      providerErrorMessage(
        data,
        `Mailshake campaign lookup failed with HTTP status ${response.status}.`
      )
    );
  }

  const returnedId =
    cleanText(
      data.id
    );

  if (
    !returnedId ||
    returnedId !==
      providerCampaignId
  ) {
    throw new Error(
      "Mailshake did not return the expected campaign."
    );
  }

  return {
    providerCampaignId:
      returnedId,

    title:
      cleanText(
        data.title
      ) ||
      "Untitled campaign",

    isArchived:
      data.isArchived ===
      true,

    isPaused:
      data.isPaused ===
      true,
  };
}

async function readMailshakeRecipient(
  providerCampaignId: string,
  email: string
) {
  const body =
    new URLSearchParams();

  body.set(
    "campaignID",
    providerCampaignId
  );

  body.set(
    "emailAddress",
    email
  );

  const response =
    await fetch(
      `${MAILSHAKE_API_BASE}/recipients/get`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            mailshakeAuthorizationHeader(),

          Accept:
            "application/json",

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          body.toString(),

        cache:
          "no-store",
      }
    );

  const rawText =
    await response.text();

  let data:
    MailshakeRecipient &
    Record<
      string,
      unknown
    >;

  try {
    data =
      parseJsonRecord(
        rawText
      ) as
        MailshakeRecipient &
        Record<
          string,
          unknown
        >;
  } catch {
    throw new Error(
      `Mailshake returned an unreadable recipient lookup response with HTTP status ${response.status}.`
    );
  }

  const providerCode =
    cleanText(
      data.code
    ).toLowerCase();

  if (
    !response.ok &&
    (
      providerCode ===
        "not_found" ||
      response.status ===
        404
    )
  ) {
    return {
      exists:
        false,

      recipientId:
        null,
    };
  }

  if (!response.ok) {
    throw new Error(
      providerErrorMessage(
        data,
        `Mailshake recipient lookup failed with HTTP status ${response.status}.`
      )
    );
  }

  return {
    exists:
      true,

    recipientId:
      cleanText(
        data.id
      ) ||
      null,
  };
}

async function readDoNotContactTagId(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >
) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "crm_tags"
      )
      .select(
        "id"
      )
      .ilike(
        "tag_name",
        "Do Not Contact"
      )
      .eq(
        "tag_type",
        "category"
      )
      .eq(
        "status",
        "active"
      )
      .is(
        "archived_at",
        null
      )
      .limit(2);

  if (error) {
    throw error;
  }

  const rows =
    Array.isArray(
      data
    )
      ? data
      : [];

  if (
    rows.length !==
    1
  ) {
    throw new Error(
      'Provider execution stopped because the active "Do Not Contact" CRM safety control could not be identified uniquely.'
    );
  }

  return cleanText(
    rows[0]?.id
  );
}

async function readActiveContact(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >,
  contactId: string
) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "contacts"
      )
      .select(
        `
        id,
        company_id,
        email,
        companies!inner (
          id,
          archived_at
        )
        `
      )
      .eq(
        "id",
        contactId
      )
      .is(
        "archived_at",
        null
      )
      .is(
        "companies.archived_at",
        null
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  return (
    data as
      ContactRow |
      null
  );
}

async function hasDoNotContactTag(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >,
  contactId: string,
  tagId: string
) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "contact_tags"
      )
      .select(
        "contact_id"
      )
      .eq(
        "contact_id",
        contactId
      )
      .eq(
        "tag_id",
        tagId
      )
      .limit(1);

  if (error) {
    throw error;
  }

  return (
    Array.isArray(
      data
    ) &&
    data.length >
      0
  );
}

async function readActiveEmailCounts(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >
) {
  const counts =
    new Map<
      string,
      number
    >();

  let pagesRead =
    0;

  let complete =
    false;

  while (
    pagesRead <
    MAX_PAGES
  ) {
    const from =
      pagesRead *
      PAGE_SIZE;

    const to =
      from +
      PAGE_SIZE -
      1;

    const {
      data,
      error,
    } =
      await supabase
        .from(
          "contacts"
        )
        .select(
          `
          id,
          email,
          companies!inner (
            archived_at
          )
          `
        )
        .is(
          "archived_at",
          null
        )
        .is(
          "companies.archived_at",
          null
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .range(
          from,
          to
        );

    if (error) {
      throw error;
    }

    const rows =
      Array.isArray(
        data
      )
        ? data
        : [];

    rows.forEach(
      (row) => {
        const email =
          normalizeEmail(
            row.email
          );

        if (!email) {
          return;
        }

        counts.set(
          email,
          (
            counts.get(
              email
            ) ??
            0
          ) +
            1
        );
      }
    );

    pagesRead +=
      1;

    if (
      rows.length <
      PAGE_SIZE
    ) {
      complete =
        true;

      break;
    }
  }

  if (!complete) {
    throw new Error(
      `Provider execution stopped because the active CRM contact population exceeded the safety limit of ${PAGE_SIZE * MAX_PAGES} rows.`
    );
  }

  return counts;
}

async function markOperationAndMapping(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >,
  operationId: string,
  enrollmentId: string,
  options: {
    operationStatus:
      string;
    mappingStatus:
      string;
    providerMessage?:
      string | null;
    errorMessage?:
      string | null;
    failed?: boolean;
    cancelled?: boolean;
  }
) {
  const now =
    new Date().toISOString();

  const operationUpdate:
    Record<
      string,
      unknown
    > = {
      status:
        options.operationStatus,

      updated_at:
        now,
  };

  const mappingUpdate:
    Record<
      string,
      unknown
    > = {
      status:
        options.mappingStatus,

      updated_at:
        now,
  };

  if (
    options.providerMessage
  ) {
    operationUpdate.provider_message =
      options.providerMessage;

    mappingUpdate.provider_message =
      options.providerMessage;
  }

  if (
    options.errorMessage
  ) {
    operationUpdate.error_message =
      options.errorMessage;
  }

  if (
    options.failed
  ) {
    operationUpdate.failed_at =
      now;

    operationUpdate.failed_count =
      1;

    mappingUpdate.failed_at =
      now;

    mappingUpdate.failure_reason =
      options.errorMessage ||
      options.providerMessage ||
      "Provider operation failed.";
  }

  if (
    options.cancelled
  ) {
    operationUpdate.completed_at =
      now;
  }

  const {
    error:
      operationError,
  } =
    await supabase
      .from(
        "outreach_provider_operations"
      )
      .update(
        operationUpdate
      )
      .eq(
        "id",
        operationId
      );

  if (operationError) {
    console.error(
      "[mailshake-provider-operation-update]",
      operationError
    );
  }

  const {
    error:
      mappingError,
  } =
    await supabase
      .from(
        "outreach_provider_operation_enrollments"
      )
      .update(
        mappingUpdate
      )
      .eq(
        "operation_id",
        operationId
      )
      .eq(
        "enrollment_id",
        enrollmentId
      );

  if (mappingError) {
    console.error(
      "[mailshake-provider-mapping-update]",
      mappingError
    );
  }
}

export async function POST(
  request: Request
) {
  const access =
    await verifyIntegrationAccess(
      request
    );

  if (
    access.response ||
    !access.context
  ) {
    return access.response;
  }

  try {
    const payload =
      (
        await request.json()
      ) as
        ProviderExecutionPayload;

    const action =
      cleanText(
        payload.action
      ).toLowerCase();

    const prepareAuthorizedOperation =
      action ===
      "prepare_authorized";

    const submitAuthorizedOperation =
      action ===
      "submit_authorized";

    const authorizedOperation =
      prepareAuthorizedOperation ||
      submitAuthorizedOperation;

    /*
     * H3C2 fail-closed boundary.
     *
     * The legacy direct-submit path is disabled.
     * Every new provider operation must now use one exact
     * run-authorization item.
     */
    if (!authorizedOperation) {
      return NextResponse.json(
        {
          error:
            "Direct Mailshake submission is disabled. Create and use an exact CRM run authorization first.",
        },
        {
          status:
            409,
        }
      );
    }

    const providerWritePolicy =
      getMailshakeProviderWritePolicy();

    const productionAuthorizedSubmit =
      submitAuthorizedOperation &&
      providerWritePolicy.environment ===
        "production";

    const previewAuthorizedSubmit =
      submitAuthorizedOperation &&
      providerWritePolicy.environment ===
        "preview";

    /*
     * H3C3 narrow Production boundary.
     *
     * The centralized Production provider policy remains
     * globally locked. Only this Admin-only submit_authorized
     * path may proceed in Production, and the database must
     * atomically validate and consume the exact Production
     * authorization item before recipients/add can be reached.
     *
     * Preview continues to require the existing provider-write
     * policy and recipient allowlist.
     */
    if (
      submitAuthorizedOperation &&
      !providerWritePolicy.enabled &&
      !productionAuthorizedSubmit
    ) {
      return NextResponse.json(
        {
          error:
            providerWritePolicy.reason,
        },
        {
          status:
            503,
        }
      );
    }

    const authorizedRole =
      cleanText(
        access.context.crmRole
      ).toLowerCase();

    if (
      authorizedRole !==
      "admin"
    ) {
      return NextResponse.json(
        {
          error:
            "Only a signed-in CRM Admin can prepare or submit an authorized Mailshake provider operation.",
        },
        {
          status:
            403,
        }
      );
    }

    if (
      prepareAuthorizedOperation &&
      providerWritePolicy.environment !==
        "preview" &&
      providerWritePolicy.environment !==
        "production"
    ) {
      return NextResponse.json(
        {
          error:
            `Authorized operation preparation is available only in Vercel Preview or Production. Current environment: ${providerWritePolicy.environment}.`,
        },
        {
          status:
            409,
        }
      );
    }

    if (
      submitAuthorizedOperation &&
      !previewAuthorizedSubmit &&
      !productionAuthorizedSubmit
    ) {
      return NextResponse.json(
        {
          error:
            `Authorized Mailshake submission is available only in Vercel Preview or Production. Current environment: ${providerWritePolicy.environment}.`,
        },
        {
          status:
            409,
        }
      );
    }
    const previewTestRecipientEmails =
      providerWritePolicy.allowedRecipientEmails;

    const authorizationItemId =
      cleanText(
        payload.authorizationItemId
      );

    if (
      !UUID_PATTERN.test(
        authorizationItemId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid run-authorization item ID is required for authorized provider execution.",
        },
        {
          status:
            400,
        }
      );
    }

    const providerCampaignId =
      cleanText(
        payload.providerCampaignId
      );

    const contactId =
      cleanText(
        payload.contactId
      );

    const confirmationPhrase =
      cleanText(
        payload.confirmationPhrase
      );

    const expectedConfirmationPhrase =
      prepareAuthorizedOperation
        ? `PREPARE ${authorizationItemId
            .slice(
              0,
              8
            )
            .toUpperCase()}`
        : productionAuthorizedSubmit
          ? `SUBMIT PRODUCTION ${authorizationItemId
              .slice(
                0,
                8
              )
              .toUpperCase()} FOR ${providerCampaignId}`
          : `SUBMIT AUTHORIZED ${authorizationItemId
              .slice(
                0,
                8
              )
              .toUpperCase()}`;

    if (
      confirmationPhrase !==
      expectedConfirmationPhrase
    ) {
      return NextResponse.json(
        {
          error:
            `Confirmation did not match. Type exactly: ${expectedConfirmationPhrase}`,
        },
        {
          status:
            400,
        }
      );
    }
    if (
      !providerCampaignId
    ) {
      return NextResponse.json(
        {
          error:
            "A Mailshake campaign ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

    const providerCampaignNumber =
      Number(
        providerCampaignId
      );

    if (
      !Number.isSafeInteger(
        providerCampaignNumber
      ) ||
      providerCampaignNumber <=
        0
    ) {
      return NextResponse.json(
        {
          error:
            "The Mailshake campaign ID is invalid.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      !UUID_PATTERN.test(
        contactId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The CRM contact ID is invalid.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      MAX_RECIPIENTS_PER_OPERATION !==
      1
    ) {
      throw new Error(
        "The initial provider execution safety limit is misconfigured."
      );
    }

    const supabase =
      getSupabaseAdmin();

    /*
     * Load the existing CRM enrollment.
     *
     * The provider-write route never creates the business
     * enrollment decision. That must already exist.
     */
    const {
      data:
        enrollmentData,
      error:
        enrollmentError,
    } =
      await supabase
        .from(
          "outreach_enrollments"
        )
        .select(
          `
          id,
          batch_id,
          outreach_campaign_id,
          provider_campaign_id,
          contact_id,
          company_id,
          normalized_email,
          status,
          provider_recipient_id,
          submitted_at
          `
        )
        .eq(
          "provider",
          "mailshake"
        )
        .eq(
          "provider_campaign_id",
          providerCampaignId
        )
        .eq(
          "contact_id",
          contactId
        )
        .maybeSingle();

    if (enrollmentError) {
      throw enrollmentError;
    }

    const enrollment =
      enrollmentData as
        EnrollmentRow |
        null;

    if (!enrollment) {
      return NextResponse.json(
        {
          error:
            "No CRM outreach enrollment exists for this contact and Mailshake campaign. Record the CRM enrollment instruction first.",
        },
        {
          status:
            409,
        }
      );
    }

    const enrollmentId =
      cleanText(
        enrollment.id
      );

    const batchId =
      cleanText(
        enrollment.batch_id
      );

    const outreachCampaignId =
      cleanText(
        enrollment.outreach_campaign_id
      );

    if (
      !enrollmentId ||
      !batchId ||
      !outreachCampaignId
    ) {
      throw new Error(
        "The CRM outreach enrollment is incomplete."
      );
    }

    const enrollmentStatus =
      cleanText(
        enrollment.status
      ).toLowerCase();

    if (
      enrollmentStatus !==
        "requested" ||
      cleanText(
        enrollment.provider_recipient_id
      ) ||
      cleanText(
        enrollment.submitted_at
      )
    ) {
      return NextResponse.json(
        {
          error:
            `This CRM enrollment is no longer eligible for first submission. Current status: ${enrollmentStatus || "unknown"}.`,
        },
        {
          status:
            409,
        }
      );
    }

    /*
     * Revalidate the CRM contact and its company.
     */
    const [
      contact,
      doNotContactTagId,
      emailCounts,
    ] =
      await Promise.all([
        readActiveContact(
          supabase,
          contactId
        ),

        readDoNotContactTagId(
          supabase
        ),

        readActiveEmailCounts(
          supabase
        ),
      ]);

    if (!contact) {
      return NextResponse.json(
        {
          error:
            "Provider execution stopped because the CRM contact or company is archived or missing.",
        },
        {
          status:
            409,
        }
      );
    }

    const currentCompanyId =
      cleanText(
        contact.company_id
      );

    if (
      !currentCompanyId ||
      currentCompanyId !==
        cleanText(
          enrollment.company_id
        )
    ) {
      return NextResponse.json(
        {
          error:
            "Provider execution stopped because the CRM company relationship changed after enrollment.",
        },
        {
          status:
            409,
        }
      );
    }

    const currentEmail =
      normalizeEmail(
        contact.email
      );

    const recordedEmail =
      normalizeEmail(
        enrollment.normalized_email
      );

    if (
      !currentEmail ||
      currentEmail !==
        recordedEmail
    ) {
      return NextResponse.json(
        {
          error:
            "Provider execution stopped because the CRM email changed after the enrollment instruction was recorded. Review the CRM enrollment before submitting.",
        },
        {
          status:
            409,
        }
      );
    }

    /*
     * Preview rollout recipient allowlist.
     *
     * Even if every other safety check passes, recipients/add
     * may only be called for an explicitly allowlisted Preview
     * test inbox.
     */
    if (
      previewAuthorizedSubmit &&
      !previewTestRecipientEmails.includes(
        currentEmail
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Provider execution stopped because this CRM contact is not on the configured Mailshake Preview test-recipient allowlist.",
        },
        {
          status:
            409,
        }
      );
    }

    const isDoNotContact =
      await hasDoNotContactTag(
        supabase,
        contactId,
        doNotContactTagId
      );

    if (isDoNotContact) {
      return NextResponse.json(
        {
          error:
            'Provider execution stopped because the CRM contact currently has the "Do Not Contact" tag.',
        },
        {
          status:
            409,
        }
      );
    }

    if (
      (
        emailCounts.get(
          currentEmail
        ) ??
        0
      ) !==
      1
    ) {
      return NextResponse.json(
        {
          error:
            "Provider execution stopped because the normalized CRM email is no longer unique among active CRM contacts.",
        },
        {
          status:
            409,
        }
      );
    }

    /*
     * Check for an existing active reservation before creating
     * another provider-operation attempt.
     *
     * The database unique partial index remains the real
     * concurrency protection.
     */
    const {
      data:
        existingReservation,
      error:
        reservationReadError,
    } =
      await supabase
        .from(
          "outreach_provider_operation_enrollments"
        )
        .select(
          "operation_id, status"
        )
        .eq(
          "enrollment_id",
          enrollmentId
        )
        .in(
          "status",
          [
            "prepared",
            "submitted",
          ]
        )
        .limit(1)
        .maybeSingle();

    if (reservationReadError) {
      throw reservationReadError;
    }

    if (existingReservation) {
      return NextResponse.json(
        {
          error:
            "This CRM enrollment already has an active or unresolved provider operation. Do not submit it again until that operation is resolved.",
        },
        {
          status:
            409,
        }
      );
    }

    /*
     * Fresh Mailshake campaign check.
     */
    const providerCampaign =
      await readMailshakeCampaign(
        providerCampaignId
      );

    if (
      providerCampaign.isArchived
    ) {
      return NextResponse.json(
        {
          error:
            "Mailshake currently reports this campaign as archived. Provider submission is blocked.",
        },
        {
          status:
            409,
        }
      );
    }

    if (
      !providerCampaign.isPaused
    ) {
      return NextResponse.json(
        {
          error:
            "Mailshake currently reports this campaign as not paused. The initial CRM safety policy permits provider submission only to paused campaigns.",
        },
        {
          status:
            409,
        }
      );
    }

    /*
     * Do not create another Mailshake recipient if the provider
     * already has this email in the campaign.
     */
    const existingProviderRecipient =
      await readMailshakeRecipient(
        providerCampaignId,
        currentEmail
      );

    if (
      existingProviderRecipient.exists
    ) {
      return NextResponse.json(
        {
          error:
            "Mailshake already contains this email address in the selected campaign. CRM did not submit another recipient. Reconciliation is required before changing the CRM enrollment status.",

          providerRecipientId:
            existingProviderRecipient.recipientId,
        },
        {
          status:
            409,
        }
      );
    }

    /*
     * H3C2 AUTHORIZED ATOMIC CLAIM
     *
     * The database consumes the exact authorization item and
     * creates the one prepared provider operation plus mapping
     * in the same transaction.
     *
     * prepare_authorized stops here.
     * submit_authorized continues using THIS SAME operation.
     */
    const claimedAt =
      new Date().toISOString();

    const {
      data:
        claimedOperationIdRaw,
      error:
        claimOperationError,
    } =
      await supabase.rpc(
        "claim_outreach_provider_run_authorization_item",
        {
          p_authorization_item_id:
            authorizationItemId,

          p_expected_enrollment_id:
            enrollmentId,

          p_environment:
            providerWritePolicy.environment,

          p_requested_by_crm_user_id:
            access.context.crmUserId,

          p_requested_by_display_name:
            access.context.crmDisplayName,

          p_request_snapshot: {
            revision:
              "3.27H3C4",

            safetyPolicy:
              productionAuthorizedSubmit
                ? "authorized_atomic_production_single_recipient"
                : submitAuthorizedOperation
                  ? "authorized_atomic_preview_submit"
                  : "authorized_atomic_prepare_only",

            preparationOnly:
              prepareAuthorizedOperation,

            providerWritePerformedAtClaim:
              false,

            environment:
              providerWritePolicy.environment,

            providerWritePolicyMode:
              providerWritePolicy.mode,

            providerWritePolicyEnabled:
              providerWritePolicy.enabled,

            productionAuthorizedPolicyOverride:
              productionAuthorizedSubmit,

            previewAllowlistedRecipient:
              previewAuthorizedSubmit
                ? currentEmail
                : null,

            providerCampaignTitle:
              providerCampaign.title,

            providerCampaignState:
              "paused",

            crmEligibilityReviewedAt:
              claimedAt,

            contactId,

            enrollmentId,

            normalizedEmail:
              currentEmail,
          },
        }
      );

    if (
      claimOperationError
    ) {
      return NextResponse.json(
        {
          error:
            claimOperationError.message ||
            "The exact authorization item could not be claimed atomically.",

          providerOperationPrepared:
            false,

          providerWritePerformed:
            false,
        },
        {
          status:
            409,
        }
      );
    }

    const operationId =
      cleanText(
        claimedOperationIdRaw
      );

    if (
      !UUID_PATTERN.test(
        operationId
      )
    ) {
      throw new Error(
        "The atomic authorization claim did not return a valid provider-operation ID."
      );
    }

    if (
      prepareAuthorizedOperation
    ) {
      return NextResponse.json(
        {
          status:
            "prepared",

          mode:
            "authorized-prepare-only",

          provider:
            "mailshake",

          environment:
            providerWritePolicy.environment,

          providerCampaignId,

          providerCampaignTitle:
            providerCampaign.title,

          providerCampaignState:
            "paused",

          operationId,

          enrollmentId,

          authorizationItemId,

          providerOperationPrepared:
            true,

          providerWritePerformed:
            false,

          providerExecutionUnlocked:
            false,

          message:
            "The exact authorization item was atomically converted into one prepared CRM provider operation. No Mailshake recipients/add request was made.",
        },
        {
          status:
            201,
        }
      );
    }
    /*
     * Second fresh Mailshake campaign check immediately before
     * the provider write.
     */
    let finalCampaignCheck:
      Awaited<
        ReturnType<
          typeof readMailshakeCampaign
        >
      >;

    try {
      finalCampaignCheck =
        await readMailshakeCampaign(
          providerCampaignId
        );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not perform the final Mailshake campaign safety check.";

      await markOperationAndMapping(
        supabase,
        operationId,
        enrollmentId,
        {
          operationStatus:
            "failed",

          mappingStatus:
            "failed",

          errorMessage:
            message,

          failed:
            true,
        }
      );

      return NextResponse.json(
        {
          error:
            `${message} No recipient-add request was made.`,
        },
        {
          status:
            502,
        }
      );
    }

    if (
      finalCampaignCheck.isArchived ||
      !finalCampaignCheck.isPaused
    ) {
      const message =
        finalCampaignCheck.isArchived
          ? "Mailshake changed this campaign to archived before submission."
          : "Mailshake no longer reports this campaign as paused.";

      await markOperationAndMapping(
        supabase,
        operationId,
        enrollmentId,
        {
          operationStatus:
            "cancelled",

          mappingStatus:
            "cancelled",

          providerMessage:
            `${message} CRM cancelled the operation before calling recipients/add.`,

          cancelled:
            true,
        }
      );

      return NextResponse.json(
        {
          error:
            `${message} Nothing was submitted to Mailshake.`,
        },
        {
          status:
            409,
        }
      );
    }

    /*
     * Mark the operation as submitting BEFORE starting the
     * external provider write.
     */
    const {
      error:
        submittingUpdateError,
    } =
      await supabase
        .from(
          "outreach_provider_operations"
        )
        .update({
          status:
            "submitting",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          operationId
        );

    if (submittingUpdateError) {
      await markOperationAndMapping(
        supabase,
        operationId,
        enrollmentId,
        {
          operationStatus:
            "failed",

          mappingStatus:
            "failed",

          errorMessage:
            "CRM could not mark the provider operation as submitting. Mailshake was not called.",

          failed:
            true,
        }
      );

      return NextResponse.json(
        {
          error:
            "CRM could not establish the submitting state safely. Mailshake was not called.",
        },
        {
          status:
            500,
        }
      );
    }

    /*
     * ==========================================================
     * FIRST REAL PROVIDER WRITE
     * ==========================================================
     *
     * Mailshake campaign was checked twice and is paused.
     * One CRM enrollment is reserved.
     *
     * Do not add bulk recipients in this initial rollout.
     */
    let providerResponse:
      Response;

    try {
      providerResponse =
        await fetch(
          `${MAILSHAKE_API_BASE}/recipients/add`,
          {
            method:
              "POST",

            headers: {
              Authorization:
                mailshakeAuthorizationHeader(),

              Accept:
                "application/json",

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                campaignID:
                  providerCampaignNumber,

                addAsNewList:
                  false,

                addresses: [
                  {
                    emailAddress:
                      currentEmail,
                  },
                ],
              }),

            cache:
              "no-store",

            signal:
              AbortSignal.timeout(
                20000
              ),
          }
        );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The Mailshake request ended without a provider response.";

      const unknownAt =
        new Date().toISOString();

      const {
        error:
          unknownUpdateError,
      } =
        await supabase
          .from(
            "outreach_provider_operations"
          )
          .update({
            status:
              "submission_unknown",

            provider_message:
              `CRM started recipients/add but did not receive a definitive Mailshake response. ${message}`,

            updated_at:
              unknownAt,
          })
          .eq(
            "id",
            operationId
          );

      if (unknownUpdateError) {
        console.error(
          "[mailshake-submission-unknown-recording]",
          unknownUpdateError
        );
      }

      return NextResponse.json(
        {
          status:
            "submission_unknown",

          mode:
            "provider-submit",

          operationId,

          providerCheckStatusId:
            null,

          message:
            "CRM initiated the Mailshake request but did not receive a definitive provider response. The enrollment was NOT marked submitted. Do not retry this enrollment until it is reconciled.",
        },
        {
          status:
            202,
        }
      );
    }

    const rawProviderText =
      await providerResponse.text();

    let providerData:
      MailshakeAddResponse &
      Record<
        string,
        unknown
      >;

    try {
      providerData =
        parseJsonRecord(
          rawProviderText
        ) as
          MailshakeAddResponse &
          Record<
            string,
            unknown
          >;
    } catch {
      const unknownAt =
        new Date().toISOString();

      await supabase
        .from(
          "outreach_provider_operations"
        )
        .update({
          status:
            "submission_unknown",

          provider_message:
            `Mailshake returned HTTP ${providerResponse.status}, but CRM could not parse the response after recipients/add.`,

          updated_at:
            unknownAt,
        })
        .eq(
          "id",
          operationId
        );

      return NextResponse.json(
        {
          status:
            "submission_unknown",

          mode:
            "provider-submit",

          operationId,

          providerCheckStatusId:
            null,

          message:
            "Mailshake returned a response, but CRM could not determine the provider result. Do not retry this enrollment until it is reconciled.",
        },
        {
          status:
            202,
        }
      );
    }

    const providerMessage =
      providerErrorMessage(
        providerData,
        `Mailshake returned HTTP ${providerResponse.status}.`
      );

    /*
     * A 5xx response can be ambiguous in a distributed system:
     * the provider may have processed the write before the error
     * reached CRM.
     */
    if (
      providerResponse.status >=
      500
    ) {
      await supabase
        .from(
          "outreach_provider_operations"
        )
        .update({
          status:
            "submission_unknown",

          provider_message:
            `Mailshake returned HTTP ${providerResponse.status} after CRM initiated recipients/add. Provider outcome requires reconciliation.`,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          operationId
        );

      return NextResponse.json(
        {
          status:
            "submission_unknown",

          mode:
            "provider-submit",

          operationId,

          providerCheckStatusId:
            null,

          message:
            "Mailshake returned a server error after CRM initiated the recipient-add request. The provider outcome is uncertain. Do not retry until reconciled.",
        },
        {
          status:
            202,
        }
      );
    }

    /*
     * 4xx provider rejection:
     * provider did not accept this request.
     *
     * CRM enrollment remains requested so a controlled future
     * retry can occur after the underlying issue is corrected.
     */
    if (
      !providerResponse.ok
    ) {
      await markOperationAndMapping(
        supabase,
        operationId,
        enrollmentId,
        {
          operationStatus:
            "failed",

          mappingStatus:
            "failed",

          providerMessage,

          errorMessage:
            providerMessage,

          failed:
            true,
        }
      );

      return NextResponse.json(
        {
          error:
            `Mailshake rejected the recipient-add request: ${providerMessage}`,

          operationId,
        },
        {
          status:
            502,
        }
      );
    }

    const checkStatusId =
      cleanText(
        providerData.checkStatusID
      );

    const invalidEmails =
      Array.isArray(
        providerData.invalidEmails
      )
        ? providerData.invalidEmails.map(
            normalizeEmail
          )
        : [];

    if (!checkStatusId) {
      if (
        providerData.isEmpty ===
          true ||
        invalidEmails.includes(
          currentEmail
        )
      ) {
        const message =
          invalidEmails.includes(
            currentEmail
          )
            ? "Mailshake rejected the recipient email during initial validation."
            : "Mailshake reported that no recipient was imported.";

        await markOperationAndMapping(
          supabase,
          operationId,
          enrollmentId,
          {
            operationStatus:
              "failed",

            mappingStatus:
              "failed",

            providerMessage:
              message,

            errorMessage:
              message,

            failed:
              true,
          }
        );

        return NextResponse.json(
          {
            error:
              `${message} The CRM enrollment remains requested.`,

            operationId,
          },
          {
            status:
              409,
          }
        );
      }

      /*
       * Provider returned success but no monitor ID.
       * We cannot safely assume the write failed or succeeded.
       */
      await supabase
        .from(
          "outreach_provider_operations"
        )
        .update({
          status:
            "submission_unknown",

          provider_message:
            "Mailshake returned a successful HTTP response to recipients/add but did not provide a checkStatusID.",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          operationId
        );

      return NextResponse.json(
        {
          status:
            "submission_unknown",

          mode:
            "provider-submit",

          operationId,

          providerCheckStatusId:
            null,

          message:
            "Mailshake returned success but did not provide the asynchronous status ID CRM requires. Do not retry until reconciled.",
        },
        {
          status:
            202,
        }
      );
    }

    const submittedAt =
      new Date().toISOString();

    /*
     * First preserve the provider monitor ID on the operation.
     */
    const {
      error:
        operationSubmittedError,
    } =
      await supabase
        .from(
          "outreach_provider_operations"
        )
        .update({
          status:
            "submitted",

          provider_check_status_id:
            checkStatusId,

          submitted_count:
            1,

          provider_message:
            "Mailshake accepted the asynchronous recipient-add request. Awaiting recipients/add-status verification.",

          submitted_at:
            submittedAt,

          updated_at:
            submittedAt,
        })
        .eq(
          "id",
          operationId
        );

    if (operationSubmittedError) {
      /*
       * Mailshake has already accepted the request.
       * Never retry automatically from this condition.
       */
      const {
        error:
          fallbackError,
      } =
        await supabase
          .from(
            "outreach_provider_operations"
          )
          .update({
            status:
              "submission_unknown",

            provider_check_status_id:
              checkStatusId,

            provider_message:
              "Mailshake returned a checkStatusID, but CRM could not finalize its submitted operation state. Do not retry; reconciliation is required.",

            updated_at:
              submittedAt,
          })
          .eq(
            "id",
            operationId
          );

      if (fallbackError) {
        console.error(
          "[mailshake-provider-check-status-preservation]",
          {
            operationId,
            checkStatusId,
            originalError:
              operationSubmittedError,
            fallbackError,
          }
        );
      }

      return NextResponse.json(
        {
          status:
            "submission_unknown",

          mode:
            "provider-submit",

          operationId,

          providerCheckStatusId:
            checkStatusId,

          message:
            "Mailshake accepted the request, but CRM could not fully finalize the provider-operation record. Do not retry. The returned checkStatusID must be reconciled.",
        },
        {
          status:
            202,
        }
      );
    }

    const {
      error:
        mappingSubmittedError,
    } =
      await supabase
        .from(
          "outreach_provider_operation_enrollments"
        )
        .update({
          status:
            "submitted",

          provider_status:
            "submitted",

          provider_message:
            "Mailshake accepted the asynchronous recipient-add request. Awaiting add-status verification.",

          submitted_at:
            submittedAt,

          updated_at:
            submittedAt,
        })
        .eq(
          "operation_id",
          operationId
        )
        .eq(
          "enrollment_id",
          enrollmentId
        );

    if (mappingSubmittedError) {
      return NextResponse.json(
        {
          error:
            "Mailshake accepted the request and CRM saved the provider status ID, but CRM could not update the operation-enrollment mapping. Do not retry this recipient.",

          operationId,

          providerCheckStatusId:
            checkStatusId,
        },
        {
          status:
            500,
        }
      );
    }

    const {
      data:
        submittedEnrollment,
      error:
        enrollmentSubmittedError,
    } =
      await supabase
        .from(
          "outreach_enrollments"
        )
        .update({
          status:
            "submitted",

          provider_status:
            "submitted",

          provider_message:
            "Mailshake accepted the asynchronous recipient-add request. Awaiting add-status verification.",

          submitted_at:
            submittedAt,

          updated_at:
            submittedAt,
        })
        .eq(
          "id",
          enrollmentId
        )
        .eq(
          "status",
          "requested"
        )
        .select(
          "id"
        )
        .maybeSingle();

    if (
      enrollmentSubmittedError ||
      !submittedEnrollment
    ) {
      return NextResponse.json(
        {
          error:
            "Mailshake accepted the request and CRM saved the provider operation, but CRM could not mark the business enrollment submitted. Do not retry this recipient.",

          operationId,

          providerCheckStatusId:
            checkStatusId,
        },
        {
          status:
            500,
        }
      );
    }

    /*
     * Batch state is useful summary metadata.
     * A batch update failure must not cause a provider retry
     * because the recipient-add request was already accepted.
     */
    const {
      error:
        batchUpdateError,
    } =
      await supabase
        .from(
          "outreach_enrollment_batches"
        )
        .update({
          status:
            "submitting",

          submitted_at:
            submittedAt,

          updated_at:
            submittedAt,
        })
        .eq(
          "id",
          batchId
        );

    if (batchUpdateError) {
      console.error(
        "[mailshake-provider-batch-summary-update]",
        batchUpdateError
      );
    }

    return NextResponse.json(
      {
        status:
          "submitted",

        mode:
          "provider-submit",

        provider:
          "mailshake",

        providerCampaignId,

        providerCampaignTitle:
          finalCampaignCheck.title,

        providerCampaignState:
          "paused",

        operationId,

        enrollmentId,

        providerCheckStatusId:
          checkStatusId,

        submittedCount:
          1,

        enrollmentStatus:
          "submitted",

        providerRecipientId:
          null,

        warning:
          batchUpdateError
            ? "Mailshake accepted the request, but the CRM batch summary could not be updated. Do not retry the recipient."
            : null,

        message:
          "Mailshake accepted the asynchronous recipient-add request for 1 CRM enrollment. The campaign was paused at the final provider check. The recipient is submitted but NOT yet confirmed; keep the campaign paused until add-status verification is complete.",
      },
      {
        status:
          202,
      }
    );
  } catch (error) {
    console.error(
      "[mailshake-provider-execution]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not execute the controlled Mailshake provider submission.",
      },
      {
        status:
          500,
      }
    );
  }
}