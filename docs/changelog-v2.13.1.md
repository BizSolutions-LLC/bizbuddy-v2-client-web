# Changelog — v2.13.1

Bug fixes and UX improvements across CutoffReview and the Employer Punch Logs export.

---

## Change 1 — CutoffReview: OT Block Rows Not Rendering for B&C Companies

**Status:** Shipped (client only).

**Problem:** OT block rows were never injected into the employee timeline for B&C companies, even though the API was returning a populated `otBlocks` array and the `OTBlockRow` component was fully implemented.

**Root cause:** `otBlockByDate` in `EmployeeCard` was keyed by formatting `block.date` via `new Date(block.date)`. Since `block.date` is a date-only string (e.g. `"2026-04-22"`), JavaScript parses it as **UTC midnight**. For companies in US timezones (UTC-4 to UTC-8), UTC midnight is still the previous calendar day locally — so the map key became `"Apr 21"` instead of `"Apr 22"`. Meanwhile `recDate` was derived from `tl.timeIn` (a full ISO timestamp) correctly formatted in company timezone as `"Apr 22"`. The keys never matched, so `otBlockByDate[recDate]` always returned `undefined`.

**Fix:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx` — `EmployeeCard` → `otBlockByDate` useMemo.

- Parse `block.date` using UTC **noon** (`Date.UTC(y, m-1, d, 12)`) instead of `new Date(block.date)` (UTC midnight). Noon UTC is safe for all real-world timezones (UTC-11 to UTC+11) — it will not roll back across midnight when formatted in company timezone.
- Same pattern already used by `enumeratePeriodDays` in this file.

```js
// Before
const formatted = new Date(block.date).toLocaleDateString("en-US", {
  month: "short", day: "numeric", timeZone: companyTimezone || "UTC"
});

