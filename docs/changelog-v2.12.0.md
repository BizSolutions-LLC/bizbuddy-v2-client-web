# Server-Side Changelog — v2.12.0

Tracks required backend changes that must be coordinated with client releases.

---

## Change 1 — `POST /api/shiftschedules/create`: Accept `targetIds[]` for Multi-Employee Individual Assignment

**Ticket:** "Create Recurring Schedule" currently only allows assigning one employee at a time (`targetId: string`). The UI is being updated to a multi-select checkbox list — users pick N employees in one form submission, expecting one schedule record created per employee in a single operation. The current endpoint forces the client to fire N separate requests, which makes conflict aggregation and error reporting fragmented.

**Status:** Shipped.

**Endpoint spec (as implemented):**

- **Request body:** `targetIds: string[]` for `individual` type. `targetId` (single string) still used for `department`; `targetId: null` for `all`. Unchanged contract for `department` and `all` branches.

- **Conflict 409:** `userId` renamed to `targetId` in the public response. Internal fields (`conflictDates`, `conflictIds`) stripped from the JSON output — they remain on the internal conflict objects for `conflictMap` and `replaceConflicts` logic.

  ```json
  {
    "message": "Scheduling conflicts detected",
    "totalConflicts": 7,
    "conflicts": [
      { "targetId": "uuid-emp-1", "userName": "Juan dela Cruz", "userEmail": "juan@biz.com", "conflictCount": 3 },
      { "targetId": "uuid-emp-2", "userName": "Maria Santos",   "userEmail": "maria@biz.com", "conflictCount": 4 }
    ]
  }
  ```

- **Transaction (`individual` branch):** Tracks `assignedCount` per employee and builds a `scheduleResults[]` array. Employees with zero non-conflicting dates get `{ targetId, skipped: true, reason: "no non-conflicting dates" }` — no record created, no error thrown.

- **Success response (`individual` type):**

  ```json
  {
    "message": "Schedules created successfully",
    "created": 3,
    "skipped": 1,
    "results": [
      { "targetId": "uuid-emp-1", "scheduleId": "...", "assignedDates": 10 },
      { "targetId": "uuid-emp-2", "scheduleId": "...", "assignedDates": 8 },
      { "targetId": "uuid-emp-3", "scheduleId": "...", "assignedDates": 10 },
      { "targetId": "uuid-emp-4", "skipped": true, "reason": "no non-conflicting dates" }
    ]
  }
  ```

- **`department` and `all` types:** Untouched — still return the existing data wrapper shape.

**Client side:** `Schedules.jsx` — Create Recurring Schedule modal. `scheduleForm.targetId` replaced with `scheduleForm.targetIds[]` for individual type. On submit: sends one `POST /api/shiftschedules/create` with the full `targetIds` array. Conflict dialog updated to show per-employee conflict list. No change to edit or delete flows.

---

## Change 2 — `TimeLogApproval`: Add `segmentStart` / `segmentEnd` for Driver Segment Time Windows

**Status:** Shipped (server + client).

**Problem:** All three driver segments (Driver AM, Regular, Driver PM) shared the same raw `timeLog.timeIn` / `timeLog.timeOut`, so the CutoffReview page showed identical times for every segment in a driver day group.

**Server changes:**
- Added two nullable `TIMESTAMPTZ` fields to `TimeLogApproval`: `segmentStart` and `segmentEnd` (ISO 8601 UTC — same format as `timeLog.timeIn` / `timeLog.timeOut`).
- Migration name: `migrate-timelog-approval-segment-bounds`.
- Backfilled all 465 existing `DRIVER_AIDE` approval rows for Piedmont via `resolveSegmentBoundary()`.
- New approval syncs populate these fields automatically at creation time.
- Regular (non-DA) rows always have both fields as `null`.

**Contract:**
- `approval.segmentStart` / `approval.segmentEnd` — non-null when `segmentType` is `"driver_am"`, `"regular"`, or `"driver_pm"`.
- `approval.segmentStart` / `approval.segmentEnd` — `null` when `segmentType` is `null` (regular punch).

**Client side:** `CutoffReview.jsx` — `buildDetails()`. When `approval.segmentType !== null`, `inTime` / `outTime` are now read from `approval.segmentStart` / `approval.segmentEnd` instead of `tl.timeIn` / `tl.timeOut`. Regular punch rows are unaffected.

---

## Change 3 — CutoffReview: Full Period Timeline (All Days Enumerated Client-Side)

**Status:** Shipped (client only).

