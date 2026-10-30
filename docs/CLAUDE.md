# BizBuddy v2 — Project Reference (CLAUDE.md)

This file serves as the canonical reference for the BizBuddy v2 client web project structure, conventions, and architecture. Update this file whenever significant structural changes are made.

---

## Tech Stack

| Concern | Tool / Library |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | JavaScript (JSX) — no TypeScript |
| Styling | Tailwind CSS 3 + Emotion |
| UI Components | shadcn/ui + Radix UI + HeroUI |
| State Management | Zustand 5 |
| Auth | JWT (`jwt-decode`) + Zustand persist (localStorage) |
| Charts | Chart.js + Recharts |
| Maps | Leaflet + React Leaflet |
| Payment | Stripe |
| Export | jsPDF + jspdf-autotable + XLSX + PapaParse |
| Real-time | Socket.io client |
| Notifications | Sonner + React Hot Toast |
| Icons | Lucide React + React Icons |
| HTTP | Axios |
| Date/Time | date-fns + date-fns-tz + React DatePicker |
| Animation | Framer Motion |

---

## Folder Structure

```
bizbuddy-v2-client-web/
├── app/                        # Next.js App Router
├── components/                 # React components
├── lib/                        # Utilities and services
├── store/                      # Zustand state stores
├── public/                     # Static assets
├── .env                        # Environment variables
├── next.config.mjs             # Next.js config (strict mode off)
├── tailwind.config.js          # Tailwind + dark mode (class-based)
├── jsconfig.json               # Path alias: @/ -> project root
└── components.json             # shadcn/ui config (new-york style, JSX)
```

---

## App Router — Pages

Route groups `(name)/` are used for logical organization without affecting URL paths.

```
app/
├── layout.jsx                  # Root layout with ThemeProvider
├── page.jsx                    # Landing page (public)
├── globals.css
│
├── (home)/                     # Public informational pages
│   ├── account-deletion/
│   ├── contact/
│   ├── faq/
│   ├── pricing/
│   ├── privacy-policy/
│   └── terms/
│
├── (auth)/                     # Authentication flows
│   ├── sign-in/
│   ├── sign-up/
│   ├── payment/
│   └── reset-password/confirm/
│
├── dashboard/                  # Protected app — all roles
│   ├── layout.jsx
│   ├── page.jsx
│   ├── DashboardLayoutClient.jsx
│   ├── DashboardHomeClient.jsx
│   ├── DashboardSkeleton.jsx
│   │
│   ├── company/                # Role: Company Admin
│   │   ├── (Locations)/locations/
│   │   ├── (Organizations&People)/
│   │   │   ├── departments/
│   │   │   ├── employees/
│   │   │   └── employee-deletion/
│   │   ├── (Payroll)/payroll/
│   │   ├── (PunchLogs&Overtimes&Leaves)/
│   │   │   ├── punch-logs/
│   │   │   ├── overtime-requests/
│   │   │   └── leave-requests/
│   │   ├── (Shifts&Schedules)/
│   │   │   ├── shifts/
│   │   │   └── schedules/
│   │   ├── (Settings)/
│   │   │   ├── profile/
│   │   │   ├── subscription/
│   │   │   ├── configurations/
│   │   │   ├── leave-settings/
│   │   │   └── deletion/
│   │   ├── contest-requests/
│   │   ├── cutoff-periods/[id]/review/
│   │   ├── employee-schedules/
│   │   └── notifications/
│   │
│   ├── employee/               # Role: Employee (self-service)
│   │   ├── (A_Overview)/overview/
│   │   ├── (B_Profile)/
│   │   │   ├── employment-details/
│   │   │   └── personal-employment-identifications/
│   │   ├── (C_TimeKeeping)/
│   │   │   ├── punch/
│   │   │   ├── punch-logs/
│   │   │   ├── schedule/
│   │   │   ├── overtime/
│   │   │   └── contest-time-logs/
│   │   ├── (D_Leaves)/leave-logs/
│   │   └── (E_Payroll)/
│   │       ├── payroll/
│   │       └── payslip/
│   │
│   ├── bizbuddy/               # Role: BizBuddy Partner
│   │   ├── (Referrers)/referrers/
│   │   └── (Subscribers)/subscribers/
│   │
│   ├── referral/(Referral)/referral/
│   ├── user/settings/
│   └── notifications/
│
├── system-admin/               # Role: Internal System Admin (per-person accounts + 2FA, BB-110)
│   ├── layout.jsx              # Session check via /auth/verify, SystemAdminProvider
│   ├── login/                  # Password → 2FA setup (QR) / code → recovery codes
│   ├── dashboard/
│   ├── performance/
│   ├── errors/
│   ├── bbuddy/                 # B. Buddy: activity, summary, companies, support staff, admin activity
│   ├── database/               # Read-only database overview + cleanup preview
│   ├── account/                # My account: change password, recovery codes
│   ├── admins/                 # System Admins (owners only)
│   ├── users/                  # User Activity analytics (BB-112)
│   ├── security/               # Security Monitor — graded signals (BB-112)
│   ├── requests/               # Request Logs, opened from "View requests" (BB-112)
│   └── server/                 # Live Server — health + live log (BB-112)
│
└── api/
    └── contact/route.js        # Contact form POST handler
```

