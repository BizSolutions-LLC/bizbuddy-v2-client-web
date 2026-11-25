# Server request — BB-128 map views: punch pins + sites on `/routes`

**From:** web client, 2026-11-25. **For:** the BB-128 map views work (uncommitted on server master,
hand-off `docs/client-update-BB-128-map-views.md`). **Mobile:** no change.

## Why
The web Routes tab used to draw, from the old combined response:
- the clock-in and clock-out pins at the ends of each route;
- the dashed pin-to-route links (BB-128 2b, red when `pinChecks.*.suspicious`);
- the work-site circles.

The new `GET /api/employee-map/routes` returns only `{ company, filters, summary, tracks }`, so all
three are gone unless the client also calls `/punches`. Carlo chose to add them to `/routes` instead
(one call per tab).

## Ask
1. **`tracks[].pins`**: the punch pins of that time log, which `breadcrumbService` already reads for
   `pinChecks`:
   ```json
   "pins": {
     "clockIn":  { "lat": 14.55, "lng": 121.02, "at": "2026-11-25T00:57:00.000Z", "atLocal": "2026-11-25 8:57 AM", "accuracy": 12 },
     "clockOut": null
   }
   ```
   - `null` when that punch has no location, or when the shift is still open (no clock-out yet).
   - `atLocal` should use the same format as the `/punches` layer items, because the client strips the
     date part on single-day views.
   - `accuracy` is optional.
2. **`sites[]`** on the `/routes` response: the same array as `/punches` and `/live`.

## Client status
The web client already reads `tracks[].pins` and `data.sites` and simply draws nothing while they are
missing, so the order of deploys doesn't matter.
