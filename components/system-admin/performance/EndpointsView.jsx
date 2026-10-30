// components/system-admin/performance/EndpointsView.jsx
//
// Performance → Endpoints: per-endpoint response times for the busiest 50
// endpoints (GET /performance). Rebuilt on Card / Table and colour tokens. Speeds
// are shown neutrally: this endpoint sends no kind, so it can't say what is slow
// for an endpoint — Capacity's busiest endpoints judge that by kind.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { systemAdminFetch } from "@/lib/systemAdminFetch";
import { CacheStamp, formatDuration, formatNumber, useRefreshLocked } from "../shared";

const RANGES = ["1h", "6h", "24h", "7d", "30d"];

const AXIS = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };
const PERCENTILES = [
  { key: "p50", label: "Typical", tech: "p50: half of calls finish faster", bar: "hsl(var(--chart-1))", dot: "bg-chart-1" },
  { key: "p95", label: "Slow calls", tech: "p95: 95% of calls finish faster", bar: "hsl(var(--chart-2))", dot: "bg-chart-2" },
  { key: "p99", label: "Slowest 1%", tech: "p99: 99% of calls finish faster", bar: "hsl(var(--chart-3))", dot: "bg-chart-3" },
];

// Average-speed buckets, shown in greys: a mix, not a verdict
const SPEEDS = [
  { label: "Under 100 ms", test: (ms) => ms < 100, tone: "bg-foreground/70" },
  { label: "100–500 ms", test: (ms) => ms >= 100 && ms < 500, tone: "bg-foreground/35" },
  { label: "Over 500 ms", test: (ms) => ms >= 500, tone: "bg-foreground/15" },
];

const LEFT = "text-left px-3";
const NUM = "text-right px-3 tabular-nums";

// 4803 → "4,803 ms"
const exactMs = (ms) => `${Math.round(Number(ms) || 0).toLocaleString()} ms`;

// The server nests the list as data.endpoints.endpoints; older builds sent the array itself
const endpointList = (data) =>
  Array.isArray(data?.endpoints) ? data.endpoints : Array.isArray(data?.endpoints?.endpoints) ? data.endpoints.endpoints : [];

function Method({ method }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">{method}</span>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-mono text-muted-foreground">{p.full}</p>
      {PERCENTILES.map((x) => (
        <p key={x.key} className="flex items-center gap-1.5 text-foreground">
          <span className={`h-2 w-2 rounded-sm ${x.dot}`} /> {x.label}: {formatDuration(p[x.key])}
        </p>
      ))}
    </div>
  );
}

