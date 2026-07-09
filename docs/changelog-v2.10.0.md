# Changelog

All notable changes to BizBuddy v2 Client Web are documented here.

---

## [v2.10.0] — 2026-04-10

### Employee Punch Logs — Server-Side Filtering & Pagination

> `EmployeePanel > Time Keeping > Punch Logs` (`/dashboard/employee/punch-logs`)

Previously, all filtering and export operated on the records already loaded in the browser. For large datasets (thousands of logs per month) this produced incomplete search results and incorrect exports.

- **Server-driven query params** — a single `queryParams` state object (`from`, `to`, `status`, `punchType`, `page`, `limit`) drives every data fetch. Changing any filter immediately re-fetches from the server.
- **`pendingDates` + Apply button** — date range inputs are now decoupled from the live query. Editing dates no longer triggers a fetch on every keystroke; an Apply button commits the range. An "Unsaved date range" indicator appears while dates are pending. The Apply button turns orange when there are uncommitted changes.
- **Default date range** — page loads showing the current calendar month (1st → today) by default instead of an empty date range.
- **Server summary stats** — the four stat cards (Total, Active, Completed, Total Hours) are now populated from a `summary` block returned by the server, reflecting the full filtered dataset rather than only the current page.
- **Pagination** — replaced "Load More / Show All" with clean page navigation (First / Prev / page buttons / Next / Last). Shows "Page N of M · X records".
- **Full-range export** — both the flat CSV and v2 Grid CSV exports now trigger a fresh `limit=10000` server fetch for the current filter range, ensuring the full dataset is always exported regardless of which page is currently displayed.

---

### Employee Punch Logs — v2 Grid CSV Export (Payroll Template)

> `EmployeePanel > Time Keeping > Punch Logs`

- **New export option** — a second export button (grid icon) generates a DayCare payroll grid CSV alongside the existing flat-row CSV. The original export is unchanged.
- **Grid layout** — rows represent the employee; columns represent each date in the selected range with three sub-columns per day: `Driver Aide AM` / `Regular` / `Driver Aide PM`.
- **DA hour breakdown** — AM is fixed at 1.25 h, Regular at 5.5 h, PM is derived from actual clock-out time relative to the PM shift boundary (with approved OT applied). Regular employees show hours only in the Regular column.
- **Totals** — per-employee AM / Regular / PM totals, a grand Total column, and blank TR / SL columns for manual payroll entry.
- **Remarks legend** — footer rows: Aide = Blue, Driver = Red, Program Hours = Black, Absent = Orange, Holiday = Yellow.

---

### Company Punch Logs — v2 Grid CSV Export (Payroll Template)

> `CompanyPanel > Punch Logs & Overtime & Leaves > Employee Punch Logs` (`/dashboard/company/punch-logs`)

- **New export button** (`LayoutTemplate` icon) added alongside the existing Detail CSV and PDF export buttons.
- **Full-range data fetch** — the grid export fetches all records for the current filter range (`limit=10000`) rather than the current page, then runs the full enrichment pipeline (schedule matching, OT map, DA breakdown) client-side before writing the CSV.
- **Multi-employee grid** — rows represent each employee (sorted alphabetically); columns are dates × AM/Regular/PM sub-columns, identical layout to the employee-panel v2 export.
- **DA field alignment** — uses the admin panel's enriched field names (`daAMHours`, `daRegularHours`, `daPMHours`) which are already computed during the timelog enrichment pass.
- **Grand totals row** — accumulates AM / Regular / PM across all employees.

---

### Company Punch Logs — Pagination & Filter UX Improvements

> `CompanyPanel > Punch Logs & Overtime & Leaves > Employee Punch Logs`

- **Default date range** — page now loads with the current calendar month (1st → today) pre-filled instead of empty date inputs.
- **`pendingDates` + Apply button** — same pattern as the employee panel: editing date inputs does not trigger a server fetch. An Apply button commits the range; the button turns orange and an "Unsaved date range" label appears while dates are uncommitted.
- **Clear All Filters** — resets both the active filters and the pending date inputs back to defaults.
- **Removed "Load More"** — the append-based "Load More" button is removed. Pagination is now page-only navigation.
- **Page indicator updated** — the filter card header and pagination footer both show "Page N of M · X records" sourced from the server `meta` block instead of the local `rowsLoaded` count.

---

### Punch — Location Restriction (Priority Check & UX)

> `EmployeePanel > Time Keeping > Punch` (`/dashboard/employee/punch`)

Previously, location restriction validation only fired inside `doCall` — the very last step after all modals had already been shown. Employees outside their designated work zone could reach the Confirm Time In/Out dialog before seeing any error.

#### Bug Fixes

