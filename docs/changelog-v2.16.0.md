# Changelog — v2.16.0

BB-126: **Employees Punch Logs shows only server-computed values.** Every hour, break, OT, schedule, device and location value, and the summary cards and totals, now come from the server, from the same calculation as the punch-log report, so the table and the PDF / Excel agree. Rows show **Decided** or **Reviewed** when approvals provide the values. The page's tooltips are restyled and show each row's own breakdown.

BB-128 (part 2): **Employee Map routes.** A "Track location during shifts" setting, and a Routes view with suspicious-movement warnings. The map moves to **Locations**.

BB-134: **Record punch device.** A Trial Features switch. Punch-log row details show the device ID, the time the server received the punch, and the IP. This stands in for the MAC address, which phones don't expose.

BB-135: **Schedules.** A new **Roster** view (employees × dates, with an OT warning). The old Requests & Logs → Employee Schedule page is merged into Shifts & Schedules → Employees Schedule, with coverage cards. Supervisors can view it but not edit.

BB-137: admin security tools in the Company panel (admin only), plus a browser identifier sent at sign-in and sign-out.

BB-139: System Admin → B. Buddy → Companies: an **Onboarding workbook** download.

BB-140: System Admin → **Emails**: a log of every email the server sends, a safe preview, an image check, and test sends.

BB-141: **Face capture.** Clock-out documentation (custom forms) can require a live face photo from the mobile app. The web becomes view only for punching. The end-of-shift form is answered **before** clock-out. Face photos appear on cutoff approvals.

Also: a stray `;` on Settings → Configurations is removed.

**Needs server v2.11.17 or later.** That release carries BB-126, BB-128 2b, BB-134, BB-137, BB-139, BB-140 and BB-141. On the server side:
- BB-134 needs `scripts/add-company-punch-device-proof.sql`, and BB-128 part 2 needs `scripts/add-location-breadcrumbs.sql`, each followed by `prisma generate`.
- BB-141 needs the S3 face-photo bucket set up in production.

**Mobile:** BB-128 (record location points), BB-134 (send `deviceId` on clock-in/out) and BB-141 (take the face photo) each have their own mobile hand-off.

---

## BB-126 — Employees Punch Logs: server-computed values

**Status:** Built (client) and checked by Carlo. Needs server **v2.11.17**.

**Why:** the table recomputed values in the browser and drifted from the report. Some fields were blank or wrong:
- DayCare schedules came from **today** instead of the punch date.
- Device In/Out showed "—" after BB-134.
- Coffee left out auto breaks.
- "Avg Hours" averaged scheduled hours.
- Locked cutoffs still showed live punches.

**Server contract used** (requested in `docs/server-request-BB-126-punch-log-rows.md`, built by the server team):
- `GET /api/timelogs`: each row has a `display` object, computed by `services/TimeLogs/punchDisplay.js` (shared with the report):
  - `basis` (`live` | `decided` | `reviewed`);
  - effective `clockIn` / `clockOut`;
  - `workedHours`, `grossHours`, `scheduledHours`, `isScheduled`, `lateHours`, `undertimeHours`;
  - `coffeeMinutes`, `lunchMinutes`, `lunchAuto`;
  - `otHours`, `otStatus`, Driver/Aide `segments`, `cutoffStatus`;
  - device and location text;
  - `schedule` for the punch's own date, `matchedShiftId`, `missingClockOut`.
- New params: `cutoffPeriodIds`, `employeeIds`, `q`. `punchType` is now filtered on the server.
- `meta`: `basis` (`live` | `reviewed` | `partial`) and `summary` (`active`, `completed`, `scheduled`, `decided`, `reviewed`, `avgWorkedHours`, `totalWorkedHours`, `totalScheduledHours`). Above 10,000 rows, `summary` is `null` and `summaryNote` says why.

