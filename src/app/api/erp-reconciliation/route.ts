import { createHash, randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Workbook } from "exceljs";
import { NextResponse } from "next/server";
import { verifySignedInCrmUser } from "../_shared/verified-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const bucketName =
  "graymills-erp-reconciliation";

const maximumFileSizeBytes =
  4 * 1024 * 1024;

const signedUrlSeconds =
  60 * 60;

const allowedExtension =
  ".xlsx";

type VerifiedContext = {
  crmUserId: string;
  crmDisplayName: string;
  crmRole: string;
};

type ParsedErpSourceRow = {
  row_number: number;
  order_date: string | null;
  order_number: string;
  line: string;
  customer_number: string;
  company: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  item_number: string;
  product_line: string;
  description: string;
  qty: string;
  unit_price: string;
  ext_price: string;
  sold_by: string;
  salesperson: string;
  territory: string;
  customer_po: string;
  status: string;
};

type MutableCustomerAggregate = {
  customerNumber: string;

  companyName: string;
  normalizedCompanyName: string;

  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;

  phone: string;
  email: string;
  emailDomain: string;

  latestOrderDate: string | null;
  latestOrderTimestamp: number;

  orderNumbers: Set<string>;
  lineCount: number;
  orderLineValue: number;

  productLines: Set<string>;
  salespeople: Set<string>;
  territories: Set<string>;
  statuses: Set<string>;

  sourceRows: ParsedErpSourceRow[];
};

type CrmCompany = {
  id: string;
  company_name: string | null;
  graymills_customer_number: string | null;
  account_type: string | null;
  website: string | null;
  domain: string | null;
  company_phone: string | null;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  assigned_salesperson_id: string | null;
  assigned_sales_manager_id: string | null;
};

type CrmContactSignals = {
  emails: Set<string>;
  domains: Set<string>;
  phones: Set<string>;
};

type CrmActivitySignals = {
  lastActivityAt: string | null;
  openActivityCount: number;
};

type CrmOpportunitySignals = {
  openOpportunityCount: number;
};

type MatchCandidate = {
  company_id: string;
  company_name: string;
  graymills_customer_number: string | null;
  account_type: string | null;

  city: string | null;
  state: string | null;
  postal_code: string | null;

  assigned_salesperson_id: string | null;
  assigned_sales_manager_id: string | null;

  score: number;
  reasons: string[];

  last_crm_activity_at: string | null;
  open_activity_count: number;
  open_opportunity_count: number;
};

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
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

function errorResponse(
  error: unknown,
  fallbackMessage: string,
  status = 500
) {
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : fallbackMessage,
    },
    {
      status,
    }
  );
}

async function verifyManagerAccess(
  request: Request
): Promise<
  | {
      context: VerifiedContext;
      response: null;
    }
  | {
      context: null;
      response: NextResponse;
    }
> {
  const verification =
    await verifySignedInCrmUser(request);

  if (verification.response) {
    return {
      context: null,
      response: verification.response,
    };
  }

  const role =
    String(
      verification.context.crmRole || ""
    )
      .trim()
      .toLowerCase();

  if (
    role !== "admin" &&
    role !== "sales_manager"
  ) {
    return {
      context: null,
      response: NextResponse.json(
        {
          error:
            "ERP reconciliation is restricted to CRM Admin and Sales Manager users.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    context: {
      crmUserId:
        verification.context.crmUserId,

      crmDisplayName:
        verification.context.crmDisplayName,

      crmRole: role,
    },
    response: null,
  };
}

function cleanText(
  value: unknown
) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeFileName(
  fileName: string
) {
  const cleaned =
    fileName
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-"
      )
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

  return cleaned ||
    "graymills-erp.xlsx";
}

function fileExtension(
  fileName: string
) {
  const finalDot =
    fileName.lastIndexOf(".");

  if (finalDot < 0) {
    return "";
  }

  return fileName
    .slice(finalDot)
    .toLowerCase();
}

function normalizeCustomerNumber(
  value: unknown
) {
  return cleanText(value)
    .toLowerCase();
}

function normalizePostalCode(
  value: unknown
) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5);
}

function normalizePhone(
  value: unknown
) {
  const digits =
    cleanText(value)
      .replace(/\D/g, "");

  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
}

function normalizeStreet(
  value: unknown
) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\broad\b/g, "rd")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\blane\b/g, "ln")
    .replace(/\bcourt\b/g, "ct")
    .replace(/\bhighway\b/g, "hwy")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompanyName(
  value: unknown
) {
  let normalized =
    cleanText(value)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const suffixes = new Set([
    "inc",
    "incorporated",
    "corp",
    "corporation",
    "co",
    "company",
    "llc",
    "ltd",
    "limited",
    "lp",
  ]);

  let tokens =
    normalized
      .split(" ")
      .filter(Boolean);

  while (
    tokens.length > 1 &&
    suffixes.has(
      tokens[tokens.length - 1]
    )
  ) {
    tokens = tokens.slice(
      0,
      tokens.length - 1
    );
  }

  normalized =
    tokens.join(" ");

  return normalized;
}

function leadingCompanyNamePhraseMatch(
  leftValue: unknown,
  rightValue: unknown
) {
  const left =
    normalizeCompanyName(
      leftValue
    );

  const right =
    normalizeCompanyName(
      rightValue
    );

  if (
    !left ||
    !right ||
    left === right
  ) {
    return false;
  }

  const leftTokens =
    left
      .split(" ")
      .filter(Boolean);

  const rightTokens =
    right
      .split(" ")
      .filter(Boolean);

  const shorter =
    leftTokens.length <=
    rightTokens.length
      ? leftTokens
      : rightTokens;

  const longer =
    leftTokens.length >
    rightTokens.length
      ? leftTokens
      : rightTokens;

  if (
    shorter.length < 2 ||
    shorter.length >=
      longer.length
  ) {
    return false;
  }

  return shorter.every(
    (token, index) =>
      longer[index] === token
  );
}

function normalizeEmail(
  value: unknown
) {
  return cleanText(value)
    .toLowerCase();
}

function domainFromEmail(
  value: unknown
) {
  const email =
    normalizeEmail(value);

  const at =
    email.lastIndexOf("@");

  if (
    at <= 0 ||
    at === email.length - 1
  ) {
    return "";
  }

  return email
    .slice(at + 1)
    .replace(/^www\./, "");
}

function normalizeDomain(
  value: unknown
) {
  const text =
    cleanText(value)
      .toLowerCase();

  if (!text) {
    return "";
  }

  try {
    const url =
      new URL(
        text.startsWith("http")
          ? text
          : `https://${text}`
      );

    return url.hostname
      .replace(/^www\./, "");
  } catch {
    return text
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim();
  }
}