---

## Components

```
components/
├── ui/                         # shadcn/Radix base primitives (26 components)
│   └── (accordion, alert, avatar, badge, button, calendar, card,
│       checkbox, dialog, dropdown-menu, input, label, popover,
│       progress, scroll-area, select, separator, sheet, sidebar,
│       skeleton, sonner, table, textarea, tooltip, confirmation-modal)
│
├── common/                     # Shared feature components (12 files)
│   ├── DataTable.jsx           # Primary reusable table
│   ├── FormDialog.jsx          # Reusable form modal
│   ├── NotificationBell.jsx    # Real-time notification bell
│   ├── LocationGuard.jsx       # Location-based access control
│   ├── ConfirmDeleteDialog.jsx
│   ├── ColumnSelector.jsx
│   ├── MultiSelect.jsx
│   ├── DeleteBtn.jsx
│   ├── EditBtn.jsx
│   ├── IconBtn.jsx
│   ├── Spinner.jsx
│   └── TableSkeleton.jsx
│
├── Dashboard/
│   ├── sidebar.jsx             # Main navigation sidebar
│   ├── PageLoader.jsx
│   └── DashboardContent/
│       ├── CompanyPanel/       # All company admin UI
│       │   ├── Locations/
│       │   ├── Organizations&People/
│       │   ├── Punchlogs&Overtimes&Leaves/
│       │   ├── Shifts&Schedules/
│       │   └── Settings/
│       │       └── UpgradeSubscription/
│       ├── EmployeePanel/      # All employee UI
│       │   ├── Overview/
│       │   ├── Profile/
│       │   ├── TimeKeeping/
│       │   ├── Leaves/
│       │   └── Payroll/
│       ├── BizBuddyPanel/      # Partner/referrer UI
│       └── Others/
│
├── Home/                       # Landing page sections (11 files)
│   └── (LandingHero, KeyFeatures, Accordion, Testimonials,
│       TrustedPartners, DataDisplay, PrivacyPolicy, Terms,
│       Contact, BizChat, FeaturesIcon)
│
├── Partial/
│   ├── Navbar/
│   └── Footer.jsx
│
├── system-admin/               # System-admin dashboard UI (BB-110)
│   ├── SystemAdminNav.jsx      # One-row nav, More menu, account menu
│   ├── SystemAdminContext.jsx  # Signed-in admin (useSystemAdmin)
│   ├── RecoveryCodes.jsx       # "Save your recovery codes" screen
│   ├── TokenDialog.jsx         # View token dialog
│   ├── ScreenshotButton.jsx
│   ├── shared.jsx              # useSystemAdminSection, SectionCard, formatters, useCompanyOptions, polling hooks
│   ├── activity/               # User Activity sections (BB-112)
│   ├── performance/            # Performance tabs: Capacity (cards, band scales, charts, hotspots), Endpoints (BB-112), Reports (BB-113)
│   ├── bbuddy/                 # B. Buddy page tabs, Add company drawer (BB-107) + api.js
│   ├── database/               # Database page sections + shared.jsx
│   └── server/                 # Live Server HealthCard + LogPanel (BB-112)
│
├── Theme/ThemeProvider.jsx     # next-themes dark mode provider
├── DateTimePicker.jsx
├── LoadingScreen.jsx
└── VersionCheck.jsx
```

