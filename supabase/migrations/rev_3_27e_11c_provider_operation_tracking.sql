-- Version 3.27E-11C
-- Provider Operation Tracking
--
-- PURPOSE
-- -------
-- CRM remains the system of record.
--
-- This migration creates CRM-owned records for future asynchronous
-- Mailshake recipient-add operations.
--
-- It does NOT:
--   - call Mailshake
--   - add recipients to Mailshake
--   - change outreach_enrollments.status
--   - change outreach_enrollment_batches.status
--   - schedule or send email
--
-- IMPORTANT
-- ---------
-- This migration was applied successfully to the live Supabase
-- database before this repository file was created.
--
-- Do not blindly rerun it.

begin;


-- ============================================================
-- 1. PROVIDER OPERATIONS
-- ============================================================

create table public.outreach_provider_operations (
  id uuid primary key
    default gen_random_uuid(),

  provider text not null
    default 'mailshake'
    check (
      provider = 'mailshake'
    ),

  operation_type text not null
    default 'recipient_add'
    check (
      operation_type in (
        'recipient_add'
      )
    ),

  outreach_campaign_id uuid not null
    references public.outreach_campaigns(id),

  provider_campaign_id text not null,

  status text not null
    default 'prepared'
    check (
      status in (
        'prepared',
        'submitting',
        'submitted',
        'checking',
        'completed',
        'partial',
        'failed',
        'cancelled'
      )
    ),

  provider_check_status_id text,

  requested_by_crm_user_id uuid not null,

  requested_by_display_name text,

  requested_count integer not null
    default 0
    check (
      requested_count >= 0
    ),

  submitted_count integer not null
    default 0
    check (
      submitted_count >= 0
    ),

  confirmed_count integer not null
    default 0
    check (
      confirmed_count >= 0
    ),

  already_present_count integer not null
    default 0
    check (
      already_present_count >= 0
    ),

  unsubscribed_count integer not null
    default 0
    check (
      unsubscribed_count >= 0
    ),

  failed_count integer not null
    default 0
    check (
      failed_count >= 0
    ),

  request_snapshot jsonb not null
    default '{}'::jsonb,

  provider_message text,

  error_message text,

  requested_at timestamptz not null
    default now(),

  submitted_at timestamptz,

  last_checked_at timestamptz,

  completed_at timestamptz,

  failed_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);


-- ============================================================
-- 2. OPERATION ↔ ENROLLMENT MAPPING
-- ============================================================

create table public.outreach_provider_operation_enrollments (
  operation_id uuid not null
    references public.outreach_provider_operations(id),

  enrollment_id uuid not null
    references public.outreach_enrollments(id),

  submitted_email text not null,

  status text not null
    default 'prepared'
    check (
      status in (
        'prepared',
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

  primary key (
    operation_id,
    enrollment_id
  )
);


-- ============================================================
-- 3. INDEXES
-- ============================================================

create index
  outreach_provider_operations_campaign_idx
on public.outreach_provider_operations (
  outreach_campaign_id,
  created_at desc
);


create index
  outreach_provider_operations_status_idx
on public.outreach_provider_operations (
  status,
  created_at desc
);


create index
  outreach_provider_operations_requested_by_idx
on public.outreach_provider_operations (
  requested_by_crm_user_id,
  created_at desc
);


create unique index
  outreach_provider_operations_check_status_uidx
on public.outreach_provider_operations (
  provider,
  provider_check_status_id
)
where provider_check_status_id is not null;


create index
  outreach_provider_operation_enrollments_enrollment_idx
on public.outreach_provider_operation_enrollments (
  enrollment_id,
  created_at desc
);


create index
  outreach_provider_operation_enrollments_status_idx
on public.outreach_provider_operation_enrollments (
  status,
  created_at desc
);


create index
  outreach_provider_operation_enrollments_recipient_idx
on public.outreach_provider_operation_enrollments (
  provider_recipient_id
)
where provider_recipient_id is not null;


-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

alter table
  public.outreach_provider_operations
enable row level security;


alter table
  public.outreach_provider_operation_enrollments
enable row level security;


revoke all
on table public.outreach_provider_operations
from anon, authenticated;


revoke all
on table public.outreach_provider_operation_enrollments
from anon, authenticated;


grant all
on table public.outreach_provider_operations
to service_role;


grant all
on table public.outreach_provider_operation_enrollments
to service_role;


-- ============================================================
-- 5. DOCUMENTATION
-- ============================================================

comment on table
  public.outreach_provider_operations
is
  'CRM-owned audit record for one asynchronous outreach-provider operation attempt. Mailshake executes the provider action; CRM retains the business and execution history.';


comment on column
  public.outreach_provider_operations.provider_check_status_id
is
  'Provider asynchronous operation identifier. For Mailshake recipients/add this stores the returned checkStatusID used by recipients/add-status.';


comment on column
  public.outreach_provider_operations.request_snapshot
is
  'Safe CRM/provider execution snapshot for auditing. Must never contain API keys, authentication headers, webhook secrets, or other credentials.';


comment on table
  public.outreach_provider_operation_enrollments
is
  'Maps CRM outreach enrollments to individual provider-operation attempts and preserves the result of each attempt.';


comment on column
  public.outreach_provider_operation_enrollments.submitted_email
is
  'Normalized CRM email snapshot intended for this specific provider operation attempt.';


commit;