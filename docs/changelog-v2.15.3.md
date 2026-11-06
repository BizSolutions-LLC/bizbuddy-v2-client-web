# Changelog — v2.15.3

BB-115: Admins get a "Set up your business" guide at the top of the sidebar. It walks them through setup in order, links each step to its page, and ticks steps off as they're done.

BB-106: The Leave Report is now an Excel workbook built by the server in the company's template layout: one sheet per leave type, one row per employee, and one column per pay date. The client sends the filters and downloads the file. The BB-098 CSV/PDF reports are removed from the UI.

BB-118: The Live Server page shows when the server started and which commit it's running, so system admins can check this without opening Render.

---

## BB-106 — Leave Report (server-built template workbook)

**Status:** Complete (client), confirmed by Carlo. Released in v2.15.3. Needs the server's BB-106 release (bizbuddy-v2-server v2.11.4, new endpoint `GET /api/reports/leave/template`), which must ship first.

**Page:** Settings → Leave → **Generate Report** button → "Generate Leave Report" dialog. File: `components/Dashboard/DashboardContent/CompanyPanel/Settings/LeaveReportDialog.jsx` (rewritten, same props).

**Dialog fields:**
- **Year:** the current year and the 4 before it. Defaults to the current year.
- **Range:** `Whole year` / `Quarters` (Q1–Q4) / `Months` (Jan–Dec).
  - Quarters and months each have an "All" option. "All" sends no range, so the report covers the whole year.
  - Only the param for the chosen mode is sent, never both. The server returns 400 if both are sent.
  - When only part of the year is picked, a note says Balance <Y> is as of the end of the last selected cutoff.
