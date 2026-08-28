import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { verifySignedInCrmUser } from "../../_shared/verified-auth";
import { POST as reviewEnrollmentRequest } from "../enrollment-requests/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAILSHAKE_API_BASE =
  "https://api.mailshake.com/2017-04-01";

const MAX_PROPOSED_AUTHORIZATION_COUNT =
  2;

const AUTHORIZATION_DURATION_MINUTES =
  15;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type AuthorizationReviewPayload = {
  action?: string;
  providerCampaignId?: string;
  campaignName?: string;
  campaignStatus?: string;
  selectionMode?: string;
  sourceListId?: string;
  filterSnapshot?: unknown;
  contactIds?: string[];

  confirmationPhrase?: string;
  authorizationId?: string;
  cancellationReason?: string;
};
type ProviderReviewResult = {
  error?: string;
  message?: string;
  providerReview?: {
    providerCampaignId?: string;
    providerCampaignTitle?: string;
    providerCampaignState?: string;
    readyToSubmitCount?: number;
    readyContactIds?: string[];
    providerWritePolicyAllowed?: boolean;
    providerWritePolicyMode?: string;
    providerWritePolicyReason?: string;
  };
};

type EnrollmentRow = {
  id?: string | null;
  contact_id?: string | null;
  normalized_email?: string | null;
  status?: string | null;
  provider_recipient_id?: string | null;
  submitted_at?: string | null;
};

