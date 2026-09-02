# Changelog — v2.14.23

BB-080: Supervisors, admins, and superadmins can now file a punch/time-correction request on behalf of an employee in their scope, instead of only the employee being able to self-submit — still routed through the normal pending-approval flow. Adds a "File for employee" entry point + employee picker to the existing request wizard, and a "Filed by X" indicator on both the employee's own request list and the approver's queue.

BB-081: New "Upload Weekly Schedule" CSV bulk-import flow for the Shifts & Schedules module — set a week/overnight flag and download a matching template, upload it back, review parsed rows (editable shift names, per-row Ready/Conflict/Error status, skip toggle) in a second modal, then confirm to create. Consumes three already-live server endpoints.

---

## BB-080 — Supervisor Files a Punch/Time-Correction Request on Behalf of an Employee

**Status:** Feature added (client only) — server contract was already live by the time of manual testing.

**Pages:** Punch Logs (`/dashboard/employee/punch-logs`), Employees Punch Logs (`/dashboard/company/punch-logs`)

**Files:**
- `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

**Ask:** Server accepts an optional `targetUserId` on `POST /api/request-punch-log/submit` (self-submit unchanged when omitted/self; 403 for an employee caller or an out-of-scope target; 404 if the target isn't found/in-company), exposes `GET /api/employee/team` returning the employees the caller may act for (department match OR individually-assigned direct supervisor — the same eligibility rule already used for Leave approver eligibility; company-wide for admin/superadmin), and adds a `createdBy` field (nested `{ id, email, profile }` on `my-requests`/submit/approve/reject responses, flattened as `createdByDisplayName` on `all-requests`) so a request can show who actually filed it versus who it's for.

**Investigation findings:**
- `PunchLogs.jsx` was already the only file with a working submission wizard and "My Requests" list; `EmployeesPunchLogs.jsx` is approve/reject-only with no submission UI. Reusing the existing wizard (rather than building a second one in the queue page) avoided duplicating ~350 lines of stepper/date/conflict-check/reason UI.
- `components/common/MultiSelect.jsx` (already used in `EmployeesPunchLogs.jsx` in `singleSelect` mode) was reused for the new employee picker rather than building a new component.
- Checked for a shared hook/context to fetch profile/role before adding another local fetch — none exists. `/api/account/profile` is already independently called in 9 separate files across the repo (`sidebar.jsx`, `UserMenu.jsx`, `EmployeesPunchLogs.jsx`, `Overview.jsx`, `Punch.jsx`, `Departments.jsx`, `CompanySubscription.jsx`, `MyPrsnlDplymntIdntfctns.jsx`, `notifications/page.jsx`). Adding a 10th local fetch to `PunchLogs.jsx` follows the existing (if duplicated) convention rather than introducing new redundancy; consolidating into a shared hook was raised and declined as out of scope for this ticket.
- `all-requests`' flattened `createdByDisplayName` has no `createdById`, so the approver's queue can't reliably distinguish "you filed this" from "someone else filed this for a peer's report." Declined to fake that distinction via name-matching; confirmed with the user that a generic "Filed by [name]" label is acceptable instead.

**Fix:**
- **Entry point** — new "File for employee" button in `PunchLogs.jsx`'s toolbar, next to "Request entry," gated to `["supervisor","admin","superadmin"]` via `currentUserRole` (fetched from `GET /api/account/profile`, new `fetchCurrentUserRole()` wired into the existing mount-time `useEffect`).
- **Employee picker** — `requestOnBehalfMode`/`requestTargetUserId`/`teamEmployees`/`loadingTeamEmployees` state; `fetchTeamEmployees()` calls `GET /api/employee/team`, triggered lazily by a `useEffect` only when the request dialog is open in on-behalf mode (matching `LeaveLogs.jsx`'s precedent for lazy on-demand picker data). Step 1 of the existing 3-step wizard renders a `MultiSelect` (single-select, searchable, sortable) above the Date field when in on-behalf mode, required via the existing Step 1 validation block.
- **Submit** — `targetUserId` conditionally spread into the existing `POST /api/request-punch-log/submit` body; dialog close/reset and post-submit reset both clear the two new fields; success toast differentiates ("Punch log request filed for employee!" vs. the existing "…submitted!").
- **"Filed by X" indicators** — `PunchLogs.jsx`'s My Requests list shows "Filed by [name] on your behalf" using the nested `createdBy.profile` shape when present; `EmployeesPunchLogs.jsx`'s queue card shows a "Filed by [name]" pill using the flattened `createdByDisplayName` field, next to the existing Submitted/Approver row — styled to match the card's existing status pills (`PunchTypeBadge`'s `rounded-full` pattern) rather than plain inline text. Both are purely additive — no changes to either endpoint's existing fetch functions.

**Bugs found and fixed during manual testing:**
1. **Role-gate silently failing** — the button was initially gated on `useAuthStore().user?.role` (the decoded JWT), matching a pattern seen elsewhere in the repo (`EmployeesOvertimeRequests.jsx`, `FeedbackWidget.jsx`). It never rendered for any account. Root cause: `useAuthStore().user` only reliably carries `userId`/`companyId`/`exp` — it does not carry a usable `role` claim. Every *verified* role-gated view in this codebase (`sidebar.jsx`, `UserMenu.jsx`, `EmployeesPunchLogs.jsx`'s own `currentUserRole`) instead fetches the live role from `GET /api/account/profile`. Fixed by adding the same fetch to `PunchLogs.jsx` (new `currentUserRole` state + `fetchCurrentUserRole()`), gating the button off that instead.
2. **Wrong endpoint path** — client called `GET /api/employees/team` (plural); the actual server route is `GET /api/employee/team` (singular), consistent with this repo's existing `/api/employee` convention (`Employees.jsx`, `EmployeesPunchLogs.jsx` both already call the singular form). The resulting 404 during manual testing was traced to this typo, not a missing endpoint. Fixed the one call site in `fetchTeamEmployees()`.

**Server-repo impact:** None remaining — confirmed all three contract pieces (`targetUserId` on submit, `GET /api/employee/team`, `createdBy`/`createdByDisplayName` on the five listed responses) were already live server-side; this was pure client integration once the path typo above was corrected.

**Explicitly out of scope (flagged, not actioned):**
- `POST /api/request-punch-log/check-conflict` doesn't accept `targetUserId`, so conflict-checking during an on-behalf submission checks the filing supervisor's own logs, not the target employee's. Not part of the ticket's numbered contract; flagged as a likely follow-up.
- Step 2 (Approver) still offers the filing supervisor's own approver list in on-behalf mode — no "approvers for target employee X" endpoint exists. Flagged as a possible future gap, not blocking.
- The approver's queue shows a generic "Filed by [name]" rather than a personalized "You filed this for [employee]" — the flattened `all-requests` response has no `createdById` to support that distinction. Confirmed acceptable with the user.
- Found and did **not** fix, as unrelated to this ticket: `fetchBootstrap`/`fetchMyRequests` in `PunchLogs.jsx` both call `setRequestsExpanded(...)`, a setter that was never declared (the real state is `requestsV2Expanded`/`setRequestsV2Expanded`). It throws inside an empty `catch {}` and silently no-ops, so the request list's auto-expand-when-pending behavior has never actually worked. Flagged to the user as a separate, pre-existing bug.

### Files Changed

| File | Changes |
|---|---|
| `.../EmployeePanel/TimeKeeping/PunchLogs.jsx` | New `MultiSelect` import; `requestOnBehalfMode`/`requestTargetUserId`/`teamEmployees`/`loadingTeamEmployees`/`currentUserRole` state; `fetchTeamEmployees()` (lazy, `GET /api/employee/team`) and `fetchCurrentUserRole()` (`GET /api/account/profile`); role-gated "File for employee" toolbar button; employee picker in wizard Step 1 + validation; `targetUserId` added to the submit body; dialog reset/close updated; "Filed by X on your behalf" row added to the My Requests list. |
| `.../Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | Queue card's Submitted/Approver row now also shows "Filed by [name]" from `createdByDisplayName` when present. |

