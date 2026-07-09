# Changelog

All notable changes to BizBuddy v2 Client Web are documented here.

---

## [v2.11.0] — 2026-04-22

---

### Calendar Date Timezone Fix — Schedules & Leaves

> `EmployeePanel > Time Keeping > Schedule` (`/dashboard/employee/schedule`)
> `CompanyPanel > Employee Schedules` (`/dashboard/company/employee-schedules`)
> `CompanyPanel > Punch Logs & Overtime & Leaves > Leave Requests` (`/dashboard/company/leave-requests`)
> `EmployeePanel > Leaves > Leave Logs` (`/dashboard/employee/leave-logs`)

#### Bug

Shift assignments and leave dates were rendering on the wrong calendar day for users whose browser timezone is **behind UTC** (any Americas timezone, e.g. US Eastern, Pacific). A shift assigned to Saturday would appear on Friday; a leave request spanning Jan 11–13 would display as Jan 10–12.

#### Root Cause

Date-only fields (`assignedDate` on `UserShift`, `startDate`/`endDate` on `Leave`) are currently serialized by the server as full UTC midnight ISO timestamps (e.g. `"2025-01-11T00:00:00.000Z"`). The client was parsing these with either `parseISO()` (date-fns v3) or `new Date()`, both of which represent the value as UTC midnight. When date-fns `format()` or `.toLocaleDateString()` then rendered the value, it applied the **browser's local timezone offset**, shifting the date backward by one day for any UTC-negative timezone.

The bug was invisible to PH-based users (UTC+8) because the positive offset kept the date within the same calendar day.

#### Client Fix

Standardized all date-only field handling across the four affected files to use timezone-safe patterns:

- **Grouping key** (calendar cell placement) — `shift.assignedDate.slice(0, 10)` extracts the raw `YYYY-MM-DD` string with no Date object construction, making it immune to any timezone offset.
- **Display and comparisons** — `toLocalDate(dateStr)` constructs `new Date(y, m - 1, d)` from the parsed string components, producing local-midnight with no UTC conversion.
- `parseISO(assignedDate)` removed from `Schedule.jsx` and `employee-schedules/page.jsx`; `parseISO` import removed from both files.
- `new Date(startDate)` / `new Date(endDate)` replaced with `toLocalDate()` in all table columns, detail dialogs, action dialogs, and delete dialogs in `EmployeesLeaveRequests.jsx` and `LeaveLogs.jsx`.
- Stale `start.setHours(0,0,0,0)` / `end.setHours(0,0,0,0)` workarounds removed — `toLocalDate()` already produces midnight.
- Incorrect time display (` at HH:MM`) removed from the action dialog start/end fields in `EmployeesLeaveRequests.jsx` — `startDate`/`endDate` are date-only values and carry no meaningful time component.

The client fix is **backwards compatible** with both the old server format (`"...T00:00:00.000Z"`) and the upcoming plain-date format (`"YYYY-MM-DD"`) because `.slice(0, 10)` and `toLocalDate()` work correctly with either.

#### Server Fix Required

> See `CHANGELOG_SERVER.md` — Change 7

The long-term fix is for the server to serialize date-only fields as plain `YYYY-MM-DD` strings (no time, no `Z`). This removes timezone ambiguity at the source and is consistent with how these values are semantically meant to be used (calendar dates, not instants in time).

| API | Field | Current | Required |
|---|---|---|---|
| `GET /api/usershifts` (all variants) | `assignedDate` | `"2025-01-11T00:00:00.000Z"` | `"2025-01-11"` |
| `GET /api/leaves`, `GET /api/leaves/my`, `POST /api/leaves/submit` | `startDate`, `endDate` | `"2025-01-11T00:00:00.000Z"` | `"2025-01-11"` |

`createdAt`, `updatedAt`, `timeIn`, `timeOut`, and all `shift.startTime` / `shift.endTime` fields are true datetimes and must remain as full ISO timestamps — do **not** change those.

#### Modified Files