---

## State Management

**Single store:** `store/useAuthStore.js` (Zustand)

- Stores JWT token in localStorage via `zustand/middleware` persist
- Exposes `user` as a computed getter that decodes the JWT
- Key methods: `login(token)`, `logout()`
- `isHydrated` flag prevents SSR mismatch

No Redux or Context API used. Zustand is the sole global state solution.

---

## Lib / Utilities

```
lib/
├── auth.js                     # Auth helper functions
├── data.js                     # Data fetching / transformation
├── dateTimeFormatter.js        # Date/time formatting utilities
├── exportUtils.js              # PDF + Excel export logic (large file, ~114KB)
├── notificationApi.js          # Notification API calls
├── prisma.js                   # Prisma ORM client instance
├── socketService.js            # Socket.io connection and event handlers
├── systemAdminFetch.js         # All system-admin API calls: Bearer token, 401 → sign-in (BB-110)
├── systemAgent.js              # B. Buddy (isSystemAgent) helpers: route guard lists, 403 messages (BB-110)
├── timezones.js                # Time-zone list: Company Configurations, Add company (BB-107)
├── utils.js                    # General utilities (cn, etc.)
├── versionCheck.js             # App version check logic
└── hooks/
    ├── use-mobile.js           # Mobile breakpoint detection hook
    └── useImportTeam.js        # Bulk-import employee picker: /employee/team, active only (BB-108)
```

---

## Roles & Access

| Role | Route Prefix | Description |
|---|---|---|
| Company Admin | `/dashboard/company/` | Full HR management |
| Employee | `/dashboard/employee/` | Self-service timekeeping, leaves, payroll |
| BizBuddy Partner | `/dashboard/bizbuddy/` | Referrers and subscribers |
| System Admin | `/system-admin/` | Internal platform management (separate sign-in, see below) |

---

## System Admin dashboard

A separate app under `/system-admin/*` for BizBuddy staff. It doesn't use `useAuthStore` or the dashboard sidebar, and the public navbar is hidden on `/system-admin/*`.

**Sign-in and session (BB-110)**
- `/system-admin/login`: username + password → 2FA (first time: QR setup with `qrcode.react`, drawn locally) → 6-digit code or a recovery code → "Save your recovery codes" screen (`RecoveryCodes.jsx`) when new ones are issued.
- The session token issued at the end of sign-in lives in `localStorage["system-admin-token"]` and is sent as a **Bearer** header. The server's cookie is `sameSite=strict`, so it can't be relied on across domains.
- `app/system-admin/layout.jsx` calls `GET /auth/verify` on every page except login and puts the admin (`{ id, username, name, isOwner, twoFactorEnabled, … }`) in `SystemAdminContext` → `useSystemAdmin()`.
- **Every call goes through `lib/systemAdminFetch.js`.** It adds the token, drops empty query values, and throws `SystemAdminError { status, code, data }`. A 401 **without** a `code` means the session is gone (logged out, expired, deactivated, 2FA reset): it clears the token and sends the admin to sign-in. Coded 401s (wrong password / code) are answers for the page to show.
- **Owners vs admins:** `isOwner` gates the System Admins page (`/admins`) and picking other admins in Admin activity. Everyone has My account (password, recovery codes).

**Pages** (nav: `components/system-admin/SystemAdminNav.jsx`, one row; less-used pages under **More**; account menu holds My account, System Admins (owners), View token, Sign out)

