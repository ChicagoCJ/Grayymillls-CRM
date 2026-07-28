-- Rev 3.22.1c
-- Add Job Shop Fab as the fourth stable Graymills Category.
-- This migration is required for databases where the original category
-- hierarchy migration was already applied before Job Shop Fab was added.

insert into public.graymills_category_definitions (
  category_key,
  category_name,
  sort_order,
  status
)
values (
  'job_shop_fab',
  'Job Shop Fab',
  40,
  'active'
)
on conflict (category_key)
do update set
  category_name = excluded.category_name,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

select
  id,
  category_key,
  category_name,
  sort_order,
  status
from public.graymills_category_definitions
where category_key = 'job_shop_fab';
