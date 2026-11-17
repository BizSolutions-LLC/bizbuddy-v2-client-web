# Changelog — v2.15.9

BB-129: **custom clock-out forms**. Admins choose between the free-form Daily Task Report and questionnaires they build themselves (like Google Forms), assign them to everyone, a department, an employee or a shift, and employees answer them after clocking out. Submitted answers show on Employee Report with a PDF. The two modes are exclusive.

BB-133: the **Overview** page is redone for all three roles (employee, admin, superadmin) in the System Admin → Activity style, on corrected server numbers. Supervisors get **My team | Me** tabs.

**Needs server v2.11.16** (BB-129 phases 1 + 2 and BB-133). Before that deploy, the server's `scripts/add-task-report-form-answers.sql` must run, then `prisma generate`.

---

## BB-129 — Custom clock-out forms (phases 1 + 2)

**Status:** Built (client) and checked by Carlo locally. Needs server **v2.11.16**.

**Why:** the free-form task list doesn't fit every company. Some need a fixed questionnaire per shift (e.g. a care form per client), with answers they can review and print.

**Server contract used (no server change from this repo):**
- `company-settings`: `taskReportMode` (`"freeform" | "forms"`) and `taskReportFormWindowHours` (1–2160, default 336). Both are admin only and return errors as `{ error }`.
- `/api/task-report-forms` (admin / superadmin), for forms:
  - list, open, create, save, duplicate, archive, restore, delete;
  - `409 FORM_NAME_TAKEN`, `FORM_ARCHIVED`, `FORM_HAS_RESPONSES`.
- `/api/task-report-forms/assignments`: list, `PUT` assign / replace, `DELETE`.
  - The scopes are `shift → employee → department → all`; the most specific wins.
- Employee:
  - `GET /me/pending`;
  - `GET|PUT /me/punch/:timeLogId` (`submit: true` locks the answers);
  - `GET /me/responses?from&to` (up to 93 days).
