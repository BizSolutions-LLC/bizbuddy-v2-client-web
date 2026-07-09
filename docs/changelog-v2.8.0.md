# Changelog

All notable changes to BizBuddy v2 Client Web are documented here.

---

## [v2.8.0] — 2026-03-31

### Timekeeping — Employee Punch

- **DayCare Driver-Aide threshold now configurable** — removed hardcoded `45`-minute constant from `Punch.jsx`. Threshold is now fetched from `GET /api/company-settings` (`driverAideThresholdMinutes` field) on mount, with a client-side fallback of `45` if the field is absent.
- **Auto-lunch deduction signal** — when an employee's department has `paidBreak: true` and `autoLunchDurationMinutes`/`autoLunchAfterHours` set, an amber banner appears once the elapsed shift time crosses the configured threshold and the employee hasn't taken a manual lunch break. On time-out, the server receives `autoLunchApplied: true` and `autoLunchMinutes` to apply the deduction automatically.

---

### Timekeeping — Punch Logs (Employee)

- **All three OT thresholds integrated** — `PunchLogs.jsx` now reads `dailyOtThresholdHours`, `weeklyOtThresholdHours`, and `cutoffOtThresholdHours` from company settings. Previously only the daily threshold was used.
- **OT Info Panel** — a new info panel renders between the stats row and the filters section. Shows the active OT basis (daily / weekly / cutoff), the relevant threshold, the employee's department name, a progress bar (green → amber at 80% → red at 100%), and a pending hours note. Helps employees understand their OT consumption in context.
- **Smart OT config-aware** — `GET /api/overtime/smart-detect` now receives `otBasis`, `threshold`, and (for cutoff basis) `periodStart`/`periodEnd` as query parameters so the server can filter correctly for the company's configured basis.
- **Employee department fetched** — `GET /api/employment-details/me` is now called on mount to get `departmentId` and `departmentName`, used for the OT Info Panel and to fetch the active cutoff period.
- **Active cutoff period fetched** — when `otBasis === "cutoff"`, the component fetches `GET /api/cutoff-periods?departmentId=...&status=open` to determine the current window for OT consumption calculation.
- **Bug fix: `isDailyBasis is not defined`** — runtime error caused by a missed variable reference during OT threshold refactor. Fixed by replacing `isDailyBasis` with `otBasis === "daily"` inline.

---

### Timekeeping — Contest Dialog

- **`ContestDialog` extracted as standalone component** — the inline ~80-line Contest Dialog JSX in `PunchLogs.jsx` has been replaced with a dedicated `ContestDialog.jsx` component. Improvements over the original:
  - Log selector shows human-readable date + time range instead of raw DB id
  - Time inputs changed from `type="datetime-local"` (UTC-sliced) to `type="time"` (local time) — ISO is reconstructed on submit via `buildISO()` to avoid timezone issues
  - Before/after comparison strip shows recorded vs. requested times side-by-side, updating live as the user edits
  - Delta pill shows net hour impact (+/- from recorded), coloured green/red
  - Two-section layout: "Select & correct" and "Approver & reason"
- **`submitContestPolicy` updated** — now accepts `(clockInISO, clockOutISO)` parameters from `ContestDialog` instead of reading state values directly.

---

### Company Configurations

- **DayCare Settings card** — a new `DayCareSettingsCard` section appears in Company Configurations for DayCare companies only (detected via `NEXT_PUBLIC_DAYCARE_COMPANY_IDS`). Allows admins to configure `driverAideThresholdMinutes` (default: 45). Saves via `PATCH /api/company-settings`.
- **Quick Guide — DayCare conditional** — the DayCare entry in the Quick Guide panel is now hidden for non-DayCare companies. The `isDayCare` flag is derived from a `GET /api/company/me` fetch on mount.
- **Per-department auto-lunch configuration** — when a department has `paidBreak: true`, two new inline fields expand: **Duration (min)** and **After (hours)**. Each field saves individually on `blur` via `PUT /api/departments/update/:id`. A live preview line and active/inactive status badge reflect the current config. Fields are hidden when `paidBreak` is false.

---

### Employees

