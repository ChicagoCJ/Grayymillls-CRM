# Graymills CRM User Guide

**Application:** Graymills CRM / Prospecting Tool  
**Application behavior:** Version 3.27H3C5 - Automatic Reconciliation
**Guide revision:** Version 3.27H3C5A - Outreach and Operations Documentation
**Audience:** Graymills sales, sales management, and CRM administrators

---

## 1. Purpose of the CRM

The Graymills CRM is used to manage:

- Companies and prospects
- Contacts
- Salesperson and Sales Manager coverage
- Sales opportunities and funnel stages
- Activities, follow-ups, notes, and documents
- ZoomInfo and other CSV imports
- AI-assisted prospect analysis
- Projects / Lists and segmentation tags
- Mailshake outreach preparation and controlled recipient enrollment
- ERP reconciliation
- CRM users, roles, buyer personas, and workflow settings

CRM data remains the system of record for sales work.

Access is controlled through the signed-in user's Graymills CRM role.

---

## 2. Signing In

Open the Graymills CRM web address provided by the administrator.

Enter:

- Your Graymills email address
- Your assigned password

Select **Sign in to CRM**.

The CRM matches the signed-in Supabase Authentication account to an active CRM Users record with the same email address.

If the email addresses do not match, access will be restricted.

### Signing out

Use the CRM sign-out control.

Do not share passwords or leave the CRM open on a shared computer.

---

## 3. User Roles

### Admin

Admins have the broadest CRM access, including:

- All companies and contacts
- All opportunities and activities
- Imports
- Sales coverage assignment
- Outreach administration and controlled Mailshake submission
- ERP Reconciliation
- CRM user administration
- Funnel stage administration
- Buyer persona administration
- Tag administration
- Projects / Lists administration
- Knowledge Library administration
- Workflow Automation administration
- Backup export

### Sales Manager

Sales Managers can:

- View all companies and contacts
- View and manage the sales funnel
- View all activities
- Import ZoomInfo data
- Assign and rebalance sales coverage
- Manage opportunities
- Access Outreach for review and reconciliation
- Access ERP Reconciliation

Production Mailshake authorization and controlled provider submission require an Admin.

### Sales Rep

Sales Reps can:

- View companies assigned to them as Salesperson / Rep
- View contacts related to their assigned companies
- View and manage related opportunities
- Add activities, notes, and follow-ups
- Move opportunities through permitted funnel stages
- Mark permitted opportunities won or lost

Sales Reps do not have access to protected Admin settings, ZoomInfo imports, Outreach, or ERP Reconciliation.

---

## 4. Main Navigation

The CRM includes these primary areas.

### Dashboard

Use the Dashboard to review:

- Open sales opportunities
- Upcoming activities
- Overdue work
- Companies requiring attention
- Sales coverage conditions
- Pipeline and funnel status

### Companies

Use Companies to:

- Search and filter company records
- Open Company Detail
- Review sales coverage
- Review contacts
- Review opportunities and activities
- Review AI prospect analysis
- Review documents
- Review classifications and tags
- Review Graymills Customer Number when available

### Contacts

Use Contacts to:

- Search by name, company, title, email, department, or tags
- Filter contact records
- Open the related company
- Review phone and email information

### Funnel

Use Funnel to:

- Review active opportunities
- Move opportunities through the sales process
- Review estimated value
- Review expected close information
- Mark opportunities won or lost
- Open the associated company

### Import ZoomInfo

Available to Admins and Sales Managers.

Use it to:

- Upload CSV files
- Review and correct field mappings
- Assign sales coverage
- Apply segmentation tags
- Review import results

### Outreach

Available to Admins and Sales Managers.

Use Outreach to:

- Load Mailshake campaigns
- Select eligible CRM contacts
- Record CRM outreach enrollment
- Review Mailshake readiness
- Create controlled Production authorizations as an Admin
- Submit controlled recipient runs as an Admin
- Review automatic reconciliation
- Manually reconcile an existing provider operation when necessary
- Review provider-operation history

See **Mailshake Outreach** later in this guide before using Production submission.

### ERP Reconciliation

Available to Admins and Sales Managers.

Use ERP Reconciliation to review CRM and ERP identity information and perform approved reconciliation work.

Graymills Customer Number is an important ERP identity field and should be verified carefully before changing it.

