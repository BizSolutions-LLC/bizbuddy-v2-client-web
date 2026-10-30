// components/system-admin/shared.jsx
//
// Shared bits for system-admin pages (BB-110 Database, BB-112 User Activity /
// Security / Request Logs / Live Server): per-section loading, formatting, a
// section card with its own skeleton / error + Retry so one failing section
// never blanks a page, and polling helpers.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { systemAdminFetch } from "@/lib/systemAdminFetch";
import { cn } from "@/lib/utils";

/**
 * GET a system-admin endpoint as one page section.
 * Re-fetches when `query` changes (compared by value); reload() reuses the last
 * query unless given a new one. Out-of-order responses are ignored.
 * BB-114: keeps the server's `cache` ({ hit, cachedAt, expiresAt }, null on
 * uncached endpoints). refresh() is for a user's explicit Refresh only — it adds
 * refresh=1 so the server recomputes; reload() and Retry never do.
 */
export function useSystemAdminSection(path, query) {
  const [state, setState] = useState({ data: null, cache: null, loading: true, error: "" });
  const lastQuery = useRef(query);
  const requestId = useRef(0);
  const queryKey = JSON.stringify(query ?? null);

  const reload = useCallback(
    async (nextQuery = lastQuery.current, { refresh = false } = {}) => {
      lastQuery.current = nextQuery;
      const id = ++requestId.current;
      setState((s) => ({ ...s, loading: true, error: "" }));
      try {
        const json = await systemAdminFetch(path, { query: refresh ? { ...nextQuery, refresh: 1 } : nextQuery });
        if (id === requestId.current) setState({ data: json.data, cache: json.cache || null, loading: false, error: "" });
      } catch (err) {
        if (id === requestId.current) setState((s) => ({ ...s, loading: false, error: err.message }));
      }
    },
    [path]
  );

  const refresh = useCallback(() => reload(lastQuery.current, { refresh: true }), [reload]);

  useEffect(() => {
    reload(JSON.parse(queryKey) ?? undefined);
  }, [reload, queryKey]);

  return { ...state, reload, refresh };
}

// ── BB-114: server-cached analytics ──────────────────────────────────────────
// The server ignores refresh=1 while its copy is under 30 s old.
const REFRESH_LOCK_MS = 30000;

const toTime = (value) => (value ? new Date(value).getTime() : NaN);

// A card built from several endpoints is only as fresh as its oldest part
export function oldestCachedAt(...caches) {
  const times = caches.map((c) => toTime(c?.cachedAt)).filter(Number.isFinite);
  return times.length ? new Date(Math.min(...times)) : null;
}

export function latestExpiresAt(...caches) {
  const times = caches.map((c) => toTime(c?.expiresAt)).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)) : null;
}

// true for 30 s after `cachedAt` — Refresh is disabled while the server would ignore it
export function useRefreshLocked(cachedAt) {
  const [locked, setLocked] = useState(false);
  const at = toTime(cachedAt);
  useEffect(() => {
    // Capped at 30 s so a skewed browser clock can't lock it longer
    const left = Number.isFinite(at) ? Math.min(at + REFRESH_LOCK_MS - Date.now(), REFRESH_LOCK_MS) : 0;
    setLocked(left > 0);
    if (left <= 0) return;
    const timer = setTimeout(() => setLocked(false), left);
    return () => clearTimeout(timer);
  }, [at]);
  return locked;
}

// Re-render every `ms` so relative times stay current
function useTick(ms) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(timer);
  }, [ms]);
}

// "As of 10:42 AM · 3 minutes ago" — when the server computed the data, not when it arrived
export function CacheStamp({ at, className }) {
  useTick(30000);
  if (!at) return null;
  const date = new Date(at);
  const time =
    date.toDateString() === new Date().toDateString()
      ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : formatDateTime(date);
  return (
    <span className={cn("text-xs text-muted-foreground", className)} title={formatDateTime(date)}>
      As of {time} · {relativeTime(date)}
    </span>
  );
}

export function formatBytes(bytes) {
  if (bytes == null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export const formatNumber = (n, digits = 0) =>
  n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });

const RELATIVE_UNITS = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

// "2 hours ago"
export function relativeTime(value) {
  if (!value) return "Never";
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

// Card with its own loading skeleton and error + Retry. Shows "As of …" when the
// section's endpoint is server-cached (BB-114); asOf={false} hides it.
export function SectionCard({ title, description, section, onRetry, skeletonRows = 5, actions, asOf = true, children }) {
  const { data, loading, error } = section;

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            {title}
            {loading && data && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
          {asOf && <CacheStamp at={section.cache?.cachedAt} className="block" />}
        </div>
        {actions}
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
            <Button size="sm" variant="outline" onClick={() => (onRetry || section.reload)()}>
              <RefreshCw /> Retry
            </Button>
          </div>
        ) : loading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// Clickable column header for sortable tables
export function SortHeader({ label, sortKey, sort, onSort, align = "left" }) {
  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 hover:text-foreground ${align === "right" ? "flex-row-reverse" : ""} ${
        active ? "text-foreground" : ""
      }`}
    >
      {label}
      <span className="text-[10px]">{active ? (sort.dir === "desc" ? "▼" : "▲") : ""}</span>
    </button>
  );
}

// Every company ({ companyId, companyName }) for filter pickers — reuses the
// B. Buddy accounts list, which already covers all companies.
export function useCompanyOptions() {
  const [companies, setCompanies] = useState([]);
  useEffect(() => {
    systemAdminFetch("/api/system-admin/bbuddy/accounts")
      .then((json) => setCompanies((json.data || []).map(({ companyId, companyName }) => ({ companyId, companyName }))))
      .catch((err) => console.error("Load companies error:", err));
  }, []);
  return companies;
}

// 850 → "850 ms", 4803 → "4.8 s", 72000 → "1 min 12 s"
export function formatDuration(ms) {
  const n = Number(ms);
  if (ms == null || !Number.isFinite(n)) return "—";
  if (n < 1000) return `${Math.round(n)} ms`;
  if (n < 60000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")} s`;
  const min = Math.floor(n / 60000);
  const sec = Math.round((n % 60000) / 1000);
  return sec ? `${min} min ${sec} s` : `${min} min`;
}

// "Oct 27" from a date / ISO day
export const formatDay = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) : "";

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

// false while the browser tab is hidden — polls stop until it's visible again
export function usePageVisible() {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

// After a 429: [paused, pause] — pause() holds polling for `ms`, then lifts itself
export function useRateLimitPause(ms = 60000) {
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);
  const pause = useCallback(() => {
    setPaused(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPaused(false), ms);
  }, [ms]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [paused, pause];
}
