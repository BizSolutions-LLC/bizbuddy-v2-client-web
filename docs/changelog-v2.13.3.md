# Changelog — v2.13.3

Two bug fixes on the Employee Punch Logs page.

---

## Change 1 — Employee Punch Logs: My Punch Log Requests — "Invalid Date" on Request Cards

**Status:** Shipped (client only).

**Problem:** All cards in the "My Punch Log Requests" section displayed "Invalid Date" as the header date instead of the formatted punch date.

**Root cause:** The date renderer appended `"T12:00"` directly to `req.requestedDate`:

```js
new Date(req.requestedDate + "T12:00")
```

The `T12:00` suffix was introduced in v2.13.2 to prevent UTC midnight from rolling the date back one day in negative-offset timezones. That fix assumed `requestedDate` would always be a date-only string (`"2026-05-06"`). The API, however, returns it as a full ISO datetime string (`"2026-05-06T00:00:00.000Z"`), producing the concatenated value `"2026-05-06T00:00:00.000ZT12:00"` — which is not a valid date.

**Fix:** `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` — request card date header (line 1315).

```js
// Before — breaks when requestedDate is a full ISO datetime string
{new Date(req.requestedDate + "T12:00").toLocaleDateString(...)}

// After — extracts just the YYYY-MM-DD portion before appending the time
{new Date((req.requestedDate?.split("T")[0] ?? "") + "T12:00").toLocaleDateString(...)}
```

`.split("T")[0]` handles both date-only strings (`"2026-05-06"` → unchanged) and full ISO strings (`"2026-05-06T00:00:00.000Z"` → `"2026-05-06"`).

---

## Change 2 — Employee Punch Logs: Weekly/Cutoff OT Configuration Card — Meter Shows 0h Instead of Accumulated Hours

**Status:** Shipped (client only).

**Problem:** The "Weekly OT Configuration" (and "Cutoff OT Configuration") card meter always displayed `0h / 40h` with a perpetually-zero progress bar and "No approved OT in this period" footer — even when the employee had several days of worked hours in the period.

**Root cause:** `otConsumptionData.approvedHours` was being used as both the meter value and the primary stat. For weekly/cutoff OT, `approvedHours` reflects formally approved OT requests from the approval flow — not accumulated worked hours. Since OT requests are only submitted after the eligibility threshold is crossed, the meter always read `0` during the pre-threshold accumulation phase, which is the normal state for most of the week/period.

**What the meter should represent:** Progress toward the eligibility threshold (e.g., "you've worked 24h of the 40h needed before OT kicks in"), not approved OT consumption.

**Fix:** `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` — `otConsumptionData` memo and the consumption meter UI block.

**`otConsumptionData` memo (lines 750–757):**

```js
// Added — sum netWorkedHours for logs within the window
const accumulatedHours = parseFloat(windowLogs.reduce((sum, l) => {
  return sum + parseFloat(l.netWorkedHours ?? 0);
}, 0).toFixed(2));

// Changed — meter percentage now tracks threshold progress, not approved OT
const pct = Math.min(100, (accumulatedHours / threshold) * 100);

// Changed — accumulatedHours added to return value
return { type: otBasis, threshold, label, accumulatedHours, approvedHours, pendingHours, pct, window: { ... } };
```

**Card display (lines 1126, 1141–1153):**

```js
// Before
{otConsumptionData.approvedHours}h / {otConsumptionData.threshold}h

// After
{otConsumptionData.accumulatedHours}h / {otConsumptionData.threshold}h
```

Footer text now contextually reflects the phase:
- **Pre-threshold:** `"23.97h accumulated"` · `"16.03h to threshold"`
- **Post-threshold, no approved OT yet:** `"Threshold met — no approved OT yet"` · `"0.50h over threshold"`
- **Post-threshold, OT approved:** `"2.50h approved"` · `"0.50h over threshold"`
- Pending hours badge (`· Xh pending`) unchanged.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` | Invalid Date fix on request cards (Change 1); weekly/cutoff OT meter now tracks accumulated hours (Change 2) |
