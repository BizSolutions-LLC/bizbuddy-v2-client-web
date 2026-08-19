# Changelog — v2.14.19

BB-070: Company Employees table trimmed to fewer, more useful default columns (Hire Date dropped from the default view, still available via Manage Columns), the Employee ID column's server-generated ID shown at a smaller font instead of truncated, and a bug fix so the Edit Employee dialog's Direct Supervisor field correctly pre-selects the employee's existing supervisor instead of always defaulting to "No Direct Supervisor".

BB-071: Cutoff Period review page — fixed the "Sync Records" loading overlay centering on the whole scrollable page instead of the visible viewport, and reorganized the sticky header to stop breadcrumb/badge text from wrapping mid-phrase under normal screen widths.

BB-069: Manual leave-balance adjustments now require a reason note (client + server), and employee self-cancel of a pending leave request can optionally carry one too — both surface in the Sick Leave Ledger's Note column, closing the two biggest gaps in the leave-balance audit trail.

BB-072: Leave Request, Overtime, Punch Log Request, and Contest Time Log approver pickers now resolve to the employee's actual assigned direct supervisor (falling back to the admin/superadmin list when none is assigned) instead of a broad, department-inferred supervisor pool — client + server.

---

## BB-070 — Company Employees table cleanup + Edit dialog supervisor pre-fill fix

**Status:** Fixed (client only).

**Pages:** Company Employees (`/dashboard/company/employees`)

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Organizations&People/Employees.jsx`

**Ask:** Trim the employee table to fewer columns, and fix the Edit Employee dialog not showing an employee's already-assigned direct supervisor.

**Investigation findings:**
- The Employee ID column rendered two lines per row: the Company Employee ID and, underneath it, the full server-generated `id` (a long UUID) in small text — noted as too lengthy to scan.
- `openEditModal` populated `editForm.supervisorId` from `employee.employmentDetail?.supervisorId`, but the API response only nests the supervisor as a relation object at `employee.employmentDetail?.supervisor` (with its own `.id`) — there is no flat `supervisorId` scalar on that object. The lookup always resolved to `undefined` and fell back to `"none"`, so the Direct Supervisor `<Select>` showed "No Direct Supervisor" even when a supervisor was actually assigned (confirmed via the read-only Employee Details panel, which reads the nested `.supervisor` object correctly and displayed the right name). The adjacent `departmentId` field one line above already follows the correct pattern (`employee.department?.id`), which is what exposed the mismatch.

**Fix:**
- **Default visible columns** — removed `"hireDate"` from `visibleCols`' initial state so it no longer shows by default; the column definition and its entry in the Manage Columns picker (`columnOptions`) are untouched, so it remains selectable. Create/edit forms, CSV import/export, and the employee details panel are unaffected — they reference `hireDate` independently.
- **Employee ID column** — the server ID line now renders at `text-[10px]` (no smaller standard Tailwind token exists in this repo's config) instead of being truncated, so the full ID stays visible but takes less vertical/visual weight than the Company Employee ID line above it.
- **`supervisorOptions`** — now unions in the employee's currently-assigned supervisor even if they no longer meet the active/role eligibility filter (e.g. deactivated, or role changed away from supervisor/admin/superadmin), labeled `(former supervisor)` in the dropdown so it's distinguishable from a normally selectable option.
- **`openEditModal`** — `editForm.supervisorId` now reads `employee.employmentDetail?.supervisor?.id` instead of the nonexistent `employmentDetail?.supervisorId`, matching the pattern used for `departmentId`. The Direct Supervisor field now correctly pre-selects the employee's existing supervisor when the Edit dialog opens.

**Server-repo impact:** None — purely client-side rendering and read-mapping fixes; no API, payload, or contract changes.

### Files Changed

| File | Changes |
|---|---|
| `.../Organizations&People/Employees.jsx` | Removed `hireDate` from default visible columns; Employee ID column's server-ID line now shown at smaller font instead of truncated; `supervisorOptions` includes the current supervisor even when ineligible for new assignment, labeled accordingly; `openEditModal` fixed to read `employmentDetail.supervisor.id` so the Direct Supervisor field pre-fills correctly. |

---

## BB-071 — Cutoff Review: sync overlay centering fix + header decluttering

**Status:** Fixed (client only).

**Pages:** Cutoff Period Review (`/dashboard/company/cutoff-periods/[id]/review`)

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Ask:** Two related UI/UX issues on the same page: (1) the "Sync Records" loading overlay was centering on the full scrollable page rather than the visible screen, and (2) the sticky header's breadcrumb and badges were wrapping awkwardly mid-phrase ("Cutoff" / "Periods" and "Auto-revert:" / "ON" splitting onto separate lines) at normal widths.

**Investigation findings:**
- The sync overlay (`fixed inset-0`) is a descendant of `DashboardLayoutClient.jsx`'s content wrapper (`motion.div`, line ~138), which animates with `y` — Framer Motion implements this via a CSS `transform`. Any transformed ancestor becomes the containing block for `position: fixed` descendants, so the overlay was centering on that wrapper's full content box (which can exceed the viewport height) instead of the actual browser viewport.
- A helper for exactly this scenario already existed and was unused: `components/ui/modal-portal.jsx` (`ModalPortal`, using `createPortal` to `document.body`).
- The header wrapping was a crowding issue, not a text-length issue: the top row (`PageHeader`) packed breadcrumb + status badge + Auto-revert badge + payment date + two buttons into one `flex justify-between` row with no `whitespace-nowrap` guards, so multi-word text nodes broke mid-phrase instead of the row wrapping cleanly.
- Also confirmed the sync button's own loading/disabled state, and the sync handler's error-field usage (`data.message`), were already correct — verified against the server's `syncCutoffApprovals` controller, which consistently returns `{ message }` on all error paths. No client or server change needed there.

**Fix:**
- **Sync overlay** — wrapped the `<AnimatePresence>` sync-overlay block in `<ModalPortal>` so it renders into `document.body`, escaping the transformed ancestor and centering on the real viewport.
- **Header decluttering** — added `whitespace-nowrap` to the breadcrumb spans, status badge, and payment-date text so none of them can break mid-phrase. Moved the "Auto-revert: ON" badge out of the crowded top-right action cluster (it's purely informational, per the existing BB-051 note — doesn't gate anything) and into the stats row as a right-aligned tile next to "OT Basis," reusing that row's existing `border-l` divider pattern. No logic, state, or button behavior changed — layout only.

**Server-repo impact:** None — both fixes are purely client-side rendering/layout changes.

**Explicitly out of scope (discussed, not actioned):**
- A separate functional finding during investigation — the sync handler only refetches/reports success when `created > 0`, silently ignoring the server's `recomputed`/`recomputeFailed`/`otRecomputed` results (meaning a sync that recomputes existing records without creating new ones shows a misleading "Already up to date" toast and doesn't refresh the screen) — was surfaced but explicitly not part of this ticket's scope, which was UI/loading-state and layout only.

### Files Changed

| File | Changes |
|---|---|
| `.../Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | Sync overlay wrapped in `ModalPortal` (portals to `document.body`) to fix viewport-centering; `whitespace-nowrap` added to breadcrumb/badge/payment text; Auto-revert badge relocated from the top action row to the stats row. |