### Admin

Available only to Admin users.

Use Admin to manage:

- Roles and permissions
- Knowledge Library
- CRM Users
- Projects / Lists
- Workflow Automation
- Funnel stages
- Buyer personas
- Markets / Sectors / Categories
- Authentication administration
- Backup exports

### Help

Help displays this User Guide inside the CRM.

### Release Notes

Release Notes summarize recent CRM revisions and features.

### Refresh CRM

Use **Refresh CRM** when CRM information appears out of date.

---

## 5. Working With Companies

### Searching for a company

Open **Companies** and use the search and filter controls.

Searchable information may include:

- Company name
- Graymills Customer Number
- Industry
- Location
- Website
- NAICS or SIC information
- CRM tags
- Prospect-analysis information

### Opening Company Detail

Select a company to open Company Detail.

The page may include:

- Company information
- Sales Coverage
- Graymills classifications
- Graymills Customer Number
- Contacts
- Activities
- Sales opportunities
- AI prospect analysis
- Analysis history
- Notes
- Documents
- Tags
- Projects / Lists

Use the Back control to return to the previous CRM view.

### Sales Coverage

Sales Coverage identifies:

- Assigned Salesperson / Rep
- Assigned Sales Manager
- Coverage status

Admins and Sales Managers can update coverage assignments.

Sales Reps see records according to their assigned company coverage.

### Bulk sales coverage assignment

Users with assignment permission may:

1. Select multiple companies.
2. Choose a Salesperson and/or Sales Manager.
3. Apply the bulk assignment.
4. Verify the confirmation message.
5. Refresh the CRM if necessary.

---

## 6. Working With Contacts

Contacts are connected to company records.

A contact may include:

- Full name
- Job title
- Management level
- Department
- Functional area
- Email
- Direct phone
- Mobile phone
- Related company
- Market, sector, and category tags
- Projects / Lists

When a Sales Rep's visibility is restricted to assigned companies, related contact visibility follows the company assignment.

Accurate email information is especially important for Mailshake Outreach.

Do not create duplicate CRM contacts merely to work around an outreach eligibility problem.

---

## 7. Activities and Follow-Ups

Activities record sales work and planned follow-up.

Depending on the activity type, a record may include:

- Activity date
- Due date
- Activity type
- Subject
- Notes
- Status
- Related company
- Related contact
- Responsible CRM user

Use activities to document:

- Calls
- Emails
- Meetings
- Follow-up tasks
- Test-wash discussions
- Quotation follow-up
- Customer visits
- Opportunity milestones

Complete activities when the work is finished rather than deleting the history.

---

## 8. Sales Opportunities and Funnel Management

Create an opportunity when a company has an identifiable potential sale.

An opportunity may include:

- Opportunity name
- Company
- Funnel stage
- Estimated value
- Expected close information
- Assigned salesperson
- Notes
- Activities
- Documents

Move the opportunity through the funnel as the sale progresses.

Typical outcomes include:

- Open
- Won
- Lost

Do not delete lost opportunities solely to improve funnel appearance.

Retaining history supports reporting, analysis, and future follow-up.

---

## 9. AI Prospect Analysis

The CRM can generate AI-assisted prospect analysis for a company.

The analysis may include:

- Fit score
- Fit tier
- Confidence
- Recommended Graymills product line
- Recommended sales path
- Likely use case
- Likely soils or contaminants
- Cleaning action
- Next best sales action
- Supporting analysis and reasoning

### Running an analysis

1. Open Company Detail.
2. Select **Analyze Prospect**.
3. Wait for the analysis to finish.
4. Review the results before using them in customer communication.

### Analysis history

The CRM stores prior analysis results so changes can be reviewed over time.

### Important limitation

AI analysis is a sales-support tool, not a confirmed engineering recommendation.

Verify important claims through:

- Customer discussion
- Part and soil information
- Process requirements
- Test washing
- Graymills engineering or application review

---

## 10. Importing ZoomInfo Data

Only Admins and Sales Managers can access the import area.

### Before importing

Review the source file and confirm it contains the expected:

- Company records
- Contact records
- Email addresses
- Phone information
- Industry information
- Location information
- ZoomInfo identifiers
- Graymills Customer Number when appropriate

### Import process

