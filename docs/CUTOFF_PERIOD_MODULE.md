# Cutoff Period Behaviour — Authoritative Reference

This document is the canonical source of truth for how cutoff period approvals work across
all company types. Server-side strategy code and client-side UI logic must conform to these
rules. Reference this document first when a bug is reported or a new feature is planned.

Last updated: 2026-11-25 (BB-149 — Training paid real net hours with no 8 h cap, counts toward the OT basis, open training punch can't be approved; see docs/TIMEKEEPING_GLOSSARY.md)

See also: [`TIMEKEEPING_GLOSSARY.md`](./TIMEKEEPING_GLOSSARY.md) for canonical term definitions
(Raw/Effective Clock-In, Worked Duration, TR, SL, OT) shared with the client-side application.

---

## Company Type Matrix

| Company Type       | isDayCare | isDriver | isBNC | OT Basis        |
|--------------------|-----------|----------|-------|-----------------|
| DayCare — Driver   | true      | true     | false | 80 h / period   |
| DayCare — Regular  | true      | false    | false | 80 h / period   |
| B&C                | false     | false    | true  | 8 h / day       |

`isBNC` is determined by membership in `BNC_COMPANY_IDS` (see `src/config/companyTypes.js`).
`isDriver` is determined by the employee having Driver/Aide shift assignments.

---

## Company Settings Fields

These four fields on the `Company` model affect how hours and OT are computed. Each field's
scope and effect is different — understand them independently.

### 1. `gracePeriodMinutes` (default: 15)

**What it is:** A forgiveness threshold for late clock-ins and early clock-outs.

**Formula:** `graceMs = (gracePeriodMinutes × 60 + 59) × 1000`
The +59 seconds gives a small buffer so e.g. 15:00 exactly still clears the gate.

**Effects:**

| Location | Effect |
|----------|--------|
| `timeLogComputeService` — lateHours | If `timeIn − shiftStart ≤ graceMs`, `lateHours = 0`. Once exceeded, the full raw lateness is charged (grace is not subtracted from the penalty, it is a gate). |
| `timeLogComputeService` — undertimeHours | Same gate logic: if `shiftEnd − timeOut ≤ graceMs`, `undertimeHours = 0`. |
| `timeLogComputeService` — rawOtMinutes | OT is only counted if `timeOut − shiftEnd > graceMs`. Minutes within grace after shift end are not OT. |
| `timeLogComputeService` — netWorkedHours (non-driver) | If clock-in is late but within grace (`isLateWithinGrace = true`), `effectiveTimeIn` snaps to `shiftStart`, crediting full shift hours. |
| `daycareCutoffStrategy` — Raw approval (non-driver) | If clock-in is late by ≤ `graceMs`, `finalClockIn` snaps to scheduled start. The displayed `approvedClockIn` is the actual punch but hours are credited from scheduled start. |
| `daycareCutoffStrategy` — Schedule approval (non-driver) | Same grace check: if late by ≤ `graceMs`, `finalClockIn` snaps to scheduled start; otherwise keeps actual late clock-in. |
| `daycareCutoffStrategy` — Driver/Aide segment path | **Grace is NOT applied to `driverAmSegmentHours`, `regularSegmentHours`, or `driverPmSegmentHours`.** Segment hours always use `max(timeIn, segmentStart)` without grace. The grace gate still controls `lateHours` and `rawOtMinutes` (computed in `timeLogComputeService`). |

### 2. `shiftAssignmentWindowMinutes`

**What it is:** A window (in minutes) defining how far before or after a shift start time a
clock-in can be automatically matched to that shift.

**Current status: STORED BUT NOT USED.** This field is read and written by
`companySettingsController.js` but is not referenced in any computation service or strategy.
It has no effect on the system today. Do not rely on it until it is wired up.

### 3. `earlyClockInGraceMinutes` (default: null)

**What it is:** Controls whether an abnormally early clock-in is flagged as "too early."

**Applies to:** `timeLogComputeService` (compute time, not approval time).

| Value | Behaviour |
|-------|-----------|
| `null` | Unlimited — any early clock-in snaps `effectiveTimeIn` to `shiftStart`. No "too early" flag. (Backwards-compatible default.) |
| `N` (integer) | If `shiftStart − timeIn > N minutes`, sets `isTooEarlyPunch = true` and uses the raw `timeIn` (no snap). The pre-shift time is included in `netWorkedHours` and surfaced for admin review. |

**Effect on Driver/Aide:** Flag only (`isTooEarlyPunch` is stored on the TimeLog). Segment
hours are unaffected because `computeSegmentHours` already clamps with `max(timeIn, segStart)`.

**Effect on non-driver Regular:** Controls `effectiveTimeIn`. If not too early, `effectiveTimeIn`
snaps to `shiftStart`, preventing pre-shift time from inflating `netWorkedHours`.

### 4. `earlyClockOutGraceMinutes` (default: 20)

**What it is:** If a Driver PM employee clocks out slightly before PM shift end, snap
their `timeOut` forward to PM end so they receive credit for the full PM segment.

**Applies to:** Driver/Aide punchTypes only (`isDriverPm` flag in `timeLogComputeService`).

**Trigger:** `isDriverPm = true` AND `timeOut < pmEnd` AND `pmEnd − timeOut ≤ earlyClockOutGraceMinutes`.

**Critical detail:** The snap is a **permanent DB write** (`timeOut` on the `TimeLog` is
updated to `pmEnd`). It happens during `computeTimeLogSummary`, before any approval action.
All downstream fields — `grossHours`, `driverPmSegmentHours`, `undertimeHours`,
`rawOtMinutes` — see the snapped value. The approval action then operates on this already-snapped `timeOut`.

---

## Approval Actions by Company Type

### DayCare — Driver (isDayCare: true, isDriver: true)

**Punch structure:** One `TimeLog` per day, three `TimeLogApproval` records per punch
(one per segment: `driver_am`, `regular`, `driver_pm`). Each approval has `segmentStart` and
`segmentEnd` pre-populated from the catalog shift times at creation.

**Actions are per-segment.** The three segments are approved independently.

#### Schedule
**Intent:** Accept the full scheduled window regardless of actual punch times.

Server behaviour:
- `approvedClockIn`  = `segmentStart` (window start, e.g. 6:45 AM)
- `approvedClockOut` = `segmentEnd` (window end, e.g. 8:00 AM)
- `actualHours`      = `segmentEnd − segmentStart` (full window, e.g. 1.25 h)
- Payable displayed  = full window duration

Grace period note: if the employee was late by ≤ `gracePeriodMinutes`, `lateHours = 0`
(no late penalty). Schedule approval always pays the full window regardless.

#### Raw
**Intent:** Accept the actual time the employee was present within the segment window.

Server behaviour:
- `approvedClockIn`  = `max(timeLog.timeIn, segmentStart)` — clips to segment window start;
  the global clock-in time is never used directly because it precedes the segment for PM/Regular
- `approvedClockOut` = `segmentEnd` — segment end always caps the out time
- `actualHours`      = `approvedClockOut − approvedClockIn`
- Time past `segmentEnd` (e.g. clock-out after 2:45 PM on PM segment) is **not** part of the
  segment hours; it is handled as OT via `recomputeOtForTimeLog`
- Grace period: NOT applied within the Driver segment path. Raw gives actual within-window time.

#### Exclude
**Intent:** Do not include this segment in payroll.

Server behaviour:
- `status` → `"excluded"` on the `TimeLogApproval`
- `actualHours`, `approvedClockIn/Out`, `scheduledHours` remain null
- OT is NOT recomputed automatically — see Constraints section

---

### DayCare — Regular (isDayCare: true, isDriver: false)

**Punch structure:** One `TimeLog` per day, one `TimeLogApproval` per punch.

#### Schedule
**Intent:** Snap punch to the assigned shift window.

Server behaviour:
- `finalClockIn`  = `scheduledClockIn` if not edited (grace check: if late by ≤ `graceMs`, snap; if late by > `graceMs`, keep actual late time)
- `finalClockOut` = `min(actualClockOut, scheduledClockOut)` (capped at shift end unless `withOT = true`)
- `timeIn` and `timeOut` on the `TimeLog` are **overwritten** with `finalClockIn`/`finalClockOut`
- `originalTimeIn`/`originalTimeOut` are saved for Reset
- `actualHours` = `finalClockOut − finalClockIn`
- `computeTimeLogSummary` runs after the TimeLog update

#### Raw
**Intent:** Accept the actual punch times, with grace-period clock-in snap only.

Server behaviour:
- Grace check on clock-in: if late by ≤ `graceMs`, `finalClockIn` snaps to scheduled start
- `timeIn` and `timeOut` on the `TimeLog` are **overwritten** (originalTimeIn/Out saved)
- `approvedClockIn` stored as the raw actual punch-in (not the snapped value)
- `actualHours` = `finalClockOut − finalClockIn`

#### Training
**Intent:** Mark the day as a training day; pay it for the time worked, like a regular punch.

Server behaviour (BB-149):
- `actualHours` = **real net hours**: clock span − coffee breaks − lunch deduction (company
  minimum lunch applies, same as a regular punch). No shift snap, **no cap**.
- The server recomputes the TimeLog first (`applyTrainingHours`), so `tl.netWorkedHours` and
  `approval.actualHours` hold the same value — the punch log and the approval always match.
- `approvedClockIn`/`approvedClockOut` = actual punch times (raw, no snap)
- `TimeLog.timeIn`/`timeOut` are **NOT modified**
- **Open punch (no clock-out):** approval is refused with 400 *"This training punch has no
  clock-out yet. Approve it after the employee clocks out."* Bulk approve counts it as failed
  (200 with `data.failed`).

Examples:
- 3 h training → 3 h (minus any breaks/lunch). It used to show a flat 8 h before approval.
- 10 h training with a 30 min lunch → 9.5 h. It used to be capped at 8 h.

**Training and OT:** Training `actualHours` count toward both TOTAL PAYABLE and the OT basis,
like any other worked hour.

```
OT basis      = Σ actualHours (ALL approved punch records, including Training)
              = 87.38h (non-training) + 8h (training) = 95.38h
OT            = 95.38h − 80h threshold = +15.38h

TOTAL PAYABLE = 95.38h
```

**Display rule:** Training records render as normal rows — same opacity, same hours column —
just identified with a "Training" label. They are NOT grayed out. Never hard-code 8 h for
training.

**Past records:** only new approvals and recomputes use this rule. Training already approved in
an open cutoff keeps its old capped value until it's Reset and approved again. Locked/processed
cutoffs are not changed.

#### Edit
**Intent:** Manually correct clock-in or clock-out before approving.

Server behaviour:
- `editedClockIn`/`editedClockOut` override the raw punch values
- Flow then follows the Schedule path with the edited values

#### Exclude
Same as Driver Exclude above.

---

### B&C (isDayCare: false, isBNC: true)

**Punch structure:** One `TimeLog` per day, one `TimeLogApproval` per punch.
Employees may have multiple shifts assigned on the same day; the system selects the best
match via `matchShiftToWindow` (max-overlap algorithm).

#### Schedule
**Intent:** Snap to the correct assigned shift.

Server behaviour:
- If employee has more than one shift on that day, the UI presents a shift-picker modal;
  the approver selects which shift applies before confirming
- Once selected, snap logic is the same as DayCare Regular Schedule above
- `timeIn`/`timeOut` overwritten; `originalTimeIn`/`originalTimeOut` saved

#### Raw
Same as DayCare Regular Raw.

#### Edit
Same as DayCare Regular Edit.

#### Exclude
Same as DayCare Regular Exclude.

---

## OT Configuration

### DayCare — 80 h / period (`otBasis: "cutoff"`)

OT is computed once per employee per cutoff period, not per day.

Computation (`cutoffOtService.computeOtForCutoffBasis`):
1. Sum `actualHours` across **all approved** `TimeLogApproval` records in the period, Training included
2. `otHours = max(0, otBasisHours − cutoffOtThresholdHours)`
3. Upsert one `CutoffOtBlock` per employee per period

**Training records count toward the OT basis and TOTAL PAYABLE (BB-149).** Training is now paid
for the real time worked (no cap), so it is worked time like a regular punch. This replaces the
earlier rule (v2.10.22+) that kept Training out of the OT basis because it was a flat, capped
credit. Daily-OT (B&C) companies already counted training — no change there.

```
OT basis      = Σ actualHours (ALL approved punch records, including Training)
TOTAL PAYABLE = Σ actualHours (ALL approved punch records, including Training) + leave

OT = max(0, OT basis − cutoffOtThresholdHours)
```

Concrete example: 87.38 h non-training + 8 h training
→ OT basis = **95.38 h** → OT = 95.38 − 80 = **+15.38 h**
→ TOTAL PAYABLE = **95.38 h**

The OT breakdown (`otBlocks[].breakdown`) still returns training rows in `days[]` with
`isTraining: true` (a label only); `breakdown.totalHours` includes them.

**Approved leave hours are excluded from the OT basis** — they are a paid credit, not worked
time, and including them would let leave manufacture OT
premium on other hours (double compensation). Because conflicting punches are auto-excluded
(see Approved Leave Handling section) and standalone leave rows have no `TimeLogApproval`,
leave hours never enter `computeOtForCutoffBasis` naturally today. Note: whether *all* paid
leave (not just sick leave) should be excluded this way, and how `Leave.isPaid` factors in, is
still being scoped — see Open Items in `docs/TIMEKEEPING_GLOSSARY.md`.

**OT is recomputed automatically after every approval action** (approve / reset / auto-exclude).
It is NOT recomputed after Exclude if the excluded record was previously approved — see Constraints.

The OT block itself has its own approval action (`approve` or `exclude`) separate from the
punch-level approval.

### B&C — 8 h / day (`otBasis: "daily"`)

OT is computed per day, per employee.

Computation (`cutoffOtService.computeOtForDailyBasis`):
- `otHours = max(0, totalHoursOnDay − dailyOtThresholdHours)`
- Approved leave hours are excluded from the daily total for the same reason as above.

---

## Approved Leave Handling in Cutoff Period

### Leave Hours Per Day

The payable hours a leave day contributes depend on the employee type:

| Employee Type         | Leave Hours / Day | Source |
|-----------------------|-------------------|--------|
| DayCare — Driver      | `defaultShiftHours` | Company setting; fallback 8 h |
| DayCare — Regular     | 5.5 h             | Fixed constant for DayCare non-driver |
| B&C                   | Actual shift hours for that calendar day | Look up `UserShift`; fallback `defaultShiftHours` (8 h) |

**DayCare employee type detection:** check whether the employee has any `DRIVER_AIDE`
punch records in the current cutoff period. If yes → Driver (use `defaultShiftHours`).
If no → Regular (use 5.5 h).

**B&C shift lookup:** find the `UserShift` record for that employee on the leave date.
Sum `shift.endTime − shift.startTime` for the assigned shift. If no shift is found,
fall back to `company.defaultShiftHours` (8 h).

---

### Leave Always Wins — Auto-Exclusion Rule

When an employee has both a `TimeLogApproval` punch record and an **approved leave** on the
same calendar day, leave always takes precedence. The server automatically excludes the punch.

**When it runs:** inside `getCutoffApprovals`, after the sync step, before the approval
records are fetched for the response. Runs on every load of an open cutoff.

**What happens:**
1. All approved leaves overlapping the cutoff period are fetched
2. Each leave is expanded to individual calendar days
3. For each leave day, any **pending** `TimeLogApproval` records for that employee on that
   day are set to `status = "excluded"`, `notes = "Auto-excluded: approved leave on this day"`
4. `recomputeOtForTimeLog` is called for each auto-excluded punch (removes its hours from OT)
5. The excluded punch still appears in the approval list so the admin can see it was excluded and why

**Already-approved punches:** if a punch was approved before the leave was approved,
it is reset to `pending` first, then auto-excluded. This ensures leave always takes precedence
regardless of approval order.

**Admin cannot override:** there is no UI path to approve a punch that has a same-day
approved leave. The `approveSingle` / `approveBulk` endpoint will reject the action if a
conflicting approved leave is detected.

---

### TOTAL PAYABLE Formula (with Leave)

```
TOTAL PAYABLE = Σ approval.actualHours        (all approved punch records, incl. Training)
              + Σ leaveHours                  (all standalone approved leave rows)
              + leave hours from conflict days (covered automatically — punch is excluded,
                                               leave row fills the day)
```

The server attaches `leaveHours` to each standalone leave row in the response so the client
can include it in the sum without recomputing.

### OT Basis Formula (Leave Excluded)

```
OT basis = Σ approval.actualHours (approved punch records only, incl. Training)
           ← leave hours are NEVER included

OT = max(0, OT basis − threshold)
```

Leave hours do not enter the OT basis because:
- Auto-excluded punches have no `actualHours` contribution
- Standalone leave rows have no `TimeLogApproval` record to read from
- `computeOtForCutoffBasis` reads only from `TimeLogApproval`, so leave is naturally excluded

### Summary Table

| Hours source | TOTAL PAYABLE | OT basis |
|---|---|---|
| Approved punch (REGULAR / TRAINING) | ✅ | ✅ |
| Auto-excluded punch (leave conflict) | ❌ (replaced by leave row) | ❌ |
| Standalone approved leave row | ✅ (`leaveHours`) | ❌ |

---

## Approval State Machine

```
              ┌─────────┐
              │ pending │◄──────────────────────────────────┐
              └────┬────┘                                    │
                   │                                         │ Reset
         ┌─────────┴──────────┐                             │ (approved or excluded)
         │                    │                             │
         ▼                    ▼                             │
    ┌──────────┐         ┌──────────┐                  ┌───┴──────┐   ┌──────────┐
    │ approved │─────────►  Reset   ├─────────────────►│ pending  │◄──┤ excluded │
    └──────────┘         └──────────┘                  └──────────┘   └──────────┘
         │                                                                  ▲
         └──────────────────── Exclude ───────────────────────────────────►┘
```

Key rules:
- **Exclude** is only reachable from `pending` — `approveSingle` throws if `status !== "pending"`.
- **Reset** works on both `approved` and `excluded` → returns record to `pending`.
- **Bulk exclude** additionally guards to `status: "pending"` in the DB query.
- A cutoff period cannot be locked until all records are either `approved` or `excluded`.
- Reset is blocked on `locked` and `processed` cutoff periods.

---

## Reset Behaviour (Detail)

### Non-driver DayCare and B&C records
1. Restore `TimeLog.timeIn` ← `originalTimeIn`, `TimeLog.timeOut` ← `originalTimeOut`
2. Set `TimeLog.isApproved = false`
3. Run `computeTimeLogSummary` against restored raw times
4. Clear on `TimeLogApproval`: `status → "pending"`, `actualHours`, `approvedClockIn`,
   `approvedClockOut`, `approvedBy`, `approvedAt`, `editedHours`, `scheduledHours` → null
5. Call `recomputeOtForTimeLog` (OT total drops)

### Driver/Aide segment records
The TimeLog's `timeIn`/`timeOut` are **not modified during segment approval** (the strategy
only writes to `TimeLogApproval`). The early clock-out grace snap writes to the TimeLog
during `computeTimeLogSummary` (before approval), not during approval itself.

