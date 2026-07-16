# Changelog — v2.14.9

Continuation of the Leave Module redo (`feature/leave-module-client`, rebased onto `master` this cycle): a series of correctness fixes to the broadened-approver-pool model (visibility, notifications, self-approval), a decision audit trail (who actually escalated/decided, not just who a request was assigned to), a fix for the Pay Type badge showing submitted intent instead of the real post-approval outcome, a full redesign of the company Leave Requests admin panel (modal → inline side panel, consistent styling, several bug fixes), client wiring for the new Cancel Leave endpoint, and a new company-wide PDF export respecting the active date filter.

Several fixes below are cross-repo — the actual logic lives in `bizbuddy-v2-server` (`wip/leave-module-redo`, itself not yet merged to server `master` or deployed) and is called out for context, but this changelog's **Files Changed** table only covers this client repo.

---

## Approver Eligibility, Visibility & Notification Fixes (cross-repo)

**Status:** Server-side (`bizbuddy-v2-server`, `wip/leave-module-redo` — not deployed). Client already consumed the corrected data automatically once available; no client code changes required for these specific items.

**Problem:** Phase 4 of the Leave Module redo broadened who can act on a leave request — any admin/superadmin, or a supervisor in the requester's department, not just the person specifically named as approver — but several server code paths still assumed the old exclusive model.

