# Changelog — v2.14.13

BB-053 fix: notifications are now clickable — clicking one marks it as seen and navigates (same tab) to the page it relates to, mapped from `notificationCode`. Also fixes the actual cause of users getting logged out unexpectedly: the auth token was already persisted correctly in `localStorage`, but a profile-fetch component was logging the user out on *any* fetch failure (network blips, 500s), not just real expired-token 401s — and no code anywhere checked whether a stored token had already expired before trying to use it.

BB-054 / BB-051: employees can now deselect individual shifts on a multi-shift day so a leave request doesn't pull in a shift they'll actually work, and can exclude unplotted weekend days from the deduction via a new "Include weekends" checkbox. Separately, admins get a new company setting for whether a punch-vs-leave conflict resolves automatically or still requires manual review in Cutoff Review — the underlying revert mechanics (whole-leave cancellation, flat refund) are unchanged. All three depend on companion `bizbuddy-v2-server` work that has been written but not yet migrated onto the live database.

---

## BB-053 — Make notifications clickable (+ root-caused a recurring re-login complaint)

**Status:** Fix applied (client only) — pending manual verification, not yet confirmed closed.

**Pages:** Notification bell dropdown (all dashboard pages), `/dashboard/notifications` (full list), and the app-wide dashboard auth gate.

**Files:**
- `lib/notificationRoutes.js` (new)
- `components/common/NotificationBell.jsx`
- `app/dashboard/notifications/page.jsx`
- `components/Partial/Navbar/UserMenu.jsx`
- `store/useAuthStore.js`
- `app/dashboard/DashboardLayoutClient.jsx`

**Ask:** Original ask was framed as "should the auth token move from `sessionStorage` to `localStorage` so two tabs don't force re-login?" — plus, separately, make notifications actually clickable.