### Changes (`EmployeesPunchLogs.jsx`)
- **Mapping only:** `enrichTimelogs` only maps `row.display` onto the field names the table already used. It does no hour, OT, break, schedule or device maths. The old helpers are removed.
- **Filters:** several employees, search (waits until typing pauses), punch type and the selected cutoff's period IDs go to the server. The browser only sorts.
- **Summary cards and totals:** they read `meta.summary`. "Avg Hours" becomes **Avg Worked Hours** for completed punches.
- **Decided / Reviewed:** a small neutral chip next to the Cutoff Status badge, in the table and in row details. A one-line note above the table when the selected cutoff is final or partly final.
- **Tooltips:** every tooltip on this page has a light card look (local wrapper; `components/ui/tooltip.jsx` is unchanged).
  - **Hover:** a soft highlight, and tooltips open faster.
  - **Content:** each value tooltip shows the row's own breakdown (e.g. Worked = Gross / Lunch / Coffee, with the basis).
  - **Fixes:** Undertime and Gross had another column's text, and the old Duration and Period Hours definitions were wrong.

### Not changed
- The columns, the column picker, the row details layout, edit, delete and punch-type actions, and the report button.
- Still worked out in the browser (display hints only): the Driver/Aide lunch-attribution note, the pre-schedule gap note, and the "(actual)" PM hint.

**To test:**
1. **DayCare:** a punch from last week shows **that day's** shift in Scheduled, in the schedule dialog and in the Driver/Aide breakdown.
2. **Matches the report:** Device In/Out, Coffee (with auto breaks), Duration and Period Hours match the PDF / Excel for the same filters.
3. **Approve:** approve every segment of a punch in an open cutoff → the **Decided** chip shows with the approved hours. Reset → back to live.
4. **Locked cutoff:** pick a locked cutoff → **Reviewed** chips and the note. A mix shows the "part of this cutoff is final" note.
5. **Filters:** several employees, search and punch type change the cards and totals too.
6. **Tooltips:** hover over Duration, Lunch and OT to see the row's breakdown, in light and dark mode.

---

## BB-128 (part 2) — Employee Map: routes and suspicious movement

**Status:** Built (client). **Testing** with the test company. Needs server v2.11.17 (2b) and the mobile app recording location points.

**Server contract used:**
- `company-settings`: `breadcrumbsEnabled`, `breadcrumbIntervalMinutes` (1–60). Admin only, each saved on its own.
- `GET /api/employee-map`:
  - `data.layers.breadcrumbs` (per punch: points, gaps, `mockedPoints`, distance);
  - `summary.breadcrumbs` (`available` / `reason`, `truncated`);
  - 2b: per track `suspicious`, `jumps[]`, `pinChecks`, `points[].jumpedHere`, and `summary.breadcrumbs.suspiciousTracks`.

### Changes
- **Trial Features → "Track location during shifts":**
  - an interval picker;
  - turning it on first shows a California notice to give employees.
- **Employee Map → Routes view:**
  - one line per employee, dashed gaps, red fake-GPS dots, and hover details;
  - a track list (distance, points, gaps), mi/km;
  - the "pick one day or one employee" and "only the first 50,000 points" messages.
- **Suspicious movement (2b):**
  - impossible jumps are drawn dashed red and never join the route line;
  - faint dashed links run from the clock-in pin to the route and from the route to the clock-out pin, red when they don't connect;
  - a red "⚠ Suspicious movement (N)" badge in the track list (its tooltip lists each jump, e.g. "4,862 mi in 1 min") and a count in the card header.
- **Markers and colours:** Start = hollow black ring, End = solid black dot. Route colours avoid blue, green, red, orange and black.
- **Menu:** Employee Map moves from Requests & Logs to **Locations**. Supervisors get Locations with only Employee Map, so they keep their access.

**To test:** with the test company, turn tracking on, record a shift on the mobile app, then check Routes for one day. Test a fake-GPS or jump case, and that a supervisor sees Locations → Employee Map only.

---

## BB-134 — Record punch device

**Status:** Built (client). Waiting on the server deploy (code still to be committed, plus `scripts/add-company-punch-device-proof.sql`) and on the mobile app sending `deviceId`.

