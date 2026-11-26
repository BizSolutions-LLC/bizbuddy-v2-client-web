# Changelog — v2.18.1

BB-151 (Company Settings history):
- **Settings → History** shows who changed which company setting, when, and the old and new value.
- Every company-wide settings save now asks "Save changes?" first.
- Settings that only admins may change are disabled for supervisors and employees.

BB-128 follow-up (Employee Map):
- **Map colours fixed:** work sites, route ends, pin links and suspicious lines no longer show Leaflet's default blue.
- **Routes:** "No location" stretches are solid, and pins show **"stayed"** times.
- **Live:**
  - **Locate now** for one person or everyone;
  - redesigned with status pins, an accuracy halo, site labels, a person card and a grouped side panel.
- **Light** is the default map style on every map.

BB-152 (company time): when your device is in another time zone, an **orange tab at the bottom-right** shows the company's date and time live. Clicking it compares company time with your time.

**Needs the next server release after the BB-128 map-views release:**
- BB-151: settings history, `GET /api/company-settings/history`, the new admin-only 403s, and `scripts/add-company-settings-events-bb151.sql`.
- BB-128: `position.hereSince`, Locate now (`POST /api/employee-map/live/:employeeId/locate`, `POST /api/employee-map/live/locate`) and `employees[].locate`.

Its number is set at the server push.
- **Before the server is deployed:** History shows a "not available yet" note, Live shows no "Here for", and Locate now answers an error toast.
- **Still open on the server:** `position.site` (on site / outside, `docs/server-request-BB-128-live-site.md`). Until it ships, Live shows people with a fresh position as "Clocked in", in neutral pins.
- **Mobile:** Locate now needs the matching app update (`docs/mobile-update-BB-128-locate-now.md` in the server repo). Until then, requests end as "Phone didn't answer". Also confirm the app never calls the BB-151 admin-only endpoints as a supervisor or employee.

---

## BB-151 — Company Settings history

**Status:** Built (client). Carlo saw History filled with real rows locally on 2026-11-26. The save confirm and the admin-only checks still need a full test.

**Why:**
- Company-wide settings change hours and pay for everyone.
- Until now a save overwrote the old value, so nobody could tell who changed what.
- The server now records each change and turns away non-admins on several settings writes.

### Server contract used
- `GET /api/company-settings/history?area&from&to&limit&cursor` (admin and superadmin only) returns:
  - `data[]`: `{ id, at, area, by, bySupport, changes[{ field, label, from, to }] }`, newest first;
  - `meta: { nextCursor, available }`.
- New 403s for non-admins on:
  - `PUT notification-settings`, `PUT check-settings`, `POST check-test-pdf`;
  - `PUT company-information/payroll-config` and `company-info`;
  - the earning-type, deduction-type and federal/state tax-rate writes.

### Changes
- **Settings History page:**
  - Files: `SettingsHistory.jsx`, `app/dashboard/company/(Settings)/settings-history/page.jsx`.
  - Sidebar: **Settings → History**, admins only (supervisors and employees are redirected).
  - Columns: When (company time zone), Who ("BizBuddy Support" for support saves, "Deleted user" when the user no longer exists), Page, Setting, Old → New.
  - On/Off for yes/no values; lists and objects shown short, with the full value on hover.
  - Load more. No filters for now (Carlo).
  - Shows "History starts once the server update is installed" when `meta.available` is false.
- **Save confirm** (`components/ui/confirm-company-save.jsx`):
  - "This changes the setting for the whole company. Save changes?" with Cancel and an orange Save button.
  - Used on:
    - Configurations: Save bars and every Trial Features switch;
    - Leave Settings: Save, credit Save, turning credits off;
    - Notifications, Check Printing, Payroll config, Company Profile;
    - the B. Buddy panel's company edit.
  - Skipped:
    - department toggles (not recorded);
    - turning **on** Punch device or Location tracking, which already shows its own notice;
    - the leave credit setup Apply (its preview is the confirmation).
- **Admin-only settings** (`lib/hooks/useAccountRole.js`, the role from `/api/account/profile`), with "Only admins can change this setting." shown:
  - **Payroll → Company:** Update Settings disabled; Add Earning/Deduction/Bracket hidden; row toggles and edits disabled.
  - **Payroll → Check Printing:** Save and Generate Test PDF disabled.
  - **Notifications:** Save disabled.
- **Role bug fixed:** `LeaveSettings.jsx` and `CompanyProfile.jsx` read `role` from the auth store, which has none. They now use the hook, which brings three behaviour changes:
  - the non-admin redirect on Leave Settings now works;
  - the superadmin **Delete company** button on Profile now shows;
  - the leave report treats supervisors as supervisors.

### Not changed
- `PATCH /api/company-settings` gating (supervisors may still save the cutoff page view).
- Flat tax rates and FUTA/CA (`/api/deductions/*`), which are not on the server's 403 list.
- Leave policy create/edit/delete (not recorded).

### To test
1. As admin, change a setting on each page. The confirm appears, Cancel does nothing, Save saves, and the row shows up in History with the right old and new value.
2. Settings → History: Load more works. Before the server SQL runs, the "not available yet" note shows.
3. As supervisor:
   - History isn't in the menu, and its URL redirects;
   - Payroll → Company and Check Printing, and Notifications, have disabled or hidden actions and show no 403 toasts.
4. As superadmin, Profile shows Delete company.

---

## BB-128 follow-up — Employee Map: colours, stays, Locate now, Live redesign

**Status:** Built (client). Carlo reviewed the Live redesign and map styles locally on 2026-11-26. Locate now and "Here for" need the server deployed, and Locate now also needs the mobile update.

