-- Rev 2.92
-- Buyer Persona names are now managed through buyer_persona_definitions.
-- Validation is performed by the protected company-buyer-personas API.

alter table public.companies
drop constraint if exists companies_buyer_personas_check;