function headerKey(
  value: unknown
) {
  return cleanText(value)
    .toLowerCase()
    .replace(/#/g, " number ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function cellText(
  cell: any
) {
  const value =
    cell?.value;

  const numFmt =
    cleanText(cell?.numFmt);

  if (
    typeof value === "number" &&
    /^0+$/.test(numFmt)
  ) {
    return String(value)
      .padStart(
        numFmt.length,
        "0"
      );
  }

  const text =
    cleanText(cell?.text);

  if (text) {
    return text;
  }

  if (value instanceof Date) {
    return [
      value.getFullYear(),
      String(
        value.getMonth() + 1
      ).padStart(2, "0"),
      String(
        value.getDate()
      ).padStart(2, "0"),
    ].join("-");
  }

  if (
    value &&
    typeof value === "object" &&
    "result" in value
  ) {
    return cleanText(
      (value as any).result
    );
  }

  return cleanText(value);
}

function parseDateCell(
  cell: any
) {
  const value =
    cell?.value;

  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    return [
      value.getFullYear(),
      String(
        value.getMonth() + 1
      ).padStart(2, "0"),
      String(
        value.getDate()
      ).padStart(2, "0"),
    ].join("-");
  }

  const text =
    cellText(cell);

  if (!text) {
    return null;
  }

  const isoMatch =
    text.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})/
    );

  if (isoMatch) {
    return [
      isoMatch[1],
      isoMatch[2].padStart(
        2,
        "0"
      ),
      isoMatch[3].padStart(
        2,
        "0"
      ),
    ].join("-");
  }

  const usMatch =
    text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/
    );

  if (usMatch) {
    let year =
      Number.parseInt(
        usMatch[3],
        10
      );

    if (year < 100) {
      year +=
        year >= 70
          ? 1900
          : 2000;
    }

    return [
      String(year),
      usMatch[1].padStart(
        2,
        "0"
      ),
      usMatch[2].padStart(
        2,
        "0"
      ),
    ].join("-");
  }

  const parsed =
    new Date(text);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }

  return [
    parsed.getFullYear(),
    String(
      parsed.getMonth() + 1
    ).padStart(2, "0"),
    String(
      parsed.getDate()
    ).padStart(2, "0"),
  ].join("-");
}

function parseMoney(
  value: unknown
) {
  const original =
    cleanText(value);

  if (!original) {
    return 0;
  }

  const negative =
    original.startsWith("(") &&
    original.endsWith(")");

  const cleaned =
    original.replace(
      /[^0-9.-]/g,
      ""
    );

  if (!cleaned) {
    return 0;
  }

  const parsed =
    Number.parseFloat(cleaned);

  if (
    !Number.isFinite(parsed)
  ) {
    return 0;
  }

  return negative
    ? -Math.abs(parsed)
    : parsed;
}

function diceSimilarity(
  leftValue: string,
  rightValue: string
) {
  const left =
    normalizeCompanyName(
      leftValue
    );

  const right =
    normalizeCompanyName(
      rightValue
    );

  if (
    !left ||
    !right
  ) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (
    left.length < 2 ||
    right.length < 2
  ) {
    return 0;
  }

  const leftPairs =
    new Map<string, number>();

  for (
    let index = 0;
    index < left.length - 1;
    index += 1
  ) {
    const pair =
      left.slice(
        index,
        index + 2
      );

    leftPairs.set(
      pair,
      (leftPairs.get(pair) ?? 0) + 1
    );
  }

  let intersection = 0;

  for (
    let index = 0;
    index < right.length - 1;
    index += 1
  ) {
    const pair =
      right.slice(
        index,
        index + 2
      );

    const count =
      leftPairs.get(pair) ?? 0;

    if (count > 0) {
      intersection += 1;

      leftPairs.set(
        pair,
        count - 1
      );
    }
  }

  return (
    (2 * intersection) /
    (
      left.length +
      right.length -
      2
    )
  );
}

function getRowCell(
  row: any,
  headers: Map<string, number>,
  key: string
) {
  const column =
    headers.get(key);

  if (!column) {
    return null;
  }

  return row.getCell(column);
}

function getRowText(
  row: any,
  headers: Map<string, number>,
  key: string
) {
  return cellText(
    getRowCell(
      row,
      headers,
      key
    )
  );
}

function detectHeader(
  worksheet: any
) {
  const required = [
    "orderdate",
    "ordernumber",
    "custnumber",
    "company",
    "extprice",
  ];

  const maximumRow =
    Math.min(
      worksheet.rowCount,
      20
    );

  for (
    let rowNumber = 1;
    rowNumber <= maximumRow;
    rowNumber += 1
  ) {
    const row =
      worksheet.getRow(
        rowNumber
      );

    const headers =
      new Map<string, number>();

    for (
      let column = 1;
      column <= row.cellCount;
      column += 1
    ) {
      const text =
        cellText(
          row.getCell(column)
        );

      if (!text) {
        continue;
      }

      const key =
        headerKey(text);

      if (
        key &&
        !headers.has(key)
      ) {
        headers.set(
          key,
          column
        );
      }
    }

    if (
      required.every(
        (key) =>
          headers.has(key)
      )
    ) {
      return {
        rowNumber,
        headers,
      };
    }
  }

  return null;
}

function latestTimestamp(
  isoDate: string | null
) {
  if (!isoDate) {
    return 0;
  }

  const timestamp =
    Date.parse(
      `${isoDate}T00:00:00`
    );

  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : 0;
}

function arrayFromSet(
  values: Set<string>
) {
  return Array.from(values)
    .filter(Boolean)
    .sort(
      (left, right) =>
        left.localeCompare(right)
    );
}

async function fetchAllCompanies(
  supabase: ReturnType<
    typeof getSupabaseAdmin
  >
): Promise<CrmCompany[]> {
  const records:
    CrmCompany[] = [];

  const pageSize = 1000;

  for (
    let from = 0;
    ;
    from += pageSize
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from("companies")
        .select(
          `
          id,
          company_name,
          graymills_customer_number,
          account_type,
          website,
          domain,
          company_phone,
          address_line_1,
          city,
          state,
          postal_code,
          assigned_salesperson_id,
          assigned_sales_manager_id
          `
        )
        .is(
          "archived_at",
          null
        )
        .range(
          from,
          from + pageSize - 1
        );

    if (error) {
      throw error;
    }

    const page =
      (data ?? []) as CrmCompany[];

    records.push(...page);

    if (
      page.length <
      pageSize
    ) {
      break;
    }
  }

  return records;
}

async function fetchAllContacts(
  supabase: ReturnType<
    typeof getSupabaseAdmin
  >
) {
  const records:
    Array<{
      company_id: string | null;
      email: string | null;
      direct_phone: string | null;
      mobile_phone: string | null;
    }> = [];

  const pageSize = 1000;

  for (
    let from = 0;
    ;
    from += pageSize
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from("contacts")
        .select(
          `
          company_id,
          email,
          direct_phone,
          mobile_phone
          `
        )
        .is(
          "archived_at",
          null
        )
        .range(
          from,
          from + pageSize - 1
        );

    if (error) {
      throw error;
    }

    const page =
      data ?? [];

    records.push(
      ...page.map(
        (record: any) => ({
          company_id:
            record.company_id
              ? String(
                  record.company_id
                )
              : null,

          email:
            record.email
              ? String(
                  record.email
                )
              : null,

          direct_phone:
            record.direct_phone
              ? String(
                  record.direct_phone
                )
              : null,

          mobile_phone:
            record.mobile_phone
              ? String(
                  record.mobile_phone
                )
              : null,
        })
      )
    );

    if (
      page.length <
      pageSize
    ) {
      break;
    }
  }

  return records;
}

