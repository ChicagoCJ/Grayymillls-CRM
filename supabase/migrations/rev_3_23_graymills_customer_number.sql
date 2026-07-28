-- Version 3.23
-- Graymills Customer Number
--
-- Purpose:
-- 1. Store the Graymills ERP customer number directly on the CRM company.
-- 2. Preserve leading zeros by using text rather than a numeric type.
-- 3. Keep the field optional for prospects and unmatched companies.
-- 4. Prevent one customer number from being assigned to multiple companies.
-- 5. Provide the strongest identity signal for later human-approved ERP matching.

alter table public.companies
add column if not exists graymills_customer_number text;

update public.companies
set graymills_customer_number = null
where graymills_customer_number is not null
  and nullif(btrim(graymills_customer_number), '') is null;

create unique index if not exists uq_companies_graymills_customer_number_ci
on public.companies (
  lower(btrim(graymills_customer_number))
)
where nullif(btrim(graymills_customer_number), '') is not null;

comment on column public.companies.graymills_customer_number is
  'Optional Graymills ERP customer number. Stored as text to preserve leading zeros and used as the strongest identity signal for later human-approved ERP reconciliation.';

select
  id,
  company_name,
  graymills_customer_number
from public.companies
where graymills_customer_number is not null
order by company_name;
