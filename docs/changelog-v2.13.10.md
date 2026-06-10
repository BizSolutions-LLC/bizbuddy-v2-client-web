# Changelog — v2.13.10

BB-023: Alphabetical sort now carries through to all report generations on the Punch Logs page; employee names in all exports use Last, First format; fixed dual-spinner bug on CSV export buttons.
BB-024: New "Early Clock-Out Grace Period" setting for DayCare companies — Driver/Aide and Driver PM employees who clock out within the grace window before their PM shift end are automatically snapped to shift end.

---

## Change 1 — BB-023: Alphabetical Sort Propagates to All Report Exports

**Status:** Client only — no server changes required.

**Page:** `/dashboard/company/punch-logs`

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`
- `lib/exports/employeePunchLogs.js`

---

### Background

The punch logs table has an alphabetical sort toggle that sorts rows by employee Last, First name. Previously, clicking any of the three export buttons (CSV, PDF, Grid CSV) did not guarantee the same order in the generated file:

- The **standard CSV** and **PDF** exports received the already-sorted `displayed` array, so they were incidentally correct when alphabetical was active — but only by coincidence, not by design.
- The **Grid CSV** (`exportEmployeePunchLogsCSV_v2`) re-sorted internally using the raw `employeeName` string from the API, which is in First Last format. This produced a different sort order from the table in all cases.
- There was no enforcement that the sort order in the export matched the table's active sort state.

Additionally, employee names throughout all three export files were rendered using `record.employeeName` (raw API string, First Last format), inconsistent with how the table displays them using the `fmtLastFirst` helper.

---

### Fix

**Sort order in Grid CSV:**

`exportEmployeePunchLogsCSV_v2` now accepts an `employeeNameMap` parameter (the same map used by the table, keyed by `userId` with `{ firstName, lastName }` entries). The internal employee sort was updated to use `lastName` then `firstName` from this map, matching the table's alphabetical sort exactly:

```js
// before
const sortedEmployees = [...employeeMap.entries()].sort((a, b) =>
  (a[1].name || "").localeCompare(b[1].name || "")
);

// after
const sortedEmployees = [...employeeMap.entries()].sort((a, b) => {
  const aN = employeeNameMap[a[0]] ?? {};
  const bN = employeeNameMap[b[0]] ?? {};
  const aLast  = (aN.lastName  || "").toLowerCase();
  const bLast  = (bN.lastName  || "").toLowerCase();
  const aFirst = (aN.firstName || "").toLowerCase();
  const bFirst = (bN.firstName || "").toLowerCase();
  if (aLast !== bLast) return aLast.localeCompare(bLast);
  if (aFirst !== bFirst) return aFirst.localeCompare(bFirst);
  return (a[1].name || "").localeCompare(b[1].name || "");
});
```

**Last, First name format in all exports:**

A shared `fmtLastFirst(map, userId, fallback)` helper was added at the top of `employeePunchLogs.js`. All six name-rendering points across the three export functions were updated to use it:

| Export function | Location | Before | After |
|---|---|---|---|
| `exportEmployeePunchLogsCSV` | Employee summary section | `log.employeeName` | `fmtLastFirst(employeeNameMap, log.userId, log.employeeName)` |
| `exportEmployeePunchLogsCSV` | Detail row `employee` cell | `record.employeeName` | `fmtLastFirst(employeeNameMap, record.userId, record.employeeName)` |
| `exportEmployeePunchLogsPDF` | Employee summary section | `log.employeeName` | `fmtLastFirst(employeeNameMap, log.userId, log.employeeName)` |
| `exportEmployeePunchLogsPDF` | Detail row `employee` cell | `record.employeeName?.split('@')[0]` | `fmtLastFirst(employeeNameMap, record.userId, record.employeeName)` |
| `exportEmployeePunchLogsCSV_v2` | Employee map entry `name` | `log.employeeName` | `fmtLastFirst(employeeNameMap, log.userId, log.employeeName)` |

`employeeNameMap` is now passed from the component into all three export calls. The helper falls back to the raw API string if the map has no entry for a given `userId`.

---

## Change 2 — BB-023: Separate Loading States for CSV Export Buttons

**Status:** Client only — no server changes required.

**Page:** `/dashboard/company/punch-logs`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

---

### Background

The "Export CSV (Detail)" and "Export Grid CSV (Payroll)" buttons shared a single `exporting` state variable. Clicking either button caused both to enter the spinning/disabled state simultaneously, making it appear both exports were running at once.

---

### Fix

A dedicated `gridExporting` state was added for the Grid CSV button:

```js
// before
const [exporting, setExporting] = useState(false);

// after
const [exporting,     setExporting]     = useState(false);
const [gridExporting, setGridExporting] = useState(false);
```

`exportGridCSV` now uses `setGridExporting` instead of `setExporting`. The Grid CSV button's `spinning` and `disabled` props were updated accordingly. The two buttons are now fully independent.

---

## Change 3 — BB-024: Early Clock-Out Grace Period Setting (DayCare Only)

**Status:** Client only — server `earlyClockOutGraceMinutes` field already supported via GET/PATCH `/api/company-settings`.

**Page:** `/dashboard/company/configurations`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyConfigurations.jsx`

---

### Background

Driver/Aide and Driver PM employees occasionally clock out a few minutes before their scheduled PM shift end. The backend can automatically snap such clock-outs forward to the shift end (treating the short gap as a grace period rather than undertime), but the configurable threshold for this behaviour — `earlyClockOutGraceMinutes` — had no UI.

Regular employees are unaffected by this setting; early clock-out is still counted as undertime for them.

---

### Fix

A new `NumberField` was added to the **DayCare Settings** card in Company Configurations, placed immediately after the existing "Early Clock-In Grace (minutes)" field — the two form a natural pair:

```jsx
<NumberField
  label="Early Clock-Out Grace (minutes)"
  value={draft?.earlyClockOutGraceMinutes ?? 20}
  onChange={(v) => setDraft((o) => ({ ...o, earlyClockOutGraceMinutes: v }))}
  step="5"
  icon={AlarmClock}
  helpText="Driver/Aide and Driver PM employees who clock out within this window before their scheduled PM shift end will have their clock-out snapped to the shift end time. Does not apply to regular employees."
/>
```

- **Default:** `20` minutes (matches server default; shown until the API returns a value).
- **Visibility:** DayCare companies only — the field lives inside the `isDayCare && (...)` block that gates the entire DayCare Settings card. No additional condition needed.
- **Persistence:** Read from `settingsJson.data.earlyClockOutGraceMinutes` on GET; written back as part of the `draft` object on PATCH. No special handling required — follows the same pattern as all other settings in this card.
- **Skeleton:** Updated the loading skeleton from 3 to 4 placeholders to match the new field count.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | Added `gridExporting` state; `exportGridCSV` uses `setGridExporting`; Grid CSV button uses `gridExporting`; `employeeNameMap` passed to all three export calls (BB-023) |
| `lib/exports/employeePunchLogs.js` | Added `fmtLastFirst` helper; `exportEmployeePunchLogsCSV` and `exportEmployeePunchLogsPDF` accept and use `employeeNameMap`; all six employee name render points updated to Last, First format; Grid CSV sort uses Last, First via `employeeNameMap` (BB-023) |
| `components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyConfigurations.jsx` | Added `earlyClockOutGraceMinutes` `NumberField` in DayCare Settings card; skeleton updated to 4 placeholders (BB-024) |
