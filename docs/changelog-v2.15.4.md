# Changelog — v2.15.4

BB-119: The employee punch log report and the punch log and schedule pages no longer use the viewer's browser time zone. Punch times show the company zone only, with no "HQ" label. Saving Leave Settings or Company Configurations can no longer overwrite the company zone with an old copy.

---

## BB-119 — Company zone only

**Status:** Complete (client), confirmed by Carlo. No server changes.

**Why:** A punch log PDF printed `Los Angeles / Manila (HQ)` while Company Configurations showed Los Angeles. The owner chose to remove the viewer's zone. After release, check the zone named on the first PDF generated.

**Report (`lib/exports/employeePunchLogs.js`, `lib/exports/_shared.js`):**
- PDF and CSV Detail show company times only. `(HQ)`, `Your/HQ`, `Your TZ / HQ TZ` and the second time are gone.
- The `Timezone:` lines, the PDF footer `TZ:` and "Generated:" all use the company zone, and the header still names it so a wrong zone stays visible.
- `getFormattedTimestamp` takes an optional zone. Only this report passes one, so other exports are unchanged.
- All three exports throw if no company zone is passed. They no longer default to UTC.
- *Later in this release:* the browser PDF and CSV Detail were replaced by server reports (items 7 and 13) and deleted. The Payroll Grid then moved to the server too (item 14), and the file was deleted.

**Report generation (`EmployeesPunchLogs.jsx`):**
- The zone is fetched when the report is generated, so a tab left open can't print an old zone. The page's zone updates to match.
- If the settings request fails, the report stops with an error. An empty zone uses `DEFAULT_TIMEZONE`, matching the server's own fallback.

**Pages:**
- `EmployeesPunchLogs.jsx`: `DualTimeDisplay` replaced by `CompanyTimeDisplay`; "Company HQ" and "Detected" labels removed.
- `PunchLogs.jsx`: `DualTime` replaced by `CompanyTime`; "Detected" label removed.
- `Schedule.jsx`, `employee-schedules/page.jsx`: "Your timezone", local times, the Local Time column and the Show/Hide Local Times button removed. The button only controlled viewer-zone times.

**Settings saves:**
- `LeaveSettings.jsx` no longer sends `timezone`.
- `CompanyConfigurations.jsx` sends `timezone` only when it was changed on that page.

---

## BB-119 — Performance report: View button

**Status:** Complete (client), confirmed by Carlo.

**Page:** System Admin → Performance → Reports → Saved reports. No server change: same `GET /api/system-admin/capacity/reports/:number/pdf`.

- `lib/systemAdminFetch.js`: new `systemAdminPdfUrl(path)` fetches the PDF with the Bearer header (never in a URL) and returns a blob address, always typed as PDF. `systemAdminDownload` and it share one internal fetch (`fetchSystemAdminFile`), so 401 and error handling match. The download works as before.
- `ReportsView.jsx`: **View** button (Eye, outline, small) before **PDF** in each row. It shows the report in a panel above the Saved reports table (report name, dates, Close button), scrolled into sight. It shows busy as `view:N`, is disabled while any action runs, and shows errors like the PDF button. Opening another report replaces the panel; the address is released on replace, close or leaving the page.

**Known limit:** saving from the embedded PDF viewer gives a random filename (use **PDF** for a named copy).

---

## BB-119 — Employees report from the server

**Status:** Complete (client), confirmed by Carlo.

**Page:** Company panel → Organizations & People → Employees, **CSV** and **PDF** buttons. Needs the server's new `GET /api/reports/employees?format=pdf|csv`, which must ship first.

- `lib/reportDownload.js` (new): `downloadServerReport({ apiUrl, token, path, fallbackFilename })` fetches a server-built report with the Bearer token, shows the server's `message` on error, takes the name from `Content-Disposition` and saves the file. The leave and yearly report downloads still use their own copies.
- `Employees.jsx`: both buttons call it (`format=csv` / `format=pdf`). The busy states, the success toast with the filename and the "No data to export" check stay. The old note under the table is replaced (see Page fixes).
- `lib/exports/employees.js`: deleted (no other importers).