// After
const [y, m, d] = block.date.slice(0, 10).split("-").map(Number);
const safeDate  = new Date(Date.UTC(y, m - 1, d, 12));
const formatted = safeDate.toLocaleDateString("en-US", {
  month: "short", day: "numeric", timeZone: companyTimezone || "UTC"
});
```

---

## Change 2 — CutoffReview: Approve Schedule Always Opens Shift Picker Modal

**Status:** Shipped (client only).

**Problem:** When an employee had exactly one shift assigned for a punch date, clicking "Schedule" would silently auto-approve directly against that shift without showing the picker modal. Admins had no chance to confirm their selection.

**Fix:** `CutoffReview.jsx` — `handleApproveSchedule`.

- Removed the `shifts.length === 1` fast-path that called `doApprove` directly.
- The picker modal now always opens when `availableShifts.length >= 1`, showing the single shift as a selectable card for explicit confirmation.
- `shifts.length === 0` still fires the warning toast ("No shift assigned for this date — use Approve Raw Time instead.") with no modal.

---

## Change 3 — CutoffReview: Approved Times Update After Approval

**Status:** Shipped (client only).

**Problem:** After approving a punch (especially via "Approve Schedule" which snaps clock-in/out to the shift), the displayed `In → Out` times on the row retained the original raw punch times until a full page reload. The optimistic `localStatus` locked the row immediately, but the visible times never reflected the server's `approvedClockIn` / `approvedClockOut`.

**Root cause:** `doApprove` was ignoring the PATCH response body entirely — it called `if (!res.ok) throw new Error()` and never read `res.json()`. The `detail` HTML string baked into each record at initial load (`buildDetails`) was never updated.

**Fix:** `CutoffReview.jsx`.

- Added `localApprovedTimes` state: `{ [recId]: { timeIn, timeOut } }`.
- `doApprove` now reads `res.json()` after a successful PATCH. If `data.data.approvedClockIn` or `data.data.approvedClockOut` is present, formats them via `formatDateTime(value, companyTimezone)` and stores them in `localApprovedTimes`.
- On failure, `localApprovedTimes[recId]` is rolled back alongside `localStatus`.
- `patchTimes()` helper in `mergedEmployees` overlays the stored times onto each record (regular rows, punch group sub-rows, driver segment rows) and **rebuilds `rec.detail`** as the updated `In → Out` HTML string — since `detail` is what `dangerouslySetInnerHTML` actually renders.
- `localApprovedTimes` added to the `mergedEmployees` useMemo dependency array.
- `companyTimezone` added to `doApprove` useCallback dependency array.

**PATCH response shape consumed:**
```json
{
  "data": {
    "approvedClockIn":  "2026-04-22T12:00:00.000Z",
    "approvedClockOut": "2026-04-22T15:00:00.000Z"
  }
}
```

---

## Change 4 — CutoffReview: "Confirming…" Spinner in Detail Cell While Approval is In-Flight

**Status:** Shipped (client only).

**Problem:** With Change 3 in place, there was a visible gap between modal close and the PATCH response arriving (2–3 seconds). During this window the detail cell showed the old raw times, which then suddenly swapped to the approved times — jarring for the user.

**Fix:** `CutoffReview.jsx`.

- Added `approvingIds` state: a `Set` of `recId`s currently being PATCH'd.
- `doApprove` adds `recId` to `approvingIds` immediately (before the fetch) and removes it on both success and failure.
- `patchTimes()` in `mergedEmployees` stamps `isApproving: approvingIds.has(rec.id)` onto each record.
- `approvingIds` added to the `mergedEmployees` useMemo dependency array.
- `TimelineRow`, `PunchSubRow`, and `DriverSegmentRow` each replace the `dangerouslySetInnerHTML` detail `<div>` with a conditional: when `isApproving`, render a `<Loader2 animate-spin />` "Confirming…" line instead.
- **Actions cell is untouched** — "Approved" badge and "Reset" button appear immediately via the existing optimistic `localStatus` lock, with no loading state applied to them.

**UX flow after fix:**
1. Admin selects shift in picker → modal closes
2. Detail cell immediately shows **"Confirming…"** spinner; "Approved" + "Reset" appear in actions cell
3. PATCH response arrives → spinner clears, correct approved times render

---

---

## Change 5 — Employer Punch Logs: BNC Daily OT Column in Exports

**Status:** Shipped (client + server).

**Problem:** When generating a CSV or PDF report from the employer punch logs page for B&C companies, approved overtime (OT) blocks were absent entirely. BNC OT is a day-level aggregate (e.g. "4h over 8h daily threshold") — not per-punch — so it never appeared on individual punch rows, and there was no mechanism to surface it in the export.

**Root cause (data):** `GET /api/timelogs` had no concept of OT blocks. They were only available from `GET /api/cutoff-periods/:cutoffId/approvals`, which is scoped to a specific cutoff period. The punch logs page is date-range filtered with no cutoff period context.

**Server change:** `GET /api/timelogs` now returns two new fields in the response envelope for BNC companies:
- `otBlocks: CutoffOtBlock[]` — all OT blocks for the queried date range (all statuses; client filters to `"approved"`)
- `dailyOtThresholdHours: number` — company-wide daily OT threshold (e.g. `8`)

Both fields are absent (not `null`, not `[]`) for non-BNC companies.

**Client changes:**

`EmployeesPunchLogs.jsx`:
- Added `bncOtBlocks` and `bncDailyOtThreshold` state.
- Reads `tlJ.otBlocks` and `tlJ.dailyOtThresholdHours` from the timelogs response on every fetch.
- Passes both to `exportEmployeePunchLogsCSV` and `exportEmployeePunchLogsPDF`.

`lib/exports/employeePunchLogs.js` (both CSV and PDF functions):
- Accepts new `bncOtBlocks` and `bncDailyOtThreshold` params.
- Builds an `approvedOtByKey` map keyed by `"userId|YYYY-MM-DD"` from approved blocks only.
- Summary stats (`totalOvertimeHours`, per-employee OT totals) now include approved OT block hours for BNC.
- Adds a dedicated **`"OT (Daily)"`** column to the export — BNC-only, appended alongside the existing `lunchStart`/`lunchEnd` columns.

**CSV behaviour:** First punch row for each employee+date shows the approved OT hours (`"4.00 hrs"`); subsequent punch rows for the same day show `"—"`.

**PDF behaviour:** First punch row for each employee+date renders the OT cell with `rowSpan: N` (spanning all punches for that day), styled purple + bold + vertically centered. Subsequent punch rows omit the OT cell so autotable treats it as covered by the span.

**DAYCARE companies:** Completely unaffected. The `"ot"` column for DAYCARE remains per-punch (from `visibleColumns`) and uses its existing path. The new BNC column only activates when `!isDayCare`.

**OT block shape consumed from API:**
```json
{
  "id": "...",
  "userId": "...",
  "date": "2026-04-24",
  "otHours": 4,
  "status": "approved",
  "approvedAt": "2026-04-25T10:00:00.000Z",
  "notes": null
}
```

---

## Change 6 — Employer Punch Logs: Cutoff Period Dropdown for Date Range

**Status:** Shipped (client only).

**Problem:** Admins running payroll reports had to manually look up and type the start/end dates for each cutoff period. No shortcut existed to jump directly to a cutoff's date range.

**Fix:** `EmployeesPunchLogs.jsx`.

- Added `cutoffPeriods` and `selectedCutoffId` state.
- `fetchCutoffPeriods` — new `useCallback` that calls `GET /api/cutoff-periods` on mount (alongside existing bootstrap). Sorts periods newest-first.
- `handleCutoffSelect(value)` — when a period is selected, sets both `pendingDates` and `filters.from`/`filters.to` immediately (no need to click Apply separately).
- A **"Cutoff Period"** `<Select>` dropdown is rendered on the Date Range filter row, left of the "From:" input, only when cutoff periods exist. Default option: "Custom range".
- Dropdown labels: `"Apr 20 – May 3 (open)"` format — uses UTC noon to avoid timezone roll-back on date-only ISO strings.
- Manually editing the From/To inputs resets the dropdown to "Custom range".
- "Clear All Filters" also resets the dropdown to "Custom range".

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | OT block date key fix; shift picker always opens; `localApprovedTimes` state + PATCH response read + `patchTimes` helper; `approvingIds` state + detail cell spinner |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | `bncOtBlocks` + `bncDailyOtThreshold` state; reads from timelogs response; passes to both export functions; cutoff period dropdown for date range preset |
| `lib/exports/employeePunchLogs.js` | BNC `"OT (Daily)"` column in CSV + PDF; rowspan merge in PDF; summary stats include approved OT block hours; DAYCARE paths unchanged |
