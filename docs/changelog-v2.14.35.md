# Changelog — v2.14.35

BB-098: Leave credits with fiscal-year grants, regularization and expiration. Admins set it up through a preview, then Apply. Balances are broken down by fiscal year, and expired hours are tracked. Leave reports (CSV/PDF) are added to Leave Settings. PadPro was set up on Oct 21, 2026, so this ships before the first expiry reminders on Nov 1.

BB-102: Admins can add, edit and delete the lunch on an employee's completed punch from Employees Punch Logs. The server recomputes the hours.

BB-089 (rework), client support: work by a fixed-hours (SV) employee on a day off can now be approved in Cutoff Review and is paid as OT on top of the fixed hours.

BB-104 / BB-105: in Cutoff Review:
- toasts show again
- Approve Schedule is disabled, with an explanation on hover, when there's no shift
- Approve Raw asks before approving a punch with no schedule
- the misleading "Left X min early" tag is suspended

BB-103: Upload Weekly Schedule becomes **Upload Schedule**:
- a date range of up to 14 days
- a template pre-filled for the target employees
- a new **Existing shifts** mode (mark "1" under a chosen shift)
- a Clean / Not clean review with **Reject or Replace** for conflicts

---

## BB-098 — Leave credits: fiscal-year grants, regularization, expiration

**Status:** Done on the client, waiting for testing. The server is complete (server v2.10.49).
- **PadPro was set up on Oct 21, 2026:**
  - 40h Sick Leave per fiscal year, fiscal year starting Jan 1
  - **monthly accrual** (about 3.33h on the 1st of each month, from Jan 1, 2027)
  - 2-year lifetime and a 60-day reminder
  - 6-month regularization with a catch-up grant
- Setup was first applied as a yearly lump sum, and the server corrected it to monthly accrual / catch-up.
- **Ship before Nov 1, 2026.** That's when the first `LEAVE_CREDITS_EXPIRING` reminders go out (6 employees, FY2025 credits). Deploy the server (v2.10.49) first, then the client.

**Page:** Company Settings → Leave Settings (`/dashboard/company/leave-settings`), and the employee's Leave Logs (`/dashboard/employee/leave-logs`).

**Leave Credits card (replaces Leave Accrual):**
- The old Leave Accrual card is removed. The server never read its fields.
- New fields:
  - grant mode (yearly lump sum or monthly accrual)
  - hours per fiscal year
  - fiscal year start (month and day)
  - credit lifetime in years
  - expiry reminder in days
  - regularization period and rule
- The regularization options depend on the mode:
  - yearly: none, prorated or full
  - monthly: none or catch up
  - Changing the mode resets the rule.
- **Save Credit Settings** saves only the leave credit fields and never sends the toggles. These fields are also left out of the page-level Save, so a toggle can never be sent from stale form state.
- Two toggles, **Automatic Grants** and **Credit Expiration**:
  - Turning one on always opens the setup review first.
  - Turning one off is always allowed and sends only that toggle.
- Fiscal year start and grant mode become read-only once `leaveCreditsInitializedAt` is set.

**Review Leave Credit Setup dialog:**
- Calls `POST /leave-balances/credit-setup/preview`. It only reads; nothing is saved.
- Shows:
  - the current fiscal year
  - four stat cards: Employees With Balance, Current Balance, Expiring Now, Balance After
  - employees with no hire date (grants skip them)
  - employees still in the regularization waiting period
- Per-employee table: Employee | Leave Type | Balance | **one column per fiscal year** (e.g. FY2026, FY2025, FY2024) | Expiring Now | After.
  - The year columns are built from the preview data, newest first, so they roll over each year without a code change.
  - Hours that expire at Apply show in red with a strike-through. Hovering a cell shows "Expires <date>".
  - "Expiring Now" means hours deducted the moment Apply is clicked. It doesn't include hours that expire later, such as FY2025 at the end of FY2026.
- **Apply** calls `POST /leave-balances/credit-setup/apply`:
  - It reports how many balances were set up and how many hours expired.
  - A 409 (someone else applied first) shows a notice and refreshes the settings.

**Leave Credits Management (matrix):**
- The **Credits** column is replaced by **one column per fiscal year**, showing the hours left from each year. The years are collected across all employees, newest first, so every employee's table lines up.
  - Fully used years show `0`. Expired years aren't shown; the Expired column covers them.
  - Before setup the server sends `creditLots: []`, so the old Credits column is shown as a fallback.
