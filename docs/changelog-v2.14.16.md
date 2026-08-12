# Changelog — v2.14.16

BB-066: added a Payroll Report Preview to the Cutoff Periods page — a header icon opens a dialog listing cutoff periods with per-period View/Download actions against the existing payroll-export endpoint, closing out the "payroll-export-download" item explicitly deferred in v2.14.14.

---

## BB-066 — Payroll Report Preview (View/Download JSON) on Cutoff Periods

**Status:** Feature added (client only) — functional today for View/Download; the "Generated"/"Not generated" status shown per period is a placeholder pending a server-side change that hasn't shipped yet. Not yet confirmed closed; one specific data point (whether the Jul 8–21 period is actually already processed) is still pending the user's own live check via the new View button.

**Pages:** Cutoff Periods list (`/dashboard/company/cutoff-periods`)

**Files:**
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeeCutoff.jsx`

**Ask:** Give the Cutoff Periods page a way to preview and download the payroll export report for a cutoff period, starting with JSON. `PayrollExportBatch` records already exist server-side (generated when a period is locked/processed) but had no client-facing access point beyond a per-period fetch endpoint nobody was calling.

**Investigation findings:**
- `GET /api/cutoff-periods` (the call behind this page's table, `fetchCutoffPeriods`) returns no `payrollExport`/generated signal per period at all — confirmed both by reading this file's own fetch/render code and by the server side confirming `getCutoffPeriods` (`cutoffPeriodController.js:362-432`) has no join/count/flag for it.
- The only existing way to check or retrieve a generated export is `GET /api/payroll-export/by-cutoff-period/:id`, which the server confirmed already exists and works: 200 returns `{ data: { employeeCount, generatedAt, payload: { periodStart, periodEnd, generatedAt, employees: [...] } } }`; 404 returns `{ message }` with **no `data` key** — the client needs to guard for that rather than assume `data` always exists.
- `PayrollExportBatch` is keyed by `companyId + periodStart + periodEnd` only — **no `departmentId` column**. One batch already covers every department for a given date range; the Cutoff Periods table's separate per-department rows for the same dates (e.g. Staff / Staff Supervisor / Driver/Aide, all "Aug 5 – Aug 18") do **not** correspond to separate export batches. An earlier version of this preview listed one row per department and filtered by the page's department chip, which was wrong on both counts.
- The server side confirmed it will enrich `GET /api/cutoff-periods` with a `payrollExport: { generated, employeeCount, generatedAt }` field per period (one extra query per list call, not per row, to avoid an N+1 pattern of calling `by-cutoff-period/:id` for 20+ rows just to paint status) — not shipped as of this writing.
- An interim placeholder was built first while the server contract was still being worked out (icon + dropdown with a single "JSON Format" item that just showed a "coming soon" toast) — fully superseded and removed once the real endpoint and its response shapes were confirmed; no placeholder code remains.

**Fix:**
- **Header** — new icon-only button (magnifying glass, `Search`) opens a "Payroll Report Preview" `Dialog`, placed before the existing "Configure" button.
- **`reportPreviewPeriods`** (new `useMemo`) — dedupes `cutoffPeriods` down to unique `periodStart`/`periodEnd` combinations (not per department), matching the batch's actual key.
- **Preview list** — each row shows the period's date range and a status line: green checkmark + "Generated {date} · {employeeCount} employees" when `period.payrollExport?.generated` is true, dimmed "Not generated yet" otherwise (currently always the latter, pending the server enrichment above).
- **Per-row actions** — two independent icon buttons, `Eye` (View) and `Download`, both calling the same new `fetchPayrollExportPayload()` helper against `GET /api/payroll-export/by-cutoff-period/:id`:
  - **View** stores the fetched payload in new `viewingPayload` state and opens a second "View Payroll Export" `Dialog` rendering `JSON.stringify(payload, null, 2)` in a scrollable monospace block.
  - **Download** builds a `Blob` from the same payload and triggers a `.json` file save (client-side generation, same convention as the existing `lib/exports/*.js` helpers elsewhere in the app).
  - New `loadingAction` state (`{ periodId, type: "view" | "download" }`) drives a per-button spinner and disables both buttons on a row while either request is in flight.
  - On a 404, the server's own `message` is surfaced via a toast rather than assuming a payload exists.

**Server-repo impact:** Real and still pending — `GET /api/cutoff-periods` needs the `payrollExport: { generated: boolean, employeeCount: number|null, generatedAt: string|null }` field added per period, per the shape agreed with the server side. Until that ships, every period in the preview shows "Not generated yet" regardless of actual DB state; View/Download are unaffected since they call the already-existing per-period endpoint directly, not the list endpoint.

**Explicitly out of scope (deferred):**
- The `GET /api/cutoff-periods` enrichment itself — server-repo work, not done here.
- Confirming actual generated/processed status against the real DB — not verifiable from this repo (no DB access). Specifically flagged: whether the Jul 8–21 period is already processed is unresolved as of this doc; the user was pointed at the new View button on that row as the way to check against live data in the meantime.
- Stale "not modeled in schema.prisma" comments noticed in `payrollExportService.js`/`payrollExportController.js` — flagged back to the server side, not a client-repo change.

### Files Changed

| File | Changes |
|---|---|
| `.../EmployeeCutoff.jsx` | New icon-only header button (`Search`) opens a "Payroll Report Preview" `Dialog`; new `reportPreviewPeriods` memo dedupes `cutoffPeriods` by unique `periodStart`/`periodEnd`; new `fetchPayrollExportPayload()`, `handleViewPayrollExport()`, `handleDownloadPayrollExport()` against `GET /api/payroll-export/by-cutoff-period/:id`; new `loadingAction`/`viewingPayload`/`isReportPreviewOpen` state; new "View Payroll Export" `Dialog` renders the raw JSON payload in a scrollable `<pre>` block; each preview row has independent View/Download icon buttons with per-button loading state. |
