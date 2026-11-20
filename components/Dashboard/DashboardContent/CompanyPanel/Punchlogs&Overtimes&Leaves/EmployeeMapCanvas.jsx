/* components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeeMapCanvas.jsx */
"use client";

// BB-128: the Leaflet map for the Employee Map page. Loaded with next/dynamic (ssr: false)
// because Leaflet needs `window`. Tiles: OpenStreetMap (free, no key).
// Layers: work sites (always), then a heat layer, individual punch points, or (part 2)
// routes: the breadcrumb tracks with the punch points at their ends.

import { Fragment, useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Circle, CircleMarker, Marker, Polyline, Popup, Tooltip, useMap } from "react-leaflet";
import { TRACK_COLORS, ROUTE_START_CLASS, ROUTE_END_CLASS, trackColorIndex, splitTrack } from "./employeeMapRoutes";

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

// Fit the view to everything drawn whenever the data changes
function FitToData({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 17 });
  }, [map, bounds]);
  return null;
}

const fmtDistance = (m) => (m == null ? null : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

function placeText(p) {
  if (!p.siteName) return "No work sites set";
  if (p.insideSite === true) return p.siteName;
  if (p.insideSite === false) return `Outside work sites (${fmtDistance(p.distanceMeters)} from ${p.siteName})`;
  return `Nearest site: ${p.siteName} (${fmtDistance(p.distanceMeters)})`;
}

function PunchPopup({ p, singleDay }) {
  const when = singleDay ? (p.atLocal || "").split(" ").slice(1).join(" ") : p.atLocal;
  return (
    <div className="space-y-0.5 text-sm">
      <p className="font-semibold">{p.employeeName}</p>
      <p>{p.type === "out" ? "Clock-out" : "Clock-in"} {when}</p>
      <p className="text-muted-foreground">{placeText(p)}</p>
      {p.accuracy != null && <p className="text-muted-foreground">±{p.accuracy} m</p>}
    </div>
  );
}

// Point colours as Tailwind classes on the SVG paths (CSS beats Leaflet's attributes)
const POINT_CLASS = {
  in: "fill-emerald-500 stroke-emerald-700",
  out: "fill-blue-500 stroke-blue-700",
};

// ── Routes (BB-128 part 2) ───────────────────────────────────────────────────
// Above this many points in total, only start/end and fake-GPS dots are drawn (SVG
// markers get slow); the lines are always drawn. One employee is always below it.
const MAX_DOTS = 2000;

const pct = (v) => (v == null ? null : `${Math.round(v * 100)}%`);

function BreadcrumbTip({ track, pt }) {
  return (
    <div className="space-y-0.5 text-xs">
      <p className="font-semibold">{track.employeeName}</p>
      <p>{pt.atLocal}</p>
      {pt.accuracy != null && <p>±{Math.round(pt.accuracy)} m</p>}
      {pt.speed != null && <p>{(pt.speed * 3.6).toFixed(1)} km/h · {(pt.speed * 2.23694).toFixed(1)} mph</p>}
      {pt.batteryLevel != null && <p>Battery {pct(pt.batteryLevel)}</p>}
      {pt.isMocked && <p className="font-semibold text-red-600">⚠ Fake GPS reported by the phone</p>}
      {pt.jumpedHere && <p className="font-semibold text-red-600">⚠ Suspicious movement: reached by an impossible move</p>}
    </div>
  );
}

// BB-128 2b: faint dashed link between a punch pin and its route (clock-in pin → first point,
// last point → clock-out pin). Red when the server's pin check says they don't connect.
function PinLink({ from, to, check, label }) {
  if (!from || !to) return null;
  const bad = Boolean(check?.suspicious);
  return (
    <Polyline
      positions={[from, to]}
      pathOptions={{
        className: bad ? "stroke-red-600" : "stroke-neutral-500",
        weight: bad ? 2 : 1.5,
        opacity: bad ? 0.8 : 0.45,
        dashArray: "2 6",
      }}
    >
      {bad && <Tooltip sticky>⚠ {label} doesn&apos;t connect to the route</Tooltip>}
    </Polyline>
  );
}

function RouteLayer({ tracks, intervalMinutes, colorIndex, pinsByLog }) {
  const totalPoints = tracks.reduce((n, t) => n + (t.points?.length || 0), 0);
  const allDots = totalPoints <= MAX_DOTS;
  return tracks.map((t) => {
    const pts = t.points || [];
    if (!pts.length) return null;
    const c = TRACK_COLORS[colorIndex(t.employeeId)];
    const { solid, gaps, jumps } = splitTrack(pts, intervalMinutes);
    const last = pts.length - 1;
    const pins = pinsByLog.get(t.timeLogId) || {};
    return (
      <Fragment key={t.timeLogId}>
        <PinLink from={pins.in} to={[pts[0].lat, pts[0].lng]} check={t.pinChecks?.clockIn} label="Clock-in pin" />
        <PinLink from={[pts[last].lat, pts[last].lng]} to={pins.out} check={t.pinChecks?.clockOut} label="Clock-out pin" />
        {solid.map((run, i) => (
          <Polyline key={`s${i}`} positions={run} pathOptions={{ className: c.stroke, weight: 3, opacity: 0.85 }} />
        ))}
        {gaps.map((seg, i) => (
          <Polyline key={`g${i}`} positions={seg} pathOptions={{ className: c.stroke, weight: 2, opacity: 0.7, dashArray: "6 6" }} />
        ))}
        {/* BB-128 2b: impossible moves — dashed red, never part of the route line */}
        {jumps.map((seg, i) => (
          <Polyline key={`j${i}`} positions={seg} pathOptions={{ className: "stroke-red-600", weight: 2.5, opacity: 0.9, dashArray: "8 6" }}>
            <Tooltip sticky>⚠ Suspicious movement</Tooltip>
          </Polyline>
        ))}
        {pts.map((pt, i) => {
          const isEnd = i === 0 || i === last;
          if (!pt.isMocked && !pt.jumpedHere && !isEnd && !allDots) return null;
          const cls = pt.isMocked || pt.jumpedHere
            ? "fill-red-500 stroke-red-700"
            : i === 0 ? ROUTE_START_CLASS : i === last ? ROUTE_END_CLASS : `${c.fill} ${c.stroke}`;
          return (
            <CircleMarker
              key={`p${i}`}
              center={[pt.lat, pt.lng]}
              radius={pt.isMocked || pt.jumpedHere || isEnd ? 5 : 2.5}
              pathOptions={{ className: cls, weight: isEnd ? 2 : 1, fillOpacity: 1 }}
            >
              <Tooltip><BreadcrumbTip track={t} pt={pt} /></Tooltip>
            </CircleMarker>
          );
        })}
      </Fragment>
    );
  });
}

export default function EmployeeMapCanvas({ data, view, singleDay }) {
  const sites = data?.sites || [];
  const tracks = useMemo(() => (view === "routes" ? data?.layers?.breadcrumbs || [] : []), [data, view]);
  const intervalMinutes = data?.summary?.breadcrumbs?.intervalMinutes || 5;
  const colorIndex = useMemo(() => trackColorIndex(data?.layers?.breadcrumbs || []), [data]);
  const heat = data?.heat || [];
  const points = useMemo(
    () => [
      ...(data?.layers?.clockIn || []).map((p) => ({ ...p, type: "in" })),
      ...(data?.layers?.clockOut || []).map((p) => ({ ...p, type: "out" })),
    ],
    [data]
  );

  // BB-128 2b: timeLogId → { in: [lat, lng], out: [lat, lng] } for the pin-to-route links
  const pinsByLog = useMemo(() => {
    const map = new Map();
    points.forEach((p) => {
      if (!p.timeLogId || p.lat == null || p.lng == null) return;
      const entry = map.get(p.timeLogId) || {};
      entry[p.type] = [p.lat, p.lng];
      map.set(p.timeLogId, entry);
    });
    return map;
  }, [points]);

  const bounds = useMemo(() => {
    const latlngs = [
      ...points.map((p) => [p.lat, p.lng]),
      ...tracks.flatMap((t) => (t.points || []).map((pt) => [pt.lat, pt.lng])),
      ...sites.filter((s) => s.latitude != null && s.longitude != null).map((s) => [s.latitude, s.longitude]),
    ];
    return latlngs.length ? L.latLngBounds(latlngs) : null;
  }, [points, sites, tracks]);

  return (
    <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom className="h-full w-full z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToData bounds={bounds} />

      {/* Work sites — always shown */}
      {sites.filter((s) => s.latitude != null && s.longitude != null).map((s) =>
        s.radius != null ? (
          <Circle
            key={s.id}
            center={[s.latitude, s.longitude]}
            radius={s.radius}
            pathOptions={{ className: "fill-orange-500/10 stroke-orange-500", dashArray: "6 4", weight: 2 }}
          >
            <Tooltip>{s.name} ({s.radius} m)</Tooltip>
          </Circle>
        ) : (
          <Marker key={s.id} position={[s.latitude, s.longitude]}>
            <Tooltip>{s.name}</Tooltip>
          </Marker>
        )
      )}

      {view === "routes" && <RouteLayer tracks={tracks} intervalMinutes={intervalMinutes} colorIndex={colorIndex} pinsByLog={pinsByLog} />}

      {view === "heat" ? (
        <HeatLayer points={heat} />
      ) : (
        points.map((p) => (
          <CircleMarker
            key={`${p.type}-${p.timeLogId}`}
            center={[p.lat, p.lng]}
            radius={6}
            pathOptions={{ className: POINT_CLASS[p.type], weight: 1.5, fillOpacity: 0.85 }}
          >
            <Popup><PunchPopup p={p} singleDay={singleDay} /></Popup>
          </CircleMarker>
        ))
      )}
    </MapContainer>
  );
}
