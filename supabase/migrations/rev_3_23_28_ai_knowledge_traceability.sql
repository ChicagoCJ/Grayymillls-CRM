-- Graymills CRM Version 3.23.28
-- AI Knowledge Traceability
--
-- Purpose:
-- Preserve an auditable snapshot of the approved Graymills knowledge
-- documents and category routing used for each prospect analysis.
--
-- Safety:
-- - does not delete or replace existing intelligence records
-- - does not modify existing analysis content
-- - existing rows receive empty/default traceability values
-- - legacy rows remain distinguishable because captured_at stays null

begin;

alter table public.prospect_intelligence
  add column if not exists analysis_knowledge_documents jsonb
    not null
    default '[]'::jsonb;

alter table public.prospect_intelligence
  add column if not exists analysis_knowledge_routing jsonb
    not null
    default '{}'::jsonb;

alter table public.prospect_intelligence
  add column if not exists analysis_knowledge_document_count integer
    not null
    default 0;

alter table public.prospect_intelligence
  add column if not exists analysis_knowledge_captured_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'prospect_intelligence_knowledge_documents_array_check'
  ) then
    alter table public.prospect_intelligence
      add constraint
        prospect_intelligence_knowledge_documents_array_check
      check (
        jsonb_typeof(analysis_knowledge_documents) = 'array'
      )
      not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'prospect_intelligence_knowledge_routing_object_check'
  ) then
    alter table public.prospect_intelligence
      add constraint
        prospect_intelligence_knowledge_routing_object_check
      check (
        jsonb_typeof(analysis_knowledge_routing) = 'object'
      )
      not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'prospect_intelligence_knowledge_count_check'
  ) then
    alter table public.prospect_intelligence
      add constraint
        prospect_intelligence_knowledge_count_check
      check (
        analysis_knowledge_document_count >= 0
      )
      not valid;
  end if;
end
$$;

comment on column
  public.prospect_intelligence.analysis_knowledge_documents
is
  'Immutable JSON snapshot of the approved active Graymills knowledge documents supplied to this analysis, including identifiers, titles, routing, version, approval, file, and content-integrity metadata.';

comment on column
  public.prospect_intelligence.analysis_knowledge_routing
is
  'Snapshot of the authoritative Graymills Category and product-area routing used to select approved knowledge for this analysis.';

comment on column
  public.prospect_intelligence.analysis_knowledge_document_count
is
  'Number of approved active Graymills knowledge documents supplied to this analysis.';

comment on column
  public.prospect_intelligence.analysis_knowledge_captured_at
is
  'Timestamp when the knowledge-document and category-routing snapshots were captured for this analysis. Null identifies legacy analyses created before Version 3.23.28.';

commit;

-- Verification: expected four rows.
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'prospect_intelligence'
  and column_name in (
    'analysis_knowledge_documents',
    'analysis_knowledge_routing',
    'analysis_knowledge_document_count',
    'analysis_knowledge_captured_at'
  )
order by column_name;

-- Verification: existing records remain present and are identified as legacy.
select
  count(*) as total_intelligence_rows,
  count(*) filter (
    where analysis_knowledge_captured_at is null
  ) as legacy_rows_without_knowledge_snapshot,
  count(*) filter (
    where analysis_knowledge_captured_at is not null
  ) as rows_with_knowledge_snapshot
from public.prospect_intelligence;