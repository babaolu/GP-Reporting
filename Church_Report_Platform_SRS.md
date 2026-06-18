**SOFTWARE REQUIREMENTS**

**SPECIFICATION**

Church Unit Report Management Platform

Version 1.0

June 2026

**Status: Draft**

Confidential - Internal Use Only

# **1\. Document Control**

| **Document Title** | Church Unit Report Management Platform - SRS |
| ------------------ | -------------------------------------------- |
| **Version**        | 1.0                                          |
| **Status**         | Draft                                        |
| **Date**           | June 2026                                    |
| **Prepared By**    | Project Owner                                |
| **Audience**       | Development Team, Stakeholders               |

# **2\. Project Overview**

The Church Unit Report Management Platform is a full-stack web application that enables each church unit head to submit monthly activity reports and allows church administrators to review, analyse, and track those reports across all units.

The platform addresses three core problems:

- Report collection is currently manual and inconsistent, resulting in missed or incomplete submissions.
- Administrators have no unified view of progress, issues, and achievements across all units each month.
- There is no systematic mechanism for surfacing critical issues or analysing trends over time.

The solution provides:

- A structured, role-gated portal for report submission and review.
- AI-powered summarisation and cross-unit insight generation via the Anthropic Claude API.
- Automated deadline-based notifications via email and Telegram.
- A consistency leaderboard, export capability, and historical trend analysis.

# **3\. Stakeholders & Roles**

The system recognises exactly two roles. There is no public self-registration; every account is created by an administrator.

## **3.1 Super Admin**

A single super admin account is seeded at deployment using environment variables. The super admin holds the admin role plus an is_super_admin flag. This account cannot be suspended or deleted through the UI.

**Capabilities:**

- All capabilities of a standard admin (see §3.2).
- Promote any unit head to admin.
- Demote any admin to unit head (cannot demote themselves).
- Suspend or delete any user including other admins (cannot act on their own account).

## **3.2 Admin**

Multiple admins may exist. They are promoted from unit head by the super admin and can be demoted back.

**Capabilities:**

- View all units and all submitted reports.
- Create, rename, and deactivate units (unit head account created as part of this flow).
- Change the unit head for any unit.
- Suspend or unsuspend any user (not themselves, not the super admin).
- Configure the monthly report deadline (subject to lock rules - see §7).
- View the cross-unit consistency leaderboard.
- View cross-unit AI summaries and per-unit trend analysis.
- Leave feedback/comments on any submitted report.
- Export any month's full report bundle as PDF or Word (.docx).
- Manually regenerate the AI summary for any month.

## **3.3 Unit Head**

Exactly one unit head per unit, enforced at the database level. Created by an admin as part of unit creation.

**Capabilities:**

- Submit and resubmit their own unit's monthly report (subject to resubmission rules - see §8).
- View their own unit's 6-month report timeline.
- View the AI summary generated for each of their submitted reports.
- Receive deadline reminder notifications via email and Telegram.

**Restrictions:**

- Cannot view any other unit's reports.
- Cannot see the leaderboard or any cross-unit summary.
- Cannot access administrative settings.

# **4\. User & Unit Lifecycle**

## **4.1 Creating a Unit**

When an admin creates a new unit, the unit and its unit head account are provisioned atomically. The entire operation rolls back if any step fails.

**Steps:**

- Admin provides: Unit Name, Unit Description, Unit Head Email.
- System creates the units row with status = 'frozen'.
- System generates a secure 16-character temporary password.
- A Supabase Auth account is created for the unit head with that email and temporary password.
- A profiles row is created with account_status = 'pending' and is_first_login = true.
- A welcome email is sent containing the temporary password and login URL.

The unit remains frozen and no report submissions are accepted until the unit head completes first-login onboarding.

## **4.2 First-Login Onboarding (Unit Head)**

Unit heads with is_first_login = true are intercepted by a mandatory full-screen onboarding flow before accessing the dashboard.

**Step 1 - Change Password:**

- Must set a new password; the temporary password is immediately invalidated.
- Minimum requirements: 8+ characters, at least one number, at least one special character.

**Step 2 - Complete Profile:**

- Full Name (required).
- Phone Number (required).
- Profile photo upload (optional).

**Step 3 - Link Telegram (optional):**

