# Changelog — v2.13.0

Client-side implementation of the v2.8.x server API contract. Covers the `companyType`-gated time log columns, the four-button cutoff approval model (B&C only), automatic OT blocks, the per-punch reset flow, and the shift picker.

---

## Change 1 — EmployeesPunchLogs: `companyType`-Gated Column Visibility

**Status:** Shipped (client only).

**Server contract:** `GET /api/timelogs` and `GET /api/timelogs/user` now return a `companyType` field in the response envelope (`"BNC"` or `"DAYCARE"`). Client must use this field to drive all column visibility — no hardcoded company IDs.

**Client side:** `EmployeesPunchLogs.jsx`.

- `fetchTimelogs()` reads `tlJ.companyType` and stores it in `companyType` state. `isDayCare` is derived as `companyType === "DAYCARE"`.
- `columnOptions` adds the `ot` and `otStatus` columns conditionally: `...(isDayCare ? [{ value: "ot" }, { value: "otStatus" }] : [])`.
- A `useEffect` on `[isDayCare, companyType]` strips `ot` and `otStatus` from `columnVisibility` whenever the company is non-DayCare, so they are never displayed for B&C.
- Per-punch shift label uses `t.userShift?.shift?.shiftName ?? "—"` (not `shiftToday` — which returns all shifts for the day and is unsuitable as a per-punch label).
- `scheduleList` enrichment deduplicates across `t.userShifts` and `t.userShift` so the schedule detail modal shows the correct full-day shift list for both company types.
- DA segment fields (`driverAmSegmentHours`, `regularSegmentHours`, `driverPmSegmentHours`, `rawOtMinutes`) are read from the server and stored on the enriched row. They are only non-null for DayCare Driver/Aide punches — B&C rows always have them as `null` or `undefined`.

**Column visibility by company type:**

| Column | BNC | DayCare |
|---|---|---|
| Duration, Gross, Scheduled, Late, Undertime, Lunch/Coffee | ✓ | ✓ |
| Shift (per punch) | ✓ | ✓ |
| Regular / Driver AM / Driver PM Segment | ✗ | ✓ (in expanded detail view) |
| Overtime (per punch) / OT Status | ✗ | ✓ |

---

## Change 2 — CutoffReview: `isBNC` from Approvals Envelope

**Status:** Shipped (client only).

**Server contract:** `GET /api/cutoff-periods/:id/approvals` returns `isBNC: boolean` in the envelope. Client must read this field — not `companyType` from any other endpoint — to gate all B&C-specific UI.

**Client side:** `CutoffReview.jsx`.

- `fetchData()` reads `approvalsData.isBNC === true` as `isBNCLocal` immediately after the fetch resolves. This local constant is passed directly to `buildDetails(approval, tz, isBNCLocal)` in the same synchronous pass — reading the React state `isBNC` here would give a stale value since `setIsBNC` is async.
- `setIsBNC(isBNCLocal)` is also called to persist the value for subsequent action handlers (`doApprove`, `confirmExclude`, `doBulkApprove`, `doReset`, `doOTBlock`).
- `companyTimezone` is resolved from `approvalsData.companyTimezone` first, falling back to `company-settings` — consistent with the server's own fallback order.
- `dailyOtThresholdHours` is read from `approvalsData.dailyOtThresholdHours ?? 8` and stored for OT block row labels.

---

## Change 3 — CutoffReview: Four-Button Approval Model (B&C Only)

**Status:** Shipped (client only).

**Server contract:** Single approval action `PATCH /api/cutoff-periods/:id/approvals/:approvalId` now accepts an `approvalMode` field (`"schedule"` | `"raw"` | `"edit"`). B&C requires `shiftId` when `approvalMode: "schedule"`. DayCare continues to use a single approve with no `approvalMode`.

**Client side:** `CutoffReview.jsx`.

- `buildDetails()` sets the `actions` array based on `isBNC` and `isSegment`:
  - **BNC regular punch:** `["approve-schedule", "approve-raw", "edit", "exclude"]`
  - **BNC driver segment** (`segmentType !== null`): `["approve-raw", "edit", "exclude"]` — shift picker is suppressed for segments since their times are already authoritative
  - **DayCare:** `["approve"]` (plus `"approve-ot"` when applicable), `"edit"`, `"exclude"`
  - **Conflict rows (all types):** `["honor-punch", "honor-leave"]`
