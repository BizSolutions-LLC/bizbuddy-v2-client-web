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
├── system-admin/               # Role: Internal System Admin
│   ├── layout.jsx
│   ├── login/
│   ├── dashboard/
│   ├── users/
│   ├── errors/
│   ├── security/
│   └── performance/
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
├── utils.js                    # General utilities (cn, etc.)
├── versionCheck.js             # App version check logic
└── hooks/
    └── use-mobile.js           # Mobile breakpoint detection hook
```

---

## Roles & Access

| Role | Route Prefix | Description |
|---|---|---|
| Company Admin | `/dashboard/company/` | Full HR management |
| Employee | `/dashboard/employee/` | Self-service timekeeping, leaves, payroll |
| BizBuddy Partner | `/dashboard/bizbuddy/` | Referrers and subscribers |
| System Admin | `/system-admin/` | Internal platform management |

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
