import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { verifySignedInCrmUser } from "../../_shared/verified-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAILSHAKE_API_BASE =
  "https://api.mailshake.com/2017-04-01";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProviderStatusPayload = {
  providerOperationId?: string;
};

type EnrollmentRow = {
  id?: string;
  batch_id?: string;
  provider_campaign_id?: string;
  normalized_email?: string;
  status?: string;
  provider_recipient_id?: string | null;
  provider_status?: string | null;
};

type OperationMappingRow = {
  operation_id?: string;
  enrollment_id?: string;
  submitted_email?: string;
  status?: string;
  provider_recipient_id?: string | null;
  provider_status?: string | null;
};

type ProviderOperationRow = {
  id?: string;
  status?: string;
  provider_campaign_id?: string;
  provider_check_status_id?: string | number | null;
};

type AddedRecipientsProblems = {
  unsubscribedEmails?: unknown;
  alreadyInCampaignEmails?: unknown;
  passedAccountLimitEmails?: unknown;
  hasProblems?: boolean;
};

type AddedRecipientsResponse = {
  isFinished?: boolean;
  problems?: AddedRecipientsProblems;
  code?: string;
  error?: string;
  message?: string;
};

type MailshakeRecipient = {
  id?: string | number;
  emailAddress?: string;
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

function normalizedEmailList(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map(
      normalizeEmail
    )
    .filter(Boolean);
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
  const token =
    Buffer.from(
      `${getMailshakeApiKey()}:`,
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
              "Mailshake provider-status reconciliation is restricted to CRM Admin and Sales Manager users.",
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

async function readMailshakeAddStatus(
  statusId: string
) {
  const body =
    new URLSearchParams();

  body.set(
    "statusID",
    statusId
  );

  const response =
    await fetch(
      `${MAILSHAKE_API_BASE}/recipients/add-status`,
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

        signal:
          AbortSignal.timeout(
            20000
          ),
      }
    );

  const rawText =
    await response.text();

  let data:
    AddedRecipientsResponse &
    Record<
      string,
      unknown
    >;

  try {
    data =
      parseJsonRecord(
        rawText
      ) as
        AddedRecipientsResponse &
        Record<
          string,
          unknown
        >;
  } catch {
    throw new Error(
      `Mailshake returned an unreadable add-status response with HTTP status ${response.status}.`
    );
  }

  if (!response.ok) {
    throw new Error(
      providerErrorMessage(
        data,
        `Mailshake add-status failed with HTTP status ${response.status}.`
      )
    );
  }

  return data;
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

        signal:
          AbortSignal.timeout(
            20000
          ),
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
      `Mailshake returned an unreadable recipient response with HTTP status ${response.status}.`
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

  const recipientEmail =
    normalizeEmail(
      data.emailAddress
    );

  if (
    recipientEmail &&
    recipientEmail !==
      email
  ) {
    throw new Error(
      "Mailshake returned a recipient whose email does not match the CRM enrollment."
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

async function updateOperationChecking(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >,
  operationId: string,
  providerMessage: string
) {
  const now =
    new Date().toISOString();

  const {
    error,
  } =
    await supabase
      .from(
        "outreach_provider_operations"
      )
      .update({
        status:
          "checking",

        last_checked_at:
          now,

        provider_message:
          providerMessage,

        updated_at:
          now,
      })
      .eq(
        "id",
        operationId
      );

  if (error) {
    throw error;
  }
}

async function refreshEnrollmentBatchStatus(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >,
  batchId: string
) {
  if (!batchId) {
    return;
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
        "status"
      )
      .eq(
        "batch_id",
        batchId
      );

  if (error) {
    throw error;
  }

  const statuses =
    (data ?? [])
      .map(
        (row) =>
          cleanText(
            row.status
          ).toLowerCase()
      )
      .filter(Boolean);

  if (
    statuses.length ===
    0
  ) {
    return;
  }

  const terminalStatuses =
    new Set([
      "confirmed",
      "already_present",
      "unsubscribed",
      "failed",
      "cancelled",
    ]);

  const nonTerminalCount =
    statuses.filter(
      (status) =>
        !terminalStatuses.has(
          status
        )
    ).length;

  const failedCount =
    statuses.filter(
      (status) =>
        status ===
        "failed"
    ).length;

  const cancelledCount =
    statuses.filter(
      (status) =>
        status ===
        "cancelled"
    ).length;

  const unsubscribedCount =
    statuses.filter(
      (status) =>
        status ===
        "unsubscribed"
    ).length;

  let batchStatus:
    "submitting" |
    "completed" |
    "partial" |
    "failed" |
    "cancelled";

  if (
    nonTerminalCount >
    0
  ) {
    batchStatus =
      "submitting";
  } else if (
    cancelledCount ===
    statuses.length
  ) {
    batchStatus =
      "cancelled";
  } else if (
    failedCount ===
    statuses.length
  ) {
    batchStatus =
      "failed";
  } else if (
    unsubscribedCount >
      0 ||
    failedCount >
      0 ||
    cancelledCount >
      0
  ) {
    batchStatus =
      "partial";
  } else {
    batchStatus =
      "completed";
  }

  const now =
    new Date().toISOString();

  const update:
    Record<
      string,
      unknown
    > = {
      status:
        batchStatus,

      updated_at:
        now,
    };

  if (
    batchStatus !==
    "submitting"
  ) {
    update.completed_at =
      now;
  }

  if (
    batchStatus ===
    "failed"
  ) {
    update.error_message =
      "All provider enrollment outcomes in this batch failed.";
  } else if (
    batchStatus ===
    "partial"
  ) {
    update.error_message =
      "Provider enrollment batch completed with one or more unsubscribed, failed, or cancelled outcomes.";
  } else {
    update.error_message =
      null;
  }

  const {
    error:
      updateError,
  } =
    await supabase
      .from(
        "outreach_enrollment_batches"
      )
      .update(
        update
      )
      .eq(
        "id",
        batchId
      );

  if (updateError) {
    throw updateError;
  }
}

async function completeRunAuthorizationIfTerminal(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >,
  operationId: string
) {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "complete_outreach_provider_run_authorization_if_terminal",
      {
        p_provider_operation_id:
          operationId,
      }
    );

  if (error) {
    throw error;
  }

  return (
    cleanText(
      data
    ) ||
    null
  );
}

async function markTerminalOutcome(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >,
  params: {
    operationId:
      string;
    enrollmentId:
      string;
    batchId?:
      string | null;
    enrollmentStatus:
      "confirmed" |
      "already_present" |
      "unsubscribed" |
      "failed";
    mappingStatus:
      "confirmed" |
      "already_present" |
      "unsubscribed" |
      "failed";
    operationStatus:
      "completed" |
      "failed";
    providerStatus:
      string;
    providerMessage:
      string;
    providerRecipientId?:
      string | null;
    failureReason?:
      string | null;
    confirmedCount?:
      number;
    alreadyPresentCount?:
      number;
    unsubscribedCount?:
      number;
    failedCount?:
      number;
  }
) {
  const now =
    new Date().toISOString();

  const enrollmentUpdate:
    Record<
      string,
      unknown
    > = {
      status:
        params.enrollmentStatus,

      provider_status:
        params.providerStatus,

      provider_message:
        params.providerMessage,

      updated_at:
        now,
  };

  if (
    params.providerRecipientId
  ) {
    enrollmentUpdate.provider_recipient_id =
      params.providerRecipientId;
  }

  if (
    params.enrollmentStatus ===
    "confirmed"
  ) {
    enrollmentUpdate.confirmed_at =
      now;
  }

  if (
    params.enrollmentStatus ===
    "failed"
  ) {
    enrollmentUpdate.failed_at =
      now;

    enrollmentUpdate.failure_reason =
      params.failureReason ||
      params.providerMessage;
  }

  /*
   * Update the business enrollment first.
   *
   * The operation mapping stays in submitted status until
   * the enrollment update succeeds, preserving the database
   * duplicate-submission reservation if anything fails.
   */
  const {
    error:
      enrollmentError,
  } =
    await supabase
      .from(
        "outreach_enrollments"
      )
      .update(
        enrollmentUpdate
      )
      .eq(
        "id",
        params.enrollmentId
      );

  if (enrollmentError) {
    throw enrollmentError;
  }

  const mappingUpdate:
    Record<
      string,
      unknown
    > = {
      status:
        params.mappingStatus,

      provider_status:
        params.providerStatus,

      provider_message:
        params.providerMessage,

      updated_at:
        now,
  };

  if (
    params.providerRecipientId
  ) {
    mappingUpdate.provider_recipient_id =
      params.providerRecipientId;
  }

  if (
    params.mappingStatus ===
    "confirmed"
  ) {
    mappingUpdate.confirmed_at =
      now;
  }

  if (
    params.mappingStatus ===
    "failed"
  ) {
    mappingUpdate.failed_at =
      now;

    mappingUpdate.failure_reason =
      params.failureReason ||
      params.providerMessage;
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
        params.operationId
      )
      .eq(
        "enrollment_id",
        params.enrollmentId
      );

  if (mappingError) {
    throw mappingError;
  }

  const operationUpdate:
    Record<
      string,
      unknown
    > = {
      status:
        params.operationStatus,

      confirmed_count:
        params.confirmedCount ??
        0,

      already_present_count:
        params.alreadyPresentCount ??
        0,

      unsubscribed_count:
        params.unsubscribedCount ??
        0,

      failed_count:
        params.failedCount ??
        0,

      provider_message:
        params.providerMessage,

      last_checked_at:
        now,

      completed_at:
        now,

      updated_at:
        now,

      error_message:
        params.operationStatus ===
        "failed"
          ? (
              params.failureReason ||
              params.providerMessage
            )
          : null,
  };

  if (
    params.operationStatus ===
    "failed"
  ) {
    operationUpdate.failed_at =
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
        params.operationId
      );

  if (operationError) {
    throw operationError;
  }

  if (
    params.batchId
  ) {
    await refreshEnrollmentBatchStatus(
      supabase,
      params.batchId
    );
  }

  const runAuthorizationStatus =
    await completeRunAuthorizationIfTerminal(
      supabase,
      params.operationId
    );

  return {
    reconciledAt:
      now,

    runAuthorizationStatus,
  };
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
        ProviderStatusPayload;

    const providerOperationId =
      cleanText(
        payload.providerOperationId
      );

    if (
      !UUID_PATTERN.test(
        providerOperationId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid CRM provider operation ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

    /*
     * Reconciliation remains available in both Vercel Preview
     * and Production.
     *
     * Version 13D requires the exact CRM provider-operation ID.
     * Do not infer an operation from campaign/contact selection
     * and do not choose the newest operation mapping.
     *
     * Recipient creation remains exclusively in provider-execution.
     */
    const supabase =
      getSupabaseAdmin();

    const operationId =
      providerOperationId;

    const {
      data:
        operationData,
      error:
        operationError,
    } =
      await supabase
        .from(
          "outreach_provider_operations"
        )
        .select(
          `
          id,
          status,
          provider_campaign_id,
          provider_check_status_id
          `
        )
        .eq(
          "id",
          operationId
        )
        .maybeSingle();

    if (operationError) {
      throw operationError;
    }

    const operation =
      operationData as
        ProviderOperationRow |
        null;

    if (!operation) {
      return NextResponse.json(
        {
          error:
            "The requested CRM provider operation could not be found.",
        },
        {
          status:
            404,
        }
      );
    }

    const providerCampaignId =
      cleanText(
        operation.provider_campaign_id
      );

    if (!providerCampaignId) {
      return NextResponse.json(
        {
          error:
            "Provider-status reconciliation stopped because this CRM provider operation does not identify a Mailshake campaign.",
        },
        {
          status:
            409,
        }
      );
    }

    /*
     * Provider execution currently permits exactly one recipient
     * per provider operation. Reconciliation therefore requires
     * exactly one operation/enrollment mapping as well.
     *
     * Read at most two rows so unexpected duplicate mappings
     * fail closed instead of being silently guessed.
     */
    const {
      data:
        mappingData,
      error:
        mappingError,
    } =
      await supabase
        .from(
          "outreach_provider_operation_enrollments"
        )
        .select(
          `
          operation_id,
          enrollment_id,
          submitted_email,
          status,
          provider_recipient_id,
          provider_status
          `
        )
        .eq(
          "operation_id",
          operationId
        )
        .limit(
          2
        );

    if (mappingError) {
      throw mappingError;
    }

    const mappings =
      (
        mappingData ??
        []
      ) as
        OperationMappingRow[];

    if (
      mappings.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "No CRM enrollment mapping exists for this provider operation.",
        },
        {
          status:
            404,
        }
      );
    }

    if (
      mappings.length !==
      1
    ) {
      return NextResponse.json(
        {
          error:
            "Provider-status reconciliation stopped because this provider operation does not map to exactly one CRM enrollment.",
        },
        {
          status:
            409,
        }
      );
    }

    const mapping =
      mappings[0] as
        OperationMappingRow;

    const enrollmentId =
      cleanText(
        mapping.enrollment_id
      );

    if (
      !UUID_PATTERN.test(
        enrollmentId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Provider-status reconciliation stopped because the provider-operation mapping does not identify a valid CRM enrollment.",
        },
        {
          status:
            409,
        }
      );
    }

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
          provider_campaign_id,
          normalized_email,
          status,
          provider_recipient_id,
          provider_status
          `
        )
        .eq(
          "id",
          enrollmentId
        )
        .eq(
          "provider",
          "mailshake"
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
            "The CRM Mailshake enrollment mapped to this provider operation could not be found.",
        },
        {
          status:
            404,
        }
      );
    }

    const submittedEmail =
      normalizeEmail(
        enrollment.normalized_email
      );

    if (!submittedEmail) {
      return NextResponse.json(
        {
          error:
            "Provider-status reconciliation stopped because the mapped CRM enrollment does not contain a normalized email.",
        },
        {
          status:
            409,
        }
      );
    }

    if (
      normalizeEmail(
        mapping.submitted_email
      ) !==
      submittedEmail
    ) {
      return NextResponse.json(
        {
          error:
            "Provider-status reconciliation stopped because the provider-operation email does not match the mapped CRM enrollment.",
        },
        {
          status:
            409,
        }
      );
    }

    if (
      cleanText(
        enrollment.provider_campaign_id
      ) !==
      providerCampaignId
    ) {
      return NextResponse.json(
        {
          error:
            "Provider-status reconciliation stopped because the provider operation and mapped CRM enrollment do not belong to the same Mailshake campaign.",
        },
        {
          status:
            409,
        }
      );
    }
    const operationStatus =
      cleanText(
        operation.status
      ).toLowerCase();

    /*
     * Idempotent terminal response.
     * Once CRM has already reconciled this operation, do not
     * call Mailshake again just because the user clicks again.
     */
    if (
      [
        "completed",
        "failed",
        "cancelled",
      ].includes(
        operationStatus
      )
    ) {
      const batchId =
        cleanText(
          enrollment.batch_id
        );

      if (batchId) {
        await refreshEnrollmentBatchStatus(
          supabase,
          batchId
        );
      }

      const runAuthorizationStatus =
        await completeRunAuthorizationIfTerminal(
          supabase,
          operationId
        );

      return NextResponse.json(
        {
          mode:
            "provider-status",

          status:
            cleanText(
              enrollment.status
            ) ||
            operationStatus,

          operationId,

          operationStatus,

          providerCheckStatusId:
            cleanText(
              operation.provider_check_status_id
            ) ||
            null,

          enrollmentStatus:
            cleanText(
              enrollment.status
            ),

          providerRecipientId:
            cleanText(
              enrollment.provider_recipient_id
            ) ||
            null,

          runAuthorizationStatus,

          isFinished:
            true,

          message:
            "This provider operation has already been reconciled in CRM. The related CRM enrollment batch and linked run authorization were also re-evaluated.",
        }
      );
    }

    if (
      operationStatus ===
      "partial"
    ) {
      return NextResponse.json(
        {
          mode:
            "provider-status",

          status:
            "reconciliation_required",

          operationId,

          operationStatus,

          enrollmentStatus:
            cleanText(
              enrollment.status
            ),

          providerRecipientId:
            cleanText(
              enrollment.provider_recipient_id
            ) ||
            null,

          isFinished:
            true,

          message:
            "Mailshake finished processing, but CRM could not map the provider result safely. Manual reconciliation is required.",
        },
        {
          status:
            409,
        }
      );
    }

    const checkStatusId =
      cleanText(
        operation.provider_check_status_id
      );

    if (!checkStatusId) {
      return NextResponse.json(
        {
          error:
            "This provider operation does not have a Mailshake checkStatusID. Do not retry the recipient submission; reconciliation is required.",
        },
        {
          status:
            409,
        }
      );
    }

    if (
      ![
        "submitted",
        "checking",
        "submission_unknown",
      ].includes(
        operationStatus
      )
    ) {
      return NextResponse.json(
        {
          error:
            `Provider status cannot be checked from CRM operation state "${operationStatus || "unknown"}".`,
        },
        {
          status:
            409,
        }
      );
    }

    await updateOperationChecking(
      supabase,
      operationId,
      "CRM is checking Mailshake recipients/add-status."
    );

    let addStatus:
      AddedRecipientsResponse;

    try {
      addStatus =
        await readMailshakeAddStatus(
          checkStatusId
        );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Mailshake add-status could not be read.";

      const now =
        new Date().toISOString();

      await supabase
        .from(
          "outreach_provider_operations"
        )
        .update({
          status:
            "checking",

          provider_message:
            `Mailshake status check did not complete: ${message}`,

          last_checked_at:
            now,

          updated_at:
            now,
        })
        .eq(
          "id",
          operationId
        );

      return NextResponse.json(
        {
          error:
            `${message} The original recipient submission was not retried.`,

          operationId,

          providerCheckStatusId:
            checkStatusId,
        },
        {
          status:
            502,
        }
      );
    }

    if (
      addStatus.isFinished !==
      true
    ) {
      await updateOperationChecking(
        supabase,
        operationId,
        "Mailshake reports that the asynchronous recipient import is still processing."
      );

      return NextResponse.json(
        {
          mode:
            "provider-status",

          status:
            "processing",

          operationStatus:
            "checking",

          operationId,

          providerCheckStatusId:
            checkStatusId,

          isFinished:
            false,

          enrollmentStatus:
            cleanText(
              enrollment.status
            ),

          message:
            "Mailshake is still processing the recipient import. Keep the campaign paused and check again later.",
        },
        {
          status:
            202,
        }
      );
    }

    const problems =
      addStatus.problems ??
      {};

    const unsubscribedEmails =
      normalizedEmailList(
        problems.unsubscribedEmails
      );

    const alreadyInCampaignEmails =
      normalizedEmailList(
        problems.alreadyInCampaignEmails
      );

    const passedAccountLimitEmails =
      normalizedEmailList(
        problems.passedAccountLimitEmails
      );

    if (
      unsubscribedEmails.includes(
        submittedEmail
      )
    ) {
      const providerMessage =
        "Mailshake finished the import and reported that this email is unsubscribed.";

      await markTerminalOutcome(
        supabase,
        {
          operationId,

          enrollmentId,

          batchId:
            cleanText(
              enrollment.batch_id
            ) ||
            null,

          enrollmentStatus:
            "unsubscribed",

          mappingStatus:
            "unsubscribed",

          operationStatus:
            "completed",

          providerStatus:
            "unsubscribed",

          providerMessage,

          unsubscribedCount:
            1,
        }
      );

      return NextResponse.json(
        {
          mode:
            "provider-status",

          status:
            "unsubscribed",

          operationStatus:
            "completed",

          operationId,

          providerCheckStatusId:
            checkStatusId,

          isFinished:
            true,

          enrollmentStatus:
            "unsubscribed",

          providerRecipientId:
            null,

          message:
            providerMessage,
        }
      );
    }

    if (
      alreadyInCampaignEmails.includes(
        submittedEmail
      )
    ) {
      let recipientId:
        string |
        null =
          null;

      try {
        const recipient =
          await readMailshakeRecipient(
            providerCampaignId,
            submittedEmail
          );

        if (
          recipient.exists
        ) {
          recipientId =
            recipient.recipientId;
        }
      } catch (error) {
        console.error(
          "[mailshake-already-present-recipient-lookup]",
          error
        );
      }

      const providerMessage =
        "Mailshake finished the import and reported that this email was already present in the campaign.";

      await markTerminalOutcome(
        supabase,
        {
          operationId,

          enrollmentId,

          batchId:
            cleanText(
              enrollment.batch_id
            ) ||
            null,

          enrollmentStatus:
            "already_present",

          mappingStatus:
            "already_present",

          operationStatus:
            "completed",

          providerStatus:
            "already_present",

          providerMessage,

          providerRecipientId:
            recipientId,

          alreadyPresentCount:
            1,
        }
      );

      return NextResponse.json(
        {
          mode:
            "provider-status",

          status:
            "already_present",

          operationStatus:
            "completed",

          operationId,

          providerCheckStatusId:
            checkStatusId,

          isFinished:
            true,

          enrollmentStatus:
            "already_present",

          providerRecipientId:
            recipientId,

          message:
            providerMessage,
        }
      );
    }

    if (
      passedAccountLimitEmails.includes(
        submittedEmail
      )
    ) {
      const providerMessage =
        "Mailshake finished the import but rejected this recipient because the applicable recipient/account limit was exceeded.";

      await markTerminalOutcome(
        supabase,
        {
          operationId,

          enrollmentId,

          batchId:
            cleanText(
              enrollment.batch_id
            ) ||
            null,

          enrollmentStatus:
            "failed",

          mappingStatus:
            "failed",

          operationStatus:
            "failed",

          providerStatus:
            "failed",

          providerMessage,

          failureReason:
            providerMessage,

          failedCount:
            1,
        }
      );

      return NextResponse.json(
        {
          mode:
            "provider-status",

          status:
            "failed",

          operationStatus:
            "failed",

          operationId,

          providerCheckStatusId:
            checkStatusId,

          isFinished:
            true,

          enrollmentStatus:
            "failed",

          providerRecipientId:
            null,

          message:
            providerMessage,
        },
        {
          status:
            409,
        }
      );
    }

    /*
     * Mailshake says processing is finished and the submitted email
     * is not in any documented problem list.
     *
     * Do not mark CRM confirmed from that inference alone.
     * Require Mailshake recipients/get to return the exact
     * recipient first.
     */
    const recipient =
      await readMailshakeRecipient(
        providerCampaignId,
        submittedEmail
      );

    if (
      recipient.exists &&
      recipient.recipientId
    ) {
      const providerMessage =
        "Mailshake finished the asynchronous import and recipients/get confirmed that the recipient exists in the campaign.";

      await markTerminalOutcome(
        supabase,
        {
          operationId,

          enrollmentId,

          batchId:
            cleanText(
              enrollment.batch_id
            ) ||
            null,

          enrollmentStatus:
            "confirmed",

          mappingStatus:
            "confirmed",

          operationStatus:
            "completed",

          providerStatus:
            "confirmed",

          providerMessage,

          providerRecipientId:
            recipient.recipientId,

          confirmedCount:
            1,
        }
      );

      return NextResponse.json(
        {
          mode:
            "provider-status",

          status:
            "confirmed",

          operationStatus:
            "completed",

          operationId,

          providerCheckStatusId:
            checkStatusId,

          isFinished:
            true,

          enrollmentStatus:
            "confirmed",

          providerRecipientId:
            recipient.recipientId,

          message:
            providerMessage,
        }
      );
    }

    /*
     * add-status finished but the recipient is not visible yet.
     * Do not guess and do not release the submitted mapping
     * reservation. A later status check may reconcile it.
     */
    if (
      problems.hasProblems !==
      true
    ) {
      await updateOperationChecking(
        supabase,
        operationId,
        "Mailshake reports that the import finished without a documented problem, but recipients/get does not yet return the recipient. CRM remains submitted and will not retry the recipient-add request."
      );

      return NextResponse.json(
        {
          mode:
            "provider-status",

          status:
            "processing",

          operationStatus:
            "checking",

          operationId,

          providerCheckStatusId:
            checkStatusId,

          isFinished:
            true,

          enrollmentStatus:
            cleanText(
              enrollment.status
            ),

          providerRecipientId:
            null,

          message:
            "Mailshake says the import finished, but CRM cannot yet verify the recipient record. Keep the campaign paused and check again; do not resubmit.",
        },
        {
          status:
            202,
        }
      );
    }

    /*
     * Mailshake says there was a problem, but none of its
     * documented email problem arrays match our one submitted
     * allowlisted recipient. Fail closed and preserve the submitted
     * mapping reservation.
     */
    const now =
      new Date().toISOString();

    const {
      error:
        partialError,
    } =
      await supabase
        .from(
          "outreach_provider_operations"
        )
        .update({
          status:
            "partial",

          provider_message:
            "Mailshake finished with a problem, but CRM could not map the problem safely to the submitted recipient. Manual reconciliation is required.",

          last_checked_at:
            now,

          completed_at:
            now,

          updated_at:
            now,
        })
        .eq(
          "id",
          operationId
        );

    if (partialError) {
      throw partialError;
    }

    return NextResponse.json(
      {
        mode:
          "provider-status",

        status:
          "reconciliation_required",

        operationStatus:
          "partial",

        operationId,

        providerCheckStatusId:
          checkStatusId,

        isFinished:
          true,

        enrollmentStatus:
          cleanText(
            enrollment.status
          ),

        providerRecipientId:
          null,

        message:
          "Mailshake finished processing but CRM could not safely classify its problem response. The recipient submission must not be retried.",
      },
      {
        status:
          409,
      }
    );
  } catch (error) {
    console.error(
      "[mailshake-provider-status]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not reconcile the Mailshake recipient import.",
      },
      {
        status:
          500,
      }
    );
  }
}