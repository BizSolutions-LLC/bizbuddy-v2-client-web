# Server request — BB-108 Import Punch Logs: pre-filled template

**From:** client (bizbuddy-v2-client-web)
**For:** bizbuddy-v2-server
**Status:** Confirmed by the server (31 days; 2,000 template rows, 2,000 file rows, 500 rows with punches; active employees only in the template, uploads still accept inactive employees typed in by hand). Client updated to match.

## Why

Import Punch Logs (BB-077) hands out a **blank** template: `date, clockIn, clockOut, employeeId, email, punchType, reason, notes` plus one example row. For every row the admin has to look up and type the employee's ID or email and the date by hand. That's the slow, error-prone part.

BB-103 already fixed the same problem for Upload Schedule: the admin picks employees and a date range, and the template comes **pre-filled**, one row per employee per date. BB-108 applies that to punch logs:

1. **Date range:** From + To, **up to 31 days** inclusive (a full cutoff period fits).
2. **Target employees:** all in scope, one department, or specific people. The same three choices as Upload Schedule.
3. **Pre-filled template:** each row already has the employee and the date. The admin **only types clockIn and clockOut** (and optionally punchType / reason / notes).
4. **Blank rows are days off:** a row with no clockIn and no clockOut is skipped, not failed.

Matching, validation, cutoff locks, overnight roll-over and the 207 results all stay exactly as they are today.

---

## 1. `GET /api/punch-log-import/template` (changed)

| Param | Type | Notes |
|---|---|---|
| `startDate` | `YYYY-MM-DD` | Required for the pre-filled template. |
| `endDate` | `YYYY-MM-DD` | Required with `startDate`. At most **31 days** including both ends; 400 otherwise. |
| `userIds` | comma-separated | Target employees. |
| `departmentId` | id | Alternative to `userIds`. If neither is given: all employees in scope. |

- **Scope:** reuse `resolveTargetEmployees` from `scheduleImportService.js` (or the same rules). Supervisors get only their own department, and a `departmentId` / `userIds` outside it returns 403. **Active, human employees only** (`HUMAN_ONLY`, so no B. Buddy accounts).
- **Rows:** one per employee × date, sorted by name, then date. **No example row**: every row is a real employee, and a pre-filled example would get imported.
- **Columns, in this order:**

  | Column | Pre-filled | Notes |
  |---|---|---|
  | `name` | yes | "Last, First". For reading only; **never used for matching** (unknown columns are already ignored by the parser). |
  | `email` | yes | The matching key. Same as Upload Schedule's templates. |
  | `date` | yes | `YYYY-MM-DD`. |
  | `clockIn` | blank | The admin fills this. |
  | `clockOut` | blank | The admin fills this. |
  | `punchType` | blank | Optional, same as today. |
  | `reason` | blank | Optional. |
  | `notes` | blank | Optional. |

- **Filename:** `punch_logs_<startDate>_to_<endDate>.csv` in `Content-Disposition`. The client sets the same name on download.
- **Backward compatibility:** with **no** `startDate` / `endDate`, keep returning today's blank template exactly as it is. Old files and any bookmarked flow keep working.

## 2. `POST /api/punch-log-import/upload` (changed)

Multipart: `file` only, unchanged.

- **Blank rows:** a row where **both** `clockIn` and `clockOut` are empty (after trim) means "no punch that day". **Skip it silently and count it.** No error.
  - Today these fail with "Invalid date, clockIn, or clockOut.", which a pre-filled template would make constant.
  - Exactly one of the two empty stays a row error, with a clearer message: "Missing clock-out." / "Missing clock-in."
- **Row limit:** `MAX_ROWS = 300` is too low for a pre-filled file. 25 employees × 31 days = 775 rows, mostly blank.
  - Suggestion: apply the 300 limit to **non-blank** rows only, and cap the file at something like 2,000 rows in total. Your call; tell us the numbers so the client copy matches.
- **Matching:** unchanged. `email` first, `employeeId` still accepted for older files. The `name` column is ignored.
- **Overnight:** unchanged. A bare clockOut earlier than clockIn already rolls to the next day.

**Response:** today's 207 shape, plus two small additions:

```json
{
  "message": "Import complete. 42 imported, 1 failed, 360 blank rows skipped.",
  "data": {
    "created": [{ "row": 3, "employeeId": "jane@acme.com", "name": "Doe, Jane", "date": "...", "clockIn": "...", "clockOut": "...", "timeLogId": "...", "requestedTimeLogId": "..." }],
    "failed":  [{ "row": 9, "employeeId": "john@acme.com", "name": "Smith, John", "date": "2026-10-03", "clockIn": "08:00", "clockOut": "", "reason": "Missing clock-out." }],
    "skipped": 360
  }
}
```

