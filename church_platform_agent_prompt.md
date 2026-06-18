# Church Unit Report Management Platform — Agent Build Prompt

## Project Overview

Build a full-stack web application for a church that enables unit heads to submit monthly reports and allows church admins to review, analyse, and track those reports across all units. The platform features AI-powered document parsing and summarisation, cross-unit insights, deadline-based notifications (email + Telegram), and a beautiful, intuitive dashboard for both admins and unit heads.

---

## Tech Stack

This is a **monorepo** with two separate packages: a React + Vite frontend and a Node.js + Express backend. They are deployed independently.

### Frontend
- **Framework:** React 18 + Vite, TypeScript
- **Styling:** Tailwind CSS + Shadcn/UI (via `shadcn` CLI configured for Vite)
- **Routing:** React Router v6 (client-side routing with protected route wrappers)
- **State / Server State:** TanStack Query (React Query) for all data fetching, caching, and background refetching
- **Rich Text Editor:** `@uiw/react-md-editor` (Markdown editor with toolbar)
- **File Preview:** `react-pdf` for PDF preview in the slide-over
- **Markdown Rendering:** `react-markdown` + `remark-gfm`
- **Deployment:** Vercel (static build — `vite build` output)

### Backend
- **Runtime:** Node.js 20, TypeScript
- **Framework:** Express.js
- **Database & Storage:** Supabase (PostgreSQL + Supabase Storage)
- **Authentication:** Supabase Auth — JWTs verified server-side using the Supabase Admin SDK; frontend uses the Supabase JS client for login/session management
- **AI Layer:** Anthropic Claude API (`claude-sonnet-4-6`)
- **Document Parsing:** `pdf-parse` (PDF), `mammoth` (DOCX), plain text (Markdown)
- **Email:** Resend Node SDK
- **Telegram:** Telegram Bot API (via `node-telegram-bot-api`)
- **Scheduled Jobs:** `node-cron` running inside the Express server (daily 08:00 WAT reminder job)
- **Export:** `pdfkit` (PDF generation), `docx` npm package (Word generation)
- **Deployment:** Railway (or Render) — long-running Node process (required for `node-cron`)

---

## Roles & Permissions

There are exactly **two roles**: `admin` and `unit_head`. There is no self-registration — every account is created by an admin. One **super admin** is seeded at deployment (via environment variables); they hold the `admin` role and additionally the `is_super_admin = true` flag. The super admin has all admin capabilities plus the ability to promote, demote, suspend, or delete any other user including other admins.

### Admin
- Multiple admins may exist
- Promoted from unit head by the super admin; demoted back to unit head by the super admin
- Can view all units and all reports
- Can create, rename, and deactivate units (and the attached unit head account is created as part of unit creation)
- Can change the unit head for any unit
- Can suspend or unsuspend any user (except themselves)
- Can configure the monthly deadline (subject to lock rules — see Deadline section)
- Can view the cross-unit leaderboard (unit heads cannot)
- Can view cross-unit AI summaries and trend analysis
- Can leave feedback/comments on any submitted report
- Can export any month's full report bundle as PDF or Word (.docx)
- Can manually regenerate the cross-unit AI summary for any month

### Super Admin (admin + is_super_admin flag)
- Everything an admin can do, plus:
- Promote any unit head to admin
- Demote any admin to unit head (cannot demote themselves)
- Suspend or delete any user including other admins (cannot act on themselves)
- Is the only account that cannot be suspended or deleted through the UI

### Unit Head
- Exactly one per unit — enforced at the database level
- Account is created by an admin as part of unit creation (not by self-registration)
- Can submit and resubmit their own unit's report (see Resubmission Rules)
- Can view their own unit's 6-month report timeline
- Can view the AI summary for each of their own submitted reports
- Receives deadline reminder notifications (email + Telegram)
- Cannot see other units' reports, the leaderboard, or cross-unit summaries

---

## User & Unit Lifecycle

### Creating a Unit (Admin Action)

When an admin creates a new unit, both the unit and the unit head account are created together in a single flow:

1. Admin provides: Unit Name, Unit Description, Unit Head Email
2. System actions (all atomic — roll back entirely on any failure):
   - Creates the `units` row with `status = 'frozen'`
   - Generates a secure random temporary password (16-character alphanumeric)
   - Creates a Supabase Auth user for the unit head with the provided email and temporary password
   - Creates the `profiles` row linked to the unit with `account_status = 'pending'`, `is_first_login = true`
   - Sends a welcome email to the unit head containing their temporary password and the login URL
3. The unit remains `frozen` and no report submission is possible until the unit head completes first-login onboarding

### First-Login Onboarding (Unit Head)

When a unit head logs in for the first time (`is_first_login = true`), they are intercepted by a mandatory full-screen onboarding flow before they can access any dashboard page:

