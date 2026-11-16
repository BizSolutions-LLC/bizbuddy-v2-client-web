# BB-121 — Client-side computation audit (Calendar cutoff pages)

**Status:** draft for review with the server team. **Not for production** until the open questions in §6 are answered and the divergences in §4 are resolved.
**Date:** 2026-11-16 · **Client:** `release/v2.15.5` working tree (uncommitted) · **Server:** v2.11.12 (development)

## 1. Why this document exists

BB-121 adds a **Calendar Type** for the two cutoff pages, next to today's **List Type**. To deliver the agreed concepts (pay preview per option, flags with reasons, default choices), the Calendar review page now **re-computes pay rules in the browser** that the server already owns.

The concern: **the server must be the single source of truth for hours, flags and pay policy.** Every rule copied into the client can drift from the server. During BB-121 it already did, three times (see §4).

This document lists **every place the client does pay-related math**, what server rule it copies, and the question it raises. The goal is to move these into the server (proposed contract in §7) and leave the client with presentation only.

## 2. Pages in scope

| Page | Route | Component | Notes |
|---|---|---|---|
| Cutoff list — **List Type** (existing) | `/dashboard/company/cutoff-periods` | `EmployeeCutoff.jsx` | Baseline. Logic moved to `cutoffPeriodsShared.jsx`, behaviour unchanged. |
| Cutoff list — **Calendar Type** (new) | same route, `cutoffPageView = "calendar"` | `CutoffPeriodsCalendar.jsx` | Counts and filters over server data. Low risk. |
| Cutoff review — **List Type** (existing) | `/dashboard/company/cutoff-periods/:id/review` | `CutoffReview.jsx` | Baseline. Logic moved to `cutoffReviewShared.jsx`, behaviour unchanged. |
| Cutoff review — **Calendar Type** (new) | same route, `cutoffPageView = "calendar"` | `CutoffReviewCalendar.jsx` | **Most client-side math lives here.** |
| Switches | both routes | `CutoffPeriodsSwitch.jsx`, `CutoffReviewSwitch.jsx`, `lib/hooks/useCutoffPageView.js` | Read `GET /api/company-settings` → `cutoffPageView`. No math. |

All component paths are under `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/`.

### Baseline: what the List Type review does (for comparison)

The List review page is a **thin client**:
- **Hours per record:** shows the server's own numbers (`payrollSummary.totalPayableHours` / `calculatedData.payableHours`; approved rows show the stored `actualHours`).
- **Tags:** shown as the server sends them (`lateMinutes/lateStatus`, `willSnapIn/Out`, `hasApprovedOT`, auto clock-out, duplicate).
- **OT blocks:** computed by the server.
- **Pay choice:** none. The approver clicks Schedule or Raw.
- **Its own math:** only **sums** of server numbers (card "Total Payable", header totals) and grouping by day.

One weakness it shares with the Calendar page: pending hours are the server's **pre-approval** figures, which can differ from what approval pays (§4).

## 3. Summary by risk

| # | Area | Where | Risk |
|---|---|---|---|
| C1 | Actual / Schedule hours per driver segment | `CutoffReviewCalendar.jsx` `rawPayHours` (L394), `segmentRow` (L407) | **High** — pay |
| C2 | Actual / Schedule hours per Staff (regular) punch | `staffAnalysis` (L498), `staffRow` (L550) | **High** — pay |
| C3 | Lunch deduction inside a window | `lunchOverlapMs` (L104), `dayLunchMinutes` (L113), used in C1/C2/C8 | **High** — pay |
| C4 | "Entry segment" (which segment the clock-in lands in; missed segments) | `analyzeDriverDay` (L294) | **High** — pay + flags |
| C5 | Default pick per row (Actual / Schedule / Hold) | `segmentRow`, `staffRow` | **High** — policy |
| C6 | Lateness / grace / early / past / left-early classification | `analyzeDriverDay`, `staffAnalysis`, `punchClockIn` (L194), `minutesBetween` (L131) | Medium — facts |
| C7 | "Early Regular?" detection + suggested exclude reason | `analyzeDriverDay`, `EXCLUDE_CHOICES` (L1083) | Medium — policy |
| C8 | Day / employee totals (PAYING, Approved, Waiting, Clocked, week totals) | `buildDayModel` (L769), `totals` (L1012), `clockedHours` (L344) | Medium — sums of C1–C3 |
| C9 | Overtime strip progress ("Xh of 80h · Yh before the threshold", "+Zh if Driver PM on actual") | `totals`, `pmExtra` (L854) | Medium — looks like OT |
| C10 | Which option an approval was paid on | `paidMode` (L742), `paidSpan` (L754) | Medium — guess |
| C11 | Staff shift start/end taken from `/api/timelogs` | `cutoffReviewShared.jsx` `buildShiftMap` (L252) | Medium — workaround |
| C12 | Bulk approve as a client loop (one PATCH per record, one reload) | `approveRemaining` (L1037) | Medium — atomicity |
| C13 | Cutoff list "Needs your attention", counts, grouping | `CutoffPeriodsCalendar.jsx` `attention` (L265), `groups` (L313) | Low — filters over server data |
| — | Calendar layout, company-time-zone day bucketing, colours, chips, wording, unsaved picks | both Calendar pages | **Fine on the client** |