1. Open **Import ZoomInfo**.
2. Upload the CSV file.
3. Review the first-row preview and detected columns.
4. Confirm or correct field mapping.
5. Select optional salesperson and Sales Manager assignments.
6. Select permitted tags or Projects / Lists when appropriate.
7. Run the import.
8. Review the import results.
9. Check several imported companies and contacts.

### Duplicate handling

Imports may create, reuse, or enrich records depending on matching information.

Always review the import summary rather than assuming every row created a new record.

---

## 11. Projects / Lists and Segmentation

Projects / Lists help group companies and contacts for sales work and outreach selection.

Segmentation may also use:

- Markets
- Sectors
- Categories
- Company
- State
- Management level
- Function

For Outreach, a CRM List can be used to select all currently eligible members of that List.

The server independently verifies current membership and eligibility before CRM outreach records are created.

---

## 12. Mailshake Outreach

### What Outreach does

The CRM is the source of truth for selecting and tracking recipients.

Mailshake executes email campaigns.

The Outreach workflow intentionally separates:

- CRM selection
- CRM enrollment
- Mailshake readiness checks
- Admin authorization
- Mailshake recipient submission
- Provider reconciliation

Selecting a contact does not by itself add anyone to Mailshake.

### Important terminology

**Selected** means the contact is selected in the CRM interface.

**Recorded enrollment** means the CRM created outreach tracking records. It does not mean the recipient was added to Mailshake.

**Ready** means the latest server-side checks indicate the CRM enrollment is currently eligible for provider submission.

**Authorized** means an Admin created exact permission for specific recipients in a controlled run.

**Submitted** means Mailshake accepted the asynchronous recipient-add request. It does not yet mean the recipient is confirmed in the campaign.

**Confirmed** means reconciliation verified that the recipient exists in the intended Mailshake campaign.

**Provider operation** is the CRM audit record for one exact Mailshake recipient action.

**Run authorization completed** means every exact item in that controlled authorization reached a terminal CRM outcome.

### Campaign size versus controlled run size

A Mailshake campaign is not limited to 10 people.

The CRM currently permits up to 10 exactly authorized recipients in one controlled run.

For example, if 37 recipients are ready:

1. Authorize and process the first 10.
2. Reconcile that run to terminal outcomes.
3. Review the remaining eligible population.
4. Authorize and process the next 10.
5. Repeat until the final 7 are complete.

The 10-recipient limit is a safety boundary for one controlled action, not a campaign-size limit.

### Before using Step 4

Keep the Mailshake campaign **paused**.

Do not unpause the campaign while recipients are still being added or reconciled.

The server checks campaign state again before each recipient submission.

### Outreach workflow

#### Step 0 - Choose campaign and recipients

Choose the Mailshake campaign and select CRM contacts.

Selection alone does not create enrollment records and does not change Mailshake.

#### Step 1 - Review Selection on Server

This is a check-only step.

The server re-validates the selected CRM contacts.

No Mailshake recipient is added.

#### Step 2 - Record Enrollment in CRM

This creates CRM enrollment and batch tracking records.

It does not submit recipients to Mailshake and does not send email.

#### Step 3 - Check Recorded Enrollment and Mailshake Readiness

The CRM re-checks:

- Current contact eligibility
- Recorded enrollment state
- Email consistency
- Duplicate and prior-processing conditions
- Existing provider operations
- Existing Mailshake recipient state
- Current Mailshake campaign state

The campaign must be paused before provider submission can proceed.

#### Production authorization

Production Mailshake submission requires an Admin-created exact run authorization.

The authorization identifies the exact recipient items permitted for the controlled run.

A Production authorization is time-limited.

If it expires or becomes invalid, run the review again and create a fresh authorization.

#### Step 4 - Submit the Controlled Run

Step 4 is the first step that can actually add recipients to Mailshake.

Each authorized recipient is processed sequentially.

Even in a 10-recipient controlled run:

- Each recipient has its own exact authorization item.
- Each recipient gets its own CRM provider operation.
- Each Mailshake provider request contains one recipient.

The CRM does not send one bulk Mailshake request for all 10 recipients.

### Stop-on-error behavior

The controlled run stops on the first blocked, failed, unreadable, or uncertain result.

The CRM does not automatically continue to later recipients after a stop condition.

Unattempted authorization items are retired so they cannot be submitted accidentally from the stopped run.