| File | Change |
|---|---|
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/Schedule.jsx` | Removed `parseISO` import; added `toLocalDate` helper; `.slice(0,10)` for `shiftsByDate` grouping key; `toLocalDate()` for `isSameMonth` filter and table date display |
| `app/dashboard/company/employee-schedules/page.jsx` | Same as above |
| `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx` | Added `toLocalDate` helper; replaced `new Date(startDate/endDate)` in table Date Range column and detail dialog with `toLocalDate()` |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx` | Replaced all remaining `new Date(startDate/endDate)` usages across table column, detail dialog, action dialog (including duration calc and leave credits calc), and delete dialog with `toLocalDate()`; removed incorrect time display from action dialog date fields |
| `CHANGELOG_SERVER.md` | Added Change 7: date-only field serialization spec for `UserShift.assignedDate`, `Leave.startDate`, `Leave.endDate` |

---

### OT Threshold-Status Gate — Punch Logs & OT Configuration

> `EmployeePanel > Time Keeping > Punch Logs` (`/dashboard/employee/punch-logs`)
> `CompanyPanel > Settings > Configurations` (`/dashboard/company/configurations`)

#### Summary

Wired the new server-authoritative `GET /api/overtime/threshold-status` endpoint into the employee Punch Logs view and hardened the OT request flow for weekly/cutoff basis companies. Added a cutoff seed date configuration UI to the OT Configuration card.

---

### Touch Point 2 — PunchLogs.jsx: Threshold-Status Gate

#### Changes

**State**
- Removed dead `isStandaloneOT` / `setIsStandaloneOT` state (was always set to `false`, never read meaningfully).
- Added `thresholdStatus` state — holds the full server response from `GET /api/overtime/threshold-status`.
- Added `otSelectedLogId` state — tracks which log the employee selects in the OT dialog log selector.

**Data fetch**
- Added `fetchThresholdStatus` useCallback hitting `GET /api/overtime/threshold-status`.
- Wired into the mount useEffect alongside the other bootstrap fetches.
- Re-fetches after a successful OT submission so the progress bar stays in sync.

**`otEligible` logic (per-log, inside `logsWithSchedule` memo)**
- `daily` basis: unchanged — `rawOtMins > 0` (server already enforces the daily threshold).
- `weekly` / `cutoff` basis: `thresholdStatus.data.eligible && thresholdStatus.data.logs[].timeLogId includes log.id` — the OT button only appears on logs the server has flagged as eligible within the current period.

**Pre-eligibility progress bar**
- Shown between the OT info card and the Filters card when `otBasis !== "daily"` AND `thresholdStatus.data.eligible === false`.
- Displays accumulated hours vs threshold, period start/end, remaining hours needed.
- Hidden once threshold is crossed (employee is now eligible).

**OT dialog enhancements**
- Log selector dropdown — shown for weekly/cutoff basis when `thresholdStatus.data.logs` has entries; pre-populated with the clicked row's log ID; each option labelled `"Day Mon DD · HH:MM AM/PM · PunchType"`.
- Hours cap — submission is blocked client-side if `requestedHours > thresholdStatus.data.otEligibleHours`; cap is displayed inline next to the OT Hours label.
- Submit body — uses `otSelectedLogId` (from the dropdown) instead of `otForLog.id` for the `timeLogId` field.

---

### Touch Point 3 — CompanyConfigurations.jsx: Cutoff Seed Date

#### Changes

- Added `toLocalDate` and `cadenceLabel` helpers at the top of the `OvertimeConfigCard` module scope (no date-fns import needed).
- Added a **Cutoff Period Seed** section inside `OvertimeConfigCard`, visible only when `basis === "cutoff"`.
  - **Period Start** date input — maps to `draft.cutoffSettings.seedStartDate`.
  - **Period End** date input — derived from `seedStartDate + durationDays - 1`; editing it back-calculates `durationDays`.
  - **Cadence label** badge — Weekly / Bi-weekly / Semi-monthly / Monthly / Every N days based on `durationDays`.
- `cutoffSettings` is nested inside `draft` as `{ seedStartDate, durationDays }` — `saveSettings → JSON.stringify(draft)` picks it up automatically, no extra wiring needed.
- Pre-populated from `draft.cutoffSettings` (populated by `loadSettings → GET /api/company-settings`).

---

### Server Requirements

> See `CHANGELOG_SERVER.md` — Change 7 (already documented)

`GET /api/overtime/threshold-status` must return:

