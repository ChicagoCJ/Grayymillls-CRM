-- Version 3.26
-- ERP-to-CRM Company & Activity Reconciliation
-- Non-destructive database foundation.
--
-- This migration does NOT update companies, contacts, activities,
-- opportunities, Graymills customer numbers, sales assignments,
-- classifications, or existing import records.

create table if not exists public.erp_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),

  source text not null default 'Graymills ERP',

  file_name text not null,
  storage_bucket text not null
    default 'graymills-erp-reconciliation',
  storage_path text not null unique,

  file_mime_type text,
  file_size_bytes bigint,
  file_sha256 text not null,

  sheet_name text,
  report_title text,
  header_row integer not null default 3,

  source_row_count integer not null default 0,
  customer_count integer not null default 0,

  confident_match_count integer not null default 0,
  likely_match_count integer not null default 0,
  ambiguous_match_count integer not null default 0,
  conflict_count integer not null default 0,
  unmatched_count integer not null default 0,

  status text not null default 'uploaded'
    check (
      status in (
        'uploaded',
        'processing',
        'ready_for_review',
        'completed',
        'failed',
        'archived'
      )
    ),

  summary jsonb not null default '{}'::jsonb,

  created_by_user_id uuid
    references public.crm_users(id)
    on delete set null,

  created_by_name text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  archived_at timestamptz
);

create table if not exists public.erp_reconciliation_customers (
  id uuid primary key default gen_random_uuid(),

  run_id uuid not null
    references public.erp_reconciliation_runs(id)
    on delete cascade,

  erp_customer_number text not null,

  company_name text not null,
  normalized_company_name text not null,

  address_line_1 text,
  city text,
  state text,
  postal_code text,

  phone text,
  email text,
  email_domain text,

  latest_order_date date,

  order_count integer not null default 0,
  line_count integer not null default 0,

  order_line_value numeric(18,2) not null default 0,

  product_lines text[] not null default '{}'::text[],
  erp_salespeople text[] not null default '{}'::text[],
  territories text[] not null default '{}'::text[],
  order_statuses text[] not null default '{}'::text[],

  source_rows jsonb not null default '[]'::jsonb,

  matched_company_id uuid
    references public.companies(id)
    on delete set null,

  match_status text not null default 'unmatched'
    check (
      match_status in (
        'confident',
        'likely',
        'ambiguous',
        'conflict',
        'unmatched'
      )
    ),

  match_method text,

  match_score integer
    check (
      match_score is null
      or (
        match_score >= 0
        and match_score <= 100
      )
    ),

  match_reasons jsonb not null default '[]'::jsonb,
  candidate_matches jsonb not null default '[]'::jsonb,

  review_status text not null default 'unreviewed'
    check (
      review_status in (
        'unreviewed',
        'needs_review',
        'confirmed',
        'rejected'
      )
    ),

  reviewed_by_user_id uuid
    references public.crm_users(id)
    on delete set null,

  reviewed_by_name text,
  reviewed_at timestamptz,
  review_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    run_id,
    erp_customer_number
  )
);

create table if not exists public.erp_reconciliation_events (
  id uuid primary key default gen_random_uuid(),

  run_id uuid not null
    references public.erp_reconciliation_runs(id)
    on delete cascade,

  reconciliation_customer_id uuid
    references public.erp_reconciliation_customers(id)
    on delete cascade,

  event_type text not null
    check (
      event_type in (
        'uploaded',
        'parsed',
        'matched',
        'review_confirmed',
        'review_rejected',
        'review_reset',
        'customer_number_applied',
        'archived',
        'restored',
        'processing_failed'
      )
    ),

  event_data jsonb not null default '{}'::jsonb,

  performed_by_user_id uuid
    references public.crm_users(id)
    on delete set null,

  performed_by_name text,

  created_at timestamptz not null default now()
);

create index if not exists
  idx_erp_reconciliation_runs_created_at
on public.erp_reconciliation_runs (
  created_at desc
);

create index if not exists
  idx_erp_reconciliation_runs_status
on public.erp_reconciliation_runs (
  status
);

create index if not exists
  idx_erp_reconciliation_customers_run_id
on public.erp_reconciliation_customers (
  run_id
);

create index if not exists
  idx_erp_reconciliation_customers_customer_number
on public.erp_reconciliation_customers (
  erp_customer_number
);

create index if not exists
  idx_erp_reconciliation_customers_company_name
on public.erp_reconciliation_customers (
  normalized_company_name
);

create index if not exists
  idx_erp_reconciliation_customers_match_status
on public.erp_reconciliation_customers (
  run_id,
  match_status
);

create index if not exists
  idx_erp_reconciliation_customers_review_status
on public.erp_reconciliation_customers (
  run_id,
  review_status
);

create index if not exists
  idx_erp_reconciliation_customers_matched_company
on public.erp_reconciliation_customers (
  matched_company_id
);

create index if not exists
  idx_erp_reconciliation_customers_latest_order
on public.erp_reconciliation_customers (
  latest_order_date desc
);

create index if not exists
  idx_erp_reconciliation_events_run_created
on public.erp_reconciliation_events (
  run_id,
  created_at desc
);

create index if not exists
  idx_erp_reconciliation_events_customer_created
on public.erp_reconciliation_events (
  reconciliation_customer_id,
  created_at desc
);

-- Backend-only access.
-- Application API routes use the Supabase service-role client after
-- verifying the signed-in CRM user and role.
alter table public.erp_reconciliation_runs
  enable row level security;

alter table public.erp_reconciliation_customers
  enable row level security;

alter table public.erp_reconciliation_events
  enable row level security;

-- Private bucket. No public object policies are created.
-- Files will only be handled by verified server-side API routes.
insert into storage.buckets (
  id,
  name,
  public
)
values (
  'graymills-erp-reconciliation',
  'graymills-erp-reconciliation',
  false
)
on conflict (id) do update
set
  name = excluded.name,
  public = false;

comment on table public.erp_reconciliation_runs is
  'Audit record for each Graymills ERP workbook submitted for CRM reconciliation.';

comment on table public.erp_reconciliation_customers is
  'Customer-level ERP summaries and proposed CRM matches requiring human review.';

comment on table public.erp_reconciliation_events is
  'Append-only audit events for ERP reconciliation processing and review actions.';

comment on column public.erp_reconciliation_customers.order_line_value is
  'Sum of ERP Ext Price values in the uploaded report; this is not labeled recognized revenue.';

comment on column public.erp_reconciliation_customers.matched_company_id is
  'Proposed or reviewer-confirmed CRM company. Does not itself modify the CRM company record.';

comment on column public.erp_reconciliation_customers.source_rows is
  'Parsed ERP order-line evidence supporting the aggregated customer reconciliation record.';

select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'erp_reconciliation_runs',
    'erp_reconciliation_customers',
    'erp_reconciliation_events'
  )
order by table_name;

select
  id,
  name,
  public
from storage.buckets
where id = 'graymills-erp-reconciliation';