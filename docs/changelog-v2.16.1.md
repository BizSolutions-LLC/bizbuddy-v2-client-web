# Changelog — v2.16.1

BB-124: **A leave request can't overlap time already punched.** Follow-up to Josie Soriano (Nov 9), who clocked in at 6:51 AM and then filed a full-day Sick Leave for the same morning. Payroll counted both. The server now refuses such a request, and the client shows why. The leave form warns before submit and lists the overlapping days when the server refuses. The form stays open so the employee can fix it. The approve dialog warns the approver but still allows approval. Times show in the day's own zone ("Manila time"), including the shift times on the leave form's "Shifts that will be on leave" card.

**Needs the server release that carries BB-124 (after v2.11.17; number to confirm).** Every field the client reads is additive. Against an older server, the warnings don't show and the shift card keeps today's times, and nothing breaks. The shift-card times also need the server change in `docs/server-request-BB-124-shift-local-times.md`.

**Mobile:** the mobile app's leave form gets the same `409 LEAVE_OVERLAPS_PUNCH` refusal. It should show `message` and keep the form open.

---

## BB-124 — Leave request vs. an existing punch

**Status:** Built (client), not tested yet. Server side built 2026-11-23, uncommitted, awaiting test.

**Why:** the server accepted a leave covering time the employee had already punched, so payroll counted the punch and the leave for the same hours.

**Server contract used** (from the server's BB-124 client update; all the overlap logic is on the server):
- Every overlap entry: `date`, `timeLogId`, `punchIn` / `punchOut`, `stillClockedIn`, `leaveFrom` / `leaveTo`, `timeZone`, `zoneLabel`, and display-ready `punchInLocal` / `punchOutLocal` / `leaveFromLocal` / `leaveToLocal`. The `*Local` strings are in `timeZone`: the shift's zone on a shift day, otherwise the company zone.
- `POST /api/leaves/submit`: new **409** `{ code: "LEAVE_OVERLAPS_PUNCH", message, conflicts: [...] }`.
- `GET /api/leaves/affected-schedules`: new `punchOverlaps` next to `data` (a preview; it doesn't know which shifts are unticked).
- `GET /api/leaves/:id/preview`: new `data.punchOverlaps`.
- `PUT /api/leaves/:id/approve` (final approval): new top-level `punchOverlaps`. Escalations don't include it.
- **Requested** (`docs/server-request-BB-124-shift-local-times.md`): each real-shift row in `affected-schedules` gets `timeZone`, `zoneLabel`, `startTimeLocal`, `endTimeLocal`.

### Changes
**`EmployeePanel/Leaves/LeaveLogs.jsx` (employee leave form)**
- **Warning before submit:** the overlap preview shows as an amber list under "Affected schedules", one line per day. Example: "Fri, Nov 20 — you punched 7:36 AM – 5:38 PM; this leave covers 8:00 AM – 5:00 PM (Manila time)". A note says unticking a shift may clear it and that submit does the final check. **Submit stays enabled.**
- **Refusal on submit:** the server's `message` shows as a toast, the form stays open, and the list switches to the refused days. The list clears as soon as the dates, times, weekend setting or shift ticks change. Other submit errors behave as before.
- **Shift card times:** the times use the server's `startTimeLocal` / `endTimeLocal` plus `(zoneLabel time)` when present. Otherwise they keep today's browser-local times.
- **Times are never converted on the client.** The date is dropped from a time only when it matches the day.

**`CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx` (approver)**
- **Approve dialog:** a "Punch Overlap" section when the preview has overlaps, with one line per day, the zone, and "You can still approve". It shows whether the leave is paid or unpaid, and the Approve button is unchanged.
- **After final approval:** if the response carries `punchOverlaps`, a warning toast ("Leave request approved", with the days) replaces the success toast.

### Not changed
- The front-end duplicate-request check, the hours and pay math, and the balance preview.
- The rest of `LeaveLogs.jsx` still uses inline styles with hardcoded colours (known drift, not in scope). The new parts use Tailwind classes.

**To test:**
1. **Clocked in:** clock in, then file a leave covering now → the amber preview warning shows. Submit → toast with the server message, the refused days listed, and the form stays open.
2. **Fix by times:** on a no-shift day, move From/To outside the punch → the warning clears and submit succeeds.
3. **Fix by unticking:** on a day with 2+ shifts, untick the overlapping shift → submit succeeds even though the preview warned.
4. **Approver:** open a pending leave that overlaps a punch → the Punch Overlap section shows. Approve still works, and the final approval shows the warning toast.
5. **Zone:** at BizSolutions LLC (company Los Angeles, shifts Manila), the lines say "(Manila time)" and the dates match the leave day. Once the server request ships, the shift card shows the Manila times too.
6. **Older server:** no warnings, and the shift card is unchanged.

---

## Open items
- **Server version:** confirm the server release number that carries BB-124 (after v2.11.17).
- **Server request:** `docs/server-request-BB-124-shift-local-times.md` (shift-card times in the shift's zone) is waiting for the server team.
- **Mobile:** the same 409 handling in the mobile leave form.
