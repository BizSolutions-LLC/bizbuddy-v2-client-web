/* components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeeMap.jsx */
"use client";

// Look (2026-11-25, Carlo): pilot of the landing page's style inside the dashboard — see the
// "Pilot look" helpers below. Data, filters and polling are unchanged.
// BB-128: Employee Map, where employees clocked in and out, their routes and (admins) where
// they are now. Scope is the server's: admins the company, supervisors their department +
// direct reports. Privacy: exact locations, so responses are never cached or stored
// (no-store, nothing in local/session storage). Only the chosen map style is remembered.
// Map views (2026-11-25): three tabs, each with its own endpoint, loaded only when opened
// and again when its filters change:
//   Clock-in / out → GET /api/employee-map/punches  (initials pins; heat map as a toggle)
//   Routes         → GET /api/employee-map/routes   (one day or one employee, else summary.reason)
//   Live           → GET /api/employee-map/live     (admins + superadmin only; polled every
//                    refreshSeconds while the tab is open and the browser tab is visible)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BatteryLow, BatteryMedium, BatteryFull, RefreshCw, X } from "lucide-react";
import useAuthStore from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DISTANCE_UNITS, BASEMAPS, BASEMAP_OPTIONS, DEFAULT_BASEMAP, BASEMAP_STORAGE_KEY,
  fmtTrackDistance, fmtClock, fmtAgo, fmtBattery, suspiciousLines,
} from "./employeeMapRoutes";

