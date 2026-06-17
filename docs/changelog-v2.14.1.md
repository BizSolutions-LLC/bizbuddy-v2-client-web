# Changelog — v2.14.1

Employee panel UI/UX overhaul — mobile-first responsiveness across TimeKeeping, Leaves, and shared calendar.

---

## Change 1 — ModernCalendar Mobile Responsiveness

**Status:** Shipped (client only).

**Component:** `components/common/ModernCalendar.jsx`

**Consumers:** Schedule, Overview, and any other page using `ModernCalendar`.

---

### What Changed

**Weekday header row:**
- Weekday labels now carry both a `short` (single/two-char) and a `long` (3-char) variant.
- On mobile (`< sm`): abbreviated labels rendered — S / M / Tu / W / Th / F / S.
- On desktop (`sm+`): full labels rendered — Sun / Mon / Tue / Wed / Thu / Fri / Sat.
- Cell padding reduced from `p-3` to `p-1.5 sm:p-3`.

**Day cells:**
- Height reduced from `h-16` to `h-10 sm:h-16` — more cells visible on small screens without scrolling.
- Cell padding reduced from `p-2` to `p-1 sm:p-2`.

**Selected date indicator:**
- On mobile: selected date number renders as an orange-filled circle (`bg-orange-500 text-white`, `w-6 h-6 rounded-full`).
- On desktop: reverts to the original orange text with ring inset (`sm:bg-transparent sm:text-orange-700 sm:ring-2`).
- The `ring-2 ring-orange-500 ring-inset` class on the cell itself is now `sm:ring-2 sm:ring-orange-500 sm:ring-inset` — ring hidden on mobile to reduce visual noise at compact cell size.

---

## Change 2 — Employee Punch Logs Mobile-First Header

**Status:** Shipped (client only).

**Page:** `/dashboard/employee/punch-logs`

**File:** `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`

---

### What Changed

**Header layout:**
- Changed from `flex-col md:flex-row` to `flex-col sm:flex-row sm:items-center` — more aggressive stacking on mobile.
- Title reduced from `text-2xl md:text-3xl` to `text-2xl` with `leading-tight` and `flex-shrink-0` on the icon.

**Action buttons:**
- "Punch" button: hidden on mobile, shown on desktop (`hidden sm:inline-flex`), styled orange-primary.
- "Contest time" button: always visible; label shows "Contest" on mobile, "Contest time" on desktop via `hidden sm:inline` / `sm:hidden`.
- "Request entry" button: always visible; label shows "Request" on mobile, "Request entry" on desktop.
- Export button: collapsed into a `DropdownMenu` (CSV, Grid CSV options), hidden on mobile (`hidden sm:inline-flex`).
- Refresh button: icon-only, hidden on mobile (`hidden sm:inline-flex`).

**TRAINING punch type badge:**
- Added `TRAINING` to `PunchTypeBadge` config — green color, `GraduationCap` icon, label "Training".

**V3 Cutoff components:**
- `V3CutoffBadge`: compact rectangular badge for the table cell — Approved (green), Awaiting (amber), Rejected (red).
- `V3CutoffBox`: expanded block for the side panel — shows badge, cutoff period date range, and period status.
- Replaces old verbose `CutoffApprovalBadge` (tooltip-wrapped outline badge) which is now removed.

**My Requests section:**
- Redesigned as a collapsible accordion card (`bg-card rounded-xl border overflow-hidden`).
- Request cards now use a compact row layout with `min-w-0` and `flex-shrink-0` for mobile safety.

---

## Change 3 — Employee Contest Time Logs V2 Redesign

**Status:** Shipped (client only).

**Page:** `/dashboard/employee/contest-time-logs`

**File:** `app/dashboard/employee/(C_TimeKeeping)/contest-time-logs/page.jsx`

---

### What Changed

Full page component redesign replacing the previous `Card`/`Table`/`Badge` layout.