Reset behaviour:
1. `originalTimeIn` is null → only sets `TimeLog.isApproved = false`
2. Clear on `TimeLogApproval`: same fields as above
3. Call `recomputeOtForTimeLog`

---

## Payable Hours Computation (enrichApprovals)

The `enrichApprovals` function in `cutoffPeriodController.js` maps each approval to its
displayed and payable hours. Understanding the source of each value prevents display bugs.

### Non-driver records (REGULAR punchType)
- `segmentHours` (payable) = `tl.netWorkedHours` ?? `grossHours`
- `segScheduledHours`      = `tl.scheduledHours`

### Training records (TRAINING punchType)
Training approval does **not** update `TimeLog.timeIn`/`timeOut`. Since BB-149 it does
recompute the TimeLog's hours first (`applyTrainingHours`), so both sources hold the same value.

| Source | What it holds |
|--------|---------------|
| `tl.netWorkedHours` | Real net hours: span − coffee breaks − lunch deduction, no cap (BB-149) |
| `approval.actualHours` | The same net hours — written at approval time |

**Rule:** For approved Training records, `enrichApprovals` reads `approval.actualHours`
(Bug 4 fix). Since BB-149 this matches `tl.netWorkedHours`, except for training approved
under the old capped rule, which keeps its capped `actualHours` until Reset and re-approved.

