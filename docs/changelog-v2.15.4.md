# Changelog — v2.15.4

BB-119: The employee punch log report and the punch log and schedule pages no longer use the viewer's browser time zone. Punch times show the company zone only, with no "HQ" label. Saving Leave Settings or Company Configurations can no longer overwrite the company zone with an old copy.

---

## BB-119 — Company zone only

**Status:** Changed, awaiting Carlo's testing. No server changes.

**Why:** A punch log PDF printed `Los Angeles / Manila (HQ)` while Company Configurations showed Los Angeles. The owner chose to remove the viewer's zone. After release, check the zone named on the first PDF generated.

**Report (`lib/exports/employeePunchLogs.js`, `lib/exports/_shared.js`):**
- PDF and CSV Detail show company times only. `(HQ)`, `Your/HQ`, `Your TZ / HQ TZ` and the second time are gone.
- The `Timezone:` lines, the PDF footer `TZ:` and "Generated:" all use the company zone, and the header still names it so a wrong zone stays visible.
- `getFormattedTimestamp` takes an optional zone. Only this report passes one, so other exports are unchanged.
- All three exports throw if no company zone is passed. They no longer default to UTC.

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

**Page:** System Admin → Performance → Reports → Saved reports. No server change: same `GET /api/system-admin/capacity/reports/:number/pdf`.

- `lib/systemAdminFetch.js`: new `systemAdminPdfUrl(path)` fetches the PDF with the Bearer header (never in a URL) and returns a blob address, always typed as PDF. `systemAdminDownload` and it share one internal fetch (`fetchSystemAdminFile`), so 401 and error handling match. The download works as before.
- `ReportsView.jsx`: **View** button (Eye, outline, small) before **PDF** in each row. It shows the report in a panel above the Saved reports table (report name, dates, Close button), scrolled into sight. It shows busy as `view:N`, is disabled while any action runs, and shows errors like the PDF button. Opening another report replaces the panel; the address is released on replace, close or leaving the page.

**Known limit:** saving from the embedded PDF viewer gives a random filename (use **PDF** for a named copy).

---

## BB-119 — Employees report from the server

**Page:** Company panel → Organizations & People → Employees, **CSV** and **PDF** buttons. Needs the server's new `GET /api/reports/employees?format=pdf|csv`, which must ship first.

- `lib/reportDownload.js` (new): `downloadServerReport({ apiUrl, token, path, fallbackFilename })` fetches a server-built report with the Bearer token, shows the server's `message` on error, takes the name from `Content-Disposition` and saves the file. The leave and yearly report downloads still use their own copies.
- `Employees.jsx`: both buttons call it (`format=csv` / `format=pdf`). The busy states, the success toast with the filename and the "No data to export" check stay. The old note under the table is replaced (see Page fixes).
- `lib/exports/employees.js`: deleted (no other importers).

**Page fixes:**
- The column picker moved from the export bar into the table toolbar, next to Filters, through a new optional `toolbarExtra` slot on `components/common/DataTable.jsx`. Its other users (`Departments.jsx`, `LeaveSettings.jsx`) don't pass it and are unchanged.
- The export bar's Rows per page dropdown is removed. It never worked: `DataTable` only reads `pageSize` when it first renders, so later changes, including "All", did nothing. Page size is set with the table's own Page Size under Filters (5–100; no "All").
- The export bar is removed. **Export CSV** and **Export PDF** sit in the page header after Import Guide and Import CSV, in the same button style; the note "Exports include every employee you can see, with all fields" is their hover text.
- The **Active Employees** card counts accounts with `status === "active"`, matching "Active accounts" in the report. A sub-line shows "X full-time · Y part-time".

**Behaviour changes (server side):** fixed PDF columns, every field in the CSV, Employee ID now prints, supervisors get only their team, and dates use the company zone. The export still ignores the search box.

## Open items

- Schedule pages still show each shift's own zone. Final decision waits on the shift check.
- Browser-zone dates elsewhere: separate ticket.
- `getTimestampForFilename` and the PDF's embedded creation date still use the browser clock.
- Both settings pages still send their other fields from a full draft, so an old page can overwrite those.
- `PunchLogs.jsx` color drift left as is.