**Investigation findings:** The token was already in `localStorage` (Zustand's `persist` middleware, key `"auth-storage"`) — the premise was based on a real symptom (forced re-login) but the wrong cause. Tracing the real cause turned up two bugs:
1. `UserMenu.jsx` fetches `/api/account/profile` on mount and called `logout()` on **any** failure of that call — a transient network error, a backend 500, *or* a real expired-token 401 were all treated identically, silently wiping the persisted token. This is what actually produced "why do I keep getting logged out."
2. No code checked the JWT's `exp` claim anywhere. A stored token that had already expired would sit around and get used for doomed API calls before the user found out they needed to log in again, instead of failing predictably up front.

Notifications themselves had no click behavior at all (only "mark as read" / "delete" buttons worked), and the notification payload has no `entityId`/`link` field — only `notificationCode`, `message`, `seen`, timestamps — so deep-linking to a specific record isn't possible without a server change. That was scoped out; only route-level navigation was built.

Also confirmed no refresh-token flow exists anywhere in this repo — once a JWT expires, the user must log in again regardless of any of this. Full silent-renewal support was explicitly deferred as a separate future ticket requiring server-side work (new endpoint, issuance/rotation policy).

**Fix:**
- **`store/useAuthStore.js`** — added an exported `isTokenExpired(token)`, a pure predicate that decodes the JWT and compares its `exp` claim to `Date.now()`. Kept out of the existing `user` getter deliberately (getters shouldn't have side effects).
- **`app/dashboard/DashboardLayoutClient.jsx`** — the auth-check effect now rejects an expired token instead of trusting it: a token recovered from `localStorage` is only accepted via `login()` if `!isTokenExpired`; a token already sitting in Zustand state that has since expired triggers `logout()` + redirect to `/sign-in` immediately, rather than waiting for an API call to 401 first.
- **`components/Partial/Navbar/UserMenu.jsx`** — the profile-fetch effect now only calls `logout()` on a real `401` response, matching the convention already used in `lib/notificationApi.js`'s axios interceptor. Network failures and non-401 server errors are logged but no longer destroy the session. Also fixed a latent bug where `isLoading` never resolved when there was no token, leaving the avatar skeleton stuck indefinitely.
- **`lib/notificationRoutes.js`** (new) — single shared `notificationCode → route` map (`getNotificationRoute()`), used by both notification UIs. All 16 destination routes were verified against the real `app/dashboard/` route tree before use. Kept separate from each notification UI's own display-config map (`NOTIFICATION_CONFIG` / `NOTIFICATION_TYPES`, which carry emoji/title/icon/color — not reused here since the route mapping has no per-file variation).
- **`components/common/NotificationBell.jsx`** / **`app/dashboard/notifications/page.jsx`** — notification rows are now clickable: click marks the notification as seen (if unread) and calls `router.push(getNotificationRoute(notification.notificationCode))` in the same tab (bell dropdown also closes itself first). The existing mark-read/delete/toggle buttons got `e.stopPropagation()` so they still work without also triggering navigation.

**Explicitly out of scope (deferred):**
- Deep-linking to the exact record a notification refers to (needs a server-side `entityId`/`link` field).
- Full refresh-token support / silent session renewal (needs a new server endpoint + issuance/rotation design — real feature work, not a bug fix).

**Server-repo impact:** None for this pass — everything above is client-only. Deep-linking and refresh tokens, if picked up later, would need server coordination as noted above.

### Files Changed

| File | Changes |
|---|---|
| `lib/notificationRoutes.js` | New file. Exports `NOTIFICATION_ROUTES` map and `getNotificationRoute(code)`. |
| `components/common/NotificationBell.jsx` | `NotificationItem` rows are now clickable (mark-as-seen + `router.push` + close dropdown); mark-read/remove buttons got `stopPropagation()`. |
| `app/dashboard/notifications/page.jsx` | Added `useRouter`; `NotificationCard` rows are now clickable (mark-as-seen + `router.push`); mark-read/toggle-seen/delete buttons got `stopPropagation()`. |
| `components/Partial/Navbar/UserMenu.jsx` | Profile-fetch effect only logs out on a real `401`; network/non-401 failures no longer destroy the session; fixed stuck-loading-skeleton bug when there's no token. |
| `store/useAuthStore.js` | Added exported `isTokenExpired(token)` helper. |
| `app/dashboard/DashboardLayoutClient.jsx` | Auth-check effect now rejects expired tokens (both the `localStorage`-recovered path and the in-state path) instead of trusting them until an API call fails. |

---

## Guidance for the mobile app — same class of bugs, different codebase

This client repo has no visibility into the mobile app's source (it's a separate codebase), so nothing here was verified against it — this is a write-up of what to check for, not a confirmed diagnosis. If mobile users report the same "keeps logging me out" complaint, or notifications aren't tappable there either, the concepts below should transfer even though the implementation will look completely different on a native stack.

### 1. If mobile has a similar forced-logout complaint

Look for the mobile equivalent of `UserMenu.jsx`'s bug: any place that fetches the user's profile/session on app foreground or screen mount, and ask **specifically** what happens on failure. The bug pattern to check for:
- Does it call whatever the mobile app's "log the user out" action is (clear stored token, navigate to login) on **every** failure path — including a plain network timeout or a 5xx — or only on a real `401`/"invalid session" response?
- If it can't tell the difference today, that's the fix: only clear the session on an explicit auth-failure response from the server. Anything else (offline, flaky connection, backend hiccup) should just show a retry/error state and leave the stored session alone.

### 2. Check for a proactive expiry check

Same idea as `isTokenExpired()` here: if the mobile app decodes/stores the JWT, does anything check the token's `exp` before trusting it — on app launch, on resume from background, before firing off a batch of API calls? If not, a stale expired token can sit in storage and get used for a string of doomed requests before the user gets any explicit "please log in again," which reads as random/unexplained. Failing this check fast and routing straight to login (rather than after an API 401 downstream) makes the failure mode predictable instead of confusing.

### 3. Where the token lives isn't the bug (probably)

Our own investigation started from "maybe it's `sessionStorage` vs `localStorage`" and that turned out to be a red herring — the token was already durably stored. On mobile there's no browser-tab equivalent of that question at all (native apps don't have "tabs"), but there is an equivalent question worth checking: is the token in secure, app-lifecycle-durable storage (e.g. Keychain/Keystore-backed secure storage, or an equivalent persistent store), not something that gets wiped on app restart or backgrounding by default? If storage is already durable and the complaint persists, the cause is much more likely to be one of the two bugs above than the storage layer itself — that's exactly what happened here.