---

## BB-069 — Require/accept a note on leave-balance adjustments and self-cancel

**Status:** Fixed (client + server — server shipped ahead of this client catch-up).

**Pages:** Leave Settings (`/dashboard/company/leave-settings`, Adjust Credits modal), Leave Logs (`/dashboard/employee/leave-logs`, self-cancel)

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Settings/LeaveSettings.jsx`
- `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx`

**Ask:** Every movement in an employee's leave balance (deduction, approval, adjustment) should carry a note, so the Sick Leave Ledger is a complete audit trail rather than having gaps.

**Investigation findings:**
- The Ledger UI (`LeaveLedgerDrilldownModal` in `LeaveSettings.jsx`) already had a Note column rendering `t.note || "—"` — the gap was entirely upstream, in which write paths actually populate `LeaveTransaction.note` (a nullable field never enforced).
- Approve/Reject/Escalate already captures a real user-supplied note (`approverComments`), just optional — left as-is per explicit scope decision.
- Accrual (monthly/yearly) and punch-vs-leave conflict resolution (the BB-068 area) already always write a system-generated note (e.g. "Monthly accrual — March 2026", "Cancelled: punch honored over leave") — not user-authored, but never blank, so left as-is.
- Two flows had **zero** note support end-to-end: manual admin balance adjustment (`POST /api/leave-balances/adjust` didn't even accept a note field from the client) and employee self-cancel of a pending request (`PUT /api/leaves/:id/cancel`, no body sent at all).

**Decision (confirmed before implementation):** manual adjustment note is **required** (it's a direct, unexplained balance edit); self-cancel note is **optional** (lower-stakes — cancelling a still-pending request has no balance effect); approve/reject left untouched.

**Server-side (shipped first, in bizbuddy-v2-server):**
- `POST /api/leave-balance/adjust` — `note` is now a **required** field; missing/blank returns `400 { message: "A reason is required for a manual balance adjustment." }`. **Breaking change** for any caller not sending `note`.
- `PUT /api/leaves/:id/cancel` — `note` is now an **optional**, additive field; existing calls with no body are unaffected.
- No schema/migration needed — `LeaveTransaction.note` already existed as a nullable column.

**Client-side fix:**
- **`AdjustCreditsModal`** (`LeaveSettings.jsx`) — added a required "Reason" `Textarea` step after the amount field; `isValid` now also requires a non-empty trimmed note; `note` included in the `POST /api/leave-balances/adjust` payload.
- **Self-cancel** (`LeaveLogs.jsx`) — the one-click "Cancel request" button now opens a confirmation dialog (previously there was no confirmation step at all) with an optional "Reason" `Textarea`, styled to match the file's existing dialog conventions. `PUT /api/leaves/:id/cancel` now sends `{ note }` only when one was typed, omitting the body otherwise to match the server's non-breaking contract.

**Server-repo impact:** Required — both endpoints above were changed in `bizbuddy-v2-server` ahead of this client change; the adjustment endpoint change is breaking and this client update was required to avoid the new 400.

### Files Changed

| File | Changes |
|---|---|
| `.../Settings/LeaveSettings.jsx` | `AdjustCreditsModal`: added required `note` state + "Reason" textarea step; `isValid` requires a non-empty note; payload now includes `note`. |
| `.../EmployeePanel/Leaves/LeaveLogs.jsx` | Self-cancel now opens a confirmation dialog with an optional "Reason" textarea instead of firing immediately; `handleCancel` conditionally sends `{ note }` in the request body. |

---

## BB-072 — Route employee requests to the actual direct supervisor + admin list

**Status:** Fixed (client + server — server shipped ahead of this client catch-up).

**Pages:** Leave Logs (leave request submission), Punch Logs (Overtime request, Punch Log Request, Contest Time Log)

**Files:**
- `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx`
- `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/ContestDialog.jsx`
- `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`

**Ask:** Every employee request flow that needs an approver (Leave, Overtime, Punch Log Request, Contest Time Log) should offer the employee's actual assigned direct supervisor plus the admin list, instead of a broader, loosely-related pool.

**Investigation findings:**
- A full inventory of the four employee-initiated approval flows found none of them used the employee's real assigned `employmentDetail.supervisorId` (the same field BB-070 fixed). All four pulled from either a flat admin+department-supervisor pool, or (Contest Time Log) admin only.
- Root cause: the server had a function literally named `getDirectSupervisors()` that, despite the name, resolved supervisors by **department relationship** (anyone supervising the employee's department), never reading the individually-assigned `supervisorId` FK.
- Leave Request didn't call that function at all — its picker (`GET /api/leaves/approvers`) only pulled from a separate, broader "eligible approvers" pool (admins + department supervisors).
- Overtime and Punch Log Request already consumed `getDirectSupervisors()`'s output via a shared bootstrap endpoint, so they inherited the department-based (not individually-assigned) supervisor list.
- Contest Time Log had no supervisor concept in its picker at all — admin-only.

**Decisions (confirmed before implementation):** narrower list of [direct supervisor if assigned] + [admin/superadmin list] — no department-wide fallback; when no direct supervisor is assigned, fall back to admins only; keep the picker UX (not auto-select); apply consistently across all four flows.

**Server-side (shipped first, in bizbuddy-v2-server):**
- `getDirectSupervisors()` (`approverResolutionService.js`) rewritten to resolve the employee's actual `employmentDetail.supervisorId` (0–1 result), falling back to the admin/superadmin list when unset or the assigned supervisor is inactive.
- `getEligibleApprovers()` simplified to a pure company-wide admin/superadmin list — supervisor selection is now `getDirectSupervisors()`'s exclusive responsibility.
- `GET /api/leaves/approvers` — **breaking change**: response shape changed from a flat array to `{ data: { supervisors: [...], approvers: [...] } }`.
- `submitLeaveRequest`'s inline approver-eligibility check widened to also accept the requester's actual assigned direct supervisor regardless of department match (previously could reject a cross-department assigned supervisor).
- Approval-side fix: a cross-department direct supervisor could previously be picked as approver but would then 403 trying to act on it (`canAct: false`) — now fully actionable.
- No change needed for Overtime/Punch Log Request/Contest Time Log submission validation (already company-wide role checks, or no server-side validation at all).

**Client-side fix:**
- **`LeaveLogs.jsx`** — updated to read the new `{ supervisors, approvers }` response shape; approver `<Select>` now shows a "Direct Supervisor" group pinned first, then "Approvers".
- **`ContestDialog.jsx`** — added a `supervisors` prop and a "Team Supervisors" group above "Approvers" in its picker, matching the grouped pattern already used by Overtime/Punch Log Request.
- **`PunchLogs.jsx`** — passed its existing `supervisors` state (already fetched via bootstrap) through to `<ContestDialog>`.
- Overtime and Punch Log Request pickers needed no client changes — they already consumed `supervisors`/`approvers` from the bootstrap payload and inherited the corrected, narrower lists automatically once the server-side functions were fixed.
- `GET /api/account/approver` (also changed server-side) confirmed unused anywhere in this client-web repo — mobile-only endpoint, no action needed here.

**Server-repo impact:** Required and already shipped — `bizbuddy-v2-server`'s `approverResolutionService.js`, `leaveController.js` (`getApprovers`, `submitLeaveRequest`), and the leave-approval action-permission check were all changed ahead of this client update; the `GET /api/leaves/approvers` shape change is breaking and this client update was required to consume it correctly.

### Files Changed

| File | Changes |
|---|---|
| `.../EmployeePanel/Leaves/LeaveLogs.jsx` | New `supervisors` state; approver fetch reads `data.supervisors`/`data.approvers` instead of a flat array; picker renders a "Direct Supervisor" group pinned first, then "Approvers". |
| `.../EmployeePanel/TimeKeeping/ContestDialog.jsx` | New `supervisors` prop; picker renders a "Team Supervisors" group above "Approvers". |
| `.../EmployeePanel/TimeKeeping/PunchLogs.jsx` | Passes existing `supervisors` state through to `<ContestDialog>`. |
