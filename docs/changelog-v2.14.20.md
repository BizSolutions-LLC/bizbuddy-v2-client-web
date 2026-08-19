# Changelog — v2.14.20

BB-074: Double-punch (two TimeLogs for the same employee on the same day) handling fixed in two places — the Cutoff Review page no longer interleaves segments from different punches into one confusing list, and the Employee Punch Logs Grid CSV export no longer silently drops one punch's hours in favor of the other.

---

## BB-074 — Double-punch handling: Cutoff Review grouping + Payroll Grid CSV export

**Status:** Fixed (client only).

**Pages:**
- Cutoff Period Review (`/dashboard/company/cutoff-periods/[id]/review`)
- Punch Logs — Employee Punch Logs Grid export (`/dashboard/company/punch-logs`)

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`
- `lib/exports/employeePunchLogs.js`

**Ask:** This was originally scoped as a server-side fix (auto-flagging duplicate punches, hiding segments in `cutoffPeriodController.js`), but that approach was tried and reverted server-side — **no server change was made or is needed**. The real problem, confirmed against live screenshots and a downloaded report, is purely client-side: when an employee has two separate TimeLogs on the same date (e.g. a short accidental AM punch plus a separate, correctly-approved Regular punch), the client wasn't correctly attributing each punch's hours to its own category in two different places.

**Investigation findings:**

*Cutoff Review page:*
- `groupRecordsByDate()`'s `driverGroupMap` grouped driver/aide segment rows by **date only**, so segments from two different TimeLogs on the same day (e.g. Driver AM from a 7:06–8:00 AM punch and a Regular segment from an unrelated 8:32 AM–1:30 PM punch) merged into one interleaved list of rows with no indication of which segment belonged to which physical punch.
- `DriverGroupRow`'s header read its "raw punch time" display from only `segments[0]`, silently dropping the second punch's time from view entirely.

*Payroll Grid CSV export:*
- Traced against a real downloaded `BizBuddy_EmployeePunchLogs_Grid_*.csv` and the underlying Punch Logs records for the affected employee (two TimeLogs on 08/10: 07:06 AM→08:00 AM and 08:32 AM→01:30 PM).
- Root cause: `lib/exports/employeePunchLogs.js:1217`, `entry.byDate[date] = log` — a last-write-wins overwrite. When an employee has multiple TimeLog records on the same date, whichever one is processed last (sorted by `timeIn` ascending) wins the day's slot in the grid; the other's hours vanish from the AM/Regular/PM columns entirely. The code's own comment at the time already flagged this exact multi-record-per-day scenario, but only the grand Total-Hours/OT column had been fixed to sum across all records — the per-day breakdown cells hadn't been.

**Fix:**

*Cutoff Review page (`CutoffReview.jsx`):*
- `buildDetails()` now also carries `originalTimeIn`/`originalTimeOut` (the true pre-snap punch time) from the TimeLog into each record.
- `groupRecordsByDate()`'s `driverGroupMap` is now keyed by `` `${date}::${timeLogId}` `` instead of `date` alone, so segments only group together when they share a TimeLog — two punches on the same day now render as two separate group blocks.
- New `PUNCH_TYPE_LABELS` map for a humanized punch-type pill (Driver/Aide, Driver AM Only, Driver PM Only, Regular, Training).
- `DriverGroupRow` now shows a punch-type pill per group and prefers `originalTimeIn`/`originalTimeOut` over `timeIn`/`timeOut` for the header's raw time range, with an info-icon tooltip explaining it's the raw, pre-snap punch time.
- No changes to any approve/exclude/edit action, endpoint, or payload — display/grouping only.

*Payroll Grid CSV export (`lib/exports/employeePunchLogs.js`):*
- `entry.byDate[date]` now accumulates an **array** of every log record for that employee/date instead of being overwritten by the last one.
- The per-day cell computation loop now **sums** AM/Regular/PM/Training hours across every record for that date — each record still contributes to its own correct category (segment-based hours for Driver/Aide rows, `duration`/`netWorkedHours` otherwise) exactly as before; the only behavioral change is that multiple same-day records now add together instead of one clobbering another. Single-record days (the vast majority) are mathematically unaffected.

**Server-repo impact:** None — confirmed no server changes were made or are needed; both fixes are purely client-side.

**Explicitly out of scope (discussed, not actioned):**
- A separate, narrower quirk in `buildRowsFromApprovals()` (`EmployeesPunchLogs.jsx:944-949`, used only when generating a report from a **locked cutoff period**, a different code path than the Payroll Grid fix above): on a locked-cutoff export, a day with both a segment and a separate flat punch has its `netWorkedHours` field overwritten by the segment-only total, which could understate that employee's period total for the OT-threshold calculation on that specific path. Does **not** affect the per-day AM/Regular/PM grid columns fixed above. Deliberately left alone per explicit scope decision — to be ticketed separately if needed.

### Files Changed

| File | Changes |
|---|---|
| `.../Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | `buildDetails()` carries `originalTimeIn`/`originalTimeOut`; `groupRecordsByDate()`'s driver-segment grouping keyed by date+TimeLog instead of date alone; new `PUNCH_TYPE_LABELS` map; `DriverGroupRow` shows a punch-type pill and prefers raw pre-snap punch time with an explanatory tooltip. |
| `lib/exports/employeePunchLogs.js` | `exportEmployeePunchLogsCSV_v2`'s per-day grouping (`entry.byDate`) now accumulates and sums every TimeLog record for a date instead of the last one overwriting the rest, so a day with multiple punches no longer silently drops one punch's hours from the grid. |
