# Changelog — v2.14.29

BB-087 (Part 2): The Yearly Total Hours Report download now opens a full dialog (styled like "Generate Report") where admins can group the report by month, quarter, or whole year, pick which months/quarters to include, and optionally add Driver, Regular, OT, and Average-per-cutoff columns. Cutoffs now count in the month their end date falls in.

---

## BB-087 (Part 2) — Yearly Total Hours Report: Grouping, Period & Column Options

**Status:** Client-ready; depends on the companion server-repo Part 2 changes (including `groupBy=year`) being committed and deployed — as of this release they exist only in the server's local working tree.

**Page:** Employees Punch Logs (`/dashboard/company/punch-logs`)

**Files:**
- `lib/yearlyHoursReportActions.js`
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/YearlyTotalHoursReportTrigger.jsx`

**Ask:** The server now buckets each cutoff by its end date (Jun 10–23 → June, Jun 24–Jul 7 → July; quarters follow from that month) and accepts new query params on `GET /api/reports/yearly-total-hours/:companyId`:

| Param | Values | Default |
|---|---|---|
| `year` | e.g. `2026` | current year |
| `groupBy` | `month` \| `quarter` \| `year` | `month` |
| `periods` | `Jan,Feb,...` or `Q1,Q2,...` | all for the chosen grouping; ignored for `year` |
| `columns` | any of `driver,regular,ot,average` | none (Total only); `ot` ignored for `year` |

The client modal needed a year picker, a Monthly/Quarterly/Yearly toggle that swaps the period checkboxes (and resets them to all selected; hidden for Yearly), and Driver/Regular/OT/Average options off by default (OT hidden for Yearly). `periods` is omitted when all are selected or for Yearly; `columns` is omitted when none are selected. Yearly counts every cutoff ending in that year (Dec 24–Jan 6 counts toward the following year), and only processed/exported cutoffs count.

**Investigation findings:**
- The existing Part 1 trigger was a small `Popover` with a year `Select` only — too small for 12 month toggles plus column options. Rebuilt as a `Dialog` mirroring `GenerateReportModal` in `EmployeesPunchLogs.jsx` (same shell, section headers, orange pill toggles, footer).
- `components/ui/` has no radio-group primitive and `@radix-ui/react-radio-group` isn't installed — the Monthly/Quarterly/Yearly choice uses three existing `Button`s as a segmented toggle instead of adding a dependency.
- The server note about reading the 400 message out of a blob applies to axios `responseType: 'blob'`. This repo's helper uses `fetch`, which already parses the JSON error body via `response.json()` on non-2xx — server validation messages surface in the error toast with no extra handling.

**Fix:**
- `lib/yearlyHoursReportActions.js` — `downloadYearlyTotalHoursReport()` accepts `groupBy`, `periods` (array), and `columns` (array); sets `groupBy`, and sends `periods` / `columns` as comma-joined params only when non-empty.
- `YearlyTotalHoursReportTrigger.jsx` — `Popover` replaced with a `Dialog`: Year select, Monthly/Quarterly/Yearly segmented toggle (switching resets the period pills to all selected), month (4×3 grid) or quarter pills with All · None links (section hidden for Yearly), and Extra Columns pills (all off by default, with a note that Total Hrs is always included; OT pill hidden for Yearly and dropped from the selection when switching to it). Download is disabled when no month/quarter is selected (not applicable to Yearly). `periods` is omitted when all are selected (server default) or for Yearly. Footer hint covers the end-date rule, the year-boundary case, and that only processed/exported cutoffs count. State resets to defaults (current year, Monthly, all months, no extras) each time the dialog opens. Selected periods/columns are sent in canonical order regardless of click order. Fallback filename gets a `_Quarterly` / `_Yearly` suffix (server `Content-Disposition` still takes precedence).
- `EmployeesPunchLogs.jsx` — unchanged; the trigger keeps the same props and toolbar position.

**Server-repo impact:** Server Part 2 (end-date bucketing, `groupBy=month|quarter|year`/`periods`/`columns` params, 400 validation, XLSX column/title changes) must be deployed in `bizbuddy-v2-server`. Against an older server the new params are ignored and the old report layout is returned; against a server without `year` support, Yearly returns a 400 shown in the error toast. If the API is cross-origin, the server's CORS config must expose `Content-Disposition` for the server filename to be used (otherwise the client fallback name applies).

**Pending with server:** "Cutoffs Included" footer row (distinct cutoffs per month/quarter under the table) — requested, not yet in the server spec; no client change needed when it lands.

**Explicitly out of scope:** Middle initial in names ("LastName, FirstName M.") — there is no middle-name field in the data; needs its own ticket (server-side schema/data first).

### Files Changed

| File | Changes |
|---|---|
| `lib/yearlyHoursReportActions.js` | Added `groupBy`, `periods`, `columns` query params. |
| `.../Punchlogs&Overtimes&Leaves/YearlyTotalHoursReportTrigger.jsx` | Popover → Dialog matching Generate Report; Monthly/Quarterly/Yearly toggle, period pills (hidden for Yearly), extra-column pills (OT hidden for Yearly), end-date rule hint. |
