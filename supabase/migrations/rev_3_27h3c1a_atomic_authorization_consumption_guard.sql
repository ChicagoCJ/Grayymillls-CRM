begin;

create or replace function public.claim_outreach_provider_run_authorization_item(
  p_authorization_item_id uuid,
  p_expected_enrollment_id uuid,
  p_environment text,
  p_requested_by_crm_user_id uuid,
  p_requested_by_display_name text,
  p_request_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();

  v_item
    public.outreach_provider_run_authorization_enrollments%rowtype;

  v_authorization
    public.outreach_provider_run_authorizations%rowtype;

  v_enrollment
    public.outreach_enrollments%rowtype;

  v_operation_id uuid;
  v_request_snapshot jsonb;
begin
  if p_authorization_item_id is null then
    raise exception
      'A run authorization item ID is required.';
  end if;

  if p_expected_enrollment_id is null then
    raise exception
      'An expected CRM enrollment ID is required.';
  end if;

  if p_environment not in ('preview', 'production') then
    raise exception
      'Provider-operation authorization claims are allowed only for Preview or Production.';
  end if;

  if p_requested_by_crm_user_id is null then
    raise exception
      'A requesting CRM user ID is required.';
  end if;

  if jsonb_typeof(
    coalesce(
      p_request_snapshot,
      '{}'::jsonb
    )
  ) <> 'object' then
    raise exception
      'Provider-operation request snapshot must be a JSON object.';
  end if;

  select *
  into v_item
  from public.outreach_provider_run_authorization_enrollments
  where id = p_authorization_item_id
  for update;

  if not found then
    raise exception
      'The requested run authorization item does not exist.';
  end if;

  select *
  into v_authorization
  from public.outreach_provider_run_authorizations
  where id = v_item.authorization_id
  for update;

  if not found then
    raise exception
      'The parent run authorization does not exist.';
  end if;

  if v_authorization.provider <> 'mailshake' then
    raise exception
      'Only Mailshake run authorization items may be claimed.';
  end if;

  if v_authorization.environment <> p_environment then
    raise exception
      'The run authorization environment does not match this deployment.';
  end if;

  if v_authorization.status not in (
    'authorized',
    'in_progress'
  ) then
    raise exception
      'The run authorization is not active.';
  end if;

  if v_authorization.expires_at <= v_now then
    raise exception
      'The run authorization has expired.';
  end if;

  if v_item.status <> 'authorized' then
    raise exception
      'The run authorization item is not available for provider-operation preparation.';
  end if;

  if v_item.consumed_at is not null then
    raise exception
      'The run authorization item has already been consumed.';
  end if;

  if v_item.enrollment_id <> p_expected_enrollment_id then
    raise exception
      'The requested CRM enrollment does not match the exact authorized enrollment.';
  end if;

  select *
  into v_enrollment
  from public.outreach_enrollments
  where id = v_item.enrollment_id
  for update;

  if not found then
    raise exception
      'The authorized CRM enrollment no longer exists.';
  end if;

  if v_enrollment.provider <> 'mailshake' then
    raise exception
      'The authorized CRM enrollment is not a Mailshake enrollment.';
  end if;

  if v_enrollment.outreach_campaign_id <>
    v_authorization.outreach_campaign_id
  then
    raise exception
      'The CRM enrollment campaign no longer matches the run authorization.';
  end if;

  if v_enrollment.provider_campaign_id <>
    v_authorization.provider_campaign_id
  then
    raise exception
      'The Mailshake campaign no longer matches the run authorization.';
  end if;

  if v_enrollment.contact_id <>
    v_item.contact_id
  then
    raise exception
      'The CRM enrollment contact no longer matches the authorized contact.';
  end if;

  if lower(trim(v_enrollment.normalized_email)) <>
    lower(trim(v_item.normalized_email))
  then
    raise exception
      'The CRM enrollment email no longer matches the authorized email.';
  end if;

  if v_enrollment.crm_eligibility_status <> 'eligible' then
    raise exception
      'The CRM enrollment is no longer CRM-eligible.';
  end if;

  if v_enrollment.status <> 'requested' then
    raise exception
      'The CRM enrollment is no longer in requested status.';
  end if;

  if v_enrollment.provider_recipient_id is not null then
    raise exception
      'The CRM enrollment already has a provider recipient ID.';
  end if;

  if v_enrollment.submitted_at is not null then
    raise exception
      'The CRM enrollment has already been submitted.';
  end if;

  if exists (
    select 1
    from public.outreach_provider_operations operation
    where operation.run_authorization_enrollment_id =
      v_item.id
  ) then
    raise exception
      'A provider operation already exists for this run authorization item.';
  end if;

  if exists (
    select 1
    from public.outreach_provider_operation_enrollments mapping
    where mapping.enrollment_id =
      v_item.enrollment_id
      and mapping.status in (
        'prepared',
        'submitted'
      )
  ) then
    raise exception
      'The CRM enrollment already has an active or unresolved provider operation.';
  end if;

  v_request_snapshot :=
    coalesce(
      p_request_snapshot,
      '{}'::jsonb
    )
    ||
    jsonb_build_object(
      'authorizationClaimRevision',
      '3.27H3C1A',

      'runAuthorizationId',
      v_authorization.id,

      'runAuthorizationEnrollmentId',
      v_item.id,

      'authorizedSequenceNumber',
      v_item.sequence_number,

      'claimedEnvironment',
      p_environment,

      'claimedAt',
      v_now
    );

  insert into public.outreach_provider_operations (
    provider,
    operation_type,
    outreach_campaign_id,
    provider_campaign_id,
    status,
    requested_by_crm_user_id,
    requested_by_display_name,
    requested_count,
    request_snapshot,
    run_authorization_enrollment_id
  )
  values (
    'mailshake',
    'recipient_add',
    v_authorization.outreach_campaign_id,
    v_authorization.provider_campaign_id,
    'prepared',
    p_requested_by_crm_user_id,
    nullif(
      trim(p_requested_by_display_name),
      ''
    ),
    1,
    v_request_snapshot,
    v_item.id
  )
  returning id
  into v_operation_id;

  insert into public.outreach_provider_operation_enrollments (
    operation_id,
    enrollment_id,
    submitted_email,
    status
  )
  values (
    v_operation_id,
    v_item.enrollment_id,
    lower(
      trim(
        v_item.normalized_email
      )
    ),
    'prepared'
  );

  update
    public.outreach_provider_run_authorization_enrollments
  set
    status = 'consumed',
    consumed_at = v_now,
    updated_at = v_now
  where id = v_item.id
    and status = 'authorized';

  if not found then
    raise exception
      'The run authorization item could not be atomically consumed.';
  end if;

  update public.outreach_provider_run_authorizations
  set
    status = 'in_progress',
    started_at = coalesce(
      started_at,
      v_now
    ),
    updated_at = v_now
  where id = v_authorization.id
    and status in (
      'authorized',
      'in_progress'
    );

  if not found then
    raise exception
      'The parent run authorization could not be transitioned to in_progress.';
  end if;

  return v_operation_id;
end;
$$;

revoke all
on function public.claim_outreach_provider_run_authorization_item(
  uuid,
  uuid,
  text,
  uuid,
  text,
  jsonb
)
from public, anon, authenticated;

grant execute
on function public.claim_outreach_provider_run_authorization_item(
  uuid,
  uuid,
  text,
  uuid,
  text,
  jsonb
)
to service_role;

comment on function public.claim_outreach_provider_run_authorization_item(
  uuid,
  uuid,
  text,
  uuid,
  text,
  jsonb
)
is
  'H3C1A service-role-only atomic claim: validates one exact active run-authorization item and requested CRM enrollment, creates one prepared provider operation plus enrollment mapping, marks the authorization item consumed, and transitions the parent authorization to in_progress. Does not call Mailshake.';

commit;