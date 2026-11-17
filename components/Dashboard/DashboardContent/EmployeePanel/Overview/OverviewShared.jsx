"use client";
// components/Dashboard/DashboardContent/EmployeePanel/Overview/OverviewShared.jsx
//
// BB-133: shared pieces for the three Overview views (employee, admin, superadmin), in the
// System Admin → Activity style (BB-112): plain Card tiles, light-grid recharts, colour
// tokens only (chart-1..5, destructive, muted), so the page follows the theme and dark mode.
// Replaces the old Commons.jsx (hex colours, donuts, inline styles).

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ChevronDown, Info } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ── Chart theme (tokens) ─────────────────────────────────────────────────────
export const CHART = {
  c1: "hsl(var(--chart-1))",
  c2: "hsl(var(--chart-2))",
  c3: "hsl(var(--chart-3))",
  c4: "hsl(var(--chart-4))",
  c5: "hsl(var(--chart-5))",
  danger: "hsl(var(--destructive))",
  muted: "hsl(var(--muted-foreground))",
};
export const SERIES = [CHART.c1, CHART.c2, CHART.c3, CHART.c4, CHART.c5];
export const AXIS = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
export const GRID = "hsl(var(--border))";
export const TOOLTIP = {
  contentStyle: {
    borderRadius: 8,
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--popover))",
    color: "hsl(var(--popover-foreground))",
    fontSize: 12,
  },
  labelStyle: { color: "hsl(var(--muted-foreground))" },
};
export const CURSOR_FILL = { fill: "hsl(var(--muted))" };

// ── Formatting ───────────────────────────────────────────────────────────────
// Axis labels arrive as "YYYY-MM-DD", "YYYY-MM" or free text. Calendar values, read as UTC.
export function fmtAxisLabel(v) {
  if (typeof v !== "string") return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(`${v}T00:00:00Z`);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  if (/^\d{4}-\d{2}$/.test(v)) {
    const d = new Date(`${v}-01T00:00:00Z`);
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  }
  return v;
}
export const fmtNum = (n, digits = 0) =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "—";
export const fmtHours = (n) => (typeof n === "number" && Number.isFinite(n) ? `${fmtNum(n, 1)}h` : "—");
export const fmtPct = (n) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return typeof v === "number" && Number.isFinite(v) ? `${fmtNum(v, 1)}%` : "—";
};
export const fmtMoney = (n) =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "—";

// "HH:mm" (24-hour, company zone) → "8:52 AM".
export function fmtClock(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
  if (!m) return null;
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}
// Minutes since midnight → "8 AM" / "8:30 AM" (clock-in trend axis).
export function fmtMinutesOfDay(min) {
  if (typeof min !== "number" || !Number.isFinite(min)) return "";
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}
export const minutesOf = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// The server clamps ranges to today: "November 2026 · through Nov 18" while the period is still running.
export function rangeLabel(dateRange, suffix) {
  if (!dateRange) return suffix || undefined;
  const parts = [dateRange.label];
  if (dateRange.periodEnd && dateRange.end && dateRange.end < dateRange.periodEnd) parts.push(`through ${fmtAxisLabel(dateRange.end)}`);
  if (suffix) parts.push(suffix);
  return parts.filter(Boolean).join(" · ");
}

// ── Period (shared by all three views) ───────────────────────────────────────
export const DATE_PRESETS = [
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 7 Days", value: "last_7_days" },
  { label: "Last 14 Days", value: "last_14_days" },
  { label: "Last 28 Days", value: "last_28_days" },
  { label: "Custom Range", value: "custom" },
];

// Display-only approximation of each preset's span; the server decides what's in it.
export function getPresetRange(period, customRange) {
  const now = new Date();
  switch (period) {
    case "last_7_days": return { from: subDays(now, 6), to: now };
    case "last_14_days": return { from: subDays(now, 13), to: now };
    case "last_28_days": return { from: subDays(now, 27), to: now };
    case "last_month": {
      const m = subMonths(now, 1);
      return { from: startOfMonth(m), to: endOfMonth(m) };
    }
    case "custom": return customRange?.from && customRange?.to ? customRange : { from: null, to: null };
    case "this_month":
    default: return { from: startOfMonth(now), to: now };
  }
}