- **Wrong location endpoint** — the component was fetching `/api/location` (admin endpoint, returns all company locations) instead of `/api/location/assigned` (employee endpoint, returns only the current user's assigned locations). As a result, `assignedLocations` was always empty and the restriction check was silently skipped.
- **Location check priority** — moved the restriction check to the very start of `handlePunch`, before any modal (no-schedule, punch type, or confirmation) can open. If the employee is outside their zone, execution stops immediately — no dialogs are shown.

#### Proactive Location Status

- **Background check on mount** — as soon as assigned locations are loaded, a GPS check runs automatically. No need for the employee to click the punch button to discover they're outside.
- **60-second auto-refresh** — location status is re-evaluated every 60 seconds passively in the background.
- **Live re-verify on punch** — when the punch button is clicked, a fresh GPS read is taken and location status is updated before proceeding. Ensures accuracy even if the employee moved since the last background check.

#### Location Status Badge (Card Header)

The generic "Location Active" badge is replaced with a dynamic status badge when the employee has location restrictions:

| Status | Badge |
|---|---|
| Checking | Pulsing spinner — "Checking location..." |
| Within Work Zone | Green — "Within Work Zone" (✓) |
| Outside Work Zone | Red — "Outside Work Zone" |
| GPS Unavailable | Red — "GPS Unavailable" |
| No restriction | Falls back to "Location Active" / "Location Required" as before |

#### Location Status Banner (Above Punch Button)

- **Outside Work Zone** — a red bordered banner appears above the punch button naming the required location(s) (e.g. "You must be within Main Office or Branch 2 to punch in or out."). Includes a **Recheck** button to re-run the GPS check on demand.
- **GPS Unavailable** — an orange bordered banner instructs the employee to enable GPS, with a **Retry** button.
- Banners animate in/out with Framer Motion.

#### Punch Button

- **Disabled when blocked** — button is greyed out (`cursor-not-allowed`, no hover/tap animation) when `locationStatus` is `"outside"` or `"unavailable"`.
- **Label reflects status** — button text changes to "Outside Work Zone" or "GPS Unavailable" instead of "TIME IN / TIME OUT", making the reason immediately clear without reading the banner.
- **"Checking Location..."** label with spinner appears during the live GPS re-verify on click.

---

### Server-Side Changes Required

> See `CHANGELOG_SERVER.md` — Change 8

`GET /api/timelogs/user` must be updated to support the following query parameters:

| Param | Type | Description |
|---|---|---|
| `from` | `YYYY-MM-DD` | Filter logs with `timeIn ≥ from` (start of day, company timezone) |
| `to` | `YYYY-MM-DD` | Filter logs with `timeIn ≤ to` (end of day, company timezone) |
| `status` | `active \| completed` | Filter by timelog status |
| `punchType` | `REGULAR \| DRIVER_AIDE \| ...` | Filter by punch type |
| `page` | integer | Page number (1-based) |
| `limit` | integer | Records per page |

Response must include:

```json
{
  "data": [...],
  "pagination": { "total": 0, "page": 1, "limit": 10, "totalPages": 0 },
  "summary": { "total": 0, "active": 0, "completed": 0, "totalHours": "0.00" }
}
```

Backwards compatible — existing callers that ignore pagination/summary are unaffected.

---

### Company Configurations — DayCare Settings: Shift Assignment Window

> `CompanyPanel > Settings > Configurations`
> `components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyConfigurations.jsx`

- **New field: Shift Assignment Window (minutes)** — added to the **DayCare Settings card** (DayCare-exclusive). Default: 30 minutes. Distinct from Driver-Aide Threshold:
  - **Driver-Aide Threshold** — for non-driver employees; punching within the window **triggers the AM/PM selection modal**.
  - **Shift Assignment Window** — for driver employees; punching within the window **auto-assigns the punch type and snaps the time to the shift boundary** — no prompt shown.
- Included in `PATCH /api/company-settings` payload as `shiftAssignmentWindowMinutes`.
- DayCare Settings card skeleton updated to show 2 field placeholders.
- Quick Guide DayCare section updated to describe both fields.

---

### Employees — DayCare: Driver Schedule Flag

> `CompanyPanel > Organizations & People > Employees`
> `components/Dashboard/DashboardContent/CompanyPanel/Organizations&People/Employees.jsx`

- **Driver Schedule toggle** — DayCare-exclusive field added to the Edit Employee modal (appears between basic info and Employment Details). Toggling on marks the employee as following a driver shift schedule, enabling auto-assignment of punch type at shift boundaries.
- Toggle is hidden for non-DayCare companies (`isDayCare` derived from `GET /api/company/me`).
- `isDriver` is sent in `PUT /api/employee/:id` payload only when `isDayCare` is true. Stored in `employmentDetail`.
- **Driver indicator** — a green `Car` icon appears next to the employee name in both the employees table and the View Details modal when `isDriver` is `true`.

---

### Server-Side Status — DayCare Features

All server-side requirements for the DayCare features implemented in this version have been confirmed. No pending server changes remain.

| Concern | Endpoint | Status | Notes |
|---|---|---|---|
| Persist & return `shiftAssignmentWindowMinutes` | `GET / PATCH /api/company-settings` | Confirmed | Field added to company settings schema; returned in `data`, accepted on `PATCH` |
| Persist `isDriver` flag | `PUT /api/employee/:id` | Confirmed | Accepted in request body, stored in `employmentDetail` |
| Return `isDriver` flag | `GET /api/employment-details/me` | Confirmed | No code change needed — Prisma returns all scalar fields by default |
| Honor `localTimestamp` for snap-to-schedule | `POST /api/timelogs/time-in` | Confirmed | Server already uses client-provided `localTimestamp` as the recorded time-in; snap logic works end-to-end as-is |

---

### Modified Files

| File | Change |
|---|---|
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` | Server-side filtering/pagination (`queryParams`, `pendingDates`, Apply button, server summary stats, full-range export fetch, v2 Grid CSV export button); timezone fix + dual-display; smart OT eligibility; DA PM schedule-aware formula; v2.7.3 alignment (`netWorkedHours`, `lateHours`, DA segment fields, `rawOtMinutes`); OT button zero-value fix; pre-schedule context; hours breakdown UI redesign (plain list, orange-only accents); **full server-side OT alignment** — client pipeline (`grossMins` → `netMins`) removed, `netWorkedHours`/`rawOtMinutes` read directly, `periodHours` unified formula, `workedPastSchedule` dead code removed, `leaveBalanceUpdated` socket listener added |
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/Punch.jsx` | Location restriction priority check, proactive status check on mount, 60 s auto-refresh, status badge, status banner with Recheck/Retry, punch button disabled/labelled when outside; fixed endpoint `/api/location/assigned`; added `useCallback`, `getDistance` haversine helper |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | Default date range, `pendingDates` + Apply button, removed "Load More", page-only pagination, v2 Grid CSV export with full-range fetch and enrichment pipeline; timezone-aware `getDefaultFrom`/`getDefaultTo`; filters/pendingDates re-initialized post-bootstrap; dropped `GET /api/overtime` parallel fetch, reads `t.overtime[0]` directly; timezone pill + Globe tooltip + `DualTimeDisplay` priority corrected (company HQ primary); `DriverAideBreakdown` — `companyTimezone` prop, pre-schedule gap note, schedule time hints, OT row, `daRawOtHours`; `toLocalMinutes` utility added; **full server-side OT alignment** — `computePMHours` dead code removed, orphan `};` parse error fixed, `toLocalDateStr` added, OT logic replaced with full `overtime[]` array reduce, stale deps cleaned from useCallback/useEffect |
| `lib/exports/punchLogs.js` | Added `exportPunchLogsCSV_v2` — single-employee DayCare payroll grid CSV |
| `lib/exports/employeePunchLogs.js` | Added `exportEmployeePunchLogsCSV_v2` — multi-employee DayCare payroll grid CSV |
| `CHANGELOG_SERVER.md` | Added Change 8: `GET /api/timelogs/user` query param + response shape spec |
| `components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyConfigurations.jsx` | Added `shiftAssignmentWindowMinutes` field to DayCare Settings card; added `AutoClockOutCard` with `autoClockOutWarningHours`, `autoClockOutGraceHours`, `autoClockOutNotifyEmails` chip input |
| `components/Dashboard/DashboardContent/CompanyPanel/Organizations&People/Employees.jsx` | DayCare Driver Schedule toggle in Edit modal; green `Car` icon in table and View Details |
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/Punch.jsx` | Replaced job-title `isDriver` string check with `employmentDetail.isDriver` flag; added `shiftAssignmentWindowMinutes` with snap-to-schedule logic; Early Clock-In modal and Late Clock-Out modal for DayCare non-drivers |
| `components/common/NotificationBell.jsx` | Added `CLOCK_OUT_WARNING` to notification config map; persistent `toast.warning` (no auto-dismiss) for time-sensitive clock-out prompt |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx` | `canAct` gate on Approve/Reject in table actions and detail dialog footer; Delete action removed; two-step approval UI (`requireSecondApproval` checkbox + escalateTo dropdown); `fetchCompanySettings` + `fetchApprovers` bootstrap; `closeActionDialog` helper |
| `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx` | `socketService` imported; `leaveBalanceUpdated` socket listener wired to `fetchBalances()` for real-time balance refresh |
| `lib/exports/employeePunchLogs.js` | Date centering fix (day number above Regular column); `employeeCode` from server field with `userId` fallback; `employeeRole` replacing punch-type `resolveType`; column header "Type" → "Role"; `resolveType` helper removed |

---

### Navbar — Hide BizBuddy Logo When Sidebar Is Open

> `components/Partial/Navbar.jsx`

- Logo in the top navbar is now hidden on dashboard routes when the sidebar is open, since the sidebar already displays the BizBuddy logo. Prevents the duplicate logo appearing side-by-side.
- Hide/show animates with Framer Motion `AnimatePresence` (opacity fade, 150 ms).
- `sidebarOpen` state added to `useAuthStore` (`store/useAuthStore.js`) and synced from `DashboardLayoutClient` via `setSidebarOpen`. Allows `Navbar` (in root layout) to read sidebar state without prop drilling.
- `{hideLogo && <div />}` placeholder preserves `justify-between` flex layout when the logo is hidden.

---

### Company Leave Requests — Real-time Leave Credits

> `CompanyPanel > Punch Logs & Overtime & Leaves > Leave Requests` (`/dashboard/company/leave-requests`)
> `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx`

Approvers previously had no visibility into an employee's leave balance when reviewing a request.

- **Leave Credits card** — the request detail dialog now shows a "Leave Credits" card listing all leave types with Credits / Used / Available columns. The requested leave type is highlighted with a `▶` indicator.
- **Approve/Reject dialog** — focused balance card shows only the requested leave type's balance with a red warning when the request exceeds the employee's available credits.
- **Data source** — credits are fetched from `GET /api/leave-balances/matrix` + `GET /api/leave-policies`, keyed by employee email into a `matrixByEmail` map for O(1) lookup per row.
- Loading state (`matrixLoading`) prevents stale data from rendering while the matrix fetch is in-flight.

---

### Employee Punch Logs — Timezone Display Fix

> `EmployeePanel > Time Keeping > Punch Logs` (`/dashboard/employee/punch-logs`)
> `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`
> `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/ContestDialog.jsx`

All dates and times were rendering in the browser's local timezone (e.g. Manila PHT) instead of the company's configured timezone (e.g. America/Los_Angeles PDT). For a San Diego company viewed from Manila, times were off by 15 hours.

#### Root cause

- **UTC date slice bug** — `timeIn.slice(0, 10)` extracts the UTC date. Punches made after 5 PM PDT cross midnight UTC, producing the next day's date. Used in schedule matching and duplicate detection.
- **Browser locale rendering** — `toLocaleTimeString(undefined, {...})` renders in the viewer's browser timezone, not the company timezone.
- **`ContestDialog` naive string parsing** — `toLocalTimeInput` used `d.getHours()`/`d.getMinutes()` (browser local); `buildISO` used browser locale for date extraction.

#### Fix

- `companyTimezone` state fetched from `GET /api/company-settings` (`j.data?.timezone`, IANA string e.g. `"America/Los_Angeles"`).
- `safeDate(d, tz)` / `safeTime(d, tz)` helpers updated to pass `timeZone: tz` explicitly to all `toLocaleDateString` / `toLocaleTimeString` calls.
- `toLocalDateStr(d, tz)` uses `toLocaleDateString("en-CA", { timeZone: tz })` (returns `YYYY-MM-DD` in company timezone) — replaces all `.slice(0, 10)` usages.
- Default date range (`getDefaultFrom` / `getDefaultTo`) now computed in company timezone.
- `tzInitialized` ref guard prevents a double-fetch when `companyTimezone` resolves and resets `queryParams`.
- `ContestDialog` — `toLocalTimeInput` and `buildISO` rewritten to use `companyTimezone` for all time extraction and ISO construction.

---

### Employee Punch Logs — Dual Timezone Display

> `EmployeePanel > Time Keeping > Punch Logs`
> `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`

When the viewer's browser timezone differs from the company timezone, the Time In and Time Out columns now show both times stacked:

```
9:25 AM          ← company timezone (primary, full weight)
12:25 AM PHT     ← viewer's local timezone (secondary, muted, smaller)
```

- Detection: `companyTimezone !== userTimezone` (`Intl.DateTimeFormat().resolvedOptions().timeZone`). If same, no secondary row is shown.
- `getTzAbbr(d, tz)` helper uses `Intl.DateTimeFormat` with `timeZoneName: "short"` for DST-aware abbreviations (e.g. PDT in summer, PST in winter).
- `DualTime` component renders the stacked layout; falls back to plain text when no difference detected.
- Company timezone is always the source of truth. The secondary row is a viewer convenience only.

---

### Employee Punch Logs — Export Timezone Fix (CSV / PDF / Grid)

> `lib/exports/punchLogs.js`

All three export functions were rendering times in the browser/server local timezone instead of the company timezone.

- `exportPunchLogsCSV`, `exportPunchLogsPDF`, `exportPunchLogsCSV_v2` — each now accepts a `timezone` parameter (default `"UTC"`).
- All `toLocaleTimeString([])` calls replaced with `toLocaleTimeString("en-US", { ..., timeZone: tz })`.
- All `log.timeIn?.slice(0, 10)` date extractions replaced with `toLocaleDateString("en-CA", { timeZone: tz })`.
- `PunchLogs.jsx` passes `timezone: companyTimezone` to all three export call sites.
- Exports always use company timezone only — no dual display in documents.

---

### Employee Punch Logs — Smart OT Detection (Schedule-Aware Eligibility)

> `EmployeePanel > Time Keeping > Punch Logs`
> `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`

Previously, OT eligibility was determined purely by a flat hour threshold (e.g. worked > 8h → "No Approval"). This missed cases where employees with shorter scheduled shifts worked overtime relative to their schedule, and incorrectly flagged DA employees as always eligible.

#### New helpers

- `toLocalMinutes(isoStr, tz)` — converts a real UTC timestamp to minutes-since-midnight in the company timezone.
- `workedPastSchedule(timeOut, scheduleList, companyTimezone)` — compares clock-out (company local time) against the latest `shift.endTime` across all shifts for that day. Shift times are stored as Prisma `@db.Time` values wrapped as `1970-01-01THH:MM:00Z` (UTC hours = local clock value per Option A storage). Returns `true` if the employee clocked out past their scheduled end.

#### OT eligibility logic

- `scheduleList` is now computed **before** `otStatus` inside `logsWithSchedule` so it can be used in the OT check.
- `otEligible = pastSchedule || rawOtMins > 0` — schedule-aware, with the hour threshold as a fallback when no shift is assigned for that day.
- **DA_AM** — no OT ever. `otStatus` always `"—"`.
- **isDA (full day)** — no manual OT button. Server-side Smart OT Detection handles full-day DA overtime (multi-segment calculation is too complex for client-side). `otStatus` stays `"—"` in All Logs view.
- **DA_PM** — OT button shown only when `otEligible` is true (worked past scheduled end). Previously always showed "No Approval".
- **REGULAR** — OT button shown only when `otEligible` is true.
- **Smart-detected logs** (`otStatus === "Detected"`) — converted to `"No Approval"` so the Request button appears. Previously, smart view was read-only with no actionable button.

#### Server-side flags for backend team

- `calculateLateHours` in `overtimeController.js` uses `getHours()` (server local time — unpredictable). Same function in `timeLogController.js` uses `getUTCHours()` (treats shift times as actual UTC — wrong for `@db.Time` Option A storage). Both need the `combineDateWithTimeTz` fix.
- OT cancel endpoint needed: `PATCH /api/overtime/:id/cancel` restricted to the original requester (`requesterId === req.user.id`) when `status === "pending"`. Currently only admin/supervisor/superadmin can delete OT requests — employees have no way to withdraw a pending submission.

---

### Employee Punch Logs — DA Hours Breakdown: Schedule-Aware PM Calculation

> `EmployeePanel > Time Keeping > Punch Logs`
> `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`

Previously, Driver/Aide PM hours were derived by subtracting fixed AM and Regular constants from `netMins` (total net worked time). This produced incorrect PM values when the employee's actual clock-out didn't align with the assumed fixed constants, and failed to reflect the real time elapsed from the end of the Regular shift.

#### Change

- **PM hours formula updated** for both `isDA` (full day) and `isDA_PM`:
  - **Before**: `PM = (netMins / 60) − AM_fixed − Regular_fixed + approvedOT`
  - **After**: `PM = toLocalMinutes(clockOut, tz) − regularShiftEndMins + approvedOT`
  - `regularShiftEndMins` is derived from the first `scheduleList` entry whose `shift.shiftName` contains `"regular"` (case-insensitive), reading `getUTCHours() * 60 + getUTCMinutes()` per Option A storage.
  - Falls back to the old formula if no Regular shift is found in `scheduleList` for that day.
- **`scheduleList` hoisted** — moved before the DA hours block in `logsWithSchedule` so the same schedule data feeds both the PM formula and the OT eligibility check.
- **`isDA_AM` unchanged** — AM = 1.25h fixed; Regular = remainder derived from `netMins`. No schedule lookup needed (early clock-in is not possible; AM is always 1.25h).
- **`fetchExportData` mirrored** — same schedule lookup and timestamp formula applied to the export path.

#### Deferred: `paidBreak` lunch alignment

The server already gates lunch deduction on `department.paidBreak` in `importClockHoursController` and `cutoffPeriodController`. The client does not yet read this flag — `netMins` always deducts `minLunchMins` regardless. This makes the client's Regular and total hours inconsistent with server payroll when `paidBreak = true`.

The fix is a one-liner once prioritised:
```js
// GET /api/account/profile already returns employmentDetail → department
const paidBreak = user.employmentDetail?.department?.paidBreak ?? false;
const lunchDeduction = paidBreak ? 0 : lunchMinsVal;
const netMins = Math.max(0, grossMins - lunchDeduction - excessCoffeeMins);
```
No extra endpoint needed — `paidBreak` is already in the profile response.

---

### Punch — Early Clock-In & Late Clock-Out Modals (DayCare Exclusive)

> `EmployeePanel > Time Keeping > Punch` (`/dashboard/employee/punch`)
> `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/Punch.jsx`

#### Driver Detection — Replaced Job Title String with `isDriver` Flag

- **Before:** `isDriver` was derived by string-matching `employeeInfo.jobTitle?.toLowerCase() === "driver"` — fragile and unreliable.
- **After:** `isDriver` is read from `employmentRes?.data?.isDriver` (boolean stored in `employmentDetail` on the server). Set via the Driver Schedule toggle in the Edit Employee modal (DayCare only).
- `isDriverOrAide` derived flag removed entirely. `isDayCareNonDriver` simplified to `isDayCare && !isDriver`.

#### Shift Assignment Window — Driver Auto-Snap

- `shiftAssignmentWindowMinutes` state added (default 30), fetched from `settingsRes?.data?.shiftAssignmentWindowMinutes` alongside the existing `driverAideThresholdMinutes`.
- **Driver time-in logic:**
  - If punching within `shiftAssignmentWindowMinutes` before scheduled start → auto-assigns `DRIVER_AIDE` and sets `pendingSnapTimestamp` to the scheduled start ISO string. No modal.
  - If punching outside the window (way early, on-time, or late) → auto-assigns `DRIVER_AIDE` with actual punch time. No modal.
- **Driver time-out:** always routes straight to confirmation as `DRIVER_AIDE`. No modal.
- `pendingSnapTimestamp` — when set, overrides `localTimestamp` in the `/api/timelogs/time-in` request body so the server records the snapped scheduled time instead of the raw attempt time.
- Confirmation dialog shows **"Recognized Time (snapped to schedule)"** with the scheduled start time when snap is active, instead of current time.

#### Early Clock-In Modal (DayCare, non-driver)

- Triggered when `isDayCareNonDriver && minutesEarlyForTimeIn() >= driverAideThresholdMinutes`.
- Presents two options: **Regular Shift** (`REGULAR`) or **Driver / Aide AM** (`DRIVER_AIDE_AM`).
- Employee must select before proceeding to the Confirmation dialog.

#### Late Clock-Out Modal (DayCare, non-driver)

- Triggered when `isDayCareNonDriver && minutesLateForTimeOut() >= driverAideThresholdMinutes`.
- Presents two options: **Regular Shift** (`REGULAR`) or **Driver / Aide PM** (`DRIVER_AIDE_PM`).
- Employee must select before proceeding to the Confirmation dialog.

#### Punch Type Routing Summary

| Employee | Action | Condition | Result |
|---|---|---|---|
| Driver | Time-in | Within shift assignment window | `DRIVER_AIDE` + time snapped to scheduled start |
| Driver | Time-in | Outside window | `DRIVER_AIDE` + actual time |
| Driver | Time-out | Any | `DRIVER_AIDE` + actual time |
| Non-driver | Time-in | Early ≥ threshold | Early Clock-In modal → `DRIVER_AIDE_AM` or `REGULAR` |
| Non-driver | Time-out | Late ≥ threshold | Late Clock-Out modal → `DRIVER_AIDE_PM` or `REGULAR` |
| Any | Time-in/out | No DayCare condition met | `REGULAR` |

---

### Discussed: Grace Period — Recommended Server-Side Implementation

> `EmployeePanel > Time Keeping > Punch Logs`

**No client code changes. Discussion outcome documented for handoff.**

Grace Period (minutes) in company configurations defines an acceptable clock-in/clock-out window around a scheduled shift time (e.g. ±10 min). Within the window, the displayed time snaps to the scheduled time; outside the window, the actual time is shown and early clock-out is flagged.

#### Recommendation: server-side, returning effective timestamps

Grace period affects both display (snap to shift time) and computation (suppress early clock-out / OT flags). Any time a config value influences both display and payroll math, the server should own the interpretation.

**Proposed server contract:** when returning timelogs, compute and include `effectiveTimeIn` / `effectiveTimeOut` alongside the raw timestamps. Raw timestamps are preserved for audit. Client switches to consuming effective timestamps for display and hours computation.

**Why not client-side:** the client would need to apply the grace window consistently across `logsWithSchedule`, `fetchExportData`, the company panel (`EmployeesPunchLogs.jsx`), and exports. More critically, server payroll (`importClockHoursController`, cutoff approval) would not apply the same window unless implemented there too, causing client hours and payroll hours to diverge — the same class of inconsistency as the `paidBreak` issue above.

**Action:** pass to backend team to implement `effectiveTimeIn` / `effectiveTimeOut` in the timelog response.

---

### Employee Punch Logs — Full Server-Side OT Alignment

> `EmployeePanel > Time Keeping > Punch Logs`
> `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`

The `logsWithSchedule` useMemo and `fetchExportData` function previously contained a full client-side OT computation pipeline (`grossMins` → `lunchMinsVal` → `excessCoffeeMins` → `netMins` → `rawOtMins`) that duplicated server logic and diverged from payroll output. The server now returns `netWorkedHours` and `rawOtMinutes` for all punch types including REGULAR.

#### Removed (client-side dead code)

- `workedPastSchedule` function — schedule-aware OT eligibility helper; never called after server-side fields were confirmed.
- `grossMins` / `lunchMinsVal` / `excessCoffeeMins` / `netMins` / `unschedCap` / `inside` local variables — entire derived pipeline replaced by single server field reads.
- `minLunchMins`, `dailyOtThreshold` removed from all `useCallback` and `useEffect` dependency arrays.

#### New formula (unified across all punch types)

```js
const netWorkedHours = parseFloat(log.netWorkedHours ?? 0);
const rawOtMins      = parseFloat(log.rawOtMinutes ?? 0);
const approvedMins   = approvedOTHours * 60;
const unapprovedOtMins = Math.max(0, rawOtMins - approvedMins);
const periodHours    = toHour(Math.max(0, netWorkedHours * 60 - unapprovedOtMins));
```

- `periodHours` now correctly excludes unapproved OT from the displayed worked hours for REGULAR and DA alike.
- `otStatus` is derived from the `overtime[]` array (multi-record reduce) — not from `log.otStatus` which is not a DB field.

#### Socket — `leaveBalanceUpdated` listener

`socketService` imported and a `leaveBalanceUpdated` socket listener added so the leave balance cards update in real-time when an approver acts on a request from another panel, without a manual page refresh.

```js
useEffect(() => {
  const handler = () => fetchBalances();
  socketService.on("leaveBalanceUpdated", handler);
  return () => socketService.off("leaveBalanceUpdated", handler);
}, [fetchBalances]);
```

---

### Company Punch Logs — Full Server-Side OT Alignment

> `CompanyPanel > Punch Logs & Overtime & Leaves > Employee Punch Logs`
> `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

Same migration applied to the company-side punch log panel. The enrichment pipeline was reading only the first OT record (`t.overtime?.[0]`) and computing OT status from a single entry. This missed cases where an employee had multiple OT approvals for a single day.

#### Removed

- `computePMHours` function — dead code, never called after server-side segment fields (`driverAmSegmentHours`, `regularSegmentHours`, `driverPmSegmentHours`) were confirmed.
- Orphan `};` closing brace and stale comment left after `computePMHours` deletion — caused a parse error; both removed.
- `shiftTemplates`, `userDeptMap`, `minLunchMins`, `dailyOtThreshold`, `gracePeriodMins` removed from useCallback/useEffect dependency arrays (all reads are now inside the fetch callback, not in stale closures).

#### Added

- `toLocalDateStr(d, tz)` — timezone-aware date extractor missing from the company-side file:
  ```js
  const toLocalDateStr = (d, tz) => d
    ? new Date(d).toLocaleDateString("en-CA", { timeZone: tz || "UTC" })
    : null;
  ```
  Without this, any code path exercising `toLocalDateStr` threw `ReferenceError` at runtime.

#### OT logic — full array reduce

Replaced single-record read with a full `overtime[]` reduce:

```js
const overtimeArr   = Array.isArray(t.overtime) ? t.overtime : [];
const approvedOTHours = overtimeArr
  .filter(ot => ot.status === "approved")
  .reduce((sum, ot) => sum + (parseFloat(ot.requestedHours) || 0), 0);
