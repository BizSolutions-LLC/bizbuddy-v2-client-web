// components/system-admin/performance/CapacityView.jsx
//
// BB-112 Performance → Capacity: is the API server, the database or one heavy
// endpoint the limit, and is it time to upgrade? GET /capacity (verdicts,
// gauges, hotspots) and /capacity/history (charts) for 1 / 7 / 30 days. Loads
// on open and on Refresh; no polling. Band scales, legend, coverage and plan
// lines come from server v2.11.1+.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { systemAdminFetch } from "@/lib/systemAdminFetch";
import { formatDateTime, relativeTime } from "../shared";
import { OverallBanner, ServerCard, DatabaseCard, HotspotsCard } from "./CapacityCards";
import CapacityCharts from "./CapacityCharts";
import HotspotsTable from "./HotspotsTable";
import { BandLegend } from "./bands";

const PERIODS = [
  { days: 1, label: "1 day" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
];

export default function CapacityView() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const [capacity, hist] = await Promise.all([
        systemAdminFetch("/api/system-admin/capacity", { query: { days } }),
        systemAdminFetch("/api/system-admin/capacity/history", { query: { days } }),
      ]);
      if (id !== requestId.current) return;
      setData(capacity.data);
      setHistory(hist.data);
      setLoadedAt(new Date());
    } catch (err) {
      if (id === requestId.current) setError(err.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const points = history?.points || [];
  const noSamples = data && !data.server?.samples;
  const sampling = data?.sampling;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          {loadedAt && (
            <span className="hidden text-xs text-muted-foreground sm:inline" title={formatDateTime(loadedAt)}>
              Checked {relativeTime(loadedAt)}
            </span>
          )}
          <div className="flex rounded-md border" role="group" aria-label="Period">
            {PERIODS.map((p, i) => (
              <button
                key={p.days}
                type="button"
                onClick={() => setDays(p.days)}
                aria-pressed={days === p.days}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${i ? "border-l" : ""} ${
                  days === p.days ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw /> Retry
          </Button>
        </div>
      )}

      {!data ? (
        !error && (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <div className="grid gap-4 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-96 w-full" />
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          <OverallBanner data={data} />

          <div className="grid gap-4 lg:grid-cols-3">
            <ServerCard server={data.server || {}} thresholds={data.thresholds} />
            <DatabaseCard database={data.database || {}} thresholds={data.thresholds} />
            <HotspotsCard hotspots={data.hotspots || {}} />
          </div>

          <BandLegend thresholds={data.thresholds} />

          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Over time</h2>
              {history?.bucket && points.length > 0 && (
                <p className="text-xs text-muted-foreground">One point per {history.bucket}</p>
              )}
            </div>
            {noSamples || points.length === 0 ? (
              <div className="rounded-md border bg-card px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">No history yet</p>
                <p
                  className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground"
                  title="Samples are saved every 5 minutes once the server runs on Render with the samples table."
                >
                  Charts appear once samples are saved. Busiest endpoints below still work.
                </p>
              </div>
            ) : (
              <CapacityCharts points={points} days={data.days || days} />
            )}
          </section>

          <HotspotsTable endpoints={data.hotspots?.endpoints || []} days={data.days || days} thresholds={data.thresholds} />

          <p className="text-xs text-muted-foreground" title="Verdicts are guidance, not alarms.">
            Sampled every {sampling?.everyMinutes ?? 5} min · kept {sampling?.keepDays ?? 30} days
          </p>
        </>
      )}
    </div>
  );
}
