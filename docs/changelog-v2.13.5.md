# Changelog — v2.13.5

BB-012 — Cutoff Periods page now defaults to showing only the period that covers today, with a Current Period / All toggle.
DayCare Cutoff Review — driver/aide segment rows now show status-aware In/Out times, the four-button approval model, and the raw punch in the day header.
DayCare Cutoff Review — driver/aide employees now show a green car icon beside their name in the employee card header.
DayCare Cutoff Review — regular (non-segment) DayCare punches now also use the four-button approval model; Approve Shift bypasses the shift picker for all DayCare records.

---

## Change 1 — Cutoff Periods: Default to Current Period View (BB-012)

**Status:** Shipped (client only).

**Page:** `/dashboard/company/cutoff-periods`

**Problem:** The Cutoff Periods table loaded all periods ever generated — past, present, and future — with no date-based filtering. Admins had to scroll through the full list to find the period currently in effect.

**Fix:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeeCutoff.jsx`

### New state

```js
const [showCurrentOnly, setShowCurrentOnly] = useState(true);
```

Defaults to `true` so the current-period view is active on load.

### Filter logic

`filteredPeriods` (the memo that drives the table) now applies a date check when `showCurrentOnly` is true. A period passes only when today falls within its `periodStart`–`periodEnd` range:

```js
const matchDate = (() => {
  if (!showCurrentOnly) return true;
  const [sy, sm, sd] = p.periodStart.slice(0, 10).split("-").map(Number);
  const [ey, em, ed] = p.periodEnd.slice(0, 10).split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end   = new Date(ey, em - 1, ed);
  return today >= start && today <= end;
})();
```

Uses the same local-date construction pattern already in the file (`split("-").map(Number)`) to avoid UTC-offset issues.

### Toggle UI

A pill-style **Current Period / All** toggle was added to the Cutoff Periods table header, to the left of the existing search input and status filter:

```jsx
<div className="inline-flex items-center rounded-lg border ... p-0.5 gap-0.5">
  <button onClick={() => setShowCurrentOnly(true)}  className={showCurrentOnly  ? "bg-orange-500 text-white ..." : "..."}>
    Current Period
  </button>
  <button onClick={() => setShowCurrentOnly(false)} className={!showCurrentOnly ? "bg-orange-500 text-white ..." : "..."}>
    All
  </button>
</div>
```

Orange fill = active selection. Both the existing search-text and status filters continue to work on top of whichever view is active.

### Empty-state message

The "No cutoff periods found" empty state now shows a context-aware hint:

```jsx
{showCurrentOnly
  ? "No period covers today's date. Switch to \"All\" to see all periods."
  : "Try adjusting your filters or create a new period."}
