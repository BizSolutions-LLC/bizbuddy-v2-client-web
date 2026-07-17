# Changelog — v2.14.10

BB-043 fix: excluding a single Driver/Aide segment in Cutoff Review was incorrectly cascading to the other segments in the same driver day.

Sidebar fix: the "Leave" item under Settings was renamed to "Leave Settings" for clarity.

BB-047 redo: Company Configurations rebuilt into a tabbed layout with per-section save; Check Printing relocated to Payroll Management; Check Printing UI polished to match the design system.

BB-048 fix: leave request form now sends the entered time window to the server, renders no-shift days distinctly, and greys out the time pickers when they're not needed.

BB-045 fix: a split leave day (balance runs out partway through) now renders as one row with both a paid and unpaid badge instead of two colliding rows.

Leave Settings fix: removed the dead "Final Approver" dropdown, which never actually controlled who leave requests escalate to.

---

## BB-043 — Excluding a Segment Excluded All Segments in the Driver Day

**Status:** Fix applied (client only) — pending manual verification, not yet confirmed closed.

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Problem:** For Driver/Aide employees, a day's punch is split into three segments (`driver_am`, `regular`, `driver_pm`) grouped as one driver day, each with its own Exclude action. Clicking Exclude on a single segment sent a correctly-scoped PATCH for just that one record, but immediately after success the client optimistically force-marked the other two sibling segments as "excluded" in local state too, based on an unverified comment assuming the server cascades the exclude across the whole driver group. The result: excluding just `driver_am` also visually excluded `regular` and `driver_pm`, contradicting the exclude dialog's own copy ("This record will be removed from payroll").

**Fix:**
- Removed the client-side sibling-cascade block in `confirmExclude`.
- After a successful single-segment exclude, the handler now calls `refreshApprovals(recId)` to re-sync real state from the server — the same pattern already used by the existing `doReset` handler — instead of guessing which other records should change.
- No server-side change required: the network request was already scoped to the single segment; only the local optimistic-update logic was wrong.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | `confirmExclude`: removed the sibling-cascade block that force-excluded other segments in the same driver group; now calls `refreshApprovals(recId)` after a successful exclude instead. |

---

## Sidebar — "Leave" Renamed to "Leave Settings"

**Status:** Fix applied (client only) — pending manual verification, not yet confirmed closed.

**File:** `components/Dashboard/sidebar.jsx`

**Problem:** Under the Settings section of the company admin sidebar, the nav item linking to `/dashboard/company/leave-settings` was labeled just "Leave," which read ambiguously next to sibling items like "Profile," "Configurations," and "Notifications."

**Fix:** Changed the `label` for the `company/leave-settings` sidebar entry from `"Leave"` to `"Leave Settings"`. The route id was left unchanged, so no links break.

### Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/sidebar.jsx` | Line 115: `label: "Leave"` → `label: "Leave Settings"` on the `company/leave-settings` sidebar entry. |

---

## BB-047 — Company Settings UI Redo + Check Printing Relocation

**Status:** Fix applied (client only) — pending manual verification, not yet confirmed closed.

**Pages:** `/dashboard/company/configurations`, `/dashboard/employee/payroll` (Payroll Management, admin/supervisor/superadmin only)

**Problem / Ask:** `CompanyConfigurations.jsx` rendered 9 setting cards stacked on one long page with a single global "Save Settings" button, making it hard to navigate. Separately, "Check Printing" (paycheck template positioning) lived on that same page even though it's payroll output configuration, not timekeeping configuration — it fit more naturally alongside Payroll Management's existing Company tab (tax config, pay period, etc.). Its own UI also had heavy design-system drift (raw HTML buttons/divs instead of shadcn primitives, hardcoded hex colors, no dark-mode support, off-brand blue CTA).