**Status pill (`PillV2`):**
- Inline-style pill with hardcoded color pairs: Pending (`#faeeda` / `#633806`), Approved (`#eaf3de` / `#3b6d11`), Rejected (`#fcebeb` / `#791f1f`).
- Icon embedded inside the pill (11px).

**Reason labels:**
- Added `REASON_MAP` constant mapping API keys (`network_delay`, `forgot_to_clock_in`, etc.) to human-readable labels.
- `fmtReason()` helper applies the map with a fallback to the raw value.

**Side panel (`PanelContentV2`):**
- Slides in when a row is selected.
- Sections: date + status pill, Requested times (clock in/out in orange), Original times, Request info (reason + description), Submitted date, Approver block (name + email), IDs (Contest ID and Time log ref).
- Sub-components: `DetailRowV2`, `IdRowV2`, `SectionLabelV2`, `DividerV2` — all inline-styled for pixel precision.
- Close button (X icon) in the panel header.

**Filter bar:**
- Status filter via `Select`.
- Search input with `SlidersHorizontal` icon.
- Download button (icon + dropdown with `DropdownMenu`).

---

## Change 4 — Employee Overtime Requests V2 Redesign

**Status:** Shipped (client only).

**Page:** `/dashboard/employee/overtime`

**File:** `app/dashboard/employee/(C_TimeKeeping)/overtime/page.jsx`

---

### What Changed

Full page component redesign replacing the previous `DataTable` + modal pattern.

**Custom inline table:**
- Replaces `DataTable`. Columns: Date submitted (sticky left), Hours, Status, Approver, Reason, Last updated.
- Table has `minWidth: 580` with horizontal scroll on mobile. Date column is `position: sticky` left at `zIndex: 1`.
- Selected row highlighted with left orange border (`borderLeft: "2px solid #f97316"`) and `bg: #fff7f0`.

**Sortable columns:**
- `SortIcon` component renders `ArrowUpDown` (inactive, gray), `ArrowUp` / `ArrowDown` (active, orange).
- `handleSort` toggles direction on same column, resets to descending on new column.

**Client-side pagination:**
- 10 records per page (`PER_PAGE = 10`).
- `PageBtn` component renders styled pagination buttons.
- Footer shows "Page X of Y · N records".
- First / page numbers / Last navigation.

**Search + filter:**
- Search input filters against status, reason, approver name/email, and submitted date.
- Status `Select` filter (All / Pending / Approved / Rejected).

**Side panel (`PanelContent`):**
- Fixed 272px width panel inline with the table.
- Header: large orange hours value (e.g. `2.50h`) + "Overtime hours" label + status pill.
- Sections: Approver (name + email), Request info (reason, late hours, submitted date/time, last updated), Comments block (when present), OT ID + Time log ref in monospace.

**Approver display:**
- `getApproverName()` resolves `profile.firstName + lastName` → `email` → `"Not assigned"`.
- `getApproverEmail()` extracts email for the sub-line.

---

## Change 5 — Employee Schedule Page Cleanup

**Status:** Shipped (client only).

**Page:** `/dashboard/employee/schedule`

**File:** `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/Schedule.jsx`

---

### What Changed

