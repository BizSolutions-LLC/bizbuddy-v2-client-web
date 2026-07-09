# Client-Side Changelog — v2.12.2

Patch release. Admin punch log table (`EmployeesPunchLogs.jsx`) aligned to the new Time Log API data contract. No changes to `PunchLogs.jsx` (employee self-service view).

**Requires server:** `companyType` field in `GET /api/timelogs` and `GET /api/timelogs/user` response envelopes, plus `userShift`, `userShifts`, `undertimeHours` fields per row.

---

## Change 1 — Replace `DAYCARE_COMPANY_IDS` env-var with server-side `companyType`

**Status:** Shipped (client only).

**Problem:** Company type detection on the admin punch log table was driven by `NEXT_PUBLIC_DAYCARE_COMPANY_IDS` — a comma-separated list of hardcoded company IDs baked into the environment. Adding a new company required an env change and a redeploy. The server now returns `companyType: "BNC" | "DAYCARE"` in every time log response envelope, making the env-var approach obsolete.

**Fix:** Removed `DAYCARE_COMPANY_IDS` constant and all `.includes(companyId)` checks. Added `companyType` state, populated once from `tlJ.companyType` on the first `fetchTimelogs` call. `isDayCare` is now derived as `companyType === "DAYCARE"` — all downstream column visibility and feature flags flow from this single value.

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`
- Removed module-level `DAYCARE_COMPANY_IDS` const (was lines 62–66)
- Added `const [companyType, setCompanyType] = useState(null)` — line ~717
- `isDayCare` derivation — line ~719
- `setCompanyType(tlJ.companyType)` call in `fetchTimelogs` — line ~1005

---

## Change 2 — `ot` / `otStatus` columns gated to DAYCARE only

**Status:** Shipped (client only).

**Problem:** The Overtime and OT Status columns were always present in `columnOptions` for all companies. For BNC, `rawOtMinutes` is always null and the `overtime` array is absent from every punch row by server design — per-punch OT does not exist for B&C. OT for BNC is a day/week/cutoff aggregate and appears on the CutoffReview page, not here.

**Fix:** Wrapped `ot` and `otStatus` entries in `columnOptions` with `...(isDayCare ? [...] : [])`. Updated the column visibility `useEffect` to strip these two columns from active visibility when `companyType` resolves to non-DAYCARE. Both the column selector toggle UI and the table header will not render these columns for BNC users.

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`
- `columnOptions` — `ot` / `otStatus` conditional on `isDayCare`
- Column visibility `useEffect` — strips `ot` / `otStatus` for non-DAYCARE on load

---

## Change 3 — `punchType` column unconditional for both companies

**Status:** Shipped (client only).

**Problem:** `punchType` was previously gated on `isDayCare`. The updated API contract lists Punch Type as a visible column for both BNC and DAYCARE. BNC punches are always `"REGULAR"` — the field is present and valid.

**Fix:** Moved `punchType` out of the `isDayCare` spread in `columnOptions` — it is now a standard unconditional entry. The `useEffect` no longer manages `punchType` visibility. The render case no longer gates on `isDayCare`.

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`
- `columnOptions` — `punchType` unconditional
- `case "punchType"` render — `isDayCare` gate removed

---

## Change 4 — New columns: `grossHours` and `undertimeHours`

**Status:** Shipped (client only).

**Problem:** `grossHours` (raw clock-out minus clock-in, no deductions) and `undertimeHours` (hours short of shift end) were returned by the server but never exposed as toggleable columns in the admin table. Both fields apply to all company types.

**Fix:**
- Added `gross` and `undertime` entries to `columnOptions` (basic group and time group respectively).
- Enriched both fields in the `fetchTimelogs` map — `grossHours` is `null` when server returns null; `undertimeHours` defaults to `"0.00"`.
- Added render cases: `gross` reuses the `duration` display style; `undertime` renders in amber (`text-amber-600`) with `—` when zero, matching the `late` column convention.
- Added both keys to `columnMapForExport` for CSV/PDF export coverage.

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`
- `columnOptions` — `gross` (basic group), `undertime` (time group)
- `columnMapForExport` — `gross: "Gross Hours"`, `undertime: "Undertime Hours"`
- Enrichment locals `undertimeHours`, `grossHours` and return object entries
- `case "gross"` and `case "undertime"` render cells

---

## Change 5 — `shiftName` now uses `userShift.shift.shiftName` (per-punch matched shift)

**Status:** Shipped (client only).

**Problem:** `shiftName` in the enriched row was derived from `shiftToday`. For DAYCARE this is a joined string of all shifts for the day (correct for a summary display). For BNC, `shiftToday` is `string[]` — all shifts for the day — which means both punches on a multi-shift day would show the same combined label regardless of which shift each punch actually belonged to.

The correct field for the per-punch "Shift" label is `userShift.shift.shiftName` — the server already runs `matchShiftToWindow` per punch for BNC, resolving each punch to its specific overlapping shift.

**Fix:** `shiftName` now derives from `t.userShift?.shift?.shiftName ?? "—"` for all company types. The Employee Details panel in expanded rows and the Shift column tooltip now always show the shift that matched this specific punch, not the full day's shift list.

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`
- Enrichment `shiftName` — line ~1100

---

## Change 6 — `isScheduled` now uses `userShifts` / `userShift`

**Status:** Shipped (client only).

**Problem:** `isScheduled` (drives the Scheduled/Unscheduled badge in the `schedule` column) was derived from `shiftToday`. For BNC, `shiftToday` is `string[]` — an empty array `[]` is truthy in JavaScript, so `!!(t.shiftToday)` would always return `true` even when no shifts were assigned. This caused every BNC row to incorrectly show "Scheduled."

**Fix:** `isScheduled` now derives from `!!(t.userShifts?.length || t.userShift)` — the same structured source used by `scheduleList` (the schedule detail modal). Empty or absent `userShifts` correctly produces `false`. Both fields are available for all company types.

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`
- Enrichment `isScheduled` — line ~1088

---

## Change 7 — Total Duration summary stat added to table header

**Status:** Shipped (client only).

**Problem:** The table header showed "Total Period Hours" (sum of `scheduledHours` across displayed rows) but had no "Total Duration" (sum of `netWorkedHours`). Admins had no quick reference for total actual worked time for the current filter view.

**Fix:** Added `totalDurationHours` useMemo (sums `r.duration` across `displayed`) and rendered it as "Total Duration" to the left of "Total Period Hours" in the card header. Both stats react to the same `displayed` array and update together on any filter change.

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`
- `totalDurationHours` useMemo — line ~1180
- Render — card header alongside `totalPeriodHours`

---

## Change 8 — Default date range now `today → today` instead of `start-of-month → today`

**Status:** Shipped (client only).

**Problem:** `getDefaultFrom()` returned the first day of the current month (e.g., `2026-05-01`), causing the table to load with a full month of records on every page visit and every reset. This was expensive for large companies and not the expected default behavior.

**Fix:** Removed `.slice(0, 7) + "-01"` from `getDefaultFrom`. It now returns today's date in the company timezone, identical to `getDefaultTo`. On load and on reset, both date pickers default to today.

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`
- `getDefaultFrom` — line ~93
