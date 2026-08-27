begin;

create table public.outreach_provider_run_authorizations (
  id uuid primary key default gen_random_uuid(),

  provider text not null default 'mailshake',
  outreach_campaign_id uuid not null
    references public.outreach_campaigns(id),
  provider_campaign_id text not null,

  environment text not null,

  status text not null default 'draft',

  authorized_by_crm_user_id uuid not null,
  authorized_by_display_name text,

  authorized_count integer not null,

  selection_fingerprint text not null,

  authorization_snapshot jsonb
    not null
    default '{}'::jsonb,

  authorized_at timestamptz,
  expires_at timestamptz not null,

  started_at timestamptz,
  stopped_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,

  stop_reason text,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint outreach_provider_run_auth_provider_check
    check (provider = 'mailshake'),

  constraint outreach_provider_run_auth_environment_check
    check (
      environment in (
        'preview',
        'production'
      )
    ),

  constraint outreach_provider_run_auth_status_check
    check (
      status in (
        'draft',
        'authorized',
        'in_progress',
        'stopped',
        'completed',
        'expired',
        'cancelled'
      )
    ),

  constraint outreach_provider_run_auth_count_check
    check (authorized_count > 0),

  constraint outreach_provider_run_auth_campaign_check
    check (
      length(trim(provider_campaign_id)) > 0
    ),

  constraint outreach_provider_run_auth_fingerprint_check
    check (
      length(trim(selection_fingerprint)) > 0
    ),

  constraint outreach_provider_run_auth_expiry_check
    check (
      expires_at > created_at
    )
);


create table public.outreach_provider_run_authorization_enrollments (
  id uuid primary key default gen_random_uuid(),

  authorization_id uuid not null
    references public.outreach_provider_run_authorizations(id)
    on delete restrict,

  enrollment_id uuid not null
    references public.outreach_enrollments(id)
    on delete restrict,

  contact_id uuid not null
    references public.contacts(id)
    on delete restrict,

  normalized_email text not null,

  sequence_number integer not null,

  status text not null default 'pending',

  consumed_at timestamptz,
  cancelled_at timestamptz,
  skip_reason text,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint outreach_provider_run_auth_enrollment_unique
    unique (
      authorization_id,
      enrollment_id
    ),

  constraint outreach_provider_run_auth_sequence_unique
    unique (
      authorization_id,
      sequence_number
    ),

  constraint outreach_provider_run_auth_item_sequence_check
    check (
      sequence_number > 0
    ),

  constraint outreach_provider_run_auth_item_email_check
    check (
      length(trim(normalized_email)) > 0
      and normalized_email = lower(trim(normalized_email))
    ),

  constraint outreach_provider_run_auth_item_status_check
    check (
      status in (
        'pending',
        'authorized',
        'consumed',
        'cancelled',
        'skipped'
      )
    )
);


alter table public.outreach_provider_operations
  add column run_authorization_enrollment_id uuid null
    references public.outreach_provider_run_authorization_enrollments(id)
    on delete restrict;


create unique index
  outreach_provider_operations_run_auth_item_uidx
on public.outreach_provider_operations (
  run_authorization_enrollment_id
)
where run_authorization_enrollment_id is not null;


create index
  outreach_provider_run_auth_campaign_idx
on public.outreach_provider_run_authorizations (
  outreach_campaign_id,
  created_at desc
);


create index
  outreach_provider_run_auth_status_idx
on public.outreach_provider_run_authorizations (
  status,
  expires_at
);


create index
  outreach_provider_run_auth_requested_by_idx
on public.outreach_provider_run_authorizations (
  authorized_by_crm_user_id,
  created_at desc
);


create index
  outreach_provider_run_auth_item_enrollment_idx
on public.outreach_provider_run_authorization_enrollments (
  enrollment_id,
  created_at desc
);


create index
  outreach_provider_run_auth_item_status_idx
on public.outreach_provider_run_authorization_enrollments (
  authorization_id,
  status,
  sequence_number
);


alter table
  public.outreach_provider_run_authorizations
enable row level security;


alter table
  public.outreach_provider_run_authorization_enrollments
enable row level security;


/*
 * H3B1 deliberately creates no anon/authenticated RLS policies.
 *
 * These authorization records are server-controlled safety records.
 * Browser code must not be able to create or alter them directly.
 */

revoke all
on public.outreach_provider_run_authorizations
from anon, authenticated;


revoke all
on public.outreach_provider_run_authorization_enrollments
from anon, authenticated;


/*
 * Server-side CRM routes use the Supabase service role.
 * No DELETE grant is provided because authorization records
 * should be retained for audit/history.
 */

grant select, insert, update
on public.outreach_provider_run_authorizations
to service_role;


grant select, insert, update
on public.outreach_provider_run_authorization_enrollments
to service_role;


commit;