## 4. Divergences already found

| Case | What the page showed / server stores | Cause | State |
|---|---|---|---|
| Driver AM 6:47 (6:45 window, 15-min grace) | List + pending: **1.2h**; Actual approval pays **1.25h** | Pending figure has no grace credit; `approveDriverSegment` credits grace from the window start | Calendar mirrors the approval (C1). **Server: pending vs approval differ.** |
| Regular segment with lunch 8:19–8:46 | Calendar showed **5.5h**; server **5.06h** | Client didn't deduct lunch (BB-092) | Fixed client-side (C3) |
| Staff 7:59 (8:00 shift, 15-min early grace) | Pending **5.5h**; Actual approval stores **5.52h** | `timeLogComputeService` snaps early ≤ `earlyClockInGraceMinutes`; REGULAR Raw approval keeps the raw clock-in | **Open — Q1** |
| Staff punch with lunch | Calendar subtracts lunch; REGULAR approval `actualHours = clockOut − clockIn` (`calculateHours`, `daycareCutoffStrategy.js:112`) | Lunch not subtracted at regular approval? | **Open — Q2** |
| Driver 7:52 vs 6:45 AM window | Server sent **no** `beyond_grace` | Server lateness for DA appears measured from another start (Regular 8:00?) | **Open — Q4** |
| Within-grace lateness | Server stores **0**, never sends `within_grace` | By design (payroll) | Server will add a display field after BB-114 batch 1 |
| Exclude note | Was dropped (`reason \|\| notes`) | Server | **Fixed in v2.11.12** |

## 5. Item details

### C1 — Driver segment hours (Actual / Schedule)
- **Client:** Schedule = window length − lunch inside the window. Actual = from the later of clock-in and window start (window start if late within grace + 59 s), to the window end, or to the real clock-out on the last segment, − lunch.
- **Mirrors:** `daycareCutoffStrategy.js` `approveDriverSegment` (~L606–645).
- **Not mirrored:** Regular segment cap at `defaultShiftHours` on approval.
- **Ask:** Q3, Q5.

### C2 — Staff (regular) punch hours
- **Client:**
  - **Schedule** — in: shift start if early or within grace, else the real time. Out: capped at shift end; shift end if there's no clock-out.
  - **Actual** — in: shift start only within grace (early minutes paid). Out: the real time.
  - Both subtract lunch.
- **Mirrors:** `daycareCutoffStrategy.js` REGULAR branch (~L210–300).
- **Ask:** Q1, Q2.

### C3 — Lunch deduction
- **Client:** a copy of `lunchOverlapMs` (`timeLogComputeUtils.js:96`). A deductible, completed lunch overlapping the window is unpaid; an auto lunch with `deductible:false` is ignored. Also drives the "Lunch Nm" chip and "on the clock".
- **Ask:** Q2.

### C4 — Entry segment
- **Client:** the clock-in's segment is the first whose window hasn't ended. Earlier segments are "missed" (Actual 0h, "No AM run"). Lateness is judged against the entry segment's start. Example: 9:53 AM → AM missed, Regular "Late 113m".
- **Server:** no explicit rule; hours fall out of `max(timeIn, segmentStart)`.
- **Ask:** Q4.

### C5 — Default pick (policy agreed with Carlo)

| Situation | Default |
|---|---|
| Late (within or beyond grace) | Actual |
| Early clock-in (driver) | Schedule |
| Driver PM past window | Actual |
| Left early | Actual |
| No AM run | Actual (0h) |
| No clock-out | Hold |
| Staff | Actual, except no clock-out → Hold |

- **Ask:** Q6.

### C6 — Lateness / flags
- **Client:**
  - Grace = `gracePeriodMinutes` × 60 + 59 s, same as the server.
  - Minutes shown with seconds dropped (each time read to the minute).
  - Flags: early / past window / left early / no clock-out, from window bounds vs raw punches.
- **Server today:**
  - Lateness within grace is stored as 0, so `within_grace` is never sent (`timeLogComputeService.js` ~L551; `cutoffPeriodController.js:208`).
  - Regular punches get **no** shift start/end in `/approvals` (`schedule` = `{ scheduledHours }` only).
- **Ask:** Q4, Q7.

### C7 — "Early Regular?"
- **Client:** flagged when the clock-in is beyond grace in the AM window **and** within `earlyClockInGraceMinutes` (fallback 30) before Regular starts. Suggests the exclude reason "Early clock-in for Regular — not a Driver AM run".
- **Ask:** Q8.

### C8 — Totals
- **PAYING per day:** approved rows use the server's stored hours. Pending rows use the C1/C2 preview of the picked option. Plus leave.
- **Approved / Waiting / Clocked per employee:** sums of the above. Clocked = clock-in → clock-out − lunch.
- **Ask:** Q9.

