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

type CompanyRelation = {
  id?: string;
  company_name?: string | null;
  archived_at?: string | null;
};

type ContactRow = {
  id?: string;
  company_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  title?: string | null;
  management_level?: string | null;
  department?: string | null;
  function_area?: string | null;
  email?: string | null;
  direct_phone?: string | null;
  mobile_phone?: string | null;
  person_state?: string | null;
  created_at?: string | null;

  companies?:
    | CompanyRelation
    | CompanyRelation[]
    | null;
};

type CrmTagRow = {
  id?: string;
  tag_name?: string | null;
  tag_type?: string | null;
  status?: string | null;
  archived_at?: string | null;
};

type ContactTagRow = {
  contact_id?: string | null;
  tag_id?: string | null;
};

type ProjectRow = {
  id?: string;
  project_name?: string | null;
  project_kind?: string | null;
  status?: string | null;
  archived_at?: string | null;
};

type ContactProjectRow = {
  contact_id?: string | null;
  project_id?: string | null;
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

function getCompany(
  value:
    | CompanyRelation
    | CompanyRelation[]
    | null
    | undefined
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
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
              "Mailshake outreach is restricted to CRM Admin and Sales Manager users.",
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

async function readAllActiveContacts(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >
) {
  const rows:
    ContactRow[] = [];

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
          company_id,
          first_name,
          last_name,
          full_name,
          title,
          management_level,
          department,
          function_area,
          email,
          direct_phone,
          mobile_phone,
          person_state,
          created_at,
          companies!inner (
            id,
            company_name,
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

    const page =
      Array.isArray(data)
        ? (data as ContactRow[])
        : [];

    rows.push(
      ...page
    );

    pagesRead += 1;

    if (
      page.length <
      PAGE_SIZE
    ) {
      complete = true;
      break;
    }
  }

  return {
    rows,
    pagesRead,
    complete,
  };
}

async function readActiveTags(
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
      .select(
        "id, tag_name, tag_type, status, archived_at"
      )
      .eq(
        "status",
        "active"
      )
      .is(
        "archived_at",
        null
      )
      .order(
        "tag_type",
        {
          ascending: true,
        }
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      )
      .order(
        "tag_name",
        {
          ascending: true,
        }
      );

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? (data as CrmTagRow[])
    : [];
}

async function readAllContactTags(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >
) {
  const rows:
    ContactTagRow[] = [];

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
        .from("contact_tags")
        .select(
          "contact_id, tag_id"
        )
        .range(
          from,
          to
        );

    if (error) {
      throw error;
    }

    const page =
      Array.isArray(data)
        ? (data as ContactTagRow[])
        : [];

    rows.push(
      ...page
    );

    pagesRead += 1;

    if (
      page.length <
      PAGE_SIZE
    ) {
      complete = true;
      break;
    }
  }

  return {
    rows,
    complete,
  };
}

async function readActiveProjects(
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
      .from("crm_projects")
      .select(
        "id, project_name, project_kind, status, archived_at"
      )
      .eq(
        "status",
        "active"
      )
      .is(
        "archived_at",
        null
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      )
      .order(
        "project_name",
        {
          ascending: true,
        }
      );

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? (data as ProjectRow[])
    : [];
}

async function readAllContactProjects(
  supabase:
    ReturnType<
      typeof getSupabaseAdmin
    >
) {
  const rows:
    ContactProjectRow[] = [];

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
        .from(
          "contact_project_assignments"
        )
        .select(
          "contact_id, project_id"
        )
        .range(
          from,
          to
        );

    if (error) {
      throw error;
    }

    const page =
      Array.isArray(data)
        ? (data as ContactProjectRow[])
        : [];

    rows.push(
      ...page
    );

    pagesRead += 1;

    if (
      page.length <
      PAGE_SIZE
    ) {
      complete = true;
      break;
    }
  }

  return {
    rows,
    complete,
  };
}

