# Changelog — v2.18.2

BB-153 (Employee Map route replay): on the **Routes** tab, a ▶ button replays a route.
- **One person:** speed 30× / 60× / 120×, "Skip stops", and a pick of which shift.
- **Everyone:** every route on one shared clock.
- **Follow** keeps the moving pins in view.

BB-151 follow-up (Settings History):
- The page is redesigned as an audit log, with stats, Today / 7 days / All time, Who chips, saves grouped by day, and "Current" / "Changed back" badges. It follows light/dark.
- Support saves show as **"B. Buddy (123)"**.

BB-149 follow-up (cutoff list):
- **Reopen** a processed cutoff never showed for anyone (role bug). It now shows for admins.
- Cutoff status history names support as "B. Buddy (123)".

No browser pop-ups:
- Cutoff delete and company delete use in-app dialogs instead of "localhost says…".
- The paycheck Print/Download placeholders are removed, and the screenshot error shows on the button.
- The rule is added to CLAUDE.md.

**Server:** no new endpoints. The "B. Buddy (123)" names need the server's BB-151 follow-up (support names on settings history and on cutoff `lastReopen` / `statusHistory`). Its number is set at the server push. **Before it ships**, support rows show plain "B. Buddy". Everything else works on the current server.

**Not in this release:** the BB-121 Calendar cutoff pages (review, switcher, Sync panel, list search). They stay uncommitted until Carlo finishes testing.

---

## BB-153 — Employee Map route replay

**Status:** Built 2026-11-28. Carlo tried the one-person replay and liked it. Follow and Everyone are untested.

**Why:** a route line shows where someone went, but not in what order or how long they stayed. A replay makes the movement visible.

### Server contract used
- None new. `GET /api/employee-map/routes` already sends every track point with its time (`at`), in time order.

### Changes
- **`employeeMapRoutes.js`:**
  - `buildPlayback` / `playbackAt`: one track's replay timeline. With Skip stops, a stop (the same `findStops` rule as "stayed") or a gap over 15 min plays in 90 real seconds.
  - `realPosAt`: a position on the shared real clock (Everyone).
- **`EmployeeMapCanvas.jsx`:**
  - `PlaybackLayer`: routes fade to 25% while replaying; each person's trail is drawn in full colour behind a moving initials pin. In Everyone mode, ended people stay, faded.
  - `FollowPins`: pans (one pin) or refits (several) only when a pin nears the edge. Dragging the map turns Follow off.
- **`EmployeeMap.jsx`:** the controls under the map on the Routes tab:
  - ▶ / ⏸ (orange), back to start, a time slider with the company-zone clock;
  - **One person** (employee picked): 30× / 60× / 120×, default 60×; Skip stops (default on); a shift picker when there are several routes; "Stayed 45 min here (fast-forwarded)" while passing a stop;
  - **Everyone** (All employees, 2+ routes): 120× / 300× / 600×, default 300×, real time, no skipping;
  - Follow (default on);
  - "Not enough route points to replay" when a route has fewer than two usable points.

### Not changed
- Clock-in/out and Live tabs; no extra requests.

### To test
1. Routes, one employee: ▶ plays; the pin moves, the trail draws, the clock runs; the slider jumps; speeds work; Skip stops fast-forwards stays.
2. Zoom in and play: the map follows the pin. Drag the map: Follow turns off.
3. Routes, All employees with 2+ routes: everyone moves on one clock; people appear when their route starts and stay faded at the end.
4. A date range with several shifts for one person: the picker switches the replayed shift.

---

## BB-151 follow-up — Settings History redesign + support names

**Status:** Built 2026-11-27, untested by Carlo except the Refresh button and the light/dark switch.

**Why:** Carlo's audit-log design. Support saves now carry the staff member's short code.

### Server contract used
- `GET /api/company-settings/history?from&limit&cursor`, unchanged. The page now sends `from` for Today / 7 days.
- Support rows: `by.name` = "B. Buddy (123)" (older rows: "B. Buddy") plus `supportCode`, from the server's BB-151 follow-up.
- The server doesn't write history in `NODE_ENV=development`, so the page is empty on a local server by design.

