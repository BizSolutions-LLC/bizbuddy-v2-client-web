# Changelog — v2.13.4

BB-007 partial fix — cutoff period dropdown deduplication on the Company Punch Logs page.
BB-004 — Recurring Schedules calendar view + Edit/Extend dialog improvements + Edit Shift Assignment bottom sheet redesign.

---

## Change 1 — Company Punch Logs: Cutoff Period Dropdown Shows Duplicate Date Ranges (BB-007, partial)

**Status:** Shipped (client only).

**Problem:** The cutoff period dropdown on the Company Punch Logs page showed the same date range repeated 2–3 times (e.g., "Jul 8 – Jul 21 (open)" appearing three times).

**Root cause:** `GET /api/cutoff-periods` correctly returns one record per department per period (e.g., Staff, Driver/Aide, Staff Supervisor each have a separate record for the same "Jul 8 – Jul 21" window). The dropdown rendered all of them verbatim because it labels entries by date only, not by department — making identical date ranges indistinguishable.

**Fix:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` — `fetchCutoffPeriods` callback.

Deduplicate the API response by `periodStart|periodEnd` before storing, keeping the first occurrence of each unique date range:

```js
// Before
setCutoffPeriods(
  (j.data || []).sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart))
);

// After
const seen = new Set();
const unique = (j.data || []).filter((p) => {
  const key = `${p.periodStart?.slice(0, 10)}|${p.periodEnd?.slice(0, 10)}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
setCutoffPeriods(unique.sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart)));
```

The dropdown is used solely for date-range navigation; per-department distinctions carry no meaning there.

---

## Change 2 — Company Punch Logs: Disable Future Cutoff Periods and Cap Date Inputs (BB-007, partial)

**Status:** Shipped (client only).

**Problem:** The cutoff period dropdown allowed selecting periods that haven't started yet (future dates), and the From/To date inputs had no upper bound — users could pick future dates that have no punch log data.

**Fix:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

**Cutoff dropdown** — periods whose `periodStart` is after today are rendered as disabled with reduced opacity:

```js
const isFuture = (p.periodStart?.slice(0, 10) ?? "") > getDefaultTo();
// SelectItem gets disabled={isFuture} + className="opacity-40 cursor-not-allowed" when true
```

Past and currently live periods (started but not yet ended) remain fully selectable.

**Date inputs** — both From and To inputs now carry `max={getDefaultTo()}` so the browser date picker prevents selecting any date beyond today.

---

---

## Change 3 — Employee Punch Logs: Cutoff OT Meter Shows `undefinedh accumulated` / `NaNh to threshold` (BB-015)

**Status:** Shipped (client only).

**Endpoint:** `/dashboard/employee/punch-logs`

**Problem:** The Cutoff OT Configuration meter displayed `undefinedh accumulated` and `NaNh to threshold` when the employee had no open cutoff period. After the first fix (adding `accumulatedHours: 0`), the meter showed `0h accumulated` with no real computation — i.e. worked hours from the loaded logs were never reflected.

**Root cause (two-part):**

1. The `otConsumptionData` memo had an early-return for the "no active cutoff period" case that was missing `accumulatedHours` in the returned object. Every downstream reference to `otConsumptionData.accumulatedHours` evaluated to `undefined`, making string interpolations produce `undefinedh` and arithmetic produce `NaN`.

2. Even after adding `accumulatedHours: 0`, the early-return bypassed the accumulation math entirely. The meter always showed static zeros regardless of how many hours were in the loaded logs.

**Fix:** `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` — `otConsumptionData` memo.

Removed the early-return. `windowLogs` now falls back to all loaded `logs` when no cutoff window exists (no date-range filtering). A labeled `else` branch sets `label = "No active cutoff period"` so the display string is always defined.

```js
// Before — early return with hardcoded zeros, skips all math
} else {
  return { type: otBasis, threshold: cutoffOtThreshold, label: "No active cutoff period",
           approvedHours: 0, pendingHours: 0, pct: 0, window: null };
}
const windowLogs = logs.filter(...);

// After — fall back to all loaded logs when no cutoff window is set
} else {
  label = "No active cutoff period";
}
const windowLogs = windowStart && windowEnd
  ? logs.filter((l) => { ... d >= windowStart && d <= windowEnd })
  : logs;
```

Accumulated hours, approved/pending OT, and the progress percentage are now computed from the currently loaded logs when no active cutoff period exists.

---

---

---

## Change 4 — Recurring Schedules: Calendar View (BB-004)

**Status:** Shipped (client only). Backend endpoints pending — see `docs/changelog_server.md`.

**Page:** `/dashboard/company/schedules`

**Problem:** The Recurring Schedules page only had a flat list/table view. No per-employee visual overview of assigned shifts by date existed.

**Fix:** New calendar view added as a toggle alongside the existing list view.

### What was built

**`components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/SchedulesCalendarView.jsx`** (new file)

- Month calendar grid (6-week, 42-cell) per employee, built with `date-fns`
- Employee selector with loading overlay while shifts are fetched
- Shift chips on calendar cells — time range (`HH:MM–HH:MM`) as primary bold text, shift name as secondary muted text
- Click any date → Day Detail panel (right column) with proportional hourly timeline
- `+` button on cell hover and right-click context menu for quick assignment
- Company timezone awareness: `GET /api/company-settings/` drives "today" highlight
- Month navigation with "Today" jump button
- All dates use UTC time extraction to avoid local-timezone shift in display

**`components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/Schedules.jsx`** (modified)

- View toggle added to header: **List** | **Calendar** buttons (orange active state)
- Calendar view renders `<SchedulesCalendarView>` inside a Card; list view renders unchanged

---

## Change 5 — Recurring Schedules: Extend Shift Action (BB-004)

**Status:** Shipped (client only).

**Problem:** From the calendar view, users had no way to repeat an existing single-day assignment forward without going back to the list view and creating a new schedule rule.

**Fix:** `SchedulesCalendarView.jsx` — Edit dialog gains a third state: **Extend**.

- Clicking **Extend** from the Edit dialog pre-fills the shift and the current day-of-week
- User picks additional days-of-week and an end date
- Submits to `POST /api/shiftschedules/create` with `skipConflicts: true` (dates already assigned are skipped)
- Dialog states: Edit (orange) → Extend (orange) → Delete confirm (red) — accent bar and icon circle change per state

---

## Change 6 — Recurring Schedules: Calendar Create Payload Fix (BB-004)

**Status:** Shipped (client only).

**Problem:** `POST /api/shiftschedules/create` returned 500 from the calendar view. The calendar's create payload was missing `replaceConflicts` and `skipConflicts` fields that the backend requires.

**Fix:** Both fields are now always sent from the calendar view:

```js
replaceConflicts: false,
skipConflicts: true,   // calendar silently skips conflicts; no conflict-resolution dialog
```

---

## Change 7 — Global: SelectTrigger Visual Bugs (BB-004)

**Status:** Shipped.

**File:** `components/ui/select.jsx`

Three bugs fixed in the shared `SelectTrigger` component that affected all `Select` instances across the app:

| # | Bug | Root cause | Fix |
|---|---|---|---|
| 7a | ChevronDown icon rendered next to content instead of at the right edge | `justify-center` on trigger — both SelectValue and icon were centered together | Changed to `justify-between` |
| 7b | Dark rectangle visible on the right portion of the trigger inside dialogs | `bg-transparent dark:bg-neutral-900` — dashboard's dark ancestor applied `neutral-900` background to the trigger | Changed to `bg-background` |
| 7c | Long shift names caused text to overflow the trigger, pushing the chevron off-screen | `[&>span]:line-clamp-1` without `min-w-0` — flex item couldn't shrink below content width | Changed to `[&>span]:min-w-0 [&>span]:truncate`; removed redundant `whitespace-nowrap` on the outer trigger |

Also added missing focus ring classes (`focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`) for keyboard accessibility.

---

## Change 8 — Global: Dialog Accent Line Fix (BB-004)

**Status:** Shipped.

**Problem:** The colored top accent line inside dialogs (used by Create, Edit, Extend, Delete confirm states in `SchedulesCalendarView`) was not rendering. The `-mt-6 mb-4` negative-margin trick relied on `overflow-hidden` being set on `DialogContent`, which it isn't.

**Fix:** Removed the `h-1 -mt-6 mb-4` div hack. Replaced with `border-t-4 border-t-{color}` on the `DialogContent` className directly. The top border follows `sm:rounded-lg` natively — no overflow clipping needed.

```jsx
// Before
<DialogContent className="max-w-sm">
  <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />

// After
<DialogContent className="max-w-sm border-t-4 border-t-orange-500">
```

Edit dialog transitions: `border-t-orange-500` (edit/extend) → `border-t-red-500` (delete confirm).

---

## Change 9 — Recurring Schedules: Edit Shift Assignment — Mobile-First Bottom Sheet (BB-004)

**Status:** Shipped (client only).

**Page:** `/dashboard/company/schedules` → Calendar view

**Problem:** The Edit Shift Assignment modal was a centered `<Dialog>` (`max-w-sm`). On mobile the dialog felt out of place — it didn't leverage the natural bottom-sheet pattern already used throughout the app (e.g., Request Punch Log Entry). The existing implementation also triggered a Radix accessibility warning: `DialogContent requires a DialogTitle` because the title was rendered as a plain `<h3>` instead of the Radix-wired `SheetTitle`.

**Fix:** `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/SchedulesCalendarView.jsx`

Replaced the centered `<Dialog>` wrapping the Edit/Delete/Extend states with a `<Sheet side="bottom">` using the same mobile-first layout pattern as the Request Punch Log Entry sheet:

| Layer | Detail |
|---|---|
| Accent line | `h-1 rounded-t-2xl` — orange for edit/extend, red for delete confirm |
| Drag handle | `w-10 h-1 rounded-full bg-muted-foreground/20` centered below accent |
| Header | `SheetTitle` (icon circle + title) + `SheetDescription` (date · employee) — `pr-8` clears the sheet's built-in close button |
| Content | `flex-1 overflow-y-auto` — edit/delete/extend states render inside, same form fields as before |
| Footer | State-aware: Edit → Remove (ghost left) + Extend/Save (right); Delete/Extend → `flex-1 h-12` paired buttons |

All three dialog states (Edit, Delete confirm, Extend) work inside the single Sheet via `showDeleteConfirm` / `showExtend` flags — no logic changes.

**Accessibility fix:** `SheetTitle` and `SheetDescription` now correctly wire the Radix `DialogTitle` and `DialogDescription` primitives, eliminating the `DialogContent requires a DialogTitle` console warning.

**Imports added:** `Sheet`, `SheetContent`, `SheetTitle`, `SheetDescription` from `@/components/ui/sheet`.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | Deduplicate cutoff period dropdown by date range (Change 1 — BB-007 partial); disable future periods + cap date inputs at today (Change 2 — BB-007 partial) |
| `components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx` | Fix Cutoff OT meter `undefinedh`/`NaNh` and missing accumulation when no active cutoff period (Change 3 — BB-015) |
| `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/SchedulesCalendarView.jsx` | New file — calendar view with day detail panel, create/edit/extend/delete dialogs (Changes 4, 5, 6, 8 — BB-004); Edit Shift Assignment converted to mobile-first bottom Sheet + accessibility fix (Change 9 — BB-004) |
| `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/Schedules.jsx` | List ↔ Calendar view toggle (Change 4 — BB-004) |
| `components/ui/select.jsx` | Three SelectTrigger visual bugs fixed: justify, background, truncation (Change 7 — BB-004) |
| `docs/changelog_server.md` | New file — backend endpoints required for calendar CRUD (DELETE/PUT /api/usershifts/:id, POST /api/shiftschedules/create 500 investigation) |
