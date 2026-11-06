# Changelog — v2.15.2

BB-116: The Leave Ledger now shows which days each leave covers and who acted on it. Before, a row was dated only by when the action happened (e.g. "Oct 15 · Deduction · −5.5h" for an Oct 27 leave), so the hours looked like they were missing.

BB-114: System-admin analytics pages now use the server's new cache. Each page shows "As of …" (when the server computed the data), Refresh asks the server to recompute, and the System Dashboard polls when the cache expires instead of every 30 seconds.

---

## BB-116 — Leave Ledger shows the leave's dates and approver

**Status:** Complete (client). Needs the server's BB-116 release (bizbuddy-v2-server `release/v2.11.1`), which must ship first.

**Page:** Settings → Leave → Leave Credits → an employee's leave type → **Ledger** modal (e.g. "Sick Leave Ledger"). File: `components/Dashboard/DashboardContent/CompanyPanel/Settings/LeaveSettings.jsx`, `LeaveLedgerDrilldownModal`.

**Date column:**
- The action date (when the row happened) stays as the first line.
- When a row is tied to a leave request, a muted second line shows the leave's own dates:
  - one day: **"Leave: Oct 27"**
  - a range: **"Leave: Nov 9 – Nov 11"**
- The leave dates are `YYYY-MM-DD` calendar dates in the company timezone. New helpers `formatYmdShort` and `leaveRangeLabel` (next to `formatYmd`) build the date from its year, month and day, so the day never shifts with the browser's timezone.

**New "By" column (after Note):**
- Shows who acted on the row (`performedBy.name`), or "—" when there's no one (e.g. system accruals).
- On `approved`, `rejected` and `deduction` rows, a muted second line **"Assigned: …"** shows the leave's assigned approver when it's a different person from who acted.
- `leave.decidedBy` is sent by the server but not displayed.

**Layout:** the modal is wider (`sm:max-w-lg` → `sm:max-w-2xl`) to make room for the sixth column.

**Null safety:** `leave`, `leave.approver` and `performedBy` can each be `null`. Rows not tied to a leave (`adjustment`, `accrual`, `expired`) show no Leave line, and an older server that doesn't send `leave` renders exactly as before.

**Server-repo impact:** Uses the new additive `leave` field on `GET /api/leave-balances/transactions`:
- `leave` holds `id`, `startDate`, `endDate`, `status`, `approver` and `decidedBy`.
- It's already built on the server side; nothing more is needed there.
- Ship order: server first, then client.

**Also in BB-116 (server only, no client change):** the cutoff period screen now shows approved leaves that fall on the last day of a cutoff. Before, they showed as Absent with "0 leave records".

---

## BB-114 — System Admin: cached analytics endpoints

**Status:** Complete (client). Needs the server's BB-114 release, which must ship first. The server change is additive (`data` is unchanged), so the current client keeps working until this lands.

**Why:** the analytics endpoints aggregate `RequestLog` on a small database. `/activity/features` and `/activity/peak-hours` took up to 2 minutes, and the dashboard's 30-second polling competed with customers for database connections. The server now caches results (15 min for `activity/*`, 2 min for `security/signals`, 1 min for the rest) and returns `cache: { hit, cachedAt, expiresAt }`.

**Shared (`components/system-admin/shared.jsx`):**
- `useSystemAdminSection` keeps the server's `cache` as `section.cache` and adds `refresh()`, which sends `refresh=1`. `reload()`, Retry and automatic loads never send it.
- `CacheStamp`: "As of 10:42 AM · 3 minutes ago" from `cachedAt` (full date when it's from another day). Updates itself every 30 s.
- `useRefreshLocked(cachedAt)`: Refresh is disabled for 30 s after `cachedAt`, since the server ignores `refresh=1` in that window. Capped at 30 s so a wrong browser clock can't lock it longer.
- `oldestCachedAt(...)` / `latestExpiresAt(...)` for cards built from several endpoints.
- `SectionCard` shows "As of …" under its title when its endpoint is cached. `asOf={false}` hides it. Uncached sections (e.g. Database) are unchanged.

**Pages:**
| Page | Change |
|---|---|
| System Dashboard (`/system-admin/dashboard`) | "Updated {time}" → "As of" the oldest of overview / trends / performance. Refresh sends `refresh=1`, locked 30 s. Polling: see below. |
| User Activity (`/system-admin/users`) | Each section (Overview, Feature usage, Peak hours, Inactive accounts) shows its own "As of". Refresh sends `refresh=1` to all three top sections; locked until the oldest is 30 s old. "Sign-ins per day" hides its label (same section as "Active users per day"). |
| Security (`/system-admin/security`) | Header "Updated …" → "As of …" (falls back to `generatedAt`). Refresh sends `refresh=1`, locked 30 s. The Signals card hides its own label. |
| Performance → Capacity | "Checked …" → "As of" the older of `capacity` / `capacity/history`. Refresh sends `refresh=1`, locked 30 s. |
| Performance → Endpoints | New "As of …" before the period buttons. Refresh sends `refresh=1`, locked 30 s. |
| Errors (`/system-admin/errors`) | New "As of …" next to Refresh. Refresh sends `refresh=1`, locked 30 s. |

**Dashboard polling:**
- Was a fixed 30 s timer, running even with the tab hidden.
- Now polls at the latest `expiresAt` + 2 s (60 s when there's no `cache`), kept between 5 s and 2 min against clock skew.
- Paused while the tab is hidden; on return it polls within ~5 s if the data has expired.
- Keeps scheduling even when all three calls fail. Polls never send `refresh=1`.

**Also fixed:** the Capacity / Endpoints Retry buttons and the Errors Refresh button passed the click event into the load function (`onClick={load}`). They now call it explicitly, so Retry never forces a server recompute.

**Not changed:** the older styling on the Dashboard and Errors pages (plain `<button>`, hardcoded `neutral-*` classes) is left as is; flagged for a later ticket. Slow-load spinners are kept — a refresh of Feature usage can still take ~2 minutes.

**Docs:** `docs/CLAUDE.md` describes the BB-114 cache helpers under the system-admin section.

**Server-repo impact:** none further; already built. Ship order: server first, then client.

**Mobile:** screens that call these endpoints are outside this repo. They keep working unchanged and can adopt the same rules (As of, refresh=1 on tap only, poll by `expiresAt`, pause in background) later.
