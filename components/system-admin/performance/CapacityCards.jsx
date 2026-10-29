// components/system-admin/performance/CapacityCards.jsx
//
// BB-112 Capacity: the overall banner and the three gauge cards (API server,
// Database, busiest endpoints). Each card: verdict, one half-circle gauge for its
// main number, the supporting figures with a band scale each, and the server's
// reasons. Labels are plain; the technical term and ranges are in the tooltip.
// Before the samples table exists, the server and database cards come back as
// { verdict, reasons, samples: 0 } with no figures — every figure is optional.
// Server v2.11.1+ also sends a band per figure, `thresholds`, `coverage` and
// `plans`; without them the cards fall back to verdict colours.

"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatDuration } from "../shared";
import { BAND, BandDot, BandScale, bandRanges, isBadBand } from "./bands";

export const VERDICT = {
  ok: { label: "OK", badge: "border-green-200 bg-green-50 text-green-700", arc: "stroke-green-600" },
  watch: { label: "Watch", badge: "border-amber-200 bg-amber-50 text-amber-700", arc: "stroke-amber-500" },
  upgrade: { label: "Upgrade", badge: "border-red-200 bg-red-50 text-red-700", arc: "stroke-red-600" },
};

// The same rules the server uses for its hotspot reasons: slow for its kind of
// endpoint, or 50%+ slower. Older servers send no band — fall back to 3 s.
export const isFlagged = (e) =>
  e.calls >= 20 &&
  (e.band !== undefined
    ? isBadBand(e.band) || e.changeBand === "terrible"
    : e.p95Ms >= 3000 || (e.p95ChangePercent ?? 0) >= 50);

const has = (v) => v != null && Number.isFinite(Number(v));

// Totals over days run into hours: "3.4 h"; shorter ones read like "12 min 5 s"
const formatTotal = (ms) => (ms >= 3600000 ? `${formatNumber(ms / 3600000, 1)} h` : formatDuration(ms));

const formatRam = (mb) => (mb >= 1024 ? `${formatNumber(mb / 1024)} GB` : `${mb} MB`);
const formatSize = (p) => `${formatNumber(p.cpu, 1)} CPU · ${formatRam(p.ramMb)}`;

export function VerdictBadge({ verdict, className = "" }) {
  const v = VERDICT[verdict] || VERDICT.ok;
  return (
    <Badge variant="outline" className={`font-medium ${v.badge} ${className}`}>
      {v.label}
    </Badge>
  );
}

// One cell of the banner's summary row. On phones the cells sit 2 × 2; from lg
// they form one row. Borders stand in for gaps so the dividers line up either way.
function Tile({ label, title, children }) {
  return (
    <div
      className="min-w-0 px-4 py-3 [&:nth-child(n+3)]:border-t [&:nth-child(odd)]:border-r [&:nth-child(odd):last-child]:border-r-0 lg:flex-1 lg:border-l lg:first:border-l-0 lg:[&:nth-child(n+3)]:border-t-0 lg:[&:nth-child(odd)]:border-r-0"
      title={title}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 space-y-1 text-sm">{children}</div>
    </div>
  );
}

// While history is short, progress towards the minimum (Upgrade verdicts wait for
// it); afterwards, how much of the chosen window has samples.
function HistoryTile({ coverage }) {
  const covered = `${formatNumber(coverage.coveredDays, 1)} of ${coverage.requestedDays} days of samples in this period`;
  if (coverage.enough) {
    return (
      <Tile label="History" title={covered}>
        <p className="font-medium tabular-nums text-foreground">
          {formatNumber(coverage.coveredDays, 1)} of {coverage.requestedDays} days
        </p>
        <p className="text-xs text-muted-foreground">Enough for upgrade advice</p>
      </Tile>
    );
  }
  const pct = Math.min((coverage.historyDays / coverage.minimumDays) * 100, 100) || 0;
  return (
    <Tile
      label="History"
      title={`${covered}. Upgrade verdicts wait for ${coverage.minimumDays} days of history in total.`}
    >
      <p className="font-medium tabular-nums text-foreground">
        {formatNumber(coverage.historyDays, 1)} of {coverage.minimumDays} days
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-amber-700">Upgrades on hold until {coverage.minimumDays} days</p>
    </Tile>
  );
}