const hasPendingOT  = overtimeArr.some(ot => ot.status === "pending");
```

`otStatus` string and `periodHours` formula identical to the employee panel — unified computation.

---

### Grid CSV Export — Date Centering & Employee Code / Role Fields

> `lib/exports/employeePunchLogs.js`

Three visual and data correctness fixes to the multi-employee DayCare payroll grid CSV (`exportEmployeePunchLogsCSV_v2`):

#### Date row centering

Previously the date value (day-of-month number) appeared above the first sub-column (Driver Aide AM). Payroll reviewers expect the date to appear above the middle column (Regular).

- **Before:** `dateRow.push(dayNum, "", "")`
- **After:** `dateRow.push("", dayNum, "")` — day number now sits above the Regular sub-column.

#### Employee Code (not DB ID)

The employee identifier column was emitting the raw database `userId` (UUID). The server now returns `employeeCode` (from `User.employeeId`) on every timelog row.

- `employeeMap` stores `code: log.employeeCode ?? log.userId` — falls back to `userId` if the field is absent for backwards compatibility.
- Data row emits `entry.code` instead of `log.userId`.

#### Employee Role

The "Type" column (formerly emitting punch type via a `resolveType` helper) is replaced with the employee's job title / role.

- `employeeMap` stores `role: log.employeeRole || "—"` from the new `employeeRole` server field.
- Column header renamed: `"Type"` → `"Role"`.
- Data row emits `entry.role`.
- `resolveType` helper function removed — no longer needed.

#### Required server fields

| Field | Source | Notes |
|---|---|---|
| `employeeCode` | `User.employeeId` | Added to `GET /api/timelogs` in this version |
| `employeeRole` | `EmploymentDetail.jobTitle` | Added to `GET /api/timelogs` in this version |

---

### Leave Logs — Real-Time Balance Refresh via Socket

> `EmployeePanel > Leaves > Leave Logs`
> `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx`

Leave balance cards previously required a manual page refresh to reflect changes after a leave request was approved or rejected by an admin from the company panel.

- `socketService` imported following the same pattern used in `NotificationBell.jsx`.
- `leaveBalanceUpdated` socket listener added; fires `fetchBalances()` on every balance-change event pushed by the server.
- Cleanup: listener is removed on component unmount via `socketService.off`.

---

### Company Leave Requests — Two-Step Approval

> `CompanyPanel > Punch Logs & Overtime & Leaves > Leave Requests`
> `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx`

When `multiApprovalEnabled` is on in company settings, a single approve action can optionally escalate the request to a second approver before it is finalized.

#### New state

| State | Type | Purpose |
|---|---|---|
| `multiApprovalEnabled` | `boolean` | Read from `GET /api/company-settings` |
| `approvers` | `array` | List fetched from `GET /api/users?role=admin` (or similar) |
| `requireSecondApproval` | `boolean` | Checkbox in the approve dialog |
| `escalateTo` | `string \| null` | Selected second approver ID |

#### Bootstrap

`fetchCompanySettings` and `fetchApprovers` wired into the existing bootstrap `useEffect`.

#### Approve dialog UX

When `multiApprovalEnabled` is true and the action type is `"approve"`:
- A **Require Second Approval** checkbox appears.
- Checking it reveals a **Select Second Approver** dropdown listing all available approvers.
- The **Approve** button is disabled while `requireSecondApproval` is true but no approver has been selected.

#### API contract

`PUT /api/leaves/:id/approve` body:

```json
{
  "approverComments": "...",
  "escalateTo": "<userId>"   // only present when requireSecondApproval && escalateTo selected
}
```

`escalateTo` is omitted from the body when second approval is not required — backwards-compatible with the existing single-step approve flow.

#### Dialog cleanup

`closeActionDialog()` helper resets `requireSecondApproval` and `escalateTo` alongside the existing comment and type state, preventing stale escalation state from bleeding into subsequent approve/reject actions.

---

### Server Fix Required — `multiApprovalEnabled` Not Persisted

> `CompanyPanel > Settings > Configurations`
> Backend: `PATCH /api/company-settings` handler

`CompanyConfigurations.jsx` correctly includes `multiApprovalEnabled` in the full `draft` payload sent on save. The server responds `200 OK` and the UI toasts "Saved successfully" — but the value reverts on page refresh.

**Root cause:** the `PATCH /api/company-settings` Prisma update block does not include `multiApprovalEnabled` in its field whitelist. The field is silently ignored.

**Fix required (server side):** add `multiApprovalEnabled` to the Prisma update object in the company-settings PATCH handler alongside the other boolean flags (`isDayCare`, `requireApproval`, etc.).

---

### Employee Punch Logs — Server v2.7.3 Alignment: Net Duration & DA Segment Hours

> `EmployeePanel > Time Keeping > Punch Logs`
> `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`

Client-side aligned to server v2.7.3 computed fields. All DA segment math previously done on the client is now removed — the server is the sole source of truth for these values.

#### New server fields consumed

| Field | Type | Description |
|---|---|---|
| `netWorkedHours` | `Decimal` | Net worked hours after breaks deducted — replaces client `rawDuration` |
| `lateHours` | `Decimal` | Late deduction hours |
| `regularSegmentHours` | `Decimal` | Regular shift portion (DA employees) |
| `driverAmSegmentHours` | `Decimal` | Driver/Aide AM segment (DA employees) |
| `driverPmSegmentHours` | `Decimal` | Driver/Aide PM segment (DA employees) |
| `rawOtMinutes` | `Decimal` | Overtime minutes detected server-side |

#### Duration fix

- **Before:** `duration` was computed client-side as `(timeOut - timeIn) / 60` — gross clock-to-clock time with no break deduction.
- **After:** reads `log.netWorkedHours` directly. Falls back to `rawDuration()` only when the field is `null`.

#### DA segment hours fix

- Removed all client-side constants (`DRIVER_AIDE_AM_HOURS = 1.25`, `DRIVER_AIDE_PM_HOURS = 1.25`) and formula-based PM derivation.
- `driverAideAMHours`, `regularHoursForLog`, `driverAidePMHours` now read directly from the server fields above.
- `daRawOtHours` derived from `rawOtMinutes / 60`.

#### OT button fix

- **Before:** OT button appeared when `pastSchedule || rawOtMins > 0` — caused the button to show even at 0.00h when the employee had clocked out past their scheduled end.
- **After:** `otEligible = rawOtMins > 0` for Regular; `(log.rawOtMinutes ?? 0) > 0` for DA. Button only appears when actual OT minutes exist.

#### Decimal coercion

Server returns Prisma `Decimal` fields serialized as strings in JSON. `parseFloat()` applied at all read sites — harmless on plain numbers, corrects string inputs.

---

### Employee Punch Logs — Hours Breakdown: Pre-Schedule Context

> `EmployeePanel > Time Keeping > Punch Logs`
> `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`

When a DA employee clocks in before their scheduled start time, the hours breakdown now surfaces an inline contextual note explaining the gap.

- `schedStartMins` derived from the Regular shift's `startTime` in `scheduleList` (via `getUTCHours() * 60 + getUTCMinutes()` per Option A `@db.Time` storage).
- `preScheduleGapMins = schedStartMins − toLocalMinutes(timeIn, tz)` — computed only when clock-in is before scheduled start.
- Shown as a slim inline `<p>` note above the segment rows: `Clock-in 7:31 AM · 29 min before schedule (8:00 AM), excluded`.
- Time ranges (e.g. `8:00 AM → 1:30 PM`) displayed inline next to each segment label in muted text.

---

### Employee Punch Logs — Hours Breakdown UI Redesign

> `EmployeePanel > Time Keeping > Punch Logs`
> `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`

The expanded row hours breakdown was rebuilt from a multi-color card grid to a clean, minimal list layout.

#### Before

Each segment (DA AM, Regular, DA PM, OT, Total) rendered as an individual colored `<div>` box with border and background (`bg-blue-50`, `bg-purple-50`, `bg-green-50`, `bg-orange-50`). Pre-schedule context was an amber banner box. Visually noisy and inconsistent with the rest of the UI.

#### After

- All colored background boxes removed.
- Each segment is a plain `flex justify-between` row with muted label, optional inline time range, and right-aligned value.
- **Orange** used exclusively for the OT value and Total Net Hours — both actionable / significant figures.
- All other values and labels use `text-muted-foreground`.
- Pre-schedule note replaced with a single `<p className="text-xs text-muted-foreground">` line.
- Separator `<div className="border-t">` before the Total row.
- Coffee / Lunch breaks shown below the separator in `text-xs text-muted-foreground` — clearly secondary.
- Regular (non-DA) breakdown follows the same plain-list pattern.

---

### Company Configurations — Auto Clock-Out Settings

> `CompanyPanel > Settings > Configurations`
> `components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyConfigurations.jsx`

New **Auto Clock-Out** card added to the settings page, rendered after the OT Configuration card. Exposes the three server-side auto clock-out thresholds introduced in server v2.7.3.

| Field | Input type | Step | Description |
|---|---|---|---|
| `autoClockOutWarningHours` | Number | 0.25 | Hours before shift end when the employee receives a warning notification |
| `autoClockOutGraceHours` | Number | 0.25 | Hours after shift end before the system auto-closes the session |
| `autoClockOutNotifyEmails` | Chip/tag input | — | Supervisor email addresses notified when an auto clock-out fires |

- All three fields read from `draft` (populated by `GET /api/company-settings`) and written back on change.
- Saved via the existing `saveSettings` → `PATCH /api/company-settings` flow — no new endpoint.
- Email chip input: type an address and press Enter or click Add; each chip shows an × to remove. Basic `@` validation prevents blank/malformed entries.

---

### Notifications — Auto Clock-Out Warning (Persistent Toast)

> `components/common/NotificationBell.jsx`

- `CLOCK_OUT_WARNING` added to `NOTIFICATION_CONFIG`: `{ title: 'Time to Clock Out', emoji: '⏰' }`.
- Socket `notification` handler intercepts `notificationCode === "CLOCK_OUT_WARNING"` and fires `toast.warning(message, { duration: Infinity, closeButton: true })` — does not auto-dismiss.
- All other notification codes continue to follow the existing bell-update + browser notification path unchanged.

---

### Company Punch Logs — Timezone-Aware Date Defaults

> `CompanyPanel > Punch Logs & Overtime & Leaves > Employee Punch Logs` (`/dashboard/company/punch-logs`)
> `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

