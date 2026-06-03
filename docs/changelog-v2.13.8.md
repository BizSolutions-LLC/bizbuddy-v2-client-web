# Changelog — v2.13.8

BB-022: `lunchDeductionMinutes` support across the punch logs table and exports; sync overlay in Cutoff Review — blocks interaction and provides clear visual feedback while the sync + re-fetch is in flight.

---

## Change 1 — Punch Logs Table: `lunchDeductionMinutes` Display

**Status:** In Development (client only).

**Page:** `/dashboard/company/punch-logs`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

---

### Background

The server introduced a new `lunchDeductionMinutes` field on time log records. This field is set when a flat lunch deduction is applied (e.g., 30 min deducted automatically) without an actual `lunchBreak.start` / `lunchBreak.end` window being recorded. Prior to this change, the client read `lunchBreak.start` and `lunchBreak.end` exclusively:

```js
// before — always "0.00" when no break window exists
const lunchMinsStr = lunchMinutesStr(t.lunchBreak);
```

This caused three silent display bugs:
1. The Lunch column showed `0.00h` even though hours were deducted from pay.
2. The `AutoBreakBadge` (the grey "Auto" pill) did not appear on these records.
3. The expanded log card's lunch row also omitted the badge.

---

### Fix

**Lunch duration string** — computed once during record enrichment and stored as `lunchMinsStr`:

```js
const lunchMinsStr = (!t.lunchBreak?.start && (t.lunchDeductionMinutes ?? 0) > 0)
  ? (t.lunchDeductionMinutes / 60).toFixed(2)
  : lunchMinutesStr(t.lunchBreak);
```

When there is no break window but a deduction exists, the minutes are converted to hours (`/ 60`) and formatted to two decimal places. `lunchMinutesStr` is called otherwise (existing path unchanged).

**`lunchAuto` flag** — used to decide whether `AutoBreakBadge` renders in the table cell:

```js
// before
const lunchAuto = t.autoLunchApplied || t.lunchBreak?.auto;

// after
const lunchAuto = t.autoLunchApplied || t.lunchBreak?.auto || (!t.lunchBreak?.start && (t.lunchDeductionMinutes ?? 0) > 0);
```

The same guard is applied in the expanded card's lunch row for the badge:

```jsx
{(t.autoLunchApplied || t.lunchBreak?.auto || (!t.lunchBreak?.start && (t.lunchDeductionMinutes ?? 0) > 0)) && (
  <AutoBreakBadge deductible={t.lunchBreak?.deductible ?? true} />
)}
```

The existing `lunchWindow` time-range strip (showing `HH:MM – HH:MM`) is intentionally not rendered for deduction-only records — there are no timestamps to display. `deductible` falls back to `true` since a flat deduction is always subtracted from pay.

---

## Change 2 — Punch Logs Exports: `lunchDeductionMinutes` in CSV & PDF

**Status:** In Development (client only).

**File:** `lib/exports/employeePunchLogs.js`

---

### Background

The CSV and PDF export functions build their `lunchStart` and `lunchEnd` columns by reading `record.lunchBreak?.start` and `record.lunchBreak?.end` directly:

```js
// CSV — before
case "lunchStart":  return formatBreakTime(record.lunchBreak?.start, companyTimezone);
case "lunchEnd":    return formatBreakTime(record.lunchBreak?.end, companyTimezone);

// PDF — before
case "lunchStart": return fmtBreakTimePDF(record.lunchBreak?.start, companyTimezone);
case "lunchEnd":   return fmtBreakTimePDF(record.lunchBreak?.end, companyTimezone);
```

For deduction-only records these both returned `"—"`, creating a confusing export where the Lunch column showed a non-zero deduction but Start/End were blank with no explanation.

The `lunch` duration column was already correct in both exports — it reads `record.lunchMins`, which is pre-computed by the enrichment step in `EmployeesPunchLogs.jsx` (Change 1) and passed through to the export data unchanged.

---

### Fix

**CSV export (`buildCsvCell`)**