**Step 1 — Change Password**
- Must set a new password (the temporary password is invalidated immediately upon submission)
- Password must meet minimum strength requirements (8+ chars, at least one number and one special character)

**Step 2 — Complete Profile**
- Full Name (required)
- Phone Number (required)
- Profile photo upload (optional)

**Step 3 — Link Telegram (optional but strongly encouraged)**
- Display instructions and a one-time 6-digit code (expires in 10 minutes, regeneratable)
- User is told: "Send this code to @YourChurchBot on Telegram"
- A "Skip for now" option is available; they can link later from Settings

On successful completion of Steps 1 and 2:
- `is_first_login` is set to `false`, `account_status` set to `'active'`
- The unit's `status` is set to `'active'`
- Unit head is redirected to their dashboard

### Changing the Unit Head (Admin Action)

An admin clicks "Change Unit Head" on a unit's detail page:

1. Admin is shown a warning modal: "This will permanently delete [Name]'s account. The unit will be frozen until the new unit head completes onboarding. All unit history and reports are preserved."
2. Admin enters the new unit head's email and confirms
3. On confirmation:
   - The old unit head's Supabase Auth account and `profiles` row are permanently deleted
   - A new auth account and profile are created for the new unit head (same flow as unit creation — temporary password + welcome email)
   - The unit's `status` is set back to `'frozen'`
   - All historical reports, AI summaries, comments, and data for the unit are fully preserved
4. The unit becomes `active` again only after the new unit head completes first-login onboarding (Steps 1 and 2 above)

### Suspending a User (Admin Action)

- Admins can suspend any unit head, or any other admin (but not themselves, and not the super admin)
- A suspended unit head cannot log in; their unit is set to `frozen` (data is readable by admins, but no new submissions are possible)
- A suspended admin loses all dashboard access
- Suspension is reversible — an admin can unsuspend from the User Management panel
- When a suspended unit head is unsuspended, their unit's status returns to `active` (assuming they had completed onboarding)

---

## Database Schema (Supabase)

```sql
-- Church units
units (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text,
  status       text NOT NULL DEFAULT 'frozen'
                 CHECK (status IN ('active', 'frozen', 'deactivated')),
  created_at   timestamptz DEFAULT now()
)

-- User profiles (extends Supabase auth.users)
profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name        text,
  role             text NOT NULL CHECK (role IN ('admin', 'unit_head')),
  is_super_admin   boolean NOT NULL DEFAULT false,
  unit_id          uuid REFERENCES units(id),   -- NULL for admins
  email            text NOT NULL,
  phone_number     text,
  avatar_url       text,
  account_status   text NOT NULL DEFAULT 'pending'
                     CHECK (account_status IN ('pending', 'active', 'suspended')),
  is_first_login   boolean NOT NULL DEFAULT true,
  telegram_chat_id text,
  telegram_linked  boolean NOT NULL DEFAULT false,
  created_at       timestamptz DEFAULT now()
)

-- Monthly deadlines (admin-configurable)
-- One row per reporting month. The system auto-computes the default deadline
-- (first Saturday of the following month) when a unit is created or at month start.
-- Admins may override the deadline_date via the dashboard until the first reminder is sent.
report_deadlines (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month                date NOT NULL,          -- always the 1st of the reporting month
  deadline_date        date NOT NULL,          -- default: first Saturday of the following month
  first_reminder_sent  boolean NOT NULL DEFAULT false,  -- true = deadline is now locked
  created_by           uuid REFERENCES profiles(id),
  created_at           timestamptz DEFAULT now(),
  UNIQUE (month)
)

-- Reports
-- Before deadline: resubmission replaces the existing record (version stays 1, submitted_at updated).
-- After deadline:  resubmission archives the existing record (is_latest = false, version incremented)
--                  and inserts a new row (is_latest = true, is_late = true).
reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       uuid NOT NULL REFERENCES units(id),
  submitted_by  uuid NOT NULL REFERENCES profiles(id),
  month         date NOT NULL,         -- first day of the reporting month
  content_text  text,                  -- populated if submitted via text editor
  file_url      text,                  -- Supabase Storage path (populated if file upload)
  file_type     text CHECK (file_type IN ('pdf', 'docx', 'md', 'text')),
  is_late       boolean NOT NULL DEFAULT false,
  version       integer NOT NULL DEFAULT 1,
  is_latest     boolean NOT NULL DEFAULT true,
  parsed_text   text,                  -- raw text extracted from document
  ai_summary    jsonb,                 -- { summary, breakthroughs, issues, progress,
                                       --   critical_alerts, completeness_score }
  ai_status     text NOT NULL DEFAULT 'pending'
                  CHECK (ai_status IN ('pending', 'processing', 'done', 'failed')),
  submitted_at  timestamptz DEFAULT now(),
  UNIQUE (unit_id, month, version)
)

-- Admin comments/feedback on a report (tied to the specific report version)
report_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES profiles(id),
  comment     text NOT NULL,
  created_at  timestamptz DEFAULT now()
)

-- Cross-unit monthly AI summary (admin-only read)
monthly_summaries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month                date NOT NULL UNIQUE,
  overall_summary      text,
  common_issues        jsonb,
  common_breakthroughs jsonb,
  critical_alerts      jsonb,
  cross_unit_themes    jsonb,
  unit_highlights      jsonb,   -- [{ unit_id, unit_name, highlight }]
  generated_at         timestamptz,
  ai_status            text DEFAULT 'pending'
                         CHECK (ai_status IN ('pending', 'processing', 'done', 'failed'))
)

-- Notification log (prevents duplicate sends per unit per month per reminder sequence)
notification_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id           uuid NOT NULL REFERENCES units(id),
  month             date NOT NULL,
  reminder_sequence integer NOT NULL CHECK (reminder_sequence IN (1, 2, 3)),
  email_sent        boolean DEFAULT false,
  telegram_sent     boolean DEFAULT false,
  sent_at           timestamptz DEFAULT now(),
  UNIQUE (unit_id, month, reminder_sequence)
)
```

