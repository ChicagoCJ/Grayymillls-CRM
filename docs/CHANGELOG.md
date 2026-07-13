# Graymills CRM Changelog

## Rev 2.83 — Contact Tags Permission Enforcement

### Changed

- Added server-side permission enforcement to Contact Tags POST and DELETE.
- Added CRM permission headers to Contact Tag write requests.
- Passed permission-header support into `ContactTagManager`.

### Verified

- Production build passed.
- Contact tags save and persist after refresh.

---

## Rev 2.82 — Company Tags Permission Enforcement

### Changed

- Added server-side permission enforcement to Company Tags POST and DELETE.
- Added CRM permission headers to Company Tag write requests.
- Passed permission-header support into `CompanyTagManager`.

### Verified

- Production build passed.
- Company tags save and persist after refresh.

---

## Rev 2.81 — Company Metadata Permission Enforcement

### Changed

- Protected Company Buyer Personas writes.
- Protected Company Owner writes.
- Added permission headers to the active Buyer Personas client workflow.

### Verified

- Production build passed.
- Buyer Persona changes save and persist.

---

## Rev 2.80 — Company Account Type Permission Enforcement

### Changed

- Protected the Company Account Type API.
- Added permission headers to the Companies table editor.

### Verified

- Production build passed.
- Account Type changes save and persist.

---

## Rev 2.79 — Analyze Prospect Permission Enforcement

### Changed

- Protected the Analyze Prospect API.
- Added permission headers to the client request.

### Verified

- Production build passed.
- Analyze Prospect completed successfully.