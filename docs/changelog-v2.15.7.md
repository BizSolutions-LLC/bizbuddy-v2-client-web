# Changelog — v2.15.7

BB-125: when a punch is honored over an approved leave, only that day of the leave is given back, and the leave shows as **Reverted** (every day punched) or **Approved · Partly reverted** (some days punched). Both leave pages show when it happened, who did it, which days, and how many hours went back to the balance. Cutoff Review and the conflict setting's text now describe the new behaviour.

BB-130: Cutoff Review shows the "Auto clock-out triggered" pill again.

---

## BB-125 — Leave "Reverted" when a punch is honored

**Status:** Complete (client), waiting for Carlo's testing. Needs the server's BB-125 release, which comes **first**: the SQL script (`scripts/bb125-leave-revert.sql`) and `prisma generate`, then the server, then this client. Until the client ships, a reverted leave shows its raw status, and nothing breaks.

**Why:** BB-125 started with an employee who worked her full shift on a day with an approved Sick Leave. With "Automatically Resolve Punch-vs-Leave Conflicts" on, the punch was approved, but the leave stayed Approved and Paid, with 5.5h still taken from her balance. The server fix (agreed with PadPro) honors the punch, gives back **only that day** of the leave, and returns exactly the hours that day took. "Reverted" means the leave was approved, but the employee punched in on that day, so the punch is paid and the leave hours are returned.

**Server contract used (no server change from this repo):**
- `Leave.status` can be `"reverted"`: every day was worked, and nothing is paid as leave.
- `reversion` on every leave in the list endpoints: `null`, or `{ dates, returnedHours, revertedAt, automatic, performedBy, note }`. **Partly reverted** = `status === "approved" && reversion != null`.
- `GET /api/leaves/:id/days`: each day has `reverted` and `revertedAt`.
- Honor Punch (`PATCH /api/cutoff-periods/:id/approvals/:approvalId/conflict`): the `message` says how many hours were returned.
- `GET /api/cutoff-periods/:id/approvals`: `leaveRecord.leaveType` is now the type's name, and `leaveRecord.status` is `"reverted"` only when the revert really happened.

### 1. Status, filters and counts
- **Employee Leave Requests (`LeaveLogs.jsx`):**
  - New **Reverted** status pill (grey-blue, `RotateCcw` icon).
  - New **Reverted** filter tab with a count.
  - A **Partly reverted** tag next to the status in the table and the side panel.
- **Company Leave Requests (`EmployeesLeaveRequests.jsx`):**
  - **Reverted** in `statusConfig` (slate), the table row pill and the stats.
  - New **Reverted** filter tab.
  - **Partly reverted** badge in the detail panel, the table row and the calendar day list.
- **Paid/Unpaid (`lib/leaveBalanceUtils.js`):** `resolveLeavePayOutcome` returns `null` for `reverted`, so a reverted leave shows no Paid/Unpaid pill. Before this fix it fell back to `isPaid` and would have shown "Paid Leave". A partly reverted leave keeps its pill, because `actualPaidHours` / `actualUnpaidHours` already leave out the reverted days.

### 2. Request details (both pages)
When `reversion` is set, Request Info adds these rows:
- **Reverted:** the date and time, then "Automatically (company setting)" or "by {name}".
- **Days reverted:** the company-zone dates, shown as the server sends them.
- **Hours returned:** for example "5.5h".

Under the rows, the explanation line reads: "Approved, but the employee punched in on this day. The punch was paid and the leave hours were returned to their balance."

### 3. Day-by-day outcome (both pages)
- A day with `reverted: true` shows a **Reverted** chip instead of Paid/Unpaid. Its hours are struck through, and hovering shows the explanation line.
- **Bugs found during BB-125, now fixed:**
  - The day breakdown, "Decided by" and the final approver comment only loaded for `approved` / `rejected` leaves, so a reverted leave would have hidden all three. Both pages now include `reverted`.
  - On the company page, `isDecided` now also includes `reverted`.

