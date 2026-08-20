import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { verifySignedInCrmUser } from "../../_shared/verified-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAGE_SIZE = 500;
const MAX_PAGES = 50;
const MAX_SELECTED_CONTACTS = 10000;

type EnrollmentAction =
  | "review"
  | "record";

type SelectionMode =
  | "individual"
  | "select_all_filtered";

type EnrollmentPayload = {
  action?: EnrollmentAction;
  providerCampaignId?: string;
  campaignName?: string;
  campaignStatus?: string;
  selectionMode?: SelectionMode;
  filterSnapshot?: unknown;
  contactIds?: string[];
};

type ContactRow = {
  id?: string;
  company_id?: string;
  email?: string | null;
};

type ExistingEnrollmentRow = {
  contact_id?: string | null;
};

type PreparedContact = {
  contactId: string;
  companyId: string;
  normalizedEmail: string;
};

type BlockedContact = {
  contactId: string;
  reason: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function splitIntoChunks<T>(
  values: T[],
  chunkSize = PAGE_SIZE
) {
  const chunks:
    T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += chunkSize
  ) {
    chunks.push(
      values.slice(
        index,
        index + chunkSize
      )
    );
  }

  return chunks;
}

function cleanFilterSnapshot(
  value: unknown
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const serialized =
    JSON.stringify(value);

  if (
    serialized.length >
    20000
  ) {
    throw new Error(
      "The CRM outreach filter snapshot is unexpectedly large."
    );
  }

  return JSON.parse(
    serialized
  ) as Record<
    string,
    unknown
  >;
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

      context: null,
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
              "Mailshake outreach enrollment is restricted to CRM Admin and Sales Manager users.",
          },
          {
            status: 403,
          }
        ),

      context: null,
    };
  }

  return {
    response: null,
    context:
      verification.context,
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
      .from("crm_tags")
      .select("id")
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
    Array.isArray(data)
      ? data
      : [];

  if (
    rows.length !== 1
  ) {
    throw new Error(
      'CRM outreach stopped because the active "Do Not Contact" safety control could not be identified uniquely.'
    );
  }

  return cleanText(
    rows[0]?.id
  );
}

async function readRequestedContacts(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >,
  contactIds: string[]
) {
  const contactById =
    new Map<
      string,
      ContactRow
    >();

  for (
    const chunk of
    splitIntoChunks(
      contactIds
    )
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from("contacts")
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
        .in(
          "id",
          chunk
        )
        .is(
          "archived_at",
          null
        )
        .is(
          "companies.archived_at",
          null
        );

    if (error) {
      throw error;
    }

    const rows =
      Array.isArray(data)
        ? (data as ContactRow[])
        : [];

    rows.forEach(
      (row) => {
        const id =
          cleanText(
            row.id
          );

        if (id) {
          contactById.set(
            id,
            row
          );
        }
      }
    );
  }

  return contactById;
}

async function readDoNotContactAssignments(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >,
  contactIds: string[],
  doNotContactTagId: string
) {
  const blockedIds =
    new Set<string>();

  for (
    const chunk of
    splitIntoChunks(
      contactIds
    )
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from("contact_tags")
        .select(
          "contact_id"
        )
        .eq(
          "tag_id",
          doNotContactTagId
        )
        .in(
          "contact_id",
          chunk
        );

    if (error) {
      throw error;
    }

    const rows =
      Array.isArray(data)
        ? data
        : [];

    rows.forEach(
      (row) => {
        const contactId =
          cleanText(
            row.contact_id
          );

        if (contactId) {
          blockedIds.add(
            contactId
          );
        }
      }
    );
  }

  return blockedIds;
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

  let pagesRead = 0;
  let complete = false;

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
        .from("contacts")
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
            ascending: false,
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
      Array.isArray(data)
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
          ) + 1
        );
      }
    );

    pagesRead += 1;

    if (
      rows.length <
      PAGE_SIZE
    ) {
      complete = true;
      break;
    }
  }

  if (!complete) {
    throw new Error(
      `CRM outreach stopped because the active contact population exceeded the safety limit of ${PAGE_SIZE * MAX_PAGES} rows.`
    );
  }

  return counts;
}

