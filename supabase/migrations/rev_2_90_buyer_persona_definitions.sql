-- Rev 2.90 â€” Buyer Persona Definition Foundation

create table if not exists buyer_persona_definitions (
  id uuid primary key default gen_random_uuid(),

  persona_name text not null unique,
  description text,
  sort_order integer not null default 100,

  status text not null default 'active'
    check (status in ('active', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table buyer_persona_definitions enable row level security;

create index if not exists idx_buyer_persona_definitions_status
on buyer_persona_definitions(status);

create index if not exists idx_buyer_persona_definitions_sort_order
on buyer_persona_definitions(sort_order);

insert into buyer_persona_definitions (
  persona_name,
  description,
  sort_order,
  status
)
values
(
  'Operations',
  'Operations leaders focused on throughput, workflow, labor, uptime, consistency, and operating performance.',
  10,
  'active'
),
(
  'Maintenance',
  'Maintenance and reliability stakeholders focused on equipment uptime, serviceability, repair, and preventive maintenance.',
  20,
  'active'
),
(
  'Purchasing',
  'Procurement stakeholders focused on pricing, commercial terms, supplier reliability, lead time, and total cost.',
  30,
  'active'
),
(
  'Quality / Process',
  'Quality, manufacturing, and process engineering stakeholders focused on specifications, repeatability, validation, and process control.',
  40,
  'active'
),
(
  'EHS / Safety',
  'Environmental, health, and safety stakeholders focused on worker safety, chemistry, handling, emissions, and compliance risk.',
  50,
  'active'
),
(
  'Principal / Owner',
  'Business owners and channel principals focused on growth, profitability, strategic fit, investment risk, and return.',
  60,
  'active'
),
(
  'Outside Sales',
  'Field sales stakeholders focused on customer opportunity, territory fit, differentiation, and closing support.',
  70,
  'active'
),
(
  'Product Specialist',
  'Technical product and application specialists focused on solution fit, specifications, training, and application support.',
  80,
  'active'
),
(
  'Inside Sales',
  'Inside sales stakeholders focused on lead response, quoting, coordination, follow-up, and transactional efficiency.',
  90,
  'active'
),
(
  'Discovery Needed',
  'Fallback definition used when the likely buyer stakeholders have not yet been confirmed.',
  100,
  'active'
)
on conflict (persona_name) do update
set
  description = excluded.description,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

select
  persona_name,
  description,
  sort_order,
  status
from buyer_persona_definitions
order by sort_order, persona_name;