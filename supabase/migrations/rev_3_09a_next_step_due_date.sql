-- Version 3.09A
-- Add an optional due date for an opportunity's required next step.
-- Existing records remain valid so they can be flagged and corrected in the UI.

alter table public.sales_opportunities
  add column if not exists next_step_due_date date;

create index if not exists idx_sales_opportunities_next_step_due_date
  on public.sales_opportunities(next_step_due_date);

comment on column public.sales_opportunities.next_step_due_date is
  'Due date for the opportunity next step. Open opportunities will be validated by the application in Version 3.09.';