**Page fixes:**
- The column picker moved from the export bar into the table toolbar, next to Filters, through a new optional `toolbarExtra` slot on `components/common/DataTable.jsx`. Its other users (`Departments.jsx`, `LeaveSettings.jsx`) don't pass it and are unchanged.
- The export bar's Rows per page dropdown is removed. It never worked: `DataTable` only reads `pageSize` when it first renders, so later changes, including "All", did nothing. Page size is set with the table's own Page Size under Filters (5–100; no "All").
- The export bar is removed. The page header now has icon buttons (shared `IconBtn`, with tooltips) for Import Guide, Import CSV, Export CSV and Export PDF, followed by the labelled Add Employee button. The export tooltips say they include every employee you can see.
- The **Active Employees** card counts accounts with `status === "active"`, matching "Active accounts" in the report.

**Behaviour changes (server side):** fixed PDF columns, every field in the CSV, Employee ID now prints, supervisors get only their team, and dates use the company zone. The export still ignores the search box.

**Excel instead of CSV:** the Export CSV button is now **Export Excel** (`FileSpreadsheet` icon, tooltip "Export Excel: every employee you can see, all fields"). `downloadCSV` is renamed `downloadExcel` and calls `format=xlsx` (fallback name `BizBuddy_Employees.xlsx`), on the server's shared Excel template: Employees and Summary sheets, title block, real dates, and confidential marks. Needs the server's `format=xlsx` to ship first. The unused `Download` import is removed. Import CSV and its sample template are unchanged.

---

## BB-119 — Departments report from the server

**Status:** Complete (client), confirmed by Carlo.

**Page:** Company panel → Organizations & People → Departments. Needs the server's new `GET /api/reports/departments?format=pdf|csv`, which must ship first.

- `Departments.jsx`: CSV and PDF use `downloadServerReport` (`format=csv` / `format=pdf`), keeping the busy states and toasts. They're icon buttons in the header next to New Department, with the note "every department you can see" as their tooltip. The Columns picker moved into the table toolbar (`toolbarExtra`). The controls bar keeps the search, Supervisors filter and Clear, which only filter the table.
- Member count: only employees assigned to the department. The old "+1 when the supervisor isn't a member" is gone, so the Members column and the Total Members card match "Employees assigned" in the report.
- `lib/exports/departments.js`: deleted. Its re-export in `lib/exportUtils.js` (an unused barrel) is removed, along with the `employees.js` one left over from the Employees change.

**Behaviour changes (server side):** no Department ID, real headcounts split by status and employment type, filters ignored, supervisors get their own department only, inactive supervisors flagged, and a Time & pay settings table.

**Excel instead of CSV:** the Export CSV button is now **Export Excel** (`FileSpreadsheet` icon, tooltip "Export Excel: every department you can see, all fields"). `downloadCSV` is renamed `downloadExcel` and calls `format=xlsx` (fallback name `BizBuddy_Departments.xlsx`): Departments sheet with a Total row, plus a Summary sheet, on the shared Excel template. Needs the server's `format=xlsx` to ship first. The unused `Download` import is removed.

---

## BB-119 — Leave Requests report from the server (PDF and new CSV)

**Status:** Complete (client), confirmed by Carlo.

**Page:** Company panel → Leave Requests, table view. Needs the server's new `GET /api/reports/leave/requests?format=pdf|csv&from&to&status`, which must ship first. The Calendar PDF is unchanged.

- `EmployeesLeaveRequests.jsx`: one handler, `handleLeaveRequestsReport(format)`, sends the table's date range (when set) and status tab and downloads with `downloadServerReport`. **Generate PDF** keeps `generatingPdf` and the "No leave requests to export for the current filters." check. A new **Generate CSV** button has its own `generatingCsv` state.
- Both buttons are shadcn `Button`s with the orange outline used on Employees and Departments, replacing the old inline-styled button. The rest of the file's inline styles are unchanged.
- The export no longer looks up balances from `matrixByEmail` (the server adds "Balance now"). The lookup stays for the detail panel's Leave Credits.
- `lib/exports/leaveRequests.js`: deleted (no other importers).

