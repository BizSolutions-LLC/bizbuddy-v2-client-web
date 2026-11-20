"use client";

// BB-135: Schedules → Roster (sheet view). View only.
// Rows = employees ("LastName, FirstName"), columns = dates (1 or 2 weeks, Sunday start),
// each cell = that employee's shifts on that date (name + time), stacked when there are
// several (multi-shift days, BNC and DayCare alike). Compact density fits more columns;
// dates where nobody in the list has a shift shrink to a narrow column. Today is orange.
// Data: GET /api/usershifts/range?from&to[&departmentId]&includeOt=1 — one call per range viewed.
// OT warning (BB-135 part 2): the server projects scheduled hours per OT period (company
// otBasis: daily / ISO week Mon–Sun / each department's cutoff periods) in `otProjection`.
// Scheduled shifts only, an estimate, warning only, shown for every company type.
// Rows come from /api/employee?all=1 (passed in). People with shifts get a row; people with
// none collapse into one expandable line. With OT on: each cell shows its net hours and
// "+Xh OT" (from the server's per-day days[]), names show range totals, people over come
// first, an "Over" chip filters them, and a Day totals row sums each date.

import { useState, useEffect, useMemo, useCallback } from "react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, ChevronDown, Search, RefreshCw, Eye, EyeOff, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Shift times are wall-clock values stored as "1970-01-01THH:mm:ss.000Z": read the UTC
// hours, the same way SchedulesCalendarView does, so both views always agree.
const wallParts = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { h: d.getUTCHours(), m: d.getUTCMinutes() };
};

// Comfortable: "8:00 AM". Compact: "8a", "8:30a".
const fmtWallTime = (iso, compact) => {
  const t = wallParts(iso);
  if (!t) return "";
  const h12 = t.h % 12 || 12;
  if (compact) return `${h12}${t.m ? `:${String(t.m).padStart(2, "0")}` : ""}${t.h < 12 ? "a" : "p"}`;
  return `${h12}:${String(t.m).padStart(2, "0")} ${t.h < 12 ? "AM" : "PM"}`;
};

// Split shifts carry their own times; prefer them over the shift template's.
const shiftTimes = (us, compact) => {
  const s = fmtWallTime(us.customStartTime || us.shift?.startTime, compact);
  const e = fmtWallTime(us.customEndTime || us.shift?.endTime, compact);
  return s && e ? `${s}${compact ? "–" : " – "}${e}` : s || e || "";
};

const startMinutes = (us) => {
  const t = wallParts(us.customStartTime || us.shift?.startTime);
  return t ? t.h * 60 + t.m : 0;
};

const lastFirst = (emp) => {
  const last = emp.profile?.lastName?.trim() || "";
  const first = emp.profile?.firstName?.trim() || "";
  if (last && first) return `${last}, ${first}`;
  return last || first || emp.email || "—";
};

const empDeptId = (emp) => emp.departmentId ?? emp.department?.id ?? null;

// ── OT projection helpers (BB-135 part 2) ─────────────────────────────────────
const num = (n) => (n == null ? "—" : String(Number(Number(n).toFixed(2))));

const spanText = (a, b) => {
  const da = parseISO(a);
  const db = parseISO(b);
  if (a === b) return format(da, "MMM d");
  return format(da, "MMM") === format(db, "MMM")
    ? `${format(da, "MMM d")}–${format(db, "d")}`
    : `${format(da, "MMM d")}–${format(db, "MMM d")}`;
};

const isUnknown = (e) => e.periodSource === "unknown";
const isOver = (e) => !e.fixedHours && !isUnknown(e) && Number(e.overBy) > 0;

// Per-day breakdown (server `days[]`): lunch wording for the OT details panel.
const LUNCH_RULE = {
  auto_lunch: "auto-lunch",
  auto_lunch_not_deducted: "auto-lunch, not deducted",
  minimum_lunch: "company minimum lunch",
  minimum_lunch_auto_too_short: "company minimum; shift too short for auto-lunch",
};
const LUNCH_SOURCE = { department: "department setting", shift: "shift setting" };

