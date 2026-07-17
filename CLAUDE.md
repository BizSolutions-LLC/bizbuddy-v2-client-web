# Working Agreement — BizBuddy v2 Client (Web)

These are standing collaboration rules for this repo. Follow them on every task, regardless of how the request is phrased.

## Cross-repo context

This client repo has a companion server repo (separate repository, not merged) at
`github.com/biz-admin-carlo/bizbuddy-v2-server` that it communicates with via a shared
API/contract (hand-written fetch/axios calls reading `NEXT_PUBLIC_API_URL` — no generated
client). Whenever a task touches something the server owns — endpoints, payloads, auth
behavior, response shapes — flag that explicitly so the user knows the server repo also
needs changes.

## Ticket tracking

There is no external ticket tracker (no GitHub Issues, Linear, Jira). A "ticket number" is
just a label the user attaches verbally for their own reference — do not attempt to look it
up anywhere.

## The four workflow types

Classify every task into one of these before starting, and follow its steps.

### 1. Fix a ticket
1. Ask for the concern and a ticket number if not already given.
2. Investigate and discuss the affected files/modules first. Do **not** edit anything yet.
3. Report what's damaged/included, a rough effort/impact estimate, and flag any server-side impact.
4. Wait for explicit go-ahead before making any changes.
5. After changes, summarize exactly what was changed and why — file by file if more than trivial.
6. Do **not** run the app, run tests, or verify the fix. The user does manual, functional, and non-functional testing themselves.
7. If the user reports something failed, return to step 2 with their findings. Only treat the ticket as complete once the user confirms.

### 2. Create or redo a module
Same gate as above (discuss → estimate → wait for go-ahead → change → summarize), but before
estimating, explicitly consider the overall concept on **both** client and server sides — this
usually has a bigger footprint than a single fix. Call out any cross-repo contract changes
clearly in the estimate.

### 3. Script writing (database)
**Does not apply to this repo** — this client has no database access (no Prisma, no DB driver,
no direct queries anywhere in the codebase). If a task seems to need a database script, that
work belongs in the server repo — flag it and redirect rather than attempting it here.

### 4. Test script creation
- Only manual/visual testing exists today — no automated functional or non-functional testing,
  and no test framework is installed (`package.json` has no `test` script or test dependency).
- When asked for tests on a piece of code, don't assume the type — propose which kinds make
  sense (unit, integration, e2e, visual/snapshot) and briefly say why, then let the user choose.
- Write the test scripts/files only. Do not execute them against anything, including local runs,
  unless explicitly told to.
- The user runs them and brings back results for interpretation/fixes.

## General rules across everything

- Never read or display contents of `.env` files, secrets, credentials, or key files.
- Never expose the value of any non-`NEXT_PUBLIC_*` environment variable, and treat any future
  non-`NEXT_PUBLIC_*` var as a real secret requiring the same care as the server repo's `.env`.
  As of 2026-07-15, everything in this repo's `.env` is `NEXT_PUBLIC_*` (intentionally
  client-exposed) — re-verify this whenever new env vars are introduced, don't assume it still
  holds.
- `jsonwebtoken`, `bcryptjs`, `nodemailer`, and the `stripe` server SDK are listed in
  `package.json` but confirmed **unused** anywhere in this repo's source (verified 2026-07-15
  via full-tree import search) — no need to re-investigate this in a future session. If any of
  these ever get wired into real code, flag it explicitly and immediately: that would introduce
  real secrets that don't currently exist here and need proper handling.
- Never force-push or run destructive git commands (`git reset --hard`, `git clean -f`,
  `rm -rf`, etc.) without explicit approval each time.
- **`git push` caution**: this repo's deploy setup is unconfirmed — a webhook-based
  auto-deploy (Vercel/Render/etc.) could be wired up outside the repo with no trace in-repo.
  Until the user confirms otherwise, treat every `git push` as potentially triggering a live
  production deploy. Gated the same way as the server repo's DB-destructive commands: hard
  denied in permissions, zero exceptions, not even prompted. The user pushes commits
  themselves. Revisit this rule once deploy status is confirmed.