- `data.skipped` (number): blank rows skipped.
- `name` on each `created` / `failed` item when the employee was matched (null otherwise). The results table shows names instead of emails.

---

## Client side (for reference)

`ImportPunchLogs.jsx` gets a setup section like Upload Schedule:
- From / To date (31-day cap, checked client-side too).
- Target employees: all, one department (admins only) or specific people.
- **Download template** sends `startDate`, `endDate` and `userIds` / `departmentId`.

Upload is unchanged. The results show `skipped` as "N blank rows skipped" and use `name` when present, falling back to the identifier. Until this ships, the client's download would get today's blank template (extra params are ignored) and blank rows would fail, so **deploy the server first**.

## Questions for the server

1. OK with 31 days as the cap?
2. The row limits you settle on (non-blank and total).
3. Any reason to keep inactive employees out of the template? Back-filling punches for someone who has since been deactivated could be a real case. The client follows whatever you decide; today it offers active employees only, matching Upload Schedule.

---

# Follow-up (BB-108): a guide row in every downloaded template

**Status:** Done on the server, as requested; ships together. Server notes: `#` rows don't count towards the limits; guide-only files return 400 "CSV file has no data rows."; result rows are file line numbers (header = 1); the old blank template's example row became a guide row; clock times accept `08:00`, `8:00`, `08:00:00`, `8:00 AM`, `8:00:00 AM`, `8 AM`, `8:00AM` in the company's time zone (bad ones fail with "Invalid clock-in time … Use 08:00 or 8:00 AM."). Supervisor scope now matches `/employee/team` (own department or direct reports). Client copy, the team-based employee picker (active only) and inline template errors updated to match.

## Why

The pre-filled templates hold names, emails and dates, and every other column is blank. Nothing in the file says what goes in those columns. Once the file is open in Excel, the admin has no reference, and a wrong value only shows up as a failed row after the upload.

The clearest gap is `punchType`. BNC accepts `REGULAR` or `TRAINING` only; DayCare (PadPro) also has `DRIVER_AIDE`, `DRIVER_AIDE_AM` and `DRIVER_AIDE_PM`. The dialog explained this for BNC only, and the file explains it for no one.

## The rule (same for every template)

- The **first data row** (right under the header) is a **guide row**: it shows the format and the allowed values for each column.
- Its **first cell starts with `#`**: `# GUIDE - not imported`.
- On upload, **any row whose first cell starts with `#` is ignored**. It's not imported, not failed and not counted as blank or skipped. Matching on the marker (not on "row 1") keeps it working when the admin sorts the sheet.
- Row numbers in results stay the real line numbers in the file.

## 1. Import Punch Logs: `GET /api/punch-log-import/template` and `POST /upload`

Guide row, by company type (the same `BNC_COMPANY_IDS` check the upload already uses):

| Column | Guide cell |
|---|---|
| `name` | `# GUIDE - not imported` |
| `email` | *(blank)* |
| `date` | `YYYY-MM-DD` |
| `clockIn` | `08:00` |
| `clockOut` | `17:00` |
| `punchType` | BNC: `REGULAR or TRAINING (blank = REGULAR)` · DayCare: `REGULAR | DRIVER_AIDE | DRIVER_AIDE_AM | DRIVER_AIDE_PM | TRAINING (blank = REGULAR)` |
| `reason` | `optional` |
| `notes` | `optional` |

- Applies to the pre-filled template. The old blank template (no params) can get the same row in place of its example row, which today would be imported if left in.
- **Please confirm the time formats** `clockIn` / `clockOut` accept. `parseClockTime` uses `moment.tz(str, tz)` without a format, so `08:00` works; if `8:00 AM` is also reliable, the guide can say `08:00 or 8:00 AM`.
- Upload: skip `#` rows before the blank-row filter and before both row caps.

## 2. Upload Schedule (BB-103): `GET /api/schedule-import/template` and `POST /preview`

Guide row: `email` = `# GUIDE - not imported`, `name` = `Mark x (or 1 / yes) under each slot to schedule`, `date` = `YYYY-MM-DD`, and one example `x` in the first mark column (shift or time block), the rest blank. Your call on the exact wording.

Preview (and confirm): skip `#` rows; they never become preview items.

## 3. Employees bulk import (client only, for reference)

This template is built on the client and parsed on the client before `POST /api/employee/bulk`, so the client already does it: the two example people (John Doe / Jane Smith, which were imported if left in) became one guide row, and rows whose `firstName` starts with `#` are dropped before sending. No server change.
