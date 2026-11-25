# Changelog — v2.17.3

BB-124 (added task): **leave days now show the times they cover.**
- Request details, the approve/reject preview and the employee's Leave Logs show each leave day's shift times in a compact line, with shift names on hover.
- When every day has the same times, they show once above the list ("Every day: …").
- The time zone shows only when it differs from the company's.
- Leaves marked unpaid by the employee now show their day list too.
- Request details shows the employee's department once the server sends it.

BB-149 follow-up: **admins can reopen a processed cutoff.**
- Reopen takes a reason, and warns when the payment date has passed.
- Reopened cutoffs show "Reopened ×N".
- The review page has a History button listing every status change with its date, time, who and reason.
- An outdated payroll export is flagged on the cutoff pages and the Payroll page until the cutoff is processed again.

**Needs the next server release after v2.11.23**, which carries leave `windows`, `User.department`, cutoff reopen and status history. Its number is set at the server push. The cutoff reopen also needs the server's `scripts/add-cutoff-status-events-bb149.sql` applied. Everything here is additive: until the server is deployed, the new parts don't show, and Reopen answers "not ready". **Mobile:** no change.

---

## BB-124 (added task) — Leave day times

**Status:** Built (client), untested.

**Why:**
- A leave day only showed its date and hours. With several shifts a day, or a shift in another zone (e.g. Manila shifts in a Los Angeles company), you couldn't tell which time it covered.
- Department showed "Not specified" in Request details because the server didn't send it.
- A first version showed full lines like "Regular Shift 8:00 AM – 1:30 PM (Los Angeles time)" on every day, which flooded the narrow details panel. Carlo picked a compact layout with hover instead.

### Server contract used
- `GET /api/leaves/:id/days` → `data[].windows` and `GET /api/leaves/:id/preview` → `data.days[].windows`:
  - each window is `{ kind: "shift" | "requested" | "whole_day", shiftName, start, end, timeZone, zoneLabel }`;
  - `start` and `end` are already formatted in the window's zone;
  - split paid/unpaid days share the same `windows`.
- `GET /api/company-settings` → `data.timezone`: the company zone, used to hide a zone that matches it. Every signed-in role can read it.
- `GET /api/leaves` and `/pending` → `User.department = { id, name }`.

### Changes
- **`lib/leaveWindows.js`** (new): formatting helpers.
  - **Short line:** "1:30 PM – 2:45 PM", "3 shifts · 6:45 AM – 2:45 PM" or "Whole day".
  - **Hover lines:** shift name, times, and the zone when it differs.
  - **Every day:** a check for whether all days share the same times.
- **`components/common/LeaveWindowsHint.jsx`** (new): a small 10px line with an ⓘ and a shadcn `Tooltip`.
- **`EmployeesLeaveRequests.jsx`** (admin Leave Requests):
  - loads the company zone;
  - `LeaveDayList` shows "Every day: …" or the per-day hint, and keeps the Reverted and Paid/Unpaid badges;
  - used in Request details, the paid preview and a new unpaid-by-choice preview;
  - Department already read `User.department.name`, so it needed no change.
- **`LeaveLogs.jsx`** (employee Leave Logs): the same "Every day" line and per-day hint in "Actual day-by-day outcome".
- **`CLAUDE.md`:** `LeaveLogs.jsx` is added to Known drift (~217 inline styles). No cleanup was done, and the new hint uses Tailwind.

### Not changed
- No "Full day" label: the client can't tell when the covered shifts are the whole schedule.
- Hover doesn't work on touch screens. The short times line stays visible there.

### To test
1. A leave with the same shift every day shows one "Every day" line, and the rows are single lines.
2. A leave whose days differ shows a small line per day. Hovering the ⓘ lists the shift names.
3. A Manila-shift leave in a Los Angeles company shows "· Manila". A PadPro leave shows no zone.
4. A leave marked unpaid by the employee shows its day list in the approve/reject preview.
5. Request details shows the department name.

---

## BB-149 follow-up — Reopen a processed cutoff

**Status:** Built (client), untested.

**Why:**
- "Processed" was final, so a cutoff needing a correction after processing could only be reopened with a database script (PadPro Nov 11–24, 2026-11-25).
- Admins and B. Buddy support can now reopen it themselves, and the reason is kept.