- New **Expired** column.
- The employee header shows **"<n> available"** instead of "<n> total credits". An employee who owes leave shows a negative number on purpose.
- New **info icon** next to the Balance %, with a "View history" tooltip. It opens the existing ledger dialog for that employee and leave type, and clicking the row still opens it too.
- The ledger dialog labels `expired` entries.

**Employee — Leave Logs (balance cards):**
- Also fetches `GET /leaves/balances`. If that call fails, only the new details below are hidden.
- Each leave type shows:
  - an "Xh expire on <date>" notice (only while expiration is on)
  - its fiscal-year breakdown, with "until <date>" when expiration is on
  - "Xh expired to date"

**Admin — Employee Leave Requests:**
- The balance summary shows "Xh expired" when there is any.

**Leave reports (Generate Report):**
- A new **Generate Report** button (Download icon) sits next to Refresh in the Leave Settings header. It opens **Generate Leave Report**.
- The data comes from the new **`GET /api/reports/leave`** (JSON). The client writes the file as **CSV or PDF**, the same split as the Employees Punch Logs report. Request: `docs/server-request-BB-098-leave-report.md`.
- **Report types in this release:**
  - **Balance Summary** (`type=summary`), as of a date:
    - each employee × leave type: Credited, Used, Adjusted, Expired, Available
    - one "FYxxxx Left" column per fiscal year, newest first; expired years are marked "(expired)"
  - **Activity by Period** (`type=activity`):
    - covers a date range of up to 5 years
    - grouped Monthly, Quarterly or Yearly, on a fiscal or calendar year basis
    - per period: Opening, Credited, Used, Unpaid, Adjusted, Expired, Closing
  - **Fiscal-Year Expiration** (`type=expiration`):
    - every credit lot: Granted, Used, Expired, Remaining, Expires On, State (Active / Expiring soon / Expired), Reminder Sent
    - the "expiring within" window defaults to the reminder setting
- **Shared filters:**
  - leave types (archived ones included)
  - department (admins only; supervisors are limited to their own department by the server)
  - employees
  - include inactive employees
- **Columns:**
  - "Credited" (grants plus positive admin adjustments) is the main column, because PadPro's existing balances came from adjustments and "Granted" would be 0.
  - A **Granted** column can be added for Summary and Activity.
- **Report notes:**
  - The header shows the leave credit setup, or "setup hasn't been applied yet".
  - Activity explains that used hours are counted on the approval date and unpaid hours on the leave day.
  - Summary says the fiscal-year columns reflect today's figures.
- **Empty results:**
  - An empty Expiration report before setup says that setup hasn't been applied.
  - Any other empty result shows "No data for the selected filters".
- **Not in this release:** `type=requests` and `type=ledger`. The server already supports both; they can be added to the dialog later.
- **Server-repo impact:**
  - New endpoint `GET /api/reports/leave`, built by the server.
  - It needs the server's `LeaveCredit.expiredHours` column (`scripts/add-bb098-leave-credit-expired-hours.sql`), which ships with server v2.10.49.
  - Expiration only has rows for companies that have applied setup. PadPro has, as of Oct 21, 2026.

**Notifications:**
- New code `LEAVE_CREDITS_EXPIRING` ("Leave Credits Expiring" ⏳). Tapping it opens the employee's Leave Logs.

**In-app documentation:**
- The Leave Settings help replaces the old "Leave accrual" topic with "Leave credits", covering the setup steps and the lock rules.
- The history-icon step mentions expirations.

**Server-repo impact:** Uses the BB-098 contract from `bizbuddy-v2-server`:
- new `company-settings` fields
- `credit-setup/preview` and `credit-setup/apply`
- `expired`, `creditLots` and `nextExpiration` on `/leaves/balances`
- `expired` and `creditLots` on the matrix cells

The server side ships in **server v2.10.49**. Deploy it before this client.

**Server confirmations (from the server side):**
- The year columns add up to `available` whenever it's 0 or more. A negative (debt) balance shows every year at 0.
- Expiry reminders are sent by the hourly job, never by Apply. An employee already inside the reminder window at Apply gets one within about an hour.
- Hours that expire send no notification, at Apply or later. Only an "Expired" ledger entry is written.