- `doApprove(recId, options)` builds the PATCH payload dynamically: sets `approvalMode` when provided, appends `shiftId` for schedule mode, appends `editedClockIn` / `editedClockOut` for edit mode, and passes `notes` when present. `withOT` is still accepted but is DayCare-only and ignored by the server for B&C.
- `TimelineRow`, `PunchSubRow`, and `DriverSegmentRow` render each button conditionally from `rec.actions` — no inline `isBNC` checks in the view layer.
- OT tag (`cls: "ot"`) in `buildDetails` is guarded by `!isBNC` — B&C `rawOtMinutes` is always `null` by server design.

---

## Change 4 — CutoffReview: Shift Picker (B&C Approve Schedule)

**Status:** Shipped (client only).

**Server contract:** Each approval record in the GET response includes `availableShifts: [{ id, shiftName, startTime, endTime }]` — shifts assigned to the employee on the punch date. May be `[]`. Not present for DayCare.

**Client side:** `CutoffReview.jsx`.

- `buildDetails()` stores `approval.availableShifts || []` on each record object.
- `handleApproveSchedule(rec)` is the entry point for the Schedule button:
  - **Empty `availableShifts`** → fires a warning toast: *"No shift assigned for this date — use Approve Raw Time instead."* No modal opens.
  - **Single shift** → calls `doApprove(rec.id, { approvalMode: "schedule", shiftId: shifts[0].id })` directly — no picker needed.
  - **Multiple shifts** → computes `usedShiftIds` by scanning all sibling records on the same date for already-approved punches with a tracked `usedShifts` entry, then opens `shiftPickerModal` with `{ recId, shifts, usedShiftIds, timeIn, timeOut }`.
- `usedShifts` state (`{ [recId]: shiftId }`) is updated optimistically when a Schedule approval completes and is rolled back on failure.
- The shift picker modal renders each shift as a selectable card showing the shift name and formatted time window (`fmtShiftTime` handles both `"HH:mm"` time-only strings and full ISO strings). Shifts present in `usedShiftIds` are visually grayed out with an "Already used" badge.
- `fmtShiftTime()` (module-level helper): time-only strings (`/^\d{1,2}:\d{2}$/`) are parsed locally without timezone conversion; ISO strings fall back to `timeZone: "UTC"`.

---

## Change 5 — CutoffReview: OT Block Rows (B&C Only)

**Status:** Shipped (client only).

**Server contract:** `GET /api/cutoff-periods/:id/approvals` returns `otBlocks: CutoffOtBlock[]` in the envelope — always `[]` for DayCare. Each block has `{ id, userId, date, otHours, status }`. Blocks are computed server-side from approved punch totals vs. `dailyOtThresholdHours`; the client must never compute them. OT block action: `PATCH /api/cutoff-periods/:id/ot-blocks/:otBlockId` with `{ action: "approve" | "exclude" }`.

**Client side:** `CutoffReview.jsx`.

- `otBlocks` state holds the full array from the approvals envelope.
- `EmployeeCard` builds `otBlockByDate`: a `{ [formattedDate]: block }` map keyed by the block's date formatted in `companyTimezone`.
- After rendering the last record for a given date, the card checks `otBlockByDate[recDate]` and injects an `<OTBlockRow>` if a block exists. The "last record for a date" check uses `rec.date !== nextRec.date` — driver groups and punch groups expose their date via their first segment/punch.
- `OTBlockRow` component: shows an OT pill, the overtime hours, the threshold, and a status badge. **Approve OT** and **Exclude** buttons are only rendered when `status === "pending"`.
- `localOTBlockStatus` state provides optimistic UI for OT block actions independent of full re-fetch.
- `mergedEmployees` derived state: each employee's `otBlocks` slice is filtered from the global array by `userId`. Pending OT blocks are counted toward `emp.pending` so the employee is not marked Done until OT blocks are also resolved.
- `doOTBlock(blockId, action)` handler: optimistically updates `localOTBlockStatus`, calls `PATCH .../ot-blocks/:blockId`, and rolls back on failure.
- `refreshOTBlocks()`: a lightweight re-fetch of the approvals envelope (`GET .../approvals`) that updates `otBlocks` and `dailyOtThresholdHours` without triggering a full page skeleton. Called after every approval action when `isBNC` is true.