Previously, `getDefaultFrom` and `getDefaultTo` always used `new Date().toISOString().slice(0, 10)` — UTC-based regardless of company timezone. For a California company viewed from Manila, the default month range was off by 8 hours, causing the first day of the month to show no records.

- `getDefaultFrom(tz)` / `getDefaultTo(tz)` — rewritten to use `toLocaleDateString("en-CA", { timeZone: tz })`, matching the pattern already used on the employee panel.
- After bootstrap resolves `companyTimezone` from `GET /api/company-settings`, both `filters` and `pendingDates` are immediately re-initialized with timezone-aware defaults so the page loads the correct date range on first render.

---

### Company Punch Logs — Overtime Embedded in Timelog Response

> `CompanyPanel > Punch Logs & Overtime & Leaves > Employee Punch Logs`
> `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

Previously, `fetchTimelogs` made two parallel requests — `GET /api/timelogs` and `GET /api/overtime` — then built an `otMap` client-side to join them by `timeLogId`.

The backend now embeds overtime directly on each timelog row as `overtime[]`, pre-sorted by `updatedAt desc`, with a lean 7-field select: `id`, `status`, `requestedHours` (float), `requesterReason`, `approverComments`, `createdAt`, `updatedAt`.

- **Dropped** the parallel `GET /api/overtime` fetch and the `otMap` build loop entirely.
- `latestOt` now reads `t.overtime?.[0] ?? null` — O(1), no reduce needed (backend pre-sorts).
- All downstream consumers (`otStatus`, `approvedMins`, `overtimeRec`) are unaffected — field names are identical.
- `GET /api/overtime` is preserved for the standalone Overtime Approvals page.
- Added `toLocalMinutes` utility (mirrors employee panel) for timezone-aware minute conversion.

---

### Company Punch Logs — Timezone Display Corrections

> `CompanyPanel > Punch Logs & Overtime & Leaves > Employee Punch Logs`
> `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