**Behaviour changes (server side):** search is ignored, days and hours are the counted leave days (pending shows the calendar span in grey), dates are MM-DD-YYYY in the company zone, and supervisors get their department plus direct reports.

**Excel instead of CSV:** **Generate CSV** is now **Generate Excel** and calls `handleLeaveRequestsReport("xlsx")` (fallback name `BizBuddy_LeaveRequests.xlsx`): a Leave requests sheet with a Total row, plus a Summary sheet, on the shared Excel template. The busy state is renamed `generatingExcel`, and the handler's fallback error says "Excel" instead of "XLSX". Needs the server's `format=xlsx` to ship first.

---

## BB-119 — Leave Calendar from the server

**Status:** Complete (client), confirmed by Carlo.

**Page:** Company panel → Leave Requests → Calendar view → Generate PDF dialog. Needs the server's new `GET /api/reports/leave/calendar?month=YYYY-MM&status=…`, which must ship first.

- `handleGenerateCalendarPdf` sends the month shown (`calendarMonth` as `yyyy-MM`) and the ticked statuses (`pending,approved,rejected,cancelled`; pending includes pending final on the server), downloads with `downloadServerReport` and closes the dialog on success. The "pick at least one status" guard stays; the "No leave requests to export" check is dropped (the server returns an empty calendar instead).
- `calendarMonthLeaves` is removed; only the old export used it.
- Dialog redesigned: plain title, a month switcher (defaults to the month on screen), statuses in one bordered list with the calendar's colour dots and each status's request count for that month, an All · None shortcut, a "N requests will be included" line, and a **Download PDF** button. Counts are requests touching the month, from the page's already-loaded leaves.
- `lib/exports/leaveCalendar.js`: deleted (no other importers).

**Behaviour changes (server side):** approved leaves mark only counted days, pending/rejected/cancelled skip weekends when excluded, and every leave in the month appears in the list after the grid.

---

## BB-119 — Contest Time Logs report from the server (two pages)

**Status:** Complete (client), confirmed by Carlo.

Needs the server's new `GET /api/reports/contests?format&scope&from&to&status`, which must ship first. `lib/exports/contestLogs.js` is deleted (its blank Approver / Reviewed at columns go with it).