// ── OT details panel (click the OT tag or a row's Hours value) ────────────────
const periodTitle = (basis, e) => {
  const span = spanText(e.periodStart, e.periodEnd);
  if (basis === "daily") return format(parseISO(e.periodStart), "EEEE, MMM d");
  if (basis === "weekly") return `Week (Mon–Sun) · ${span}`;
  return `Cutoff · ${span}`;
};

function Stat({ label, value, tone }) {
  return (
    <div className="rounded border px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-semibold", tone)}>{value}</div>
    </div>
  );
}

// One OT period: verdict, then a line per scheduled day (gross − lunch − coffee = net).
function OtPeriodDetails({ basis, entry: e, highlightDate }) {
  const days = e.days || [];
  const hasCoffee = days.some((d) => Number(d.coffeeHours) > 0);
  const hasOvernight = days.some((d) => d.overnightShifts > 0);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold">{periodTitle(basis, e)}</p>
        {e.periodSource === "projected" && <span className="text-[10px] text-muted-foreground">projected cutoff</span>}
      </div>

      {isUnknown(e) ? (
        <p className="text-xs text-muted-foreground">
          {num(e.scheduledHours)}h scheduled. Cutoff isn&apos;t set up for these dates, so OT can&apos;t be checked.
        </p>
      ) : e.fixedHours ? (
        <p className="text-xs text-muted-foreground">
          {num(e.scheduledHours)}h scheduled. Fixed-hours employee: scheduled duty is never OT.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <Stat label="Scheduled" value={`${num(e.scheduledHours)}h`} />
          <Stat label="Limit" value={`${num(e.threshold)}h`} />
          <Stat label="Over" value={isOver(e) ? `${num(e.overBy)}h` : "—"} tone={isOver(e) ? "text-red-600" : "text-muted-foreground"} />
        </div>
      )}

      {days.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left font-medium py-1">Day</th>
              <th className="text-right font-medium py-1">Shifts</th>
              <th className="text-right font-medium py-1">Lunch</th>
              {hasCoffee && <th className="text-right font-medium py-1">Coffee</th>}
              <th className="text-right font-medium py-1">Net</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const rule = [LUNCH_RULE[d.lunchRule], LUNCH_SOURCE[d.lunchSource]].filter(Boolean).join(" · ");
              return (
                <tr key={d.date} className={cn("border-t align-top", d.date === highlightDate && "bg-orange-50 dark:bg-orange-950/30")}>
                  <td className="py-1 pr-1 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      {format(parseISO(d.date), "EEE d")}
                      {d.overnightShifts > 0 && <Moon className="h-3 w-3 text-muted-foreground" aria-label="Includes an overnight shift" />}
                    </span>
                  </td>
                  <td className="py-1 text-right">{num(d.grossHours)}h</td>
                  <td className="py-1 text-right">
                    <div>{Number(d.lunchHours) > 0 ? `−${num(d.lunchHours)}h` : "0"}</div>
                    {rule && <div className="text-[10px] leading-tight text-muted-foreground">{rule}</div>}
                  </td>
                  {hasCoffee && <td className="py-1 text-right">{Number(d.coffeeHours) > 0 ? `−${num(d.coffeeHours)}h` : "0"}</td>}
                  <td className={cn("py-1 text-right font-semibold", basis === "daily" && isOver(e) && "text-red-600")}>{num(d.netHours)}h</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {hasOvernight && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Moon className="h-3 w-3" /> Overnight shifts count fully on their start date, the same as payroll.
        </p>
      )}
    </div>
  );
}

