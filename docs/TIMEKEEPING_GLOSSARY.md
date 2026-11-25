# Timekeeping Glossary — Canonical Term Reference

This is the single source of truth for timekeeping/payroll terminology used across the server
(`CUTOFF_PERIOD_MODULE.md`, `TIMELOG_MODULE.md`) and the client-side application. Do not
redefine these terms locally in other docs — link back here instead. If client-side and
server-side definitions ever diverge, this file wins; update both sides to match it.

Last updated: 2026-11-25 (BB-149: Training no longer capped at 8 h, and counts toward OT)

---

## Term Definitions

| Term | Definition |
|---|---|
| **Raw Clock-In** | The actual timestamp recorded when the employee clocks in. Never modified. Maps to `TimeLog.timeIn` prior to any policy adjustment. |
| **Raw Clock-Out** | The actual timestamp recorded when the employee clocks out. Never modified, with one sanctioned exception: the early-clock-out grace snap (`earlyClockOutGraceMinutes`) is a permanent DB write — see `CUTOFF_PERIOD_MODULE.md`. |
| **Effective Clock-In** | The clock-in timestamp after applying attendance policies — grace period, early-clock-in rules, schedule alignment. Maps to `effectiveTimeIn` / `finalClockIn` / `approvedClockIn` depending on company type and approval mode. |
| **Effective Clock-Out** | The clock-out timestamp after applying attendance policies — early clock-out rules, schedule alignment. Maps to `finalClockOut` / `approvedClockOut`. |
| **Worked Duration** | `Effective Clock-Out − Effective Clock-In`. Total elapsed working time before break deductions. |
| **Break Duration (BR)** | Total unpaid break time deducted from Worked Duration. Derived from `TimeLog.totalBreakMinutes` + `lunchDeductionMinutes` (breaks are stored as JSON — `coffeeBreaks`, `lunchBreak` — not a relational model). |
| **Net Worked Hours** | `Worked Duration − Break Duration`. Actual hours worked before leave adjustments. Maps to `TimeLog.netWorkedHours`. |
| **Training Hours (TR)** | Training hours credited for the day (DayCare, `punchType = "TRAINING"`). Since BB-149 this is the **real net hours**: clock span − coffee breaks − lunch deduction (company minimum lunch applies, same as a regular punch). No shift snap and **no cap**. Previously it was `min(clock span, defaultShiftHours)` with nothing deducted. Maps to `TimeLog.netWorkedHours` (written by the server's `applyTrainingHours`) and, once approved, `TimeLogApproval.actualHours`. A training punch with no clock-out can't be approved. |
| **Sick Leave Hours (SL)** | Approved, paid sick leave converted into hours based on the employee's scheduled shift. **Open item:** paid/unpaid status is tracked per leave *request* (`Leave.isPaid`), not per leave *type* — "sick vs. vacation" is not itself the determining factor for whether hours count here. Full leave-module semantics are scoped separately — see Open Items. |
| **Overtime Hours (OT)** | Hours exceeding the regular work requirement for the cutoff period, after excluding non-worked paid credits (paid SL) from the threshold comparison. Training is worked time and **counts** (BB-149). See Formulas below. |
| **Raw Overtime** | Time worked beyond the scheduled shift, before approval or payroll adjustment. Maps to `TimeLog.rawOtMinutes`. **Not used for payroll on cutoff-basis (80h/period) companies** — see `TIMELOG_MODULE.md`. Relevant for daily-basis (B&C) companies. |
| **Approved Overtime** | Raw Overtime that has been approved for payroll. For cutoff-basis companies this is a period-level approval (`CutoffOtBlock.status`), not per-punch. For daily-basis (B&C) companies it is closer to a literal per-punch approved raw OT. |
| **Time Zone** | The company's official time zone, used for all attendance and cutoff-boundary calculations (e.g. `America/Los_Angeles`). Always use `moment.tz(companyTimezone)` — never server-local time. |
| **Cutoff Status** | Two distinct state machines share this name informally — be specific about which one is meant. (1) **Record-level** — `TimeLogApproval.status`: `pending` / `approved` / `excluded`. (2) **Period-level** — `CutoffPeriod` status: open / locked / processed. |

---

## Formulas

```
Worked Duration      = Effective Clock-Out − Effective Clock-In

Net Worked Hours      = Worked Duration − Break Duration

Total Payable Hours   = Σ Net Worked Hours (approved, non-training/non-leave records)
                       + Σ Training Hours (TR)
                       + Σ paid Leave Hours (SL, or other paid leave once leave module is scoped)

OT Hours               = max(0, (Total Payable Hours − SL) − Threshold)
                         ← TR stays in: training counts toward OT (BB-149)
```

`Threshold` is the cutoff-basis OT threshold (`cutoffOtThresholdHours`, e.g. 80h for a
bi-weekly 5+5 day DayCare cutoff — 10 working days × 8h). Applies to `otBasis: "cutoff"`
companies. B&C (`otBasis: "daily"`) uses a per-day threshold instead — see
`CUTOFF_PERIOD_MODULE.md`.

**Why SL is subtracted rather than just excluded from the sum:** paid sick leave is a flat,
non-worked credit. If it's left inside the total that gets compared against the fixed period
Threshold, it doesn't just get paid its own amount — it also pushes other, genuinely worked
hours across the OT line, generating OT premium the employee never actually worked for.
Subtracting it before the threshold comparison means OT is earned only on hours actually
worked beyond the period baseline.

**Why TR is no longer subtracted (BB-149):** Training used to be a flat, capped credit
(`min(span, defaultShiftHours)`), so it was treated like SL and kept out of the OT basis.
Since BB-149 Training is paid for the time actually worked — real net hours, no cap — so it is
worked time like a regular punch and counts toward OT. Daily-OT (B&C) companies already counted
training; nothing changed there.

**Status: IMPLEMENTED (server, BB-149).** `cutoffOtService.computeOtForCutoffBasis` and the
`getCutoffApprovals` OT breakdown include Training in the OT basis; `breakdown.days[]` still
flags those rows with `isTraining: true`, but `breakdown.totalHours` includes them. This
supersedes the "Training excluded from OT basis" rule (v2.10.22+) and the earlier Bug 6 history
in `CUTOFF_PERIOD_MODULE.md`. The **SL term is not yet implemented** — leave still has no
effect on OT basis or TOTAL PAYABLE in code today (see Open Items).

---

## Open Items (Not Yet Implemented)

- **Leave module semantics.** `Leave.isPaid` exists in the schema but today is only read for
  `LeaveBalance` deduction bookkeeping — it has no effect on `TOTAL PAYABLE` or OT basis. The
  `leaveHours` field described in `CUTOFF_PERIOD_MODULE.md`'s "Approved Leave Handling" section
  does not exist in code; standalone leave rows carry no computed hours today. Full scope
  (SL vs. VL, paid/unpaid gating, per-employee-type hour lookup) is a separate discussion.
  Until this lands, SL has no code-level effect — it is already implicitly excluded from OT
  basis today (leave never had a `TimeLogApproval` row to begin with), which happens to match
  the target formula, but TOTAL PAYABLE does not yet add leave hours in.
- **Past training records (BB-149).** Only new approvals and recomputes use the uncapped rule.
  Training already approved in an open cutoff keeps its old capped `actualHours` until it is
  Reset and approved again. Locked/processed cutoffs are not changed. No backfill is planned.

---

## Dropped Concepts

- **"Punch Type" as a clock-event classifier** (Clock-In / Clock-Out / Break-In / Break-Out /
  Manual Adjustment) was considered and dropped. `PunchType` already exists in the schema as a
  work-category/segment enum (`REGULAR`, `DRIVER_AIDE_AM`, `DRIVER_AIDE_PM`, `DRIVER_AIDE`,
  `TRAINING`) — reusing the name for a different concept would collide. No discrete
  punch-event log exists in the data model today (breaks are unstructured JSON, not event
  rows). If a real event-level log is ever built as its own feature, name and define this term
  then, grounded in the actual schema.

---

## See Also

- `docs/CUTOFF_PERIOD_MODULE.md` — cutoff approval actions, OT configuration, leave
  auto-exclusion, known bugs.
- `docs/TIMELOG_MODULE.md` — TimeLog computation fields, DRIVER_AIDE sync-back design, OT
  Status display.
