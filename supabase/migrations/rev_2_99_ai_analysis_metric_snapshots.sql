-- Rev 2.99
-- Preserve prospect scores and product-path fields as they existed for each AI analysis.

alter table public.prospect_intelligence
add column if not exists analysis_priority_score integer;

alter table public.prospect_intelligence
add column if not exists analysis_priority_tier text;

alter table public.prospect_intelligence
add column if not exists analysis_fit_rating text;

alter table public.prospect_intelligence
add column if not exists analysis_confidence text;

alter table public.prospect_intelligence
add column if not exists analysis_product_line text;

alter table public.prospect_intelligence
add column if not exists analysis_likely_product_path text;

alter table public.prospect_intelligence
add column if not exists analysis_primary_use_case text;

alter table public.prospect_intelligence
add column if not exists analysis_likely_soils text;

alter table public.prospect_intelligence
add column if not exists analysis_likely_cleaning_action text;

alter table public.prospect_intelligence
add column if not exists analysis_next_best_action text;

comment on column public.prospect_intelligence.analysis_priority_score is
  'Priority score generated for this specific AI analysis run.';

comment on column public.prospect_intelligence.analysis_priority_tier is
  'Priority tier generated for this specific AI analysis run.';

comment on column public.prospect_intelligence.analysis_fit_rating is
  'Fit rating generated for this specific AI analysis run.';

comment on column public.prospect_intelligence.analysis_confidence is
  'Confidence rating generated for this specific AI analysis run.';

comment on column public.prospect_intelligence.analysis_product_line is
  'Product line generated for this specific AI analysis run.';

comment on column public.prospect_intelligence.analysis_likely_product_path is
  'Likely product path generated for this specific AI analysis run.';

comment on column public.prospect_intelligence.analysis_primary_use_case is
  'Primary use case generated for this specific AI analysis run.';

comment on column public.prospect_intelligence.analysis_likely_soils is
  'Likely soils generated for this specific AI analysis run.';

comment on column public.prospect_intelligence.analysis_likely_cleaning_action is
  'Likely cleaning action generated for this specific AI analysis run.';

comment on column public.prospect_intelligence.analysis_next_best_action is
  'Next-best action generated for this specific AI analysis run.';