# Changelog — v2.14.28

BB-087: Admins, supervisors, and superadmins can now download the yearly "Total Staff Hours" Summary report (one row per employee, yearly Total Hrs + OT Hrs broken out by calendar month) as an `.xlsx` file, generated server-side on demand — replacing the manual spreadsheet/VLOOKUP process previously used every cutoff period.

BB-085: Fixed the "Flagged" pill/badge/counter/tab on the Cutoff Review screen, which previously used three different, disagreeing definitions of "flagged" (including counting purely informational tags like OT and auto clock-out) and never hid the "Possible duplicate" tag once a record was approved.

BB-090: Excluded rows on the Cutoff Review screen now show a "Reset" button next to the "Excluded" badge, matching the button that already existed for approved rows — staff who excluded a record by mistake (or changed their mind) can now put it back to pending instead of being stuck.

BB-091: Split the "Approve All Clean" bulk-approve button on Cutoff Review into two: "Approve All Schedule" (new — bulk-approves using each record's matched shift, DayCare only) and "Approve All Raw" (the old "Clean" button's exact behavior, renamed to say what it actually does).

---

## BB-087 — Yearly Total Hours Report Download

**Status:** Client-ready; functionally blocked until the companion server-repo endpoint is deployed.

**Page:** Employees Punch Logs (`/dashboard/company/punch-logs`)

**Files:**
- `lib/yearlyHoursReportActions.js` (new)
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/YearlyTotalHoursReportTrigger.jsx` (new)
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

**Ask:** New server endpoint `GET /api/reports/yearly-total-hours/:companyId?year=YYYY` returns a binary `.xlsx` file (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, filename via `Content-Disposition`) instead of the usual JSON envelope — admin/supervisor/superadmin only, `year` optional (server defaults to current year). Client work was purely the consumer side: a trigger to call the endpoint and save the binary response as a file download, with a year picker (no company-picker needed — every CompanyPanel page, including for superadmin, already scopes to the logged-in user's own resolved `companyId`).

**Investigation findings:**
- No shared API client wraps blob/binary responses in this repo — every existing file download (`lib/payslipActions.js`, `ImportPunchLogs.jsx`'s template download, `lib/exportPayrollSummary.js`) uses a plain `fetch` + `response.blob()` + synthetic `<a download>` click, never axios `responseType: 'blob'`. `lib/payslipActions.js`'s `downloadPayslipPdf` was the closest match (Bearer header, `Content-Disposition` filename parsing, blob → object URL → click → revoke) and was adapted directly rather than building a new pattern.
- `EmployeesPunchLogs.jsx` already had an existing "Generate Report" button, but it builds a CSV client-side from already-fetched in-memory rows — a different mechanism from this ticket's server-generated `.xlsx`. Kept as a visually distinct sibling trigger (separate icon, `Popover` instead of that button's `Dialog`) so the two aren't confused.
- `companyId`, `companyName`, and role (`currentUserRole` → `canEdit`, fetched at bootstrap from `GET /api/account/profile`) were already resolved in `EmployeesPunchLogs.jsx`'s existing state — no new fetches or state needed in the host component.

**Fix:**
- `lib/yearlyHoursReportActions.js` — `downloadYearlyTotalHoursReport({ apiUrl, token, companyId, year, fallbackFilename })`: fetches the endpoint with a Bearer header, parses a JSON error body on non-2xx, extracts the filename from `Content-Disposition` (falling back to a generated name), then triggers the browser download via `createObjectURL` + a synthetic `<a download>` click.
- `YearlyTotalHoursReportTrigger.jsx` (new sibling component) — a `Popover`-based trigger (not a modal, given it's a single dropdown + button) with a year `Select` and a Download button with loading state and error toast; renders `null` when the caller isn't admin/supervisor/superadmin. Year options start at a fixed 2024 floor and run through the current year (`Array.from({ length: CURRENT_YEAR - START_YEAR + 1 }, ...)`), so the range self-extends every January with no code change needed.
- `EmployeesPunchLogs.jsx` — new trigger mounted in the existing header toolbar, right after "Generate Report," passing through the already-existing `companyId`, `companyName`, and `canEdit` state.

**Server-repo impact:** Blocking. `GET /api/reports/yearly-total-hours/:companyId?year=YYYY` must exist and be deployed in `bizbuddy-v2-server` for this to function — the client code is a pure consumer and needed no contract negotiation, but until the endpoint is live wherever `NEXT_PUBLIC_API_URL` points, clicking Download will 404 and surface as an error toast (expected, not a client bug).

**Explicitly out of scope:** Full multi-tab workbook (per-payroll-date detail, driver/aide split, training, sick-leave columns) — Summary tab only, per the ticket. No company-picker UI for superadmin, matching this app's existing convention of scoping every CompanyPanel page to the logged-in user's own company.

### Files Changed

| File | Changes |
|---|---|
| `lib/yearlyHoursReportActions.js` | New — `downloadYearlyTotalHoursReport()`, fetch + `Content-Disposition` filename parsing + blob download helper, adapted from `lib/payslipActions.js`. |
| `.../Punchlogs&Overtimes&Leaves/YearlyTotalHoursReportTrigger.jsx` | New — role-gated `Popover` trigger with a self-extending year `Select` (2024–current) and Download button. |
| `.../Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | Mounted the new trigger in the header toolbar, passing existing `companyId`/`companyName`/`canEdit` state. |