**Problem:** The CutoffReview employee timeline only rendered rows for dates that had a cutoff approval record. Days without a synced record (e.g., May 1 punches that existed in `timelogs` but hadn't been synced into the cutoff) were silently absent from the list.

**Client side:** `CutoffReview.jsx`.

- `fetchData()` now performs a second fetch after the initial approvals load: `GET /api/timelogs?from=periodStart&to=periodEnd&departmentId=...&limit=10000`. This returns all raw punch logs for the period regardless of cutoff sync status.
- `syncedTimeLogIds` set is built from the approvals response to diff against raw logs.
- Raw logs not present in `syncedTimeLogIds` are converted via `buildUnsyncedRecord()` into `type: "unsynced"` display records — showing actual punch times and an amber **"Not in cutoff — run Sync to include"** badge. No approve/exclude actions are shown since these records aren't yet in the approval table.
- `groupRecordsByDate()` now accepts `(records, periodStart, periodEnd, tz)`. After the existing driver/punch grouping, it calls `enumeratePeriodDays()` to walk every calendar day from `periodStart` to `periodEnd` in company timezone order. Days with data emit their records; days with no data emit a grey **"Absent"** placeholder row.
- `enumeratePeriodDays()` uses noon-UTC anchoring (`Date.UTC(y, m-1, d, 12)`) to ensure day labels are timezone-safe across any `companyTimezone`.
- `mergedEmployees` derived state: `absent` and `unsynced` rows are excluded from `pending` / `approved` counts. An `unsyncedCount` is tracked separately and surfaced as an amber **"N unsynced"** badge on the employee card header.
- Employees are sorted by `totalHours` descending so the highest-hour employees appear first.

---

## Change 4 — CutoffReview: Scheduled Shift Window Display

**Status:** Shipped (client only).

**Problem:** The "Xh scheduled" label in the detail column gave no indication of *when* the shift was scheduled, making it hard to judge lateness or early departure at a glance.

**Client side:** `CutoffReview.jsx`.

- `buildDetails()`: `scheduleInfo` now includes `shiftStart` and `shiftEnd` extracted from `schedule.shift?.startTime` / `schedule.shift?.endTime` (with flat fallbacks `schedule.startTime` / `schedule.endTime`).
- `fmtShiftTime()` helper added (module-level): formats UTC-stored shift times using `timeZone: "UTC"` — consistent with how `EmployeesPunchLogs.jsx` renders shift windows.
- Schedule strip in `TimelineRow` and `PunchSubRow`: when both `shiftStart` and `shiftEnd` are present, a muted mono `5:00 AM – 8:00 AM` label is rendered inline after "Xh scheduled". Rows without shift bounds are unaffected.

---

## Change 5 — CutoffReview: Action Button Layout + Employee Sort

**Status:** Shipped (client only).

**Changes:**

- **Action buttons:** `TimelineRow` and `PunchSubRow` action cells — the `flex-col` wrapper with a nested inner row was collapsed into a single `flex items-center gap-1.5 flex-wrap justify-end` row. Approve, Edit, and Exclude now appear on one line.
- **Employee sort:** `filteredEmployees` now sorts by `totalHours` descending after all tab/chip/search filtering, so the highest-hour employees always appear first in the list.

---

## Change 6 — EmployeesPunchLogs: Auto-Break Time Window Display

**Status:** Shipped (client only).

**Problem:** Auto-injected breaks (coffee and lunch) showed only the total duration. There was no way to see when the break started and ended without opening a separate view.

**Client side:** `EmployeesPunchLogs.jsx`.

- **Table columns (Coffee & Lunch):** When a break is auto-injected and has `start`/`end` timestamps, a muted mono time window (e.g. `10:30 AM – 11:00 AM`) is rendered below the duration badge in the cell. Only shown for auto breaks — manual breaks are unaffected.
- **Expanded row (Break Times section):** Coffee and lunch rows now display the actual time window stacked below the duration + `AutoBreakBadge`. Coffee loops over all auto breaks (handles multiple breaks per shift). Lunch shows the window when `lunchBreak.auto` is true and start/end are present.
- **No API change required.** `coffeeBreaks[].{ start, end, auto }` and `lunchBreak.{ start, end, auto }` were already in the response — the existing duration helpers already consumed them. Display only.

---

## Change 7 — EmployeesPunchLogs: Export Report Fixes + Lunch Window + Dual Hour Totals

**Status:** Shipped (client only).

**File:** `lib/exports/employeePunchLogs.js`

**Problems fixed:**

1. **`[object Object]` in Cutoff Status column** — the `cutoffApproval` field is an object; the default switch fallback was serializing it directly. Now renders `"Approved"` / `"Pending"` / `"Rejected"` / `"Not in cutoff"`.
2. **Total hours = period hours (wrong)** — all three exports were summing `periodHours` (scheduled) for the "Total Hours" summary. Changed to sum `duration` (actual computed hours).
3. **Only one hours figure in summary** — users need both computed and scheduled side-by-side to catch discrepancies.

**Changes per export:**

### PDF (`exportEmployeePunchLogsPDF`)
- **Summary stats box:** Now shows `Duration Hours` (orange, actual) + `Period Hours` (muted slate, scheduled) + `Overtime` on one row, with a small italic legend: *"Duration = actual computed hours · Period = scheduled hours"*. Box height expanded from 20 → 25.
- **Employee summary table:** Added `Period Hrs` column alongside `Duration Hrs`. Added a dark-blue **TOTAL** footer row (shown on last page) with grand totals for Duration, Period, and Overtime.
- **Detail table:** `Lunch Start` and `Lunch End` always appended as the last two columns, formatted in company timezone. Visible column limit adjusted from 10 → 8 + 2 fixed lunch columns.
- **Cutoff Status column:** Fixed `[object Object]` → status string.

### Detail CSV (`exportEmployeePunchLogsCSV`)
- **Summary statistics section:** `Total Duration Hours (actual computed hours)` and `Total Period Hours (scheduled hours)` both listed.
- **Employee summary table:** `Duration Hours` and `Period Hours` columns; `TOTAL` row appended at the bottom.
- **Detail table:** `Lunch Start` and `Lunch End` columns always appended regardless of column visibility selection.
- **Cutoff Status column:** Fixed.

### Payroll Grid CSV (`exportEmployeePunchLogsCSV_v2`)
- Each date group expanded from 3 columns `[AM, Regular, PM]` to 4 columns `[Driver Aide AM, Regular, Driver Aide PM, Lunch Break]`.
- `Lunch Break` cell shows `10:30 AM – 11:00 AM` time window when the day's record has an auto lunch break with start/end; blank otherwise.
- Date header row and totals row updated to align with the extra column per date.

---
