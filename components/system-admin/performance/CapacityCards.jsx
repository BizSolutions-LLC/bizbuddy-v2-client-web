// components/system-admin/performance/CapacityCards.jsx
//
// BB-112 Capacity: the overall banner and the three gauge cards (API server,
// Database, API hotspots). Each card: verdict, one half-circle gauge for its
// main number, the supporting figures, and the server's reasons in plain words.
// Before the samples table exists, the server and database cards come back as
// { verdict, reasons, samples: 0 } with no figures — every figure is optional.

"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatDuration } from "../shared";

export const VERDICT = {
  ok: { label: "OK", badge: "border-green-200 bg-green-50 text-green-700", arc: "stroke-green-600" },
  watch: { label: "Watch", badge: "border-amber-200 bg-amber-50 text-amber-700", arc: "stroke-amber-500" },
  upgrade: { label: "Upgrade", badge: "border-red-200 bg-red-50 text-red-700", arc: "stroke-red-600" },
};

// The same rules the server uses for its hotspot reasons
export const isFlagged = (e) => e.calls >= 20 && (e.p95Ms >= 3000 || (e.p95ChangePercent ?? 0) >= 50);

const has = (v) => v != null && Number.isFinite(Number(v));

// Totals over days run into hours: "3.4 h"; shorter ones read like "12 min 5 s"
const formatTotal = (ms) => (ms >= 3600000 ? `${formatNumber(ms / 3600000, 1)} h` : formatDuration(ms));

export function VerdictBadge({ verdict, className = "" }) {
  const v = VERDICT[verdict] || VERDICT.ok;
  return (
    <Badge variant="outline" className={`font-medium ${v.badge} ${className}`}>
      {v.label}
    </Badge>
  );
}

export function OverallBanner({ data }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-4 py-3">
      <VerdictBadge verdict={data.overall} className="text-sm" />
      <p className="text-sm font-medium text-foreground">{data.recommendation}</p>
    </div>
  );
}

