# Changelog — v2.14.36

BB-103 (further improvements): In Upload Schedule, the shift dropdown now shows full shift names instead of cutting them off. The "Uploading a schedule" help topic is updated to match the reworked dialog.

BB-096: Cutoff Review shows one employee at a time. Opening an employee closes the one that was open, and the page scrolls the new one into view.

BB-105 (follow-up): Cutoff Review and Employees Punch Logs hide the "Too Early" and auto clock-out flags, which read inaccurately. "min late" stays. Cutoff Review also stops showing the "Approved" toast after a single approval.

---

## BB-103 (further improvements) — Shift dropdown and help text

**Status:** Complete (client only).

**Page:** Shifts & Schedules → Employees Schedule (`/dashboard/company/schedules`) → **Upload Schedule** → Existing shifts mode, and the in-app help (`/dashboard/employee/documentation`).

**Shift dropdown (Shifts in this upload):**
- **Root cause:** the shared `MultiSelect` dropdown panel was a fixed 256px wide (`w-64`) and each row cut off its label. Shift labels include the time range (e.g. "Afternoon 1 (03:30 PM - 12:00 AM)"), so most of them were cut off even though the trigger is full width.
- `MultiSelect` gets a new opt-in prop, `fullWidthContent`:
  - The panel matches the trigger's width (`--radix-popover-trigger-width`), and is never narrower than 256px.
  - Long labels wrap onto a second line instead of being cut off. The checkbox stays lined up with the first line.
- Only the Upload Schedule shift picker turns it on. The other `MultiSelect` users (filters across the app) are unchanged.
- Search, A–Z / Z–A sort and the "All shifts" row work as before.

**Help topic "Uploading a schedule" (Employees Schedule):**
- Step 2: each picked shift becomes a column, and the shift list can be searched.
- Step 3: lists the target-employee choices (all active employees, one department, or specific employees).
- Step 5: overlapping entries default to Reject. Switch them to Replace if needed. The Confirm button shows the create / replace counts.
- New tips:
  - Rows that overlap another row in the same file, or can't be processed, aren't imported. Fix them in the file and upload again.
  - Supervisors can only upload for their own department.

**Server-repo impact:** None.

---

## BB-096 — Cutoff Review: one employee open at a time

**Status:** Complete (client only).

**Page:** Payroll → Cutoff Periods → Review (`/dashboard/company/cutoff-periods/:id/review`)

- Before, each employee card kept its own open/closed state, so any number could be open at once.
- The page now tracks one open employee (`openEmpId`):
  - Opening an employee closes the one that was open.
  - Clicking the open employee closes it.
  - Approving, editing or excluding inside the card keeps it open.
- When an employee opens, the page waits for the previous card to finish closing (0.2s), then smoothly scrolls the new card's header to the top. A `scroll-mt-40` offset keeps it clear of the sticky page header.
- The small "Days" breakdown toggle inside a card is separate and unchanged.

**Server-repo impact:** None.

---

## BB-105 (follow-up) — Hidden flags and the "Approved" toast

**Status:** Complete (client only).

**Pages:** Cutoff Review (`/dashboard/company/cutoff-periods/:id/review`) and Employees Punch Logs (`/dashboard/company/punch-logs`).

**Hidden for now ("Too Early" and auto clock-out read inaccurately):**
- **Cutoff Review:**
  - The "Too Early" and "Auto clock-out triggered" tags are hidden through `SHOW_TOO_EARLY_TAG` and `SHOW_AUTO_CLOCKOUT_TAG` (both `false`), next to the existing `SHOW_LEFT_EARLY_TAG`.
  - Neither tag drives the Flagged badge, the card border or any filter, so only what's displayed changes.
- **Employees Punch Logs:**
  - The "Too Early" badge under the clock-in time is hidden through `SHOW_TOO_EARLY_FLAG`.
  - Auto clock-out (G-6) is switched off where each row's data is built (`isAutoClockOut`), through `SHOW_AUTO_CLOCKOUT_FLAG`. That one switch covers all four places:
    - the timer icon next to the name
    - the purple row highlight
    - the warning box in the row details
    - the note in the Edit dialog
- **Not affected:**
  - "min late" is accurate and still shows.
  - Approvals, hours, payroll and the auto clock-out emails sent to supervisors (from the server) are unaffected.
- To bring a flag back, flip its constant to `true`.

**"Approved" toast removed (Cutoff Review):**
- A single-record approve no longer shows the "Approved" toast. This covers Approve, Approve with OT, Approve Schedule (including the shift picker), Approve Raw and approve from the Edit dialog. The row's status change is the confirmation.
- "Failed to approve" still shows on error.
- Other toasts are unchanged:
  - Bulk "N record(s) approved"
  - OT block
  - Exclude, Reset, Honor punch / leave
  - Training / Regular
  - Fixed hours
  - Sync
  - Finalize

**Server-repo impact:** None required for this change. The underlying problem is on the server: `isTooEarlyPunch` and `autoClockOut` come from the server, as `earlyMinutes` did for "Left X min early". Once those values are reliable, the client turns the flags back on.

---

### Files Changed

| File | Ticket | Changes |
|---|---|---|
| `components/common/MultiSelect.jsx` | BB-103 | New opt-in `fullWidthContent` prop: the panel matches the trigger width (min 256px) and labels wrap instead of being cut off. |
| `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/UploadWeeklySchedule.jsx` | BB-103 | Turns on `fullWidthContent` for the "Shifts in this upload" picker. |
| `components/Dashboard/DashboardContent/EmployeePanel/Documentation/companyDocsContent.js` | BB-103 | "Uploading a schedule" steps 2, 3 and 5 reworded; two new tips. |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | BB-096, BB-105 | BB-096: `openEmpId` state in the page; `EmployeeCard` takes `expanded` / `onToggle` and scrolls into view on open (`scroll-mt-40`). BB-105: `SHOW_TOO_EARLY_TAG` / `SHOW_AUTO_CLOCKOUT_TAG` set to `false`; "Approved" toast removed from `doApprove`. |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | BB-105 | `SHOW_TOO_EARLY_FLAG` / `SHOW_AUTO_CLOCKOUT_FLAG` set to `false`; they hide the "Too Early" badge and gate `isAutoClockOut` at row build. |
