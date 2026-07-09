# Changelog

All notable changes to BizBuddy v2 Client Web are documented here.

---

## [v2.7.0] — 2026-03-28

### Auth

- **Sign-in migrated to POST** — replaced `GET /api/account/sign-in?email=...&password=...` (credentials exposed in URL, browser history, and server logs) with `POST /api/account/login` sending JSON body. Response shape unchanged.

---

### Performance & Bundle Size

- **`lib/exportUtils.js` split into domain modules** — the 3,561-line monolith now re-exports from seven focused files under `lib/exports/`:
  - `_shared.js` — BRANDING constants, `fetchCurrentUser`, shared helpers
  - `punchLogs.js` — `exportPunchLogsCSV`, `exportPunchLogsPDF`, `exportBoth`
  - `deletionRequests.js` — `exportDeletionRequestsCSV`, `exportDeletionRequestsPDF`
  - `contestLogs.js` — `exportContestLogsCSV`, `exportContestLogsPDF`
  - `departments.js` — `exportDepartmentsCSV`, `exportDepartmentsPDF`
  - `employees.js` — `exportEmployeesCSV`, `exportEmployeesPDF`
  - `employeePunchLogs.js` — `exportEmployeePunchLogsCSV`, `exportEmployeePunchLogsPDF`
  - `lib/exportUtils.js` retained as a re-export barrel for backward compatibility
- **Dynamic imports for all export consumers** — six components now lazy-load only their domain module on click instead of importing the full 3,561-line file at page load:
  - `Employees.jsx` → `@/lib/exports/employees`
  - `Departments.jsx` → `@/lib/exports/departments`
  - `EmployeesPunchLogs.jsx` → `@/lib/exports/employeePunchLogs`
  - `EmployeesPunchLogs.jsx` (company) → `@/lib/exports/punchLogs`
  - `employee-deletion/page.jsx` → `@/lib/exports/deletionRequests`
  - `contest-time-logs/page.jsx` → `@/lib/exports/contestLogs`
- **`jsPDF` + `jspdf-autotable` dynamic import in `Overtime.jsx`** — removed static top-level imports; both libraries now loaded with `Promise.all([import("jspdf"), import("jspdf-autotable")])` inside the async `exportPDF` handler, reducing the employee overtime page's initial JS bundle.
- **Sidebar parallel fetch** — replaced 6 sequential `useEffect` API calls with a single `Promise.allSettled` of 6 concurrent requests, reducing time-to-render for sidebar notification badges.
- **APK removed from git tracking** — `public/bizbuddy.apk` (~76 MB) untracked with `git rm --cached`. Added `*.apk` and `*.ipa` to `.gitignore` to prevent large binaries being re-committed.

---

### Reliability

- **Global Error Boundary added** — new `components/common/ErrorBoundary.jsx` (class-based React error boundary) wraps `{children}` in `DashboardLayoutClient.jsx`. Catches runtime errors in any dashboard page, shows a user-friendly recovery UI with "Try again" and "Reload page" actions. In development mode, the raw error message is printed for debugging.

---

### Bug Fixes

- **Employee Schedules stats blank** — fixed three field name mismatches between the frontend and `GET /api/usershifts/company-stats` response:
  - `stats.employeesWithShifts` → `stats.withShifts`
  - `stats.employeesWithoutShifts` → `stats.withoutShifts`
  - `stats.coverageRate` → `stats.coverage` (also added `%` suffix; API returns a float)
- **Employee CSV bulk import validation** — added pre-flight checks before sending to `POST /api/employee/bulk`:
  - Rejects empty CSV files
  - Rejects files exceeding 100 rows (backend limit) with a clear batching message
  - Validates that required columns (`firstName`, `lastName`, `email`, `password`) are present; surfaces missing column names in the error toast
- **Employees create modal missing fields** — create form now includes `Exempt Status`, `Probation End Date`, and `Time Zone` fields that were already present in the edit modal but missing from create.
- **Employees edit modal missing Employment Status option** — added `Contract` as a selectable option to match backend schema.

---

### UI — Responsiveness (Mobile / Small Screen)

Stat numbers and headings that were fixed `text-2xl` now use `text-lg sm:text-2xl` to prevent overflow on small screens. Detail dialog grids that were fixed `grid-cols-2` now collapse to `grid-cols-1 sm:grid-cols-2`.