```json
{
  "data": {
    "eligible": true,
    "accumulatedHours": 42.5,
    "threshold": 40,
    "otEligibleHours": 2.5,
    "basis": "weekly",
    "periodStart": "2026-04-14",
    "periodEnd": "2026-04-20",
    "logs": [
      { "timeLogId": "abc123", "date": "2026-04-18", "timeIn": "2026-04-18T08:00:00.000Z", "timeOut": "2026-04-18T18:00:00.000Z", "netWorkedHours": 10, "punchType": "REGULAR" }
    ]
  }
}
```

`PATCH /api/company-settings` must accept `cutoffSettings: { seedStartDate: "YYYY-MM-DD", durationDays: number }` in the request body.

---

### Modified Files

| File | Change |
|---|---|
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` | Removed `isStandaloneOT`; added `thresholdStatus`, `otSelectedLogId`, `fetchThresholdStatus`; threshold-gated `otEligible` for weekly/cutoff; pre-eligibility progress bar; log selector + hours cap in OT dialog |
| `components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyConfigurations.jsx` | Added `toLocalDate` + `cadenceLabel` helpers; added cutoff seed date section in `OvertimeConfigCard` |

---

### Bug Fixes — Schedule Badge & Dialog (Company Punch Logs)

> `CompanyPanel > Punch Logs` (`/dashboard/company/punch-logs`)
> `EmployeePanel > Time Keeping > Punch Logs` (`/dashboard/employee/punch-logs`)

#### Summary

Fixed "Unscheduled: Uses default company settings" always showing for all logs regardless of employee schedule, and the Schedule Details dialog always showing empty.

---

#### Root Causes & Fixes

**1. `isScheduled` hardcoded to `false` in both views**

Both `PunchLogs.jsx` and `EmployeesPunchLogs.jsx` had `isScheduled: false` hardcoded in their log enrichment — the badge, G-1 amber flag icon, and amber row highlight were firing for every log.

- `PunchLogs.jsx` (employee view): fixed to `isScheduled: scheduleList.length > 0` — `scheduleList` was already correctly computed from `userShifts` filtered by date.
- `EmployeesPunchLogs.jsx` (company view): fixed to `isScheduled: !!(t.shiftToday)` — uses the `shiftToday` field now returned by the server.

**2. `shiftName` field mismatch (company view)**

The client was reading `t.shiftName` but the server returns `t.shiftToday`. Fixed to `shiftName: t.shiftToday || "—"` so the Shift field in the detail panel displays correctly.

**3. `scheduleList` hardcoded to `[]` (company view)**

The Schedule Details dialog was always empty because `scheduleList: []` was hardcoded. Fixed to use `t.userShifts` (full array of all shifts for that day) with `t.userShift` as a backwards-compat fallback.

**4. Duplicate shifts in dialog (DA employees)**

DA employees with multiple shifts (AM + Regular + PM) were seeing each shift appear twice. Root cause: the server's batch query was returning multiple `UserShift` rows pointing to the same `Shift` definition; the dedup was keying on `UserShift.id` instead of `Shift.id`.

- Server fix: dedup guard changed from `x.id === s.id` to `x.shift.id === s.shift.id`; `shift.id` added to payload.
- Client guard: dedup key changed to `s.shift?.id || s.id` — resilient against any future duplicate regardless of origin.

---

### Server Requirements (added)

See `CHANGELOG_SERVER.md` — Change 8

`GET /api/timelogs` must include per log:
- `shiftToday` — joined shift name string (e.g. `"Regular Shift, Driver Aide PM"`); `null` if unscheduled
- `userShift` — first matched `UserShift` + `Shift` object; `null` if unscheduled (backwards compat)
- `userShifts` — deduplicated array of all matched `UserShift` + `Shift` objects for that date; `[]` if unscheduled

Dedup key on `shift.id` (not `UserShift.id`).

---

### Additional Modified Files

| File | Change |
|---|---|
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` | `isScheduled: false` → `isScheduled: scheduleList.length > 0` |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | `isScheduled: !!(t.shiftToday)`; `shiftName` reads `t.shiftToday`; `scheduleList` populated from `t.userShifts` with client-side dedup by `shift.id` |
| `CHANGELOG_SERVER.md` | Added Change 8: `shiftToday`, `userShift`, `userShifts` fields on `GET /api/timelogs` |

