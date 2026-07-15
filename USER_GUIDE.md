# Graymills CRM User Guide

**Application:** Graymills CRM / Prospecting Tool  
**Release:** Version 3.0 Production Release  
**Audience:** Graymills sales, sales management, and CRM administrators

---

## 1. Purpose of the CRM

The Graymills CRM is used to manage:

- Companies and prospects
- Contacts
- Salesperson and Sales Manager coverage
- Sales opportunities and funnel stages
- Activities, follow-ups, notes, and documents
- ZoomInfo or other CSV imports
- AI-assisted prospect analysis
- CRM users, roles, tags, buyer personas, and workflow settings

Access is controlled through the userâ€™s Graymills CRM role.

---

## 2. Signing In

Open the Graymills CRM web address provided by the administrator.

Enter:

- Your Graymills email address
- Your assigned password

Select **Sign in to CRM**.

The CRM matches the signed-in Supabase Authentication account to a CRM Users record with the same email address.

If the email addresses do not match, access will be restricted.

### Signing out

Use the sign-out control in the Admin authentication section when available, or close the browser after signing out of the authenticated session.

Do not share passwords or leave the CRM open on a shared computer.

---

## 3. User Roles

### Admin

Admins have full CRM access, including:

- All companies and contacts
- All opportunities and activities
- Imports
- Sales coverage assignment
- CRM user administration
- Funnel stage administration
- Buyer persona administration
- Tag administration
- Backup export

### Sales Manager

Sales Managers can:

- View all companies and contacts
- View and manage the sales funnel
- View all activities
- Import ZoomInfo data
- Assign and rebalance sales coverage
- Manage opportunities

Sales Managers cannot manage CRM users or protected Admin settings.

### Sales Rep

Sales Reps can:

- View companies assigned to them as Salesperson / Rep
- View contacts related to their assigned companies
- View and manage related opportunities
- Add activities, notes, and follow-ups
- Move opportunities through permitted funnel stages
- Mark permitted opportunities won or lost

Sales Reps do not have access to Admin settings or ZoomInfo imports.

---

## 4. Main Navigation

The CRM includes these primary areas:

### Dashboard

The Dashboard provides an overview of CRM activity, pipeline, company records, and follow-up information.

Use it to identify:

- Open sales opportunities
- Upcoming activities
- Companies requiring attention
- Sales coverage conditions
- Pipeline and funnel status

### Companies

The Companies area contains prospect and customer company records.

Use it to:

- Search for a company
- Filter company records
- Open Company Detail
- Review sales coverage
- Review AI prospect analysis
- View contacts, opportunities, activities, notes, and documents
- Select multiple companies for bulk sales coverage assignment when permitted

### Contacts

The Contacts area contains people associated with CRM companies.

Use it to:

- Search by name, company, title, email, department, or tags
- Filter by market, sector, or category
- Open the related company
- Review available phone and email information

### Funnel

The Funnel area contains sales opportunities arranged by stage.

Use it to:

- Review active opportunities
- Move opportunities through the sales process
- Review opportunity value and status
- Mark opportunities won or lost
- Open the associated company

### Import ZoomInfo

The Import area is available to Admins and Sales Managers.

Use it to:

- Upload a ZoomInfo CSV file
- Map imported columns
- Assign imported companies to a salesperson or Sales Manager
- Apply CRM tags
- Review import validation
- Import companies and contacts

### Admin

The Admin area is available only to Admin users.

Use it to manage:

- CRM users
- User roles and status
- Funnel stages
- Buyer personas
- Tags and tag types
- Authentication status
- CRM backup exports

### Release Notes

The Release Notes area summarizes recent CRM revisions and features.

---

## 5. Working With Companies

### Searching for a company

Open **Companies** and use the search box.

The search can match information such as:

- Company name
- Industry
- Location
- Website
- NAICS or SIC information
- CRM tags
- Prospect-analysis fields

### Opening Company Detail

Select a company to open its Company Detail page.

The page may include:

- Company information
- Sales Coverage
- Contacts
- Activities
- Sales opportunities
- AI prospect analysis
- Analysis history
- Notes
- Documents
- Tags

Use the Back control to return to the previous CRM view.

### Sales Coverage

The Sales Coverage section identifies:

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

When a Sales Repâ€™s visibility is restricted to assigned companies, related contact visibility follows the company assignment.

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

Do not mark an opportunity Won until the sale has reached the companyâ€™s accepted definition of a win.

Do not delete lost opportunities solely to improve funnel appearance. Retaining the history supports analysis and future follow-up.

---

## 9. AI Prospect Analysis

The CRM can generate an AI-assisted prospect analysis for a company.

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

Historical snapshots may include the score, tier, confidence, product recommendation, use case, soils, cleaning action, and next best action.

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

### Import process

1. Open **Import ZoomInfo**.
2. Upload the CSV file.
3. Review detected columns.
4. Confirm or correct field mapping.
5. Select optional salesperson and Sales Manager assignments.
6. Select any tags to apply.
7. Run the import.
8. Review the import results.
9. Check several imported companies and contacts.

### Duplicate handling

Imports may match or update existing records based on available identifiers and matching rules.

Always review the import summary rather than assuming every row created a new record.

---

## 11. Tags

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

