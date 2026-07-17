-- Version 3.03A
-- Projects / Lists database foundation.
--
-- A project record can represent either:
--   1. A longer-running sales project, campaign, territory initiative, or workstream.
--   2. A flexible list used to group companies and contacts.
--
-- Company and contact assignment tables are many-to-many so one record can
-- belong to multiple projects or lists.

create table if not exists public.crm_projects (
  id uuid primary key default gen_random_uuid(),

  project_name text not null unique,

  project_kind text not null default 'project'
    check (project_kind in ('project', 'list')),

  description text,

  owner_user_id uuid
    references public.crm_users(id)
    on delete set null,

  sort_order integer not null default 100,

  status text not null default 'active'
    check (status in ('active', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.company_project_assignments (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.crm_projects(id)
    on delete cascade,

  company_id uuid not null
    references public.companies(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  unique (project_id, company_id)
);

create table if not exists public.contact_project_assignments (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.crm_projects(id)
    on delete cascade,

  contact_id uuid not null
    references public.contacts(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  unique (project_id, contact_id)
);

alter table public.crm_projects
enable row level security;

alter table public.company_project_assignments
enable row level security;

alter table public.contact_project_assignments
enable row level security;

create index if not exists idx_crm_projects_status
on public.crm_projects(status);

create index if not exists idx_crm_projects_kind
on public.crm_projects(project_kind);

create index if not exists idx_crm_projects_sort_order
on public.crm_projects(sort_order);

create index if not exists idx_crm_projects_owner_user_id
on public.crm_projects(owner_user_id);

create index if not exists idx_company_project_assignments_project_id
on public.company_project_assignments(project_id);

create index if not exists idx_company_project_assignments_company_id
on public.company_project_assignments(company_id);

create index if not exists idx_contact_project_assignments_project_id
on public.contact_project_assignments(project_id);

create index if not exists idx_contact_project_assignments_contact_id
on public.contact_project_assignments(contact_id);

comment on table public.crm_projects is
  'Admin-managed projects and flexible CRM lists used to group companies and contacts.';

comment on column public.crm_projects.project_kind is
  'Determines whether the record is presented as a project or a list.';

comment on column public.crm_projects.owner_user_id is
  'Optional CRM User responsible for the project or list.';

comment on table public.company_project_assignments is
  'Many-to-many membership connecting companies to CRM projects and lists.';

comment on table public.contact_project_assignments is
  'Optional many-to-many membership connecting individual contacts to CRM projects and lists.';

select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'crm_projects',
    'company_project_assignments',
    'contact_project_assignments'
  )
order by table_name;

select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'crm_projects',
    'company_project_assignments',
    'contact_project_assignments'
  )
order by table_name, ordinal_position;