// Loads one analytics endpoint for the selected period. path e.g. "/api/analytics/employee".
export function useOverviewAnalytics(path) {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;
  const [period, setPeriod] = useState({ value: "this_month", custom: { from: null, to: null } });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      let url = `${API}${path}?period=${period.value}`;
      if (period.value === "custom" && period.custom.from && period.custom.to) {
        url += `&startDate=${format(period.custom.from, "yyyy-MM-dd")}&endDate=${format(period.custom.to, "yyyy-MM-dd")}`;
      }
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.data) throw new Error(j.message || "Couldn't load the overview");
      setData(j.data);
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    }
    setLoading(false);
  }, [API, token, path, period]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load, period, setPeriod };
}

export function PeriodPicker({ period, onChange, label, disabled }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(period.value);
  const [pendingCustom, setPendingCustom] = useState(period.custom);

  const onOpenChange = (o) => {
    if (o) { setPending(period.value); setPendingCustom(period.custom); }
    setOpen(o);
  };
  const current = DATE_PRESETS.find((p) => p.value === period.value);
  const committed = getPresetRange(period.value, period.custom);
  const pendingRange = getPresetRange(pending, pendingCustom);

  const apply = () => {
    if (pending === "custom") {
      if (!pendingCustom?.from || !pendingCustom?.to) { toast.error("Select both start and end dates"); return; }
      onChange({ value: "custom", custom: pendingCustom });
    } else onChange({ value: pending, custom: { from: null, to: null } });
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-between min-w-[220px]" disabled={disabled}>
            <span className="flex items-center gap-2">
              <CalendarDays className="text-muted-foreground" />
              <span className="font-medium">{current?.label || "This Month"}</span>
              {committed.from && committed.to && (
                <span className="hidden sm:inline text-muted-foreground font-normal">
                  {format(committed.from, "MMM d")} – {format(committed.to, "MMM d, yyyy")}
                </span>
              )}
            </span>
            <ChevronDown className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(700px,calc(100vw-2rem))] p-0" align="start">
          <div className="flex flex-col sm:flex-row">
            <div className="flex sm:flex-col overflow-x-auto sm:w-44 shrink-0 border-b sm:border-b-0 sm:border-r py-2">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPending(p.value)}
                  className={cn(
                    "text-left px-4 py-2 text-sm whitespace-nowrap transition-colors",
                    pending === p.value ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex-1 p-4 min-w-0">
              <div className="flex items-end gap-3 mb-3">
                {["from", "to"].map((k) => (
                  <div key={k} className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">{k === "from" ? "Start date" : "End date"}</p>
                    <div className="border rounded-md px-3 py-1.5 text-sm truncate">
                      {pendingRange[k] ? format(pendingRange[k], "MMM d, yyyy") : "Select date"}
                    </div>
                  </div>
                ))}
                {pending === "custom" && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPendingCustom({ from: null, to: null })}>Clear</Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  selected={pending === "custom" ? pendingCustom : pendingRange}
                  onSelect={(range) => { if (pending !== "custom") setPending("custom"); setPendingCustom(range || { from: null, to: null }); }}
                  disabled={(d) => d > new Date() || d < new Date("2020-01-01")}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={apply}
              disabled={pending === "custom" && (!pendingCustom?.from || !pendingCustom?.to)}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}

// ── Tiles ────────────────────────────────────────────────────────────────────
export function StatTile({ label, value, hint, info, loading }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          {label}
          {info && (
            <UiTooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 cursor-default" aria-label={`About ${label}`} />
              </TooltipTrigger>
              <TooltipContent className="max-w-[240px] text-xs">{info}</TooltipContent>
            </UiTooltip>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-20" /> : (
          <div className="text-2xl font-bold text-foreground truncate" title={typeof value === "string" ? value : undefined}>{value}</div>
        )}
        {hint && <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function TileGrid({ children }) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>
    </TooltipProvider>
  );
}

// ── Chart card ───────────────────────────────────────────────────────────────
export function ChartCard({ title, description, empty, emptyText = "No data for this period.", loading, className, children, height = "h-64" }) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className={cn("w-full", height)} />
        ) : empty ? (
          <div className={cn("flex items-center justify-center text-sm text-muted-foreground", height)}>{emptyText}</div>
        ) : (
          <div className={height}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Split bar (share of a whole, instead of a donut) ─────────────────────────
// items: [{ label, value, color }]. Widths are computed, so they use inline style.
export function SplitBar({ items, format: fmt = (v) => fmtNum(v), emptyText = "Nothing to show." }) {
  const rows = (items || []).filter((i) => i.value > 0);
  const total = rows.reduce((n, i) => n + i.value, 0);
  if (!total) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <div className="space-y-3">
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {rows.map((i) => (
          <div
            key={i.label}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(i.value / total) * 100}%`, backgroundColor: i.color }}
            title={`${i.label}: ${fmt(i.value)}`}
          />
        ))}
      </div>
      <ul className="space-y-1.5">
        {(items || []).map((i) => (
          <li key={i.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground min-w-0">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: i.color }} />
              <span className="truncate">{i.label}</span>
            </span>
            <span className="tabular-nums">
              {fmt(i.value)}
              <span className="text-muted-foreground ml-2 text-xs">{total ? Math.round((i.value / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Ranked list (top N with relative bars) ───────────────────────────────────
// showZero: keep rows whose value is 0 (e.g. a department with hours beyond schedule but no approved OT).
export function RankedList({ rows, label, value, format: fmt = (v) => fmtNum(v), detail, color = CHART.c1, showZero = false, emptyText = "Nothing to show." }) {
  const list = (rows || []).filter((r) => showZero || (r?.[value] ?? 0) > 0);
  const max = Math.max(0, ...list.map((r) => r[value]));
  if (!list.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="space-y-2.5">
      {list.map((r, i) => (
        <li key={`${r[label]}-${i}`} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{r[label]}</span>
            <span className="tabular-nums text-muted-foreground">
              {fmt(r[value])}
              {detail && <span className="ml-2 text-xs">{detail(r)}</span>}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${max ? (r[value] / max) * 100 : 0}%`, backgroundColor: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Loading layout used by all three views.
export function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}

// ── Attendance strip (BB-133, series.daily[].status) ─────────────────────────
export const DAY_STATUS = {
  on_time:     { label: "On time",           cls: "bg-chart-2" },
  late:        { label: "Late",              cls: "bg-chart-4" },
  absent:      { label: "Absent",            cls: "bg-destructive" },
  leave:       { label: "Leave",             cls: "bg-chart-3" },
  holiday:     { label: "Holiday",           cls: "bg-chart-3/40" },
  worked:      { label: "Worked, no shift",  cls: "bg-chart-1" },
  unscheduled: { label: "No shift",          cls: "bg-muted" },
  scheduled:   { label: "Today, shift not over", cls: "border border-dashed border-muted-foreground" },
};
// "unscheduled" with hours is a worked day without a shift.
export const dayKind = (d) => (d.status === "unscheduled" && d.hours > 0 ? "worked" : (DAY_STATUS[d.status] ? d.status : "unscheduled"));

export function AttendanceStrip({ days }) {
  const list = days || [];
  if (!list.length) return <p className="text-sm text-muted-foreground">No days in this period.</p>;
  const counts = list.reduce((acc, d) => { const k = dayKind(d); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1" role="list" aria-label="Attendance by day">
        {list.map((d) => {
          const k = dayKind(d);
          const extra = [
            d.hours > 0 ? fmtHours(d.hours) : null,
            d.firstIn ? `in ${fmtClock(d.firstIn)}` : null,
            d.lastOut ? `out ${fmtClock(d.lastOut)}` : null,
            d.earlyOut ? "left early" : null,
          ].filter(Boolean).join(", ");
          return (
            <span
              key={d.date}
              role="listitem"
              className={cn("h-5 w-5 rounded-sm", DAY_STATUS[k].cls)}
              title={`${fmtAxisLabel(d.date)}: ${DAY_STATUS[k].label}${extra ? ` (${extra})` : ""}`}
              aria-label={`${fmtAxisLabel(d.date)}: ${DAY_STATUS[k].label}`}
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {Object.keys(DAY_STATUS).filter((k) => counts[k]).map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-sm", DAY_STATUS[k].cls)} />
            {DAY_STATUS[k].label} <span className="text-foreground tabular-nums">{counts[k]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
