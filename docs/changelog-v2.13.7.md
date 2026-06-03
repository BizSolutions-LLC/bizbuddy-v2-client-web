# Changelog — v2.13.7

Request Punch Log: cross-midnight clock-out support — when clock-out time is earlier than clock-in time, the clock-out date is automatically advanced to the next day, resolving the "Clock in must be before clock out" error for night shift employees.

---

## Change 1 — Request Punch Log: Cross-Midnight Clock-Out Support

**Status:** In Development (client only).

**Page:** `/dashboard/employee/punch-logs`

**File:** `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`

---

### Background

Employees working night shifts (e.g., 10:00 PM to 6:00 AM) could not submit a punch log request. The Step 1 "Next" button validation at line 1957:

```js
if (requestClockIn && requestClockOut && requestClockIn >= requestClockOut) errors.clockIn = "Clock in must be before clock out";
```

compares the full datetime strings. With both clock-in and clock-out stored on the same date, a clock-out of `2026-06-03T06:00` is lexicographically less than a clock-in of `2026-06-03T22:00`, so the validation always fired and blocked submission. There was no way around it — the form had no concept of overnight spans.

---

### Fix

The clock-in and clock-out `onChange` handlers now detect when the clock-out time is earlier than the clock-in time and automatically advance the clock-out date to the next day. No changes were made to the Step 1 validation itself — the ordering check now passes naturally because the full datetime strings are ordered correctly.

#### Clock In `onChange`

When the user adjusts clock-in, if a clock-out is already set and its time-of-day would now fall before the new clock-in time, the clock-out date is promoted to the next day (and demoted back to the punch date if the user corrects clock-in to be earlier again):

```js
onChange={(e) => {
  const inTime = e.target.value;
  setRequestClockIn(`${requestPunchDate}T${inTime}`);
  if (requestClockOut) {
    const outTime = requestClockOut.split("T")[1] || "";
    const isCrossMidnight = outTime && inTime && outTime < inTime;
    let outDate = requestPunchDate;
    if (isCrossMidnight) {
      const d = new Date(`${requestPunchDate}T12:00`);
      d.setDate(d.getDate() + 1);
      outDate = d.toLocaleDateString("en-CA");
    }
    setRequestClockOut(`${outDate}T${outTime}`);
  }
  setRequestErrors((p) => ({ ...p, clockIn: undefined, conflict: undefined }));
}}
```

#### Clock Out `onChange`

When the user sets the clock-out time and it is earlier than the current clock-in time, the clock-out date is set to the next day:

```js
onChange={(e) => {
  const outTime = e.target.value;
  const inTime = requestClockIn.split("T")[1] || "";
  const isCrossMidnight = outTime && inTime && outTime < inTime;
  let outDate = requestPunchDate;
  if (isCrossMidnight) {
    const d = new Date(`${requestPunchDate}T12:00`);
    d.setDate(d.getDate() + 1);
    outDate = d.toLocaleDateString("en-CA");
  }
  setRequestClockOut(`${outDate}T${outTime}`);
  setRequestErrors((p) => ({ ...p, clockOut: undefined, conflict: undefined }));
}}
```

`en-CA` locale produces `YYYY-MM-DD` format, consistent with `requestPunchDate`.

---

### UI indicators

#### "+1 / Clock-out on the next day" hint (Step 1)

An amber hint renders below the Clock Out field whenever the stored clock-out date is after the punch date:

```jsx
{requestClockOut.split("T")[0] > requestPunchDate && (
  <p className="text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-1">
    <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold">+1</span>
    Clock-out on the next day
  </p>
)}
```

#### "+1 day" badge (Step 2 review summary)

The Clock Out row in the Step 2 summary now shows a "+1 day" badge when the clock-out date is on the next day:

```jsx
<span className="font-semibold text-red-600 flex items-center gap-1.5">
  {requestClockOut.split("T")[1] || "—"}
  {requestClockOut.split("T")[0] > requestPunchDate && (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">+1 day</span>
  )}
</span>
```

---

### What is unaffected

- The Step 1 "Clock in must be before clock out" validation string is unchanged — it now passes naturally for overnight spans.
- The conflict pre-check (`/api/request-punch-log/check-conflict`) receives correctly dated ISO strings and requires no changes.
- The submit payload is unchanged — `requestedClockIn` and `requestedClockOut` were already full ISO datetime strings.
- Steps 2 and 3 of the sheet are otherwise unaffected.
- The "My Punch Log Requests" fetch and display are unaffected.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` | Clock In and Clock Out `onChange` handlers auto-advance clock-out date when time-of-day crosses midnight; amber "+1 / Clock-out on the next day" hint below Clock Out field in Step 1; "+1 day" badge on Clock Out row in Step 2 review summary (Change 1) |
