# Changelog

All notable changes to BizBuddy v2 Client Web are documented here.

---

## [v2.11.1] — 2026-04-29

Patch release on top of v2.11.0. Bug fixes, server field alignment, display consistency corrections, and completion of server-shipped Cutoff Review features. No new routes or API endpoints.

---

### Bug Fix — `isScheduled` Badge (Company Punch Logs)

> `CompanyPanel > Punch Logs` (`/dashboard/company/punch-logs`)
> `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

#### Bug

The "Scheduled" / "Unscheduled" badge in the company punch logs table was showing "Scheduled" for employees who had no personal shift assigned.

#### Root Cause

`isScheduled` was derived from `t.shiftToday` — a server-joined string that can be non-null even when the employee has no personal `UserShift` record (e.g., when the server resolves a company or department-level default shift name). This caused false positives on the badge.

#### Fix

`isScheduled` is now derived from the same source as `scheduleList` — `t.userShifts` and `t.userShift`, which are the employee's actual `UserShift` records for that day.

```js
// Before
isScheduled: !!(t.shiftToday),

// After — scheduleList computed first, isScheduled reads same source
scheduleList: (() => { ... })(),
isScheduled: !!(t.userShifts?.length || t.userShift),
```

The badge, tooltip, and Schedule Details dialog now all agree on whether a shift was actually assigned.

| Before | After |
|---|---|
| `!!(t.shiftToday)` — truthy if server resolves any default | `!!(t.userShifts?.length \| t.userShift)` — truthy only if a `UserShift` record exists |

---

### Server Alignment — `grossHours` Field

> `EmployeePanel > Time Keeping > Punch Logs` (`/dashboard/employee/punch-logs`)
> `CompanyPanel > Punch Logs` (`/dashboard/company/punch-logs`)

#### Summary

The server now returns `grossHours` (raw `timeOut − timeIn` in hours) on every `TimeLog` row via `GET /api/timelogs/user` and `GET /api/timelogs`. The client was previously computing this value client-side as a fallback.

#### Change

`grossHours` is now wired in as the priority fallback in the duration computation chain, replacing the client-side `rawDuration()` / `diffMins()` calculation. The client-side fallback is retained as a last resort for active logs (no `timeOut` yet) or if `grossHours` is absent.

```
netWorkedHours  →  grossHours  →  rawDuration(timeIn, timeOut)
```

**Modified:**

| File | Location | Change |
|---|---|---|
| `PunchLogs.jsx` | `logsWithSchedule` enrichment | `duration` fallback chain updated |
| `PunchLogs.jsx` | `fetchExportData` | Same fallback chain applied to export path |
| `EmployeesPunchLogs.jsx` | Log enrichment | `duration` fallback chain updated |

Exports (`punchLogs.js`, `employeePunchLogs.js`) are unaffected — they read `log.duration` after enrichment.

---

### Server Alignment — `periodHours` Redefined as `scheduledHours`

> `EmployeePanel > Time Keeping > Punch Logs` (`/dashboard/employee/punch-logs`)
> `CompanyPanel > Punch Logs` (`/dashboard/company/punch-logs`)

#### Summary

`Period Hours` in the expanded row detail previously displayed a client-side derivation of `netWorkedHours − unapproved OT minutes`. This conflated actual attendance output with scheduled time.

**Correct definition:** Period Hours represents how many hours the employee was *scheduled* to work that day — the sum of their assigned shift durations (e.g., `1.25h + 5.5h + 1.25h = 8h` for a DA employee with three shifts). The server now computes and returns this as `scheduledHours` (`null` if no shift assigned).

#### Change

```js
// Before — client-side derivation
const approvedMins     = approvedOTHours * 60;
const unapprovedOtMins = Math.max(0, rawOtMins - approvedMins);
const periodHours      = toHour(Math.max(0, netWorkedHours * 60 - unapprovedOtMins));

// After — server-authoritative
const periodHours = log.scheduledHours != null
  ? parseFloat(log.scheduledHours).toFixed(2)
  : "0.00";
```

`approvedMins` and `unapprovedOtMins` were only used to compute `periodHours` and have been removed. `approvedOTHours` is retained — it is still used for `otStatus` display.

**Modified:**

| File | Location | Change |
|---|---|---|
| `PunchLogs.jsx` | `logsWithSchedule` enrichment | Replaced formula; removed `approvedMins`, `unapprovedOtMins` |
| `PunchLogs.jsx` | `fetchExportData` | Same replacement applied to export path |
| `EmployeesPunchLogs.jsx` | Log enrichment | Replaced formula; removed `approvedMins`, `unapprovedOtMins` |

---

### Display Fix — `lateHours` Zero Suppression (Expanded Row)

> `EmployeePanel > Time Keeping > Punch Logs` (`/dashboard/employee/punch-logs`)
> `CompanyPanel > Punch Logs` (`/dashboard/company/punch-logs`)

#### Bug

The "Late Hours" row in the expanded log detail always rendered `0.00h` even when the employee was not late. The company panel table column already suppressed zero with `—`; the expanded row did not.

#### Fix

Both expanded rows now match the table column behavior:

```jsx
// Before
{log.lateHours}h

