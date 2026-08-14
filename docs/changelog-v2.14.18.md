# Changelog — v2.14.18

BB-055: client caught up to the already-shipped server support for direct supervisor assignment — the admin Employees edit dialog can now set/clear an employee's direct supervisor, restricted to active supervisors/admins/superadmins in the company, gated on the employee already having an employment-details record; also fixed an error-toast bug that would have swallowed all of this ticket's new validation messages.

BB-066: added a "Cancelled" status tab/stat and a cancelled-timestamp detail row to both the admin and employee leave-request views, so cancelled leave requests are visible and filterable instead of only living in status data with no dedicated UI surface.

---

## BB-055 — Direct Supervisor Assignment (admin employee edit)

**Status:** Feature added (client only), admin-side edit flow. Employee creation and CSV bulk import were explicitly deferred — see below.

**Pages:** Company Employees (`/dashboard/company/employees`)

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Organizations&People/Employees.jsx`

**Ask:** The server now accepts `supervisorId` on `PUT /api/employee/:id` (and several other endpoints not touched by this ticket), with three rules: setting a supervisor requires the employee already has an `EmploymentDetail` record; the candidate must be an active, same-company user with role `supervisor`, `admin`, or `superadmin` (not a plain employee, not self); and the response's `employmentDetail` now additively includes a nested `supervisor` object. The client had no UI to set this at all.

**Investigation findings:**
- No supervisor picker existed anywhere in the codebase for `employmentDetail.supervisorId` — this was net-new UI, not an extension of existing code.
- The *display* side was already ahead of this: `Employees.jsx`'s `processedEmployees` memo and its employee-details panel already read `employmentDetail?.supervisor` (the new nested object) defensively via optional chaining, so no read-side changes were needed.
- `Employees.jsx`'s create/edit/delete handlers read `j.message` from failed responses, but this endpoint (like the rest of the in-scope set) returns `{ error }`, not `{ message }`. Left as-is, every new 400 from this ticket — "Set up this employee's employment details before assigning a supervisor.", the two eligibility errors — would have silently fallen through to a generic "Failed to update employee." toast.
- A separate, unrelated supervisor picker already exists in `Departments.jsx` for a *department's* supervisor (`PUT /api/departments/update/:id`, filtered to `role === "supervisor"` only). Different field, different endpoint, different eligibility rule — intentionally not touched.
- Employee creation has no `EmploymentDetail` record at the moment of `POST /api/employee`, so the constraint blocks setting a supervisor there regardless of UI — no field was added to the create dialog.
- `MyEmplymntDtls.jsx` (employee self-service "My Employment Details") is 100% read-only with no save/PUT call in the client at all; making it editable was explicitly deferred, scoped as a separate follow-up.

**Fix:**
- **`supervisorOptions`** (new `useMemo` in `Employees.jsx`) — filters the already-loaded `employees` list to `status === "active"` and `role IN (supervisor, admin, superadmin)`, excluding the employee currently being edited (self-assignment guard).
- **Edit form state** — `editForm.supervisorId` added (defaults to `"none"`); new `editHasEmploymentDetail` boolean set in `openEditModal` from `!!employee.employmentDetail`.
- **Edit dialog UI** — new "Direct Supervisor" `Select` next to Time Zone in the Employment Details section. Disabled with an explanatory note ("Set up this employee's employment details above, save, then reopen to assign a supervisor.") when the employee has no employment-details record yet, so the 400 for that case is avoided by the UI rather than just handled after the fact.
- **`handleSaveEdit`** — `supervisorId` is excluded from the generic "`\"none\"` → `undefined`" field mapping (which would have *omitted* it) and handled explicitly: only included in the payload when `editHasEmploymentDetail` is true, with `"none"` mapping to `null` (clear) rather than being dropped — matching the server's set/clear/omit three-way contract.
- **Error surfacing** — `handleCreateEmployee` and `handleSaveEdit` now read `j.error || j.message || "..."` instead of only `j.message`, so the new validation messages actually reach the user.

**Server-repo impact:** None — all server-side work for BB-055 shipped ahead of this change; this was a pure client catch-up.

**Explicitly out of scope (deferred):**
- Supervisor field on employee **creation** — blocked by the same-request constraint (no `EmploymentDetail` exists yet at creation time); not applicable until/unless the creation flow changes.
- CSV bulk import (`POST /api/employee/bulk`) — no `supervisorId` column added to the template or row mapping. Deferred to a follow-up ticket per explicit decision.
- Employee self-service "My Employment Details" (`MyEmplymntDtls.jsx`, `PUT /employment-details/me`) — still fully read-only; making it editable is a larger, separate task (new form state + new save handler, no existing PUT call to extend). Deferred per explicit decision.
- `Departments.jsx`'s department-supervisor picker — left untouched; different feature, different endpoint.
- The same `j.message`/`j.error` mismatch in `Employees.jsx`'s `confirmDelete` and its `fetch`/`fetchDepartments` error paths — not part of BB-055's five listed endpoints, so left alone. Flagged for a possible standalone cleanup.

### Files Changed

| File | Changes |
|---|---|
| `.../Organizations&People/Employees.jsx` | New `supervisorOptions` memo (active supervisor/admin/superadmin, same-company, excludes self); `editForm.supervisorId` + `editHasEmploymentDetail` state; `openEditModal` populates both from the employee's `employmentDetail`; new "Direct Supervisor" `Select` in the edit dialog's Employment Details section, disabled + explained when no employment-details record exists; `handleSaveEdit` sends `supervisorId` explicitly (set/clear/omit) instead of via the generic field mapping; `handleCreateEmployee`/`handleSaveEdit` error toasts now read `j.error` before falling back to `j.message`. |

---

## BB-066 — Cancelled status surfaced in leave-request views

**Status:** Feature added (client only).

**Pages:** Employees' Leave Requests (admin/supervisor view), My Leave Logs (employee self-service view)

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx`
- `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx`

**Ask:** Leave requests can carry a `cancelled` status and a `cancelledAt` timestamp, but neither view had a way to filter to cancelled requests or see when a request was cancelled.

**Fix:**
- **`EmployeesLeaveRequests.jsx`** (admin/supervisor): `stats` memo adds a `cancelled` count (`leaves.filter(r => r.status === "cancelled")`); a "Cancelled" entry added to the status tabs alongside Pending/Approved/Rejected; the request detail panel adds a "Cancelled" row (date + time) shown only when `request.status === "cancelled" && request.cancelledAt`.
- **`LeaveLogs.jsx`** (employee self-service): same pattern — `cancelled` added to the stats memo and `TABS`, and a "Cancelled" detail row added to the selected-row panel, conditioned the same way on `status === "cancelled" && cancelledAt`.

**Server-repo impact:** None — `status: "cancelled"` and `cancelledAt` are consumed as already-present fields on the leave-request response; no new endpoint or shape needed.

**Explicitly out of scope (deferred):**
- The underlying cancel-flow correctness issue (paid-leave cancellation crediting a flat 8h with no ledger entry on punch-wins conflict resolution) is a separate, already-tracked concern — this change only adds visibility for whatever `cancelled`/`cancelledAt` data the server returns, it does not touch cancellation logic itself.

### Files Changed

| File | Changes |
|---|---|
| `.../EmployeesLeaveRequests.jsx` | `stats.cancelled` added; "Cancelled" status tab added; detail panel shows a "Cancelled" date/time row when applicable. |
| `.../LeaveLogs.jsx` | `stats.cancelled` added; "Cancelled" entry added to `TABS`; selected-row detail panel shows a "Cancelled" date/time row when applicable. |
