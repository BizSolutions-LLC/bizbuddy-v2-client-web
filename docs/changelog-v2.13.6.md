# Changelog — v2.13.6

BB-020 — Request Punch Log conflict check: overlap-based validation replaces day-based block; conflict pre-check at Step 1; My Punch Log Requests card visual redesign.

---

## Change 1 — Request Punch Log: Overlap-Based Conflict Check (BB-020)

**Status:** Shipped (client + server).

**Page:** `/dashboard/employee/punch-logs`

**File:** `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`

**Server version:** v2.10.7

---

### Background

The previous `/submit` endpoint returned 409 for any existing punch log on the same calendar day, regardless of whether the time ranges actually overlapped. This broke multi-shift employees — a second legitimate shift on the same day could not be submitted at all.

The server was updated to use **overlap-based** conflict detection:

> Two ranges conflict when `existingTimeIn < requestedClockOut AND existingTimeOut > requestedClockIn`.
> A punch with no `timeOut` (employee still clocked in) is always treated as a conflict.

A new pre-check endpoint was also added so the frontend can surface conflicts at Step 1 before the user reaches the submit button.

---

### New endpoint — conflict pre-check

```
POST /api/request-punch-log/check-conflict
Authorization: Bearer <token>
```

**Request:**
```json
{
  "requestedClockIn":  "2026-06-01T09:00:00+08:00",
  "requestedClockOut": "2026-06-01T17:00:00+08:00"
}
```

**Response 200 — no conflict:**
```json
{
  "hasConflict": false,
  "conflictingLogId": null,
  "conflictingTimeIn": null,
  "conflictingTimeOut": null
}
```

**Response 200 — conflict found:**
```json
{
  "hasConflict": true,
  "conflictingLogId": "clxxxxxxxxxxxxx",
  "conflictingTimeIn": "2026-06-01T01:00:00.000Z",
  "conflictingTimeOut": "2026-06-01T09:00:00.000Z"
}
```

`conflictingTimeOut` is `null` when the employee is still clocked in (treated as conflict).

---

### Client changes

#### 1 — Removed old day-based client check

The date picker's `onChange` previously searched `logs` for any entry on the selected date and blocked the field with `"A punch log already exists for this date"`. This was incorrect and inconsistent with the new server behavior.

```js
// Removed
const existing = logs.find((l) => toLocalDateStr(l.timeIn, companyTimezone) === d);
if (existing) setRequestErrors((p) => ({ ...p, date: "A punch log already exists for this date" }));
```

The date picker now only clears the `date` and `conflict` error keys on change — no local log lookup.

#### 2 — New `isCheckingConflict` state

```js
const [isCheckingConflict, setIsCheckingConflict] = useState(false);
```

Drives the button disabled state and loading label while the API call is in flight.

#### 3 — Step 1 "Next" button calls check-conflict

The "Next" button handler is now `async`. After local validation passes (date, clock-in, clock-out, ordering), it calls the pre-check endpoint before advancing to Step 2:

```js
setIsCheckingConflict(true);
try {
  const res = await fetch(`${API_URL}/api/request-punch-log/check-conflict`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ requestedClockIn, requestedClockOut }),
  });
  const j = await res.json();
  if (!res.ok) {
    setRequestErrors((p) => ({ ...p, conflict: j.message || "Could not verify availability. Please try again." }));
    return;
  }
  if (j.hasConflict) {
    const fmt = (iso) => iso ? safeTime(iso, companyTimezone) : "ongoing";
    setRequestErrors((p) => ({
      ...p,
      conflict: `Your selected time overlaps with an existing punch log (${fmt(j.conflictingTimeIn)} – ${fmt(j.conflictingTimeOut)}). Please adjust the times.`,
    }));
    return;
  }
} catch {
  setRequestErrors((p) => ({ ...p, conflict: "Could not verify availability. Please try again." }));
  return;
} finally {
  setIsCheckingConflict(false);
}
setRequestStep((s) => s + 1);
```

The conflicting window is formatted via the existing `safeTime` utility with `companyTimezone`, matching the time display used in the rest of the punch log table.

#### 4 — Conflict error display in Step 1

An inline red error renders below the Estimated Net Hours preview when `requestErrors.conflict` is set:

```jsx
{requestErrors.conflict && (
  <p className="text-red-500 text-xs flex items-center gap-1 pt-1">
    <AlertCircle className="h-3 w-3 shrink-0" />{requestErrors.conflict}
  </p>
)}
```

The `conflict` error key is also cleared whenever the user changes Clock In or Clock Out.

#### 5 — Next button: disabled + loading state

```jsx
disabled={(requestStep === 1 && !!requestErrors.date) || isCheckingConflict}
```

```jsx
{isCheckingConflict
  ? <><OrangeLoadingSpinner /><span className="ml-2">Checking...</span></>
  : "Next →"}
```

#### 6 — Submit handler: 409 safety net

If the server returns 409 on submit (race condition — another punch was added after the Step 1 check passed), the user is sent back to Step 1 with the server's conflict message rather than a generic toast:

```js
} else if (res.status === 409) {
  setRequestStep(1);
  setRequestErrors({ conflict: result.message || "A conflict was detected. Please choose different times." });
}
```

---

### What is unaffected

- Steps 2 and 3 of the sheet are unchanged.
- The submit payload is unchanged — no new fields.
- The "My Punch Log Requests" fetch and display are unaffected.
- The Contest Policy flow is unaffected.

---

## Change 2 — My Punch Log Requests: Card Visual Redesign (BB-020)

**Status:** Shipped (client only).

**Page:** `/dashboard/employee/punch-logs`

**File:** `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`

---

### What changed

The request cards in the collapsible "My Punch Log Requests" section were redesigned for better visual hierarchy and scannability.

| Element | Before | After |
|---|---|---|
| Date row leading icon | `Calendar` (orange, always) | Status-contextual icon: `Clock` amber (Pending), `CheckCircle` green (Approved), `XCircle` red (Rejected) |
| Status badge | Colored dot + label | Label only (dot removed, badge color carries the signal) |
| Net hours | Plain text `(7.00h)` inline with time range | Solid orange pill badge `7.00h` right-aligned |
| Reason | `AlertTriangle` + `"Reason:"` label + text | Neutral rounded chip (`bg-black/5`) with reason text only |
| Description | 2-line clamp with `FileText` icon row | 1-line clamp, inline after reason chip |
| Card background | Applied to full card | Applied to body section only; footer uses `bg-background` |
| Footer | Single border-t row | Same layout, now on distinct `bg-background` surface |

**`statusMeta` before:**
```js
{ border, bg, badge, dot, label }
```

**`statusMeta` after:**
```js
{ border, bg, badge, Icon, iconColor, label }
```

`Icon` and `iconColor` replace `dot` — the status icon is rendered directly in the date row instead of the dot-in-badge pattern.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` | Removed day-based date conflict check; added `isCheckingConflict` state; Step 1 Next button calls `check-conflict` pre-check with overlap-aware error message; conflict error display in Step 1; 409 safety net in submit handler; My Punch Log Requests card visual redesign (BB-020) |
