# Changelog — v2.14.4

Cutoff Review: approval skeleton UX + enriched-hours refresh + OT block day breakdown + Training OT exclusion fix. Leave Requests: per-request balance fetch. Employee Leave Logs: date submission timezone fix.

---

## Change 1 — Cutoff Review: Skeleton Loading During Approve / Reset

**Status:** Shipped (client only).

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**What Changed:**

The Hours and Actions columns in `TimelineRow`, `PunchSubRow`, `DriverSegmentRow`, and `DriverGroupRow` now show `<Skeleton>` placeholders while an approval or reset is in-flight (`rec.isApproving === true`).

Previously, clicking Approve or Reset immediately replaced the action buttons with the Approved/locked state using optimistic values from the PATCH response — but the PATCH only returns a raw approval record. Enriched hours (`approvedClockOut − approvedClockIn`) only exist after `enrichApprovals` runs on `GET /approvals`. This caused the hours column to momentarily display stale or incorrect values before a full reload.

**Skeleton coverage:**
- `TimelineRow` — Hours cell, Actions cell
- `PunchSubRow` — Hours cell, Actions cell
- `DriverSegmentRow` — Hours cell, Actions cell
- `DriverGroupRow` — Hours total cell (set to `isApproving` when any segment is approving)

---

## Change 2 — Cutoff Review: `refreshApprovals` — Re-fetch After Approve / Reset

**Status:** Shipped (client only).

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Root Cause:**

After approving a time log, the UI previously used the PATCH response body to update `localApprovedTimes` (optimistic state). The PATCH response returns raw `approvedClockIn` / `approvedClockOut` ISO strings, but the displayed hours in the table come from `enrichApprovals` on the server (`netWorkedHours`, `grossHours`, segment hours for drivers) — not from a simple clock-out minus clock-in. Using the raw values produced incorrect hours in the Hours column immediately after approval.

**Fix:**

Introduced `refreshApprovals(recId)` — a `useCallback` that:
1. Keeps `approvingIds` active (skeletons remain) until the GET completes.
2. Re-fetches both `GET /cutoff-periods/:id/approvals` and `GET /timelogs` in parallel.
3. Rebuilds the full `employees` state (same logic as initial load) so all hours values come from the server's `enrichApprovals` output.
4. Clears optimistic overrides (`localStatus`, `localApprovedTimes`, `resetIds`) for the completed record once authoritative server data has landed.
5. Releases `approvingIds` in the `finally` block — skeletons resolve to correct values.

`handleApprove` and `doReset` now call `refreshApprovals(recId)` on success instead of patching local state from the PATCH response. The separate `refreshOTBlocks` call is also removed — `refreshApprovals` rebuilds `otBlocks` as part of the same GET response.

---

## Change 3 — Cutoff Review: OT Block Expandable Day Breakdown

**Status:** Shipped (client only).

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Context (server-side Bug 6 — fixed in server v2.10.18):**

`computeOtForCutoffBasis` previously filtered out Training records from the OT period total (`punchType: { not: "TRAINING" }`). This was wrong — "no OT for Training" means a training day cannot contribute more than `defaultShiftHours` on its own (the cap on `actualHours` handles that), but those capped hours still count toward the 80h period threshold. The fix removed the filter. The OT breakdown `totalHours` in `getCutoffApprovals` was also updated to include Training records, keeping it consistent with the OT computation.

**What Changed (client):**

For cutoff-basis OT blocks (`isCutoffBasis`), the `OTBlockRow` component now supports an expandable day breakdown panel.

When the server response includes `block.breakdown` with a non-empty `days` array, a **"Days"** toggle button appears inline with the OT block description. Clicking it expands a right-aligned mini-table (below the OT row) showing:
- Each contributing day's date and hours — including Training days (which are now included in the OT basis after the Bug 6 server fix)
- Training days labeled with an amber **"Training"** badge (for identification only, not visual suppression — they are full contributors to `totalHours`)
- A **Total** footer row
- A formula row: `{total}h − {threshold}h threshold = +{otHours}h OT`