- **Schedule inheritance modal** — when an employee is created or moved to a different department, the client checks for active recurring schedules applicable to that employee (both `assignmentType: "all"` and `assignmentType: "department"` matching the new department). If any are found, a modal appears listing them with checkboxes (all pre-selected). The admin can deselect individual schedules or skip entirely. Confirmed selections are applied via `POST /api/shiftschedules/:scheduleId/apply-to-employee`.
  - Filtering is done client-side from `GET /api/shiftschedules` (server-side `departmentId` + `status` filtering is spec'd in `CHANGELOG_SERVER.md` for a future server update).
  - For edits, the modal only triggers when the department actually changed (tracked via `editOriginalDeptId`).
- **`DeleteEmployeeModal` extracted as standalone component** — replaces the original inline delete dialog with an improved UX:
  - Employee identity card with initials avatar, name, email, role badge, and department badge
  - "What gets deleted" consequence list (account access, employment data, schedule assignments) with a softer note that time logs are retained for payroll
  - Confirmation input — admin must type the employee's full name before the delete button enables, with green/red border feedback as they type
  - Prevents accidental deletions

---

### Recurring Schedules

No new features. Existing implementation reviewed:
- Conflict resolution uses named actions (`"check"` / `"skip"` / `"replace"`) to prevent double conflict-detection loops
- Edit sends full payload including `shiftId` so the server can regenerate `UserShift` records
- Stats reads `avgDaysPerSchedule` matching the API field name

**Known gap documented:** Department-assigned schedules are snapshot-based at creation time. New employees added to a department after a schedule was created do not automatically inherit it — handled by the new Schedule Inheritance Modal above.

---

### Feedback Widget

- **New `FeedbackWidget` component** — a fixed left-edge tab (`position: fixed, left: 0, vertically centered`) is now mounted on every dashboard page via `DashboardLayoutClient.jsx`. Available to all authenticated roles.
- Slides in a panel from the left (spring animation) with fields: **Category** (Bug Report / Suggestion / Question / Other), **Title**, **Description**
- Auto-captures and sends with every submission: current page route, user role, `userAgent`, and `screenResolution` (`window.screen.width x window.screen.height`)
- On success, displays the feedback log number returned by the server: `"Your feedback has been logged as #1000"`
- Connects to a **Google Sheets Apps Script** webhook — each submission automatically appends a row to a Google Sheet with columns: Log #, ID, Date, Employee, Email, Role, Category, Title, Description, Page, Status, Browser, OS, Device, Resolution
- Server parses `userAgent` into structured `browser`, `os`, and `device` fields (via `ua-parser-js`) before forwarding to the webhook

---

### New Files

| File | Description |
|---|---|
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/ContestDialog.jsx` | Standalone contest clock-in/out dialog — drop-in for PunchLogs |
| `components/Dashboard/DashboardContent/CompanyPanel/Organizations&People/DeleteEmployeeModal.jsx` | Standalone delete confirmation dialog with name-typing guard |
| `components/common/FeedbackWidget.jsx` | In-app feedback widget — fixed left-side tab, slides in panel, posts to `/api/feedback` |
| `CHANGELOG_SERVER.md` | Running log of all server-side changes required to support v2.8.0 client features |

---

### Server-Side Changes Required

All backend changes needed for v2.8.0 are documented in `CHANGELOG_SERVER.md` at the project root. Summary:

| # | Change | Endpoint(s) |
|---|---|---|
| 1 | `driverAideThresholdMinutes` field in company settings | `GET` + `PATCH /api/company-settings` |
| 2 | `autoLunchDurationMinutes` / `autoLunchAfterHours` on Department; auto-lunch signal on time-out | `GET /api/departments` · `PUT /api/departments/update/:id` · `GET /api/employment-details/me` · `POST /api/timelogs/time-out` |
| 3 | All three OT thresholds in company settings response | `GET /api/company-settings` |
| 4 | Smart OT detection accepts OT config query params | `GET /api/overtime/smart-detect` |
| 5 | Employment details response includes department name + id | `GET /api/employment-details/me` |
| 6 | Schedule apply-to-employee endpoint; department + status filtering on schedules list | `POST /api/shiftschedules/:id/apply-to-employee` · `GET /api/shiftschedules` |
| 7 | Feedback endpoint + Google Sheets webhook + `logNumber` in response | `POST /api/feedback` |
