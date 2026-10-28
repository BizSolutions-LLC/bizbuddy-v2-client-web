// components/system-admin/server/LogPanel.jsx
//
// BB-112: live tail of the server's log output. First load takes the latest
// 500 lines; then every 5s asks for lines after the last seq it has. Changing
// the level or search starts over from after=0. Keeps the last 2,000 on screen.

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pause, Play, ArrowDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { systemAdminFetch } from "@/lib/systemAdminFetch";
import { formatNumber, formatDateTime } from "../shared";

const POLL_INTERVAL_MS = 5000;
const FIRST_LOAD_LIMIT = 500;
const MAX_LINES = 2000;

const LEVEL_OPTIONS = [
  { value: "all", label: "All" },
  { value: "warn", label: "Warnings & errors" },
  { value: "error", label: "Errors only" },
];

const LEVEL_TONE = {
  error: "text-red-600",
  warn: "text-amber-600",
  info: "text-muted-foreground",
  http: "text-muted-foreground/60",
  debug: "text-muted-foreground/60",
};

const formatClock = (value) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

export default function LogPanel({ active, onRateLimited }) {
  const [level, setLevel] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gap, setGap] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [paused, setPaused] = useState(false);
  const [follow, setFollow] = useState(true);

  // gen: bumps when the filter/search changes, so late responses are dropped.
  // after: last seq received. pending: the gen with a request in flight.
  const cursor = useRef({ gen: 0, after: 0, loaded: false, pending: null });
  const opened = useRef(false);
  const scroller = useRef(null);

  // Search sends q after typing settles
  useEffect(() => {
    const id = setTimeout(() => setQ(searchInput.trim()), 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  const pull = useCallback(async () => {
    const c = cursor.current;
    const gen = c.gen;
    if (c.pending === gen) return;
    c.pending = gen;
    const first = !c.loaded;
    // Only the very first request counts as opening the page
    const poll = opened.current ? 1 : "";
    opened.current = true;

    try {
      const json = await systemAdminFetch("/api/system-admin/server/logs", {
        query: {
          after: c.after,
          level: level === "all" ? "" : level,
          q,
          ...(first ? { limit: FIRST_LOAD_LIMIT } : {}),
          poll,
        },
      });
      if (gen !== c.gen) return;
      const data = json.data || {};
      c.after = data.lastSeq ?? c.after;
      c.loaded = true;
      if (data.lines?.length) setLines((prev) => [...prev, ...data.lines].slice(-MAX_LINES));
      if (first) setTruncated(!!data.truncated);
      // A poll that hit the limit skipped lines too
      else if (data.gap || data.truncated) setGap(true);
      setMeta({ buffered: data.buffered, capacity: data.capacity, oldestAt: data.oldestAt, capturing: data.capturing });
      setError("");
    } catch (err) {
      if (gen !== c.gen) return;
      if (err.status === 429) onRateLimited();
      else setError(err.message);
    } finally {
      if (c.pending === gen) c.pending = null;
      if (gen === c.gen) setLoading(false);
    }
  }, [level, q, onRateLimited]);

  // First load, and again from the start whenever the level or search changes
  useEffect(() => {
    const c = cursor.current;
    c.gen += 1;
    c.after = 0;
    c.loaded = false;
    setLines([]);
    setGap(false);
    setTruncated(false);
    setError("");
    setLoading(true);
    setFollow(true);
    pull();
  }, [pull]);

  // Poll while the tab is visible, not paused and not rate-limited; catch up on resume
  useEffect(() => {
    if (!active || paused) return;
    if (cursor.current.loaded) pull();
    const id = setInterval(pull, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [active, paused, pull]);

  // Stick to the newest line while following
  useLayoutEffect(() => {
    const el = scroller.current;
    if (follow && el) el.scrollTop = el.scrollHeight;
  }, [lines, follow]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atBottom !== follow) setFollow(atBottom);
  };

  const clearView = () => {
    setLines([]);
    setGap(false);
    setTruncated(false);
  };

  const notices = [
    paused && "Paused, new lines are not loading.",
    meta?.capturing === false && "Log capture is off on this server.",
    gap && "Some lines were skipped because the server printed faster than this page refreshes.",
    truncated && `Showing the latest ${FIRST_LOAD_LIMIT} lines.`,
  ].filter(Boolean);

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            Live log
            {loading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
          </CardTitle>
          <CardDescription>New lines every {POLL_INTERVAL_MS / 1000} seconds.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="h-9 w-44" aria-label="Level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search"
            aria-label="Search log lines"
            className="h-9 w-48"
          />
          <Button variant="outline" size="sm" className="h-9" onClick={() => setPaused((p) => !p)}>
            {paused ? <Play /> : <Pause />} {paused ? "Resume" : "Pause"}
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={clearView} disabled={lines.length === 0}>
            Clear view
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {notices.length > 0 && (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
            <Button size="sm" variant="outline" onClick={pull}>
              <RefreshCw /> Retry
            </Button>
          </div>
        )}

        <div className="relative">
          <div ref={scroller} onScroll={onScroll} className="h-[480px] overflow-auto rounded-md border bg-muted/30 py-2 font-mono text-xs">
            {lines.length === 0 ? (
              !loading && <p className="px-3 py-8 text-center font-sans text-sm text-muted-foreground">No log lines yet.</p>
            ) : (
              lines.map((l) => (
                <div key={l.seq} className="grid grid-cols-[auto_3.25rem_minmax(0,1fr)] gap-3 px-3 py-0.5 hover:bg-muted">
                  <span className="text-muted-foreground" title={formatDateTime(l.time)}>
                    {formatClock(l.time)}
                  </span>
                  <span className={`uppercase ${LEVEL_TONE[l.level] || LEVEL_TONE.info}`}>{l.level}</span>
                  <span className="whitespace-pre-wrap break-words text-foreground">{l.text}</span>
                </div>
              ))
            )}
          </div>
          {!follow && lines.length > 0 && (
            <Button size="sm" className="absolute bottom-3 right-5 shadow-md" onClick={() => setFollow(true)}>
              <ArrowDown /> Jump to latest
            </Button>
          )}
        </div>

        {meta?.capacity != null && (
          <p className="text-xs text-muted-foreground">
            Holding {formatNumber(meta.buffered)} of {formatNumber(meta.capacity)} lines
            {meta.oldestAt ? ` since ${formatDateTime(meta.oldestAt)}` : ""}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
