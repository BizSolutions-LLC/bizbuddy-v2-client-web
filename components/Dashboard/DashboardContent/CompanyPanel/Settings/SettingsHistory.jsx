// components/Dashboard/DashboardContent/CompanyPanel/Settings/SettingsHistory.jsx
// BB-151: who changed which company setting, when, and from what to what.
// Data: GET /api/company-settings/history (admin / superadmin only), newest first, cursor paging.
// Redesign 2026-11-27 (Carlo's audit-log concept): dark header, stat row, Today / 7 days / All time,
// Who chips, saves grouped by day, "Current" and "Changed back N min later" badges, row details.
// Times are always in the company time zone (no zone switcher). No CSV export (Carlo).
"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, RefreshCw, Search } from "lucide-react";
import { fromZonedTime } from "date-fns-tz";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import useAccountRole from "@/lib/hooks/useAccountRole";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const API = process.env.NEXT_PUBLIC_API_URL;
const PAGE_SIZE = 50;
const CHANGED_BACK_MIN = 60; // "Changed back" = reverted within an hour

// Server `area` → the page the change was made on
const AREA_LABEL = {
  general:       "Configurations",
  cutoff:        "Cutoff schedule",
  notifications: "Notifications",
  check:         "Check Printing",
  payroll:       "Payroll config",
  profile:       "Company Profile",
  leaveCredits:  "Leave credits",
};

const RANGES = [
  { id: "today", label: "Today" },
  { id: "7d",    label: "7 days" },
  { id: "all",   label: "All time" },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

// ── Time helpers (company zone) ─────────────────────────────────────────────
const ymdIn = (d, tz) => {
  try { return new Date(d).toLocaleDateString("en-CA", { timeZone: tz || undefined }); }
  catch { return new Date(d).toISOString().slice(0, 10); }
};
const fmtClock = (iso, tz) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz || undefined });
const fmtFull = (iso, tz) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: tz || undefined });
const fmtDayHeader = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};
const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
};
const relTime = (iso) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
};

// ── Values ──────────────────────────────────────────────────────────────────
function fmtValue(v, tz) {
  if (v === null || v === undefined || v === "") return { text: "—", kind: "empty" };
  if (typeof v === "boolean") return { text: v ? "On" : "Off", kind: v ? "on" : "off" };
  if (Array.isArray(v)) return v.length ? { text: v.map((x) => fmtValue(x, tz).text).join(", "), kind: "text" } : { text: "—", kind: "empty" };
  if (typeof v === "object") {
    const short = JSON.stringify(v);
    return { text: short.length > 32 ? `${short.slice(0, 32)}…` : short, kind: "text", full: JSON.stringify(v, null, 2) };
  }
  if (typeof v === "string" && ISO_DATE.test(v)) return { text: v.length === 10 ? v : fmtFull(v, tz), kind: "text" };
  return { text: String(v), kind: "text" };
}
const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Old value: struck through, muted */
const OldChip = ({ value, tz }) => {
  const f = fmtValue(value, tz);
  return (
    <span title={f.full || f.text} className="inline-block max-w-[11rem] truncate align-middle px-1.5 py-0.5 rounded-sm text-xs bg-neutral-100 text-neutral-400 line-through dark:bg-neutral-800 dark:text-neutral-500">
      {f.text}
    </span>
  );
};
/** New value: On = orange, Off = black, text = soft orange */
const NewChip = ({ value, tz }) => {
  const f = fmtValue(value, tz);
  const cls = f.kind === "on" ? "bg-orange-500 text-white"
    : f.kind === "off" ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
    : f.kind === "empty" ? "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
    : "bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300";
  return (
    <span title={f.full || f.text} className={`inline-block max-w-[13rem] truncate align-middle px-1.5 py-0.5 rounded-sm text-xs font-semibold ${cls}`}>
      {f.text}
    </span>
  );
};

