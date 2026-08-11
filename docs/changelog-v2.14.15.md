# Changelog — v2.14.15

BB-067: confirmed and fixed two data-correctness bugs in the "CSV — Payroll Grid" export's Role and SL columns, and removed an unused static Remarks/Color legend block from the same export.

---

## BB-067 — Payroll Grid CSV: Role column, SL column, Remarks legend

**Status:** Fix applied (client only) — pending manual verification, not yet confirmed closed.

**Pages:** Company Punch Logs (`/dashboard/company/punch-logs`) → Generate Report → "CSV — Payroll Grid"

**Files:**
- `lib/exports/employeePunchLogs.js`
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

**Ask:** Confirm (before changing anything) whether column D ("Role") is correct/showing in the Payroll Grid CSV, and whether column AN ("SL") includes both paid and unpaid sick leave — then fix whatever was confirmed broken, touching only those two columns.

**Investigation findings:**
- **Role (column D)** is correct on the live/open-period report path (`enrichTimelogs()` passes through the server's `employeeRole` field, sourced from `EmploymentDetail.jobTitle` per v2.10.0) but wrong on the locked-cutoff-period path: `buildRowsFromApprovals()` set `employeeRole: user.role`, the auth/account role ("employee"/"admin"/etc.), not a job title. Any report generated against a locked cutoff period showed the wrong value in column D.
- **SL (column AN)** summed paid and unpaid sick leave together on both report paths, with no pay-status filter at all — confirmed by reading the aggregation loop directly. The live path's `GET /api/leaves` records already carry `isPaid`/`actualPaidHours`/`actualUnpaidHours` per leave; the locked-cutoff path's approvals envelope already carries `payableHours` per leave row (same field `CutoffReview.jsx` already uses for its own Paid/Unpaid tag) — neither was being read by the export.
- A separate header/data column-count mismatch in the same trailing section (10 header cells vs. 8 data cells) was also found while tracing column AN, but the actual SL numbers land correctly regardless — left untouched per explicit scope decision (Role and SL columns only, no other columns' layout).
- The static Remarks/Color legend rows (`Aide=Blue`, `Driver=Red`, `Program Hours=Black`, `Absent=Orange`, `Holiday=Yellow`) appended after the totals row were flagged as unused — confirmed self-contained (referenced only once, in `allRows`), no other code depends on it. Since this is a plain CSV, the "Color" values were never applied as actual cell coloring — purely a manual-reference key.

**Fix:**
- **`EmployeesPunchLogs.jsx`** — added `employeeRoleMap`, built from the already-fetched `employees[].employmentDetail?.jobTitle` (same pattern as the existing `employeeIdMap`), and applied it to override `employeeRole` on `enriched` rows for both report paths — same fix already in place for `employeeId`.
- **`lib/exports/employeePunchLogs.js`** (`exportEmployeePunchLogsCSV_v2`) — the SL aggregation now calls the existing shared `resolveLeavePayOutcome()` helper (`lib/leaveBalanceUtils.js`) and skips leave records that resolve to `"unpaid"` or unknown pay status; for paid/partial leave it prefers `actualPaidHours` (the real post-decision outcome) over the submitted `requestedHours` intent.
- **`EmployeesPunchLogs.jsx`** (`buildLeavesFromApprovals()`) — now synthesizes `status`/`isPaid`/`actualPaidHours` from `leaveRow.payableHours ?? leaveRow.hours ?? 8` (same default `CutoffReview.jsx` already uses) so the locked-cutoff path feeds the same paid-only SL filter correctly.
- **`lib/exports/employeePunchLogs.js`** — removed the `remarksRows` array and its `...remarksRows` spread into `allRows`; the export now ends at the totals row.

**Server-repo impact:** None — all fields used (`employmentDetail.jobTitle`, `isPaid`/`actualPaidHours` on `/api/leaves`, `payableHours` on `/cutoff-periods/:id/approvals`) were already returned by the server and already fetched client-side; this was purely a client-side sourcing/filtering gap.

**Explicitly out of scope (deferred):** The header/data column-count mismatch in the same trailing section (10 vs. 8 trailing cells) — noted during investigation but left untouched per explicit direction to only touch the Role and SL columns.

### Files Changed

| File | Changes |
|---|---|
| `.../EmployeesPunchLogs.jsx` | New `employeeRoleMap` (job title, from `employees[].employmentDetail?.jobTitle`) applied to override `employeeRole` on both report paths; `buildLeavesFromApprovals()` now carries `status`/`isPaid`/`actualPaidHours` derived from `payableHours ?? hours ?? 8`. |
| `lib/exports/employeePunchLogs.js` | SL aggregation in `exportEmployeePunchLogsCSV_v2` now filters to paid-only leave via `resolveLeavePayOutcome()` and prefers `actualPaidHours` over `requestedHours`; removed the unused `remarksRows` legend block from the CSV output. |