**Row Level Security (RLS) policies:**
- `unit_head` role: SELECT/INSERT/UPDATE on `reports` where `unit_id = their own unit_id`. No access to other units' rows, `monthly_summaries`, or `leaderboard`-related queries.
- `admin` role: Full SELECT on all tables. INSERT/UPDATE/DELETE on `units`, `profiles`, `report_deadlines`, `monthly_summaries`. INSERT on `report_comments`.
- `profiles`: every authenticated user can SELECT their own row; admins can SELECT all rows.
- Supabase Service Role key (used in server-side API routes only) bypasses RLS for system operations like user creation and notification dispatch.

---

## Deadline Logic

### Default Deadline
For each reporting month, the default deadline is the **first Saturday of the following month**. For example, for the month of June, the deadline defaults to the first Saturday in July.

The system auto-creates a `report_deadlines` row for each month on the first day of that month if one does not already exist (via the daily cron job). Admins may override the `deadline_date` from the admin dashboard using a dropdown calendar picker — but **only before the first reminder has been sent** (`first_reminder_sent = false`). Once `first_reminder_sent` is set to `true`, the deadline input is disabled and shows a tooltip: "The deadline can no longer be changed because the first reminder has already been sent."

### Reminder Schedule
Reminders are sent on three occasions, working backwards from the deadline:

| Reminder | Sent on                            |
|----------|------------------------------------|
| 1st      | deadline_date − 6 days             |
| 2nd      | deadline_date − 3 days (i.e., 3 days after Reminder 1) |
| 3rd      | deadline_date − 1 day  (i.e., 2 days after Reminder 2) |

This produces gaps of **3 days → 2 days → 1 day** as specified.

Sending Reminder 1 locks the deadline and sets `first_reminder_sent = true`.

Reminders are only sent to unit heads whose unit has **not yet submitted** a report for that month. Units that have already submitted are skipped. A notification is never sent twice for the same unit + month + sequence (enforced by the `UNIQUE` constraint on `notification_log`).

### Cron Job
- Runs daily at **08:00 WAT (UTC+1)**
- For the current month's deadline row, computes which reminder sequence should fire today (if any)
- For each active unit without a report for that month, sends email + Telegram (if linked)
- After firing Reminder 1, sets `first_reminder_sent = true` on the deadline row
- Endpoint: `GET /api/cron/reminders` — protected by `Authorization: Bearer {CRON_SECRET}` header

---

## Report Submission & Resubmission Rules

### Submission
- A unit head may submit a report for the **current reporting month** only
- They may submit via **file upload** (`.pdf`, `.docx`, `.md`) OR via the **text editor** — not both simultaneously
- If both a file and text are present when they click Submit, show an inline validation error and require them to clear one before proceeding

### Before-Deadline Resubmission (Silent Replace)
- If a report already exists for that unit and month and the deadline has **not** passed:
  - The existing report row is **updated in-place**: `content_text` / `file_url`, `parsed_text`, `ai_summary`, `ai_status`, and `submitted_at` are overwritten
  - `version` stays at 1, `is_late` stays `false`
  - No version history is created or shown
  - The unit head sees a confirmation: "Your report has been updated."

### After-Deadline Resubmission (Archived + Flagged)
- If a report already exists and the deadline **has** passed:
  - The existing row: `is_latest` is set to `false`
  - A new row is inserted: `version = previous_version + 1`, `is_latest = true`, `is_late = true`
  - Both versions are visible in the unit head's report slide-over under "Submission History" (labelled "Original" and "Revision 1", etc.)
  - The late flag is displayed prominently (amber badge) on the timeline node and in the admin's view
