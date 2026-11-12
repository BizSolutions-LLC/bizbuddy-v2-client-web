# Changelog — v2.15.5

BB-118 (redo): the System Admin sign-in page is simpler, with less text.

BB-123: the employee Punch Logs table now works like the company one (column picker, rows that expand in place), and selecting a row no longer dims the page. Contest requests now use the **company** time zone on both the employee's dialog and the approver's page, handle overnight shifts, flag large or suspicious moves, and respect locked cutoffs. Each punch shows whether it has a contest, and a second contest can't be sent while one is pending.

---

## BB-123 — Employee Punch Logs: table + contest time requests

**Status:** Complete (client), confirmed by Carlo. Uses the server's BB-123 contract (live with v2.11.8, see below). No other server change is needed. One optional server follow-up is under Open items.

### 1. Page dimmed when a row was selected (bug)

**Cause:** the phone-only bottom sheet for Log Details opened at every screen width. Its panel was hidden on desktop (`sm:hidden`), but its full-screen dark overlay wasn't, and it blocked clicks on the rest of the page.

**Fix:** the bottom sheet and the right-side Log Details panel are both removed (`PunchLogs.jsx`). Rows now expand in place (section 2), so nothing creates that overlay any more.

### 2. Punch Logs table matches the company Punch Logs table (`PunchLogs.jsx`)

- **Card header:** orange icon badge, "N shown", **Total Duration**, **Total Period Hours** and the company time zone (with a tooltip).
- **Columns picker:** new **Columns** control at the start of Filters & controls (shared `ColumnSelector`).
  - Always shown: Date, Clock In, Clock Out, Actions.
  - On by default (the same view as before): Duration, OT, Cutoff Status, and Punch Type for Day Care.
  - Optional: Gross Hours (not Day Care), Status, Scheduled, Period Hours, OT Status, Late, Undertime, Coffee, Lunch, Check-in/out Location, Device In/Out.
  - Gross Hours and Undertime read `grossHours` / `undertimeHours` and show "—" when the server doesn't send them.
- **Rows:** a chevron column, centered cells, the same fade-in as the company table, and click to expand or collapse. Unscheduled punches get the amber left edge, as in the company table.
- **Expanded row:** a 3-column details grid replaces the old Log Details panel:
  - Time Details (with the Driver/Aide hours breakdown for Day Care) and Break Times;
  - Overtime and Payroll Cutoff;
  - Schedule, and Device & Location.

  The details component (`LogDetailBody`) was rewritten for this layout and is the only copy.
- **Actions column:** icon-only buttons with tooltips, in the company table's style:
  - **Contest time** (`ClockAlert`), on completed punches whose cutoff isn't approved, locked or processed, and that have no pending contest.
  - **Request OT approval** (`AlarmClockPlus`), when the OT still needs approval. This replaces the old "Request" button in the OT cell.

  Clicking either one doesn't expand the row. The expanded row also has a **Contest time** button under Time Details.
- **Toolbar:** the **Contest time** button is removed, because contesting now starts from the row. The Contest dialog still has its punch-log dropdown for switching to another log.
- **Contest approver list:** the dialog now gets the de-duplicated supervisors/approvers list (`approverOptions`), the same one the OT and Request Punch dialogs use. A person who was both a team supervisor and an approver used to appear twice, and picking them showed the name twice ("Ivan CJ VillanuevaIvan CJ Villanueva").

### 3. Contest dialog — company time zone, overnight shifts, warnings (`ContestDialog.jsx`)

The shared time zone and contest math is in a new file, **`lib/contestTimes.js`**, used by the dialog, the punch-logs rows and the approver page.

- **Company zone:** requested times are read as wall-clock times in `companyTimezone` (`date-fns-tz` `fromZonedTime`), not the browser's zone.
  - The old `buildISO` used `new Date("YYYY-MM-DDTHH:MM")`, which reads the browser's zone. A Manila employee's "16:08" for a Los Angeles company was sent about 16h off.
- **Overnight shifts:** a clock-out at or before the clock-in is on the next day. The comparison table shows "(next day)".
- **Hours preview:** worked out from real timestamps, so a 16:00 → 01:00 shift shows 9h instead of −24h.
- **Minute precision:** recorded punches carry seconds (for example 17:00:36), so every comparison is done to the minute. An unchanged 9h shift reads "No change from recorded" instead of "+0.01h".
- **Dropdown dates:** the punch-log dropdown shows dates in the company zone. It used to show "Thu, Nov 12" for the Wed Nov 11 log for a viewer in Manila.
- **Zone label:** the Recorded/Requested table shows the zone, built from `companyTimezone` with the abbreviation for the punch's own date (for example "Los Angeles (PST)"). A hint under the time fields says: "All times are in the company time zone (…). A clock-out earlier than the clock-in counts as the next day."
- **Large-move warning:** an amber note shows when the requested clock-in moves 12h or more from the recorded clock-in. It never blocks submitting. A next-day clock-out alone never triggers it.
  - The "moves to another day" text (with the Request Punch Log hint) is in place, but the dialog only has time fields, so the clock-in date can't change in practice.
