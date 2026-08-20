-- Version 3.27
-- Outreach Integration Foundation
--
-- CRM remains the system of record.
-- External providers such as Mailshake remain responsible
-- for sending campaigns.
--
-- Initial supported normalized events:
--   message_sent
--   replied
--
-- Provider API credentials are NOT stored in these tables.

create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),

  provider text not null,
  provider_campaign_id text not null,

  campaign_name text,
  campaign_status text,

  provider_created_at timestamptz,
  provider_updated_at timestamptz,

  first_synced_at timestamptz not null default now(),
  last_synced_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint outreach_campaigns_provider_check
    check (
      provider in ('mailshake')
    ),

  constraint outreach_campaigns_provider_campaign_unique
    unique (
      provider,
      provider_campaign_id
    )
);


create table if not exists public.outreach_recipients (
  id uuid primary key default gen_random_uuid(),

  campaign_id uuid not null
    references public.outreach_campaigns(id)
    on delete cascade,

  provider text not null,
  provider_recipient_id text,

  email text not null,
  first_name text,
  last_name text,

  contact_id uuid
    references public.contacts(id)
    on delete set null,

  company_id uuid
    references public.companies(id)
    on delete set null,

  crm_match_status text not null default 'unmatched',
  crm_match_reason text,

  sent_count integer not null default 0,
  reply_count integer not null default 0,

  first_sent_at timestamptz,
  last_sent_at timestamptz,

  first_replied_at timestamptz,
  last_replied_at timestamptz,

  provider_status text,

  first_synced_at timestamptz not null default now(),
  last_synced_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint outreach_recipients_provider_check
    check (
      provider in ('mailshake')
    ),

  constraint outreach_recipients_match_status_check
    check (
      crm_match_status in (
        'matched',
        'unmatched',
        'ambiguous'
      )
    ),

  constraint outreach_recipients_counts_check
    check (
      sent_count >= 0
      and reply_count >= 0
    )
);


create unique index if not exists
  outreach_recipients_campaign_provider_recipient_unique
on public.outreach_recipients (
  campaign_id,
  provider_recipient_id
)
where provider_recipient_id is not null;


create unique index if not exists
  outreach_recipients_campaign_email_unique
on public.outreach_recipients (
  campaign_id,
  lower(email)
);


create table if not exists public.outreach_events (
  id uuid primary key default gen_random_uuid(),

  campaign_id uuid not null
    references public.outreach_campaigns(id)
    on delete cascade,

  recipient_id uuid not null
    references public.outreach_recipients(id)
    on delete cascade,

  contact_id uuid
    references public.contacts(id)
    on delete set null,

  company_id uuid
    references public.companies(id)
    on delete set null,

  provider text not null,

  /*
   * provider_event_key is the deduplication key.
   * The API may use the provider's own event id or create
   * a deterministic hash when one is not supplied.
   */
  provider_event_key text not null,

  provider_message_id text,
  provider_campaign_id text,
  provider_recipient_id text,

  event_type text not null,
  occurred_at timestamptz not null,

  recipient_email text not null,

  subject text,

  /*
   * First version deliberately does not store full raw
   * provider webhook payloads or full email bodies.
   */
  message_excerpt text,

  created_at timestamptz not null default now(),

  constraint outreach_events_provider_check
    check (
      provider in ('mailshake')
    ),

  constraint outreach_events_type_check
    check (
      event_type in (
        'message_sent',
        'replied'
      )
    ),

  constraint outreach_events_provider_event_unique
    unique (
      provider,
      provider_event_key
    )
);


create index if not exists
  outreach_campaigns_last_synced_idx
on public.outreach_campaigns (
  last_synced_at desc
);


create index if not exists
  outreach_recipients_contact_idx
on public.outreach_recipients (
  contact_id
);


create index if not exists
  outreach_recipients_company_idx
on public.outreach_recipients (
  company_id
);


create index if not exists
  outreach_recipients_email_idx
on public.outreach_recipients (
  lower(email)
);


create index if not exists
  outreach_recipients_last_sent_idx
on public.outreach_recipients (
  last_sent_at desc
);


create index if not exists
  outreach_recipients_last_replied_idx
on public.outreach_recipients (
  last_replied_at desc
);


create index if not exists
  outreach_events_recipient_idx
on public.outreach_events (
  recipient_id,
  occurred_at desc
);


create index if not exists
  outreach_events_contact_idx
on public.outreach_events (
  contact_id,
  occurred_at desc
);


create index if not exists
  outreach_events_company_idx
on public.outreach_events (
  company_id,
  occurred_at desc
);


create index if not exists
  outreach_events_type_time_idx
on public.outreach_events (
  event_type,
  occurred_at desc
);


alter table public.outreach_campaigns
  enable row level security;

alter table public.outreach_recipients
  enable row level security;

alter table public.outreach_events
  enable row level security;


/*
 * These tables are intentionally service-role only.
 * Browser users do not receive direct table access.
 * CRM API routes will verify the signed-in CRM user
 * before reading outreach information.
 */

revoke all
on table public.outreach_campaigns
from anon, authenticated;

revoke all
on table public.outreach_recipients
from anon, authenticated;

revoke all
on table public.outreach_events
from anon, authenticated;


grant all
on table public.outreach_campaigns
to service_role;

grant all
on table public.outreach_recipients
to service_role;

grant all
on table public.outreach_events
to service_role;


comment on table public.outreach_campaigns
is
'Version 3.27: External outreach campaign identities such as Mailshake campaigns.';


comment on table public.outreach_recipients
is
'Version 3.27: Outreach recipients matched to CRM contacts and companies primarily by normalized email.';


comment on table public.outreach_events
is
'Version 3.27: Deduplicated normalized external outreach events. Initial event types are message_sent and replied.';