async function readExistingCampaign(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >,
  providerCampaignId: string
) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "outreach_campaigns"
      )
      .select(
        "id, provider, provider_campaign_id, campaign_name, campaign_status"
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

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function readExistingEnrollmentIds(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >,
  outreachCampaignId: string,
  contactIds: string[]
) {
  const existingIds =
    new Set<string>();

  if (
    !outreachCampaignId ||
    contactIds.length === 0
  ) {
    return existingIds;
  }

  for (
    const chunk of
    splitIntoChunks(
      contactIds
    )
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
          "contact_id"
        )
        .eq(
          "outreach_campaign_id",
          outreachCampaignId
        )
        .in(
          "contact_id",
          chunk
        );

    if (error) {
      throw error;
    }

    const rows =
      Array.isArray(data)
        ? (
            data as
              ExistingEnrollmentRow[]
          )
        : [];

    rows.forEach(
      (row) => {
        const contactId =
          cleanText(
            row.contact_id
          );

        if (contactId) {
          existingIds.add(
            contactId
          );
        }
      }
    );
  }

  return existingIds;
}

async function prepareEnrollmentReview(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >,
  providerCampaignId: string,
  contactIds: string[]
) {
  const [
    doNotContactTagId,
    contactById,
    emailCounts,
  ] =
    await Promise.all([
      readDoNotContactTagId(
        supabase
      ),

      readRequestedContacts(
        supabase,
        contactIds
      ),

      readActiveEmailCounts(
        supabase
      ),
    ]);

  const doNotContactIds =
    await readDoNotContactAssignments(
      supabase,
      contactIds,
      doNotContactTagId
    );

  const eligible:
    PreparedContact[] = [];

  const blocked:
    BlockedContact[] = [];

  for (
    const contactId of
    contactIds
  ) {
    const row =
      contactById.get(
        contactId
      );

    if (!row) {
      blocked.push({
        contactId,

        reason:
          "Blocked: the contact is archived, missing, or belongs to an archived company.",
      });

      continue;
    }

    const companyId =
      cleanText(
        row.company_id
      );

    const normalizedEmail =
      normalizeEmail(
        row.email
      );

    if (!companyId) {
      blocked.push({
        contactId,

        reason:
          "Blocked: the contact is not attached to a valid active CRM company.",
      });

      continue;
    }

    if (!normalizedEmail) {
      blocked.push({
        contactId,

        reason:
          "Blocked: the CRM contact does not have an email address.",
      });

      continue;
    }

    if (
      doNotContactIds.has(
        contactId
      )
    ) {
      blocked.push({
        contactId,

        reason:
          'Blocked: the CRM contact currently has the "Do Not Contact" tag.',
      });

      continue;
    }

    if (
      (
        emailCounts.get(
          normalizedEmail
        ) ??
        0
      ) > 1
    ) {
      blocked.push({
        contactId,

        reason:
          "Blocked: multiple active CRM contacts currently share this normalized email address.",
      });

      continue;
    }

    eligible.push({
      contactId,
      companyId,
      normalizedEmail,
    });
  }

  const existingCampaign =
    await readExistingCampaign(
      supabase,
      providerCampaignId
    );

  const existingEnrollmentIds =
    existingCampaign?.id
      ? await readExistingEnrollmentIds(
          supabase,
          String(
            existingCampaign.id
          ),
          eligible.map(
            (contact) =>
              contact.contactId
          )
        )
      : new Set<string>();

  const newContacts =
    eligible.filter(
      (contact) =>
        !existingEnrollmentIds.has(
          contact.contactId
        )
    );

  return {
    eligible,
    blocked,
    existingCampaign,
    existingEnrollmentIds,
    newContacts,
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
      ) as EnrollmentPayload;

    const action =
      payload.action ===
      "record"
        ? "record"
        : payload.action ===
            "review"
          ? "review"
          : null;

    if (!action) {
      return NextResponse.json(
        {
          error:
            'action must be "review" or "record".',
        },
        {
          status: 400,
        }
      );
    }

    const providerCampaignId =
      cleanText(
        payload.providerCampaignId
      ).slice(
        0,
        100
      );

    const campaignName =
      cleanText(
        payload.campaignName
      ).slice(
        0,
        300
      );

    const campaignStatus =
      cleanText(
        payload.campaignStatus
      ).toLowerCase();

    const selectionMode:
      SelectionMode =
        payload.selectionMode ===
        "select_all_filtered"
          ? "select_all_filtered"
          : "individual";

    if (
      !providerCampaignId
    ) {
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

    if (!campaignName) {
      return NextResponse.json(
        {
          error:
            "A Mailshake campaign name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      ![
        "active",
        "paused",
        "archived",
      ].includes(
        campaignStatus
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The Mailshake campaign status is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      campaignStatus ===
      "archived"
    ) {
      return NextResponse.json(
        {
          error:
            "Archived Mailshake campaigns cannot receive new CRM enrollment instructions.",
        },
        {
          status: 409,
        }
      );
    }

    const rawContactIds =
      Array.isArray(
        payload.contactIds
      )
        ? payload.contactIds
        : [];

    const contactIds =
      Array.from(
        new Set(
          rawContactIds
            .map(cleanText)
            .filter(Boolean)
        )
      );

    if (
      contactIds.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Select at least one CRM contact.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      contactIds.length >
      MAX_SELECTED_CONTACTS
    ) {
      return NextResponse.json(
        {
          error:
            `A single CRM enrollment action is limited to ${MAX_SELECTED_CONTACTS} selected contacts.`,
        },
        {
          status: 400,
        }
      );
    }

    const invalidContactId =
      contactIds.find(
        (contactId) =>
          !UUID_PATTERN.test(
            contactId
          )
      );

    if (invalidContactId) {
      return NextResponse.json(
        {
          error:
            "One or more selected CRM contact IDs are invalid.",
        },
        {
          status: 400,
        }
      );
    }

    const filterSnapshot =
      cleanFilterSnapshot(
        payload.filterSnapshot
      );

    const supabase =
      getSupabaseAdmin();

    const review =
      await prepareEnrollmentReview(
        supabase,
        providerCampaignId,
        contactIds
      );

    const baseResponse = {
      provider:
        "mailshake",

      providerCampaignId,

      campaignName,

      campaignStatus,

      selectionMode,

      requestedCount:
        contactIds.length,

      eligibleCount:
        review.eligible.length,

      blockedCount:
        review.blocked.length,

      alreadyRecordedCount:
        review.existingEnrollmentIds.size,

      newEnrollmentCount:
        review.newContacts.length,

      blocked:
        review.blocked,

      alreadyRecordedContactIds:
        Array.from(
          review.existingEnrollmentIds
        ),
    };

    if (
      action === "review"
    ) {
      return NextResponse.json({
        status:
          "reviewed",

        mode:
          "crm-review-only",

        ...baseResponse,

        message:
          `Server review complete. ${review.newContacts.length} contact${review.newContacts.length === 1 ? "" : "s"} can be newly recorded for this CRM outreach campaign. No CRM enrollment records were changed and nothing was submitted to Mailshake.`,
      });
    }

    if (
      review.newContacts.length ===
      0
    ) {
      return NextResponse.json({
        status:
          "no_new_enrollments",

        mode:
          "crm-record-only",

        batchId:
          null,

        recordedEnrollmentCount:
          0,

        ...baseResponse,

        message:
          "CRM revalidation found no new enrollment records to create. Nothing was submitted to Mailshake.",
      });
    }

    const now =
      new Date().toISOString();

    const {
      data:
        outreachCampaign,
      error:
        campaignError,
    } =
      await supabase
        .from(
          "outreach_campaigns"
        )
        .upsert(
          {
            provider:
              "mailshake",

            provider_campaign_id:
              providerCampaignId,

            campaign_name:
              campaignName,

            campaign_status:
              campaignStatus,

            last_synced_at:
              now,

            updated_at:
              now,
          },
          {
            onConflict:
              "provider,provider_campaign_id",
          }
        )
        .select(
          "id, provider_campaign_id, campaign_name, campaign_status"
        )
        .single();

    if (campaignError) {
      throw campaignError;
    }

    const outreachCampaignId =
      cleanText(
        outreachCampaign?.id
      );

    if (!outreachCampaignId) {
      throw new Error(
        "The CRM could not establish the outreach campaign identity."
      );
    }

    /*
     * Re-check existing enrollment rows after the campaign
     * upsert to protect against another request recording
     * the same contact at nearly the same time.
     */
    const freshExistingIds =
      await readExistingEnrollmentIds(
        supabase,
        outreachCampaignId,
        review.eligible.map(
          (contact) =>
            contact.contactId
        )
      );

    const contactsToRecord =
      review.eligible.filter(
        (contact) =>
          !freshExistingIds.has(
            contact.contactId
          )
      );

    if (
      contactsToRecord.length ===
      0
    ) {
      return NextResponse.json({
        status:
          "no_new_enrollments",

        mode:
          "crm-record-only",

        batchId:
          null,

        recordedEnrollmentCount:
          0,

        ...baseResponse,

        alreadyRecordedCount:
          freshExistingIds.size,

        newEnrollmentCount:
          0,

        message:
          "The selected eligible contacts are already recorded in CRM for this outreach campaign. Nothing was submitted to Mailshake.",
      });
    }

    const auditSnapshot = {
      ...filterSnapshot,

      crmEnrollmentReview: {
        reviewedAt:
          now,

        originallyRequestedCount:
          contactIds.length,

        blockedCount:
          review.blocked.length,

        alreadyRecordedCount:
          freshExistingIds.size,

        newEnrollmentCount:
          contactsToRecord.length,
      },
    };

    const {
      data:
        batch,
      error:
        batchError,
    } =
      await supabase
        .from(
          "outreach_enrollment_batches"
        )
        .insert({
          provider:
            "mailshake",

          outreach_campaign_id:
            outreachCampaignId,

          provider_campaign_id:
            providerCampaignId,

          campaign_name:
            campaignName,

          selection_mode:
            selectionMode,

          filter_snapshot:
            auditSnapshot,

          requested_by_crm_user_id:
            access.context.crmUserId,

          requested_by_display_name:
            access.context.crmDisplayName,

          requested_count:
            contactIds.length,

          eligible_count:
            review.eligible.length,

          blocked_count:
            review.blocked.length,

          status:
            "ready",

          requested_at:
            now,

          created_at:
            now,

          updated_at:
            now,
        })
        .select(
          "id, status, requested_at"
        )
        .single();

    if (batchError) {
      throw batchError;
    }

    const batchId =
      cleanText(
        batch?.id
      );

    if (!batchId) {
      throw new Error(
        "The CRM enrollment batch was not created."
      );
    }

    const enrollmentRows =
      contactsToRecord.map(
        (contact) => ({
          batch_id:
            batchId,

          provider:
            "mailshake",

          outreach_campaign_id:
            outreachCampaignId,

          provider_campaign_id:
            providerCampaignId,

          contact_id:
            contact.contactId,

          company_id:
            contact.companyId,

          normalized_email:
            contact.normalizedEmail,

          crm_eligibility_status:
            "eligible",

          crm_eligibility_reason:
            "Server revalidated as eligible when the CRM enrollment instruction was recorded.",

          requested_by_crm_user_id:
            access.context.crmUserId,

          requested_at:
            now,

          status:
            "requested",

          created_at:
            now,

          updated_at:
            now,
        })
      );

    const {
      data:
        recordedRows,
      error:
        enrollmentError,
    } =
      await supabase
        .from(
          "outreach_enrollments"
        )
        .upsert(
          enrollmentRows,
          {
            onConflict:
              "outreach_campaign_id,contact_id",

            ignoreDuplicates:
              true,
          }
        )
        .select(
          "id, contact_id, status"
        );

    if (enrollmentError) {
      await supabase
        .from(
          "outreach_enrollment_batches"
        )
        .update({
          status:
            "failed",

          error_message:
            enrollmentError.message,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          batchId
        );

      throw enrollmentError;
    }

    const recordedEnrollmentCount =
      Array.isArray(
        recordedRows
      )
        ? recordedRows.length
        : 0;

    return NextResponse.json({
      status:
        "recorded_in_crm",

      mode:
        "crm-record-only",

      batchId,

      recordedEnrollmentCount,

      ...baseResponse,

      alreadyRecordedCount:
        freshExistingIds.size,

      newEnrollmentCount:
        recordedEnrollmentCount,

      requestedBy: {
        crmUserId:
          access.context.crmUserId,

        displayName:
          access.context.crmDisplayName,
      },

      message:
        `CRM enrollment instruction recorded for ${recordedEnrollmentCount} contact${recordedEnrollmentCount === 1 ? "" : "s"}. Nothing was submitted to Mailshake and no email was sent.`,
    });
  } catch (error) {
    console.error(
      "[mailshake-enrollment-request]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not review or record the CRM outreach enrollment instruction.",
      },
      {
        status: 500,
      }
    );
  }
}