async function fetchAllActivities(
  supabase: ReturnType<
    typeof getSupabaseAdmin
  >
) {
  const records:
    Array<{
      company_id: string | null;
      created_at: string | null;
      completed_at: string | null;
    }> = [];

  const pageSize = 1000;

  for (
    let from = 0;
    ;
    from += pageSize
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from("activities")
        .select(
          `
          company_id,
          created_at,
          completed_at
          `
        )
        .range(
          from,
          from + pageSize - 1
        );

    if (error) {
      throw error;
    }

    const page =
      data ?? [];

    records.push(
      ...page.map(
        (record: any) => ({
          company_id:
            record.company_id
              ? String(
                  record.company_id
                )
              : null,

          created_at:
            record.created_at
              ? String(
                  record.created_at
                )
              : null,

          completed_at:
            record.completed_at
              ? String(
                  record.completed_at
                )
              : null,
        })
      )
    );

    if (
      page.length <
      pageSize
    ) {
      break;
    }
  }

  return records;
}

async function fetchAllOpportunities(
  supabase: ReturnType<
    typeof getSupabaseAdmin
  >
) {
  const records:
    Array<{
      company_id: string | null;
      status: string | null;
    }> = [];

  const pageSize = 1000;

  for (
    let from = 0;
    ;
    from += pageSize
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "sales_opportunities"
        )
        .select(
          `
          company_id,
          status
          `
        )
        .range(
          from,
          from + pageSize - 1
        );

    if (error) {
      throw error;
    }

    const page =
      data ?? [];

    records.push(
      ...page.map(
        (record: any) => ({
          company_id:
            record.company_id
              ? String(
                  record.company_id
                )
              : null,

          status:
            record.status
              ? String(
                  record.status
                )
              : null,
        })
      )
    );

    if (
      page.length <
      pageSize
    ) {
      break;
    }
  }

  return records;
}

function buildContactSignals(
  contacts: Awaited<
    ReturnType<
      typeof fetchAllContacts
    >
  >
) {
  const byCompany =
    new Map<
      string,
      CrmContactSignals
    >();

  for (
    const contact of contacts
  ) {
    const companyId =
      cleanText(
        contact.company_id
      );

    if (!companyId) {
      continue;
    }

    let signals =
      byCompany.get(companyId);

    if (!signals) {
      signals = {
        emails: new Set(),
        domains: new Set(),
        phones: new Set(),
      };

      byCompany.set(
        companyId,
        signals
      );
    }

    const email =
      normalizeEmail(
        contact.email
      );

    if (email) {
      signals.emails.add(email);

      const domain =
        domainFromEmail(email);

      if (domain) {
        signals.domains.add(
          domain
        );
      }
    }

    for (
      const phone of [
        contact.direct_phone,
        contact.mobile_phone,
      ]
    ) {
      const normalized =
        normalizePhone(phone);

      if (normalized) {
        signals.phones.add(
          normalized
        );
      }
    }
  }

  return byCompany;
}

function buildActivitySignals(
  activities: Awaited<
    ReturnType<
      typeof fetchAllActivities
    >
  >
) {
  const byCompany =
    new Map<
      string,
      CrmActivitySignals
    >();

  for (
    const activity of activities
  ) {
    const companyId =
      cleanText(
        activity.company_id
      );

    if (!companyId) {
      continue;
    }

    let signals =
      byCompany.get(companyId);

    if (!signals) {
      signals = {
        lastActivityAt: null,
        openActivityCount: 0,
      };

      byCompany.set(
        companyId,
        signals
      );
    }

    if (
      activity.created_at &&
      (
        !signals.lastActivityAt ||
        Date.parse(
          activity.created_at
        ) >
          Date.parse(
            signals.lastActivityAt
          )
      )
    ) {
      signals.lastActivityAt =
        activity.created_at;
    }

    if (!activity.completed_at) {
      signals.openActivityCount += 1;
    }
  }

  return byCompany;
}

function buildOpportunitySignals(
  opportunities: Awaited<
    ReturnType<
      typeof fetchAllOpportunities
    >
  >
) {
  const byCompany =
    new Map<
      string,
      CrmOpportunitySignals
    >();

  for (
    const opportunity of opportunities
  ) {
    const companyId =
      cleanText(
        opportunity.company_id
      );

    if (!companyId) {
      continue;
    }

    let signals =
      byCompany.get(companyId);

    if (!signals) {
      signals = {
        openOpportunityCount: 0,
      };

      byCompany.set(
        companyId,
        signals
      );
    }

    if (
      cleanText(
        opportunity.status
      ).toLowerCase() ===
      "open"
    ) {
      signals.openOpportunityCount += 1;
    }
  }

  return byCompany;
}

function candidateWithContext(
  company: CrmCompany,
  score: number,
  reasons: string[],
  activitySignals:
    Map<
      string,
      CrmActivitySignals
    >,
  opportunitySignals:
    Map<
      string,
      CrmOpportunitySignals
    >
): MatchCandidate {
  const companyId =
    String(company.id);

  const activity =
    activitySignals.get(
      companyId
    );

  const opportunity =
    opportunitySignals.get(
      companyId
    );

  return {
    company_id:
      companyId,

    company_name:
      cleanText(
        company.company_name
      ),

    graymills_customer_number:
      company.graymills_customer_number,

    account_type:
      company.account_type,

    city:
      company.city,

    state:
      company.state,

    postal_code:
      company.postal_code,

    assigned_salesperson_id:
      company.assigned_salesperson_id,

    assigned_sales_manager_id:
      company.assigned_sales_manager_id,

    score,
    reasons,

    last_crm_activity_at:
      activity?.lastActivityAt ??
      null,

    open_activity_count:
      activity?.openActivityCount ??
      0,

    open_opportunity_count:
      opportunity?.openOpportunityCount ??
      0,
  };
}