`approval.actualHours` is also the value that feeds into `computeOtForCutoffBasis` — so TOTAL
PAYABLE and the OT basis are computed from the same source.

### Driver/Aide records
For each segment type, `segmentHours` (payable) and `segScheduledHours` are:

| Segment     | segmentHours source           | segScheduledHours source |
|-------------|-------------------------------|--------------------------|
| `driver_am` | `tl.driverAmSegmentHours`     | `segmentEnd − segmentStart` (window) |
| `regular`   | `tl.regularSegmentHours`      | `segmentEnd − segmentStart` (window) |
| `driver_pm` | `tl.driverPmSegmentHours`     | `segmentEnd − segmentStart` (window) |

`tl.driverXxxSegmentHours` are computed by `computeSegmentHours`:
```
hours = max(0, min(timeOut, segEnd) − max(timeIn, segStart))
```
This gives actual time within the window using raw punch times. It does not apply grace.

**Rule:** When a Driver/Aide segment is approved as Schedule, the payable hours must equal
the full window (`segmentEnd − segmentStart`), not the raw within-window time. When approved
as Raw, the payable hours equal the actual within-window time.
`enrichApprovals` must use `approvalMode` to select the correct source.

---

## Known Bugs and Fixes (Applied v2.10.17+)

### Bug 1 — enrichApprovals: Schedule-approved Driver segments paid raw hours (FIXED)
**Symptom:** Driver AM approved as Schedule showed 1.18 h (actual within-window) instead
of 1.25 h (full window 6:45–8:00). Payable total was understated.

