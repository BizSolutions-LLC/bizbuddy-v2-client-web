# Changelog — v2.15.0

BB-110: **B. Buddy**, a hidden admin account in every company that BizBuddy support staff use, is supported on the web client:
- Staff sign in with the shared B. Buddy login plus their own **staff code and PIN**, so their actions are recorded under their name.
- B. Buddy sees the **Company panel only**.
- Each staff member is assigned to **one company**.

BB-110 (system admin): the system-admin dashboard gets:
- **per-person accounts with two-factor authentication** (authenticator app plus recovery codes)
- a **My account** page and an owner-only **System Admins** page
- a **B. Buddy** page: activity audit, summary, companies, support staff, admin activity
- a read-only **Database** page
- a redesigned nav

Every system-admin call now goes through one helper that sends the session token and returns to sign-in when the session ends.

BB-111: in Edit Employee, **Account status** (Active / Inactive) moves out of the Role / Department row into its own row with a short explanation. Switching an active employee to Inactive asks for confirmation before saving.

BB-112: the system-admin **Users** and **Security** pages, which were "coming soon" placeholders, become **User Activity** analytics and a **Security Monitor**. A new **Request Logs** page opens from a signal's "View requests", and a new **Live Server** page shows the API server's health and live log output.

BB-107: system admins can **add a company** (company, owner, plan, B. Buddy and support staff in one form) and **set up B. Buddy** for an existing company from the Companies tab.

BB-108: **Import Punch Logs** gets a pre-filled template. Pick a date range and employees, and every row already has the employee and date, so admins only type clock-in and clock-out. Blank rows are days off. Follow-up: every downloadable template starts with a **guide row** showing the allowed values (punch types per company type), which is never imported.

**Deploy order:** server first, then client. The BB-110, BB-112, BB-107 and BB-108 server work is in `bizbuddy-v2-server`. At the time of writing it was still uncommitted on the server's local `master`. None of the client screens below work until it's deployed.

---

## BB-110 — B. Buddy support sign-in

**Status:** ✅ Complete. Tested in development with the server change.

**Page:** Sign in (`/sign-in`).

**Company picker (step 2):** when an account has `isSystemAgent: true`:
- a headset icon instead of the role icon
- **"B. Buddy"** instead of the username (the internal `bbuddy-<companyId>` username is never shown)
- a grey **Internal** badge instead of the orange role badge
- no **"Forgot your password?"** link (the B. Buddy password is managed centrally)

**Support sign-in (new step 3):**
- **When it opens:** a 401 `AGENT_IDENTITY_REQUIRED` from `POST /api/account/login` is no longer shown as an error banner. It opens the **Support sign-in** step, keeping the email, password and company.
- **Copy:** title "Support sign-in"; helper "You're signing in as B. Buddy. Enter your personal staff code and PIN so your actions are recorded under your name."
- **Fields:**
  - **Staff code** (not case-sensitive).
  - **PIN**: masked with a show/hide toggle, numeric keypad, digits only, checked for 6–8 digits before sending.
  - No placeholders on either field.
- **Buttons:** **Continue** resends the same login with `agentCode` and `agentPin`. **Back** returns to step 2 and clears both fields.
- **Step dots:** a third dot appears only when a B. Buddy account is selected.
- **Errors on this step (the step stays open):**
  - 401 `AGENT_IDENTITY_INVALID`: "Invalid staff code or PIN."
  - 403 `AGENT_NOT_ASSIGNED`: "You're not assigned to this company." This is checked **before** the existing generic 403 ("Your account is inactive…"), which would otherwise have shown the wrong message.
  - 429 `AGENT_LOCKED`: "Too many wrong PINs. This staff code is locked for 15 minutes, or ask a system admin to reset your PIN."
- The login request moved into a shared `submitLogin()`, so steps 2 and 3 send the same request.

**Not in this release:** the mobile app (step 1.5 of the handoff, `deviceId`) is a separate repo.

---

## BB-110 — B. Buddy works the Company panel only

**Status:** ✅ Complete. Tested in development with the server change.

**How the client knows:** the login token carries `isSystemAgent: true`, so routing decisions don't wait for the profile call. `GET /api/account/profile` → `user.isSystemAgent` drives the sidebar and the user menu.

**Routing:**
- After sign-in, `/dashboard` sends B. Buddy straight to **Company → Employees** (`/dashboard/company/employees`) instead of the employee overview.
- **Route guard** in the dashboard layout. B. Buddy is sent back to Employees from:
  - `/dashboard/employee/*`, **except Payroll Management** (`/dashboard/employee/payroll`)
  - `/dashboard/user/*` (change password)
  - `/dashboard/company/deletion`
- **Why payroll stays:** Payroll Management is a company-wide admin tool that happens to live under the Employee panel. The server's B. Buddy activity labels include "Saved payroll run" and "Edited payroll details", so support is expected to use it. **My Payslip** is hidden.

**Sidebar:**
- The Employee panel is hidden. Only Payroll → Payroll Management remains, under a "Payroll" header.
- Company Settings → **Deletion** is hidden.
- The user block shows **"B. Buddy"** and **"Support mode: B. Buddy"** instead of the username and role.

**User menu (top right):**
- The username and the **Settings** (change password) link are hidden.
- A short **Support** badge replaces the role badge (kept on one line, same size as the role pill).

**Unchanged:** the "Delete Company" button in Company Profile already shows only for `superadmin`, and B. Buddy is `admin`.

**New 403 messages:**
- `SYSTEM_AGENT_NOT_ALLOWED`: "This action isn't available in support mode."
- `SYSTEM_AGENT_PROTECTED`: "The B. Buddy account is managed by BizBuddy and can't be changed here."

They're used where the server can actually return them: edit and delete employee (Employees), and save and reset payroll details (Payroll Management). There's no central fetch wrapper in the company dashboard, so it isn't wired into every screen.

**No change needed:** employee lists, counts and reports already exclude B. Buddy (server-side). Its approvals show as "B. Buddy".

---

## BB-110 — System-admin sign-in with 2FA

**Status:** ✅ Complete. Tested in development with the server change.

**Page:** `/system-admin/login` (rewritten).

**Step 1, password:** `POST /api/system-admin/auth/login` with `{ username, password }`.
- `mfaSetupRequired` → Step 2a. `mfaRequired` → Step 2b.
- 401 `INVALID_CREDENTIALS`: "Invalid username or password."
- 429 `ADMIN_LOCKED`: "Too many failed attempts. Try again in 15 minutes."

**Step 2a, first-time setup ("Set up two-factor authentication"):**
- `otpauthUrl` is drawn as a **QR code on the page** with `qrcode.react` (new dependency). The secret is never sent to an online QR service, because that would undo the second factor.
- The key is shown grouped in fours under "Can't scan? Enter this key in your app."
- The admin enters the first 6-digit code → `POST /auth/2fa/setup`.
- Next comes **Save your recovery codes**:
  - the 10 codes, with Copy and Download (.txt)
  - a required "I've saved these codes. Each works once if I lose my phone." checkbox
  - then **Continue to dashboard**
  - the codes are never shown again

