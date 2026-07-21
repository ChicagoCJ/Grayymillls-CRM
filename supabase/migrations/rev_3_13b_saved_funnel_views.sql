-- Version 3.13B — Saved Funnel Views Foundation

create table if not exists saved_funnel_views (
  id uuid primary key default gen_random_uuid(),

  crm_user_id uuid not null
    references crm_users(id)
    on delete cascade,

  view_name text not null,

  is_default boolean not null default false,

  view_mode text not null default 'board'
    check (view_mode in ('board', 'list')),

  card_density text not null default 'comfortable'
    check (card_density in ('comfortable', 'compact')),

  status_filter text not null default 'open',
  stage_filter text not null default 'All',
  type_filter text not null default 'All',
  search_term text not null default '',

  sort_order integer not null default 100,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saved_funnel_views_crm_user_id
on saved_funnel_views(crm_user_id);

create index if not exists idx_saved_funnel_views_user_sort
on saved_funnel_views(crm_user_id, sort_order, view_name);

create unique index if not exists uq_saved_funnel_views_user_name
on saved_funnel_views(crm_user_id, lower(view_name));

create unique index if not exists uq_saved_funnel_views_one_default_per_user
on saved_funnel_views(crm_user_id)
where is_default = true;

alter table saved_funnel_views enable row level security;

comment on table saved_funnel_views is
  'User-specific saved Funnel filter and display configurations managed through verified server APIs.';

comment on column saved_funnel_views.stage_filter is
  'Stores All or a sales_funnel_stages UUID as text so archived or removed stages can be handled safely by the UI.';

comment on column saved_funnel_views.type_filter is
  'Stores All or the selected opportunity type.';

select
  c.relname as table_name,
  c.relrowsecurity as row_security
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'saved_funnel_views'
  and c.relkind = 'r';

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'saved_funnel_views'
order by indexname;