```js
case "lunchStart":
  if (!record.lunchBreak?.start && (record.lunchDeductionMinutes ?? 0) > 0)
    return "Auto-deducted";
  return formatBreakTime(record.lunchBreak?.start, companyTimezone);
case "lunchEnd":
  if (!record.lunchBreak?.start && (record.lunchDeductionMinutes ?? 0) > 0)
    return "Auto-deducted";
  return formatBreakTime(record.lunchBreak?.end, companyTimezone);
```

**PDF export (`buildPdfCell`)**

```js
case "lunchStart":
  if (!record.lunchBreak?.start && (record.lunchDeductionMinutes ?? 0) > 0)
    return "Auto";
  return fmtBreakTimePDF(record.lunchBreak?.start, companyTimezone);
case "lunchEnd":
  if (!record.lunchBreak?.start && (record.lunchDeductionMinutes ?? 0) > 0)
    return "Auto";
  return fmtBreakTimePDF(record.lunchBreak?.end, companyTimezone);
```

`"Auto-deducted"` is used in CSV (wider cells) and `"Auto"` in PDF (narrow cells) for the same semantic meaning: a flat deduction was applied by the system with no recorded break window.

---

## Change 3 — Cutoff Review: Sync Overlay

**Status:** In Development (client only).

**Page:** `/dashboard/company/cutoff-periods/[id]/review`

**File:** `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

---

### Background

The "Sync Records" button triggers `doSync`, which posts to `/api/cutoff-periods/:id/sync` and — if new records are found — calls `fetchData()` to reload the full review page. Both steps combined can take several seconds. During that time:

- The button label switched to "Syncing…" with a spinner, but the rest of the page remained fully interactive.
- There was no visual indication that a potentially long background operation was in progress.
- Users could click action buttons (approve, exclude, etc.) on stale data while the reload was pending.

---

### Fix

A full-screen overlay is rendered via `AnimatePresence` whenever `syncing` is `true`. The `syncing` flag is already held `true` for the entire duration of both the API call and the subsequent `fetchData()` re-fetch, so the overlay covers the complete operation.

```jsx
<AnimatePresence>
  {syncing && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 8 }}
        animate={{ scale: 1,    opacity: 1, y: 0 }}
        exit={{    scale: 0.92, opacity: 0, y: 8 }}
        transition={{ duration: 0.22, delay: 0.06 }}
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 px-8 py-8 max-w-sm w-full mx-4 flex flex-col items-center gap-5 text-center"
      >
        {/* Pulsing icon ring */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-blue-400/30 animate-ping" />
          <span className="absolute inset-1.5 rounded-full bg-blue-100 dark:bg-blue-900/40" />
          <RefreshCw className="relative w-7 h-7 text-blue-600 dark:text-blue-400 animate-spin" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Syncing Records</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Scanning for new employees and punch records added after this cutoff was created.
          </p>
        </div>

        {/* Indeterminate progress bar */}
        <div className="w-full h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full w-1/2 bg-blue-500 rounded-full"
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          Please wait — this may take a moment
        </p>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

**Overlay details:**

- `fixed inset-0 z-[60]` — sits above all page content and existing modals (`z-50`).
- `bg-neutral-900/50 backdrop-blur-sm` — semi-transparent gray with backdrop blur; the page is still visible but clearly inactive.
- `pointer-events-all` (default) — all clicks are absorbed by the overlay; no interaction with underlying cards is possible.
- The card scales in with a spring-like entrance (`scale 0.92 → 1`, `y 8 → 0`) and exits in reverse via `AnimatePresence`.
- The pulsing `animate-ping` ring on the icon provides a live-activity cue separate from the indeterminate progress bar sweep.
- No new state was added — the existing `syncing` boolean drives everything.

---

## Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | `lunchMinsStr` enrichment reads `lunchDeductionMinutes` when no break window exists; `lunchAuto` flag extended to cover deduction-only records in table cell and expanded card badge (Changes 1) |
| `lib/exports/employeePunchLogs.js` | CSV `lunchStart`/`lunchEnd` cells show `"Auto-deducted"`; PDF cells show `"Auto"` when `lunchDeductionMinutes > 0` and no break window is present (Change 2) |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | Full-screen sync overlay added — grays and blurs the page, blocks all interaction, shows animated card with pulsing icon ring, description, and indeterminate progress bar for the entire sync + re-fetch duration (Change 3) |
