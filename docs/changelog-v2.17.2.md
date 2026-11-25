# Changelog — v2.17.2

BB-149: **Training days are no longer capped at 8 hours.**
- The server now pays DayCare training punches the real net hours worked (breaks and lunch deducted, no cap), and training counts toward overtime.
- On the web, Cutoff Review now shows the server's reason when an approval is refused, e.g. a training punch with no clock-out. Before, it said "Failed to approve".
- When bulk approve skips some punches, Cutoff Review now warns and refreshes. Before, it reported success and left the skipped rows looking approved.
- The in-app guide and the developer docs describe the new rule.

**Needs server v2.11.23** (BB-149). **Mobile:** no change.

---

## BB-149 — Training days: 8-hour cap removed

**Status:** Built (client), untested.

**Why:**
- The server changed how DayCare training (`punchType = "TRAINING"`) is paid:

  | | Before | Now |
  |---|---|---|
  | Hours | Flat 8 h before approval; `min(clock span, 8 h)` on approval, nothing deducted | Real net hours: clock span − coffee breaks − lunch deduction, no cap |
  | Overtime (80 h per period) | Training left out | Training counts |
  | Open training punch | Approved as 8 h | Refused: *"This training punch has no clock-out yet. Approve it after the employee clocks out."* |

- The web only needed wording changes, plus one fix: the approve calls didn't show the server's message.

### Server contract used
- `PATCH /api/cutoff-periods/:id/approvals/:approvalId`: returns 400 with `message` for an open training punch.
- `PATCH /api/cutoff-periods/:id/approvals/bulk`: returns 200 with `data: { approved, failed }` and a `message` like "3 time log(s) approved successfully. 1 failed."
- `GET /api/cutoff-periods/:id/approvals` → `otBlocks[].breakdown`: `days[]` rows still carry `isTraining: true`, and `totalHours` now includes them.
- No new fields or endpoints.

### Changes
- **`cutoffReviewShared.jsx`** (Cutoff Review, List and Calendar):
  - **Single approve:** on an error it now reads the server's `message` and shows it as-is. If there's none, it still says "Failed to approve".
  - **Bulk approve:** when `data.failed > 0`, it shows a warning with the server's message and the hint "Open training punches can't be approved until the employee clocks out". It then reloads the approvals, so refused rows go back to pending. With no failures, it shows the same success toast as before.
- **`companyDocsContent.js`:** the in-app guide's DayCare "Training days" entry now ends with *"Training is paid for the time worked, like a regular punch (breaks and lunch deducted). It counts toward overtime."*
- **`docs/CUTOFF_PERIOD_MODULE.md`** and **`docs/TIMEKEEPING_GLOSSARY.md`:** rewritten to the new rule:
  - training hours are real net hours with no cap;
  - training counts toward overtime (only paid sick leave is taken out);
  - examples, display rules and the rule for past records.

  The old cap and the "training excluded from OT" rule stay only as marked history under Known Bugs.

### Not changed
- **OT breakdown:** it already showed training days with a plain "Training" label and used the server's `totalHours`. The Calendar view already adds up every day, training included.
- **Hours shown:** nothing on the web hard-coded 8 h for training; the hours come from the server.
- **B&C:** the "Training days" guide entry and daily-OT companies are unchanged. They already counted training.

### To test
1. **DayCare cutoff, open training punch:** approve it. The toast shows *"This training punch has no clock-out yet. Approve it after the employee clocks out."* and the row goes back to pending.
2. **Bulk approve** an employee who has one open training punch: a warning shows "N approved … 1 failed", and the open punch stays pending after the reload.
3. **Short and long training:** a 3 h training shows about 3 h, not 8 h. A 10 h training with lunch shows the net hours, more than 8.
4. **Per-cutoff OT block → Days:** the training row has a plain "Training" label, and Total includes its hours.
5. **Guide → Cutoff Review → Training days** (DayCare company) shows the new sentence.

---

## Open items
- **Server v2.11.23** (BB-149) has to be deployed for the new hours and the open-punch refusal.
- **Past records:** training already approved in an open cutoff keeps its old capped hours until it's Reset and approved again. Locked and processed cutoffs don't change.
- **Carried from v2.17.1:**
  - Bing recrawl;
  - the server release for `POST /api/public/contact`;
  - CSP enforcement;
  - tokens in localStorage;
  - store URLs;
  - `/pricing` restyle or hide;
  - the "CC" initials in the screenshots.
