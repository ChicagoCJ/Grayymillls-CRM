-- Version 3.22.1
-- Graymills Category > Industry > optional Sub-Industry hierarchy
--
-- Design:
-- 1. Graymills Category is the stable top-level product-line routing dimension.
-- 2. Seed the four current Graymills Categories with immutable category_key values:
--      parts_washers, pumps, graphics, job_shop_fab
-- 3. Scope managed Industry definitions to a Graymills Category.
-- 4. Keep Sub-Industry optional and scoped through its parent Industry.
-- 5. Allow one company to have one classification per Graymills Category,
--    so a company can be relevant to multiple Graymills product lines.
-- 6. Preserve existing companies.primary_industry / primary_sub_industry text fields
--    and existing managed definitions as legacy data until they are deliberately
--    assigned into the new hierarchy.
-- 7. The stable category_key is intended to route the postponed category-specific
--    AI prospect research later without depending on a display label.

create table if not exists public.graymills_category_definitions (
  id uuid primary key default gen_random_uuid(),
  category_key text not null,
  category_name text not null,
  sort_order integer not null default 100,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_graymills_category_definitions_key
on public.graymills_category_definitions (category_key);

create unique index if not exists uq_graymills_category_definitions_name_ci
on public.graymills_category_definitions (lower(category_name));

create index if not exists idx_graymills_category_definitions_status_sort
on public.graymills_category_definitions (status, sort_order, category_name);

insert into public.graymills_category_definitions (
  category_key,
  category_name,
  sort_order,
  status
)
values
  ('parts_washers', 'Parts Washers', 10, 'active'),
  ('pumps', 'Pumps', 20, 'active'),
  ('graphics', 'Graphics', 30, 'active'),
  ('job_shop_fab', 'Job Shop Fab', 40, 'active')
on conflict (category_key)
do update set
  category_name = excluded.category_name,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.company_industry_definitions
add column if not exists graymills_category_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_company_industry_definitions_graymills_category'
  ) then
    alter table public.company_industry_definitions
      add constraint fk_company_industry_definitions_graymills_category
      foreign key (graymills_category_id)
      references public.graymills_category_definitions(id)
      on delete restrict;
  end if;
end
$$;

-- The original Rev 3.22.1 schema made Industry names globally unique.
-- The same Industry may legitimately exist under more than one Graymills Category,
-- so uniqueness now belongs within Category.
drop index if exists public.uq_company_industry_definitions_name_ci;

create unique index if not exists uq_company_industry_definitions_category_name_ci
on public.company_industry_definitions (
  graymills_category_id,
  lower(industry_name)
)
where graymills_category_id is not null;

-- Preserve legacy/unassigned definitions without allowing duplicate orphan names.
create unique index if not exists uq_company_industry_definitions_unassigned_name_ci
on public.company_industry_definitions (
  lower(industry_name)
)
where graymills_category_id is null;

create index if not exists idx_company_industry_definitions_graymills_category
on public.company_industry_definitions (
  graymills_category_id,
  status,
  sort_order,
  industry_name
);

create table if not exists public.company_graymills_classifications (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null
    references public.companies(id)
    on delete cascade,

  graymills_category_id uuid not null
    references public.graymills_category_definitions(id)
    on delete restrict,

  industry_id uuid
    references public.company_industry_definitions(id)
    on delete restrict,

  sub_industry_id uuid
    references public.company_sub_industry_definitions(id)
    on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (company_id, graymills_category_id)
);

create index if not exists idx_company_graymills_classifications_company
on public.company_graymills_classifications (company_id);

create index if not exists idx_company_graymills_classifications_category
on public.company_graymills_classifications (graymills_category_id);

create index if not exists idx_company_graymills_classifications_industry
on public.company_graymills_classifications (industry_id);

create index if not exists idx_company_graymills_classifications_sub_industry
on public.company_graymills_classifications (sub_industry_id);

alter table public.graymills_category_definitions
enable row level security;

alter table public.company_graymills_classifications
enable row level security;

comment on table public.graymills_category_definitions is
  'Stable Graymills product-line categories used to scope Industry definitions and route category-specific sales intelligence.';

comment on column public.graymills_category_definitions.category_key is
  'Stable machine key intended for product-line routing such as category-specific AI research; do not use the display label as the routing key.';

comment on column public.company_industry_definitions.graymills_category_id is
  'Optional during migration. New managed Industry definitions should belong to a Graymills Category. Existing legacy definitions remain null until deliberately assigned.';

comment on table public.company_graymills_classifications is
  'One company classification per Graymills Category, allowing the same company to be relevant to Parts Washers, Pumps, Graphics, Job Shop Fab, or multiple categories.';

-- Verification output.
select
  id,
  category_key,
  category_name,
  sort_order,
  status
from public.graymills_category_definitions
order by sort_order, category_name;

select
  count(*) as unassigned_legacy_industry_definitions
from public.company_industry_definitions
where graymills_category_id is null;

select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'graymills_category_definitions',
    'company_graymills_classifications',
    'company_industry_definitions'
  )
  and column_name in (
    'category_key',
    'category_name',
    'graymills_category_id',
    'company_id',
    'industry_id',
    'sub_industry_id'
  )
order by table_name, ordinal_position;
