# Server request — BB-098 Leave Reports

**From:** client (bizbuddy-v2-client-web)
**For:** bizbuddy-v2-server
**Status:** Draft. Please review and confirm the shape, or push back, before the client starts.

## Why

Admins need leave reports from **Company Settings → Leave Settings** (`/dashboard/company/leave-settings`), the same way Employees Punch Logs has **Generate Report**. The reports should cover:
- balances
- what was granted, used, adjusted and expired, grouped by **month, quarter or year**
- the fiscal-year credits (lots) and their **expiration**
- leave requests

The client builds the files (CSV / PDF / XLSX) itself, as Punch Logs does. So the server only needs to return **JSON**: one endpoint, five report types, the same filters for all of them.

The data already exists: `LeaveTransaction`, `LeaveCredit`, `LeaveCreditUsage`, `LeaveBalance`, `Leave` and `LeavePolicy`. No schema changes are expected.

---

## Endpoint

```
GET /api/reports/leave
```

Mounted next to the existing `/api/reports` (yearly total hours) routes.

**Auth:** same as `GET /leave-balances/matrix`: admin and superadmin see the whole company. Supervisors are limited to their department(s), if that's how the matrix already behaves; please confirm. Always scoped to the caller's company.

### Query parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `type` | `summary` \| `activity` \| `expiration` \| `requests` \| `ledger` | — (required) | See below. |
| `from` | `YYYY-MM-DD` | — | Start of range (company timezone, inclusive). Required for every type except `summary` and `expiration`. |
| `to` | `YYYY-MM-DD` | today | End of range (inclusive). For `summary` this is the **as-of** date. |
| `groupBy` | `month` \| `quarter` \| `year` | `month` | `activity` only. |
| `basis` | `calendar` \| `fiscal` | `fiscal` | How `quarter` / `year` periods are cut. `fiscal` uses the company's `leaveYearStartMonth/Day`. With a Jan 1 start, both are the same. |
| `policyIds` | comma-separated ids | all | Leave types. Includes archived types, which keep their history. |
| `departmentId` | id | all | |
| `userIds` | comma-separated ids | all | |
| `includeInactive` | boolean | `false` | Include inactive / archived employees. |
| `status` | comma-separated | `approved` | `requests` only: `pending`, `approved`, `rejected`, `cancelled`. |
| `includeLifecycle` | boolean | `false` | `ledger` only: also include the submitted / approved / rejected / … entries, which carry no hours. |
| `expiringWithinDays` | integer | `leaveExpiryReminderDays`, or 60 if that's 0 | `expiration` only: how far ahead counts as "expiring soon". |

All hours are numbers, rounded to 2 decimals. All dates are `YYYY-MM-DD` in the company timezone, unless named `...At`, which is ISO UTC.

### Common response envelope

```json
{
  "data": {
    "type": "activity",
    "generatedAt": "2026-10-21T08:00:00.000Z",
    "company": { "id": "...", "name": "PadPro", "timezone": "America/Los_Angeles" },
    "filters": { "...echo of the resolved filters, incl. defaults..." },
    "settings": {
      "leaveCreditsInitializedAt": "2026-…" ,
      "leaveGrantEnabled": true,
      "leaveExpirationEnabled": true,
      "leaveGrantHours": 40,
      "leaveYearStartMonth": 1, "leaveYearStartDay": 1,
      "leaveCreditLifetimeYears": 2,
      "leaveExpiryReminderDays": 60
    },
    "policies": [{ "id": "...", "leaveType": "Sick Leave", "isArchived": false }],
    "rows": [ "...type-specific, below..." ],
    "totals": { "...type-specific, below..." }
  }
}
```

`settings` lets the client print the setup on the report header and explain empty fiscal-year columns. Before setup there are no lots, and `leaveCreditsInitializedAt` is `null`.

**Employee object** (used in every row as `employee`):
```json
{ "userId": "...", "employeeId": "E-102", "name": "Capulong, Lennie", "email": "...",
  "department": "Admin", "status": "active", "hireDate": "2023-03-01" }
```
`employeeId` is the company's own employee ID, the same field the punch log reports use.

---

## 1. `type=summary` — balances as of a date

One row per **employee × leave type**, as of `to`.

```json
{
  "employee": { "...": "..." },
  "policyId": "...", "leaveType": "Sick Leave",
  "grantedHours":  92.5,
  "usedHours":     72,
  "adjustedHours": 0,
  "expiredHours":  0,
  "availableHours": 20.5,
  "creditLots": [
    { "fiscalYear": 2026, "label": "FY2026", "grantedHours": 40, "remainingHours": 20.5, "expiresOn": "2027-12-31", "expiredAt": null }
  ],
  "nextExpiration": { "date": "2026-12-31", "hours": 0 }
}
```
- The totals are cumulative up to and including `to`, from `LeaveTransaction`, including entries made before setup. `availableHours` is the balance after the last balance-changing entry on or before `to`. When `to` is today, it equals `LeaveBalance.balanceHours`.
- `creditLots`: oldest first. Include fully used lots at 0, and **expired lots with `expiredAt` set**. Unlike the matrix, the report should show expired years. Send `[]` before setup.
- `nextExpiration`: only while expiration is on, otherwise `null`.
- `totals`: `{ grantedHours, usedHours, adjustedHours, expiredHours, availableHours }` across all rows.

## 2. `type=activity` — granted / used / expired per period

One row per **employee × leave type × period**, for every period in `from`–`to`, including periods with no activity, so the columns line up.