// Panel body: the employee, then each period (periods that aren't over collapse to one line).
function OtPanel({ name, basis, entries, highlightDate }) {
  const full = entries.filter((e) => isOver(e) || highlightDate || entries.length === 1);
  const brief = entries.filter((e) => !full.includes(e));
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">{name}</p>
        <p className="text-[11px] text-muted-foreground">Scheduled hours vs. the OT limit · estimate from the schedule</p>
      </div>
      {full.map((e, i) => (
        <div key={`${e.periodStart}-${i}`} className={cn(i > 0 && "border-t pt-3")}>
          <OtPeriodDetails basis={basis} entry={e} highlightDate={highlightDate} />
        </div>
      ))}
      {brief.length > 0 && (
        <div className={cn("space-y-0.5", full.length > 0 && "border-t pt-2")}>
          {brief.map((e, i) => (
            <div key={`${e.periodStart}-b${i}`} className="flex justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{basis === "daily" ? format(parseISO(e.periodStart), "EEE d") : spanText(e.periodStart, e.periodEnd)}</span>
              <span>
                {isUnknown(e) ? `${num(e.scheduledHours)}h · no cutoff`
                  : e.fixedHours ? "Fixed hours"
                    : `${num(e.scheduledHours)} / ${num(e.threshold)}h`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// Short limit wording: chip "Over 8h", badge "Daily 8h", summary "past 8h …".
const BASIS_LABEL = { daily: "Daily", weekly: "Weekly", cutoff: "Cutoff" };
const limitShort = (basis, threshold) =>
  basis === "daily" ? `${num(threshold)}h`
    : basis === "weekly" ? `${num(threshold)}h/wk`
      : `${num(threshold)}h/cutoff`;
export const otRuleText = (ot) =>
  ot && ot.available !== false && ot.basis ? `OT rule · ${BASIS_LABEL[ot.basis] || ot.basis} ${num(ot.threshold)}h` : null;

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const people = (n) => (n === 1 ? "1 person" : `${n} people`);

const ALL = "all";
const RANGES = [
  { weeks: 1, label: "1 week" },
  { weeks: 2, label: "2 weeks" },
];
const DENSITIES = [
  { id: "comfortable", label: "Comfortable" },
  { id: "compact", label: "Compact" },
];

// Small segmented control on the Button primitive
function Segmented({ options, value, onChange, getId = (o) => o.id }) {
  return (
    <div className="inline-flex rounded-md border p-0.5 gap-0.5" role="group">
      {options.map((o) => {
        const id = getId(o);
        return (
          <Button
            key={id}
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "h-8 px-2.5",
              value === id && "bg-orange-500 text-white hover:bg-orange-600 hover:text-white"
            )}
            aria-pressed={value === id}
            onClick={() => onChange(id)}
          >
            {o.label}
          </Button>
        );
      })}
    </div>
  );
}

// Filter chip (All / Over the limit)
function Chip({ active, onClick, children }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-pressed={active}
      onClick={onClick}
      className={cn("h-7 rounded-full px-3 text-xs", active && "border-orange-500 bg-orange-500 text-white hover:bg-orange-600 hover:text-white")}
    >
      {children}
    </Button>
  );
}

const OtPopover = ({ trigger, children }) => (
  <Popover>
    <PopoverTrigger asChild>{trigger}</PopoverTrigger>
    <PopoverContent align="start" className="w-80 max-h-[26rem] overflow-y-auto p-3">{children}</PopoverContent>
  </Popover>
);

export default function SchedulesRosterView({ employees = [], departments = [], token, API_URL, onOtRuleChange }) {
  const [companyTimezone, setCompanyTimezone] = useState(null);
  const [rangeStart, setRangeStart] = useState(null); // "YYYY-MM-DD" (a Sunday)
  const [weeks, setWeeks] = useState(1);
  const [density, setDensity] = useState("comfortable");
  const [departmentId, setDepartmentId] = useState(ALL);
  const [search, setSearch] = useState("");
  const [userShifts, setUserShifts] = useState([]);
  const [ot, setOt] = useState(null); // otProjection from the server (BB-135 part 2)
  const [showOt, setShowOt] = useState(true); // OT warnings on/off (view only; data still loaded)
  const [filter, setFilter] = useState(ALL); // "all" | "over"
  const [showNoShift, setShowNoShift] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const compact = density === "compact";

  // Company zone decides "today" and which week opens first.
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/company-settings/`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setCompanyTimezone(j.data?.timezone || j.data?.companyTimezone || "UTC"))
      .catch(() => setCompanyTimezone("UTC"));
  }, [token, API_URL]);

  const todayStr = useMemo(
    () => (companyTimezone ? new Date().toLocaleDateString("en-CA", { timeZone: companyTimezone }) : null),
    [companyTimezone]
  );

  const weekOf = (dateStr) => format(startOfWeek(parseISO(dateStr), { weekStartsOn: 0 }), "yyyy-MM-dd");

  useEffect(() => {
    if (todayStr && !rangeStart) setRangeStart(weekOf(todayStr));
  }, [todayStr, rangeStart]);

  const days = useMemo(() => {
    if (!rangeStart) return [];
    const start = parseISO(rangeStart);
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const d = addDays(start, i);
      return {
        key: format(d, "yyyy-MM-dd"),
        dow: format(d, "EEE"),
        label: format(d, "MMM d"),
        day: format(d, "d"),
        isSunday: d.getDay() === 0,
      };
    });
  }, [rangeStart, weeks]);

  const from = days[0]?.key;
  const to = days[days.length - 1]?.key;
  const periodWord = weeks === 1 ? "this week" : "these 2 weeks";

  // ── API: GET /api/usershifts/range (BB-135) ────────────────────────────────
  const fetchRange = useCallback(async () => {
    if (!token || !from || !to) return;
    setLoading(true);
    setError(null);
    setUserShifts([]); // never show another range's shifts under these dates
    setOt(null);
    try {
      const qs = new URLSearchParams({ from, to, includeOt: "1" });
      if (departmentId !== ALL) qs.append("departmentId", departmentId);
      const r = await fetch(`${API_URL}/api/usershifts/range?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setUserShifts(Array.isArray(j.data) ? j.data : []);
        setOt(j.otProjection || null);
      }
      else setError(j.message || "Failed to load schedules");
    } catch {
      setError("Network error loading schedules");
    }
    setLoading(false);
  }, [token, API_URL, from, to, departmentId]);

  useEffect(() => { fetchRange(); }, [fetchRange]);

  // The page header shows "OT rule · Daily 8h"
  const otRule = otRuleText(ot);
  useEffect(() => { onOtRuleChange?.(otRule); }, [otRule, onOtRuleChange]);

  // { [userId]: { [date]: userShift[] } } — cancelled shifts hidden.
  const byUserDate = useMemo(() => {
    const map = {};
    userShifts.forEach((us) => {
      if (!us?.userId || !us.assignedDate || us.status === "cancelled") return;
      const date = String(us.assignedDate).slice(0, 10);
      ((map[us.userId] ||= {})[date] ||= []).push(us);
    });
    Object.values(map).forEach((dates) =>
      Object.values(dates).forEach((list) => list.sort((a, b) => startMinutes(a) - startMinutes(b)))
    );
    return map;
  }, [userShifts]);

  // Per day, from the server's days[]: { [userId]: { [date]: { net, ot, entry } } }.
  // OT on a day = the part of that day's net hours past the period limit, running in date
  // order. Daily: net − limit. Weekly/cutoff: from the day the period crosses the limit on.
  const otAvailable = !!ot && ot.available !== false;
  const dayHours = useMemo(() => {
    const out = {};
    if (!ot || ot.available === false) return out;
    Object.entries(ot.employees || {}).forEach(([uid, entries]) => {
      const m = (out[uid] = {});
      (entries || []).forEach((e) => {
        const limit = Number(e.threshold ?? ot.threshold) || 0;
        const checkable = !e.fixedHours && !isUnknown(e) && limit > 0;
        let run = 0;
        [...(e.days || [])].sort((a, b) => a.date.localeCompare(b.date)).forEach((d) => {
          const net = Number(d.netHours) || 0;
          const before = run;
          run += net;
          const over = checkable ? Math.max(0, run - Math.max(before, limit)) : 0;
          m[d.date] = { net, ot: Math.round(over * 100) / 100, entry: e };
        });
      });
    });
    return out;
  }, [ot]);

  // Employees in scope (department + search), each with this range's totals.
  const scope = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees
      .filter((emp) => departmentId === ALL || empDeptId(emp) === departmentId)
      .filter((emp) => {
        if (!q) return true;
        const hay = `${emp.profile?.firstName ?? ""} ${emp.profile?.lastName ?? ""} ${emp.email ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .map((emp) => {
        const dates = byUserDate[emp.id] || {};
        const info = dayHours[emp.id] || {};
        let workDays = 0, hours = 0, hasHours = false, otHours = 0, otDays = 0;
        days.forEach(({ key }) => {
          if (!dates[key]?.length) return;
          workDays += 1;
          const h = info[key];
          if (h) {
            hasHours = true;
            hours += h.net;
            if (h.ot > 0) { otHours += h.ot; otDays += 1; }
          }
        });
        const entries = ot?.employees?.[emp.id] || [];
        const overPeriods = entries.filter(isOver);
        return {
          emp,
          name: lastFirst(emp),
          workDays,
          hours: hasHours ? hours : null,
          otHours,
          otDays,
          entries,
          overPeriods,
          over: otAvailable && (otDays > 0 || overPeriods.length > 0),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, departmentId, search, byUserDate, dayHours, days, ot, otAvailable]);

  const scheduled = useMemo(() => scope.filter((r) => r.workDays > 0), [scope]);
  const noShift = useMemo(() => scope.filter((r) => r.workDays === 0), [scope]);
  const overRows = useMemo(() => scheduled.filter((r) => r.over), [scheduled]);
  const otOn = showOt && otAvailable;

  // Hiding OT drops the Over filter
  useEffect(() => { if (!otOn && filter !== ALL) setFilter(ALL); }, [otOn, filter]);

  // Rows shown: OT on → people over first, then by name
  const shown = useMemo(() => {
    const list = filter === "over" ? overRows : scheduled;
    return otOn ? [...list].sort((a, b) => Number(b.over) - Number(a.over) || a.name.localeCompare(b.name)) : list;
  }, [filter, overRows, scheduled, otOn]);

  // Per date: people on, net hours, OT hours (everyone in scope, not the chip filter)
  const dayTotals = useMemo(() => {
    const out = {};
    days.forEach(({ key }) => {
      let people = 0, hours = 0, otH = 0;
      scope.forEach(({ emp }) => {
        if (!byUserDate[emp.id]?.[key]?.length) return;
        people += 1;
        const h = dayHours[emp.id]?.[key];
        if (h) { hours += h.net; otH += h.ot; }
      });
      out[key] = { people, hours, ot: otH };
    });
    return out;
  }, [days, scope, byUserDate, dayHours]);

  // Dates where nobody in scope has a shift → narrow column
  const showEmptyNarrow = !loading && scheduled.length > 0;
  const isNarrow = (d) => showEmptyNarrow && dayTotals[d.key]?.people === 0 && d.key !== todayStr;

  const otTotal = overRows.reduce((s, r) => s + r.otHours, 0);
  const otDayTotal = overRows.reduce((s, r) => s + r.otDays, 0);
  const otBasis = ot?.basis;

  const move = (dir) => setRangeStart((w) => format(addDays(parseISO(w), dir * weeks * 7), "yyyy-MM-dd"));
  const rangeLabel = days.length
    ? `${format(parseISO(from), "MMM d")} – ${format(parseISO(to), "MMM d, yyyy")}`
    : "";
  const showsToday = todayStr && from && to && todayStr >= from && todayStr <= to;
  const colCount = days.length + 1;

  // Sizes per density. Compact: narrower columns, smaller text, short times ("8a–5p").
  const sz = compact
    ? { col: "min-w-[5.5rem]", name: "min-w-[10rem] text-xs py-1.5", cell: "p-1", chip: "px-1 py-0.5", title: "text-[10px]", time: "text-[10px]", foot: "text-[10px]" }
    : { col: "min-w-[8.5rem]", name: "min-w-[12rem]", cell: "p-1.5", chip: "px-2 py-1", title: "text-xs", time: "text-[11px]", foot: "text-[11px]" };

  // ── One employee row ──────────────────────────────────────────────────────
  const renderRow = (r, rowIdx) => {
    const { emp, name } = r;
    // Alternating rows. The fixed name cell must stay opaque (dates scroll under it),
    // so it layers the same muted tint as a gradient over bg-background.
    const striped = rowIdx % 2 === 1;
    let otTag = null;
    if (otOn && r.over) {
      otTag = r.otHours > 0
        ? `≈${num(r.otHours)}h OT · ${plural(r.otDays, "day")}`
        : `Over OT · ${r.overPeriods.map((e) => spanText(e.periodStart, e.periodEnd)).join(", ")}`;
    }
    return (
      <TableRow key={emp.id} className={cn("align-top h-px", striped && "bg-muted/40")}>
        <TableCell
          className={cn(
            "sticky left-0 z-10 bg-background border-r whitespace-nowrap align-middle",
            striped && "bg-gradient-to-r from-muted/40 to-muted/40",
            sz.name
          )}
        >
          <div className="font-medium">{name}</div>
          {otOn && r.workDays > 0 && (
            r.entries.length ? (
              <OtPopover
                trigger={
                  <button
                    type="button"
                    className="mt-0.5 block text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`OT details for ${name}`}
                  >
                    <span className={cn("block text-muted-foreground hover:underline", sz.foot)}>
                      {r.hours != null ? `${num(r.hours)}h · ` : ""}{plural(r.workDays, "day")}
                    </span>
                    {otTag && (
                      <span className={cn("mt-0.5 inline-block rounded bg-red-600 px-1.5 font-semibold leading-4 text-white", sz.foot)}>
                        {otTag}
                      </span>
                    )}
                  </button>
                }
              >
                <OtPanel name={name} basis={otBasis} entries={r.entries} />
              </OtPopover>
            ) : (
              <div className={cn("mt-0.5 text-muted-foreground", sz.foot)}>{plural(r.workDays, "day")}</div>
            )
          )}
        </TableCell>
        {days.map((d, i) => {
          const list = byUserDate[emp.id]?.[d.key] || [];
          const isToday = d.key === todayStr;
          const narrow = isNarrow(d);
          const h = otOn ? dayHours[emp.id]?.[d.key] : null;
          const otHere = !!h && h.ot > 0;
          return (
            <TableCell
              key={d.key}
              className={cn(
                "h-px align-top",
                narrow ? "p-1" : sz.cell,
                isToday && "bg-orange-50 dark:bg-orange-950/30",
                i > 0 && d.isSunday && "border-l"
              )}
            >
              {list.length === 0 ? (
                <span className="block pt-1 text-center text-muted-foreground">·</span>
              ) : (
                <div
                  className={cn(
                    "flex h-full flex-col rounded-md bg-muted p-1",
                    compact ? "gap-1" : "gap-1.5",
                    otHere && "bg-orange-50 ring-1 ring-orange-300 dark:bg-orange-950/40 dark:ring-orange-800"
                  )}
                >
                  {list.map((us) => (
                    <div
                      key={us.id}
                      className={cn("rounded border bg-card leading-tight", sz.chip)}
                      title={`${us.shift?.shiftName || "Shift"} · ${shiftTimes(us, false)}${us.isSplitShift ? " (split)" : ""}`}
                    >
                      <div className={cn("font-semibold truncate", sz.title)}>{us.shift?.shiftName || "Shift"}</div>
                      <div className={cn("text-muted-foreground whitespace-nowrap", sz.time)}>
                        {shiftTimes(us, compact)}
                        {us.isSplitShift && !compact && <span className="ml-1">(split)</span>}
                      </div>
                    </div>
                  ))}
                  {h && (
                    <div className={cn("mt-auto flex items-center justify-between gap-1 px-0.5 pt-0.5", sz.foot)}>
                      <span className={otHere ? "font-semibold text-red-600" : "text-muted-foreground"}>{num(h.net)}h</span>
                      {otHere && (
                        <OtPopover
                          trigger={
                            <button
                              type="button"
                              className="rounded bg-red-600 px-1 font-semibold leading-4 text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                              aria-label={`Why ${name} is over OT on ${d.label}`}
                            >
                              +{num(h.ot)}h OT
                            </button>
                          }
                        >
                          <OtPanel name={name} basis={otBasis} entries={[h.entry]} highlightDate={d.key} />
                        </OtPopover>
                      )}
                    </div>
                  )}
                </div>
              )}
            </TableCell>
          );
        })}
      </TableRow>
    );
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => move(-1)} disabled={!rangeStart} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[10rem] text-center">{rangeLabel || "…"}</span>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => move(1)} disabled={!rangeStart} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => setRangeStart(weekOf(todayStr))} disabled={!todayStr || showsToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={fetchRange} disabled={loading || !from} aria-label="Refresh">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Segmented options={RANGES} value={weeks} onChange={setWeeks} getId={(o) => o.weeks} />
          <Segmented options={DENSITIES} value={density} onChange={setDensity} />
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={showOt}
            onClick={() => setShowOt((v) => !v)}
            title={showOt ? "Hide OT warnings" : "Show OT warnings"}
            className={cn(
              "h-9 gap-1.5",
              showOt && "border-orange-500 bg-orange-500 text-white hover:bg-orange-600 hover:text-white"
            )}
          >
            {showOt ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            OT
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="h-9 sm:w-52">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee…"
              className="h-9 pl-8 sm:w-56"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Summary line + filter chips */}
      {!loading && rangeStart && !error && (
        <div
          className={cn(
            "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md px-3 py-2 text-sm",
            otOn && overRows.length > 0 ? "bg-orange-50 dark:bg-orange-950/30" : "bg-muted/40"
          )}
        >
          <p>
            {otOn && overRows.length > 0 ? (
              <>
                <span className="font-semibold text-red-600">
                  {people(overRows.length)} scheduled past {limitShort(otBasis, ot.threshold)}
                </span>
                {otBasis === "daily" && otDayTotal > 0 && <> on {plural(otDayTotal, "day")}</>}
                {otTotal > 0 && <> · about <span className="font-semibold">{num(otTotal)}h OT</span> if worked as scheduled</>}
                <span className="text-muted-foreground"> · {scheduled.length} scheduled · {noShift.length} with no shifts</span>
              </>
            ) : (
              <>
                {people(scheduled.length)} scheduled {periodWord} · {noShift.length} with no shifts
                {showOt && ot?.available === false && (
                  <span className="text-muted-foreground"> · {ot.reason || "OT can't be checked for these dates."}</span>
                )}
                {otOn && <span className="text-muted-foreground"> · no one past the OT limit</span>}
              </>
            )}
          </p>
          {otOn && (
            <div className="flex gap-1.5 shrink-0">
              <Chip active={filter === ALL} onClick={() => setFilter(ALL)}>All ({scheduled.length})</Chip>
              <Chip active={filter === "over"} onClick={() => setFilter("over")}>
                Over {limitShort(otBasis, ot.threshold)} ({overRows.length})
              </Chip>
            </div>
          )}
        </div>
      )}

      {/* Sheet */}
      <div className="rounded-md border overflow-x-auto">
        <Table className="w-max min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead className={cn("sticky left-0 z-10 bg-background border-r", sz.name)}>Employee</TableHead>
              {days.map((d, i) => {
                const isToday = d.key === todayStr;
                const narrow = isNarrow(d);
                const people = dayTotals[d.key]?.people || 0;
                return (
                  <TableHead
                    key={d.key}
                    className={cn(
                      narrow ? "min-w-[3rem] w-12 px-1 text-center" : sz.col,
                      compact && "px-1.5",
                      isToday && "bg-orange-500 text-white",
                      i > 0 && d.isSunday && "border-l"
                    )}
                    title={narrow ? "No shifts this day" : undefined}
                  >
                    {narrow ? (
                      <div className="leading-tight py-1">
                        <div className="text-[10px] uppercase tracking-wide">{d.dow}</div>
                        <div className="text-xs font-semibold">{d.day}</div>
                      </div>
                    ) : (
                      <div className={cn("flex items-baseline justify-between gap-2 py-1", compact ? "text-xs" : "text-sm")}>
                        <span className="whitespace-nowrap">
                          {d.dow} <span className="font-semibold">{compact ? d.day : d.label}</span>
                        </span>
                        {!loading && (
                          <span className={cn("text-[10px] font-normal whitespace-nowrap", isToday ? "text-white/80" : "text-muted-foreground")}>
                            {people} on
                          </span>
                        )}
                      </div>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!rangeStart || loading) ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell className={cn("sticky left-0 bg-background border-r", sz.name)}><Skeleton className="h-4 w-28" /></TableCell>
                  {(days.length ? days : Array.from({ length: 7 })).map((_d, j) => (
                    <TableCell key={j} className={sz.cell}><Skeleton className={compact ? "h-6 w-full" : "h-8 w-full"} /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : scope.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-sm text-muted-foreground py-10">
                  No employees match these filters.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {shown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={colCount} className="text-center text-sm text-muted-foreground py-8">
                      {filter === "over" ? "No one is scheduled past the OT limit." : `No one has shifts ${periodWord}.`}
                    </TableCell>
                  </TableRow>
                )}
                {shown.map(renderRow)}

                {/* People with no shifts: one collapsed line, expandable */}
                {filter === ALL && noShift.length > 0 && (
                  <>
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={colCount} className="py-2">
                        <button
                          type="button"
                          onClick={() => setShowNoShift((v) => !v)}
                          aria-expanded={showNoShift}
                          className="sticky left-2 flex max-w-[min(100%,48rem)] items-center gap-1.5 text-left text-xs rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {showNoShift ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                          <span className="font-semibold whitespace-nowrap">
                            {people(noShift.length)} with no shifts {periodWord}
                          </span>
                          {!showNoShift && (
                            <span className="truncate text-muted-foreground">{noShift.map((r) => r.name).join(" · ")}</span>
                          )}
                        </button>
                      </TableCell>
                    </TableRow>
                    {showNoShift && noShift.map((r, i) => renderRow(r, shown.length + i))}
                  </>
                )}

                {/* Day totals */}
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableCell className={cn("sticky left-0 z-10 border-r bg-background bg-gradient-to-r from-muted/60 to-muted/60 font-semibold", sz.name)}>
                    Day totals
                  </TableCell>
                  {days.map((d, i) => {
                    const t = dayTotals[d.key];
                    return (
                      <TableCell
                        key={d.key}
                        className={cn("align-top whitespace-nowrap", isNarrow(d) ? "p-1 text-center" : sz.cell, sz.foot, i > 0 && d.isSunday && "border-l")}
                      >
                        {isNarrow(d) ? (
                          <span className="text-muted-foreground">·</span>
                        ) : (
                          <>
                            <div>
                              {otOn && t.people > 0 && <span className="font-semibold">{num(t.hours)}h · </span>}
                              {people(t.people)}
                            </div>
                            {otOn && t.people > 0 && (
                              t.ot > 0
                                ? <div className="font-semibold text-red-600">+{num(t.ot)}h OT</div>
                                : <div className="text-muted-foreground">no OT</div>
                            )}
                          </>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Legend */}
      {!loading && rangeStart && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {otOn && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-orange-50 ring-1 ring-orange-300 dark:bg-orange-950/40 dark:ring-orange-800" />
              {otBasis === "daily"
                ? `Day over ${num(ot.threshold)}h · OT shown on the day`
                : `OT starts on the day the ${otBasis === "weekly" ? "week (Mon–Sun)" : "cutoff"} passes ${num(ot.threshold)}h`}
            </span>
          )}
          {otOn && <span>Hours are after unpaid lunch and coffee breaks, which differ by shift · click +OT for the breakdown</span>}
          <span className="inline-flex items-center gap-1"><Moon className="h-3 w-3" /> Overnight shifts count on the day they start</span>
          {otOn && <span>Estimate from the schedule</span>}
        </div>
      )}
    </div>
  );
}