**Why:**
- The map showed Leaflet's default blue in several places.
- Carlo wanted Life360-style "here for" times, a way to ask a phone for a fresh location, and a cleaner Live view built from his mockup.

### Server contract used
- `/live` `employees[].position.hereSince` (when the person arrived at their current spot) and `employees[].locate` (`pending` / `answered` / `no_answer` / `not_sent`).
- `POST /api/employee-map/live/:employeeId/locate` and `POST /api/employee-map/live/locate` (`{ departmentId? }`). `reason` is one of `cooldown`, `no_device`, `push_failed` or `rate_limited`; 409 when the company or person can't be located.
- Requested, not shipped yet: `position.site { id, name, inside, distanceMeters, since }` (`docs/server-request-BB-128-live-site.md`).

### Changes
- **Colour fixes (`EmployeeMapCanvas.jsx`):**
  - **Cause:** `className` inside `pathOptions` is ignored by react-leaflet, so Leaflet's blue showed instead.
  - **Fix:**
    - work-site circles get explicit orange;
    - route start and end dots, pin-to-route links, suspicious-movement lines and fake-GPS dots get their classes as a top-level prop.
- **Routes:**
  - "No location" stretches are drawn solid (Carlo). Hovering one says the line is straight between two points. The legend entry was removed.
  - Stops are worked out on the client (`findStops`): within 100 m for 5+ minutes, with low-accuracy points skipped. This is the same rule as the server's `hereSince`.
  - Clock-in and clock-out pins show **"stayed 1 hr, 20 min"**, stretched to the punch time when the pin is within 100 m. Route dots in a stop say "Stayed X here".
- **Pin card:**
  - a Life360-style bubble (`.map-bubble` in `globals.css`);
  - on Live, a person card: department + status badge, Clocked in, **Here for** ("Was here for" when the position is old), Last location, GPS accuracy, Work site, Battery, and Locate now.
- **Locate now:**
  - a crosshair button on the card and on each side-panel row, plus **Refresh locations** in the toolbar (locked for 30 s). Clicking a pin never sends a request on its own.
  - While a request is pending: a pulsing ring, "Locating…", and Live refreshes every 5 s until it expires.
  - Then: "Updated just now" when answered; "Phone didn't answer, showing last known location (seen …)" otherwise; or the server's no-phone and rate-limit messages.
- **Live redesign:**
  - pins coloured by status: orange on site, black outside, grey no location or no recent update, red ring for fake GPS;
  - a GPS accuracy halo and work-site labels ("Kaingin site · 1 here");
  - a side panel grouped **Needs a look** / **On site** with one-line status ("At Main office · here 4 hr 30 min"), and search only when 5+ people are clocked in;
  - the map-style switch moved inside the map, and a new legend.
- **Light** is the default map style on the Employee Map and the Locations page. The saved choice was reset once (`employeeMap.basemap.v2`). Street is used if the Esri key is missing.
- **Configurations → Trial Features:** the location tracking notice adds "An administrator can also ask for your current location while you are clocked in."
- **`CLAUDE.md`:** map pins may be solid orange, an exception to the pilot's thin-accent rule.

### Not changed
- Clock-in / out and Routes keep each person's own colour. Only Live colours by status.
- No "Open time log" or "Directions" on the card (Carlo).

### To test
1. The map shows no blue anywhere: work sites, route start and end, pin links, suspicious lines.
2. Routes: gaps are solid. A clock-in pin at a long stop says "stayed …".
3. Live, after the server deploy:
   - "Here for" shows, and reads "Was here for" on an old position;
   - Locate now (one person and Refresh) pulses, polls every 5 s, then updates or says the phone didn't answer;
   - Refresh is locked for 30 s.
4. Live with 5+ people shows search; with fewer, no search.
5. The Employee Map and the Locations map open on Light.

---

## BB-152 — Company time tab

**Status:** Confirmed working by Carlo on 2026-11-26.

**Why:** people whose device is in another time zone misread punch and schedule times.

### Changes
- **`components/common/CompanyTimeBadge.jsx`, mounted in `DashboardLayoutClient.jsx`:**
  - The tab is orange, at the bottom-right edge (Feedback stays bottom-left), showing **"Nov 25 · 18:00:56 PST"** live.
  - Clicking it opens a card with **Company time** and **Your time**, each with date and zone, and the note "Punches, schedules and payroll follow the company time zone."
  - It only shows when the device's UTC offset differs from the company's. Same-offset zones such as Manila and Singapore don't trigger it. It re-checks every second.
  - It shows on dashboard pages only, not on public or system-admin pages.

### Not changed
- No server change. It reads `timezone` from `GET /api/company-settings`.

### To test
1. Set the computer to a zone with a different offset and reload the dashboard: the tab shows the company date and time, and the card shows both.
2. In the company's zone, no tab.

---

## Open items
- **Server:**
  - deploy the BB-151 + BB-128 Locate now release before this one, then fill in its version here;
  - run `add-company-settings-events-bb151.sql`;
  - `position.site` is still to be built (request in `docs/server-request-BB-128-live-site.md`, not committed).
- **Mobile:**
  - Locate now app update;
  - confirm no supervisor or employee calls to the BB-151 admin-only endpoints.
- **Settings History:** locked on the Free plan like other non-free pages. Add it to `FREE_ALLOWED` if Free companies should see it.
- **Known styling drift**, left as is: payroll `Company.jsx` still has hardcoded button colours.
- **Not committed**, local only:
  - `docs/server-request-BB-128-*.md`, `docs/server-request-BB-126/135-*.md`, `docs/mobile-handover-BB-143.md`;
  - the landing PDF and zip;
  - `public/landing/employee-map*.png`.
