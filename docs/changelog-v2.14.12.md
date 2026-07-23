# Changelog — v2.14.12

BB-056 fix: cutoff review previously credited every approved leave day's full scheduled hours to an employee's Total Payable, regardless of whether the leave was paid or unpaid. Unpaid (and partially-paid) leave now excludes/reduces those hours from payable totals, and each leave row is tagged Paid / Unpaid / Partially Paid so admins can see why.

BB-058 fix: the Punch Logs Time In/Time Out summary (company + employee views, plus CSV/PDF exports) was rendering the raw, unadjusted punch time instead of the actual approved clock time once a day was reviewed. Now prefers the server's new `dayApprovedClockIn`/`dayApprovedClockOut` fields when present, falling back to raw `timeIn`/`timeOut` for still-pending days.

---

## BB-056 — Cutoff review didn't distinguish paid vs. unpaid approved leave

**Status:** Fix applied (client only) — pending manual verification, not yet confirmed closed.

**Page:** `/dashboard/company/cutoff-periods/[id]/review` (Cutoff Review)

**Files:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Ask:** Investigate what the cutoff review page does when a leave is approved, and whether paid vs. unpaid leave changes anything.

**Investigation findings:** The cutoff review screen already had real leave integration — approved leave rows, punch/leave conflict resolution ("Honor Punch" / "Honor Leave") — but zero handling of paid vs. unpaid. Every approved leave, paid or not, was credited into an employee's payable hours identically (`totalHours = punchHours + leaveHours`, with `leaveHours` summed from the display-only scheduled-hours field). Confirmed via a screenshot from production data (Corazon Viola, Jul 23–28 approved Vacation Leave) that this could show a fully-unpaid stretch of leave (balance exhausted) as 8h/day green "payable-looking" rows, while the header's PAYABLE total correctly summed to 0h once the server-side fix (below) was live — an internal inconsistency worth fixing rather than leaving as a silent trust-the-total situation.

**Server-side contract (already specified/coordinated, not this repo):** `GET /api/cutoff-periods/:id/approvals` gains a `payableHours` field on standalone `leaves[]` rows — the hours that actually count toward payroll for that leave day (0 fully unpaid, full amount fully paid, partial if a leave straddles a balance cutoff). The existing `hours` field is unchanged and stays display-only (scheduled hours). Conflict rows (`leaveRecord`/`pendingLeave` when `hasLeaveConflict: true`) gain `isPaid` (+ `actualPaidHours`/`actualUnpaidHours` once approved) — not consumed by this client change, left for a possible follow-up.

**Fix:**
- Added `resolveLeavePayStatus(payableHours, scheduledHours)` helper — classifies a leave day as `"paid"`, `"unpaid"`, or `"partial"`.
- Both standalone-leave-row builders (initial load and the refresh-after-action duplicate) now read `leaveRow.payableHours ?? leaveRow.hours ?? 8` (safe whether or not the server has shipped the field yet — no deploy-ordering risk between the two repos) and store it alongside the existing `hours`, plus the computed `payStatus`.
- Each leave row now carries exactly one tag — `Paid`, `Partially Paid`, or `Unpaid` — added to `TagPill`'s style map (emerald / amber / neutral) and `TAG_TOOLTIPS`.
- The `mergedEmployees` payable-hours calculation now sums `payableHours ?? hours ?? 0` per leave record instead of unconditionally summing `hours` — this is the actual payroll fix; everything downstream (`totalHours`, `globalStats.totalHours`) picks it up automatically.
- `TimelineRow` (the renderer for standalone leave rows) no longer shows an hour value at all for unpaid leave (falls through to the same `—` dash used for "Absent" rows); paid/partial leave shows the payable portion (not the raw scheduled hours), with partial rendered in amber and an updated, leave-specific tooltip instead of the punch-oriented "This goes to payroll on approval" text that was misleading for leave rows.
- No change to `EmployeeCutoff.jsx` (the cutoff periods list page) — it has no leave logic or hour totals. No change to punch/leave conflict rows — flagged as out of scope for this pass, not overlooked.

**Server-repo impact:** The client fix alone doesn't close the payroll bug for real users until the server actually populates `payableHours` (and conflict-row `isPaid`) on `GET /api/cutoff-periods/:id/approvals` per the contract above — confirm that work is tracked/shipped in the server repo.

### Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | Added `resolveLeavePayStatus()` helper; added `paidLeave`/`partialLeave`/`unpaidLeave` entries to `TAG_TOOLTIPS` and `TagPill` styles; both leave-row builders now compute and store `payableHours`/`payStatus` and push a pay-status tag; `mergedEmployees`'s `leaveHours` sum now uses `payableHours ?? hours ?? 0`; `TimelineRow` computes `displayHours` (0 for unpaid, payable portion for paid/partial) and uses it for the Hours-column value, color, and tooltip. |

---

## BB-058 — Punch Logs summary showed raw clock-out instead of approved time

**Status:** Fix applied (client only) — pending manual verification, not yet confirmed closed.

**Pages:** `/dashboard/company/punch-logs` (`EmployeesPunchLogs.jsx`), `/dashboard/employee/punch-logs` (`PunchLogs.jsx`), plus their CSV/PDF exports.

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`
- `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`
- `lib/exports/punchLogs.js`
- `lib/exports/employeePunchLogs.js`

**Ask:** Backend flagged that the Punch Logs summary row's Time Out was rendering the raw clock-out straight off the API response, not the approved/effective time set once a day is reviewed (e.g. a multi-segment Driver/Aide day approved with a corrected clock-out still showed the original raw punch).

**Investigation findings:** Confirmed — on both endpoints, `timeIn`/`timeOut` were rendered exactly as returned by the API with no client-side selection or fallback logic (`DualTimeDisplay`/`safeTime` are pure timezone formatters). No existing client-side logic picked an approved value for these two columns; the one place that already preferred approved times (`CutoffReview.jsx`, per-segment `approvedClockIn`/`approvedClockOut`) is a separate screen with a different data shape, not reused here. The client did already have the relevant precedent pattern (`dayCutoffStatus === "approved"` gating, used for late/undertime columns) — just not applied to Time In/Out.

**Server-side contract (shipped, confirmed by backend):** `GET /api/timelogs` and `GET /api/timelogs/user` now return `dayApprovedClockIn` / `dayApprovedClockOut` (ISO string or `null`) on every row — the resolved, approved/effective time for the day, already doing the "which segment wins" resolution server-side. Both fields are `null` until the day is actually decided (pending or fully-excluded), so the raw fallback naturally applies until then. No fetch/query changes needed — both fields arrive in the existing payload.

**Fix:** Wherever the client renders a day's Time In/Time Out, swapped to `row.dayApprovedClockIn ?? row.timeIn` / `row.dayApprovedClockOut ?? row.timeOut`:
- `EmployeesPunchLogs.jsx` — main table's `dateTimeIn`/`dateTimeOut` cell renderer.
- `PunchLogs.jsx` — table's Clock In/Clock Out cells and the "Log Details" side panel's Clock In/Clock Out rows.
- `lib/exports/punchLogs.js` — Time In/Time Out columns in both the CSV and PDF export paths.
- `lib/exports/employeePunchLogs.js` — `dateTimeIn`/`dateTimeOut` cases in both `buildCsvCell` and `buildPdfCell`.

**Deliberately left on raw values (out of scope, by design):** Edit Time In/Time Out dialogs (must prefill the actual raw punch being edited), delete-confirmation dialog, OT Details dialog, all date-bucketing/sort keys (`dateKey`, `daysWorked`, grid-CSV date grouping — swapping these could shift which day a record buckets into), `CutoffReview.jsx`, and `buildRowsFromApprovals()` (different mechanism — per-segment `approvedClockIn`/`approvedClockOut`, not the new day-level fields).

**Server-repo impact:** None remaining — server work already shipped and confirmed by backend before this client fix was made.

### Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | Main table's Time In/Time Out cells (`dateTimeIn`/`dateTimeOut` cases) now prefer `t.dayApprovedClockIn`/`t.dayApprovedClockOut`. |
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` | Table's Clock In/Clock Out cells and the Log Details panel's Clock In/Clock Out rows now prefer `dayApprovedClockIn`/`dayApprovedClockOut`. |
| `lib/exports/punchLogs.js` | CSV (`exportPunchLogsCSV`) and PDF (`exportPunchLogsPDF`) Time In/Time Out columns now prefer `dayApprovedClockIn`/`dayApprovedClockOut`; the Date column stays on raw `timeIn` (bucketing key, unchanged). |
| `lib/exports/employeePunchLogs.js` | `buildCsvCell` and `buildPdfCell`'s `dateTimeIn`/`dateTimeOut` cases now prefer `dayApprovedClockIn`/`dayApprovedClockOut`; all date-bucketing (`dk`, `daysWorked`, grid grouping) left on raw `timeIn`. |
