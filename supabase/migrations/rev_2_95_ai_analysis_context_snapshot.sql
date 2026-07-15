-- Rev 2.95
-- Preserve the company sales context used by each AI prospect analysis.

alter table public.prospect_intelligence
add column if not exists analysis_account_type text;

alter table public.prospect_intelligence
add column if not exists analysis_buyer_personas jsonb;

comment on column public.prospect_intelligence.analysis_account_type is
  'Saved company Account Type used when this AI analysis was generated.';

comment on column public.prospect_intelligence.analysis_buyer_personas is
  'Saved company Buyer Persona names used when this AI analysis was generated.';