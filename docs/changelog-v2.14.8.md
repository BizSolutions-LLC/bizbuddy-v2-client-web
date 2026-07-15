# Changelog — v2.14.8

BB-041: the Punch Logs Employee filter now defaults to single-select (radio-style) instead of accumulating multiple employees on every click, with an opt-in "Select multiple" toggle to restore the previous checkbox behavior. Also consolidated the duplicate refresh control on the same page: the standalone refresh icon on the "Punch Log Requests Pending Approval" card now piggybacks on the page-level refresh button.

---

## Punch Logs — Employee Filter Single/Multi-Select Toggle

**Status:** Shipped (client only).

**Ticket:** BB-041

**Page:** `/dashboard/company/punch-logs` → Filters & Controls → Employee

**Files:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`, `components/common/MultiSelect.jsx`

**Problem:**

The Employee filter already supported search, the full employee list with an "All employees" option, and A→Z/Z→A sorting, but every click on an employee row simply added or removed that employee from the selection (checkbox behavior). There was no way to quickly select just one employee without clicking to deselect any others already checked.

**Fix:**

- Added a "Select multiple" checkbox next to the Employee filter label, off by default.
- **Single-select mode (default):** clicking an employee replaces the current selection with just that one employee (radio-style). Clicking "All employees" still resets to the default "All employees" state.
- **Multi-select mode (toggle on):** restores the original checkbox/accumulate behavior, starting from whatever employee was already selected.
- Toggling multi-select **off** collapses the selection down to the first employee that was selected, discarding the rest (or stays on "All employees" if that was selected).
- "Clear all filters" also resets the toggle back to single-select.
- `components/common/MultiSelect.jsx` gained an opt-in `singleSelect` prop (default `false`, so the other three consumers — Column Selector, Contest Requests, Employee Deletion — are unaffected): when enabled, each option row renders a radio-style indicator instead of a checkbox, and selecting an option auto-closes the popover.
- Scoped to the Employee filter only; the Department filter is a plain single-select dropdown already and was left unchanged.

---

## Punch Logs — Duplicate Refresh Icon on Pending Approval Card

**Status:** Shipped (client only).

**Page:** `/dashboard/company/punch-logs` → Punch Log Requests Pending Approval

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

**Problem:**

The "Punch Log Requests Pending Approval" card had its own refresh icon in its header (calling `fetchPendingRequests()` only), separate from the page-level "Refresh data" icon in the top header (`refreshAll`, which already refreshed bootstrap data and timelogs but not pending requests). Two refresh controls on the same page did overlapping, inconsistent jobs.

**Fix:**

- Removed the standalone refresh button from the Pending Approval card header.
- `refreshAll` (the top-level "Refresh data" `IconBtn`) now also calls `fetchPendingRequests()` alongside `bootstrap()` and `fetchTimelogs()`, so a single refresh action keeps the pending-requests list in sync with everything else on the page.

---

## BB-044 — Reusable Cutoff Date Range Filter + Punch Logs Bootstrap Endpoint

**Status:** Shipped (client) on `/dashboard/employee/punch-logs`, `/dashboard/employee/contest-time-logs`, `/dashboard/company/contest-requests`, `/dashboard/company/leave-requests` (Table view), `/dashboard/company/overtime-requests`, and `/dashboard/employee/leave-logs`; backend bootstrap endpoint (`GET /api/punch-logs/bootstrap`) live for punch-logs only. In progress on remaining candidate pages.

**Ticket:** BB-044

**Files:** `components/common/CutoffDateRangeFilter.jsx` (new), `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`, `app/dashboard/employee/(C_TimeKeeping)/contest-time-logs/page.jsx`, `app/dashboard/company/contest-requests/page.jsx`, `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx`, `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesOvertimeRequests.jsx`, `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx`

**Problem:**

The status-colored cutoff-period date range picker (a follow-on idea from BB-041's Date Range filter on the company punch-logs page) was going to be a one-off inline patch. Since cutoff-period-aware date filtering is a recurring need across the app, it was extracted into a reusable component instead — and while wiring it up on the employee punch-logs page, an audit of that page's mount-time requests turned up an opportunity to cut 6 separate API calls down to 1.

**Fix:**

- New `components/common/CutoffDateRangeFilter.jsx` — a controlled component exporting `groupPeriodsByRange`, `groupStatus`, `periodRangeKey` helpers alongside the component. Renders a quick-select dropdown grouped by pay period: a status glyph per row (green `CircleDot` = open, amber `Lock` = locked, blue `CheckCircle2` = processed, red `AlertTriangle` = partial — colors matched to the existing `STATUS_CONFIG` badge language already established in `CutoffReview.jsx`) with a hover tooltip explaining the status, a "Current" tag on today's period, and a department-count chip — plus manual date inputs and an Apply action.
  - `mode` prop (`"combined"` default / `"picker"` / `"range"`) lets the dropdown and the manual date inputs render together in one control, or split into two independent, always-visible filter slots.
  - `size` prop (`"default"` / `"compact"`) matches either the desktop company-page filter styling or the employee panel's mobile-first `h-8`/`text-xs`/`rounded-lg` rows.
- **`/dashboard/employee/punch-logs`:** Filters & Controls now has two separate slots instead of one merged control — **"Date range"** (`mode="picker"`, always visible even with zero periods loaded, matching how every other filter on the page behaves) and **"Custom range"** (`mode="range"`, explicit Start/End labels) for picking dates outside anything the dropdown offers. Selecting a period in one syncs the other; editing the custom range resets the picker back to "Custom range."
- **Backend consolidation — `GET /api/punch-logs/bootstrap`:** following a field-level audit (which fields this page actually reads from each response), replaced 6 separate mount-time requests — company settings, employment details, leave approvers, account approvers/supervisors, assigned locations, pending punch-log requests — with one bootstrap call. `activeCutoffPeriod` (feeds the Cutoff OT threshold card) is now derived via `useMemo` from the bootstrap's `cutoffPeriods` array instead of its own dedicated `&status=open` fetch. All 6 individual endpoints remain live and unchanged for mobile — this is additive only.
- **`/dashboard/employee/contest-time-logs`:** same "Date range" (picker) + "Custom range" (Start/End) slot split as punch-logs, using `cutoffPeriods` embedded in `/api/employment-details/me` (initially wired to a separate `/api/cutoff-periods?departmentId=` call, corrected to match the punch-logs consolidation once it turned out the picker was returning empty for the same reason as before). Bootstrap-style endpoint consolidation for this page is still pending.
- **`/dashboard/company/contest-requests`:** this page had **no date filtering at all** before (client-side Status/Employee/Reason filters only, over every contest request fetched in one shot). Added both slots from scratch — "Date range" (`mode="picker"`, company-wide cutoff periods via `GET /api/cutoff-periods`, no department scoping since this is a cross-department admin view) and "Custom range" (`mode="range"`), filtering the already-loaded `contestRequests` list client-side by `submittedAt`. Folded into `clearFilters`/`anyFilterActive`.
- **`/dashboard/company/leave-requests` (Table view only, not Calendar view):** same company-wide picker + custom range pair as contest-requests, added to the existing search/status-tab toolbar. Filters by **overlap** with each leave's own `[startDate, endDate]` span rather than a single point-in-time field, since a leave request is itself a date range — a multi-day leave that merely crosses into the selected window still shows up, not just ones that start inside it. Also added a "Clear" button (shown only when a filter is active) that resets search, status tab, and both date range slots together — this page had no reset mechanism at all before.
- **`/dashboard/company/overtime-requests`:** folded into a broader table redesign (see below) — added the same company-wide picker + custom range pair to the new toolbar, filtering by submission date (`createdAt`), a single point-in-time field like punch-logs and contest-requests above.
- **`/dashboard/employee/leave-logs`:** same picker + custom range pair as `/dashboard/company/leave-requests`, added to the existing search/status-tab toolbar. Filters by **overlap** with each leave's own `[startDate, endDate]` span (leave period, not submission date) rather than a single point-in-time field, consistent with how leave-requests already filters. Stats, status tabs, and the table itself now derive from this date-filtered set. Also added a "Clear" button, and fixed the existing page-reset effect so a date-range change resets pagination back to page 1 the same way a tab/search change already did.

---

## Contest Requests — Table Redesign + Detail Side Panel

**Status:** Shipped (client only).

**Page:** `/dashboard/company/contest-requests`

**File:** `app/dashboard/company/contest-requests/page.jsx`

**Problem:**

The table tried to show everything on every row — Employee, a 2-box Original Punch Log, a 2-box Requested Times, Reason, Status, Submitted At, plus 4 action icons — which made it cramped and hard to scan, and every clock in/out was colored green/red regardless of whether that field had actually changed or the request had even been reviewed yet.

**Fix:**

- Cut the table down to Employee, Original punch, Requested, Status, Submitted At. Reason moved into the detail side panel; Actions (Approve/Reject) moved there too.
- Replaced the "View Details" `Dialog` with an inline row-click side panel (same pattern as `employee/punch-logs`'s log-detail panel) — clicking a row highlights it (orange background + left border accent) and slides in a panel with Status, Original Punch, Requested Change, Reason, and Submitted, plus Approve/Reject buttons for pending requests and a Delete icon in the header.
- Recolored the time values: Original punch is always plain text (black), except a missing/invalid original clock-out still shows explicit red **"Invalid date"** rather than being hidden. Requested time color now follows the request's own status — green once approved, orange while pending, red once rejected — instead of highlighting whichever field happened to differ from the original.
- Removed the redundant status-icon-next-to-badge in both the table and the panel (kept just the badge).
- Employee name is vertically centered against the row height and horizontally centered, matching the header.

---

## Overtime Requests — Full Redesign + Detail/Action Side Panel

**Status:** Shipped (client only).

**Page:** `/dashboard/company/overtime-requests`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesOvertimeRequests.jsx`

