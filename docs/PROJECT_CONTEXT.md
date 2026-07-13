# Graymills CRM Project Context
**Living Project Document**

Last Updated: July 2026  
Current Revision: **Rev 2.83**

---

# Project Overview

Graymills CRM is a custom CRM built for Graymills Corporation.

The project is intentionally developed in **small, production-safe revisions**. Stability is valued more than speed.

Primary goals:

- Sales prospect management
- Company and contact management
- Opportunity tracking
- AI-assisted prospect analysis
- Role-based permissions
- Production-ready quality

Technology Stack

- Next.js 16
- TypeScript
- Supabase
- Vercel
- OpenAI API

---

# Development Philosophy

This project follows strict engineering discipline.

## Every revision must:

1. Have one clearly defined objective.
2. Be small enough to roll back easily.
3. Build successfully before continuing.
4. Be browser tested.
5. Be committed only after verification.

Never combine unrelated features into one revision.

---

# Standard Revision Workflow

Every revision follows this sequence.

## Step 1

Inspect current code.

Never assume source layout.

Inspect first.

---

## Step 2

Create timestamped backup.

Example:

C:\apps\prospecting-tool-backups\

---

## Step 3

Apply patch.

Prefer deterministic patching.

Never perform wide search-and-replace.

---

## Step 4

Run

```
npm run build
```

A revision is not complete until the build passes.

---

## Step 5

Browser verification.

Verify the actual feature.

---

## Step 6

Commit.

Only after successful build and verification.

---

# Patch Philosophy

Large one-off scripts became fragile.

Project now uses:

```
scripts/safe-patch.cjs
```

Future patches should use:

- JSON patch specifications
- Validation before writing
- Automatic backups
- Check mode
- Apply mode

Avoid enormous custom patch scripts whenever possible.

---

# Coding Standards

Prefer:

Small revisions.

Readable code.

Explicit naming.

Fail safely.

No unrelated formatting changes.

Never "clean up" unrelated code while patching.

---

# Output Preferences

When command output exceeds roughly 25 lines:

Do NOT paste into chat.

Instead:

- write to timestamped txt file
- open in Notepad
- user pastes contents

This keeps conversations readable.

---

# Inspection Workflow

Before patching:

Create inspection txt file.

Inspect:

- route
- component
- fetch calls
- git status

Only then generate patch.

---

# Build Workflow

Every revision:

```
npm run build
```

No exceptions.

---

# Verification Workflow

Every revision requires:

- successful build
- browser verification
- git status
- commit

---

# Git Workflow

Typical sequence:

```
git add ...

git commit -m "Rev X.XX ..."

git push origin master
```

---

# Versioning

Current:

Rev 2.x

When project reaches production-ready release:

Version 3.0

Continue:

3.1

3.2

etc.

---

# Current Project Focus

Role-based permission enforcement.

Completed

Rev 2.79

Analyze Prospect

Rev 2.80

Company Account Type

Rev 2.81

Buyer Personas

Company Owner

Rev 2.82

Company Tags

Rev 2.83

Contact Tags

Remaining

Rev 2.84

Sales Opportunities

Rev 2.85

Opportunity Activities

Rev 2.86

Opportunity Documents

Rev 2.87

Root API review

Rev 2.88

Final permission audit

---

# Permission Pattern

Server:

```
enforceApiPermission(...)
```

Client:

```
...apiPermissionHeaders()
```

Always inspect before patching.

---

# User Preferences

User prefers:

- incremental revisions
- copy/paste-ready commands
- deterministic changes
- backup before patching
- verification before commit
- minimal scrolling
- concise explanations
- production-quality engineering

Avoid huge inline code unless necessary.

---

# Things Learned

Do not assume identical formatting.

Inspect first.

Dead components may exist.

Props often must be threaded through multiple component levels.

Always verify where a fetch actually originates before patching.

---

# Future Improvements

After permission work:

- user guide
- release checklist
- production deployment checklist
- automated regression checklist
- patch helper improvements
- revision history generator

---

# Project Status

The project is stable.

The remaining permission work is straightforward.

The project is approaching production readiness.
# Project Status



For revision history, see:

- `CHANGELOG.md`

For planned work, see:

- `FUTURE_REVISIONS.md`

For production preparation, see:

- `RELEASE_CHECKLIST.md`

For system structure and technical design, see:

- `ARCHITECTURE.md`

For practical application instructions, see:

- `USER_GUIDE.md`