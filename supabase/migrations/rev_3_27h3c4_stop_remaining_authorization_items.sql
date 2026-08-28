begin;

create or replace function public.stop_outreach_provider_run_authorization_remaining_items(
  p_authorization_id uuid,
  p_environment text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_status text;
  v_skipped_count integer := 0;
  v_operation_count integer := 0;
  v_reason text :=
    coalesce(
      nullif(trim(p_reason), ''),
      'Controlled provider run stopped before all authorized items were attempted.'
    );
begin
  if p_authorization_id is null then
    raise exception
      'A run authorization ID is required.';
  end if;

  if p_environment not in ('preview', 'production') then
    raise exception
      'Run authorization environment must be Preview or Production.';
  end if;

  select auth.status
  into v_status
  from public.outreach_provider_run_authorizations auth
  where auth.id = p_authorization_id
    and auth.provider = 'mailshake'
    and auth.environment = p_environment
  for update;

  if not found then
    raise exception
      'The Mailshake run authorization was not found in this deployment environment.';
  end if;

  if v_status in (
    'completed',
    'cancelled',
    'expired'
  ) then
    return jsonb_build_object(
      'status', v_status,
      'skipped_count', 0,
      'provider_operation_count', (
        select count(*)
        from public.outreach_provider_operations operation
        join public.outreach_provider_run_authorization_enrollments item
          on item.id =
            operation.run_authorization_enrollment_id
        where item.authorization_id =
          p_authorization_id
      )
    );
  end if;

  if v_status not in (
    'authorized',
    'in_progress'
  ) then
    raise exception
      'The run authorization is not in a stoppable state.';
  end if;

  update
    public.outreach_provider_run_authorization_enrollments item
  set
    status = 'skipped',
    skip_reason = coalesce(
      item.skip_reason,
      v_reason
    ),
    updated_at = v_now
  where item.authorization_id =
      p_authorization_id
    and item.status in (
      'pending',
      'authorized'
    )
    and not exists (
      select 1
      from public.outreach_provider_operations operation
      where operation.run_authorization_enrollment_id =
        item.id
    );

  get diagnostics
    v_skipped_count = row_count;

  select count(*)
  into v_operation_count
  from public.outreach_provider_operations operation
  join public.outreach_provider_run_authorization_enrollments item
    on item.id =
      operation.run_authorization_enrollment_id
  where item.authorization_id =
    p_authorization_id;

  if v_operation_count = 0 then
    update public.outreach_provider_run_authorizations
    set
      status = 'cancelled',
      cancelled_at =
        coalesce(
          cancelled_at,
          v_now
        ),
      stopped_at =
        coalesce(
          stopped_at,
          v_now
        ),
      stop_reason =
        coalesce(
          stop_reason,
          v_reason
        ),
      updated_at = v_now
    where id =
      p_authorization_id;

    v_status := 'cancelled';
  else
    update public.outreach_provider_run_authorizations
    set
      status = 'in_progress',
      stop_reason =
        coalesce(
          stop_reason,
          v_reason
        ),
      updated_at = v_now
    where id =
      p_authorization_id
      and status in (
        'authorized',
        'in_progress'
      );

    v_status := 'in_progress';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'skipped_count', v_skipped_count,
    'provider_operation_count', v_operation_count
  );
end;
$$;

revoke all
on function public.stop_outreach_provider_run_authorization_remaining_items(
  uuid,
  text,
  text
)
from public, anon, authenticated;

grant execute
on function public.stop_outreach_provider_run_authorization_remaining_items(
  uuid,
  text,
  text
)
to service_role;

commit;