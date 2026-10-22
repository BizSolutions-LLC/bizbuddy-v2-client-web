# Changelog — v2.14.31

BB-093: Company admins couldn't see or edit an employee's address from the Company Employees page. The Employee Details modal now always shows the address, and the Edit Employee modal has a new Address section (Address Line, City, State, Postal Code).

BB-089: New department Fixed Hours setting. Selected employees are paid a flat number of hours per cutoff instead of their punches. It's configured under Company Configurations → Fixed Hours, and Cutoff Review shows and edits it.

BB-087: Yearly Total Hours report gets an optional "Leave Hrs" column.

---

## BB-093 — Edit Address of the Employee

**Status:** Complete (client and server).

**Page:** Company Employees (`/dashboard/company/employees`): Employee Details modal and Edit Employee modal

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Organizations&People/Employees.jsx`

**Investigation findings:**
- The address data already existed. `UserProfile` has `addressLine`, `city`, `state` and `postalCode`, which employees fill in themselves on their own Profile page (`EmployeePanel/Profile/MyPrsnlDplymntIdntfctns.jsx`, `PUT /api/account/profile`).
- The Employee Details modal already had address markup inside a conditional "Personal Information" block, but it never rendered. The server's `GET /api/employee` only returned `firstName`, `lastName`, `phoneNumber` and `username` for `profile`, so `profile.addressLine` was always missing on the client.
- The Edit Employee modal had no address fields, and the server's `PUT /api/employee/:id` didn't read any address keys from the request body.

**Fix (client):**
- **Edit form state:** `editForm` now includes `addressLine`, `city`, `state` and `postalCode`. `openEditModal` pre-fills them from `employee.profile`.
- **Saving:** `handleSaveEdit` pulls the four fields out of the `...employment` spread and always sends them in the `PUT` payload, as a trimmed value or `null`. Elsewhere in this file, `val()` turns an empty field into `undefined`, so the field is left out and the server keeps the old value. Sending `null` instead means a cleared address field is actually saved as empty.
- **Edit Employee modal:** new "Address" section (`MapPin` icon) between Basic Information and DayCare Settings. Address Line is full width, then City / State / Postal Code in a `grid-cols-1 sm:grid-cols-3` row. It reuses the existing `Input` and section pattern.
- **Employee Details modal:**
  - Account Information now has an always-visible "Address" row after Phone Number (`sm:col-span-2`). It joins whichever parts are filled in, or shows "—" if none are.
  - The duplicate address entry was removed from the "Personal Information" block, which now shows only date of birth and SSN.

**Server-repo impact:** Yes. In `bizbuddy-v2-server`, `src/controllers/Features/employeeController.js`:
- `getAllEmployees`: added `addressLine`, `city`, `state` and `postalCode` to the employee's `profile.select`.
- `updateEmployee`: reads the four fields from `req.body` and adds them to `profileData` using `!== undefined`, the same rule as `phone`:
  - `null` or empty clears the field.
  - A missing key leaves it unchanged.
- No schema or migration change; the columns already existed on `UserProfile`.

**Known follow-ups (not in scope):**
- The Create Employee modal and bulk CSV import don't have address fields.
- The Employee Details modal's "Personal Information" (date of birth, SSN) and "Emergency Contact" blocks still never render, for the same reason the address didn't: `GET /api/employee` doesn't return those profile fields.

### Files Changed

| File | Changes |
|---|---|
| `.../Organizations&People/Employees.jsx` | Added the four address fields to `editForm`, `openEditModal` and the `handleSaveEdit` payload (sent as trimmed value or `null`); new Address section in the Edit Employee modal; always-visible Address row in the Employee Details modal's Account Information; removed the duplicate conditional address entry from Personal Information. |
| `bizbuddy-v2-server`: `src/controllers/Features/employeeController.js` | `getAllEmployees` returns the profile address fields; `updateEmployee` accepts and saves `addressLine`, `city`, `state` and `postalCode`. |

## BB-089 — Department Fixed Hours

**Status:** Complete (client and server).

**Pages:** Company Configurations → Fixed Hours tab; Cutoff Period Review (`/dashboard/company/cutoff-periods/[id]/review`)

**Behaviour:**
- Fixed hours need two switches on: the department's master switch, which holds the hours per cutoff (default 80), and each employee's own switch. Everyone else in the department stays punch-based.
- A fixed-hours employee is paid the department's hours per cutoff, whatever their clock-ins.
  - Paid leave is part of that total: 8h of leave gives 72h regular + 8h leave = 80h. Leave balances are still used up as normal.
- Punches are kept for reference only. They aren't counted for pay, never create OT, and never block Lock or Finalize.
- Turning a department or an employee off only affects open cutoffs. Locked and processed cutoffs stay as they are.

**Fix (client):**
- **`CompanyConfigurations.jsx`:**
  - New "Fixed Hours" tab with `DepartmentFixedHoursCard`.
  - Each department has a master switch and an hours-per-cutoff input. The input saves when you leave the field, via `PUT /api/departments/update/:id`.
  - There's an expandable employee list with per-employee switches and All on / All off buttons, via `GET` / `PUT /api/departments/:id/fixed-hours-members`.
  - Summary counts for fixed-hours departments and employees.
- **`CutoffReview.jsx`:**
  - Reads `fixedHours` from the approvals response.
  - A fixed-hours employee always gets a card, even with no punches or leave, with a "Fixed hours" badge and an approved `FixedHoursRow` showing the regular + leave breakdown.
  - While the cutoff is open, an Edit Fixed Hours modal (hours 0–999, optional notes) saves via `PATCH /api/cutoff-periods/:id/fixed-hours/:fixedHoursId`.
  - Punches, driver segments and OT blocks for these employees are struck through, labelled "Not counted: fixed hours", and have no actions.
  - They're left out of pending counts, the Excluded tab and hour totals.
  - The card's total comes from the fixed row instead of punches + leave.

**Server-repo impact:** Yes, and already in the server repo (`2d8467b feat: BB-087 leave column and BB-089 fixed-hours employees`).
- Department `fixedHoursEnabled` / `fixedHoursPerCutoff`.
- The `fixed-hours-members` endpoints.
- `fixedHours` and `isFixedHoursEmployee` in the cutoff approvals response.
- The fixed-hours `PATCH` endpoint.

### Files Changed

| File | Changes |
|---|---|
| `.../Settings/CompanyConfigurations.jsx` | New Fixed Hours tab, `DepartmentFixedHoursCard`, `departmentFixedHours` state and `updateDepartmentFixedHours`. |
| `.../Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | `fixedHours` handling, `FixedHoursRow`, `FixedHoursNotCounted` label, Edit Fixed Hours modal; fixed-hours punches/segments/OT blocks are left out of actions, pending counts, the Excluded tab and totals. |

## BB-087 — Yearly Total Hours report: Leave Hrs column

**Status:** Complete (client and server).

**Page:** Yearly Total Hours report download (Cutoff Periods)

**Fix (client):**
- New optional "Leave Hrs" column in the report's extra-columns picker.
- When it's selected, the helper text explains that Leave Hrs is the paid leave already counted in Total Hrs.

**Server-repo impact:** Yes, and already in the server repo (same commit as BB-089). The report endpoint returns the leave column.

### Files Changed

| File | Changes |
|---|---|
| `.../Punchlogs&Overtimes&Leaves/YearlyTotalHoursReportTrigger.jsx` | Added `leave` to `EXTRA_COLUMNS`, plus a helper-text note when it's selected. |
