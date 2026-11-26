// BB-128: helpers for the Employee Map, shared by the map (EmployeeMapCanvas) and the page
// (EmployeeMap): route (breadcrumb) drawing, distances, Live labels and the map styles.
// Map views (2026-11-25): every person carries the server's `initials` + `color`, so the old
// per-response track palette is gone; one person has one colour on every tab.

// Route Start / End markers: the legend's hollow and solid black dots, never a person's colour.
export const ROUTE_START_CLASS = "fill-white stroke-neutral-900";
export const ROUTE_END_CLASS = "fill-neutral-900 stroke-neutral-900";

// Split a track's points (time order) into solid runs, gap segments (drawn solid since 2026-11-26) and
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

// ── Stops ("here for", BB-128 follow-up) ───────────────────────────────────
// A stop is a run of consecutive points that all stay within STOP_RADIUS_M of the run's first
// accurate point, lasting at least STOP_MIN_SECONDS. Worked out from the route points only.
// Same rule as the server's Live `position.hereSince`: low-accuracy points (> 100 m) are skipped,
// so one bad fix doesn't end a stay, and a gap with no points at the same spot still counts.
export const STOP_RADIUS_M = 100;
export const STOP_MIN_SECONDS = 5 * 60;

function metersBetween(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// → [{ start, end, seconds }] with start/end as point indexes (inclusive), time order
export function findStops(points) {
  const stops = [];
  let start = -1; // first accurate point of the current run
  let end = -1;   // last accurate point of the current run
  const close = () => {
    if (start < 0 || end <= start) return;
    const seconds = (Date.parse(points[end].at) - Date.parse(points[start].at)) / 1000;
    if (seconds >= STOP_MIN_SECONDS) stops.push({ start, end, seconds });
  };
  points.forEach((pt, i) => {
    if (pt.lowAccuracy) return;
    if (start >= 0 && metersBetween(points[start], pt) <= STOP_RADIUS_M) { end = i; return; }
    close();
    start = i;
    end = i;
  });
  close();
  return stops;
}

// Stay at a punch pin (Routes): the stop at that end of the route, stretched to the punch time
// when the pin is within STOP_RADIUS_M of it (clock-in → first stop starts at the clock-in;
// clock-out → last stop ends at the clock-out). Like the server's rule: a clock-in more than
// 100 m away doesn't count, the stay then starts at the first point. → seconds or null
export function stayAtPin(points, stops, pin, end) {
  if (!points.length || !pin) return null;
  const idx = end === "in" ? 0 : points.length - 1;
  const stop = stops.find((s) => (end === "in" ? s.start : s.end) === firstAccurate(points, end));
  const anchor = stop ? points[end === "in" ? stop.start : stop.end] : points[idx];
  const pinNear = metersBetween(pin, anchor) <= STOP_RADIUS_M;
  const pinMs = Date.parse(pin.at);
  let from = stop ? Date.parse(points[stop.start].at) : null;
  let to = stop ? Date.parse(points[stop.end].at) : null;
  if (pinNear && Number.isFinite(pinMs)) {
    if (end === "in") { from = pinMs; to = to ?? Date.parse(anchor.at); }
    else { to = pinMs; from = from ?? Date.parse(anchor.at); }
  }
  if (from == null || to == null) return null;
  const seconds = (to - from) / 1000;
  return seconds >= STOP_MIN_SECONDS ? seconds : null;
}

function firstAccurate(points, end) {
  const order = end === "in" ? points.keys() : [...points.keys()].reverse();
  for (const i of order) if (!points[i].lowAccuracy) return i;
  return -1;
}

export const stopAt = (stops, index) => stops.find((s) => index >= s.start && index <= s.end) || null;

// "14 hr, 53 min" / "2 hr" / "35 min" (Life360 style)
export function fmtStay(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const m = Math.max(1, Math.floor(seconds / 60));
  const h = Math.floor(m / 60);
  if (!h) return `${m} min`;
  return m % 60 ? `${h} hr, ${m % 60} min` : `${h} hr`;
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

// ── Live tab ─────────────────────────────────────────────────────────────────
// Live redesign (2026-11-26): one status per clocked-in person, drives the pin colour, the side-panel
// groups and the popup badge. Site state comes from the server's position.site (requested in
// docs/server-request-BB-128-live-site.md); until it ships, people with a fresh position are "unknown".
// Pin colours are runtime values for Leaflet divIcons (not Tailwind classes), Tailwind palette hexes.
export const LIVE_STATUS = {
  mocked:  { label: "Fake GPS flagged", pin: "#171717", text: "text-red-600 dark:text-red-400", needsLook: true, rank: 0 },
  none:    { label: "No location yet",  pin: "#a3a3a3", text: "text-muted-foreground", needsLook: true, rank: 1 },
  stale:   { label: "No recent update", pin: "#a3a3a3", text: "text-foreground", needsLook: true, rank: 2 },
  outside: { label: "Outside a site",   pin: "#171717", text: "text-orange-700 dark:text-orange-400", needsLook: true, rank: 3 },
  onsite:  { label: "On site",          pin: "#c2410c", text: "text-orange-700 dark:text-orange-400", needsLook: false, rank: 4 }, // orange-700: white initials stay readable
  unknown: { label: "Clocked in",       pin: "#525252", text: "text-muted-foreground", needsLook: false, rank: 5 },
};

export function liveStatus(e) {
  const p = e?.position;
  if (!p) return "none";
  if (p.isMocked) return "mocked";
  if (p.stale) return "stale";
  if (p.site?.inside === true) return "onsite";
  if (p.site?.inside === false) return "outside";
  return "unknown";
}

// "1h 42m" / "42m" / "just now" (compact, for "Clocked in 3:52 PM · 1h 42m ago")
export function fmtShortSpan(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const m = Math.floor(Math.max(0, seconds) / 60);
  if (m < 1) return "just now";
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

// "here for" seconds from position.hereSince; a stale position counts only up to its last point
export function hereSeconds(pos, nowMs = Date.now()) {
  if (!pos?.hereSince) return null;
  const until = pos.stale ? Date.parse(pos.at) : nowMs;
  const s = (until - Date.parse(pos.hereSince)) / 1000;
  return Number.isFinite(s) && s >= 60 ? s : null;
}

// "just now", "3 min ago", "2 h 5 min ago" from a number of seconds
export function fmtAgo(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const m = Math.floor(Math.max(0, seconds) / 60);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min ago` : `${h} h ago`;
}

// Battery is a fraction 0–1 from the server (0.42 = 42%)
export function fmtBattery(fraction) {
  if (fraction == null || !Number.isFinite(Number(fraction))) return null;
  return `${Math.round(Math.min(1, Math.max(0, Number(fraction))) * 100)}%`;
}

// ── Map styles (basemaps) ────────────────────────────────────────────────────
// Street (OpenStreetMap) needs no key and is always there. Light and Satellite use the Esri key
// NEXT_PUBLIC_MAP_SATELLITE_KEY (ArcGIS Location Platform, a public, referrer-restricted token
// with only the "Static basemap tiles" privilege) and show only when it is set.
// 2026-11-25: Light moved from CARTO to Esri Light Gray. CARTO raster tiles now need their own
// key (keyless requests get "API KEY REQUIRED" tiles), and their free tier is non-commercial.
// Satellite can instead come from MapTiler (NEXT_PUBLIC_MAP_SATELLITE_PROVIDER=maptiler, a MapTiler
// key); Light is Esri-only, so it is hidden in that case.
const MAP_KEY = process.env.NEXT_PUBLIC_MAP_SATELLITE_KEY;
const SATELLITE_PROVIDER = (process.env.NEXT_PUBLIC_MAP_SATELLITE_PROVIDER || "esri").toLowerCase();
const ESRI_KEY = MAP_KEY && SATELLITE_PROVIDER !== "maptiler" ? MAP_KEY : null;
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const SATELLITE = !MAP_KEY
  ? null
  : SATELLITE_PROVIDER === "maptiler"
    ? {
        url: `https://api.maptiler.com/maps/satellite/256/{z}/{x}/{y}.jpg?key=${encodeURIComponent(MAP_KEY)}`,
        attribution: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> ' + OSM_ATTRIBUTION,
        maxZoom: 20,
      }
    : {
        url: `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(MAP_KEY)}`,
        attribution: "Powered by Esri | Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxZoom: 19,
      };

// Esri static basemap tiles are 512 px with levels one lower than 256 px services, hence
// tileSize 512 + zoomOffset -1 (and minZoom 1, so no level -1 is ever requested).
const LIGHT = !ESRI_KEY
  ? null
  : {
      url: `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/light-gray/static/tile/{z}/{y}/{x}?token=${encodeURIComponent(ESRI_KEY)}`,
      attribution: "Powered by Esri | Esri, TomTom, Garmin, FAO, NOAA, USGS, " + OSM_ATTRIBUTION + ", and the GIS User Community",
      tileSize: 512,
      zoomOffset: -1,
      minZoom: 1,
      maxZoom: 20,
    };

export const BASEMAPS = {
  street: { id: "street", label: "Street", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: OSM_ATTRIBUTION, maxZoom: 19 },
  ...(LIGHT ? { light: { id: "light", label: "Light", ...LIGHT } } : {}),
  ...(SATELLITE ? { satellite: { id: "satellite", label: "Satellite", ...SATELLITE } } : {}),
};
export const BASEMAP_OPTIONS = Object.values(BASEMAPS).map(({ id, label }) => ({ id, label }));
// Light is pre-selected on every map (Carlo, 2026-11-26); Street when the Esri key is missing.
export const DEFAULT_BASEMAP = BASEMAPS.light ? "light" : "street";
// Per-browser convenience only: just the style id, never any location data.
// v2: earlier saved choices are dropped once, so everyone starts on Light.
export const BASEMAP_STORAGE_KEY = "employeeMap.basemap.v2";