function uniqueStringOptions(
  values: string[]
) {
  return Array.from(
    new Set(
      values
        .map(cleanText)
        .filter(Boolean)
    )
  ).sort(
    (a, b) =>
      a.localeCompare(b)
  );
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
    const supabase =
      getSupabaseAdmin();

    const [
      contactResult,
      tags,
      contactTagResult,
      projects,
      contactProjectResult,
    ] =
      await Promise.all([
        readAllActiveContacts(
          supabase
        ),

        readActiveTags(
          supabase
        ),

        readAllContactTags(
          supabase
        ),

        readActiveProjects(
          supabase
        ),

        readAllContactProjects(
          supabase
        ),
      ]);

    if (
      !contactResult.complete
    ) {
      throw new Error(
        `The active CRM contact population exceeded the safety limit of ${PAGE_SIZE * MAX_PAGES} rows. Select All Filtered was disabled rather than using an incomplete contact population.`
      );
    }

    if (
      !contactTagResult.complete
    ) {
      throw new Error(
        `CRM contact-tag assignments exceeded the safety limit of ${PAGE_SIZE * MAX_PAGES} rows. Outreach selection stopped rather than risk missing a Do Not Contact assignment.`
      );
    }

    if (
      !contactProjectResult.complete
    ) {
      throw new Error(
        `CRM contact Project / List assignments exceeded the safety limit of ${PAGE_SIZE * MAX_PAGES} rows. Outreach selection stopped rather than use incomplete filters.`
      );
    }

    const tagById =
      new Map<
        string,
        CrmTagRow
      >();

    tags.forEach(
      (tag) => {
        const id =
          cleanText(
            tag.id
          );

        if (id) {
          tagById.set(
            id,
            tag
          );
        }
      }
    );

    const dncTag =
      tags.find(
        (tag) =>
          cleanText(
            tag.tag_type
          ).toLowerCase() ===
            "category" &&
          cleanText(
            tag.tag_name
          ).toLowerCase() ===
            "do not contact"
      );

    const dncTagId =
      cleanText(
        dncTag?.id
      );

    const dncControlAvailable =
      Boolean(
        dncTagId
      );

    const contactTagIds =
      new Map<
        string,
        Set<string>
      >();

    contactTagResult.rows.forEach(
      (row) => {
        const contactId =
          cleanText(
            row.contact_id
          );

        const tagId =
          cleanText(
            row.tag_id
          );

        if (
          !contactId ||
          !tagId
        ) {
          return;
        }

        const existing =
          contactTagIds.get(
            contactId
          ) ??
          new Set<string>();

        existing.add(
          tagId
        );

        contactTagIds.set(
          contactId,
          existing
        );
      }
    );

    const projectById =
      new Map<
        string,
        ProjectRow
      >();

    projects.forEach(
      (project) => {
        const id =
          cleanText(
            project.id
          );

        if (id) {
          projectById.set(
            id,
            project
          );
        }
      }
    );

    const contactProjectIds =
      new Map<
        string,
        Set<string>
      >();

    contactProjectResult.rows.forEach(
      (row) => {
        const contactId =
          cleanText(
            row.contact_id
          );

        const projectId =
          cleanText(
            row.project_id
          );

        if (
          !contactId ||
          !projectId ||
          !projectById.has(
            projectId
          )
        ) {
          return;
        }

        const existing =
          contactProjectIds.get(
            contactId
          ) ??
          new Set<string>();

        existing.add(
          projectId
        );

        contactProjectIds.set(
          contactId,
          existing
        );
      }
    );

    const emailCounts =
      new Map<
        string,
        number
      >();

    contactResult.rows.forEach(
      (contact) => {
        const email =
          normalizeEmail(
            contact.email
          );

        if (!email) {
          return;
        }

        emailCounts.set(
          email,
          (
            emailCounts.get(
              email
            ) ?? 0
          ) + 1
        );
      }
    );

    const contacts =
      contactResult.rows.map(
        (contact) => {
          const contactId =
            cleanText(
              contact.id
            );

          const company =
            getCompany(
              contact.companies
            );

          const email =
            normalizeEmail(
              contact.email
            );

          const assignedTagIds =
            Array.from(
              contactTagIds.get(
                contactId
              ) ??
                new Set<string>()
            );

          const assignedTags =
            assignedTagIds
              .map(
                (tagId) =>
                  tagById.get(
                    tagId
                  )
              )
              .filter(
                (
                  tag
                ): tag is CrmTagRow =>
                  Boolean(tag)
              );

          const doNotContact =
            Boolean(
              dncTagId &&
                assignedTagIds.includes(
                  dncTagId
                )
            );

          const duplicateEmailInCrm =
            Boolean(
              email &&
                (
                  emailCounts.get(
                    email
                  ) ?? 0
                ) > 1
            );

          let eligibleForMailshake =
            true;

          let eligibilityReason =
            "Eligible for Mailshake enrollment review.";

          if (
            !dncControlAvailable
          ) {
            eligibleForMailshake =
              false;

            eligibilityReason =
              'Blocked: the CRM "Do Not Contact" safety control is unavailable.';
          } else if (
            !contactId
          ) {
            eligibleForMailshake =
              false;

            eligibilityReason =
              "Blocked: this CRM contact does not have a valid CRM contact ID.";
          } else if (
            !cleanText(
              contact.company_id
            )
          ) {
            eligibleForMailshake =
              false;

            eligibilityReason =
              "Blocked: this CRM contact is not attached to a valid company.";
          } else if (
            !email
          ) {
            eligibleForMailshake =
              false;

            eligibilityReason =
              "Blocked: this CRM contact does not have an email address.";
          } else if (
            doNotContact
          ) {
            eligibleForMailshake =
              false;

            eligibilityReason =
              'Blocked: this CRM contact has the "Do Not Contact" tag.';
          } else if (
            duplicateEmailInCrm
          ) {
            eligibleForMailshake =
              false;

            eligibilityReason =
              "Blocked: multiple active CRM contacts share this normalized email address.";
          }

          const fullName =
            cleanText(
              contact.full_name
            ) ||
            [
              cleanText(
                contact.first_name
              ),
              cleanText(
                contact.last_name
              ),
            ]
              .filter(Boolean)
              .join(" ");

          const marketTags =
            assignedTags
              .filter(
                (tag) =>
                  cleanText(
                    tag.tag_type
                  ).toLowerCase() ===
                  "market"
              )
              .map(
                (tag) => ({
                  id:
                    cleanText(
                      tag.id
                    ),

                  label:
                    cleanText(
                      tag.tag_name
                    ),
                })
              );

          const sectorTags =
            assignedTags
              .filter(
                (tag) =>
                  cleanText(
                    tag.tag_type
                  ).toLowerCase() ===
                  "sector"
              )
              .map(
                (tag) => ({
                  id:
                    cleanText(
                      tag.id
                    ),

                  label:
                    cleanText(
                      tag.tag_name
                    ),
                })
              );

          const categoryTags =
            assignedTags
              .filter(
                (tag) =>
                  cleanText(
                    tag.tag_type
                  ).toLowerCase() ===
                    "category" &&
                  cleanText(
                    tag.id
                  ) !==
                    dncTagId
              )
              .map(
                (tag) => ({
                  id:
                    cleanText(
                      tag.id
                    ),

                  label:
                    cleanText(
                      tag.tag_name
                    ),
                })
              );

          const assignedProjectIds =
            Array.from(
              contactProjectIds.get(
                contactId
              ) ??
                new Set<string>()
            );

          const contactProjects =
            assignedProjectIds
              .map(
                (projectId) =>
                  projectById.get(
                    projectId
                  )
              )
              .filter(
                (
                  project
                ): project is ProjectRow =>
                  Boolean(project)
              )
              .map(
                (project) => ({
                  id:
                    cleanText(
                      project.id
                    ),

                  label:
                    cleanText(
                      project.project_name
                    ),

                  kind:
                    cleanText(
                      project.project_kind
                    ) ===
                    "list"
                      ? "list"
                      : "project",
                })
              );

          return {
            contactId,

            companyId:
              cleanText(
                contact.company_id
              ),

            companyName:
              cleanText(
                company?.company_name
              ),

            firstName:
              cleanText(
                contact.first_name
              ),

            lastName:
              cleanText(
                contact.last_name
              ),

            fullName,

            title:
              cleanText(
                contact.title
              ),

            managementLevel:
              cleanText(
                contact.management_level
              ),

            department:
              cleanText(
                contact.department
              ),

            functionArea:
              cleanText(
                contact.function_area
              ),

            state:
              cleanText(
                contact.person_state
              ),

            email,

            phoneNumber:
              cleanText(
                contact.direct_phone
              ) ||
              cleanText(
                contact.mobile_phone
              ),

            marketTags,
            sectorTags,
            categoryTags,
            projects:
              contactProjects,

            doNotContact,

            duplicateEmailInCrm,

            eligibleForMailshake,

            eligibilityReason,
          };
        }
      )
      .sort(
        (a, b) => {
          const companyCompare =
            a.companyName.localeCompare(
              b.companyName
            );

          if (
            companyCompare !== 0
          ) {
            return companyCompare;
          }

          return (
            a.fullName ||
            a.email
          ).localeCompare(
            b.fullName ||
              b.email
          );
        }
      );

    const companies =
      Array.from(
        new Map(
          contacts
            .filter(
              (contact) =>
                contact.companyId
            )
            .map(
              (contact) => [
                contact.companyId,
                {
                  id:
                    contact.companyId,

                  label:
                    contact.companyName ||
                    "Unnamed company",
                },
              ]
            )
        ).values()
      ).sort(
        (a, b) =>
          a.label.localeCompare(
            b.label
          )
      );

    const marketTags =
      tags
        .filter(
          (tag) =>
            cleanText(
              tag.tag_type
            ).toLowerCase() ===
            "market"
        )
        .map(
          (tag) => ({
            id:
              cleanText(
                tag.id
              ),

            label:
              cleanText(
                tag.tag_name
              ),
          })
        )
        .filter(
          (tag) =>
            tag.id &&
            tag.label
        );

    const sectorTags =
      tags
        .filter(
          (tag) =>
            cleanText(
              tag.tag_type
            ).toLowerCase() ===
            "sector"
        )
        .map(
          (tag) => ({
            id:
              cleanText(
                tag.id
              ),

            label:
              cleanText(
                tag.tag_name
              ),
          })
        )
        .filter(
          (tag) =>
            tag.id &&
            tag.label
        );

    const categoryTags =
      tags
        .filter(
          (tag) =>
            cleanText(
              tag.tag_type
            ).toLowerCase() ===
              "category" &&
            cleanText(
              tag.id
            ) !==
              dncTagId
        )
        .map(
          (tag) => ({
            id:
              cleanText(
                tag.id
              ),

            label:
              cleanText(
                tag.tag_name
              ),
          })
        )
        .filter(
          (tag) =>
            tag.id &&
            tag.label
        );

    const projectOptions =
      projects
        .map(
          (project) => ({
            id:
              cleanText(
                project.id
              ),

            label:
              cleanText(
                project.project_name
              ),

            kind:
              cleanText(
                project.project_kind
              ) ===
              "list"
                ? "list"
                : "project",
          })
        )
        .filter(
          (project) =>
            project.id &&
            project.label
        );

    const eligibleCount =
      contacts.filter(
        (contact) =>
          contact.eligibleForMailshake
      ).length;

    const doNotContactCount =
      contacts.filter(
        (contact) =>
          contact.doNotContact
      ).length;

    const noEmailCount =
      contacts.filter(
        (contact) =>
          !contact.email
      ).length;

    const duplicateEmailCount =
      contacts.filter(
        (contact) =>
          contact.duplicateEmailInCrm
      ).length;

    return NextResponse.json({
      status: "ready",

      provider: "mailshake",

      mode: "read-only",

      selectionSafe: true,

      dncControlAvailable,

      totalActiveContacts:
        contacts.length,

      eligibleCount,

      blockedCount:
        contacts.length -
        eligibleCount,

      blockedCounts: {
        doNotContact:
          doNotContactCount,

        missingEmail:
          noEmailCount,

        duplicateEmail:
          duplicateEmailCount,
      },

      pagesRead:
        contactResult.pagesRead,

      filterOptions: {
        companies,

        states:
          uniqueStringOptions(
            contacts.map(
              (contact) =>
                contact.state
            )
          ),

        managementLevels:
          uniqueStringOptions(
            contacts.map(
              (contact) =>
                contact.managementLevel
            )
          ),

        functions:
          uniqueStringOptions(
            contacts.flatMap(
              (contact) => [
                contact.functionArea,
                contact.department,
              ]
            )
          ),

        marketTags,

        sectorTags,

        categoryTags,

        projects:
          projectOptions,
      },

      contacts,

      message:
        "CRM outreach contacts and filter metadata were prepared for review. No Mailshake recipients were added and no email was sent.",
    });
  } catch (error) {
    console.error(
      "[mailshake-outreach-contacts]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not prepare CRM contacts for Mailshake outreach.",
      },
      {
        status: 500,
      }
    );
  }
}