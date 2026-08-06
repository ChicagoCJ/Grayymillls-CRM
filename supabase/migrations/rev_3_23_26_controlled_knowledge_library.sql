-- Version 3.23.26
-- Controlled Graymills Knowledge Library
--
-- Non-destructive migration:
-- - preserves all existing knowledge documents
-- - preserves the legacy product_area routing used by Analyze Prospect
-- - creates a private Supabase Storage bucket
-- - adds controlled upload, approval, archive, restore, and extraction metadata
-- - adds a permanent lifecycle event table
--
-- This migration does not delete knowledge documents or storage objects.

begin;

-- ---------------------------------------------------------------------------
-- 1. Extend the existing knowledge document table.
-- ---------------------------------------------------------------------------

alter table public.graymills_knowledge_documents
  add column if not exists graymills_category_id uuid,
  add column if not exists scope_type text not null default 'category',
  add column if not exists category_key_snapshot text,
  add column if not exists category_name_snapshot text,
  add column if not exists source_kind text not null default 'legacy',
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists file_mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists file_sha256 text,
  add column if not exists extraction_status text not null default 'not_required',
  add column if not exists extraction_error text,
  add column if not exists uploaded_by_user_id text,
  add column if not exists uploaded_by_name text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_user_id text,
  add column if not exists approved_by_name text,
  add column if not exists archived_by_user_id text,
  add column if not exists archived_by_name text,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by_user_id text,
  add column if not exists restored_by_name text;

-- ---------------------------------------------------------------------------
-- 2. Add the Graymills Category foreign key without replacing legacy routing.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'graymills_knowledge_documents_category_fk'
  ) then
    alter table public.graymills_knowledge_documents
      add constraint graymills_knowledge_documents_category_fk
      foreign key (graymills_category_id)
      references public.graymills_category_definitions(id)
      on update cascade
      on delete restrict;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Add controlled-value checks for new and changed rows.