**Known follow-ups (not in scope):**
- Notify employees when hours actually expire. This needs a new notification code on the server, client support, and care so a company's first Apply doesn't send a flood. Separate ticket.
- The new Leave Logs balance details follow that file's existing inline `style={{...}}` hex values, which bypass the token system. Cleanup would be a separate ticket.

---

## BB-102 — Admin add / edit / delete lunch on a punch

**Status:** Done on the client, waiting for testing.

**Page:** Employees Punch Logs (`/dashboard/company/punch-logs`) → a punch's **Edit Time In / Time Out** action.

**What changed:**
- The edit dialog has a new **Lunch** section, shown only on completed punches (ones with a Time Out).
  - **No lunch yet:** "No lunch on this punch", with Start and End fields and an **Add Lunch** button.
  - **Lunch exists:** the current times are shown and filled in, with **Update Lunch** and **Delete** buttons.
  - The Start and End pickers are limited to the punch's Time In and Time Out, and End can't be earlier than Start. The server checks this too.
  - An edited lunch shows "Edited by an admin on <date/time>", taken from `lunchBreak.editedAt`. The server only sends the editor's user ID, so no name is shown.
  - The lunch saves on its own. Time In / Time Out changes still need **Save Changes**.
- **Add / Update:** `PUT /api/timelogs/:id/lunch-break` with `{ start, end }`, converted from the company timezone to UTC ISO using the file's existing `fromCompanyInputToISO`.
- **Delete:** `DELETE /api/timelogs/:id/lunch-break`.
- On success, the server's message is shown, the dialog closes, and the list is fetched again so the server's new hours appear.
- Errors are shown as the server sends them. That includes the 409 for an approved punch (Reset it on the Cutoff page first) or a locked or processed cutoff.
- Who sees the action is unchanged: admin, superadmin and supervisor, on punches that are complete and not approved.

**Unchanged:**
- Hours are calculated entirely by the server, including the minimum-lunch rule and Driver/Aide segments.
- Cutoff Review needs no client change. Pending rows read the recomputed hours from `GET /cutoff-periods/:id/approvals` when the page loads or refreshes.
- **Clear Auto-Breaks & Reset Flags** stays as it is.

**Server-repo impact:** Uses `PUT` / `DELETE /api/timelogs/:id/lunch-break` from `bizbuddy-v2-server` (`docs/client-handoff-BB-102.md`). No further server changes are needed.

---

## BB-089 (rework) — Off-day work for fixed-hours (SV) employees as approvable OT

**Status:** Done on the client, waiting for testing. The server side is in `bizbuddy-v2-server` `docs/changelog-v2.10.49.md` → "BB-089 (rework)".

**Page:** Cutoff Review (`/dashboard/company/cutoff-periods/[id]/review`)

**New rule (server):**
- **Scheduled day:** an SV's punches are covered by the flat hours (80 by default) and stay "Not counted: fixed hours".
- **Off day:** the punch goes to the admin as pending. If approved, it's paid as OT on top of the flat hours, with no threshold.
  - An SV with shifts plotted: an off day is a date with no scheduled shift.
  - An SV with no shifts in the cutoff: an off day is a Saturday or Sunday.

**What changed:**
- **Punch rows:**
  - A punch from a fixed-hours employee is treated as "fixed hours" only when `isOffDay` is false.
  - Off-day rows keep the normal Approve / Edit / Exclude actions, and their hours are no longer struck through.
  - They get an **"Off-day · OT"** tag, in the existing OT tag style, with a tooltip.
  - "Not counted: fixed hours" now appears only on scheduled-day rows.
- **OT blocks:**
  - Fixed-hours blocks are approvable like anyone else's (Approve OT / Exclude).
  - A pending one counts as pending, so it blocks Lock/Finalize.
  - The block reads "Off-day OT · Xh on top of fixed hours" instead of a threshold line, because an SV has no threshold.
  - The block's "Not counted: fixed hours" label is removed.
- **Payable:**
  - A fixed-hours employee's Total Payable is the fixed hours + **approved** OT blocks, e.g. Lennie Capulong 80 + 8 = **88h**.
  - The sub-label reads "80h regular · 8h OT · 0h leave".
  - OT is counted from the approved OT blocks, not the approved off-day punch, which carries the same hours and would double count.
  - The page-wide total hours include it.

**Unchanged:**
- The fixed-hours row stays at its flat value.
- Lock is enforced by the server.

