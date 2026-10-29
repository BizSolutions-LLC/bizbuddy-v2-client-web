// components/system-admin/performance/bands.jsx
//
// BB-112 Capacity: the excellent / good / watch / terrible bands the server puts
// on every metric (server v2.11.1+). The ranges come from `thresholds` in the
// /capacity response, so the scales, legend and tooltips match the server's
// verdicts. Older servers send no bands — every helper here tolerates that.

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatDuration, formatNumber } from "../shared";

export const BAND = {
  excellent: { label: "Excellent", dot: "bg-green-600", text: "text-green-700", arc: "stroke-green-600" },
  good: { label: "Good", dot: "bg-green-400", text: "text-foreground", arc: "stroke-green-500" },
  watch: { label: "Watch", dot: "bg-amber-500", text: "text-amber-600", arc: "stroke-amber-500" },
  terrible: { label: "Terrible", dot: "bg-red-600", text: "text-red-600", arc: "stroke-red-600" },
};

const BAND_NAMES = ["excellent", "good", "watch", "terrible"];

export const isBadBand = (b) => b === "watch" || b === "terrible";

const formatBound = (v, unit) =>
  unit === "ms" ? formatDuration(v) : unit === "%" ? `${formatNumber(v, 1)}%` : formatNumber(v);

// "Excellent < 40% · Good < 60% · Watch < 80% · Terrible ≥ 80%" — a band whose
// bound equals the previous one is empty (pool timeouts have no "good"): "Good —".
export function bandRanges(spec) {
  if (!spec?.bounds) return "";
  const [lt, ge] = spec.higherIsBetter ? [">", "≤"] : ["<", "≥"];
  const names = ["Excellent", "Good", "Watch"];
  const parts = spec.bounds.map((b, i) =>
    i && b === spec.bounds[i - 1] ? `${names[i]} —` : `${names[i]} ${lt} ${formatBound(b, spec.unit)}`
  );
  parts.push(`Terrible ${ge} ${formatBound(spec.bounds[spec.bounds.length - 1], spec.unit)}`);
  return parts.join(" · ");
}

export function BandDot({ band, className = "" }) {
  const b = BAND[band];
  if (!b) return null;
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${b.dot} ${className}`} aria-label={b.label} />;
}

// Edges e0..e4 of the four bands, excellent first. Lower is better: 0 → bounds →
// an open end (100 for percentages, else twice the last bound). Higher is better
// (cache hit) runs downwards from 100. Equal edges mean an empty band.
function bandEdges({ bounds, unit, higherIsBetter }) {
  const [b1, , b3] = bounds;
  if (higherIsBetter) return [unit === "%" ? Math.max(100, b1) : b1 + (b1 - b3), ...bounds, b3 - (b1 - b3)];
  const start = b1 > 0 ? 0 : b1 - (b3 - b1);
  const end = unit === "%" && b3 < 100 ? 100 : b3 > 0 ? b3 * 2 : b3 + (b3 - start);
  return [start, ...bounds, end];
}

// The visible (non-empty) bands with where `value` sits. The marker always lands
// inside the server's own band, so the bar can't disagree with the verdict.
function scaleModel(spec, value, band) {
  const edges = bandEdges(spec);
  const segments = BAND_NAMES.map((name, i) => ({ name, from: edges[i], to: edges[i + 1] })).filter(
    (s) => s.from !== s.to
  );
  let marker = null;
  const idx = segments.findIndex((s) => s.name === band);
  if (idx >= 0 && value != null && Number.isFinite(Number(value))) {
    const s = segments[idx];
    const f = Math.min(Math.max((Number(value) - s.from) / (s.to - s.from), 0.08), 0.92);
    marker = ((idx + f) / segments.length) * 100;
  }
  return { segments, marker, active: idx };
}

/**
 * Thin four-band bar with a tick at the value. Shows nothing without a spec or
 * band (older server, or a figure the server couldn't measure).
 * labels: print the bounds under the joins (legend).
 */
export function BandScale({ spec, value, band, labels = false, className = "" }) {
  if (!spec?.bounds) return null;
  if (!labels && !BAND[band]) return null;
  const { segments, marker, active } = scaleModel(spec, value, band);
  return (
    <div className={`relative ${labels ? "pb-4" : ""} ${className}`}>
      <div className="flex gap-0.5">
        {segments.map((s, i) => (
          <span
            key={s.name}
            className={`h-1.5 flex-1 first:rounded-l-full last:rounded-r-full ${BAND[s.name].dot} ${
              active < 0 || i === active ? "" : "opacity-25"
            }`}
          />
        ))}
      </div>
      {marker != null && (
        <span
          className="absolute -top-[3px] h-3 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
          style={{ left: `${marker}%` }}
          aria-hidden
        />
      )}
      {labels &&
        segments.slice(0, -1).map((s, i) => (
          <span
            key={s.name}
            className="absolute top-2.5 -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground"
            style={{ left: `${((i + 1) / segments.length) * 100}%` }}
          >
            {formatBound(s.to, spec.unit)}
          </span>
        ))}
    </div>
  );
}

const LEGEND_ROWS = [
  { group: "server", key: "cpuP95Percent", label: "API server CPU", tech: "CPU, 95th percentile" },
  { group: "server", key: "memoryP95Percent", label: "API server memory", tech: "Memory, 95th percentile of the limit" },
  { group: "server", key: "eventLoopP95Ms", label: "API server responsiveness", tech: "Event-loop delay, 95th percentile" },
  { group: "database", key: "latencyP95Ms", label: "Database speed", tech: "Trivial query (SELECT 1), 95th percentile" },
  { group: "database", key: "connectionsPeakPercent", label: "Database connections in use", tech: "Connections peak, of max" },
  { group: "database", key: "poolTimeouts", label: "Waiting for a connection", tech: "Pool timeouts" },
  { group: "database", key: "cacheHitPercent", label: "Reads from memory", tech: "Cache hit — higher is better" },
  { group: "database", key: "storagePercent", label: "Database storage", tech: "Storage, of disk" },
  { group: "endpoints", key: "light", label: "Light endpoints", tech: "p95 · profile, settings, simple lists" },
  { group: "endpoints", key: "heavy", label: "Heavy endpoints", tech: "p95 · approvals, timelogs, leaves, reports, payroll" },
  { group: "endpoints", key: "long", label: "Long actions", tech: "p95 · sync, imports, bulk, PDFs, exports" },
  { group: "endpoints", key: "changePercent", label: "Slower than before", tech: "Endpoint p95 change vs the period before" },
];

// Collapsible "what the colours mean": one scale per metric, straight from the server's thresholds.
export function BandLegend({ thresholds }) {
  const [open, setOpen] = useState(false);
  if (!thresholds) return null;
  const rows = LEGEND_ROWS.filter((r) => thresholds[r.group]?.[r.key]?.bounds);
  if (!rows.length) return null;
  return (
    <section className="rounded-md border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-foreground">
          What the colours mean
          <span className="flex flex-wrap items-center gap-3 text-xs font-normal text-muted-foreground">
            {Object.entries(BAND).map(([k, b]) => (
              <span key={k} className="flex items-center gap-1.5">
                <BandDot band={k} /> {b.label}
              </span>
            ))}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <dl className="divide-y border-t text-sm">
          {rows.map((r) => {
            const spec = thresholds[r.group][r.key];
            return (
              <div
                key={`${r.group}.${r.key}`}
                className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                title={`${r.tech}\n${bandRanges(spec)}`}
              >
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="w-full sm:w-72">
                  <BandScale spec={spec} labels />
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}
