# Changelog — v2.15.6

BB-120: B. Buddy (the support account) no longer has any way into payroll. Cutoff review and the hours reports stay available. B. Buddy can now open Documentation, which used to redirect it away.

---

## BB-120 — B. Buddy: no payroll access

**Status:** Complete (client), confirmed by Carlo: B. Buddy no longer sees payroll. Needs the server's BB-120 change: `/api/payroll`, `/api/payroll-system`, `/api/company-information`, `/api/employee-payroll-details`, `/api/payroll-export` and `/api/disbursements` return 403 `SYSTEM_AGENT_NOT_ALLOWED` for a B. Buddy session. Either can ship first: client first only hides the links early; server first means B. Buddy sees "This action isn't available in support mode." in payroll until the client ships. Best shipped together.

**Sidebar (`components/Dashboard/sidebar.jsx`):**
- B. Buddy gets no Employee Panel section (it used to show a **Payroll** group with Payroll Management). The existing `features.length > 0` check hides the empty section.
- `agentFeatures` removed. The section heading is always "Employee Panel" now (the "Payroll" heading was only for B. Buddy).

**Route guard (`lib/systemAgent.js`):** payroll is removed from `ALLOWED_PREFIXES`, so `/dashboard/employee/payroll` (bookmark, old link) redirects B. Buddy to `SYSTEM_AGENT_HOME` like every other Employee panel page. Payroll, Disbursement and Payslip pages all live under `/dashboard/employee`, so all are covered. The only Employee panel page B. Buddy can open is now Documentation (below).

**Documentation (bug found during BB-120):** clicking the Documentation (book) icon in the top bar as B. Buddy never opened the guide. The page is `/dashboard/employee/documentation`, which BB-110's guard blocked, so B. Buddy got a loading screen and was sent to the Employees page. This dates from BB-110, not BB-120; other roles weren't affected.
- `lib/systemAgent.js`: `ALLOWED_PREFIXES` is now `["/dashboard/employee/documentation"]`.
- `Documentation.jsx`: for B. Buddy (`isSystemAgentToken`), the Employee tab is hidden, so the page opens on **Company Panel**. Any guide whose page B. Buddy can't open is hidden, using the same `isBlockedForSystemAgent` check as the route guard: today that's Payroll Management, Disbursement (Company Panel tab) and company Deletion (Company Settings tab). Everyone else sees the same guide as before.
- The Navbar icon is unchanged.

**Employee Cutoff (`EmployeeCutoff.jsx`):** the **Preview Payroll Reports** button (search icon next to Configure) is hidden for B. Buddy (`isSystemAgentToken`). Its dialog called `/api/payroll-export/…`. Review, approve, lock, process and Configure are unchanged. The dialog code stays (unreachable for B. Buddy).

**Unchanged for B. Buddy:** cutoff review, and the hours reports on the company Punch Logs page: PDF, Excel, Payroll Grid (`/api/reports/punch-logs`) and Yearly Total Hours (`/api/reports/yearly-total-hours`, on the Punch Logs page, not Settings). The setup guide's payroll step is dropped by the server; no client change.

**Normal admins:** unchanged.

**To test (as B. Buddy):** no Employee Panel / Payroll group in the sidebar; `/dashboard/employee/payroll` redirects to Employees; Employee Cutoff has no preview button and review / approve / lock / process still work; no payroll step in the setup guide; Punch Logs reports and Yearly Total Hours still download; the Documentation icon opens the guide on Company Panel, with Company Panel and Company Settings tabs only, and no Payroll Management, Disbursement or Deletion guides. As a normal admin (and as an employee), Documentation shows the same tabs and guides as before. As a normal admin: Payroll, Disbursement and the payroll preview work as before.

---

## BB-097 (revision) — Documentation matches v2.15.4 and BB-120

**Status:** Complete, confirmed by Carlo. Text only. No server changes.

**Why:** v2.15.4 (BB-119) changed exports and removed viewer-zone times, and BB-120 removed B. Buddy's payroll access. Parts of the in-app guide described the old behaviour.

**Fixed (no longer true):**
- **Employee → Punch Logs** (`docsContent.js`): "Use Export to download your logs as CSV or PDF" → **Export PDF**, on a computer, for the selected period and filters.
- **Employee → My Schedule** (`docsContent.js`): the Multi-timezone item is a badge that says the shifts use more than one zone. It doesn't explain the zones.
- **Company → Departments** (`companyDocsContent.js`): "CSV or PDF" → **Export Excel** (all fields) or **Export PDF**.
- **Company → Employee Schedule** (`companyDocsContent.js`): the Multiple timezones notice lists the zones. It no longer shows local times.

**Filled in:**
- **Company → Punch Logs, Reports:** names the three report types (Excel — Detail, PDF, Excel — Payroll Grid) and says the page filters apply.
- **Company → Leave Requests:** the table view's Generate Excel / Generate PDF, and the calendar's Generate PDF for the month.
- **Company → Employees:** new "Exporting employees" topic (Export Excel / Export PDF).
- **Company → Employee Requests (Contests):** tip for Export Excel / Export PDF (date range and status filter apply).
- **Employee → Contest Time Logs:** step for Export → Export Excel / Export PDF (on a computer).
- **Company Panel tab description** (`Documentation.jsx`): B. Buddy gets a version without "pay a finalized payroll", since its payroll guides are hidden (BB-120). Everyone else sees the same description.

**Checked, unchanged:** "Times are shown in the company timezone" (Punch Logs), the Company timezone guide (Settings), Yearly Total Hours, and the Cutoff Periods guide (never mentioned the payroll preview).

**To test:** open Documentation as an employee, an admin and B. Buddy, and check the sections above read as described.

---

## Open items

- `EmployeeCutoff.jsx:130` has one static inline style (`style={{ background: "inherit" }}`). Left as is.