- A 6-digit one-time code is displayed, valid for 10 minutes and regeneratable.
- Unit head sends the code to the church Telegram bot to link their account.
- A 'Skip for now' option is available; linking can be completed later in Settings.

On completing Steps 1 and 2, is_first_login is set to false, account_status to 'active', and the unit's status to 'active'. The unit head is redirected to their dashboard.

## **4.3 Changing the Unit Head**

An admin clicks 'Change Unit Head' on a unit detail page. The following occurs after confirmation:

- The old unit head's auth account and profile row are permanently deleted.
- A new account is created for the new unit head with a fresh temporary password and welcome email.
- The unit's status is set back to 'frozen'.
- All historical reports, AI summaries, and comments for the unit are fully preserved.
- The unit becomes active only after the new unit head completes first-login onboarding.

## **4.4 Suspending a User**

- Admins can suspend any unit head or any other admin, but not themselves and not the super admin.
- A suspended unit head cannot log in; their unit is set to 'frozen' (data visible to admins only).
- A suspended admin loses all dashboard access.
- Suspension is reversible from the User Management panel.
- When unsuspended, the unit head's unit returns to 'active' (if onboarding was previously completed).

# **5\. Functional Requirements**

## **5.1 Authentication**

- Email and password login via Supabase Auth.
- Role-based route protection: admins and unit heads see entirely separate dashboard layouts.
- First-login onboarding intercept enforced via route guard (cannot be bypassed).
- Suspended users are rejected at login with a clear message.
- Forgot password flow supported via Supabase email reset.

## **5.2 Report Submission**

- A unit head may submit a report for the current reporting month only.
- Two submission modes are available - File Upload or Text Editor - mutually exclusive.
  - File Upload: accepts .pdf, .docx, .md; maximum file size 10 MB.
  - Text Editor: Markdown-enabled editor with toolbar (Bold, Italic, H2/H3, Bullet list, Numbered list).
  - A recommended but fully editable report template is pre-filled in the editor.
- If both file and text are present at submission, an inline validation error blocks proceeding.
- The submission form is locked for past months (read-only).

**Report Template (pre-filled in editor, fully editable):**

- Section 1: Progress This Month
- Section 2: Key Achievements & Breakthroughs
- Section 3: Challenges & Issues Faced
- Section 4: Critical or Urgent Matters
- Section 5: Plans for Next Month

## **5.3 Resubmission Rules**

**Before deadline - Silent Replace:**

- The existing report row is updated in-place (content, parsed text, AI summary, submitted_at overwritten).
- Version number stays at 1; is_late stays false.
- No version history is created or shown to either party.
- Unit head sees confirmation: 'Your report has been updated.'

**After deadline - Archived + Flagged:**

- The existing record's is_latest is set to false.
- A new record is inserted with version incremented, is_latest = true, is_late = true.
- Both versions appear in the slide-over under 'Submission History' (labelled 'Original', 'Revision 1', etc.).
- An amber 'Late Submission' badge is displayed on the timeline node and in admin views.
- First-time submission after the deadline: single record inserted with is_late = true.

## **5.4 Admin Report Management**

- Admin can view any unit's full report and AI summary for any month.
- Admin can leave typed comments/feedback on any submitted report; visible (read-only) to the unit head.
- Admin can export a selected month's full report bundle as PDF or Word (.docx).
  - Export content: cover page, table of contents, per-unit sections (full report + AI summary + comments), cross-unit summary.
- Admin can manually regenerate the AI summary for any month.

## **5.5 Unit Management**

- Admins can create new units (triggers unit head account creation flow - see §4.1).
- Admins can rename or deactivate existing units.
- Admins can change the unit head for any unit (triggers §4.3 flow).
- Units have three statuses: active, frozen, deactivated.
- Frozen units are visible to admins in a visually distinct state (greyed card, padlock icon).

## **5.6 Leaderboard (Admin Only)**

The leaderboard is entirely invisible to unit heads - absent from their navigation and dashboard.

**Scoring formula:**

- base_score = (months submitted on time ÷ total active months) × 100
- completeness_bonus = average(AI completeness score) ÷ 5 × 10 (up to 10 bonus points)
- final_score = base_score + completeness_bonus

Tiebreaker: if two units share the same final_score, rank by earliest average submission time relative to the deadline.

**Display:**