- If no report existed before the deadline and the unit head submits after the deadline:
  - A single row is inserted with `version = 1`, `is_late = true`
  - The same amber "Late Submission" badge applies

---

## Report Template (Guided Submission)

When a unit head opens the text editor, the following **pre-filled template** is displayed as editable placeholder content (not hardcoded — it populates the editor and the unit head can freely edit or delete any section):

```
## [Unit Name] Monthly Report — [Month Year]

### 1. Progress This Month
_Describe the activities carried out, projects advanced, and goals worked on._

### 2. Key Achievements & Breakthroughs
_Highlight any significant wins, milestones reached, or positive outcomes._

### 3. Challenges & Issues Faced
_Describe any difficulties encountered. Be specific so they can be addressed._

### 4. Critical or Urgent Matters
_Flag any issues requiring immediate attention from leadership._

### 5. Plans for Next Month
_Outline what the unit intends to focus on in the coming month._
```

A small note appears below the editor:
> "This template is a guide. You may edit or restructure it freely. A structured report helps generate better AI summaries."

---

## AI Layer (Anthropic Claude API)

All Claude calls use the model `claude-sonnet-4-6` with `max_tokens: 1500` and temperature 0. All prompts instruct the model to return **only valid JSON** — no markdown fences, no preamble.

### Per-Report Summarisation

Triggered asynchronously after text extraction completes. Sets `ai_status = 'processing'` immediately, then updates to `'done'` or `'failed'`.

**Prompt:**
```
You are an assistant to a church administrator. You have received a monthly report
from the [UNIT_NAME] department for [MONTH_YEAR].

Analyse the report and return a JSON object with exactly this structure:
{
  "summary": "2–3 sentence overview of the report",
  "breakthroughs": ["array of key achievements or positive outcomes"],
  "issues": ["array of challenges or problems reported"],
  "progress": ["array of ongoing activities or updates"],
  "critical_alerts": ["urgent matters requiring immediate leadership attention — empty array if none"],
  "completeness_score": <integer 1–5>
}

Scoring guide for completeness_score:
5 = Thorough, covers multiple sections with detail
4 = Good coverage, minor gaps
3 = Adequate but sparse in some areas
2 = Very brief or missing key sections
1 = Essentially empty or uninformative

Return only the JSON object. No markdown, no explanation.

Report text:
[EXTRACTED_TEXT]
```

Store the result in `reports.ai_summary`. On failure, set `ai_status = 'failed'` and do not leave a partial value in `ai_summary`.

### Cross-Unit Monthly Summary (Admin-only)

Triggered when the admin navigates to the Summaries page for a given month, or via the "Regenerate Summary" button. Only runs when at least one report with `ai_status = 'done'` exists for that month.

**Prompt:**
```
You are an assistant to a church administrator. Below are AI-parsed summaries of
monthly reports from all church units for [MONTH_YEAR].

Analyse across all units and return a JSON object with exactly this structure:
{
  "overall_summary": "A narrative paragraph summarising the month across all units",
  "common_issues": ["Issues mentioned by 2 or more units"],
  "common_breakthroughs": ["Achievements shared or reflected across multiple units"],
  "critical_alerts": ["Any urgent matters from any unit requiring immediate attention"],
  "cross_unit_themes": ["Notable patterns, dependencies, or recurring themes across units"],
  "unit_highlights": [{ "unit_name": "...", "highlight": "one-sentence highlight" }]
}

Return only the JSON object. No markdown, no explanation.

Unit summaries (JSON array):
[ARRAY_OF_PER_UNIT_AI_SUMMARIES]
```

### Per-Unit Trend Analysis (Admin-only)

Triggered on demand when the admin views a specific unit's detail page and clicks "View Trend Analysis". Uses the last 6 months of per-report `ai_summary` data for that unit (chronological order).

**Prompt:**
```
You are analysing the report history for the [UNIT_NAME] department of a church.
Below are AI summaries for the past [N] months in chronological order (oldest first).

Return a JSON object with exactly this structure:
{
  "trend_narrative": "A paragraph describing the unit's overall progress trajectory",
  "persisting_issues": ["Issues that appear in 2 or more consecutive months"],
  "resolved_issues": ["Issues that appeared previously but are absent in recent months"],
  "new_developments": ["Things appearing for the first time in the most recent report"],
  "momentum": "positive | neutral | concerning"
}

Return only the JSON object. No markdown, no explanation.

Monthly summaries:
[CHRONOLOGICAL_ARRAY_OF_AI_SUMMARIES_WITH_MONTH_LABELS]
```

### Document Text Extraction

Run server-side before triggering AI summarisation:
- `.pdf` → use `pdf-parse` npm package; extract full text
- `.docx` → use `mammoth` npm package; extract as plain text (not HTML)
- `.md` → read as plain text (no transformation needed)
- Text editor submissions → use `content_text` directly