- **Leave Types:** defaults to all. Each type becomes one sheet.
- **Department:** admins only. Supervisors don't see it, because the server scopes them to their own department.
- **Employees:** defaults to all.
- **Include inactive employees:** checkbox.
- Help text describes the workbook columns (previous-year balance, credits, pay-date columns, total used, balance, next year's beginning balance).

**Removed from the dialog:** the report type (Balance Summary / Activity by Period / Fiscal-Year Expiration), From/To dates, Group By, Year Basis, Expiring Within, the Granted column option and the CSV/PDF format. The server endpoint `GET /api/reports/leave?type=…` is unchanged; it just isn't called from this page any more.

**Download (`lib/leaveReportActions.js`, new):**
- `downloadLeaveTemplateReport()` calls the endpoint with `fetch`, in the same way as `lib/yearlyHoursReportActions.js`. The repo has no axios instance.
- It sends only the filters that are set. Lists are joined with commas.
- The filename comes from `Content-Disposition` (`Leave_Report_<Company>_<year>[_Q1-Q2].xlsx`). The fallback is `Leave_Report_<year>.xlsx`.
- A failed request returns JSON `{ message }`, which is shown in the error toast.

**Deleted:** `lib/exports/leaveReports.js` (the BB-098 CSV/PDF writer). Its only importer was the old dialog.

**Other:** `LeaveSettings.jsx`: for BB-106 only the comment on `reportOpen` changed (BB-098 → BB-106). Its other changes in this release belong to BB-115.

**Server-repo impact:** none further; the endpoint is already built and `Content-Disposition` is exposed through CORS. Ship order: server first, then client.

---

## BB-115 — "Set up your business" guide

**Status:** Built (client), released in v2.15.3. See **Open items** below. Needs the server's BB-115 release (bizbuddy-v2-server v2.11.4, `/api/company-setup/checklist` endpoints plus the `Company.setupGuide` migration), which must ship first. Until it's deployed the checklist call fails and the guide simply doesn't show.

**Who sees it:** admin and superadmin, including B. Buddy. Supervisors and employees don't, and the client doesn't call the API for them. A 403 hides the guide and stops further calls.

**Sidebar card** (`components/Dashboard/SetupGuide/SetupGuideCard.jsx`, mounted at the top of the sidebar's scroll area in `components/Dashboard/sidebar.jsx`):
- "Set up your business", a progress bar, and "5 of 15 steps · 4/9 required".
  - Companies on cutoff OT get 15 steps (9 required). Daily and weekly companies get 14 (8 required), because the server only sends the `cutoff` step when `otBasis` is `"cutoff"`. The client renders the steps it receives and assumes no fixed count.
- The **Up next** step (`nextStepKey`) with its `detail` hint, a **Go** button and **View all steps**.
- When every required step is finished (`isComplete`), the title becomes "You're all set" with a note that optional steps remain.
- When the guide is hidden (`dismissed`) or every step is finished (`allFinished`), the card shrinks to a one-line **Setup guide (36%)** entry. Clicking it reopens the guide (`POST …/reopen`) and opens the full list.

**Full checklist** (`SetupGuideSheet.jsx`, a right-side panel built on the `sheet` primitive):
- Intro text, progress, then every step in server order. Step titles, descriptions and hints are shown exactly as the server sends them.
- Each row shows a status icon (done/reviewed ✓, skipped, todo, or a lock when it depends on unfinished steps), a **Required** tag, **Up next**, and "3/5" progress when the server sends it.
- The server caps `progress.current` at `target`, so a finished "add at least one" step reads "1/1" (e.g. with 46 employees).
- Expanding a row (the Up next row starts expanded) shows the description, the hint, "Do *X* first" for blocked steps, and the buttons: **Go**, **Mark reviewed / Undo** (review steps), **Skip / Undo skip** (optional steps).
- Footer: **Hide guide** (`POST …/dismiss`).
- Action errors show in the panel, in the server's words. Every action re-renders from the checklist the server returns.

**Step links** (`setupRoutes.js`, server `page` → route):
| `page` | Route |
|---|---|
| `company_profile` | `/dashboard/company/profile` |
| `departments` | `/dashboard/company/departments` |
| `locations` | `/dashboard/company/locations` |
| `employees` | `/dashboard/company/employees` |
| `shifts` / `schedules` | `/dashboard/company/shifts` / `/dashboard/company/schedules` |
| `cutoff_settings` | `/dashboard/company/configurations?tab=ot-config` |
| `cutoff_periods` | `/dashboard/company/cutoff-periods` (the `department_cutoffs` step, added by the server 2026-11-06) |
| `attendance_settings` | `/dashboard/company/configurations?tab=time-settings` |
| `leave_policies` | `/dashboard/company/leave-settings?section=leave-types` |
| `leave_settings` | `/dashboard/company/leave-settings?section=leave-credits` |
| `payroll_settings` | `/dashboard/employee/payroll?tab=company` |
| `holidays` | none: there's no holidays page on web yet, so the step shows "Not available on web yet" and no Go button |

- Pages locked by the company's plan (same rule as the sidebar, `lockChildByPlan`) show **Upgrade to <plan>** instead of Go, which opens Subscription.

**Refreshing** (`useSetupGuide.js`): fetched on load, on every route change (covers coming back from a step's page) and when the window regains focus. Older responses that arrive late are ignored.

**Deep links added for the guide:**
- `CompanyConfigurations.jsx`: reads `?tab=` (`time-settings`, `ot-config`, `break-policy`, `fixed-hours`, `daycare` for DayCare companies) and opens that tab, including when the link changes while the page is open. Unknown values are ignored.
- `Payroll.jsx`: reads `?tab=` (e.g. `company`, `employee`) the same way.
- `LeaveSettings.jsx`: the Leave Credits settings card and the Manage Leave Types card are wrapped in `id="leave-credits"` / `id="leave-types"`. `?section=` scrolls to that card once the page has loaded.

**New files:** `lib/companySetupApi.js` (the 7 calls), `components/Dashboard/SetupGuide/` (`useSetupGuide.js`, `setupRoutes.js`, `SetupGuideCard.jsx`, `SetupGuideSheet.jsx`).

**Server-repo impact:** none further; the endpoints are already built. Ship order: server (with the `Company.setupGuide` migration) first, then client.

**Mobile:** outside this repo. The server detects steps done on mobile, so the web guide stays accurate either way.

**Open items (from testing, not yet fixed):**
- **"Assign employees to departments" stays to-do at 42/46** ("4 employee(s) missing a department or hire date"). The client shows the server's `status` as-is and won't treat "nearly done" as done. The server's current code already leaves out B. Buddy, the owner account and inactive users, so if it still shows 42/46 on that code, the 4 are real active employees. They'd need a department and hire date, or the server would have to change the step, because it's required and can't be skipped.
- **Reopen error not shown:** if `POST …/reopen` fails from the one-line "Setup guide (x%)" entry, nothing is displayed, because errors show inside the panel and the panel isn't open yet. Minor; not fixed.

---

## BB-118 — "Running since" on Live Server

**Status:** Built (client), released in v2.15.3. No server change needed; the data is already in `GET /api/system-admin/server/health`.

**Page:** System Admin → Live Server (`/system-admin/server`), at the bottom of the Health card. File: `components/system-admin/server/HealthCard.jsx`. It replaces the old "Version 688ce14 on master" line and uses the data the card already loads, so there's no extra request.

**Label:** **Running since** Nov 6, 2026, 10:15 AM · commit 688ce14 (master)
- The date is `process.startedAt` in the viewer's local time.
- `commit` and `branch` are `null` when the server isn't on Render. With no commit, only the date shows. The branch only shows alongside a commit.
- The label hides when a health call fails and comes back on the next success. A 429 doesn't hide it; the page shows its "paused for a minute" note.

**Wording:** this is when the server process last started, not the deploy time. A deploy resets it, but so does a crash or manual restart.

**Open item:** a real "Last deployed" time isn't available yet. The health endpoint has no deploy timestamp, so it needs a server change. The proposed approach is a build-time timestamp returned as a new field such as `instance.deployedAt`. Waiting for Carlo's decision.
