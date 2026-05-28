-- Rev 1.29.3 — Opportunity Document Attachments

create table if not exists opportunity_documents (
  id uuid primary key default gen_random_uuid(),

  opportunity_id uuid not null references sales_opportunities(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,

  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  document_type text default 'attachment',
  description text,

  status text not null default 'active' check (status in ('active', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_opportunity_documents_opportunity_id
on opportunity_documents(opportunity_id);

create index if not exists idx_opportunity_documents_company_id
on opportunity_documents(company_id);

create index if not exists idx_opportunity_documents_status
on opportunity_documents(status);

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'opportunity-documents',
  'opportunity-documents',
  false
)
on conflict (id) do nothing;