---

## Change 6 — CutoffReview: Per-Punch Reset Button

**Status:** Shipped (client only).

**Server contract:** `PATCH /api/cutoff-periods/:id/approvals/:approvalId/reset` (no body). Clears `status → "pending"`, `actualHours → null`, `approvedClockIn/Out → null`, `approvedBy/At → null`. Raw `timeIn/timeOut` on the TimeLog are never touched. Only `approved` records can be reset; locked/processed cutoff periods return 400. After reset, the OT block for that employee-day is recomputed server-side.

**Client side:** `CutoffReview.jsx`.

- Reset button (`RotateCcw` icon, neutral color) is shown only in the `isLocked` branch of `TimelineRow`, `PunchSubRow`, and `DriverSegmentRow` — and only for the `approved` state (excluded rows show "Excluded" text with no reset button).
- `doReset(recId)` handler:
  1. Adds `recId` to `resetIds` (a `Set`) — this forces `localStatus → null` via the `effectiveStatus` logic in `mergedEmployees`, re-enabling action buttons immediately.
  2. Deletes any optimistic `localStatus[recId]` entry.
  3. Calls `PATCH .../approvals/:recId/reset`.
  4. On failure: removes `recId` from `resetIds` to roll back.
  5. On success (BNC): calls `refreshOTBlocks()` — the OT block for that day may shrink or disappear.
- `effectiveStatus(id, baked)` in `mergedEmployees`: `resetIds.has(id) ? null : localStatus[id] ?? baked` — `resetIds` takes precedence over both optimistic state and the baked-in status from `buildDetails`, preventing the record from re-locking on re-render before a full refetch.

---

## Change 7 — CutoffReview: Bulk Approve Always Raw (B&C)

**Status:** Shipped (client only).

**Server contract:** `PATCH /api/cutoff-periods/:id/approvals/bulk` with `{ action: "approve", approvalMode: "raw", timeLogIds: [...] }`. For B&C, bulk approve always uses raw mode — the shift picker cannot be applied per-record in bulk. OT blocks for all affected employee-days are recomputed automatically.

**Client side:** `CutoffReview.jsx`.

- `doBulkApprove(empId)` collects all approvable records for the employee (those with `approve`, `approve-schedule`, or `approve-raw` in `actions` and no `localStatus`, excluding conflict and unscheduled rows).
- Sends `PATCH .../approvals/bulk` with `approvalMode: "raw"` unconditionally — this is correct for both B&C (forced raw) and DayCare (server applies DayCare snap logic).
- Calls `refreshOTBlocks()` on success when `isBNC` is true.

---

---

## Change 8 — Schedules: Fix `startDate` / `endDate` Off-by-One Display Bug

**Status:** Shipped (server + client).

**Problem:** The Start and End columns in the Shift Schedules table were showing the wrong date — one day earlier than expected — for users in timezones behind UTC (US, etc.). `startDate` and `endDate` were returned as full ISO datetime strings (e.g. `"2025-06-01T00:00:00.000Z"`). Passing these to `new Date(str).toLocaleDateString()` without a timezone causes JavaScript to parse as UTC midnight and then convert to local time, shifting the date back by one day.

**Why server-side:** `startDate` / `endDate` are date-only concepts — a calendar date with no time or timezone component. Fixing the serialization at the source guarantees both web and mobile receive the correct value without each client needing its own workaround.

**Server changes:** All four endpoints that return `ShiftSchedule` records now serialize `startDate` and `endDate` as plain `"YYYY-MM-DD"` strings using `date-fns` `format`. Affected endpoints:

| Method | Path |
|---|---|
| `GET` | `/api/shiftschedules` |
| `GET` | `/api/shiftschedules/:id` |
| `POST` | `/api/shiftschedules/create` |
| `PUT` | `/api/shiftschedules/:id` (4 return points) |

**Client side:** `Schedules.jsx`.