Several timezone display elements had the priority inverted — showing the developer's browser timezone (Manila/PHT) as primary and the company timezone (Los Angeles/PDT) as secondary.

- **Orange timezone pill** (Filters card header) — added, matching the employee panel. Shows `{companyTimezone}` city name as primary (e.g. "Los Angeles"); appends `· Detected Time Zone: {userTimezone}` at `opacity-60` only when the viewer's timezone differs from company. Hidden when `companyTimezone === "UTC"`.
- **Globe tooltip trigger** (table card header) — fixed priority: company timezone is now `font-medium text-primary`; detected timezone is `text-muted-foreground opacity-60` and only rendered when timezones differ.
- **`DualTimeDisplay` component** (Time In / Time Out table columns) — fixed priority: company HQ time is now the primary bold line; "Your time: HH:MM" is the secondary muted line. Tooltip also reordered: Company HQ first, Detected second.

---

### Company Punch Logs — Driver/Aide Breakdown Enhancements

> `CompanyPanel > Punch Logs & Overtime & Leaves > Employee Punch Logs`
> `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

The `DriverAideBreakdown` expanded-row component was missing three pieces present on the employee panel.

- **`daRawOtHours`** — added to the enriched log return (`rawOtMins / 60`). Was computed in the enrichment loop but previously discarded.
- **`DriverAideBreakdown`** updated with `companyTimezone` prop:
  - **Pre-schedule gap note** — when the employee clocked in before their scheduled start, an inline muted note appears: `Clock-in 7:45 AM · 15 min before schedule (08:00 AM), excluded`. Derived from `scheduleList` using the same `toLocalMinutes` + `schedStartMins` pattern as the employee panel.
  - **Schedule time hints** — muted time range shown inline on the Regular row (`08:00 AM → 05:00 PM`) and PM row (`05:00 PM → 06:15 PM`). Derived from `fmtUTCTime` on `regularShiftEntry` and `driverPMShiftEntry` in `scheduleList`.
  - **OT row** — orange card row (`AlarmClockPlus` icon) rendered when `(isDA || isDA_PM) && daRawOtHours > 0`, showing time range `{driverPMEndStr} → {safeTime(timeOut, companyTimezone)}` and hours value.
- Call site updated to pass `companyTimezone` to `<DriverAideBreakdown>`.

---

### Company Leave Requests — SV View-Only Access & `canAct` Gate

> `CompanyPanel > Punch Logs & Overtime & Leaves > Leave Requests` (`/dashboard/company/leave-requests`)
> `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx`

#### Root cause (backend)

`GET /api/leaves` previously returned only leaves explicitly directed at the viewer (named approver match). Supervisors and admins who received a leave notification would tap through and see an empty list. The backend now returns all company leave requests for any management role, with a `canAct` boolean on each record indicating whether the viewer is the named approver.

#### Frontend changes

- **`canAct` gate on table actions** — Approve and Reject action buttons now require both a pending status (`pending` or `pending_secondary`) and `canAct === true`. View-only rows (where the viewer is not the named approver) show no action buttons.
- **`canAct` gate on detail dialog footer** — the Approve/Reject buttons in the Leave Request Details modal apply the same `canAct === true` guard. Previously only checked `status`, so view-only viewers saw action buttons they were not authorized to use.
- **Delete action removed** — the Delete action has been removed from the table actions entirely.
