# Changelog

All notable changes to BizBuddy v2 Client Web are documented here.

---

## [v2.9.0] — 2026-04-06

### Leave Requests — Calendar View (Company Panel)

- **New Calendar View toggle** — the Employee Leave Requests page now supports two view modes: Table (existing) and Calendar. A toggle in the page header switches between them.
- **Monthly leave grid** — the calendar plots all leave requests on a monthly grid. Each day cell shows color-coded dot indicators reflecting the statuses of leaves spanning that day:
  - Amber dot — at least one pending request
  - Blue dot — at least one pending final approval request (`pending_secondary`)
  - Green dot — at least one approved request
  - Red dot — at least one rejected request
- **Hover tooltip** — hovering a day cell shows a tooltip with the total number of employees on leave and a breakdown by status (pending / pending final / approved / rejected).
- **Day detail panel** — selecting a date opens a detail panel listing every leave request active on that day. Each card shows the employee name, department, leave type, duration, and status badge. Pending and pending-final requests surface inline Approve and Reject action buttons directly in the panel. A context label ("Awaiting your approval" / "Awaiting your final approval") clarifies which approval step is needed.
- **Multi-day leave spanning** — leaves are correctly plotted across every calendar day from `startDate` to `endDate`, inclusive. Date parsing uses local midnight to avoid UTC timezone shifts.

---

### Leave Requests — Paid / Unpaid

- **Paid/Unpaid toggle in New Request form** (`EmployeePanel > Leave Requests`) — a segmented toggle (Paid / Unpaid) is now displayed in the New Leave Request dialog between the date fields and the reason textarea. Defaults to Paid. Submits `isPaid: true|false` in the request body.
- **Pay Type badge in leave history table** (`EmployeePanel > Leave Requests`) — a green "Paid" or red "Unpaid" badge is now shown as a column in the leave history table. Displays `—` for older records that predate this field.
- **Pay Type badge in company leave table** (`CompanyPanel > Leave Requests`) — same badge added to the company-side leave requests table so supervisors and admins can see pay type at a glance.
- **Pay Type badge in detail dialogs** — both the employee and company detail dialogs show the Paid/Unpaid badge alongside the status badge.

---

### Leave Requests — Two-Step Approval (`pending_secondary`)

- **New `pending_secondary` status** — represents a leave that has passed first-level approval and is awaiting final (secondary) approval. Displayed everywhere a leave status appears:
  - Blue badge labeled "Pending Final Approval" in all tables and detail dialogs (both Employee and Company panels)
  - "Pending Final" tab in the Company leave requests table with its own count
  - "Pending Final" stat card in the Company leave requests page
  - Blue dot indicator and "pending final" label in the Calendar View tooltip
  - Context label "Awaiting your final approval" in the calendar day detail panel
  - Approve / Reject actions remain available for `pending_secondary` requests
- **`cancelled` status** — added to statusConfig (neutral grey badge) for completeness.

---

### Company Settings — Multi-Approval

- **New Multi-Approval section** added to `CompanyPanel > Company Configurations`, between Leave Accrual and Manage Leave Types.
- Two configurable fields:
  - **Enable Two-Step Approval** (`multiApprovalEnabled`) — toggle to require a secondary approver for all leave requests. When enabled, approved requests move to `pending_secondary` before final approval.
  - **Secondary Approver** (`secondaryApproverId`) — user picker populated from `GET /api/leaves/approvers`. Only shown when two-step approval is enabled. Shows a warning if enabled but no approver is selected.
- An info callout explains the two-step flow: first-level approval moves the request to "Pending Final Approval"; the secondary approver then gives the final decision.

---

### Company Settings — Leave Accrual

- **New Leave Accrual section** added to `CompanyPanel > Company Configurations`, between Check Settings and Manage Leave Types.
- Three configurable fields saved via `PATCH /api/company-settings`:
  - **Enable Leave Accrual** — toggle to turn accrual on or off company-wide. When off, the remaining fields are hidden.
  - **Accrual Year Start Month** — dropdown (January–December) defining when the accrual year resets. Defaults to January.
  - **Enable Catch-Up Accrual** — toggle to back-credit employees hired mid-year with leave they would have earned since the accrual year started.
- An info callout notes that balances are now capped at policy maximums and carry-over executes automatically at year-end.

---

### Shared ModernCalendar Component

- **`components/common/ModernCalendar.jsx` (new file)** — extracted the calendar grid from `EmployeePanel > Schedule.jsx` into a reusable shared component. Both Employee Schedule and Leave Requests Calendar now use this component, ensuring a consistent visual design across the app.
- The component accepts three callback props to keep it generic:
  - `getDayIndicators(date)` — returns an array of `{ color }` objects for colored dot indicators at the bottom of each cell
  - `getDayTooltip(date)` — returns a ReactNode rendered inside the hover tooltip
  - `getDayExtras(date)` — returns an optional ReactNode overlaid at the top-left of the cell (used in Schedule for the multi-timezone globe icon)
- Indicator logic: up to 3 dots are shown individually; 4 or more are collapsed into a count badge.

---

### Sign-In Page — Responsiveness

- **Continue button** — increased tap target size with larger vertical padding and bold font weight. Icon size bumped for better visual balance.
- **Create Account button** — same sizing improvements as the Continue button.
- **Select Company section** — now scales correctly across mobile, tablet, and desktop breakpoints.
- **Card width** — widened from `max-w-md` to `max-w-lg` on tablet (`sm:`) and above to reduce dead space.
- **Viewport height fix** — replaced `min-h-screen` with `min-h-[calc(100vh-4rem)]` to account for the root layout's `pt-16` navbar offset, preventing the page from overflowing the viewport and breaking vertical centering.

---

### Punch Logs — Removed Delete Action (Employee Panel)

- Removed the Delete option from the actions dropdown on individual punch log rows in `EmployeePanel > Time Keeping > Punch Logs`.
- Only "View Schedule" remains as an available action, preventing accidental deletion of time records.
- Removed associated state, handler function, and dialog from the component.

---

### New Files

| File | Description |
|---|---|
| `components/common/ModernCalendar.jsx` | Shared calendar grid component — generic, callback-driven, used by Schedule and Leave Requests |

---

### Modified Files

| File | Change |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx` | Added Calendar View with `ModernCalendar`, day detail panel, leave-by-date computation, Pay Type column and badge in detail dialog, `pending_secondary` status support (blue badge, "Pending Final Approval"), stats card, tab, calendar dot and tooltip, Approve/Reject actions, and context labels. Added `cancelled` to statusConfig. |
| `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx` | Added Paid/Unpaid toggle to New Request form, Pay Type column in history table, Pay Type badge in detail dialog, `pending_secondary` status ("Pending Final Approval", blue), updated stats and tabs |
| `components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyConfigurations.jsx` | Added Leave Accrual section (`accrualEnabled`, `leaveYearStartMonth`, `newEmployeeCatchUp`), added Multi-Approval section (`multiApprovalEnabled`, `secondaryApproverId` with approver picker) |
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/Schedule.jsx` | Replaced local calendar grid with shared `ModernCalendar` component |
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` | Removed Delete action, state, handler, and dialog |
| `app/(auth)/sign-in/page.jsx` | Responsiveness improvements for buttons, company selector, and page layout |