**Data fields used from `block.breakdown`:**
- `bd.days[]` — `{ date, hours, isTraining }`
- `bd.totalHours` — sum of all approved `actualHours` including Training (post Bug 6 fix)
- `bd.threshold` — the cutoff OT threshold in hours
- `bd.otHours` — payable OT (total − threshold)

The OT block description line also updated to use `bd.totalHours` and `bd.threshold` when breakdown is present, and the Hours column for cutoff-basis blocks now shows `+{otHours}h` (the net OT hours) rather than the gross total.

---

## Change 4 — Cutoff Review: `set-punch-type` Endpoint URL Fix

**Status:** Shipped (client only).

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Root Cause:**

The PATCH calls in `doSetPunchType` and `doSetPunchTypeForDate` were hitting:
```
/api/cutoff-periods/:id/approvals/:recId/punch-type
```
The correct server endpoint is:
```
/api/cutoff-periods/:id/approvals/:recId/set-punch-type
```

This caused all Training / Regular toggle operations to return 404.

**Fix:** Updated both call sites to use `set-punch-type`.

---

## Change 5 — Cutoff Review: Training Designation Triggers OT Refresh

**Status:** Shipped (client only).

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**What Changed:**

When a punch is designated as Training Day, the server re-evaluates the cutoff OT block for that employee — because the training day's `actualHours` is now capped at `defaultShiftHours`, which may change the period total and therefore the OT amount. The PATCH response includes `data.excludedSegmentCount` — the number of approved OT segments that were re-evaluated as a result of the recalculation.

If `excludedSegmentCount > 0`, `doSetPunchType` now calls `refreshApprovals(recId)` to rebuild employees and OT blocks so the table reflects the updated OT hours immediately. The same logic applies in `doSetPunchTypeForDate` (bulk Training designation for a full date) — if any result has `excludedSegmentCount > 0`, `refreshApprovals` is triggered.

---

## Change 6 — Leave Requests: Per-Request Balance Fetch on Dialog Open

**Status:** Shipped (client only).

**Page:** `/dashboard/company/leave-requests`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx`

**Root Cause:**

The approval dialog's **Credit Balance** panel previously read leave balance data from the `leaveMatrix` — a bulk fetch of all employees' balances loaded once when the page mounts. This had two problems:
1. Balances could be stale (fetched at page load, not when the dialog opens).
2. For employees not in the matrix (e.g., newly added), no balance data was shown.

**Fix:**

When `actionDialog` opens with a request, a `useEffect` fires a fresh `GET /api/leaves/balances?userId=...` for the specific employee. The response populates `actionBalance` — an array of `{ leaveType, balanceHours, usedHours }` entries. The balance panel reads from `actionBalance` instead of the matrix.

A loading spinner (`actionBalanceLoading`) is shown while the fetch is in-flight. On dialog close, `actionBalance` is reset.

**Also fixed:** `requestedHours` from `actionDialog.request.requestedHours` is now used directly for the "Total Hours" display and the exceed-balance calculation, rather than always computing `days * 8`. This supports half-day and custom-duration leaves correctly.

---

## Change 7 — Employee Leave Logs: Date Submission Timezone Fix

**Status:** Shipped (client only).

**Page:** `/dashboard/employee/leave-logs`

**File:** `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx`

**Root Cause:**

When submitting a leave request, the start and end dates were constructed as:
```js
new Date(`${startDate}T${startTime || "08:00"}:00`).toISOString()
```

`new Date("YYYY-MM-DDTHH:mm:ss")` without a timezone suffix is parsed as **local browser time**. For employees in non-UTC timezones (e.g. UTC+8), converting `"2026-06-24T08:00:00"` to ISO shifts it to UTC (`"2026-06-24T00:00:00.000Z"`). However for employees in UTC− timezones, the same conversion would shift the date to the previous day on the server.

The time component was only a submission artifact — leave requests are date-based, not datetime-based.

**Fix:**

```js
// Before
const fromDate = new Date(`${startDate}T${startTime || "08:00"}:00`).toISOString();
const toDate   = new Date(`${endDate}T${endTime   || "17:00"}:00`).toISOString();