- Top 3 units: gold / silver / bronze trophy styling.
- Full ranked table: Rank, Unit Name, Consistency Score, On-Time Submissions, Average Lead Time, Completeness Avg.
- Current month's live submission count shown at the top.
- Month filter to view historical ranking snapshots.

# **6\. AI & Intelligence Requirements**

All AI operations use Anthropic Claude (model: claude-sonnet-4-6) with max_tokens: 1500 and temperature 0. All prompts instruct the model to return only valid JSON - no markdown fences, no preamble.

## **6.1 Document Text Extraction**

| **Format**  | **Library**     | **Output**                       |
| ----------- | --------------- | -------------------------------- |
| .pdf        | pdf-parse (npm) | Full plain text                  |
| .docx       | mammoth (npm)   | Plain text (not HTML)            |
| .md         | none - raw read | Plain text as-is                 |
| text editor | n/a             | content_text field used directly |

Extracted text is stored in reports.parsed_text. If extraction fails (corrupted file, password-protected PDF, etc.), ai_status is set to 'failed' and the unit head is prompted to re-upload or switch to the text editor.

## **6.2 Per-Report Summarisation**

Triggered asynchronously after text extraction. ai_status is set to 'processing' immediately and updated to 'done' or 'failed' on completion.

**Output JSON structure:**

- summary - 2-3 sentence overview.
- breakthroughs - array of key achievements.
- issues - array of challenges or problems.
- progress - array of ongoing activities.
- critical_alerts - urgent matters requiring immediate attention (empty array if none).
- completeness_score - integer 1-5 rating the thoroughness of the report.

On failure, ai_status = 'failed'; ai_summary is not partially populated.

## **6.3 Cross-Unit Monthly Summary (Admin Only)**

Triggered when the admin visits the Summaries page for a given month, or manually via 'Regenerate Summary'. Only runs when at least one report with ai_status = 'done' exists for that month.

**Output JSON structure:**

- overall_summary - narrative paragraph covering all units.
- common_issues - issues reported by 2 or more units.
- common_breakthroughs - achievements shared across multiple units.
- critical_alerts - any urgent matters from any unit.
- cross_unit_themes - notable patterns or dependencies across units.
- unit_highlights - one-sentence highlight per unit.

## **6.4 Per-Unit Trend Analysis (Admin Only)**

Triggered on demand from the unit detail page. Uses the last 6 months of per-report AI summaries in chronological order.

**Output JSON structure:**

- trend_narrative - paragraph describing the unit's progress trajectory.
- persisting_issues - issues appearing in 2+ consecutive months.
- resolved_issues - issues that no longer appear in recent months.
- new_developments - items appearing for the first time in the latest report.
- momentum - one of: positive | neutral | concerning.

## **6.5 AI Processing UI States**

| **ai_status** | **UI Behaviour**                                         |
| ------------- | -------------------------------------------------------- |
| pending       | Grey shimmer skeleton in the summary panel.              |
| processing    | Animated gradient shimmer with label 'Analysing report…' |
| done          | Summary renders fully with structured sections.          |
| failed        | Amber 'Summary unavailable' notice with a Retry button.  |

# **7\. Deadline Management & Notifications**

## **7.1 Default Deadline**

The default deadline for each reporting month is the first Saturday of the following calendar month. For example, the deadline for June's report defaults to the first Saturday in July.

The system auto-creates a report_deadlines row for each month on the first day of that month (via the daily cron job) if one does not already exist.

## **7.2 Admin Override**

- Admins may change the deadline_date for any upcoming month via a calendar picker in the Settings page.
- The deadline becomes locked (non-editable) once the first reminder has been sent (first_reminder_sent = true).
- When locked, the input is disabled and shows a tooltip: 'The deadline cannot be changed after the first reminder has been sent.'

## **7.3 Reminder Schedule**

Three reminders are sent, working backwards from the deadline:

| **Reminder** | **Sent On**       | **Gap from Previous**   |
| ------------ | ----------------- | ----------------------- |
| 1st          | deadline − 6 days | -                       |
| 2nd          | deadline − 3 days | 3 days after Reminder 1 |
| 3rd          | deadline − 1 day  | 2 days after Reminder 2 |

- Reminders are sent only to unit heads who have not yet submitted for that month.
- Units that have already submitted are skipped entirely.
- A reminder is never sent twice for the same unit + month + sequence number (enforced by a database unique constraint).
- Sending Reminder 1 immediately sets first_reminder_sent = true, locking the deadline.

