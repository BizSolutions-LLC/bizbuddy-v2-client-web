# Server request: BB-124 shift times in the shift's own zone (affected-schedules)

**From:** client (bizbuddy-v2-client-web)
**For:** bizbuddy-v2-server
**Status:** Draft, 2026-11-23. Client side is already built and falls back to today's display until this ships.
**Builds on:** BB-124 `GET /api/leaves/affected-schedules` (`punchOverlaps` with `timeZone` / `zoneLabel` / `*Local`).
**Database change:** none.

## Why

Seen in the BB-124 test (BizSolutions LLC: company zone Los Angeles, shifts Manila): the leave form's
"Shifts that will be on leave" card showed the Nov 20 shift as **04:00 PM → 01:00 AM**. The client
formats `startTime` / `endTime` in the viewer's browser zone, so the times don't match the shift's
own date or the overlap warning right under it ("… 8:00 AM – 5:00 PM (Manila time)").

Carlo's decision (2026-11-23): fix it inside BB-124, the same way as the overlap times — the
server sends display-ready strings, the client never converts.

## `GET /api/leaves/affected-schedules`: new fields per row (additive)

For each **real shift row** (`isFallback: false`) in `data`, add:

```json
{
  "userShiftId": "…",
  "assignedDate": "2026-11-20T00:00:00.000Z",
  "startTime": "…",            // unchanged
  "endTime": "…",              // unchanged
  "timeZone": "Asia/Manila",
  "zoneLabel": "Manila",
  "startTimeLocal": "2026-11-20 8:00 AM",
  "endTimeLocal": "2026-11-20 5:00 PM"
}
```

- Same zone rule and string format as `punchOverlaps` (`YYYY-MM-DD h:mm AM`): the **shift's** zone.
- Overnight shift: `endTimeLocal` carries the next day's date (`2026-11-21 1:00 AM`). The client drops
  the date only when it equals the row's `assignedDate` day, so the next-day date stays visible.
- Fallback rows (`isFallback: true`) need nothing new.
- Nothing else changes; existing fields stay as they are.

## Client behaviour

- If `startTimeLocal` and `endTimeLocal` are present: show them, plus `(zoneLabel time)`.
- Otherwise: today's browser-local formatting (no break against an older server).