**Root cause:** `enrichApprovals` always read `tl.driverAmSegmentHours` from the TimeLog
(computed as `max(timeIn, segStart) → segEnd` without any mode awareness) regardless of
whether the segment was approved as Schedule or Raw.

**Fix:** For approved segment records, compute `segmentHours` from `approvedClockIn` and
`approvedClockOut` on the `TimeLogApproval` record itself. These already reflect the correct
mode: Schedule sets `approvedClockIn = segmentStart`; Raw (after Bug 2 fix) sets
`approvedClockIn = max(timeIn, segmentStart)`. A guard skips records where
`approvedClockIn < segmentStart` (historical bad records written before Bug 2 fix) and falls
back to the stored TimeLog value for those.

**Fix location:** `src/controllers/Features/cutoffPeriodController.js` — `enrichApprovals`.

### Bug 2 — daycareCutoffStrategy: Raw segment stored wrong approvedClockIn for PM (FIXED)
**Symptom:** Driver PM approved as Raw stored `approvedClockIn = 6:49 AM` (global clock-in)
and `approvedClockOut = 2:45 PM`, giving `actualHours ≈ 7.93 h` instead of 1.25 h. This
inflated the OT period total and could create false OT.

**Root cause:** Raw mode used `new Date(timeLog.timeIn)` directly as `approvedIn` without
clipping to `segmentStart`. The global clock-in (6:49 AM) precedes the PM segment window
(1:30 PM), so the stored hours spanned the entire day up to PM end.