### 4. Making notifications tappable on mobile

Same underlying idea as `lib/notificationRoutes.js`: the notification data itself (`notificationCode`, `message`, `seen`, timestamps) comes from the same shared backend, so mobile already has everything needed to build its own `notificationCode → screen` map — it just points at native screens/deep links instead of Next.js paths. No server change is needed for this either, for the same reason it wasn't needed here: as long as a static code-to-destination mapping is acceptable (vs. deep-linking to one exact record), it's a client-only lookup table. If mobile *does* want to jump straight to the specific record (not just the general screen), that's the one piece that would need a server change on both platforms — adding an `entityId`/`link` field to the notification payload — worth raising with backend once/if both clients want it, rather than solving it twice independently.

### Not investigated (would need eyes on the actual mobile source)

- Whether mobile has an equivalent of the `UserMenu.jsx` profile-fetch-on-every-mount pattern at all.
- What mobile's actual session/token storage mechanism is.
- Whether mobile already has some notification-tap behavior that just needs the route map, or none at all.

If someone can point to the mobile repo (or paste the relevant screens/session code), a follow-up pass can go from "here's the shape of the bug" to an actual reviewed fix.

---

## BB-054 / BB-051 — Per-shift leave selection, weekend-exclusion checkbox, punch-conflict auto-revert toggle

**Status:** Client-side implementation applied — blocked on the paired server-side migration (written, not yet run) before live end-to-end testing is possible. Not yet confirmed closed.

**Pages:** Employee leave request form (`/dashboard/employee/leave-logs`), Company Leave Settings (`/dashboard/company/leave-settings`), Cutoff Period Review (`/dashboard/company/cutoff-periods/[id]/review`).

**Files:**
- `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx`
- `components/Dashboard/DashboardContent/CompanyPanel/Settings/LeaveSettings.jsx`
- `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx`

**Ask:** BB-054 asked for two refinements to leave requests — let an employee pick which shift(s) on a multi-shift day a leave actually applies to, and let a "no scheduled shift" weekend day be excluded from the deduction via a checkbox. BB-051 asked for a company-level setting controlling whether a punch-vs-leave conflict resolves automatically or waits for manual admin review. Three product questions were confirmed with Carlo before building: (1) an unchecked shift is a completely normal, unmarked work shift, but its hours must actually stop counting toward the leave; (2) BB-051 stays a narrow on/off toggle — today's revert mechanics (whole-leave cancellation, flat default-shift-length refund, no ledger entry) are not redesigned as part of this; (3) the weekend checkbox only affects days with no scheduled shift — a weekend day with a real shift is always deductible regardless.

**Investigation findings:** `affectedShiftIds` (sent on every leave submission today) was confirmed **write-only** — captured server-side but never read back by approval/deduction logic (`docs/OLD_LEAVE_MODULE.md:190`, `docs/UPDATED_LEAVE_MODULE.md:262`). Deduction was computed entirely server-side by a whole-day walk with no concept of shift selection or a weekend-exclusion flag, meaning all three pieces of this ticket needed companion `bizbuddy-v2-server` changes, not just client UI. Separately, what BB-051 describes is exactly Phase 6 ("Cancel Leave") of the leave-module redo, which `docs/UPDATED_LEAVE_MODULE.md §15.2` records as **deliberately paused pending real-world usage signal** — flagged to Carlo before building, who confirmed proceeding with the toggle only (not reopening the paused revert-mechanics redesign).