Store the extracted result in `reports.parsed_text`. If extraction fails (corrupted file, password-protected PDF, etc.), set `ai_status = 'failed'` and show the unit head an error prompt: "We couldn't read your file. Please re-upload or paste your report into the text editor."

### AI Processing UI States

- `pending` → grey shimmer skeleton in the summary panel
- `processing` → animated gradient shimmer with label "Analysing report…"
- `done` → summary renders fully
- `failed` → shows an amber "Summary unavailable" notice with a Retry button (admin-only for monthly summary; unit head sees it for their own report)

---

## Leaderboard (Admin Only)

Unit heads have no visibility of the leaderboard whatsoever — it does not appear in their navigation or anywhere in their dashboard.

### Scoring

Each unit receives a **Consistency Score** calculated as:

```
base_score = (months_submitted_on_time / total_active_months) × 100
completeness_bonus = average(completeness_score) / 5 × 10   -- adds up to 10 bonus points
final_score = base_score + completeness_bonus
```

Where:
- `months_submitted_on_time` = submissions where `is_late = false`
- `total_active_months` = number of months since the unit's `status` first became `'active'`
- `completeness_score` is the integer (1–5) from the AI summary

### Tiebreaker

If two or more units share the same `final_score`, rank by **earliest average submission time relative to the deadline** (i.e., the unit that consistently submits furthest ahead of the deadline ranks higher).

### Leaderboard Display

- Top 3 units: gold / silver / bronze trophy styling
- Full ranked table below showing: Rank, Unit Name, Consistency Score, On-Time Submissions, Average Lead Time, Completeness Avg
- Current month's live status shown at the top: "X of Y units have submitted for [Month]"

---

## Notification Content

### Email (via Resend)

**Subject:** `⏰ Reminder [N/3]: Monthly Report Due in [D] Day(s) — [Month Year]`

```
Hi [Full Name],

This is your [1st / 2nd / 3rd] reminder that the monthly report for the
[Unit Name] is due on [Deadline Date, formatted as "Saturday, 5 July 2025"].

You have [D] day(s) remaining.

[→ Submit Your Report]   ← button linking to the login / submission page

If you have already submitted, please disregard this message.

Grace & Peace,
[CHURCH_NAME] Administration
```

### Telegram (via Bot API)

```
⏰ *Report Reminder [N/3]*

Hi [Full Name], your monthly report for *[Unit Name]* is due in *[D] day(s)*
(by [Deadline Date]).

👉 [Submit here: APP_URL/dashboard/unit-head/report]

If you've already submitted, ignore this. 🙏
```

### Telegram Account Linking Flow

1. Unit head goes to **Settings → Notifications → Link Telegram**
2. A 6-digit one-time code is generated and stored with a 10-minute TTL
3. UI shows: "Send this code to @[BotUsername] on Telegram to link your account."
4. The Telegram bot's webhook receives the message, finds the matching code, stores the `chat_id` in `profiles.telegram_chat_id`, and sets `telegram_linked = true`
5. The settings page polls every 5 seconds and updates to show a green "Telegram linked ✓" badge
6. If the code expires, a "Regenerate Code" button appears

---

## Admin Dashboard — Feature Detail

### Overview Page
- Headline stat: "X of Y units have submitted for [Current Month]"
- Progress bar across the top
- Grid of all unit cards showing: unit name, unit head name, submission status badge (Submitted / Pending / Late / Frozen), submitted-at time if submitted
- Critical alerts banner: if any unit's AI summary contains non-empty `critical_alerts`, they surface here with the unit name and alert text
- Shortcut button: "View This Month's Summary"

### Units Page
- Searchable, filterable grid of all units
- Each card: unit name, unit head name, status badge (Active / Frozen / Deactivated), current month submission status
- "Create Unit" button opens a slide-over form (unit name, description, unit head email)
- Clicking a unit card navigates to the Unit Detail page

### Unit Detail Page
- Unit name, description, unit head profile card (name, email, phone, Telegram status)
- "Change Unit Head" action button (with confirmation modal)
- "Deactivate Unit" action (with confirmation)
- **6-Month Timeline** (see Timeline section below)
- **Trend Analysis** panel (lazy-loaded on demand via "View Trend Analysis" button)
- Admin comment box at the bottom of each opened report view

### Monthly Reports Page
- Month picker (dropdown showing available months from the earliest unit creation date to present)
- For the selected month: table/card listing all units with columns: Unit | Unit Head | Submitted? | On Time? | Submitted At | AI Status | Actions
- Clicking a row expands an inline panel showing the full report and its AI summary
- Admin comment thread visible and editable inline
- **Export button**: "Export This Month" — opens a modal with format choice (PDF or Word .docx) and triggers export generation