## **7.4 Notification Channels**

**Email (via Resend):**

- Subject: '⏰ Reminder \[N/3\]: Monthly Report Due in \[D\] Day(s) - \[Month Year\]'
- Body includes: unit name, deadline date, days remaining, submit button link, sign-off with church name.

**Telegram (via Bot API):**

- Short formatted message with unit name, deadline, days remaining, and submission link.
- Requires the unit head to have linked their Telegram account (see §7.5).

**Cron job:**

- Runs daily at 08:00 WAT (UTC+1) as a node-cron job inside the Express server.
- Auto-creates the deadline row for the current month if it does not yet exist.
- Computes which reminder sequence should fire today and dispatches accordingly.

## **7.5 Telegram Account Linking**

- Unit head navigates to Settings → Notifications → Link Telegram.
- A 6-digit one-time code is generated with a 10-minute TTL.
- UI displays: 'Send this code to @\[BotUsername\] on Telegram to link your account.'
- The Telegram bot webhook receives the code, matches it to a profile, stores the chat_id, and sets telegram_linked = true.
- The settings page polls every 5 seconds and updates to show 'Telegram linked ✓' on success.
- If the code expires, a 'Regenerate Code' button appears; the old code is invalidated.

# **8\. Dashboard Requirements**

## **8.1 Admin Dashboard Pages**

**Overview Page:**

- Headline stat: 'X of Y units have submitted for \[Month\]' with a progress bar.
- Grid of all unit cards: unit name, unit head name, submission status badge (Submitted / Pending / Late / Frozen), submitted-at time.
- Critical alerts banner: surfaces non-empty critical_alerts from any unit's AI summary.
- Shortcut to this month's cross-unit summary.

**Units Page:**

- Searchable, filterable grid of all units with status badges.
- 'Create Unit' button opens a slide-over form.
- Clicking a unit navigates to the Unit Detail page.

**Unit Detail Page:**

- Unit name, description, unit head profile card (name, email, phone, Telegram status).
- 'Change Unit Head' and 'Deactivate Unit' action buttons (with confirmation modals).
- 6-month report timeline (shared component with unit head view).
- 'View Trend Analysis' button (lazy-loads AI trend data).
- Admin comment box at the bottom of each opened report slide-over.

**Monthly Reports Page:**

- Month picker (all available months from earliest unit creation to present).
- Table: Unit | Unit Head | Submitted? | On Time? | Submitted At | AI Status | Actions.
- Clicking a row expands the full report and AI summary inline.
- Admin comment thread visible and editable inline.
- 'Export This Month' button opens format-selection modal (PDF or .docx).

**Leaderboard Page (admin only):**

- Full ranked table with gold/silver/bronze trophy styling for top 3.
- Month filter for historical snapshots; tiebreaker label shown when applicable.

**Summaries & Insights Page (admin only):**

- Tab 'This Month': cross-unit summary with colour-coded sections.
- Tab 'Trend Analysis': per-unit trend cards, expandable.
- Tab 'Cross-Unit Themes': issues/breakthroughs shared by 2+ units, grouped.
- 'Regenerate Summary' button.

**User Management Page (admin only):**

- Table: Name | Email | Role | Unit | Status | Actions.
- Actions: Suspend / Unsuspend | Promote (super admin only) | Demote (super admin only).
- Super admin row has no action buttons (cannot be acted on).
- An admin cannot act on their own row.

**Settings Page (admin only):**

- Deadline configuration: month picker + calendar date picker (disabled after Reminder 1 is sent).
- Church Name: editable (used in notification emails).
- Telegram Bot: shows bot username and webhook connection status.

## **8.2 Unit Head Dashboard Pages**

**Overview Page:**

- Welcome card with current month report status: Submitted ✓ / Pending - \[D\] days remaining / Overdue.
- Quick action: 'Submit Report' or 'Update Report' button.
- Amber banner if Telegram is not yet linked: 'Link your Telegram to receive reminders.'

**Submit / Update Report Page:**

- Two tabs: Upload File | Write Report (mutually exclusive - switching tabs clears the other input).
- Upload tab: drag-and-drop zone; shows filename and size after selection.
- Write tab: Markdown editor with template pre-filled; editable freely.
- If deadline passed and report exists: button reads 'Submit Late Revision'; amber warning banner shown.