**Fix:**
- **Tabbed layout:** `CompanyConfigurations.jsx` reorganized into 4 tabs — Time Settings (Timezone + Time Defaults + Auto Clock-Out), OT Configurations, DayCare Settings (hidden for non-DayCare companies, same as before), Break Policy (Auto-Break Policy + Dept Lunch + Dept Coffee) — following the hand-rolled tab-bar pattern already used in `Payroll.jsx`. Tab nav is horizontally scrollable (`overflow-x-auto`) for mobile.
- **Per-section save:** the single global "Save Settings" button was removed from the page header and a `SaveSettingsBar` was added inside each relevant tab instead. Note: there's only one save endpoint (`PATCH /api/company-settings`), which always sends the full settings draft — each button is the same save action relocated next to its most relevant fields, not a true isolated per-tab save.
- **Check Printing relocated:** `CheckSettings.jsx` (component itself unmoved) is no longer rendered from `CompanyConfigurations.jsx` — it's now a new "Check Printing" tab in `Payroll.jsx`, rendered unconditionally like the page's other tabs (Create Paycheck, Employee Sheet, Reports, Employee, Company). No new role guard was added — `Payroll.jsx` has no per-tab role checks for any of its tabs today; access is governed only by the existing sidebar nav visibility (`admin`/`supervisor`/`superadmin` see the "Payroll Management" link at all). Matching that existing (unguarded) pattern was an explicit choice, not an oversight.
- **Check Printing UI polish:** header, "Select Template" card, "Save Settings" button, and "Live Preview" panel rewritten with shadcn `Button`/`Card`/`Badge` primitives, Lucide icons, dark-mode variants, and the app's orange brand color (was `bg-blue-600`). Added `p-4 sm:p-6` to the root wrapper — tab content in `Payroll.jsx` has no padding wrapper of its own, so the page previously rendered flush against the card edges.
- **Left untouched, by explicit decision:** the "Fine-tune Settings" slider card (raw `<input type="range">` + custom hex-hardcoded thumb CSS) and the `LiveCheckPreview` sub-component (its inline positioning styles are legitimate computed-value usage, not drift) — flagged as a separate future cleanup, not done here.
- No server-side changes required anywhere in this ticket.

### Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyConfigurations.jsx` | Rebuilt into 4 tabs with per-tab `SaveSettingsBar`; removed global header Save button; removed the Check Printing tab/import (moved to `Payroll.jsx`). |
| `app/dashboard/employee/(E_Payroll)/payroll/Payroll.jsx` | Added a new "Check Printing" tab rendering `CheckSettings`, unconditionally, matching the page's existing (unguarded) tab pattern. |
| `components/Dashboard/DashboardContent/CompanyPanel/Settings/CheckSettings.jsx` | Restyled header/template selector/save button/live preview panel with shadcn primitives, Lucide icons, dark mode, orange brand color; added root padding. Sliders and `LiveCheckPreview` left unchanged. |

---

## BB-048 — Leave Request Time Window Not Sent; No-Shift Days Not Distinguished

**Status:** Client fix applied. Companion server repo (`bizbuddy-v2-server`) side — `calcDailyHours`/`getAffectedSchedules`/`submitLeaveRequest` — is committed (`a14411c`) and pushed to `release/v2.10.26`; its migration has been run against the database. Not yet confirmed merged to server `master` or deployed to production — pending manual verification once both sides are live.

**Page:** `/dashboard/employee/leave-logs` (New leave request form)

**File:** `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx`

**Problem:** The "New leave request" form already had Start/End time pickers, but they were purely decorative — never sent to `GET /api/leaves/affected-schedules` (the pre-submission preview) or `POST /api/leaves/submit`. Separately, once the server started returning synthetic `isFallback: true` entries for no-shift days (server-side BB-048 work), the client's "Affected schedules" list had no handling for them — it would've rendered a blank shift name and a `"— → —"` time range instead of something meaningful.

