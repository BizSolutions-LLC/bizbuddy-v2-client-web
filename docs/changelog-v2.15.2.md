# Changelog — v2.15.2

BB-116: The Leave Ledger now shows which days each leave covers and who acted on it. Before, a row was dated only by when the action happened (e.g. "Oct 15 · Deduction · −5.5h" for an Oct 27 leave), so the hours looked like they were missing.

---

## BB-116 — Leave Ledger shows the leave's dates and approver

**Status:** Complete (client). Needs the server's BB-116 release (bizbuddy-v2-server `release/v2.11.1`), which must ship first.

**Page:** Settings → Leave → Leave Credits → an employee's leave type → **Ledger** modal (e.g. "Sick Leave Ledger"). File: `components/Dashboard/DashboardContent/CompanyPanel/Settings/LeaveSettings.jsx`, `LeaveLedgerDrilldownModal`.

**Date column:**
- The action date (when the row happened) stays as the first line.
- When a row is tied to a leave request, a muted second line shows the leave's own dates:
  - one day: **"Leave: Oct 27"**
  - a range: **"Leave: Nov 9 – Nov 11"**
- The leave dates are `YYYY-MM-DD` calendar dates in the company timezone. New helpers `formatYmdShort` and `leaveRangeLabel` (next to `formatYmd`) build the date from its year, month and day, so the day never shifts with the browser's timezone.

**New "By" column (after Note):**
- Shows who acted on the row (`performedBy.name`), or "—" when there's no one (e.g. system accruals).
- On `approved`, `rejected` and `deduction` rows, a muted second line **"Assigned: …"** shows the leave's assigned approver when it's a different person from who acted.
- `leave.decidedBy` is sent by the server but not displayed.

**Layout:** the modal is wider (`sm:max-w-lg` → `sm:max-w-2xl`) to make room for the sixth column.

**Null safety:** `leave`, `leave.approver` and `performedBy` can each be `null`. Rows not tied to a leave (`adjustment`, `accrual`, `expired`) show no Leave line, and an older server that doesn't send `leave` renders exactly as before.

**Server-repo impact:** Uses the new additive `leave` field on `GET /api/leave-balances/transactions`:
- `leave` holds `id`, `startDate`, `endDate`, `status`, `approver` and `decidedBy`.
- It's already built on the server side; nothing more is needed there.
- Ship order: server first, then client.

**Also in BB-116 (server only, no client change):** the cutoff period screen now shows approved leaves that fall on the last day of a cutoff. Before, they showed as Absent with "0 leave records".
