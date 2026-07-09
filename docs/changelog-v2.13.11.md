# Changelog — v2.13.11

BB-027: Approved sick leave now auto-populates the SL column in the Grid CSV (Payroll) export. A new "Driving Hrs" summary column (AM + PM combined) was also added to the Grid CSV. Both client and server changes are complete and fully integrated.
BB-028: DayCare companies now see computed OT blocks in Cutoff Review — cutoff-period-basis overtime is fully wired up on both server and client. OT configuration indicator added to the review page header.
BB-029: Admins can now designate entire dates as Training Days in Cutoff Review. A "Training Day" toggle appears on each date sub-header inside non-driver employee cards. Toggling ON bulk-updates all eligible punches for that date across all employees (client-side loop over existing PATCH endpoint). Toggling OFF resets them all to Regular. A "Training" filter chip lets admins quickly find affected employees. Per-punch toggles remain as a fine-grained correction tool.

---

## Change 1 — BB-027: Sick Leave Auto-Fill in Grid CSV Export

**Status:** Fully shipped — client and server complete.

**Page:** `/dashboard/company/punch-logs`

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`
- `lib/exports/employeePunchLogs.js`

---

### Background

The Grid CSV (Payroll) export template has an "SL" (Sick Leave) summary column. Previously it was always blank — left for manual entry. Approved sick leave records were never fetched on the punch logs page and were not reflected in any report export.

The root cause is that leave data lives in a completely separate endpoint (`GET /api/leaves`) from punch logs (`GET /api/timelogs`). A sick leave day produces no timelog row, so without fetching leaves, the report has no way to know the employee was absent due to approved leave.

A secondary problem was the SL hours value: the system stores leave balance credits in **hours** (e.g. "32h total"), and the employee's scheduled shift for June 3 is **5.5h**, but a naive calculation of `days × defaultShiftHours` (1 × 8h) produces the wrong value (8h).

---

### Client Changes

**`EmployeesPunchLogs.jsx`:**

- Added `approvedLeaves` state (default `[]`).
- Added `fetchApprovedLeaves` callback — calls `GET /api/leaves`, stores only records with `status === "approved"`. Fails silently (leave data is supplemental).
- Called alongside bootstrap/cutoffs on mount.
- `exportGridCSV` now passes `approvedLeaves`, `defaultShiftHours: defaultHours`, `fromDate: filters.from`, `toDate: filters.to` to the export function.

**`lib/exports/employeePunchLogs.js` — `exportEmployeePunchLogsCSV_v2`:**

New parameters: `approvedLeaves`, `defaultShiftHours`, `fromDate`, `toDate`.

After collecting punch log dates, builds a `slHoursByUser` lookup keyed by `userId`. For each approved leave where `leaveType.toLowerCase().includes("sick")`:

1. Resolves `userId` via `leave.userId || leave.requester?.id || leave.User?.id`.
2. Clips the leave date range to the report's `fromDate`/`toDate` window.
3. Scales `leave.requestedHours` (server-computed, covers the full leave) proportionally to the overlapping days: `requestedHours × (overlapDays / totalLeaveDays)`. Falls back to `days × defaultShiftHours` if `requestedHours` is `null`. This ensures a 2-day leave where only 1 day falls in the report window contributes the correct single-day amount rather than the full leave total.

The per-employee SL cell and the grand total SL cell now render from this lookup. The `grandTotals` object gained an `sl` key so the Total row's SL cell also aggregates correctly.

**Total Driving Hours column:**  
A new "Driving Hrs" summary column was added to the Grid CSV after the existing AM/Regular/PM totals. It shows `totalAM + totalPM` per employee — the combined driver aide hours for the period. Non-driver employees get a blank. The grand Total row includes the corresponding `grandTotals.driving` aggregate. This is a subtotal view within the existing Total column — it does not add to the overall sum.

---

### Server Changes

**Endpoints updated:** `GET /api/leaves`, `GET /api/leaves/pending`, `GET /api/leaves/my`

Each leave record in `data[]` now includes `requestedHours` — the actual hours consumed, computed from the employee's scheduled shift hours for the leave date(s).

**Calculation logic:** For employees with assigned shifts, hours are derived from the shift's `startTime`/`endTime` (midnight-crossing handled). For salaried/unassigned employees (no `UserShift` records in range), falls back to the company's `defaultShiftHours`. This same calculation is used when deducting from the leave balance on approval, so the displayed value and the deducted value are always consistent.

`requestedHours` is a number (2 decimal places). It is `null` if the calculation fails for any reason — the client falls back to `days × defaultShiftHours` in that case.

**Example:** Marites Fernandez, Regular Shift 08:00–13:30 on June 3 = **5.5h**. Her approved Sick Leave for June 3 returns `requestedHours: 5.5`, and the SL column shows `5.50` — not the previous incorrect `8.00`.

---

## Change 2 — BB-028: Cutoff-Basis OT Blocks for DayCare in Cutoff Review

**Status:** Fully shipped — client and server complete.

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

---

### Background

DayCare companies use `otBasis = "cutoff"` with a `cutoffOtThresholdHours` value (e.g. 80h per period). The server was previously not generating `CutoffOtBlock` records for these companies, and the client was gating all OT block logic on `isBNC === true` — so even after the server started computing blocks, DayCare reviewers would never see them.

---

### Server Changes (BB-028)

**Files:** `cutoffOtService.js`, `daycareCutoffStrategy.js`, `cutoffPeriodController.js`

- `computeOtForCutoffBasis` added — sums approved `actualHours` for an employee across the full cutoff period; upserts one `CutoffOtBlock` keyed on `periodEnd` if total exceeds `cutoffOtThresholdHours`, deletes it if hours fall back.
- `recomputeOtForTimeLog` and `recomputeAllOtForCutoff` now dispatch on `otBasis`: `"daily"` → existing per-day logic, `"cutoff"` → new period logic.
- `daycareCutoffStrategy.js` now calls `recomputeOtForTimeLog` after every approval and `recomputeAllOtForCutoff` after bulk approve — same pattern as B&C.
- `getCutoffApprovals` controller: `otBlocks` now returned for `otBasis === "cutoff"` companies (previously B&C only); `cutoffOtThresholdHours` added to response; timezone fallback corrected from `"Asia/Manila"` to `"America/Los_Angeles"`.

**New response fields on `GET /api/cutoff-periods/:id/approvals`:**

| Field | Description |
|---|---|
| `otBasis` | `"cutoff"` for DayCare, `"daily"` for B&C |
| `cutoffOtThresholdHours` | Admin-configured per-period OT threshold (e.g. `80`) |
| `otBlocks[]` | Now populated for DayCare — one block per employee (not per day) |
| `otBlocks[].date` | Always equals the cutoff `periodEnd` for DayCare |

---

### Client Changes (BB-028)

**New state:**
- `otBasis` — parsed from approvals response; `null` for company types that don't use it.
- `cutoffOtThresholdHours` — parsed from both the initial load and `refreshOTBlocks` re-fetch.

**OT block refresh guards:**  
All four `if (isBNC) refreshOTBlocks()` calls updated to `if (isBNC || otBasis === "cutoff")`. Applies to: single approval, exclude, bulk approve, and reset. Corresponding `useCallback` dependency arrays updated to include `otBasis`.

**`OTBlockRow` component:**  
Added `isCutoffBasis` prop. Label and value are now conditional:
- B&C label: `"Overtime · Xh over Yh daily threshold"` — value: `Xh` (already the OT excess amount)
- DayCare label: `"Period OT · Xh total / Yh threshold"` — value: `+Zh` where Z = total − threshold (the actual OT excess)

For DayCare, `block.otHours` is the total accumulated period hours, not the excess. The highlighted value now shows the excess (`+17.41h`) so it's clear what's being approved as overtime, distinct from the total payable hours already shown in the card footer.

**`EmployeeCard` component:**  
- Added `otBasis`, `cutoffOtThresholdHours` props.
- `isCutoffBasis = otBasis === "cutoff"` derived inside the card.
- `otBlockByDate` map (date-keyed, used for B&C inline injection) short-circuits to `{}` when `isCutoffBasis` — DayCare blocks are not per-day and shouldn't be injected inline.
- `periodOTBlock` — for DayCare, takes `emp.otBlocks[0]` (the single period-level block). Rendered as a dedicated row at the bottom of the employee's timeline table with `threshold={cutoffOtThresholdHours ?? dailyOtThresholdHours}` and `isCutoffBasis`.
- Both `cutoffOtThresholdHours` and `otBasis` now passed in from the parent.

**Approve/exclude flow:** No changes needed — same `PATCH /api/cutoff-periods/:id/ot-blocks/:otBlockId` endpoint and `{ action, notes }` payload for both company types.

**`isBNC` sourcing:**  
`GET /api/company-settings` now returns `isBNC` directly (previously only available in the cutoff approvals envelope). The load logic now resolves `isBNCLocal` as `settingsData.data?.isBNC === true || approvalsData.isBNC === true` — preferring the authoritative source with a fallback for backward compatibility.

**OT config indicator (`PageHeader`):**  
A small pill is now rendered at the right end of the stats row (Total Records / Approved / Unreviewed / Flagged / Total Hours). It shows the active OT threshold for this company:
- DayCare (`otBasis === "cutoff"`): `⚡ OT: 80h / period`
- Other (`otBasis === "daily"` or similar): `⚡ OT: 8h / day`

Only renders when `otBasis` is known. `PageHeader` now accepts `otBasis`, `dailyOtThresholdHours`, `cutoffOtThresholdHours` props.

**"Has OT" filter chip fix:**  
The chip previously checked only `emp.hasOT` (a punch-level flag set when an individual punch has approved OT). Employees with a Period OT block (`emp.otBlocks`) but no punch-level OT — e.g. a DayCare employee who crossed the 80h cutoff threshold — were invisible to the chip. Fixed: chip now matches on `emp.hasOT || emp.otBlocks?.length > 0`.

**`EmployeeCutoff` page (`/dashboard/company/cutoff-periods`) — 3 UI fixes:**

**Department tab counts:** `fetchCutoffPeriods` was previously re-fetched with a `?departmentId=` query param on every tab change — replacing the full `cutoffPeriods` state with only that department's records. `deptTotalCounts` (derived from `cutoffPeriods`) then showed 0 for all other tabs. Fixed by removing the dept query param so all periods are always fetched once, and moving department filtering to a `matchDept` condition inside `filteredPeriods` (client-side).

**Pending badge cap removed:** The badge previously capped display at "9+". Now shows the actual pending count using an auto-width pill (`min-w-[1.125rem]` + `px-1`).

**Future periods greyed out:** Rows where `periodStart > today` are now rendered at reduced opacity (`opacity-40`) with the Review button disabled, preventing confusion from interacting with periods that aren't open yet.

---

## Change 3 — BB-029: Training Day Bulk Designation in Cutoff Review

**Status:** Client complete. No new server endpoint required — uses existing `PATCH /api/cutoff-periods/:id/approvals/:id/punch-type`.

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

---

### Background

Training days apply to the entire date across all employees — if May 30 is a training day, every eligible punch on that date for every employee should be marked as `TRAINING`. The previous per-punch toggle was too granular and didn't reflect this mental model.

---

### Client Changes

**New `localPunchType` override** (carried from earlier per-punch work): `{ [recId]: 'TRAINING' | 'REGULAR' }` — patched into `mergedEmployees` via `patchTimes`.

**`trainingDates` useMemo:**
Computed from `mergedEmployees` — a `Set<string>` of formatted date strings (e.g. `"May 30"`) where at least one record has `punchType === "TRAINING"`. Checks `punch_group` sub-punches and top-level records. Used to show the badge and toggle state on date sub-headers.

**`doSetPunchTypeForDate(date, targetType)` callback:**
- Iterates all `mergedEmployees` and collects every record on `date` that has `"toggle-training"` in its `actions` (i.e. pending REGULAR/TRAINING punches on non-driver employees).
- Optimistically sets all targets in `localPunchType`.
- Fires `PATCH .../approvals/:id/punch-type` for all targets in parallel via `Promise.allSettled`.
- On any failure: rolls back all optimistic updates and shows error. On full success: single success toast with count.
- No new server endpoint needed — loops over existing per-record endpoint.

**Date sub-header row in `EmployeeCard`:**
For non-driver employees (`!emp.isDriver`), a slim header row is injected before the first record of each new date (skips `absent` and `driver_group` rows). Contains:
- Date label (left side)
- "Training Day" amber badge — shown when `trainingDates.has(date)`
- Toggle button — amber "Training Day" or neutral "Unmark Training"

Clicking the toggle calls `onTrainingDay(date, targetType)` which fires `doSetPunchTypeForDate` across ALL employees for that date, not just the current card.

**"Training" filter chip:**
Added to `FilterBar` chips. Filters to employees who have at least one record with `punchType === "TRAINING"` (checks `punch_group` sub-punches and top-level records).

**Per-punch toggle retained:**
The individual Training/Regular toggle button on each `TimelineRow`/`PunchSubRow` remains as a correction tool for fine-grained overrides after a date-level bulk action.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | Added `approvedLeaves` state; `fetchApprovedLeaves` callback; called on mount; `exportGridCSV` passes leave data + date range to export |
| `lib/exports/employeePunchLogs.js` | `exportEmployeePunchLogsCSV_v2` accepts `approvedLeaves`, `defaultShiftHours`, `fromDate`, `toDate`; builds `slHoursByUser` lookup; SL cell and grand total SL now auto-filled; `requestedHours` scaled proportionally to overlap window (bug fix: multi-day leaves clipped to report range no longer inflate SL hours); new "Driving Hrs" summary column (AM + PM) added with grand total aggregate |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | BB-028: New `otBasis`/`cutoffOtThresholdHours` state; 4 OT refresh guards updated; `EmployeeCard`/`OTBlockRow` DayCare period-level block rendering; `isBNC` sourced from company-settings; OT config indicator in `PageHeader`; "Has OT" chip fix; TRAINING records excluded from `punchHours` total; excluded driver segments excluded from group total; sibling segments mirrored as excluded on cascade. BB-029: `localPunchType` state; `trainingDates` useMemo; `doSetPunchTypeForDate` callback; date sub-header with Training Day toggle in `EmployeeCard`; "Training" filter chip. |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeeCutoff.jsx` | BB-028: Dept tab counts fixed (removed `?departmentId=` param, added `matchDept` client-side filter); pending badge now shows actual count (no "9+" cap); future periods greyed out with disabled Review button. |