function Stat({ title, value, hint, tone = "text-foreground", children }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {value != null && <p className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>}
        {children}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function SpeedMix({ endpoints }) {
  const counts = SPEEDS.map((s) => endpoints.filter((e) => s.test(Number(e.avgResponseTime) || 0)).length);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="space-y-2" title="Endpoints by average response time">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {SPEEDS.map((s, i) =>
          counts[i] ? <span key={s.label} className={s.tone} style={{ width: `${(counts[i] / total) * 100}%` }} /> : null
        )}
      </div>
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {SPEEDS.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-sm ${s.tone}`} /> {s.label}
            </span>
            <span className="tabular-nums text-foreground">{counts[i]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function EndpointsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeRange, setTimeRange] = useState("24h");
  const [cache, setCache] = useState(null);
  const refreshLocked = useRefreshLocked(cache?.cachedAt);
  const requestId = useRef(0);

  // refresh: only from the Refresh button — asks the server to recompute (refresh=1, BB-114)
  const load = useCallback(async (refresh = false) => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const result = await systemAdminFetch("/api/system-admin/performance", {
        query: { timeRange, limit: 50, refresh: refresh ? 1 : undefined },
      });
      if (id === requestId.current) {
        setData(result.data);
        setCache(result.cache || null);
      }
    } catch (err) {
      if (id === requestId.current) setError(err.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    load();
  }, [load]);

  const endpoints = endpointList(data);
  const slowest = Array.isArray(data?.slowestEndpoints) ? data.slowestEndpoints : [];

  const calls = endpoints.reduce((sum, e) => sum + (Number(e.requestCount) || 0), 0);
  const errors = endpoints.reduce((sum, e) => sum + (Number(e.errorCount) || 0), 0);
  const avg = calls
    ? endpoints.reduce((sum, e) => sum + (Number(e.avgResponseTime) || 0) * (Number(e.requestCount) || 0), 0) / calls
    : null;

  const chartData = endpoints.slice(0, 10).map((e) => ({
    name: e.endpoint.length > 25 ? `${e.endpoint.substring(0, 25)}…` : e.endpoint,
    full: `${e.method} ${e.endpoint}`,
    p50: e.p50ResponseTime || 0,
    p95: e.p95ResponseTime || 0,
    p99: e.p99ResponseTime || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <CacheStamp at={cache?.cachedAt} className="hidden sm:inline" />
        <div className="flex rounded-md border" role="group" aria-label="Period">
          {RANGES.map((range, i) => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              aria-pressed={timeRange === range}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${i ? "border-l" : ""} ${
                timeRange === range ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading || refreshLocked}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
          <Button size="sm" variant="outline" onClick={() => load()}>
            <RefreshCw /> Retry
          </Button>
        </div>
      )}

      {!data ? (
        !error && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
            <Skeleton className="h-80 w-full" />
          </div>
        )
      ) : endpoints.length === 0 ? (
        <div className="rounded-md border bg-card px-4 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No requests in this period</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a longer range.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat title="Calls" value={formatNumber(calls)} hint={`Top ${endpoints.length} endpoints`} />
            <Stat title="Average response" value={formatDuration(avg)} hint="Weighted by calls" />
            <Stat
              title="Errors"
              value={formatNumber(errors)}
              tone={errors ? "text-red-600" : "text-foreground"}
              hint={calls ? `${formatNumber((errors / calls) * 100, 2)}% of calls` : undefined}
            />
            <Stat title="Speed mix">
              <SpeedMix endpoints={endpoints} />
            </Stat>
          </div>

          {chartData.length > 0 && (
            <Card className="min-w-0">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="space-y-1.5">
                  <CardTitle className="text-base">Response times</CardTitle>
                  <CardDescription>Top 10 by calls</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {PERCENTILES.map((x) => (
                    <span key={x.key} className="flex items-center gap-1.5" title={x.tech}>
                      <span className={`h-2.5 w-2.5 rounded-sm ${x.dot}`} /> {x.label}
                    </span>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={AXIS} angle={-45} textAnchor="end" height={100} tickLine={false} axisLine={false} interval={0} />
                      <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={formatDuration} />
                      <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltip />} />
                      {PERCENTILES.map((x) => (
                        <Bar key={x.key} dataKey={x.key} name={x.label} fill={x.bar} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {slowest.length > 0 && (
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-base">Slowest on average</CardTitle>
                <CardDescription>5+ calls</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y border-t">
                  {slowest.map((e) => {
                    const a = Number(e.avg_response_time);
                    const max = Number(e.max_response_time);
                    const count = Number(e.request_count) || 0;
                    return (
                      <li
                        key={`${e.method} ${e.endpoint}`}
                        className="flex items-center justify-between gap-4 px-6 py-3"
                        title={`Average ${exactMs(a)} across ${count.toLocaleString()} calls. Slowest single call: ${exactMs(max)}.`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Method method={e.method} />
                            <span className="truncate font-mono text-sm text-foreground">{e.endpoint}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{formatNumber(count)} calls</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-base font-semibold tabular-nums text-foreground">{formatDuration(a)}</p>
                          <p className="text-xs tabular-nums text-muted-foreground">slowest {formatDuration(max)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base">All endpoints</CardTitle>
              <CardDescription>By calls</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={LEFT}>Endpoint</TableHead>
                    <TableHead className={NUM}>Calls</TableHead>
                    <TableHead className={NUM}>Average</TableHead>
                    {PERCENTILES.map((x) => (
                      <TableHead key={x.key} className={NUM} title={x.tech}>
                        {x.label}
                      </TableHead>
                    ))}
                    <TableHead className={NUM} title="The single longest call">
                      Longest
                    </TableHead>
                    <TableHead className={NUM}>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpoints.map((e) => (
                    <TableRow key={`${e.method} ${e.endpoint}`}>
                      <TableCell className={`${LEFT} py-2.5`}>
                        <div className="flex items-center gap-2">
                          <Method method={e.method} />
                          <span className="max-w-md truncate font-mono text-xs text-foreground" title={e.endpoint}>
                            {e.endpoint}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className={NUM}>{formatNumber(e.requestCount)}</TableCell>
                      <TableCell className={`${NUM} font-medium`}>{formatDuration(e.avgResponseTime)}</TableCell>
                      <TableCell className={`${NUM} text-muted-foreground`}>{formatDuration(e.p50ResponseTime)}</TableCell>
                      <TableCell className={`${NUM} text-muted-foreground`}>{formatDuration(e.p95ResponseTime)}</TableCell>
                      <TableCell className={`${NUM} text-muted-foreground`}>{formatDuration(e.p99ResponseTime)}</TableCell>
                      <TableCell className={`${NUM} text-muted-foreground`} title={exactMs(e.maxResponseTime)}>
                        {formatDuration(e.maxResponseTime)}
                      </TableCell>
                      <TableCell className={NUM} title={`${e.errorRate}% of calls`}>
                        {e.errorCount > 0 ? (
                          <span className="font-medium text-red-600">
                            {formatNumber(e.errorCount)} <span className="text-xs font-normal">({e.errorRate}%)</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
