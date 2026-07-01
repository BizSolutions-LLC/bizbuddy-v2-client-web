# Changelog — v2.14.6

Leave Credits Management in Company Configurations fully redesigned — modal-based adjustment flow and a new accordion-style employee view replacing the old horizontal matrix table. DayCare punch log CSV export now includes an OT column. Also fixes an off-by-one date bug on the company Punch Log Requests approval card.

---

## BB-034 — Leave Credits Management: Modal-Based Adjustment Flow

**Status:** Shipped (client only). No server changes — existing `POST /api/leave-balances/adjust` endpoint used as-is.

**Page:** `/dashboard/company/configurations`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyConfigurations.jsx`

**Problem:**

The previous adjustment panel was a flat 4-column grid inline in the card: an employee dropdown (no search, raw value list), a multi-type popover, a freeform `±` hours input, and an Apply button. Several usability issues:

- No way to search employees by name or email — companies with many employees had to scroll through a raw list
- Leave type multi-select was a separate popover with no balance context — admin had no visibility into current credits before adjusting
- Entering negative hours for subtractions was error-prone and non-obvious
- All leave types were silently pre-selected on every mount via a side-effect `useEffect`
- The Radix `Select` component with an embedded search `<Input>` did not work — Radix captures keystrokes for its own navigation, preventing typing in the search field

**Fix:**

Replaced the inline panel with two components:

### `AdjustCreditsModal`

A `Dialog` that walks through three steps in a single scrollable view:

**Step 1 — Employee**

Replaced Radix `Select` + embedded search with a `Popover`-based combobox:
- Button trigger shows the selected employee name or a placeholder
- Popover opens with a plain `<Input autoFocus>` for searching by name or email
- Results rendered as plain `<button>` list items — no Radix keyboard capture conflicts
- Selected employee highlighted with an orange checkmark
- After selection, an orange chip card shows the employee's initial, full name, and email

**Step 2 — Leave Types** (shown after employee is selected)

- Each leave type rendered as a clickable row (entire row is the toggle target, not just the checkbox)
- Each row displays the employee's current **Credits / Used / Available** balance inline
- When an adjustment amount is entered, each checked row shows a live **"After"** preview of the new available balance
- Select All / Clear All shortcut link in the section header
- Leave types default to all selected when the modal opens

**Step 3 — Adjustment** (shown after at least one type is selected)

- **Add / Subtract** toggle buttons replace the freeform `±` number input — admin always enters a positive number and picks direction explicitly
- The Apply button color follows direction: green for Add, red for Subtract
- A summary line confirms the hours and type count before submitting

Modal resets all state on open. Saving blocks the close gesture until the request completes.

### `LeaveCreditsAccordionCard` (replaces `LeaveAdminCard`)

The old horizontal matrix table (one wide row per employee, leave types as columns) was replaced with an accordion-style employee list:

**Employee header row (collapsed):**
- Avatar circle with deterministic color per first letter and two-letter initials
- Employee name + email
- Right side: amber **"N depleted"** badge (count of leave types where `credits > 0` and `available === 0`), total credits sum, chevron toggle
- **"No credits allocated"** shown when all leave types are at zero

**Expanded breakdown — per-leave-type sub-table:**

| Column | Description |
|---|---|
| Leave Type | Type name |
| Credits | Total allocated hours |
| Used | Hours consumed by approved leave |
| Avail | Remaining balance (bold red when depleted) |
| Balance | Thin progress bar + percentage |

Progress bar color: green ≥ 50%, orange < 50%, red when depleted. Rows where `credits === 0` show `—` in all numeric columns and **"Not allocated"** in the Balance column.

**Search:** Input above the list filters employees by name or email without collapsing open rows.

**Adjust Credits button** moved to the card header — opens `AdjustCreditsModal` as before.

`LeaveAdminCard` component removed entirely.

---

## DayCare Punch Log CSV — OT Column

**Status:** Shipped (client only). OT eligibility and amounts are computed server-side; this change surfaces the result in the exported CSV.

**Page:** `/dashboard/company/punch-logs` → Generate Report (DayCare)

**Files:** `lib/exports/employeePunchLogs.js`, `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

**Problem:**

The DayCare CSV export had no OT column. Overtime hours were not visible in the generated report even when employees had approved OT on the server.

**Fix:**

- `exportEmployeePunchLogsCSV_v2` accepts a new `cutoffOtThreshold` parameter (passed in from the page component).
- Before the date-key deduplication loop, total `netWorkedHours` per employee is pre-summed across all raw logs. This is required for DayCare employees who can have multiple punch records on the same date (DRIVER_AIDE_AM, REGULAR, DRIVER_AIDE_PM as separate entries) — summing after deduplication would undercount.
- OT per employee: `max(0, totalWorkedHours - cutoffOtThreshold)`, only applied when the employee has at least one approved OT record (`otStatus === "Approved"`).
- New **OT** column inserted between SL and Total in both the header row and every data/grand-total row.

---

## Punch Log Requests — Approval Card Date Off-By-One

**Status:** Shipped (client only).

**Page:** `/dashboard/company/punch-logs` → Punch Log Requests Pending Approval

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

**Problem:**

The pending approval card showed the requested date one day earlier than what the employee actually submitted (e.g. employee requests Jun 15, admin sees Jun 14). `req.requestedDate` is a date-only value (no time component), but it was formatted with `safeDate(d, companyTimezone)`, which does `new Date(d)` — parsed as UTC midnight — and then converts into the company's timezone. For any timezone behind UTC (e.g. `America/Los_Angeles`), that conversion rolls the date back by one day. The reject-request dialog had the same issue.

**Fix:**

Added `safeCalendarDate`, which parses the date's Y/M/D parts directly, pins them to noon UTC, and formats in UTC — avoiding any timezone-driven shift. Used it for `req.requestedDate` in both the approval card and the reject dialog, in place of `safeDate(..., companyTimezone)`.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyConfigurations.jsx` | Added `AdjustCreditsModal` + `LeaveCreditsAccordionCard` components; removed `LeaveAdminCard`; added avatar helpers (`avatarColor`, `avatarInitials`, `AVATAR_COLORS`) |
| `lib/exports/employeePunchLogs.js` | Added `cutoffOtThreshold` param; pre-sum `netWorkedHours` before deduplication; added OT column to DayCare CSV header, data rows, and grand total |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | Passes `cutoffOtThreshold` into the CSV export call; added `safeCalendarDate` helper and used it for `requestedDate` in the approval card and reject dialog to fix an off-by-one date bug |