If an outcome is uncertain, do not automatically retry the recipient.

Review Existing Operations / Reconciliation first.

### Automatic reconciliation

After a completely successful controlled submission run, Version 3.27H3C5 automatically reconciles the exact provider operations created by that run.

Automatic reconciliation:

- Checks status only
- Uses the exact existing CRM provider-operation IDs
- Does not call the recipient-submission endpoint
- Does not add a recipient again
- Does not unpause the campaign
- Does not send email
- Polls for up to approximately 60 seconds

When Mailshake finishes processing, CRM can update:

- Enrollment status
- Provider-operation status
- Mailshake recipient ID
- Batch status
- Run authorization status

### Manual reconciliation fallback

If Mailshake is still processing after the automatic polling window, or an operation requires attention, use **Reconcile This Operation**.

Manual reconciliation checks the exact existing provider operation.

It does not submit the recipient again.

If the operation still shows processing:

- Wait
- Reconcile the same operation later
- Do not click Step 4 again for that recipient

### When reconciliation is complete

A normal successful final result shows:

- CRM enrollment: confirmed
- Provider operation: completed
- Mailshake recipient ID populated

For the final operation in a controlled run, the linked run authorization should also reach completed when every authorized item has a terminal outcome.

### Existing Operations / Reconciliation

Provider history is the CRM audit trail for Mailshake operations already created.

Loading history is read-only.

Use it to:

- Review prior operations
- Review recipient outcomes
- Find exact provider-operation IDs
- Reconcile an existing operation safely

Reconciliation never means submit again.

### When to unpause the Mailshake campaign

Do not unpause solely because Mailshake accepted the asynchronous recipient-add request.

Unpause only after:

- All recipient additions you intended for the current campaign load have been reconciled
- You have reviewed the final recipient population
- No unresolved provider operation needs investigation
- You are actually ready for the Mailshake email sequence to begin

The CRM does not automatically unpause the campaign.

Unpausing is a deliberate Mailshake campaign decision.

### Production Outreach operating checklist

Before clicking Step 4:

- Confirm the correct Mailshake campaign.
- Confirm the campaign is paused.
- Confirm the intended CRM contacts.
- Confirm server-ready counts.
- Review blocked and already-processed counts.
- Confirm the controlled authorization contains only the intended recipients.
- Confirm the Step 4 button shows the expected recipient count.
- Read the final browser confirmation before continuing.

After Step 4:

- Do not click Step 4 again.
- Allow automatic reconciliation to run.
- Review every exact provider operation.
- Use manual reconciliation only when needed.
- Confirm terminal outcomes.
- Keep the campaign paused until the intended recipient load is complete.

---

## 13. Outreach Eligibility and Safety

A contact may be blocked from Mailshake Outreach for reasons such as:

- Do Not Contact status
- Missing email
- Duplicate active CRM email
- Email changed after enrollment
- Enrollment no longer in the expected state
- Recipient already processed
- Existing active provider operation
- Recipient already present in the Mailshake campaign
- Mailshake campaign not paused
- Authorization expired or invalid

Do not bypass a blocked condition by creating a duplicate CRM contact or resubmitting the same recipient.

Correct the underlying CRM or campaign condition, then run a fresh review.

### Preview test allowlist

Vercel Preview uses a server-side recipient allowlist for Mailshake testing.

If Preview reports that a contact is not on the configured test-recipient allowlist:

- No Mailshake recipient should be submitted through that blocked attempt.
- Confirm the exact test email in the Preview environment variable.
- Redeploy the Preview after changing the environment variable.
- Run a fresh review and authorization.

This allowlist is a testing control and is not the normal Production recipient-selection mechanism.

---

## 14. ERP Reconciliation

ERP Reconciliation is available to Admins and Sales Managers.

Use it to review CRM company identity against ERP information.

Graymills Customer Number is the strongest explicit ERP identity field when it is available and correct.

Before changing an ERP identity value:

- Verify the company record.
- Verify the customer number.
- Preserve leading zeros.
- Confirm the number does not belong to another CRM company.
- Avoid guessing based only on similar company names.

ERP reconciliation should be human-reviewed when identity is uncertain.

---

## 15. Tags

Tags help categorize companies and contacts.

Examples may include:

- Markets
- Industries or sectors
- Product interests
- Workflow status
- Priority
- Campaign
- Customer type
- Application type