// After
const fromDate = startDate;
const toDate   = endDate;
```

Plain date strings (`"YYYY-MM-DD"`) are sent directly. The server interprets them as date-only values, avoiding any timezone shift.

---

## Change 8 — Cutoff Review: OT Header Value + TOTAL PAYABLE Source Fixes

**Status:** Shipped (client only).

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

### Fix A — OT Header Value: use `breakdown.otHours` not `block.otHours`

The `+Xh` value in the OT block's Hours cell was reading `block.otHours` — the value stored in the DB at last compute time. The fresh value is `block.breakdown.otHours`, which is recomputed on every `GET /approvals` response (the same response that drives `refreshApprovals`). These can diverge if the DB write lagged or if the breakdown calculation includes adjustments not yet persisted.

**Fix:** OT header now reads `bd?.otHours ?? block.otHours` — uses the fresh breakdown value when available, falls back to the DB value.

### Fix B — TOTAL PAYABLE: approved records only, Training included

The "Total Payable" displayed in the employee card footer (and the collapsed "Payable" header) was computed as `punchHours + leaveHours`, where `punchHours` had two problems:

1. **Training records were explicitly excluded** — but Training approvals have real payable hours (`payrollSummary.payableRegularHours`, capped at `defaultShiftHours` by the server's Bug 4 fix). Excluding them understated TOTAL PAYABLE.
2. **All records were summed regardless of approval status** — pending records should not contribute to TOTAL PAYABLE; only approved records count.

The `punch_group.hours` and `driver_group.hours` (the hours totals shown on date group rows) had the same two bugs.

**Fix — correct formula:**
```
TOTAL PAYABLE = Σ payrollSummary.payableRegularHours (approved punch records, Training included)
              + Σ leave.leaveHours (standalone leave rows)
```

`r.hours` on each record already reads from `payrollSummary.payableRegularHours` (via `buildDetails`). The fix is to sum only approved records.

```js
// punch_group.hours — approved sub-punches only
punches.reduce((sum, p) => p.localStatus === "approved" ? sum + (p.hours || 0) : sum, 0)

// driver_group.hours — approved segments only (was: exclude only "excluded", which included pending)
segments.reduce((sum, s) => s.localStatus === "approved" ? sum + (s.hours || 0) : sum, 0)

// top-level punchHours reduce — groups use pre-computed .hours; standalone records filtered by approved
records.reduce((s, r) => {
  if (r.type === "leave") return s;
  if (r.type === "punch_group" || r.type === "driver_group") return s + (r.hours || 0);
  return r.localStatus === "approved" ? s + (r.hours || 0) : s;
}, 0)
```

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | Skeleton loading for `isApproving` in `TimelineRow`, `PunchSubRow`, `DriverSegmentRow`, `DriverGroupRow`; `refreshApprovals` callback; approve and reset flows call `refreshApprovals` instead of optimistic PATCH updates; `OTBlockRow` expandable day breakdown for cutoff-basis blocks (Training days shown at normal weight with amber "Training" label); `set-punch-type` endpoint URL fix; Training designation triggers `refreshApprovals` when `excludedSegmentCount > 0`; `isApproving` propagated to driver group; OT header uses `breakdown.otHours` (fresh) over `block.otHours` (stale DB); TOTAL PAYABLE now includes Training records |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests.jsx` | Per-request balance fetch (`actionBalance`, `actionBalanceLoading`) on dialog open; `requestedHours` used directly for total hours and exceed-balance calculation; balance panel reads from fresh per-user fetch instead of stale matrix |
| `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx` | Date submission fix — plain date strings sent instead of `new Date(...).toISOString()` to prevent timezone-induced date shift |