// Half circle, 0–100. The arc carries the card's verdict colour; the number is the label.
function Gauge({ percent, verdict, value, caption }) {
  const pct = has(percent) ? Math.min(Math.max(Number(percent), 0), 100) : 0;
  const arc = "M 12 92 A 80 80 0 0 1 172 92";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 184 100" className="w-full max-w-[220px]" role="img" aria-label={`${caption}: ${value}`}>
        <path d={arc} pathLength="100" fill="none" strokeWidth="14" strokeLinecap="round" className="stroke-muted" />
        {pct > 0 && (
          <path
            d={arc}
            pathLength="100"
            fill="none"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${pct} 100`}
            className={(VERDICT[verdict] || VERDICT.ok).arc}
          />
        )}
        <text x="92" y="82" textAnchor="middle" className="fill-foreground text-[26px] font-semibold tabular-nums">
          {value}
        </text>
      </svg>
      <p className="-mt-1 max-w-full break-all text-center text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

function Figures({ rows }) {
  const shown = rows.filter((r) => r.value != null);
  if (!shown.length) return null;
  return (
    <dl className="divide-y rounded-md border text-sm">
      {shown.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-3 px-3 py-2">
          <dt className="text-muted-foreground">
            {r.label}
            {r.hint && <span className="block text-[11px]">{r.hint}</span>}
          </dt>
          <dd className={`text-right font-medium tabular-nums ${r.tone || "text-foreground"}`}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Reasons({ reasons = [] }) {
  if (!reasons.length) return <p className="text-sm text-muted-foreground">Looks healthy.</p>;
  return (
    <ul className="list-disc space-y-1.5 pl-4 text-sm text-foreground marker:text-muted-foreground">
      {reasons.map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ul>
  );
}

function GaugeCard({ title, gauge, verdict, figures, reasons }) {
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <VerdictBadge verdict={verdict} />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <Gauge verdict={verdict} {...gauge} />
        <Figures rows={figures} />
        <div className="border-t pt-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Why</p>
          <Reasons reasons={reasons} />
        </div>
      </CardContent>
    </Card>
  );
}

export function ServerCard({ server }) {
  const { cpu, memory, eventLoop, inFlight } = server;
  const mem = memory
    ? has(memory.limitMb)
      ? `${formatNumber(memory.p95Mb)} / ${formatNumber(memory.limitMb)} MB, ${memory.p95PercentOfLimit}%`
      : has(memory.p95Mb) ? `${formatNumber(memory.p95Mb)} MB` : null
    : null;
  return (
    <GaugeCard
      title="API server (Render)"
      verdict={server.verdict}
      gauge={{
        percent: cpu?.p95Percent,
        value: has(cpu?.p95Percent) ? `${cpu.p95Percent}%` : "—",
        caption: "CPU, 95th percentile",
      }}
      figures={[
        { label: "Memory", hint: "95th percentile vs limit", value: mem, tone: memory?.p95PercentOfLimit >= 85 ? "text-red-600" : memory?.p95PercentOfLimit >= 70 ? "text-amber-600" : undefined },
        { label: "Responsiveness", hint: "Event-loop delay, p95", value: has(eventLoop?.p95Ms) ? `${formatNumber(eventLoop.p95Ms)} ms` : null },
        { label: "Peak requests at once", value: has(inFlight?.max) ? formatNumber(inFlight.max) : null },
        { label: "Restarts", hint: "Deploys count too", value: has(server.restarts) ? formatNumber(server.restarts) : null },
      ]}
      reasons={server.reasons}
    />
  );
}

export function DatabaseCard({ database }) {
  const { connections, latency, storage } = database;
  const size = has(storage?.sizeMb)
    ? `${formatNumber(storage.sizeMb)} MB${has(storage.limitMb) ? ` of ${formatNumber(storage.limitMb)} MB (${storage.percent}%)` : ""}`
    : null;
  return (
    <GaugeCard
      title="Database"
      verdict={database.verdict}
      gauge={{
        percent: connections?.peakPercent,
        value: has(connections?.peakPercent) ? `${connections.peakPercent}%` : "—",
        caption:
          has(connections?.peak) && has(connections?.max)
            ? `Connections peak: ${connections.peak} of ${connections.max}`
            : "Connections peak vs max",
      }}
      figures={[
        {
          label: "Latency",
          hint: "Now · 95th percentile",
          value: latency ? `${has(latency.nowMs) ? `${latency.nowMs} ms` : "—"} · ${has(latency.p95Ms) ? `${latency.p95Ms} ms` : "—"}` : null,
        },
        {
          label: "Pool timeouts",
          hint: "Requests that waited too long for a connection",
          value: has(database.poolTimeouts) ? formatNumber(database.poolTimeouts) : null,
          tone: database.poolTimeouts > 0 ? "text-red-600" : undefined,
        },
        { label: "Size", value: size },
        { label: "Cache hit", hint: "Reads served from memory", value: has(database.cacheHitPercent) ? `${database.cacheHitPercent}%` : null },
      ]}
      reasons={database.reasons}
    />
  );
}

export function HotspotsCard({ hotspots }) {
  const endpoints = hotspots.endpoints || [];
  const top = endpoints[0];
  const flagged = endpoints.filter(isFlagged).length;
  return (
    <GaugeCard
      title="API hotspots"
      verdict={hotspots.verdict}
      gauge={{
        percent: top?.shareOfServerTimePercent,
        value: top ? `${top.shareOfServerTimePercent}%` : "—",
        caption: top ? `of server time: ${top.method} ${top.endpoint}` : "Top endpoint's share of server time",
      }}
      figures={[
        { label: "Endpoints flagged", hint: "Slow (p95 3 s+) or 50%+ slower, 20+ calls", value: formatNumber(flagged), tone: flagged ? "text-red-600" : undefined },
        { label: "Endpoints tracked", value: formatNumber(endpoints.length) },
        { label: "Total server time", value: has(hotspots.totalServerTimeMs) ? formatTotal(hotspots.totalServerTimeMs) : null },
      ]}
      reasons={hotspots.reasons}
    />
  );
}