**Problem:**

The page used shadcn `Card`/`Badge` + the generic `DataTable` component with two separate `Dialog` modals — one for viewing request details, another for the Approve/Reject action — while `employee/leave-logs` (the reference page for this redesign) had already moved to a fully custom-styled layout (hairline-border "BOX" cards, hand-rolled table/search/tabs/pagination) with a single row-click side panel replacing both dialogs. Two pages doing the same "review a submitted request" job looked and behaved inconsistently.

**Fix:**

- Rewrote the page's visual layer to match `leave-logs`: custom BOX-styled page header and 4 metric cards (Total Requests, Pending, Approved, Approved Hours), a hand-rolled sortable/searchable/paginated table (replacing `DataTable`), and the same tab/search/pagination-footer chrome.
- Replaced the "View Details" `Dialog` and the separate Approve/Reject `Dialog` with a single row-click side panel: clicking a row highlights it (orange background + left border accent) and slides in a panel showing Employee, Status, OT/Late hours, Submitted timestamp, TimeLog ID, Reason, and any existing approver comment.
- Approve/Reject now happens inline in the panel — the buttons reveal a comment textarea (required for Reject, optional for Approve) with Confirm/Cancel, instead of opening a third modal.
- Kept the `CutoffDateRangeFilter` already on this page (BB-044, above), restyled to sit in the new toolbar alongside the search bar and status tabs.
- Dropped the bulk-select/bulk-approve/bulk-reject scaffolding (`selectedRequests`, `bulkActions`) — it had no working implementation (empty `// Handle bulk approve` stubs) and `leave-logs` has no equivalent, so it was cut rather than carried forward.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | Added `multiSelectEmployees` state, `toggleEmployeeFilter`/`handleMultiSelectEmployeesChange` handlers, "Select multiple" checkbox next to the Employee filter label, `singleSelect` prop wiring, reset on "Clear all filters"; removed the Pending Approval card's own refresh button and folded `fetchPendingRequests()` into the page-level `refreshAll` |
| `components/common/MultiSelect.jsx` | Added opt-in `singleSelect` prop: radio-style row indicator, auto-close popover on select, controlled `open` state |
| `components/common/CutoffDateRangeFilter.jsx` | New reusable component — cutoff-period quick-select dropdown (status glyph, tooltip, "Current" tag, department chip) + manual date range + Apply, with `mode` and `size` variants |
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` | Split Date Range filter into "Date range" (picker) + "Custom range" (Start/End) slots; replaced 6 mount-time fetches with `fetchBootstrap()` → `GET /api/punch-logs/bootstrap`; `activeCutoffPeriod` now derived via `useMemo` instead of its own fetch |
| `app/dashboard/employee/(C_TimeKeeping)/contest-time-logs/page.jsx` | Added `fetchEmployeeDetails` reading embedded `cutoffPeriods`; split Date Range filter into "Date range" (picker) + "Custom range" (Start/End) slots in place of the old inline date inputs, same pattern as `PunchLogs.jsx`; removed dead `employeeDeptId` state |
| `app/dashboard/company/contest-requests/page.jsx` | Added company-wide `cutoffPeriods` fetch, `handleCutoffSelect`, "Date range" (picker) + "Custom range" (Start/End) slots; table redesign — Employee/Original punch/Requested/Status/Submitted only, Reason and Approve/Reject/Delete moved into a new row-click side panel replacing the old Dialog; status-based (not diff-based) Requested-time coloring; removed redundant status icon; centered Employee cell |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx` | Added company-wide `cutoffPeriods` fetch, `handleCutoffSelect`, "Date range" (picker) + "Custom range" (Start/End) slots to the Table view's toolbar; date filter uses `[startDate, endDate]` overlap instead of a single-field comparison; added `anyTableFilterActive`/`clearTableFilters` and a "Clear" button (page previously had no filter-reset mechanism) |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesOvertimeRequests.jsx` | Full rewrite from shadcn `Card`/`DataTable` + two `Dialog`s to the custom BOX-styled layout matching `leave-logs`; consolidated "View Details" + Approve/Reject dialogs into a single row-click side panel with inline approve/reject; kept `CutoffDateRangeFilter` restyled into the new toolbar; removed non-functional bulk-select scaffolding |
| `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx` | Added company-wide `cutoffPeriods` fetch, `handleCutoffSelect`, "Date range" (picker) + "Custom range" (Start/End) slots to the history table's toolbar; date filter uses `[startDate, endDate]` overlap; added `anyDateFilterActive`/`clearDateFilters` and a "Clear" button; stats/tabs/table now derive from the date-filtered set; page-reset effect now also fires on date-range changes |