- Viewing: `GET /responses/:id`, and `GET /responses/:id/pdf[?disposition=inline]` (submitted only).
- `POST /api/timelogs/time-out` now also returns `taskReportForm` (`null` when there's nothing to answer).
- `GET /api/task-reports/team?include=forms` puts questionnaire rows (`kind: "form"`) next to free-form ones. `GET /api/task-reports/me/:date` returns `mode`.

### 1. Trial Features card (`CompanyConfigurations.jsx`)
- When "Clock-out documentation (trial)" is on, there's a **Documentation mode** choice: **Free-form** or **Custom forms**.
  - Switching asks for confirmation in both directions and explains what changes for employees.
- In Custom forms mode:
  - **Time to answer after clock-out**: presets (24 hours, 3 / 7 / 14 days) or a custom number of days or hours;
  - a **Manage forms and assignments** link.
- Each setting saves on its own. The general Save no longer sends them.
- The Quick Guide text is updated.

### 2. Clock-out Forms page (`/dashboard/company/clock-out-forms`, Settings group)
- Admin only. It shows while the trial is on and is allowed on the free plan.
- **Forms tab:** Active / Archived / All.
  - Each row can be opened, duplicated ("Copy of X" when no name is given), archived or restored.
  - Delete asks for confirmation. If the form already has answers, it offers **Archive** instead.
  - If a restore clashes with an active form's name, the message explains how to fix it.
- **Assignments tab:** every rule in priority order.
  - Deleted targets are flagged, and archived forms are marked "skipped until restored".
  - Each rule can be changed or removed.
  - The **Assign form** dialog has a searchable department / employee / shift picker and says when it replaces an existing form.
- **Editor** (`/clock-out-forms/[id]`, `new`):
  - name and description, then 1–100 questions of 9 types, with help text, required, and options for choice types;
  - ↑/↓ reorder, duplicate and delete per question;
  - the client checks the same rules the server does before saving;
  - question ids stay stable;
  - an **Edit / Preview** toggle;
  - an **Assigned to** section, and the number of answer sets;
  - archived forms are read-only (Restore / Duplicate);
  - a warning before leaving with unsaved changes.

### 3. Employee: answering
- **Pop-up after clock-out** (`Punch.jsx`) when `taskReportForm` is set. Closing it means "answer later".
- **Punch logs** (Custom forms mode):
  - a **Questionnaires** button with a pending count opens **Pending** (with when each closes) and **History** (date range);
  - each punch row has a questionnaire icon: answer / draft / submitted / incomplete;
  - the free-form icon is hidden in this mode.
- **Answer dialog:**
  - all 9 types, in the company time zone;
  - Save draft, or Submit with a confirmation (submit locks the answers);
  - required questions are only checked on Submit;
  - it's read-only when submitted, Incomplete or turned off;
  - on a conflict, lock or closed window it reloads and shows the server's message;
  - **View PDF / Download** once submitted.
- The free-form report opens read-only in Custom forms mode, with an explanation.

### 4. Employee Report (`EmployeeTaskReports.jsx`)
- Free-form reports and questionnaires appear in one list, with a **Type** filter and column.
- The Items column shows tasks, or answered / total questions.
- Incomplete questionnaires get an **Incomplete** badge.
- The side panel opens either kind. Submitted questionnaires get **View PDF / Download**.

### Not changed
- Free-form Daily Task Report behaviour in Free-form mode.
- Mobile app (the mobile developer has the same hand-off).

**To test (once server v2.11.16 is live):**
1. Trial Features:
   - The mode cards show only while the switch is on.
   - Switching asks for confirmation, and the choice stays after a reload.
   - The time to answer saves.
2. Clock-out Forms:
   - Create, edit, reorder and preview a form, then save twice: question ids stay the same.
   - A name clash, an empty option or a duplicate option is blocked.
   - Archive → read-only. Restore with a name clash → message. Duplicate → "Copy of X".
3. Assignments: assign to a shift, an employee, a department and everyone; replace one; remove one. Deleted targets are flagged.
4. Clock-out:
   - In Custom forms mode, the pop-up opens for a punch with a form.
   - Close it: the punch shows as pending in Punch logs → Questionnaires.
   - Save a draft, then Submit: the answers lock, and the PDF opens and downloads.
5. When the window ends, a draft shows as Incomplete, with no PDF.
6. Employee Report:
   - Both kinds show, the Type filter works, and the questionnaire panel shows the answers.
   - In Free-form mode the old behaviour is unchanged.

---

## BB-133 — Overview page redo (all roles)

**Status:** Built (client), not yet tested. Needs server **v2.11.16** for the corrected numbers and the supervisor team view. Against the current server the page still works: old field names are used as fallbacks.

**Why:** the Overview looked dated, and several numbers were wrong:
- times and days in UTC;
- absences included future and wrong-day shifts;
- late-ins compared against 1970 shift times;
- "overtime" wasn't approved OT;
- the OT cost and server uptime were made up.

The server issues and the agreed rules are in `docs/BB-133-overview-server-contract.md` (answered by the server).

**Server contract used (no server change from this repo):**
- `GET /api/analytics/employee`:
  - new totals `hoursWorked`, `daysWorked`, `scheduledDays`, `earlyOuts`, `approvedOvertime`, `overtimeDays`, `hoursBeyondSchedule`, `leaveDays`;
  - `series.daily[]` with each day's `status`;
  - `usualClockIn/Out` are now `"HH:mm"`, with `…Label` text versions.
- `GET /api/analytics/admin-dashboard`:
  - `scope` (`"company" | "team"`); supervisors get their department plus direct reports;
  - `charts.attendanceDaily[]`;
  - approved vs beyond-schedule OT;
  - `cost` is removed.
- `GET /api/analytics/super-dashboard`:
  - superadmin only;
  - days in UTC;
  - `serverUptime` / `avgResponseTime` are `null`.

### 1. Shared pieces (`Overview/OverviewShared.jsx`, new)
- One data hook and one period picker, replacing three copies.
- Stat tiles, chart cards, split bars, ranked lists and the **attendance strip**.
- Colour tokens only (`chart-1..5`, `destructive`, `muted`), so dark mode works.
- `Commons.jsx` is now unused but kept for now.

### 2. Employee view
- **Tiles:** hours worked, approved overtime ("approved in cutoff review"), beyond schedule, average per day worked, late, early clock-outs, absences (leave not counted), usual hours.
- **Charts:**
  - daily hours as stacked regular and approved-OT bars;
  - the attendance strip, one square per day;
  - a clock-in time trend.
- **Removed:** the Session Status donut and the ×7 / ×30 projections.

### 3. Admin view (and supervisors' "My team")
- **Tiles:** active staff, hours worked, approved OT (beyond schedule as the hint), absences, coverage, reliability, late rate, early leave rate.
- **Charts and lists:**
  - daily attendance (stacked) and scheduled vs actual hours;
  - overtime trend and overtime by department (approved vs beyond);
  - active staff, leave status, leave by type;
  - a departments table.
- **Removed:** the OT cost chart.

### 4. Superadmin view
- **Tiles and charts:** platform tiles (Engagement replaces the response-time tile), subscription mix, revenue by plan, new companies / employees, top companies, sessions by country, most active and recently joined.
- "days in UTC" is shown next to the period.
- **Removed:** Server Uptime and the "Platform Healthy" badge.

### 5. Page shell (`Overview.jsx`)
- A new header with a per-role subtitle, and Refresh.
- Supervisors get **My team** (opens first) | **Me** tabs.

### Not changed
- The URL, the period presets and the custom range limit.
- Mobile.

**To test:**
1. **Employee:**
   - Usual hours show as "8:52 AM – 5:10 PM" in the company zone.
   - Absences leave out leave days and future days.
   - Approved OT is 0 until the cutoff is reviewed.
   - The strip's colours match each day.
2. **Admin:** the daily attendance bars add up, and approved vs beyond-schedule OT both show.
3. **Supervisor:** My team shows only the department and direct reports. Me shows their own numbers.
4. **Superadmin:**
   - No uptime or health badge, and "days in UTC" shows.
   - An admin calling `/super-dashboard` directly gets 403.
5. Dark mode and phone width: the charts and tiles stay readable, with no horizontal scroll.

---

## Open items
- `Overview/Commons.jsx` is unused. Delete it in a later push (Carlo kept it for now).
- BB-129 later work: no PDF on mobile yet (optional for the mobile developer); the mobile app needs sections 3–7 and 10 of the phase 2 hand-off.
- BB-133: test against the live server. The fallbacks to old field names can be removed after that.
