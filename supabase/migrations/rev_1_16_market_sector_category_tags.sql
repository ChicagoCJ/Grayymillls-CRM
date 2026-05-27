-- Rev 1.16 — Market / Sector / Category Tables + Seed Defaults

create table if not exists crm_tags (
  id uuid primary key default gen_random_uuid(),
  tag_name text not null,
  tag_type text not null check (tag_type in ('market', 'sector', 'category')),
  description text,
  color text,
  sort_order integer not null default 100,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (tag_name, tag_type)
);

create table if not exists company_tags (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  tag_id uuid not null references crm_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (company_id, tag_id)
);

create table if not exists contact_tags (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  tag_id uuid not null references crm_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (contact_id, tag_id)
);

create index if not exists idx_crm_tags_tag_type
on crm_tags(tag_type);

create index if not exists idx_crm_tags_status
on crm_tags(status);

create index if not exists idx_company_tags_company_id
on company_tags(company_id);

create index if not exists idx_company_tags_tag_id
on company_tags(tag_id);

create index if not exists idx_contact_tags_contact_id
on contact_tags(contact_id);

create index if not exists idx_contact_tags_tag_id
on contact_tags(tag_id);

insert into crm_tags (
  tag_name,
  tag_type,
  description,
  color,
  sort_order,
  status
)
values
-- Markets
(
  'Parts Washing',
  'market',
  'Companies or contacts with potential relevance to Graymills parts washers, cleaning fluids, accessories, or cleaning applications.',
  'blue',
  10,
  'active'
),
(
  'Pumps / Fluid Handling',
  'market',
  'Companies or contacts with potential relevance to Graymills pumps, pump/tank systems, filtration, lubrication, coolant, or fluid-handling applications.',
  'green',
  20,
  'active'
),
(
  'Inking Systems',
  'market',
  'Companies or contacts with potential relevance to Graymills flexographic, gravure, printing, ink circulation, filtration, mixing, or pressroom productivity applications.',
  'purple',
  30,
  'active'
),
(
  'OEM / Custom',
  'market',
  'Companies or contacts with potential relevance to Graymills OEM, private-label, custom manufacturing, or engineered-system opportunities.',
  'slate',
  40,
  'active'
),
(
  'Cleaning Fluids',
  'market',
  'Companies or contacts with potential relevance to Graymills cleaning fluids, detergents, chemistries, or process cleaning support.',
  'cyan',
  50,
  'active'
),

-- Sectors
(
  'Aviation MRO',
  'sector',
  'Maintenance, repair, and overhaul operations serving aviation, aerospace, aircraft components, ground support, or related parts cleaning needs.',
  'blue',
  110,
  'active'
),
(
  'Automotive / Fleet',
  'sector',
  'Automotive, fleet maintenance, engine, transmission, service, repair, rebuild, and related parts cleaning or fluid-handling applications.',
  'blue',
  120,
  'active'
),
(
  'Printing / Converting',
  'sector',
  'Flexographic, gravure, digital, paper processing, packaging, label, corrugated, envelope, or converting operations.',
  'purple',
  130,
  'active'
),
(
  'Metalworking',
  'sector',
  'Machine shops, stamping, forming, machining, metal fabrication, coolant handling, lubrication, chip management, or metal-part cleaning applications.',
  'green',
  140,
  'active'
),
(
  'Lubricants / Petrochemical',
  'sector',
  'Lubricant manufacturers, petroleum, chemical blending, petrochemical service, oilfield, or related fluid-intensive operations.',
  'amber',
  150,
  'active'
),
(
  'Heavy Equipment',
  'sector',
  'Agriculture, construction, mining, industrial equipment, hydraulic components, diesel, repair, rebuild, and service operations.',
  'orange',
  160,
  'active'
),
(
  'Medical / Precision Cleaning',
  'sector',
  'Precision parts, medical device, laboratory, high-cleanliness, ultrasonic, or controlled cleaning applications.',
  'teal',
  170,
  'active'
),
(
  'General Industrial',
  'sector',
  'Broad industrial manufacturing, maintenance, repair, production, cleaning, fluid handling, or plant operations opportunities.',
  'slate',
  180,
  'active'
),
(
  'Distributor / Channel',
  'sector',
  'Industrial distributors, MRO suppliers, catalog houses, equipment dealers, representatives, or channel partners.',
  'gray',
  190,
  'active'
),

-- Categories
(
  'High Priority',
  'category',
  'Prospect or contact should receive prioritized follow-up based on fit, urgency, relationship, value, or strategic importance.',
  'red',
  210,
  'active'
),
(
  'Existing Customer',
  'category',
  'Known customer or account with prior Graymills relationship, purchase history, installed base, or active commercial connection.',
  'green',
  220,
  'active'
),
(
  'Distributor Prospect',
  'category',
  'Potential distributor, reseller, representative, catalog partner, or channel account.',
  'gray',
  230,
  'active'
),
(
  'OEM Prospect',
  'category',
  'Potential OEM, private-label, engineered-system, or custom manufacturing opportunity.',
  'slate',
  240,
  'active'
),
(
  'Needs Research',
  'category',
  'Record needs additional validation before outreach, scoring, assignment, or recommendation.',
  'yellow',
  250,
  'active'
),
(
  'OpenAI Analyzed',
  'category',
  'Record has had AI-assisted prospect analysis generated and saved.',
  'blue',
  260,
  'active'
),
(
  'Follow-Up This Week',
  'category',
  'Record needs near-term sales follow-up.',
  'orange',
  270,
  'active'
),
(
  'Trade Show Lead',
  'category',
  'Lead sourced from or related to a trade show, event, conference, or expo.',
  'purple',
  280,
  'active'
),
(
  'Do Not Contact',
  'category',
  'Record should not be contacted unless reviewed and cleared.',
  'red',
  290,
  'active'
),
(
  'Decision Maker',
  'category',
  'Contact appears to be a likely commercial, technical, operational, or procurement decision maker.',
  'green',
  300,
  'active'
),
(
  'Technical Influencer',
  'category',
  'Contact appears likely to influence technical requirements, specification, equipment fit, or application validation.',
  'blue',
  310,
  'active'
),
(
  'Maintenance Contact',
  'category',
  'Contact appears related to maintenance, repair, reliability, facilities, equipment, or plant service operations.',
  'orange',
  320,
  'active'
),
(
  'EHS Influencer',
  'category',
  'Contact may influence environmental, health, safety, compliance, solvent, fluid, or workplace safety decisions.',
  'teal',
  330,
  'active'
)
on conflict (tag_name, tag_type) do update
set
  description = excluded.description,
  color = excluded.color,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

select tag_type, count(*) as tag_count
from crm_tags
group by tag_type
order by tag_type;