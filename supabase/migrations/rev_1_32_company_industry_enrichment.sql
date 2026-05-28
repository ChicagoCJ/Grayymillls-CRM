-- Rev 1.32 — Import NAICS / SIC Detail Fields from ZoomInfo CSV

alter table companies
add column if not exists naics_codes text,
add column if not exists naics_descriptions text,
add column if not exists sic_codes text,
add column if not exists sic_descriptions text,
add column if not exists primary_industry text,
add column if not exists primary_sub_industry text;

create index if not exists idx_companies_primary_industry
on companies(primary_industry);

create index if not exists idx_companies_primary_sub_industry
on companies(primary_sub_industry);

select
  column_name,
  data_type
from information_schema.columns
where table_name = 'companies'
  and column_name in (
    'naics_codes',
    'naics_descriptions',
    'sic_codes',
    'sic_descriptions',
    'primary_industry',
    'primary_sub_industry'
  )
order by column_name;