begin;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t
      on t.oid = c.conrelid
    join pg_namespace n
      on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'outreach_provider_run_authorizations'
      and c.contype = 'c'
      and lower(pg_get_constraintdef(c.oid)) like '%status%'
      and lower(pg_get_constraintdef(c.oid)) like '%completed%'
  ) then
    raise exception
      'H3C3A stopped: the existing run-authorization status constraint does not appear to permit completed.';
  end if;
end
$$;


create or replace function public.complete_outreach_provider_run_authorization_if_terminal(
  p_provider_operation_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_authorization_id uuid;
  v_authorization_status text;
  v_authorized_count integer;
  v_item_count integer;
  v_now timestamptz := now();
begin
  if p_provider_operation_id is null then
    raise exception
      'A provider operation ID is required.';
  end if;


  select
    item.authorization_id,
    run_auth.status,
    run_auth.authorized_count
  into
    v_authorization_id,
    v_authorization_status,
    v_authorized_count
  from public.outreach_provider_operations operation
  join public.outreach_provider_run_authorization_enrollments item
    on item.id =
      operation.run_authorization_enrollment_id
  join public.outreach_provider_run_authorizations run_auth
    on run_auth.id =
      item.authorization_id
  where operation.id =
    p_provider_operation_id
  for update of run_auth;


  if not found then
    return null;
  end if;


  if v_authorization_status = 'completed' then
    return 'completed';
  end if;


  if v_authorization_status not in (
    'authorized',
    'in_progress'
  ) then
    return v_authorization_status;
  end if;


  select count(*)
  into v_item_count
  from public.outreach_provider_run_authorization_enrollments
  where authorization_id =
    v_authorization_id;


  if
    v_item_count = 0
    or v_item_count <> v_authorized_count
  then
    raise exception
      'Run authorization item count does not match the authorized count. Parent completion was refused.';
  end if;


  if exists (
    select 1
    from public.outreach_provider_run_authorization_enrollments item
    left join public.outreach_provider_operations operation
      on operation.run_authorization_enrollment_id =
        item.id
    where item.authorization_id =
      v_authorization_id
    group by
      item.id,
      item.status
    having
      item.status not in (
        'consumed',
        'skipped',
        'cancelled'
      )

      or (
        item.status = 'consumed'
        and (
          count(operation.id) <> 1
          or count(operation.id) filter (
            where operation.status in (
              'completed',
              'failed',
              'cancelled'
            )
          ) <> 1
        )
      )

      or (
        item.status in (
          'skipped',
          'cancelled'
        )
        and count(operation.id) <> 0
      )
  ) then
    return v_authorization_status;
  end if;


  update public.outreach_provider_run_authorizations
  set
    status = 'completed',
    stopped_at = coalesce(
      stopped_at,
      v_now
    ),
    stop_reason = coalesce(
      stop_reason,
      'All authorized items reached terminal CRM provider-operation outcomes.'
    ),
    updated_at = v_now
  where id = v_authorization_id
    and status in (
      'authorized',
      'in_progress'
    );


  if found then
    return 'completed';
  end if;


  select status
  into v_authorization_status
  from public.outreach_provider_run_authorizations
  where id =
    v_authorization_id;


  return v_authorization_status;
end;
$$;


revoke all
on function public.complete_outreach_provider_run_authorization_if_terminal(uuid)
from public, anon, authenticated;


grant execute
on function public.complete_outreach_provider_run_authorization_if_terminal(uuid)
to service_role;

commit;