### Server contract used
- `POST /api/cutoff-periods/:id/reopen` with `{ reason, confirmPaid }` (admin and superadmin):
  - **200:** reopened.
  - **400** `REOPEN_REASON_REQUIRED` or `REOPEN_NOT_PROCESSED`.
  - **409** `REOPEN_CONFIRM_PAID` or `REOPEN_STATUS_CHANGED`.
  - **503** `REOPEN_NOT_READY`.
- `GET /api/cutoff-periods`: each period adds `reopenCount`, `lastReopen = { at, by, bySupport, reason }`, and `payrollExport.outdated` with `outdatedDepartments`.
- `GET /api/cutoff-periods/:id`: adds `statusHistory[] = { fromStatus, toStatus, action, reason, at, by, bySupport }`.
  - `action: "status"` is Lock, Unlock or Mark Processed.
  - `"finalize"` is Finalize Cutoff.
  - `"reopen"` is a reopen.
- `GET /api/payroll-export/by-cutoff-period/:id`: adds `data.outdated`, `outdatedDepartments` and `reopenedAt`.

### Changes
- **`cutoffPeriodsShared.jsx`** (shared by the List and Calendar pages):
  - **Reopen dialog:**
    - Required Reason (5–500 characters, with a counter) and the note "Approvals stay as they are. The payroll export will show as outdated until you process it again."
    - If the payment date has passed, the paid warning shows up front. On a 409 `REOPEN_CONFIRM_PAID`, the dialog switches to that warning and **Reopen anyway** sends `confirmPaid: true`.
    - A reason error shows under the field. "Status changed" reloads the list, and the other errors show the server's message.
  - **`ReopenedBadge`:** "Reopened ×N". Hovering shows the last reopen's time, who ("BizBuddy Support" for B. Buddy) and the reason.
  - **`OutdatedExportNote`:** "Outdated: {departments} reopened, process again to update."
  - **`StatusHistoryList` and `CutoffHistoryButton`:** a History popover listing each move newest first, with date and time, who and the reason. Finalize shows as "Finalized" and reopen as "Reopened".
  - **Payroll Report Preview:** flags outdated exports.
  - **Mark Processed confirm:** now says "Processed periods are read-only. An admin can reopen one later with a reason." Before, it said the status was final.
  - **Reopen permission:** admins and superadmins only, read from the token role. Supervisors don't see it.
- **`EmployeeCutoff.jsx`** (List page): processed rows get **Reopen Period** in the row menu, and the badge shows next to the status.
- **`CutoffPeriodsCalendar.jsx`** (Calendar page):
  - processed rows get **Reopen period** in the menu, and it respects the preview-only switch;
  - the badge shows next to the status;
  - the outdated note shows under the status and in the export menu.
- **`CutoffReview.jsx`** and **`CutoffReviewCalendar.jsx`:** the History button is in the header.
- **`EmployeeSheet.jsx`** (Payroll → Employee Sheet): loading hours from an outdated export shows a 15-second warning not to pay from those numbers.
- **`companyDocsContent.js`:** the guide's "Cutoff period lifecycle" entry explains Reopen and History, and Processed now reads "Read-only unless an admin reopens it."

### Not changed
- Lock, Unlock and the existing Mark Processed actions are unchanged, including what supervisors can see.
- Employees get no notification on a reopen. The server sends "Payroll Updated" when the cutoff is processed again.

### To test
1. As an admin, reopen a processed cutoff whose payment date hasn't passed: a reason is required, and it reloads as Open with "Reopened ×1".
2. Reopen one whose payment date has passed: the warning shows, and **Reopen anyway** works.
3. As a supervisor, there's no Reopen option.
4. On the review page, History lists the reopen with its date, time, who and reason. Finalize Cutoff, then check that History shows "Finalized · Open → Locked".
5. The Calendar page and the Payroll Report Preview show "Outdated" until the cutoff is processed again. Loading hours on the Payroll page from that export shows the warning.

---

## Open items
- Server: deploy the release with leave `windows`, `User.department`, cutoff reopen and status history, and run `scripts/add-cutoff-status-events-bb149.sql` before deploying. Fill in its version here.
- History only starts with that server release. Earlier status changes aren't recorded.
- Mobile: no change needed for either ticket.