| Component | Change |
|---|---|
| `EmployeesLeaveRequests.jsx` | Heading `text-xl sm:text-2xl`; 4 stat numbers responsive; detail dialog grid collapses on mobile |
| `EmployeesOvertimeRequests.jsx` | 4 stat numbers responsive; detail hours value responsive; detail dialog grid collapses on mobile |
| `Locations.jsx` | Heading `text-lg sm:text-2xl md:text-3xl`; stats grid `grid-cols-1 sm:grid-cols-2 md:grid-cols-4`; column filter and search inputs `w-full sm:min-w-[...]` |
| `OverviewEmployee.jsx` | Dynamic font function returns `text-lg sm:text-2xl` at default; truncation `max-w-[120px] sm:max-w-[180px]`; non-text stats responsive |
| `OverviewAdmin.jsx` | Stat numbers `text-lg sm:text-2xl`; truncation `max-w-[100px] sm:max-w-[140px]` |
| `OverviewSuperadmin.jsx` | Stat numbers `text-lg sm:text-2xl` |
| `EmployeesPunchLogs.jsx` | Summary stats grid `grid-cols-1 sm:grid-cols-2 md:grid-cols-4` |

---

### UI — Design Cohesion (Employee Punch Logs)

`EmployeesPunchLogs.jsx` was visually inconsistent with the rest of the dashboard. Aligned its design language with the Employee Schedules page:

- **Container** — `max-w-full p-4 lg:px-6 px-2` → `max-w-7xl p-6` (consistent max width)
- **Header** — wrapped in `motion.div` with `opacity: 0 → 1, y: -10 → 0` entrance animation; `h2` promoted to `h1`; plain `Clock` icon replaced with solid orange `rounded-xl` icon box matching other pages
- **Subtitle** — `text-muted-foreground` → explicit `text-gray-600 dark:text-gray-400` for correct dark mode contrast
- **SummaryStats** — wrapped in `motion.div` with `y: 10 → 0, delay: 0.1` stagger
- **Toaster** — added `richColors` prop
- **Card headers (Filters, Pending Requests, Main Table)** — replaced orange top-bar + `dark:border-white/10` pattern with:
  - `border-2 border-orange-200 dark:border-orange-900/50 shadow-lg`
  - `bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-950/20 border-b` on CardHeader
  - Icon boxes changed from `rounded-full bg-orange-500/10 text-orange-500` to solid `rounded-xl bg-orange-500 text-white shadow-lg`

---

### UI — Employees Page Cleanup

`Employees.jsx` was cleaned of dead code accumulated from earlier iterations:

**Removed unused imports:** `ChevronDown`, `ChevronUp`, `Filter`, `Mail`, `Plus`, `AnimatePresence`, all `Table/*` primitives, `Skeleton`, `Tooltip`/`TooltipTrigger`/`TooltipContent`, `Popover`/`PopoverTrigger`/`PopoverContent`, `Checkbox`, `MultiSelect`, `fmtMMDDYYYY`, `fmtMMDDYYYY_hhmma`, static `exportEmployeesCSV`/`exportEmployeesPDF` import

**Removed dead state/functions:** `filters` state object (6-key multi-select filter), `requestSort` function

**Dark mode improvements:** outline buttons, `DialogContent` borders, section dividers, progress bar background, CSV template `<pre>` block, password visibility toggle button — all now have explicit `dark:` variants

---

### Sidebar

- Navigation config comments cleaned up (removed stale `✅ UPDATED` / `✅ NEW` annotations)
- `notifyKey` metadata added to sidebar nav items to wire up notification badge rendering:
  - `company/employee-deletion` → `notifyKey: "deletion"`
  - `company/employee-schedules` → `notifyKey: "unscheduled"`, `variant: "dot"`
  - `company/contest-requests` → `notifyKey: "contest"`
  - `company/leave-requests` → `notifyKey: "leave"`
  - `company/overtime-requests` → `notifyKey: "overtime"`
  - `company/cutoff-periods` → `notifyKey: "cutoff"`
  - `company/subscription` → `notifyKey: "subscription"`, `variant: "dot"`

---

### New Files

| File | Description |
|---|---|
| `components/common/ErrorBoundary.jsx` | Global React error boundary for all dashboard pages |
| `lib/exports/_shared.js` | Shared branding, auth fetch, and PDF helpers |
| `lib/exports/punchLogs.js` | Company punch log CSV + PDF export |
| `lib/exports/deletionRequests.js` | Employee deletion request CSV + PDF export |
| `lib/exports/contestLogs.js` | Contest log CSV + PDF export |
| `lib/exports/departments.js` | Departments CSV + PDF export |
| `lib/exports/employees.js` | Employees CSV + PDF export |
| `lib/exports/employeePunchLogs.js` | Employee punch log (employee view) CSV + PDF export |
| `CLAUDE.md` | Project reference document for architecture, conventions, and folder structure |