---

## BB-085 — Fix "Flagged" Pill Accuracy on Cutoff Review

**Status:** Complete (client only).

**Page:** Cutoff Period Review (`/dashboard/company/cutoff-periods/[id]/review`)

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Ask:** The "Flagged" pill felt inaccurate/meaningless; asked to study it, make it accurate, consider letting it be removed, and stop showing it once the underlying record is approved. Also asked whether server-side work was needed.

**Investigation findings:**
- The same screen computed "Flagged" three different, disagreeing ways: the employee-card badge and the sticky-header counter counted *any* tag at all (including purely informational ones like OT, "snapped to schedule," and auto clock-out), while the "Flagged" filter tab only counted `conflict`/`unscheduled` record types and ignored tags entirely — so the badge could show "Flagged" for something the Flagged tab wouldn't agree was flagged. The tab's own logic also had no branch for driver-segment records at all, so driver segments were never counted as flagged there, unlike in the badge/counter.
- All underlying data (`tags`, `cls`, `approval.status`, `tl.isApproved`) was already present in the existing `/approvals` API response — the "flagged" definitions live entirely in client-side aggregation, confirming this is a pure client-side fix with no new field or endpoint needed.
- `late`, `leftEarly`, and `auto` tags were already correctly hidden once a record is approved (`&& !tl.isApproved` guards); the `"Possible duplicate"` tag was the one exception — it kept showing indefinitely even after approval, which is the concrete bug behind "once approved, no need to show it."
- No existing dismiss/clear-pill interaction pattern exists anywhere in the app; confirmed with the user that a manual removable pill wasn't needed — accuracy + auto-hide-on-approval covers the ask.

**Fix:**
- Added a single shared helper, `isRecordFlagged(r, { includeConflict })`, as the one source of truth for "needs attention": unscheduled (or, opt-in, conflict) record types, or a tag explicitly classed `"flag"` (currently "Left Xmin early" and "Possible duplicate") — excluding informational tags like OT/late/snap/auto that shouldn't trigger the badge.
- Card badge (`hasFlag`), sticky-header counter (`totalFlagged`), and the "Flagged" tab (both its filter and its count) all now call this same helper, so all three agree with each other. This also fixed the tab's missing driver-segment branch as a side effect of unifying the logic.
- Gated the `"Possible duplicate"` tag with `&& !tl.isApproved`, matching the pattern already used for `late`/`leftEarly`/`auto`, so it disappears once the record is approved.

**Server-repo impact:** None — confirmed during investigation that everything needed was already delivered by the existing `/approvals` response; this was entirely a client-side aggregation bug.

**Explicitly out of scope:** A manual, user-dismissible "X to clear" pill — declined by the user in favor of the pill simply being accurate and auto-hiding once approved (no persistence question to resolve, so no server-side flag/endpoint needed either).

### Files Changed

| File | Changes |
|---|---|
| `.../Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | New shared `isRecordFlagged()` helper; card badge, sticky counter, and "Flagged" tab (filter + count) unified to use it; `"Possible duplicate"` tag now hidden once approved. |

---

## BB-090 — Add Re-Exclude/Reset Button for Excluded Records on Cutoff Review

**Status:** Complete (client only).

**Page:** Cutoff Period Review (`/dashboard/company/cutoff-periods/[id]/review`)

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Ask:** Once a record was marked "Excluded," the row showed only a static badge with no way to undo it — staff who excluded something by mistake, or changed their mind, were stuck. Ticket included the root cause already diagnosed: the reset API (`PATCH /api/cutoff-periods/:id/approvals/:approvalId/reset`) already accepts both `approved` and `excluded` as valid source statuses server-side; the client UI simply never rendered the Reset button for the excluded branch.

**Investigation findings:**
- Confirmed the ticket's diagnosis exactly: `TimelineRow`, `PunchSubRow`, and `DriverSegmentRow` each had an identical `localStatus === "excluded"` ternary that rendered only the static badge, versus the `approved` branch rendering the same badge plus a working `Reset` `ActionBtn`.
- Traced `onReset` end-to-end and confirmed it was already fully wired from all three leaf components up through `EmployeeCard` to the real handler, `doReset` — a generic `PATCH .../approvals/:id/reset` call with no client-side restriction to "approved" only. `RotateCcw`/`ActionBtn` were already imported and in use in the same file. So no new plumbing, imports, or API calls were needed — purely a missing JSX branch.

**Fix:**
- `TimelineRow`, `PunchSubRow`, `DriverSegmentRow` — the excluded-status branch now renders the "Excluded" badge plus a `Reset` `ActionBtn`, identical to how the approved branch already renders "Approved" + `Reset`, reusing the existing `onReset(id)` handler.
- Once reset, the record drops back to pending and the existing "Exclude" button (already wired) is available again — same flow already used for approved rows.

**Server-repo impact:** None — confirmed the reset endpoint already accepts `excluded` as a source status; this was purely a missing client-side UI branch.

**Explicitly out of scope:** None — ticket was fully self-contained.

### Files Changed

| File | Changes |
|---|---|
| `.../Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | `TimelineRow`, `PunchSubRow`, `DriverSegmentRow` — excluded-status branch now also renders the existing `Reset` `ActionBtn` next to the "Excluded" badge, reusing the already-wired `onReset` handler. |

