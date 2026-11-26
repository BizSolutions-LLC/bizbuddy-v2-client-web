/* components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeeMapCanvas.jsx */
"use client";

// BB-128: the Leaflet map for the Employee Map page. Loaded with next/dynamic (ssr: false)
// because Leaflet needs `window`. Map style (basemap) is chosen on the page: Street (OSM),
// Light (Esri Light Gray) or Satellite (Esri), the last two when the Esri key is set, see BASEMAPS in employeeMapRoutes.js.
// Map views (2026-11-25): one mode per tab, each with its own server response:
//   punches → GET /api/employee-map/punches  (initials pins, or the heat layer)
//   routes  → GET /api/employee-map/routes   (breadcrumb tracks + their punch pins)
//   live    → GET /api/employee-map/live     (latest position per clocked-in employee)
// Work sites are drawn on every tab. People are drawn as round initials badges in the
// server's per-employee `color`.

import { Fragment, useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, MapPin } from "lucide-react";
import { MapContainer, TileLayer, Circle, CircleMarker, Marker, Polyline, Popup, Tooltip, useMap } from "react-leaflet";
import { ROUTE_START_CLASS, ROUTE_END_CLASS, BASEMAPS, DEFAULT_BASEMAP, splitTrack, fmtAgo, fmtBattery, fmtClock, findStops, stopAt, stayAtPin, fmtStay,
  LIVE_STATUS, liveStatus, fmtShortSpan, hereSeconds } from "./employeeMapRoutes";

// Default marker images (same fix as Locations.jsx: bundlers break Leaflet's own paths)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Heat layer ───────────────────────────────────────────────────────────────
// A small canvas layer (the same technique as leaflet.heat / simpleheat): each point is
// stamped as a soft alpha blob weighted by `weight`, then the alpha is coloured through a
// gradient. Colours are canvas pixel values, so they can't be Tailwind classes.
// Work-site circle: brand orange (Tailwind orange-500). Leaflet paints its default blue on the
// shape itself, so the colour has to go through Leaflet's own color/fillColor options, not CSS classes.
const SITE_ORANGE = "#f97316";
const ACCURACY_GREY = "#737373"; // Live GPS accuracy halo (neutral-500)
const HEAT_GRADIENT = { 0.4: "#3b82f6", 0.6: "#06b6d4", 0.7: "#84cc16", 0.8: "#eab308", 1.0: "#ef4444" };

function buildPalette() {
  const c = document.createElement("canvas");
  c.width = 1; c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  Object.entries(HEAT_GRADIENT).forEach(([stop, color]) => g.addColorStop(Number(stop), color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1, 256);
  return ctx.getImageData(0, 0, 1, 256).data;
}

function buildStamp(r) {
  const c = document.createElement("canvas");
  c.width = c.height = r * 2;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, r * 2, r * 2);
  return c;
}

const HeatCanvasLayer = L.Layer.extend({
  initialize(points, options) {
    this._points = points;
    L.setOptions(this, options);
  },
  onAdd(map) {
    this._map = map;
    // leaflet-zoom-hide: hidden during the zoom animation, redrawn on zoomend
    this._canvas = L.DomUtil.create("canvas", "leaflet-zoom-hide");
    this._canvas.style.pointerEvents = "none";
    map.getPanes().overlayPane.appendChild(this._canvas);
    map.on("moveend zoomend resize", this._redraw, this);
    this._redraw();
  },
  onRemove(map) {
    map.off("moveend zoomend resize", this._redraw, this);
    this._canvas?.remove();
  },
  _redraw() {
    const map = this._map;
    if (!map) return;
    const size = map.getSize();
    const canvas = this._canvas;
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
    canvas.width = size.x;
    canvas.height = size.y;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, size.x, size.y);
    if (!this._points.length) return;

    const r = this.options.radius;
    const stamp = buildStamp(r);
    const max = Math.max(...this._points.map((p) => p.weight || 1));
    for (const p of this._points) {
      const pt = map.latLngToContainerPoint([p.lat, p.lng]);
      if (pt.x < -r || pt.y < -r || pt.x > size.x + r || pt.y > size.y + r) continue;
      ctx.globalAlpha = Math.min(1, Math.max(0.15, (p.weight || 1) / max));
      ctx.drawImage(stamp, pt.x - r, pt.y - r);
    }

    const img = ctx.getImageData(0, 0, size.x, size.y);
    const px = img.data;
    const palette = this._palette || (this._palette = buildPalette());
    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3];
      if (!a) continue;
      const j = a * 4;
      px[i] = palette[j]; px[i + 1] = palette[j + 1]; px[i + 2] = palette[j + 2];
      px[i + 3] = Math.min(255, a + 40);
    }
    ctx.putImageData(img, 0, 0);
  },
});

function HeatLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    const layer = new HeatCanvasLayer(points, { radius: 28 });
    layer.addTo(map);
    return () => { layer.remove(); };
  }, [map, points]);
  return null;
}

// ── Initials pins ────────────────────────────────────────────────────────────
// A round badge: the employee's server colour (a runtime value, so inline) with white
// initials. Variants: "in" solid, "out" with a white inner ring, stale at 50% opacity,
// fake GPS with a red outline.
const FALLBACK_COLOR = "#525252";
const safeColor = (c) => (typeof c === "string" && /^#[0-9a-f]{3,8}$/i.test(c) ? c : FALLBACK_COLOR);
const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

const PIN_SIZE = 26;
const iconCache = new Map();
function initialsIcon({ initials, color, variant = "in", stale = false, mocked = false, locating = false, selected = false }) {
  const key = `${initials}|${color}|${variant}|${stale}|${mocked}|${locating}|${selected}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const cls = [
    "flex h-[26px] w-[26px] items-center justify-center rounded-full text-[10px] font-semibold leading-none text-white shadow-md select-none",
    variant === "out" ? "ring-2 ring-inset ring-white" : "",
    stale ? "opacity-50" : "",
    mocked ? "outline outline-2 outline-offset-1 outline-red-600" : "",
    selected && !mocked ? "outline outline-[5px] outline-orange-500/30" : "",
  ].filter(Boolean).join(" ");
  const icon = L.divIcon({
    className: "", // no default white box
    // BB-128 3b: pulsing ring while a Locate now request is pending (the old pin stays meanwhile)
    html: `<div class="relative">${
      locating ? `<span class="absolute inset-0 rounded-full animate-ping" style="background:${safeColor(color)};opacity:.45"></span>` : ""
    }<div class="relative ${cls}" style="background:${safeColor(color)}">${escapeHtml((initials || "?").slice(0, 3))}</div></div>`,
    iconSize: [PIN_SIZE, PIN_SIZE],
    iconAnchor: [PIN_SIZE / 2, PIN_SIZE / 2],
    popupAnchor: [0, -PIN_SIZE / 2],
    tooltipAnchor: [PIN_SIZE / 2, 0],
  });
  iconCache.set(key, icon);
  return icon;
}

// ── View helpers ─────────────────────────────────────────────────────────────
// Fit the view to everything drawn, once per `fitKey` (a new load or new filters; Live
// polls keep the same key so the map doesn't jump every minute).
function FitToData({ bounds, fitKey }) {
  const map = useMap();
  const lastKey = useRef(null);
  useEffect(() => {
    if (!bounds || !bounds.isValid() || lastKey.current === fitKey) return;
    lastKey.current = fitKey;
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 17 });
  }, [map, bounds, fitKey]);
  return null;
}

// Live side panel: clicking a person flies the map to their pin
function FlyTo({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (!focus || focus.fly === false) return; // a pin click selects without moving the map
    map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [map, focus]);
  return null;
}

const fmtDistance = (m) => (m == null ? null : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

function placeText(p) {
  if (!p.siteName) return "No work sites set";
  if (p.insideSite === true) return p.siteName;
  if (p.insideSite === false) return `Outside work sites (${fmtDistance(p.distanceMeters)} from ${p.siteName})`;
  return `Nearest site: ${p.siteName} (${fmtDistance(p.distanceMeters)})`;
}

// BB-128 follow-up: Life360-style bubble for the initials pins (styles: .map-bubble in globals.css).
// `stay` = { label: "here for" | "stayed", text: "1 hr, 20 min" } when known.
const BUBBLE_POPUP = { closeButton: false, className: "map-bubble", offset: [0, -14] };

function MapBubble({ stay, title, children }) {
  return (
    <div className="min-w-[9rem] text-sm">
      {stay && (
        <div className="flex items-center gap-2 pb-2 mb-2 border-b border-border">
          <MapPin className="h-5 w-5 shrink-0 text-orange-500" aria-hidden />
          <div className="leading-tight">
            <p className="text-xs text-muted-foreground">{stay.label}</p>
            <p className="font-semibold">{stay.text}</p>
          </div>
        </div>
      )}
      <p className="font-semibold">{title}</p>
      <div className="space-y-0.5 text-muted-foreground">{children}</div>
    </div>
  );
}

function PunchPopup({ p, singleDay, stay }) {
  const when = singleDay ? (p.atLocal || "").split(" ").slice(1).join(" ") : p.atLocal;
  return (
    <MapBubble stay={stay} title={p.employeeName}>
      <p className="text-foreground">{p.type === "out" ? "Clock-out" : "Clock-in"} {when}</p>
      {p.siteName !== undefined && <p>{placeText(p)}</p>}
      {p.accuracy != null && <p>±{Math.round(p.accuracy)} m</p>}
    </MapBubble>
  );
}

function PunchPin({ p, singleDay, stay }) {
  return (
    <Marker position={[p.lat, p.lng]} icon={initialsIcon({ initials: p.initials, color: p.color, variant: p.type })}>
      <Popup {...BUBBLE_POPUP}><PunchPopup p={p} singleDay={singleDay} stay={stay} /></Popup>
    </Marker>
  );
}

// ── Routes ───────────────────────────────────────────────────────────────────
// Above this many points in total, only start/end, fake-GPS and jump dots are drawn (SVG
// markers get slow); the lines are always drawn. One employee is always below it.
const MAX_DOTS = 2000;

function BreadcrumbTip({ track, pt, stop }) {
  const battery = fmtBattery(pt.batteryLevel);
  return (
    <div className="space-y-0.5 text-xs">
      <p className="font-semibold">{track.employeeName}</p>
      <p>{pt.atLocal}</p>
      {stop && <p className="font-semibold">Stayed {fmtStay(stop.seconds)} here</p>}
      {pt.accuracy != null && (
        <p>±{Math.round(pt.accuracy)} m{pt.lowAccuracy && ", not counted in distance"}</p>
      )}
      {pt.speed != null && <p>{(pt.speed * 3.6).toFixed(1)} km/h · {(pt.speed * 2.23694).toFixed(1)} mph</p>}
      {battery && <p>Battery {battery}</p>}
      {pt.isMocked && <p className="font-semibold text-red-600">⚠ Fake GPS reported by the phone</p>}
      {pt.jumpedHere && <p className="font-semibold text-red-600">⚠ Suspicious movement: reached by an impossible move</p>}
    </div>
  );
}

// Note: react-leaflet only applies `className` when given as its own prop at creation; inside
// `pathOptions` it is ignored and Leaflet's default blue shows. Shapes whose class can change get a
// `key` that changes with it, so they are recreated with the new class.

// BB-128 2b: faint dashed link between a punch pin and its route (clock-in pin → first point,
// last point → clock-out pin). Red when the server's pin check says they don't connect.
function PinLink({ from, to, check, label }) {
  if (!from || !to) return null;
  const bad = Boolean(check?.suspicious);
  return (
    <Polyline
      key={bad ? "bad" : "ok"}
      positions={[from, to]}
      className={bad ? "stroke-red-600" : "stroke-neutral-500"}
      pathOptions={{
        weight: bad ? 2 : 1.5,
        opacity: bad ? 0.8 : 0.45,
        dashArray: "2 6",
      }}
    >
      {bad && <Tooltip sticky>⚠ {label} doesn&apos;t connect to the route</Tooltip>}
    </Polyline>
  );
}

const hasLatLng = (p) => p && p.lat != null && p.lng != null;

function RouteLayer({ tracks, intervalMinutes, singleDay }) {
  const totalPoints = tracks.reduce((n, t) => n + (t.points?.length || 0), 0);
  const allDots = totalPoints <= MAX_DOTS;
  return tracks.map((t) => {
    const pts = t.points || [];
    const color = safeColor(t.color);
    const { solid, gaps, jumps } = splitTrack(pts, intervalMinutes);
    const last = pts.length - 1;
    // BB-128 follow-up: stops along the route ("Stayed 1 hr, 20 min"), from the points only
    const stops = findStops(pts);
    const stayOf = (pin, end) => {
      const seconds = stayAtPin(pts, stops, pin, end);
      return seconds ? { label: "stayed", text: fmtStay(seconds) } : null;
    };
    // Punch pins come with the track (server: tracks[].pins); missing until the server sends them
    const pinIn = hasLatLng(t.pins?.clockIn) ? t.pins.clockIn : null;
    const pinOut = hasLatLng(t.pins?.clockOut) ? t.pins.clockOut : null;
    const person = { employeeName: t.employeeName, initials: t.initials, color: t.color };
    return (
      <Fragment key={t.timeLogId}>
        {pts.length > 0 && (
          <>
            <PinLink from={pinIn && [pinIn.lat, pinIn.lng]} to={[pts[0].lat, pts[0].lng]} check={t.pinChecks?.clockIn} label="Clock-in pin" />
            <PinLink from={[pts[last].lat, pts[last].lng]} to={pinOut && [pinOut.lat, pinOut.lng]} check={t.pinChecks?.clockOut} label="Clock-out pin" />
          </>
        )}
        {solid.map((run, i) => (
          <Polyline key={`s${i}`} positions={run} pathOptions={{ color, weight: 3, opacity: 0.85 }} />
        ))}
        {/* No location for a while: drawn solid like the route (Carlo, 2026-11-26); the hover says it's a straight line */}
        {gaps.map((seg, i) => (
          <Polyline key={`g${i}`} positions={seg} pathOptions={{ color, weight: 3, opacity: 0.85 }}>
            <Tooltip sticky>No location recorded here; straight line between two points</Tooltip>
          </Polyline>
        ))}
        {/* BB-128 2b: impossible moves — dashed red, never part of the route line */}
        {jumps.map((seg, i) => (
          <Polyline key={`j${i}`} positions={seg} className="stroke-red-600" pathOptions={{ weight: 2.5, opacity: 0.9, dashArray: "8 6" }}>
            <Tooltip sticky>⚠ Suspicious movement</Tooltip>
          </Polyline>
        ))}
        {pts.map((pt, i) => {
          const isEnd = i === 0 || i === last;
          const flagged = pt.isMocked || pt.jumpedHere;
          if (!flagged && !isEnd && !allDots) return null;
          // Low accuracy (> 100 m): still drawn, lighter; not counted in distance
          const dotClass = flagged ? "fill-red-500 stroke-red-700" : i === 0 ? ROUTE_START_CLASS : i === last ? ROUTE_END_CLASS : undefined;
          const options = dotClass
            ? { weight: flagged ? 1 : 2, fillOpacity: 1 }
            : { color, fillColor: color, weight: 1, fillOpacity: pt.lowAccuracy ? 0.25 : 1, opacity: pt.lowAccuracy ? 0.35 : 1 };
          return (
            <CircleMarker
              key={`p${i}-${dotClass || "plain"}`}
              center={[pt.lat, pt.lng]}
              radius={flagged || isEnd ? 5 : 2.5}
              className={dotClass}
              pathOptions={options}
            >
              <Tooltip><BreadcrumbTip track={t} pt={pt} stop={stopAt(stops, i)} /></Tooltip>
            </CircleMarker>
          );
        })}
        {pinIn && <PunchPin p={{ ...person, ...pinIn, type: "in" }} singleDay={singleDay} stay={stayOf(pinIn, "in")} />}
        {pinOut && <PunchPin p={{ ...person, ...pinOut, type: "out" }} singleDay={singleDay} stay={stayOf(pinOut, "out")} />}
      </Fragment>
    );
  });
}

// ── Live ─────────────────────────────────────────────────────────────────────
// Live redesign (2026-11-26): person card — header, status badge, facts, Locate now.
const LIVE_POPUP = { className: "map-bubble", offset: [0, -14], minWidth: 256, maxWidth: 300 };

function Fact({ label, children }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </>
  );
}

function LivePopup({ e, ageSeconds, tz, status, onLocate }) {
  const pos = e.position;
  const st = liveStatus(e);
  const meta = LIVE_STATUS[st];
  const battery = fmtBattery(pos.batteryLevel);
  const here = hereSeconds(pos);
  const since = Date.parse(e.clockedInAt);
  const clockedAgo = Number.isFinite(since) ? fmtShortSpan((Date.now() - since) / 1000) : null;
  const site = pos.site;
  return (
    <div className="text-sm">
      <div className="flex items-center gap-3 pr-5">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ background: meta.pin }}
        >
          {(e.initials || "?").slice(0, 3)}
        </span>
        <div className="min-w-0">
          <p className="font-semibold truncate">{e.name}</p>
          <p className="flex items-center gap-2 min-w-0">
            {e.department && <span className="text-xs text-muted-foreground truncate">{e.department}</span>}
            <span className={`inline-flex shrink-0 rounded-brand border px-1.5 py-px text-[11px] font-semibold ${meta.text}`}>{meta.label}</span>
          </p>
        </div>
      </div>
      <div className="mt-3 border-t border-border pt-3 space-y-2.5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <Fact label="Clocked in">
            {fmtClock(e.clockedInAt, tz)}{clockedAgo && clockedAgo !== "just now" ? ` · ${clockedAgo} ago` : ""}
          </Fact>
          {here != null && <Fact label={pos.stale ? "Was here for" : "Here for"}>{fmtStay(here)}</Fact>}
          <Fact label="Last location">{pos.source === "clockIn" ? "At clock-in" : fmtAgo(ageSeconds)}</Fact>
          {pos.accuracy != null && <Fact label="GPS accuracy">±{Math.round(pos.accuracy)} m</Fact>}
          {site && (
            <Fact label="Work site">
              <span className={site.inside ? LIVE_STATUS.onsite.text : ""}>
                {site.inside
                  ? `${site.name} · inside`
                  : `${site.distanceMeters != null ? `${Math.round(site.distanceMeters)} m ` : ""}outside ${site.name}`}
              </span>
            </Fact>
          )}
          {battery && <Fact label="Battery">{battery}</Fact>}
        </dl>
        {pos.isMocked && <p className="text-xs font-semibold text-red-600">⚠ Fake GPS reported by the phone</p>}
        {status && (
          <p className={`text-xs ${status.pending ? "text-foreground animate-pulse" : status.fresh ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            {status.text}
          </p>
        )}
        {onLocate && (
          <button
            type="button"
            onClick={() => onLocate(e)}
            disabled={Boolean(status?.pending)}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-brand border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Crosshair className="h-3.5 w-3.5" /> Locate now
          </button>
        )}
      </div>
    </div>
  );
}

