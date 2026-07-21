-- Version 3.12A
-- Controlled Sales Workflow Automations foundation.
-- Rules are seeded disabled so no activity can be created until an Admin enables it
-- through the protected settings workflow added in later Version 3.12 steps.

create table if not exists public.sales_workflow_automation_rules (
  id uuid primary key default gen_random_uuid(),

  rule_key text not null unique,
  rule_name text not null,
  description text,

  trigger_stage_key text,
  trigger_outcome text
    check (trigger_outcome is null or trigger_outcome in ('won', 'lost')),

  enabled boolean not null default false,
  require_confirmation boolean not null default true,
  create_activity boolean not null default true,
  require_lost_reason boolean not null default false,

  activity_type text not null default 'task',
  activity_subject text,
  activity_notes text,
  due_business_days integer not null default 3
    check (due_business_days >= 0 and due_business_days <= 365),

  sort_order integer not null default 100,
  status text not null default 'active'
    check (status in ('active', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  check (
    (trigger_stage_key is not null and trigger_outcome is null)
    or
    (trigger_stage_key is null and trigger_outcome is not null)
  )
);

create index if not exists idx_sales_workflow_automation_rules_status
  on public.sales_workflow_automation_rules(status);

create index if not exists idx_sales_workflow_automation_rules_enabled
  on public.sales_workflow_automation_rules(enabled);

create index if not exists idx_sales_workflow_automation_rules_stage_key
  on public.sales_workflow_automation_rules(trigger_stage_key);

alter table public.sales_workflow_automation_rules enable row level security;

comment on table public.sales_workflow_automation_rules is
  'Admin-controlled rules that propose or create opportunity activities when an opportunity enters a stage or closes won/lost. Access is restricted to verified server-side service-role workflows.';

alter table public.sales_opportunity_activities
  add column if not exists automation_rule_id uuid
    references public.sales_workflow_automation_rules(id) on delete set null;

alter table public.sales_opportunity_activities
  add column if not exists automation_event_key text;

create unique index if not exists idx_sales_opportunity_activities_automation_event_key
  on public.sales_opportunity_activities(automation_event_key)
  where automation_event_key is not null;

create index if not exists idx_sales_opportunity_activities_automation_rule_id
  on public.sales_opportunity_activities(automation_rule_id);

comment on column public.sales_workflow_automation_rules.require_confirmation is
  'When true, the user must preview and confirm the proposed activity before it is created.';

comment on column public.sales_opportunity_activities.automation_event_key is
  'Deterministic key used to prevent duplicate automated activities for the same workflow event.';

insert into public.sales_workflow_automation_rules (
  rule_key,
  rule_name,
  description,
  trigger_stage_key,
  trigger_outcome,
  enabled,
  require_confirmation,
  create_activity,
  require_lost_reason,
  activity_type,
  activity_subject,
  activity_notes,
  due_business_days,
  sort_order,
  status
)
values
(
  'enter_discovery',
  'Discovery follow-up',
  'Propose a discovery-call activity when an opportunity enters the Discovery stage.',
  'discovery',
  null,
  false,
  true,
  true,
  false,
  'meeting',
  'Schedule discovery call',
  'Confirm the application, parts, soils, current process, pain points, stakeholders, timing, and commercial relevance.',
  3,
  10,
  'active'
),
(
  'enter_solution_quote',
  'Prepare and send quote',
  'Propose a quote-preparation activity when an opportunity enters the Solution / Quote stage.',
  'solution_quote',
  null,
  false,
  true,
  true,
  false,
  'task',
  'Prepare and send quote',
  'Confirm the proposed solution, configuration, scope, pricing, lead time, commercial terms, and customer delivery expectations.',
  5,
  20,
  'active'
),
(
  'enter_technical_commercial_review',
  'Quote follow-up',
  'Propose a quote follow-up when an opportunity enters Technical / Commercial Review.',
  'technical_commercial_review',
  null,
  false,
  true,
  true,
  false,
  'quote_followup',
  'Follow up on quote',
  'Review customer feedback, technical questions, budget, procurement requirements, decision criteria, approvals, and next actions.',
  3,
  30,
  'active'
),
(
  'close_won_handoff',
  'Won opportunity handoff',
  'Propose an order-handoff task when an opportunity is marked won.',
  null,
  'won',
  false,
  true,
  true,
  false,
  'task',
  'Confirm order handoff',
  'Confirm order details, internal ownership, customer commitments, required documentation, and the next operational handoff.',
  2,
  40,
  'active'
),
(
  'close_lost_reason',
  'Lost reason required',
  'Require a lost reason when an opportunity is marked lost. No follow-up activity is created.',
  null,
  'lost',
  false,
  true,
  false,
  true,
  'note',
  null,
  null,
  0,
  50,
  'active'
)
on conflict (rule_key) do update
set
  rule_name = excluded.rule_name,
  description = excluded.description,
  trigger_stage_key = excluded.trigger_stage_key,
  trigger_outcome = excluded.trigger_outcome,
  require_confirmation = excluded.require_confirmation,
  create_activity = excluded.create_activity,
  require_lost_reason = excluded.require_lost_reason,
  activity_type = excluded.activity_type,
  activity_subject = excluded.activity_subject,
  activity_notes = excluded.activity_notes,
  due_business_days = excluded.due_business_days,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

select
  rule_key,
  rule_name,
  trigger_stage_key,
  trigger_outcome,
  enabled,
  require_confirmation,
  create_activity,
  require_lost_reason,
  due_business_days,
  status
from public.sales_workflow_automation_rules
order by sort_order, rule_name;
