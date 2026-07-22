# Changelog — v2.14.11

BB-052 feature: Calendar view on the Leave Requests page can now generate a PDF, rendered as an actual month-grid calendar (not a table), with a status filter and colored per-employee day chips.

Unticketed fix: leave submission 500'd whenever the request range included a no-shift day, because the affected-shifts list sent a `null` entry the server's `id: { in: [...] }` query couldn't handle.

---

## BB-052 — Leave Calendar PDF Export

**Status:** Feature applied (client only) — pending manual verification, not yet confirmed closed.

**Page:** `/dashboard/company/leave-requests` (Calendar view)

**Files:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx`, `lib/exports/leaveCalendar.js` (new)

**Ask:** Table view already had a "Generate PDF" button exporting whatever the table's current filters showed, via `lib/exports/leaveRequests.js`. Calendar view had no export at all. The ask was to add the same capability to Calendar view, scoped to the month currently displayed, with a prompt to choose which statuses to include — and, after an initial pass that just reused the Table view's tabular PDF, clarified that the calendar export should actually look like a calendar (a month grid with day cells, employee names inside, colored by status), not a list.

**Fix:**
- Added a "Generate PDF" button next to "Today" in the Calendar view's card header (shadcn `Button` + `Download`/`Loader2` icons — matches the existing "Today" button's styling, not the Table toolbar's raw inline-style pattern).
- Added a status-filter dialog with 4 checkboxes — Pending (merges `pending` and `pending_secondary`, since those are just the first/second step of the same not-yet-decided state), Approved, Rejected, Cancelled — all checked by default, confirm button disabled if none are checked.
- Added a `calendarMonthLeaves` memo: leaves whose `[startDate, endDate]` span overlaps the month currently shown (an overlap check, not "starts in this month," so a leave crossing a month boundary still counts for both).
- New `lib/exports/leaveCalendar.js` → `exportLeaveCalendarPDF({ data, month, user, filename })`: a hand-drawn (not `autoTable`) landscape PDF — branded header/footer matching the existing report style, a condensed "REPORT INFORMATION" box, a 4-item color legend, then a 7-column day grid sized dynamically to however many weeks the month needs (4–6 rows). Each day cell shows the day number plus a colored chip per employee on leave that day ("First L.", colored by status), capped to however many fit before switching to "+N more".
- No changes to the existing `lib/exports/leaveRequests.js` or the Table view's PDF button/handler — confirmed working as-is and explicitly left alone.
- No server-repo impact — `GET /api/leaves` already returns full company leave history client-side (calendar month navigation just re-filters the same in-memory array), so no new endpoint or payload shape was needed.

**Follow-up refinements (same session, post-review, BB-050):**
- **Two-column day-cell chip grid** — a day with 3+ people on leave was hitting "+N more" too early with the original single-column stack. `leaveCalendar.js`'s chip-drawing block now lays out chips in a grid (`numCols = entries.length < 3 ? 1 : 2`, fills left-to-right then top-to-bottom) — under 3 entries keeps the original full-width single column (reads better with little content), 3+ switches to two narrower columns to roughly double how many names fit before falling back to "+N more".
- Added a `fitText()` helper (measures with `doc.getTextWidth`, truncates with an ellipsis) for the two-column chips, since the narrower ~16-17mm columns can't reliably rely on the previous character-count-based abbreviation alone.
- **Submission-order sorting** — leave entries within a day (both the live Calendar view's day panel and the PDF chips) are now ordered by `createdAt` ascending, so whoever submitted first appears first, consistently in both places. `leavesByDate` and `calendarMonthLeaves` (`EmployeesLeaveRequests.jsx`) now sort by `createdAt` before bucketing/filtering; `leaveCalendar.js`'s `buildDayMap` just preserves whatever order it's given, so no separate ordering logic was needed there.

### Files Changed

| File | Changes |
|---|---|
| `lib/exports/leaveCalendar.js` | New file. `exportLeaveCalendarPDF` — draws a month-grid PDF (header/footer/legend/day grid with per-employee status-colored chips) instead of reusing the Table view's `autoTable`-based report. Follow-up: two-column chip grid for 3+ entries per day (single column under 3), `fitText()` ellipsis-truncation helper, `buildDayMap` documented as submission-order-dependent on its caller. |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx` | Added `calendarPdfDialog`/`generatingCalendarPdf` state, `calendarMonthLeaves` memo, `handleGenerateCalendarPdf` handler, a "Generate PDF" button in the Calendar card header, and a status-filter `Dialog` (Pending/Approved/Rejected/Cancelled checkboxes). Follow-up: `leavesByDate` and `calendarMonthLeaves` now sort by `createdAt` ascending (submission-order-first, feeds both the Calendar day panel and the PDF export). |

---

## Unticketed — Leave submission 500 on `affectedShiftIds: [null]`

**Status:** Fix applied (client only) — pending manual verification, not yet confirmed closed.

**Page:** `/dashboard/employee/leave-logs` (leave request submission form)

**Files:** `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx`

**Bug:** Submitting a leave request whose date range included at least one day with no shift plotted returned a generic 500 on `POST /api/leaves/submit`. Traced (with the server side confirming independently) to `affectedShiftIds` containing a `null` entry — the server's `prisma.userShift.findMany({ where: { id: { in: affectedShiftIds } } })` (`leaveController.js:222`) throws a `PrismaClientValidationError` on a non-string array entry.

**Root cause:** `GET /api/leaves/affected-schedules` returns one entry per day in the requested range — real plotted shifts get a real `userShiftId`, but days with nothing plotted get a fallback entry with `userShiftId: null` (`isFallback: true`, by design, per BB-048). `LeaveLogs.jsx`'s `affectedShiftIds` memo mapped over *every* entry, real and fallback alike, so any request touching a no-shift day put a `null` into the array sent to the server.

**Fix:**
- `affectedShiftIds` now filters to entries with a real `userShiftId` before mapping, dropping fallback/no-shift-day entries.
- The submit payload only includes `affectedShiftIds` when the filtered array is non-empty; omitted entirely otherwise, matching the server-side suggestion.
- No server-repo changes — the server's fallback-entry behavior (`userShiftId: null` for no-shift days) is correct per BB-048's design; this was purely a client filtering gap.

### Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx` | `affectedShiftIds` memo now filters out fallback entries (`userShiftId` falsy) before mapping; `handleSubmit`'s request body only spreads in `affectedShiftIds` when it has at least one real ID. |