- **Locked cutoffs:** punches whose `cutoffApproval.cutoffPeriod.status` is `locked` or `processed` are disabled in the dropdown and labelled "Locked (cutoff closed)". Punches with a pending contest are disabled and labelled "Contest pending".
- **24h or longer:** submitting is blocked with an inline error, matching the server's rule.
- **Server errors (`PunchLogs.jsx` submit):**
  - `CUTOFF_LOCKED` and `CONTEST_PENDING` show their message under the punch-log dropdown as well as in the toast.
  - `CONTEST_PENDING` also reloads the contest badges.
  - Other errors still show the server's message in a toast.

**Checked by hand** (LA company, browser in Manila): Tue Nov 10 log, 16:00 / 01:00 → 9h, no warning, `requestedClockIn = 2026-11-11T00:00:00.000Z`, `requestedClockOut = 2026-11-11T09:00:00.000Z`.

### 4. Contest status on punch-log rows (`PunchLogs.jsx`)

- The page loads the employee's own contests from `GET /api/contest-policy/view-contestTimeLogs`, 200 at a time, and matches them to rows by `timeLogId`.
  - It stops loading once the contests are older than the date range on screen (a contest is always submitted after its punch), with one day of margin for time zones.
  - It reloads when the date range changes, after a successful submit, and after `CONTEST_PENDING`.
  - If the call fails, the page shows nothing and no error, because the indicator is only informational.
- **Indicator:** a small orange dot (`orange-500`) on the row's expand chevron. Hovering shows "N contest request(s) · latest pending/approved/rejected", and screen readers get the same text.
- **Expanded row:** a **Contest Request** section under Payroll Cutoff shows the latest contest:
  - status;
  - requested times in the company zone, with "(next day)" when the clock-out rolls over;
  - change from recorded ("In ±Xh · Length ±Yh");
  - reason, approver and submitted date;
  - "+N earlier" when there are older contests, and a **View all contests** link to Contest Time Logs.
- **One pending contest per punch:** while a contest is pending, the row's Contest icon is disabled (tooltip "A contest for this punch is already pending."), the expanded row shows that note instead of the button, and the dialog dropdown disables the punch. Approved and rejected contests don't block a new one.

### 5. Company → Contest Requests (approver page) (`app/dashboard/company/contest-requests/page.jsx`)

- **Company zone:** all punch times (`formatDateTime`, `formatTimeOnly`, `formatDateOnly`) use `companyTimezone`, and one label under the table title says so ("All times are in the company time zone (…)").
  - **Submitted At** used the shared `fmtMMDDYYYY_hhmma`, which always prints **UTC**. On this page it now uses the company zone too. The shared formatter is unchanged, because other pages use it.
- **Change from recorded:**
  - Each table row shows "In ±Xh · Length ±Yh" under the requested times.
  - The side panel has a new **Change From Recorded** section: clock-in moved, clock-out moved, and old → new length.
  - Amber flags: "Moved +16h, same length: possible time zone mistake" (both times moved by the same amount, length unchanged), "Moves the punch to another day", or "Clock-in moves ±Nh" for 12h or more.
- **Cutoff locked:**
  - A pending request whose punch date or requested date is in a `locked`/`processed` cutoff gets a **Cutoff locked** badge (table and panel, with the period dates in the panel).
  - Approve is disabled, with the tooltip "Reopen the cutoff to approve, or reject." Reject stays available.
  - Up front, this only matches company-wide cutoff periods, because the list doesn't return the employee's department (see Open items).
  - A `CUTOFF_LOCKED` response to Approve marks the request as locked right away.
- **Error messages:** Approve and Reject now show the server's `message` instead of "Failed to approved contest request."

### Server contract used (BB-123, live with v2.11.8 — no client action left)

- `POST /api/contest-policy/submit` and `PATCH /api/contest-policy/approve/:id` return **400 `{ message }`** for an invalid time, a clock-out not after the clock-in, or a shift of 24h or longer.
- Both return **400 `{ code: "CUTOFF_LOCKED", message }`** when the punch's reviewed cutoff, or the cutoff covering its recorded or requested date, is `locked`/`processed`.
- Submit returns **400 `{ code: "CONTEST_PENDING", message, contestId }`** when the punch already has a pending contest.

### Files

- `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`
- `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/ContestDialog.jsx`
- `app/dashboard/company/contest-requests/page.jsx`
- `lib/contestTimes.js` (new)

### To test (LA company; a browser in another zone, such as Manila, shows the zone fixes best)

**Employee → Punch Logs:**
- Selecting a row expands it, and the page doesn't dim.
- The Columns picker shows and hides columns.
- Totals and the time zone appear in the table header.
- Day Care shows the Punch Type column and the Driver/Aide breakdown.
- At phone width, the table scrolls sideways with Date fixed, and the details stack.

