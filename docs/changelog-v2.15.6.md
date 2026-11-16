# Changelog — v2.15.6

BB-120: B. Buddy (the support account) no longer has any way into payroll. Cutoff review and the hours reports stay available. B. Buddy can now open Documentation, which used to redirect it away.

BB-121: a company can choose a **List** or **Calendar** cutoff page in Configurations → Trial Features. The Calendar pages are built but **parked as a view-only preview**: every change still happens in the List view, until the server owns the pay math (see `docs/BB-121-client-computation-audit.md`).

BB-129: trial of **clock-out documentation** (Daily Task Report). Employees can list the tasks they did each day from their Punch logs; supervisors and admins read the submitted reports on a new **Employee Report** page. Off by default; turned on in Configurations → Trial Features. Needs server v2.11.13.

BB-128 (part 1 of GPS Breadcrumbs): new **Employee Map** page for supervisors and admins showing where employees clocked in and out, as a heat map or individual points, with the company's work sites. Needs server v2.11.14.

---

## BB-120 — B. Buddy: no payroll access

**Status:** Complete (client), confirmed by Carlo: B. Buddy no longer sees payroll. Needs the server's BB-120 change: `/api/payroll`, `/api/payroll-system`, `/api/company-information`, `/api/employee-payroll-details`, `/api/payroll-export` and `/api/disbursements` return 403 `SYSTEM_AGENT_NOT_ALLOWED` for a B. Buddy session. Either can ship first: client first only hides the links early; server first means B. Buddy sees "This action isn't available in support mode." in payroll until the client ships. Best shipped together.

**Sidebar (`components/Dashboard/sidebar.jsx`):**
- B. Buddy gets no Employee Panel section (it used to show a **Payroll** group with Payroll Management). The existing `features.length > 0` check hides the empty section.
- `agentFeatures` removed. The section heading is always "Employee Panel" now (the "Payroll" heading was only for B. Buddy).

**Route guard (`lib/systemAgent.js`):** payroll is removed from `ALLOWED_PREFIXES`, so `/dashboard/employee/payroll` (bookmark, old link) redirects B. Buddy to `SYSTEM_AGENT_HOME` like every other Employee panel page. Payroll, Disbursement and Payslip pages all live under `/dashboard/employee`, so all are covered. The only Employee panel page B. Buddy can open is now Documentation (below).

**Documentation (bug found during BB-120):** clicking the Documentation (book) icon in the top bar as B. Buddy never opened the guide. The page is `/dashboard/employee/documentation`, which BB-110's guard blocked, so B. Buddy got a loading screen and was sent to the Employees page. This dates from BB-110, not BB-120; other roles weren't affected.
- `lib/systemAgent.js`: `ALLOWED_PREFIXES` is now `["/dashboard/employee/documentation"]`.
- `Documentation.jsx`: for B. Buddy (`isSystemAgentToken`), the Employee tab is hidden, so the page opens on **Company Panel**. Any guide whose page B. Buddy can't open is hidden, using the same `isBlockedForSystemAgent` check as the route guard: today that's Payroll Management, Disbursement (Company Panel tab) and company Deletion (Company Settings tab). Everyone else sees the same guide as before.
- The Navbar icon is unchanged.

**Employee Cutoff (`EmployeeCutoff.jsx`):** the **Preview Payroll Reports** button (search icon next to Configure) is hidden for B. Buddy (`isSystemAgentToken`). Its dialog called `/api/payroll-export/…`. Review, approve, lock, process and Configure are unchanged. The dialog code stays (unreachable for B. Buddy).

**Unchanged for B. Buddy:** cutoff review, and the hours reports on the company Punch Logs page: PDF, Excel, Payroll Grid (`/api/reports/punch-logs`) and Yearly Total Hours (`/api/reports/yearly-total-hours`, on the Punch Logs page, not Settings). The setup guide's payroll step is dropped by the server; no client change.

**Normal admins:** unchanged.

**To test (as B. Buddy):** no Employee Panel / Payroll group in the sidebar; `/dashboard/employee/payroll` redirects to Employees; Employee Cutoff has no preview button and review / approve / lock / process still work; no payroll step in the setup guide; Punch Logs reports and Yearly Total Hours still download; the Documentation icon opens the guide on Company Panel, with Company Panel and Company Settings tabs only, and no Payroll Management, Disbursement or Deletion guides. As a normal admin (and as an employee), Documentation shows the same tabs and guides as before. As a normal admin: Payroll, Disbursement and the payroll preview work as before.

