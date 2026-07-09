# Client-Side Changelog — v2.12.1

Patch release. Bug fixes only — no API changes required.

---

## Fix 1 — `Schedules.jsx`: Shift Times in Create Recurring Schedule Modal Displayed in Browser Local Timezone

**Status:** Shipped (client only).

**Problem:** The shift dropdown inside the Create Recurring Schedule modal was rendering shift start/end times using the browser's local timezone instead of UTC. Shift times are stored as naive UTC (e.g., a 9:00 AM shift is stored as `T09:00:00Z` — the hour value is the company timezone hour, with no offset conversion applied). Without an explicit `timeZone: "UTC"` option, `toLocaleTimeString()` falls back to the browser's local timezone, producing wrong times for all users regardless of their location:

- Manila browser (UTC+8): `T09:00:00Z` → displayed as **5:00 PM** ✗
- PDT browser (UTC−7): `T09:00:00Z` → displayed as **2:00 AM** ✗

**Fix:** Added `timeZone: "UTC"` to the `fmtShiftTime()` helper in `Schedules.jsx`. This is consistent with how `Shifts.jsx` handles the same data via `fmtClock()` and `fmtClockWith12Hour()`.

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/Schedules.jsx`
- `fmtShiftTime()` — line 165

---

## Fix 2 — `ConflictModal.jsx`: Conflicting Shift Times Displayed in Browser Local Timezone

**Status:** Shipped (client only).

**Problem:** The conflict resolution overlay — shown when a recurring schedule creation detects existing conflicting schedules — rendered conflicting shift times via `formatTime()` without an explicit `timeZone`. Same root cause as Fix 1: naive UTC shift times interpreted in the browser's local timezone, producing incorrect times for all users.

**Fix:** Added `timeZone: "UTC"` to the `formatTime()` helper in `ConflictModal.jsx`.

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/ConflictModal.jsx`
- `formatTime()` — line 300

---