### C9 — Overtime strip
- **Client:** "Xh of 80h so far · Yh before the threshold" sums C8. "Paying Driver PM on actual would add Zh" is computed from the picks.
- **The badge** shows server OT blocks only.
- **Ask:** Q10.

### C10 — Paid option
- **Client:** the option approved from this page this session is remembered. Otherwise it's guessed by comparing the approved hours to the Schedule/Actual preview (a tie shows Actual). It drives the raised option, the "resolved, paid on …" line and the header's paid times.
- **Ask:** Q11.

### C11 — Staff shift times
- **Client:** `/approvals` lacks shift times for regular punches, so they're read from the `GET /api/timelogs` rows the hook already loads (`userShift(s)`, custom times first; a shift named "regular" preferred).
- **Ask:** Q7.

### C12 — Bulk approve
- **Client:** "Approve remaining" sends one PATCH per record with its pick, sequentially, then one `/approvals` reload. The bulk endpoint only takes one mode for all and works per time log (it would approve all of a driver day's segments).
- **Ask:** Q12.

### C13 — Cutoff list (Calendar Type)
- **Client:** "Needs your attention" cards (open period with pending records, locked past payment date, departments with no upcoming period), status and department counts, Current / Previous / Earlier grouping. Filters and counts over `GET /api/cutoff-periods` + cutoff settings.
- **No pay math.** No change needed; listed for completeness.

## 6. Open questions for the server team

1. **Early minutes (Staff):** should Actual (Raw) approval of a regular punch snap an early clock-in within `earlyClockInGraceMinutes` to the shift start, as `timeLogComputeService` does? Today pending = 5.5h, approval = 5.52h for 7:59→1:30.
2. **Lunch on regular punches:** REGULAR approval stores `actualHours = clockOut − clockIn` with no lunch subtracted. Is lunch deducted later (sync-back, payroll export)? What is the paid figure for a Staff day with a 26-min lunch?
3. **Driver segment preview vs pending figure:** pending segment hours lack the grace credit that approval applies (1.2h vs 1.25h). Can pending figures be computed with the approval rules, so List and Calendar show what will be paid?
4. **Driver/Aide lateness:** which start does the server use for a DA punch's `lateHours`? 7:52 vs a 6:45 AM window came back without `beyond_grace`. And for a clock-in that lands in Regular (9:53), is Regular the one considered late?
5. **Regular segment cap:** should the preview apply the `defaultShiftHours` cap on the Regular segment?
6. **Default choices:** should the defaults in C5 live on the server (company config or a per-record `recommendedMode` + reason)?
7. **Shift times in `/approvals`:** can each record include `shiftStart` / `shiftEnd` (with custom times applied) and raw lateness minutes (the planned `rawLateMinutes`)?
8. **"Early Regular?":** is `earlyClockInGraceMinutes` the right threshold, or should it be per-schedule grace (a future ticket)?
9. **Totals:** can `/approvals` return per-day and per-employee totals (approved, pending-preview, clocked)?
10. **OT progress:** is a hours-vs-threshold progress bar acceptable from client sums, or should the server provide it?
11. **Approval mode:** can each approval store `approvalMode` (`schedule` / `raw` / `edit`) so the UI never guesses?
12. **Bulk approve:** can the bulk endpoint accept `[{ approvalId, approvalMode }]` per record and be all-or-nothing?

## 7. Proposed `/approvals` additions (after BB-114 batch 1, ~2026-11-28)

Per approval record:

```jsonc
{
  "shift":   { "start": "2026-11-13T15:00:00Z", "end": "2026-11-13T20:30:00Z" }, // custom times applied
  "facts":   { "rawLateMinutes": 9, "lateStatus": "within_grace",               // or beyond_grace / early / on_time
               "earlyMinutes": 0, "pastWindowMinutes": 1, "leftEarlyMinutes": 0,
               "lunchMinutesInWindow": 26, "missed": false },
  "preview": { "schedule": { "in": "…", "out": "…", "hours": 5.5 },
               "actual":   { "in": "…", "out": "…", "hours": 5.53 } },           // same function the approval uses
  "recommendedMode": "raw", "recommendationReason": "late_within_grace",
  "flags":   ["late_within_grace", "past_window"],                             // early_regular, missed_segment, no_clock_out, …
  "approvalMode": "raw"                                                         // stored on approve
}
```

Plus envelope totals per employee and day, and a per-record-mode bulk endpoint (Q12).

**With this, the client keeps only:**
- layout and calendar;
- day bucketing in `companyTimezone` (per the hand-off);
- reason-code → text and colour;
- unsaved picks;
- filters.

## 8. Before production

- [ ] Q1 and Q2 answered; preview matches the server's paid figure for Staff days.
- [ ] Q3 / Q4 answered or accepted as known differences.
- [ ] Decide whether pending hour figures are labelled "preview" in the UI until approved.
- [ ] Server ticket logged for §7 (post BB-114 batch 1).
- [ ] Regression pass on the **List Type** pages, since their logic moved into `cutoffPeriodsShared.jsx` / `cutoffReviewShared.jsx`.