---

## BB-097 (revision) — Documentation matches v2.15.4 and BB-120

**Status:** Complete, confirmed by Carlo. Text only. No server changes.

**Why:** v2.15.4 (BB-119) changed exports and removed viewer-zone times, and BB-120 removed B. Buddy's payroll access. Parts of the in-app guide described the old behaviour.

**Fixed (no longer true):**
- **Employee → Punch Logs** (`docsContent.js`): "Use Export to download your logs as CSV or PDF" → **Export PDF**, on a computer, for the selected period and filters.
- **Employee → My Schedule** (`docsContent.js`): the Multi-timezone item is a badge that says the shifts use more than one zone. It doesn't explain the zones.
- **Company → Departments** (`companyDocsContent.js`): "CSV or PDF" → **Export Excel** (all fields) or **Export PDF**.
- **Company → Employee Schedule** (`companyDocsContent.js`): the Multiple timezones notice lists the zones. It no longer shows local times.

**Filled in:**
- **Company → Punch Logs, Reports:** names the three report types (Excel — Detail, PDF, Excel — Payroll Grid) and says the page filters apply.
- **Company → Leave Requests:** the table view's Generate Excel / Generate PDF, and the calendar's Generate PDF for the month.
- **Company → Employees:** new "Exporting employees" topic (Export Excel / Export PDF).
- **Company → Employee Requests (Contests):** tip for Export Excel / Export PDF (date range and status filter apply).
- **Employee → Contest Time Logs:** step for Export → Export Excel / Export PDF (on a computer).
- **Company Panel tab description** (`Documentation.jsx`): B. Buddy gets a version without "pay a finalized payroll", since its payroll guides are hidden (BB-120). Everyone else sees the same description.

**Checked, unchanged:** "Times are shown in the company timezone" (Punch Logs), the Company timezone guide (Settings), Yearly Total Hours, and the Cutoff Periods guide (never mentioned the payroll preview).

**To test:** open Documentation as an employee, an admin and B. Buddy, and check the sections above read as described.

---

## BB-121 — Cutoff page type (List / Calendar), parked as a preview

**Status:** In progress, **parked** by Carlo (2026-11-16). The setting, the routing and the List pages are complete. The two Calendar pages are a **view-only preview**: every action that changes data is turned off, and approvals stay in the List view. They won't be switched on until the server provides the pay figures (audit below).

**Needs server v2.11.12:**
- `Company.cutoffPageView` (`"list"` default / `"calendar"`) on `GET`/`PATCH /api/company-settings`.
- Supervisors may save that one field.
- The exclude note fix.

Until the server ships, the page stays on List and the setting doesn't save.