**Fix:** `approvedIn` for Raw is now `max(timeLog.timeIn, segmentStart)`. This ensures PM
and Regular segments never credit time before their window begins.

**Fix location:** `src/services/Cutoff/daycareCutoffStrategy.js` — both the single-record
path (approveSingle) and the bulk path (approveBulk), DRIVER_AIDE segment block.

### Bug 3 — Excluded records could not be reset (FIXED)
**Symptom:** A record accidentally excluded had no path back to `pending`. `resetApproval`
rejected anything that was not `approved`.

**Fix:** `resetApproval` now accepts both `approved` and `excluded` statuses. For excluded
records, there is no TimeLog to restore (exclude never modifies `timeIn`/`timeOut`), so the
reset simply clears the approval fields and sets `isApproved = false`.

**Fix location:** `src/controllers/Features/cutoffPeriodController.js` — `resetApproval`.

### Bug 4 — enrichApprovals: Training records read wrong payable hours source (FIXED)
**Symptom:** An approved Training record's `payableRegularHours` in the response reflected
`tl.netWorkedHours` (raw punch duration) instead of `approval.actualHours` (capped value).
If the employee punched more than `defaultShiftHours`, the displayed value was overstated.

**Root cause:** `enrichApprovals` dispatched non-`DRIVER_AIDE` records to a single branch
that always read `tl.netWorkedHours`. Training approval does not update the TimeLog or call
`computeTimeLogSummary`, so `tl.netWorkedHours` retained the raw pre-cap punch duration.

