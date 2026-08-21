# Changelog — v2.14.21

BB-075: Cutoff Period Review's green driver-car icon appeared/disappeared for the same employee across different cutoff periods — fixed by sourcing it from the employee's stable admin-assigned driver designation instead of that period's punch data.

BB-076: New Leave Request "Reason" field showed a minimum of 15 characters but the submit validation silently required 30 — fixed by lowering the enforced minimum to match the displayed 15.

---

## BB-075 — Cutoff Review driver-car icon inconsistent across periods for the same employee

**Status:** Fixed (client only).

**Page:** Cutoff Period Review (`/dashboard/company/cutoff-periods/[id]/review`)

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Investigation findings:**
- The green `Car` icon next to an employee's name (line 1195) was driven by `emp.isDriver`, which was recomputed on every fetch from that period's own punch-approval records: `if (details.segmentType !== null) emp.isDriver = true;` — true only if the employee had at least one `driver_am`/`driver_pm`/segment-tagged punch approved in the currently viewed cutoff period.
- Net effect: the same employee (e.g. Evangeline Velasquez) showed the icon in periods where their punches happened to include a driver segment, and lost it in periods where none of their approved records that cutoff carried a segment tag — reported by the user as the icon appearing "randomly assigned."
- Confirmed this wasn't random or index-based — it was a real but unstable signal. A genuine, stable, admin-assigned driver designation already exists elsewhere in the data model: `employmentDetail.isDriver`, the same field the Employees list page (`Organizations&People/Employees.jsx`) already reads to show its own driver icon and lets admins toggle via the Edit Employee modal. `CutoffReview.jsx` simply wasn't fetching it, so it fell back to inferring driver status from that period's punch data instead.
- Confirmed with the user that the icon is meant to represent the fixed employee role, not per-period punch activity.

**Fix:**
- `fetchData()`'s initial load now also calls `GET /api/employee?all=1` (the same endpoint the Employees list page uses) and builds a `{ [userId]: employmentDetail.isDriver }` lookup, stored in a `driverMapRef`.
- All four places that initialize an employee row (`empMap`) — initial-load punch records, initial-load standalone-leave records, the silent-refresh punch path, and the silent-refresh leave path — now set `isDriver` from that stable lookup instead of `false`.
- Removed both `if (details.segmentType !== null) emp.isDriver = true;` overrides (initial load and refresh) that were recomputing the flag from that period's punch data.
- Secondary effect: `emp.isDriver` is also read at line 1287 to suppress the "Training Day" sub-header for driver employees. That suppression is now role-based (consistent across periods) instead of period-based, which is more correct — flagged to and accepted by the user as in-scope.

**Server-repo impact:** None — `employmentDetail.isDriver` was already exposed by the existing `/api/employee` endpoint; this was a client-side data-fetching/mapping fix only.

### Files Changed

| File | Changes |
|---|---|
| `.../Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | Added `GET /api/employee?all=1` fetch and a `driverMapRef` lookup built from `employmentDetail.isDriver`; all four `empMap` employee-row initializations now source `isDriver` from that stable map instead of deriving it per-period from punch `segmentType`; removed the two `segmentType`-based overrides. |

## BB-076 — New Leave Request "Reason" field: displayed minimum (15) didn't match enforced minimum (30)

**Status:** Fixed (client only).

**Page:** New Leave Request modal (`/dashboard/employee/leave-logs`)

**File:** `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx`

**Investigation findings:**
- The Reason field's live character counter (`{reason.trim().length}/15 min`, line 1425) and textarea placeholder ("at least 15 characters", line 1431) both told the user 15 characters was the minimum, and the counter turned green once 15 was reached.
- The actual submit-handler validation (lines 566-567) and the Submit button's `disabled` condition (line 1459) both required 30 characters.
- Net effect: a user typing 15-29 characters saw a green "requirement met" signal, but the Submit button stayed disabled — the exact symptom reported.
- Confirmed with the user that 15 is the intended minimum, so the enforcement was brought down to match the display rather than the other way around.
- No shared validation utility exists in this repo (no zod/yup, no `lib/validations`); each form hardcodes its own thresholds inline, which is how the 15/30 values drifted apart in the first place.

**Fix:**
- Line 566-567: submit-handler validation now checks `reason.trim().length < 15` and the error message reads "must be at least 15 characters (X/15)".
- Line 1459: Submit button `disabled` condition now checks `reason.trim().length < 15`.
- Lines 1425 and 1431 (counter label and placeholder) were already correct at 15 — no change needed.

**Server-repo impact:** None — purely client-side display/validation logic, no API contract involved.

### Files Changed

| File | Changes |
|---|---|
| `.../Leaves/LeaveLogs.jsx` | Submit-handler Reason validation and Submit button's `disabled` check both lowered from a 30-character minimum to 15, matching the already-correct displayed counter/placeholder. |
