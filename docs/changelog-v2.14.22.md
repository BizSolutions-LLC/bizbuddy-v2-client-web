# Changelog — v2.14.22

BB-077: New "Import Punch Logs" feature on the admin/supervisor Punch Logs page — bulk-upload historical punch logs via CSV, consuming two new server endpoints (template download + multipart upload). Per-row results (imported vs. failed, with reasons) are shown in a single table so a user can fix and re-upload just the bad rows.

BB-079: New Leave Request "Reason" field's minimum length lowered from 15 to 10 characters.

---

## BB-077 — CSV Bulk Import of Historical Punch Logs

**Status:** Added (client only).

**Page:** Punch Logs (`/dashboard/company/punch-logs`)

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/ImportPunchLogs.jsx` (new)
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx`

**Ask:** Server implemented two new endpoints restricted to admin/supervisor/superadmin roles (403 otherwise): `GET /api/punch-log-import/template` (downloads a blank CSV template) and `POST /api/punch-log-import/upload` (multipart file upload, max 5MB / 300 data rows, `.csv` only). This ticket was the client-side UI to consume them — no server-repo work was in scope.

**Implementation:**
- New `ImportPunchLogs.jsx` — a dialog with three steps (`idle` → `uploading` → `results`), launched from a new toolbar button on the Punch Logs page, gated by the page's existing `canEdit` flag (admin/supervisor/superadmin).
- **Template download:** `fetch` with a Bearer token → `res.blob()` → object-URL `<a>` download, filename hardcoded to `punch_log_import_template.csv` (no `Content-Disposition` parsing exists anywhere in this repo, so this matches the existing convention of locally-known filenames used by `lib/exports/*.js`).
- **Upload:** the first true `multipart/form-data` upload in this repo — `FormData` with field name `file` (required exact match), Bearer token header, no manually-set `Content-Type` (browser sets the multipart boundary). Client-side pre-checks are limited to `.csv` extension and the 5MB size cap; everything else (300-row cap, CSV structural validation, all row-level business rules) is left to the server and surfaced verbatim.
- **Results:** `created[]` and `failed[]` from the 207 response are merged into one table sorted by row number — columns Row / Employee / Date & Time / Status / Reason. Successful rows show the server-parsed date+time (ISO with company-timezone offset); failed rows show the raw, unparsed values exactly as typed, since a failed row may not be a valid date at all. A small lock icon marks reasons mentioning a locked/processed cutoff period.
- **Static help text** on the idle step: supervisor department-scoping hint, BNC/Driver-Aide restriction hint, the 5 date formats the server accepts with a warning about spreadsheet autofill silently varying format per cell, and the 300-row/5MB/no-open-punch limits — plus a separate info `Alert` calling out that imported punches are auto-approved immediately (no pending-approval step, importer recorded as both submitter and approver) and get no automatic lunch/break deduction (unlike a live clock-in), so net hours can run higher than an equivalent live-punched day.
- Wired into `EmployeesPunchLogs.jsx`: new `importModalOpen` state, a toolbar `IconBtn` next to "Generate Report", and the dialog mount passing through the page's already-computed `isDayCare`, `currentUserRole`, and `refreshAll` (so the table and pending-requests list reload after an import) — no new data fetching added to the parent.

**Mid-flight spec revision:** The server's response shape was clarified after the first pass — `created[]`/`failed[]` turned out to carry per-row date/time, not just row/employeeId/reason. The results screen was redesigned from a "count-only success, detail-only failures" split into the single merged per-row table described above, since seeing the *parsed* date next to a successful row is the main way a user would catch a row that silently imported on the wrong date.

**Bug found and fixed during manual testing:** the Reason column's content rendered outside the dialog's right edge, bleeding into the page behind it. Root cause: the `<table>` used the browser default `table-layout: auto`, so `w-full` never actually capped its width — a long, unbreakable reason sentence (originally wrapped in an `inline-flex` span, which resists wrapping) stretched the whole table past the dialog boundary. Fixed with `table-fixed` plus explicit `w-*` widths on every column header, and the Reason cell now uses `whitespace-normal break-words` with a plain inline icon instead of a flex wrapper. The results-step dialog was also widened (`sm:max-w-2xl`, vs. `sm:max-w-lg` on the idle/uploading steps) to give the 5-column table more room.

**Server-repo impact:** None — both endpoints were already implemented server-side; this was client-only integration. Assumes both are reachable at whatever `NEXT_PUBLIC_API_URL` points to in the environment used for testing.

### Files Changed

| File | Changes |
|---|---|
| `.../Punchlogs&Overtimes&Leaves/ImportPunchLogs.jsx` | New file — import dialog: file picker, template download, multipart upload, merged per-row results table, static format/behavioral help text. |
| `.../Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | Added `importModalOpen` state, a role-gated toolbar button, and the `ImportPunchLogs` dialog mount (passing `isDayCare`, `currentUserRole`, `refreshAll`). |

## BB-079 — New Leave Request "Reason" minimum lowered from 15 to 10 characters

**Status:** Fixed (client only).

**Page:** New Leave Request modal (`/dashboard/employee/leave-logs`)

**File:** `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx`

**Ask:** Lower the enforced Reason minimum from 15 to 10 characters. No shared validation utility exists in this repo (confirmed during the BB-076 fix, v2.14.21) — this form hardcodes its own threshold, and no other leave-request form (e.g. the admin-side `EmployeesLeaveRequests.jsx`) duplicates this check, so the change is fully contained to this one file.

**Fix — four hardcoded `15` sites, all changed to `10`:**
- Lines 566-567: submit-handler validation (`reason.trim().length < 10`) and its error message ("must be at least 10 characters (X/10)").
- Lines 1424-1425: live character counter (`{reason.trim().length}/10 min`), turns green at 10.
- Line 1431: textarea placeholder ("at least 10 characters").
- Line 1459: Submit button `disabled` condition (`reason.trim().length < 10`).

**Server-repo impact:** None — purely client-side display/validation logic, no API contract involved.

**Flagged, not actioned:** this Reason block uses inline `style={{ color: "#3b6d11", ... }}` hardcoded hex values instead of Tailwind tokens — not on the CLAUDE.md documented drift list, and out of scope for this ticket. Flagged to the user; cleanup would be a separate task.

### Files Changed

| File | Changes |
|---|---|
| `.../Leaves/LeaveLogs.jsx` | Reason-minimum validation, live counter, placeholder text, and Submit button's `disabled` check all lowered from 15 to 10 characters. |
