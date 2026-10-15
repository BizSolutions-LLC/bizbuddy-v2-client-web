# Changelog — v2.14.34

BB-089 follow-up: Fixed-hours (SV) employees now show their fixed hours per cutoff (80 by default) in the Employees Punch Logs reports. Before this, the CSV Detail summary showed 0 for them and the CSV Payroll grid left their rows blank, even though payroll pays them a flat amount each cutoff.

---

## BB-089 (follow-up) — Fixed hours in CSV Detail and CSV Payroll reports

**Status:** Complete (client only).

**Page:** Employees Punch logs (`/dashboard/company/punch-logs`) → Generate Report → **CSV — Detail** and **CSV — Payroll**

**Root cause:**
- BB-089 auto-excludes every punch from a fixed-hours employee, so `buildRowsFromApprovals` counts their punch rows as 0 payable hours. An SV employee with no punches gets no row at all.
- The fixed hours aren't stored on punches. They're `CutoffFixedHours` records, which the server already returns as `fixedHours` in `GET /api/cutoff-periods/:id/approvals`. Cutoff Review reads them, but the report exports didn't.

**Who it applies to:**
- Only employees the server returns in `fixedHours` for the cutoff. Those are the employees toggled on under Settings → Configurations → Fixed Hours (department on, employee picked).
- Everyone else's row is still built from their punches, exactly as before.
- The value is the server's `hours`, not a hard-coded 80. It follows the department's setting and any admin edit made in Cutoff Review.
- Only locked or processed cutoffs carry this data. Open cutoffs and date-range reports are unchanged.

**CSV — Detail:**
- Employee Summary: Duration and Period Hours for an SV employee are replaced with the fixed hours, not added on top of punch hours.
  - SV employees with no punches get a row, appended after the others.
  - The row is labelled "Name (fixed hours)". Days Worked and Avg Hours/Day show "—".
- The Summary Statistics "Total Duration Hours" and "Total Period Hours" are now calculated from the Employee Summary, so they always equal its TOTAL line.
- OT is calculated before the override, so fixed-hours employees never get OT.
- The per-day "Punch Logs Detail" rows are unchanged (no 8h/day spread).

**CSV — Payroll (grid):**
- Regular total and Total = fixed hours − the SL shown in that row. For example, 80h with 8h SL gives Regular 72, SL 8, Total 72.
  - Regular + SL always equals the server's fixed hours.
  - This matches the grid's existing rule that Total excludes SL.
  - Paid leave other than sick leave (e.g. vacation) has no column in the grid, so it stays inside Regular.
- Daily cells, AM, PM, Driving, TR and OT are blank for SV employees.
- The role cell reads "Role (fixed hours)" so payroll can see why the daily cells are empty.
- SV employees with no punches get a row, sorted alphabetically with everyone else. ID and job title come from the same lookups as the other rows.
- The bottom Total row includes the SV hours.

**Both reports:**
- `fixedHours` goes through the same employee and search filters as the punch rows. Search matches name or email.
- A selection with only SV employees and no punches now exports instead of failing with "No data to export".

**Server-repo impact:** None. It uses the `fixedHours` field `GET /api/cutoff-periods/:id/approvals` already returns.

**Known follow-ups (not in scope):**
- The PDF export (`exportEmployeePunchLogsPDF`) has the same totals logic and the same gap.
- Open cutoffs (live `/api/timelogs` path) would need the server to return fixed hours too. Separate ticket if needed.

### Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | `handleGenerateReport` collects `fixedHours` from each locked cutoff and applies the employee and search filters. It passes them to CSV Detail, and to CSV Payroll with the employee ID and job title attached. |
| `lib/exports/employeePunchLogs.js` | `exportEmployeePunchLogsCSV`: fixed-hours override in the Employee Summary, totals recalculated, no failure for an SV-only selection. `exportEmployeePunchLogsCSV_v2`: SV rows with Regular/Total = fixed hours − SL, a "(fixed hours)" role label, rows added for SV employees with no punches, no failure for an SV-only selection. |
