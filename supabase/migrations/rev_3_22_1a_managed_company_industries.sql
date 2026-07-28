-- Version 3.22.1
-- Managed Company Industry / Sub-Industry definitions
--
-- Purpose:
-- 1. Preserve companies.primary_industry and companies.primary_sub_industry as text
--    so existing data and imports remain compatible.
-- 2. Add managed definition tables that drive approved dropdown choices.
-- 3. Allow sub-industries to belong to a parent industry.
-- 4. Backfill current company values into the managed lists without changing companies.
-- 5. Keep archived choices available for historical records while preventing new use in UI.

create table if not exists public.company_industry_definitions (
  id uuid primary key default gen_random_uuid(),
  industry_name text not null,
  sort_order integer not null default 100,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_company_industry_definitions_name_ci
on public.company_industry_definitions (lower(industry_name));

create index if not exists idx_company_industry_definitions_status
on public.company_industry_definitions (status);

create index if not exists idx_company_industry_definitions_sort_order
on public.company_industry_definitions (sort_order, industry_name);

create table if not exists public.company_sub_industry_definitions (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid null
    references public.company_industry_definitions(id)
    on delete restrict,
  sub_industry_name text not null,
  sort_order integer not null default 100,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_company_sub_industry_definitions_parent_name_ci
on public.company_sub_industry_definitions (
  industry_id,
  lower(sub_industry_name)
)
where industry_id is not null;

create unique index if not exists uq_company_sub_industry_definitions_orphan_name_ci
on public.company_sub_industry_definitions (
  lower(sub_industry_name)
)
where industry_id is null;

create index if not exists idx_company_sub_industry_definitions_industry_id
on public.company_sub_industry_definitions (industry_id);

create index if not exists idx_company_sub_industry_definitions_status
on public.company_sub_industry_definitions (status);

create index if not exists idx_company_sub_industry_definitions_sort_order
on public.company_sub_industry_definitions (
  industry_id,
  sort_order,
  sub_industry_name
);

alter table public.company_industry_definitions enable row level security;
alter table public.company_sub_industry_definitions enable row level security;

-- Backfill distinct current Primary Industry values.
with current_industries as (
  select
    lower(btrim(primary_industry)) as industry_key,
    min(btrim(primary_industry)) as industry_name
  from public.companies
  where nullif(btrim(primary_industry), '') is not null
  group by lower(btrim(primary_industry))
)
insert into public.company_industry_definitions (
  industry_name,
  sort_order,
  status
)
select
  ci.industry_name,
  100,
  'active'
from current_industries ci
where not exists (
  select 1
  from public.company_industry_definitions d
  where lower(d.industry_name) = ci.industry_key
);

-- Backfill current Primary Sub-Industry values that have a Primary Industry.
with current_pairs as (
  select
    lower(btrim(primary_industry)) as industry_key,
    lower(btrim(primary_sub_industry)) as sub_industry_key,
    min(btrim(primary_sub_industry)) as sub_industry_name
  from public.companies
  where nullif(btrim(primary_industry), '') is not null
    and nullif(btrim(primary_sub_industry), '') is not null
  group by
    lower(btrim(primary_industry)),
    lower(btrim(primary_sub_industry))
)
insert into public.company_sub_industry_definitions (
  industry_id,
  sub_industry_name,
  sort_order,
  status
)
select
  d.id,
  cp.sub_industry_name,
  100,
  'active'
from current_pairs cp
join public.company_industry_definitions d
  on lower(d.industry_name) = cp.industry_key
where not exists (
  select 1
  from public.company_sub_industry_definitions sd
  where sd.industry_id = d.id
    and lower(sd.sub_industry_name) = cp.sub_industry_key
);

-- Preserve any legacy Sub-Industry values that currently have no Primary Industry.
-- These remain unassigned until an Admin or Sales Manager associates them later.
with orphan_sub_industries as (
  select
    lower(btrim(primary_sub_industry)) as sub_industry_key,
    min(btrim(primary_sub_industry)) as sub_industry_name
  from public.companies
  where nullif(btrim(primary_industry), '') is null
    and nullif(btrim(primary_sub_industry), '') is not null
  group by lower(btrim(primary_sub_industry))
)
insert into public.company_sub_industry_definitions (
  industry_id,
  sub_industry_name,
  sort_order,
  status
)
select
  null,
  osi.sub_industry_name,
  100,
  'active'
from orphan_sub_industries osi
where not exists (
  select 1
  from public.company_sub_industry_definitions sd
  where sd.industry_id is null
    and lower(sd.sub_industry_name) = osi.sub_industry_key
);

select
  id,
  industry_name,
  sort_order,
  status
from public.company_industry_definitions
order by sort_order, industry_name;

select
  sd.id,
  sd.industry_id,
  d.industry_name,
  sd.sub_industry_name,
  sd.sort_order,
  sd.status
from public.company_sub_industry_definitions sd
left join public.company_industry_definitions d
  on d.id = sd.industry_id
order by
  coalesce(d.sort_order, 999999),
  d.industry_name nulls last,
  sd.sort_order,
  sd.sub_industry_name;