## 12. Buyer Personas

Buyer personas help describe common customer or prospect profiles.

Admins can manage buyer-persona definitions.

Personas may be used to support:

- Prospect analysis
- Sales messaging
- Qualification
- Campaign targeting
- Application recommendations

Persona assignments should support sales judgment rather than replace it.

---

## 13. Creating a New User

A new user requires two matching records:

1. A Supabase Authentication account.
2. A Graymills CRM Users record.

The email address must match in both systems.

### Step 1: Create the login in Supabase

In the Supabase project:

1. Open **Authentication**.
2. Open **Users**.
3. Select **Add user** or **Create user**.
4. Enter the userâ€™s email.
5. Assign a temporary password.
6. Mark the email confirmed when appropriate.

Provide the temporary password to the user through an approved secure method.

### Step 2: Create the CRM Users record

In the Graymills CRM:

1. Sign in as an Admin.
2. Open **Admin**.
3. Add the new CRM user.
4. Enter the same email used in Supabase.
5. Enter the display name.
6. Assign the correct role.
7. Set the user status to **Active**.
8. Select the appropriate coverage type.
9. Save the user.

### Step 3: Verify access

Have the user sign in.

Confirm:

- The correct user name is shown.
- The correct role is applied.
- The correct navigation tabs appear.
- Record visibility matches the role.
- Sales coverage behaves as expected.

---

## 14. Password Administration

The current CRM does not provide a complete self-service password-management workflow inside the application.

Password administration is handled through Supabase Authentication.

An administrator may need to:

- Create the initial password
- Send a password-reset invitation
- Reset a password
- Confirm a userâ€™s email
- Disable or remove an authentication account

Changing or disabling the CRM Users record alone does not automatically change the Supabase password.

For terminated or inactive users:

1. Set the CRM Users record to inactive.
2. Disable or remove the Supabase Authentication account.
3. Reassign open companies, opportunities, and activities.

---

## 15. Backup Export

Admins can download a dated JSON backup of core CRM operational tables.

Before major data changes:

1. Open **Admin**.
2. Locate **Backup Export**.
3. Select **Download CRM backup JSON**.
4. Confirm the file downloads.
5. Store the file in an approved secure location.

The current backup tool exports data only.

A full automated restore workflow is not currently enabled.

---

## 16. Data Quality Practices

Follow these practices when adding or updating records:

- Search before creating a new company.
- Use the companyâ€™s standard legal or operating name.
- Verify website addresses.
- Use direct phone and email information when available.
- Assign the correct salesperson and Sales Manager.
- Use standardized tags.
- Keep opportunity stages current.
- Complete old activities.
- Avoid entering sensitive personal information that does not belong in the CRM.
- Do not use AI-generated claims without review.

---

## 17. Troubleshooting

### The login screen keeps appearing

Check:

- The email and password are correct.
- The user exists in Supabase Authentication.
- The browser Supabase environment configuration is available.
- The authentication account is active.

### Login succeeds, but CRM access is restricted

Check:

- A CRM Users record exists.
- The CRM Users email matches the Supabase Authentication email.
- The CRM Users record is Active.
- The role is Admin, Sales Manager, or Sales Rep.

### The Admin tab is missing

Only Admin users can access the Admin area.

Verify the userâ€™s CRM role.

### The Import tab is missing

Import access is available to Admins and Sales Managers.

Sales Reps do not have Import access.

### A Sales Rep cannot see a company

Check whether the company is assigned to that user as Salesperson / Rep.

### Contacts are missing

Contacts inherit visibility from their related company.

Confirm the company is visible to the signed-in user.

### An assignment dropdown is empty

Check:

- CRM users exist.
- The users are Active.
- The CRM Users API loaded successfully.
- The browser session is still signed in.

### AI analysis fails

Check:

- The company record loaded correctly.
- The server has the required OpenAI configuration.
- The user has permission for the requested operation.
- The application error message for additional details.

### Data appears outdated

Select **Refresh CRM** and recheck the record.

---

## 18. Production Administrator Checklist

Before adding the first production records:

- Confirm the production Supabase project is connected.
- Confirm required environment variables are present.
- Confirm at least one Admin authentication account.
- Confirm the matching Admin CRM Users record.
- Verify Admin, Sales Manager, and Sales Rep permissions.
- Download a CRM backup.
- Remove test companies, contacts, activities, opportunities, and analyses.
- Preserve CRM users and configuration records.
- Confirm zero unintended test records remain.
- Import or create initial production companies.
- Verify backup export after production data is added.

---

## 19. Support and Change Requests

Report CRM issues with:

- The page or section being used
- The user role
- The company or contact involved
- What action was attempted
- The displayed error message
- A screenshot when appropriate
- Whether Refresh CRM changed the result

Do not include passwords in support messages or screenshots.

---

## 20. Version 3.0 Release Notes

Version 3.0 establishes the CRM as the production release.

Production-release priorities include:

- Supabase email/password login gate
- Signed-in CRM-user matching
- Role-based navigation and permissions
- Sales Rep company visibility
- Sales coverage management
- Protected Admin and Import access
- CRM backup export
- AI analysis history and metric snapshots
- Removal of temporary role-testing controls
- Production documentation
- Removal of test CRM data before normal use