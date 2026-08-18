-- Version 3.26G
-- Safely link a reviewed ERP customer to an existing CRM company.
-- The only CRM company field this function can change is:
--   companies.graymills_customer_number

create or replace function public.apply_erp_reconciliation_customer_link(
  p_reconciliation_customer_id uuid,
  p_company_id uuid,
  p_actor_user_id uuid,
  p_actor_name text,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reconciliation public.erp_reconciliation_customers%rowtype;
  v_company public.companies%rowtype;

  v_erp_customer_number text;
  v_existing_customer_number text;

  v_candidate_allowed boolean := false;

  v_conflicting_company_id uuid;
  v_conflicting_company_name text;

  v_customer_number_changed boolean := false;
  v_now timestamptz := now();
begin
  if p_reconciliation_customer_id is null then
    raise exception
      'Reconciliation customer id is required.';
  end if;

  if p_company_id is null then
    raise exception
      'CRM company id is required.';
  end if;

  select *
  into v_reconciliation
  from public.erp_reconciliation_customers
  where id = p_reconciliation_customer_id
  for update;

  if not found then
    raise exception
      'ERP reconciliation customer was not found.';
  end if;

  v_erp_customer_number :=
    btrim(
      coalesce(
        v_reconciliation.erp_customer_number,
        ''
      )
    );

  if v_erp_customer_number = '' then
    raise exception
      'The ERP reconciliation customer does not have a customer number.';
  end if;

  /*
   * Prevent two simultaneous link operations for the same
   * ERP customer number.
   */
  perform pg_advisory_xact_lock(
    hashtext(
      'graymills-erp-customer:' ||
      lower(v_erp_customer_number)
    )
  );

  /*
   * The CRM company must have been one of the reconciliation
   * candidates, or already be the proposed matched company.
   */
  select exists (
    select 1
    from jsonb_array_elements(
      coalesce(
        v_reconciliation.candidate_matches,
        '[]'::jsonb
      )
    ) as candidate
    where
      candidate ->> 'company_id' =
      p_company_id::text
  )
  into v_candidate_allowed;

  if
    not v_candidate_allowed
    and coalesce(
      v_reconciliation.matched_company_id::text,
      ''
    ) <> p_company_id::text
  then
    raise exception
      'The selected CRM company is not one of the proposed reconciliation candidates.';
  end if;

  select *
  into v_company
  from public.companies
  where
    id = p_company_id
    and archived_at is null
  for update;

  if not found then
    raise exception
      'The selected CRM company is not active or no longer exists.';
  end if;

  v_existing_customer_number :=
    btrim(
      coalesce(
        v_company.graymills_customer_number,
        ''
      )
    );

  /*
   * Never overwrite a different CRM customer number.
   */
  if
    v_existing_customer_number <> ''
    and lower(v_existing_customer_number) <>
        lower(v_erp_customer_number)
  then
    raise exception
      'Customer-number conflict: CRM company "%" already has customer number "%", while ERP has "%".',
      v_company.company_name,
      v_existing_customer_number,
      v_erp_customer_number;
  end if;

  /*
   * Never assign this ERP customer number to two active
   * CRM companies.
   */
  select
    company.id,
    company.company_name
  into
    v_conflicting_company_id,
    v_conflicting_company_name
  from public.companies as company
  where
    company.id <> p_company_id
    and company.archived_at is null
    and lower(
      btrim(
        coalesce(
          company.graymills_customer_number,
          ''
        )
      )
    ) = lower(v_erp_customer_number)
  limit 1
  for update;

  if v_conflicting_company_id is not null then
    raise exception
      'ERP customer number "%" is already linked to CRM company "%". No change was made.',
      v_erp_customer_number,
      v_conflicting_company_name;
  end if;

  /*
   * Only fill a blank customer-number field.
   * If the same value is already present, this is safe to repeat.
   */
  if v_existing_customer_number = '' then
    update public.companies
    set
      graymills_customer_number =
        v_erp_customer_number
    where id = p_company_id;

    v_customer_number_changed := true;
  end if;

  update public.erp_reconciliation_customers
  set
    matched_company_id =
      p_company_id,

    review_status =
      'confirmed',

    reviewed_by_user_id =
      p_actor_user_id,

    reviewed_by_name =
      nullif(
        btrim(
          coalesce(
            p_actor_name,
            ''
          )
        ),
        ''
      ),

    reviewed_at =
      v_now,

    review_note =
      nullif(
        btrim(
          coalesce(
            p_review_note,
            ''
          )
        ),
        ''
      ),

    updated_at =
      v_now
  where id =
    p_reconciliation_customer_id;

  insert into public.erp_reconciliation_events (
    run_id,
    reconciliation_customer_id,
    event_type,
    event_data,
    performed_by_user_id,
    performed_by_name,
    created_at
  )
  values (
    v_reconciliation.run_id,
    p_reconciliation_customer_id,
    'customer_number_applied',

    jsonb_build_object(
      'company_id',
        p_company_id,

      'company_name',
        v_company.company_name,

      'erp_customer_number',
        v_erp_customer_number,

      'previous_crm_customer_number',
        nullif(
          v_existing_customer_number,
          ''
        ),

      'customer_number_changed',
        v_customer_number_changed,

      'review_note',
        nullif(
          btrim(
            coalesce(
              p_review_note,
              ''
            )
          ),
          ''
        )
    ),

    p_actor_user_id,

    nullif(
      btrim(
        coalesce(
          p_actor_name,
          ''
        )
      ),
      ''
    ),

    v_now
  );

  return jsonb_build_object(
    'status',
      'linked',

    'company_id',
      p_company_id,

    'company_name',
      v_company.company_name,

    'erp_customer_number',
      v_erp_customer_number,

    'previous_crm_customer_number',
      nullif(
        v_existing_customer_number,
        ''
      ),

    'customer_number_changed',
      v_customer_number_changed
  );
end;
$$;

revoke all
on function public.apply_erp_reconciliation_customer_link(
  uuid,
  uuid,
  uuid,
  text,
  text
)
from public;

revoke all
on function public.apply_erp_reconciliation_customer_link(
  uuid,
  uuid,
  uuid,
  text,
  text
)
from anon;

revoke all
on function public.apply_erp_reconciliation_customer_link(
  uuid,
  uuid,
  uuid,
  text,
  text
)
from authenticated;

grant execute
on function public.apply_erp_reconciliation_customer_link(
  uuid,
  uuid,
  uuid,
  text,
  text
)
to service_role;

comment on function public.apply_erp_reconciliation_customer_link(
  uuid,
  uuid,
  uuid,
  text,
  text
)
is
'Version 3.26G: Safely links an approved ERP reconciliation customer to an existing CRM company using the Graymills customer number.';