Admins manage available tags in the Admin area.

Use existing standardized tags whenever possible instead of creating multiple tags with nearly identical meanings.

---

## 16. Buyer Personas

Buyer personas help describe common customer or prospect profiles.

Admins can manage buyer-persona definitions.

Personas may support:

- Prospect analysis
- Sales messaging
- Qualification
- Campaign targeting
- Application recommendations

Persona assignments support sales judgment rather than replace it.

---

## 17. Admin User Management

Only a signed-in Admin can create or modify CRM Users and manage matching authentication logins.

Each person who signs in requires:

1. A Graymills CRM Users record.
2. A Supabase Authentication login.

The email address must match exactly in both records.

### Creating a new user

#### Step 1 - Create the CRM Users record

1. Sign in as an Admin.
2. Open **Admin**.
3. Find **Create CRM User**.
4. Enter the display name.
5. Enter the email address.
6. Select the correct User Role.
7. Select the appropriate Coverage Type.
8. Set Status to Active.
9. Enter optional information.
10. Select **Create CRM User**.

The new user initially displays **No login**.

#### Step 2 - Create the matching Auth login

1. Find the user in CRM Users.
2. Confirm the email address.
3. Confirm the user is Active.
4. Enter a temporary password.
5. Use at least eight characters.
6. Select **Create Auth Login**.
7. Confirm **Login exists**.
8. Confirm email confirmation status as appropriate.

The temporary password is sent to Supabase Authentication.

Do not place passwords in CRM notes, screenshots, support tickets, or shared documents.

### Selecting the correct role

Assign the least-privileged role that still permits the person's work.

### Selecting status

**Active** users may receive normal CRM access when authentication also matches.

**Archived** users are retained for history but should not receive new work or normal CRM access.

---

## 18. Password Administration

Admins can reset another active user's password from the CRM.

### Resetting another user's password

1. Sign in as an Admin.
2. Open **Admin**.
3. Find the active user.
4. Confirm **Login exists**.
5. Enter a new temporary password.
6. Use at least eight characters.
7. Select **Reset Password**.
8. Confirm the success message.
9. Give the password to the user securely.
10. Have the user verify it works.

### Resetting your own password

The CRM intentionally prevents an Admin from resetting their own password from the Admin user-management page.

Use the approved authentication or account-recovery process.

### Password safety

- Never place passwords in CRM notes.
- Never include visible passwords in screenshots.
- Use a unique temporary password.
- Share credentials through an approved secure method.

---

## 19. Archiving and Reactivating Users

### Archiving a CRM User

Before archiving:

- Review open companies
- Review opportunities
- Review activities
- Reassign active work when necessary

Archiving retains the CRM User record for history.

Archiving the CRM User does not by itself delete the Supabase Authentication account.

For security-sensitive departures, also follow the approved authentication-administration process.

### Reactivating a CRM User

1. Open **Admin**.
2. Find the archived user.
3. Select **Reactivate**.
4. Confirm Active status.
5. Review role and coverage type.
6. Confirm the existing authentication login is appropriate.
7. Reset the password when required.
8. Verify access.

Do not create a second Auth login when **Login exists** is already displayed.

---

## 20. Backup Export

Admins can download a dated JSON backup of core CRM operational tables.

Before major data changes:

1. Open **Admin**.
2. Locate **Backup Export**.
3. Select **Download CRM backup JSON**.
4. Confirm the file downloads.
5. Store it in an approved secure location.

The current backup tool exports data only.

A full automated restore workflow is not currently enabled.

---

## 21. Data Quality Practices

Follow these practices when adding or updating records:

- Search before creating a new company.
- Search before creating a new contact.
- Use the company's standard legal or operating name.
- Verify website addresses.
- Verify email addresses.
- Preserve Graymills Customer Number accurately.
- Use direct phone and email information when available.
- Assign the correct salesperson and Sales Manager.
- Use standardized tags.
- Keep opportunity stages current.
- Complete old activities.
- Preserve useful historical records instead of deleting them.
- Avoid entering sensitive personal information that does not belong in the CRM.
- Do not use AI-generated claims without review.

---

## 22. Troubleshooting

### The login screen keeps appearing

Check:

- The email and password are correct.
- The user exists in Supabase Authentication.
- The browser Supabase environment configuration is available.
- The authentication account is active.