### Changes (`SettingsHistory.jsx`)
- **Header:** "AUDIT LOG" title, "Times in <company zone>" (always the company zone, no zone switcher), and an orange Refresh button with dark text.
- **Stats:** Changes ("in N saves"), Settings touched, People ("1 admin · 1 support"), Changed back ("reverted within an hour"). They count what's shown.
- **Toolbar:** search a setting or person; Today / 7 days / All time (sent as `from`); Who chips (Everyone plus each person).
- **Rows:**
  - saves grouped by day ("Thu, Nov 26, 2026 · Today · 4 saves");
  - time with "28 min ago"; who with an initials square (orange for support) and their role or "Support";
  - the setting(s) and page; old value struck through → new value (On orange, Off black);
  - ▾ details: exact time, field key, full values.
- **Badges:** **Current** (the newest change of that setting) and **Changed back N min later** (put back within an hour).
- Header and stats follow light/dark.
- Footer: count, Load more, and the badge legend.
- No CSV export (Carlo).

### Not changed
- Admin-only access and the redirect for everyone else.

### To test
1. On a production-mode server: rows appear grouped by day, with badges right after a change and its reversal.
2. Today / 7 days / All time narrow the list; search and Who chips filter it.
3. A save made as B. Buddy shows "B. Buddy (123)" with "Support".
4. Light and dark mode both look right.

---

## BB-149 follow-up — Reopen for admins, support names, delete dialog

**Status:** Built 2026-11-27, untested.

**Why:**
- `canReopen` read `role` from `useAuthStore`, which has no role. So **Reopen never appeared for anyone**, on both cutoff list pages, since the BB-149 follow-up (v2.17.3).

### Changes (`cutoffPeriodsShared.jsx`)
- `canReopen` uses `useAccountRole()` (role from `/api/account/profile`), so admins and superadmins see Reopen again in the ⋮ menu of a processed cutoff.
- The Reopen logic and dialog moved into `useReopenCutoff` / `ReopenCutoffDialog`. The list pages work as before.
- `actorLabel` shows the server's support name ("B. Buddy (123)") in the "Reopened ×N" tooltip and the cutoff History list.
- **Delete cutoff** opens an in-app "Delete this cutoff?" dialog (department and dates, Cancel / red Delete cutoff, spinner) instead of the browser's `confirm()`.

### Not changed
- The cutoff pages themselves (List Type and Calendar Type). The BB-121 Calendar work is not in this release.

### To test
1. As an admin, a processed cutoff's ⋮ shows **Reopen Period**; reopening asks for a reason and the row shows "Reopened ×1".
2. As a supervisor, no Reopen.
3. ⋮ → Delete shows the in-app dialog; Cancel keeps the cutoff, Delete removes it.

---

## No browser pop-ups

**Status:** Built 2026-11-27, untested.

**Why:** native `confirm()` / `alert()` show "localhost:3000 says…", can't be styled and block the page (Carlo).

### Changes
- **CLAUDE.md:** new rule, never `window.confirm/alert/prompt`. Use in-app dialogs (`components/ui/dialog.jsx`) and Sonner toasts.
- **`Settings/CompanyProfile.jsx`:** Delete Company (superadmin) opens a "Delete the company?" dialog: Cancel / red Delete company, can't close mid-delete.
- **`payroll/ViewPaychecksModal.jsx`:** the Print / Download buttons that only ran `alert()` are removed. The file isn't imported anywhere.
- **`system-admin/ScreenshotButton.jsx`:** a failed capture turns the button red with "Failed · try again" for 4 s, instead of `alert()`. Not every system-admin page shows toasts.
- **Cutoff delete:** see BB-149 follow-up.

### To test
1. Delete Company as a superadmin: the in-app dialog appears; Cancel closes it.
2. A failed screenshot shows the red button state.

---

## Open items
- **Server:** the BB-151 follow-up support names (settings history and cutoff status events). Until deployed, support shows as plain "B. Buddy".
- **BB-121 Calendar cutoff pages:** uncommitted, in testing. The next release carries them with the server's BB-121 work: glossary approval rules, Sync job, `availableShifts`, shift zones, OT blocks for every company, and `add-approval-mode-shift-bb121.sql`.
- **Not committed**, local only:
  - the cutoff design files (`docs/BizBuddy-cutoff-review.html`, the two "Cutoff review" PNGs) and the BB-121 / BB-149 / OT server-request docs;
  - the older `docs/server-request-BB-126/128/135-*.md`, `docs/mobile-handover-BB-143.md`, the landing PDF and zip, and `public/landing/employee-map*.png`.
