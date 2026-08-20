-- Version 3.27E-11C3
-- Prevent Concurrent Duplicate Provider Submission
--
-- PURPOSE
-- -------
-- Prevent the same CRM outreach enrollment from being reserved
-- by more than one active provider-operation attempt at a time.
--
-- An operation-enrollment mapping is considered active while its
-- status is:
--   prepared
--   submitted
--
-- This protects against overlapping requests, double-clicks,
-- retries during an uncertain provider outcome, and similar
-- concurrency cases.
--
-- This migration:
--   - does not call Mailshake
--   - does not insert provider operations
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

create unique index
  outreach_provider_operation_enrollments_active_enrollment_uidx
on public.outreach_provider_operation_enrollments (
  enrollment_id
)
where status in (
  'prepared',
  'submitted'
);

comment on index
  public.outreach_provider_operation_enrollments_active_enrollment_uidx
is
  'Allows only one active provider-operation attempt per CRM outreach enrollment while the operation mapping is prepared or submitted.';

commit;