### 4. Cutoff Review (`CutoffReview.jsx`)
- The conflict detail reads "Leave: Sick Leave (Reverted)" when `leaveRecord.status === "reverted"`, and "(Approved)" otherwise. The name comes from the server, so no client change was needed for it.
- After **Honor Punch** or **Honor Leave**, the toast shows the server's `message`, for example "Punch honored. Leave day reverted — 5.5h returned to the employee's balance." If there's no message, it falls back to a generic one.

### 5. Settings and in-app guide text
- **`LeaveSettings.jsx`, Punch-vs-Leave Conflicts card:**
  - The description under the toggle is replaced.
  - The "What This Does — and Doesn't — Change" callout now has four bullets: who resolves the conflict, only the punched day is reverted, exact hours returned, and excluded shifts never count as a conflict.
  - The code comment no longer describes the old whole-leave cancellation and flat refund.
- **In-app guide (`settingsDocsContent.js`):** "The refund works the same either way." is replaced. The guide now says that honoring the punch reverts only that day and returns its hours, and that a leave whose every day was punched shows as Reverted.

### Not changed
- **Calendar dots:** a reverted leave gets no dot, the same as a cancelled one.
- **Calendar PDF:** there's no "Reverted" checkbox yet. See Open items.
- **Styling:** the new LeaveLogs pills and the company table row pill follow the hardcoded hex colours already used in those spots (known drift, not cleaned up here). The Badge-based spots use Tailwind slate classes.

**To test:**
1. **Fully reverted leave:** Reverted pill, no Paid/Unpaid pill, every day shows the Reverted chip, the reversion rows and the explanation, and the Reverted tab counts it.
2. **Partly reverted multi-day leave:** Approved plus Partly reverted, reverted days struck through, other days Paid/Unpaid as before.
3. **Honor Punch in Cutoff Review:** the toast shows the hours returned.
4. **Auto-reverted conflict:** shows "(Reverted)".
5. **Leave Settings and Documentation:** the new text.

Check steps 1 and 2 on both the employee and the company pages.

---

## BB-130 — Cutoff Review: auto clock-out pill shown again

**Status:** Complete (client), waiting for Carlo's testing. No server change.

- `CutoffReview.jsx`: `SHOW_AUTO_CLOCKOUT_TAG` is `true` again, after BB-105 (v2.14.36) turned it off. The comment above it notes BB-130.
- The "Auto clock-out triggered" pill shows on records where the server sends `timeLog.autoClockOut`, until the record is approved.
- It applies to every department and both company types. It shows on regular punches, grouped punches and Driver/Aide segments.
- It's display only. It doesn't affect the Flagged badge, the card border, filters, approvals or hours.
- **Still hidden:** "Too Early" (`SHOW_TOO_EARLY_TAG`) and "Left X min early" (`SHOW_LEFT_EARLY_TAG`) in Cutoff Review, and the auto clock-out flag on Employees Punch Logs (`SHOW_AUTO_CLOCKOUT_FLAG`).
- **Note:** BB-105 hid this pill because it "read inaccurately". If that was the server's `autoClockOut` value, wrong pills will come back with it. That would be a server issue.

**To test:**
1. Open a cutoff with an auto clocked-out punch that isn't approved yet. The pill shows, with its tooltip.
2. Approve the record. The pill goes away.

---

## Open items

- **Calendar PDF (server question):** does `/api/reports/leave/calendar` accept `status=reverted`? If it does, add a "Reverted" checkbox to the Calendar PDF dialog (`EmployeesLeaveRequests.jsx`).
- **Mobile (BB-125):** questions for the mobile developer:
  1. How does the app show an unknown `status: "reverted"`?
  2. Can it show Reverted and Partly reverted?
  3. Does it read the per-day `reverted` flag?
  4. Does it work out Paid/Unpaid from `isPaid` or from `actualPaidHours`?
- **BB-105 accuracy (BB-130):** check whether the server's `autoClockOut` was the inaccurate part.