function scoreCompanyCandidate(
  aggregate:
    MutableCustomerAggregate,
  company:
    CrmCompany,
  contactSignals:
    Map<
      string,
      CrmContactSignals
    >,
  activitySignals:
    Map<
      string,
      CrmActivitySignals
    >,
  opportunitySignals:
    Map<
      string,
      CrmOpportunitySignals
    >
) {
  const reasons:
    string[] = [];

  const erpName =
    aggregate.normalizedCompanyName;

  const crmName =
    normalizeCompanyName(
      company.company_name
    );

  const exactName =
    Boolean(
      erpName &&
      crmName &&
      erpName === crmName
    );

  const similarity =
    diceSimilarity(
      aggregate.companyName,
      cleanText(
        company.company_name
      )
    );

  const erpPostal =
    normalizePostalCode(
      aggregate.postalCode
    );

  const crmPostal =
    normalizePostalCode(
      company.postal_code
    );

  const postalMatch =
    Boolean(
      erpPostal &&
      crmPostal &&
      erpPostal === crmPostal
    );

  const cityMatch =
    Boolean(
      aggregate.city &&
      company.city &&
      cleanText(
        aggregate.city
      ).toLowerCase() ===
        cleanText(
          company.city
        ).toLowerCase()
    );

  const stateMatch =
    Boolean(
      aggregate.state &&
      company.state &&
      cleanText(
        aggregate.state
      ).toLowerCase() ===
        cleanText(
          company.state
        ).toLowerCase()
    );

  const cityStateMatch =
    cityMatch &&
    stateMatch;

  const leadingNamePhraseMatch =
    leadingCompanyNamePhraseMatch(
      erpName,
      crmName
    );

  const erpStreet =
    normalizeStreet(
      aggregate.addressLine1
    );

  const crmStreet =
    normalizeStreet(
      company.address_line_1
    );

  const streetMatch =
    Boolean(
      erpStreet &&
      crmStreet &&
      erpStreet === crmStreet
    );

  const erpPhone =
    normalizePhone(
      aggregate.phone
    );

  const crmPhone =
    normalizePhone(
      company.company_phone
    );

  const companyPhoneMatch =
    Boolean(
      erpPhone &&
      crmPhone &&
      erpPhone === crmPhone
    );

  const companyId =
    String(company.id);

  const contacts =
    contactSignals.get(
      companyId
    );

  const contactPhoneMatch =
    Boolean(
      erpPhone &&
      contacts?.phones.has(
        erpPhone
      )
    );

  const erpEmail =
    normalizeEmail(
      aggregate.email
    );

  const exactContactEmail =
    Boolean(
      erpEmail &&
      contacts?.emails.has(
        erpEmail
      )
    );

  const erpDomain =
    aggregate.emailDomain;

  const crmDomain =
    normalizeDomain(
      company.domain ||
      company.website
    );

  const domainMatch =
    Boolean(
      erpDomain &&
      (
        erpDomain === crmDomain ||
        contacts?.domains.has(
          erpDomain
        )
      )
    );

  let score = 0;

  if (exactName) {
    score =
      Math.max(
        score,
        82
      );

    reasons.push(
      "Exact normalized company name"
    );
  } else if (
    similarity >= 0.88
  ) {
    score =
      Math.max(
        score,
        70
      );

    reasons.push(
      `Strong fuzzy company-name similarity (${Math.round(
        similarity * 100
      )}%)`
    );
  } else if (
    similarity >= 0.78
  ) {
    score =
      Math.max(
        score,
        60
      );

    reasons.push(
      `Possible company-name similarity (${Math.round(
        similarity * 100
      )}%)`
    );
  }

  if (
    !exactName &&
    leadingNamePhraseMatch &&
    cityStateMatch
  ) {
    score =
      Math.max(
        score,
        84
      );

    reasons.push(
      "Leading normalized company-name phrase matches"
    );

    reasons.push(
      "City and state match"
    );
  }

  if (
    exactName &&
    postalMatch
  ) {
    score =
      Math.max(
        score,
        96
      );

    reasons.push(
      "Postal code matches"
    );
  } else if (
    exactName &&
    cityStateMatch
  ) {
    score =
      Math.max(
        score,
        94
      );

    reasons.push(
      "City and state match"
    );
  } else if (postalMatch) {
    score += 8;

    reasons.push(
      "Postal code matches"
    );
  } else if (cityStateMatch) {
    score += 6;

    reasons.push(
      "City and state match"
    );
  }

  if (streetMatch) {
    score += 7;

    reasons.push(
      "Street address matches"
    );
  }

  if (domainMatch) {
    score =
      Math.max(
        score,
        86
      );

    reasons.push(
      "Email or website domain matches"
    );
  }

  if (exactContactEmail) {
    score =
      Math.max(
        score,
        90
      );

    reasons.push(
      "ERP contact email matches CRM contact"
    );
  }

  if (
    companyPhoneMatch ||
    contactPhoneMatch
  ) {
    score =
      Math.max(
        score,
        84
      );

    reasons.push(
      companyPhoneMatch
        ? "ERP phone matches CRM company phone"
        : "ERP phone matches CRM contact phone"
    );
  }

  score =
    Math.min(
      Math.round(score),
      99
    );

  return candidateWithContext(
    company,
    score,
    reasons,
    activitySignals,
    opportunitySignals
  );
}

function matchMethodFromCandidate(
  candidate:
    MatchCandidate | undefined
) {
  if (!candidate) {
    return null;
  }

  if (
    candidate.reasons.includes(
      "Exact normalized company name"
    ) &&
    candidate.reasons.some(
      (reason) =>
        reason ===
          "Postal code matches" ||
        reason ===
          "City and state match"
    )
  ) {
    return "exact_name_location";
  }

  if (
    candidate.reasons.includes(
      "Exact normalized company name"
    )
  ) {
    return "exact_name";
  }

  if (
    candidate.reasons.some(
      (reason) =>
        reason.includes(
          "domain matches"
        )
    )
  ) {
    return "domain";
  }

  if (
    candidate.reasons.some(
      (reason) =>
        reason.includes(
          "contact email"
        )
    )
  ) {
    return "contact_email";
  }

  if (
    candidate.reasons.some(
      (reason) =>
        reason.includes(
          "phone matches"
        )
    )
  ) {
    return "phone";
  }

  return "fuzzy_company_name";
}

