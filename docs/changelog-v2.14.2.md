# Changelog — v2.14.2

UI/UX modernization across Shifts, Leave, and Punch Logs pages + BB-030 timezone fix in Edit Punch modal.

---

## Change 1 — Remove Training Day Button from Date Sub-Header in Cutoff Review

**Status:** Shipped (client only).

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**What Changed:**
Removed the `ActionBtn` ("Training Day" / "Unmark Training") from each date sub-header row. It was redundant — individual punch rows already have their own Training toggle. The amber badge indicator in the date sub-header is retained.

---

## Change 2 — Suspend v2 Cutoff Review Route

**Status:** Shipped (client only).

**Page:** `/dashboard/company/cutoff-periods/[id]/review/v2`

**File:** `app/dashboard/company/cutoff-periods/[id]/review/v2/page.jsx`

**What Changed:**
Route now returns `notFound()` in all non-development environments. The "Try v2 →" link was also removed from the main Cutoff Review header. The v2 page is still accessible locally for development.

---

## Change 3 — Company Leave Requests: Calendar View Shows Employee Name

**Status:** Shipped (client only).

**Page:** `/dashboard/company/leave-requests`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx`

**What Changed:**
The calendar day panel now shows the employee's name (resolved from `profile.firstName/lastName` with fallback chain) instead of their email. Email is still shown in the View modal.

---

## Change 4 — Leave Request Details Modal: Visual Cleanup

**Status:** Shipped (client only).

**Page:** `/dashboard/company/leave-requests`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx`

**What Changed:**
- All colored section backgrounds (blue/indigo/purple/orange) neutralized to `bg-muted/40 border-border`
- Leave Credits highlighted row changed from purple to orange (`bg-orange-50`)
- Close button changed from default black to orange (`bg-orange-500`)

---

## Change 5 — Company Leave Requests: Inline Table Replaces DataTable

**Status:** Shipped (client only).

**Page:** `/dashboard/company/leave-requests`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx`

**What Changed:**
Replaced the `DataTable` component with a self-contained inline table matching the LeaveLogs style. Columns: **Name** (with status pill), **Date Range** (start–end + day count), **Leave Type**, **Submitted**, **View**. Includes search, sort, tabs, and pagination.

---

## Change 6 — Employee Leave Logs: Duplicate Detection + Reason Validation

**Status:** Shipped (client only).

**Page:** `/dashboard/employee/leave-logs`

**File:** `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx`

**What Changed:**
- Added `duplicateConflict` detection via `useMemo` — shows an inline red warning banner in the modal when a new request's dates overlap an existing pending/approved leave
- Submit button disabled when a duplicate conflict exists
- Reason field is now required with a 30-character minimum; live counter shown in label
- `PayPill` labels corrected to "Paid Leave" / "Unpaid Leave"
- Table row spacing tightened; date range condensed to a single line
- Added `VisuallyHidden` `DialogTitle` to fix screen-reader accessibility warning

---

## Change 7 — Shifts Page: Full Table Modernization

**Status:** Shipped (client only).

**Page:** `/dashboard/company/shifts`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/Shifts.jsx`

**What Changed:**
Replaced the heavy shadcn `Table` + Framer Motion + Card + column-visibility-toggle table with a clean inline `<table>` matching the LeaveLogs/EmployeesLeaveRequests style.

Removed:
- Stats cards (Total Shifts, Avg Duration, Morning Shifts, Night Shifts)
- Column visibility toggle (`MultiColumnSelect`)
- Framer Motion row animations
- Tooltip wrappers on every cell
- Separate "Filters & Controls" card
- Bulk select checkboxes and bulk delete dialog
- Items-per-page selector

New table columns (fixed): **Shift Name** · **Time** (24h → 12h subtitle) · **Duration** pill · **Timezone** (IANA on hover) · **Pay Rate** · **Actions** (Edit / Delete).

---

## Change 8 — Shifts Page: Dialogs Modernization (Create / Edit / Delete)

**Status:** Shipped (client only).

**Page:** `/dashboard/company/shifts`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/Shifts.jsx`

**What Changed:**
All three dialogs (Create, Edit, Delete) modernized to match the inline table aesthetic:
- `TimezoneBadge` gradient → flat `#fff7f0` pill with timezone abbreviation
- Blue/green `Alert` tips and previews → flat colored info rows (`#f0fdf4`, `#eff6ff`)
- shadcn `Button` footer → native `<button>` elements
- shadcn `Input` / `Label` → native `<input>` / `<label>` with orange focus border
- Tooltip wrappers on labels → native `title` attributes on `Info` icons
- Delete dialog: full red `#fcebeb` box → neutral `#fafaf9` with `3px` red left-border accent

---

## BB-030 — Edit Punch Modal Showing UTC Times Instead of Company Timezone

**Status:** Shipped (client only).

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Root Cause:**
Two bugs at the same two lines in the Edit punch modal:

1. **Opening:** `rawTimeIn.slice(0, 16)` fed the raw UTC ISO string into `datetime-local`, causing the input to display UTC time (e.g. `15:18`) instead of the correct company timezone time (e.g. `8:18 AM`).
2. **Saving:** `new Date(editedClockIn).toISOString()` treated the input value as the browser's local timezone (e.g. Manila UTC+8), producing a wrong UTC value on save.

**Fix:**
Added two pure helper functions:
- `toCompanyTzInput(isoStr, tz)` — converts UTC ISO → `"YYYY-MM-DDTHH:mm"` in the company timezone using `Intl.DateTimeFormat.formatToParts()`
- `fromCompanyTzInput(localStr, tz)` — converts the input value (interpreted as company timezone) → UTC ISO using `fromZonedTime` from `date-fns-tz`

Added import: `fromZonedTime` from `date-fns-tz`.

Also added a note below the time inputs: *"Times are in the company timezone: {companyTimezone}"* so admins always know which timezone they're editing in.

**Example (Alec Duna, May 28):**
- Stored UTC: `15:18Z` / `20:36Z`
- Before fix: Edit modal showed `15:18` / `20:36` ✗
- After fix: Edit modal shows `8:18` / `13:36` (America/Los_Angeles PDT) ✓

---

## Change 9 — Punch Logs: Early Clock-In Grace in Employee Details

**Status:** Shipped (client only).

**Page:** `/dashboard/company/punch-logs`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

**What Changed:**
Added `earlyClockInGraceMins` state, populated from `cJ.data?.earlyClockInGraceMinutes` in the same company-settings fetch that already reads `gracePeriodMinutes`. Displayed as a new **"Early Clock-In Grace"** row in the Employee Details panel, directly below the existing "Grace Period" row.

---

## Files Changed

| File | Changes |
|---|---|
| `app/dashboard/company/cutoff-periods/[id]/review/v2/page.jsx` | Route locked to dev-only via `notFound()` |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | Remove Training Day ActionBtn; BB-030 timezone fix in Edit Punch modal |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx` | Calendar name display; modal visual cleanup; DataTable → inline table |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | Early Clock-In Grace in Employee Details |
| `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/Shifts.jsx` | Full table + dialogs modernization; remove bulk delete |
| `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx` | Duplicate detection; reason validation; PayPill labels; table spacing; a11y fix |