// The server only suggests a plan for an Upgrade verdict. It works the plan out
// before holding the verdict back, so `next` can be set while the card says Watch.
function PlanTile({ label, advice, held, disk }) {
  const { current, next, upgradeFor } = advice;
  let status;
  if (next) {
    status = (
      <p className="text-xs text-amber-700">
        {held ? "On hold: " : "Suggested: "}
        {formatSize(next)} · +${advice.monthlyDelta}/mo
      </p>
    );
  } else if (upgradeFor === "disk") {
    status = <p className="text-xs text-amber-700">{held ? "On hold: " : ""}more disk or a cleanup; the plan is fine</p>;
  } else if (upgradeFor) {
    status = <p className="text-xs text-amber-700">At its limit; no bigger plan in the list</p>;
  } else {
    status = <p className="text-xs text-muted-foreground">No plan change</p>;
  }
  return (
    <Tile label={label} title={`Render plan ${current.code}${next ? ` → ${next.code}` : ""}`}>
      <p className="font-medium tabular-nums text-foreground">
        {formatSize(current)} · ${current.monthly}/mo
      </p>
      {status}
      {disk}
    </Tile>
  );
}

function DiskLine({ storage, diskMb }) {
  const limit = storage?.limitMb ?? diskMb;
  if (!has(limit)) return null;
  const used = has(storage?.sizeMb);
  return (
    <p className="text-xs tabular-nums text-muted-foreground" title="Database only; Render's disk figure also counts logs">
      Disk {used ? `${formatNumber(storage.sizeMb)} of ` : ""}
      {formatNumber(limit)} MB{used && has(storage.percent) ? ` · ${storage.percent}%` : ""}
    </p>
  );
}

// Sum of the two plans now and, when a plan is suggested, after it
function CostTile({ plans, held }) {
  const now = plans.web.current.monthly + plans.db.current.monthly;
  const delta = (plans.web.next ? plans.web.monthlyDelta : 0) + (plans.db.next ? plans.db.monthlyDelta : 0);
  return (
    <Tile label="Monthly cost" title="API server and database plans; disk and bandwidth not included">
      <p className="font-medium tabular-nums text-foreground">${now}/mo</p>
      {delta > 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          ${now + delta}/mo {held ? "if upgraded" : "after the upgrade"}
        </p>
      )}
    </Tile>
  );
}

export function OverallBanner({ data }) {
  const { coverage, plans } = data;
  const web = plans?.web?.current ? plans.web : null;
  const db = plans?.db?.current ? plans.db : null;
  const webHeld = data.server?.provisional === "upgrade";
  const dbHeld = data.database?.provisional === "upgrade";
  return (
    <div className="rounded-md border bg-card">
      <div className="flex flex-wrap items-start gap-3 px-4 py-3">
        <VerdictBadge verdict={data.overall} className="text-sm" />
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{data.recommendation}</p>
      </div>
      {(coverage || web || db) && (
        <div className="grid grid-cols-2 border-t lg:flex">
          {coverage && <HistoryTile coverage={coverage} />}
          {web && <PlanTile label="API server" advice={web} held={webHeld} />}
          {db && (
            <PlanTile
              label="Database"
              advice={db}
              held={dbHeld}
              disk={<DiskLine storage={data.database?.storage} diskMb={db.storageMb} />}
            />
          )}
          {web && db && <CostTile plans={plans} held={(webHeld && web.next) || (dbHeld && db.next)} />}
        </div>
      )}
    </div>
  );
}

