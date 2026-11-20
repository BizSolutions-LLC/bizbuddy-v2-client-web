/* components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeeMap.jsx */
"use client";

// BB-128 (part 1 of GPS Breadcrumbs): Employee Map — where employees clocked in and out.
// Data: GET /api/employee-map (server v2.11.14). Supervisors see their department + direct
// reports, admins the whole company; the server decides. Privacy: exact punch locations, so
// the response is never cached or stored (no-store, nothing in local/session storage).
// BB-128 part 2: "Routes" view — breadcrumb tracks (data.layers.breadcrumbs), recorded by the
// mobile app while clocked in when Configurations → Trial Features → Track location is on.
// Routes come back only for one day or one employee; otherwise summary.breadcrumbs.reason.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MapPinned, RefreshCw, X } from "lucide-react";
import useAuthStore from "@/store/useAuthStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TRACK_COLORS, trackColorIndex, DISTANCE_UNITS, fmtTrackDistance, fmtClock, suspiciousLines } from "./employeeMapRoutes";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const EmployeeMapCanvas = dynamic(() => import("./EmployeeMapCanvas"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const ALL = "all";
const MAX_RANGE_DAYS = 31;
const TYPES = [
  { id: "both", label: "Both" },
  { id: "in", label: "Clock-in" },
  { id: "out", label: "Clock-out" },
];
const VIEWS = [
  { id: "heat", label: "Heat map" },
  { id: "points", label: "Points" },
  { id: "routes", label: "Routes" }, // BB-128 part 2
];
const dayCount = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000 + 1;