**Fix:** In `enrichApprovals`, when `approval.status === "approved"` and
`approval.actualHours != null`, `approval.actualHours` is used as `segmentHours` for all
non-driver punchTypes (REGULAR, TRAINING). Pending records continue reading from the
TimeLog fields as a preview.

**Fix location:** `src/controllers/Features/cutoffPeriodController.js` — `enrichApprovals`,
non-driver branch.

**BB-149 note:** the cap is gone and Training approval now writes the same net hours to
`tl.netWorkedHours`, so the two sources no longer diverge for new approvals. The fix still
matters for training approved under the old capped rule.

### Bug 5 — TOTAL PAYABLE display excludes Training hours (PENDING FIX)
**Symptom:** The cutoff period summary shows `TOTAL PAYABLE = 87.38 h` for a period where a
Training day (8 h, approved) also exists. Expected total: `87.38 h + 8 h = 95.38 h`.

**Root cause:** The client derives TOTAL PAYABLE from `otBlocks.breakdown.totalHours`, which
(due to Bug 6) currently excludes Training records from the OT basis sum.

**Fix (planned — client-side):** TOTAL PAYABLE must be the sum of `payrollSummary.payableRegularHours`
across all approved records (once Bug 4 is fixed), or `approval.actualHours` directly.
Do NOT derive TOTAL PAYABLE from `otBlocks.breakdown.totalHours`.

