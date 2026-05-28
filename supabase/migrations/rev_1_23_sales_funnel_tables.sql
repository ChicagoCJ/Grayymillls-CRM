-- Rev 1.23 — Sales Funnel Tables

create table if not exists sales_funnel_stages (
  id uuid primary key default gen_random_uuid(),
  stage_name text not null unique,
  stage_key text not null unique,
  description text,
  sort_order integer not null default 100,
  default_probability integer not null default 0 check (default_probability >= 0 and default_probability <= 100),
  is_open_stage boolean not null default true,
  is_won_stage boolean not null default false,
  is_lost_stage boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists sales_opportunities (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  prospect_id uuid references prospects(id) on delete set null,

  opportunity_name text not null,
  opportunity_type text,
  product_line text,
  likely_product_path text,
  primary_use_case text,

  stage_id uuid references sales_funnel_stages(id) on delete set null,

  estimated_value numeric(14,2),
  probability integer check (probability >= 0 and probability <= 100),
  expected_close_date date,

  next_step text,
  customer_need text,
  business_case text,
  competitive_situation text,
  decision_criteria text,
  buying_committee_notes text,

  source text,
  owner text,

  status text not null default 'open' check (status in ('open', 'won', 'lost', 'archived')),
  lost_reason text,
  won_at timestamptz,
  lost_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists sales_opportunity_activities (
  id uuid primary key default gen_random_uuid(),

  opportunity_id uuid not null references sales_opportunities(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,

  activity_type text not null default 'note',
  subject text,
  notes text,
  due_date date,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_funnel_stages_sort_order
on sales_funnel_stages(sort_order);

create index if not exists idx_sales_funnel_stages_status
on sales_funnel_stages(status);

create index if not exists idx_sales_opportunities_company_id
on sales_opportunities(company_id);

create index if not exists idx_sales_opportunities_contact_id
on sales_opportunities(contact_id);

create index if not exists idx_sales_opportunities_prospect_id
on sales_opportunities(prospect_id);

create index if not exists idx_sales_opportunities_stage_id
on sales_opportunities(stage_id);

create index if not exists idx_sales_opportunities_status
on sales_opportunities(status);

create index if not exists idx_sales_opportunities_expected_close_date
on sales_opportunities(expected_close_date);

create index if not exists idx_sales_opportunity_activities_opportunity_id
on sales_opportunity_activities(opportunity_id);

create index if not exists idx_sales_opportunity_activities_company_id
on sales_opportunity_activities(company_id);

create index if not exists idx_sales_opportunity_activities_due_date
on sales_opportunity_activities(due_date);

insert into sales_funnel_stages (
  stage_name,
  stage_key,
  description,
  sort_order,
  default_probability,
  is_open_stage,
  is_won_stage,
  is_lost_stage,
  status
)
values
(
  'New / Unqualified',
  'new_unqualified',
  'Potential opportunity identified but not yet qualified with real application, need, timing, or buyer engagement.',
  10,
  5,
  true,
  false,
  false,
  'active'
),
(
  'Discovery',
  'discovery',
  'Sales is validating application details, parts, soils, process, current pain, stakeholders, and commercial relevance.',
  20,
  15,
  true,
  false,
  false,
  'active'
),
(
  'Application Fit',
  'application_fit',
  'Graymills product path appears relevant, but solution details, economics, and buying process still need validation.',
  30,
  30,
  true,
  false,
  false,
  'active'
),
(
  'Solution / Quote',
  'solution_quote',
  'A specific solution, configuration, quote, or commercial proposal is being prepared or has been shared.',
  40,
  50,
  true,
  false,
  false,
  'active'
),
(
  'Technical / Commercial Review',
  'technical_commercial_review',
  'Customer is reviewing technical fit, budget, procurement, decision criteria, approvals, or alternatives.',
  50,
  65,
  true,
  false,
  false,
  'active'
),
(
  'Commit / Purchase Process',
  'commit_purchase_process',
  'Customer appears to be moving toward purchase, PO, approval, final documentation, or implementation planning.',
  60,
  80,
  true,
  false,
  false,
  'active'
),
(
  'Closed Won',
  'closed_won',
  'Opportunity resulted in an order or confirmed commercial win.',
  90,
  100,
  false,
  true,
  false,
  'active'
),
(
  'Closed Lost',
  'closed_lost',
  'Opportunity did not result in an order.',
  100,
  0,
  false,
  false,
  true,
  'active'
)
on conflict (stage_key) do update
set
  stage_name = excluded.stage_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  default_probability = excluded.default_probability,
  is_open_stage = excluded.is_open_stage,
  is_won_stage = excluded.is_won_stage,
  is_lost_stage = excluded.is_lost_stage,
  status = excluded.status,
  updated_at = now();

select
  stage_name,
  stage_key,
  sort_order,
  default_probability,
  is_open_stage,
  is_won_stage,
  is_lost_stage
from sales_funnel_stages
order by sort_order;