- `fmtScheduleDate(str)` helper added: parses `"YYYY-MM-DD"` via the local Date constructor (`new Date(y, m-1, d)`) — avoids UTC parsing entirely — and formats with `{ month: "short", day: "numeric", year: "numeric" }` for a consistent `"Jun 1, 2025"` display across all locales.
- Table display (Start / End columns): replaced `new Date(str).toLocaleDateString()` with `fmtScheduleDate(str)`.
- Edit form population (`handleEditClick`): replaced `new Date(str).toISOString().split('T')[0]` with `schedule.startDate` directly — server already returns `"YYYY-MM-DD"`, no re-parsing needed.
- `isActive` check (×2 in `filteredSchedules` and inline): replaced `new Date(endDate) >= new Date()` with `endDate >= new Date().toLocaleDateString("en-CA")` — plain `"YYYY-MM-DD"` string comparison, no timezone drift.

---

## Change 9 — EmployeesPunchLogs: Export Employee Summary Respects Table Sort Order

**Status:** Shipped (client only).

**Problem:** The Employee Summary section in the Detail CSV and PDF exports always appeared in insertion order (the order each employee's first punch was encountered while iterating the data). This meant the summary was effectively in date order regardless of how the user had sorted the table — so sorting the table alphabetically before exporting had no effect on the summary section.

**Root cause:** Both `exportEmployeePunchLogsCSV` and `exportEmployeePunchLogsPDF` built `employeeStats` as a plain object and then called `Object.values(employeeStats)` to render the summary. `Object.values` on a plain object returns properties in insertion order, not sort order.

**Fix:** `lib/exports/employeePunchLogs.js`.

- Added an `employeeOrder` array alongside `employeeStats` in both functions. Each `userId` is pushed to `employeeOrder` on first encounter — preserving the order employees appear in `data` (which is `displayed`, the client-side sorted array).
- Replaced `Object.values(employeeStats)` with `employeeOrder.map(id => employeeStats[id])` in the Employee Summary section of both the CSV and PDF functions.

**Behaviour after fix:**
- User sorts table A–Z by employee name → Detail CSV and PDF Employee Summary also appear A–Z.
- User sorts by date (default) → Employee Summary follows that same order.
- Grid CSV is unchanged — it already sorted employees independently via `localeCompare`.

---

## Change 10 — EmployeesPunchLogs: Gross Hours Column is DayCare-Only (Hidden for BNC)

**Status:** Shipped (client only).

**Change:** `Gross Hours` is now hidden for DayCare companies. BNC companies retain it as a selectable column.

**Client side:** `EmployeesPunchLogs.jsx`.

- `columnOptions` adds `{ value: "gross", label: "Gross Hours", ... }` conditionally: `...(!isDayCare ? [{ value: "gross" }] : [])`.
- A `useEffect` on `[isDayCare, companyType]` strips `gross` from `columnVisibility` when `isDayCare` is true, so it is never displayed for DayCare even if previously selected.

**Column visibility by company type:**

| Column | BNC | DayCare |
|---|---|---|
| Gross Hours | ✓ | ✗ (hidden) |

---

## Change 11 — EmployeesPunchLogs: Lunch Start / Lunch End Columns Are BNC-Only in Exports

**Status:** Shipped (client only).

**Problem:** The Detail CSV and PDF exports always appended `Lunch Start` and `Lunch End` columns to every report regardless of company type. These fields are meaningless for DayCare companies and should not appear in their reports.

**Client side:** `lib/exports/employeePunchLogs.js` + `EmployeesPunchLogs.jsx`.

- Added `isDayCare = false` parameter to both `exportEmployeePunchLogsCSV` and `exportEmployeePunchLogsPDF`.
- Changed the lunch column append from unconditional to `...(!isDayCare ? ["lunchStart", "lunchEnd"] : [])` in both functions (`exportColumns` in CSV, `pdfColumns` in PDF).
- `exportCSV` and `exportPDF` call sites in `EmployeesPunchLogs.jsx` now pass `isDayCare` from component state.
- Grid CSV (`exportEmployeePunchLogsCSV_v2`) is unchanged — it handles lunch inline per row and is a DayCare-specific format anyway.

**Behaviour after fix:**

| Export | BNC | DayCare |
|---|---|---|
| Detail CSV | Lunch Start + Lunch End columns included | Omitted |
| PDF | Lunch Start + Lunch End columns included | Omitted |
| Grid CSV | N/A | Unchanged |

---

---

## Change 12 — EmployeesPunchLogs: `TRAINING` Punch Type Support in UI

**Status:** Shipped (client only).

**Change:** `TRAINING` is now a recognized punch type in the Employee Punch Logs page. It is a DayCare-only punch type that grants a flat credit using the company's Default Shift Hours.

**Client side:** `EmployeesPunchLogs.jsx`.

- `PunchTypeBadge` config map extended with `TRAINING: { label: "Training", icon: BookOpen, color: "green" }`. Badge color logic updated from a binary `isBlue` check to a `colorClass` ternary that handles blue (Driver/Aide), green (Training), and purple (Regular).
- Punch Type filter dropdown (DayCare-only) now includes a `Training` option (`value="TRAINING"`).
- Edit Punch Type dialog now includes `Training` as a selectable option with a green `BookOpen` icon.

---

## Change 13 — EmployeesPunchLogs: `TRAINING` Punch Type in Exports

**Status:** Shipped (client only).

**Change:** All three export functions now handle `TRAINING` punch type correctly.

**Client side:** `lib/exports/employeePunchLogs.js`.

- **Detail CSV and PDF:** Added a `case "punchType"` renderer in both `exportEmployeePunchLogsCSV` and `exportEmployeePunchLogsPDF`. Previously `punchType` fell through to the `default` branch and exported the raw enum string (e.g. `"DRIVER_AIDE_AM"`). Now maps to human-readable labels: `REGULAR → "Regular"`, `DRIVER_AIDE → "Driver/Aide"`, `DRIVER_AIDE_AM → "Driver AM"`, `DRIVER_AIDE_PM → "Driver PM"`, `TRAINING → "Training"`.
- **Grid CSV (`exportEmployeePunchLogsCSV_v2`):** `TRAINING` punch type is now tracked separately. Per-day: training hours display under the Regular column (no per-day TR slot in the grid layout). Totals: training hours accumulate into `totalTR` (not `totalReg`) and are written to the `TR` column, which was previously left blank for manual entry. Grand total row updated to include `grandTotals.tr`. `rowTotal` and `grandTotal` both include TR hours.

---

## Change 14 — EmployeesPunchLogs: Grid CSV Removes Lunch Break Column (DayCare)

**Status:** Shipped (client only).

**Problem:** The Grid CSV (DayCare payroll format) included a `Lunch Break` column per date showing the lunch window. Lunch start/end is irrelevant for DayCare companies and cluttered the payroll grid.

**Client side:** `lib/exports/employeePunchLogs.js` — `exportEmployeePunchLogsCSV_v2`.

- `colRow` no longer pushes `"Lunch Break"` — per-date columns are now `Driver Aide AM | Regular | Driver Aide PM` (3 columns instead of 4).
- `dateRow` per-date spacer updated from 4 cells to 3 to stay aligned.
- Empty-date push updated from `"", "", "", ""` to `"", "", ""`.
- Total row spacer loop updated to push 3 cells per date.
- `fmtGridBreakTime` helper removed (no longer referenced).

**Behaviour after fix:**

| Column | Before | After |
|---|---|---|
| Per-date columns | AM \| Regular \| PM \| Lunch Break | AM \| Regular \| PM |
| TR column (totals) | Blank (manual entry) | Auto-filled from TRAINING punch logs |

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | `companyType` from API, `isDayCare` gate, OT/Gross column gating, `userShift` label, DA segment fields; TRAINING punch type badge, filter, and edit dialog |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | `isBNC` from approvals envelope, four-button model, shift picker, OT block rows, reset button, `refreshOTBlocks` |
| `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/Schedules.jsx` | `fmtScheduleDate` helper, safe date parse in table display, edit form, and `isActive` checks |
| `lib/exports/employeePunchLogs.js` | `employeeOrder` array in CSV + PDF functions; Employee Summary now mirrors table sort order; `isDayCare` param added; lunch columns omitted for DayCare; `punchType` label formatting in CSV + PDF; TRAINING tracked in Grid CSV TR column; Lunch Break column removed from Grid CSV |