function proposedMatch(
  aggregate:
    MutableCustomerAggregate,
  companies:
    CrmCompany[],
  customerNumberMap:
    Map<
      string,
      CrmCompany[]
    >,
  contactSignals:
    Map<
      string,
      CrmContactSignals
    >,
  activitySignals:
    Map<
      string,
      CrmActivitySignals
    >,
  opportunitySignals:
    Map<
      string,
      CrmOpportunitySignals
    >
) {
  const erpCustomerNumber =
    normalizeCustomerNumber(
      aggregate.customerNumber
    );

  const exactCustomerMatches =
    customerNumberMap.get(
      erpCustomerNumber
    ) ?? [];

  if (
    exactCustomerMatches.length ===
    1
  ) {
    const company =
      exactCustomerMatches[0];

    const candidate =
      candidateWithContext(
        company,
        100,
        [
          "Exact Graymills customer number",
        ],
        activitySignals,
        opportunitySignals
      );

    return {
      matched_company_id:
        String(company.id),

      match_status:
        "confident",

      match_method:
        "graymills_customer_number",

      match_score:
        100,

      match_reasons:
        candidate.reasons,

      candidate_matches:
        [candidate],

      review_status:
        "unreviewed",
    };
  }

  if (
    exactCustomerMatches.length > 1
  ) {
    const candidates =
      exactCustomerMatches.map(
        (company) =>
          candidateWithContext(
            company,
            100,
            [
              "Duplicate exact Graymills customer number exists in CRM",
            ],
            activitySignals,
            opportunitySignals
          )
      );

    return {
      matched_company_id:
        null,

      match_status:
        "ambiguous",

      match_method:
        "duplicate_customer_number",

      match_score:
        100,

      match_reasons: [
        "More than one active CRM company has this exact Graymills customer number.",
      ],

      candidate_matches:
        candidates,

      review_status:
        "needs_review",
    };
  }

  const candidates =
    companies
      .map(
        (company) =>
          scoreCompanyCandidate(
            aggregate,
            company,
            contactSignals,
            activitySignals,
            opportunitySignals
          )
      )
      .filter(
        (candidate) =>
          candidate.score >= 55
      )
      .sort(
        (left, right) =>
          right.score -
          left.score
      )
      .slice(0, 5);

  const top =
    candidates[0];

  const second =
    candidates[1];

  if (!top) {
    return {
      matched_company_id:
        null,

      match_status:
        "unmatched",

      match_method:
        null,

      match_score:
        null,

      match_reasons: [
        "No CRM company met the minimum matching threshold.",
      ],

      candidate_matches:
        [],

      review_status:
        "needs_review",
    };
  }

  const topCustomerNumber =
    normalizeCustomerNumber(
      top.graymills_customer_number
    );

  const customerNumberConflict =
    Boolean(
      top.score >= 80 &&
      topCustomerNumber &&
      topCustomerNumber !==
        erpCustomerNumber
    );

  if (customerNumberConflict) {
    return {
      matched_company_id:
        top.company_id,

      match_status:
        "conflict",

      match_method:
        matchMethodFromCandidate(
          top
        ),

      match_score:
        top.score,

      match_reasons: [
        ...top.reasons,
        `Customer-number conflict: ERP has "${aggregate.customerNumber}" while the proposed CRM company has "${top.graymills_customer_number}".`,
      ],

      candidate_matches:
        candidates,

      review_status:
        "needs_review",
    };
  }

  const competingCandidate =
    Boolean(
      second &&
      top.score >= 70 &&
      second.score >=
        top.score - 4
    );

  if (competingCandidate) {
    return {
      matched_company_id:
        null,

      match_status:
        "ambiguous",

      match_method:
        matchMethodFromCandidate(
          top
        ),

      match_score:
        top.score,

      match_reasons: [
        ...top.reasons,
        "Multiple CRM companies have similarly strong matching evidence.",
      ],

      candidate_matches:
        candidates,

      review_status:
        "needs_review",
    };
  }

  if (top.score >= 94) {
    return {
      matched_company_id:
        top.company_id,

      match_status:
        "confident",

      match_method:
        matchMethodFromCandidate(
          top
        ),

      match_score:
        top.score,

      match_reasons:
        top.reasons,

      candidate_matches:
        candidates,

      review_status:
        "unreviewed",
    };
  }

  if (top.score >= 80) {
    return {
      matched_company_id:
        top.company_id,

      match_status:
        "likely",

      match_method:
        matchMethodFromCandidate(
          top
        ),

      match_score:
        top.score,

      match_reasons:
        top.reasons,

      candidate_matches:
        candidates,

      review_status:
        "needs_review",
    };
  }

  if (top.score >= 65) {
    return {
      matched_company_id:
        null,

      match_status:
        "ambiguous",

      match_method:
        matchMethodFromCandidate(
          top
        ),

      match_score:
        top.score,

      match_reasons: [
        ...top.reasons,
        "The strongest evidence is not sufficient for a direct proposed match.",
      ],

      candidate_matches:
        candidates,

      review_status:
        "needs_review",
    };
  }

  return {
    matched_company_id:
      null,

    match_status:
      "unmatched",

    match_method:
      null,

    match_score:
      top.score,

    match_reasons: [
      "Only weak CRM similarity was found.",
    ],

    candidate_matches:
      candidates,

    review_status:
      "needs_review",
  };
}

async function signedUrlForRun(
  supabase: ReturnType<
    typeof getSupabaseAdmin
  >,
  run: any
) {
  if (
    !run?.storage_path
  ) {
    return null;
  }

  const storageBucket =
    cleanText(
      run.storage_bucket
    ) ||
    bucketName;

  const {
    data,
    error,
  } =
    await supabase.storage
      .from(storageBucket)
      .createSignedUrl(
        String(
          run.storage_path
        ),
        signedUrlSeconds
      );

  if (error) {
    return null;
  }

  return (
    data?.signedUrl ??
    null
  );
}

export async function GET(
  request: Request
) {
  const access =
    await verifyManagerAccess(
      request
    );

  if (access.response) {
    return access.response;
  }

  try {
    const supabase =
      getSupabaseAdmin();

    const {
      searchParams,
    } =
      new URL(request.url);

    const requestedRunId =
      cleanText(
        searchParams.get(
          "runId"
        )
      );

    const {
      data: runs,
      error: runsError,
    } =
      await supabase
        .from(
          "erp_reconciliation_runs"
        )
        .select("*")
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(25);

    if (runsError) {
      throw runsError;
    }

    const selectedRunId =
      requestedRunId ||
      cleanText(
        runs?.[0]?.id
      );

    let customers: any[] =
      [];

    let selectedRun: any =
      null;

    if (selectedRunId) {
      selectedRun =
        (runs ?? []).find(
          (run: any) =>
            String(run.id) ===
            selectedRunId
        ) ?? null;

      if (!selectedRun) {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              "erp_reconciliation_runs"
            )
            .select("*")
            .eq(
              "id",
              selectedRunId
            )
            .maybeSingle();

        if (error) {
          throw error;
        }

        selectedRun =
          data ?? null;
      }

      if (selectedRun) {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              "erp_reconciliation_customers"
            )
            .select("*")
            .eq(
              "run_id",
              selectedRunId
            )
            .order(
              "latest_order_date",
              {
                ascending: false,
                nullsFirst: false,
              }
            )
            .order(
              "company_name",
              {
                ascending: true,
              }
            );

        if (error) {
          throw error;
        }

        customers =
          data ?? [];
      }
    }

    const signedUrl =
      selectedRun
        ? await signedUrlForRun(
            supabase,
            selectedRun
          )
        : null;

    return NextResponse.json({
      runs:
        runs ?? [],

      selectedRun:
        selectedRun
          ? {
              ...selectedRun,
              signed_url:
                signedUrl,
            }
          : null,

      customers,
    });
  } catch (error) {
    return errorResponse(
      error,
      "Could not load ERP reconciliation data."
    );
  }
}

