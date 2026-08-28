begin;


/*
 * Version 3.27H3B2A
 * Atomic Production run authorization safety guard.
 *
 * This migration does NOT enable Production Mailshake writes.
 */


alter table public.outreach_provider_run_authorizations
  add column if not exists
    cancelled_by_crm_user_id uuid null,
  add column if not exists
    cancelled_by_display_name text null;


/*
 * Only one active authorization may exist for the same
 * provider campaign and environment.
 */

create unique index if not exists
  outreach_provider_run_auth_active_campaign_uidx
on public.outreach_provider_run_authorizations (
  environment,
  provider,
  provider_campaign_id
)
where status in (
  'authorized',
  'in_progress'
);


/*
 * Atomically create the authorization parent plus every
 * exact authorized enrollment item.
 *
 * Either the whole authorization succeeds or none of it does.
 */

create or replace function public.create_outreach_provider_run_authorization(
  p_provider text,
  p_outreach_campaign_id uuid,
  p_provider_campaign_id text,
  p_environment text,
  p_authorized_by_crm_user_id uuid,
  p_authorized_by_display_name text,
  p_selection_fingerprint text,
  p_authorization_snapshot jsonb,
  p_expires_at timestamptz,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_authorization_id uuid;
  v_now timestamptz := now();
  v_item_count integer;
begin

  if p_provider <> 'mailshake' then
    raise exception
      'Only Mailshake run authorizations are supported.';
  end if;


  if p_environment not in (
    'preview',
    'production'
  ) then
    raise exception
      'Run authorization environment must be Preview or Production.';
  end if;


  if p_expires_at <= v_now then
    raise exception
      'Run authorization expiration must be in the future.';
  end if;


  if coalesce(
    trim(p_provider_campaign_id),
    ''
  ) = '' then
    raise exception
      'A provider campaign ID is required.';
  end if;


  if coalesce(
    trim(p_selection_fingerprint),
    ''
  ) = '' then
    raise exception
      'A selection fingerprint is required.';
  end if;


  if jsonb_typeof(p_items) <> 'array' then
    raise exception
      'Authorization items must be a JSON array.';
  end if;


  v_item_count :=
    jsonb_array_length(p_items);


  if v_item_count < 1 then
    raise exception
      'At least one enrollment must be authorized.';
  end if;


/*
 * Expire stale authorization items first.
 */

  update
    public.outreach_provider_run_authorization_enrollments item
  set
    status = 'skipped',

    skip_reason = coalesce(
      item.skip_reason,
      'Run authorization expired before provider execution.'
    ),

    updated_at = v_now

  from
    public.outreach_provider_run_authorizations auth

  where
    item.authorization_id = auth.id

    and auth.environment =
      p_environment

    and auth.provider =
      p_provider

    and auth.provider_campaign_id =
      p_provider_campaign_id

    and auth.status in (
      'authorized',
      'in_progress'
    )

    and auth.expires_at <=
      v_now

    and item.status in (
      'pending',
      'authorized'
    );


/*
 * Expire the corresponding stale authorization parent.
 */

  update
    public.outreach_provider_run_authorizations

  set
    status = 'expired',

    stopped_at = coalesce(
      stopped_at,
      v_now
    ),

    stop_reason = coalesce(
      stop_reason,
      'Run authorization expired before provider execution.'
    ),

    updated_at = v_now

  where
    environment =
      p_environment

    and provider =
      p_provider

    and provider_campaign_id =
      p_provider_campaign_id

    and status in (
      'authorized',
      'in_progress'
    )

    and expires_at <=
      v_now;


/*
 * Refuse to create another live authorization for the same
 * Mailshake campaign and environment.
 */

  if exists (
    select
      1

    from
      public.outreach_provider_run_authorizations

    where
      environment =
        p_environment

      and provider =
        p_provider

      and provider_campaign_id =
        p_provider_campaign_id

      and status in (
        'authorized',
        'in_progress'
      )

      and expires_at >
        v_now
  ) then

    raise exception
      'An active run authorization already exists for this Mailshake campaign.';

  end if;


/*
 * Defense in depth:
 *
 * Every authorization item must still match the exact
 * CRM enrollment, provider, Mailshake campaign,
 * contact and normalized email.
 */

  if exists (
    select
      1

    from jsonb_to_recordset(
      p_items
    ) as item(
      enrollment_id uuid,
      contact_id uuid,
      normalized_email text,
      sequence_number integer
    )

    left join
      public.outreach_enrollments enrollment

      on enrollment.id =
        item.enrollment_id

    where
      enrollment.id is null

      or enrollment.provider <>
        p_provider

      or enrollment.outreach_campaign_id <>
        p_outreach_campaign_id

      or enrollment.provider_campaign_id <>
        p_provider_campaign_id

      or enrollment.contact_id <>
        item.contact_id

      or lower(
        trim(
          enrollment.normalized_email
        )
      ) <>
        lower(
          trim(
            item.normalized_email
          )
        )

      or enrollment.status <>
        'requested'

      or enrollment.provider_recipient_id
        is not null

      or enrollment.submitted_at
        is not null
  ) then

    raise exception
      'One or more authorization items no longer match the intended provider campaign and requested CRM enrollment.';

  end if;


/*
 * Create the authorization parent.
 */

  insert into
    public.outreach_provider_run_authorizations (
      provider,
      outreach_campaign_id,
      provider_campaign_id,
      environment,
      status,
      authorized_by_crm_user_id,
      authorized_by_display_name,
      authorized_count,
      selection_fingerprint,
      authorization_snapshot,
      authorized_at,
      expires_at
    )

  values (
    p_provider,
    p_outreach_campaign_id,
    p_provider_campaign_id,
    p_environment,
    'authorized',
    p_authorized_by_crm_user_id,
    p_authorized_by_display_name,
    v_item_count,
    p_selection_fingerprint,
    coalesce(
      p_authorization_snapshot,
      '{}'::jsonb
    ),
    v_now,
    p_expires_at
  )

  returning id
  into v_authorization_id;


/*
 * Create every exact authorized enrollment item.
 */

  insert into
    public.outreach_provider_run_authorization_enrollments (
      authorization_id,
      enrollment_id,
      contact_id,
      normalized_email,
      sequence_number,
      status
    )

  select
    v_authorization_id,
    item.enrollment_id,
    item.contact_id,
    lower(
      trim(
        item.normalized_email
      )
    ),
    item.sequence_number,
    'authorized'

  from jsonb_to_recordset(
    p_items
  ) as item(
    enrollment_id uuid,
    contact_id uuid,
    normalized_email text,
    sequence_number integer
  );


  return
    v_authorization_id;

end;
$$;


/*
 * Browser roles cannot execute the authorization function.
 */

revoke all
on function public.create_outreach_provider_run_authorization(
  text,
  uuid,
  text,
  text,
  uuid,
  text,
  text,
  jsonb,
  timestamptz,
  jsonb
)
from
  public,
  anon,
  authenticated;


grant execute
on function public.create_outreach_provider_run_authorization(
  text,
  uuid,
  text,
  text,
  uuid,
  text,
  text,
  jsonb,
  timestamptz,
  jsonb
)
to service_role;


/*
 * Cancel an unused authorization while preserving
 * the audit record.
 */

create or replace function public.cancel_outreach_provider_run_authorization(
  p_authorization_id uuid,
  p_cancelled_by_crm_user_id uuid,
  p_cancelled_by_display_name text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
begin

/*
 * Once any provider operation exists for this authorization,
 * the unused-authorization cancellation path is no longer
 * allowed.
 */

  if exists (
    select
      1

    from
      public.outreach_provider_operations operation

    join
      public.outreach_provider_run_authorization_enrollments item

      on item.id =
        operation.run_authorization_enrollment_id

    where
      item.authorization_id =
        p_authorization_id
  ) then

    raise exception
      'This authorization already has a provider operation and cannot be cancelled through the unused-authorization control.';

  end if;


/*
 * Cancel any still-unused authorization items.
 */

  update
    public.outreach_provider_run_authorization_enrollments

  set
    status = 'cancelled',

    cancelled_at = v_now,

    skip_reason = coalesce(
      nullif(
        trim(p_reason),
        ''
      ),
      'Run authorization cancelled before provider execution.'
    ),

    updated_at = v_now

  where
    authorization_id =
      p_authorization_id

    and status in (
      'pending',
      'authorized'
    );


/*
 * Cancel the parent authorization and retain who did it.
 */

  update
    public.outreach_provider_run_authorizations

  set
    status = 'cancelled',

    cancelled_at =
      v_now,

    stopped_at =
      coalesce(
        stopped_at,
        v_now
      ),

    cancelled_by_crm_user_id =
      p_cancelled_by_crm_user_id,

    cancelled_by_display_name =
      nullif(
        trim(
          p_cancelled_by_display_name
        ),
        ''
      ),

    stop_reason =
      coalesce(
        nullif(
          trim(p_reason),
          ''
        ),
        'Run authorization cancelled before provider execution.'
      ),

    updated_at =
      v_now

  where
    id =
      p_authorization_id

    and status in (
      'draft',
      'authorized'
    );


  if not found then
    raise exception
      'The run authorization is missing or is no longer cancellable.';
  end if;


  return true;

end;
$$;


/*
 * Browser roles cannot execute cancellation either.
 */

revoke all
on function public.cancel_outreach_provider_run_authorization(
  uuid,
  uuid,
  text,
  text
)
from
  public,
  anon,
  authenticated;


grant execute
on function public.cancel_outreach_provider_run_authorization(
  uuid,
  uuid,
  text,
  text
)
to service_role;


commit;