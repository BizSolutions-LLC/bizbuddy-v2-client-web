# Server request — BB-103 Upload Schedule (rework of Upload Weekly Schedule)

**From:** client (bizbuddy-v2-client-web)
**For:** bizbuddy-v2-server
**Status:** Draft. Please review and confirm the shape, or push back, before the client starts.

## Why

Today's Upload Weekly Schedule works, but:
- it always covers 7 days
- the template is empty, so admins type every employee ID by hand
- the only way to mark a schedule is 46 half-hour blocks
- every import creates **new `Shift` records**, even when the same shift already exists

BB-103 reworks it into **Upload Schedule**:

1. **Date range:** Start date + End date, **up to 14 days** (inclusive).
2. **Target employees:** all, one department, or specific people. **The template comes pre-filled**: one row per employee per date, with employee ID and name.
3. **Two marking modes:**
   - **Time blocks (30-min):** today's 46 half-hour columns, mark `1`. Unchanged apart from points 1, 2 and 4.
   - **Existing shifts (new):** the admin picks a **pool** of the company's existing shifts. The template has **one column per chosen shift**. A `1` under a shift assigns that existing shift on that row's date. Several `1`s on one row mean several shifts that day (e.g. 10:00 AM–5:00 PM **and** 7:00 PM–5:00 AM). **No new `Shift` records** are created in this mode.
4. **Conflicts:** the review separates **clean** rows from **not clean** ones. Rows that clash with an **existing** assignment can be **Rejected** (skipped) or **Replaced** (the existing assignment is removed and the uploaded one is created).

**All of the logic stays on the server:** the template, parsing, employee and shift matching, overlap and conflict detection, and whether a Replace is allowed. The client only sends the admin's choices, shows the preview exactly as returned, and sends back one decision per row.

---

## 1. `GET /api/schedule-import/template` (changed)

| Param | Type | Notes |
|---|---|---|
| `mode` | `time_blocks` \| `shifts` | Required. |
| `startDate` | `YYYY-MM-DD` | Required. |
| `endDate` | `YYYY-MM-DD` | Required. At most **14 days** including both ends; 400 otherwise. |
| `overnight` | boolean | `time_blocks` only (same meaning as today). Ignored for `shifts`. |
| `userIds` | comma-separated | Target employees. |
| `departmentId` | id | Alternative to `userIds`. If neither is given: all employees in scope. |
| `shiftIds` | comma-separated | `shifts` only. Required, at least 1. Company shifts only. |

- **Scope:** same as today. Supervisors get only their own department, and a `departmentId` / `userIds` outside it returns 403. **Active employees only.**
- **Rows:** one per employee × date, sorted by name, then date. Columns: `employeeId`, `name` (for reading only; never used for matching), `date`.
  - An employee with no `employeeId` gets their `email` in that column, so matching still works.
- **`time_blocks` columns:** the same 46 block columns as today.
  - Drop the example row: the rows are now real employees, and a pre-filled example would get imported.
- **`shifts` columns:** one column per chosen shift, in the order of `shiftIds`. The header must map back to **exactly one** shift.
  - Suggested header: `Morning (10:00 AM–5:00 PM)`.
  - Shift names can repeat (past imports created duplicates). If two chosen shifts would get the same header, add something to tell them apart, e.g. `Morning (10:00 AM–5:00 PM) #2`.
  - Your call how to make headers resolvable. One option: the client sends the same `shiftIds` again on preview, and you match headers against that pool.
- **Backward compatibility:** keep accepting today's `weekStart` + `overnight`, treated as `mode=time_blocks`, `startDate=weekStart`, `endDate=weekStart+6`, until the new client ships.

## 2. `POST /api/schedule-import/preview` (changed)

Multipart: `file`, `mode`, `overnight` (time_blocks), `shiftIds` (shifts). Optionally `startDate` / `endDate` if you want to check that the file's dates fall inside them.

**Processing (all server-side):**
- **Blank rows** (no `1` anywhere) mean "no shift that day". **Skip them silently** and count them. No error. Today they're an error ("No time blocks marked"), which a pre-filled template would make constant.
- **Dates:** every date in the file must span **14 days or fewer**. A row outside the range is an error.
- **Shift columns** (`shifts`): an unknown or changed header returns **400 for the whole file**, the same as today's shape errors. An unrecognised mark value is a row error.
- **Overlap detection must include overnight spill.**
  - A shift that crosses midnight occupies the **next** date until its end time. For example, 7:00 PM–5:00 AM on Oct 26 overlaps a 4:00 AM shift on Oct 27.
  - This applies **within the file** (two marks in the same row, or across consecutive rows for the same employee) and **against existing assignments** (an existing overnight shift on the previous day counts too).
  - Today's in-file check only compares ranges on the same date.