**Server-repo impact:** Uses the new fields in `GET /api/cutoff-periods/:id/approvals`, which only add to the response:
- `isOffDay` on each approval
- off-day approvals returned as `pending`
- fixed-hours entries in `otBlocks[]`, with `threshold: 0`

No further server changes are needed.

**Employees Punch Logs reports (locked/processed cutoffs):**
- **CSV — Payroll (grid):**
  - **Scheduled days:** an SV's daily Regular cell shows the hours actually worked, capped at one shift (`defaultShiftHours`, 8). A 9h day shows 8, and a 6h day shows 6.
    - Before this, these cells were blank, because the punches are excluded.
    - This is for the record only. The daily cells won't always add up to Regular, because the flat amount is paid regardless.
  - **Off days (approved):** the daily cell shows the approved hours, so the work is on record.
  - **Totals:**
    - Regular stays at fixed hours − SL.
    - **OT** = the employee's approved SV OT blocks, not capped.
    - For SV rows, **Total = Regular + OT**, e.g. Lennie 80 + 8 = **88**, matching Cutoff Review and the server's payroll export. Everyone else's Total is unchanged.
    - The bottom Total row includes SV OT.
  - The role cell still reads "Role (fixed hours)".
- **CSV — Detail:**
  - In the Employee Summary, an SV's OT = their approved SV OT blocks. Duration and Period Hours stay at the fixed value.
  - This replaces the cutoff-basis rule (total − threshold), which would give the wrong figure now that SV employees can have approved OT blocks.
  - The per-day detail rows already show the approved off-day punch.
- **Data:**
  - `buildRowsFromApprovals` carries the actual hours of excluded scheduled-day SV punches in a separate `fixedHoursScheduledHours` field, so only the grid's daily cells read them. The PDF and the Detail rows are unchanged.
  - The server keeps the calculated hours on excluded approvals, because exclusion only changes the status.
- Open cutoffs and date-range reports are unchanged. Fixed hours only come from locked or processed cutoffs.

**Known follow-up (not in scope):**
- The PDF export still has the v2.14.34 fixed-hours gap. It was already noted there.

---

## BB-103 — Upload Schedule (rework of Upload Weekly Schedule)

**Status:** ✅ Complete. Request: `docs/server-request-BB-103-upload-schedule.md`. Used by all companies.

**Page:** Shifts & Schedules → Schedules (list view) → **Upload Schedule**, renamed from "Upload Weekly Schedule".

**Setup step:**
- **Mode:**
  - **Existing shifts** (the default) assigns existing shifts. No new Shift records are created.
    - The admin picks the **shifts in this upload**, and each becomes a template column.
    - A "1" under a shift assigns it on that row's date. Several "1"s on one row mean several shifts that day.
  - **Time blocks (30-min)** is today's half-hour grid. The overnight question only appears in this mode, because it decides how overnight runs are joined when the file is read.
- **Start date + End date**, up to **14 days** inclusive. The end date can't go past start + 13, and choosing a start date defaults the end to a week.
- **Target employees:**
  - all active employees, one department, or specific employees
  - **active employees only**, because the server returns 403 for inactive ones
  - supervisors get "Everyone in my department" and no department picker
- **Download CSV Template** comes pre-filled by the server (one row per employee per date) and is named `schedule_<mode>_<start>_to_<end>.csv`.
- **Upload & Preview** sends the same mode, dates and shift list as the template.
  - The server rejects a file whose shift columns were changed: "the template is out of date".

**Review step:**
- The header line shows the clean count, how many need attention, and how many blank rows were skipped (days off).
- **Clean — will be created:** in Time blocks mode the shift name can still be edited, as before.
- **Not clean**, grouped by the server's status:
  - **Overlaps an existing assignment:**
    - Shows the uploaded shift next to the assignment it clashes with, including a different date when an overnight shift spills over.
    - **Reject / Replace** per item, defaulting to Reject.
    - Replace is only offered when the server allows it (`allowedActions`), and the server's reason is shown when it isn't.
  - **Overlaps another entry in this file** and **Can't be processed:** skipped automatically. They're fixed in the file and uploaded again.
- Choosing Replace shows a warning: it removes the existing assignment permanently, and the employee gets a "Shift Changed" notification.
- **Confirm (N create, M replace)** sends one decision per item, and the button shows exactly what will be sent. The result toast shows created / replaced / skipped / failed, with the first failure reason.