```

### What is unaffected

- The **stat cards** (Total / Open / Locked / Processed) count all fetched periods from the API — the toggle does not affect them.
- The **Department tabs** and **Dept Config Panel** are unaffected.
- The **status filter** and **search input** continue to layer on top of the toggle.

---

## Change 2 — DayCare Cutoff Review: Driver/Aide Segment Display + Approval Model Fix

**Status:** Shipped (client only).

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Problem:** Three separate bugs in the Cutoff Review page when reviewing DayCare employees with Driver/Aide assignments. Each day for these employees is split into 3 approval rows (Driver AM, Regular, Driver PM):

1. **Wrong In/Out times shown.** Segment rows always displayed `segmentStart`/`segmentEnd` (the scheduled window) regardless of approval status. Approved records should show the actual approved clock times (`approvedClockIn`/`approvedClockOut`), not the scheduled window.

2. **Raw punch hidden.** All three segments share the same raw punch (e.g., clocked in 6:41 AM, out 2:54 PM). This context was not surfaced anywhere on screen.

3. **Wrong approval buttons.** DayCare driver/aide segments fell through to the generic single-button `Approve` model. They should have the same four-button model used by BNC regular punches: Approve Shift, Approve Raw, Edit, Exclude.

**Root cause:** `buildDetails` in `CutoffReview.jsx` had no branch for `!isBNC && isSegment`. The in/out display was not status-aware for segments. `handleApproveSchedule` always opened the shift picker, which would bail with "No shift assigned" on segments that have no `availableShifts`.

---

### Fix 1 — Status-aware In/Out for segment rows

`buildDetails` now branches on `approval.status` for segment records:

```js
if (approval.segmentType !== null) {
  if (approval.status === "approved") {
    // Show what was actually approved
    inTime  = formatDateTime(approval.approvedClockIn,  tz);
    outTime = formatDateTime(approval.approvedClockOut, tz);
  } else {
    // pending / excluded — show the segment window (unique per segment;
    // raw punch is identical across all 3 rows so it lives in the day header)
    inTime  = formatDateTime(approval.segmentStart, tz);
    outTime = formatDateTime(approval.segmentEnd,   tz);
  }
} else {
  // Regular punch — unchanged
  inTime  = tl.timeIn  ? formatDateTime(tl.timeIn,  tz) : "—";
  outTime = tl.timeOut ? formatDateTime(tl.timeOut, tz) : "Not clocked out";
}
```

`segmentStart`/`segmentEnd` are also stored as `segmentWindow` (pre-formatted string) and rendered as a violet reference pill in `DriverSegmentRow` — visible on approved rows so the admin can see the original scheduled window alongside the approved times.

---

### Fix 2 — Raw punch in the Driver Day header

`DriverGroupRow` now accepts a `companyTimezone` prop and reads the shared raw punch from `group.segments[0].rawTimeIn`/`rawTimeOut`:

```jsx
{rawIn && (
  <span className="font-mono text-[10px] text-neutral-400">
    {formatDateTime(rawIn, companyTimezone)} → {rawOut ? formatDateTime(rawOut, companyTimezone) : "Not clocked out"}
  </span>
)}
```

This surfaces "Driver Day — 3 segments · clocked in 6:41 AM → 2:54 PM" in the day header row, giving the admin the full-day clock context without repeating it on every segment sub-row.

---

### Fix 3 — Four-button approval model for DayCare segments

`buildDetails` now has an explicit `!isBNC && isSegment` branch:

```js
} else if (isSegment) {
  // DayCare driver/aide segments — four-button model; no shift picker (segment window is authoritative)
  actions.push("approve-schedule", "approve-raw", "edit", "exclude");
}
```

`handleApproveSchedule` bypasses the shift picker when called on a segment:

```js
if (rec.segmentType !== null) {
  doApprove(rec.id, { approvalMode: "schedule" });
  return;
}
```

This sends `{ action: "approve", approvalMode: "schedule" }` directly — no `shiftId` — which is all the server needs for driver/aide segment approval. The shift picker (`shiftPickerModal`) remains unchanged for BNC regular punches.

---

### What is unaffected

- BNC (Batangas National College) cutoff review is fully unaffected — both the BNC segment branch (`isBNC && isSegment`) and BNC regular punch branch (`isBNC`) are unchanged.
- DayCare regular (non-segment) punch rows are unaffected.
- The Edit, Exclude, Reset, Conflict, and Bulk Approve flows are unaffected.
- No backend changes. `approvedClockIn`/`approvedClockOut` and `segmentStart`/`segmentEnd` were already returned by `GET /api/cutoff-periods/:id/approvals`.

---

## Change 4 — DayCare Cutoff Review: Four-Button Model for Regular Punches + Approve Shift Bypass

**Status:** Shipped (client only).

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Problem:** Two gaps left after Change 2:

1. **Regular DayCare punches still had the single-button model.** The `isSegment` branch added in Change 2 only covered driver/aide sub-rows (`segmentType !== null`). Standard staff punches in a DayCare cutoff fell through to the old `else` branch and got a single `Approve` button instead of the four-button model.

2. **`handleApproveSchedule` still opened the shift picker for regular DayCare punches.** The bypass added in Change 2 only short-circuited on `segmentType !== null`. A regular DayCare punch (`segmentType === null`) would proceed to `setShiftPickerModal` even though DayCare never needs shift selection.

### Fix 1 — Actions block `else` branch

```js
// Before
} else {
  actions.push("approve");
  if (hasOT || calc.potentialOT) actions.push("approve-ot");
  actions.push("edit", "exclude");
}

// After
} else {
  // DayCare regular punch — same four-button model; no OT button (handled server-side)
  actions.push("approve-schedule", "approve-raw", "edit", "exclude");
}
```

The `approve-ot` button is dropped — OT is computed and applied server-side on approval for DayCare.

### Fix 2 — `handleApproveSchedule` bypass extended to all DayCare

```js
// Before — only bypassed for segments
if (rec.segmentType !== null) {
  doApprove(rec.id, { approvalMode: "schedule" });
  return;
}