```json
{
  "employee": { "...": "..." },
  "policyId": "...", "leaveType": "Sick Leave",
  "period": { "key": "2026-Q3", "label": "Q3 2026", "start": "2026-07-01", "end": "2026-09-30" },
  "openingHours":  40,
  "grantedHours":  0,
  "usedHours":     16,
  "unpaidHours":   4,
  "adjustedHours": 0,
  "expiredHours":  0,
  "closingHours":  24
}
```
- `grantedHours` = `accrual` entries.
- `usedHours` = `deduction` entries, net of any restored when a leave is cancelled. Show positive numbers.
- `adjustedHours` = `adjustment` entries. Signed.
- `expiredHours` = `expired` entries. Show positive numbers.
- `unpaidHours` = `Leave.actualUnpaidHours` of approved leaves in the period. It doesn't move the balance, but payroll needs it.
- `openingHours` = balance at the start of the period. `closingHours` = opening + granted − used + adjusted − expired.
- A leave that spans two periods: attribute it to the date of the ledger entry, or split it by leave day. Please say which; the client only displays what it receives.
- Period `key` formats: `2026-10` (month), `2026-Q3` (quarter), `FY2026` / `2026` (year, fiscal / calendar). With `basis=fiscal` and a start other than Jan 1, quarters are counted from the fiscal year start, and `label` should say so (e.g. "FQ1 FY2026").
- `totals`: per period, e.g. `{ "2026-Q3": { grantedHours, usedHours, unpaidHours, adjustedHours, expiredHours } }`, plus `all` for the whole range.

## 3. `type=expiration` — fiscal-year lots and expiry

One row per **lot** (`LeaveCredit`). Empty before setup.

```json
{
  "employee": { "...": "..." },
  "policyId": "...", "leaveType": "Sick Leave",
  "creditId": "...",
  "fiscalYear": 2025, "label": "FY2025",
  "grantedHours": 40, "usedHours": 37.75, "remainingHours": 2.25,
  "expiresOn": "2026-12-31",
  "state": "expiring_soon",
  "expiredAt": null, "expiredHours": 0,
  "reminderSentAt": "2026-11-01T…"
}
```
- `state`: `active` | `expiring_soon` (expires within `expiringWithinDays` of `to`) | `expired`.
- Which lots: `expiresOn` between `from` and `to` when given. With no range, every lot that's still active or expired within the last 12 months. Please suggest a better default if you have one.
- `usedHours` = `grantedHours − remainingHours − expiredHours`, or from `LeaveCreditUsage`, whichever is accurate.
- `totals`: `{ active: {count, remainingHours}, expiring_soon: {count, remainingHours}, expired: {count, expiredHours} }`.

## 4. `type=requests` — leave requests in a range

One row per **leave request** that overlaps `from`–`to` and has one of the `status` values.

```json
{
  "employee": { "...": "..." },
  "leaveId": "...", "policyId": "...", "leaveType": "Sick Leave",
  "startDate": "2026-10-06", "endDate": "2026-10-07",
  "status": "approved",
  "isPaid": true,
  "requestedHours": 16, "paidHours": 12, "unpaidHours": 4,
  "reason": "...",
  "submittedAt": "2026-10-01T…",
  "decidedAt": "2026-10-02T…", "decidedBy": "Reyes, Ana",
  "approver": "Reyes, Ana", "secondaryApprover": null,
  "creditsUsed": [{ "fiscalYear": 2025, "hours": 2.25 }, { "fiscalYear": 2026, "hours": 9.75 }]
}
```
- `paidHours` / `unpaidHours` = `actualPaidHours` / `actualUnpaidHours` once decided. Before that, `null`, and the client shows the requested intent.
- `creditsUsed` comes from `LeaveCreditUsage`. It shows which fiscal year's credits paid for the leave, so it's an audit trail for expiration. Send `[]` before setup.
- `totals`: `{ count, byStatus: { approved: n, … }, paidHours, unpaidHours }`.

## 5. `type=ledger` — raw history

Every `LeaveTransaction` in `from`–`to`, oldest first. This is the same data as `GET /leave-balances/transactions`, but for many employees at once.

```json
{
  "employee": { "...": "..." },
  "policyId": "...", "leaveType": "Sick Leave",
  "id": "...", "createdAt": "2026-10-02T…",
  "type": "deduction",
  "hours": -8, "balanceBefore": 28, "balanceAfter": 20,
  "leaveId": "...", "performedBy": "Reyes, Ana", "note": "..."
}
```
- Include the lifecycle entries (`submitted`, `approved`, …, where `hours` is `null`) only with `includeLifecycle=true`. The default is balance-changing entries only.

---

## Errors

| Status | When |
|---|---|
| 400 | Unknown `type` / `groupBy` / `basis`; `from` > `to`; a missing `from` where it's required; a range over **5 years** for `activity` / `ledger`, as a safety cap (please adjust if needed). |
| 403 | Not admin / superadmin / supervisor, or a department / user outside the caller's scope. |

`{ "message": "..." }`, the same format as the other endpoints.

## Questions for the server side

1. A leave spanning two periods in `activity`: is it attributed by ledger entry date or split by leave day?
2. Supervisor scope: the same as the matrix?
3. Is there anything here that's expensive to calculate? For example, the opening balance for each period over a long range. If so, propose a cap or a cached approach.
4. Is `usedHours` on a lot more accurate from `LeaveCreditUsage` or from the subtraction formula?
