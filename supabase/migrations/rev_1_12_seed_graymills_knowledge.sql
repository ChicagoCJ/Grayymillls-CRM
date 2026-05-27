-- Rev 1.12 — Seed Graymills Knowledge into Supabase
-- Full replacement script.
-- Safe to rerun. It creates the tables if needed, clears prior Rev 1.12 seed data,
-- and reloads the Graymills knowledge layer.

create table if not exists graymills_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  document_type text not null,
  product_area text,
  source_file_name text,
  source_url text,
  summary text,
  approved_for_ai boolean not null default true,
  version_label text,
  status text not null default 'active',
  raw_text text,
  structured_data jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists graymills_product_families (
  id uuid primary key default gen_random_uuid(),
  product_family text not null,
  product_area text not null,
  short_description text,
  best_fit_applications text,
  cleaning_action text,
  common_soils text,
  buyer_value_drivers text,
  discovery_questions jsonb,
  proof_points jsonb,
  caution_language jsonb,
  source_document_id uuid references graymills_knowledge_documents(id),
  approved_for_ai boolean not null default true,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists graymills_application_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  product_area text not null,
  product_family text,
  when_to_recommend text,
  when_not_to_recommend text,
  required_discovery text,
  risk_or_caution text,
  sales_language text,
  source_document_id uuid references graymills_knowledge_documents(id),
  approved_for_ai boolean not null default true,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists graymills_prompt_context (
  id uuid primary key default gen_random_uuid(),
  context_name text not null,
  context_type text not null,
  product_area text,
  prompt_text text not null,
  usage_notes text,
  approved_for_ai boolean not null default true,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_graymills_knowledge_documents_product_area
on graymills_knowledge_documents(product_area);

create index if not exists idx_graymills_knowledge_documents_status
on graymills_knowledge_documents(status);

create index if not exists idx_graymills_product_families_product_area
on graymills_product_families(product_area);

create index if not exists idx_graymills_application_rules_product_area
on graymills_application_rules(product_area);

create index if not exists idx_graymills_prompt_context_product_area
on graymills_prompt_context(product_area);

delete from graymills_prompt_context;
delete from graymills_application_rules;
delete from graymills_product_families;
delete from graymills_knowledge_documents;

insert into graymills_knowledge_documents (
  title,
  document_type,
  product_area,
  source_file_name,
  source_url,
  summary,
  approved_for_ai,
  version_label,
  status,
  raw_text,
  structured_data,
  notes
)
values
(
  'Graymills Parts Washer Catalog',
  'catalog',
  'Parts Washers',
  'Graymills Parts Washer Catalog gm-200.pdf',
  null,
  'Primary source for Graymills parts washer product families, cleaning actions, selection criteria, applications, accessories, and fluids.',
  true,
  'Rev 1.12 seed',
  'active',
  'Graymills parts washer materials describe selection criteria including soils to be removed, current cleaning method, part material, part size, part weight, part configuration, quantity per day, upstream and downstream process steps, handling preference, single-step or multi-step cleaning, and solvent or water-based fluid requirements. The materials describe cleaning actions including soak, brush, directed stream, high-pressure spray, fluid agitation, lift-platform agitation, heated aqueous cleaning, and ultrasonics.',
  jsonb_build_object(
    'key_themes', jsonb_build_array(
      'Application-driven equipment selection',
      'Cleaning action matched to soils, parts, fluid, throughput, and workflow',
      'Manual, immersion, ultrasonic, and spray cleaning',
      'Complimentary cleaning tests reduce buyer risk',
      'Use discovery before model recommendation'
    ),
    'source_use', 'Use for parts washer selection logic, cleaning-action definitions, and sales-discovery guardrails.'
  ),
  'Initial curated AI context. Do not use this seed as a substitute for model-specific specification lookup.'
),
(
  'Graymills Parts Washer Brochure',
  'brochure',
  'Parts Washers',
  'GM_Brochure_PARTSWASHERS_r6.pdf',
  null,
  'Marketing overview for Graymills manual, spray, ultrasonic, and immersion parts washers, including customer-facing explanation of cleaning actions.',
  true,
  'Rev 1.12 seed',
  'active',
  'The parts washer brochure explains cleaning actions: soak is the simplest and least aggressive; brush supplements other methods for stubborn soils; directed stream flushes parts through a hose; high-pressure spray uses water-based solution; fluid agitation moves solution through and around parts; lift-platform agitation moves parts vertically through fluid; heat improves water-based cleaning; ultrasonics use cavitation to scrub immersed parts.',
  jsonb_build_object(
    'key_themes', jsonb_build_array(
      'Plain-language cleaning-action explanations',
      'Manual, spray, ultrasonic, and immersion cleaning',
      'Application fit depends on parts, soils, chemistry, and workflow'
    ),
    'source_use', 'Use for accessible customer-facing phrasing and discovery-question generation.'
  ),
  'Good source for customer-facing explanations.'
),
(
  'Graymills PrintClean Documentation',
  'sell sheet and manual',
  'Parts Washers',
  'PrintClean 550 Sell Sheet.pdf; 795-94048 PCL (UL1204).pdf',
  null,
  'Source for PrintClean solvent parts washer positioning for production, maintenance, and graphic printing service.',
  true,
  'Rev 1.12 seed',
  'active',
  'PrintClean is described as a heavy-duty, multi-functional solvent parts washer for production, maintenance, and graphic printing service. The pumping system circulates solvent to hoses for manual cleaning and to a hydro-jet manifold for in-tank agitation. Cleaning fluid circulates through a filter with mesh screen. Standard features include flexible metal flush hose, pistol-grip spray nozzle, adjustable work shelves, safety lid, hydro-jet manifold, cleaning action selector valve on applicable models, washable screen filter, drain plug, optional soak or sludge trays, welded steel tank, and abrasive-resistant pump.',
  jsonb_build_object(
    'key_themes', jsonb_build_array(
      'Graphic printing maintenance cleaning',
      'Solvent cleaning',
      'Manual directed cleaning plus soak and agitation',
      'Filtration and sludge management',
      'HP Indigo-related PrintClean use cases'
    ),
    'source_use', 'Use for printing-maintenance and HP Indigo-related prospect hypotheses.'
  ),
  'Avoid overclaiming compatibility; validate cleaning fluid, part type, and workflow.'
),
(
  'Graymills Pump Catalog',
  'catalog',
  'Pumps and Metalworking Fluid Systems',
  'Graymills Pump Catalog gm-100.pdf',
  null,
  'Primary source for Graymills pump families, pump/tank systems, Stocklube systems, and pump selection considerations.',
  true,
  'Rev 1.12 seed',
  'active',
  'Graymills pump materials describe centrifugal, diaphragm, gear, and pump/tank systems used for fluid movement, coolant or lubricant handling, recirculation, transfer, and industrial applications. Pump selection should consider flow, head, viscosity, fluid, temperature, duty cycle, materials compatibility, solids or abrasives, and system integration. Stocklube systems provide controlled lubrication of coil or strip stock, reducing hand brushing, recirculating lubricant, and supporting production applications.',
  jsonb_build_object(
    'key_themes', jsonb_build_array(
      'Flow, head, viscosity, and duty requirements matter',
      'Pump/tank systems for machine and fluid management',
      'Stocklube systems for controlled coil or strip lubrication',
      'Serviceability and reliability as buyer value drivers'
    ),
    'source_use', 'Use for pump and metalworking-fluid prospect hypotheses, not final pump sizing.'
  ),
  'Do not generate final pump recommendations without flow, head, viscosity, fluid, temperature, duty cycle, and materials compatibility.'
),
(
  'Graymills Inking Systems Catalog',
  'catalog',
  'Inking Systems',
  'GRAYMILLS INKING SYSTEMS GM300-0418.pdf',
  null,
  'Primary source for Graymills flexographic and gravure inking systems, pumps, filters, mixers, and pressroom productivity context.',
  true,
  'Rev 1.12 seed',
  'active',
  'Graymills inking materials describe pump and motor selection for press, plumbing, and operating demands. Ink filters are positioned as important for print quality and equipment protection by removing contaminants such as dust, fiber, metallic particles, dried ink, and pigments. Graymills offers ink mixers, replenishment systems, centrifugal pumps, peristaltic pumps, diaphragm pumps, filters, and surge suppressors for flexographic and gravure applications.',
  jsonb_build_object(
    'key_themes', jsonb_build_array(
      'Press uptime and changeover productivity',
      'Ink circulation, filtration, mixing, and replenishment',
      'Print quality and contamination control',
      'Anilox roll and gravure cylinder protection',
      'Pump choice depends on press, plumbing, fluid, flow, deck height, and operating demand'
    ),
    'source_use', 'Use for flexographic, gravure, converting, and pressroom prospect analysis.'
  ),
  'Do not assume final pump or filter selection without press configuration and ink details.'
);

insert into graymills_product_families (
  product_family,
  product_area,
  short_description,
  best_fit_applications,
  cleaning_action,
  common_soils,
  buyer_value_drivers,
  discovery_questions,
  proof_points,
  caution_language,
  source_document_id,
  approved_for_ai,
  status
)
values
(
  'Manual Parts Washers',
  'Parts Washers',
  'Manual solvent or aqueous cleaning stations for maintenance, repair, rebuild, and flexible lower-volume cleaning tasks.',
  'Good fit when operators need direct control, brushing, flushing, soaking, spot cleaning, maintenance cleaning, or lower-volume cleaning where flexibility matters more than automation.',
  'Soak, brush, and directed stream; some models add agitation or spray features depending on configuration.',
  'Grease, oil, shop soils, cutting oils, residues, grime, and maintenance-related contaminants; validate against part material and cleaning chemistry.',
  'Low equipment complexity, flexible cleaning, operator control, useful for maintenance and repair workflows, ability to flush and brush stubborn soils.',
  jsonb_build_array(
    'What parts are cleaned most often, and how large or heavy are they?',
    'Are operators brushing, flushing, soaking, or doing all three today?',
    'What soils are hardest to remove?',
    'Is the current process limited by labor time, inconsistent results, fluid maintenance, or safety concerns?',
    'Do parts go to painting, plating, assembly, inspection, or service after cleaning?'
  ),
  jsonb_build_array(
    'Graymills materials define soak, brush, and directed-stream cleaning as core manual cleaning actions.',
    'Manual washers are relevant where flexible operator-controlled cleaning is valuable.'
  ),
  jsonb_build_array(
    'Do not claim a specific model is correct until part size, fluid, soil, volume, and workflow are validated.',
    'Do not assume solvent or aqueous chemistry compatibility without verification.',
    'Use likely-fit language.'
  ),
  (select id from graymills_knowledge_documents where title = 'Graymills Parts Washer Catalog' limit 1),
  true,
  'active'
),
(
  'Turbo-Action Immersion Parts Washers',
  'Parts Washers',
  'Hands-off total immersion cleaning using Graymills pump-driven fluid action to move cleaning fluid through and around parts.',
  'Good fit for larger or more complex parts that benefit from all-surface immersion exposure, including internal surfaces, blind holes, housings, castings, and nested geometries.',
  'Total immersion plus pump-driven fluid agitation; solvent or heated aqueous versions depending on model and application.',
  'Oils, chips, grime, manufacturing residues, rebuild soils, and contaminants that benefit from immersion and flushing action; validate chemistry and part compatibility.',
  'Hands-off cleaning, improved exposure to complex surfaces, reduced manual handling, larger tank options, filtration and basket options.',
  jsonb_build_array(
    'Are blind holes, internal passages, or complex geometries difficult to clean with spray or manual methods?',
    'Are parts being manually handled or scrubbed more than desired?',
    'What is the largest part size and weight?',
    'Is solvent or heated aqueous cleaning preferred?',
    'Would baskets, filtration, stainless wetted construction, or heat be required?'
  ),
  jsonb_build_array(
    'Immersion cleaning is relevant when cleaning solution must reach external and internal surfaces.',
    'Graymills immersion systems are positioned for hands-off cleaning action.'
  ),
  jsonb_build_array(
    'Do not position immersion as always superior; validate throughput, soils, part geometry, drying needs, and handling.',
    'Do not recommend heated aqueous versions without confirming water-based chemistry suitability.'
  ),
  (select id from graymills_knowledge_documents where title = 'Graymills Parts Washer Catalog' limit 1),
  true,
  'active'
),
(
  'Liftkleen Immersion Systems',
  'Parts Washers',
  'Immersion systems using lift-platform agitation, optional fluid agitation, ultrasonics, filtration, controls, and modular configurations.',
  'Good fit for complex, stacked, nested, larger, or heavier parts requiring automated immersion, repeatable cycle control, reduced manual handling, or multi-stage cleaning.',
  'Full immersion with lift-platform agitation; optional pump agitation, ultrasonics, heat, filtration, oil skimming, coalescing, dryer modules, and modular handling.',
  'Oils, chips, production soils, rebuild residues, and contaminants that benefit from full immersion and agitation; validate chemistry and material compatibility.',
  'Hands-off repeatability, better access to complex surfaces, load/unload ergonomics, cycle control, modular expansion, filtration and fluid management options.',
  jsonb_build_array(
    'Are parts complex, stacked, nested, heavy, or difficult to handle manually?',
    'Is the process batch-oriented, cell-based, or production-line oriented?',
    'Is repeatable cycle timing important?',
    'Is a single tank enough, or is multi-stage wash/rinse/dry needed?',
    'What lift capacity, tank size, agitation, ultrasonics, filtration, or drying requirements exist?'
  ),
  jsonb_build_array(
    'Lift-platform agitation can improve exposure by moving parts through the cleaning fluid.',
    'Modular immersion systems can support additional process needs depending on configuration.'
  ),
  jsonb_build_array(
    'Do not make load-capacity or tank-size claims without model verification.',
    'Do not promise process performance; recommend cleaning tests and application validation.'
  ),
  (select id from graymills_knowledge_documents where title = 'Graymills Parts Washer Catalog' limit 1),
  true,
  'active'
),
(
  'Ultrasonic Parts Washers',
  'Parts Washers',
  'Water-based ultrasonic cleaning systems using cavitation to scrub immersed parts, including intricate surfaces and hard-to-reach features.',
  'Good fit for precision components, intricate geometries, delicate parts, small parts, hard-to-remove soils, and applications where cavitation can improve cleaning consistency.',
  'Ultrasonic cavitation in water-based cleaning fluid; may be combined with heat, filtration, lift-platform agitation, oil skimming, and cycle control depending on model.',
  'Fine particulate, oils, residues, soils lodged in small features, intricate surfaces, and precision-cleaning contaminants; validate detergent, material, and process requirements.',
  'Precision cleaning, access to small features, reduced manual scrubbing, repeatability, and ability to combine with heat and filtration.',
  jsonb_build_array(
    'What level of cleanliness is required and how is it measured?',
    'Are parts delicate, intricate, or difficult to reach mechanically?',
    'What material are the parts made from?',
    'What detergent and temperature range are acceptable?',
    'Is filtration, oil skimming, lift agitation, or automated cycle control required?'
  ),
  jsonb_build_array(
    'Graymills materials describe ultrasonics as cavitation bubbles forming and collapsing to scrub immersed surfaces.',
    'Ultrasonics are relevant where part geometry or required cleanliness makes manual contact difficult.'
  ),
  jsonb_build_array(
    'Do not assume ultrasonics are appropriate for every material or soil.',
    'Do not recommend frequency, wattage, or model without application testing or specification review.',
    'State that water-based chemistry is required unless verified otherwise.'
  ),
  (select id from graymills_knowledge_documents where title = 'Graymills Parts Washer Catalog' limit 1),
  true,
  'active'
),
(
  'Tempest Spray Cabinet Washers',
  'Parts Washers',
  'Aqueous high-pressure spray cabinet washers for directed cleaning of parts without abrasive grit.',
  'Good fit when operators need directed high-pressure aqueous spray for precision machined parts, shop cleaning, maintenance, repair, and parts with deposits that respond to heated aqueous pressure washing.',
  'Heated high-pressure aqueous spray, operator-directed nozzle, filtration, and cabinet containment.',
  'Deposits, oils, grime, chips, and aqueous-cleanable contaminants; validate part material, geometry, detergent, and pressure sensitivity.',
  'Operator comfort, hands out of cleaning fluid, directed cleaning power, heated aqueous cleaning, filtration, visibility, and no abrasive grit.',
  jsonb_build_array(
    'Are parts currently blasted, pressure washed, hand cleaned, or solvent cleaned?',
    'Can the parts tolerate heated aqueous spray?',
    'Are precision surfaces sensitive to abrasive media?',
    'What deposits are hardest to remove?',
    'What part size and weight must fit in the cabinet?'
  ),
  jsonb_build_array(
    'Tempest is relevant where heated aqueous spray and non-abrasive cleaning are important.',
    'The product path should be validated around part size, soil, aqueous chemistry, and pressure tolerance.'
  ),
  jsonb_build_array(
    'Do not recommend Tempest if solvent-only cleaning is required.',
    'Do not assume aqueous cleaning is compatible with all parts or downstream processes.',
    'Confirm size, weight, chemistry, pressure sensitivity, and drying requirements.'
  ),
  (select id from graymills_knowledge_documents where title = 'Graymills Parts Washer Catalog' limit 1),
  true,
  'active'
),
(
  'PrintClean Parts Washers',
  'Parts Washers',
  'Heavy-duty solvent parts washers for production, maintenance, and graphic printing service, including manual hoses, in-tank hydro-jet agitation, and filtration.',
  'Good fit for printing operations, press maintenance, HP Indigo-related cleaning, ink pump and BID cleaning, and shops needing solvent cleaning with manual directed cleaning plus soak/agitation.',
  'Manual directed solvent flow through hoses/nozzle, in-tank hydro-jet agitation on applicable models, filtration, soak, and sludge management.',
  'Ink-related soils, pressroom residues, oils, grime, and production-maintenance contaminants; validate cleaning fluid and part compatibility.',
  'Pressroom productivity, manual cleaning flexibility, soak/agitation capability, filtration, fluid-life management, and reduced cleaning friction for graphic printing service.',
  jsonb_build_array(
    'What press components, ink pumps, BIDs, or assemblies are being cleaned?',
    'How often are these components cleaned and how long does it take today?',
    'Is the cleaning process a bottleneck for press uptime or changeover?',
    'What solvent or approved cleaning fluid is used?',
    'Are sludge trays, filtration, or fluid-life management pain points?'
  ),
  jsonb_build_array(
    'PrintClean documentation describes production, maintenance, and graphic printing service use.',
    'PrintClean documentation describes hoses for manual cleaning, hydro-jet manifold agitation, and screen filtration.'
  ),
  jsonb_build_array(
    'Do not claim compatibility with specific ink, solvent, or OEM parts without verification.',
    'Do not recommend solvent cleaning without confirming flash point, safety, ventilation, and EHS requirements.'
  ),
  (select id from graymills_knowledge_documents where title = 'Graymills PrintClean Documentation' limit 1),
  true,
  'active'
),
(
  'Graymills Pumps and Pump/Tank Systems',
  'Pumps and Metalworking Fluid Systems',
  'Industrial pumps and pump/tank systems for moving, circulating, filtering, and managing fluids in manufacturing and process equipment.',
  'Good fit for machine tool coolant, lubricant handling, recirculation, transfer, filtering, tank systems, and OEM fluid-system integration where flow, head, viscosity, materials, and duty cycle must be matched.',
  'Fluid pumping, recirculation, transfer, filtration support, coolant/lubricant delivery, and tank-system integration.',
  'Coolants, lubricants, oils, inks, process fluids, and fluids with varying viscosity or solids; validate compatibility and operating conditions.',
  'Reliability, serviceability, ready-to-install systems, flow/head matching, materials options, reduced maintenance friction, and OEM integration support.',
  jsonb_build_array(
    'What fluid is being pumped and what is its viscosity?',
    'What flow rate and head pressure are required?',
    'Is the pump continuous duty or intermittent?',
    'Are abrasives, chips, solids, or contaminants present?',
    'What wetted materials are compatible with the fluid?',
    'Is this for a machine retrofit, OEM system, tank system, or replacement pump?'
  ),
  jsonb_build_array(
    'Graymills pump materials emphasize flow, head, viscosity, pump/tank systems, and serviceability features.',
    'Pump opportunities must be qualified around operating conditions before product recommendation.'
  ),
  jsonb_build_array(
    'Never size or specify a pump without flow, head, viscosity, fluid, temperature, duty cycle, and materials compatibility.',
    'Use potential-fit language until engineering details are known.'
  ),
  (select id from graymills_knowledge_documents where title = 'Graymills Pump Catalog' limit 1),
  true,
  'active'
),
(
  'Stocklube Systems',
  'Pumps and Metalworking Fluid Systems',
  'Controlled lubrication systems for coil or strip stock that replace hand-brushing and recirculate lubricant through a pump/reservoir system.',
  'Good fit for stamping, forming, and coil/strip applications where controlled, uniform lubrication can reduce mess, improve consistency, reduce die wear, and support production speed.',
  'Roller-applied lubrication with recirculation, filtration, and adjustable flow control.',
  'Metalworking lubricants, oils, and stock-surface contamination; validate lubricant and material requirements.',
  'Uniform lubrication, less hand application, reduced mess, die-life support, recirculated fluid, and adjustable flow.',
  jsonb_build_array(
    'What stock width and thickness are being processed?',
    'Is lubrication applied manually today?',
    'What lubricant is used and how much waste or mess occurs?',
    'Are die wear, floor hazards, or inconsistent lubrication concerns?',
    'What production speed and flow control are needed?'
  ),
  jsonb_build_array(
    'Stocklube materials describe controlled lubrication of coil or strip stock and recirculated lubricant through a pump reservoir.',
    'Stocklube is relevant where manual lubrication creates mess, waste, or inconsistency.'
  ),
  jsonb_build_array(
    'Do not claim die-life improvement quantitatively without customer data.',
    'Validate lubricant, stock width, thickness, speed, and installation constraints.'
  ),
  (select id from graymills_knowledge_documents where title = 'Graymills Pump Catalog' limit 1),
  true,
  'active'
),
(
  'Flexographic and Gravure Inking Systems',
  'Inking Systems',
  'Ink circulation, filtration, pumping, mixing, and replenishment systems for flexographic and gravure pressrooms.',
  'Good fit for converters, printers, OEMs, and ink rooms needing improved ink circulation, viscosity/color consistency, deck supply/return, filtration, contamination control, changeover, or press uptime.',
  'Ink pumping, circulation, filtration, mixing, replenishment, surge suppression, and drain/flush support.',
  'Ink contamination including dried ink, pigments, dust, fiber, doctor blade metal particles, and coating/adhesive solids; validate ink chemistry and press design.',
  'Print quality, anilox/gravure cylinder protection, press uptime, reduced waste, faster cleanup, consistent ink condition, and system longevity.',
  jsonb_build_array(
    'What type of press is used: CI, in-line, stack, corrugated, envelope, rotary screen, coating, adhesive, or gravure?',
    'What ink, coating, adhesive, or primer is being circulated?',
    'What flow rate and deck height are required?',
    'Is the process open pan, applicator, or chambered doctor blade?',
    'Are contamination, scoring, plugging, viscosity drift, or changeover time problems?',
    'What pump type is used today: centrifugal, diaphragm, peristaltic, or transfer pump?'
  ),
  jsonb_build_array(
    'Graymills inking materials state that pump and motor selection depends on press, plumbing, and operating demands.',
    'Graymills filter materials position filters as supporting print quality and protecting anilox rolls and gravure cylinders from contaminants.'
  ),
  jsonb_build_array(
    'Do not recommend a pump or filter without press details, flow, deck height, fluid or ink type, viscosity, chemistry, and cleaning/changeover requirements.',
    'Use pressroom-productivity-hypothesis language until validated.'
  ),
  (select id from graymills_knowledge_documents where title = 'Graymills Inking Systems Catalog' limit 1),
  true,
  'active'
);

insert into graymills_application_rules (
  rule_name,
  product_area,
  product_family,
  when_to_recommend,
  when_not_to_recommend,
  required_discovery,
  risk_or_caution,
  sales_language,
  source_document_id,
  approved_for_ai,
  status
)
values
(
  'Use cleaning-action fit before model recommendation',
  'Parts Washers',
  null,
  'Recommend a cleaning path only after identifying soils, current cleaning method, part material, part size, part weight, part configuration, daily volume, upstream and downstream operations, handling preference, process steps, and fluid type.',
  'Do not jump directly to a model when the cleaning action is not yet clear.',
  'Ask about soils, current cleaning method, part material, part geometry, quantity per day, process before and after cleaning, handling, single-step or multi-step process, solvent versus water-based preference, and cleanliness standard.',
  'Equipment fit depends on application variables; avoid guaranteed cleaning outcomes without testing.',
  'The right starting point is the cleaning job, not the machine. Validate the soil, part geometry, throughput, and fluid constraints first, then narrow the Graymills path.',
  (select id from graymills_knowledge_documents where title = 'Graymills Parts Washer Catalog' limit 1),
  true,
  'active'
),
(
  'Manual washer hypothesis',
  'Parts Washers',
  'Manual Parts Washers',
  'Recommend as a likely path when the account has maintenance, repair, rebuild, low-to-moderate volume, operator-controlled cleaning, brush/flush/soak needs, or highly variable parts.',
  'Avoid if the customer needs automated batch consistency, high throughput, very large parts, full immersion automation, precision ultrasonic cleaning, or high-pressure aqueous spray.',
  'Confirm parts, soils, operator workflow, safety constraints, solvent/aqueous preference, and downstream process.',
  'Manual cleaning depends on operator technique and may not solve labor or consistency issues where automation is needed.',
  'A manual washer may be a practical fit where flexibility and operator control matter, especially for maintenance or repair parts that need brushing, flushing, or soaking.',
  (select id from graymills_knowledge_documents where title = 'Graymills Parts Washer Catalog' limit 1),
  true,
  'active'
),
(
  'Immersion washer hypothesis',
  'Parts Washers',
  'Turbo-Action Immersion Parts Washers / Liftkleen Immersion Systems',
  'Recommend as a likely path when the parts are complex, nested, stacked, internally featured, or difficult to clean by surface spray alone.',
  'Avoid if parts cannot be immersed, if water/solvent chemistry is incompatible, if drying requirements dominate, or if the part size/weight exceeds available equipment capabilities.',
  'Confirm part geometry, immersion compatibility, soil type, chemistry, batch size, handling, and drying needs.',
  'Do not say immersion is automatically better; it is better when all-surface exposure and agitation matter.',
  'Immersion is worth validating when the issue is access: blind holes, internal passages, stacked parts, or complex surfaces that need cleaning solution around and through the part.',
  (select id from graymills_knowledge_documents where title = 'Graymills Parts Washer Catalog' limit 1),
  true,
  'active'
),
(
  'Tempest aqueous spray hypothesis',
  'Parts Washers',
  'Tempest Spray Cabinet Washers',
  'Recommend as a likely path when the customer needs operator-directed, heated aqueous, high-pressure cleaning without abrasive media.',
  'Avoid when solvent cleaning is mandatory, parts cannot tolerate aqueous chemistry or pressure, or drying/corrosion concerns are unresolved.',
  'Confirm aqueous compatibility, part sensitivity, size/weight, soil type, temperature, detergent, pressure tolerance, and drying/rust-prevention needs.',
  'Do not imply it replaces all blast or solvent processes; validate with the application.',
  'Tempest may be a strong path when the customer wants pressure-cleaning force without abrasive grit, especially for precision machined parts where surface damage is a concern.',
  (select id from graymills_knowledge_documents where title = 'Graymills Parts Washer Catalog' limit 1),
  true,
  'active'
),
(
  'PrintClean printing-maintenance hypothesis',
  'Parts Washers',
  'PrintClean Parts Washers',
  'Recommend as a likely path when the customer is a printer, HP Indigo user, pressroom, or production maintenance operation cleaning ink-related parts, pumps, BIDs, assemblies, or press components.',
  'Avoid if solvent cleaning is not allowed, if the parts require aqueous-only processing, or if the chemistry/safety requirements have not been confirmed.',
  'Confirm press type, parts cleaned, ink/soil type, cleaning fluid, workflow bottlenecks, maintenance frequency, fluid management, and EHS constraints.',
  'Do not claim compatibility with specific OEM parts or solvents without verification.',
  'PrintClean is worth exploring when press maintenance cleaning is consuming time, creating bottlenecks, or requiring both manual directed cleaning and passive soak/agitation.',
  (select id from graymills_knowledge_documents where title = 'Graymills PrintClean Documentation' limit 1),
  true,
  'active'
),
(
  'Pump sizing guardrail',
  'Pumps and Metalworking Fluid Systems',
  'Graymills Pumps and Pump/Tank Systems',
  'Recommend Graymills pump review when the prospect has coolant, lubricant, ink, process-fluid, transfer, recirculation, filtration, or OEM fluid-system needs.',
  'Do not recommend a specific pump family or model without application data.',
  'Capture fluid, viscosity, temperature, solids/abrasives, flow rate, head, duty cycle, motor or air requirements, tank constraints, material compatibility, and service expectations.',
  'Pump misapplication creates reliability, flow, overheating, compatibility, and maintenance risk.',
  'A Graymills pump opportunity should be qualified around flow, head, viscosity, duty cycle, and fluid compatibility before suggesting a product path.',
  (select id from graymills_knowledge_documents where title = 'Graymills Pump Catalog' limit 1),
  true,
  'active'
),
(
  'Inking system guardrail',
  'Inking Systems',
  'Flexographic and Gravure Inking Systems',
  'Recommend Graymills inking-system review when a printer or converter has ink circulation, filtration, contamination, deck supply/return, viscosity, changeover, or print-quality issues.',
  'Avoid final pump/filter claims without press and ink details.',
  'Capture press type, deck height, web width, run length, flow rate, open pan/applicator/chamber configuration, ink/coating type, contamination problems, cleaning/changeover workflow, and current pump/filter setup.',
  'Wrong pump/filter setup may hurt flow, cleanup, print quality, or equipment life.',
  'The strongest inking-system discussion starts with the pressroom economics: uptime, changeover, contamination control, anilox/gravure protection, and repeatable ink condition.',
  (select id from graymills_knowledge_documents where title = 'Graymills Inking Systems Catalog' limit 1),
  true,
  'active'
);

insert into graymills_prompt_context (
  context_name,
  context_type,
  product_area,
  prompt_text,
  usage_notes,
  approved_for_ai,
  status
)
values
(
  'Graymills AI Analysis Guardrails',
  'guardrail',
  'All',
  'Use careful industrial sales-hypothesis language. Say likely, may, potential fit, worth validating, and depending on parts, soils, chemistry, throughput, handling, safety, and workflow. Do not invent specifications, certifications, compatibility, dimensions, capacities, regulatory claims, performance guarantees, exact model recommendations, or payback claims. When a specific model is needed, ask for missing application variables or recommend Graymills review/testing.',
  'Apply to every OpenAI prospect analysis.',
  true,
  'active'
),
(
  'Parts Washer Discovery Prompt Context',
  'discovery',
  'Parts Washers',
  'For parts washer prospects, evaluate likely fit based on soils, current cleaning method, part material, size, weight, geometry, daily volume, upstream/downstream operation, handling preference, single-step or multi-step process, solvent versus water-based fluid, heating, filtration, drying, safety, EHS constraints, and cleanliness requirements. Map the opportunity to manual, immersion, ultrasonic, spray cabinet, PrintClean, custom, cleaning fluids, or accessories only as a hypothesis.',
  'Use for parts-washer opportunity scoring and prospect-package generation.',
  true,
  'active'
),
(
  'Pump and Metalworking Fluid Discovery Prompt Context',
  'discovery',
  'Pumps and Metalworking Fluid Systems',
  'For pump and fluid-system prospects, qualify around fluid type, viscosity, temperature, flow rate, head, duty cycle, solids/abrasives, pump/tank constraints, motor or air supply, wetted material compatibility, maintenance history, OEM integration requirements, and whether the issue is transfer, recirculation, filtration, lubrication, coolant management, or process fluid delivery.',
  'Use for pump prospect analysis. Do not size a pump from incomplete CRM data.',
  true,
  'active'
),
(
  'Inking System Discovery Prompt Context',
  'discovery',
  'Inking Systems',
  'For flexographic and gravure prospects, evaluate press type, web width, deck height, open pan/applicator/chamber configuration, ink/coating/adhesive chemistry, flow rate, run length, changeover frequency, contamination issues, filtration, viscosity/color consistency, anilox or gravure cylinder protection, current pump type, and cleanup workflow. Focus on uptime, print quality, contamination control, changeover speed, and waste reduction.',
  'Use for printing/converting opportunity analysis.',
  true,
  'active'
),
(
  'Copy Tone for Prospect Intelligence',
  'style',
  'All',
  'Write like a technically literate Graymills industrial sales strategist. Be practical, skeptical of vague claims, and focused on operating value: uptime, labor reduction, cleaning consistency, print quality, contamination control, maintenance simplicity, compliance support, total cost of ownership, and payback. Use concise headings and direct sales language. Avoid hype.',
  'Use when generating prospect packages, sales blocks, call openers, and email drafts.',
  true,
  'active'
),
(
  'What Not To Invent',
  'guardrail',
  'All',
  'Do not invent exact Graymills model numbers, specifications, certifications, dimensions, capacities, chemistry compatibility, regulatory statements, guaranteed labor savings, guaranteed cleaning performance, customer-specific process claims, or payback periods. If those details are not in approved knowledge or CRM data, say they need validation.',
  'Hard guardrail for OpenAI output validation.',
  true,
  'active'
);

select 'graymills_knowledge_documents' as table_name, count(*) from graymills_knowledge_documents
union all
select 'graymills_product_families', count(*) from graymills_product_families
union all
select 'graymills_application_rules', count(*) from graymills_application_rules
union all
select 'graymills_prompt_context', count(*) from graymills_prompt_context;