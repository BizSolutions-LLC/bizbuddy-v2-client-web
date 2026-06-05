# Changelog — v2.13.9

BB-008: Hide informational warning badges on approved timelogs — applied to both the Cutoff Review page and the Punch Logs table.

---

## Change 1 — Cutoff Review: Hide Informational Badges on Approved Timelogs

**Status:** Client only — no server changes required.

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

---

### Background

On the Cutoff Review page, timelogs that were already approved still displayed informational warning badges in the timeline row:

- **"Xmin late"** — derived from `calc.lateMinutes` when `lateStatus === "beyond_grace"`
- **"Left Xmin early"** — derived from `calc.earlyMinutes`
- **"Auto clock-out triggered"** — driven by `tl.autoClockOut`

These badges are meaningful during the review process — they signal anomalies a supervisor should acknowledge before approving. Once a timelog is approved, the supervisor has already accepted the record. Showing the badges post-approval creates noise and implies there is still something to act on.

The server already returns `isApproved` on each `timeLog` object in the `APPROVAL_INCLUDE` response. No backend changes were needed.

---

### Fix

In `buildDetails`, the three affected tag pushes were gated on `!tl.isApproved`:

```js
// before
if (isLate)      tags.push({ cls: "late", label: `${calc.lateMinutes}min late` });
if (leftEarly)   tags.push({ cls: "flag", label: `Left ${calc.earlyMinutes}min early`, ... });
if (tl.autoClockOut) tags.push({ cls: "auto", label: "Auto clock-out triggered" });

// after
if (isLate && !tl.isApproved)      tags.push({ cls: "late", label: `${calc.lateMinutes}min late` });
if (leftEarly && !tl.isApproved)   tags.push({ cls: "flag", label: `Left ${calc.earlyMinutes}min early`, ... });
if (tl.autoClockOut && !tl.isApproved) tags.push({ cls: "auto", label: "Auto clock-out triggered" });
```

All other tags (`snap`, `ot`, `tooEarly`, `duplicate`) are unaffected — they either remain relevant after approval or are not tied to the approved/anomaly distinction.

---

## Change 2 — Punch Logs: Hide Informational Badges/Indicators on Cutoff-Approved Timelogs

**Status:** Client only — no server changes required.

**Page:** `/dashboard/company/punch-logs`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

---

### Background

The same principle applies to the Punch Logs table. Once a timelog has been approved through a cutoff review (`t.cutoffApproval?.status === "approved"`), it is considered clean. Showing warning indicators after that point is misleading — a supervisor browsing the log could mistake them for open issues that still need attention.

The relevant indicators were:

| Location | Indicator |
|---|---|
| Table row (collapsed) | Purple row highlight + left border (`border-l-purple-400`) for G-6 auto clock-out |
| Employee name cell | Small purple `Timer` icon (G-6 tooltip) |
| `Late` column | Red `lateHours` value |
| `Undertime` column | Amber `undertimeHours` value |
| Expanded row — Break Times panel | `Late Hours:` value |
| Expanded row — Employee Details panel | Purple G-6 warning block |

The `cutoffApproval` object is already returned by `/api/timelogs` (it powers the existing Cutoff Status column). No additional data fetching was needed.

---

### Fix

All six locations were gated on `t.cutoffApproval?.status !== "approved"`:

**Row background color (collapsed state):**
```js
// before
: t.isAutoClockOut
? "bg-purple-50/40 ... border-l-2 border-l-purple-400"

// after
: t.isAutoClockOut && t.cutoffApproval?.status !== "approved"
? "bg-purple-50/40 ... border-l-2 border-l-purple-400"
```

**G-6 icon in employee name cell:**
```jsx
// before
{t.isAutoClockOut && (

// after
{t.isAutoClockOut && t.cutoffApproval?.status !== "approved" && (
```

**Late column:**
```jsx
// before
parseFloat(t.lateHours) > 0 ? <TimeDisplayWithTooltip ... /> : <span>—</span>

// after
t.cutoffApproval?.status !== "approved" && parseFloat(t.lateHours) > 0
  ? <TimeDisplayWithTooltip ... /> : <span>—</span>
```

**Undertime column:**
```jsx
// before
parseFloat(t.undertimeHours) > 0 ? <TimeDisplayWithTooltip ... /> : <span>—</span>

// after
t.cutoffApproval?.status !== "approved" && parseFloat(t.undertimeHours) > 0
  ? <TimeDisplayWithTooltip ... /> : <span>—</span>
```

**Expanded row — Late Hours field:**
```jsx
// before
{parseFloat(t.lateHours) > 0 ? `${t.lateHours}h` : "—"}

// after
{t.cutoffApproval?.status !== "approved" && parseFloat(t.lateHours) > 0 ? `${t.lateHours}h` : "—"}
```

**Expanded row — G-6 warning block:**
```jsx
// before
{t.isAutoClockOut && (

// after
{t.isAutoClockOut && t.cutoffApproval?.status !== "approved" && (
```

The gate is intentionally permissive for records not yet in any cutoff (`cutoffApproval === null`) — those records still show all warnings since no supervisor has reviewed them.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | `buildDetails`: gated `late`, `leftEarly`, and `autoClockOut` tag pushes on `!tl.isApproved` (Change 1) |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | Row highlight, G-6 icon, Late column, Undertime column, expanded Late Hours field, and expanded G-6 warning block all gated on `t.cutoffApproval?.status !== "approved"` (Change 2) |
