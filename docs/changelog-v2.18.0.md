# Changelog — v2.18.0

BB-128 (map views): **the Employee Map has three tabs and a new look.**
- **Clock-in / out, Routes and Live**: each tab loads only when it's opened.
- **Live** is for admins only. It shows where clocked-in employees are now and refreshes every minute.
- People show as round initials badges in their own colour, the same colour on every tab.
- A map style switcher offers Street, Light and Satellite. Light and Satellite come from Esri.
- The page is the first dashboard page in the landing page's style (pilot).

BB-145 follow-up: **the landing page's Location punch slide shows the Employee Map**, with a Satellite view of the same spot in front of the Street view.

**Needs the next server release after v2.11.24** (BB-128 map views: `/api/employee-map/punches`, `/routes`, `/live`, with `initials`/`color`, and `pins` + `sites` on routes). Its number is set at the server push. The page calls only the new endpoints, so **the server must be deployed first**. **Vercel:** `NEXT_PUBLIC_MAP_SATELLITE_KEY` (Esri key) is already set. **Mobile:** no change.

---

## BB-128 — Employee Map: three views, initials pins, map styles

**Status:** Built (client). Carlo checked it locally on 2026-11-25: map styles, the restyle and the console are clean. The three tabs still need a full test against the deployed server.

**Why:**
- The server split the map into one endpoint per view, so each tab loads only its own data, and added a Live view of where clocked-in employees are now.
- Heat blobs and small dots told little with only 2–3 people. Initials badges show who is where.
- Carlo wanted users to be able to pick the map style.
- CARTO's free map tiles now need a key, and their free tier is non-commercial, so Light moved to Esri.
- Carlo wanted the page to feel like the landing page. It's a pilot on this one page first.

### Server contract used
- `GET /api/employee-map/punches?date|from&to&type&departmentId&userId` returns `{ company, filters, sites, summary, heat, layers: { clockIn, clockOut }, employees }`.
- `GET /api/employee-map/routes?date|from&to&departmentId&userId` returns `{ company, filters, sites, summary, tracks }`.
  - `summary` is the old `summary.breadcrumbs`.
  - `tracks[]` adds `initials`, `color`, `lowAccuracyPoints` and `pins: { clockIn, clockOut }`. Pins and sites were added at the client's request (`docs/server-request-BB-128-routes-pins.md`).
  - Per point: `lowAccuracy`, and `batteryLevel` as a 0–1 fraction.
- `GET /api/employee-map/live?departmentId` (admin and superadmin only, 404 for others) returns:
  - `generatedAt`, `refreshSeconds`, `tracking`, `summary`, `sites`;
  - `employees[]` with `position` (`source`, `ageSeconds`, `stale`, `isMocked`, `batteryLevel`, …) or `null`.
- Every person carries `initials` and `color`. The old combined `GET /api/employee-map` is no longer called.

### Changes
- **`EmployeeMap.jsx`:**
  - **Tabs:** each tab fetches its endpoint when opened and again when its filters change, always `no-store`.
    - Live is hidden unless the role (from `/api/account/profile`) is admin or superadmin.
    - Routes has no punch-type filter; Live has only Department.
  - **Clock-in / out:** stat row, Pins | Heat map toggle (Pins by default), employee list with initials badges.
  - **Routes:** same route list as before, plus "N low-accuracy points (over 100 m), not counted in distance".
  - **Live:**
    - refreshes every `refreshSeconds` while the tab is open and the browser tab is visible, and stops when you leave;
    - "Seen X min ago" counts up between refreshes; "At clock-in, 8:57 AM" until the first route point;
    - five stats, and a notice when tracking is off;
    - side list sorted by name with battery and fake GPS. "No location yet" rows have no pin. Clicking a person flies the map to their pin.
  - **Map style switcher:** Street, Light, Satellite. The browser remembers only the style name, never location data.
  - **Look (pilot):**
    - Inter Tight title;
    - underline tab bar with an orange marker;
    - filters in one toolbar;
    - flat stat row with thin orange rules and neutral numbers;
    - map and list in square-cornered frames;
    - slim toolbar and legend bars;
    - orange left marker on the selected row.