const EmployeeMapCanvas = dynamic(() => import("./EmployeeMapCanvas"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const ALL = "all";
const MAX_RANGE_DAYS = 31;
const LIVE_TICK_MS = 30000; // re-count "Seen X min ago" between polls
const TYPES = [
  { id: "both", label: "Both" },
  { id: "in", label: "Clock-in" },
  { id: "out", label: "Clock-out" },
];
const PUNCH_VIEWS = [
  { id: "pins", label: "Pins" },
  { id: "heat", label: "Heat map" },
];
const TABS = [
  { id: "punches", label: "Clock-in / out", path: "punches" },
  { id: "routes", label: "Routes", path: "routes" },
  { id: "live", label: "Live", path: "live", adminOnly: true },
];
const EMPTY_TAB = { data: null, error: null, loading: false, key: null, fetchedAt: 0 };
const dayCount = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000 + 1;

// Query per tab: Live takes only the department; Routes has no punch type
function buildQuery(tab, f) {
  const qp = new URLSearchParams();
  if (f.departmentId !== ALL) qp.set("departmentId", f.departmentId);
  if (tab === "live") return qp;
  if (f.from && f.to) { qp.set("from", f.from); qp.set("to", f.to); }
  else if (f.date) qp.set("date", f.date);
  if (tab === "punches") qp.set("type", f.type);
  if (f.userId !== ALL) qp.set("userId", f.userId);
  return qp;
}

// ── Pilot look (2026-11-25): the landing page's style inside the dashboard ──
// Inter Tight titles (font-display), 2px corners (rounded-brand), flat bordered surfaces and
// brand orange only as thin accents (accent-brand: tab marker, stat rules, selected row).
const SURFACE = "rounded-brand border bg-card";

// Small segmented control on the Button primitive (square corners)
function Segmented({ options, value, onChange, disabled }) {
  return (
    <div className="inline-flex rounded-brand border p-0.5 gap-0.5" role="group">
      {options.map((o) => (
        <Button
          key={o.id}
          type="button"
          size="sm"
          variant={value === o.id ? "secondary" : "ghost"}
          className="h-7 rounded-[1px] px-2.5 text-xs font-semibold"
          aria-pressed={value === o.id}
          disabled={disabled}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

// Page tabs: underline style, orange marker on the active tab
function TabBar({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-x-6 border-b">
      {tabs.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 pb-2.5 pt-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? "border-accent-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// Flat stat row: thin orange rule, big neutral number (the landing's highlights band)
function StatRow({ items, loading, cols = "lg:grid-cols-4" }) {
  return (
    <div className={`grid grid-cols-2 ${cols} gap-x-8 gap-y-5`}>
      {items.map((s) => (
        <div key={s.label} className="border-l-[3px] border-accent-brand pl-4">
          <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
          {loading ? (
            <Skeleton className="mt-1.5 h-8 w-14" />
          ) : (
            <p className="font-display text-3xl font-bold leading-tight tracking-[-0.02em] tabular-nums">{s.value}</p>
          )}
          {s.sub && <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// Side panel list row: orange left marker when selected
const rowClass = (selected) =>
  `w-full text-left py-2.5 px-4 border-l-2 transition-colors ${
    selected ? "border-accent-brand bg-muted/50" : "border-transparent hover:bg-muted/40"
  }`;

const FilterField = ({ label, htmlFor, children }) => (
  <div className="space-y-1">
    <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{label}</Label>
    <div>{children}</div>
  </div>
);

// Initials badge for the side panels and legend. `color` is the server's per-employee colour
// (a runtime value, so inline); the legend passes none and gets a neutral token instead.
const HEX = /^#[0-9a-f]{3,8}$/i;
function InitialsBadge({ initials, color, ring = false, faded = false, mocked = false, small = false }) {
  const hasColor = HEX.test(color || "");
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none text-white",
        small ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]",
        hasColor ? "" : "bg-neutral-600",
        ring ? "ring-2 ring-inset ring-white" : "",
        faded ? "opacity-50" : "",
        mocked ? "outline outline-2 outline-offset-1 outline-red-600" : "",
      ].filter(Boolean).join(" ")}
      style={hasColor ? { background: color } : undefined}
    >
      {(initials || "?").slice(0, 3)}
    </span>
  );
}

function BatteryIcon({ level }) {
  const label = fmtBattery(level);
  if (!label) return null;
  const Icon = level < 0.2 ? BatteryLow : level < 0.7 ? BatteryMedium : BatteryFull;
  return (
    <span className={`inline-flex items-center gap-0.5 ${level < 0.2 ? "text-red-600" : ""}`} title={`Battery ${label}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

const LegendDot = ({ className, children }) => (
  <span className="flex items-center gap-1"><span className={className} />{children}</span>
);

const sumField = (summary, field) =>
  ["clockIn", "clockOut"].reduce((n, k) => n + (summary?.[k]?.[field] ?? 0), 0);

export default function EmployeeMap() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;

  const [tab, setTab] = useState("punches");
  const [role, setRole] = useState(null);
  const isAdmin = ["admin", "superadmin"].includes((role || "").toLowerCase());

  // Filters (shared by the tabs; each tab uses the ones it takes)
  const [rangeMode, setRangeMode] = useState(false);
  const [date, setDate] = useState("");          // single day; filled from the server's default (today, company zone)
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("both");
  const [departmentId, setDepartmentId] = useState(ALL);
  const [userId, setUserId] = useState(ALL);
  const [punchView, setPunchView] = useState("pins");
  const [unit, setUnit] = useState("mi"); // route distances, mi or km
  const [basemap, setBasemap] = useState(DEFAULT_BASEMAP);

  const [departments, setDepartments] = useState([]);
  const [roster, setRoster] = useState([]);       // { id, name } from the last call without userId
  const [tabs, setTabs] = useState({ punches: EMPTY_TAB, routes: EMPTY_TAB, live: EMPTY_TAB });
  const [focus, setFocus] = useState(null);       // Live: { lat, lng } to fly to
  const [now, setNow] = useState(() => Date.now());
  const seqRef = useRef({ punches: 0, routes: 0, live: 0 }); // drop out-of-order responses

  const rangeError = rangeMode
    ? !from || !to
      ? "Pick both dates."
      : from > to
        ? "The start date must be on or before the end date."
        : dayCount(from, to) > MAX_RANGE_DAYS
          ? `The range can be at most ${MAX_RANGE_DAYS} days.`
          : null
    : null;

  const filters = useMemo(
    () => ({ date, from: rangeMode ? from : "", to: rangeMode ? to : "", type, departmentId, userId }),
    [date, from, to, rangeMode, type, departmentId, userId]
  );

  // ── Map style: per-browser convenience (style id only) ──
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(BASEMAP_STORAGE_KEY);
      if (saved && Object.hasOwn(BASEMAPS, saved)) setBasemap(saved); // own keys only
    } catch { /* storage blocked: keep the default */ }
  }, []);
  const chooseBasemap = (id) => {
    setBasemap(id);
    try { window.localStorage.setItem(BASEMAP_STORAGE_KEY, id); } catch { /* ignore */ }
  };

  // ── Role (Live tab is admins + superadmin only) and departments for the filter ──
  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`${API}/api/account/profile`, { headers })
      .then((r) => r.json())
      .then((j) => setRole(j.data?.user?.role || null))
      .catch(() => {});
    fetch(`${API}/api/departments`, { headers })
      .then((r) => r.json())
      .then((j) => setDepartments(Array.isArray(j.data) ? j.data : []))
      .catch(() => {});
  }, [token, API]);

  // ── Load one tab ──
  const load = useCallback(async (which, f, { quiet = false } = {}) => {
    const qp = buildQuery(which, f);
    const key = `${which}?${qp}`;
    const seq = ++seqRef.current[which];
    setTabs((t) => ({ ...t, [which]: { ...t[which], loading: !quiet, error: quiet ? t[which].error : null, key } }));
    try {
      const res = await fetch(`${API}/api/employee-map/${which}?${qp}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || `Failed to load the Employee Map (${res.status})`);
      if (seq !== seqRef.current[which]) return;
      const d = j.data || {};
      let loadedKey = key;
      // First load: show the server's default day (today in the company zone) without fetching it twice
      if (which !== "live" && !f.date && !f.from && d.filters?.from) {
        const day = d.filters.from;
        setDate(day); setFrom(day); setTo(d.filters.to || day);
        loadedKey = `${which}?${buildQuery(which, { ...f, date: day })}`;
      }
      setTabs((t) => ({ ...t, [which]: { data: d, error: null, loading: false, key: loadedKey, fetchedAt: Date.now() } }));
      if (f.userId === ALL && which === "punches") {
        setRoster((d.employees || []).map((e) => ({ id: e.id, name: e.name })));
      } else if (f.userId === ALL && which === "routes" && d.tracks?.length) {
        const seen = new Map();
        d.tracks.forEach((tr) => { if (!seen.has(tr.employeeId)) seen.set(tr.employeeId, { id: tr.employeeId, name: tr.employeeName }); });
        setRoster([...seen.values()].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      }
    } catch (e) {
      if (seq !== seqRef.current[which]) return;
      setTabs((t) => ({ ...t, [which]: { ...t[which], loading: false, error: e.message } }));
    }
  }, [API, token]);

  // Punches / Routes: load when the tab is open and its filters differ from what it shows
  useEffect(() => {
    if (!token || tab === "live" || rangeError) return;
    const key = `${tab}?${buildQuery(tab, filters)}`;
    if (tabs[tab].key === key) return;
    load(tab, filters);
  }, [token, tab, filters, rangeError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live: load on open and on department change, then poll every refreshSeconds while the
  // browser tab is visible. Stops when the tab closes.
  const refreshSeconds = tabs.live.data?.refreshSeconds || 60;
  useEffect(() => {
    if (!token || tab !== "live" || !isAdmin) return;
    const f = { ...filters };
    load("live", f);
    const poll = () => { if (document.visibilityState === "visible") load("live", f, { quiet: true }); };
    const timer = setInterval(poll, refreshSeconds * 1000);
    const tick = setInterval(() => setNow(Date.now()), LIVE_TICK_MS);
    const onVisible = () => { if (document.visibilityState === "visible") { setNow(Date.now()); poll(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); clearInterval(tick); document.removeEventListener("visibilitychange", onVisible); };
  }, [token, tab, isAdmin, departmentId, refreshSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  // A non-admin can never sit on Live (e.g. role loaded after the tab was chosen)
  useEffect(() => { if (tab === "live" && role && !isAdmin) setTab("punches"); }, [tab, role, isAdmin]);

  const current = tabs[tab];
  const data = current.data;
  const loading = current.loading;
  const error = current.error;
  const tz = data?.company?.timeZone || tabs.punches.data?.company?.timeZone || tabs.routes.data?.company?.timeZone;
  const singleDay = data?.filters ? data.filters.from === data.filters.to : true;
  const selectedEmployee = userId !== ALL ? roster.find((e) => e.id === userId) : null;
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  const refresh = () => {
    if (tab !== "live" && rangeError) return;
    load(tab, filters);
  };

  // ── Clock-in / out ──
  const summary = tab === "punches" ? data?.summary : null;
  const withoutLocation = sumField(summary, "withoutLocation");
  const punchTiles = [
    { label: "Punches", field: "punches" },
    { label: "With location", field: "withLocation" },
    { label: "No location", field: "withoutLocation" },
    { label: "Outside work sites", field: "outsideSites" },
  ];

  // ── Routes ──
  const routes = tab === "routes" ? data : null;
  const crumbs = routes?.summary;
  const tracks = routes?.tracks || [];
  const routesNotice = !routes
    ? null
    : crumbs?.enabled === false && !tracks.length
      ? "Location tracking is off. An admin can turn it on in Configurations → Trial Features."
      : crumbs && crumbs.available === false
        ? crumbs.reason || "Pick one day or one employee to see routes."
        : !tracks.length
          ? "No routes for these filters."
          : null;
  const fmtSpan = (t) => {
    const day = singleDay ? "" : `${new Date(t.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz || "UTC" })}, `;
    return `${day}${fmtClock(t.startedAt, tz)} – ${t.endedAt ? fmtClock(t.endedAt, tz) : "still clocked in"}`;
  };

  // ── Live ──
  const live = tab === "live" ? data : null;
  const liveTz = tz || (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined);
  const liveFetchedAt = tabs.live.fetchedAt;
  const ageOf = useCallback(
    (e) => (e.position?.ageSeconds == null ? null : e.position.ageSeconds + Math.max(0, (now - liveFetchedAt) / 1000)),
    [now, liveFetchedAt]
  );
  const liveEmployees = useMemo(
    () => [...(live?.employees || [])].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [live]
  );
  const liveTiles = [
    { label: "Clocked in", field: "clockedIn" },
    { label: "Live", field: "live" },
    { label: "Stale", field: "stale" },
    { label: "At clock-in only", field: "clockInOnly" },
    { label: "No location yet", field: "noPosition" },
  ];
  const liveLabel = (e) => {
    const p = e.position;
    if (!p) return "No location yet";
    if (p.source === "clockIn") return `At clock-in, ${fmtClock(p.at || e.clockedInAt, liveTz)}`;
    return `Seen ${fmtAgo(ageOf(e))}${p.stale ? " (stale)" : ""}`;
  };

  const fitKey = tab === "live" ? `live?${departmentId}` : `${current.key}@${current.fetchedAt}`;

  const showDates = tab !== "live";
  const showEmployee = tab !== "live";

  const punchStats = punchTiles.map((t) => ({
    label: t.label,
    value: t.field === "outsideSites" && !data?.sites?.length ? "—" : sumField(summary, t.field),
    sub: summary?.clockIn || summary?.clockOut
      ? [summary?.clockIn && `In ${summary.clockIn[t.field] ?? "—"}`, summary?.clockOut && `Out ${summary.clockOut[t.field] ?? "—"}`].filter(Boolean).join(" · ")
      : null,
  }));
  const liveStats = liveTiles.map((t) => ({ label: t.label, value: live?.summary?.[t.field] ?? "—" }));
  const panelCount = !data ? null : tab === "routes" ? tracks.length : tab === "live" ? liveEmployees.length : data.employees?.length || 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="mb-1.5 text-sm font-bold text-muted-foreground">Locations</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold leading-[1.1] tracking-[-0.02em]">Employee Map</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Where employees clocked in and out, their routes during shifts{isAdmin && ", and where they are now"}.
            {tz && <> Times are in the company time zone ({tz}).</>}
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-brand font-semibold" onClick={refresh} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {/* Tabs + filters */}
      <div className="space-y-4">
        <TabBar tabs={visibleTabs} value={tab} onChange={(id) => { setFocus(null); setTab(id); }} />
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          {showDates && (
            <>
              <FilterField label="Dates">
                <Segmented
                  options={[{ id: "day", label: "One day" }, { id: "range", label: "Range" }]}
                  value={rangeMode ? "range" : "day"}
                  onChange={(v) => {
                    const toRange = v === "range";
                    if (toRange && !from) { setFrom(date); setTo(date); }
                    setRangeMode(toRange);
                  }}
                />
              </FilterField>
              {rangeMode ? (
                <>
                  <FilterField label="From" htmlFor="em-from">
                    <Input id="em-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-8 w-40 rounded-brand" />
                  </FilterField>
                  <FilterField label="To" htmlFor="em-to">
                    <Input id="em-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-8 w-40 rounded-brand" />
                  </FilterField>
                </>
              ) : (
                <FilterField label="Date" htmlFor="em-date">
                  <Input id="em-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-8 w-40 rounded-brand" />
                </FilterField>
              )}
            </>
          )}
          {tab === "punches" && (
            <FilterField label="Punches">
              <Segmented options={TYPES} value={type} onChange={setType} />
            </FilterField>
          )}
          <FilterField label="Department">
            <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setUserId(ALL); }}>
              <SelectTrigger className="h-8 w-48 rounded-brand"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All departments</SelectItem>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FilterField>
          {showEmployee && (
            <FilterField label="Employee">
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="h-8 w-52 rounded-brand"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All employees</SelectItem>
                  {roster.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
          )}
          {selectedEmployee && tab !== "live" && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs rounded-brand" onClick={() => setUserId(ALL)}>
              <X /> Show everyone
            </Button>
          )}
        </div>
        {showDates && rangeError && <p className="text-xs text-destructive">{rangeError}</p>}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Stats: Clock-in / out */}
      {tab === "punches" && (
        <div className="space-y-3">
          <StatRow items={punchStats} loading={loading && !data} />
          {withoutLocation > 0 && (
            <p className="text-sm text-muted-foreground">
              {withoutLocation} punch{withoutLocation === 1 ? " has" : "es have"} no location (entered by an admin, imported,
              or location was off), so {withoutLocation === 1 ? "it isn't" : "they aren't"} on the map.
            </p>
          )}
        </div>
      )}

      {/* Stats: Live */}
      {tab === "live" && (
        <div className="space-y-3">
          {live?.tracking?.enabled === false && (
            <p className="text-sm text-muted-foreground border-l-2 border-accent-brand pl-3">
              Location tracking is off for this company. Showing clock-in locations only.
            </p>
          )}
          <StatRow items={liveStats} loading={loading && !live} cols="lg:grid-cols-5" />
        </div>
      )}

      {/* Map + side panel */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section className={`${SURFACE} min-w-0 overflow-hidden`} aria-label="Map">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 flex-wrap border-b px-3 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              {tab === "punches" && <Segmented options={PUNCH_VIEWS} value={punchView} onChange={setPunchView} />}
              {tab === "routes" && <Segmented options={DISTANCE_UNITS} value={unit} onChange={setUnit} />}
              {tab === "live" && live?.generatedAt && (
                <span className="text-xs text-muted-foreground">
                  Updated {fmtClock(live.generatedAt, liveTz)} · refreshes every {refreshSeconds} s
                </span>
              )}
            </div>
            {BASEMAP_OPTIONS.length > 1 && <Segmented options={BASEMAP_OPTIONS} value={basemap} onChange={chooseBasemap} />}
          </div>
          {tab === "routes" && (routesNotice || crumbs?.truncated) && (
            <div className="border-b px-3 py-2 space-y-1 text-sm text-muted-foreground">
              {routesNotice && <p>{routesNotice}</p>}
              {crumbs?.truncated && (
                <p>Only the first 50,000 points are shown. Pick one employee to see the full route.</p>
              )}
            </div>
          )}
          <div className="h-[28rem] sm:h-[34rem] relative">
            {data ? (
              <EmployeeMapCanvas
                mode={tab}
                data={data}
                punchView={punchView}
                singleDay={singleDay}
                basemap={basemap}
                fitKey={fitKey}
                focus={tab === "live" ? focus : null}
                ageOf={ageOf}
                tz={liveTz}
              />
            ) : (
              <Skeleton className="h-full w-full rounded-none" />
            )}
          </div>
          {/* Legend */}
          <div className="border-t px-3 py-2 flex items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground flex-wrap">
            {(tab === "routes" || (tab === "punches" && punchView === "pins")) && (
              <>
                <span className="flex items-center gap-1.5"><InitialsBadge initials="AB" small />Clock-in</span>
                <span className="flex items-center gap-1.5"><InitialsBadge initials="AB" ring small />Clock-out</span>
              </>
            )}
            {tab === "routes" && (
              <>
                <LegendDot className="h-2.5 w-2.5 rounded-full border-2 border-foreground bg-background">Start</LegendDot>
                <LegendDot className="h-2.5 w-2.5 rounded-full bg-foreground">End</LegendDot>
                <LegendDot className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30">Low accuracy</LegendDot>
                <LegendDot className="w-4 border-t-2 border-dashed border-muted-foreground">No location</LegendDot>
                <LegendDot className="h-2.5 w-2.5 rounded-full bg-red-500">Fake GPS</LegendDot>
                <LegendDot className="w-4 border-t-2 border-dashed border-red-600">Suspicious movement</LegendDot>
              </>
            )}
            {tab === "live" && (
              <>
                <span className="flex items-center gap-1.5"><InitialsBadge initials="AB" small />Current</span>
                <span className="flex items-center gap-1.5"><InitialsBadge initials="AB" faded small />Stale</span>
                <span className="flex items-center gap-1.5"><InitialsBadge initials="AB" mocked small />Fake GPS</span>
              </>
            )}
            <LegendDot className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-orange-500">Work site</LegendDot>
          </div>
        </section>

        {/* Side panel */}
        <section className={`${SURFACE} min-w-0 self-start overflow-hidden`} aria-label="List">
          <div className="flex items-baseline gap-2 border-b px-4 py-3">
            <h2 className="font-display text-base font-bold tracking-[-0.01em]">
              {tab === "routes" ? "Routes" : tab === "live" ? "Clocked in now" : "Employees"}
            </h2>
            {panelCount != null && <span className="text-sm text-muted-foreground tabular-nums">{panelCount}</span>}
            {tab === "routes" && crumbs?.suspiciousTracks > 0 && (
              <span className="ml-auto text-xs font-semibold text-red-600">⚠ {crumbs.suspiciousTracks} suspicious</span>
            )}
          </div>
          <div className="max-h-[32rem] overflow-y-auto">
            {loading && !data ? (
              <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : tab === "routes" ? (
              !tracks.length ? (
                <p className="p-4 text-sm text-muted-foreground">{routesNotice || "No routes for these filters."}</p>
              ) : (
                <TooltipProvider delayDuration={200}>
                  <ul className="divide-y">
                    {tracks.map((t) => (
                      <li key={t.timeLogId}>
                        <button
                          type="button"
                          onClick={() => setUserId(userId === t.employeeId ? ALL : t.employeeId)}
                          aria-pressed={userId === t.employeeId}
                          className={rowClass(userId === t.employeeId)}
                        >
                          <p className="text-sm font-semibold truncate flex items-center gap-2">
                            <InitialsBadge initials={t.initials} color={t.color} />
                            {t.employeeName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-1">{fmtSpan(t)}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmtTrackDistance(t.distanceMeters, unit)} · {t.pointCount} point{t.pointCount === 1 ? "" : "s"}
                            {t.gaps?.length > 0 && <> · {t.gaps.length} gap{t.gaps.length === 1 ? "" : "s"}</>}
                            {t.mockedPoints > 0 && <span className="text-red-600"> · ⚠ {t.mockedPoints} fake GPS</span>}
                          </p>
                          {t.lowAccuracyPoints > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {t.lowAccuracyPoints} low-accuracy point{t.lowAccuracyPoints === 1 ? "" : "s"} (over 100 m), not counted in distance
                            </p>
                          )}
                          {/* BB-128 2b: impossible moves + route not connecting to its punch pins */}
                          {t.suspicious > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="mt-1 inline-flex items-center rounded-brand border border-red-300 px-1.5 py-0.5 text-[11px] font-semibold text-red-600 dark:border-red-800">
                                  ⚠ Suspicious movement ({t.suspicious})
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <ul className="space-y-0.5 text-xs">
                                  {suspiciousLines(t, unit, tz).map((line, i) => <li key={i}>{line}</li>)}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {t.gaps?.map((g, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              No location {fmtClock(g.from, tz)}–{fmtClock(g.to, tz)} ({g.minutes} min)
                            </p>
                          ))}
                        </button>
                      </li>
                    ))}
                  </ul>
                </TooltipProvider>
              )
            ) : tab === "live" ? (
              !liveEmployees.length ? (
                <p className="p-4 text-sm text-muted-foreground">Nobody is clocked in right now.</p>
              ) : (
                <ul className="divide-y">
                  {liveEmployees.map((e) => {
                    const p = e.position;
                    const selected = Boolean(p && focus && focus.lat === p.lat && focus.lng === p.lng);
                    return (
                      <li key={e.timeLogId || e.employeeId}>
                        <button
                          type="button"
                          disabled={!p}
                          onClick={() => p && setFocus({ lat: p.lat, lng: p.lng, at: Date.now() })}
                          className={`${rowClass(selected)} disabled:cursor-default disabled:hover:bg-transparent`}
                        >
                          <p className="text-sm font-semibold truncate flex items-center gap-2">
                            <InitialsBadge initials={e.initials} color={e.color} faded={!p || p.stale} mocked={p?.isMocked} />
                            {e.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {[e.employeeCode, e.department].filter(Boolean).join(" · ") || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span>{liveLabel(e)}</span>
                            {p?.batteryLevel != null && <BatteryIcon level={p.batteryLevel} />}
                          </p>
                          {p?.isMocked && <p className="text-xs font-semibold text-red-600">⚠ Fake GPS reported by the phone</p>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : !data?.employees?.length ? (
              <p className="p-4 text-sm text-muted-foreground">No punches for these filters.</p>
            ) : (
              <ul className="divide-y">
                {data.employees.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setUserId(userId === e.id ? ALL : e.id)}
                      aria-pressed={userId === e.id}
                      className={rowClass(userId === e.id)}
                    >
                      <p className="text-sm font-semibold truncate flex items-center gap-2">
                        <InitialsBadge initials={e.initials} color={e.color} />
                        {e.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {[e.employeeId, e.department].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        In {e.clockIns} · Out {e.clockOuts}
                        {e.withoutLocation > 0 && <> · {e.withoutLocation} no location</>}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