**What the server does (no calculation on the client):**
- builds and reads the template
- matches employees by ID or email, and shift columns against the chosen shifts
- checks overlaps, including overnight spill into the next date, both within the file and against existing assignments
- treats blank rows as days off
- sets the 2,000-row limit
- decides which actions each item allows
- checks everything again at confirm
- performs Replace by deleting the old assignment, plus a `SCHEDULE_REPLACED` notification (already handled by the bell)
- reuses an identical existing Shift in Time blocks mode

**Fixed on the server along the way (affects the current dialog too):** supervisor uploads, overnight overlap detection, cancelled assignments no longer counting as conflicts, inactive employees flagged in the preview, and blank rows no longer errors.

**Server-repo impact:**
- `GET /template`, `POST /preview` and `POST /confirm` under `/api/schedule-import` now take `mode`.
- The old `weekStart` flow keeps working until this client ships.

---

## BB-104 — Cutoff Approvals: "Approve Schedule" did nothing when the employee had no schedule (B&C)

**Status:** ✅ Complete.

**Page:** Cutoff Review (`/dashboard/company/cutoff-periods/[id]/review`), on B&C companies.

**Root cause:**
- `handleApproveSchedule` already stopped when a B&C punch had no `availableShifts`, and called `toast.warning("No shift assigned for this date — use Approve Raw Time instead.")`.
- But **no Sonner `<Toaster />` was mounted on the Cutoff Review route** (not in the page, the component or any layout), so that toast, like every other toast on the page, rendered nothing. The button looked broken.

**Fix:**
- **`<Toaster position="top-center" />` is added to Cutoff Review.** Every message on the page shows again, including approve, reset, OT and lock errors.
- **"Schedule" (Approve Schedule) is disabled** on B&C regular punches whose `availableShifts` is empty or missing.
  - Hovering shows the tooltip: "No schedule assigned for this day. Assign a shift first, or use Approve Raw / Edit."
  - It turns back on by itself once a shift is assigned and the approvals list loads again.
- DayCare punches and B&C Driver/Aide segments approve without a shift, so their Schedule button is unchanged. Raw, Edit and Exclude are unchanged.
- `ActionBtn` gains optional `disabled` and `title` props. The disabled style is greyed, and the tooltip is shown through a wrapping span. Other buttons are unaffected.

**Follow-up (same ticket):**
- **Hover explanation:** the greyed-out Schedule button now shows the page's dark tooltip (the same style as `InfoTooltip`) right away on hover. It replaces the slow built-in browser tooltip. Any `ActionBtn` with a `title` uses it.
- **Confirm before Approve Raw without a schedule:**
  - Clicking **Raw** on a punch with no schedule that day opens "Approve raw hours without a schedule?", showing the employee, date and punch times.
  - "No schedule" means a B&C regular punch with no shift to pick, or a DayCare regular punch with no scheduled shift (the new `noSchedule` flag).
  - **Approve All Raw** asks once when any of its punches have no schedule: "N of the M punches … have no shift assigned".
  - Punches with a schedule approve straight away, as before.
  - The bulk selection now comes from one helper, `collectBulkApprovable`, so the confirmation and the bulk action always count the same punches.

**Server-repo impact:** None. It uses `availableShifts` / `schedule`, which the server already sends.

---

## BB-105 — Suspend the "Left X min early" tag in Cutoff Review

**Status:** ✅ Complete on the client (tag suspended). The root cause of the `earlyMinutes` figure is with the server side; turn the tag back on once it's fixed.

**Why:** the tag reads misleadingly. For example, "Left 301.8min early" appears on punches with no schedule, and the fractional minutes suggest the server's `calculatedData.earlyMinutes` is measured against the wrong reference.

**What changed:**
- The tag is no longer added in `buildApprovalRecord`. It's behind `SHOW_LEFT_EARLY_TAG = false`, so it's one line to bring back once the server figure is right.
- It's display only. Approvals, hours, snapping and payroll are unaffected.
- Only Cutoff Review showed this tag. Other tags (Late, Snap, OT, …) are unchanged.

**Server-repo impact:** an investigation request: how `earlyMinutes` is calculated when there's no schedule, and why it isn't a whole number. The client turns the tag back on once that's fixed.

---

## Also in this release (no ticket number)

