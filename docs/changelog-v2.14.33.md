# Changelog — v2.14.33

BB-097: There's a new in-app Documentation page, opened from the book icon in the top bar. It has an Employee guide for everyone, plus Company Panel and Company Settings guides. Each user only sees the guides their role can use, and pages locked by the company's plan carry the same lock badge as the sidebar. The content is tailored to the company type: PadPro (DayCare) and B&C each see only the instructions that apply to them.

---

## BB-097 — In-app documentation (Employee, Company Panel, Company Settings)

**Status:** Complete (client only). Awaiting functional confirmation.

**Page:** Documentation (`/dashboard/employee/documentation`, tabs via `?tab=company` / `?tab=settings`)

**Access rules (mirrors the sidebar):**

| Role | Tabs shown |
|---|---|
| employee | Employee only (no tab bar) |
| supervisor | Employee + Company Panel (Organizations & People, Requests & Logs only) |
| admin / superadmin | Employee + Company Panel (all groups) + Company Settings |

- A plan-locked page's section shows a "Basic 🔒" / "Pro 🔒" badge (same classes as the sidebar), and its "Open this page" button is disabled.
- Linking to a tab the role doesn't have (e.g. `?tab=settings` as an employee) falls back to the Employee tab.
- These rules hide guides in the UI only. The guides are static help text, and access to the real pages is still enforced by the server.

**Company type (PadPro vs B&C):**
- Read from `GET /api/company-settings/` (`companyType`, falling back to `isBNC`). That's the same source Cutoff Review and the employee Punch logs treat as authoritative.
- A section or topic can be tagged `companyType: "DAYCARE"` (PadPro) or `"BNC"` (B&C). Untagged content applies to both.
- Where the two companies work differently, there's one topic per type with the same title, and each company sees only its own.
- If the type can't be loaded, both versions are shown, each with a "PadPro only" / "B&C only" badge.
- Main differences covered:
  - **Employee:** Driver/Aide punch types, per-punch OT requests and tracking, and the Request entry shift-type step are PadPro only. B&C gets a "How overtime works" topic explaining that OT comes from day/week/cutoff totals and is approved at cutoff.
  - **Company Panel:** Punch type editing and filtering, backtrack import, Driver Schedule, Driver Day segments and Approve All Schedule are PadPro only. B&C gets the shift picker for Approve Schedule, Approve Raw only for segments, OT blocks (Approve OT / Exclude) and REGULAR/TRAINING-only imports.
  - **Company Settings:** The DayCare Settings tab and per-punch OT request flow are PadPro only. B&C's OT approval is explained through OT blocks.

**Implementation:**
- **`Documentation.jsx`:**
  - Fetches the role and plan from `/api/account/profile` (same as `sidebar.jsx`) and the company type from `/api/company-settings/`.
  - Tab bar uses the List/Calendar toggle style from `Schedules.jsx`, so no new dependency. The active tab is kept in the URL.
  - The table of contents and section list show the sidebar's group headings.
  - Shows a skeleton until the role and company type are both known, so nobody briefly sees the wrong content.
- **Content files:**
  - `docsContent.js` — Employee guide.
  - `companyDocsContent.js` — Company Panel: one section per sidebar page, so each one carries the right plan lock.
  - `settingsDocsContent.js` — Company Settings.
  - Company and settings sections carry a `groupId` and `routeId` that match the sidebar's ids.
- **`sidebar.jsx`:** `CompanyPanelItems`, `filterCompanyPanelByRole` and `lockChildByPlan` are now exported (no logic change), so the docs and the sidebar share one set of access rules.
- **`Navbar.jsx`:** Book-icon `DocsLink` with a tooltip, shown on desktop and mobile only when signed in.

**Server-repo impact:** None. It uses the existing `GET /api/account/profile` and `GET /api/company-settings/` calls.

**Known follow-ups (not in scope):**
- `Punch.jsx`, the punch-type parts of `PunchLogs.jsx`, `Employees.jsx` and `CompanyConfigurations.jsx` still detect PadPro from the `NEXT_PUBLIC_DAYCARE_COMPANY_IDS` env list instead of the API. If the two ever disagree for a company, the guide and those pages won't match.
- The Employee tab doesn't show plan-lock badges and doesn't document Payroll Management (admin/supervisor).
- The sidebar hides Settings → Notifications from supervisors, but the page itself allows them. The docs follow the sidebar.
- Assumptions to confirm:
  - PadPro is the `DAYCARE` company type.
  - B&C employees never file per-punch OT requests.

### Files Changed

| File | Changes |
|---|---|
| `components/Partial/Navbar.jsx` | New `DocsLink` (book icon + tooltip) for signed-in users, desktop and mobile. |
| `components/Dashboard/sidebar.jsx` | Exported `CompanyPanelItems`, `filterCompanyPanelByRole`, `lockChildByPlan` (no logic change). |
| `app/dashboard/employee/(F_Help)/documentation/page.jsx` | **New** route wrapping `Documentation` in `Suspense`. |
| `.../EmployeePanel/Documentation/Documentation.jsx` | **New**. Role/plan/company-type fetch, tab bar, role/plan/company-type filtering, plan lock and company-type badges, grouped TOC. |
| `.../EmployeePanel/Documentation/docsContent.js` | **New**. Employee guide with PadPro / B&C variants. |
| `.../EmployeePanel/Documentation/companyDocsContent.js` | **New**. Company Panel guide (11 pages) with PadPro / B&C variants. |
| `.../EmployeePanel/Documentation/settingsDocsContent.js` | **New**. Company Settings guide (6 pages) with PadPro / B&C variants. |