---

### Leave Request Details — Name & Approver Fields

> `CompanyPanel > Punch Logs & Overtime & Leaves > Leave Requests` (`/dashboard/company/leave-requests`)

#### Summary

Enhanced the Leave Request Details modal and fixed a permission leak in the Calendar view.

#### Changes

**Detail modal — Employee name**
- Added a **Name** row above Email in the Employee Information section.
- Resolves `requester.name` first (server pre-computed field), then `requester.profile.firstName/lastName`, then bare `firstName/lastName` as fallback.
- Row is hidden if no name data is returned.

**Detail modal — Approver section**
- Added an **Approver** card (indigo) below Employee Information, visible only when `request.approver` is present.
- Displays `approver.name` (server pre-computed) with `approver.email` as fallback.
- Secondary approver row is wired but will remain hidden until the server adds the Prisma relation for `secondaryApproverId`.

**Calendar view — Approve/Reject button gate**
- The Approve/Reject buttons and "Awaiting your approval" hint text in the calendar day panel were shown based on `leave.status` alone — missing the `canAct` check that the table view already had.
- Fixed to require `leave.canAct === true`, consistent with table view action conditions.

#### Server Requirements

`GET /api/leaves` (both `getPendingLeavesForApprover` and `getLeavesForApprover`) must include per leave record:
- `requester.name` — pre-computed display name (`firstName + lastName`, falling back to `username`)
- `approver` — object with `id`, `email`, `role`, `name` (pre-computed); `null` if no approver assigned

#### Modified Files