export async function POST(
  request: Request
) {
  const access =
    await verifyManagerAccess(
      request
    );

  if (access.response) {
    return access.response;
  }

  const supabase =
    getSupabaseAdmin();

  let runId:
    string | null = null;

  try {
    const formData =
      await request.formData();

    const fileEntry =
      formData.get("file");

    if (
      !fileEntry ||
      !(fileEntry instanceof File)
    ) {
      return NextResponse.json(
        {
          error:
            "Select an ERP XLSX workbook before starting reconciliation.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      fileEntry.size <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "The selected ERP workbook is empty.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      fileEntry.size >
      maximumFileSizeBytes
    ) {
      return NextResponse.json(
        {
          error:
            "ERP reconciliation workbooks cannot exceed 4 MB in this revision.",
        },
        {
          status: 400,
        }
      );
    }

    const extension =
      fileExtension(
        fileEntry.name
      );

    if (
      extension !==
      allowedExtension
    ) {
      return NextResponse.json(
        {
          error:
            "Version 3.26 accepts .xlsx ERP workbooks. Export older .xls files as .xlsx first.",
        },
        {
          status: 400,
        }
      );
    }

    const fileBuffer =
      Buffer.from(
        await fileEntry.arrayBuffer()
      );

    const fileSha256 =
      createHash("sha256")
        .update(fileBuffer)
        .digest("hex");

    const workbook =
      new Workbook();

    await workbook.xlsx.load(
      fileBuffer as any
    );

    let worksheet:
      any = null;

    let header:
      ReturnType<
        typeof detectHeader
      > = null;

    for (
      const candidateWorksheet of
      workbook.worksheets
    ) {
      const candidateHeader =
        detectHeader(
          candidateWorksheet
        );

      if (candidateHeader) {
        worksheet =
          candidateWorksheet;

        header =
          candidateHeader;

        break;
      }
    }

    if (
      !worksheet ||
      !header
    ) {
      return NextResponse.json(
        {
          error:
            "The workbook does not contain the expected ERP columns. Required columns include Order Date, Order #, Cust #, Company, and Ext Price.",
        },
        {
          status: 400,
        }
      );
    }

    const reportTitle =
      cellText(
        worksheet
          .getRow(1)
          .getCell(1)
      ) ||
      "ERP Order Lines";

    const aggregates =
      new Map<
        string,
        MutableCustomerAggregate
      >();

    let sourceRowCount = 0;
    let skippedRowCount = 0;

    for (
      let rowNumber =
        header.rowNumber + 1;
      rowNumber <=
        worksheet.rowCount;
      rowNumber += 1
    ) {
      const row =
        worksheet.getRow(
          rowNumber
        );

      const customerNumber =
        getRowText(
          row,
          header.headers,
          "custnumber"
        );

      const companyName =
        getRowText(
          row,
          header.headers,
          "company"
        );

      const orderNumber =
        getRowText(
          row,
          header.headers,
          "ordernumber"
        );

      const anyUsefulData =
        Boolean(
          customerNumber ||
          companyName ||
          orderNumber
        );

      if (!anyUsefulData) {
        continue;
      }

      sourceRowCount += 1;

      if (
        !customerNumber ||
        !companyName
      ) {
        skippedRowCount += 1;
        continue;
      }

      const orderDate =
        parseDateCell(
          getRowCell(
            row,
            header.headers,
            "orderdate"
          )
        );

      const line =
        getRowText(
          row,
          header.headers,
          "line"
        );

      const contact =
        getRowText(
          row,
          header.headers,
          "contact"
        );

      const phone =
        getRowText(
          row,
          header.headers,
          "phone"
        );

      const email =
        getRowText(
          row,
          header.headers,
          "email"
        );

      const address =
        getRowText(
          row,
          header.headers,
          "address"
        );

      const city =
        getRowText(
          row,
          header.headers,
          "city"
        );

      const state =
        getRowText(
          row,
          header.headers,
          "state"
        );

      const zip =
        getRowText(
          row,
          header.headers,
          "zip"
        );

      const itemNumber =
        getRowText(
          row,
          header.headers,
          "itemnumber"
        );

      const productLine =
        getRowText(
          row,
          header.headers,
          "productline"
        );

      const description =
        getRowText(
          row,
          header.headers,
          "description"
        );

      const qty =
        getRowText(
          row,
          header.headers,
          "qty"
        );

      const unitPrice =
        getRowText(
          row,
          header.headers,
          "unitprice"
        );

      const extPrice =
        getRowText(
          row,
          header.headers,
          "extprice"
        );

      const soldBy =
        getRowText(
          row,
          header.headers,
          "soldby"
        );

      const salesperson =
        getRowText(
          row,
          header.headers,
          "salesperson"
        );

      const territory =
        getRowText(
          row,
          header.headers,
          "territory"
        );

      const customerPo =
        getRowText(
          row,
          header.headers,
          "customerpo"
        );

      const status =
        getRowText(
          row,
          header.headers,
          "status"
        );

      const sourceRow:
        ParsedErpSourceRow = {
          row_number:
            rowNumber,

          order_date:
            orderDate,

          order_number:
            orderNumber,

          line,
          customer_number:
            customerNumber,

          company:
            companyName,

          contact,
          phone,
          email,
          address,
          city,
          state,
          zip,

          item_number:
            itemNumber,

          product_line:
            productLine,

          description,
          qty,

          unit_price:
            unitPrice,

          ext_price:
            extPrice,

          sold_by:
            soldBy,

          salesperson,
          territory,

          customer_po:
            customerPo,

          status,
        };

      const aggregateKey =
        normalizeCustomerNumber(
          customerNumber
        );

      let aggregate =
        aggregates.get(
          aggregateKey
        );

      if (!aggregate) {
        aggregate = {
          customerNumber,
          companyName,

          normalizedCompanyName:
            normalizeCompanyName(
              companyName
            ),

          addressLine1:
            address,

          city,
          state,
          postalCode:
            zip,

          phone,
          email,

          emailDomain:
            domainFromEmail(
              email
            ),

          latestOrderDate:
            orderDate,

          latestOrderTimestamp:
            latestTimestamp(
              orderDate
            ),

          orderNumbers:
            new Set(),

          lineCount: 0,

          orderLineValue: 0,

          productLines:
            new Set(),

          salespeople:
            new Set(),

          territories:
            new Set(),

          statuses:
            new Set(),

          sourceRows: [],
        };

        aggregates.set(
          aggregateKey,
          aggregate
        );
      }

      const rowTimestamp =
        latestTimestamp(
          orderDate
        );

      if (
        rowTimestamp >
        aggregate.latestOrderTimestamp
      ) {
        aggregate.latestOrderTimestamp =
          rowTimestamp;

        aggregate.latestOrderDate =
          orderDate;

        aggregate.companyName =
          companyName ||
          aggregate.companyName;

        aggregate.normalizedCompanyName =
          normalizeCompanyName(
            aggregate.companyName
          );

        aggregate.addressLine1 =
          address ||
          aggregate.addressLine1;

        aggregate.city =
          city ||
          aggregate.city;

        aggregate.state =
          state ||
          aggregate.state;

        aggregate.postalCode =
          zip ||
          aggregate.postalCode;

        aggregate.phone =
          phone ||
          aggregate.phone;

        aggregate.email =
          email ||
          aggregate.email;

        aggregate.emailDomain =
          domainFromEmail(
            aggregate.email
          );
      }

      if (orderNumber) {
        aggregate.orderNumbers.add(
          orderNumber
        );
      }

      aggregate.lineCount += 1;

      aggregate.orderLineValue +=
        parseMoney(
          extPrice
        );

      if (productLine) {
        aggregate.productLines.add(
          productLine
        );
      }

      if (salesperson) {
        aggregate.salespeople.add(
          salesperson
        );
      }

      if (territory) {
        aggregate.territories.add(
          territory
        );
      }

      if (status) {
        aggregate.statuses.add(
          status
        );
      }

      aggregate.sourceRows.push(
        sourceRow
      );
    }

    if (
      aggregates.size === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No ERP customer rows with both Cust # and Company were found.",
        },
        {
          status: 400,
        }
      );
    }

    const [
      companies,
      contacts,
      activities,
      opportunities,
    ] =
      await Promise.all([
        fetchAllCompanies(
          supabase
        ),

        fetchAllContacts(
          supabase
        ),

        fetchAllActivities(
          supabase
        ),

        fetchAllOpportunities(
          supabase
        ),
      ]);

    const contactSignals =
      buildContactSignals(
        contacts
      );

    const activitySignals =
      buildActivitySignals(
        activities
      );

    const opportunitySignals =
      buildOpportunitySignals(
        opportunities
      );

    const customerNumberMap =
      new Map<
        string,
        CrmCompany[]
      >();

    for (
      const company of companies
    ) {
      const customerNumber =
        normalizeCustomerNumber(
          company.graymills_customer_number
        );

      if (!customerNumber) {
        continue;
      }

      const current =
        customerNumberMap.get(
          customerNumber
        ) ?? [];

      current.push(company);

      customerNumberMap.set(
        customerNumber,
        current
      );
    }

    const cleanedFileName =
      safeFileName(
        fileEntry.name
      );

    const storagePath =
      `runs/${Date.now()}-` +
      `${randomUUID()}-` +
      cleanedFileName;

    const mimeType =
      cleanText(
        fileEntry.type
      ) ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    const {
      error: uploadError,
    } =
      await supabase.storage
        .from(bucketName)
        .upload(
          storagePath,
          fileBuffer,
          {
            contentType:
              mimeType,

            upsert: false,
          }
        );

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: run,
      error: runInsertError,
    } =
      await supabase
        .from(
          "erp_reconciliation_runs"
        )
        .insert({
          source:
            "Graymills ERP",

          file_name:
            fileEntry.name,

          storage_bucket:
            bucketName,

          storage_path:
            storagePath,

          file_mime_type:
            mimeType,

          file_size_bytes:
            fileEntry.size,

          file_sha256:
            fileSha256,

          sheet_name:
            worksheet.name,

          report_title:
            reportTitle,

          header_row:
            header.rowNumber,

          source_row_count:
            sourceRowCount,

          customer_count:
            aggregates.size,

          status:
            "processing",

          created_by_user_id:
            access.context.crmUserId,

          created_by_name:
            access.context.crmDisplayName,
        })
        .select("*")
        .single();

    if (runInsertError) {
      await supabase.storage
        .from(bucketName)
        .remove([
          storagePath,
        ]);

      throw runInsertError;
    }

    runId =
      String(run.id);

    const {
      error: uploadedEventError,
    } =
      await supabase
        .from(
          "erp_reconciliation_events"
        )
        .insert({
          run_id:
            runId,

          event_type:
            "uploaded",

          event_data: {
            file_name:
              fileEntry.name,

            file_sha256:
              fileSha256,

            file_size_bytes:
              fileEntry.size,

            sheet_name:
              worksheet.name,

            header_row:
              header.rowNumber,
          },

          performed_by_user_id:
            access.context.crmUserId,

          performed_by_name:
            access.context.crmDisplayName,
        });

    if (uploadedEventError) {
      throw uploadedEventError;
    }

    const records: any[] =
      [];

    const counts = {
      confident: 0,
      likely: 0,
      ambiguous: 0,
      conflict: 0,
      unmatched: 0,
    };

    for (
      const aggregate of
      aggregates.values()
    ) {
      const match =
        proposedMatch(
          aggregate,
          companies,
          customerNumberMap,
          contactSignals,
          activitySignals,
          opportunitySignals
        );

      const matchStatus =
        match.match_status as
          | "confident"
          | "likely"
          | "ambiguous"
          | "conflict"
          | "unmatched";

      counts[
        matchStatus
      ] += 1;

      records.push({
        run_id:
          runId,

        erp_customer_number:
          aggregate.customerNumber,

        company_name:
          aggregate.companyName,

        normalized_company_name:
          aggregate.normalizedCompanyName,

        address_line_1:
          aggregate.addressLine1 ||
          null,

        city:
          aggregate.city ||
          null,

        state:
          aggregate.state ||
          null,

        postal_code:
          aggregate.postalCode ||
          null,

        phone:
          aggregate.phone ||
          null,

        email:
          aggregate.email ||
          null,

        email_domain:
          aggregate.emailDomain ||
          null,

        latest_order_date:
          aggregate.latestOrderDate,

        order_count:
          aggregate.orderNumbers.size,

        line_count:
          aggregate.lineCount,

        order_line_value:
          Math.round(
            aggregate.orderLineValue *
              100
          ) / 100,

        product_lines:
          arrayFromSet(
            aggregate.productLines
          ),

        erp_salespeople:
          arrayFromSet(
            aggregate.salespeople
          ),

        territories:
          arrayFromSet(
            aggregate.territories
          ),

        order_statuses:
          arrayFromSet(
            aggregate.statuses
          ),

        source_rows:
          aggregate.sourceRows,

        matched_company_id:
          match.matched_company_id,

        match_status:
          match.match_status,

        match_method:
          match.match_method,

        match_score:
          match.match_score,

        match_reasons:
          match.match_reasons,

        candidate_matches:
          match.candidate_matches,

        review_status:
          match.review_status,
      });
    }

    const batchSize = 200;

    for (
      let index = 0;
      index < records.length;
      index += batchSize
    ) {
      const batch =
        records.slice(
          index,
          index + batchSize
        );

      const {
        error,
      } =
        await supabase
          .from(
            "erp_reconciliation_customers"
          )
          .insert(batch);

      if (error) {
        throw error;
      }
    }

    const erpCustomerNumbers =
      new Set(
        Array.from(
          aggregates.keys()
        )
      );

    const crmCustomersAbsentFromErp =
      companies.filter(
        (company) => {
          const number =
            normalizeCustomerNumber(
              company.graymills_customer_number
            );

          return Boolean(
            number &&
            !erpCustomerNumbers.has(
              number
            )
          );
        }
      );

    const summary = {
      skipped_row_count:
        skippedRowCount,

      source_row_count:
        sourceRowCount,

      customer_count:
        aggregates.size,

      crm_company_count_evaluated:
        companies.length,

      crm_customer_numbers_not_in_erp_count:
        crmCustomersAbsentFromErp.length,

      matching_rules: [
        "Exact Graymills customer number",
        "Exact normalized company plus location",
        "Exact normalized company",
        "Leading normalized company-name phrase plus city/state",
        "Email/domain/phone/address supporting signals",
        "Fuzzy company name as review-only evidence",
      ],
    };

    const {
      data: completedRun,
      error: updateRunError,
    } =
      await supabase
        .from(
          "erp_reconciliation_runs"
        )
        .update({
          confident_match_count:
            counts.confident,

          likely_match_count:
            counts.likely,

          ambiguous_match_count:
            counts.ambiguous,

          conflict_count:
            counts.conflict,

          unmatched_count:
            counts.unmatched,

          summary,

          status:
            "ready_for_review",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          runId
        )
        .select("*")
        .single();

    if (updateRunError) {
      throw updateRunError;
    }

    const {
      error: parsedEventError,
    } =
      await supabase
        .from(
          "erp_reconciliation_events"
        )
        .insert([
          {
            run_id:
              runId,

            event_type:
              "parsed",

            event_data: {
              source_row_count:
                sourceRowCount,

              customer_count:
                aggregates.size,

              skipped_row_count:
                skippedRowCount,
            },

            performed_by_user_id:
              access.context.crmUserId,

            performed_by_name:
              access.context.crmDisplayName,
          },
          {
            run_id:
              runId,

            event_type:
              "matched",

            event_data: {
              ...counts,
            },

            performed_by_user_id:
              access.context.crmUserId,

            performed_by_name:
              access.context.crmDisplayName,
          },
        ]);

    if (parsedEventError) {
      throw parsedEventError;
    }

    const {
      data: savedCustomers,
      error: customersError,
    } =
      await supabase
        .from(
          "erp_reconciliation_customers"
        )
        .select("*")
        .eq(
          "run_id",
          runId
        )
        .order(
          "latest_order_date",
          {
            ascending: false,
            nullsFirst: false,
          }
        )
        .order(
          "company_name",
          {
            ascending: true,
          }
        );

    if (customersError) {
      throw customersError;
    }

    const signedUrl =
      await signedUrlForRun(
        supabase,
        completedRun
      );

    return NextResponse.json({
      status:
        "ready_for_review",

      run: {
        ...completedRun,
        signed_url:
          signedUrl,
      },

      customers:
        savedCustomers ?? [],

      message:
        "ERP workbook parsed and matched for review. No CRM records were changed.",
    });
  } catch (error) {
    if (runId) {
      const message =
        error instanceof Error
          ? error.message
          : "ERP reconciliation processing failed.";

      const now =
        new Date().toISOString();

      const {
        error: failedRunError,
      } =
        await supabase
          .from(
            "erp_reconciliation_runs"
          )
          .update({
            status:
              "failed",

            updated_at:
              now,

            summary: {
              processing_error:
                message,
            },
          })
          .eq(
            "id",
            runId
          );

      if (failedRunError) {
        console.error(
          "[erp-reconciliation-failed-run]",
          failedRunError
        );
      }

      const {
        error: failedEventError,
      } =
        await supabase
          .from(
            "erp_reconciliation_events"
          )
          .insert({
            run_id:
              runId,

            event_type:
              "processing_failed",

            event_data: {
              error:
                message,
            },

            performed_by_user_id:
              access.context.crmUserId,

            performed_by_name:
              access.context.crmDisplayName,
          });

      if (failedEventError) {
        console.error(
          "[erp-reconciliation-failed-event]",
          failedEventError
        );
      }
    }

    return errorResponse(
      error,
      "ERP reconciliation processing failed."
    );
  }
}

