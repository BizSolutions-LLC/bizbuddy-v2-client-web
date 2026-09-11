# Changelog — v2.14.25

BB-086: Redesigned the "Review Backtrack Import" preview table (Backtrack Punch Log Import modal) to match the polished table conventions used elsewhere in the app — shared Badge component, an expandable Segments row, status-based row coloring, and a fixed date-wrapping bug.

BB-088: Improved the Overview dashboard — consumed new server-provided clock-in/out patterns and hours/overtime averages on the Employee Overview page, then elevated the visual design across all three Overview role-variants (Employee/Admin/Superadmin): flattened dated gradient/drop-shadow chart styling, rebuilt the date-range picker as a two-pane Cancel/Apply-gated popover, replaced bordered KPI cards with a borderless "big number" style, added hover tooltips explaining each metric, and removed the manual role-preview switcher. Also flagged a data bug in the Admin dashboard's "Leave by Type" chart for the server side.

---

## BB-086 — Redesign Review Backtrack Import Table

**Status:** UI polish (client only).

**Page:** Employees Punch Logs (`/dashboard/company/punch-logs`) — "Import Backtrack Punch Logs" modal, review/preview step.

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/ImportBacktrackPunchLogs.jsx`

**Ask:** The "Review Backtrack Import" preview table looked dated next to the rest of the app's tables — hand-rolled `<span>` pills instead of the shared `Badge` component, a cramped 3-line Segments column, a custom bouncing scroll-FAB, and no visual hierarchy for row severity. Bring it in line with the polished table conventions already established in `EmployeesPunchLogs.jsx` (Badge component, expand/collapse row, status-based row coloring) — presentation only, no changes to matching/import logic.

**Investigation findings:**
- `EmployeesPunchLogs.jsx` already had the reference pattern for everything asked for: shadcn `Badge` for status pills, and a chevron + `framer-motion` `motion.tr`/`AnimatePresence` expand/collapse row for detail that doesn't fit in a collapsed row.
- Unlike that reference table, this modal's rows have several nested interactive controls (Include checkbox, fuzzy-match override buttons, an employee-picker `MultiSelect`) — so the expand toggle was scoped to the chevron button only, not the whole row, to avoid needing click-guards around every interactive child.

**Fix:**
- Status and employee-match pills now render through the shared `Badge` component instead of raw `<span>` elements.
- Segment detail (Reg/AM/PM target→predicted breakdown, capped-hours tooltip, warnings) moved out of a cramped inline column into an expandable row — new chevron column, same `motion.tr`/`AnimatePresence` pattern as `EmployeesPunchLogs.jsx`. Collapsed rows show a compact "Reg + AM"-style summary with a warning icon when relevant.
- Added a header "select all" checkbox in the Include column (toggles every non-error row at once).
- Full row color coding by status: green = ready to import, red = conflict/error, blue = informational (likely a leave day — no punch records for that day), amber = needs an employee match resolved before it can import. Excluded (unchecked) rows keep a muted treatment regardless of status, since they won't be imported anyway.
- Employee-match "Matched" text badge replaced with a green `CheckCircle2` icon + tooltip (exact matches don't need a full badge); fuzzy-match quick-pick chips limited to the top 2 candidates by similarity score — the full employee dropdown below is unchanged for picking anyone else.
- Date column reformatted (new `fmtRowDate` helper, e.g. "Jan 7" — no year, since every row in one review batch falls within the same reviewed period) with `whitespace-nowrap`, fixing the raw ISO date string (`2026-01-07`) wrapping across two lines inside the narrow fixed-width column.

**Bug found and fixed during iteration:** the first redesign pass replaced the table's manual `overflow-y-auto` scroll container with the shared shadcn `ScrollArea` component. It silently failed to enable scrolling — `ScrollArea`'s Radix-driven overflow auto-detection didn't reliably pick up overflow through the `Table` primitive's own internal `overflow-auto` wrapper div — and a later edit pass left a stray reference that threw `ScrollArea is not defined` once the import was removed. Reverted to a plain `max-h-96 overflow-y-auto` div, matching how this table worked originally and how other non-`ScrollArea` tables in the app already scroll reliably.

**Server-repo impact:** None — this ticket only touched table presentation in the existing `preview` step; no API contract, matching logic, or confirm/import payload changed.

**Explicitly out of scope (flagged, not actioned):** the orange brand accent bar and CTA buttons in this modal were left as-is — consistent with the app-wide orange brand convention, not modal-specific drift.

### Files Changed

| File | Changes |
|---|---|
| `.../Punchlogs&Overtimes&Leaves/ImportBacktrackPunchLogs.jsx` | Badge component for status/match pills; expandable Segments row (chevron + framer-motion); header select-all checkbox; status-based row color coding; "Matched" replaced with a check icon; fuzzy candidates limited to top 2; compact no-wrap date format. |

---

## BB-088 — Improve Overview Page

**Status:** Mixed — the clock-in/out patterns and hours/overtime averages are fully working (server field already live); the visual redesign is complete and client-only; one new field (`totals.overtimeDays`) is client-ready but **pending a server addition**; one bug (raw IDs in "Leave by Type") is flagged for the server side, not fixed.

**Pages:** Employee Overview (`/dashboard/employee/overview`, `mode === "employee"`), Admin Overview (`mode === "admin"`), Superadmin Overview (`mode === "super"`) — all three variants rendered by `Overview.jsx`.

**Files:**
- `components/Dashboard/DashboardContent/EmployeePanel/Overview/Overview.jsx`
- `components/Dashboard/DashboardContent/EmployeePanel/Overview/OverviewEmployee.jsx`
- `components/Dashboard/DashboardContent/EmployeePanel/Overview/OverviewAdmin.jsx`
- `components/Dashboard/DashboardContent/EmployeePanel/Overview/OverviewSuperadmin.jsx`
- `components/Dashboard/DashboardContent/EmployeePanel/Overview/Commons.jsx`

**Ask:** Two parts. (1) Server added `patterns.usualClockIn`/`usualClockOut` (median clock-in/out time-of-day) and `averages.hoursPerDay/Week/Month` + `averages.overtimePerDay/Week/Month` (projected rates) to `GET /api/analytics/employee` — client work was to surface these on the Employee Overview page. (2) Separately, the Overview page's tables/charts/date-picker looked dated ("2008-era" gradients and drop-shadows) compared to the rest of the app — asked to elevate the whole page's visual design, plus remove the manual Employee/Admin/Super-Admin preview-switcher (to be rebuilt elsewhere).

**Investigation findings:**
- Only `OverviewEmployee.jsx` calls `/api/analytics/employee` — `OverviewAdmin.jsx`/`OverviewSuperadmin.jsx` hit separate endpoints (`admin-dashboard`, `super-dashboard`) with their own independent (and equally dated) copies of the same date-picker/KPI-card/chart patterns, not shared components. Elevating the Employee page alone would have left the other two roles' dashboards visually inconsistent, so the same treatment was extended to all three once asked.
- The "Employee/Admin/Super-Admin" buttons in `Overview.jsx` were a manual preview-switcher for admins/superadmins to view other roles' dashboards — separate from the actual auto-detected role routing (`me.role` → default `mode`), which already existed independently. Removing the buttons only removes the manual override; every role still lands on its own correct dashboard automatically.
- The app has no existing "—" fallback convention on this specific page (Department already falls back to the string "Not assigned") — the `"—"` convention was borrowed from elsewhere in the app (`Overtime.jsx`, `contest-time-logs/page.jsx`) for the two new nullable clock-pattern fields specifically.
- `calculateTrend()` in all three Overview files was mock data (`Math.random()`), explicitly commented as such — dropped entirely across all three pages during the redesign rather than carried forward.

**Fix — new analytics fields (Employee Overview):**
- Two new stat tiles, "Usual Clock-In" / "Usual Clock-Out", reading `data.patterns?.usualClockIn/usualClockOut`, falling back to "—" when null.
- New "Averages" card showing `averages.hoursPerDay/Week/Month` and `overtimePerDay/Week/Month`, with a tooltip on the Week/Month figures clarifying they're projected rates (daily average × 7/30), not literal calendar totals.

**Fix — visual redesign (all three Overview variants):**
- **Charts (`Commons.jsx`):** removed the gradient fills and `drop-shadow`/`feGaussianBlur`/glow SVG filters from `PieSimple`, `BarSimple`, `LineSimple`, and `GroupedBarSimple` — flat solid colors now, matching the rest of the app's restrained styling. `AreaSimple`'s soft fill gradient was left as-is (a legitimate, still-modern technique, not part of the dated look).
- **Date-range picker:** rebuilt as a two-pane popover (preset list + Start/End date display + a two-month calendar) with Cancel/Apply gating changes, replacing the old single-pane preset-list-then-calendar layout, on all three pages. The calendar is always interactive — clicking a date while a preset is selected switches to "Custom Range" starting from that click.
- **Stat tiles:** replaced bordered, icon-chip KPI cards (with mock trend badges) with a borderless style — a small dotted-underline label above a large bold number, grouped inside one card per section — on all three pages.
- **Off-brand blue → orange:** standalone metric pills that used blue with no semantic meaning (Admin's "hrs tracked" chip, its Department-table avg-hours badge, Superadmin's "days ago" badge) switched to the app's orange brand color. Left blue where it's a legitimate second-series chart color (e.g. Session Status legend) and green where it's a real status semantic (Superadmin's "Platform Healthy" badge).
- **Hover tooltips:** every KPI tile on the Admin dashboard (Departments, Total Employees, Active Plan, Active Staff, Late Rate, Early Leave Rate, Reliability, Coverage Rate, Leave Approval, Hours Tracked) now shows an explanatory tooltip on hover, covering the whole tile (label + number), not just the label text. Scoped to Admin per what was asked; not yet added to Employee/Superadmin tiles.
- **Admin-selector removal (`Overview.jsx`):** removed the manual role-preview toggle buttons; the page still auto-routes to the correct dashboard for the signed-in user's actual role.

**Fix — new field, client-ready pending server (Employee Overview):**
- Added an "Overtime Days" tile reading `data.totals.overtimeDays ?? 0`, with a hover tooltip. The field does not exist server-side yet — drafted the request text for `totals.overtimeDays` (count of days with overtime in the selected period) to hand off to the server-repo work, including an explicit ask to confirm "days" vs. "separate overtime instances" as the intended granularity.

**Bug found, flagged for server (not fixed here):** Admin dashboard's "Leave by Type" chart (`OverviewAdmin.jsx`, `data.charts.leaveByType`) renders raw leave-type IDs (e.g. `cmnii9ek3008nrf4484en8eah`) as chart labels instead of readable names (e.g. "Vacation") — confirmed no client-side leave-types lookup exists anywhere in this repo to remap IDs locally, so the `leaveByType` aggregation needs to return the type's name server-side. Request text drafted and handed to the user for the server repo.

**Server-repo impact:** Two items pending on the server side — (1) `totals.overtimeDays` on `GET /api/analytics/employee` (new, additive), and (2) the `leaveByType` aggregation on `GET /api/analytics/admin-dashboard` returning names instead of IDs (bug fix). Everything else in this ticket was either already-live server data (`patterns`/`averages`) or pure client-side presentation.

**Explicitly out of scope / flagged:**
- The removed admin-selector (role-preview switcher) is not yet rebuilt anywhere — flagged as the user's own follow-up ("we will move that elsewhere").
- Hover-tooltip explanations were only added to the Admin dashboard's tiles, not Employee's or Superadmin's — can be extended if wanted.
- `StackedBarSimple` in `Commons.jsx` still has the old gradient styling but is unused by any current page — left untouched.

### Files Changed

| File | Changes |
|---|---|
| `.../Overview/Overview.jsx` | Removed the manual Employee/Admin/Super-Admin preview-switcher buttons; page still auto-routes by the signed-in user's actual role. |
| `.../Overview/OverviewEmployee.jsx` | New Usual Clock-In/Clock-Out tiles, new Averages card, new Overtime Days tile (pending server field); borderless stat-tile redesign; two-pane date-range picker; dropped mock trend badges. |
| `.../Overview/OverviewAdmin.jsx` | Borderless stat-tile redesign with hover tooltips on every tile; two-pane date-range picker; "hrs tracked"/avg-hours badges switched from blue to orange; dropped mock trend badges. |
| `.../Overview/OverviewSuperadmin.jsx` | Borderless stat-tile redesign; two-pane date-range picker; "days ago" badge switched from blue to orange; dropped mock trend badges. |
| `.../Overview/Commons.jsx` | Flattened `PieSimple`, `BarSimple`, `LineSimple`, `GroupedBarSimple` — removed gradient fills and drop-shadow/glow SVG filters. |