**Fix:**
- **`LeaveLogs.jsx`** — new `shiftSelection` state (`{userShiftId: boolean}`, defaults to selected, reconciled against each `affected-schedules` fetch) and `includeWeekends` state (default `true`). The "Affected schedules" preview panel now shows a checkbox per shift on any date with 2+ real shifts (reusing the shadcn `Checkbox` pattern already used in `EmployeesLeaveRequests.jsx`), plus a page-level "Include weekends" checkbox above it. New `excludedShiftIds` derivation is sent as its own submit-payload field — kept separate from the unchanged `affectedShiftIds` so deselecting every shift on a day still sends a non-empty signal instead of vanishing under the existing "omit array if empty" convention (`docs/changelog-v2.14.11.md`). `totalAffectedHours` now subtracts deselected-shift hours; weekend-excluded fallback rows already arrive pre-zeroed from the server (`scheduledHours: 0` + `excludedByWeekend: true`) once `includeWeekends` is threaded into the `GET /api/leaves/affected-schedules` query string. Excluded rows (either reason) render grayed/struck-through in the preview only.
- **`LeaveSettings.jsx`** — new `LeaveConflictCard`, following the existing `LeaveAccrualCard`/`LeaveApprovalCard` pattern, adding a single `leaveConflictAutoRevert` boolean to the same `draft` object already round-tripped through `GET`/`PATCH /api/company-settings`. Default off (today's fully-manual behavior, unchanged). Copy states explicitly that only the trigger (admin click vs. automatic) changes, not the refund/cancellation mechanics.
- **`CutoffReview.jsx`** — reads `leaveConflictAutoRevert` off the `GET /api/company-settings` call already made in `fetchData()` and surfaces it as a passive, read-only "Auto-revert: ON" badge in the page header. No changes to the existing Honor Punch/Honor Leave buttons or conflict logic — confirmed with the server team that an auto-resolved conflict comes back already resolved (`status: "approved"`, leave `status: "cancelled"`) and never surfaces as a pending `hasLeaveConflict: true` row, so no gating was needed.

**Server-repo impact:** Confirmed implemented in `bizbuddy-v2-server`, matching this plan — `POST /api/leaves/submit` now persists and actually consumes `excludedShiftIds` and `includeWeekends`; `GET /api/leaves/affected-schedules` honors `includeWeekends` and returns `excludedByWeekend`/zeroed `scheduledHours` for excluded fallback rows; `leaveConflictAutoRevert` is live on `GET`/`PATCH /api/company-settings`; and `hasLeaveConflict` is now shift-aware (a punch on an explicitly-excluded shift no longer flags as a conflict — expect fewer conflict rows in mixed-shift-day QA, not a bug). **Schema changes are written but the migration has not been run yet**, so live API testing isn't possible until that lands.

**Explicitly out of scope (deferred):**
- Redesigning the punch-vs-leave revert mechanics themselves (whole-leave cancellation, flat refund, no ledger entry) — stays exactly as-is; BB-051 is the trigger toggle only.
- Any gating/conditional UI in `CutoffReview.jsx` beyond the read-only badge — not needed given the confirmed conflict-visibility contract above.

### Files Changed

| File | Changes |
|---|---|
| `components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs.jsx` | Added `shiftSelection`/`includeWeekends` state, per-shift checkboxes and a weekend checkbox in the "Affected schedules" panel, `excludedShiftIds` derivation, updated `totalAffectedHours`, submit payload gains `excludedShiftIds`/`includeWeekends`. |
| `components/Dashboard/DashboardContent/CompanyPanel/Settings/LeaveSettings.jsx` | New `LeaveConflictCard` wiring `leaveConflictAutoRevert` into the existing company-settings draft round trip. |
| `components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview.jsx` | Reads `leaveConflictAutoRevert` from the existing settings fetch; adds a read-only "Auto-revert: ON" badge to the page header. |