| File | Change |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx` | Added Name row to detail modal Employee Information; added Approver card to detail modal; added `canAct` gate to calendar view Approve/Reject buttons |

---

### Auto-Break Policy — Company Configurations, Shifts, Punch Logs

> `CompanyPanel > Settings > Configurations` (`/dashboard/company/configurations`)
> `CompanyPanel > Shifts & Schedules > Shifts` (`/dashboard/company/shifts`)
> `CompanyPanel > Punch Logs` (`/dashboard/company/punch-logs`)
> `EmployeePanel > Time Keeping > Punch Logs` (`/dashboard/employee/punch-logs`)

#### Summary

Implemented client-side configuration for server-side auto-break injection. When enabled, the server injects lunch and/or coffee break records into a time log at clock-out rather than requiring manual employee entry. Two fully independent systems now coexist:

| System | Trigger | Fields used | Purpose |
|---|---|---|---|
| Auto-break injection (new) | At clock-out | `autoBreakLunch*`, `autoBreakCoffee*` per dept/shift | Inject break records for paper trail |
| Break policy enforcement (existing) | At cutoff processing | `paidBreak`, `coffeeBreakMaxCount`, `coffeeBreakMinutes`, `coffeeBreakPaid` per dept | Determine payable hours deductions |

The existing Department Lunch Break Policy and Department Coffee Break Policy cards are unchanged and still required — they govern separate server logic at cutoff time.

---

#### Auto-Break Policy Card (new) — Company level

Added `AutoBreakPolicyCard` to `CompanyConfigurations.jsx`. Controls three company-wide fields saved via `PATCH /api/company-settings`:

| Field | Type | Description |
|---|---|---|
| `autoLunchEnabled` | boolean | Master switch — enable auto-lunch injection company-wide |
| `autoCoffeeEnabled` | boolean | Master switch — enable auto-coffee injection company-wide |
| `autoBreakBasis` | `"department"` \| `"shift"` | Whether injection config is read per-department or per-shift |

- Toggles instant-save on change.
- `autoBreakBasis` selector is hidden when both master switches are off.
- Info callout explains that enabling here arms the system; entitlement is still configured per department or per shift below.

---

#### Department-level Auto-Break Config — embedded in existing cards

Both existing department policy cards were extended with an auto-break injection config block per department row. The block is gated: only visible when `autoBreakBasis === "department"` and the relevant master switch is on.

**Auto-Lunch Injection block** (inside `DepartmentBreakPolicyCard`):

| Field | Type | Default | Description |
|---|---|---|---|
| `autoLunchEntitled` | boolean | `false` | Whether this dept receives auto-injected lunch |
| `autoBreakLunchMinutes` | number | `60` | Duration of injected lunch (minutes) |
| `autoBreakLunchAfterHours` | number | `5` | Minimum worked hours before injection triggers |
| `autoBreakLunchDeductible` | boolean | `false` | Whether injected lunch is deducted from net hours |

**Auto-Coffee Injection block** (inside `DepartmentCoffeeBreakPolicyCard`):

| Field | Type | Default | Description |
|---|---|---|---|
| `autoCoffeeEntitled` | boolean | `false` | Whether this dept receives auto-injected coffee breaks |
| `autoBreakCoffeeCount` | number | `2` | Number of coffee breaks to inject |
| `autoBreakCoffeeMinutes` | number | `15` | Duration per injected break (minutes) |
| `autoBreakCoffeeDeductible` | boolean | `false` | Whether injected coffee time is deducted from net hours |

- `autoLunchEntitled` / `autoCoffeeEntitled` toggles instant-save (`PUT /api/departments/update/:id`).
- Number inputs save `onBlur`.
- Deductible toggle instant-saves with its own correctly-keyed loading state (`autobreak_autoBreakLunchDeductible_${id}` / `autobreak_autoBreakCoffeeDeductible_${id}`).
- Preview cell shows `{minutes}m after {afterHours}h` (lunch) or `{count} × {minutes}m` (coffee).

---

#### Shift-level Auto-Break Config — edit modal

`Shifts.jsx` extended to load `autoBreakBasis`, `autoLunchEnabled`, `autoCoffeeEnabled` from `GET /api/company-settings` and populate per-shift entitlement from `GET /api/shifts`.

An **Auto-Break Config** section is appended to the existing edit modal, gated on `autoBreakBasis === "shift" && (autoLunchEnabled || autoCoffeeEnabled)`. All 8 entitlement fields (same fields as department level above) are wired into `editForm` state and saved with the existing Save Changes button via `PUT /api/shifts/:id`.

---

#### "Auto" badge — Punch Log views

When a time log has `autoLunchApplied === true` or `autoCoffeeApplied === true` (server-set flag), or when individual break objects inside `lunchBreak` / `coffeeBreaks` JSON carry `auto: true`, a small **Auto** badge is shown:

- **Company punch logs** (`EmployeesPunchLogs.jsx`): badge appears in the Coffee and Lunch table columns, and in the Break Times section of the expanded row detail.
- **Employee punch logs** (`PunchLogs.jsx`): badge appears in both the deducted-breaks block and the regular breakdown section of the expanded row detail.

---

#### Server Requirements

`GET /api/company-settings` must return `autoBreakBasis`, `autoLunchEnabled`, `autoCoffeeEnabled`.

`PATCH /api/company-settings` must accept those three fields.

`GET /api/departments` must return per department: `autoLunchEntitled`, `autoBreakLunchMinutes`, `autoBreakLunchAfterHours`, `autoBreakLunchDeductible`, `autoCoffeeEntitled`, `autoBreakCoffeeCount`, `autoBreakCoffeeMinutes`, `autoBreakCoffeeDeductible`.

`PUT /api/departments/update/:id` must accept any subset of those 8 fields.

`GET /api/shifts` must return the same 8 fields per shift.

`PUT /api/shifts/:id` must accept all 8 fields in the request body.

`GET /api/timelogs` must include `autoLunchApplied` and `autoCoffeeApplied` boolean flags per time log. Individual break entries inside `lunchBreak` and `coffeeBreaks` JSON should carry `auto: true` when server-injected.

---

#### Modified Files

| File | Change |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyConfigurations.jsx` | Added `AutoBreakPolicyCard`; extended `DepartmentBreakPolicyCard` and `DepartmentCoffeeBreakPolicyCard` with per-department auto-break injection config blocks; added `departmentAutoBreakEntitlement` state and `updateDepartmentAutoBreakConfig` function; fixed deductible toggle loading keys in both cards |
| `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/Shifts.jsx` | Added auto-break company settings fetch; added `shiftAutoBreakEntitlement` state; populated and saved all 8 auto-break fields through the edit modal |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | Added "Auto" badge to Coffee and Lunch table cells and break times expanded detail |
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` | Added "Auto" badge to deducted-breaks block and regular breakdown in expanded detail |