--
-- NOT VALID means existing historical rows are preserved even if an older
-- value falls outside the new controlled list. New writes are still checked.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'graymills_knowledge_documents_status_check'
  ) then
    alter table public.graymills_knowledge_documents
      add constraint graymills_knowledge_documents_status_check
      check (status in ('draft', 'active', 'archived'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'graymills_knowledge_documents_scope_check'
  ) then
    alter table public.graymills_knowledge_documents
      add constraint graymills_knowledge_documents_scope_check
      check (scope_type in ('all', 'category'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'graymills_knowledge_documents_source_kind_check'
  ) then
    alter table public.graymills_knowledge_documents
      add constraint graymills_knowledge_documents_source_kind_check
      check (source_kind in ('legacy', 'seed', 'upload', 'manual'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'graymills_knowledge_documents_extraction_status_check'
  ) then
    alter table public.graymills_knowledge_documents
      add constraint graymills_knowledge_documents_extraction_status_check
      check (
        extraction_status in (
          'not_required',
          'pending',
          'completed',
          'manual',
          'failed'
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'graymills_knowledge_documents_file_size_check'
  ) then
    alter table public.graymills_knowledge_documents
      add constraint graymills_knowledge_documents_file_size_check
      check (
        file_size_bytes is null or
        file_size_bytes >= 0
      )
      not valid;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Backfill controlled scope and Category IDs from the existing product_area.
--
-- These mappings exactly preserve the routing currently used by
-- src/app/api/analyze-prospect/route.ts.
-- ---------------------------------------------------------------------------

update public.graymills_knowledge_documents
set scope_type = 'all'
where lower(trim(coalesce(product_area, ''))) = 'all'
  and scope_type is distinct from 'all';

with category_product_area_map (
  category_key,
  product_area
) as (
  values
    ('parts_washers', 'Parts Washers'),
    ('pumps', 'Pumps and Metalworking Fluid Systems'),
    ('graphics', 'Inking Systems'),
    ('job_shop_fab', 'Job Shop / Contract Manufacturing')
)
update public.graymills_knowledge_documents as document
set
  graymills_category_id = category.id,
  scope_type = 'category',
  category_key_snapshot = category.category_key,
  category_name_snapshot = category.category_name
from category_product_area_map as mapping
join public.graymills_category_definitions as category
  on category.category_key = mapping.category_key
where document.product_area = mapping.product_area
  and document.graymills_category_id is null;

update public.graymills_knowledge_documents as document
set
  category_key_snapshot = category.category_key,
  category_name_snapshot = category.category_name
from public.graymills_category_definitions as category
where document.graymills_category_id = category.id
  and (
    document.category_key_snapshot is distinct from category.category_key or
    document.category_name_snapshot is distinct from category.category_name
  );

-- Existing active, approved records predate approval audit fields.
-- Their prior updated/created time is used as the best available approval time.

update public.graymills_knowledge_documents
set approved_at = coalesce(updated_at, created_at, now())
where approved_for_ai = true
  and status = 'active'
  and approved_at is null;

-- ---------------------------------------------------------------------------
-- 5. Permanent document lifecycle event history.
-- ---------------------------------------------------------------------------

create table if not exists public.graymills_knowledge_document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null
    references public.graymills_knowledge_documents(id)
    on update cascade
    on delete restrict,
  event_type text not null,
  actor_user_id text,
  actor_name text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'graymills_knowledge_document_events_type_check'
  ) then
    alter table public.graymills_knowledge_document_events
      add constraint graymills_knowledge_document_events_type_check
      check (
        event_type in (
          'created',
          'file_uploaded',
          'metadata_updated',
          'content_updated',
          'approved',
          'approval_revoked',
          'archived',
          'restored',
          'downloaded',
          'extraction_completed',
          'extraction_failed'
        )
      )
      not valid;
  end if;
end
$$;

-- This table is server-managed through the service-role API.
-- No browser/client policies are created.

alter table public.graymills_knowledge_document_events
  enable row level security;

-- ---------------------------------------------------------------------------
-- 6. Indexes for management screens, audit history, and AI retrieval.
-- ---------------------------------------------------------------------------

create index if not exists
  idx_graymills_knowledge_documents_category_id
on public.graymills_knowledge_documents (
  graymills_category_id
);

create index if not exists
  idx_graymills_knowledge_documents_scope_type
on public.graymills_knowledge_documents (
  scope_type
);

create index if not exists
  idx_graymills_knowledge_documents_updated_at
on public.graymills_knowledge_documents (
  updated_at desc
);

create index if not exists
  idx_graymills_knowledge_documents_ai_active_scope
on public.graymills_knowledge_documents (
  approved_for_ai,
  status,
  scope_type,
  graymills_category_id,
  product_area
)
where approved_for_ai = true
  and status = 'active'
  and archived_at is null;

create unique index if not exists
  idx_graymills_knowledge_documents_storage_object
on public.graymills_knowledge_documents (
  storage_bucket,
  storage_path
)
where storage_bucket is not null
  and storage_path is not null;

create index if not exists
  idx_graymills_knowledge_document_events_document_created
on public.graymills_knowledge_document_events (
  document_id,
  created_at desc
);

-- ---------------------------------------------------------------------------
-- 7. Private Supabase Storage bucket.
--
-- Files are accessed only through server-generated signed URLs.
-- Maximum file size: 25 MB.
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'graymills-knowledge',
  'graymills-knowledge',
  false,
  26214400,
  array[
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;

-- ---------------------------------------------------------------------------
-- Verification results
-- ---------------------------------------------------------------------------

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'graymills_knowledge_documents'
  and column_name in (
    'graymills_category_id',
    'scope_type',
    'source_kind',
    'storage_bucket',
    'storage_path',
    'file_mime_type',
    'file_size_bytes',
    'extraction_status',
    'approved_at',
    'archived_by_name',
    'restored_at'
  )
order by ordinal_position;

select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'graymills-knowledge';

select
  status,
  approved_for_ai,
  scope_type,
  count(*) as document_count
from public.graymills_knowledge_documents
group by
  status,
  approved_for_ai,
  scope_type
order by
  status,
  approved_for_ai desc,
  scope_type;

select
  document.product_area,
  document.scope_type,
  document.category_key_snapshot,
  document.category_name_snapshot,
  count(*) as document_count
from public.graymills_knowledge_documents as document
group by
  document.product_area,
  document.scope_type,
  document.category_key_snapshot,
  document.category_name_snapshot
order by
  document.product_area nulls last;