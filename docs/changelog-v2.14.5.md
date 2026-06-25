# Changelog — v2.14.5

Employee Timelogs: OT Status now reads from server-provided `otStatus` field instead of client-derived per-punch computation. New "Included" and "Approved" period-level labels for DayCare companies. OT Status badge in admin view updated to handle new values.

---

## Change 1 — Employee Punch Logs (Employee View): OT Status from Server Field

**Status:** Shipped (client only). Requires server `otStatus` field on `GET /api/timelogs/user` response.

**Page:** `/dashboard/employee/punch-logs`

**File:** `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`

**Root Cause:**

The OT Status displayed in the punch log side panel was derived client-side from `rawOtMinutes` and the `overtime[]` array. For DayCare companies using cutoff-basis OT, `rawOtMinutes` reflects per-punch computation at the time of clocking — it does not reflect whether the employee's period OT block has been approved by an admin. This caused the side panel to show misleading "No Approval" or "Pending" labels even when OT had already been approved in the Cutoff Period review.

**Fix:**

The `logsWithSchedule` useMemo and `fetchExportData` function now check for `log.otStatus` on each API record first. When present (DayCare rows), the server value is used directly. The old `rawOtMinutes`/`overtime[]` derivation is retained as a fallback for rows that do not carry the field (B&C and daily-basis companies).

```js
// Before
let otStatus;
if (approvedOTHours > 0) otStatus = `Approved ${approvedOTHours.toFixed(2)}h`;
else if (hasPendingOT)   otStatus = "Pending";
else if (otEligible)     otStatus = "No Approval";
else                     otStatus = "—";

// After
const otStatus = log.otStatus != null
  ? log.otStatus
  : approvedOTHours > 0 ? `Approved ${approvedOTHours.toFixed(2)}h`
  : hasPendingOT        ? "Pending"
  : otEligible          ? "No Approval"
  : "—";
```

**OT Status values (server-provided, DayCare only):**

| Value | Meaning | Display |
|---|---|---|
| `"-"` / `"—"` | No CutoffOtBlock exists for this employee this period | Muted dash |
| `"Included"` | OT block exists, status pending admin approval | Amber badge |
| `"Approved"` | OT block exists, approved | Green badge |

**Side panel — new OT Status row:**

An "OT Status" row is now shown in the Overtime section of the log detail side panel for DayCare records (`isDayCare && log.otStatus != null`). Renders `"Approved"` as a green badge, `"Included"` as an amber badge, and the dash case as muted text.

The "Request OT Approval" button is unaffected — it only fires on `"No Approval"`, which DayCare records will never receive from the server.

---

## Change 2 — Employee Punch Logs (Admin View): OT Status from Server Field + Badge Update

**Status:** Shipped (client only). Requires server `otStatus` field on `GET /api/timelogs` response.

**Page:** `/dashboard/company/punch-logs`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

**Root Cause:**

Same as Change 1. The `enrichTimelogs` function derived `otStatus` client-side from `rawOtMinutes` and `overtime[]`. The `OvertimeBadge` component only handled lowercase legacy values (`"approved"`, `"pending"`, `"rejected"`) and had no rendering logic for the new server-provided capitalized values (`"Included"`, `"Approved"`).

**Fix — `enrichTimelogs`:**

Same pattern as Change 1 — `t.otStatus` from the API is used when present, with the legacy derivation as fallback.

**Fix — `OvertimeBadge`:**

Replaced the flat `variants`/`icons` lookup maps with a `getConfig(s)` switch that handles both legacy values and the new server values:

- `"Approved"` (new) → green `"default"` badge with `CheckCircle` icon. Tooltip: "Period overtime has been reviewed and approved."
- `"Included"` (new) → amber `"outline"` badge (`bg-amber-50 border-amber-200 text-amber-700`) with `Clock` icon. Tooltip: "Overtime has been computed for this period and is pending admin approval."
- `"approved"` (legacy) → unchanged green default badge.
- `"pending"` (legacy) → unchanged secondary badge.
- `"rejected"` (legacy) → unchanged destructive badge.
- All other / dash → unchanged outline badge with `Timer` icon.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` | `logsWithSchedule`: use `log.otStatus` from server when present; `fetchExportData`: same; side panel Overtime section: new OT Status row for DayCare records |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | `enrichTimelogs`: use `t.otStatus` from server when present; `OvertimeBadge`: extended to handle `"Included"` (amber) and `"Approved"` (green) new server values |