---

## BB-081 — Upload Weekly Schedule (CSV Bulk Import)

**Status:** Feature added (client only) — server contract confirmed live and testable at scoping time.

**Pages:** Recurring Schedules (`/dashboard/company/schedules`)

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/UploadWeeklySchedule.jsx` (new)
- `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/Schedules.jsx`

**Ask:** Bulk-create a week's worth of per-employee shifts from a CSV instead of building each schedule by hand. Server exposes `GET /api/schedule-import/template?weekStart=&overnight=` (CSV download), `POST /api/schedule-import/preview` (multipart `file` + `overnight` field → 200 `{ data: { rows: [{ row, employeeId, employeeName, date, startTime, endTime, crossesMidnight, shiftName, timeRangeKey, status: 'ready'|'conflict'|'error', reason }] } }`, 400 for whole-file problems), and `POST /api/schedule-import/confirm` (JSON `{ rows }` — the preview rows with any `shiftName`/`skip` edits → 207 `{ data: { created, skipped, failed } }`). A block ending exactly at midnight gets `crossesMidnight: true` even without the overnight flag — pre-existing `shiftController.js` semantics (`startMinutes > endMinutes`), not something to "correct" client-side.

**Investigation findings:**
- No existing component in this codebase does real drag-and-drop file upload — the closest precedent (`ImportPunchLogs.jsx`, BB-077) is a styled click-to-browse box only. Built genuine `onDragOver`/`onDrop` handling for this ticket.
- No "week starting" picker exists anywhere in the app (`CutoffDateRangeFilter.jsx` is pay-period-specific and a poor fit); used a plain `Input type="date"` instead of forcing an unrelated component to fit.
- No inline-editable table cell exists anywhere in this codebase (every table's edits go through a separate dialog). Built the Shift Name column's editable `Input` from scratch on top of `Table`/`TableCell` primitives.
- `ImportPunchLogs.jsx` (BB-077) has no separate preview-before-commit step — it uploads and commits in one request. BB-081's two-request `preview` → `confirm` flow is a new interaction shape for this codebase, not a reuse, even though the surrounding dialog chrome (step-machine, template download, `Alert`-for-whole-file-errors convention) was reused directly.
- Reused the established 3-state `Badge` pattern (`bg-{color}-100 text-{color}-800 border-{color}-300`, dark variants) from `EmployeesPunchLogs.jsx`'s PENDING/APPROVED/REJECTED pills for the new Ready/Conflict/Error statuses, rather than inventing new color tokens.
- **Found a second instance of the same bug class as BB-080:** `Schedules.jsx` destructured `const { token, role } = useAuthStore()`, but `useAuthStore` never exposes a `role` property (only `token` and a computed `user` JWT getter) — so the page's own admin/supervisor/superadmin redirect guard (`useEffect` at the top of the component) had silently never fired for anyone. Flagged and fixed as part of this ticket, using the same `GET /api/account/profile` fetch pattern established in BB-080.

**Fix:**
- **`UploadWeeklySchedule.jsx`** — new dialog, four-step machine (`setup` → `uploading` → `preview` → `confirming`):
  - *Setup* — overnight Yes/No radio (native `<input type="radio">`, matching this same file's own `assignmentType` picker convention rather than introducing shadcn `RadioGroup`) with dynamic helper text; "Week starting" date input; "Download CSV Template" button (`GET /api/schedule-import/template` with `weekStart`/`overnight` query params, same blob/object-URL download pattern as BB-077); a real drag-and-drop dropzone with a Remove-file link; client-side type/size pre-checks before any network call.
  - *Preview* — summary line (static `successCount`/`failedCount` computed from `status`, not affected by later skip toggles), a review table (Employee/Date/Time/Shift Name/Status) in a plain `overflow-y-auto` scroll container (not the shared `ScrollArea` — see follow-up below), editable Shift Name `Input` per row (disabled for `error` rows, since those can never be created regardless of the name), Ready/Conflict/Error `Badge` per row, and a "Skip this row" `Checkbox` shown only on non-`ready` rows. Footer's "Confirm & Create Schedules (N)" count is *live*, computed as ready rows plus non-skipped conflict rows (error rows never count) — this wasn't fully pinned down by the spec, flagged to the user as an assumption.
  - *Confirm* — posts the full `previewRows` array (including each row's `skip` flag and any edited `shiftName`) to `/api/schedule-import/confirm`; on success shows the full-success or partial-failure toast per spec copy, calls `onImportComplete` (wired to the parent's `fetchAll`), and closes.
  - Empty/all-failed state (no creatable rows at all) shown as a destructive `Alert` in place of the summary line, with Confirm disabled.
- **`Schedules.jsx`** — new "Upload Weekly Schedule" toolbar button (with tooltip) next to Refresh/Create Schedule, only shown in list view; mounts `UploadWeeklySchedule` with `onImportComplete={fetchAll}` so the list and stat cards refresh after an import. Role bug fix described above: `role` replaced with a fetched `currentUserRole` state (`fetchCurrentUserRole()`, called alongside the existing mount-time `fetchAll()`), and the redirect-guard `useEffect` now depends on it instead of the always-`undefined` `role`.

**Follow-up polish (same session, after initial manual testing):** the review table's scroll affordance wasn't noticeable — the shared `ScrollArea` component's Radix scrollbar is a thin `w-2.5` bar, easy to miss when a row happens to get clipped right at the container edge. Since the shared `ScrollArea` wrapper doesn't forward a ref to its underlying scrollable viewport, swapped that one table's container from `ScrollArea` to a plain `overflow-y-auto` div (ref'd directly) and added a floating, bouncing "scroll down" chevron button pinned to the bottom-center of the table — shown only while there's more content below (hidden at the true bottom, and hidden entirely if the table never overflows), scrolling smoothly by ~80% of the visible height on click.

**Server-repo impact:** None — all three endpoints were already live and confirmed reachable by the user before implementation began.

**Explicitly out of scope / flagged assumptions:**
- `readyCount`'s exact definition (ready + non-skipped conflicts, excluding errors) is an interpretation of an underspecified part of the copy doc — flagged to the user rather than assumed silently.
- Not verified end-to-end against the live server by the assistant (per this repo's standing rule) — pending the user's manual test pass.

### Files Changed

| File | Changes |
|---|---|
| `.../Shifts&Schedules/UploadWeeklySchedule.jsx` | New file — four-step import dialog: overnight/week-start fields, template download, drag-and-drop upload, editable-shift-name review table with Ready/Conflict/Error badges and per-row skip toggle, confirm step, and a floating scroll-down affordance on the review table. |
| `.../Shifts&Schedules/Schedules.jsx` | New "Upload Weekly Schedule" toolbar button + dialog mount (`onImportComplete={fetchAll}`); fixed the page's dead role-based redirect guard by replacing the nonexistent `useAuthStore().role` with a fetched `currentUserRole` (`GET /api/account/profile`). |
