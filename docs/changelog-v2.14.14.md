# Changelog — v2.14.14

BB-051: fixed a driver-day / multi-shift group showing "0h total" even though every individual segment inside it had a correct, non-zero hours value — a client-side aggregation bug where resolved punch-vs-leave conflicts weren't counted toward the group sum.

BB-066: the Cutoff Periods "Lock/Unlock/Mark Processed" success toast now shows the server's own `message` instead of a hardcoded string. While working this ticket, also found and fixed a completely empty three-dot menu on `processed` rows, confirmed (via a live 400) that `processed → locked` is intentionally not a supported transition, and added confirmation prompts plus tightened Delete to `open`-only periods.

---

## BB-051 — Driver-day / multi-shift group hours excluded after conflict resolution

**Status:** Fix applied (client only) — pending manual verification, not yet confirmed closed.

**Pages:** Cutoff Period Review (`/dashboard/company/cutoff-periods/[id]/review`)

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Ask:** Reported symptom: a "Driver Day — 3 segments" group (`Driver AM` / `Regular` / `Driver PM`) showed correct individual segment hours (1.15h / 5.5h / 1.25h) but the day-level group header displayed "0h total" instead of their sum.

**Investigation findings:** Group-level hours are computed entirely client-side, inside the `mergedEmployees` memo — no server field is involved. The `driver_group` and `punch_group` reducers there sum each segment/punch's `hours` only when `localStatus === "approved"` exactly. Once a segment's punch-vs-leave conflict is resolved via the Honor Punch / Honor Leave buttons (`doConflict`), its `localStatus` is set to `"resolved"`, never `"approved"`. Every other place in the same file that checks status (`isLocked`, the approved-count filter feeding the header stats) already treats `"resolved"` as equivalent to `"approved"` — these two reducers were the one place that didn't, so a fully-resolved driver day summed to 0 even though each segment's own `hours` value was correct all along (`DriverSegmentRow` renders `seg.hours` directly and never consults `localStatus`, which is why the per-segment rows were always right). Confirmed via `git blame`/`git show` that this predates the BB-054/BB-051 per-shift work — that feature just made the bug more visible by routing more segments through `doConflict`.

**Fix:**
- **`CutoffReview.jsx`** — both group-hours reducers (`driver_group` and `punch_group`, inside `mergedEmployees`) now include a segment/punch in the group total when `localStatus` is `"approved"` **or** `"resolved"`, matching the convention already used elsewhere in the file.

**Server-repo impact:** None — purely a client-side aggregation bug; no server field or endpoint involved.

**Explicitly out of scope:** None — single, contained fix.

### Files Changed

| File | Changes |
|---|---|
| `.../CutoffReview.jsx` | `mergedEmployees`'s `driver_group` and `punch_group` hour reducers now also count `localStatus === "resolved"` segments/punches toward the group total, not just `"approved"` ones. |

---

## BB-066 — Payroll export toast message + Cutoff Periods status-menu fixes

**Status:** Fix applied (client only) — pending manual verification, not yet confirmed closed. One sub-item (`processed → locked` revert) was attempted, confirmed rejected by the server, and reverted.

**Pages:** Cutoff Periods list (`/dashboard/company/cutoff-periods`)

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeeCutoff.jsx`

**Ask:** Per the BB-066 server-side contract doc — `PATCH /api/cutoff-periods/:id/status` now returns an enriched `message` describing the payroll-export outcome (currently on `locked`, possibly moving to `processed` later; either way the client should read `message` generically for any status-changing call rather than branching on which status triggered it). The Lock/Unlock/Mark Processed success toast should show that message instead of a hardcoded string. Three further issues were raised/found against the same list while working this:
1. The three-dot row menu rendered completely empty for `processed` periods.
2. Whether `processed` should be revertible back to `locked` — tested live; the server rejects it with a 400, confirming `processed` is intentionally terminal per the contract doc.
3. Lock Period / Mark Processed had no "are you sure" step, and Delete was available for both `open` and `locked` periods, not just `open`.

**Investigation findings:**
- `handleUpdateStatus`'s success branch never read the response body at all (`toast.success(\`Cutoff period ${newStatus}\`)`, hardcoded) — its own error branch two lines below already followed the right convention (`data.message || fallback`), just not mirrored on success. The function is shared, unbranched, across all three status transitions, so a generic `data.message || fallback` read on success is correct and automatically forward-compatible if the server later moves the enrichment from `locked` to `processed`, per the doc's stated intent.
- Empty-menu bug: none of the three `DropdownMenuItem` conditionals (`status === "open"`, `status === "locked"`, `status !== "processed"` for Delete) match when `status === "processed"`, so the menu opened with zero items instead of being disabled or hidden.
- A `processed → locked` "Lock Period" revert item was added and tested live; the server returned a 400, confirming `processed` is meant to be final, matching the contract doc's framing. Removed the added menu item as a result.
- No `AlertDialog` usage exists anywhere in this repo. This file already imports `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription` for two other modals (Configure Department Cutoff, Create Manual Cutoff) — reused that exact styling convention (orange accent, `Loader2` spinner, plain-`div` footer, no `DialogFooter` import) for the new confirmation modal instead of introducing a new pattern or a native `window.confirm`.

**Fix:**
- **Toast message** — `handleUpdateStatus`'s success branch now reads `toast.success(data.message || \`Cutoff period ${newStatus}\`)`, matching this file's own error-path and other-handler conventions (`data.message || fallback`).
- **Empty menu on processed rows** — the three-dot trigger `Button` is now `disabled={period.status === "processed"}`, so a processed row's menu can no longer be opened at all (no action was ever valid there, and none was added, per the confirmed no-revert contract).
- **Lock / Mark Processed confirmation** — new `statusConfirm` state (`{ periodId, departmentId, newStatus }`) plus an `isUpdatingStatus` loading flag. "Lock Period" and "Mark Processed" dropdown items now open a shared confirmation `Dialog` — *"Are you sure you want to lock / mark as processed this cutoff period for **{department}**?"*, with an added *"This status is final and cannot be reverted"* note on the processed variant — instead of calling `handleUpdateStatus` directly. "Unlock Period" was left un-gated (not part of this ask).
- **Delete restricted to Open only** — guard changed from `period.status !== "processed"` (shown for both `open` and `locked`) to `period.status === "open"` — locked periods no longer offer Delete at all.

**Server-repo impact:** None required for what shipped — the toast change only consumes a response shape already documented as live. The one open question is whether `processed → locked` should ever become a valid transition: if wanted later, that needs a deliberate server-side change to the status state machine; the client currently has no path to attempt it (a menu item was built, tested against the real API, and removed this session once the 400 confirmed it isn't supported).

**Explicitly out of scope (deferred):**
- Re-adding any revert path off of `processed` — would need a server-side decision first.
- The optional "Secured" badge keyed off `data.payrollExport.generated`, mentioned in the BB-066 doc as optional/not required.
- The payroll-export-download endpoint — explicitly not in scope yet per the BB-066 doc (no retrieval endpoint exists).

### Files Changed

| File | Changes |
|---|---|
| `.../EmployeeCutoff.jsx` | `handleUpdateStatus` success toast now reads `data.message`; three-dot trigger `disabled` for `processed` rows; new `statusConfirm`/`isUpdatingStatus` state driving a confirmation `Dialog` for Lock Period/Mark Processed; Delete menu item restricted to `open`-status periods only. |