**Report History - 6-Month Timeline:**

- Vertical timeline; most recent month at top.
- Green ✓ node = submitted on time.
- Amber clock node = submitted late.
- Red ✕ node (warning styling, pulsing outline) = no report submitted.
- Grey dash node = future month.
- Clicking a submitted node opens a slide-over: full report, AI summary, submission history (if resubmitted after deadline), admin comments (read-only).

**Settings Page:**

- Update profile: Full Name, Phone Number, Avatar.
- Change Password.
- Link / Unlink Telegram.
- Email notification preference toggle.

# **9\. Data Model Summary**

The database is hosted on Supabase (PostgreSQL). Row Level Security (RLS) is enforced at the database layer.

| **Table**         | **Purpose**                        | **Key Constraints**                                     |
| ----------------- | ---------------------------------- | ------------------------------------------------------- |
| units             | Church units                       | status: active \| frozen \| deactivated                 |
| profiles          | User accounts (extends auth.users) | role: admin \| unit_head; unique unit_id per unit_head  |
| report_deadlines  | Monthly submission deadlines       | One row per month; deadline locked after first reminder |
| reports           | Submitted reports (all versions)   | UNIQUE(unit_id, month, version)                         |
| report_comments   | Admin feedback on reports          | CASCADE delete with report                              |
| monthly_summaries | Cross-unit AI summaries            | One row per month (admin-read only)                     |
| notification_log  | Sent reminder audit trail          | UNIQUE(unit_id, month, reminder_sequence)               |

## **9.1 RLS Policy Summary**

| **Table**         | **unit_head Access**               | **admin Access**          |
| ----------------- | ---------------------------------- | ------------------------- |
| reports           | SELECT/INSERT/UPDATE own unit only | Full SELECT; no delete    |
| monthly_summaries | No access                          | Full SELECT/INSERT/UPDATE |
| profiles          | SELECT own row only                | SELECT all rows           |
| units             | SELECT own unit only               | Full CRUD                 |
| report_deadlines  | No access                          | Full CRUD                 |
| notification_log  | No access                          | Full SELECT               |

# **10\. Technical Stack**

## **10.1 Frontend**

| **Concern**      | **Technology**                                               |
| ---------------- | ------------------------------------------------------------ |
| Framework        | React 18 + Vite (TypeScript)                                 |
| Styling          | Tailwind CSS + Shadcn/UI (configured for Vite)               |
| Routing          | React Router v6 with protected route wrappers                |
| Server State     | TanStack Query (React Query) - all data fetching and caching |
| Auth Client      | Supabase JS Client (session management only)                 |
| Rich Text Editor | @uiw/react-md-editor (Markdown with toolbar)                 |
| File Preview     | react-pdf (PDF preview in slide-over)                        |
| MD Rendering     | react-markdown + remark-gfm                                  |
| Deployment       | Vercel (static build via vite build)                         |

## **10.2 Backend**

| **Concern**  | **Technology**                                                    |
| ------------ | ----------------------------------------------------------------- |
| Runtime      | Node.js 20, TypeScript                                            |
| Framework    | Express.js                                                        |
| Database     | Supabase (PostgreSQL + Supabase Storage)                          |
| Auth Server  | Supabase Admin SDK - JWT verification on every protected route    |
| AI           | Anthropic Claude API (claude-sonnet-4-6)                          |
| PDF Parsing  | pdf-parse (npm)                                                   |
| DOCX Parsing | mammoth (npm)                                                     |
| Email        | Resend Node SDK                                                   |
| Telegram     | node-telegram-bot-api                                             |
| Scheduler    | node-cron (daily 08:00 WAT - persistent process, not serverless)  |
| PDF Export   | pdfkit or puppeteer                                               |
| DOCX Export  | docx (npm)                                                        |
| Deployment   | Railway or Render (always-on Node process required for node-cron) |

# **11\. Non-Functional Requirements**

## **11.1 Security**

- All backend routes are protected by Supabase JWT verification; the service role key is never exposed to the frontend.
- Role enforcement is applied at both the API middleware layer and the database RLS layer.
- Temporary passwords are cryptographically random (16-character alphanumeric).
- Temporary passwords are invalidated immediately upon first-login password change.
- The Telegram bot webhook is verified by a webhook secret header.
- All destructive admin actions require a confirmation modal.

## **11.2 Performance**