- **Inactive employees** are errors in the preview ("Employee is inactive."), not "ready". Today they show as ready and then fail at confirm.
- **Row limit:** today's `MAX_ROWS = 300` is too low. 25 employees × 14 days = 350 rows. Please raise it, or base it on employees × days; tell us the new limit.
- **Performance:** the preview currently runs one overlap query per row. With pre-filled templates, consider loading the existing `UserShift`s for all employees in the range (plus one day either side for spill) in a single query.

**Response `data`:**
```json
{
  "mode": "shifts",
  "range": { "startDate": "2026-10-26", "endDate": "2026-11-08" },
  "summary": { "rows": 350, "blankRows": 290, "ready": 52, "conflictExisting": 5, "conflictFile": 2, "error": 1 },
  "items": [
    {
      "key": "r14:c4",
      "row": 14,
      "employee": { "userId": "...", "employeeId": "E-101", "name": "Capulong, Lennie" },
      "date": "2026-10-26",
      "shift": {
        "shiftId": "...",
        "shiftName": "Overnight",
        "startTime": "19:00", "endTime": "05:00", "crossesMidnight": true,
        "isExisting": true
      },
      "status": "conflict_existing",
      "reason": "Overlaps an existing shift on this date.",
      "conflicts": [
        {
          "userShiftId": "...", "shiftId": "...", "shiftName": "Evening",
          "date": "2026-10-26", "startTime": "16:00", "endTime": "22:00", "crossesMidnight": false,
          "replaceable": true, "notReplaceableReason": null
        }
      ],
      "allowedActions": ["skip", "replace"]
    }
  ]
}
```
- **One item per proposed assignment.** That's a marked shift column (`shifts`) or a contiguous run of blocks (`time_blocks`). `key` is stable, so the client can send decisions back against it.
- **`status`:**
  - `ready`: clean.
  - `conflict_existing`: clashes with an assignment already in the system.
  - `conflict_file`: clashes with another item in this file. Both items get it, and `conflicts` points at the other item's `key`.
  - `error`: can't be processed.
- **`allowedActions`** is decided by the server. The client only offers what's listed:
  - `ready` → `["create"]`
  - `conflict_existing` → `["skip", "replace"]`, or `["skip"]` when any conflict isn't `replaceable`
  - `conflict_file` and `error` → `["skip"]`, and the admin fixes the file
- **`time_blocks` items:** `shift.isExisting` is false, with a suggested `shiftName` (editable on the client as today). Please **reuse an existing Shift** when one has exactly the same start, end, `crossesMidnight` and name, instead of creating a duplicate.

## 3. `POST /api/schedule-import/confirm` (changed)

```json
{
  "mode": "shifts",
  "decisions": [
    { "key": "r12:c4", "action": "create" },
    { "key": "r14:c4", "action": "replace" },
    { "key": "r15:c5", "action": "skip" }
  ],
  "items": [ "...the preview items as returned, plus an edited shiftName for time_blocks..." ]
}
```
- **Validate everything again** against the current database, the same as today, because the preview can be stale. That includes scope, active status, overlaps with spill, and whether a Replace is still allowed.
- **`replace`:**
  - Removes the conflicting existing `UserShift`(s) listed in `conflicts`, then creates the uploaded one, **in one transaction per item**.
  - Please decide **delete** or **`status: "cancelled"` + a note**. The client prefers cancel, so there's a record of it.
  - **Refuse a Replace** (→ `failed`) when an existing assignment:
    - already has punches on that date
    - is in a locked or processed cutoff
    - is `completed`
  - The same rules decide `replaceable` in the preview.
- **`shifts` mode:** create a `UserShift` linked to the **existing** `shiftId`, with `createdFrom: "bulk"` as today. No `Shift` is created.
- **Notifications:** as today. For a Replace, please also tell the employee that the old assignment was removed, or say if that's out of scope.

**Response `data`:** `{ created: [...], replaced: [...], skipped: [...], failed: [{ key, reason }] }`.
- 200 when everything succeeded, 207 when some items failed. That's today's behaviour.
- `replaced` entries list both the new `userShiftId` and the removed one(s).

## Errors

| Status | When |
|---|---|
| 400 | Bad `mode`; a missing or invalid date; a range over 14 days; `shifts` mode without `shiftIds`; a CSV shape problem (missing columns, unknown shift header); over the row limit. |
| 403 | Not admin / superadmin / supervisor; a department, employee or shift outside the caller's scope. |

`{ "message": "..." }`, the same as today.

## Questions for the server side

1. How do shift-column headers resolve to exactly one shift, given that names can repeat?
2. Replace: delete or cancel the old assignment? And is the list of things that block a Replace complete?
3. The new row limit.
4. Is reusing an existing matching Shift in `time_blocks` mode OK? It stops the Shifts list from filling with duplicates.