// After — bypasses for all DayCare (segment or regular); only BNC regular punches use the picker
if (!isBNC || rec.segmentType !== null) {
  doApprove(rec.id, { approvalMode: "schedule" });
  return;
}
// BNC regular punches — shift picker required
```

Server contract unchanged: `{ action: "approve", approvalMode: "schedule" }` and `{ action: "approve", approvalMode: "raw" }`. No backend changes needed.

---

## Change 3 — DayCare Cutoff Review: Car Icon for Driver/Aide Employees

**Status:** Shipped (client only).

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Problem:** In the Cutoff Review employee card list, there was no visual indicator to distinguish driver/aide employees from regular staff — admins had to expand a card to see segment rows before knowing an employee had a Driver/Aide assignment.

**Fix:** Added a green `Car` icon (Lucide React, `w-3.5 h-3.5 text-green-500`) beside the employee name in the card header, matching the exact same indicator used on the `/dashboard/company/employees` Employee Details modal.

Driver status is detected client-side from the approval records: if any of an employee's approval records has `segmentType !== null`, `isDriver` is set to `true` on the employee object — no API change needed.

```js
// In fetchData — empMap initialization
isDriver: false,

// After buildDetails
if (details.segmentType !== null) emp.isDriver = true;
```

```jsx
{/* EmployeeCard name row */}
<div className="flex items-center gap-1.5">
  <span className="font-bold text-sm text-neutral-800 dark:text-neutral-200 truncate">{emp.name}</span>
  {emp.isDriver && <Car className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
</div>
```

---

---

## Change 5 — Punch Log Requests: Time Display Uses Company Timezone (BB-019)

**Status:** Shipped (client only).

**Page:** `/dashboard/company/punch-logs`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

**Problem:** In the "Punch Log Requests Pending Approval" section, the **Date** field used the browser's local timezone and the **Time In / Time Out** fields defaulted to UTC — both inconsistent with the rest of the punch log table, which renders all times in the company timezone.

**Fix:** Replaced the raw `new Date(...).toLocaleDateString(...)` call on `requestedDate` with `safeDate(req.requestedDate, companyTimezone)`, and passed `companyTimezone` as the second argument to both `safeTime(req.requestedClockIn, companyTimezone)` and `safeTime(req.requestedClockOut, companyTimezone)`.

`companyTimezone` is already fetched from company configuration and available in component scope — no API changes needed.

The **Submitted** timestamp is intentionally left as browser local time; it is a meta field (when the request was submitted) and does not represent a company-operation time.

---

## Change 6 — DayCare Settings: Early Clock-In Grace Field

**Status:** Shipped (client only).

**Page:** `/dashboard/company/configurations`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyConfigurations.jsx`

**Problem:** The DayCare Settings card had no way to configure how early an employee can clock in before their shift without having their time snapped to the shift start. The only existing fields were Driver-Aide Threshold and Auto-Snap Window.

**Fix:** Added a third `NumberField` — "Early Clock-In Grace (minutes)" — bound to `draft.earlyClockInGraceMinutes` with a step of 5 and an `AlarmClock` icon. The DayCare Settings card grid was widened from `sm:grid-cols-2` to `lg:grid-cols-3` to accommodate the new field in the same row on larger screens.

Help text: "Employees who clock in more than this many minutes before their shift start will have their actual time kept as-is and be flagged as Too Early. Leave blank to always snap early arrivals to shift start."

No backend changes needed beyond the server already reading/persisting `earlyClockInGraceMinutes` on the company config record.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeeCutoff.jsx` | Added `showCurrentOnly` state; updated `filteredPeriods` memo with date-range check; added Current Period / All toggle to table header; updated empty-state message (Change 1 — BB-012) |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | Status-aware In/Out for driver/aide segments; raw punch in DriverGroupRow header; DayCare segment four-button approval model; handleApproveSchedule segment bypass (Change 2); four-button model extended to regular DayCare punches; handleApproveSchedule bypass extended to all non-BNC records (Change 4); green Car icon beside driver/aide employee names (Change 3) |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | Punch Log Requests: Date, Time In, Time Out now render in company timezone via `safeDate`/`safeTime` with `companyTimezone` (Change 5 — BB-019) |
| `components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyConfigurations.jsx` | DayCare Settings card: added Early Clock-In Grace field bound to `earlyClockInGraceMinutes`; grid widened to `lg:grid-cols-3` (Change 6) |