---

## BB-091 — Split "Approve All Clean" into "Approve All Schedule" / "Approve All Raw"

**Status:** Complete (client only) — one unverified server-side assumption flagged below.

**Page:** Cutoff Period Review (`/dashboard/company/cutoff-periods/[id]/review`)

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Ask:** Add per-employee bulk-approve buttons for "Raw" and "Schedule" approval modes, alongside the existing "Approve All Clean." Scoped to DayCare — not necessarily BNC.

**Investigation findings:**
- Discovered "Approve All Clean" was already, functionally, a Raw-mode bulk approve: `doBulkApprove` hardcoded `approvalMode: "raw"` in its request body regardless of which individual actions (`approve-schedule`/`approve-raw`) each swept-up record actually offered. So a literal "Approve All Raw" would have been identical behavior under a different name — confirmed with the user this should be a rename, not a new third button.
- Traced why "Approve All Schedule" can't cleanly exist for BNC companies: `isBNC` is a single company-wide flag, not per-record. BNC driver segments never get an `approve-schedule` action (segment window is authoritative — raw only). BNC regular punches do get `approve-schedule`, but the individual "Schedule" button for those opens a manual shift-picker modal (`handleApproveSchedule`) because there's no single unambiguous matched shift — a bulk action can't resolve that per-row ambiguity for N records at once. DayCare doesn't have this problem (schedule is already unambiguous server-side for both segments and regular punches). Confirmed with the user to scope "Approve All Schedule" to DayCare only rather than show a button that would sweep up nothing for BNC.
- The per-employee "bulk eligible" flag (`hasBulk`) was computed identically in two separate places in the file (initial load and the incremental refresh merge) — same duplicated-logic shape already seen and fixed in BB-085 — so both needed updating in parallel to stay consistent.

**Fix:**
- `doBulkApprove` generalized to take an `approvalMode` param ("raw" | "schedule") instead of hardcoding "raw"; two thin wrappers, `doBulkApproveRaw` and `doBulkApproveSchedule`, call it with the respective mode rather than duplicating the whole fetch/optimistic-update/error-handling block.
- Bulk eligibility now checks for the specific action each record offers (`approve-raw` vs `approve-schedule`) instead of "any of the three approve actions."
- Replaced the single `hasBulk` employee-level flag with two — `hasBulkRaw` and `hasBulkSchedule` — computed in both places records get merged. `hasBulkSchedule` is explicitly gated `!isBNC`.
- UI: the old single "Approve All Clean" button is now two — "Approve All Schedule" (violet, `CalendarCheck` icon, DayCare-only) and "Approve All Raw" (orange, `Clock` icon — same position/styling as the old Clean button, same underlying behavior, accurately renamed).

**Server-repo impact:** Flagged, not blocking. "Approve All Schedule" sends `approvalMode: "schedule"` to the *bulk* endpoint (`PATCH .../approvals/bulk`) for the first time — previously only `"raw"` had ever been sent there. The *per-row* endpoint already accepts `approvalMode: "schedule"`, but whether the separate bulk endpoint honors the same field the same way is unverified from this repo. Worst case if unsupported: the button fails gracefully via the existing error-toast path, no data risk — recommend confirming with the server side during QA.

**Explicitly out of scope:** BNC bulk-schedule approval — deliberately not built; BNC's schedule-eligible records all require the manual per-row shift picker, so there's nothing safely bulkable there today.

### Files Changed

| File | Changes |
|---|---|
| `.../Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | `doBulkApprove` parameterized by `approvalMode`; new `doBulkApproveRaw`/`doBulkApproveSchedule` wrappers; `hasBulk` split into `hasBulkRaw`/`hasBulkSchedule` (schedule gated DayCare-only) in both merge loops; "Approve All Clean" button replaced with "Approve All Schedule" + "Approve All Raw." |