### Leaderboard Page (Admin only)
- Full ranked list with trophy styling for top 3
- Month filter to see historical ranking snapshots
- Tiebreaker label shown when applicable

### Summaries & Insights Page (Admin only)
- Tabs: "This Month" | "Trend Analysis" | "Cross-Unit Themes"
- This Month: rendered cross-unit summary with colour-coded sections (breakthroughs in green, issues in amber, critical alerts in red)
- Trend Analysis: per-unit trend cards (click to expand full narrative)
- Cross-Unit Themes: issues or breakthroughs appearing in 2+ units are highlighted and grouped
- "Regenerate Summary" button at the top of "This Month" tab

### User Management Page (Admin only)
- Table of all users: Name | Email | Role | Unit | Status | Actions
- Actions per row: Suspend / Unsuspend | Promote to Admin (super admin only) / Demote to Unit Head (super admin only) | View Profile
- Super admin cannot be suspended or demoted via the UI
- An admin cannot act on their own row

### Settings Page (Admin only)
- **Deadline Configuration:** month picker + calendar date picker to set the deadline for upcoming months. Disabled if `first_reminder_sent = true` for that month.
- **Church Name:** editable, used in notification emails
- **Telegram Bot:** shows bot username and webhook status

---

## Unit Head Dashboard — Feature Detail

### Overview Page
- Welcome card: "Good morning, [Name]. Here is your [Month] report status."
- Status card: Submitted ✓ / Pending — [D] days remaining / Overdue
- Quick action: "Submit Report" or "Update Report" button
- Telegram linking prompt (if not yet linked): amber banner "Link your Telegram to receive reminders"

### Submit / Update Report Page
- Month label (locked to current month; past months are read-only)
- Two tabs: **Upload File** | **Write Report**
  - Upload tab: drag-and-drop zone accepting `.pdf`, `.docx`, `.md` with file size limit (10 MB). Shows file name and size after selection.
  - Write tab: Markdown-enabled rich text editor pre-filled with the report template (see Template section). Toolbar: Bold, Italic, Headings (H2/H3), Bullet list, Numbered list.
- Mutual exclusivity enforced: switching tabs clears the other input and shows a toast "Switched to [mode]. Previous input cleared."
- Submit / Update button with confirmation step
- If deadline has passed and a report exists: button text changes to "Submit Late Revision" and an amber warning banner explains the late submission policy

### Report History — 6-Month Timeline
- Vertical timeline showing the last 6 months (most recent at top)
- Each month node:
  - **Green circle with ✓** — submitted on time
  - **Amber circle with clock** — submitted late
  - **Red circle with ✕ (warning styling)** — no report submitted; card shows a distinct warning-coloured background with text "No report submitted for this month."
  - **Grey circle with dash** — future month (not yet open)
- Clicking a submitted node opens a slide-over with:
  - The full report text or a file preview (PDF viewer or rendered Markdown)
  - AI summary panel (structured sections: Summary, Breakthroughs, Issues, Progress, Critical Alerts)
  - Submission timestamp and late/on-time badge
  - If after-deadline resubmission exists: "Submission History" accordion showing all versions with labels ("Original", "Revision 1") and timestamps
  - Admin comments thread (read-only for the unit head)

### Settings Page (Unit Head)
- Update profile: Full Name, Phone Number, Avatar
- Change Password
- Notifications: Link / Unlink Telegram (with the one-time code flow)
- Email notification preference toggle

---

## Export Feature (Admin)

The admin can export a month's complete report bundle from the Monthly Reports page.

**On clicking Export:**
1. A modal asks: "Select export format — PDF or Word (.docx)"
2. On selection, the server generates the document server-side and returns a download URL

**Document contents:**
- Cover page: Church name, "Monthly Reports — [Month Year]", generated date
- Table of Contents
- For each unit (alphabetical order):
  - Unit name and unit head name
  - Submission status (on time / late / not submitted)
  - Full report content
  - AI Summary (structured sections)
  - Admin comments (if any)
- Final page: Cross-unit AI Summary (overall summary, common issues, breakthroughs, critical alerts)

**Libraries:**
- PDF: `pdfkit` or `puppeteer` (render an HTML template to PDF)
- DOCX: `docx` npm package (programmatic Word generation)

---

## Design System & UI

**Visual Identity:**
- Primary: Deep Indigo `#3730A3`
- Accent: Warm Gold `#D97706` (church warmth and celebration)
- Success (on time): `#16A34A`
- Warning (late submission): `#F59E0B`
- Danger (missing report / critical alert): `#DC2626`
- Frozen/neutral: `#6B7280`
- Page background: `#F8F7FF` (light lavender-white — not pure white)
- Card surface: `#FFFFFF`
- Primary text: `#1E1B4B`