**Note:** Once Bug 6 is also fixed, `otBlocks.breakdown.totalHours` will include Training and
equal TOTAL PAYABLE — but the client should still sum from individual records rather than
depend on the OT block total, which is employee-scoped (not a full period sum).

### Bug 6 — computeOtForCutoffBasis excludes Training from OT basis (SUPERSEDED — see below)
**Symptom:** OT was computed only on non-Training hours. With 87.38 h non-training + 8 h
training (approved), the old code produced OT = 7.38 h instead of what this fix considered
correct, 15.38 h.

**Root cause (as understood at the time):** `computeOtForCutoffBasis` filtered records with
`punchType: { not: "TRAINING" }`, excluding training from the period total. The interpretation
applied here was that "no OT for training" only means a training day cannot exceed
`defaultShiftHours` credits on its own (the cap handles that) — not that those credits should
be invisible to the period OT threshold.

**Original fix (now superseded):** Removed the `punchType` filter from the query, folding
Training into the OT basis. The OT breakdown `totalHours` in `getCutoffApprovals` was updated
to match (included training in the reduce).

**Why this was superseded (v2.10.22+):** This fix was incomplete. Training is a flat, capped,
non-OT-eligible credit. Leaving it inside the total that's compared against the fixed period
Threshold doesn't just pay its own flat 8 h — it also pushes 8 h of the employee's *other,
already-worked* hours across the OT line, manufacturing OT premium that was never actually
worked. Concretely: 87.38 h worked (10 real days) alone would produce 7.38 h OT against an 80 h
threshold; adding an unrelated 8 h training day should not turn that into 15.38 h OT — the
training day is fully paid on its own and shouldn't also inflate OT on the other days.

**Second fix (v2.10.22+, superseded by BB-149 — see below):** Training `actualHours` is again excluded from the OT-basis comparison (back to
7.38 h in the example above), but — unlike the pre-Bug-6 state — Training is still fully
counted in `TOTAL PAYABLE`. The two figures now diverge on purpose: `TOTAL PAYABLE` reflects
everything the employee is paid for; the OT basis reflects only hours worked beyond the period
baseline. See `docs/TIMEKEEPING_GLOSSARY.md` for the full formula and reasoning (`TR`/`SL`
subtraction).

**Fix location:** `src/services/Cutoff/cutoffOtService.js` — `computeOtForCutoffBasis`;
`src/controllers/Features/cutoffPeriodController.js` — OT breakdown `totalHours` reduce.

**Superseded again by BB-149 (2026-11-25):** the reasoning above relied on Training being a
flat, capped 8 h credit. BB-149 removed the cap — Training is now paid the real net hours
worked — so it is worked time and counts toward the OT basis again (15.38 h in the example
above). See the Training section and OT Configuration above.

### Non-issue — Exclude on approved record
**Investigation finding:** `approveSingle` (the single-record action handler) guards all
actions behind `if (approval.status !== "pending") throw StrategyError`. Excluding an
already-approved record through the normal API path is therefore impossible. This was
initially flagged as a bug but is not — the guard already protects it.

---

## Field Reference (TimeLogApproval)

| Field             | Set by                  | Cleared by Reset | Notes |
|-------------------|-------------------------|------------------|-------|
| `status`          | all actions             | → "pending"      | pending / approved / excluded |
| `approvalMode`    | approve action          | NOT cleared      | "schedule" / "raw" |
| `approvedClockIn` | approve action          | → null           | Schedule: segmentStart; Raw: max(timeIn, segStart) |
| `approvedClockOut`| approve action          | → null           | segmentEnd for Driver; scheduledClockOut for others |
| `actualHours`     | approve action          | → null           | Hours credited toward payable and OT basis |
| `scheduledHours`  | approve action          | → null           | Full window duration for Driver segments |
| `segmentType`     | set at record creation  | never            | driver_am / regular / driver_pm / null |
| `segmentStart`    | set at record creation  | never            | From resolveDriverAideSegments |
| `segmentEnd`      | set at record creation  | never            | From resolveDriverAideSegments |
| `editedHours`     | Edit action             | → null           | Manual override |