- **Leave request cancelled notification:**
  - New code `LEAVE_REQUEST_CANCELLED` ("Leave Request Cancelled" 🚫).
  - Tapping it opens Employee Leave Requests with `?leaveId=…`, which opens that request's details on the correct tab.
  - The parameter is then removed, so a refresh doesn't reopen the details.
  - If the request is no longer in the list, a notice is shown.
  - `getNotificationRoute` now takes the notification's `payload`, and the bell and the notifications page pass it in.

---

### Files Changed

| File | Ticket | Changes |
|---|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Settings/LeaveSettings.jsx` | BB-098 | Generate Report button + dialog, Leave Credits card replaces Leave Accrual, review dialog with year columns, matrix year columns with Credits fallback, Expired column, "available" header, info icon, `expired` label in the ledger, credit fields left out of the page-level Save. |
| `components/Dashboard/DashboardContent/CompanyPanel/Settings/LeaveReportDialog.jsx` | BB-098 | **New.** Generate Leave Report dialog: report type, period, grouping/basis, filters, format. Fetches `GET /api/reports/leave`. |
| `lib/exports/leaveReports.js` | BB-098 | **New.** Table builders for summary / activity / expiration; CSV and PDF writers using the shared branding helpers. |
| `docs/server-request-BB-098-leave-report.md` | BB-098 | **New.** The endpoint request sent to the server side. |
| `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/UploadWeeklySchedule.jsx` | BB-103 | Reworked into Upload Schedule: mode, date range, target employees, shift pool, Clean / Not clean review with Reject / Replace, decision-based confirm. |
| `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/Schedules.jsx` | BB-103 | Button renamed to "Upload Schedule"; passes the shifts, employees and departments it already loads into the dialog. |
| `components/Dashboard/DashboardContent/EmployeePanel/Documentation/companyDocsContent.js` | BB-103 | "Uploading a schedule" help steps and tips. |
| `docs/server-request-BB-103-upload-schedule.md` | BB-103 | **New.** The request sent to the server side. |
| `lib/leaveBalanceUtils.js` | BB-098 | `normalizeLeaveBalanceCell` returns `expired` and `creditLots`. |
| `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx` | BB-098 | Fetches `/leaves/balances`; shows the expiration notice, the fiscal-year breakdown and hours expired to date. |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx` | BB-098, untagged | "Xh expired" in the balance summary (BB-098); `?leaveId=` deep link (untagged). |
| `components/Dashboard/DashboardContent/EmployeePanel/Documentation/settingsDocsContent.js` | BB-098 | "Leave credits" help topic. |
| `components/common/NotificationBell.jsx` | BB-098, untagged | `LEAVE_CREDITS_EXPIRING` and `LEAVE_REQUEST_CANCELLED` entries; passes `payload` when opening a notification. |
| `lib/notificationRoutes.js` | BB-098, untagged | Routes for both codes; `getNotificationRoute(code, payload)` adds `?leaveId=` for cancellations. |
| `app/dashboard/notifications/page.jsx` | untagged | Passes `payload` to `getNotificationRoute`. |
| `docs/CLIENT_LEAVE_CONTRACT.md` | BB-098 | BB-098 contract section. |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | BB-102, BB-089 (rework) | Lunch section in the edit dialog, plus the `saveLunch` / `deleteLunch` handlers (BB-102). `buildRowsFromApprovals` carries `fixedHoursScheduledHours` / `isOffDay`, and CSV Payroll receives `otBlocks` (BB-089). |
| `lib/exports/employeePunchLogs.js` | BB-089 (rework) | `sumApprovedFixedHoursOT` helper. CSV Detail: SV OT from approved blocks. CSV Payroll: capped scheduled-day cells, off-day cells, SV OT, and SV Total = Regular + OT. |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | BB-089 (rework), BB-104, BB-105 | BB-104 follow-up: hover tooltip in `ActionBtn`, `noSchedule` flag, `collectBulkApprovable`, Approve Raw confirmation (single + bulk). BB-105: `SHOW_LEFT_EARLY_TAG = false`. Earlier: `isOffDay` handling and the "Off-day · OT" tag in `buildApprovalRecord`; SV OT blocks approvable and counted as pending; SV payable = fixed hours + approved OT, with an OT sub-label (BB-089). Toaster mounted; `noShiftToPick` disables Schedule with a tooltip; `ActionBtn` gains `disabled` / `title` (BB-104). |