- **`EmployeeMapCanvas.jsx`:**
  - **Initials pins:** server colour, white initials. Clock-out has a white ring, stale is faded, fake GPS has a red outline.
  - **Routes:** route lines in the person's colour, punch pins and pin-to-route links from `tracks[].pins`, low-accuracy points drawn lighter.
  - **Live:** one pin per located employee.
  - The map fits to the data once per load; Live refreshes don't move the map.
- **`employeeMapRoutes.js`:**
  - Map style settings:
    - Street is OSM;
    - Light is Esri Light Gray (512 px tiles);
    - Satellite is Esri World Imagery.

    Light and Satellite need the Esri key and are hidden without it.
  - `fmtAgo` and `fmtBattery` helpers.
  - The old per-response route colours were removed.
- **`app/globals.css`, `tailwind.config.js`:** the `accent-brand` token, brand orange with a dark-mode value, for thin accents only. `font-display` and `rounded-brand` are now also used by this page.
- **`CLAUDE.md`, `docs/CLAUDE.md`:**
  - the new env var, marked public by design;
  - a note that the landing look is a pilot and not to copy it to other pages yet;
  - Employee Map notes.

### Not changed
- Who sees the page: admins, and supervisors for their team. Only the Live tab is admin-only.
- Other dashboard pages, and the shared Card and Button components.
- No "Locate now" button yet (server and mobile come later).

### To test
1. As an admin: three tabs. As a supervisor: no Live tab.
2. In DevTools → Network, each tab calls only its own endpoint, and changing filters reloads only the open tab.
3. One person has the same colour on every tab. Clock-out pins have a white ring. The heat map toggle works.
4. Routes: punch pins and pin-to-route links show, plus work-site circles. Low-accuracy points are lighter. Battery shows as %.
5. Live:
   - refreshes every 60 s, pauses when the browser tab is hidden, and stops when you leave the tab;
   - "Seen X min ago" counts up;
   - someone who clocks out disappears at the next refresh;
   - the tracking-off notice shows when tracking is off.
6. Street, Light and Satellite all load, and the choice is remembered after a reload. The console shows no errors.
7. Light and dark mode both look right.

---

## BB-145 follow-up — Landing: Location punch slide

**Status:** Built. Carlo picked the screenshots on 2026-11-25.

**Why:** the slide showed the old Punch page. The Employee Map shows better where punches happen.

### Changes
- **`content.js`** (Location punch entry):
  - web only; the phone screenshot is removed for now;
  - new text: "Restrict or record punches by GPS location, and see on a map where every clock-in and clock-out happened.";
  - caption: "Employee Map on the web, in Street and Satellite views".
- **`HeroRail.jsx`:** a new `InsetFrame`, a smaller browser window in front of the main one. It only shows for slides that define an inset. The main window is slightly narrower then.
- **Images:**
  - `public/landing/employee-map-v3.png`: Street view, test account, employee ID and role blurred.
  - `public/landing/employee-map-satellite.png`: the same spot in Satellite view, cropped to the map.

### Not changed
- The other slides, and `phone-online.png` (the Time keeping slide still uses it).

### To test
1. The Location punch slide shows the Street map with the Satellite window in front, on desktop and on mobile.
2. The caption ends with "Demo data".

---

## Open items
- Server: deploy the BB-128 map-views release before this one, then fill in its version here. The old `GET /api/employee-map` can be retired after.
- Esri key expires around 2/23/2027 (or the date you set when extending it). Renew it before then, or Light and Satellite stop loading.
- Optional: fall back to Street automatically when Esri tiles fail.
- The landing look is a pilot on the Employee Map. Rolling it out to other pages would be a separate ticket.
- Unused, not committed: `public/landing/employee-map.png` and `employee-map-street.png`. Delete them if not needed.
- Mobile: no change.
