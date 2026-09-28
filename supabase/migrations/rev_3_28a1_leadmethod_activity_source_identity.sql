-- Rev 3.28A1 — LeadMethod activity source identity foundation
-- Adds durable external-source identity fields to CRM activities so historical
-- imports can preserve source metadata and reject duplicate source records.

alter table public.activities
  add column if not exists source text,
  add column if not exists source_record_id text,
  add column if not exists source_metadata jsonb;

create unique index if not exists activities_source_record_unique_idx
  on public.activities (source, source_record_id)
  where source is not null and source_record_id is not null;

create index if not exists activities_source_idx
  on public.activities (source);

comment on column public.activities.source is
  'External source system for imported activity history, for example LeadMethod.';

comment on column public.activities.source_record_id is
  'Source-system record identifier used for durable duplicate protection.';

comment on column public.activities.source_metadata is
  'Additional source-system fields preserved as structured JSONB metadata.';