// Small segmented control on the Button primitive
function Segmented({ options, value, onChange, disabled }) {
  return (
    <div className="inline-flex rounded-md border p-0.5 gap-0.5" role="group">
      {options.map((o) => (
        <Button
          key={o.id}
          type="button"
          size="sm"
          variant={value === o.id ? "secondary" : "ghost"}
          className="h-8"
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

const sumField = (summary, field) =>
  ["clockIn", "clockOut"].reduce((n, k) => n + (summary?.[k]?.[field] ?? 0), 0);

export default function EmployeeMap() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;

  // Filters
  const [rangeMode, setRangeMode] = useState(false);
  const [date, setDate] = useState("");          // single day; filled from the server's default (today, company zone)
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("both");
  const [departmentId, setDepartmentId] = useState(ALL);
  const [userId, setUserId] = useState(ALL);
  const [view, setView] = useState("heat");
  const [unit, setUnit] = useState("mi"); // BB-128 part 2: route distances, mi or km

  const [departments, setDepartments] = useState([]);
  const [roster, setRoster] = useState([]);       // employees from the last call without userId
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const skipReloadRef = useRef(false); // the first response fills the date; don't fetch it twice

  const rangeError = rangeMode
    ? !from || !to
      ? "Pick both dates."
      : from > to
        ? "The start date must be on or before the end date."
        : dayCount(from, to) > MAX_RANGE_DAYS
          ? `The range can be at most ${MAX_RANGE_DAYS} days.`
          : null
    : null;

  // ── Departments for the filter (the map call is still scoped by the server) ──
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/departments`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setDepartments(Array.isArray(j.data) ? j.data : []))
      .catch(() => {});
  }, [token, API]);

  // ── Map data ──
  const load = useCallback(async (params) => {
    setLoading(true); setError(null);
    try {
      const qp = new URLSearchParams();
      if (params.from && params.to) { qp.set("from", params.from); qp.set("to", params.to); }
      else if (params.date) qp.set("date", params.date);
      qp.set("type", params.type);
      if (params.departmentId !== ALL) qp.set("departmentId", params.departmentId);
      if (params.userId !== ALL) qp.set("userId", params.userId);
      const res = await fetch(`${API}/api/employee-map?${qp}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || `Failed to load the Employee Map (${res.status})`);
      const d = j.data;
      setData(d);
      if (params.userId === ALL) setRoster(d.employees || []);
      // First load: show the server's default day (today in the company zone)
      if (!params.date && !params.from) { skipReloadRef.current = true; setDate(d.filters?.from || ""); setFrom(d.filters?.from || ""); setTo(d.filters?.to || ""); }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [API, token]);

  const current = { date, from: rangeMode ? from : "", to: rangeMode ? to : "", type, departmentId, userId };

  // Initial load, then reload whenever a filter changes (dates only when valid)
  useEffect(() => {
    if (!token) return;
    if (rangeError) return;
    if (skipReloadRef.current) { skipReloadRef.current = false; return; }
    load(rangeMode ? current : { ...current, from: "", to: "" });
  }, [token, rangeMode, date, from, to, type, departmentId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = data?.summary;
  const withoutLocation = sumField(summary, "withoutLocation");
  const tz = data?.company?.timeZone;
  const singleDay = data?.filters ? data.filters.from === data.filters.to : true;

  const tiles = [
    { label: "Punches", field: "punches", cls: "text-foreground" },
    { label: "With location", field: "withLocation", cls: "text-green-600" },
    { label: "No location", field: "withoutLocation", cls: "text-orange-600" },
    { label: "Outside work sites", field: "outsideSites", cls: "text-red-600" },
  ];

  const selectedEmployee = userId !== ALL ? roster.find((e) => e.id === userId) : null;

  // ── Routes (BB-128 part 2) ──
  const crumbs = summary?.breadcrumbs;
  const tracks = data?.layers?.breadcrumbs || [];
  const colorIndex = useMemo(() => trackColorIndex(data?.layers?.breadcrumbs || []), [data]);
  const routesNotice = !data || view !== "routes"
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

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapPinned className="h-6 w-6 text-orange-500" />
            Employee Map
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Where employees clocked in and out, and their routes during shifts.{tz && <> Times are in the company time zone ({tz}).</>}
          </p>
        </div>
        <Button variant="outline" onClick={() => !rangeError && load(rangeMode ? current : { ...current, from: "", to: "" })} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dates</Label>
              <div>
                <Segmented
                  options={[{ id: "day", label: "One day" }, { id: "range", label: "Range" }]}
                  value={rangeMode ? "range" : "day"}
                  onChange={(v) => {
                    const toRange = v === "range";
                    if (toRange && !from) { setFrom(date); setTo(date); }
                    setRangeMode(toRange);
                  }}
                />
              </div>
            </div>
            {rangeMode ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="em-from" className="text-xs">From</Label>
                  <Input id="em-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="w-40" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="em-to" className="text-xs">To</Label>
                  <Input id="em-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="w-40" />
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="em-date" className="text-xs">Date</Label>
                <Input id="em-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-40" />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Punches</Label>
              <div><Segmented options={TYPES} value={type} onChange={setType} /></div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Department</Label>
              <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setUserId(ALL); }}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All departments</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Employee</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All employees</SelectItem>
                  {roster.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {rangeError && <p className="text-xs text-destructive">{rangeError}</p>}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Card key={t.field}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading && !data ? <Skeleton className="h-7 w-16" /> : (
                <>
                  <p className={`text-2xl font-bold ${t.cls}`}>
                    {t.field === "outsideSites" && !data?.sites?.length ? "—" : sumField(summary, t.field)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {summary?.clockIn && <>In {summary.clockIn[t.field] ?? "—"}</>}
                    {summary?.clockIn && summary?.clockOut && " · "}
                    {summary?.clockOut && <>Out {summary.clockOut[t.field] ?? "—"}</>}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {withoutLocation > 0 && (
        <p className="text-sm text-muted-foreground">
          {withoutLocation} punch{withoutLocation === 1 ? " has" : "es have"} no location (entered by an admin, imported,
          or location was off), so {withoutLocation === 1 ? "it isn't" : "they aren't"} on the map.
        </p>
      )}

      {/* Map + employee list */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0 flex-wrap">
            <Segmented options={VIEWS} value={view} onChange={setView} />
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {view === "routes" && (
                <>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-foreground bg-background" />Start</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-foreground" />End</span>
                  <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-muted-foreground" />No location</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Fake GPS</span>
                  <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-red-600" />Suspicious movement</span>
                  <Segmented options={DISTANCE_UNITS} value={unit} onChange={setUnit} />
                </>
              )}
              {view !== "heat" && (
                <>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Clock-in</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />Clock-out</span>
                </>
              )}
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-orange-500" />Work site</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {(routesNotice || (view === "routes" && crumbs?.truncated)) && (
              <div className="px-6 pb-3 space-y-1 text-sm text-muted-foreground">
                {routesNotice && <p>{routesNotice}</p>}
                {view === "routes" && crumbs?.truncated && (
                  <p className="text-orange-600">Only the first 50,000 points are shown. Pick one employee to see the full route.</p>
                )}
              </div>
            )}
            <div className="h-[28rem] sm:h-[34rem] relative">
              {data ? <EmployeeMapCanvas data={data} view={view} singleDay={singleDay} /> : <Skeleton className="h-full w-full rounded-none" />}
            </div>
          </CardContent>
        </Card>

        {view === "routes" ? (
        <Card className="min-w-0 self-start">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Routes
              {data && <span className="ml-2 text-sm font-normal text-muted-foreground">{tracks.length}</span>}
              {crumbs?.suspiciousTracks > 0 && (
                <span className="ml-2 text-sm font-normal text-red-600">· ⚠ {crumbs.suspiciousTracks} suspicious</span>
              )}
            </CardTitle>
            {selectedEmployee && (
              <Button variant="ghost" size="sm" className="h-7 px-2 w-fit text-xs" onClick={() => setUserId(ALL)}>
                <X /> Show everyone
              </Button>
            )}
          </CardHeader>
          <CardContent className="max-h-[30rem] overflow-y-auto">
            {loading && !data ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !tracks.length ? (
              <p className="text-sm text-muted-foreground">{routesNotice || "No routes for these filters."}</p>
            ) : (
              <TooltipProvider delayDuration={200}>
              <ul className="divide-y">
                {tracks.map((t) => (
                  <li key={t.timeLogId}>
                    <button
                      type="button"
                      onClick={() => setUserId(userId === t.employeeId ? ALL : t.employeeId)}
                      aria-pressed={userId === t.employeeId}
                      className={`w-full text-left py-2 px-1 rounded-sm transition-colors ${userId === t.employeeId ? "bg-muted" : "hover:bg-muted/50"}`}
                    >
                      <p className="text-sm font-medium truncate flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TRACK_COLORS[colorIndex(t.employeeId)].bg}`} />
                        {t.employeeName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{fmtSpan(t)}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtTrackDistance(t.distanceMeters, unit)} · {t.pointCount} point{t.pointCount === 1 ? "" : "s"}
                        {t.gaps?.length > 0 && <> · {t.gaps.length} gap{t.gaps.length === 1 ? "" : "s"}</>}
                        {t.mockedPoints > 0 && <span className="text-red-600"> · ⚠ {t.mockedPoints} fake GPS</span>}
                      </p>
                      {/* BB-128 2b: impossible moves + route not connecting to its punch pins */}
                      {t.suspicious > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="mt-1 inline-flex items-center rounded-md border border-red-300 px-1.5 py-0.5 text-[11px] font-semibold text-red-600 dark:border-red-800">
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
            )}
          </CardContent>
        </Card>
        ) : (
        <Card className="min-w-0 self-start">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Employees
              {data && <span className="ml-2 text-sm font-normal text-muted-foreground">{data.employees?.length || 0}</span>}
            </CardTitle>
            {selectedEmployee && (
              <Button variant="ghost" size="sm" className="h-7 px-2 w-fit text-xs" onClick={() => setUserId(ALL)}>
                <X /> Show everyone
              </Button>
            )}
          </CardHeader>
          <CardContent className="max-h-[30rem] overflow-y-auto">
            {loading && !data ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !data?.employees?.length ? (
              <p className="text-sm text-muted-foreground">No punches for these filters.</p>
            ) : (
              <ul className="divide-y">
                {data.employees.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setUserId(userId === e.id ? ALL : e.id)}
                      aria-pressed={userId === e.id}
                      className={`w-full text-left py-2 px-1 rounded-sm transition-colors ${userId === e.id ? "bg-muted" : "hover:bg-muted/50"}`}
                    >
                      <p className="text-sm font-medium truncate">{e.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[e.employeeId, e.department].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        In {e.clockIns} · Out {e.clockOuts}
                        {e.withoutLocation > 0 && <span className="text-orange-600"> · {e.withoutLocation} no location</span>}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
