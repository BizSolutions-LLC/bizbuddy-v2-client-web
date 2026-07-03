# Changelog — v2.14.7

Four related fixes to Overtime figures in the Punch Logs "Generate Report" exports (Detail CSV and PDF): approved BNC daily OT blocks were never matching due to a date-format mismatch, the CSV only showed the daily OT value on one punch row per day, unapproved OT was being counted in the summary totals, and cutoff-basis companies were using the wrong OT formula entirely (per-punch sum instead of the period-level formula already used by the Payroll Grid export).

---

## Punch Logs Export — BNC Daily OT Block Date-Key Mismatch

**Status:** Shipped (client only).

**Page:** `/dashboard/company/punch-logs` → Generate Report (CSV — Detail, PDF)

**File:** `lib/exports/employeePunchLogs.js`

**Problem:**

The daily OT column for BNC companies almost never showed a value, even for OT that had already been approved. The lookup map was keyed as `` `${b.userId}|${b.date}` ``, but `b.date` (from the `bncOtBlocks[]` field on `/api/timelogs`) is a full ISO datetime string, not a bare `YYYY-MM-DD`. The punch-record side of the same lookup used a plain `YYYY-MM-DD` string, so the two keys never matched.

**Fix:**

Normalize `b.date` with `.slice(0, 10)` when building the lookup key, in both the CSV and PDF export functions — the same normalization `CutoffReviewV2.jsx` already applies to the same field elsewhere in the app.

---

## Punch Logs Export — CSV Daily OT Value Only Shown on First Punch of the Day

**Status:** Shipped (client only).

**Page:** `/dashboard/company/punch-logs` → Generate Report (CSV — Detail)

**File:** `lib/exports/employeePunchLogs.js`

**Problem:**

For BNC companies, an employee with more than one punch on the same day (e.g. clocking in/out twice) only showed the daily OT value on the first punch row for that day — every other row for the same day showed `"—"`, which read as missing/incomplete data. This was a carryover from the PDF export's `rowSpan` cell-merge logic, which has no equivalent in a flat CSV.

**Fix:**

The CSV now repeats the same daily OT value on every punch row for that employee/date instead of blanking out all but the first.

---

## Punch Logs Export — Unapproved OT Counted in Summary Totals

**Status:** Shipped (client only).

**Page:** `/dashboard/company/punch-logs` → Generate Report (CSV — Detail, PDF)

**File:** `lib/exports/employeePunchLogs.js`

**Problem:**

The per-employee "Overtime" total and the report's grand "Total Overtime Hours" summed every record's raw computed OT (`otHours`, derived from `rawOtMinutes`) regardless of approval status. Punches with `otStatus` of `"Included"` (pending review), `"pending"`, or `"No Approval"` contributed hours to the total the same as punches with actually-approved OT — most visible on DayCare PDF reports, where nearly every employee showed a nonzero Overtime figure even though very little of it had been approved.

**Fix:**

Added an `isApprovedOT(otStatus)` helper (matches legacy `"approved"` / `"Approved …h"` values) and gated both the grand total and each employee's per-row Overtime total on it. Unapproved OT no longer inflates either figure.

---

## Punch Logs Export — Cutoff-Basis Companies Used the Wrong OT Formula

**Status:** Shipped (client only).

**Page:** `/dashboard/company/punch-logs` → Generate Report (CSV — Detail, PDF)

**Files:** `lib/exports/employeePunchLogs.js`, `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

**Problem:**

For companies on **cutoff-basis** OT (`otBasis === "cutoff"`), overtime is a single **period-level** figure — `max(0, totalWorkedHoursInRange - cutoffOtThreshold)`, applied once the employee has any approved OT — not a sum of per-punch/per-day raw values. The Detail CSV and PDF summary tables were still summing each record's raw `otHours` (even after the approval gate above), which produced numbers that didn't match the Payroll Grid CSV export for the same employee and date range (e.g. showing `6.18h` where the correct period figure was closer to `7h`).

**Fix:**

- `exportEmployeePunchLogsCSV` and `exportEmployeePunchLogsPDF` now accept `otBasis` and `cutoffOtThreshold` parameters.
- When `otBasis === "cutoff"`, each employee's `totalOT` is overridden with the period formula — `hasApprovedOT ? Math.max(0, totalWorkedHours - cutoffOtThreshold) : 0` — using a strict `otStatus === "Approved"` check, exactly matching the formula already used by `exportEmployeePunchLogsCSV_v2` (Payroll Grid).
- For "daily"/"weekly" basis companies, the per-record approved-OT summation (previous fix) is unchanged.
- The grand "Total Overtime Hours" is now derived by summing the corrected per-employee totals, so it always stays consistent with the table below it.
- `EmployeesPunchLogs.jsx` (`handleGenerateReport`) now passes `otBasis` and `cutoffOtThreshold` — both already tracked in component state — through to the CSV and PDF export calls, which previously did not receive them.

---

## Files Changed

| File | Changes |
|---|---|
| `lib/exports/employeePunchLogs.js` | Added `isApprovedOT` helper; fixed BNC daily-OT-block lookup key normalization (`.slice(0, 10)` on `b.date`); CSV now repeats the daily OT value across every punch row per day instead of only the first; gated summary/employee OT totals on approval status; added `otBasis`/`cutoffOtThreshold` params and period-level OT formula for cutoff-basis companies, matching the Payroll Grid export |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | `handleGenerateReport` now passes `otBasis` and `cutoffOtThreshold` to both `exportEmployeePunchLogsCSV` and `exportEmployeePunchLogsPDF` |
