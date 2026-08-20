-- Version 3.27D-2A
-- Mailshake outreach event ingestion
--
-- Creates a service-role-only transaction function used by the
-- Mailshake webhook receiver.
--
-- Installing this function does not ingest any event and does not
-- modify contacts, companies, activities, opportunities, ownership,
-- classifications, or Mailshake records.

create or replace function public.ingest_mailshake_outreach_event(
  p_event_type text,
  p_provider_event_key text,
  p_provider_message_id text,
  p_provider_campaign_id text,
  p_campaign_name text,
  p_campaign_created_at timestamptz,
  p_provider_recipient_id text,
  p_recipient_email text,
  p_recipient_first_name text,
  p_recipient_last_name text,
  p_occurred_at timestamptz,
  p_subject text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();

  v_email text;
  v_provider_event_key text;
  v_provider_campaign_id text;
  v_provider_recipient_id text;
  v_provider_message_id text;

  v_contact_ids uuid[];
  v_company_ids uuid[];
  v_contact_count integer := 0;

  v_contact_id uuid;
  v_company_id uuid;

  v_match_status text;
  v_match_reason text;

  v_campaign public.outreach_campaigns%rowtype;
  v_recipient public.outreach_recipients%rowtype;

  v_event_id uuid;
begin
  --------------------------------------------------------------
  -- Validate normalized event
  --------------------------------------------------------------

  if p_event_type not in (
    'message_sent',
    'replied'
  ) then
    raise exception
      'Unsupported outreach event type: %',
      p_event_type;
  end if;

  v_provider_event_key :=
    nullif(trim(p_provider_event_key), '');

  if v_provider_event_key is null then
    raise exception
      'provider_event_key is required';
  end if;

  v_provider_campaign_id :=
    nullif(trim(p_provider_campaign_id), '');

  if v_provider_campaign_id is null then
    raise exception
      'provider_campaign_id is required';
  end if;

  v_provider_recipient_id :=
    nullif(trim(p_provider_recipient_id), '');

  v_provider_message_id :=
    nullif(trim(p_provider_message_id), '');

  v_email :=
    lower(
      nullif(
        trim(p_recipient_email),
        ''
      )
    );

  if v_email is null then
    raise exception
      'recipient_email is required';
  end if;

  if p_occurred_at is null then
    raise exception
      'occurred_at is required';
  end if;

  --------------------------------------------------------------
  -- Serialize changes for this campaign + recipient.
  -- This prevents two simultaneous Mailshake events from
  -- creating competing recipient rows.
  --------------------------------------------------------------

  perform pg_advisory_xact_lock(
    hashtext(
      'mailshake-outreach:' ||
      v_provider_campaign_id ||
      ':' ||
      v_email
    )
  );

  --------------------------------------------------------------
  -- CRM contact matching
  --
  -- Exact normalized email only.
  -- Active contacts only.
  --
  -- We deliberately do NOT create contacts from webhook data.
  --------------------------------------------------------------

  select
    array_agg(
      c.id
      order by c.id::text
    ),
    array_agg(
      c.company_id
      order by c.id::text
    ),
    count(*)::integer
  into
    v_contact_ids,
    v_company_ids,
    v_contact_count
  from public.contacts c
  where
    c.archived_at is null
    and c.email is not null
    and lower(trim(c.email)) = v_email;

  if v_contact_count = 1 then
    v_contact_id :=
      v_contact_ids[1];

    v_company_id :=
      v_company_ids[1];

    v_match_status :=
      'matched';

    v_match_reason :=
      'Exact normalized email matched one active CRM contact.';
  elsif v_contact_count > 1 then
    v_contact_id := null;
    v_company_id := null;

    v_match_status :=
      'ambiguous';

    v_match_reason :=
      'Exact normalized email matched multiple active CRM contacts; no automatic CRM link was made.';
  else
    v_contact_id := null;
    v_company_id := null;

    v_match_status :=
      'unmatched';

    v_match_reason :=
      'No active CRM contact matched the normalized email.';
  end if;

  --------------------------------------------------------------
  -- Campaign identity
  --------------------------------------------------------------

  insert into public.outreach_campaigns (
    provider,
    provider_campaign_id,
    campaign_name,
    provider_created_at,
    first_synced_at,
    last_synced_at,
    created_at,
    updated_at
  )
  values (
    'mailshake',
    v_provider_campaign_id,
    nullif(trim(p_campaign_name), ''),
    p_campaign_created_at,
    v_now,
    v_now,
    v_now,
    v_now
  )
  on conflict (
    provider,
    provider_campaign_id
  )
  do update
  set
    campaign_name =
      coalesce(
        excluded.campaign_name,
        outreach_campaigns.campaign_name
      ),
    provider_created_at =
      coalesce(
        outreach_campaigns.provider_created_at,
        excluded.provider_created_at
      ),
    last_synced_at =
      excluded.last_synced_at,
    updated_at =
      excluded.updated_at
  returning *
  into v_campaign;

  --------------------------------------------------------------
  -- Locate recipient.
  --
  -- Provider recipient ID is strongest.
  -- Email within campaign is the safe fallback.
  --------------------------------------------------------------

  if v_provider_recipient_id is not null then
    select r.*
    into v_recipient
    from public.outreach_recipients r
    where
      r.campaign_id = v_campaign.id
      and r.provider_recipient_id =
        v_provider_recipient_id
    limit 1;
  end if;

  if v_recipient.id is null then
    select r.*
    into v_recipient
    from public.outreach_recipients r
    where
      r.campaign_id = v_campaign.id
      and lower(trim(r.email)) =
        v_email
    limit 1;
  end if;

  --------------------------------------------------------------
  -- Protect against a provider-recipient conflict.
  --------------------------------------------------------------

  if
    v_recipient.id is not null
    and v_recipient.provider_recipient_id is not null
    and v_provider_recipient_id is not null
    and v_recipient.provider_recipient_id <>
      v_provider_recipient_id
  then
    raise exception
      'Mailshake recipient conflict for campaign % and email %',
      v_provider_campaign_id,
      v_email;
  end if;

  --------------------------------------------------------------
  -- Create or refresh recipient identity.
  --------------------------------------------------------------

  if v_recipient.id is null then
    insert into public.outreach_recipients (
      campaign_id,
      provider,
      provider_recipient_id,
      email,
      first_name,
      last_name,
      contact_id,
      company_id,
      crm_match_status,
      crm_match_reason,
      sent_count,
      reply_count,
      first_synced_at,
      last_synced_at,
      created_at,
      updated_at
    )
    values (
      v_campaign.id,
      'mailshake',
      v_provider_recipient_id,
      v_email,
      nullif(trim(p_recipient_first_name), ''),
      nullif(trim(p_recipient_last_name), ''),
      v_contact_id,
      v_company_id,
      v_match_status,
      v_match_reason,
      0,
      0,
      v_now,
      v_now,
      v_now,
      v_now
    )
    returning *
    into v_recipient;
  else
    update public.outreach_recipients
    set
      provider_recipient_id =
        coalesce(
          v_provider_recipient_id,
          provider_recipient_id
        ),

      email =
        v_email,

      first_name =
        coalesce(
          nullif(
            trim(p_recipient_first_name),
            ''
          ),
          first_name
        ),

      last_name =
        coalesce(
          nullif(
            trim(p_recipient_last_name),
            ''
          ),
          last_name
        ),

      contact_id =
        v_contact_id,

      company_id =
        v_company_id,

      crm_match_status =
        v_match_status,

      crm_match_reason =
        v_match_reason,

      last_synced_at =
        v_now,

      updated_at =
        v_now
    where
      id = v_recipient.id
    returning *
    into v_recipient;
  end if;

  --------------------------------------------------------------
  -- Idempotent event insert.
  --
  -- Mailshake may retry webhook requests. The unique provider
  -- event key prevents a retry from creating another event or
  -- incrementing the recipient totals twice.
  --------------------------------------------------------------

  insert into public.outreach_events (
    campaign_id,
    recipient_id,
    contact_id,
    company_id,
    provider,
    provider_event_key,
    provider_message_id,
    provider_campaign_id,
    provider_recipient_id,
    event_type,
    occurred_at,
    recipient_email,
    subject,
    message_excerpt,
    created_at
  )
  values (
    v_campaign.id,
    v_recipient.id,
    v_contact_id,
    v_company_id,
    'mailshake',
    v_provider_event_key,
    v_provider_message_id,
    v_provider_campaign_id,
    v_provider_recipient_id,
    p_event_type,
    p_occurred_at,
    v_email,
    nullif(trim(p_subject), ''),
    null,
    v_now
  )
  on conflict (
    provider,
    provider_event_key
  )
  do nothing
  returning id
  into v_event_id;

  --------------------------------------------------------------
  -- Duplicate webhook/event:
  -- do not increment counters a second time.
  --------------------------------------------------------------

  if v_event_id is null then
    return jsonb_build_object(
      'status',
      'duplicate',

      'eventType',
      p_event_type,

      'campaignId',
      v_campaign.id,

      'recipientId',
      v_recipient.id,

      'crmMatchStatus',
      v_match_status,

      'contactId',
      v_contact_id,

      'companyId',
      v_company_id
    );
  end if;

  --------------------------------------------------------------
  -- Update recipient sent/reply summary only after a NEW event.
  --------------------------------------------------------------

  if p_event_type = 'message_sent' then
    update public.outreach_recipients
    set
      sent_count =
        sent_count + 1,

      first_sent_at =
        case
          when first_sent_at is null
            or p_occurred_at < first_sent_at
          then p_occurred_at
          else first_sent_at
        end,

      last_sent_at =
        case
          when last_sent_at is null
            or p_occurred_at > last_sent_at
          then p_occurred_at
          else last_sent_at
        end,

      last_synced_at =
        v_now,

      updated_at =
        v_now
    where
      id = v_recipient.id;

  elsif p_event_type = 'replied' then
    update public.outreach_recipients
    set
      reply_count =
        reply_count + 1,

      first_replied_at =
        case
          when first_replied_at is null
            or p_occurred_at < first_replied_at
          then p_occurred_at
          else first_replied_at
        end,

      last_replied_at =
        case
          when last_replied_at is null
            or p_occurred_at > last_replied_at
          then p_occurred_at
          else last_replied_at
        end,

      last_synced_at =
        v_now,

      updated_at =
        v_now
    where
      id = v_recipient.id;
  end if;

  return jsonb_build_object(
    'status',
    'ingested',

    'eventId',
    v_event_id,

    'eventType',
    p_event_type,

    'campaignId',
    v_campaign.id,

    'recipientId',
    v_recipient.id,

    'crmMatchStatus',
    v_match_status,

    'contactId',
    v_contact_id,

    'companyId',
    v_company_id
  );
end;
$$;


revoke all
on function public.ingest_mailshake_outreach_event(
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  timestamptz,
  text
)
from public, anon, authenticated;


grant execute
on function public.ingest_mailshake_outreach_event(
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  timestamptz,
  text
)
to service_role;


comment on function public.ingest_mailshake_outreach_event(
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  timestamptz,
  text
)
is
'Version 3.27D-2: Idempotently ingests normalized Mailshake sent/replied events, matches active CRM contacts by exact normalized email, and never creates or modifies CRM contacts or companies.';