- AI summarisation is fully asynchronous; the UI never blocks on AI completion.
- TanStack Query is used for all data fetching with background refetching to keep data fresh.
- The settings page polls ai_status every 5 seconds during processing.
- Trend analysis is lazy-loaded on demand, not at page load.

## **11.3 Reliability**

- Unit and user creation is atomic - the entire operation rolls back on any step failure.
- Notification deduplication is enforced at the database level (unique constraint on notification_log).
- AI failure states are handled gracefully; raw reports remain accessible when summarisation fails.
- File extraction failure prompts the user clearly without corrupting the report record.

## **11.4 Usability & Accessibility**

- Fully responsive: complete functionality on screens ≥ 375px wide.
- Sidebar navigation collapses to a bottom tab bar on mobile.
- Empty states are instructional and action-oriented - never plain 'No data'.
- AI processing is shown via shimmer skeleton loaders (not plain spinners).
- Frozen units are visually distinct: greyed card with padlock icon and tooltip.
- Reduced motion preferences are respected.
- All interactive elements have visible keyboard focus styles.

# **12\. Edge Cases & Error Handling**

| **Scenario**                                   | **Expected Behaviour**                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Unit head submits file AND fills text          | Inline validation error; must clear one before proceeding.                                    |
| AI summarisation fails                         | ai_status = 'failed'; 'Summary unavailable' shown with Retry; raw report accessible.          |
| Admin modifies deadline after Reminder 1       | Deadline input is disabled; tooltip explains why.                                             |
| No deadline row exists for current month       | System auto-computes first Saturday of following month; admin sees computed date in settings. |
| Admin tries to suspend/demote themselves       | UI blocks the action with a clear error message.                                              |
| Super admin targeted for suspension/delete     | Action buttons absent from their row in user management.                                      |
| Unit head resubmits before deadline            | Existing record updated in-place; no version history shown.                                   |
| Unit head resubmits after deadline             | Old record archived; new record inserted with is_late = true; both shown in slide-over.       |
| Unit head's first submission is after deadline | Single record inserted with is_late = true; amber badge displayed.                            |
| Telegram link code expires                     | 'Regenerate Code' button appears; old code is invalidated.                                    |
| Unit is frozen (pending new unit head)         | Admins can view historical reports; no submission controls shown.                             |
| All units submit on time (leaderboard tie)     | Tiebreaker activates using average submission lead time relative to deadline.                 |
| Admin exports month with zero submissions      | Document generates with 'No report submitted' notice per unit.                                |
| Uploaded file is corrupted / unreadable        | Extraction fails gracefully; unit head prompted to re-upload or use text editor.              |
| New unit head logs in (post unit-head change)  | Onboarding intercepts login; unit activates only after Steps 1 and 2 complete.                |

# **13\. Out of Scope (Version 1.0)**

- Public-facing church website or announcement pages.
- Report approval workflows (reports are submitted and visible; no admin approval gate).
- In-app messaging between unit heads.
- Mobile native apps (iOS / Android); the platform is web-only but mobile-responsive.
- Integration with third-party church management systems.
- Multi-church / multi-tenant support.
- Offline-first or PWA functionality.

# **14\. Glossary**

| **Term**           | **Definition**                                                                        |
| ------------------ | ------------------------------------------------------------------------------------- |
| Unit               | A functional group within the church (e.g. Choir, Ushers, Youth).                     |
| Unit Head          | The leader of a unit; responsible for submitting the unit's monthly report.           |
| Admin              | A church administrator with cross-unit visibility and management rights.              |
| Super Admin        | The primary admin; has additional rights to promote, demote, and delete other admins. |
| Frozen             | A unit state where no new submissions are accepted (pending active unit head).        |
| is_late            | A flag on a report record indicating it was submitted after the monthly deadline.     |
| ai_status          | The processing state of AI summarisation: pending \| processing \| done \| failed.    |
| Leaderboard        | Admin-only ranked view of units by report submission consistency and quality.         |
| Completeness Score | An AI-assigned integer (1-5) rating how thorough a submitted report is.               |
| WAT                | West Africa Time (UTC+1); the timezone used for the daily notification cron job.      |
| RLS                | Row Level Security - Supabase/PostgreSQL feature restricting data access by role.     |
| DXA                | A unit of measurement used in Word documents; 1440 DXA = 1 inch.                      |

- End of Document -
