-- Version 3.23.24
-- Non-destructive audit fields for external company and facility research.

alter table public.prospect_intelligence
add column if not exists research_status text;

alter table public.prospect_intelligence
add column if not exists research_performed_at timestamptz;

alter table public.prospect_intelligence
add column if not exists web_search_used boolean not null default false;

alter table public.prospect_intelligence
add column if not exists research_model text;

alter table public.prospect_intelligence
add column if not exists research_response_id text;

alter table public.prospect_intelligence
add column if not exists research_summary text;

alter table public.prospect_intelligence
add column if not exists research_facility_profile text;

alter table public.prospect_intelligence
add column if not exists research_likely_processes jsonb;

alter table public.prospect_intelligence
add column if not exists research_evidence jsonb;

alter table public.prospect_intelligence
add column if not exists research_sources jsonb;

alter table public.prospect_intelligence
add column if not exists analysis_methodology_version text;

alter table public.prospect_intelligence
add column if not exists analysis_graymills_category_key text;

alter table public.prospect_intelligence
add column if not exists analysis_graymills_category_name text;

alter table public.prospect_intelligence
add column if not exists analysis_industry_name text;

alter table public.prospect_intelligence
add column if not exists analysis_sub_industry_name text;

comment on column public.prospect_intelligence.research_status is
  'Status of external company and facility research for this analysis.';

comment on column public.prospect_intelligence.research_performed_at is
  'Timestamp when external company and facility research was attempted.';

comment on column public.prospect_intelligence.web_search_used is
  'True when the OpenAI web search tool was used for this analysis.';

comment on column public.prospect_intelligence.research_model is
  'OpenAI model used for the external research pass.';

comment on column public.prospect_intelligence.research_response_id is
  'OpenAI Responses API identifier for the external research pass.';

comment on column public.prospect_intelligence.research_summary is
  'Research-only summary of the company and supported findings.';

comment on column public.prospect_intelligence.research_facility_profile is
  'Research findings associated with the relevant facility or location.';

comment on column public.prospect_intelligence.research_likely_processes is
  'Structured verified or inferred company-process findings.';

comment on column public.prospect_intelligence.research_evidence is
  'Structured research evidence, unknowns, triggers, and failure details.';

comment on column public.prospect_intelligence.research_sources is
  'Web source titles, URLs, source types, and retrieval timestamps.';

comment on column public.prospect_intelligence.analysis_methodology_version is
  'Graymills prospect-analysis methodology version used for this analysis.';

comment on column public.prospect_intelligence.analysis_graymills_category_key is
  'Authoritative Graymills Category key used to route this analysis.';

comment on column public.prospect_intelligence.analysis_graymills_category_name is
  'Authoritative Graymills Category display name used for this analysis.';

comment on column public.prospect_intelligence.analysis_industry_name is
  'Company Industry classification present when this analysis was generated.';

comment on column public.prospect_intelligence.analysis_sub_industry_name is
  'Company Sub-Industry present when this analysis was generated.';