**Server contract used:**
- `company-settings`: `punchDeviceProofEnabled` (admin only, saved on its own).
- `GET /api/timelogs` rows: `proofIn` / `proofOut`, each `{ deviceId, registeredDeviceId, deviceMatch, serverReceivedAt, ipAddress, source }`. They are `null` when the setting was off.

### Changes
- **Trial Features → "Record punch device (trial)":** turning it on first shows a California notice to give employees.
- **Employees Punch Logs → row details → Location In / Out:** coordinates | device ID with "✓ Registered phone" or "⚠ Other phone", or "Web browser" / "Device not identified", plus "Received by server … · IP …".
- **Not built:** blocking punches, and a PDF / Excel column.

**To test:** once the server has BB-134, turn it on, clock in on the test phone, and open that punch's details. Older punches show no proof.

---

## BB-135 — Schedules: Roster view and Employee Schedule merge

**Status:** Built (client) and checked by Carlo. Uses `GET /api/usershifts/range` (with `includeOt=1`) and `/api/usershifts/company-stats`, already on the server.

### Changes
- **Views:** Shifts & Schedules → Employees Schedule has **Recurring | Calendar | Roster** tabs.
- **Roster** (`SchedulesRosterView.jsx`):
  - employees × dates in the company zone, 1 or 2 weeks, Comfortable / Compact;
  - per-cell net hours and "+Xh OT", name and day totals;
  - an OT on/off toggle with click-open OT panels (Scheduled / Limit / Over, plus a per-day breakdown);
  - the OT rule badge in the card header.
- **Merge:**
  - the old Requests & Logs → Employee Schedule page (`/dashboard/company/employee-schedules`) is now a redirect to `/dashboard/company/schedules`;
  - its coverage numbers become the stat cards: **Total Schedules, Assigned Employees, Without Shifts** (orange when > 0) **and Coverage %**.
- **Supervisors:**
  - they now get Shifts & Schedules → Employees Schedule, **view only**: no Create, Upload, Edit or Delete, and Calendar is read-only;
  - Company Shift Templates stays admin-only.
  - The server still allows supervisor writes; this only limits the page.
- **Moved to the Schedules page:** the "employees without shifts" sidebar dot, the `SCHEDULE_ASSIGNED_MANAGEMENT` notification link and the in-app guide entry.
- **In-app guide:** it hides guides for pages taken out of a menu group, and the "Who sees the Company Panel" text is updated.

**To test:** as a supervisor, check that Schedules has no edit controls and that the Templates guide is hidden. The old Employee Schedule link should redirect, the coverage cards should match the old page, and the Roster OT panels should open.

---

## BB-137 — Admin security tools

**Status:** Built (client) and checked by Carlo. Needs server v2.11.17.

### Changes
- **Sign-in and sign-out:** a per-browser identifier is sent at sign-in, and with a sign-out call from the Sign Out button. It's sent as `browserId`, never as `deviceId`, and sign-out never blocks if the call fails. Automatic logouts don't send it.
- **Company panel:** a new admin-only group, loaded only for admin accounts. Supervisors and employees see no change. Details are in the server's BB-137 hand-off.

**To test:** sign in and out on the web as an admin and as an employee. Check the admin-only group is present for admins and absent for everyone else, including by typing the URL directly.

---

## BB-139 — Onboarding workbook (System Admin)

**Status:** Built (client) and confirmed working by Carlo. Needs server v2.11.17.

### Changes
- System Admin → B. Buddy → Companies has an **Onboarding workbook** button next to Add company.
  - It downloads `GET /api/system-admin/onboarding-workbook` with `systemAdminDownload`, using the server's filename or the fallback name.
  - Its tooltip lists the required and optional sheets.

**To test:** the downloaded file has the dated name. If it has the fallback name, the server's CORS doesn't expose `Content-Disposition`.

---

## BB-140 — Emails page (System Admin)

**Status:** Built (client) and checked by Carlo. Needs server v2.11.17.

**Server contract used:** `GET /api/system-admin/emails`, `/emails/:id`, `/emails/templates`, and `POST /emails/test`.