| Route | What it is |
|---|---|
| `dashboard` | Overview |
| `users` | User Activity analytics (BB-112) |
| `security` | Security Monitor: graded signals, "View requests" → Request Logs (BB-112) |
| `bbuddy` | B. Buddy: Activity (Refresh / Live), Summary, Companies (Add company, Set up B. Buddy, retired companies — BB-107), Staff, Admin activity. One Refresh in the tab row reloads the open tab |
| `performance` | Capacity (BB-112: OK / Watch / Upgrade verdicts for the API server, database and busiest endpoints, band scales from the server's thresholds, coverage + plans banner, history charts, hotspots table), Endpoints (per-endpoint response times) and Reports (BB-113: Baseline + 30-day period PDFs via `systemAdminDownload`) |
| `errors` | API error logs |
| `database` | Read-only database overview + cleanup preview |
| `requests` | Request Logs (opened with filters from Security) |
| `server` | Live Server: health card + live log tail (BB-112) |
| `account`, `admins` | My account; System Admins (owners only) |

**Shared helpers** (`components/system-admin/shared.jsx`): `useSystemAdminSection(path, query)` (load + retry state), `SectionCard`, `SortHeader`, `formatNumber` / `formatBytes` / `relativeTime` / `formatDay` / `formatDateTime`, `useCompanyOptions()`, `formatDuration` ("4.8 s"), and the polling pair `usePageVisible()` (stop polling while the tab is hidden) + `useRateLimitPause()` (hold polling for a minute after a 429).

**Server-cached analytics (BB-114):** the analytics endpoints (`overview`, `trends`, `performance`, `errors`, `activity/*`, `security/signals`, `capacity`, `capacity/history`, …) return an optional top-level `cache: { hit, cachedAt, expiresAt }`. `useSystemAdminSection` keeps it as `section.cache` and adds `refresh()` (sends `refresh=1`; only for an explicit Refresh tap — `reload()`, Retry and polls never force it). `SectionCard` shows `CacheStamp` ("As of 10:42 AM · 3 minutes ago") from `section.cache.cachedAt` (`asOf={false}` hides it). Helpers: `oldestCachedAt(...caches)` (cards built from several endpoints), `latestExpiresAt(...caches)` (schedule polls), `useRefreshLocked(cachedAt)` (Refresh disabled 30 s after `cachedAt`, the server ignores it then). The dashboard polls at the latest `expiresAt` + 2 s, not on a fixed timer.

**Conventions:** admin pages are light-only; status colour is restrained (neutral badges, red only for real errors); polling is opt-in (Live toggles, Live Server) and always pauses when hidden. The B. Buddy page's calls go through `bbuddyFetch` in `components/system-admin/bbuddy/api.js` (`systemAdminFetch` scoped to `/api/system-admin/bbuddy`).

---

## B. Buddy (support accounts)

B. Buddy is a hidden `admin` account in each company that BizBuddy support staff sign in to (BB-110).
- **Sign-in** (`app/(auth)/sign-in/page.jsx`): the shared B. Buddy login, then a third step for the staff member's **code + PIN** (`agentCode` / `agentPin`), so actions are recorded per person. Each staff member is assigned to **one company**.
- **Company panel only:** the login token carries `isSystemAgent: true`. `lib/systemAgent.js` holds the route guard lists (`isBlockedForSystemAgent`), the landing route (`SYSTEM_AGENT_HOME`, Company → Employees) and friendly messages for the server's `SYSTEM_AGENT_*` / `AGENT_*` 403 codes (`getSystemAgentErrorMessage`). The server enforces all of this; the client keeps the UI in line.
- The user menu shows a small **Support** badge; the internal `bbuddy-<companyId>` username is never shown.
- Managed from the system-admin B. Buddy page: staff (codes, PINs, company), per-company setup, and an activity audit.

---

## Bulk uploads (CSV)

| Feature | Component | Endpoints | Flow |
|---|---|---|---|
| Upload Schedule (BB-103) | `Shifts&Schedules/UploadWeeklySchedule.jsx` | `/api/schedule-import/{template, preview, confirm}` | Pick mode (shifts / time blocks), dates (≤ 14 days) and employees → pre-filled template → mark slots → preview → one decision per item → confirm |
| Import Punch Logs (BB-077, BB-108) | `Punchlogs&Overtimes&Leaves/ImportPunchLogs.jsx` | `/api/punch-log-import/{template, upload}` | Pick dates (≤ 31 days) and employees → pre-filled template → type clockIn / clockOut → upload once → 207 results (created / failed / blank rows skipped) |
| Backtrack import | `Punchlogs&Overtimes&Leaves/ImportBacktrackPunchLogs.jsx` | `/api/backtrack-punch-log-import/{preview, confirm}` | Reads the **PadPro export** as-is (no template) → preview → confirm |
| Employees bulk import | `Organizations&People/Employees.jsx` | `POST /api/employee/bulk` | Sample CSV built on the client → parsed on the client (PapaParse) → up to 100 people per file |

**Shared rules**
- **Templates come from the server**, pre-filled with one row per employee × date, so admins never look up IDs. The server owns columns, limits and validation; the client mirrors limits only for early feedback (row counts, range caps). Employees bulk import is the exception: its sample CSV is a client constant.
- **Match by email**, never by name. `name` columns are for reading only. `employeeId` is still accepted for older files.
- **Guide row (BB-108 follow-up):** the first row under the header shows each column's format and allowed values. Its first cell starts with `#` (`# GUIDE - not imported`), and **any `#` row is ignored on upload** — on the server for schedules and punch logs, in `Employees.jsx` for employee imports. Never put a real-looking example person in a template: it gets imported if left in.
- **Company type matters:** BNC punch logs take `REGULAR` or `TRAINING` only; DayCare (PadPro) also `DRIVER_AIDE`, `DRIVER_AIDE_AM`, `DRIVER_AIDE_PM`. Blank = `REGULAR`.
- **Files:** `.csv` only, 5 MB max. Dates `YYYY-MM-DD` (punch logs also accept `M/D/YY`, `M/D/YYYY`, `MM/DD/YY`, `MM/DD/YYYY`). Punch times: `08:00`, `8:00 AM`, `8:00:00 AM` (Excel's usual), `8 AM` and similar, read in the company's time zone; a clock-out earlier than the clock-in is the next day.
- **Row numbers are file line numbers** (header = line 1). Guide rows don't count towards row limits; a file with only guide rows is a 400.
- **Partial success is a 207.** Show created / failed per row with the server's reason and the real line number in the file. Whole-file problems (bad headers, row caps) come back as 400 with a `message`.
- **Who can be picked:** the import dialogs load `GET /api/employee/team` themselves (`lib/hooks/useImportTeam.js`), active only. Admins get the whole company; supervisors get their **team**: own department plus direct reports (`EmploymentDetail.supervisorId`) in any department. That's the same rule the server checks; anyone else is a 403. Don't feed the pickers from `/api/employee?all=1` (whole company for every role).
- **Template downloads:** only a 200 is the CSV. Anything else is JSON `{ message }`; show it in the dialog (under Download), not in a toast behind it. For "everyone", leave `departmentId` out.

---

## Conventions

- **Path alias:** `@/` resolves to the project root. Use for all imports.
- **Component files:** `.jsx` (not `.tsx`). No TypeScript.
- **Styling:** Tailwind utility classes. Use `cn()` from `lib/utils.js` for conditional classes.
- **Dark mode:** Class-based via next-themes. Use Tailwind `dark:` variants.
- **Route groups:** Use `(GroupName)/` folders to organize related routes without affecting URLs.
- **No strict mode:** `reactStrictMode: false` in `next.config.mjs`.
- **Icons:** Prefer Lucide React. React Icons as secondary.
- **Toasts:** Use Sonner (`components/ui/sonner.jsx`) for notifications.
- **Tables:** Use `components/common/DataTable.jsx` as the standard table component.
- **Modals/Dialogs:** Use `components/common/FormDialog.jsx` as the standard dialog wrapper.
- **Exports:** All PDF/Excel logic goes through `lib/exportUtils.js`.

---

## Scripts

```bash
npm run dev       # Development with Turbopack
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint
```

---

## Notes

- The app communicates with an **external backend API** via Axios. There is minimal Next.js API route usage (only `app/api/contact/route.js`).
- Real-time features use **Socket.io** (`lib/socketService.js`).
- `public/bizbuddy.apk` (~80MB) is the companion Android app bundled in the public folder.
- `lib/exportUtils.js` is a large file — be careful when editing to avoid regressions in PDF/Excel exports.