**Step 2b, enter a code ("Enter your authentication code"):**
- A 6-digit numeric input (`autocomplete="one-time-code"`) → `POST /auth/2fa/verify`.
- **"Use a recovery code instead"** switches to a text input and sends `{ mfaToken, recoveryCode }`.
- If `recoveryCodesRemaining` is 3 or fewer, a dismissible yellow banner appears across the dashboard: "You have N recovery codes left. Generate new ones in Account settings." It links to My account.

**Errors on 2a/2b:**
- `MFA_INVALID_CODE`: the server's message, and the input is cleared.
- `MFA_TOKEN_INVALID`: "Your sign-in step expired." and back to Step 1. The step token lasts 5 minutes.
- `ADMIN_LOCKED`: same as Step 1.

**Also:** a green notice on the password step for one-off messages, e.g. "Password changed. Please sign in again."

---

## BB-110 — System-admin sessions

**Status:** ✅ Complete. Tested in development with the server change.

**`lib/systemAdminFetch.js` (new):** every system-admin call goes through it.
- It sends the session as a **Bearer token**. The server's httpOnly cookie is `sameSite: strict`, so it only helps when the dashboard and API share a domain.
- **A 401 without a `code`** (session ended: logged out, expired, deactivated, 2FA reset) clears the token and goes to sign-in, instead of the page quietly showing empty data.
- **A 401 with a `code`** (wrong current password, wrong authenticator code) is shown as an error instead.
- Moved to it: Overview, Performance, Errors, and every BB-110 page.
- The Overview page now loads its three sections independently, so one failing section doesn't blank the others.

**Layout:**
- `GET /auth/verify` provides `{ id, username, name, isOwner, twoFactorEnabled, … }` to the nav and pages through `SystemAdminContext`.
- Owner-only menus show when `isOwner`.

**Logout:** now sends the token, so `POST /auth/logout` ends the admin's sessions in every browser. Before this it sent no credentials, so the server couldn't tell who was logging out.

**Security note:** the stored token can be read by any script on the page, so the dashboard should stay free of third-party scripts. Server sessions expire after 8 hours and can be ended on demand.

---

## BB-110 — My account (every system admin)

**Status:** ✅ Complete. Tested in development with the server change.

**Page:** `/system-admin/account` (new), opened from the account menu.

- **Header:** name, @username, Owner/Admin and 2FA status.
- **Change password:**
  - current password, new password and confirm, with a 12-character minimum → `PUT /auth/password`
  - on success the admin is signed out everywhere and sees "Password changed. Please sign in again."
- **Recovery codes:**
  - enter the current authenticator code → `POST /auth/2fa/recovery-codes`
  - the 10 new codes appear on the same save screen as setup
  - warning: "Your old recovery codes will stop working."

---

## BB-110 — System Admins (owners only)

**Status:** ✅ Complete. Tested in development with the server change.

**Page:** `/system-admin/admins` (new). It's in the account menu only for owners. Non-owners who open the URL see "Only an owner can manage system admins."

- **Columns:** Name, Username, Role (Owner/Admin), 2FA (On / Not set up), Status (Active / Inactive / **Locked**), Last sign-in.
- **Add:**
  - username: 3–40 lowercase letters, digits, dots, dashes or underscores
  - name
  - temporary password: 12 characters or more
  - Owner checkbox
  - helper text: "They'll set up their authenticator app at first sign-in."
- **Edit:** name and owner role.
- **Deactivate / Reactivate:** "Deactivate Jane? They'll be signed out immediately."
- **Reset 2FA:** shown only when 2FA is on. "Reset 2FA for Jane? They'll be signed out and must scan a new QR code at next sign-in."
- **Reset password:** reads "Reset password & unlock" when the account is locked.
- **Your own row has only Edit.** Your own 2FA and password are managed from My account or by another owner.
- **Errors:** the server blocks self-deactivation, removing your own owner role and removing the last active owner. Its 400 message is shown in the dialog.
- **Copy uses "They'll"** throughout, not "She'll" as in the original handoff.

---

## BB-110 — B. Buddy page (system admin)

**Status:** ✅ Complete. Tested in development with the server change.

**Page:** `/system-admin/bbuddy` (new), "B. Buddy" in the nav. Base path `/api/system-admin/bbuddy`.

**Activity tab:**
- **Filters:** company, staff (removed staff included, labelled "· removed"), date range (default 30 days), "endpoint contains", writes only, failed only.
- **Table:** When, Action (e.g. "Approved leave"), Company, Staff, Status. Paged, 50 per page.
- **Details panel:** clicking a row opens it on the right, with a close button. It shows the full request, response time, error, IP address, user agent and request body.
- **Refresh and Live:** a **Refresh** button at the end of the tab row reloads whichever tab is open (Activity, Summary, Companies, Staff or Admin activity) and keeps its filters, date range and page; it also refreshes the company and staff lists behind the Activity filters. **Live** (off by default) reloads page 1 every 15 seconds while the browser tab is visible, pauses on other pages, and is disabled when the date range ends before today. Rows update without clearing, the open request stays selected, and "Updated … ago" shows when the data was fetched. Each poll is an ordinary `/activity` request, so there's no server change.

**Summary tab:**
- Date range (default 7 days).
- Four stat cards: Requests, Writes, Failed sign-ins, Active staff.
- Tables by company and by staff member (total / writes / reads / last activity).