// Site label above the circle: "Kaingin site · 1 here" (Live). A non-interactive divIcon marker at
// the circle's top edge; the chip centres itself on that point.
function siteChipIcon(text) {
  return L.divIcon({
    className: "",
    html: `<span class="site-chip">${escapeHtml(text)}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

// Live: accuracy halos, status pins, site chips; opens the selected person's card
function LiveLayer({ live, sites, ageOf, tz, locateStatus, onLocate, onSelect, selectedId, openKey }) {
  const markers = useRef({});
  // Open the card of the person picked in the side panel (after the fly-to)
  useEffect(() => {
    if (!selectedId || !openKey) return;
    const t = setTimeout(() => markers.current[selectedId]?.openPopup(), 650);
    return () => clearTimeout(t);
  }, [selectedId, openKey]);

  const counts = useMemo(() => {
    const c = {};
    live.forEach((e) => { const st = e.position?.site; if (st?.inside && st.id) c[st.id] = (c[st.id] || 0) + 1; });
    return c;
  }, [live]);

  return (
    <>
      {sites.filter((s) => s.latitude != null && s.longitude != null && s.radius != null).map((s) => (
        <Marker
          key={`chip-${s.id}`}
          position={[s.latitude + s.radius / 111320, s.longitude]}
          icon={siteChipIcon(counts[s.id] ? `${s.name} · ${counts[s.id]} here` : s.name)}
          interactive={false}
          keyboard={false}
        />
      ))}
      {live.map((e) => e.position.accuracy > 0 && (
        <Circle
          key={`acc-${e.timeLogId || e.employeeId}`}
          center={[e.position.lat, e.position.lng]}
          radius={e.position.accuracy}
          interactive={false}
          pathOptions={{ stroke: false, fillColor: ACCURACY_GREY, fillOpacity: 0.18 }}
        />
      ))}
      {live.map((e) => {
        const id = e.employeeId || e.timeLogId;
        return (
          <Marker
            key={e.timeLogId || e.employeeId}
            ref={(m) => { if (m) markers.current[id] = m; else delete markers.current[id]; }}
            position={[e.position.lat, e.position.lng]}
            icon={initialsIcon({
              initials: e.initials,
              color: LIVE_STATUS[liveStatus(e)].pin,
              mocked: Boolean(e.position.isMocked),
              locating: Boolean(locateStatus?.(e)?.pending),
              selected: selectedId === id,
            })}
            eventHandlers={{ click: () => onSelect?.(e) }}
          >
            <Popup {...LIVE_POPUP}>
              <LivePopup e={e} ageSeconds={ageOf ? ageOf(e) : e.position.ageSeconds} tz={tz} status={locateStatus?.(e)} onLocate={onLocate} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

// ── Map ──────────────────────────────────────────────────────────────────────
/**
 * @param mode       "punches" | "routes" | "live"
 * @param data       that tab's server `data`
 * @param punchView  "pins" | "heat" (punches only)
 * @param basemap    key of BASEMAPS
 * @param fitKey     changes when the view should refit to the data
 * @param focus      { lat, lng } to fly to (Live side panel)
 * @param ageOf      (employee) → seconds since their position, re-counted between polls (Live)
 * @param tz         company time zone for Live labels
 * @param locateStatus (employee) → { text, pending?, fresh? } | null — Locate now state (Live, BB-128 3b)
 * @param onLocate   (employee) → void — sends Locate now; null hides the button (tracking off)
 * @param onSelect   (employee) → void — a Live pin was clicked (side panel follows)
 * @param selectedId employeeId of the selected Live person (ring on the pin)
 */
export default function EmployeeMapCanvas({
  mode, data, punchView = "pins", singleDay, basemap, fitKey, focus, ageOf, tz, locateStatus, onLocate, onSelect, selectedId,
}) {
  const tile = Object.hasOwn(BASEMAPS, basemap || "") ? BASEMAPS[basemap] : BASEMAPS[DEFAULT_BASEMAP];
  const sites = data?.sites || [];
  const tracks = useMemo(() => (mode === "routes" ? data?.tracks || [] : []), [data, mode]);
  const intervalMinutes = data?.summary?.intervalMinutes || 5;
  const heat = mode === "punches" ? data?.heat || [] : [];
  const points = useMemo(
    () =>
      mode !== "punches"
        ? []
        : [
            ...(data?.layers?.clockIn || []).map((p) => ({ ...p, type: "in" })),
            ...(data?.layers?.clockOut || []).map((p) => ({ ...p, type: "out" })),
          ],
    [data, mode]
  );
  const live = useMemo(() => (mode === "live" ? (data?.employees || []).filter((e) => hasLatLng(e.position)) : []), [data, mode]);

  const bounds = useMemo(() => {
    const latlngs = [
      ...points.map((p) => [p.lat, p.lng]),
      ...tracks.flatMap((t) => [
        ...(t.points || []).map((pt) => [pt.lat, pt.lng]),
        ...[t.pins?.clockIn, t.pins?.clockOut].filter(hasLatLng).map((p) => [p.lat, p.lng]),
      ]),
      ...live.map((e) => [e.position.lat, e.position.lng]),
      ...sites.filter((s) => s.latitude != null && s.longitude != null).map((s) => [s.latitude, s.longitude]),
    ];
    return latlngs.length ? L.latLngBounds(latlngs) : null;
  }, [points, sites, tracks, live]);

  return (
    <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom className="h-full w-full z-0">
      <TileLayer
        key={tile.id}
        attribution={tile.attribution}
        url={tile.url}
        maxZoom={tile.maxZoom}
        {...(tile.minZoom != null ? { minZoom: tile.minZoom } : {})}
        {...(tile.tileSize ? { tileSize: tile.tileSize, zoomOffset: tile.zoomOffset ?? 0 } : {})}
      />
      <FitToData bounds={bounds} fitKey={fitKey} />
      <FlyTo focus={focus} />

      {/* Work sites — always shown */}
      {sites.filter((s) => s.latitude != null && s.longitude != null).map((s) =>
        s.radius != null ? (
          <Circle
            key={s.id}
            center={[s.latitude, s.longitude]}
            radius={s.radius}
            pathOptions={{ color: SITE_ORANGE, fillColor: SITE_ORANGE, fillOpacity: 0.1, dashArray: "6 4", weight: 2 }}
          >
            <Tooltip>{s.name} ({s.radius} m)</Tooltip>
          </Circle>
        ) : (
          <Marker key={s.id} position={[s.latitude, s.longitude]}>
            <Tooltip>{s.name}</Tooltip>
          </Marker>
        )
      )}

      {mode === "punches" && (punchView === "heat"
        ? <HeatLayer points={heat} />
        : points.map((p) => <PunchPin key={`${p.type}-${p.timeLogId}`} p={p} singleDay={singleDay} />))}

      {mode === "routes" && <RouteLayer tracks={tracks} intervalMinutes={intervalMinutes} singleDay={singleDay} />}

      {mode === "live" && (
        <LiveLayer
          live={live} sites={sites} ageOf={ageOf} tz={tz}
          locateStatus={locateStatus} onLocate={onLocate} onSelect={onSelect}
          selectedId={selectedId} openKey={focus?.open ? focus.at : null}
        />
      )}
    </MapContainer>
  );
}
