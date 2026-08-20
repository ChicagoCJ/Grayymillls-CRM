-- Version 3.27E-11C2
-- Add submission_unknown provider-operation safety state
--
-- PURPOSE
-- -------
-- If CRM starts a Mailshake write request but cannot determine
-- whether the provider accepted it, the provider operation must
-- preserve that uncertainty instead of incorrectly recording
-- the operation as failed.
--
-- This migration:
--   - changes only the provider-operation status constraint
--   - does not modify existing rows
--   - does not call Mailshake
--   - does not change outreach_enrollments
--   - does not send or schedule email
--
-- IMPORTANT
-- ---------
-- This migration was applied successfully to the live Supabase
-- database before this repository file was created.
--
-- Do not blindly rerun it.

begin;

alter table public.outreach_provider_operations
drop constraint outreach_provider_operations_status_check;

alter table public.outreach_provider_operations
add constraint outreach_provider_operations_status_check
check (
  status in (
    'prepared',
    'submitting',
    'submitted',
    'submission_unknown',
    'checking',
    'completed',
    'partial',
    'failed',
    'cancelled'
  )
);

comment on column
  public.outreach_provider_operations.status
is
  'CRM-owned provider-operation lifecycle. submission_unknown means CRM initiated a provider write but cannot yet determine whether Mailshake accepted the operation; reconciliation is required before retrying.';

commit;