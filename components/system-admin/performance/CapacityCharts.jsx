// components/system-admin/performance/CapacityCharts.jsx
//
// BB-112 Capacity: history from GET /capacity/history (every 5 minutes for 1 day,
// hourly beyond). One measure per chart, on a shared time axis, so units never
// share an axis. Limits are dashed lines; pool timeouts are red markers on the
// connections chart.

"use client";

import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { formatNumber, formatDuration } from "../shared";

const LINE = "hsl(var(--chart-1))";
const ALERT = "hsl(var(--destructive))";
const AXIS = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const GRID = "hsl(var(--border))";

const maxOf = (points, key) => {
  const values = points.map((p) => p[key]).filter((v) => v != null);
  return values.length ? Math.max(...values) : null;
};

function ChartTooltip({ active, payload, label, title, format, extra }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 text-muted-foreground">
        {new Date(label).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
      </p>
      <p className="font-medium text-foreground">
        {title}: {point.value == null ? "—" : format(point.value)}
      </p>
      {extra?.(point)}
    </div>
  );
}

function MiniChart({ title, hint, points, dataKey, format, xFormat, limit, limitLabel, domainMax, markerKey, extraTooltip, footer }) {
  const data = points.map((p) => ({
    at: p.at,
    value: p[dataKey],
    ...(markerKey ? { marker: p[markerKey] > 0 ? p[dataKey] : null, markerCount: p[markerKey] } : {}),
  }));
  const peak = maxOf(data, "value");
  const top = Math.max(peak ?? 0, limit ?? 0, domainMax ?? 0);

  return (
    <div className="min-w-0 rounded-md border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <p className="shrink-0 text-xs text-muted-foreground tabular-nums">Peak {peak == null ? "—" : format(peak)}</p>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="at" tickFormatter={xFormat} tick={AXIS} axisLine={false} tickLine={false} minTickGap={32} />
            <YAxis
              tick={AXIS}
              axisLine={false}
              tickLine={false}
              width={44}
              allowDecimals={false}
              domain={[0, domainMax ?? (top ? Math.ceil(top * 1.1) : 1)]}
            />
            <Tooltip
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }}
              content={<ChartTooltip title={title} format={format} extra={extraTooltip} />}
            />
            {limit != null && (
              <ReferenceLine
                y={limit}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                label={{ value: limitLabel, position: "insideTopRight", fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
            )}
            <Line type="monotone" dataKey="value" stroke={LINE} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            {markerKey && (
              <Line
                dataKey="marker"
                stroke="none"
                dot={{ r: 4, fill: ALERT, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {footer && <p className="mt-2 text-xs text-muted-foreground">{footer}</p>}
    </div>
  );
}

export default function CapacityCharts({ points, days }) {
  // 1 day: clock time; longer: the date
  const xFormat = (v) =>
    days <= 1
      ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      : new Date(v).toLocaleDateString([], { month: "short", day: "numeric" });

  const memoryLimit = maxOf(points, "memoryLimitMb");
  const dbMax = maxOf(points, "dbMaxConnections");
  const timeouts = points.reduce((sum, p) => sum + (p.poolTimeouts || 0), 0);
  const mb = (v) => `${formatNumber(v)} MB`;
  const ms = (v) => formatDuration(v);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MiniChart title="CPU" hint="Average per interval" points={points} dataKey="cpuPercent" format={(v) => `${formatNumber(v, 1)}%`} xFormat={xFormat} domainMax={100} />
      <MiniChart
        title="Memory"
        hint="Peak per interval"
        points={points}
        dataKey="rssMb"
        format={mb}
        xFormat={xFormat}
        limit={memoryLimit}
        limitLabel={memoryLimit != null ? `Limit ${formatNumber(memoryLimit)} MB` : undefined}
      />
      <MiniChart title="Requests in progress" hint="Most at once per interval" points={points} dataKey="inFlightPeak" format={(v) => formatNumber(v)} xFormat={xFormat} />
      <MiniChart title="Response time, p95" hint="95% of requests finish faster" points={points} dataKey="p95Ms" format={ms} xFormat={xFormat} />
      <MiniChart
        title="Database connections"
        hint="Peak per interval"
        points={points}
        dataKey="dbConnections"
        format={(v) => formatNumber(v)}
        xFormat={xFormat}
        limit={dbMax}
        limitLabel={dbMax != null ? `Max ${formatNumber(dbMax)}` : undefined}
        markerKey="poolTimeouts"
        extraTooltip={(p) => (p.markerCount > 0 ? <p className="text-red-600">Pool timeouts: {formatNumber(p.markerCount)}</p> : null)}
        footer={
          timeouts > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              {formatNumber(timeouts)} pool timeout{timeouts === 1 ? "" : "s"}: requests waited too long for a connection
            </span>
          ) : (
            "No pool timeouts in this period."
          )
        }
      />
      <MiniChart title="Database latency" hint="Slowest ping per interval" points={points} dataKey="dbLatencyMs" format={ms} xFormat={xFormat} />
    </div>
  );
}