**Companies tab:**
- Every company: B. Buddy **Yes** / a neutral grey **Not set up** (a company without B. Buddy isn't an error), **Staff with access** (the assigned staff codes), **B. Buddy status** (the B. Buddy account's status, not the company's), last sign-in, created. Under each name, "N people" (active users).
- **Retired companies** (BB-107; no active users, sent as `isRetired`, listed last): the row is greyed to about 50% with a small grey **Retired** tag after the name and "—" for B. Buddy. A **Hide retired** checkbox next to All / With / Without is on by default. The heading counts active companies only, e.g. "2 of 4 have B. Buddy · 5 retired".
- **Table layout:** columns read left to right (the shared table centres by default), with even row padding, one muted "—" for every empty value, and the same text weight for every badge.
- Filters: All / With / Without B. Buddy, plus search.

**Staff tab (support staff):**
- **Columns:** Code, Name, **Company**, Status, Last used.
  - Company shows one chip, or a muted **Not assigned** badge with the tooltip "Can't sign in as B. Buddy until a company is assigned."
  - Status is Active, Suspended, **Locked** ("Until … · Reset PIN to unlock") or Removed.
- **"Show removed"** checkbox. Removed rows have no actions.
- **Add / Edit dialog:**
  - **Code:** 2–20 letters, digits or dashes, saved uppercase, can't be changed later.
  - **Name.**
  - **PIN:** required when adding; an optional "Reset PIN" when editing. It has:
    - **Generate**: a random 6-digit PIN from the browser's secure random generator, skipping weak PINs like `000000` or `123456`
    - a show/hide toggle
    - a **Copy** button
    - the helper "Copy it before saving… it can't be viewed later"
  - **Company:** a single dropdown with "No company" plus every company. Companies without B. Buddy are marked "B. Buddy not set up yet". Retired companies are left out (a staff member already on one keeps it in the list, so the field isn't blank). Helper: "Each staff member can access one company only."
  - **Edit sends only what changed.**
- **Moving or unassigning** someone who already has a company asks first:
  - "Move C. Corcuera from Sunshine Learning to BizSolutions LLC? They'll be signed out of Sunshine Learning."
  - "Unassign … ? They'll be signed out of … and can't sign in as B. Buddy until a company is assigned."
- **Suspend / Reactivate:** temporary.
- **Remove:** permanent. "Remove Jane Doe? They'll be signed out and can't sign in again. Their past activity stays in the audit log. Code JDOE can't be reused."
- **Errors:** 400, 404 and 409 show the server's message in the dialog.

**History within this release:** Staff access started as a multi-company checklist with an "All companies" toggle. The server then moved to **one company per staff member**, and `allCompanies` was removed from the client entirely.

**Admin activity tab:**
- Request logs filtered by `systemAdminId` (`GET /api/system-admin/requests`).
- Owners pick any admin; other admins see their own activity.

---

## BB-110 — Database page (system admin, read-only)

**Status:** ✅ Complete. Tested in development with the server change.

**Page:** `/system-admin/database` (new), "Database" in the nav for **all** admins. Base path `/api/system-admin/database`.

**View only:** there are no delete, edit or clean-up buttons. Cleanup is done separately through scripts a developer reviews and runs.

- **Header:** four tiles and a manual **Refresh** (no polling, because some counts touch large tables).
  - Database size.
  - Companies.
  - Active employees.
  - Requests per day (`RequestLog` 30-day average).
- **Storage:**
  - **Category bars:** one per category, sized by share of the database, with size, %, approximate rows, table count and policy text.
    - Colours: logs amber, temporary blue, legacy grey, the rest neutral.
    - The client adds an **"Other"** bar for tables the server tags `other`, so the bars add up to the full database size.
  - **Tables list:** sortable on every column (default: Size, largest first), filterable by category, rows shown as "≈N", a "needs vacuum" hint when dead rows are over 20%, and "Row counts are estimates."
- **Companies:**
  - active employees, time logs (30 days), open cutoffs, and last activity shown relatively ("2 hours ago")
  - a muted **Inactive** badge when there's no activity, or none in 30+ days
- **Growth:** last 7 days, last 30 days and average per day, fastest-growing first.
- **Cleanup preview:**
  - the always-visible "Preview only…" banner
  - **Day windows:** five inputs (request logs 90, audit logs 730, notifications 365, email logs 365, activity 365), kept within 1–3650 days.
  - **Recalculate** runs only when clicked. Afterwards the inputs show the values the server used.
  - **Candidates table:** rules that would remove 0 rows are greyed out.
  - **Legacy tables:** each has the "Empty, can be dropped…" or "Has data, back up before dropping." hint.
  - **Notes:** legal record-keeping, and the audit trail being kept longer.
- **Loading and errors:** each section loads separately with its own skeleton. A failing section shows the server's message and **Retry** without blanking the page.

---

## BB-110 — System-admin nav redesign

**Status:** ✅ Complete. Tested in development with the server change.

- **One row:**
  - the brand ("System Admin · BizBuddy Analytics")
  - main links and a **More ▾** menu (regrouped in BB-112: main row Overview, Users, Security, B. Buddy; More holds Performance, Errors, Database, Request logs, Live Server)
  - a **Screenshot** icon button
  - an **account menu** (initials + first name ▾)
  - the page links sit centred in the bar: the brand and the right side share the spare width equally
- **Account menu:** name, @username · Owner/Admin, My account, System admins (owners only), View token, Log out.
- **Narrower screens:**
  - medium width shows icon-only links, with the name on hover
  - phone width collapses every page into one ☰ menu
- **Behaviour:** the nav stays at the top while scrolling. Nothing wraps onto two lines anymore.
- **The public site navbar** (Home / Pricing / FAQ / Sign in) no longer shows on `/system-admin/*`. The admin pages are moved up to fill the space it left.

---

## BB-111 — Account status carries more weight in Edit Employee

**Status:** ✅ Complete.

**Page:** Organizations & People → Employees (`/dashboard/company/employees`) → **Edit Employee**.

**Why:** Status sat in the same row as Role and Department, as a plain Active / Inactive dropdown, and saved silently with the other fields. But Inactive means the account can't be used at all, so it should read as an account-level decision, not a profile field.

**What changed:**
- **Layout:** Role and Department now share the row as two columns.
- **New "Account status" row:** under a divider at the end of Basic Information, with:
  - a label and a one-line description: "Inactive accounts can't sign in or use BizBuddy."
  - a dropdown on the right, with a small status dot (green for Active, red for Inactive)
  - when Inactive is selected, the description changes to "This account can't be used until it's set back to Active.", in the theme's `destructive` colour
  - no tinted backgrounds, cards or extra icons; the emphasis comes from the separation and the description
- **Confirm on save:** only when an *active* employee is switched to Inactive.
  - "Deactivate this account?" / "Jane Doe won't be able to sign in or use BizBuddy until the account is set back to Active. Your other changes will be saved as well."
  - **Cancel** returns to the form with nothing saved. **Deactivate account** saves everything.
  - Required-field checks run first. No confirm when the employee was already inactive, or when switching back to Active.

**Unchanged:** the same `status` value is sent (`PUT /api/employee/:id`), and the Employees list and Create Employee aren't touched.

**Server-repo impact:** none. Inactive accounts are already blocked by the server.

---

## BB-112 — User Activity, Security Monitor and Request Logs (system admin)

**Status:** ✅ Complete.

Every call goes through `systemAdminFetch` (Bearer token, 401 → sign-in).

**User Activity** (`/system-admin/users`, replaces the "coming soon" placeholder):
- **Filters:** period (7 / 30 / 90 days, sent as `days`), company (all companies, from `/bbuddy/accounts`) and a manual Refresh. Changing a filter reloads every section.
- **Tiles** (`GET /activity/overview`):
  - active users today, this week and this month
  - **Web vs app** as one split bar, with a labelled legend and percentages; user counts on hover
- **Charts** (Recharts):
  - **Active users per day:** a single line (`dailyActiveUsers`)
  - **Sign-ins per day:** stacked bars, Succeeded / Failed, with a legend (`signIns`)
  - Colours are the theme's `--chart-1` / `--chart-2` tokens plus `--destructive` for Failed. They were checked with the dataviz palette validator for the light background these pages use.
- **Feature usage** (`GET /activity/features`):
  - columns: Company, Feature, Actions, Views, Users
  - sortable; default is Actions, highest first
  - friendly feature names (`clock_in_out` → "Clock in/out", …)
- **Peak hours** (`GET /activity/peak-hours`):
  - a 24-hour heatmap, one row per company, labelled with that company's time zone
  - shading is relative to that company's busiest hour, with a Fewer → More legend
  - hovering a cell shows its requests and users
- **Inactive accounts** (`GET /activity/inactive`):
  - columns: Name, Email, Company, Role, Last seen (relative, or "Never"), Created
  - its own **Days inactive** input (default 30) with Apply; follows the company filter
- **Footnote:** "B. Buddy and system-admin activity aren't counted. Web vs app is estimated from the device."

**Security Monitor** (`/system-admin/security`, replaces the "coming soon" placeholder):
- **Controls:** a 1h / 6h / 24h / 7d / 30d range switch (sent as `timeRange`, default 24h) and a manual **Refresh**. There's no polling, because the 30-day range touches a lot of rows.
- **Counters:** Critical / Warning / Info from `counts`. The number is only coloured red, amber or blue when it's above zero.
- **Group chips, with counts:**
  - All
  - Sign-in (`account_failed_signins`, `credential_stuffing`, `new_network_signin`, `reset_spike_*`)
  - Access (`repeated_access_denied`)
  - B. Buddy (`bbuddy_*`)
  - System admin (`admin_*`)
  - Platform (`server_errors`, `request_flood`)
- **Signal list:** in the server's order, critical first. Each row has:
  - a severity badge, title, ×count and the detail text
  - the subject (email, IP, staff code or endpoint)
  - "Last seen …", with the exact time on hover
  - **View requests**: opens Request Logs with the signal's `filters`, the selected time window and the subject's company
- **Empty state and footnote:** "No security signals in this period." / "Signals show suspicious activity; they don't block it. Blocking is handled by sign-in limits, lockouts and 2FA."
- **Old tables dropped:** the legacy `/security` tables were never shown on the client, so they're replaced by the signal list rather than kept as a "Raw" tab.

**Request Logs** (`/system-admin/requests`, new, under More):
- **Filters:** read from the URL, then editable. Endpoint contains, method, status code, company, date range and failed only. `userId` / `systemAdminId` show as removable chips.
- **Table:** When, Request (method + endpoint), Who (user email or system admin), Company, Status.
- **Details panel:** click a row for the full request, response time, error, IP, user agent and request body.
- **Paging:** 50 per page. Next is enabled when a page comes back full (see the pagination follow-up under Server-repo impact).

**Live Server** (`/system-admin/server`, new, under More, visible to every admin):
- **Page note** under the title: watch-only, secrets hidden, lines in memory only and cleared on restart or deploy, build/deploy/crash logs still in Render, opening the page is recorded.
- **Health** (`GET /server/health` on open, then every 15 seconds with `poll=1`, plus a Refresh button):
  - Status pill: Healthy, Needs attention or Database not responding, with any warnings listed under it as plain text.
  - Tiles: Up for (hover shows the start time), Memory, CPU, Responsiveness (event-loop p99), Database ping (red "Not responding" when down), Requests per minute, Server errors (% and count), Response time (avg · p95). Request tiles are labelled "Last 5 minutes", the server's window. CPU and Responsiveness show "—" right after a restart.
  - A 15-minute requests-per-minute bar chart, server errors stacked on top in the error colour.
  - "Version <commit> on <branch>" footer; null values are hidden (normal when running locally).
- **Live log** (`GET /server/logs?limit=500` first, then `after=<lastSeq>&poll=1` every 5 seconds):
  - Each line: local time (HH:mm:ss), a level tag (error red, warn amber, info grey, http/debug lighter) and monospace text that wraps.
  - Controls: Pause / Resume, level (All, Warnings & errors, Errors only), search (sent as `q` after typing pauses), Clear view (screen only, keeps the position).
  - Changing the level or search clears the panel and reloads from the start. These reloads send `poll=1`, so only the first open is recorded.
  - Follows the newest line; scrolling up stops following and shows **Jump to latest**. Keeps the last 2,000 lines.
  - Notices: paused, log capture off, skipped lines (a `gap`, or a poll that hit the limit) and "Showing the latest 500 lines". The footer shows how many lines the server holds, out of its capacity, and since when. Empty state: "No log lines yet."
- **Behaviour:** both panels stop polling while the browser tab is hidden and catch up when it's visible again. A 401 uses the normal sign-out. A 429 pauses both for 60 seconds with "Refreshing too often, paused for a minute."

**Nav:** the main row is Overview · Users · Security · B. Buddy. **More ▾** holds Performance · Errors · Database · Request logs · Live Server. The "Soon" tags are gone.

**Shared helpers:** `components/system-admin/shared.jsx` (new) holds:
- a section loader that refetches when filters change and ignores out-of-order responses
- a section card with skeleton / error / Retry
- formatters and sortable headers
- the company list
- `usePageVisible` and `useRateLimitPause` for the Live Server polling

The Database page now uses it as well, with no visible change.

### Performance → Capacity

**Status:** Done on the client, waiting for testing.

**Performance** now has two tabs: **Capacity** (new, the default) and **Endpoints** (the original page, unchanged, including the readable Slowest Endpoints card). The page title is now "Performance".

Capacity answers "is the API server, the database or one heavy endpoint the limit, and is it time to upgrade?" from `GET /capacity` and `GET /capacity/history`, for **1 / 7 / 30 days**. It loads on open and on **Refresh** ("Checked … ago"); no polling.
- **Banner:** the overall verdict (**OK** green / **Watch** amber / **Upgrade** red) and the server's recommendation, e.g. "The database is the bottleneck — upgrade the database plan or reduce connections first."
- **Three cards** (side by side; stacked on mobile), each with its verdict, a half-circle gauge in the verdict's colour, supporting figures and a "Why" list of the server's reasons ("Looks healthy." when there are none):
  - **API server (Render):** gauge = CPU p95. Memory p95 vs limit ("412 / 512 MB, 80%"; amber from 70%, red from 85%, the server's thresholds), responsiveness (event-loop p95), peak requests at once, restarts.
  - **Database:** gauge = connections peak vs max ("Connections peak: 18 of 20"). Latency now · p95, pool timeouts (red above 0), size ("of N MB" and % when the plan limit is set), cache hit %.
  - **API hotspots:** gauge = the top endpoint's share of server time, with the endpoint named under it. Endpoints flagged (red when any), endpoints tracked, total server time. "Flagged" uses the server's own rules: 20+ calls and p95 3 s+ or 50%+ slower than the period before.
- **Over time:** six small charts, one measure each on a shared time axis, so different units never share an axis: CPU %, memory (dashed line at the limit), requests in progress, p95 response time, database connections (dashed line at max, **pool timeouts as red markers** with a total under the chart) and database latency. Hover shows the time and value; each chart shows its peak.
- **API hotspots table:** method + endpoint, calls, avg, p95 (red at 3 s+), change ("+62%" red at 50%+, green when faster, "—" when there's no earlier data), share of server time as a bar, slow calls, 5xx (red above 0). Flagged rows get a red dot. Top 15 first, "Show all N" for the rest. **Clicking a row opens Request Logs** filtered to that endpoint and method.
- **Before history exists:** "No history yet. Samples are saved every 5 minutes once the server runs on Render with the new table." The cards still show the reasons, and the hotspots table still works (it reads request logs). Every figure is optional, so a missing table never breaks the page.
- Footnote: "Samples every 5 minutes, kept 30 days. Verdicts are guidance, not alarms."

**Server-repo impact:** uses `/api/system-admin/capacity` and `/api/system-admin/capacity/history`. History only fills once `scripts/bb112-server-metric-samples.sql` is applied (database work, server repo) and the server runs on Render.

**Server-repo impact:** uses `/api/system-admin/activity/{overview, features, peak-hours, inactive}`, `/api/system-admin/security/signals`, `/api/system-admin/requests` and `/api/system-admin/server/{health, logs}`. Follow-up: `/requests` can't filter by **IP** or **email** (see Server-repo impact).

---

## BB-107 — Add company and Set up B. Buddy (system admin)

**Status:** ✅ Complete. Tested in development with the server change.

**Add company** (button at the top right of B. Buddy → Companies) opens a drawer:
- Under the title: "This creates the company and its owner only. Departments, shifts, policies and employees are set up in the Company panel by signing in as B. Buddy."
- **Company:** name (required) and time zone (default America/Los_Angeles). A collapsed **More details** holds EIN, DBA, business email, phone, address lines 1 and 2, city, state, postal code, country and currency.
- **Owner:** first name, last name, email, password (minimum 8, with show/hide and **Generate**, a random 12-character password made in the browser), and an optional phone.
- **Plan:** optional, from `GET /subscription-plans`, labelled "Name · range of users · $price".
- **B. Buddy:** "Set up B. Buddy for this company" (on by default) and an optional **Assign support staff** dropdown, enabled only while it's ticked. It lists active staff with their current company and warns "BIZ-002 will move from YYY Company to this company."
- **Welcome email:** "Send welcome email to the owner" (on by default), hint "Includes their sign-in email and password."
- **Clash checks:** leaving the company name, business email, EIN or owner email field calls `POST /provision-company/check` with all four values. Each error shows under its field. When the owner email already has accounts elsewhere, a grey note says so (not an error): "This email already has accounts in: YYY Company (admin, inactive). A separate account will be created for this company."
- **Submit:** `POST /provision-company`. A 409 puts each error under its field (opening More details if one is in there); a 400 shows the message at the top of the form.
- **Success screen:** "✓ {company} created", then owner email and username, B. Buddy set up (or "Not set up" with **Set up now**), support staff with "moved from …" when they moved, and the welcome email result (sent / failed: "Send the sign-in details yourself" / not sent). When the email wasn't sent, a **Copy password** button is there so the details can be passed on by hand. **Add another** clears the form; **Done** closes it. The Companies table refreshes as soon as the company is created.
- Closing the drawer clears the form, so the password isn't kept.

**Set up B. Buddy:** on active rows without B. Buddy, a small **Set up** button replaces "Not set up". It confirms "Create B. Buddy for {company}? Support staff can then be assigned to it.", calls `POST /bbuddy/accounts/{companyId}`, and refreshes the table. A 409 or 400 shows the server's message.

**Time zones:** the list moved into `lib/timezones.js`. Company Configurations now imports it instead of keeping its own identical copy, so both pickers offer the same zones.

**Server-repo impact:** uses `GET /api/system-admin/subscription-plans`, `POST /api/system-admin/provision-company/check`, `POST /api/system-admin/provision-company` and `POST /api/system-admin/bbuddy/accounts/:companyId`. Uncommitted in the server's local repo at the time of writing; ships together with the server change.

---

## BB-108 — Import Punch Logs: pre-filled template

**Status:** ✅ Complete. Tested in development with the server change (`docs/server-request-BB-108-import-punch-logs.md`); client and server ship together.

**Before:** the template was blank. Admins had to look up and type each employee's ID or email, plus the date, for every row.

**Now** (same approach as BB-103 Upload Schedule):
- **1. Download a template:**
  - **From / To** dates, up to 31 days (defaults to two weeks after picking From).
  - **Employees:** all active employees (supervisors: everyone in their department), one department (admins only) or specific people.
  - **Download CSV Template** gets a file with one row per employee per date. Name, email and date are filled in; the admin types **clockIn** and **clockOut** only.
- **2. Upload the filled-in file:** unchanged. Leave both times blank for a day off; those rows are skipped.
- **Results:** "N blank rows skipped" next to the imported / failed counts, and the Employee column shows the name when the server sends it (falls back to the email).
- **Limits (confirmed by the server):** a live "N rows (E employees × D days)" count under the pickers; Download is disabled above 2,000 with "Too many rows (N). Pick fewer employees or days." (a supervisor's "everyone" has no client-side count; the server checks it). Help text: up to 500 rows with punches and 2,000 rows in total per file.
- **Copy:** setup line "Pick the dates (up to 31 days) and employees…", and under Download: "Leave a row's times empty for a day off; it's skipped. For two punches on one day, copy the row and fill each one."
- **Importing state:** "Importing <file>…" with "A full file can take up to 30 seconds." No client timeout on the request.
- **Inactive employees:** the picker offers active employees only. Back-filling a former employee still works by typing their email and date into a row by hand.
- The dialog scrolls when it's taller than the screen.

### Follow-up: a guide row in every template

**Status:** ✅ Complete. Tested in development with the server change; client and server ship together. Request and server reply: "Follow-up" section of `docs/server-request-BB-108-import-punch-logs.md`.

**Why:** nothing in a downloaded file said what goes in the blank columns. `punchType` was the clearest gap: BNC accepts `REGULAR` or `TRAINING` only, DayCare (PadPro) also `DRIVER_AIDE`, `DRIVER_AIDE_AM` and `DRIVER_AIDE_PM`. The dialog explained it for BNC only, the file for no one, and a wrong value only showed up as a failed row after uploading.

**The rule:** the first row under the header is a guide to each column's format and allowed values. Its first cell starts with `#` (`# GUIDE - not imported`), and any row starting with `#` is ignored on upload, so it still works if the sheet gets sorted.
- **Guide rows (server):** a `#` row is skipped on upload / preview: not imported, not failed, not counted in `skipped` and not counted towards the 2,000 / 500 limits. A file with only guide rows returns 400 "CSV file has no data rows." Result row numbers are the file's real line numbers (header = line 1, guide = line 2, first employee = row 3).
- **Import Punch Logs** (server): guide row with `YYYY-MM-DD`, `08:00 or 8:00 AM` / `17:00 or 5:00 PM`, and the punch types (B&C: REGULAR or TRAINING; every other company: all five). The old blank template's example row is replaced by a guide row too.
- **Clock times (server fix):** accepts `08:00`, `8:00`, `08:00:00`, `20:00`, `8:00 AM`, `8:00:00 AM`, `8 AM`, `8:00AM` (any case), read in the **company's** time zone. Before, anything but `08:00` was guessed in the server's time zone, giving errors or times off by hours; Excel often saves `8:00:00 AM`. Bad times fail per row with `Invalid clock-in time "…". Use 08:00 or 8:00 AM.` / `Invalid clock-out time "…". Use 17:00 or 5:00 PM.`
- **Import Punch Logs dialog:** adds "Times: 08:00 or 8:00 AM. A clock-out earlier than the clock-in counts as the next day."
- **Supervisor scope (server fix + client):** the template download returned 403 with no file when a supervisor picked a direct report from another department. Both imports now use the same team rule as `GET /api/employee/team` (BB-080): own department **or** direct reports (`EmploymentDetail.supervisorId`), any department. Row error "Employee not found in your team." replaces "…in your department."
  - Both dialogs now load their employee picker from `/api/employee/team` when they open (new `lib/hooks/useImportTeam.js`), **active only** (`status === "active"`). Before, they used the page's `/api/employee?all=1` list, which is the whole company for every role, and let people without a status through.
  - Supervisors: "Everyone in my department" is now **"Everyone on my team"**, and the live row count works for them too (the team list is the server's scope). Import Punch Logs help: "Supervisors can import for their team: their own department and their direct reports."
  - **Template refusals show under the Download button** instead of as a toast, which sat behind the dialog and was easy to miss. Only a 200 is saved as a file; any other status shows the server's `message` (e.g. "The date range can be at most 31 days (got 32).", "N of M selected employees are inactive or outside your scope."). The dialog now lists the punch types for DayCare too ("REGULAR, DRIVER_AIDE, DRIVER_AIDE_AM, DRIVER_AIDE_PM or TRAINING"; BNC: "REGULAR or TRAINING"), adds "Leave it blank for REGULAR", and says the first row is a guide that's never imported ("You can delete it or leave it in.").
- **Upload Schedule** (server): guide row "Mark x (or 1 / yes) under each slot to schedule" with one example `x`; it never appears in `/preview`. The hint under Download says the first row is a guide you can delete or leave in.
- **Employees bulk import** (client only, works now): the sample CSV's two example people (John Doe / Jane Smith, imported if left in) became one guide row with the allowed values (`employee | supervisor | admin`, `full_time | part_time | contract`, and so on). Rows whose `firstName` starts with `#` are dropped before sending; failed-row numbers are the file's line numbers (header = line 1), the same as the server imports. The CSV Format Guide says the first row is never imported and can be deleted or left in.

**Server-repo impact:** template and upload changes for Import Punch Logs and Upload Schedule (guide row in; `#` rows skipped). Done on the server; ships together.

**In-app docs:** Help → Documentation (Company Panel) now covers the pre-filled template, guide rows, accepted times, limits, row numbers and the supervisor team rule for Importing punch logs, Importing employees from CSV and Uploading a schedule. It also covers the BB-111 Account status change under Editing an employee.

**Other uploads checked:** Upload Schedule already works this way (BB-103). Backtrack import reads the old PadPro export, not our template, and already matches names. Employees bulk import creates new people. Neither needs this change.

**Server-repo impact:** `GET /api/punch-log-import/template` takes `startDate`, `endDate`, `userIds` / `departmentId` and returns the pre-filled CSV (no params → today's blank template). `POST /api/punch-log-import/upload` skips blank rows, returns `skipped` and the employee `name`, and needs a higher row limit. Full contract in the server request doc. Ships together with the server change.

---

## Also in this release (no ticket number)

- **Performance → Slowest Endpoints reads in plain time.** The big number is the average as a readable duration ("4.8 s avg"; under a second stays in ms). The exact average stays under it ("4,803 ms · slowest 18.5 s"), each row says "6 requests · avg 4.8 s each", and hovering gives the full sentence with exact ms. The subtitle now explains both numbers. The number follows the page's existing fast/moderate/slow colours instead of always red, and the method tag is neutral grey. Client only (`app/system-admin/performance/page.jsx`).
- **View token (system admin):**
  - opened from the account menu
  - shows the current system-admin session token in a dialog: hidden by default, Reveal / Hide, Copy
  - re-hides on close
  - started as a nav button and moved into the account menu with the nav redesign
- **BizChat widget:** `BizChatLoader` now also skips `/system-admin/*`, so no third-party script runs next to the admin token. The widget is currently commented out in `app/layout.jsx`; this only matters if it's turned back on.

---

## Server-repo impact

Uses the BB-110 contract from `bizbuddy-v2-server`. The client doesn't need anything else from the server, except the follow-ups below.

- **Sign-in:** `POST /api/account/login` (`agentCode` / `agentPin`, plus the `AGENT_*` codes), `GET /api/account/get-user-email` (`isSystemAgent`), `GET /api/account/profile` (`user.isSystemAgent`).
- **System-admin auth:** `/api/system-admin/auth/{login, 2fa/setup, 2fa/verify, verify, logout, password, 2fa/recovery-codes}`.
- **Admins:** `/api/system-admin/admins` (+ `/:id`, `/:id/reset-2fa`, `/:id/reset-password`).
- **B. Buddy:** `/api/system-admin/bbuddy/{activity, summary, accounts, agents, agents/:id}`.
- **Admin activity:** `/api/system-admin/requests?systemAdminId=`.
- **Database:** `/api/system-admin/database/{storage, business, growth, cleanup-candidates}`.
- **User Activity (BB-112):** `/api/system-admin/activity/{overview, features, peak-hours, inactive}`.
- **Security Monitor (BB-112):** `/api/system-admin/security/signals`; Request Logs uses `/api/system-admin/requests`.
- **Capacity (BB-112):** `/api/system-admin/capacity` and `/api/system-admin/capacity/history`; needs `scripts/bb112-server-metric-samples.sql` applied for history.
- **Live Server (BB-112):** `/api/system-admin/server/health` and `/api/system-admin/server/logs`. No rate limiter is on these routes yet; the client already handles a 429 if one is added.
- **Add company / Set up B. Buddy (BB-107):** `/api/system-admin/subscription-plans`, `/api/system-admin/provision-company` (+ `/check`), `POST /api/system-admin/bbuddy/accounts/:companyId`, and `isRetired` / `activeUsers` on `/bbuddy/accounts`.
- **Import Punch Logs (BB-108):** pre-filled `/api/punch-log-import/template`, blank-row skipping and `skipped` / `name` on `/upload`. See `docs/server-request-BB-108-import-punch-logs.md`.
- **Guide rows (BB-108 follow-up):** `/api/punch-log-import/template` and `/api/schedule-import/template` add a `#` guide row; `/api/punch-log-import/upload` and `/api/schedule-import/preview` (+ `/confirm`) skip `#` rows. Same doc, "Follow-up" section.

**Follow-ups for the server:**
- **`GET /api/system-admin/requests` never returns pagination.** `analyticsController.getRequestLogs` sends `pagination: result.pagination`, but `analyticsService.getRequestLogs` returns `total` / `page` / `limit` / `totalPages` at the top level. The Admin activity tab works around it by enabling Next when a page comes back full.
- **`GET /api/system-admin/requests` can't filter by IP or email (BB-112).** It supports `userId`, `companyId`, `endpoint`, `method`, `statusCode`, `isFailed` and dates only. Signals identified only by `subject.ip` / `subject.email` therefore get no "View requests" link: credential stuffing, request flood, reset spikes and new-network sign-ins. Adding `ip` / `email` filters lets the client link those too.
- **`GET /database/storage` has no `other` entry in `categories`.** Tables tagged `other` aren't totalled, so the client adds the "Other" bar itself. If the server adds it, the client stops calculating it.
- **The BB-110 / BB-112 server changes need committing and deploying** before this client release, and so do the **BB-107** and **BB-108** server changes.

---

## Known follow-ups (not in scope)

- **Mobile app:** the B. Buddy support sign-in, `AGENT_*` errors and Company-panel-only behaviour (separate repo).
- **SYSTEM_AGENT_\* messages:** only wired into the screens where the server can return them today. A central fetch wrapper for the company dashboard would cover every screen.
- **Existing styling:** the sign-in page and the older system-admin pages use hardcoded `orange-*` / `neutral-*` colours. The new pages use shadcn primitives and the design-system colours; the old ones weren't cleaned up.

---

### Files Changed

| File | Ticket | Changes |
|---|---|---|
| `app/(auth)/sign-in/page.jsx` | BB-110 | B. Buddy company-picker display; Support sign-in step 3 (staff code + PIN); `AGENT_IDENTITY_REQUIRED` / `_INVALID`, `AGENT_NOT_ASSIGNED`, `AGENT_LOCKED` handling; shared `submitLogin()`; third step dot. |
| `lib/systemAgent.js` | BB-110 | **New.** `isSystemAgentToken`, B. Buddy route allow/block lists, `SYSTEM_AGENT_HOME`, `getSystemAgentErrorMessage`. |
| `app/dashboard/DashboardLayoutClient.jsx` | BB-110 | Route guard sending B. Buddy back to Employees from blocked routes. |
| `app/dashboard/DashboardHomeClient.jsx` | BB-110 | B. Buddy lands on Company → Employees. |
| `components/Dashboard/sidebar.jsx` | BB-110 | Employee panel hidden for B. Buddy (Payroll Management kept, under a "Payroll" header); Deletion hidden; "Support mode: B. Buddy" in the user block. |
| `components/Partial/Navbar/UserMenu.jsx` | BB-110 | Username and Settings hidden for B. Buddy; "Support" badge in place of the role badge. |
| `components/Dashboard/DashboardContent/CompanyPanel/Organizations&People/Employees.jsx` | BB-110, BB-111 | `SYSTEM_AGENT_*` messages on edit/delete employee (BB-110). Account status in its own row (`AccountAccessField`), Role / Department as two columns, and a "Deactivate this account?" confirm when saving an active employee as Inactive (BB-111). Sample CSV is one `#` guide row instead of two example people; `#` rows are skipped on import (BB-108 follow-up). |
| `app/dashboard/employee/(E_Payroll)/payroll/Employee.jsx` | BB-110 | `SYSTEM_AGENT_*` messages on save/reset payroll details. |
| `lib/systemAdminFetch.js` | BB-110 | **New.** Shared system-admin fetch: Bearer token, 401 → sign-in (session 401s only), token helpers, `RECOVERY_LEFT_KEY`, `LOGIN_NOTICE_KEY`. |
| `components/system-admin/SystemAdminContext.jsx` | BB-110 | **New.** Signed-in admin context (`useSystemAdmin`). |
| `components/system-admin/RecoveryCodes.jsx` | BB-110 | **New.** "Save your recovery codes" screen (Copy, Download .txt, required checkbox). |
| `app/system-admin/login/page.jsx` | BB-110 | Rewritten: password → 2FA setup (QR) / code (or recovery code) → recovery codes; error codes; sign-in notice. |
| `app/system-admin/layout.jsx` | BB-110 | Session check through `/auth/verify`, `SystemAdminProvider`, low recovery codes banner, offset for the hidden public navbar. |
| `app/system-admin/account/page.jsx` | BB-110 | **New.** My account: change password, new recovery codes. |
| `app/system-admin/admins/page.jsx` | BB-110 | **New.** System Admins (owners only). |
| `app/system-admin/bbuddy/page.jsx` | BB-110 | **New.** B. Buddy page: Activity, Summary, Companies, Staff, Admin activity tabs, and one Refresh for the open tab. |
| `components/system-admin/bbuddy/api.js` | BB-110 | **New.** `bbuddyFetch` (on top of `systemAdminFetch`), date helpers. |
| `components/system-admin/bbuddy/ActivityTab.jsx` | BB-110 | **New.** Filterable, paged activity table with a details panel; Live (15s polling) toggle; reloads on the page's Refresh. |
| `components/system-admin/bbuddy/SummaryTab.jsx` | BB-110 | **New.** Stat cards + by-company / by-staff tables. |
| `components/system-admin/bbuddy/AccountsTab.jsx` | BB-110 | **New.** Companies with/without B. Buddy and their assigned staff; retired companies greyed and hidden by default; Add company and per-row Set up B. Buddy (BB-107). |
| `components/system-admin/bbuddy/AddCompanySheet.jsx` | BB-107 | **New.** Add company drawer: form, clash checks, success screen with Set up now. |
| `lib/timezones.js` | BB-107 | **New.** Time-zone list for the Add company form and Company Configurations. |
| `components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyConfigurations.jsx` | BB-107 | Imports the time-zone list from `lib/timezones.js` instead of its own identical copy. No visible change. |
| `components/system-admin/bbuddy/StaffTab.jsx` | BB-110 | **New.** Support staff: add/edit (one company, PIN Generate/Copy), move/unassign confirmations, suspend, remove, Locked status; retired companies left out of the company dropdown. |
| `components/system-admin/bbuddy/AdminActivityTab.jsx` | BB-110 | **New.** Request logs by system admin. |
| `app/system-admin/database/page.jsx` | BB-110 | **New.** Read-only Database page: tiles, Refresh, sections. |
| `components/system-admin/database/shared.jsx` | BB-110, BB-112 | **New.** `useDatabaseSection`; re-exports the shared helpers (moved to `components/system-admin/shared.jsx` in BB-112). |
| `components/system-admin/shared.jsx` | BB-112 | **New.** `useSystemAdminSection` (refetch on filter change, ignores stale responses), `SectionCard`, `SortHeader`, formatters, `useCompanyOptions`, `usePageVisible`, `useRateLimitPause`. |
| `app/system-admin/users/page.jsx` | BB-112 | Rewritten from placeholder: User Activity page (period / company filters, sections, footnote). |
| `components/system-admin/activity/OverviewSection.jsx` | BB-112 | **New.** Active-user tiles, web vs app split bar, active users per day (line), sign-ins per day (stacked bars). |
| `components/system-admin/activity/FeatureUsageSection.jsx` | BB-112 | **New.** Sortable feature usage table with friendly feature names. |
| `components/system-admin/activity/PeakHoursSection.jsx` | BB-112 | **New.** Per-company 24-hour heatmap in each company's time zone. |
| `components/system-admin/activity/InactiveAccountsSection.jsx` | BB-112 | **New.** Inactive accounts table with a days-inactive window. |
| `app/system-admin/security/page.jsx` | BB-112 | Rewritten from placeholder: Security Monitor (range, counters, group chips, signal list, View requests). |
| `app/system-admin/requests/page.jsx` | BB-112 | **New.** Request Logs: URL-driven filters, paged table, details panel. |
| `app/system-admin/server/page.jsx` | BB-112 | **New.** Live Server: page note, shared tab-visibility and 429 pause for both panels. |
| `components/system-admin/server/HealthCard.jsx` | BB-112 | **New.** Status, warnings, eight tiles, 15-minute chart, version line; polls every 15s. |
| `components/system-admin/server/LogPanel.jsx` | BB-112 | **New.** Live log tail: 5s polling by seq, level/search, pause, follow + Jump to latest, 2,000-line cap, notices. |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/ImportPunchLogs.jsx` | BB-108 | Date range + employee picker, pre-filled template download, blank-rows-skipped count, names in results, scrollable dialog. Guide-row line, times line and punch types for both company types; employee picker from `/employee/team` (active only); team wording; template refusals shown under Download (follow-up). |
| `components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/UploadWeeklySchedule.jsx` | BB-108 | Hint says the template's first row is a guide; employee picker from `/employee/team` (active only); "Everyone on my team"; template refusals shown under Download (follow-up). |
| `lib/hooks/useImportTeam.js` | BB-108 | **New.** Loads `/api/employee/team` when an import dialog opens, active only, with the page's list as fallback. |
| `components/Dashboard/DashboardContent/EmployeePanel/Documentation/companyDocsContent.js` | BB-108, BB-111 | In-app Help → Documentation (Company Panel) brought up to date: Editing an employee (Account status row, Deactivate confirm), Importing employees from CSV (guide row, line numbers), Importing punch logs (pre-filled template, dates and employees, blank rows, times, guide row, 500 / 2,000 limits, row numbers, supervisor team), Punch types in imports (blank = REGULAR, full DayCare list), Uploading a schedule (x / 1 / yes, guide row, supervisor team). System admin and B. Buddy are intentionally left out. |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs.jsx` | BB-108 | Passes `employees` and `departments` to Import Punch Logs. |
| `docs/server-request-BB-108-import-punch-logs.md` | BB-108 | **New.** Server contract for the pre-filled template and blank-row skipping. |
| `components/system-admin/database/StorageSection.jsx` | BB-110 | **New.** Category bars (incl. client-side "Other") and the sortable tables list. |
| `components/system-admin/database/CompaniesSection.jsx` | BB-110 | **New.** Per-company activity with an Inactive badge. |
| `components/system-admin/database/GrowthSection.jsx` | BB-110 | **New.** Rows added per table. |
| `components/system-admin/database/CleanupSection.jsx` | BB-110 | **New.** Cleanup preview: windows + Recalculate, candidates, legacy tables, notes. |
| `components/system-admin/SystemAdminNav.jsx` | BB-110, BB-112 | Redesigned: one row, More menu, account menu, mobile menu, logout with the Bearer token (BB-110). Regrouped: Users / Security in the main row; Performance, Errors, Database, Request logs, Live Server under More (BB-112). |
| `components/system-admin/ScreenshotButton.jsx` | BB-110 | New `compact` (icon-only) mode. |
| `components/system-admin/TokenDialog.jsx` | untagged | **New.** View token dialog (opened from the account menu). |
| `app/system-admin/dashboard/page.jsx` | BB-110 | Uses `systemAdminFetch`; sections load independently. |
| `app/system-admin/performance/page.jsx` | BB-110, BB-112 | Now "Performance" with Capacity / Endpoints tabs (BB-112). The original view moved to `EndpointsView.jsx` unchanged (it uses `systemAdminFetch`; Slowest Endpoints shows readable durations, no ticket). |
| `components/system-admin/performance/CapacityView.jsx` | BB-112 | **New.** Capacity tab: period, Refresh, banner, cards, charts, hotspots, empty state. |
| `components/system-admin/performance/CapacityCards.jsx` | BB-112 | **New.** Overall banner, verdict badges, half-circle gauge, API server / Database / API hotspots cards. |
| `components/system-admin/performance/CapacityCharts.jsx` | BB-112 | **New.** Six history charts with limit lines and pool-timeout markers. |
| `components/system-admin/performance/HotspotsTable.jsx` | BB-112 | **New.** Endpoints by server time; rows open Request Logs. |
| `components/system-admin/performance/EndpointsView.jsx` | BB-112 | **New file, existing view.** The original Performance content, moved under the Endpoints tab. |
| `app/system-admin/errors/page.jsx` | BB-110 | Uses `systemAdminFetch`. |
| `components/Partial/Navbar.jsx` | BB-110 | Public navbar hidden on `/system-admin/*`. |
| `components/Home/BizChatLoader.jsx` | untagged | Skips `/system-admin/*`. |
| `package.json`, `package-lock.json` | BB-110 | Adds `qrcode.react@^4.2.0` (2FA setup QR code, drawn locally). |
| `docs/CLAUDE.md` | BB-107, BB-108, BB-110, BB-112 | Project reference: new **System Admin dashboard**, **B. Buddy** and **Bulk uploads (CSV)** sections (sign-in and session, pages, shared helpers, the four upload flows and their shared rules, including the guide row); system-admin folder entries, `lib/timezones.js`. |
| `docs/server-request-BB-108-import-punch-logs.md` | BB-108 | **New.** Server request for the pre-filled template, plus the guide-row follow-up for punch log and schedule templates. |