export async function PATCH(
  request: Request
) {
  const access =
    await verifyManagerAccess(
      request
    );

  if (access.response) {
    return access.response;
  }

  try {
    const supabase =
      getSupabaseAdmin();

    const payload =
      await request.json();

    const reconciliationCustomerId =
      cleanText(
        payload.reconciliationCustomerId
      );

    const action =
      cleanText(
        payload.action
      ).toLowerCase();

    const selectedCompanyId =
      cleanText(
        payload.companyId
      );

    const reviewNote =
      cleanText(
        payload.reviewNote
      ) ||
      null;

    if (!reconciliationCustomerId) {
      return NextResponse.json(
        {
          error:
            "Reconciliation customer id is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      action !== "link" &&
      action !== "reject"
    ) {
      return NextResponse.json(
        {
          error:
            'Review action must be "link" or "reject".',
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: reconciliation,
      error: loadError,
    } =
      await supabase
        .from(
          "erp_reconciliation_customers"
        )
        .select(
          `
          id,
          run_id,
          matched_company_id,
          candidate_matches,
          review_status
          `
        )
        .eq(
          "id",
          reconciliationCustomerId
        )
        .single();

    if (loadError) {
      throw loadError;
    }

    const now =
      new Date().toISOString();

    let update:
      Record<
        string,
        unknown
      >;

    let eventType:
      "review_confirmed" |
      "review_rejected";

    if (
      action === "link"
    ) {
      if (!selectedCompanyId) {
        return NextResponse.json(
          {
            error:
              "Select a CRM company before linking this ERP account.",
          },
          {
            status: 400,
          }
        );
      }

      const candidateIds =
        (
          Array.isArray(
            reconciliation.candidate_matches
          )
            ? reconciliation.candidate_matches
            : []
        )
          .map(
            (candidate: any) =>
              cleanText(
                candidate?.company_id
              )
          )
          .filter(Boolean);

      if (
        !candidateIds.includes(
          selectedCompanyId
        ) &&
        cleanText(
          reconciliation.matched_company_id
        ) !==
          selectedCompanyId
      ) {
        return NextResponse.json(
          {
            error:
              "The selected company is not one of the proposed CRM candidates.",
          },
          {
            status: 400,
          }
        );
      }

      const {
        data: company,
        error: companyError,
      } =
        await supabase
          .from("companies")
          .select(
            `
            id,
            company_name,
            graymills_customer_number,
            archived_at
            `
          )
          .eq(
            "id",
            selectedCompanyId
          )
          .is(
            "archived_at",
            null
          )
          .maybeSingle();

      if (companyError) {
        throw companyError;
      }

      if (!company) {
        return NextResponse.json(
          {
            error:
              "The selected CRM company is not active or no longer exists.",
          },
          {
            status: 400,
          }
        );
      }

      const {
        data: linkResult,
        error: linkError,
      } =
        await supabase.rpc(
          "apply_erp_reconciliation_customer_link",
          {
            p_reconciliation_customer_id:
              reconciliationCustomerId,

            p_company_id:
              selectedCompanyId,

            p_actor_user_id:
              access.context.crmUserId,

            p_actor_name:
              access.context.crmDisplayName,

            p_review_note:
              reviewNote,
          }
        );

      if (linkError) {
        throw linkError;
      }

      return NextResponse.json({
        status:
          "linked",

        link:
          linkResult,

        message:
          `Account linked. ERP customer ${cleanText(
            (linkResult as any)?.erp_customer_number
          ) || "number"} is now linked to ${cleanText(
            (linkResult as any)?.company_name
          ) || "the selected CRM company"}.`,
      });
    } else {
      update = {
        matched_company_id:
          null,

        review_status:
          "rejected",

        reviewed_by_user_id:
          access.context.crmUserId,

        reviewed_by_name:
          access.context.crmDisplayName,

        reviewed_at:
          now,

        review_note:
          reviewNote,

        updated_at:
          now,
      };

      eventType =
        "review_rejected";
    }

    const {
      data: updated,
      error: updateError,
    } =
      await supabase
        .from(
          "erp_reconciliation_customers"
        )
        .update(update)
        .eq(
          "id",
          reconciliationCustomerId
        )
        .select("*")
        .single();

    if (updateError) {
      throw updateError;
    }

    const {
      error: eventError,
    } =
      await supabase
        .from(
          "erp_reconciliation_events"
        )
        .insert({
          run_id:
            reconciliation.run_id,

          reconciliation_customer_id:
            reconciliationCustomerId,

          event_type:
            eventType,

          event_data: {
            company_id:
              null,

            review_note:
              reviewNote,
          },

          performed_by_user_id:
            access.context.crmUserId,

          performed_by_name:
            access.context.crmDisplayName,
        });

    if (eventError) {
      throw eventError;
    }

    return NextResponse.json({
      status:
        "rejected",

      reconciliation:
        updated,

      message:
        "Proposed ERP-to-CRM match rejected. The CRM company record was not changed.",
    });
  } catch (error) {
    return errorResponse(
      error,
      "Could not save the ERP reconciliation review."
    );
  }
}