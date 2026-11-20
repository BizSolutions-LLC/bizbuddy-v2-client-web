// BB-128 part 2: helpers for the Employee Map's route (breadcrumb) layer, shared by the
// map (EmployeeMapCanvas) and the track list (EmployeeMap).

// One colour per employee. Tailwind classes on the SVG paths (CSS beats Leaflet's
// attributes), written out in full so Tailwind keeps them. Left out: red (fake GPS,
// suspicious movement), orange/amber (work sites), blue and blue-ish (clock-out pins),
// emerald/green (clock-in pins), black (route Start/End markers).
export const TRACK_COLORS = [
  { stroke: "stroke-violet-600",  fill: "fill-violet-600",  bg: "bg-violet-600" },
  { stroke: "stroke-teal-600",    fill: "fill-teal-600",    bg: "bg-teal-600" },
  { stroke: "stroke-pink-600",    fill: "fill-pink-600",    bg: "bg-pink-600" },
  { stroke: "stroke-lime-600",    fill: "fill-lime-600",    bg: "bg-lime-600" },
  { stroke: "stroke-fuchsia-600", fill: "fill-fuchsia-600", bg: "bg-fuchsia-600" },
  { stroke: "stroke-stone-500",   fill: "fill-stone-500",   bg: "bg-stone-500" },
  { stroke: "stroke-purple-900",  fill: "fill-purple-900",  bg: "bg-purple-900" },
  { stroke: "stroke-lime-800",    fill: "fill-lime-800",    bg: "bg-lime-800" },
];

// Route Start / End markers: the legend's hollow and solid black dots, never a track colour,
// so they can't be confused with the clock-out pins.
export const ROUTE_START_CLASS = "fill-white stroke-neutral-900";
export const ROUTE_END_CLASS = "fill-neutral-900 stroke-neutral-900";

// employeeId → palette index, in order of first appearance (stable for one response)
export function trackColorIndex(tracks) {
  const map = new Map();
  tracks.forEach((t) => { if (!map.has(t.employeeId)) map.set(t.employeeId, map.size % TRACK_COLORS.length); });
  return (employeeId) => map.get(employeeId) ?? 0;
}

// Split a track's points (time order) into solid runs, dashed gap segments and
// dashed red jump segments.
// - Gap: no point for 3× the interval or more (phone off, no signal, permission removed).
// - Jump (BB-128 2b): the server marks a point `jumpedHere` when it was reached by an
//   impossible move (> 120 mph over > 1 km). The segment INTO that point is a jump, never
//   part of the normal route line. A jump wins over a gap for the same segment.
export function splitTrack(points, intervalMinutes = 5) {
  const gapMs = 3 * intervalMinutes * 60 * 1000;
  const solid = [];
  const gaps = [];
  const jumps = [];
  let run = [];
  points.forEach((pt, i) => {
    const ll = [pt.lat, pt.lng];
    if (i > 0) {
      const prev = points[i - 1];
      const seg = [[prev.lat, prev.lng], ll];
      if (pt.jumpedHere) {
        if (run.length > 1) solid.push(run);
        jumps.push(seg);
        run = [];
      } else if (Date.parse(pt.at) - Date.parse(prev.at) >= gapMs) {
        if (run.length > 1) solid.push(run);
        gaps.push(seg);
        run = [];
      }
    }
    run.push(ll);
  });
  if (run.length > 1) solid.push(run);
  return { solid, gaps, jumps };
}

// ── Suspicious movement (BB-128 2b) ──────────────────────────────────────────
// Long distances for jump labels: "4,862 mi" / "7,825 km" (no decimals once it's big).
export function fmtJumpDistance(meters, unit) {
  if (meters == null) return "—";
  const value = unit === "km" ? meters / 1000 : meters / 1609.344;
  if (value < 10) return fmtTrackDistance(meters, unit);
  return `${Math.round(value).toLocaleString("en-US")} ${unit === "km" ? "km" : "mi"}`;
}

function fmtDuration(seconds) {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

// "4,862 mi in 1 min", or "… instantly" when both moments have the same time (mph is null)
export function fmtMove(move, unit) {
  const dist = fmtJumpDistance(move?.meters, unit);
  if (!move?.seconds || move.mph == null) return `${dist} instantly`;
  return `${dist} in ${fmtDuration(move.seconds)}`;
}

// Lines for the track's suspicious-movement tooltip: each jump, then failed pin checks.
export function suspiciousLines(track, unit, tz) {
  const lines = (track.jumps || []).map((j) => `${fmtMove(j, unit)} at ${fmtClock(j.to?.at, tz)}`);
  if (track.pinChecks?.clockIn?.suspicious) lines.push(`Clock-in pin → route start: ${fmtMove(track.pinChecks.clockIn, unit)}`);
  if (track.pinChecks?.clockOut?.suspicious) lines.push(`Route end → clock-out pin: ${fmtMove(track.pinChecks.clockOut, unit)}`);
  return lines;
}

export const DISTANCE_UNITS = [
  { id: "mi", label: "mi" },
  { id: "km", label: "km" },
];

export function fmtTrackDistance(meters, unit) {
  if (meters == null) return "—";
  if (unit === "km") return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
  const mi = meters / 1609.344;
  return mi < 0.1 ? `${Math.round(meters * 3.28084)} ft` : `${mi.toFixed(1)} mi`;
}

export function fmtClock(iso, tz) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz || "UTC" });
}