### Changes
- **New page:** System Admin → More → **Emails** (`app/system-admin/emails/page.jsx`).
  - **Filters:** UTC dates (last 7 days by default, at most 92), company, type, status, include tests, and search.
  - **Summary:** total / sent / failed, and a sent-vs-failed chart per day.
  - **Table:** time, type (the server's labels), TEST chip, status (failed shows the error on hover), and a preview icon. 50 per page.
- **Detail drawer** (`EmailDetailSheet.jsx`):
  - from / to / subject, the server's reply, message ID, "triggered by", and hidden-values count;
  - the email preview, only in an `<iframe sandbox="">`, with a Text tab;
  - an image check (✅ / ❌ / not checkable);
  - "Details (older email, no preview)" for older rows.
- **Send test email** (`SendTestDialog.jsx`):
  - the template list comes from the server;
  - the address is pre-filled with the admin's username when it's an email, otherwise with the last address used in this browser (system admins have no email field);
  - the server's messages show (including the 30-per-hour limit and mail-server refusals).

**To test:** filters and paging; open a sent email (preview, Text tab, images); an older row; send a test → it shows at the top as TEST.

---

## BB-141 — Face capture

**Status:** Built (client) and checked by Carlo. Needs server v2.11.17 (with S3 set up) and the mobile hand-off.

**Server contract used:**
- `company-settings`: `taskReportFaceCapture` and `taskReportFaceCaptureClockIn`.
- `/time-in` and `/time-out` can answer `403 WEB_PUNCH_DISABLED`.
- `GET /api/task-report-forms/me/open`.
- `/time-out` with `{ answers }` (`400 TASK_REPORT_FORMS_REQUIRED` without them).
- `GET /api/face-photos/cutoff/:id` and `/face-photos/:id/url`.

### Changes
- **Settings → Clock-out documentation (Custom forms mode):**
  - **Include face capture**, with the reminder text;
  - **Also at clock-in** (disabled while face capture is off).
  - Each saves on its own, and turning documentation off clears both.
- **Punch page (view only):** while face capture applies, it hides Time In/Out and the breaks, and shows "Clock in and out from the BizBuddy mobile app". A `WEB_PUNCH_DISABLED` answer switches it to view only.
- **Form before clock-out:**
  - if the open punch has a form, it opens first (`ClockOutFormDialog.jsx`);
  - "Submit and time out" sends the answers with the clock-out, and "Stay clocked in" cancels;
  - **this is required by the new server even without face capture**: the v2.15.9 "answer after clock-out" flow fails on server v2.11.17.
- **Cutoff approvals (List):**
  - camera **In / Out** icons on each punch row, one set on the Driver Day header;
  - greyed out when hidden after approval or deleted after 90 days;
  - the viewer gets a fresh 5-minute link each time and shows the phone time, server time, and coordinates with a Google Maps link (`cutoffFacePhotos.jsx`).
  - The photos reload after approve, bulk approve and reset.

### Not changed
- The Calendar review page (still a parked preview).

**To test:**
1. Turn face capture on → the web Punch page is view only.
2. With face capture off and a form assigned → the form opens before clock-out, and the answers are saved with the punch.
3. On cutoff approvals: the photo icons and viewer work, the photo is hidden after approve, and it shows again after reset.

---

## Fix — Settings → Configurations

- `app/dashboard/company/(Settings)/configurations/page.jsx` rendered a stray `;` after the page. Removed.

---

## Open items
- **BB-128 part 2:** finish testing with the test company once the mobile app records location points.
- **BB-134:** the server code and SQL still need to be committed and deployed, and the mobile app must send `deviceId`. Then confirm the proof lines appear.
- **BB-126:** the Driver/Aide lunch-attribution, pre-schedule-gap and "(actual)" hints are still worked out in the browser. Moving them to the server needs one more server field.
- **BB-140:** a real "send to my own email" needs an email field on system admins (server).
- **Release together with server v2.11.17.** It has to work both ways:
  - This client on an older server: Punch Logs values read 0.00 / "—".
  - Server v2.11.17 with the older client (v2.15.9): web clock-out fails for employees with an assigned form (`TASK_REPORT_FORMS_REQUIRED`).
