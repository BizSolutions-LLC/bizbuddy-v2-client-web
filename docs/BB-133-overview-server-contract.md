# BB-133 — Overview page: server contract (draft for review)

**Status:** answered — server built 2026-11-18 (server hand-off "BB-133 Overview page: corrected
numbers", next server push). Client follow-up built the same day: new fields read first, old names as
fallbacks; supervisors get "My team | Me" tabs.

**Answers (server):** 1 leave + `Holiday` table excluded from absent · 2 `gracePeriodMinutes` (late) and
`earlyClockOutGraceMinutes` (early) · 3 both: approved OT main, beyond schedule separate · 4 per day
worked only · 5 OT cost dropped · 6 superadmin in UTC · 7 supervisors: team view on `/admin-dashboard`
(`data.scope = "team"`), personal view stays on `/employee`. §0 fixed: super-dashboard is superadmin-only.
Deviations from §3: `usualClockIn/Out` are `"HH:mm"` with `…Label` text fields; `series.daily[].status`
adds `holiday` and `scheduled` (today, shift not over); `dateRange.periodEnd` added; superadmin
`serverUptime` / `avgResponseTime` are `null`.

The rest of this file is the original draft, kept for reference.
**Client:** `components/Dashboard/DashboardContent/EmployeePanel/Overview/` (`/dashboard/employee/overview`).
**Server today:** `src/controllers/Features/employeeAnalyticsController.js`,
`adminAnalyticsController.js`, `superAdminAnalyticsController.js`, routes in
`src/routes/Features/analyticsRoutes.js`.

---

## 0. Security — fix first, independent of BB-133

`GET /api/analytics/super-dashboard` is authorized for `admin, supervisor, superadmin`
(`analyticsRoutes.js`). It returns **platform-wide** data: MRR, revenue by plan, every company's
name, hours and active users. Any company admin or supervisor can call it directly.

**Ask:** restrict to `superadmin` only (`authorizeRoles("superadmin")`). The client only calls it for
superadmins already. Same check for `/api/analytics/super` (already superadmin-only, fine).

---

## 1. What's wrong today (all three endpoints)

| # | Problem | Where | Effect on screen |
|---|---|---|---|
| 1 | Days are bucketed in **UTC** (`toISOString().slice(0,10)`), not the company time zone | all three | Evening punches land on the next day; daily charts and per-day counts are off |
| 2 | "Usual clock-in/out" uses `getUTCHours()` | employee | Shows e.g. 12:50 AM for a 4:50 PM (PT) clock-in |
| 3 | Absent = scheduled day with no hours on the **same UTC date**; future scheduled days in the range count | employee | Absences too high (13 by Nov 18 in the BB-133 screenshot) |
| 4 | Late compares the first punch with `shift.startTime` stored on **1970-01-01** (+15 min) | employee | Nearly every worked day counts as late |
| 5 | Late = any second after start, early leave = any second before end, no grace | admin | Late / early rates high, reliability low |
| 6 | "Overtime" = actual − scheduled hours per day, not approved OT | employee, admin | Doesn't match the OT the company approves or pays |
| 7 | `overtimeDays` is not returned | employee | Client always showed 0 |
| 8 | Averages per week / month = per-day × 7 / × 30 | employee | 370.9 h "per month" — a projection shown as a figure (client now hides it) |
| 9 | OT cost = hours × 1.5 × **$15** hard-coded | admin | Made-up money (client now hides it) |
| 10 | `serverUptime` hard-coded 99.9 / 99.95 | superadmin | Fake (client now hides it) |
| 11 | Overnight shifts: `diffH(startTime, endTime)` goes negative | employee, admin | Scheduled hours wrong for night shifts |

---

## 2. Rules the corrected endpoints should use

- **Company time zone** (`Company.timeZone`) for every day boundary, time of day and label.
- **Day of a punch** = company-zone date of `timeIn` (same rule as the cutoff / task-report pages).
- **Range end** is clamped to **today** (company zone). Future days never count as absent.
- **Absent** = a past scheduled day (UserShift) with no punch, **excluding** approved leave days and
  company holidays (if holidays exist). → *Q1*
- **Late** = first clock-in of the day after the shift's start **on that day** + the company grace
  period (`gracePeriod` from company settings). → *Q2*
- **Early leave** = last clock-out before the shift's end on that day − grace. Same grace? → *Q2*
- **Overtime** = approved OT hours (the same number Punch Logs / cutoff use), plus a separate
  "hours beyond schedule" if we still want it. → *Q3*
- **Overtime days** = days with approved OT > 0.
- **Averages** = actual per-day average over days worked; drop ×7 / ×30, or return real
  per-ISO-week totals. → *Q4*
- Overnight shifts: end ≤ start means end is the next day.

---

## 3. Proposed response shapes

Same URLs and query (`period=this_month|last_month|last_7_days|last_14_days|last_28_days|custom`,
`startDate`, `endDate` for custom). Add fields; keep old ones until the client switches, then remove.
Every response adds `timeZone` and `dateRange: { start, end, label, period }` (company-zone dates).

### 3.1 `GET /api/analytics/employee`
```json
{
  "timeZone": "America/Los_Angeles",
  "profile": { "username": "", "firstName": "", "lastName": "", "department": "" },
  "totals": {
    "hoursWorked": 111.28,
    "daysWorked": 9,
    "scheduledDays": 12,
    "absences": 2,
    "lateIns": 3,
    "earlyOuts": 1,
    "approvedOvertime": 6.5,
    "overtimeDays": 2,
    "hoursBeyondSchedule": 8.25,
    "leaveDays": 1
  },
  "patterns": { "usualClockIn": "08:52", "usualClockOut": "17:10" },
  "averages": { "hoursPerDayWorked": 12.4, "overtimePerDayWorked": 0.7 },
  "series": {
    "daily": [
      { "date": "2026-11-03", "hours": 8.5, "overtime": 0.5, "scheduledHours": 8,
        "status": "on_time|late|absent|leave|unscheduled", "firstIn": "08:55", "lastOut": "17:30" }
    ]
  }
}
```
`usualClockIn/Out` as `"HH:mm"` 24-hour in the company zone (client formats).
`series.daily` includes **absent and leave days** (hours 0) so the client can draw an attendance strip.

### 3.2 `GET /api/analytics/admin-dashboard`
Keep `summary`, `charts.*` names; correct the numbers per §2 and add:
```json
{
  "summary": {
    "approvedOvertimeHours": 42.0,
    "hoursBeyondSchedule": 61.5,
    "absences": 7,
    "scheduledShifts": 180
  },
  "charts": {
    "attendanceDaily": [ { "date": "2026-11-03", "onTime": 20, "late": 3, "earlyOut": 1, "absent": 2 } ],
    "overtimeTrend": [ { "period": "2026-11-03", "approvedHours": 4, "beyondScheduleHours": 6 } ]
  }
}
```
Remove `overtimeTrend[].cost` (or base it on real pay rates). → *Q5*

### 3.3 `GET /api/analytics/super-dashboard`
Superadmin-only (§0). Correct day buckets per §2 (platform view may use UTC — *Q6*).
Remove `serverUptime`, or source it from real monitoring (System Admin → Server already has health
data). Optional: `summary.mrrPrevious` for a real period-over-period change.

---

## 4. Questions (clarification needed)

1. **Absent:** should approved leave and holidays be excluded? Does the company have a holiday
   calendar the server can read?
2. **Grace:** use the company `gracePeriod` for late (and early leave)? Per-schedule grace is a
   separate future ticket (see BB-121 notes).
3. **Overtime on Overview:** show **approved OT** (matches payroll) or **hours beyond schedule**
   (today's number), or both?
4. **Averages:** keep only "per day worked", or add real calendar-week totals?
5. **OT cost:** drop it, or compute from real pay rates (needs payroll data; admins only)?
6. **Superadmin time zone:** companies are in different zones — bucket platform charts in UTC, or
   per company zone?
7. **Supervisors:** today they get the personal (employee) view. Should they get a team view
   (their department + direct reports) instead?

---

## 5. Client follow-up once the server ships

- Read the new fields (fall back to old names while both exist).
- Employee: attendance strip from `series.daily[].status`; stacked regular / OT bars; clock-in trend.
- Admin: daily attendance stacked bars; approved OT vs beyond-schedule.
- Remove the "not approved overtime" caveats the restyle added.