**Fix:**
- `canAct` on the list/dashboard endpoints (`getPendingLeavesForApprover`, `getLeavesForApprover`) now uses the same `_isEligibleApprover()` rule that already guarded the approve/reject/escalate writes, instead of a stale named-approver-only check — eligible admins/supervisors now actually see the Approve/Reject buttons on requests they can act on, not just the one specifically assigned.
- Leave-submission notifications now filtered through the same eligible pool (admins/superadmins company-wide, supervisors scoped to the requester's department) instead of notifying every management user regardless of department.
- Escalation notifications (`LEAVE_PENDING_SECONDARY_APPROVAL`) now reach the full eligible second-stage pool, not just the one specifically-named escalation target.
- Self-approval blocked: a supervisor or admin can no longer approve, reject, or preview their own leave request — enforced both at the write-guard (`403 "You cannot act on your own leave request."`) and the read-side `canAct` flag, so the buttons don't even render.

---

## Decision Audit Trail — Escalated By / Decided By

**Status:** Shipped (client + server; server not yet deployed).

**Problem:** With the broadened approver pool, `approverId`/`secondaryApproverId` only ever show who a request was *assigned* or *escalated to* — not who actually clicked Approve/Reject, which can now be a different eligible person entirely.

**Fix:**
- New `escalatedBy`/`decidedBy` fields on every leave read endpoint (server).
- Employee (`LeaveLogs.jsx`) and company admin (`EmployeesLeaveRequests.jsx`) detail views now show "Escalated By" (when a request went through two-step escalation) and "Decided By" (once approved/rejected) alongside the existing "Assigned Approver" section.
- The Approve/Reject action modal also surfaces "Escalated By" when acting on an already-escalated request, and the escalation checkbox/second-approver option is now hidden once a request is already at `pending_secondary` — it was previously always shown for any approve action regardless of stage, offering a dead option the server would silently ignore.
- Approval/rejection comments now correctly read `secondaryApproverComments` for escalated requests (the second reviewer's actual decision comment) instead of always showing the first reviewer's escalation note relabeled as the final comment; a separate "Escalation Note" section shows the first reviewer's note when one exists.

---

## Pay Type Now Reflects the Real Outcome, Not Just Submitted Intent

**Status:** Shipped (client + server; server backfilled historical approved leaves from existing day-level records).

**Problem:** `Leave.isPaid` only ever reflected the employee's submitted intent and was never updated after approval — so a request submitted as "Paid" that partially or fully fell back to unpaid (balance ran out at approval time) still showed a "Paid Leave" badge everywhere, even though the actual day-by-day breakdown correctly showed unpaid.

**Fix:**
- New `actualPaidHours`/`actualUnpaidHours` fields, populated once a leave is decided (server).
- `lib/leaveBalanceUtils.js`: new `resolveLeavePayOutcome(leave)` — derives `"paid"` / `"unpaid"` / `"partial"` for approved leaves from these fields, falling back to submitted intent for pending/rejected leaves (nothing's been applied yet, so intent is still accurate there).
- Applied everywhere a Paid/Unpaid badge shows: the admin table's Pay Type column, the admin detail panel's top badge (with a new violet "Partially Paid" state), and the employee-side `PayPill` component (now takes the full leave record instead of a bare `isPaid` boolean).

---

## Company Leave Requests — Admin Panel Redesign

**Status:** Shipped (client only).

**Page:** `/dashboard/company/leave-requests`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx`

**Problem:** The page used a centered modal for viewing/approving requests (inconsistent with the persistent side-panel pattern already established on `employee/leave-logs`, `PunchLogs.jsx`, and `SchedulesCalendarView.jsx`), a Table view with a redundant dedicated "View" button/column, heavy colored card sections in the Approve/Reject dialog, a Calendar view that stacked its two columns too early, and a few real bugs surfaced through live testing.

**Fix:**
- **Table view:** "View" modal replaced with an inline persistent side panel (row click selects, orange highlight, explicit X dismiss) — matches the employee-side pattern. Removed the now-redundant View button/column, leaving 4 core columns (Name + status badge on the same line, Date Range with weekday, Leave Type, Submitted) plus a new Pay Type pill column.
- **Calendar view:** the day-details card now swaps its own content in-place (back-chevron + "Request Details" header, same shared detail content) instead of popping a modal when a leave is clicked — no new column needed, reuses the existing card. Fixed the two-column grid's breakpoint from `xl:` (1280px) to `lg:` (1024px) to match the reference `employee-schedules` page, so it stops stacking (forcing a scroll) at window widths where it should already be side-by-side.
- **Bug:** switching between Table and Calendar view didn't clear the shared detail-selection state, so a request selected in one view stayed visibly "open" after switching to the other. Both toggle buttons now reset it.
- **Approve/Reject modal:** rebuilt from four heavy colored card sections (green Employee box, orange Leave Period box, purple Balance box, blue Second-Approval box) to the same flat `DetailSectionLabel`/`DetailRow` list presentation as the Request Details panel — consistent visual language across the whole page now. Employee name shown instead of email. Added a subtle "This is the second and final approval for this request" note when acting on an already-escalated request.
- **Bug:** Leave Credits in the detail panel listed every leave type the employee had credits for; now shows only the type actually being requested.
- Extracted `renderLeaveDetailContent`/`renderLeaveDetailActions` as shared functions so the table panel, calendar in-place view, and (where still applicable) any modal content can't drift out of sync with each other.

---

## Leave Requests — Cancel Own Request

**Status:** Shipped (client wiring for a new server endpoint, `PUT /api/leaves/:id/cancel`).

**Page:** `/dashboard/employee/leave-logs`

**File:** `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx`

**Problem:** Employees had no way to withdraw their own leave request before a decision was made.

**Fix:**
- New "Cancel request" button in the detail panel's footer, shown only while status is `pending` or `pending_secondary`.
- `409` (someone already acted on the request in the moment before cancel was pressed) handled identically to how the admin UI already handles approve/reject conflicts — a friendly "Already handled" toast plus a list refresh, not a generic error.

---

## Leave Requests — Company-Wide PDF Export

**Status:** Shipped (client only).

**Page:** `/dashboard/company/leave-requests` (Table view)

**Files:** `lib/exports/leaveRequests.js` (new), `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx`

**Problem:** No way to export the currently-filtered leave request list for record-keeping.

**Fix:**
- New "Generate PDF" button in the table toolbar, following the same branded export pattern already established for punch logs (`lib/exports/_shared.js` — logo, report metadata box, footer with requestor info + page numbers).
- Report only includes whatever the table's active filters currently show (date range, status tab, search) — not the full unfiltered company history.
- Report metadata box includes Company, **Generated By** (the admin running the report), Email, **Date Range** (the applied filter), and Total Records.
- Table columns: Employee, Leave Type, Date Range, Days, Pay Type, Status, **Balance** (the employee's current available balance for that leave type), Approver, Decided By, Submitted.
- A "Deducted" column (actual hours paid, from `actualPaidHours`) was added and then removed after review — leaves approved before the Pay Type fix above have no backfilled value there, showing a confusing blank for otherwise-normal approved requests; removed rather than risk being misread as a bug.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx` | Table view: modal → inline side panel, removed View column, added Pay Type column, name+status on one line, weekday in date format. Calendar view: in-place detail swap instead of modal, `lg:` breakpoint fix, `ChevronLeft` back button. Fixed `detailDialog` not resetting on view-mode switch. Approve/Reject modal rebuilt with `DetailSectionLabel`/`DetailRow`; escalation option gated to `status === "pending"`; added Escalated By; employee name instead of email; subtle final-approval note. Leave Credits limited to the requested type only. Added Generate PDF button + `handleGeneratePdf`. Removed now-unused `DollarSign`/`ArrowUpCircle`/`CreditCard`/`leaveTypes` state. |
| `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx` | Added "Escalated By"/"Decided By" sections; fixed approval/rejection comment display (previously rejection-only, and read the wrong field for escalated requests); removed redundant "Pay type" row from Request Info; `PayPill` now derives from `resolveLeavePayOutcome`; added Cancel request button + `handleCancel` (409 handling). |
| `lib/leaveBalanceUtils.js` | New `resolveLeavePayOutcome(leave)` helper. |
| `lib/exports/leaveRequests.js` | New — `exportLeaveRequestsPDF()`, company-wide leave requests PDF report. |
