-- Version 3.14B
-- Multiple related contacts for company activities, sales opportunities,
-- and sales opportunity activities.
--
-- Existing contact_id columns remain the Primary Contact.
-- These assignment tables store additional Related Contacts only.

create table if not exists public.activity_contact_assignments (
  id uuid primary key default gen_random_uuid(),

  activity_id uuid not null
    references public.activities(id)
    on delete cascade,

  contact_id uuid not null
    references public.contacts(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  unique (activity_id, contact_id)
);

create table if not exists public.opportunity_contact_assignments (
  id uuid primary key default gen_random_uuid(),

  opportunity_id uuid not null
    references public.sales_opportunities(id)
    on delete cascade,

  contact_id uuid not null
    references public.contacts(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  unique (opportunity_id, contact_id)
);

create table if not exists public.opportunity_activity_contact_assignments (
  id uuid primary key default gen_random_uuid(),

  opportunity_activity_id uuid not null
    references public.sales_opportunity_activities(id)
    on delete cascade,

  contact_id uuid not null
    references public.contacts(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  unique (opportunity_activity_id, contact_id)
);

alter table public.activity_contact_assignments
enable row level security;

alter table public.opportunity_contact_assignments
enable row level security;

alter table public.opportunity_activity_contact_assignments
enable row level security;

create index if not exists idx_activity_contact_assignments_activity_id
  on public.activity_contact_assignments(activity_id);

create index if not exists idx_activity_contact_assignments_contact_id
  on public.activity_contact_assignments(contact_id);

create index if not exists idx_opportunity_contact_assignments_opportunity_id
  on public.opportunity_contact_assignments(opportunity_id);

create index if not exists idx_opportunity_contact_assignments_contact_id
  on public.opportunity_contact_assignments(contact_id);

create index if not exists idx_opportunity_activity_contact_assignments_activity_id
  on public.opportunity_activity_contact_assignments(opportunity_activity_id);

create index if not exists idx_opportunity_activity_contact_assignments_contact_id
  on public.opportunity_activity_contact_assignments(contact_id);

comment on table public.activity_contact_assignments is
  'Additional contacts related to a company activity. activities.contact_id remains the Primary Contact.';

comment on table public.opportunity_contact_assignments is
  'Additional contacts related to a sales opportunity. sales_opportunities.contact_id remains the Primary Contact.';

comment on table public.opportunity_activity_contact_assignments is
  'Additional contacts related to a sales opportunity activity. sales_opportunity_activities.contact_id remains the Primary Contact.';

select
  c.relname as table_name,
  c.relrowsecurity as row_security
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'activity_contact_assignments',
    'opportunity_contact_assignments',
    'opportunity_activity_contact_assignments'
  )
  and c.relkind = 'r'
order by c.relname;

select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'activity_contact_assignments',
    'opportunity_contact_assignments',
    'opportunity_activity_contact_assignments'
  )
order by tablename, indexname;