// Half circle, 0–100. The arc carries the band of the number it shows (or the
// card's verdict on older servers); the number is the label.
function Gauge({ percent, verdict, band, value, caption, tech }) {
  const pct = has(percent) ? Math.min(Math.max(Number(percent), 0), 100) : 0;
  const arc = "M 12 92 A 80 80 0 0 1 172 92";
  const tone = BAND[band]?.arc || (VERDICT[verdict] || VERDICT.ok).arc;
  return (
    <div className="flex flex-col items-center" title={tech}>
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
            className={tone}
          />
        )}
        <text x="92" y="82" textAnchor="middle" className="fill-foreground text-[26px] font-semibold tabular-nums">
          {value}
        </text>
      </svg>
      <p className="-mt-1 max-w-full break-all text-center text-xs text-muted-foreground">
        {caption}
        {BAND[band] && <span className={`ml-1 font-medium ${BAND[band].text}`}>· {BAND[band].label}</span>}
      </p>
    </div>
  );
}

// value is the banded number; extra is muted context shown before it
function Figures({ rows }) {
  const shown = rows.filter((r) => r.value != null);
  if (!shown.length) return null;
  return (
    <dl className="divide-y rounded-md border text-sm">
      {shown.map((r) => (
        <div
          key={r.label}
          className="px-3 py-2"
          title={[r.tech, bandRanges(r.spec)].filter(Boolean).join("\n") || undefined}
        >
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="flex items-center justify-end gap-1.5 text-right tabular-nums">
              {!r.spec && <BandDot band={r.band} />}
              {r.extra && <span className="text-muted-foreground">{r.extra} ·</span>}
              <span className={`font-medium ${r.tone || BAND[r.band]?.text || "text-foreground"}`}>{r.value}</span>
            </dd>
          </div>
          <BandScale spec={r.spec} value={r.scaleValue} band={r.band} className="mt-2" />
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

function GaugeCard({ title, tech, gauge, verdict, provisional, figures, reasons }) {
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader className="space-y-1 pb-2">
        <div className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base" title={tech}>
            {title}
          </CardTitle>
          <VerdictBadge verdict={verdict} />
        </div>
        {provisional === "upgrade" && (
          <p className="text-right text-[11px] text-amber-700">Would be Upgrade — not enough history yet</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <Gauge verdict={verdict} {...gauge} />
        <Figures rows={figures} />
        <div className="border-t pt-3">
          <Reasons reasons={reasons} />
        </div>
      </CardContent>
    </Card>
  );
}

export function ServerCard({ server, thresholds }) {
  const { cpu, memory, eventLoop, inFlight } = server;
  const t = thresholds?.server;
  const mem = memory
    ? has(memory.limitMb)
      ? `${formatNumber(memory.p95Mb)} of ${formatNumber(memory.limitMb)} MB · ${memory.p95PercentOfLimit}%`
      : has(memory.p95Mb) ? `${formatNumber(memory.p95Mb)} MB` : null
    : null;
  const memTone =
    memory?.band === undefined
      ? memory?.p95PercentOfLimit >= 85 ? "text-red-600" : memory?.p95PercentOfLimit >= 70 ? "text-amber-600" : undefined
      : undefined;
  return (
    <GaugeCard
      title="API server"
      tech="API server (Render)"
      verdict={server.verdict}
      provisional={server.provisional}
      gauge={{
        percent: cpu?.p95Percent,
        band: cpu?.band,
        value: has(cpu?.p95Percent) ? `${cpu.p95Percent}%` : "—",
        caption: "CPU in busy moments",
        tech: ["CPU, 95th percentile", bandRanges(t?.cpuP95Percent)].filter(Boolean).join("\n"),
      }}
      figures={[
        {
          label: "Memory",
          tech: "95th percentile vs the plan's limit",
          value: mem,
          band: memory?.band,
          tone: memTone,
          spec: t?.memoryP95Percent,
          scaleValue: memory?.p95PercentOfLimit,
        },
        {
          label: "Responsiveness",
          tech: "Event-loop delay, 95th percentile",
          value: has(eventLoop?.p95Ms) ? `${formatNumber(eventLoop.p95Ms)} ms` : null,
          band: eventLoop?.band,
          spec: t?.eventLoopP95Ms,
          scaleValue: eventLoop?.p95Ms,
        },
        { label: "Peak requests at once", tech: "Most requests in progress at the same time", value: has(inFlight?.max) ? formatNumber(inFlight.max) : null },
        { label: "Restarts", tech: "Deploys count too", value: has(server.restarts) ? formatNumber(server.restarts) : null },
      ]}
      reasons={server.reasons}
    />
  );
}

export function DatabaseCard({ database, thresholds }) {
  const { connections, latency, storage } = database;
  const t = thresholds?.database;
  const size = has(storage?.sizeMb)
    ? `${formatNumber(storage.sizeMb)} MB${has(storage.limitMb) ? ` of ${formatNumber(storage.limitMb)} MB · ${storage.percent}%` : ""}`
    : null;
  return (
    <GaugeCard
      title="Database"
      tech="Database (PostgreSQL)"
      verdict={database.verdict}
      provisional={database.provisional}
      gauge={{
        percent: connections?.peakPercent,
        band: connections?.band,
        value: has(connections?.peakPercent) ? `${connections.peakPercent}%` : "—",
        caption:
          has(connections?.peak) && has(connections?.max)
            ? `Connections in use · ${connections.peak} of ${connections.max}`
            : "Connections in use",
        tech: ["Connections peak vs max", bandRanges(t?.connectionsPeakPercent)].filter(Boolean).join("\n"),
      }}
      figures={[
        {
          label: "Speed",
          tech: "Trivial query (SELECT 1): now · 95th percentile. The colour is for the 95th percentile.",
          extra: latency && has(latency.nowMs) ? `${latency.nowMs} ms now` : null,
          value: latency ? (has(latency.p95Ms) ? `${latency.p95Ms} ms` : "—") : null,
          band: latency?.band,
          spec: t?.latencyP95Ms,
          scaleValue: latency?.p95Ms,
        },
        {
          label: "Waiting for a connection",
          tech: "Pool timeouts: requests that waited too long for a connection",
          value: has(database.poolTimeouts) ? formatNumber(database.poolTimeouts) : null,
          band: database.poolTimeoutsBand,
          tone: database.poolTimeoutsBand === undefined && database.poolTimeouts > 0 ? "text-red-600" : undefined,
          spec: t?.poolTimeouts,
          scaleValue: database.poolTimeouts,
        },
        {
          label: "Size",
          tech: storage?.limitMb ? "Database only; Render's disk figure also counts logs" : undefined,
          value: size,
          band: storage?.band,
          spec: t?.storagePercent,
          scaleValue: storage?.percent,
        },
        {
          label: "Reads from memory",
          tech: "Cache hit — higher is better",
          value: has(database.cacheHitPercent) ? `${database.cacheHitPercent}%` : null,
          band: database.cacheHitBand,
          spec: t?.cacheHitPercent,
          scaleValue: database.cacheHitPercent,
        },
      ]}
      reasons={database.reasons}
    />
  );
}

export function HotspotsCard({ hotspots }) {
  const endpoints = hotspots.endpoints || [];
  const top = endpoints[0];
  const flagged = endpoints.filter(isFlagged).length;
  const banded = top?.band !== undefined;
  return (
    <GaugeCard
      title="Busiest endpoints"
      tech="API hotspots"
      verdict={hotspots.verdict}
      gauge={{
        percent: top?.shareOfServerTimePercent,
        value: top ? `${top.shareOfServerTimePercent}%` : "—",
        caption: top ? `of server time · ${top.method} ${top.endpoint}` : "Top endpoint's share of server time",
        tech: "The top endpoint's share of all server time",
      }}
      figures={[
        {
          label: "Flagged",
          tech: banded ? "Slow for its kind, or 50%+ slower, 20+ calls" : "Slow (p95 3 s+) or 50%+ slower, 20+ calls",
          value: formatNumber(flagged),
          tone: flagged ? "text-red-600" : undefined,
        },
        { label: "Tracked", tech: "Endpoints with requests in this period", value: formatNumber(endpoints.length) },
        { label: "Total server time", value: has(hotspots.totalServerTimeMs) ? formatTotal(hotspots.totalServerTimeMs) : null },
      ]}
      reasons={hotspots.reasons}
    />
  );
}