**Actions column:**
- Hover each icon to see its tooltip.
- Contest opens the dialog pre-filled for that punch. Request OT opens the OT dialog. Neither expands the row.
- Active, approved-cutoff and locked punches have no Contest icon. A punch with a pending contest has it disabled.

**Contest dialog:**
- Each approver appears once.
- On the Nov 10 log, enter 16:00 / 01:00: expect 9h, "(next day)" and no warning.
- An unchanged punch reads "No change from recorded".
- A same-day clock-in move of 12h or more shows the warning.
- Locked and pending punches are disabled in the dropdown.

**Contest status on rows:**
- A contested punch shows the orange dot and the tooltip.
- Expanding it shows the Contest Request section.
- A new contest shows the dot right away.

**Company → Contest Requests:**
- Times and Submitted At are in the company zone, with the zone label shown.
- A Sunshine Learning test request shows "Moved +16h, same length: possible time zone mistake".
- Approving a request in a locked cutoff shows the server's message, the Cutoff locked badge, and a disabled Approve button. Reject still works.

---

## BB-118 (redo) — Simpler System Admin sign-in

**Status:** Complete (client), confirmed by Carlo. Look and wording only. Sign-in, 2FA and recovery-code logic are unchanged. No server change.

**Page:** `/system-admin/login` (`app/system-admin/login/page.jsx`).

**Removed:**
- the 80px orange gradient shield circle and the large "System Administrator" title;
- the "Restricted Access · Authorized Personnel Only" line;
- all entrance animations (`framer-motion`);
- the gradient, shadowed button;
- the icons inside the Username and Password fields, and their placeholders;
- the bordered "Unauthorized access is prohibited and monitored…" box (no replacement line);
- the "BizBuddy System Administration v1.0" footer.

**Now:**
- the BizBuddy logo (`public/logo.png`) only, with no visible title. A hidden "System admin sign in" heading stays for screen readers;
- a plain white card with a light border;
- labelled fields, with the show/hide password toggle kept;
- a flat orange **Sign in** button ("Signing in…" while loading).

The page stays light-only, using the same neutral greys as the rest of `/system-admin`.

**Shorter 2FA wording:**
- **Setup:** "Scan with your authenticator app, then enter the 6-digit code." The fallback reads "Can't scan? Use this key:", and the button is **Turn on 2FA**.
- **Verify:** the heading is "Enter your code", with "From your authenticator app." or "Each recovery code works once." underneath.

The QR code, the setup key, the Back link, the recovery-code switch, the "password changed" notice, the error messages and the recovery-codes screen (`RecoveryCodes.jsx`) all stay.

**To test:**
- Sign in with a wrong password (error shows) and then the right one.
- Enter a 2FA code, and try the recovery-code switch.
- On a first sign-in, check the QR setup and the recovery-codes screen.
- After changing your password, check the green notice on the sign-in page.

---

## Open items

- **System Admin sign-in (BB-118 redo), optional:**
  - The page no longer says it's the system-admin sign-in; only the Username field (vs. email on the normal sign-in) hints at it. That was a deliberate choice. If staff mix it up with the normal sign-in, add a small grey "System admin" line inside the card.
  - A faint peach line shows along the top edge of the page. It seems to come from the shared layout, not this page. Not investigated.

- **Server (optional):** `GET /api/contest-policy/view-allContestTimeLogs` doesn't return the employee's `departmentId`. Prisma selects it, but `formattedData` in `contestPolicyController.js` drops it. Without it, the approver page can only mark "Cutoff locked" up front for company-wide cutoff periods; department periods show it after the server refuses an Approve. The client already reads `departmentId` if it's added.
- **Mobile:** the four mobile questions are still waiting on answers:
  - Are contest times built in the device's zone or the company's?
  - Is an after-midnight clock-out moved to the next day?
  - Is the server's 400 `message` shown?
  - Is there an approver screen, and are its times in the company zone?
- **CLAUDE.md:** "Reusable UI patterns → Detail/context panel pattern" still names `PunchLogs.jsx`'s table + "Log Details" panel (lines 1387+) as a reference. That panel is gone; `SchedulesCalendarView.jsx` is the remaining example. The "Known drift" line numbers for `PunchLogs.jsx` (stat cards ~1112–1141, `OTBanner` ~2172–2235) have also moved.
- **In-app guide (`docsContent.js`)** still describes the old layout:
  - line 148: "Click any row to open the Log Details panel";
  - lines 211–212: "In Punch logs, click Contest time" (toolbar button);
  - line 336: "use Contest time in Punch logs";
  - lines 345 and 350: "check Log Details", "use the Request button on that log".

  It needs a short text revision, like BB-097's.
- **Styling drift (not touched):**
  - `PunchLogs.jsx` stat-card row and `OTBanner` (already listed in CLAUDE.md);
  - the time zone chip in Filters & controls uses inline hex colors (`#faeeda` / `#633806`);
  - the new table card copies the company table's `border-2 border-orange-200` and gradient header, as asked, which is louder than the usual UI restraint.