type MailshakeRecipientResponse = {
  id?: number | string;
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

function deploymentEnvironment() {
  const vercelEnvironment =
    cleanText(
      process.env.VERCEL_ENV
    ).toLowerCase();

  if (vercelEnvironment) {
    return vercelEnvironment;
  }

  return (
    cleanText(
      process.env.NODE_ENV
    ).toLowerCase() ||
    "development"
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
  const token =
    Buffer.from(
      `${getMailshakeApiKey()}:`,
      "utf8"
    ).toString(
      "base64"
    );

  return `Basic ${token}`;
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
        method: "POST",

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
    MailshakeRecipientResponse;

  try {
    data =
      rawText
        ? JSON.parse(
            rawText
          )
        : {};
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
      exists: false,
      recipientId: null,
    };
  }

  if (!response.ok) {
    throw new Error(
      cleanText(
        data.message
      ) ||
      cleanText(
        data.error
      ) ||
      `Mailshake recipient lookup failed with HTTP status ${response.status}.`
    );
  }

  return {
    exists: true,

    recipientId:
      cleanText(
        data.id
      ) ||
      null,
  };
}

export async function POST(
  request: Request
) {
  const verification =
    await verifySignedInCrmUser(
      request
    );

  if (
    verification.response ||
    !verification.context
  ) {
    return verification.response;
  }

  if (
    cleanText(
      verification.context.crmRole
    ).toLowerCase() !==
    "admin"
  ) {
    return NextResponse.json(
      {
        error:
          "Only a signed-in CRM Admin can review or manage a Mailshake run authorization.",
      },
      {
        status: 403,
      }
    );
  }

  try {
    const payload =
      (
        await request.json()
      ) as
        AuthorizationReviewPayload;

    const action =
      cleanText(
        payload.action
      ).toLowerCase();

    if (
      ![
        "review",
        "create",
        "cancel",
      ].includes(
        action
      )
    ) {
      return NextResponse.json(
        {
          error:
            'The run-authorization endpoint supports only action "review", "create", or "cancel".',
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Cancellation only removes permission.
     * It does not require another provider-readiness pass.
     *
     * The database function independently refuses cancellation
     * once any provider operation has been linked.
     */
    if (
      action ===
      "cancel"
    ) {
      const environment =
        deploymentEnvironment();

      if (
        environment !==
          "preview" &&
        environment !==
          "production"
      ) {
        return NextResponse.json(
          {
            error:
              `Run authorizations can be cancelled only from Vercel Preview or Production. Current environment: ${environment}.`,
          },
          {
            status: 409,
          }
        );
      }

      const authorizationId =
        cleanText(
          payload.authorizationId
        );

      if (
        !UUID_PATTERN.test(
          authorizationId
        )
      ) {
        return NextResponse.json(
          {
            error:
              "A valid run authorization ID is required for cancellation.",
          },
          {
            status: 400,
          }
        );
      }

      const cancellationReason =
        cleanText(
          payload.cancellationReason
        );

      if (
        cancellationReason.length <
          8 ||
        cancellationReason.length >
          500
      ) {
        return NextResponse.json(
          {
            error:
              "Enter a cancellation reason between 8 and 500 characters.",
          },
          {
            status: 400,
          }
        );
      }

      const expectedConfirmation =
        `CANCEL ${authorizationId
          .slice(
            0,
            8
          )
          .toUpperCase()}`;

      if (
        cleanText(
          payload.confirmationPhrase
        ).toUpperCase() !==
        expectedConfirmation
      ) {
        return NextResponse.json(
          {
            error:
              `Cancellation confirmation did not match. Type exactly: ${expectedConfirmation}`,
          },
          {
            status: 409,
          }
        );
      }

      const supabase =
        getSupabaseAdmin();

      const {
        data:
          existingAuthorization,
        error:
          existingAuthorizationError,
      } =
        await supabase
          .from(
            "outreach_provider_run_authorizations"
          )
          .select(
            `
            id,
            provider,
            provider_campaign_id,
            environment,
            status,
            authorized_count,
            expires_at
            `
          )
          .eq(
            "id",
            authorizationId
          )
          .maybeSingle();

      if (
        existingAuthorizationError
      ) {
        throw existingAuthorizationError;
      }

      if (
        !existingAuthorization
      ) {
        return NextResponse.json(
          {
            error:
              "The requested run authorization could not be found.",
          },
          {
            status: 404,
          }
        );
      }

      if (
        cleanText(
          existingAuthorization.provider
        ).toLowerCase() !==
          "mailshake" ||
        cleanText(
          existingAuthorization.environment
        ).toLowerCase() !==
          environment
      ) {
        return NextResponse.json(
          {
            error:
              "The run authorization does not belong to this Mailshake deployment environment.",
          },
          {
            status: 409,
          }
        );
      }

      const existingStatus =
        cleanText(
          existingAuthorization.status
        ).toLowerCase();

      if (
        ![
          "draft",
          "authorized",
        ].includes(
          existingStatus
        )
      ) {
        return NextResponse.json(
          {
            error:
              `The run authorization cannot be cancelled because its current status is "${existingStatus || "unknown"}".`,
          },
          {
            status: 409,
          }
        );
      }

      const {
        data:
          cancelled,
        error:
          cancelError,
      } =
        await supabase.rpc(
          "cancel_outreach_provider_run_authorization",
          {
            p_authorization_id:
              authorizationId,

            p_cancelled_by_crm_user_id:
              verification.context.crmUserId,

            p_cancelled_by_display_name:
              verification.context.crmDisplayName,

            p_reason:
              cancellationReason,
          }
        );

      if (
        cancelError
      ) {
        return NextResponse.json(
          {
            error:
              cancelError.message ||
              "The run authorization could not be cancelled.",
          },
          {
            status: 409,
          }
        );
      }

      if (
        cancelled !==
        true
      ) {
        throw new Error(
          "The cancellation database function did not confirm success."
        );
      }

      const {
        data:
          cancelledAuthorization,
        error:
          cancelledAuthorizationError,
      } =
        await supabase
          .from(
            "outreach_provider_run_authorizations"
          )
          .select(
            `
            id,
            provider_campaign_id,
            environment,
            status,
            authorized_count,
            cancelled_at,
            cancelled_by_crm_user_id,
            cancelled_by_display_name,
            stop_reason
            `
          )
          .eq(
            "id",
            authorizationId
          )
          .single();

      if (
        cancelledAuthorizationError
      ) {
        throw cancelledAuthorizationError;
      }

      return NextResponse.json({
        status:
          "run_authorization_cancelled",

        authorizationCancelled:
          true,

        providerExecutionUnlocked:
          false,

        authorization:
          cancelledAuthorization,

        message:
          "The unused run authorization was cancelled and retained for audit. No Mailshake provider operation was created or executed.",
      });
    }
    const providerCampaignId =
      cleanText(
        payload.providerCampaignId
      );

    if (!providerCampaignId) {
      return NextResponse.json(
        {
          error:
            "A Mailshake campaign ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const contactIds =
      Array.from(
        new Set(
          (
            Array.isArray(
              payload.contactIds
            )
              ? payload.contactIds
              : []
          )
            .map(
              cleanText
            )
            .filter(
              Boolean
            )
        )
      );

    if (
      contactIds.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Select at least one CRM contact before reviewing a Production authorization.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Re-run the existing authoritative Step 3 provider review
     * on the server.
     *
     * Do not trust ready-contact IDs or campaign state from
     * the browser.
     */
    const authorizationHeader =
      request.headers.get(
        "authorization"
      ) ||
      "";

    const providerReviewRequest =
      new Request(
        request.url,
        {
          method: "POST",

          headers: {
            Authorization:
              authorizationHeader,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              ...payload,

              action:
                "provider_review",

              providerCampaignId,

              contactIds,
            }),
        }
      );

    const providerReviewResponse =
      await reviewEnrollmentRequest(
        providerReviewRequest
      );

    const providerReviewText =
      await providerReviewResponse.text();

    let providerReviewData:
      ProviderReviewResult;

    try {
      providerReviewData =
        providerReviewText
          ? JSON.parse(
              providerReviewText
            )
          : {};
    } catch {
      throw new Error(
        "The authoritative CRM provider review returned an unreadable response."
      );
    }

    if (
      !providerReviewResponse.ok
    ) {
      return NextResponse.json(
        {
          error:
            providerReviewData.error ||
            "The authoritative CRM provider review did not pass.",
        },
        {
          status:
            providerReviewResponse.status,
        }
      );
    }

    const providerReview =
      providerReviewData.providerReview;

    if (!providerReview) {
      throw new Error(
        "The authoritative CRM provider review did not return its expected review data."
      );
    }

    const reviewedCampaignId =
      cleanText(
        providerReview.providerCampaignId
      );

    if (
      reviewedCampaignId !==
      providerCampaignId
    ) {
      throw new Error(
        "The authoritative CRM provider review returned a different Mailshake campaign."
      );
    }

    const readyContactIds =
      Array.from(
        new Set(
          (
            Array.isArray(
              providerReview.readyContactIds
            )
              ? providerReview.readyContactIds
              : []
          )
            .map(
              cleanText
            )
            .filter(
              Boolean
            )
        )
      );

    const proposedContactIds =
      readyContactIds.slice(
        0,
        MAX_PROPOSED_AUTHORIZATION_COUNT
      );

    const supabase =
      getSupabaseAdmin();

    const blockedReasons:
      string[] = [];

    const blockedContactIds =
      new Set<string>();

    const {
      data:
        crmCampaign,
      error:
        crmCampaignError,
    } =
      await supabase
        .from(
          "outreach_campaigns"
        )
        .select(
          "id"
        )
        .eq(
          "provider",
          "mailshake"
        )
        .eq(
          "provider_campaign_id",
          providerCampaignId
        )
        .maybeSingle();

    if (crmCampaignError) {
      throw crmCampaignError;
    }

    const outreachCampaignId =
      cleanText(
        crmCampaign?.id
      );

    const enrollmentRows:
      EnrollmentRow[] =
        [];

    if (
      proposedContactIds.length >
      0
    ) {
      if (!outreachCampaignId) {
        throw new Error(
          "The CRM outreach campaign record could not be resolved for the proposed Production authorization."
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "outreach_enrollments"
          )
          .select(
            `
            id,
            contact_id,
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
            "outreach_campaign_id",
            outreachCampaignId
          )
          .eq(
            "provider_campaign_id",
            providerCampaignId
          )
          .in(
            "contact_id",
            proposedContactIds
          );

      if (error) {
        throw error;
      }

      if (
        Array.isArray(
          data
        )
      ) {
        enrollmentRows.push(
          ...(
            data as
              EnrollmentRow[]
          )
        );
      }
    }

    const enrollmentByContactId =
      new Map<
        string,
        EnrollmentRow
      >();

    enrollmentRows.forEach(
      (row) => {
        const contactId =
          cleanText(
            row.contact_id
          );

        if (contactId) {
          enrollmentByContactId.set(
            contactId,
            row
          );
        }
      }
    );

    for (
      const contactId of
      proposedContactIds
    ) {
      const enrollment =
        enrollmentByContactId.get(
          contactId
        );

      if (!enrollment) {
        blockedContactIds.add(
          contactId
        );

        blockedReasons.push(
          "A proposed contact no longer has the expected CRM enrollment record."
        );

        continue;
      }

      if (
        cleanText(
          enrollment.status
        ).toLowerCase() !==
          "requested" ||
        cleanText(
          enrollment.provider_recipient_id
        ) ||
        cleanText(
          enrollment.submitted_at
        )
      ) {
        blockedContactIds.add(
          contactId
        );

        blockedReasons.push(
          "A proposed CRM enrollment is no longer in untouched requested status."
        );

        continue;
      }

      if (
        !cleanText(
          enrollment.normalized_email
        )
      ) {
        blockedContactIds.add(
          contactId
        );

        blockedReasons.push(
          "A proposed CRM enrollment no longer has a normalized email."
        );
      }
    }

    const proposedEnrollmentIds =
      enrollmentRows
        .map(
          (row) =>
            cleanText(
              row.id
            )
        )
        .filter(
          Boolean
        );

    let activeProviderOperationCount =
      0;

    if (
      proposedEnrollmentIds.length >
      0
    ) {
      const {
        data:
          activeMappings,
        error:
          activeMappingError,
      } =
        await supabase
          .from(
            "outreach_provider_operation_enrollments"
          )
          .select(
            "enrollment_id, status"
          )
          .in(
            "enrollment_id",
            proposedEnrollmentIds
          )
          .in(
            "status",
            [
              "prepared",
              "submitted",
            ]
          );

      if (activeMappingError) {
        throw activeMappingError;
      }

      const mappingRows =
        Array.isArray(
          activeMappings
        )
          ? activeMappings
          : [];

      activeProviderOperationCount =
        mappingRows.length;

      for (
        const mapping of
        mappingRows
      ) {
        const enrollmentId =
          cleanText(
            mapping.enrollment_id
          );

        const matchingEnrollment =
          enrollmentRows.find(
            (row) =>
              cleanText(
                row.id
              ) ===
              enrollmentId
          );

        const contactId =
          cleanText(
            matchingEnrollment?.contact_id
          );

        if (contactId) {
          blockedContactIds.add(
            contactId
          );
        }
      }

      if (
        mappingRows.length >
        0
      ) {
        blockedReasons.push(
          "A proposed enrollment already has an active or unresolved CRM provider operation."
        );
      }
    }

    let existingProviderRecipientCount =
      0;

    for (
      const contactId of
      proposedContactIds
    ) {
      if (
        blockedContactIds.has(
          contactId
        )
      ) {
        continue;
      }

      const enrollment =
        enrollmentByContactId.get(
          contactId
        );

      const normalizedEmail =
        cleanText(
          enrollment?.normalized_email
        ).toLowerCase();

      if (!normalizedEmail) {
        continue;
      }

      /*
       * This Mailshake request is READ ONLY.
       * It does not add a recipient or mutate a campaign.
       */
      const providerRecipient =
        await readMailshakeRecipient(
          providerCampaignId,
          normalizedEmail
        );

      if (
        providerRecipient.exists
      ) {
        existingProviderRecipientCount +=
          1;

        blockedContactIds.add(
          contactId
        );

        blockedReasons.push(
          "Mailshake already contains a proposed CRM enrollment's email in this campaign. Reconciliation is required before a new provider add can be authorized."
        );
      }
    }

    const environment =
      deploymentEnvironment();

    const authorizationEnvironment:
      | "production"
      | "preview"
      | null =
        environment ===
        "production"
          ? "production"
          : environment ===
              "preview"
            ? "preview"
            : null;

    let activeAuthorization:
      {
        id: string;
        status: string;
        authorizedCount: number;
        authorizedAt: string | null;
        expiresAt: string | null;
        expiredByClock: boolean;
      } |
      null =
        null;

    if (
      authorizationEnvironment
    ) {
      const {
        data:
          authorizationRow,
        error:
          authorizationError,
      } =
        await supabase
          .from(
            "outreach_provider_run_authorizations"
          )
          .select(
            "id, status, authorized_count, authorized_at, expires_at"
          )
          .eq(
            "environment",
            authorizationEnvironment
          )
          .eq(
            "provider",
            "mailshake"
          )
          .eq(
            "provider_campaign_id",
            providerCampaignId
          )
          .in(
            "status",
            [
              "authorized",
              "in_progress",
            ]
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            }
          )
          .limit(
            1
          )
          .maybeSingle();

      if (
        authorizationError
      ) {
        throw authorizationError;
      }

      if (
        authorizationRow
      ) {
        const expiresAt =
          cleanText(
            authorizationRow.expires_at
          ) ||
          null;

        activeAuthorization = {
          id:
            cleanText(
              authorizationRow.id
            ),

          status:
            cleanText(
              authorizationRow.status
            ),

          authorizedCount:
            Number(
              authorizationRow.authorized_count ??
              0
            ),

          authorizedAt:
            cleanText(
              authorizationRow.authorized_at
            ) ||
            null,

          expiresAt,

          expiredByClock:
            Boolean(
              expiresAt &&
              Date.parse(
                expiresAt
              ) <=
                Date.now()
            ),
        };
      }
    }

    const blockingActiveAuthorization =
      Boolean(
        activeAuthorization &&
        !activeAuthorization.expiredByClock
      );

    if (
      blockingActiveAuthorization
    ) {
      blockedReasons.push(
        "An active CRM run authorization already exists for this deployment and Mailshake campaign."
      );
    }

    const providerCampaignState =
      cleanText(
        providerReview.providerCampaignState
      ).toLowerCase();

    if (
      providerCampaignState !==
      "paused"
    ) {
      blockedReasons.push(
        "Mailshake does not currently report the campaign as paused."
      );
    }

    const verifiedProposedCount =
      proposedContactIds.filter(
        (contactId) =>
          !blockedContactIds.has(
            contactId
          )
      ).length;

    const safetyChecksPassedForProposedSet =
      proposedContactIds.length >
        0 &&
      verifiedProposedCount ===
        proposedContactIds.length &&
      providerCampaignState ===
        "paused" &&
      !blockingActiveAuthorization;

    const eligibleForLaterProductionAuthorization =
      environment ===
        "production" &&
      safetyChecksPassedForProposedSet;

    /*
     * H3B2B2A CREATE
     *
     * The complete authoritative H3B2B1 review above has
     * just run again on the server.
     *
     * Only now can an Admin create the short-lived exact
     * authorization through the atomic database function.
     *
     * This still does not unlock provider execution.
     */
    if (
      action ===
      "create"
    ) {
      if (
        !authorizationEnvironment
      ) {
        return NextResponse.json(
          {
            error:
              `Run authorizations can be created only from Vercel Preview or Production. Current environment: ${environment}.`,
          },
          {
            status: 409,
          }
        );
      }

      if (
        proposedContactIds.length ===
        0
      ) {
        return NextResponse.json(
          {
            error:
              "There are no currently ready CRM enrollments to authorize.",
          },
          {
            status: 409,
          }
        );
      }

      if (
        !safetyChecksPassedForProposedSet
      ) {
        return NextResponse.json(
          {
            error:
              "The proposed controlled authorization did not pass every current safety check. Run the review again and resolve all findings before creating an authorization.",

            blockedReasons:
              Array.from(
                new Set(
                  blockedReasons
                )
              ),
          },
          {
            status: 409,
          }
        );
      }

      if (
        !outreachCampaignId
      ) {
        throw new Error(
          "The CRM outreach campaign identity is missing."
        );
      }

      const expectedConfirmation =
        `AUTHORIZE ${authorizationEnvironment.toUpperCase()} ${proposedContactIds.length} FOR ${providerCampaignId}`;

      if (
        cleanText(
          payload.confirmationPhrase
        ).toUpperCase() !==
        expectedConfirmation
      ) {
        return NextResponse.json(
          {
            error:
              `Authorization confirmation did not match. Type exactly: ${expectedConfirmation}`,
          },
          {
            status: 409,
          }
        );
      }

      const authorizationItems =
        proposedContactIds.map(
          (
            contactId,
            index
          ) => {
            const enrollment =
              enrollmentByContactId.get(
                contactId
              );

            if (
              !enrollment
            ) {
              throw new Error(
                "A proposed authorization enrollment disappeared before the atomic create call."
              );
            }

            const enrollmentId =
              cleanText(
                enrollment.id
              );

            const normalizedEmail =
              cleanText(
                enrollment.normalized_email
              ).toLowerCase();

            if (
              !UUID_PATTERN.test(
                enrollmentId
              ) ||
              !UUID_PATTERN.test(
                contactId
              ) ||
              !normalizedEmail
            ) {
              throw new Error(
                "A proposed authorization item has an invalid enrollment, contact, or normalized-email identity."
              );
            }

            return {
              enrollment_id:
                enrollmentId,

              contact_id:
                contactId,

              normalized_email:
                normalizedEmail,

              sequence_number:
                index + 1,
            };
          }
        );

      const fingerprintPayload = {
        environment:
          authorizationEnvironment,

        provider:
          "mailshake",

        outreachCampaignId,

        providerCampaignId,

        items:
          authorizationItems,
      };

      const selectionFingerprint =
        createHash(
          "sha256"
        )
          .update(
            JSON.stringify(
              fingerprintPayload
            ),
            "utf8"
          )
          .digest(
            "hex"
          );

      const expiresAt =
        new Date(
          Date.now() +
            AUTHORIZATION_DURATION_MINUTES *
              60 *
              1000
        ).toISOString();

      const authorizationSnapshot = {
        revision:
          "3.27H3B2B2A",

        createdAt:
          new Date().toISOString(),

        environment:
          authorizationEnvironment,

        provider:
          "mailshake",

        outreachCampaignId,

        providerCampaignId,

        providerCampaignTitle:
          cleanText(
            providerReview.providerCampaignTitle
          ),

        providerCampaignState,

        selectionMode:
          cleanText(
            payload.selectionMode
          ) ||
          null,

        sourceListId:
          cleanText(
            payload.sourceListId
          ) ||
          null,

        selectedContactCount:
          contactIds.length,

        serverReadyCount:
          readyContactIds.length,

        authorizedCount:
          authorizationItems.length,

        authorizedContactIds:
          authorizationItems.map(
            (item) =>
              item.contact_id
          ),

        providerWritePolicyAllowed:
          providerReview.providerWritePolicyAllowed ===
          true,

        providerWritePolicyMode:
          cleanText(
            providerReview.providerWritePolicyMode
          ),

        providerExecutionUnlocked:
          false,
      };

      const {
        data:
          createdAuthorizationIdRaw,
        error:
          createAuthorizationError,
      } =
        await supabase.rpc(
          "create_outreach_provider_run_authorization",
          {
            p_provider:
              "mailshake",

            p_outreach_campaign_id:
              outreachCampaignId,

            p_provider_campaign_id:
              providerCampaignId,

            p_environment:
              authorizationEnvironment,

            p_authorized_by_crm_user_id:
              verification.context.crmUserId,

            p_authorized_by_display_name:
              verification.context.crmDisplayName,

            p_selection_fingerprint:
              selectionFingerprint,

            p_authorization_snapshot:
              authorizationSnapshot,

            p_expires_at:
              expiresAt,

            p_items:
              authorizationItems,
          }
        );

      if (
        createAuthorizationError
      ) {
        return NextResponse.json(
          {
            error:
              createAuthorizationError.message ||
              "The atomic run authorization could not be created.",
          },
          {
            status: 409,
          }
        );
      }

      const createdAuthorizationId =
        cleanText(
          createdAuthorizationIdRaw
        );

      if (
        !UUID_PATTERN.test(
          createdAuthorizationId
        )
      ) {
        throw new Error(
          "The atomic database function did not return a valid authorization ID."
        );
      }

      const {
        data:
          createdAuthorization,
        error:
          createdAuthorizationError,
      } =
        await supabase
          .from(
            "outreach_provider_run_authorizations"
          )
          .select(
            `
            id,
            provider,
            outreach_campaign_id,
            provider_campaign_id,
            environment,
            status,
            authorized_by_crm_user_id,
            authorized_by_display_name,
            authorized_count,
            selection_fingerprint,
            authorized_at,
            expires_at
            `
          )
          .eq(
            "id",
            createdAuthorizationId
          )
          .single();

      if (
        createdAuthorizationError
      ) {
        throw createdAuthorizationError;
      }

      const {
        data:
          createdItems,
        error:
          createdItemsError,
      } =
        await supabase
          .from(
            "outreach_provider_run_authorization_enrollments"
          )
          .select(
            `
            id,
            authorization_id,
            enrollment_id,
            contact_id,
            normalized_email,
            sequence_number,
            status
            `
          )
          .eq(
            "authorization_id",
            createdAuthorizationId
          )
          .order(
            "sequence_number",
            {
              ascending:
                true,
            }
          );

      if (
        createdItemsError
      ) {
        throw createdItemsError;
      }

      const createdItemRows =
        Array.isArray(
          createdItems
        )
          ? createdItems
          : [];

      if (
        createdItemRows.length !==
        authorizationItems.length
      ) {
        throw new Error(
          "The authorization was created, but its item-count verification did not match. Provider execution remains locked; reconcile the authorization before continuing."
        );
      }

      const cancelConfirmationPhrase =
        `CANCEL ${createdAuthorizationId
          .slice(
            0,
            8
          )
          .toUpperCase()}`;

      return NextResponse.json({
        status:
          "run_authorization_created",

        authorizationCreated:
          true,

        providerExecutionUnlocked:
          false,

        authorization:
          createdAuthorization,

        authorizationItems:
          createdItemRows,

        selectionFingerprint,

        cancelConfirmationPhrase,

        message:
          `${authorizationItems.length} recipient${authorizationItems.length === 1 ? "" : "s"} were atomically authorized for this controlled ${authorizationEnvironment} run. No Mailshake recipient was added and provider execution remains locked.`,
      });
    }
    let message:
      string;

    if (
      environment ===
        "production" &&
      readyContactIds.length ===
        0
    ) {
      message =
        "Read-only Production authorization review completed. No selected CRM enrollment is currently ready for a new Mailshake recipient add, so there is nothing to authorize. No authorization record was created.";
    } else if (
      environment ===
        "production" &&
      safetyChecksPassedForProposedSet
    ) {
      message =
        `Read-only Production authorization review completed. ${verifiedProposedCount} proposed recipient${verifiedProposedCount === 1 ? "" : "s"} passed the H3B2B1 checks for a later controlled authorization. No authorization record was created and no Mailshake write occurred.`;
    } else {
      message =
        `Read-only authorization review completed in ${environment}. The server found ${readyContactIds.length} currently ready CRM enrollment${readyContactIds.length === 1 ? "" : "s"} and reviewed up to ${MAX_PROPOSED_AUTHORIZATION_COUNT} for the proposed controlled Production authorization. No authorization record was created and no Mailshake write occurred.`;
    }

    return NextResponse.json({
      status:
        "production_authorization_reviewed",

      mode:
        "read-only-authorization-review",

      readOnly:
        true,

      reviewedAt:
        new Date().toISOString(),

      environment,

      authorizationEnvironment,

      adminOnly:
        true,

      provider:
        "mailshake",

      providerCampaignId,

      providerCampaignTitle:
        cleanText(
          providerReview.providerCampaignTitle
        ),

      providerCampaignState,

      serverReadyCount:
        readyContactIds.length,

      proposedCount:
        proposedContactIds.length,

      verifiedProposedCount,

      blockedProposedCount:
        proposedContactIds.length -
        verifiedProposedCount,

      maxControlledAuthorizationCount:
        MAX_PROPOSED_AUTHORIZATION_COUNT,

      authorizationDurationMinutes:
        AUTHORIZATION_DURATION_MINUTES,

      createConfirmationPhrase:
        proposedContactIds.length >
          0 &&
        authorizationEnvironment
          ? `AUTHORIZE ${authorizationEnvironment.toUpperCase()} ${proposedContactIds.length} FOR ${providerCampaignId}`
          : null,
      authorizationCreated:
        false,

      safetyChecksPassedForProposedSet,

      eligibleForLaterProductionAuthorization,

      activeProviderOperationCount,

      existingProviderRecipientCount,

      activeAuthorization,

      blockedReasons:
        Array.from(
          new Set(
            blockedReasons
          )
        ),

      providerWritePolicyAllowed:
        providerReview.providerWritePolicyAllowed ===
        true,

      providerWritePolicyMode:
        cleanText(
          providerReview.providerWritePolicyMode
        ),

      providerWritePolicyReason:
        cleanText(
          providerReview.providerWritePolicyReason
        ),

      message,
    });
  } catch (error) {
    console.error(
      "[mailshake-run-authorization-lifecycle]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not complete the Mailshake run-authorization lifecycle request.",
      },
      {
        status: 500,
      }
    );
  }
}