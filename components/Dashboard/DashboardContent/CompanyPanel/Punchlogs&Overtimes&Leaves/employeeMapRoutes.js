// BB-128: helpers for the Employee Map, shared by the map (EmployeeMapCanvas) and the page
// (EmployeeMap): route (breadcrumb) drawing, distances, Live labels and the map styles.
// Map views (2026-11-25): every person carries the server's `initials` + `color`, so the old
// per-response track palette is gone; one person has one colour on every tab.

// Route Start / End markers: the legend's hollow and solid black dots, never a person's colour.
export const ROUTE_START_CLASS = "fill-white stroke-neutral-900";
export const ROUTE_END_CLASS = "fill-neutral-900 stroke-neutral-900";

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

// ── Live tab ─────────────────────────────────────────────────────────────────
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
export const DEFAULT_BASEMAP = "street";
// Per-browser convenience only: just the style id, never any location data.
export const BASEMAP_STORAGE_KEY = "employeeMap.basemap";
