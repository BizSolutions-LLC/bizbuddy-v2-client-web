# Changelog — v2.13.2

Bug fix, mobile-first UX redesign, and dead code removal on the Employee Punch Logs page.

Tickets: **BB-006** (Request Punch Log — partial web concerns)

---

## Change 1 — Employee Punch Logs: Request Punch Log Entry Submit Bug
**Ticket:** BB-006
**Status:** Shipped (client only).

**Problem:** Clicking "Submit Request" in the "Request Punch Log Entry" modal produced no response — no success toast, no error, nothing sent to the server.

**Root cause:** The `JSON.stringify` payload in the submit handler used ES6 shorthand property syntax for `requestedClockIn` and `requestedClockOut`. No variables with those names existed in scope — the actual state variables were named `requestClockIn` and `requestClockOut` (no `"ed"` suffix). This caused a `ReferenceError` at runtime, which was silently swallowed by the surrounding `try/catch`, resulting in `toast.error("Failed to submit. Please try again.")` — often missed since the dialog was still open.

**Fix:** `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` — submit handler inside the Request Punch Log dialog footer.

```js
// Before — ReferenceError: requestedClockIn / requestedClockOut not defined
body: JSON.stringify({ requestedDate: requestPunchDate, requestedClockIn, requestedClockOut, ... })

// After — explicit mapping to correct state variables
body: JSON.stringify({ requestedDate: requestPunchDate, requestedClockIn: requestClockIn, requestedClockOut: requestClockOut, ... })
```

---

## Change 2 — Employee Punch Logs: Request Punch Log Entry — Mobile-First Multi-Step Bottom Sheet
**Ticket:** BB-006
**Status:** Shipped (client only).

**Problem:** The "Request Punch Log Entry" form was a single tall scrollable `Dialog` with all fields revealed progressively behind a date gate. On mobile, `datetime-local` inputs were awkward to use, the full form required excessive scrolling, and there was no clear indication of required fields or submission progress.

**Fix:** `PunchLogs.jsx` — replaced the `Dialog` with a 3-step `Sheet` (bottom drawer) and split the form into focused steps.

**Step breakdown:**

| Step | Fields |
|---|---|
| 1 — Date & Times | Date picker · Clock In (`type="time"`) · Clock Out (`type="time"`) · Net hours preview |
| 2 — Approver & Reason | Approver select · Reason select |
| 3 — Review & Submit | Summary card (date, times, net hours, approver, reason) · Detailed explanation textarea |

**Key UX changes:**
- Bottom sheet (`Sheet side="bottom"`, `h-[88vh]`, `rounded-t-2xl`) slides up natively — familiar mobile pattern.
- Clock In / Clock Out switched from `datetime-local` to `type="time"` since the date is already captured in Step 1. Native time pickers on iOS/Android are significantly more usable.
- Per-step validation — the **Next** button validates only the current step's fields before advancing. No full-form dump at the end.
- Step progress bar with labels (Date & Times → Approver → Details) gives the user a clear sense of position.
- Step counter badge (`2 / 3`) in the header.
- Step 3 summary card lets the user confirm all entries before submitting.
- Textarea character counter shows remaining chars needed before the 20-char minimum is met.
- All touch targets set to `h-12` for comfortable tap size.
- Back/Cancel and Next/Submit buttons always pinned to the bottom footer — no scrolling required to navigate.
- Added `requestStep` state (initialized to `1`); reset to `1` on close.
- API call, payload shape, and all state variables untouched.

**New import:** `Sheet, SheetContent` from `@/components/ui/sheet`.

---

## Change 3 — Employee Punch Logs: My Punch Log Requests — Mobile-First Card Redesign
**Ticket:** BB-006
**Status:** Shipped (client only).

**Problem:** The "My Punch Log Requests" list used a flat card layout that relied on a two-column `flex justify-between` structure. On narrow screens, the status badge and date competed for the same row, the approver/submitted footer line didn't wrap, and emoji-based status indicators (`🟡`, `✅`, `❌`) were inconsistent across platforms.

**Fix:** `PunchLogs.jsx` — rewrote the request card layout with a mobile-first structure.

**Changes:**
- **Left accent border** color-coded by status: amber (`border-l-amber-400`) for Pending, green (`border-l-green-500`) for Approved, red (`border-l-red-500`) for Rejected. Provides instant visual scan without reading the badge.
- **Status badge** replaced emoji + all-caps text with a small colored dot + readable label (`Pending`, `Approved`, `Rejected`). Works consistently across all platforms and screen sizes.
- **Each data point is its own row** — date, time range + hours, reason, description — removing the cramped two-column grid that broke on small screens.
- **Footer wraps** via `flex-wrap` so the approver name and submitted date stack naturally on narrow screens and sit side-by-side on wider ones. Approver name truncated at `max-w-[180px]` to prevent overflow.
- **"X total" count** hidden on mobile (`hidden sm:inline`) — reduces header clutter on small screens.
- **Date offset fix** — `req.requestedDate` (a date-only string) is now suffixed with `T12:00` before `new Date()` to prevent UTC midnight from rolling the date back one day in negative-offset timezones.
- **Submitted date** formatted with `{ month: "short", day: "numeric", year: "numeric" }` for consistency with the rest of the page.

---

## Change 4 — Employee Punch Logs: Removed Duplicate "OT Threshold Progress" Card
**Ticket:** BB-006
**Status:** Shipped (client only).

**Problem:** Two cards were shown simultaneously for weekly/cutoff OT employees who had not yet reached the worked-hours threshold:
1. **OT Configuration card** — showed approved OT consumption (`0h / 40h`) with a window date range.
2. **OT Threshold Progress card** — showed accumulated worked hours toward eligibility (`23.97h / 40.00h`) with a purple progress bar.

During the pre-eligibility phase, Card 1's meter always read `0h` approved (no OT can be requested yet), making it redundant and misleading alongside Card 2. Card 2 was added when the `thresholdStatus` API was introduced but was never cleaned up — the intent was for it to be the pre-eligibility display while Card 1 handled post-eligibility consumption.

**Fix:** `PunchLogs.jsx` — removed the standalone "OT Threshold Progress" `Card` block entirely (`otBasis !== "daily" && thresholdStatus?.data && !thresholdStatus.data.eligible` conditional).

Card 1 (OT Configuration + consumption meter) remains as the single display for both configuration info and approved OT consumption. It correctly shows `0h` approved when no OT has been requested, which is accurate post-eligibility.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` | BB-006: Submit bug fix (Change 1); multi-step bottom sheet (Change 2); mobile-first request cards (Change 3); removed OT Threshold Progress card (Change 4) |