---

## Client-Side Rules

These rules must be enforced in the UI to prevent the server-side bugs from being triggered
and to give approvers a consistent experience.

### Action availability by company type

| Action   | DayCare Driver (per segment) | DayCare Regular (per day) | B&C (per day) |
|----------|------------------------------|---------------------------|---------------|
| Schedule | ✓                            | ✓                         | ✓ (with shift picker if >1 shift) |
| Raw      | ✓                            | ✓                         | ✓ |
| Training | ✗                            | ✓                         | ✗ |
| Edit     | ✗                            | ✓                         | ✓ |
| Exclude  | ✓                            | ✓                         | ✓ |
| Reset    | ✓ (approved only)            | ✓ (approved only)         | ✓ (approved only) |

### Display rules

- **Hours column for Driver segments:**
  - If `approval.approvalMode === "schedule"` and `status === "approved"`: display
    `segmentEnd − segmentStart` (full window), not `driverAmSegmentHours` from the TimeLog.
  - If `approval.approvalMode === "raw"` and `status === "approved"`: display
    `actual within-window time` = `approvedClockOut − approvedClockIn`.
  - If `status === "pending"`: display stored `driverXxxSegmentHours` (preview).

- **Training rows — render normally, do NOT gray out:**
  Training records appear as normal punch rows with a "Training" label/badge. They have real
  payable hours (`payrollSummary.payableRegularHours` = `actualHours`, real net hours since
  BB-149). Do not reduce their opacity or style them as disabled/excluded, and never hard-code
  8 h for them.

- **OT row:** Display as `"Period OT · {totalHours}h total / {threshold}h threshold → +{otHours}h"`.
  Expand to a per-day breakdown showing each approved record's `actualHours` contribution.
  Training days in the breakdown (`isTraining: true`) get a plain "Training" label and render
  like any other day — since BB-149 they **count** toward `totalHours` and the OT basis. Do not
  grey them out or label them "not counted"/"excluded", and don't skip them when adding up
  `days` on the client (prefer the server's `totalHours`).

- **Approve errors:** show the server's `message` as-is (e.g. the 400 for an open training
  punch). For bulk approve, a 200 with `data.failed > 0` means some rows were refused — warn,
  then reload the approvals so refused rows show as pending again.

- **TOTAL PAYABLE — critical rule:** Do **NOT** use `otBlocks.breakdown.totalHours` as the
  source for TOTAL PAYABLE — it is the OT-basis total for one employee and leaves out leave
  hours. Compute TOTAL PAYABLE as:
  ```
  TOTAL PAYABLE = Σ payrollSummary.payableRegularHours  (all approved punch records, incl. Training)
                + Σ leave.leaveHours                    (all standalone leave rows in response)
  ```
  The server attaches `leaveHours` to each standalone leave row. Auto-excluded punches
  (leave conflicts) contribute 0 — their day is covered by the leave row instead.

  Example: 87.38 h punches + 8 h Training + 8 h leave day = **103.38 h** TOTAL PAYABLE.
  OT basis = 95.38 h (punches incl. Training; leave excluded) → OT = **+15.38 h**.
  See `docs/TIMEKEEPING_GLOSSARY.md` for the full formula and the reasoning for excluding SL.

- **OT display value:** Use `otBlock.breakdown.otHours` (computed fresh each response),
  NOT `otBlock.otHours` (stored DB value, may be stale until next sync/approval action).

- **Exclude button:** Should only be shown for `pending` records to avoid the OT recompute
  gap (Bug 3). If the UI needs to allow un-approving, use Reset (pending → approved) then
  Exclude.

- **Reset button:** Shown for both `approved` and `excluded` records. Not shown for
  `pending` records.

- **Grace period indicator:** When an approved record's `lateStatus === "within_grace"`,
  show a visual indicator that lateness was forgiven (≤ gracePeriodMinutes). Do not show a
  late badge.