**Employee page (`contest-time-logs/page.jsx`):**
- The Export menu's CSV and PDF call the endpoint with `scope=mine`, the date range and the status filter. Search is ignored.
- All contests load: the list pages through `view-contestTimeLogs` 200 at a time until `hasMore` is false (it used to stop at the server's default 50).
- The date filter uses the punch date (original clock-in, or the requested one when there was none) in the company time zone, both days fully included. It used to compare the submitted time, and dropped most of the last day. The company zone comes from `/api/company-settings`.

**Company page (`contest-requests/page.jsx`):**
- CSV and PDF icon buttons in the header, next to Refresh, call the endpoint with `scope=team`, the date range and the status filter. The employee and reason filters aren't sent.
- The date filter now uses the punch date too (it used the submitted date), so the table and the export agree.

**Excel instead of CSV (both pages):** the employee menu's **Export CSV** is now **Export Excel**, and the company CSV icon button's tooltip is "Export Excel: date range and status filter apply". Both call `exportReport("xlsx")` (fallback name `BizBuddy_Contests.xlsx`): a Contests sheet (team reports add Employee, Email and Department) plus a Summary sheet, on the shared Excel template. Needs the server's `format=xlsx` to ship first.

## BB-119 — Punch Logs PDF from the server (two pages, PDF only)

**Status:** Complete (client), confirmed by Carlo.

Needs the server's new `GET /api/reports/punch-logs?format=pdf&scope&…`, which must ship first. One server builder makes both PDFs, so the same punch shows the same hours, OT and cutoff status on both. The CSV Detail and Payroll Grid CSV exports are unchanged (still built in the browser); they'll be a separate item.

**Employee page (`EmployeePanel/TimeKeeping/PunchLogs.jsx`):**
- Export PDF calls the endpoint with `scope=mine`, the status and punch type filters.
- A cutoff picked in the dropdown sends that cutoff's id (the employee's own department's, or a company-wide one), so a locked cutoff prints the reviewed, paid hours. Otherwise it sends the applied date range (live punches).

**Company page (`EmployeesPunchLogs.jsx`):**
- Generate Report → PDF calls the endpoint with `scope=team`, the dialog's cutoff ids (or date range) and the page's department, employee, punch type and status filters. It returns before the approvals, live data and time zone fetches the CSV types still use. Search is ignored.
- The dialog's column picker now shows for CSV Detail only; the PDF's columns are fixed.

`exportEmployeePunchLogsPDF` is now unused (deleted in item 13 below).

## BB-119 — Employee Punch Logs: PDF only

**Status:** Complete (client), confirmed by Carlo.

- The employee page's Export dropdown (CSV Details, PDF, Grid CSV Payroll) is now a single **Export PDF** button (desktop only, as before). The Payroll grid belongs on the company page, and what matters to an employee from the CSV Details is in the server PDF.
- `exportCSV`, `exportGridCSV` and `fetchExportData` are removed from `PunchLogs.jsx`, with the unused `DropdownMenu*`, `Download` and `LayoutTemplate` imports. `ChevronDown` stays (the overtime requests panel uses it).
- `lib/exports/punchLogs.js` is deleted (`exportPunchLogsCSV`, `exportPunchLogsPDF`, `exportPunchLogsCSV_v2`, `exportBoth`), along with its re-export in `lib/exportUtils.js`. That also retires the Grid CSV's first-punch-only and off-by-one day bugs.
- The company page's CSV Detail and Payroll Grid CSV are unchanged.

## BB-119 — Company Punch Logs: CSV Detail becomes a server Excel file

**Status:** Complete (client), confirmed by Carlo.

Needs the server's `GET /api/reports/punch-logs?format=xlsx&scope=team&…` (same parameters, cutoff logic and data basis as the PDF), which must ship first.

**`EmployeesPunchLogs.jsx`:**
- Generate Report → **Excel — Detail** (value renamed `csv-detail` → `xlsx-detail`) goes through the same early server branch as the PDF, with `format=xlsx` (fallback name `punch-logs.xlsx`). Default type in the dialog is still the Detail file.
- The browser CSV Detail branch and the old browser PDF branch (unreachable since item 7) are removed. **CSV — Payroll Grid is unchanged.**
- The dialog's column picker is removed (the Excel and PDF have fixed columns), with what only it used: `REPORT_GROUPS`, `REPORT_EXCLUDED_COLS`, `BNC_FORCED_COLS`, the dialog's selected-columns state, the `isDayCare` / `columnOptions` / `defaultColumns` props, the `columns` argument, `COLUMN_MAP_FOR_EXPORT` and `exportFilters`. The Payroll Grid's "column selection does not apply" note goes too. The table's own column selector is untouched.
- Report type icons follow the icon rule: Excel — Detail and CSV — Payroll Grid → `FileSpreadsheet` (colors kept), PDF → `FileText`. `LayoutTemplate` import removed.

**`lib/exports/employeePunchLogs.js`:** `exportEmployeePunchLogsCSV` and `exportEmployeePunchLogsPDF` deleted (about 1,100 lines), with `isApprovedOT` and the PDF-only imports. Only `exportEmployeePunchLogsCSV_v2` (Payroll Grid) and its helpers remain.

**Behaviour changes:** the search box no longer filters the Detail file (it still filters the Payroll Grid), admins can't pick columns, and the requester's User ID / username and the per-record Log ID are gone from the file.

**Left as is:** `freshOtThreshold` in the handler is now assigned but no longer read (it only fed the removed exporters). It sits in the Payroll Grid's data-loading path, so it's left for the Payroll Grid item. *(Removed with that path in item 14.)*

## BB-119 — Company Punch Logs: Payroll Grid from the server as Excel

**Status:** Complete (client), confirmed by Carlo.

Needs the server's `GET /api/reports/punch-logs?format=payroll&…` (same cutoff / date range and filters as the PDF and Excel), which must ship first.

- Generate Report's Payroll Grid option is now **Excel — Payroll Grid** (value `xlsx-payroll`), built on the server. (It ran side by side with the old browser CSV while the two were compared.)
- `xlsx-payroll` goes through the same server request as the PDF and Excel with `format=payroll`, which now returns an Excel grid (fallback name `punch-logs-payroll.xlsx`): one column group per date (AM / Regular / PM), weekend columns tinted, ID / name / role and both header rows frozen, a Total row, and the legend under the grid, on the shared Excel template. `format=payroll-csv` gives the same grid in the original CSV layout; the page doesn't use it.
- **Compared:** for Oct 14–27 the server grid (CSV layout) matched the old browser file cell for cell (44 rows, 0 differences). The Excel and CSV come from the same server grid builder.
- **Expected differences** (server side): SL can be higher (the old grid only saw the newest 50 leave requests), OT follows the approved OT records (cutoff OT as in Cutoff Review, without training hours; B&C daily OT blocks; approved requests for daily/weekly companies), and a blank ID instead of the internal user id when an employee has no employee ID.
- **Old version removed:** the CSV — Payroll Grid (old) option and the whole browser report path. `handleGenerateReport` is now just the server request. Removed from `EmployeesPunchLogs.jsx`: `buildRowsFromApprovals`, `buildLeavesFromApprovals`, `fetchRawTimelogs`, `fetchCompanyTimezone` (+ `DEFAULT_TIMEZONE` import), `fetchApprovedLeaves` / `approvedLeaves` (one fewer `GET /api/leaves` on page load), `employeeIdMap`, `employeeRoleMap`, `bncDailyOtThreshold`, `bncOtBlocks` (set but never read), `cutoffOtThreshold`. `lib/exports/employeePunchLogs.js` deleted and its `lib/exportUtils.js` re-export removed. `enrichTimelogs` stays (the table uses it).
- **No CSV option is kept.** If someone turns out to import the Payroll Grid CSV elsewhere, the server still serves it (`format=payroll-csv`), so a **CSV — Payroll Grid (for import)** option can be added back with one dialog entry.

## Export icons: one rule across pages

**Status:** Complete (client), confirmed by Carlo.

**PDF → `FileText`. CSV and Excel → `FileSpreadsheet`.** `Download` is kept only for actions that don't name a file type (the Punch Logs "Generate Report" button and its dialog button, the Contests "Export" menu button, "Download CSV Template"). Icons only; no labels, styles or behaviour changed.
- **Leave Requests:** the CSV and PDF icons were swapped (CSV showed `FileText`, PDF showed `Download`); fixed. Leave Calendar's "Generate PDF" and the dialog's "Download PDF" → `FileText`.
- **Contests** (employee menu item and company icon button), **Employee deletion**, **Subscribers** CSV → `FileSpreadsheet`.
- **Payroll sheet** "Export Excel" and **Leave Settings** "Generate Report" (Excel workbook) → `FileSpreadsheet`.
- **System admin Reports** "PDF" → `FileText`.
- Unused `Download` imports removed where nothing else used them. `Overtime.jsx` (unreachable) left as is.

## Open items

- Schedule pages still show each shift's own zone. Final decision waits on the shift check.
- Browser-zone dates elsewhere: separate ticket.
- `getTimestampForFilename` and the PDF's embedded creation date still use the browser clock.
- Both settings pages still send their other fields from a full draft, so an old page can overwrite those.
- `PunchLogs.jsx` color drift left as is.
- `EmployeesLeaveRequests.jsx` table view: about 52 static inline styles and 73 hard-coded colors (including a `#fff` card background that ignores dark mode). Cleanup would be its own pass.
