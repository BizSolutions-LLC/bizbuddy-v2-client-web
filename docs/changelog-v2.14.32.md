# Changelog — v2.14.32

BB-095: Cutoff Review has a new "Add Training Day" control that applies the Training punch type to every employee who punched on a chosen date, or reverts that date to Regular, in one step. It replaces tagging each employee's punch by hand.

BB-092 follow-up: The Driver/Aide Hours Breakdown now shows where the punched lunch was deducted. There's an ⓘ tooltip on Lunch Break, a "−0.47h lunch" note under the segment that lost the time, and a time range on the Driver/Aide AM row.

---

## BB-095 — Training Day for all employees on a date

**Status:** Complete (client only). Modal layout confirmed. The bulk mark/revert behaviour has not been confirmed yet.

**Page:** Cutoff Period Review (`/dashboard/company/cutoff-periods/[id]/review`)

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Investigation findings:**
- BB-029 (v2.13.11) had already added a whole-date handler, `doSetPunchTypeForDate`.
- v2.14.2 removed its button because it repeated on every date sub-header inside every employee card. The handler stayed in the file with nothing calling it.
- The handler had two bugs, checked against the server's `setPunchType`:
  1. **It sent requests the server always rejects.** It sent one for every punch with `toggle-training`, including punches already at the target type and punches that weren't pending. The server returns 400 for both, so a date that was already partly Training failed.
  2. **Wrong rollback.** On any failure it reverted *all* the optimistic updates and said "no changes saved". But the requests that succeeded were already saved on the server, so the UI no longer matched the database.

**Fix (client):**
- **`trainingDayPunchesByDate` / `trainingDayCandidates`:**
  - Take eligible punches from all employees, ignoring the current tab, search and filter chips.
  - A punch is eligible when it has `toggle-training`, is still pending (no `localStatus`) and isn't mid-approval.
  - Grouped by date with employee, Regular and Training counts, in date order using the raw `timeIn` (the date key is a display label like "Oct 7").
- **`doSetPunchTypeForDate`:**
  - Only targets punches that aren't already at the target type.
  - If some requests fail, it reverts only those punches, putting back what they showed before.
  - Messages: success / partial ("X of N … — Y failed") / all failed, with correct singular and plural.
  - Reloads from the server when driver/aide segments were auto-excluded, or after a partial failure.
  - Returns `{ ok, failed }` so the dialog knows whether to close.
- **Filter bar:**
  - New outline "Add Training Day" button (`Plus` icon) at the right end of the chip row.
  - Shown only when the cutoff is open and at least one date has eligible punches.
- **Training Day dialog:**
  - Date picker that marks dates already holding Training punches.
  - Summary of employees, Regular and Training counts for the chosen date.
  - "Mark as Training (n)" and "Revert to Regular (n)" buttons, each disabled when there's nothing to change, with a saving state.
  - Layout:
    - Dialog is 500px wide.
    - `grid-cols-[minmax(0,1fr)]` keeps a wide row from stretching every row past the edge.
    - The button row wraps on narrow screens.
- **Cleanup:** removed the unused `onTrainingDay` prop from `EmployeeCard`. The per-date "Training Day" badge stays.

**Server-repo impact:** None. It reuses `PATCH /api/cutoff-periods/:id/approvals/:approvalId/set-punch-type` with one request per punch.
- DayCare companies only; the server rejects BNC.
- Only pending punches in an open cutoff. Approved punches are skipped.

**Known follow-ups (not in scope):**
- The company Punch Logs page (`EmployeesPunchLogs.jsx`, `/api/timelogs/:id/punch-type`) has no whole-date action.
- An all-or-nothing bulk endpoint on the server could replace the one-request-per-punch approach if partial failures become a problem.

### Files Changed

| File | Changes |
|---|---|
| `.../Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | New `trainingDayPunchesByDate` / `trainingDayCandidates` lists; reworked `doSetPunchTypeForDate` (only sends changeable punches, reverts only failures, accurate messages); "Add Training Day" button in `FilterBar`; Training Day dialog; removed unused `onTrainingDay` prop. |

## BB-092 follow-up — Lunch attribution in the Driver/Aide Hours Breakdown

**Status:** Complete (client only). Awaiting functional confirmation.

**Page:** Company Punch Logs (`EmployeesPunchLogs.jsx`), expanded row → Driver/Aide Hours Breakdown

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

**Background:**
- Since BB-092, Driver/Aide punches deduct the punched lunch from the segment it falls in.
- Example: Jasbleidi, 09/30, lunch 08:17–08:46. Regular went from 5.50h to 5.03h.
- But the Regular row still showed a 5.50h window (08:00 AM → 01:30 PM) next to 5.03h, so you couldn't see the deduction.

**Fix (client, display only):**
- **How the deduction is attributed (`computeLunchAttribution`):**
  - For each segment (AM, Regular, PM), rebuild its window the same way the server does: the later of clock-in and shift start, to the earlier of clock-out and shift end.
  - Shift times are placed on the punch's date in the company timezone (`shiftTimeOnDate`, via `fromZonedTime`).
  - Each window is compared with the stored segment hours, ±0.015h:
    - stored ≈ window − lunch overlap → deducted
    - stored ≈ window → not deducted
    - neither → unknown
  - Overall result:
    - every touched segment deducted → "Deducted from …" (with a per-segment split if the lunch crosses a boundary)
    - every touched segment not deducted → "Not deducted"
    - lunch outside all segments → "Outside the scheduled segments"
    - anything else → lunch times only, no segment named
  - `lunchDeductionMinutes` is deliberately **not** used. Records computed before BB-092 still carry the full lunch there while their segments were never reduced (e.g. Jasbleidi 09/25).
- **Lunch Break ⓘ tooltip (`LunchBreakTooltip`):**
  - Shows `Lunch` / `Auto lunch`, start → end and minutes.
  - "· not deducted" when the lunch is auto and `deductible === false`.
  - Lunches over 120 min: the value is amber and the tooltip says the lunch may not have been ended.
  - No tooltip when `lunchBreak` is null or has no end.
- **Inline note (`LunchDeductionNote`):** "−0.47h lunch" on its own line under each deducted segment's row.
- **AM range:**
  - The Driver/Aide AM row shows its shift start → end.
  - The AM shift is found with a whole-word match (`/\bam\b/`).
- **No change to the Lunch Break value:** it still shows the full punched duration from `lunchBreak` start/end. It falls back to `lunchDeductionMinutes` only when there's no `lunchBreak.start`.

**Server-repo impact:** No API changes. It relies on fields the punch log endpoint already returns (`lunchBreak`, `driverAmSegmentHours`, `regularSegmentHours`, `driverPmSegmentHours`). The "Deducted from" result only appears on records computed with the server's BB-092 per-segment lunch deduction, so that server change needs to be deployed for it to show.

**Known follow-ups (not in scope):**
- No coffee break tooltip. Driver/Aide segments never deduct coffee breaks.
- The PM row's displayed range still starts at the Regular shift's end, not the PM shift's start. The calculation uses the PM shift's own times.
- The employee self-view (`EmployeePanel/TimeKeeping/PunchLogs.jsx`) Hours Breakdown is unchanged.

### Files Changed

| File | Changes |
|---|---|
| `.../Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | New `fromZonedTime` import; new `shiftTimeOnDate`, `computeLunchAttribution`, `LunchBreakTooltip`, `LunchDeductionNote`; `DriverAideBreakdown` adds the AM shift range, per-segment lunch notes and the Lunch Break tooltip / amber highlight. |
