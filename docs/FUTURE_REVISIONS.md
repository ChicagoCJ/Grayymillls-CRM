# Graymills CRM Future Revisions

## Permission Hardening

### Rev 2.84 — Sales Opportunities

- Protect POST and PATCH.
- Add permission headers to create, edit, and quick-update requests.
- Pass permission-header support into `CompanyOpportunityPanel`.

### Rev 2.85 — Opportunity Activities

- Review both similarly named activity routes.
- Determine which route is active and which may be legacy.
- Protect all active write methods.
- Add required client permission headers.

### Rev 2.86 — Opportunity Documents

- Protect upload and update methods.
- Add CRM permission headers to multipart requests.
- Do not manually set multipart `Content-Type`.

### Rev 2.87 — Root API Review

- Inspect `src/app/api/route.ts`.
- Determine its current purpose and whether it remains active.
- Protect, replace, or remove as appropriate.

### Rev 2.88 — Final Permission Audit

- Enumerate every write-capable API route.
- Verify server-side enforcement.
- Verify active client write calls include permission headers.
- Document intentional exceptions.
- Run final production build and browser tests.

## Future Enhancements

- Add clear remove controls to assigned company and contact tags.
- Make Buyer Persona definitions administratively editable.
- Improve patch-helper validation and reporting.
- Complete the practical production user guide.
- Complete release and production-readiness checklists.