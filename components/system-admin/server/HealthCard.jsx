// components/system-admin/server/HealthCard.jsx
//
// BB-112: server health snapshot — status, process / database / request tiles
// and a 15-minute request chart. GET /server/health on open, then every 15s
// with poll=1 while `active`.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { systemAdminFetch } from "@/lib/systemAdminFetch";
import { formatNumber, formatDateTime, relativeTime } from "../shared";

const HEALTH_INTERVAL_MS = 15000;

const STATUS = {
  ok: { label: "Healthy", badge: "border-green-200 bg-green-50 text-green-700" },
  degraded: { label: "Needs attention", badge: "border-amber-200 bg-amber-50 text-amber-700" },
  down: { label: "Database not responding", badge: "border-red-200 bg-red-50 text-red-700" },
};

// Theme tokens (same pair as the sign-ins chart, validated for the light surface)
const COLORS = { requests: "hsl(var(--chart-1))", serverErrors: "hsl(var(--destructive))" };
const AXIS = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const GRID = "hsl(var(--border))";

const formatMinute = (value) =>
  value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "";

// "3d 4h", "5h 12m", "12m", "40s"
function formatUptime(seconds) {
  if (seconds == null) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${seconds}s`;
}

const ms = (v) => (v == null ? "—" : `${formatNumber(v)} ms`);

export default function HealthCard({ active, onRateLimited }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const opened = useRef(false);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    // Only the first call counts as opening the page; the rest are polls
    const poll = opened.current ? 1 : "";
    opened.current = true;
    setLoading(true);
    try {
      const json = await systemAdminFetch("/api/system-admin/server/health", { query: { poll } });
      if (id !== requestId.current) return;
      setData(json.data);
      setError("");
    } catch (err) {
      if (id !== requestId.current) return;
      if (err.status === 429) onRateLimited();
      else setError(err.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [onRateLimited]);

  // Load now (and on resume), then poll while active
  useEffect(() => {
    if (!active) return;
    load();
    const id = setInterval(load, HEALTH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [active, load]);

  const status = STATUS[data?.status];
  const proc = data?.process;
  const db = data?.database;
  const req = data?.requests;

  const tiles = [
    {
      label: "Up for",
      value: formatUptime(proc?.uptimeSeconds),
      title: proc?.startedAt ? `Started ${formatDateTime(proc.startedAt)}` : undefined,
    },
    { label: "Memory", value: proc?.memory?.rssMb == null ? "—" : `${formatNumber(proc.memory.rssMb)} MB` },
    { label: "CPU", value: proc?.cpuPercent == null ? "—" : `${proc.cpuPercent}%` },
    { label: "Responsiveness", value: ms(proc?.eventLoop?.p99Ms), hint: "Event-loop delay, p99" },
    db?.ok === false
      ? { label: "Database", value: "Not responding", tone: "text-red-600" }
      : { label: "Database", value: ms(db?.latencyMs), hint: "Ping" },
    { label: "Requests", value: req ? `${formatNumber(req.perMinute, 1)}/min` : "—", hint: "Last 5 minutes" },
    {
      label: "Server errors",
      value: req ? `${req.serverErrorRate}%` : "—",
      hint: req ? `${formatNumber(req.serverErrors)} in the last 5 minutes` : "Last 5 minutes",
      tone: req?.serverErrors ? "text-red-600" : undefined,
    },
    { label: "Response time", value: req ? `avg ${ms(req.avgMs)} · p95 ${ms(req.p95Ms)}` : "—", hint: "Last 5 minutes" },
  ];

  const series = (req?.series || []).map((m) => ({
    minute: m.minute,
    ok: Math.max(m.requests - m.serverErrors, 0),
    serverErrors: m.serverErrors,
  }));

  const version = [data?.instance?.commit && `Version ${data.instance.commit}`, data?.instance?.branch && `on ${data.instance.branch}`]
    .filter(Boolean)
    .join(" ");

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-2">
          <CardTitle className="text-base flex items-center gap-2">
            Health
            {status && (
              <Badge variant="outline" className={`text-[11px] font-medium ${status.badge}`}>
                {status.label}
              </Badge>
            )}
          </CardTitle>
          {data?.warnings?.length > 0 && (
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              {data.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-3">
          {data?.checkedAt && (
            <span className="text-xs text-muted-foreground" title={formatDateTime(data.checkedAt)}>
              Checked {relativeTime(data.checkedAt)}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw /> Retry
            </Button>
          </div>
        )}

        {/* Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-md border bg-border">
          {tiles.map((t) => (
            <div key={t.label} className="bg-card p-4" title={t.title}>
              <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
              {loading && !data ? (
                <Skeleton className="mt-2 h-6 w-20" />
              ) : (
                <p className={`mt-1 text-lg font-semibold ${t.tone || "text-foreground"}`}>{t.value}</p>
              )}
              {t.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{t.hint}</p>}
            </div>
          ))}
        </div>

        {/* Last 15 minutes */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Requests per minute, last 15 minutes</p>
          {loading && !data ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="minute" tickFormatter={formatMinute} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                    labelFormatter={formatMinute}
                    cursor={{ fill: "hsl(var(--muted))" }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="ok" name="Requests" stackId="requests" fill={COLORS.requests} />
                  <Bar dataKey="serverErrors" name="Server errors" stackId="requests" fill={COLORS.serverErrors} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {version && <p className="text-xs text-muted-foreground">{version}</p>}
      </CardContent>
    </Card>
  );
}