// After
{parseFloat(log.lateHours) > 0 ? `${log.lateHours}h` : "—"}
```

**Modified:**

| File | Change |
|---|---|
| `PunchLogs.jsx` | Expanded row Regular breakdown — `lateHours` display |
| `EmployeesPunchLogs.jsx` | Expanded row detail section — `lateHours` display |

---

### Payroll Notice — `lateHours` Value Change (Grace Period Behavior)

> `lib/exports/punchLogs.js` · `lib/exports/employeePunchLogs.js`

**No code change.** The server-side grace period for `lateHours` and `undertimeHours` now operates as a threshold rather than a buffer. Employees who previously just exceeded grace (e.g., 11 minutes late with a 10-minute grace) will now show the full late value instead of a reduced one.

Values in the flat CSV, PDF export, and DayCare v2 Grid CSV will be higher for these edge cases on the next export run. No column changes, no format changes — only the numeric values differ. Payroll reviewers should be aware before the next export.

---

---

### Cutoff Review — Driver Day Grouping, Sync Records, Timezone Fixes

> `CompanyPanel > Cutoff Periods > Review` (`/dashboard/company/cutoff-periods/:id/review`)
> `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`
> `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeeCutoff.jsx`

#### Driver Day Grouping

The server already creates 3 approval records per `DRIVER_AIDE` punch (one each for `driver_am`, `regular`, `driver_pm`). The client was ignoring `segmentType` and displaying all records as flat "Punch" rows. This client-side completion wires up the existing server behavior.

**Changes:**
- `groupDriverRecords()` — groups records by date when `segmentType !== null`; produces a `driver_group` parent with a `segments[]` array ordered `driver_am → regular → driver_pm`
- `DriverGroupRow` — violet header row showing date + segment count + total hours
- `DriverSegmentRow` — child row per segment with segment-type pill (Driver AM / Regular / Driver PM), punch detail, hours, and Approve / +OT / Exclude actions (no Edit — segments cannot be corrected individually)
- `findRecord()` — depth-first lookup through driver groups for action handlers (approve, conflict, exclude)
- Bulk approve, stat counters, flag detection, and filter chips all updated to traverse `driver_group` segments
- Driver AM / Driver PM pill fixed: `whitespace-nowrap` + widened type cell (`w-28`) to prevent label wrapping on wide screens

> **Backfill note:** Cutoffs created before the server deployed segment splitting will show stale single-record rows for DRIVER_AIDE employees. Clicking **Sync Records** on the cutoff will replace them with the correct 3-segment records. See `CHANGELOG_SERVER.md` — Change 9.

#### Sync Records Button

Added **Sync Records** button to the sticky header (visible on `open` cutoffs only). Calls `POST /api/cutoff-periods/:id/sync`. If new records are added the list refreshes automatically; if already up to date a toast confirms it. Primary use case: picking up employees or punches added after the cutoff was first created, and backfilling stale driver segment records.

#### Timezone Fixes

**Period boundary dates** (`periodStart`, `periodEnd`, `paymentDate`) are date-only values with no time component. Previously parsed via `new Date(d)` which applies a timezone offset and shifts the date by ±1 day for users whose browser is not UTC.

Fix applied to both pages:
```js
// Before — timezone offset shifts date ±1 day
new Date(d).toLocaleDateString("en-US", { ... })

// After — reads YYYY-MM-DD literally, no timezone math
const [year, month, day] = d.slice(0, 10).split("-").map(Number);
new Date(year, month - 1, day).toLocaleDateString("en-US", { ... })
```

**Punch timestamps** (`timeIn`, `timeOut`) are true UTC ISO strings. `formatDateTime` now receives `companyTimezone` (fetched from `GET /api/company-settings/` in parallel with the approvals fetch, with `approvalsData.companyTimezone` as the preferred source if the server begins embedding it). Times now render in the company's configured timezone (e.g. `America/Los_Angeles`) instead of the browser's local timezone.

| Field type | Before | After |
|---|---|---|
| Period dates (`periodStart` etc.) | Browser tz → ±1 day shift | `slice(0,10)` literal → always correct |
| Punch times (`timeIn`/`timeOut`) | Browser tz (Manila for dev) | Company tz (California for this company) |

#### Employee Reason for Unscheduled Punch

When a `TimeLog` has a `remarks` array entry of type `"no_schedule"`, the employee's submitted reason is now shown inline below the "No schedule for this day" warning banner. Displayed as a card with a `FileText` icon and "Employee Reason" label.

---

### Modified Files

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | Driver Day grouping (`groupDriverRecords`, `DriverGroupRow`, `DriverSegmentRow`); `findRecord` helper; Sync Records button + `doSync`; `companyTimezone` state from company-settings fetch; `formatDate` → date-only parse; `formatDateTime` with `companyTimezone`; `noScheduleRemark` display; Driver AM pill `whitespace-nowrap` + `w-28` cell; all stat/filter/bulk paths updated for driver groups |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeeCutoff.jsx` | `formatDate` → date-only parse (period boundary dates no longer shift by timezone offset) |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | `isScheduled` source changed to `userShifts`/`userShift`; `scheduleList` hoisted before `isScheduled`; `grossHours` fallback in `duration`; `periodHours` → `scheduledHours`; removed `approvedMins`, `unapprovedOtMins`; `lateHours` zero suppression in expanded row |
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` | `grossHours` fallback in `duration` (logsWithSchedule + fetchExportData); `periodHours` → `scheduledHours` in both paths; removed `approvedMins`, `unapprovedOtMins` from both paths; `lateHours` zero suppression in expanded row |

