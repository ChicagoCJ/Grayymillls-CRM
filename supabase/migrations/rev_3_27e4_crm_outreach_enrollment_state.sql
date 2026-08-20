-- Version 3.27E-4
-- CRM-Owned Outreach Enrollment State
--
-- CRM is the system of record.
-- Mailshake is the email execution provider.
--
-- This migration creates CRM-owned enrollment instructions
-- and does NOT call Mailshake or send email.

create table if not exists public.outreach_enrollment_batches (
  id uuid primary key default gen_random_uuid(),

  provider text not null default 'mailshake'
    check (provider = 'mailshake'),

  outreach_campaign_id uuid not null
    references public.outreach_campaigns(id),

  provider_campaign_id text not null,

  campaign_name text,

  selection_mode text not null
    check (
      selection_mode in (
        'individual',
        'select_all_filtered'
      )
    ),

  filter_snapshot jsonb not null
    default '{}'::jsonb,

  requested_by_crm_user_id uuid not null,

  requested_by_display_name text,

  requested_count integer not null
    default 0
    check (requested_count >= 0),

  eligible_count integer not null
    default 0
    check (eligible_count >= 0),

  blocked_count integer not null
    default 0
    check (blocked_count >= 0),

  status text not null
    default 'ready'
    check (
      status in (
        'ready',
        'submitting',
        'completed',
        'partial',
        'failed',
        'cancelled'
      )
    ),

  requested_at timestamptz not null
    default now(),

  submitted_at timestamptz,

  completed_at timestamptz,

  error_message text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);


create table if not exists public.outreach_enrollments (
  id uuid primary key default gen_random_uuid(),

  batch_id uuid not null
    references public.outreach_enrollment_batches(id),

  provider text not null
    default 'mailshake'
    check (provider = 'mailshake'),

  outreach_campaign_id uuid not null
    references public.outreach_campaigns(id),

  provider_campaign_id text not null,

  contact_id uuid not null
    references public.contacts(id),

  company_id uuid not null
    references public.companies(id),

  normalized_email text not null,

  crm_eligibility_status text not null
    default 'eligible'
    check (
      crm_eligibility_status in (
        'eligible',
        'blocked'
      )
    ),

  crm_eligibility_reason text,

  requested_by_crm_user_id uuid not null,

  requested_at timestamptz not null
    default now(),

  status text not null
    default 'requested'
    check (
      status in (
        'requested',
        'submitted',
        'confirmed',
        'already_present',
        'unsubscribed',
        'failed',
        'cancelled'
      )
    ),

  provider_recipient_id text,

  provider_status text,

  provider_message text,

  submitted_at timestamptz,

  confirmed_at timestamptz,

  failed_at timestamptz,

  failure_reason text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint outreach_enrollments_campaign_contact_unique
    unique (
      outreach_campaign_id,
      contact_id
    )
);


create index if not exists
  outreach_enrollment_batches_campaign_idx
on public.outreach_enrollment_batches (
  outreach_campaign_id,
  requested_at desc
);


create index if not exists
  outreach_enrollment_batches_requested_by_idx
on public.outreach_enrollment_batches (
  requested_by_crm_user_id,
  requested_at desc
);


create index if not exists
  outreach_enrollments_batch_idx
on public.outreach_enrollments (
  batch_id
);


create index if not exists
  outreach_enrollments_contact_idx
on public.outreach_enrollments (
  contact_id,
  requested_at desc
);


create index if not exists
  outreach_enrollments_company_idx
on public.outreach_enrollments (
  company_id,
  requested_at desc
);


create index if not exists
  outreach_enrollments_status_idx
on public.outreach_enrollments (
  status,
  requested_at desc
);


create index if not exists
  outreach_enrollments_provider_recipient_idx
on public.outreach_enrollments (
  provider,
  provider_recipient_id
)
where provider_recipient_id is not null;


alter table
  public.outreach_enrollment_batches
enable row level security;


alter table
  public.outreach_enrollments
enable row level security;


revoke all
on table public.outreach_enrollment_batches
from anon, authenticated;


revoke all
on table public.outreach_enrollments
from anon, authenticated;


grant all
on table public.outreach_enrollment_batches
to service_role;


grant all
on table public.outreach_enrollments
to service_role;


comment on table
  public.outreach_enrollment_batches
is
  'CRM-owned record of a confirmed outreach enrollment action. Mailshake is an execution provider, not the system of record.';


comment on table
  public.outreach_enrollments
is
  'CRM-owned contact-to-campaign enrollment state. Provider IDs and statuses describe Mailshake execution results.';


comment on column
  public.outreach_enrollment_batches.filter_snapshot
is
  'Snapshot of CRM filters used when the user confirmed a Select All Filtered or individual outreach enrollment action.';


comment on column
  public.outreach_enrollments.provider_recipient_id
is
  'Mailshake recipient identifier returned by the execution provider. This is implementation metadata, not the CRM enrollment identity.';