**Configurations (`Settings/CompanyConfigurations.jsx`):**
- **New "Cutoff Page" tab** (`?tab=cutoff-page`), renamed **"Trial Features"** in BB-129 (`?tab=trial-features`; the old link still opens it): List or **Calendar (preview)**. It saves right away with only `{ cutoffPageView }`. Admins, superadmins and supervisors can change it.
- **Main Save** no longer sends `cutoffPageView`, so an old copy of the page can't undo another person's choice (same idea as BB-119's timezone).
- **Bug found:** the page read `role` from the auth store, which has no `role`, and the sign-in token carries none either. So the role was always empty, the employee redirect never ran, and the new setting was locked for everyone. The role now comes from `GET /api/account/profile` (`data.user.role`), as the sidebar does. Employees opening Configurations directly are now sent to the dashboard, as intended.
- Quick Guide entry added.

**Routing:**
- `lib/hooks/useCutoffPageView.js` reads `cutoffPageView`. Anything but `"calendar"` means List.
- `CutoffPeriodsSwitch.jsx` and `CutoffReviewSwitch.jsx` pick the page. The URLs are unchanged, so existing links keep working.
- `?view=list` switches the current browser tab to List and is remembered for that tab (sessionStorage); `?view=calendar` clears it.

**List pages: same behaviour, code moved so both views share it.**
- **`cutoffPeriodsShared.jsx`:** cutoff list data and actions (`useCutoffPeriods`), its dialogs, and `DeptConfigPanel`. The panel has a new optional `readOnly`, used only by the Calendar preview.
- **`cutoffReviewShared.jsx`:** review data, record building and actions (`useCutoffReview`), the sync overlay and the dialogs.
  - **Records now also keep:** the raw segment window, the punch's lunch and the server's lateness.
  - **Settings now also kept:** grace, early clock-in grace, and each punch's shift times from `GET /api/timelogs` (already loaded).
  - **`CutoffReviewDialogs`** takes `skip`.
- **`EmployeeCutoff.jsx`** (1,399 → ~580 lines) and **`CutoffReview.jsx`** (3,517 → ~1,620 lines) use them. The layout and behaviour are unchanged.

**Calendar cutoff list (`CutoffPeriodsCalendar.jsx`, preview):**
- "Needs your attention" cards and status tabs.
- Department chips with pending counts; the company name is used for records with no department.
- Periods grouped Current / Previous / Earlier, with approval bars and a ⋮ menu with descriptions.
- A Mark processed dialog with a confirmation tick box.
- Configure schedule, read-only.

**Calendar review (`CutoffReviewCalendar.jsx`, preview):**
- **Layout:** employee list, summary (Approved / Waiting / Clocked) and an Overtime strip (server OT only).
- **Calendar:** paid and clocked hours, flag chips (late/grace, No AM run, Early Regular?, +Nm PM, left early, no clock-out, lunch) and an orange week column.
- **Day panel:** pick-then-approve with Schedule/Actual/Hold, banners, a lunch line and a Calendar-only Exclude dialog.
- **Rows covered:** driver and Staff (regular) rows. B&C and fixed-hours specifics aren't built yet.
- **Removed here:** Mark training and Edit.

**Preview switch:** `lib/cutoffCalendarPreview.js`, `CALENDAR_PREVIEW_ONLY = true`.
- **Both Calendar pages** show a banner with **Open List view**, and every action that changes data is disabled with a tooltip.
- **Review page:**
  - **Disabled:** Approve, Exclude, Approve remaining, OT Approve/Decline, Reset, Honor punch/leave, Sync and Finalize. The handlers themselves also refuse to run.
  - **Still works:** Schedule/Actual/Hold picks (local only), days, employees and the legend.
- **List page:**
  - **Disabled:** Manual cutoff, Lock / Unlock / Mark processed / Delete, and Configure / Edit / Generate.
  - **Still works:** Review/View, payroll export view and download, and filters.
- Setting the flag to `false` turns everything back on.

**Why it's parked:** the Calendar review page re-computes things that only the server should own:
- pay previews for Schedule and Actual;
- lunch deduction;
- grace and lateness;
- default choices;
- which option was paid;
- totals.

During BB-121 these already drifted from the server three times. The full list with code references, the open questions and the proposed `/approvals` additions is in **`docs/BB-121-client-computation-audit.md`**. The List pages are the baseline: they show the server's numbers and only add them up.

**To test:**
- **Configurations → Trial Features (Cutoff Page):**
  - an admin or supervisor can switch List ↔ Calendar (preview);
  - saving another tab doesn't send `cutoffPageView`;
  - an employee opening Configurations is sent to the dashboard.
- **With List:** both cutoff pages behave exactly as before. Run a full pass on review, approve, exclude, reset, OT, conflicts, training, fixed hours, Sync, Finalize, Configure, Generate, Manual cutoff, lock/process/delete and payroll exports.
- **With Calendar:**
  - both pages open with the preview banner;
  - every data-changing button is disabled;
  - picks, days and employees still respond;
  - **Open List view** shows the List pages and stays on List while moving between the list and a review in that tab.

---

## BB-129 — Clock-out documentation (Daily Task Report), trial

**Status:** Complete (client), confirmed by Carlo (2026-11-16). Web only; mobile has no change.

**Needs server v2.11.13 deployed first** (`/api/task-reports`, `Company.taskReportEnabled`). On the server, `scripts/add-daily-task-report.sql` must run **before** that deploy: `GET /api/company-settings` selects the new column, so without it company settings fail for every company. Until the server ships, the setting reads as off, so the icon and the Employee Report page stay hidden.

**What it is:** one optional report per employee per day (the company-zone day of the clock-in). A list of tasks, each with a title (required, up to 200 characters) and a note (optional, up to 1000), at most 50. No deadline during the trial: any past day with a punch can be documented. The PDF exists only after submit. Supervisors and admins can only read submitted reports.

**Configurations (`Settings/CompanyConfigurations.jsx`):**
- The BB-121 **Cutoff Page** tab is renamed **Trial Features** (`?tab=trial-features`; `?tab=cutoff-page` still opens it). It holds settings for features still on trial or in preview.
- New **Clock-out documentation (trial)** switch. It saves right away with only `{ taskReportEnabled }`. **Admins and superadmins only**: the server rejects the field from anyone else, so supervisors see it read-only. The main Save no longer sends `taskReportEnabled` (same reason as `cutoffPageView`).
- After saving, the page tells the sidebar, so **Employee Report** appears or goes without a reload.
- `Toggle` gained an optional `disabled` prop (other toggles unchanged).
- Quick Guide entry added.

**Employee Punch logs (`EmployeePanel/TimeKeeping/PunchLogs.jsx`):**
- When the setting is on, every row's **Actions** cell has a report icon: plain document (none), orange pen (draft), green check (submitted). Every punch on the same day opens the **same** report.
- The icon states come from `GET /api/task-reports/me?from=&to=` for the days on the current page. The server allows 93 days per call, so far-apart days are split into several calls.
- Only the Actions column and the new dialog were touched. The file's flagged stat-card and `OTBanner` styling is untouched.

**Report dialog (new `EmployeePanel/TimeKeeping/TaskReportDialog.jsx`):**
- Shows the day's attendance (first clock-in, last clock-out or "Still clocked in", shift, punch count) in the company zone from the response.
- Input form only, no PDF layout: add, remove, move up/down (no drag-and-drop library in the repo). Character limits are enforced while typing. Completely empty rows are dropped on save; a note without a title is an error.
- **Save draft** / **Submit** before the first submit; after it, one **Save** that always re-submits. **View PDF** (opens in a new browser tab) and **Download** appear only once submitted.
- Read-only with the reason when `canEdit` is false (setting off, or no punch that day). Server errors show their `message`.
- Unsaved changes are kept: clicking outside or pressing Esc doesn't close the dialog while there are changes; Cancel does.

**Employee Report page (new `/dashboard/company/employee-report`, `Punchlogs&Overtimes&Leaves/EmployeeTaskReports.jsx`):**
- Sidebar: **Requests & Logs → Employee Report**, for admins, superadmins, supervisors and B. Buddy, **only while the setting is on**. Opening the URL while it's off shows "Clock-out documentation is turned off."
- Not plan-locked: added to `FREE_ALLOWED`, same as Employees Punch logs.
- `GET /api/task-reports/team`: submitted reports only; the server decides the scope (supervisor: department + direct reports; admin: whole company). Opens on the server's default range (last 30 days); From/To with Apply (max 93 days). Department and employee name/ID filters work on the loaded list.
- Selecting a row opens the report on the right (`GET /api/task-reports/:id`): employee, job title, department, attendance, tasks, View PDF (new tab) and Download. Closed with ✕. No edit controls.

**Shared:**
- `lib/taskReportsApi.js` (new): calls, limits, the sidebar event, and time formatting in the response's time zone.
- `lib/reportDownload.js`: new `openServerReport` opens a server PDF in a new tab. The tab is opened on the click itself so pop-up blockers allow it; if the browser still blocks it, the message suggests Download.

**To test:**
- **Configurations → Trial Features:** as admin, the switch saves and Employee Report appears or goes in the sidebar without a reload; as supervisor it's read-only; saving another tab doesn't flip it; `?tab=cutoff-page` still opens the tab.
- **Setting off:** no report icon on Punch logs; no Employee Report in the sidebar; the URL shows the "turned off" message.
- **Employee, setting on:**
  - the icon shows on every row; two punches on the same day open the same report;
  - Save draft → orange icon, no PDF buttons;
  - Submit with no tasks → error; Submit → green icon, View PDF opens a new tab, Download saves the file;
  - edit after submit → only **Save**, stays submitted;
  - an overnight punch belongs to its clock-in day in the company zone;
  - times show in the company zone with the browser set to another zone.
- **Supervisor:** sees only their department and direct reports, never drafts; filters work; the panel shows the tasks and both PDF buttons; no edit controls.
- **Admin / B. Buddy:** whole company. B. Buddy has no Punch logs (Employee panel blocked), so it can't write reports.

---

## BB-128 — Employee Map (part 1 of GPS Breadcrumbs)

**Status:** Built (client), waiting for Carlo's test. Web only; mobile has no change.

**Needs server v2.11.14 deployed first** (`GET /api/employee-map`; no SQL). Before that, the page shows the server's error message.

**Where:** Requests & Logs → **Employee Map** (`/dashboard/company/employee-map`). That group is already hidden from employees; supervisors and admins see it. The server still decides the scope (supervisor: department + direct reports; admin: whole company) and returns 403 to employees. Plan lock: not on `FREE_ALLOWED`, so Free plans see it locked (Basic and up), like most company pages.

**Page (new `Punchlogs&Overtimes&Leaves/EmployeeMap.jsx`):**
- **Filters:** One day (default: today in the company zone, from the server) or a Range (max 31 days, checked before calling); Both / Clock-in / Clock-out; department (`/api/departments`); employee. Every change reloads the map.
- **Stat tiles:** Punches, With location, No location, Outside work sites (in and out split underneath). "Outside work sites" shows "—" when the company has no sites.
- **No-location note:** "N punches have no location (entered by an admin, imported, or location was off)…" so the map isn't read as complete.
- **Employee list** next to the map (counts, and how many have no location). Clicking one filters to that employee (calls again with `userId`); clicking again or **Show everyone** clears it. The list keeps everyone while one person is selected.
- Times come from the server (`atLocal`, company zone); the page header names the zone.
- **Privacy:** requests use `cache: "no-store"` and nothing is kept in local or session storage.

**Map (new `Punchlogs&Overtimes&Leaves/EmployeeMapCanvas.jsx`, Leaflet + OpenStreetMap, both already in the repo):**
- **Heat map** (default) or **Points** (clock-in green, clock-out blue) with a popup: name, "Clock-in 8:57 AM" (date included for a range), site name or "Outside work sites (1.2 km from Main Office)", and "±15 m" accuracy when present.
- Work sites always: a dashed orange circle with their radius, or a pin when the radius is empty.
- The view fits all points and sites on each load.
- **No new dependency:** `leaflet.heat` isn't installed, so the heat layer is a small canvas layer in this file (same technique: soft blobs weighted by `weight`, coloured blue→red). Its colours are canvas pixel values, so they're hex in code by necessity.
- Breadcrumbs (part 2): `layers.breadcrumbs` is ignored for now; it will be one more layer and toggle on this map.

**To test:**
- As admin: today's map loads; switch Both / Clock-in / Clock-out; Heat ↔ Points; popups read as above; sites show as circles or pins.
- A range of more than 31 days shows an error and doesn't call the server.
- Pick a department, then an employee (from the dropdown or the list); Show everyone clears it.
- The no-location note and tile match punches entered by an admin or imported.
- As supervisor: only their department and direct reports. As employee: no menu item; the URL shows the server's 403 message.
- Browser set to another time zone: popup times stay in the company zone.

---

## Open items

- `EmployeeCutoff.jsx:80` (was line 130 before BB-121 moved code out) has one static inline style (`style={{ background: "inherit" }}`). Left as is.
- **BB-121, server answers needed before the Calendar pages are switched on** (`docs/BB-121-client-computation-audit.md` §6):
  - **Actual on an early regular punch:** should it snap to the shift start within `earlyClockInGraceMinutes` (pending 5.5h vs approved 5.52h)?
  - **Lunch on regular punches:** is it deducted at approval or later?
  - **Pending vs approved driver segment hours:** the grace credit differs (1.2h vs 1.25h).
  - **DA lateness:** which start does the server measure from?
- **BB-121 server ticket (after BB-114 batch 1, ~2026-11-28):** `/approvals` per-record additions (shift times, raw lateness, flags, a Schedule/Actual preview, recommended mode, stored `approvalMode`), totals, and a bulk approve that takes a mode per record.
- **BB-121 Calendar, not built yet:** B&C layout, fixed-hours summary/edit, and the whole-day Training dialog on the Calendar review.
- **BB-121 follow-up:** the List page's Exclude dialog still has six reasons; the Calendar one has three.
- **BB-129 follow-ups (not in this version):** an edit deadline and its setting, mobile support, a prompt at web clock-out (client only), an in-app guide entry in `companyDocsContent.js`, and a report icon on the company Punch logs (the separate page was chosen instead).
- **BB-128 part 2 (later, needs mobile):** GPS breadcrumbs layer and toggle on the Employee Map.
