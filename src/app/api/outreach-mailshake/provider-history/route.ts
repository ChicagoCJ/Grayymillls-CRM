import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { verifySignedInCrmUser } from "../../_shared/verified-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function uniqueValues(
  values: unknown[]
) {
  return Array.from(
    new Set(
      values
        .map(
          cleanText
        )
        .filter(Boolean)
    )
  );
}

export async function GET(
  request: Request
) {
  try {
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
            "Mailshake provider history is restricted to CRM Admin and Sales Manager users.",
        },
        {
          status:
            403,
        }
      );
    }

    const requestUrl =
      new URL(
        request.url
      );

    const requestedLimit =
      Number(
        requestUrl.searchParams.get(
          "limit"
        ) ||
        25
      );

    const limit =
      Number.isFinite(
        requestedLimit
      )
        ? Math.min(
            100,
            Math.max(
              1,
              Math.trunc(
                requestedLimit
              )
            )
          )
        : 25;

    const supabase =
      getSupabaseAdmin();

    /*
     * CRM database only.
     *
     * This endpoint deliberately does NOT call Mailshake.
     * It is an audit/history reader.
     */
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
          provider,
          operation_type,
          outreach_campaign_id,
          provider_campaign_id,
          status,
          provider_check_status_id,
          requested_by_crm_user_id,
          requested_by_display_name,
          requested_count,
          submitted_count,
          confirmed_count,
          already_present_count,
          unsubscribed_count,
          failed_count,
          provider_message,
          error_message,
          requested_at,
          submitted_at,
          last_checked_at,
          completed_at,
          failed_at,
          created_at,
          updated_at
          `
        )
        .eq(
          "provider",
          "mailshake"
        )
        .order(
          "requested_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          limit
        );

    if (operationError) {
      throw operationError;
    }

    const operations =
      operationData ??
      [];

    const operationIds =
      uniqueValues(
        operations.map(
          (operation) =>
            operation.id
        )
      );

    let mappings:
      any[] = [];

    if (
      operationIds.length >
      0
    ) {
      const {
        data,
        error,
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
            provider_status,
            provider_message,
            submitted_at,
            confirmed_at,
            failed_at,
            failure_reason,
            updated_at
            `
          )
          .in(
            "operation_id",
            operationIds
          );

      if (error) {
        throw error;
      }

      mappings =
        data ??
        [];
    }

    const enrollmentIds =
      uniqueValues(
        mappings.map(
          (mapping) =>
            mapping.enrollment_id
        )
      );

    let enrollments:
      any[] = [];

    if (
      enrollmentIds.length >
      0
    ) {
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
            batch_id,
            contact_id,
            company_id,
            normalized_email,
            status,
            provider_recipient_id,
            provider_status,
            provider_message,
            requested_at,
            submitted_at,
            confirmed_at,
            failed_at,
            failure_reason,
            updated_at
            `
          )
          .in(
            "id",
            enrollmentIds
          );

      if (error) {
        throw error;
      }

      enrollments =
        data ??
        [];
    }

    const enrollmentById =
      new Map(
        enrollments.map(
          (enrollment) => [
            cleanText(
              enrollment.id
            ),
            enrollment,
          ]
        )
      );

    const batchIds =
      uniqueValues(
        enrollments.map(
          (enrollment) =>
            enrollment.batch_id
        )
      );

    let batches:
      any[] = [];

    if (
      batchIds.length >
      0
    ) {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "outreach_enrollment_batches"
          )
          .select(
            `
            id,
            campaign_name,
            provider_campaign_id,
            status,
            requested_at,
            submitted_at,
            completed_at,
            error_message,
            updated_at
            `
          )
          .in(
            "id",
            batchIds
          );

      if (error) {
        throw error;
      }

      batches =
        data ??
        [];
    }

    const batchById =
      new Map(
        batches.map(
          (batch) => [
            cleanText(
              batch.id
            ),
            batch,
          ]
        )
      );

    const contactIds =
      uniqueValues(
        enrollments.map(
          (enrollment) =>
            enrollment.contact_id
        )
      );

    let contacts:
      any[] = [];

    if (
      contactIds.length >
      0
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
            first_name,
            last_name,
            full_name,
            email
            `
          )
          .in(
            "id",
            contactIds
          );

      if (error) {
        throw error;
      }

      contacts =
        data ??
        [];
    }

    const contactById =
      new Map(
        contacts.map(
          (contact) => [
            cleanText(
              contact.id
            ),
            contact,
          ]
        )
      );

    const companyIds =
      uniqueValues(
        enrollments.map(
          (enrollment) =>
            enrollment.company_id
        )
      );

    let companies:
      any[] = [];

    if (
      companyIds.length >
      0
    ) {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "companies"
          )
          .select(
            `
            id,
            company_name
            `
          )
          .in(
            "id",
            companyIds
          );

      if (error) {
        throw error;
      }

      companies =
        data ??
        [];
    }

    const companyById =
      new Map(
        companies.map(
          (company) => [
            cleanText(
              company.id
            ),
            company,
          ]
        )
      );

    const mappingsByOperation =
      new Map<
        string,
        any[]
      >();

    for (
      const mapping of
      mappings
    ) {
      const operationId =
        cleanText(
          mapping.operation_id
        );

      if (!operationId) {
        continue;
      }

      const existing =
        mappingsByOperation.get(
          operationId
        ) ??
        [];

      existing.push(
        mapping
      );

      mappingsByOperation.set(
        operationId,
        existing
      );
    }

    const history =
      operations.map(
        (operation) => {
          const operationId =
            cleanText(
              operation.id
            );

          const operationMappings =
            mappingsByOperation.get(
              operationId
            ) ??
            [];

          const recipients =
            operationMappings.map(
              (mapping) => {
                const enrollment =
                  enrollmentById.get(
                    cleanText(
                      mapping.enrollment_id
                    )
                  );

                const batch =
                  enrollment
                    ? batchById.get(
                        cleanText(
                          enrollment.batch_id
                        )
                      )
                    : null;

                const contact =
                  enrollment
                    ? contactById.get(
                        cleanText(
                          enrollment.contact_id
                        )
                      )
                    : null;

                const company =
                  enrollment
                    ? companyById.get(
                        cleanText(
                          enrollment.company_id
                        )
                      )
                    : null;

                const contactName =
                  cleanText(
                    contact?.full_name
                  ) ||
                  [
                    cleanText(
                      contact?.first_name
                    ),
                    cleanText(
                      contact?.last_name
                    ),
                  ]
                    .filter(Boolean)
                    .join(" ") ||
                  null;

                return {
                  enrollmentId:
                    cleanText(
                      mapping.enrollment_id
                    ),

                  batchId:
                    cleanText(
                      enrollment?.batch_id
                    ) ||
                    null,

                  batchStatus:
                    cleanText(
                      batch?.status
                    ) ||
                    null,

                  campaignName:
                    cleanText(
                      batch?.campaign_name
                    ) ||
                    null,

                  contactId:
                    cleanText(
                      enrollment?.contact_id
                    ) ||
                    null,

                  contactName,

                  companyId:
                    cleanText(
                      enrollment?.company_id
                    ) ||
                    null,

                  companyName:
                    cleanText(
                      company?.company_name
                    ) ||
                    null,

                  submittedEmail:
                    cleanText(
                      mapping.submitted_email
                    ) ||
                    cleanText(
                      enrollment?.normalized_email
                    ) ||
                    cleanText(
                      contact?.email
                    ) ||
                    null,

                  enrollmentStatus:
                    cleanText(
                      enrollment?.status
                    ) ||
                    null,

                  mappingStatus:
                    cleanText(
                      mapping.status
                    ) ||
                    null,

                  providerRecipientId:
                    cleanText(
                      mapping.provider_recipient_id
                    ) ||
                    cleanText(
                      enrollment?.provider_recipient_id
                    ) ||
                    null,

                  providerStatus:
                    cleanText(
                      mapping.provider_status
                    ) ||
                    cleanText(
                      enrollment?.provider_status
                    ) ||
                    null,

                  providerMessage:
                    cleanText(
                      mapping.provider_message
                    ) ||
                    cleanText(
                      enrollment?.provider_message
                    ) ||
                    null,

                  requestedAt:
                    cleanText(
                      enrollment?.requested_at
                    ) ||
                    null,

                  submittedAt:
                    cleanText(
                      mapping.submitted_at
                    ) ||
                    cleanText(
                      enrollment?.submitted_at
                    ) ||
                    null,

                  confirmedAt:
                    cleanText(
                      mapping.confirmed_at
                    ) ||
                    cleanText(
                      enrollment?.confirmed_at
                    ) ||
                    null,

                  failedAt:
                    cleanText(
                      mapping.failed_at
                    ) ||
                    cleanText(
                      enrollment?.failed_at
                    ) ||
                    null,

                  failureReason:
                    cleanText(
                      mapping.failure_reason
                    ) ||
                    cleanText(
                      enrollment?.failure_reason
                    ) ||
                    null,
                };
              }
            );

          const campaignNames =
            uniqueValues(
              recipients.map(
                (recipient) =>
                  recipient.campaignName
              )
            );

          return {
            id:
              operationId,

            provider:
              cleanText(
                operation.provider
              ),

            operationType:
              cleanText(
                operation.operation_type
              ),

            outreachCampaignId:
              cleanText(
                operation.outreach_campaign_id
              ) ||
              null,

            providerCampaignId:
              cleanText(
                operation.provider_campaign_id
              ),

            campaignName:
              campaignNames[0] ||
              null,

            status:
              cleanText(
                operation.status
              ),

            providerCheckStatusId:
              cleanText(
                operation.provider_check_status_id
              ) ||
              null,

            requestedByCrmUserId:
              cleanText(
                operation.requested_by_crm_user_id
              ) ||
              null,

            requestedByDisplayName:
              cleanText(
                operation.requested_by_display_name
              ) ||
              null,

            requestedCount:
              Number(
                operation.requested_count ??
                0
              ),

            submittedCount:
              Number(
                operation.submitted_count ??
                0
              ),

            confirmedCount:
              Number(
                operation.confirmed_count ??
                0
              ),

            alreadyPresentCount:
              Number(
                operation.already_present_count ??
                0
              ),

            unsubscribedCount:
              Number(
                operation.unsubscribed_count ??
                0
              ),

            failedCount:
              Number(
                operation.failed_count ??
                0
              ),

            providerMessage:
              cleanText(
                operation.provider_message
              ) ||
              null,

            errorMessage:
              cleanText(
                operation.error_message
              ) ||
              null,

            requestedAt:
              cleanText(
                operation.requested_at
              ) ||
              null,

            submittedAt:
              cleanText(
                operation.submitted_at
              ) ||
              null,

            lastCheckedAt:
              cleanText(
                operation.last_checked_at
              ) ||
              null,

            completedAt:
              cleanText(
                operation.completed_at
              ) ||
              null,

            failedAt:
              cleanText(
                operation.failed_at
              ) ||
              null,

            recipients,
          };
        }
      );

    return NextResponse.json(
      {
        mode:
          "provider-history",

        readOnly:
          true,

        provider:
          "mailshake",

        count:
          history.length,

        operations:
          history,

        message:
          "CRM provider operation history loaded. No Mailshake provider action was performed.",
      }
    );
  } catch (error) {
    console.error(
      "[mailshake-provider-history]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load Mailshake provider operation history.",
      },
      {
        status:
          500,
      }
    );
  }
}