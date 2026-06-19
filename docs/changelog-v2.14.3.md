# Changelog — v2.14.3

Punch Logs page: Edit modal timezone fix + Pending Requests UI cleanup + unified Generate Report modal.

---

## Change 1 — Edit Time In/Out Modal: Timezone Fix (EmployeesPunchLogs)

**Status:** Shipped (client only).

**Page:** `/dashboard/company/punch-logs`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

**Root Cause:**
Two bugs in the Edit Time In / Time Out modal:

1. **Opening (pre-population):** `toLocalInputValue()` used `Date.getHours()` / `getDate()` etc., which return browser-local time. When the admin's browser timezone differs from the company timezone, the inputs were pre-filled with the "Detected time" (employee device timezone) instead of the correct company-local time.
2. **Saving:** `new Date(editTimeIn).toISOString()` also treated the input string as browser-local time, producing an incorrect UTC value on save.

**Fix:**
Replaced `toLocalInputValue` with two pure helpers:
- `toCompanyInputValue(iso, tz)` — converts UTC ISO → `"YYYY-MM-DDTHH:mm"` in the company timezone using `Intl.DateTimeFormat.formatToParts()`.
- `fromCompanyInputToISO(localStr, tz)` — converts the `datetime-local` input string (interpreted as company timezone) back to UTC ISO using the Intl offset-inversion trick.

`openEditDialog` now passes `companyTimezone` when pre-populating both inputs. `submitEdit` now uses `fromCompanyInputToISO` instead of `new Date().toISOString()`.

**Example (Alec Duna, 06/06/2026):**
- Display (company tz): `08:06 AM` / `04:45 PM`
- Before fix: Edit modal showed `23:06` / `07:45` (browser local, PDT) ✗
- After fix: Edit modal shows `08:06` / `16:45` (company timezone) ✓

---

## Change 2 — Punch Log Requests Pending Approval: UI Cleanup

**Status:** Shipped (client only).

**Page:** `/dashboard/company/punch-logs`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

**What Changed:**
- Removed emoji prefixes (`🟡`, `✅`, `❌`) from status badges (PENDING / APPROVED / REJECTED) — badges now show plain text with color-coded styling only.
- Replaced `🔥 {daysAgo}d ago` urgent badge with `{daysAgo}d overdue` — cleaner and more professional.
- Apply (date range) button changed to always render orange (`bg-orange-500`) instead of conditionally switching between orange and black (`bg-primary`).

---

---

## Change 3 — Punch Logs Reports: Active Filters Date Display Timezone Fix

**Status:** Shipped (client only).

**Page:** `/dashboard/company/punch-logs`

**File:** `lib/exports/employeePunchLogs.js`

**Root Cause:**
`new Date("2025-05-27").toLocaleDateString()` parses the date string as UTC midnight, then converts to the browser's local timezone before formatting. For users in UTC− timezones (e.g. US/Los Angeles), this shifted the displayed date one day earlier in the "Active Filters" section of both CSV and PDF reports — the data rows were correct, only the filter summary header was wrong.

**Fix:**
Added `{ timeZone: "UTC" }` to both calls in the Active Filters section of the CSV export and the PDF export:
```js
new Date(filters.from).toLocaleDateString("en-US", { timeZone: "UTC" })
new Date(filters.to).toLocaleDateString("en-US", { timeZone: "UTC" })
```

---

## Change 4 — Punch Logs: Unified Generate Report Modal

**Status:** Shipped (client only).

**Page:** `/dashboard/company/punch-logs`

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`
- `lib/exports/employeePunchLogs.js`

**What Changed:**

Replaced three separate export icon buttons (CSV Detail, PDF, CSV Payroll Grid) with a single **Download** icon that opens a unified **Generate Report** modal.

**Modal fields:**
- **Report Type** — PDF / CSV (Detail) / CSV (Payroll Grid)
- **Date Range** — start and end date inputs, pre-filled from the current page filters
- **Cutoff Period quick-select** — shown when the company has cutoff periods configured; selecting a period auto-fills the date inputs; defaults to "Custom range"
- **Columns** — grouped column picker (Basic Info, Schedule, Time, Breaks, Other); opens with all available columns pre-selected; for BNC companies, OT (Daily), Lunch Start, and Lunch End are always forced-included regardless of selection

**Columns excluded from report (not selectable):**
Device In, Device Out, Location In, Location Out, Location Required — not relevant for payroll/attendance reporting.

**PDF column limit removed:**
The previous hard `.slice(0, 8)` cap on PDF columns was removed. `autoTable` now receives all selected columns and handles layout automatically.

**Employee sort:**
Report data is always sorted **Last name → First name → date ascending** before being passed to the export function, ensuring consistent alphabetical order across all three report types.

**Fresh data fetch:**
The modal fetches a fresh data range for the specified dates (not re-using the page's currently loaded data), then applies the current department / status / employee filters client-side before export.

**Internal refactor — `enrichTimelogs` helper:**
Extracted ~115 lines of timelog enrichment logic from `fetchTimelogs` into a shared `enrichTimelogs(rawData, opts)` module-level helper, used by both the page fetch and the report fetch.

**BookOpen (Rules Guide) icon retained** as a separate button in the header.
**ColumnSelector retained** in the Filters card for table UI column visibility — unrelated to report generation.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | Edit modal timezone fix (`toCompanyInputValue` + `fromCompanyInputToISO`); pending requests emoji removal; Apply button always orange; unified Generate Report modal (`GenerateReportModal` component, `handleGenerateReport`, `enrichTimelogs` helper, `COLUMN_MAP_FOR_EXPORT` / `REPORT_GROUPS` / `BNC_FORCED_COLS` / `REPORT_EXCLUDED_COLS` constants); alphabetical employee sort in report output |
| `lib/exports/employeePunchLogs.js` | Active Filters date timezone fix (CSV + PDF); PDF 8-column cap removed |