**Typography:**
- Display headings: `Playfair Display` (serif — dignity, authority, church character)
- Body and UI: `Inter` (clean, highly legible)

**Signature element:**
The 6-month report timeline uses circular nodes connected by a subtle vertical spine. Each node contains an icon. On hover, the node lifts slightly with a soft shadow. Clicking a node opens a slide-over smoothly from the right. The missing-report node uses a pulsing red outline to draw attention without being alarming.

**UI principles:**
- Frozen units: greyed card with a padlock icon badge; tooltip "Awaiting new unit head"
- Empty states: instructional and action-oriented (never just "No data")
- AI processing: shimmer skeleton loaders — never plain spinners
- Destructive actions: always require a clearly worded confirmation modal
- Mobile-responsive: full functionality on screens ≥ 375px wide
- Sidebar navigation collapses to a bottom tab bar on mobile

---

## Monorepo Structure & File Layout

```
/
├── frontend/                          ← React + Vite app
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── .env                           ← VITE_ prefixed vars only
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                    ← router root, auth guards
│       ├── routes/
│       │   ├── auth/
│       │   │   ├── Login.tsx
│       │   │   ├── ForgotPassword.tsx
│       │   │   └── Onboarding.tsx     ← first-login mandatory flow
│       │   ├── admin/
│       │   │   ├── Overview.tsx
│       │   │   ├── Units.tsx
│       │   │   ├── UnitDetail.tsx
│       │   │   ├── Monthly.tsx
│       │   │   ├── Leaderboard.tsx
│       │   │   ├── Summaries.tsx
│       │   │   ├── Users.tsx
│       │   │   └── Settings.tsx
│       │   └── unit-head/
│       │       ├── Overview.tsx
│       │       ├── Report.tsx
│       │       ├── History.tsx
│       │       └── Settings.tsx
│       ├── components/
│       │   ├── ui/                    ← shadcn/ui components
│       │   ├── layout/
│       │   │   ├── AdminSidebar.tsx
│       │   │   ├── UnitHeadSidebar.tsx
│       │   │   └── MobileTabBar.tsx
│       │   ├── timeline/
│       │   │   ├── ReportTimeline.tsx
│       │   │   ├── MonthNode.tsx
│       │   │   └── ReportSlideOver.tsx
│       │   ├── reports/
│       │   │   ├── ReportForm.tsx
│       │   │   ├── ReportEditor.tsx   ← Markdown editor with template
│       │   │   ├── ReportViewer.tsx
│       │   │   ├── ReportCard.tsx
│       │   │   └── VersionHistory.tsx
│       │   ├── summaries/
│       │   │   ├── AISummaryPanel.tsx
│       │   │   ├── CrossUnitSummary.tsx
│       │   │   └── TrendCard.tsx
│       │   ├── leaderboard/
│       │   │   ├── LeaderboardTable.tsx
│       │   │   └── UnitRankCard.tsx
│       │   ├── units/
│       │   │   ├── UnitCard.tsx
│       │   │   ├── CreateUnitModal.tsx
│       │   │   ├── ChangeUnitHeadModal.tsx
│       │   │   └── FrozenUnitBanner.tsx
│       │   ├── users/
│       │   │   ├── UserTable.tsx
│       │   │   └── UserActionsMenu.tsx
│       │   ├── notifications/
│       │   │   ├── DeadlineCountdown.tsx
│       │   │   └── TelegramLinkCard.tsx
│       │   └── export/
│       │       └── ExportModal.tsx
│       ├── lib/
│       │   ├── supabase.ts            ← Supabase JS client (auth + realtime)
│       │   ├── api.ts                 ← typed fetch helpers to backend REST API
│       │   └── date-helpers.ts
│       └── hooks/
│           ├── useAuth.ts
│           ├── useDeadline.ts
│           └── useReportStatus.ts
│
└── backend/                           ← Express + Node.js API
    ├── package.json
    ├── tsconfig.json
    ├── .env
    └── src/
        ├── index.ts                   ← Express app entry; mounts routers; starts node-cron
        ├── middleware/
        │   ├── auth.ts                ← verify Supabase JWT, attach user to req
        │   ├── requireAdmin.ts
        │   └── requireSuperAdmin.ts
        ├── routes/
        │   ├── auth.ts                ← POST /auth/onboarding
        │   ├── units.ts               ← GET/POST/PATCH/DELETE /units
        │   ├── users.ts               ← GET/POST/PATCH /users (promote, demote, suspend)
        │   ├── reports.ts             ← POST /reports/submit, POST /reports/resubmit
        │   ├── parse.ts               ← POST /parse (file → raw text)
        │   ├── ai.ts                  ← POST /ai/summarize-report, /summarize-monthly, /trend
        │   ├── notifications.ts       ← POST /notifications/send
        │   ├── telegram.ts            ← POST /telegram/webhook, POST /telegram/link
        │   └── export.ts              ← POST /export/monthly
        ├── services/
        │   ├── supabase.ts            ← Supabase Admin client (service role key)
        │   ├── anthropic.ts           ← Claude API calls
        │   ├── parsers/
        │   │   ├── pdf.ts
        │   │   ├── docx.ts
        │   │   └── markdown.ts
        │   ├── email.ts               ← Resend integration
        │   ├── telegram.ts            ← Bot API integration
        │   ├── export/
        │   │   ├── pdf.ts
        │   │   └── docx.ts
        │   └── leaderboard.ts
        ├── jobs/
        │   └── reminders.ts           ← node-cron daily job (08:00 WAT)
        └── lib/
            ├── deadline.ts            ← first Saturday logic + reminder date math
            ├── password-generator.ts
            └── date-helpers.ts
```