- Don't run or verify code on your own initiative — always stop after making changes and give
  a summary, then wait.
- When in doubt about scope or intent, ask — don't assume the safer-sounding interpretation and
  proceed.
- Before running any Bash command that will trigger a permission prompt (`git commit`, or
  anything else gated by plan mode), first explain in plain language, as a separate message,
  before the approval prompt appears: what the command does, why you're running it now, and
  anything notable about it. The user should never have to parse a raw shell command to figure
  out what they're approving.

## Design system reference

- This repo uses Tailwind CSS + shadcn/ui as the design system. `tailwind.config.js` and
  `components.json` are the source of truth for colors, spacing, and component primitives —
  don't invent new color values, spacing scales, or one-off components without checking these
  first.
- Before building any new UI element, check `components/ui/` (26 shadcn primitives already
  exist — button, card, dialog, dropdown-menu, table, select, sidebar, sonner, etc.). Reuse or
  extend an existing primitive rather than hand-rolling a new one.
- All styling should use Tailwind utility classes and the existing CSS-variable color tokens
  (`background`, `foreground`, `primary`, `card`, `border`, `ring`, `chart-1..5`, etc.) — not
  inline `style={{...}}` with hardcoded values, except where the value is genuinely
  dynamic/computed at runtime.
- If any file you're working in has styling that doesn't follow this system (hardcoded values,
  inline styles that aren't computed at runtime), flag it and ask whether cleanup is in scope —
  don't silently rewrite it as part of an unrelated change.
- Dead dependencies, confirmed unused in source (added to the existing "confirmed dead" list
  in General rules): `@emotion/react`, `@emotion/styled`, `@mui/material`,
  `@mui/icons-material`, `@heroui/*`.

### Reusable UI patterns

- **Stat-card summary row** (4-metric `Card` grid at the top of a page): follow
  `Schedules.jsx` (`components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/Schedules.jsx`,
  ~lines 488–530) — `Card`/`CardHeader`/`CardContent` with Tailwind text-color utilities
  (`text-orange-600`, `text-green-600`, etc.), no inline hex.
- **Detail/context panel pattern** (persistent left region + right-side panel that opens on
  selection, dismisses explicitly): both `PunchLogs.jsx`'s table + "Log Details" panel (lines
  1387+) and `SchedulesCalendarView.jsx`'s day panel implement this correctly and are good
  references — select an item on the left, inspect/act in a panel on the right, explicit
  dismiss control.
- Inline `style={{...}}` is acceptable only for genuinely computed runtime values
  (positioning, dynamic height/width, computed coordinates) — see
  `SchedulesCalendarView.jsx` for correct usage.

### Known drift (flagged, not to be imitated)

- `overtime/page.jsx` (`app/dashboard/employee/(C_TimeKeeping)/overtime/page.jsx`) — 69
  `style={{...}}` instances, the large majority static values (font sizes, padding, colors)
  that duplicate what Tailwind utility classes already provide, not computed/dynamic values.
  Don't use this file as a pattern to copy.
- `PunchLogs.jsx` (`components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs.jsx`),
  specifically its stat-card row (~lines 1112–1141) and `OTBanner` sub-component (~lines
  2172–2235) — 15+ hardcoded hex colors bypassing the token system. The file's table and
  detail-panel sections (lines 1387+) are clean and fine to reference; only these two specific
  parts are drift. Do not use this file's stat cards or `OTBanner` as a pattern to copy, even
  though the rest of the file is fine.
- If a ticket touches any of these files, flag the drift and ask whether cleanup is in scope,
  rather than expanding the change unprompted.

## Permission enforcement (`.claude/settings.json`)

The rules above are backed by actual tool permissions, not just instructions:
- `defaultMode: "plan"` — nothing runs without conscious approval each time.
- Hard `deny` (zero exceptions, not even prompted): `git push` in all forms (any branch, any
  remote, `--force` or not) — pending confirmation of this repo's deploy setup.
- `npm run dev`, `npm run build`, `npm run lint` are intentionally **not** hard-denied — only
  gated by `defaultMode: plan` — so the user can still explicitly ask for them. Never run these
  on your own initiative.
