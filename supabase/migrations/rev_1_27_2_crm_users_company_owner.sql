-- Rev 1.27.2 — CRM Users / Owners Database

create table if not exists crm_users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null unique,
  role_name text,
  email text,
  phone text,
  notes text,
  sort_order integer not null default 100,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table companies
add column if not exists assigned_user_id uuid references crm_users(id) on delete set null;

create index if not exists idx_crm_users_status
on crm_users(status);

create index if not exists idx_crm_users_sort_order
on crm_users(sort_order);

create index if not exists idx_companies_assigned_user_id
on companies(assigned_user_id);

insert into crm_users (
  display_name,
  role_name,
  notes,
  sort_order,
  status
)
values
(
  'Unassigned',
  'Placeholder',
  'Default placeholder for records that do not yet have an assigned owner.',
  10,
  'active'
),
(
  'House Account',
  'Placeholder',
  'Placeholder for accounts managed generally rather than by an individual owner.',
  20,
  'active'
),
(
  'Sales',
  'Placeholder',
  'Placeholder for sales-owned records before a specific individual is assigned.',
  30,
  'active'
),
(
  'Marketing',
  'Placeholder',
  'Placeholder for marketing-owned research, campaign, or nurture records.',
  40,
  'active'
),
(
  'Distributor Follow-Up',
  'Placeholder',
  'Placeholder for records that should be routed through distributor or channel follow-up.',
  50,
  'active'
)
on conflict (display_name) do update
set
  role_name = excluded.role_name,
  notes = excluded.notes,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

select
  display_name,
  role_name,
  sort_order,
  status
from crm_users
order by sort_order, display_name;