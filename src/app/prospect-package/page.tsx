import { createClient } from "@supabase/supabase-js";
import PrintButton from "./PrintButton";

type SearchParams = {
  companyId?: string;
};

type JsonRecord = Record<string, unknown>;

const APP_VERSION = "Rev 1.10 — Print-Ready Prospecting Package View";
const REVISION_NOTE =
  "Dedicated print package view for company prospecting summaries.";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function parseArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPrimaryText(item: unknown, keys: string[]) {
  if (!isRecord(item)) return displayValue(item);
  const key = keys.find((candidate) => item[candidate]);
  return key ? displayValue(item[key]) : "Item";
}

function getSecondaryText(item: unknown, keys: string[]) {
  if (!isRecord(item)) return "";
  const key = keys.find((candidate) => item[candidate]);
  return key ? displayValue(item[key]) : "";
}

export default async function ProspectPackagePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const companyId = params.companyId;

  if (!companyId) {
    return (
      <main className="min-h-screen bg-white p-10 text-slate-900">
        <h1 className="text-2xl font-bold">Missing company ID</h1>
        <p className="mt-3 text-slate-600">
          Open this page from a company record or add a companyId query parameter.
        </p>
      </main>
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (companyError) {
    throw companyError;
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("*")
    .eq("company_id", companyId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (contactsError) {
    throw contactsError;
  }

  const { data: prospects, error: prospectsError } = await supabase
    .from("prospects")
    .select("*")
    .eq("company_id", companyId)
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: false });

  if (prospectsError) {
    throw prospectsError;
  }

  const primaryProspect = prospects?.[0] ?? null;

  let intelligence: JsonRecord | null = null;

  if (primaryProspect) {
    const { data: intelligenceData, error: intelligenceError } = await supabase
      .from("prospect_intelligence")
      .select("*")
      .eq("prospect_id", primaryProspect.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (intelligenceError) {
      throw intelligenceError;
    }

    intelligence = intelligenceData;
  }

  const discoveryQuestions = parseArray(intelligence?.discovery_questions);
  const recommendedProductPaths = parseArray(intelligence?.recommended_product_paths);
  const likelyObjections = parseArray(intelligence?.likely_objections);
  const buyingCommittee = parseArray(intelligence?.buying_committee_hypothesis);
  const triggerEvents = parseArray(intelligence?.trigger_events);
  const whatNotToSay = parseArray(intelligence?.what_not_to_say);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6 text-slate-950 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:p-8 print:shadow-none">
        <div className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-6 print:hidden">
          <p className="text-sm font-semibold text-blue-700">{APP_VERSION}</p>
          <p className="text-sm text-slate-600">{REVISION_NOTE}</p>
          <PrintButton />
        </div>

        <section className="border-b border-slate-300 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Graymills Prospecting Package
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            {displayValue(company.company_name)}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-700">
            {displayValue(company.industry)}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <ScoreBox
              label="Priority Score"
              value={
                primaryProspect
                  ? `${displayValue(primaryProspect.priority_score)} / 100`
                  : "Not scored"
              }
            />
            <ScoreBox
              label="Tier"
              value={primaryProspect ? displayValue(primaryProspect.priority_tier) : "—"}
            />
            <ScoreBox
              label="Fit"
              value={primaryProspect ? displayValue(primaryProspect.fit_rating) : "—"}
            />
            <ScoreBox
              label="Confidence"
              value={primaryProspect ? displayValue(primaryProspect.confidence) : "—"}
            />
          </div>
        </section>

        <section className="grid gap-6 border-b border-slate-300 py-6 md:grid-cols-2">
          <PackageCard title="Company Snapshot">
            <InfoRow label="Website" value={company.website} />
            <InfoRow label="Domain" value={company.domain} />
            <InfoRow label="Phone" value={company.company_phone} />
            <InfoRow label="Employees" value={company.employee_count} />
            <InfoRow label="Revenue" value={company.revenue} />
            <InfoRow
              label="Location"
              value={[company.city, company.state, company.country].filter(Boolean).join(", ")}
            />
          </PackageCard>

          <PackageCard title="Prospect Summary">
            <InfoRow label="Product Line" value={primaryProspect?.product_line} />
            <InfoRow label="Likely Product Path" value={primaryProspect?.likely_product_path} />
            <InfoRow label="Primary Use Case" value={primaryProspect?.primary_use_case} />
            <InfoRow label="Likely Soils" value={primaryProspect?.likely_soils} />
            <InfoRow label="Cleaning Action" value={primaryProspect?.likely_cleaning_action} />
          </PackageCard>
        </section>

        <section className="border-b border-slate-300 py-6">
          <h2 className="text-2xl font-bold">Primary Contacts</h2>

          {!contacts || contacts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No contacts attached.</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {contacts.map((contact) => (
                <div key={contact.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-semibold">
                    {displayValue(
                      contact.full_name ||
                        [contact.first_name, contact.last_name].filter(Boolean).join(" ")
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{displayValue(contact.title)}</p>
                  <div className="mt-3 grid gap-1 text-sm text-slate-700">
                    <p>Email: {displayValue(contact.email)}</p>
                    <p>Direct: {displayValue(contact.direct_phone)}</p>
                    <p>Mobile: {displayValue(contact.mobile_phone)}</p>
                    <p>Function: {displayValue(contact.function_area || contact.department)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 border-b border-slate-300 py-6 md:grid-cols-2">
          <PackageCard title="What They Do">
            <Paragraph value={intelligence?.what_they_do} />
          </PackageCard>

          <PackageCard title="Likely Graymills Relevance">
            <Paragraph value={intelligence?.likely_relevance} />
          </PackageCard>

          <PackageCard title="Likely Parts / Components Cleaned">
            <Paragraph value={intelligence?.likely_parts_cleaned} />
          </PackageCard>

          <PackageCard title="Likely Soils / Contaminants">
            <Paragraph value={intelligence?.likely_soils_contaminants} />
          </PackageCard>

          <PackageCard title="Likely Pain Points">
            <Paragraph value={intelligence?.likely_pain_points} />
          </PackageCard>

          <PackageCard title="Suggested Sales Angle">
            <Paragraph value={intelligence?.suggested_sales_angle} />
          </PackageCard>

          <PackageCard title="Buyer Persona">
            <Paragraph value={intelligence?.buyer_persona} />
          </PackageCard>

          <PackageCard title="Likely Priorities">
            <Paragraph value={intelligence?.likely_priorities} />
          </PackageCard>
        </section>

        <section className="border-b border-slate-300 py-6">
          <h2 className="text-2xl font-bold">Next Best Action</h2>
          <p className="mt-3 text-sm leading-7 text-slate-800">
            {displayValue(primaryProspect?.next_best_action)}
          </p>
        </section>

        <section className="border-b border-slate-300 py-6">
          <h2 className="text-2xl font-bold">Discovery Questions</h2>

          {discoveryQuestions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No discovery questions generated.</p>
          ) : (
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-7 text-slate-800">
              {discoveryQuestions.map((question, index) => (
                <li key={`${String(question)}-${index}`}>{displayValue(question)}</li>
              ))}
            </ol>
          )}
        </section>

        <section className="grid gap-6 border-b border-slate-300 py-6 md:grid-cols-2">
          <PackageCard title="First Call Opener">
            <Paragraph value={intelligence?.first_call_opener} />
          </PackageCard>

          <PackageCard title="Email Draft">
            <p className="text-sm font-semibold text-slate-900">
              Subject: {displayValue(intelligence?.email_subject)}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-800">
              {displayValue(intelligence?.email_message)}
            </p>
          </PackageCard>
        </section>

        <section className="grid gap-6 border-b border-slate-300 py-6 md:grid-cols-2">
          <ReadableArraySection
            title="Recommended Product Paths"
            items={recommendedProductPaths}
            primaryKeys={["path", "product_path", "name", "title"]}
            secondaryKeys={["when_relevant", "description", "rationale", "notes"]}
          />

          <ReadableArraySection
            title="Likely Objections and Responses"
            items={likelyObjections}
            primaryKeys={["objection", "title", "concern"]}
            secondaryKeys={["response", "answer", "recommended_response", "notes"]}
          />

          <ReadableArraySection
            title="Buying Committee Hypothesis"
            items={buyingCommittee}
            primaryKeys={["role", "title", "stakeholder"]}
            secondaryKeys={["concern", "priority", "notes"]}
          />

          <ReadableArraySection
            title="Trigger Events"
            items={triggerEvents}
            primaryKeys={["trigger", "event", "title"]}
            secondaryKeys={["reason", "description", "notes"]}
          />
        </section>

        <section className="border-b border-slate-300 py-6">
          <ReadableArraySection
            title="What Not to Say"
            items={whatNotToSay}
            primaryKeys={["do_not_say", "bad_claim", "claim"]}
            secondaryKeys={["say_instead", "better_language", "response"]}
          />
        </section>

        <section className="py-6">
          <h2 className="text-2xl font-bold">Copyable Sales Block</h2>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-800 print:bg-white">
            {displayValue(intelligence?.copyable_sales_block)}
          </div>
        </section>

        <footer className="mt-8 border-t border-slate-300 pt-4 text-xs text-slate-500">
          <p>
            Generated from Graymills Prospecting Tool {APP_VERSION}. All AI-style
            recommendations should be validated through application discovery: parts, soils,
            chemistry, throughput, handling, safety, workflow, and cleaning requirements.
          </p>
        </footer>
      </div>
    </main>
  );
}

function ScoreBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 print:border-slate-300 print:bg-white">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 print:text-slate-600">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-blue-950 print:text-slate-950">{value}</p>
    </div>
  );
}

function PackageCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="break-inside-avoid rounded-xl border border-slate-200 p-4">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="border-b border-slate-100 py-2 text-sm last:border-b-0">
      <p className="font-semibold text-slate-800">{label}</p>
      <p className="mt-1 leading-6 text-slate-700">{displayValue(value)}</p>
    </div>
  );
}

function Paragraph({ value }: { value: unknown }) {
  return <p className="text-sm leading-7 text-slate-800">{displayValue(value)}</p>;
}

function ReadableArraySection({
  title,
  items,
  primaryKeys,
  secondaryKeys,
}: {
  title: string;
  items: unknown[];
  primaryKeys: string[];
  secondaryKeys: string[];
}) {
  return (
    <div className="break-inside-avoid rounded-xl border border-slate-200 p-4">
      <h2 className="text-lg font-bold">{title}</h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No items generated.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {items.map((item, index) => {
            const primary = getPrimaryText(item, primaryKeys);
            const secondary = getSecondaryText(item, secondaryKeys);

            return (
              <div key={index} className="rounded-lg bg-slate-50 p-3 print:bg-white">
                <p className="font-semibold text-slate-900">{primary}</p>
                {secondary && (
                  <p className="mt-2 text-sm leading-6 text-slate-700">{secondary}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}