**Removed: Shift Details Table**
- The "Shift Details" table section at the bottom (showing shift name, date, timezone, start/end times, local time, total hours) has been removed entirely.
- The calendar and shift card panel above it remain unchanged.
- `Table`, `TableHeader`, `TableBody`, etc. imports removed. `AnimatePresence`, `isSameDay`, `startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `isToday`, `toZonedTime`, `Select` also removed (no longer needed).

**Navigation buttons:**
- "Today", "Prev", "Next" nav buttons wrapped in `<div className="hidden sm:flex flex-wrap gap-2">` — hidden on mobile to reduce header clutter.

---

## Change 6 — Employee Leave Logs V2 Redesign

**Status:** Shipped (client only).

**Page:** `/dashboard/employee/leave-logs`

**File:** `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx`

---

### What Changed

Full page component redesign replacing the previous `DataTable` + `Dialog` pattern.

**Status pills (`StatusPill`):**
- Inline-style pills using `STATUS_CFG` map — Pending, Pending final, Approved, Rejected, Cancelled.
- Consistent color pairs with contest and overtime pages (orange-warm palette for pending, green for approved, red for rejected, indigo for pending_secondary, neutral for cancelled).

**Stats summary row:**
- `grid grid-cols-2 sm:grid-cols-4` — responsive card grid (2-up on mobile, 4-up on desktop).
- Cards: Total Requests, Approved, Pending, Rejected — each with icon, count, and label.

**Tab filter bar:**
- Horizontal scrollable tab strip: All / Pending / Approved / Rejected / Cancelled.
- Active tab styled with orange bottom border and text. Overflow-x scrollable for narrow screens.

**Custom inline table:**
- Columns: Date(s), Type, Duration, Status, Submitted.
- Sortable headers with `ArrowUpDown` / `ArrowUp` / `ArrowDown` icons.
- Client-side pagination with First / page numbers / Last footer.
- Horizontal scroll on overflow.

**Side panel:**
- Fixed 272px panel rendered inline with the table when a row is selected.
- Sections: leave type + status pill, date range (start → end), Duration, Submitted date, shift times (if available), Reason/Description, Approver details, Leave balance snapshot.
- Leave type icon pulled from `LEAVE_ICONS` map (Heart, Umbrella, Baby, AlertCircle, etc.).
- Close button in panel header.

**Removed dependencies:**
- `DataTable`, `Badge`, `Card`, `Input`, `Progress`, `DateTimePicker`, `Dialog`/`DialogHeader`/`DialogFooter` removed. Leave type dialog replaced by side panel.

---

## Change 7 — Company Punch Logs V2 Table Prototype

**Status:** In progress — V2 panel added alongside existing table (not yet replacing it).

**Page:** `/dashboard/company/punch-logs`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

---

### What Changed

**New V2 table block** added below the existing V1 table (labeled with an orange `V2` border):

- Simplified table columns: Date, Clock In, Clock Out, Duration, OT (DayCare only), Status.
- Row click selects the row; clicking again deselects.
- Row states: default, auto clock-out (purple left border), D-4 flag (red), unscheduled (amber), selected (orange + bg-orange-50).
- Tooltip icons on the date cell for flags: `AlertCircle` (unscheduled), `Timer` (auto clock-out), `AlertTriangle` (D-4).

**Side detail panel:**
- Animates in from the right (`width: 0 → 288`) via Framer Motion when a row is selected.
- Contains full punch log details — times, duration, punch type, flags, cutoff status, location, etc.
- The V1 table narrows (`flex-1 min-w-0`) when the panel is open.

**Added state:**
- `selectedLogV2` — tracks the currently selected row for the V2 panel.

> **Note:** The V2 block coexists with the existing V1 table. The V1 table remains the production table. The V2 block is marked with a comment for removal once V1 is retired.

---

## Files Changed

| File | Changes |
|---|---|
| `components/common/ModernCalendar.jsx` | Abbreviated weekday headers on mobile; compact cell height/padding; orange circle for selected date on mobile |
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` | Mobile-first header; abbreviated action button labels; desktop-only Punch/Export/Refresh; TRAINING badge; V3CutoffBadge/Box; My Requests accordion |
| `app/dashboard/employee/(C_TimeKeeping)/contest-time-logs/page.jsx` | Full V2 redesign: PillV2, REASON_MAP, PanelContentV2 side panel, filter bar with dropdown |
| `app/dashboard/employee/(C_TimeKeeping)/overtime/page.jsx` | Full V2 redesign: custom inline table, sortable columns, client-side pagination, side panel, search + filter |
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/Schedule.jsx` | Removed Shift Details table; nav buttons hidden on mobile |
| `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx` | Full V2 redesign: custom inline table, tab filter bar, side panel, stats summary grid |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | V2 table + side panel prototype added (V1 table still active) |