---

## Environment Variables

### `frontend/.env`
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=             # e.g. https://your-backend.railway.app
VITE_APP_URL=                  # e.g. https://your-app.vercel.app
VITE_CHURCH_NAME=
```

### `backend/.env`
```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

ANTHROPIC_API_KEY=

RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@yourdomain.com

TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=

APP_URL=                       # frontend URL, used in notification links
CHURCH_NAME=

# Seeded on first backend start — creates the initial super admin
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=

PORT=3000
```

---

## Implementation Order (Recommended)

1. **Monorepo scaffold** — initialise `frontend/` with `npm create vite@latest` (React + TypeScript template) and `backend/` with Express + TypeScript. Configure Tailwind and Shadcn/UI for Vite. Set up `concurrently` or Turborepo at root to run both dev servers.
2. **Supabase setup** — schema, RLS policies, storage bucket (`reports/`), seed script for super admin (runs once on backend start if `profiles` table is empty)
3. **Auth & routing** — Supabase JS client in frontend for login/session; backend JWT middleware verifying Supabase tokens on every protected route; React Router protected route wrappers; first-login onboarding intercept; suspension guard
4. **Unit + user creation flow** — admin creates unit → backend creates Supabase Auth user with temp password → sends welcome email → frozen state
5. **Unit head dashboard** — 6-month timeline, submission form (file upload + Markdown editor with template), before/after deadline logic
6. **File parsing pipeline** — frontend uploads file to Supabase Storage → calls backend `/parse` → backend extracts text → queues AI summarisation → frontend polls `ai_status` → renders summary panel
7. **Admin dashboard** — overview page, units grid, unit detail with timeline and trend analysis, admin comments
8. **Monthly Reports view** — month picker, full unit table, inline report expansion, export modal (PDF + DOCX)
9. **Cross-unit AI summary** — monthly generation, cross-unit themes, critical alerts surface
10. **Leaderboard** — scoring logic, completeness bonus, tiebreaker, admin-only page
11. **Notifications** — Resend email, Telegram bot webhook + linking flow, `node-cron` reminder job with deadline lock
12. **User management** — promote, demote, suspend, unsuspend, change unit head, delete
13. **Deadline configuration** — first Saturday auto-compute, admin calendar override, lock after Reminder 1
14. **Polish** — empty states, shimmer skeletons, mobile responsiveness, error boundaries, confirmation modals, toast notifications

---

## Key Edge Cases to Handle

| Scenario | Expected Behaviour |
|---|---|
| Unit head submits file AND fills text | Inline validation error; require clearing one before submitting |
| AI summarisation fails | `ai_status = 'failed'`; show "Summary unavailable" with Retry; raw report still accessible |
| Admin tries to modify deadline after Reminder 1 sent | Deadline input is disabled; tooltip explains why |
| No deadline configured for a month | System auto-computes first Saturday of next month; admin is shown the computed date in settings |
| Admin demotes or suspends themselves | UI blocks the action with a clear error message |
| Super admin cannot be suspended or deleted | Action buttons absent from their row in user management |
| Unit head resubmits before deadline | Existing record updated in-place; no version history created |
| Unit head resubmits after deadline | Old record archived; new record inserted with `is_late = true`; both visible in slide-over |
| Telegram link code expires | "Regenerate Code" button appears; old code invalidated |
| Unit is frozen pending new unit head | Admins can still view all historical reports; no submission controls shown; unit card shows lock icon |
| All units submit on time | Leaderboard tiebreaker activates using average submission lead time |
| Admin exports month with zero submissions | Document still generates; each unit section shows "No report submitted" notice |
| File is corrupted or unreadable | Extraction fails gracefully; unit head prompted to re-upload or switch to text editor |
| Unit head submits after deadline for first time | Single record inserted with `is_late = true`; amber "Late Submission" badge displayed |
| New unit head logs in after unit head change | Onboarding flow intercepts login; unit activates only after Steps 1 and 2 complete |
```
