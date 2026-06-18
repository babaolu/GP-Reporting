# Grace Place Church Report Management Platform (GP-Reporting)

An enterprise-grade, role-gated monorepo portal designed to manage monthly reports across church units. This application includes role-based views, automated reminders, AI-driven report parsing & summaries, leaderboard stand, and consolidated PDF/DOCX report exports.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, React Router v6, Lucide Icons
- **Backend**: Node.js, Express, TypeScript, Supabase SDK (Admin Client), Resend SDK, Telegram Bot API, Node-Cron, PDFKit, Mammoth
- **Database & Storage**: Supabase (PostgreSQL with Row Level Security, Storage Buckets, Triggers)
- **AI Processing**: Switchable Multi-Provider (Anthropic Claude 3.5, Google Gemini 1.5, OpenRouter, Nvidia NIM)

---

## 📁 Project Directory Structure

```text
├── frontend/                   # React + Vite application
│   ├── src/
│   │   ├── components/         # Shared UI & Timeline components
│   │   ├── hooks/              # Custom React hooks (useAuth, useDeadline)
│   │   ├── lib/                # API and Supabase client SDK wrappers
│   │   ├── routes/             # Role-gated routing (Admin, Auth, Unit-Head pages)
│   │   └── index.css           # Styling with Tailwind CSS v4 directives
│   ├── tsconfig.json           # TS setup
│   └── package.json
│
├── backend/                    # Node + Express REST API
│   ├── src/
│   │   ├── jobs/               # Daily cron scheduling (Reminders & locks)
│   │   ├── middleware/         # JWT Verification & Role restriction middlewares
│   │   ├── routes/             # Express API Endpoints (Auth, Units, Reports, Exports)
│   │   ├── services/           # DB Seeding, Mail (Resend), Telegram Bot, & AI drivers
│   │   └── index.ts            # App startup entry point
│   ├── tsconfig.json           # TS setup
│   └── package.json
│
├── supabase_schema.sql         # SQL schema definitions, indexes, and RLS policies
├── .gitignore                  # Global git ignores
└── package.json                # Root workspaces configurator
```

---

## 🚀 Getting Started

### 1. Database Setup (Supabase)
1. Set up a Supabase project at [Supabase.com](https://supabase.com).
2. Copy the contents of [supabase_schema.sql](supabase_schema.sql) at the root folder.
3. Go to the **SQL Editor** in your Supabase Dashboard, paste the schema content, and click **Run**.
4. Create a public Storage bucket named `reports` inside your Supabase Storage dashboard.

### 2. Configure Environment Variables
Create `.env` configurations for both packages.

#### Backend Configuration (`backend/.env`):
```env
SUPABASE_URL=https://your-project-ref.supabase.co
# Replace with the secret "service_role" key from Settings -> API to bypass RLS for admin operations
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3000

# AI Configuration (provider: anthropic, gemini, openrouter, nvidia)
AI_PROVIDER=anthropic
AI_API_KEY=your_ai_api_key
AI_MODEL=claude-3-5-sonnet-20241022

# Email & Notification Settings
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=reports@yourdomain.org

# Telegram Bot integration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_BOT_USERNAME=your_telegram_bot_username

# Seeding Initial Super Admin Credentials
SEED_ADMIN_EMAIL=admin@graceplace.org
SEED_ADMIN_PASSWORD=AdminSecurePassword123!
```

#### Frontend Configuration (`frontend/.env`):
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_publishable_key
VITE_API_BASE_URL=http://localhost:3000/api
VITE_CHURCH_NAME="Grace Place"
```

---

## ⚡ Installation & Execution

### 1. Bootstrap dependencies
From the root directory:
```bash
npm run bootstrap
```
This runs npm install globally and propagates package dependencies into frontend and backend workspaces.

### 2. Build the packages
Verify that the full TypeScript tree compiles:
```bash
npm run build
```

### 3. Start Development Servers
To run both the frontend UI and the Express backend concurrently:
```bash
npm run dev
```

The server will automatically seed the initial Super Admin profile (`admin@graceplace.org` / `AdminSecurePassword123!`) if the profiles table is empty on startup.

---

## 🔐 Key Security Features
- **Role-Level Security (RLS)**: PostgreSQL policies on Supabase prevent unauthorized cross-tenant viewing or updates.
- **Onboarding Interceptor**: Unit Heads are restricted from visiting dashboard functions until password reset and user profiles are set up.
- **Deadline Locking**: Once the first reminder triggers 6 days before the monthly deadline, deadline overrides are locked to prevent tampering.