function whoLabel(ev) {
  // BB-151 follow-up: the server names support rows "B. Buddy (123)" (older rows: "B. Buddy")
  if (ev.bySupport) return ev.by?.name || "B. Buddy";
  if (!ev.by) return "Deleted user";
  return ev.by.name || "Unknown user";
}
const whoKey = (ev) => (ev.bySupport ? `support:${ev.by?.name || "B. Buddy"}` : ev.by?.id || "deleted");
const initials = (name) => (name || "?").replace(/\(.*?\)/g, "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export default function SettingsHistory() {
  const { token } = useAuthStore();
  const { isAdmin, loading: roleLoading } = useAccountRole();

  const [timeZone, setTimeZone] = useState(null);
  const [tzReady, setTzReady]   = useState(false);
  const [events,   setEvents]   = useState([]);
  const [cursor,   setCursor]   = useState(null);
  const [available, setAvailable] = useState(true);
  const [loading,  setLoading]  = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [range, setRange] = useState("7d");
  const [who, setWho] = useState("all");
  const [q, setQ] = useState("");
  const [openRows, setOpenRows] = useState({}); // { [eventId]: true }

  // Admins only (server answers 403 to everyone else)
  useEffect(() => {
    if (!token) { window.location.href = "/login"; return; }
    if (!roleLoading && !isAdmin) window.location.href = "/dashboard";
  }, [token, isAdmin, roleLoading]);

  // Company time zone — every time on this page is in it
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/company-settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setTimeZone(j?.data?.timezone || null))
      .catch(() => {})
      .finally(() => setTzReady(true));
  }, [token]);

  const todayYmd = useMemo(() => ymdIn(new Date(), timeZone), [timeZone]);

  /** `from` for the range: start of today (or 6 days before) in the company zone, as ISO */
  const fromIso = useMemo(() => {
    if (range === "all") return null;
    const start = range === "today" ? todayYmd : addDays(todayYmd, -6);
    try { return fromZonedTime(`${start}T00:00:00`, timeZone || "UTC").toISOString(); }
    catch { return `${start}T00:00:00.000Z`; }
  }, [range, todayYmd, timeZone]);

  const fetchPage = useCallback(async (nextCursor) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (nextCursor) params.set("cursor", nextCursor);
    if (fromIso) params.set("from", fromIso);
    const r = await fetch(`${API}/api/company-settings/history?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || j.error || "Failed to load settings history");
    return j;
  }, [token, fromIso]);

  const load = useCallback(async () => {
    if (!token || !isAdmin || !tzReady) return;
    setLoading(true);
    try {
      const j = await fetchPage(null);
      setEvents(j.data || []);
      setCursor(j.meta?.nextCursor || null);
      setAvailable(j.meta?.available !== false);
    } catch (e) {
      toast.error(e.message || "Network error loading settings history");
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin, tzReady, fetchPage]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const j = await fetchPage(cursor);
      setEvents((prev) => [...prev, ...(j.data || [])]);
      setCursor(j.meta?.nextCursor || null);
    } catch (e) {
      toast.error(e.message || "Network error loading settings history");
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Badges: "Current" (newest change of that setting) · "Changed back N min later" ──
  // Events are newest first, so the first time a field appears is its latest change.
  const badges = useMemo(() => {
    const out = {};            // `${eventId}:${field}` → { current, backMin }
    const newer = {};          // field → the next newer change seen so far { at, to }
    events.forEach((ev) => {
      (ev.changes || []).forEach((c) => {
        const k = `${ev.id}:${c.field}`;
        const n = newer[c.field];
        const b = { current: !n, backMin: null };
        if (n && sameValue(n.to, c.from)) {
          const mins = Math.round((new Date(n.at) - new Date(ev.at)) / 60000);
          if (mins >= 0 && mins <= CHANGED_BACK_MIN) b.backMin = mins;
        }
        out[k] = b;
        newer[c.field] = { at: ev.at, to: c.to };
      });
    });
    return out;
  }, [events]);

  // ── People (for the Who chips) ──
  const people = useMemo(() => {
    const m = new Map();
    events.forEach((ev) => {
      const k = whoKey(ev);
      if (!m.has(k)) m.set(k, { key: k, name: whoLabel(ev), support: !!ev.bySupport, role: ev.by?.role || null });
    });
    return [...m.values()];
  }, [events]);

  // ── Filters (search + who) on the loaded saves ──
  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    return events.filter((ev) => {
      if (who !== "all" && whoKey(ev) !== who) return false;
      if (!query) return true;
      const hay = [
        whoLabel(ev), AREA_LABEL[ev.area] || ev.area,
        ...(ev.changes || []).flatMap((c) => [c.label, c.field, fmtValue(c.from, timeZone).text, fmtValue(c.to, timeZone).text]),
      ].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }, [events, who, q, timeZone]);

  // ── Stats (for what's shown) ──
  const stats = useMemo(() => {
    const fields = new Set(), areas = new Set(), ppl = new Map();
    let changes = 0, back = 0;
    visible.forEach((ev) => {
      areas.add(ev.area);
      ppl.set(whoKey(ev), ev.bySupport ? "support" : ev.by?.role || "user");
      (ev.changes || []).forEach((c) => {
        changes += 1;
        fields.add(c.field);
        if (badges[`${ev.id}:${c.field}`]?.backMin != null) back += 1;
      });
    });
    const roleCounts = {};
    ppl.forEach((r) => { roleCounts[r] = (roleCounts[r] || 0) + 1; });
    return {
      changes, saves: visible.length, fields: fields.size,
      areaNote: areas.size === 1 ? `all on ${AREA_LABEL[[...areas][0]] || [...areas][0]}` : areas.size ? `on ${areas.size} pages` : "—",
      people: ppl.size,
      peopleNote: Object.entries(roleCounts).map(([r, n]) => `${n} ${r}`).join(" · ") || "—",
      back,
    };
  }, [visible, badges]);

  // ── Group by day (company zone) ──
  const days = useMemo(() => {
    const m = new Map();
    visible.forEach((ev) => {
      const d = ymdIn(ev.at, timeZone);
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(ev);
    });
    return [...m.entries()];
  }, [visible, timeZone]);

  if (roleLoading || !isAdmin) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const chip = (on) =>
    `h-8 px-3 text-xs font-semibold border transition-colors ${
      on ? "bg-neutral-900 border-neutral-900 text-white dark:bg-neutral-100 dark:border-neutral-100 dark:text-neutral-900"
         : "bg-white border-neutral-300 text-neutral-800 hover:border-neutral-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"
    }`;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <Toaster position="top-center" />
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-brand overflow-hidden bg-white dark:bg-neutral-900">

        {/* ── Header ── */}
        <div className="bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white px-5 sm:px-6 py-5 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-orange-600 dark:text-orange-400">
              <span className="w-5 h-0.5 bg-accent-brand" /> Audit log
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1.5">Settings history</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
              Every saved change to company settings: who made it, when, and what it was before and after.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {timeZone && <span className="text-xs text-neutral-500 dark:text-neutral-400">Times in <strong className="text-neutral-800 dark:text-neutral-200 font-semibold">{timeZone}</strong></span>}
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-brand bg-orange-400 hover:bg-orange-500 text-neutral-950 text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={2.5} /> Refresh
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 bg-neutral-50 text-neutral-900 divide-x divide-neutral-200 border-y border-neutral-200 dark:bg-neutral-900 dark:text-white dark:divide-neutral-800 dark:border-neutral-800">
          {[
            { k: "Changes", v: stats.changes, n: `in ${stats.saves} save${stats.saves === 1 ? "" : "s"}` },
            { k: "Settings touched", v: stats.fields, n: stats.areaNote },
            { k: "People", v: stats.people, n: stats.peopleNote },
            { k: "Changed back", v: stats.back, n: "reverted within an hour" },
          ].map((s) => (
            <div key={s.k} className="px-5 sm:px-6 py-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">{s.k}</p>
              <p className="font-display text-2xl font-bold leading-tight mt-0.5">{loading ? "—" : s.v}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{loading ? "" : s.n}</p>
            </div>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-3 flex-wrap px-5 sm:px-6 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a setting or person"
              aria-label="Search a setting or person"
              className="w-full h-8 pl-9 pr-2 border border-neutral-300 rounded-brand bg-white text-sm outline-none focus:ring-2 focus:ring-orange-200 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:ring-orange-900"
            />
          </div>
          <div role="group" aria-label="Date range" className="inline-flex">
            {RANGES.map((r, i) => (
              <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}
                className={`${chip(range === r.id)} ${i > 0 ? "-ml-px" : ""}`}>
                {r.label}
              </button>
            ))}
          </div>
          {people.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 mr-1">Who</span>
              <button type="button" aria-pressed={who === "all"} onClick={() => setWho("all")} className={chip(who === "all")}>Everyone</button>
              {people.map((p) => (
                <button key={p.key} type="button" aria-pressed={who === p.key} onClick={() => setWho(p.key)} className={chip(who === p.key)}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {!available && (
          <p className="px-5 sm:px-6 py-3 text-sm text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
            History starts once the server update is installed. Saves still work as before.
          </p>
        )}

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[6.5rem_12rem_minmax(0,1fr)_minmax(0,16rem)_1.5rem] gap-4 px-5 sm:px-6 py-2.5 border-b-2 border-neutral-900 dark:border-neutral-200 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
              <span>Time</span><span>Who</span><span>Setting</span><span>Change</span><span />
            </div>

            {loading ? (
              <div className="p-5 space-y-2">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : days.length === 0 ? (
              <p className="text-sm text-neutral-500 py-12 text-center">
                {events.length === 0
                  ? (available ? (range === "all" ? "No settings changes recorded yet." : "No settings changes in this range.") : "")
                  : "Nothing matches the search or person."}
              </p>
            ) : days.map(([ymd, list]) => (
              <Fragment key={ymd}>
                <div className="px-5 sm:px-6 pt-5 pb-2 flex items-baseline gap-2 border-b border-neutral-100 dark:border-neutral-800">
                  <h2 className="font-display text-base font-bold text-neutral-900 dark:text-neutral-100">
                    {fmtDayHeader(ymd)}{ymd === todayYmd ? " · Today" : ""}
                  </h2>
                  <span className="text-xs text-neutral-500">{list.length} save{list.length === 1 ? "" : "s"}</span>
                </div>
                {list.map((ev) => {
                  const name = whoLabel(ev);
                  const isOpen = !!openRows[ev.id];
                  const changes = ev.changes?.length ? ev.changes : [];
                  return (
                    <div key={ev.id} className="border-b border-neutral-100 dark:border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setOpenRows((o) => ({ ...o, [ev.id]: !o[ev.id] }))}
                        aria-expanded={isOpen}
                        className="w-full grid grid-cols-[6.5rem_12rem_minmax(0,1fr)_minmax(0,16rem)_1.5rem] gap-4 px-5 sm:px-6 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/40 items-start"
                      >
                        {/* Time */}
                        <span>
                          <span className="block text-sm font-bold text-neutral-900 dark:text-neutral-100">{fmtClock(ev.at, timeZone)}</span>
                          <span className="block text-xs text-neutral-500">{relTime(ev.at)}</span>
                        </span>
                        {/* Who */}
                        <span className="flex items-start gap-2 min-w-0">
                          <span className={`w-7 h-7 flex-shrink-0 flex items-center justify-center text-[10px] font-bold rounded-sm ${
                            ev.bySupport ? "bg-orange-500 text-white" : "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                          }`}>{initials(name)}</span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{name}</span>
                            <span className="block text-xs text-neutral-500 capitalize">{ev.bySupport ? "Support" : ev.by?.role || ""}</span>
                          </span>
                        </span>
                        {/* Settings */}
                        <span className="space-y-2 min-w-0">
                          {changes.map((c) => {
                            const b = badges[`${ev.id}:${c.field}`] || {};
                            return (
                              <span key={c.field} className="block min-w-0">
                                <span className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{c.label || c.field}</span>
                                  {b.current && (
                                    <span className="px-1.5 text-[10px] font-bold bg-neutral-900 text-white rounded-sm dark:bg-neutral-100 dark:text-neutral-900">Current</span>
                                  )}
                                  {b.backMin != null && (
                                    <span className="px-1.5 text-[10px] font-semibold bg-orange-100 text-orange-800 rounded-sm dark:bg-orange-950/50 dark:text-orange-300">
                                      Changed back {b.backMin} min later
                                    </span>
                                  )}
                                </span>
                                <span className="block text-xs text-neutral-500">{AREA_LABEL[ev.area] || ev.area}</span>
                              </span>
                            );
                          })}
                          {changes.length > 1 && (
                            <span className="block text-xs font-medium text-neutral-500">{changes.length} settings changed in one save</span>
                          )}
                        </span>
                        {/* Change */}
                        <span className="space-y-2 min-w-0">
                          {changes.map((c) => (
                            <span key={c.field} className="flex items-center gap-2 min-h-[2.25rem]">
                              <OldChip value={c.from} tz={timeZone} />
                              <span className="text-neutral-900 dark:text-neutral-100" aria-hidden="true">→</span>
                              <NewChip value={c.to} tz={timeZone} />
                            </span>
                          ))}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 mt-1 text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>

                      {/* Details */}
                      {isOpen && (
                        <div className="px-5 sm:px-6 pb-4">
                          <div className="ml-[7.5rem] border-l-2 border-accent-brand pl-4 space-y-2 text-xs text-neutral-600 dark:text-neutral-300">
                            <p>
                              Saved {fmtFull(ev.at, timeZone)} by <strong>{name}</strong>
                              {ev.bySupport ? " (BizBuddy support)" : ev.by?.role ? ` (${ev.by.role})` : ""} on {AREA_LABEL[ev.area] || ev.area}.
                            </p>
                            {changes.map((c) => (
                              <div key={c.field} className="grid grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)] gap-3">
                                <span className="font-mono text-neutral-500 truncate" title={c.field}>{c.field}</span>
                                <pre className="whitespace-pre-wrap break-words text-neutral-500">{fmtValue(c.from, timeZone).full || fmtValue(c.from, timeZone).text}</pre>
                                <pre className="whitespace-pre-wrap break-words font-semibold text-neutral-900 dark:text-neutral-100">{fmtValue(c.to, timeZone).full || fmtValue(c.to, timeZone).text}</pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap px-5 sm:px-6 py-3 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-3">
            Showing {visible.length} of {events.length}{cursor ? "+" : ""} saves{timeZone ? ` · times in ${timeZone}` : ""}
            {cursor && (
              <Button variant="outline" size="sm" className="h-7 rounded-brand" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Load more
              </Button>
            )}
          </span>
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5"><span className="px-1.5 bg-orange-100 text-orange-800 rounded-sm dark:bg-orange-950/50 dark:text-orange-300">Changed back</span> reverted within an hour</span>
            <span className="inline-flex items-center gap-1.5"><span className="px-1.5 bg-neutral-900 text-white rounded-sm font-bold dark:bg-neutral-100 dark:text-neutral-900">Current</span> value in effect now</span>
          </span>
        </div>
      </div>
    </div>
  );
}
