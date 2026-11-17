# Changelog — v2.15.8

BB-132: new **Subscription plans** page in the System Admin dashboard, under **More**, after Database. It shows every plan, what each one includes, and which companies are on it. It's view only: there's no create, edit, delete or change-plan. Needs server v2.11.15.

Also: the root `CLAUDE.md` now records how versions, changelogs and release branches work.

---

## BB-132 — Subscription Plans (System Admin)

**Status:** Built (client), not yet tested. Needs server **v2.11.15** to be live first. Against an older server the page loads, but each section shows its own error with Retry. Nothing else breaks.

**Why:** System Admin had no single place to see the subscription plans, what they include, and how many companies and employees are on each.

**Server contract used (no server change from this repo):**
- `GET /api/system-admin/subscription-plans/overview` → `{ plans[], totals, featureKeys[] }`.
  - `plans` comes sorted by price, then name.
  - Each plan has `companies: { active, retired }` and `activeEmployees`.
- `GET /api/system-admin/subscription-plans/:id[?includeRetired=true]` → the plan plus `companyList[]`.
  - Active companies come first.
  - Retired companies are included only with `includeRetired=true`, and their `activeEmployees` is `null`.
  - An unknown id returns 404 "Subscription plan not found."
- Both use the usual system-admin session (`systemAdminFetch`: Bearer token, 401 → sign-in).
- `GET /api/system-admin/subscription-plans` (the Add company dropdown) is unchanged.

### 1. Page (`app/system-admin/subscription-plans/page.jsx`)
- Title, a "View only" subtitle and a manual **Refresh**. There's no polling.
- **Summary tiles** from `totals`: Plans, Subscribed companies, Companies without a plan, Retired companies.
- `totals.estimatedMonthly` is deliberately **not shown**. The estimate tile was removed at Carlo's request.

### 2. Plan cards (`PlanCards.jsx`)
- One card per plan, in the server's order.
- Each card shows the name, price per month ("Free" at 0), user range ("2–9 users") and a two-line description.
- It also shows active companies, with "+ N retired" in muted text, and active employees.
- Clicking a card opens the plan drawer.

### 3. Feature comparison (`FeatureComparison.jsx`)
- One row per `featureKeys` entry and one column per plan. No key is hard-coded.
- A check means `features[key] === true`. Anything else, including a missing key, shows a muted dash.
- Labels are generated from the key, e.g. `timekeeping-punch-offline` → "Timekeeping: punch offline" (`format.js`).

### 4. Plan drawer (`PlanDetailSheet.jsx`)
- Right-side `Sheet` with the plan's price, user range, the active / retired / employee counts, and its description.
- **Companies** table: name (with a neutral **Retired** badge), subscribed since, active employees ("—" for retired).
- A **Show N retired** checkbox appears only when the plan has retired companies.
  - Ticking it refetches with `includeRetired=true`.
  - It resets when another plan is opened.

### 5. Nav and docs
- `SystemAdminNav.jsx`: "Subscription plans" (`CreditCard` icon) added to **More**, after Database. It's also in the small-screen menu.
- `docs/CLAUDE.md`: the page is added to the System Admin pages table and the component tree.

### Not changed
- No create / edit / delete / change-plan actions.
- The Add company drawer is unchanged.
- The company-side subscription pages are unchanged.

**To test (once server v2.11.15 is live):**
1. Open System Admin → More → Subscription plans.
   - The tiles match `totals`.
   - The cards are in price order.
   - The comparison rows match `featureKeys`.
2. Click a plan. The drawer lists its active companies.
   - Tick **Show N retired**: retired companies appear with the badge and "—" employees.
   - Untick it: they're gone.
3. Older server or bad plan id: the section shows an error with Retry. Expired session: you're sent to sign-in.
4. At phone width the page is in the menu, and the tables scroll inside their cards.

---

## Root CLAUDE.md — versioning, changelog and release

New section **"Versioning, changelog and release"**:
- One push = one version, used for the changelog file, the `release/vX.Y.Z` branch and the commit.
- Patch for narrow pushes, minor for wide ones (Carlo decides).
- Several tickets per push is normal.
- The mobile developer's PRs can take a number first.
- Claude must always ask Carlo for the final version number. It's never inferred from the branch name: `release/v2.15.5` carried v2.15.5–v2.15.7 commits.

---

## Open items

- **Server v2.11.15** must be deployed before this page works.
- **Estimated monthly:** the server still returns `totals.estimatedMonthly`, and the client ignores it. Decide whether the server should drop it.