**Fix:**
- `fromTime`/`toTime` (from the existing `startTime`/`endTime` state) are now sent on both the affected-schedules fetch and the submit body.
- `isFallback: true` rows render as "No shift scheduled" instead of a blank shift name/time range.
- The time pickers are greyed out (with an explanatory note) whenever every day in the range already has a real shift, since the entered window would be inert for that request; enabled whenever at least one day has no real shift, including a mixed range.
- A second helper note explains that the window is used and capped at the company's default shift length, for the case where the pickers are still active.

### Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx` | Added `fromTime`/`toTime` to the affected-schedules fetch and submit body; added `hasRealShiftDay`/`hasFallbackDay` memos; greyed out time pickers + helper text; `isFallback` rows render distinctly. |

---

## BB-045 — Split Leave Day Rendering (Balance Runs Out Mid-Day)

**Status:** Client fix applied. Companion server repo side — `computeProration`/`LeaveDay` schema change — is committed (`586f5e2`) and pushed to `release/v2.10.26`; its migration has been run against the database. Same not-yet-deployed-to-production caveat as BB-048 above.

**Pages:** `/dashboard/employee/leave-logs` (employee's own decided-leave day breakdown), `/dashboard/company/leave-requests` (approver preview + decided-leave day breakdown)

**Files:** `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx`, `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx`

**Problem:** Server-side, the day where a leave's balance runs out partway through now splits into two `LeaveDay` rows sharing the same date (one paid portion, one unpaid portion) instead of the whole day falling to one side. All three client day-list renders (employee day breakdown, approver preview, approver day breakdown) keyed each row by `date` alone and would have collided/misrendered on a split day.

**Fix:** all three renders now group entries by date before mapping, so a split day shows as a single row with both a paid and an unpaid badge/hour value, instead of two separate rows with a duplicate React key.

### Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx` | `dayBreakdown` render now groups entries by date before mapping. |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx` | Both `preview.days` and `dayBreakdown` renders now group entries by date before mapping. |

---

## Leave Settings — Removed Dead "Final Approver" Dropdown

**Status:** Fix applied (client only) — pending manual verification, not yet confirmed closed.

**Page:** `/dashboard/company/leave-settings`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Settings/LeaveSettings.jsx`

**Problem:** The "Leave Approval" card's "Final Approver" dropdown let an admin pre-select one
specific company-wide person as "the account that gives the final approval on all leave requests."
That value (`Company.secondaryApproverId`) is never read anywhere in the actual escalation logic —
`leaveController.js`'s `approveLeave` lets the first-stage approver escalate to *any* active
admin/supervisor/superadmin in the company, chosen live via a dropdown at the moment of escalation
(the same "Require second approval" control seen on the Approve Leave Request dialog), completely
ignoring this setting. This matches a gap already flagged in `OLD_LEAVE_MODULE.md §9.1` and claimed
fixed in `LEAVE_MODULE.md §8/§12` — the behavior was replaced, but the Settings UI for the old
mechanism was never removed.

**Fix:**
- Removed the "Final Approver" picker and its validation warning from `LeaveApprovalCard`.
- Removed the now-unused `approvers`/`loadingApprovers` state, the `loadApprovers()` fetch
  (`GET /api/leaves/approvers`), and its two call sites — nothing else in the file used that data
  once the dropdown was gone.
- Updated the toggle's description and the "How Two-Step Approval Works" callout to describe what
  actually happens (an eligible admin or the requester's department supervisor, chosen live at
  escalation time) instead of referencing a preconfigured "company-wide final approver."
- The "Enable Two-Step Leave Approval" toggle itself is untouched — `multiApprovalEnabled` is still
  real and still gates escalation server-side (`leaveController.js:373`).

**Flagged, not fixed here:** `Company.secondaryApproverId` (schema + `companySettingsController.js`)
remains a genuinely dead field server-side — left alone as a harmless unused column pending a
separate server-repo cleanup decision.

### Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Settings/LeaveSettings.jsx` | Removed the Final Approver picker, its `approverId` derivation, and the `approvers`/`loadingApprovers` state/fetch/props; updated toggle description and info-callout copy. |