### Login succeeds, but CRM access is restricted

Check:

- A CRM Users record exists.
- The CRM Users email matches the Authentication email.
- The CRM Users record is Active.
- The role is Admin, Sales Manager, or Sales Rep.

### The Admin tab is missing

Only Admin users can access the Admin area.

### The Import tab is missing

Import access is available to Admins and Sales Managers.

### Outreach is unavailable

Outreach is available to Admins and Sales Managers.

Production authorization and controlled Mailshake submission require an Admin.

### A Sales Rep cannot see a company

Check whether the company is assigned to that user as Salesperson / Rep.

### Contacts are missing

Contacts inherit visibility from their related company.

### An assignment dropdown is empty

Check:

- CRM users exist.
- The users are Active.
- The CRM Users API loaded successfully.
- The browser session is signed in.

### AI analysis fails

Check:

- The company record loaded correctly.
- The server has the required OpenAI configuration.
- The user has permission.
- The displayed application error.

### Mailshake Step 4 says a recipient is blocked

Do not repeatedly click Step 4.

Review the displayed reason.

Common causes include:

- Do Not Contact
- Missing email
- Duplicate email
- Email changed
- Already processed
- Existing provider operation
- Recipient already in campaign
- Campaign not paused
- Authorization invalid or expired

Correct the underlying issue and run a fresh review.

### Preview says the recipient is not allowlisted

Confirm the exact test email is in the Preview-only Mailshake test-recipient allowlist and redeploy the Preview.

Then create a fresh review and authorization.

### Mailshake says submitted but not confirmed

This is normal for an asynchronous Mailshake add request.

Allow automatic reconciliation to run.

Do not resubmit.

### Automatic reconciliation times out

Use **Reconcile This Operation** later for the same exact provider operation.

Do not submit the recipient again.

### Reconciliation says processing

Wait and reconcile the same operation later.

Do not use Step 4 again for that recipient.

### Reconciliation requires investigation

Stop provider actions for that recipient.

Review the exact existing provider operation and its CRM audit history before deciding what to do.

Do not automatically retry an uncertain submission.

### Campaign has more than 10 recipients

This is normal.

Process the campaign in controlled groups of up to 10.

The campaign itself is not limited to 10.

### Data appears outdated

Select **Refresh CRM**.

For Outreach history, also use **Refresh Provider History** when appropriate.

---

## 23. Production Administrator Checklist

Periodically verify:

- Production Supabase is connected.
- Required environment variables are present.
- At least one active Admin authentication account exists.
- Matching CRM Users records are correct.
- Admin, Sales Manager, and Sales Rep permissions behave as expected.
- Backup export works.
- Production Mailshake campaigns used by CRM are intentionally selected.
- Controlled Mailshake runs remain capped at the intended limit.
- Mailshake recipient submission requires exact Production authorization.
- Provider-operation history is retained.
- Automatic reconciliation is working.
- Manual reconciliation remains available as fallback.
- No Production secrets are exposed in browser-visible code or documentation.

Before major production data changes, download a backup.

---

## 24. Support and Change Requests

Report CRM issues with:

- The page or section being used
- The user role
- The company or contact involved
- The Mailshake campaign when relevant
- The CRM provider-operation ID when relevant
- What action was attempted
- The first meaningful displayed error message
- A screenshot when appropriate
- Whether Refresh CRM or Refresh Provider History changed the result

Do not include passwords or secret environment-variable values in support messages or screenshots.

For an uncertain Mailshake submission, include the provider-operation information and do not retry the recipient before review.

---

## 25. Guide Revision Notes

### Version 3.27H3C5A

This guide revision updates operating documentation through the Version 3.27H3C5 Automatic Reconciliation behavior.

Major documentation updates include:

- Current main navigation
- Outreach / Mailshake workflow
- Campaign size versus controlled-run size
- Up-to-10-recipient controlled runs
- Production authorization
- One provider operation per recipient
- Stop-on-error behavior
- Automatic reconciliation
- Manual reconciliation fallback
- Campaign pause and unpause guidance
- Outreach troubleshooting
- ERP Reconciliation overview
- Updated Admin-area navigation
- Corrected text-encoding artifacts from the older guide

No CRM database, Mailshake provider behavior, or application code is changed by this guide revision.