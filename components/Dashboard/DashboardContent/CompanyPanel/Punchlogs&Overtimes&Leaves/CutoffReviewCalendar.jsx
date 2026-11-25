// components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReviewCalendar.jsx
// BB-121 (phase 1): Calendar Type cutoff review page — employee list, Overtime card,
// "Period at a glance" calendar and a day panel. Same endpoints/actions as the List Type
// (shared via ./cutoffReviewShared). Hand-off rules followed here:
//   - /approvals is loaded once; again only after an action or a Sync (never prefetched);
//   - OT is never recalculated in the browser — only the server's OT blocks are shown;
//   - neighbouring-cutoff days are greyed with no hours, no "carried in" totals;
//   - days are bucketed in the company time zone from the response.
// Phase 2 (not here yet): B&C shift-picker specifics, fixed-hours summary/edit, Training-day dialog.
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Lock,
  Check,
  X,
  AlertCircle,
  Loader2,
  RotateCcw,
  Pencil,
  GraduationCap,
  GitMerge,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast, Toaster } from "sonner";
import { CALENDAR_PREVIEW_ONLY as PREVIEW, PREVIEW_TIP, listViewHref } from "@/lib/cutoffCalendarPreview";
import {
  enumeratePeriodDays,
  fmtShiftTime,
  fromCompanyTzInput,
  SEGMENT_LABELS,
  useCutoffReview,
  SyncOverlay,
  CutoffReviewDialogs,
} from "./cutoffReviewShared";
import { CutoffHistoryButton } from "./cutoffPeriodsShared"; // BB-149 follow-up

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** 8.8166 → "8.82h" */
const fmtH = (n) => `${parseFloat((Number(n) || 0).toFixed(2))}h`;

/** ISO → "6:45 AM" in the company zone */
const fmtTime = (iso, tz) =>
  iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }) : "—";

/** "YYYY-MM-DD" → "Tue, Nov 10" */
const fmtIsoDay = (iso) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
};

/** "YYYY-MM-DD" → "Nov 13" */
const fmtShortDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

/** "Oct 28 – Nov 10, 2026" */
const fmtRange = (start, end) => {
  if (!start || !end) return "—";
  const [sy, sm, sd] = start.slice(0, 10).split("-").map(Number);
  const [ey, em, ed] = end.slice(0, 10).split("-").map(Number);
  const s = new Date(Date.UTC(sy, sm - 1, sd, 12));
  const e = new Date(Date.UTC(ey, em - 1, ed, 12));
  const sLabel = s.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC", ...(sy !== ey ? { year: "numeric" } : {}) });
  const eLabel = e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${sLabel} – ${eLabel}`;
};

const isoAddDays = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
};
/** 0 = Mon … 6 = Sun */
const isoWeekday = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() + 6) % 7;
};

/**
 * Unpaid lunch inside a window — same as the server's lunchOverlapMs (timeLogComputeUtils.js, BB-092):
 * the part of a completed lunch that overlaps [start, end]; auto lunches marked non-deductible don't count.
 */
const lunchOverlapMs = (lb, start, end) => {
  if (!lb?.start || !lb?.end || !start || !end) return 0;
  if (lb.auto && lb.deductible === false) return 0;
  const s = Math.max(new Date(lb.start).getTime(), new Date(start).getTime());
  const e = Math.min(new Date(lb.end).getTime(),   new Date(end).getTime());
  return Math.max(0, e - s);
};

/** Minutes of unpaid lunch on a day (deductible lunches inside each punch) — for the "Lunch Nm" chip */
const dayLunchMinutes = (items) => {
  let ms = 0;
  items.forEach((it) => {
    if (it.type === "driver_group") {
      const { rawIn, rawOut } = driverRaw(it);
      ms += lunchOverlapMs(it.segments[0]?.lunchBreak, rawIn, rawOut || it.segments[it.segments.length - 1]?.segmentEndIso);
    } else if (!["leave", "absent", "unsynced", "rest"].includes(it.type)) {
      leafsOf(it).forEach((p) => { ms += lunchOverlapMs(p.lunchBreak, p.rawTimeIn, p.rawTimeOut); });
    }
  });
  return Math.round(ms / 60000);
};

/**
 * Whole minutes from a to b, with each time read to the minute first (seconds dropped), exactly as
 * shown on screen: 7:45:30 → 8:00 = 15 (not 14), 7:00:40 vs 6:45 = 15 (not 16).
 */
const toMinute = (t) => Math.floor(new Date(t).getTime() / 60000);
const minutesBetween = (a, b) => toMinute(b) - toMinute(a);

const itemDate = (r) => r.date || r.segments?.[0]?.date || r.punches?.[0]?.date;
const leafsOf  = (r) => (r.type === "driver_group" ? r.segments : r.type === "punch_group" ? r.punches : [r]);
const NON_ACTIONABLE = new Set(["absent", "leave", "unsynced", "rest"]);

const stripHtml = (s) => (s || "").replace(/<[^>]+>/g, "").replace(/&rarr;/g, "→").replace(/&nbsp;/g, " ");

/** Raw clock in/out of a driver day (original times when the punch was edited) */
const driverRaw = (group) => {
  const s0 = group.segments[0] || {};
  const useOriginal = s0.originalTimeIn && s0.originalTimeOut;
  return {
    rawIn:  useOriginal ? s0.originalTimeIn  : s0.rawTimeIn,
    rawOut: useOriginal ? s0.originalTimeOut : s0.rawTimeOut,
  };
};

/** Minutes the driver_pm segment ran past its window on this driver day (0 if not) */
const pmPastMinutes = (group) => {
  const pm = group.segments.find((s) => s.segmentType === "driver_pm");
  const { rawOut } = driverRaw(group);
  if (!pm?.segmentEndIso || !rawOut) return 0;
  return Math.max(0, minutesBetween(pm.segmentEndIso, rawOut));
};

/** Everything the calendar needs for one employee on one day */
function dayInfo(emp, label) {
  const items  = emp.records.filter((r) => itemDate(r) === label);
  const leafs  = items.flatMap(leafsOf).filter((l) => !NON_ACTIONABLE.has(l.type));
  const leaves = items.filter((r) => r.type === "leave");
  const unsynced = items.filter((r) => r.type === "unsynced");

  const punchHours = leafs.reduce((s, l) => (l.localStatus === "excluded" || l.isFixedHours ? s : s + (l.hours || 0)), 0);
  const leaveHours = leaves.reduce((s, l) => s + (l.payableHours ?? l.hours ?? 0), 0);
  const pastMin = items.filter((r) => r.type === "driver_group").reduce((s, g) => s + pmPastMinutes(g), 0);

  let status = "off";
  if (leafs.some((l) => l.type === "conflict" && !l.localStatus)) status = "conflict";
  else if (leafs.some((l) => !l.localStatus && !l.isFixedHours)) status = "pending";
  else if (leafs.length && leafs.every((l) => l.localStatus === "excluded" || l.isFixedHours)) status = "excluded";
  else if (leafs.length) status = "approved";
  else if (leaves.length) status = "leave";
  else if (unsynced.length) status = "unsynced";

  return {
    items, leafs, leaves, unsynced, status, pastMin,
    hours: punchHours + leaveHours,
    training: leafs.some((l) => l.punchType === "TRAINING"),
  };
}

const DAY_STYLE = {
  approved: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20",
  pending:  "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900",
  conflict: "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20",
  excluded: "border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800/60",
  leave:    "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20",
  unsynced: "border-dashed border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/10",
  off:      "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40",
};

/** Regular punch: server flags only (beyond grace / "Clock-in will snap") → { tone, mins } */
const punchClockIn = (p) => {
  if (!p.scheduleInfo || p.type === "unscheduled") return null;
  if (p.lateStatus === "beyond_grace") return { tone: "beyond", mins: Math.round(p.lateMinutes) };
  if (p.tags?.some((t) => t.label === "Clock-in will snap" || t.label?.startsWith("Within grace"))) return { tone: "grace", mins: null };
  return { tone: "ok", mins: 0 };
};

/** Excluded records: greyed and struck through (not paid) */
const EXCLUDED_TEXT = "text-neutral-400 dark:text-neutral-600 line-through";

const DAY_NOTE = {
  pending:  "Pending",
  conflict: "Punch vs leave",
  excluded: "Excluded",
  leave:    "Leave",
  unsynced: "Not synced",
  off:      "No punches",
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
const Avatar = ({ emp, size = "w-9 h-9 text-sm" }) => (
  // background is the per-employee colour assigned at runtime by the shared hook
  <div className={`${size} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`} style={{ background: emp.color }}>
    {emp.initials}
  </div>
);

const Stat = ({ label, value, tone = "" }) => (
  <div className="text-right">
    <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
    <p className={`text-xl font-extrabold leading-tight ${tone || "text-neutral-900 dark:text-neutral-100"}`}>{value}</p>
  </div>
);

/** Small text link (no icons, per Carlo) */
const TextLink = ({ onClick, danger, disabled, title, children }) => (
  <button
    type="button"
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    title={title}
    className={`text-xs font-medium hover:underline underline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline ${
      danger ? "text-red-600 dark:text-red-400" : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
    }`}
  >
    {children}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// FLAGS, CHIPS AND PAY DEFAULTS (concept v2)
// ─────────────────────────────────────────────────────────────────────────────

/** Today's date (YYYY-MM-DD) in the company time zone */
const todayIsoIn = (tz) => {
  try { return new Date().toLocaleDateString("en-CA", { timeZone: tz }); }
  catch { return new Date().toISOString().slice(0, 10); }
};

const CHIP = {
  ok:       "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900",
  grace:    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  late:     "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  missing:  "bg-white text-red-700 border-red-400 dark:bg-neutral-900 dark:text-red-400 dark:border-red-700",
  past:     "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  early:    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900",
  neutral:  "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700",
  review:   "bg-white text-orange-700 border-orange-300 dark:bg-neutral-900 dark:text-orange-300 dark:border-orange-800",
  outline:  "bg-white text-neutral-700 border-neutral-400 dark:bg-neutral-900 dark:text-neutral-300 dark:border-neutral-600",
  today:    "bg-white text-neutral-900 border-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-300",
};

/** `small`: calendar-cell size — smaller text, and wraps inside the cell instead of overflowing */
const Chip = ({ kind, small, children }) => (
  <span className={`inline-flex items-center font-semibold rounded-md border ${
    small ? "text-[10px] leading-tight px-1 py-px whitespace-normal break-words max-w-full" : "text-[11px] px-1.5 py-0.5 whitespace-nowrap"
  } ${CHIP[kind] || CHIP.neutral}`}>
    {children}
  </span>
);

/** Banner tint per chip kind */
const BANNER = {
  grace:   "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200",
  late:    "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200",
  missing: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200",
  past:    "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950/20 dark:text-orange-200",
  early:   "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200",
  neutral: "border-neutral-200 bg-neutral-50 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200",
};

/**
 * Driver day: what happened at clock-in (vs the first window's start) and at clock-out
 * (vs the last window's end). Uses the times in /approvals only.
 *   entryIdx: the segment the clock-in lands in; earlier segments were missed (noAm when AM is one)
 *   inState:  late (beyond grace) | grace | early | ontime — against the ENTRY segment's start
 *   outState: noOut | past | leftEarly | exact
 * Server note: lateness within grace is stored as 0, so "grace" = after the window start but
 * not flagged beyond grace by the server.
 */
function analyzeDriverDay(group, windowMin, graceMin) {
  const segs  = group.segments;
  const first = segs[0];
  const last  = segs[segs.length - 1];
  const { rawIn, rawOut } = driverRaw(group);

  // The segment the clock-in actually lands in (first one whose window hasn't ended yet).
  // e.g. 9:53 AM → Regular (8:00–1:30): AM was missed, and Regular is 113 min late.
  let entryIdx = 0;
  if (rawIn) {
    const idx = segs.findIndex((x) => x.segmentEndIso && new Date(rawIn) < new Date(x.segmentEndIso));
    entryIdx = idx === -1 ? segs.length - 1 : idx;
  }
  const entry = segs[entryIdx];
  const noAm  = entryIdx > 0 && first?.segmentType === "driver_am";

  let inState = null;
  if (entry?.segmentStartIso && rawIn) {
    const late = minutesBetween(entry.segmentStartIso, rawIn);
    // Beyond grace = more than the company grace period, same limit as the server: grace + 59 s
    // (15-min grace → up to 7:00:59 is within grace for 6:45). The server's own flag isn't always
    // there for Driver/Aide punches, so it's only a fallback.
    const lateMs = new Date(rawIn) - new Date(entry.segmentStartIso);
    const beyond = lateMs > ((graceMin ?? 15) * 60 + 59) * 1000 || (entryIdx === 0 && first.lateStatus === "beyond_grace");
    if (late > 0) inState = { kind: beyond ? "late" : "grace", mins: late };
    else if (late < 0) inState = { kind: "early", mins: -late };
    else inState = { kind: "ontime", mins: 0 };
  }

  let outState = null;
  if (!rawOut) outState = { kind: "noOut" };
  else if (last?.segmentEndIso) {
    const d = minutesBetween(last.segmentEndIso, rawOut);
    outState = d > 0 ? { kind: "past", mins: d } : d < 0 ? { kind: "leftEarly", mins: -d } : { kind: "exact" };
    if (outState.kind === "past" && last.segmentType === "driver_pm") outState.seg = "PM";
  }

  // "Early Regular?": beyond grace AND within the company's early clock-in grace
  // (earlyClockInGraceMinutes — the server's "how early before a shift" rule; empty = always snap,
  // so 30 min is used then) before Regular starts — most likely an early Regular clock-in, not an AM run.
  let earlyRegular = null;
  const reg = segs.find((x) => x.segmentType === "regular");
  if (entryIdx === 0 && inState?.kind === "late" && first?.segmentType === "driver_am" && reg?.segmentStartIso && rawIn) {
    const before = minutesBetween(rawIn, reg.segmentStartIso);
    if (before >= 0 && before <= (windowMin ?? 30)) earlyRegular = { minsBefore: before, regularStart: reg.segmentStartIso };
  }
  return { rawIn, rawOut, inState, outState, first, last, earlyRegular, entryIdx, entry, noAm };
}

/** Hours between the raw clock-in and clock-out for a day's records (what's "on the clock") */
const clockedHours = (items) => items.reduce((sum, it) => {
  const span = (a, b) => (a && b ? Math.max(0, (new Date(b) - new Date(a)) / 3600000) : 0);
  if (it.type === "driver_group") {
    const { rawIn, rawOut } = driverRaw(it);
    const lunch = rawIn && rawOut ? lunchOverlapMs(it.segments[0]?.lunchBreak, rawIn, rawOut) / 3600000 : 0;
    return sum + Math.max(0, span(rawIn, rawOut) - lunch);
  }
  if (["leave", "absent", "unsynced", "rest"].includes(it.type)) return sum;
  return sum + leafsOf(it).reduce((x, p) => x + span(p.originalTimeIn || p.rawTimeIn, p.originalTimeOut || p.rawTimeOut), 0);
}, 0);

const inChip = (s) => {
  if (!s) return null;
  if (s.kind === "late")  return { kind: "late",    label: `Late ${s.mins}m` };
  if (s.kind === "grace") return { kind: "grace",   label: `Late ${s.mins}m · grace` };
  if (s.kind === "early") return { kind: "ok",      label: `✓ On time · ${s.mins}m early` };
  return { kind: "ok", label: "✓ On time" };
};
const outChip = (s) => {
  if (!s) return null;
  if (s.kind === "noOut")     return { kind: "missing", label: "No clock-out" };
  if (s.kind === "past")      return { kind: "past",    label: `+${s.mins}m ${s.seg || "past window"}` };
  if (s.kind === "leftEarly") return { kind: "early",   label: `Left ${s.mins}m early` };
  return null;
};

/** Regular punch: clock-in state from the server flags (see punchClockIn) */
const punchInState = (p) => {
  const ci = punchClockIn(p);
  if (!ci) return null;
  if (ci.tone === "beyond") return { kind: "late", mins: ci.mins };
  if (ci.tone === "grace")  return { kind: "grace", mins: ci.mins };
  return { kind: "ontime", mins: 0 };
};

/**
 * One decision row. Defaults follow Carlo's policy (concept v2):
 *   late (within or beyond grace) → Actual · early clock-in → Schedule
 *   PM past window → Actual · left early → Actual · No AM run → Actual (0h) · no clock-out → Hold
 * Hours: Schedule = window/shift length; Actual = the SERVER's hours for the record (grace-aware),
 * so the "Paying" total matches what approval pays.
 */
/**
 * What "Actual" (Raw) approval pays for a driver segment — mirrors the server's
 * approveDriverSegment (daycareCutoffStrategy.js):
 *   in  = later of clock-in and window start; within grace → window start
 *   out = actual clock-out on the last segment, otherwise the window end
 * The pending figure in /approvals is the raw time without the grace credit, so it isn't used here.
 * (Lunch inside the window is unpaid in both modes on the server; not applied in this preview.)
 */
const rawPayHours = (seg, isLast, a, graceMin) => {
  if (!seg.segmentStartIso || !seg.segmentEndIso) return Number(seg.hours) || 0;
  const start = new Date(seg.segmentStartIso).getTime();
  const end   = new Date(seg.segmentEndIso).getTime();
  const rawIn = a.rawIn ? new Date(a.rawIn).getTime() : start;
  const graceMs = ((graceMin ?? 15) * 60 + 59) * 1000; // same window as the server
  const lateMs  = rawIn - start;
  const inMs  = lateMs > 0 && lateMs <= graceMs ? start : Math.max(rawIn, start);
  const outMs = isLast && a.rawOut ? new Date(a.rawOut).getTime() : end;
  const lunch = lunchOverlapMs(seg.lunchBreak, inMs, outMs); // unpaid in Raw mode too (server BB-092)
  return Math.max(0, (outMs - inMs - lunch) / 3600000);
};

function segmentRow(seg, i, n, a, tz, graceMin) {
  const isFirst  = i === 0;
  const isLast   = i === n - 1;
  const isEntry  = i === a.entryIdx;            // the segment the clock-in lands in
  const isMissed = i < a.entryIdx;              // window ended before the clock-in
  const canS = seg.actions?.includes("approve-schedule");
  const canA = seg.actions?.includes("approve-raw");
  const lunchMs = lunchOverlapMs(seg.lunchBreak, seg.segmentStartIso, seg.segmentEndIso);
  const schedH = seg.segmentStartIso && seg.segmentEndIso
    ? Math.max(0, (new Date(seg.segmentEndIso) - new Date(seg.segmentStartIso) - lunchMs) / 3600000) // lunch unpaid in Schedule too
    : null;
  const actH   = rawPayHours(seg, isLast, a, graceMin);
  const lunchMin = Math.round(lunchMs / 60000);

  let options = [], pick = null, helper = {}, chips = [], matches = false;
  if (isLast && a.outState?.kind === "noOut") {
    options = ["hold", "schedule"]; pick = "hold";
    helper  = { hold: "Unpaid until the punch is fixed", schedule: "Pays the window" };
    chips.push(outChip(a.outState));
  } else if (isMissed) {
    options = ["actual", "schedule"]; pick = "actual";
    helper  = { actual: "Nothing on the clock in this window", schedule: "Pays the full window anyway" };
    chips.push(seg.segmentType === "driver_am" ? { kind: "missing", label: "No AM run" } : { kind: "missing", label: `No ${SEGMENT_LABELS[seg.segmentType] || "segment"} punch` });
  } else if (isEntry && a.inState && a.inState.kind !== "ontime") {
    const k = a.inState.kind;
    const m = a.inState.mins;
    pick   = k === "early" ? "schedule" : "actual"; // Carlo: any late clock-in defaults to Actual
    helper = {
      actual:   k === "grace" ? `Grace covers the ${m} late minute${m === 1 ? "" : "s"} · same hours either way`
              : k === "early" ? "Paid from the window start · early minutes aren't paid"
              : "Pays what was worked",
      schedule: k === "grace" ? `Grace covers the ${m} late minute${m === 1 ? "" : "s"}` : k === "early" ? "Early minutes aren't paid" : "Pays the full window",
    };
    if (a.earlyRegular) helper.actual = `Pays the ${minutesBetween(a.rawIn, seg.segmentEndIso)} min on the clock`;
    options = pick === "schedule" ? ["schedule", "actual"] : ["actual", "schedule"];
    chips.push(inChip(a.inState));
    if (a.earlyRegular) chips.push({ kind: "outline", label: "Early Regular?" });
  } else if (isLast && a.outState && a.outState.kind !== "exact") {
    const k = a.outState.kind;
    pick   = "actual"; // Carlo: past the window → Actual (the extra time may count toward OT); left early → Actual
    helper = {
      schedule: k === "past" ? `Caps at the ${fmtTime(seg.segmentEndIso, tz)} window` : "Pays the full window",
      actual:   k === "past" ? "Pays what was worked · may count toward OT" : "Pays what was worked",
    };
    options = pick === "schedule" ? ["schedule", "actual"] : ["actual", "schedule"];
    chips.push(outChip(a.outState));
  } else {
    matches = true;
  }
  options = options.filter((o) => o === "hold" || (o === "schedule" ? canS : canA));
  if (!matches && !options.includes(pick)) pick = options[0] ?? null;
  if (!matches && options.length === 0) matches = true;

  return {
    rec: seg,
    key: seg.id,
    kind: "segment",
    label: SEGMENT_LABELS[seg.segmentType] || seg.segmentType,
    windowText: `${fmtTime(seg.segmentStartIso, tz)} – ${fmtTime(seg.segmentEndIso, tz)}`,
    actIn:  isMissed ? null : isEntry ? a.rawIn : seg.segmentStartIso,
    actOut: isMissed ? null : isLast ? a.rawOut : seg.segmentEndIso,
    missed: isMissed,
    inState:  isEntry ? a.inState  : null,
    outState: isLast  ? a.outState : null,
    chips: chips.filter(Boolean),
    options, pick, helper, matches,
    matchText: "punches match the window",
    lunchMin,
    hours: { schedule: schedH, actual: actH, hold: 0 },
    scheduleLabel: "Schedule",
    bulkSchedule: true,
    earlyRegular: isEntry ? a.earlyRegular : null,
  };
}

/** Shift time ("HH:mm", or a 1970 ISO holding the wall time in UTC — how fmtShiftTime reads it) → "HH:mm" */
const shiftHHMM = (t) => {
  if (!t) return null;
  if (/^\d{1,2}:\d{2}$/.test(t)) return t.padStart(5, "0");
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

/**
 * Staff (Regular-only) punch vs its shift, e.g. 8:00 AM – 1:30 PM, in the company time zone.
 * Hours mirror the server's REGULAR approval (daycareCutoffStrategy.js), lunch deducted:
 *   Schedule — in: shift start if early or within grace, else the real clock-in;
 *              out: capped at the shift end (the real time if earlier); no clock-out → shift end
 *   Actual   — in: shift start only within grace (early minutes are paid); out: the real clock-out
 */
function staffAnalysis(p, tz, graceMin, shiftMap) {
  const rawIn  = p.originalTimeIn  || p.rawTimeIn;   // original = the real punch once approved
  const rawOut = p.originalTimeOut || p.rawTimeOut;
  // /approvals has no shift times for regular punches → fall back to the punch's shift from /api/timelogs
  const sh   = shiftMap?.[p.timeLogId];
  const sIn  = shiftHHMM(p.scheduleInfo?.shiftStart || sh?.start);
  const sOut = shiftHHMM(p.scheduleInfo?.shiftEnd   || sh?.end);
  if (!rawIn || !sIn || !sOut) return null;

  const dateStr  = new Date(rawIn).toLocaleDateString("en-CA", { timeZone: tz });
  const startIso = fromCompanyTzInput(`${dateStr}T${sIn}`, tz);
  let endIso     = fromCompanyTzInput(`${dateStr}T${sOut}`, tz);
  if (new Date(endIso) <= new Date(startIso)) endIso = new Date(new Date(endIso).getTime() + 86400000).toISOString();

  const graceMs = ((graceMin ?? 15) * 60 + 59) * 1000;            // same limit as the server
  const lateMs  = new Date(rawIn) - new Date(startIso);
  const late    = minutesBetween(startIso, rawIn);
  const inState = late > 0 ? { kind: lateMs > graceMs ? "late" : "grace", mins: late }
                : late < 0 ? { kind: "early", mins: -late }
                : { kind: "ontime", mins: 0 };

  let outState;
  if (!rawOut) outState = { kind: "noOut" };
  else {
    const d = minutesBetween(endIso, rawOut);
    outState = d > 0 ? { kind: "past", mins: d, seg: "past shift" } : d < 0 ? { kind: "leftEarly", mins: -d } : { kind: "exact" };
  }

  const S = new Date(startIso).getTime(), E = new Date(endIso).getTime();
  const I = new Date(rawIn).getTime(),    O = rawOut ? new Date(rawOut).getTime() : null;
  const withinGrace = lateMs > 0 && lateMs <= graceMs;
  const net = (a, b) => Math.max(0, (b - a - lunchOverlapMs(p.lunchBreak, a, b)) / 3600000);
  const schedIn  = I <= S || withinGrace ? S : I;
  const schedOut = O == null ? E : Math.min(O, E);
  const actIn    = withinGrace ? S : I;
  return {
    rawIn, rawOut, startIso, endIso, inState, outState,
    schedH: net(schedIn, schedOut),
    actH:   O == null ? null : net(actIn, O),
  };
}

function punchRow(p, isBNC, tz, graceMin, shiftMap) {
  if (!isBNC) {
    const st = staffAnalysis(p, tz, graceMin, shiftMap);
    const noSched = p.type === "unscheduled" || !st;
    if (!noSched) return staffRow(p, st, tz);
  }
  return punchRowBasic(p, isBNC);
}

/** Staff decision row — Carlo: default always Actual (no clock-out → Hold) */
function staffRow(p, st, tz) {
  const canS = p.actions?.includes("approve-schedule");
  const canA = p.actions?.includes("approve-raw");
  const i = st.inState, o = st.outState;
  const shiftText = `${fmtTime(st.startIso, tz)} – ${fmtTime(st.endIso, tz)}`;

  const chips = [];
  if (i.kind !== "ontime") chips.push(inChip(i));
  const oc = outChip(o);
  if (oc) chips.push(oc);

  let options = [], pick = null, helper = {}, matches = false;
  if (o.kind === "noOut") {
    options = ["hold", "schedule"]; pick = "hold";
    helper  = { hold: "Unpaid until the punch is fixed", schedule: "Pays from the clock-in to the shift end" };
  } else if (i.kind === "ontime" && o.kind === "exact") {
    matches = true;
  } else {
    options = ["actual", "schedule"]; pick = "actual";
    const a = ["Pays what was worked"];
    if (i.kind === "grace") a.push(`grace covers the ${i.mins} late min`);
    if (i.kind === "early") a.push(`includes ${i.mins} early min`);
    if (o.kind === "past")  a.push("may count toward OT");
    helper = { actual: a.join(" · "), schedule: `Fits to the ${shiftText} shift${i.kind === "late" ? " · late minutes stay unpaid" : ""}` };
  }
  options = options.filter((x) => x === "hold" || (x === "schedule" ? canS : canA));
  if (!matches && !options.includes(pick)) pick = options[0] ?? null;
  if (!matches && options.length === 0) matches = true;

  return {
    rec: p,
    key: p.id,
    kind: "punch",
    staff: st,
    label: p.punchType === "TRAINING" ? "Training" : "Regular",
    windowText: shiftText,
    actInText:  fmtTime(st.rawIn, tz),
    actOutText: st.rawOut ? fmtTime(st.rawOut, tz) : "no clock-out",
    inState: i,
    outState: o,
    chips,
    options, pick, helper, matches,
    matchText: "punches match the schedule",
    lunchMin: Math.round(lunchOverlapMs(p.lunchBreak, st.rawIn, st.rawOut) / 60000),
    hours: { schedule: st.schedH, actual: st.actH ?? 0, hold: 0 },
    scheduleLabel: "Schedule",
    bulkSchedule: true,
  };
}

function punchRowBasic(p, isBNC) {
  const canS = p.actions?.includes("approve-schedule");
  const canA = p.actions?.includes("approve-raw");
  const sh = Number(p.scheduledHours) || null;
  const h  = Number(p.hours) || 0;
  const noSched = p.noSchedule || p.type === "unscheduled" || !p.scheduleInfo;
  const ins = punchInState(p);

  let options = [], pick = null, helper = {}, chips = [], matches = false;
  if (noSched) {
    options = ["actual"]; pick = "actual";
    helper  = { actual: "No schedule that day · pays what was worked" };
    chips.push({ kind: "neutral", label: "No schedule" });
  } else if (ins?.kind === "late") {
    options = ["actual", "schedule"]; pick = "actual";
    helper  = { actual: "Pays what was worked", schedule: "Pays the full shift" };
    chips.push({ kind: "late", label: ins.mins ? `Late ${ins.mins}m` : "Late" });
  } else if (ins?.kind === "grace") {
    options = ["actual", "schedule"]; pick = "actual"; // Carlo: any late clock-in defaults to Actual
    helper  = { actual: "Grace covers the late minutes · same hours either way", schedule: "Grace covers the late minutes" };
    chips.push({ kind: "grace", label: "Late · grace" });
  } else if (!isBNC && sh && Math.abs(h - sh) * 60 < 1) {
    matches = true;
  } else if (!isBNC && sh && h > sh) {
    options = ["schedule", "actual"]; pick = "schedule";
    helper  = { schedule: "Caps at the scheduled shift", actual: "Pays what was worked" };
  } else {
    options = ["actual", "schedule"]; pick = "actual";
    helper  = { actual: "Pays what was worked", schedule: isBNC ? "Pick the shift to pay" : "Pays the full shift" };
  }
  options = options.filter((o) => (o === "schedule" ? canS : canA));
  if (!matches && !options.includes(pick)) pick = options[0] ?? null;
  if (!matches && options.length === 0) matches = true;

  const sched = p.scheduleInfo?.shiftStart && p.scheduleInfo?.shiftEnd
    ? `${fmtShiftTime(p.scheduleInfo.shiftStart)} – ${fmtShiftTime(p.scheduleInfo.shiftEnd)}` // same formatter as the List page
    : "—";
  return {
    rec: p,
    key: p.id,
    kind: "punch",
    label: p.punchType === "TRAINING" ? "Training" : "Regular",
    windowText: sched,
    actInText: p.timeIn,
    actOutText: p.timeOut,
    inState: ins,
    chips,
    options, pick, helper, matches,
    matchText: "punches match the schedule",
    lunchMin: Math.round(lunchOverlapMs(p.lunchBreak, p.rawTimeIn, p.rawTimeOut) / 60000),
    hours: { schedule: isBNC ? null : sh, actual: h, hold: 0 },
    scheduleLabel: isBNC ? "Pick shift…" : "Schedule",
    bulkSchedule: !isBNC,            // B&C needs the shift picker, one at a time
  };
}

/** Problem chips for a calendar day cell (no "on time" chips) */
function dayCellChips(items, windowMin, graceMin, tz, isBNC, shiftMap) {
  const out = [];
  items.forEach((it) => {
    if (it.type === "driver_group") {
      const a = analyzeDriverDay(it, windowMin, graceMin);
      if (a.noAm) out.push({ kind: "missing", label: "No AM run", side: "in" });
      const c1 = inChip(a.inState);
      if (c1 && c1.kind !== "ok") out.push({ ...c1, label: a.entryIdx > 0 ? `${c1.label} · ${a.entry?.segmentType === "regular" ? "Reg" : SEGMENT_LABELS[a.entry?.segmentType] || ""}`.trim() : c1.label, side: "in" });
      if (a.earlyRegular) out.push({ kind: "outline", label: "Early Regular?", side: "in" });
      const c2 = outChip(a.outState);
      if (c2) out.push({ ...c2, side: "out" });
    } else if (it.type !== "leave" && it.type !== "absent" && it.type !== "unsynced") {
      leafsOf(it).forEach((p) => {
        const st = !isBNC && p.type !== "conflict" ? staffAnalysis(p, tz, graceMin, shiftMap) : null;
        if (st) {
          const c1 = inChip(st.inState);
          if (c1 && c1.kind !== "ok" && st.inState.kind !== "ontime") out.push({ ...c1, side: "in" });
          const c2 = outChip(st.outState);
          if (c2) out.push({ ...c2, side: "out" });
          return;
        }
        const s = punchInState(p);
        if (s?.kind === "late") out.push({ kind: "late", label: s.mins ? `Late ${s.mins}m` : "Late", side: "in" });
        if (s?.kind === "grace") out.push({ kind: "grace", label: "Late · grace", side: "in" });
      });
    }
  });
  return out;
}

/** Radio-style pay option (drawn control, no icon library) */
const PayOption = ({ label, hours, selected, onSelect, disabled }) => (
  <button
    type="button"
    onClick={disabled ? undefined : onSelect}
    disabled={disabled}
    className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap border transition-colors ${
      selected
        ? "bg-white border-neutral-400 shadow-sm text-neutral-900 dark:bg-neutral-900 dark:border-neutral-500 dark:text-neutral-100"
        : disabled
        ? "border-transparent text-neutral-400 cursor-default"
        : "border-transparent text-neutral-600 hover:bg-white/70 dark:text-neutral-300 dark:hover:bg-neutral-900/60"
    }`}
  >
    <span className={`w-3 h-3 rounded-full border flex items-center justify-center flex-shrink-0 ${selected ? "border-orange-500" : "border-neutral-400"}`}>
      {selected && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
    </span>
    <span className="font-semibold">{label}</span>
    {hours != null && <span className="font-bold">{fmtH(hours)}</span>}
  </button>
);

const OPTION_LABEL = { schedule: "Schedule", actual: "Actual", hold: "Hold" };

const LegendRow = ({ title, children }) => (
  <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap">
    <span className="w-16 text-xs font-semibold text-neutral-700 dark:text-neutral-300">{title}</span>
    {children}
  </div>
);
const LegendItem = ({ chip, kind, text }) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
    <Chip kind={kind}>{chip}</Chip> {text}
  </span>
);

/** Clock-in text coloured by its state: green on time/early · orange within grace · red beyond grace / no AM run */
const IN_TONE = {
  ontime: "text-green-700 dark:text-green-400",
  early:  "text-green-700 dark:text-green-400",
  grace:  "text-orange-600 dark:text-orange-400",
  late:   "text-red-600 dark:text-red-400",
  noAm:   "text-red-600 dark:text-red-400",
};
const ClockInText = ({ state, text, muted, fallbackBold }) => {
  if (muted) return <span>{text}</span>;
  if (!state) return fallbackBold ? <strong className="text-neutral-900 dark:text-neutral-100">{text}</strong> : <span>{text}</span>;
  return <strong className={IN_TONE[state.kind] || "text-neutral-900 dark:text-neutral-100"}>{text}</strong>;
};

/**
 * For a decided row: which option was paid. The server doesn't say, so:
 *   1) the option approved from this page this session (row.approvedMode), else
 *   2) the nearest of Schedule/Actual hours — a tie (same hours either way) shows Actual, the default.
 */
const paidMode = (row) => {
  if (row.approvedMode) return row.approvedMode;
  if (row.hours.schedule == null) return "actual";
  const h = Number(row.rec.hours) || 0;
  return Math.abs(h - row.hours.schedule) < Math.abs(h - (row.hours.actual ?? Infinity)) ? "schedule" : "actual";
};

/**
 * Driver day, all segments decided: the times actually paid (same rules as the server):
 *   start — window start (Schedule, within grace, or early); the real clock-in only on Actual beyond grace
 *   end   — window end (Schedule); the real clock-out only on Actual for the last segment
 */
function paidSpan(rows, a) {
  const segs = rows.filter((r) => r.kind === "segment" && r.rec.localStatus && r.rec.localStatus !== "excluded" && !r.missed);
  if (!segs.length) return null;
  const f = segs[0], l = segs[segs.length - 1];
  let inIso = f.rec.segmentStartIso;
  if (f.inState?.kind === "late" && paidMode(f) === "actual" && a.rawIn) inIso = a.rawIn;
  let outIso = l.rec.segmentEndIso;
  if (l.outState && l.outState.kind !== "noOut" && paidMode(l) === "actual" && a.rawOut) outIso = a.rawOut;
  return { inIso, outIso };
}

/**
 * Everything the calendar cell, the day panel, the summary and the Overtime strip need for one day.
 * ctx = { picks, tz, isBNC, graceMin, windowMin }
 */
function buildDayModel(d, iso, ctx) {
  if (!d) return null;
  const { picks, tz, isBNC, graceMin, windowMin } = ctx;
  const rows = [];
  const banners = [];
  let driver = null;
  let staff  = null;   // first Staff (Regular-only) punch row of the day, for the header
  const g = graceMin != null ? `${graceMin}-min grace period` : "grace period";

  d.items.forEach((it) => {
    if (it.type === "driver_group") {
      const a = analyzeDriverDay(it, windowMin, graceMin);
      driver = { a, segments: it.segments.length };
      it.segments.forEach((seg, i) => rows.push(segmentRow(seg, i, it.segments.length, a, tz, graceMin)));
      const s = a.inState, o = a.outState;
      const firstId = it.segments[0]?.id, lastId = it.segments[it.segments.length - 1]?.id;
      const entryId = it.segments[a.entryIdx]?.id;
      const entryLabel = SEGMENT_LABELS[a.entry?.segmentType] || "the first segment";
      const bStart = banners.length;
      if (a.noAm) banners.push({ rowId: firstId, kind: "missing", chip: "No AM run", strong: "The AM run didn't happen.", text: ` First punch was ${fmtTime(a.rawIn, tz)}, after the AM window had closed. This isn't lateness for AM.` });
      if (a.entryIdx > 0 && s?.kind === "late") {
        banners.push({ rowId: entryId, kind: "late", chip: `Late ${s.mins}m`, strong: `Clocked in at ${fmtTime(a.rawIn, tz)}, ${s.mins} min after ${entryLabel} started.`, text: ` Past the ${g}. Actual is the default.` });
      } else if (a.entryIdx > 0 && s?.kind === "grace") {
        banners.push({ rowId: entryId, kind: "grace", chip: `Late ${s.mins}m · grace`, strong: `Clocked in ${s.mins} min after ${entryLabel} started,`, text: ` inside the ${g}, so it's still paid from the window start. Actual is the default.` });
      } else if (s?.kind === "late" && a.earlyRegular) {
        const am = it.segments[0];
        banners.push({
          kind: "late", chip: `Late ${s.mins}m`,
          strong: `Clocked in at ${fmtTime(a.rawIn, tz)}, ${s.mins} min after the AM window opened.`,
          text: ` That's far past grace and ${a.earlyRegular.minsBefore} min before Regular starts, so it's most likely an early Regular clock-in, not an AM run.`,
          action: !am.localStatus ? { label: "Exclude as early Regular clock-in", recId: am.id, reason: "early_regular" } : null,
        });
      } else if (s?.kind === "late") {
        banners.push({ kind: "late", chip: `Late ${s.mins}m`, strong: `Clocked in ${s.mins} min late,`, text: ` past the ${g}. Actual is the default.` });
      }
      if (a.entryIdx === 0 && s?.kind === "grace") banners.push({ kind: "grace", chip: `Late ${s.mins}m · grace`, strong: `Clocked in ${s.mins} min late,`, text: ` inside the ${g}, so it's still paid from the window start. Actual is the default.` });
      if (o?.kind === "noOut") banners.push({ kind: "missing", chip: "No clock-out", strong: "No clock-out.", text: " Ask for a correction, or pay the window." });
      if (o?.kind === "past")  banners.push({ kind: "past", chip: `+${o.mins}m ${o.seg || "past window"}`, strong: `${SEGMENT_LABELS[a.last?.segmentType] || "Last segment"} ran ${o.mins} min long.`, text: ` Clocked out ${fmtTime(a.rawOut, tz)} against a ${fmtTime(a.last?.segmentEndIso, tz)} window.` });
      if (o?.kind === "leftEarly") banners.push({ kind: "early", chip: `Left ${o.mins}m early`, strong: `Clocked out at ${fmtTime(a.rawOut, tz)},`, text: ` ${o.mins} min before the ${SEGMENT_LABELS[a.last?.segmentType] || "last"} window ended.` });
      // Clock-out banners (no clock-out, past window, left early) belong to the last segment; the rest to the first
      banners.slice(bStart).forEach((b) => {
        if (b.rowId) return;
        const outSide = b.kind === "past" || b.kind === "early" || b.chip === "No clock-out";
        b.rowId = outSide ? lastId : firstId;
      });
    } else if (it.type === "leave" || it.type === "unsynced" || it.type === "absent") {
      if (it.type !== "absent") rows.push({ rec: it, key: it.id, kind: it.type });
    } else {
      leafsOf(it).forEach((p) => {
        if (p.type === "conflict") { rows.push({ rec: p, key: p.id, kind: "conflict" }); return; }
        const row = punchRow(p, isBNC, tz, graceMin, ctx.shiftMap);
        rows.push(row);
        if (row.staff) {
          const st = row.staff, i = st.inState, o = st.outState;
          if (!staff) staff = row;
          if (i.kind === "late")  banners.push({ rowId: p.id, kind: "late", chip: `Late ${i.mins}m`, strong: `Clocked in at ${fmtTime(st.rawIn, tz)}, ${i.mins} min after the shift started.`, text: ` Past the ${g}. Actual is the default.` });
          if (i.kind === "grace") banners.push({ rowId: p.id, kind: "grace", chip: `Late ${i.mins}m · grace`, strong: `Clocked in ${i.mins} min late,`, text: ` inside the ${g}, so it's still paid from ${fmtTime(st.startIso, tz)}. Actual is the default.` });
          if (o.kind === "noOut") banners.push({ rowId: p.id, kind: "missing", chip: "No clock-out", strong: "No clock-out.", text: " Ask for a correction, or pay to the shift end." });
          if (o.kind === "past")  banners.push({ rowId: p.id, kind: "past", chip: `+${o.mins}m past shift`, strong: `Stayed ${o.mins} min past the shift.`, text: ` Clocked out ${fmtTime(st.rawOut, tz)} against a ${fmtTime(st.endIso, tz)} shift end.` });
          if (o.kind === "leftEarly") banners.push({ rowId: p.id, kind: "early", chip: `Left ${o.mins}m early`, strong: `Clocked out at ${fmtTime(st.rawOut, tz)},`, text: ` ${o.mins} min before the shift ended.` });
        } else {
          if (row.inState?.kind === "late")  banners.push({ rowId: p.id, kind: "late", chip: row.chips[0]?.label, strong: "Clocked in late,", text: ` past the ${g}. Actual is the default.` });
          if (row.inState?.kind === "grace") banners.push({ rowId: p.id, kind: "grace", chip: "Late · grace", strong: "Clocked in late,", text: ` inside the ${g}, so it's still paid from the shift start. Actual is the default.` });
        }
      });
    }
  });

  rows.forEach((r) => { const m = ctx.approvedModes?.[r.rec.id]; if (m) r.approvedMode = m; });
  const decisionRows = rows.filter((r) => r.kind === "segment" || r.kind === "punch");
  const effPick = (r) => picks[r.rec.id] ?? r.pick;
  // What each row pays: approved → server's hours; pending → the chosen option; excluded → 0
  const payOf = (r) => {
    const st = r.rec.localStatus;
    if (st === "excluded" || r.rec.isFixedHours) return 0;
    if (st) return Number(r.rec.hours) || 0;
    if (r.matches) return r.hours.schedule ?? r.hours.actual ?? 0;
    return r.hours[effPick(r)] ?? 0;
  };
  const parts   = decisionRows.filter((r) => r.rec.localStatus !== "excluded").map(payOf);
  const leaveH  = rows.filter((r) => r.kind === "leave").reduce((s, r) => s + (r.rec.payableHours ?? r.rec.hours ?? 0), 0);
  const pending = decisionRows.filter((r) => !r.rec.localStatus && !r.rec.isFixedHours);
  const approvedH = decisionRows.filter((r) => r.rec.localStatus && r.rec.localStatus !== "excluded").reduce((s, r) => s + payOf(r), 0) + leaveH;
  const waitingH  = pending.reduce((s, r) => s + (effPick(r) === "hold" && !r.matches ? 0 : payOf(r)), 0);
  // Hours paying Driver PM on Actual would add over the current pick (for the Overtime strip)
  const pmExtra = pending
    .filter((r) => r.kind === "segment" && r.outState?.kind === "past" && effPick(r) === "schedule")
    .reduce((s, r) => s + Math.max(0, (r.hours.actual ?? 0) - (r.hours.schedule ?? 0)), 0);

  const span = driver && pending.length === 0 ? paidSpan(rows, driver.a) : null;

  return {
    rows, banners, driver, staff, effPick, payOf, span,
    paying: parts.reduce((s, x) => s + x, 0) + leaveH,
    parts, pending, approvedH, waitingH, pmExtra,
    clocked: clockedHours(d.items),
    lunchMin: dayLunchMinutes(d.items),
    lunchLines: rows
      .filter((r) => (r.kind === "segment" || r.kind === "punch") && r.lunchMin > 0 && r.rec.lunchBreak)
      .map((r) => ({
        key: r.key,
        chip: `Lunch ${r.lunchMin}m`,
        text: `Lunch ${fmtTime(r.rec.lunchBreak.start, tz)} → ${fmtTime(r.rec.lunchBreak.end, tz)} (${r.lunchMin} min)`,
        where: r.kind === "segment" ? `deducted from ${r.label}` : "deducted from this punch",
      })),
    flags: dayCellChips(d.items, windowMin, graceMin, tz, isBNC, ctx.shiftMap),
    leaves: rows.filter((r) => r.kind === "leave").length,
    total: decisionRows.filter((r) => !r.rec.isFixedHours).length,
    weekend: isoWeekday(iso) >= 5,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CutoffReviewCalendar({ cutoffId }) {
  const router = useRouter();
  const r = useCutoffReview(cutoffId);
  const {
    token, cutoff, isLoading, syncing, doSync,
    mergedEmployees, companyTimezone: tz, isBNC,
    otBasis, dailyOtThresholdHours, cutoffOtThresholdHours, otBlocks, localOTBlockStatus, refreshingOT,
    doOTBlock, handleApproveSchedule, requestApproveRaw, doReset, doConflict,
    refreshApprovals, setFinalizeModal, finalizeReady, getDepartmentName, gracePeriodMinutes, earlyClockInGraceMinutes, shiftByTimeLog,
  } = r;

  const [selectedId, setSelectedId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null); // isoDate
  const [search, setSearch] = useState("");
  const [otOnly, setOtOnly] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const isOpenPeriod = (cutoff?.status || "open") === "open";
  const blockStatus = (b) => localOTBlockStatus[b.id] || b.status;
  const otHoursOf = (b) => Number(b.breakdown?.otHours ?? b.otHours) || 0;

  // ── Period days + calendar weeks (Mon–Sun) ───────────────────────────────
  const periodDays = useMemo(
    () => enumeratePeriodDays(cutoff?.periodStart, cutoff?.periodEnd, tz),
    [cutoff?.periodStart, cutoff?.periodEnd, tz]
  );
  const labelByIso = useMemo(() => Object.fromEntries(periodDays.map((d) => [d.isoDate, d.label])), [periodDays]);
  const weeks = useMemo(() => {
    if (!periodDays.length) return [];
    const first = periodDays[0].isoDate;
    const last  = periodDays[periodDays.length - 1].isoDate;
    let cur = isoAddDays(first, -isoWeekday(first));
    const end = isoAddDays(last, 6 - isoWeekday(last));
    const out = [];
    while (cur <= end) {
      const week = [];
      for (let i = 0; i < 7; i++) { week.push(cur); cur = isoAddDays(cur, 1); }
      out.push(week);
    }
    return out;
  }, [periodDays]);

  // ── Employees: list order + per-employee OT summary ──────────────────────
  const employees = useMemo(() => {
    return mergedEmployees.map((emp) => {
      const blocks = emp.otBlocks || [];
      const pendingOT  = blocks.filter((b) => blockStatus(b) === "pending");
      const approvedOT = blocks.filter((b) => blockStatus(b) === "approved");
      const worked = emp.records.reduce((s, rec) =>
        s + leafsOf(rec).filter((l) => !NON_ACTIONABLE.has(l.type))
          .reduce((x, l) => (l.localStatus === "excluded" || l.isFixedHours ? x : x + (l.hours || 0)), 0), 0);
      return {
        ...emp,
        worked,
        pendingOTBlocks: pendingOT,
        eligibleOT: blocks.filter((b) => blockStatus(b) !== "excluded").reduce((s, b) => s + otHoursOf(b), 0),
        pendingOTHours: pendingOT.reduce((s, b) => s + otHoursOf(b), 0),
        approvedOTHours: approvedOT.reduce((s, b) => s + otHoursOf(b), 0),
      };
    }).sort((a, b) =>
      (b.pendingOTBlocks.length > 0) - (a.pendingOTBlocks.length > 0) ||
      (b.pending > 0) - (a.pending > 0) ||
      a.name.localeCompare(b.name)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedEmployees, localOTBlockStatus]);

  const visibleEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) =>
      (!q || e.name.toLowerCase().includes(q) || (e.email || "").toLowerCase().includes(q)) &&
      (!otOnly || (e.otBlocks || []).length > 0)
    );
  }, [employees, search, otOnly]);

  const emp = employees.find((e) => e.id === selectedId) || visibleEmployees[0] || null;

  // Default the selected day: OT-crossing day, else first pending day, else first period day
  const days = useMemo(() => {
    if (!emp) return {};
    return Object.fromEntries(periodDays.map((d) => [d.isoDate, dayInfo(emp, d.label)]));
  }, [emp, periodDays]);

  // ── Overtime (server blocks only) ────────────────────────────────────────
  const isCutoffBasis = otBasis === "cutoff";
  const threshold = isCutoffBasis ? cutoffOtThresholdHours : dailyOtThresholdHours;
  const ruleLabel = otBasis === "cutoff" ? `Cutoff · ${cutoffOtThresholdHours ?? "—"}h`
    : otBasis === "weekly" ? "Weekly"
    : otBasis === "daily" ? `Daily · ${dailyOtThresholdHours ?? 8}h`
    : null;

  const periodBlock = isCutoffBasis ? (emp?.otBlocks?.[0] ?? null) : null;
  const crossedIso = useMemo(() => {
    const bd = periodBlock?.breakdown;
    if (!bd?.days?.length || bd.threshold == null) return null;
    let cum = 0;
    for (const d of [...bd.days].sort((a, b) => a.date.localeCompare(b.date))) {
      cum += Number(d.hours) || 0;
      if (cum > Number(bd.threshold)) return d.date.slice(0, 10);
    }
    return null;
  }, [periodBlock]);

  useEffect(() => {
    if (!emp || !periodDays.length) return;
    if (selectedDay && labelByIso[selectedDay]) return;
    const firstPending = periodDays.find((d) => days[d.isoDate]?.status === "pending" || days[d.isoDate]?.status === "conflict");
    setSelectedDay(crossedIso || firstPending?.isoDate || periodDays[0].isoDate);
  }, [emp?.id, periodDays, crossedIso]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Header numbers ───────────────────────────────────────────────────────
  const allPendingBlocks  = otBlocks.filter((b) => blockStatus(b) === "pending");
  const allApprovedOTHrs  = otBlocks.filter((b) => blockStatus(b) === "approved").reduce((s, b) => s + otHoursOf(b), 0);


  // ── Day panel (concept v2): pick first, then approve ────────────────────
  const [picks, setPicks] = useState({});      // { [recId]: "schedule" | "actual" | "hold" } — unsaved choices
  const [approvedModes, setApprovedModes] = useState({}); // { [recId]: "schedule" | "actual" } — what was approved from this page
  const [bulkBusy, setBulkBusy] = useState(false);
  const todayIso = todayIsoIn(tz);

  const dayModels = useMemo(() => {
    const ctx = { picks, approvedModes, tz, isBNC, graceMin: gracePeriodMinutes, windowMin: earlyClockInGraceMinutes, shiftMap: shiftByTimeLog };
    return Object.fromEntries(periodDays.map((pd) => [pd.isoDate, buildDayModel(days[pd.isoDate], pd.isoDate, ctx)]));
  }, [periodDays, days, picks, approvedModes, tz, isBNC, gracePeriodMinutes, earlyClockInGraceMinutes, shiftByTimeLog]);
  const dayModel = selectedDay ? dayModels[selectedDay] || null : null;

  // Employee totals across the period (Approved · Waiting · Clocked) + Overtime-strip hours
  const totals = useMemo(() => {
    const t = { approved: 0, waiting: 0, clocked: 0, paying: 0, pmExtra: 0, daysLogged: 0, flagsOpen: 0, leaves: 0, toReview: 0 };
    Object.values(dayModels).forEach((m) => {
      if (!m) return;
      t.approved += m.approvedH; t.waiting += m.waitingH; t.clocked += m.clocked; t.paying += m.paying; t.pmExtra += m.pmExtra;
      t.leaves += m.leaves;
      if (m.clocked > 0) t.daysLogged += 1;
      if (m.pending.length > 0) { t.toReview += 1; t.flagsOpen += m.flags.length; }
    });
    return t;
  }, [dayModels]);

  const choose = (recId, opt) => setPicks((p) => ({ ...p, [recId]: opt }));
  const clearPick = (recId) => setPicks((p) => { const n = { ...p }; delete n[recId]; return n; });

  const approveOne = (row) => {
    if (PREVIEW) return;
    const pick = row.matches ? (row.options.includes("schedule") || row.rec.actions?.includes("approve-schedule") ? "schedule" : "actual") : dayModel.effPick(row);
    if (pick === "hold") return;
    clearPick(row.rec.id);
    setApprovedModes((m) => ({ ...m, [row.rec.id]: row.matches ? "actual" : pick }));
    if (pick === "schedule") handleApproveSchedule(row.rec);
    else requestApproveRaw(row.rec.id);
  };

  /** "Approve remaining": sequential PATCHes with each row's pick, then ONE /approvals reload */
  const approveRemaining = async () => {
    if (PREVIEW) return;
    if (!dayModel) return;
    const todo = [], skipped = [];
    dayModel.pending.forEach((r) => {
      const pick = r.matches
        ? (r.rec.actions?.includes("approve-schedule") && r.bulkSchedule ? "schedule" : "actual")
        : dayModel.effPick(r);
      if (pick === "hold" || !pick) { skipped.push(r); return; }
      if (pick === "schedule" && !r.bulkSchedule) { skipped.push(r); return; }   // B&C shift picker
      if (pick === "actual" && r.rec.noSchedule) { skipped.push(r); return; }    // needs the no-schedule confirm
      todo.push({ r, mode: pick === "schedule" ? "schedule" : "raw" });
    });
    if (!todo.length) { toast.info("Nothing to approve with the current picks"); return; }
    setBulkBusy(true);
    let ok = 0, failed = 0;
    for (const { r, mode } of todo) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/approvals/${r.rec.id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve", approvalMode: mode }),
        });
        if (!res.ok) throw new Error();
        ok++;
      } catch { failed++; }
    }
    setApprovedModes((m) => {
      const n = { ...m };
      todo.forEach(({ r, mode }) => { n[r.rec.id] = r.matches ? "actual" : mode === "schedule" ? "schedule" : "actual"; });
      return n;
    });
    await refreshApprovals(todo[0].r.rec.id);
    setPicks((p) => { const n = { ...p }; todo.forEach(({ r }) => delete n[r.rec.id]); return n; });
    setBulkBusy(false);
    const held = skipped.length ? ` · ${skipped.length} left for you to decide` : "";
    if (failed === 0) toast.success(`${ok} approved${held}`);
    else toast.warning(`${ok} approved, ${failed} failed${held}`);
  };

  const remainingPay = dayModel
    ? dayModel.pending.reduce((s, r) => s + (dayModel.effPick(r) === "hold" ? 0 : dayModel.payOf(r)), 0)
    : 0;

  // ── Exclude (Calendar page's own dialog; the shared one is skipped) ─────
  // Reason values match the List page's, plus the new early-Regular one. Server v2.11.12 saves
  // both as "<reason> — <note>", so they're sent as separate fields (same as the List page).
  const EXCLUDE_CHOICES = [
    { id: "early_regular", value: "Early clock-in for Regular — not a Driver AM run", label: "Early clock-in for Regular, not a Driver AM run",
      desc: (row) => `The punch starts the Regular shift. Driver AM pays 0h; Regular still starts at ${fmtTime(row?.earlyRegular?.regularStart, tz)}.` },
    { id: "invalid",     value: "Suspected invalid punch",             label: "Suspected invalid punch",                 desc: () => "Device, location or time looks wrong." },
    { id: "leave",       value: "Leave takes precedence",              label: "Leave takes precedence",                  desc: () => "Approved leave covers this time." },
    { id: "other",       value: "Other",                               label: "Other",                                   desc: () => "Explain in the note (required)." },
  ];
  const [exTarget, setExTarget] = useState(null);   // { row }
  const [exChoice, setExChoice] = useState("");
  const [exNote, setExNote]     = useState("");
  const [exBusy, setExBusy]     = useState(false);

  const openExclude = (row, suggested = null) => {
    if (PREVIEW) return;
    setExTarget({ row, suggested });
    setExChoice(suggested || "");
    setExNote("");
  };

  const submitExclude = async () => {
    if (PREVIEW) return;
    const choice = EXCLUDE_CHOICES.find((c) => c.id === exChoice);
    if (!exTarget || !choice) return;
    const note = exNote.trim();
    if (choice.id === "other" && !note) return;
    setExBusy(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/approvals/${exTarget.row.rec.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "exclude", reason: choice.value, notes: note || undefined }),
      });
      if (!res.ok) throw new Error();
      setExTarget(null);
      toast.success(`${exTarget.row.label} excluded`);
      await refreshApprovals(exTarget.row.rec.id); // one /approvals reload after the action
    } catch {
      toast.error("Failed to exclude");
    } finally {
      setExBusy(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-14 w-full" />
        <div className="grid lg:grid-cols-[300px_1fr] gap-4">
          <Skeleton className="h-96 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const day = selectedDay ? days[selectedDay] : null;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Toaster position="top-center" />
      <SyncOverlay syncing={syncing} />

      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-4 flex-wrap px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => router.push("/dashboard/company/cutoff-periods")} aria-label="Back to cutoff periods">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-xs text-neutral-500 truncate">Cutoff periods / {getDepartmentName(cutoff?.departmentId)}</p>
              <h1 className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100 leading-tight">{fmtRange(cutoff?.periodStart, cutoff?.periodEnd)}</h1>
            </div>
            <Badge className="border-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 whitespace-nowrap capitalize">
              {cutoff?.status || "open"} · pays {fmtShortDate(cutoff?.paymentDate)}
            </Badge>
            <CutoffHistoryButton cutoff={cutoff} />
            {ruleLabel && (
              <Badge className="border-0 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 whitespace-nowrap gap-1">
                <TrendingUp className="w-3 h-3" /> OT rule · {ruleLabel}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs leading-tight">
              <p><strong>{allPendingBlocks.length}</strong> OT to decide</p>
              <p className="text-neutral-500"><strong className="text-neutral-800 dark:text-neutral-200">{fmtH(allApprovedOTHrs)}</strong> OT approved this period</p>
            </div>
            {isOpenPeriod && (
              <Button variant="outline" size="sm" onClick={PREVIEW ? undefined : doSync} disabled={PREVIEW || syncing} title={PREVIEW ? PREVIEW_TIP : ""} className="gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync
              </Button>
            )}
            <Button
              size="sm"
              onClick={PREVIEW ? undefined : () => setFinalizeModal(true)}
              disabled={PREVIEW || !finalizeReady}
              title={PREVIEW ? PREVIEW_TIP : finalizeReady ? "" : "Review every record and decide on overtime first"}
              className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white disabled:bg-neutral-200 disabled:text-neutral-500 dark:disabled:bg-neutral-800"
            >
              <Lock className="w-3.5 h-3.5" /> Finalize cutoff
            </Button>
          </div>
        </div>
      </div>

      {PREVIEW && (
        <div className="mx-4 sm:mx-6 mt-4 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-orange-900 dark:text-orange-200">
            <strong>Preview of the new Calendar view.</strong> Approvals, exclusions and overtime decisions still happen in the List view.
          </p>
          <Button size="sm" variant="outline" className="bg-white dark:bg-neutral-900" onClick={() => { window.location.href = listViewHref(); }}>
            Open List view
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-4 p-4 sm:p-6 items-start">

        {/* ── Employee list ── */}
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden lg:sticky lg:top-24">
          <div className="p-3 space-y-2 border-b border-neutral-200 dark:border-neutral-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${employees.length} employees`} className="pl-9 text-sm" />
            </div>
            <button
              type="button"
              onClick={() => setOtOnly((v) => !v)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                otOnly ? "bg-orange-500 border-orange-500 text-white" : "border-neutral-200 text-neutral-700 hover:border-orange-300 dark:border-neutral-700 dark:text-neutral-300"
              }`}
            >
              Has OT
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {visibleEmployees.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-10">No employees match</p>
            ) : visibleEmployees.map((e) => {
              const active = emp?.id === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => { setSelectedId(e.id); setSelectedDay(null); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 transition-colors ${
                    active ? "bg-orange-50 border-l-2 border-l-orange-500 dark:bg-orange-950/20" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                  }`}
                >
                  <Avatar emp={e} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate">{e.name}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {fmtH(e.worked)} worked · {e.pending > 0 ? `${e.pending} pending` : "all approved"}
                    </p>
                  </div>
                  {e.pendingOTHours > 0 && (
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-orange-500 text-white whitespace-nowrap">+{fmtH(e.pendingOTHours)} OT</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Selected employee ── */}
        {!emp ? (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-10 text-center text-neutral-500">
            No employees in this cutoff yet.
          </div>
        ) : (
          <div className="space-y-4 min-w-0">

            {/* Summary */}
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar emp={emp} size="w-11 h-11 text-base" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{emp.name}</h2>
                    {emp.isDriver && <Chip kind="neutral">Driver/Aide</Chip>}
                    {emp.fixedHours && <Chip kind="neutral">Fixed hours</Chip>}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {totals.daysLogged} day{totals.daysLogged === 1 ? "" : "s"} logged · {totals.flagsOpen} flag{totals.flagsOpen === 1 ? "" : "s"} open · {totals.leaves} leave
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <Stat label="Approved" value={fmtH(totals.approved)} tone="text-green-700 dark:text-green-400" />
                <Stat label="Waiting" value={fmtH(totals.waiting)} tone={totals.waiting > 0 ? "text-orange-700 dark:text-orange-400" : ""} />
                <Stat label="Clocked" value={fmtH(totals.clocked)} />
              </div>
            </div>

            {/* Overtime strip — hours progress only; the badge shows only the server's OT blocks */}
            {(() => {
              const thr = isCutoffBasis ? Number(cutoffOtThresholdHours) || null : null;
              const soFar = totals.paying;
              const blocks = emp.otBlocks || [];
              return (
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex items-center gap-4 flex-wrap">
                  <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">Overtime · {ruleLabel || "—"}</p>
                  <div className="flex-1 min-w-[220px]">
                    {thr ? (
                      <>
                        <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                          {/* width computed from the hours being paid vs the threshold */}
                          <div className="h-full bg-neutral-700 dark:bg-neutral-400" style={{ width: `${Math.min(100, (soFar / thr) * 100)}%` }} />
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">
                          {fmtH(soFar)} of {fmtH(thr)} so far ·{" "}
                          {soFar < thr ? `${fmtH(thr - soFar)} before the threshold` : `${fmtH(soFar - thr)} past the threshold · the server works out overtime`}
                          {totals.pmExtra > 0 ? ` · paying Driver PM on actual would add ${fmtH(totals.pmExtra)}` : ""}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-neutral-500">
                        {otBasis === "daily" ? `Each day's time past ${dailyOtThresholdHours ?? 8}h is overtime.` : "Overtime follows the company's rule in Configurations."}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {blocks.length === 0 ? (
                      <Chip kind="neutral">No overtime yet</Chip>
                    ) : blocks.map((b) => {
                      const st = blockStatus(b);
                      if (st === "approved") return <Chip key={b.id} kind="ok">✓ {fmtH(otHoursOf(b))} OT approved</Chip>;
                      if (st === "excluded") return <Chip key={b.id} kind="neutral">{fmtH(otHoursOf(b))} OT declined</Chip>;
                      return (
                        <span key={b.id} className="inline-flex items-center gap-2">
                          <Chip kind="past">+{fmtH(otHoursOf(b))} OT{!isCutoffBasis && b.date ? ` · ${fmtShortDate(b.date)}` : ""}</Chip>
                          {isOpenPeriod && (
                            <>
                              <Button size="sm" className="h-7 bg-orange-500 hover:bg-orange-600 text-white" disabled={PREVIEW} title={PREVIEW ? PREVIEW_TIP : ""} onClick={PREVIEW ? undefined : () => doOTBlock(b.id, "approve")}>Approve</Button>
                              <Button size="sm" variant="outline" className="h-7" disabled={PREVIEW} title={PREVIEW ? PREVIEW_TIP : ""} onClick={PREVIEW ? undefined : () => doOTBlock(b.id, "exclude")}>Decline</Button>
                            </>
                          )}
                        </span>
                      );
                    })}
                    {refreshingOT && <span className="text-xs text-neutral-500 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Updating…</span>}
                  </div>
                </div>
              );
            })()}

            {/* Period at a glance */}
            {(() => {
              const inDays   = periodDays.map((d) => d.isoDate);
              const firstIso = inDays[0];
              const lastIso  = inDays[inDays.length - 1];
              const shortRange = (a, b) => {
                if (a === b) return fmtShortDate(a);
                const A = fmtShortDate(a), B = fmtShortDate(b);
                return A.split(" ")[0] === B.split(" ")[0] ? `${A} – ${B.split(" ")[1]}` : `${A} – ${B}`;
              };
              return (
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">{fmtRange(cutoff?.periodStart, cutoff?.periodEnd).replace(/, \d{4}$/, "")} at a glance</h3>
                      <p className="text-xs text-neutral-500">
                        {totals.toReview} day{totals.toReview === 1 ? "" : "s"} to review · {totals.flagsOpen} flag{totals.flagsOpen === 1 ? "" : "s"} · big number = hours being paid
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowLegend((v) => !v)}>{showLegend ? "Hide legend" : "Legend"}</Button>
                  </div>

                  {showLegend && (
                    <div className="mb-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-3 space-y-2">
                      {gracePeriodMinutes != null && (
                        <p className="text-xs text-neutral-500">Grace period: <strong className="text-neutral-800 dark:text-neutral-200">{gracePeriodMinutes} min</strong> after the window opens</p>
                      )}
                      <LegendRow title="Clock-in">
                        <LegendItem kind="ok" chip="✓ On time" text="at or before the window opens" />
                        <LegendItem kind="grace" chip="Late 3m · grace" text={`within ${gracePeriodMinutes ?? 15} min · still paid from the window start`} />
                        <LegendItem kind="late" chip="Late 18m" text="beyond grace · paid on actual" />
                      </LegendRow>
                      <LegendRow title="Segment">
                        <LegendItem kind="outline" chip="Early Regular?" text="punch sits just before Regular starts" />
                        <LegendItem kind="missing" chip="No clock-out" text="punch missing · needs a fix" />
                        <LegendItem kind="past" chip="+119m PM" text="ran past the window · may add OT" />
                        <LegendItem kind="early" chip="Left 20m early" text="clocked out before the window ended" />
                        <LegendItem kind="neutral" chip="Lunch 26m" text="unpaid lunch · deducted from the segment it falls in" />
                      </LegendRow>
                      <LegendRow title="Day">
                        <LegendItem kind="review" chip="To review" text="segments waiting" />
                        <LegendItem kind="ok" chip="Approved" text="all decided" />
                        <LegendItem kind="today" chip="Today" text="nothing synced yet" />
                      </LegendRow>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <div className="grid grid-cols-8 gap-2 min-w-[760px]">
                      {WEEKDAYS.map((w) => <p key={w} className="text-xs font-semibold text-neutral-500">{w}</p>)}
                      <p className="ml-2 text-xs font-bold text-orange-700 dark:text-orange-300">Week</p>

                      {weeks.map((week, wi) => {
                        const inPeriod = week.filter((iso) => labelByIso[iso]);
                        const before   = week.filter((iso) => firstIso && iso < firstIso);
                        const after    = week.filter((iso) => lastIso && iso > lastIso);
                        const weekTotal   = inPeriod.reduce((s, iso) => s + (dayModels[iso]?.paying || 0), 0);
                        const weekClocked = inPeriod.reduce((s, iso) => s + (dayModels[iso]?.clocked || 0), 0);
                        const hasToday  = week.includes(todayIso) && labelByIso[todayIso];
                        const allAhead  = inPeriod.length > 0 && inPeriod.every((iso) => iso > todayIso);
                        const where = hasToday
                          ? "week in progress"
                          : before.length
                          ? `${shortRange(before[0], before[before.length - 1])} in previous cutoff`
                          : after.length
                          ? `${shortRange(inPeriod[0], inPeriod[inPeriod.length - 1])} only`
                          : "full week";
                        const note = weekClocked > 0 ? `paying · ${fmtH(weekClocked)} clocked · ${where}` : where;
                        return [
                          ...week.map((iso) => {
                            const label = labelByIso[iso];
                            const dayNum = fmtShortDate(iso);
                            if (!label) {
                              return (
                                <div key={iso} className="rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 p-2 min-h-[92px]">
                                  <p className="text-xs font-semibold text-neutral-400">{dayNum}</p>
                                  <p className="text-xs text-neutral-400 mt-1">{iso < firstIso ? "Previous cutoff" : "Next cutoff"}</p>
                                </div>
                              );
                            }
                            const d = days[iso];
                            const selected = selectedDay === iso;
                            const noData = d.status === "off";
                            const isToday = iso === todayIso;
                            const upcoming = noData && iso > todayIso;
                            const review = d.status === "pending" || d.status === "conflict";
                            const m = dayModels[iso];
                            const chips = m?.flags || [];
                            const tone = selected
                              ? "border-2 border-orange-400 bg-white dark:bg-neutral-900"
                              : noData && isToday
                              ? "border-2 border-neutral-900 bg-white dark:border-neutral-300 dark:bg-neutral-900"
                              : upcoming
                              ? "border border-dashed border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
                              : review
                              ? "border border-amber-300 bg-white dark:border-amber-800 dark:bg-neutral-900"
                              : `border ${DAY_STYLE[d.status]}`;
                            return (
                              <button
                                key={iso}
                                type="button"
                                onClick={() => setSelectedDay(iso)}
                                className={`text-left rounded-lg p-2 min-h-[92px] min-w-0 overflow-hidden transition-shadow hover:shadow-sm ${tone}`}
                              >
                                <div className="flex items-start justify-between gap-x-1 flex-wrap">
                                  <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 whitespace-nowrap">{dayNum}</p>
                                  {review && <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap">• To review</span>}
                                </div>
                                {!noData && m && (m.paying > 0 || m.clocked > 0) && (
                                  <>
                                    <p className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100 leading-tight mt-0.5">{fmtH(m.paying)}</p>
                                    {m.clocked > 0 && <p className="text-[11px] text-neutral-500 leading-tight">{fmtH(m.clocked)} clocked</p>}
                                  </>
                                )}
                                {noData ? (
                                  <p className="text-xs text-neutral-500 mt-0.5">
                                    {isToday ? "Today · nothing synced yet" : upcoming ? "Upcoming" : "No punches · day off"}
                                  </p>
                                ) : !review && d.status !== "approved" ? (
                                  <p className="text-xs text-neutral-500 mt-0.5">{DAY_NOTE[d.status]}</p>
                                ) : null}
                                {(chips.length > 0 || m?.lunchMin > 0) && (
                                  <div className="flex flex-col items-start gap-1 mt-1">
                                    {[
                                      ...chips.filter((c) => c.side !== "out"),
                                      ...(m?.lunchMin > 0 ? [{ kind: "neutral", label: `Lunch ${m.lunchMin}m` }] : []),
                                      ...chips.filter((c) => c.side === "out"),
                                    ].map((c, ci) => <Chip key={ci} kind={c.kind} small>{c.label}</Chip>)}
                                  </div>
                                )}
                                {d.training && <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mt-1">Training</p>}
                              </button>
                            );
                          }),
                          // Summary column, not a day: set apart with a gap and a soft orange fill
                          <div key={`total-${wi}`} className="ml-2 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30 p-2 min-h-[92px]">
                            <p className="text-lg font-extrabold text-orange-900 dark:text-orange-100 leading-tight">
                              {weekTotal > 0 ? fmtH(weekTotal) : allAhead && !hasToday ? "—" : "0h"}
                            </p>
                            <p className="text-xs text-orange-700/80 dark:text-orange-300/80 mt-0.5">{note}</p>
                          </div>,
                        ];
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Day panel */}
            {day && dayModel && (
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 flex-wrap p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">{fmtIsoDay(selectedDay)}</h3>
                      {dayModel.weekend && <Chip kind="neutral">Weekend shift</Chip>}
                      {dayModel.total > 0 && dayModel.pending.length > 0 && (
                        <Chip kind="grace">{dayModel.pending.length} of {dayModel.total} {dayModel.driver ? "segments" : "records"} to decide</Chip>
                      )}
                      {dayModel.total > 0 && dayModel.pending.length === 0 && (
                        <Chip kind="ok">✓ {dayModel.driver ? "Segments" : "All"} {day.leafs.some((l) => l.localStatus === "excluded") ? "reviewed" : "approved"}</Chip>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {dayModel.driver && dayModel.span ? (
                        <>
                          Driver day · {dayModel.driver.segments} segments · paid{" "}
                          <strong className="text-neutral-900 dark:text-neutral-100">{fmtTime(dayModel.span.inIso, tz)} → {fmtTime(dayModel.span.outIso, tz)}</strong>
                          {" "}· {fmtH(dayModel.paying)}
                          <span className="block text-[11px] text-neutral-400 mt-0.5">
                            clocked {fmtTime(dayModel.driver.a.rawIn, tz)} → {dayModel.driver.a.rawOut ? fmtTime(dayModel.driver.a.rawOut, tz) : "—"}
                            {dayModel.clocked > 0 && <> · {fmtH(dayModel.clocked)} on the clock</>}
                          </span>
                        </>
                      ) : dayModel.driver ? (
                        <>
                          Driver day · {dayModel.driver.segments} segments · clocked{" "}
                          <ClockInText state={dayModel.driver.a.inState} text={fmtTime(dayModel.driver.a.rawIn, tz)} />
                          {" → "}
                          <strong className="text-neutral-800 dark:text-neutral-200">{dayModel.driver.a.rawOut ? fmtTime(dayModel.driver.a.rawOut, tz) : "—"}</strong>
                          {dayModel.clocked > 0 && <> · {fmtH(dayModel.clocked)} on the clock</>}
                        </>
                      ) : dayModel.staff ? (
                        <>
                          Regular day · clocked{" "}
                          <ClockInText state={dayModel.staff.inState} text={dayModel.staff.actInText} />
                          {" → "}
                          <strong className={dayModel.staff.outState?.kind === "past" ? "text-red-600 dark:text-red-400" : "text-neutral-800 dark:text-neutral-200"}>{dayModel.staff.actOutText}</strong>
                          {dayModel.clocked > 0 && <> · {fmtH(dayModel.clocked)} on the clock</>}
                        </>
                      ) : (DAY_NOTE[day.status] || "")}
                    </p>
                  </div>
                  {dayModel.total > 0 && (
                    <div className="text-right">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Paying</p>
                      <p className="text-2xl font-extrabold leading-tight text-neutral-900 dark:text-neutral-100">{fmtH(dayModel.paying)}</p>
                      {dayModel.parts.length > 1 && <p className="text-xs text-neutral-500">{dayModel.parts.map(fmtH).join(" + ")}</p>}
                    </div>
                  )}
                </div>

                {/* Banners (things to decide) + quiet info lines (lunch — nothing to decide) */}
                {(dayModel.banners.length > 0 || dayModel.lunchLines.length > 0) && (
                  <div className="px-4 pb-3 space-y-2">
                    {dayModel.lunchLines.map((l) => (
                      <p key={`lunch-${l.key}`} className="text-xs text-neutral-500 flex items-center gap-2 flex-wrap">
                        <Chip kind="neutral">{l.chip}</Chip>
                        <span>{l.text} · {l.where}</span>
                      </p>
                    ))}
                    {dayModel.banners.map((b, bi) => {
                      const target = b.rowId ? dayModel.rows.find((x) => x.rec.id === b.rowId) : null;
                      const st = target?.rec.localStatus;
                      if (st) {
                        const how = st === "excluded" ? "excluded"
                          : `paid on ${paidMode(target) === "schedule" ? "Schedule" : "Actual"} · ${fmtH(target.rec.hours)}`;
                        return (
                          <p key={bi} className="text-xs text-neutral-500 flex items-center gap-2 flex-wrap">
                            <span className="text-green-700 dark:text-green-400">✓</span>
                            <span>{[b.chip, String(b.strong || "").replace(/[.,]$/, "")].filter((t, ti, arr) => t && arr.indexOf(t) === ti).join(" · ")}</span>
                            <span className="text-neutral-400">· resolved, {how}</span>
                          </p>
                        );
                      }
                      return (
                      <div key={bi} className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-2.5 flex-wrap ${BANNER[b.kind] || BANNER.neutral}`}>
                        {b.chip && <Chip kind={b.kind}>{b.chip}</Chip>}
                        <span className="flex-1 min-w-[200px]"><strong>{b.strong}</strong>{b.text}</span>
                        {b.action && isOpenPeriod && (() => {
                          const target = dayModel.rows.find((x) => x.rec.id === b.action.recId);
                          return target ? (
                            <Button size="sm" variant="outline" className="border-red-300 text-red-700 bg-white hover:bg-red-50 dark:bg-neutral-900 dark:border-red-800 dark:text-red-400"
                              disabled={PREVIEW} title={PREVIEW ? PREVIEW_TIP : ""}
                              onClick={PREVIEW ? undefined : () => openExclude(target, b.action.reason)}>
                              {b.action.label}
                            </Button>
                          ) : null;
                        })()}
                      </div>
                      );
                    })}
                  </div>
                )}

                {/* Rows */}
                <div className="overflow-x-auto border-t border-neutral-200 dark:border-neutral-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left bg-neutral-50 dark:bg-neutral-900/50">
                        {["Segment", "Window", "Actual punches", "Pay on", "Decision"].map((h) => (
                          <th key={h} className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500 ${h === "Decision" ? "text-right" : ""}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dayModel.rows.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">No punches on this day.</td></tr>
                      ) : dayModel.rows.map((row) => {
                        const rec = row.rec;

                        if (row.kind === "leave") {
                          return (
                            <tr key={row.key} className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 bg-blue-50/40 dark:bg-blue-950/10">
                              <td className="px-4 py-3 font-semibold">Leave</td>
                              <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300" colSpan={2}>
                                {stripHtml(rec.detail)}{rec.tags?.[0]?.label ? ` · ${rec.tags[0].label}` : ""}
                              </td>
                              <td className="px-4 py-3 text-sm"><strong>{fmtH(rec.payableHours ?? rec.hours)}</strong><span className="text-neutral-500"> · leave</span></td>
                              <td className="px-4 py-3 text-right text-xs text-neutral-500">Pre-approved</td>
                            </tr>
                          );
                        }
                        if (row.kind === "unsynced") {
                          return (
                            <tr key={row.key} className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0">
                              <td className="px-4 py-3 font-semibold">Punch</td>
                              <td className="px-4 py-3 text-neutral-500">—</td>
                              <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{rec.timeIn} → {rec.timeOut}</td>
                              <td className="px-4 py-3 text-xs text-amber-700 dark:text-amber-400" colSpan={2}>Not synced yet — use Sync</td>
                            </tr>
                          );
                        }
                        if (row.kind === "conflict") {
                          return (
                            <tr key={row.key} className={`border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 ${!rec.localStatus ? "bg-red-50/60 dark:bg-red-950/10" : ""}`}>
                              <td className="px-4 py-3 font-semibold">Punch vs leave</td>
                              <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300" colSpan={2}>{stripHtml(rec.detail)}</td>
                              <td className="px-4 py-3" colSpan={2}>
                                {rec.localStatus ? (
                                  <span className="text-xs text-neutral-500">Resolved</span>
                                ) : isOpenPeriod ? (
                                  <span className="inline-flex gap-2 justify-end w-full">
                                    <Button size="sm" variant="outline" disabled={PREVIEW} title={PREVIEW ? PREVIEW_TIP : ""} onClick={PREVIEW ? undefined : () => doConflict(rec.id, "punch")}>Honor punch</Button>
                                    <Button size="sm" variant="outline" disabled={PREVIEW} title={PREVIEW ? PREVIEW_TIP : ""} onClick={PREVIEW ? undefined : () => doConflict(rec.id, "leave")}>Honor leave</Button>
                                  </span>
                                ) : <span className="text-xs text-neutral-500">Pending</span>}
                              </td>
                            </tr>
                          );
                        }

                        // ── Segment / punch decision row ──
                        const st = rec.localStatus;
                        const excluded = st === "excluded";
                        const pendingRow = !st && !rec.isFixedHours;
                        const needsDecision = pendingRow && !row.matches;
                        const pick = dayModel.effPick(row);
                        const paidSchedule = st && !row.matches && row.hours.schedule != null
                          ? paidMode(row) === "schedule"
                          : null;
                        return (
                          <tr key={row.key} className={`border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 ${
                            excluded ? "bg-neutral-50 dark:bg-neutral-900/60" : needsDecision ? "bg-orange-50/50 dark:bg-orange-950/10" : ""
                          }`}>
                            {/* Segment */}
                            <td className="px-4 py-3 whitespace-nowrap align-top">
                              <p className={`font-semibold ${excluded ? EXCLUDED_TEXT : "text-neutral-900 dark:text-neutral-100"}`}>{row.label}</p>
                              <p className={`text-[11px] font-semibold ${
                                needsDecision ? "text-orange-700 dark:text-orange-400" : st === "approved" || st === "resolved" ? "text-green-700 dark:text-green-400" : "text-neutral-500"
                              }`}>
                                {rec.isFixedHours ? "Fixed hours" : excluded ? "Excluded" : st ? "Approved" : needsDecision ? "Needs a decision" : "Pending"}
                              </p>
                            </td>
                            {/* Window */}
                            <td className={`px-4 py-3 whitespace-nowrap align-top ${excluded ? EXCLUDED_TEXT : "text-neutral-700 dark:text-neutral-300"}`}>{row.windowText}</td>
                            {/* Actual punches */}
                            <td className="px-4 py-3 whitespace-nowrap align-top">
                              <p className={excluded ? EXCLUDED_TEXT : "text-neutral-700 dark:text-neutral-300"}>
                                {row.kind === "segment" && row.missed ? (
                                  <span className="text-neutral-400">nothing on the clock</span>
                                ) : row.kind === "segment" ? (
                                  <>
                                    {row.inState
                                      ? <ClockInText state={row.inState} text={fmtTime(row.actIn, tz)} muted={excluded} />
                                      : <strong className={excluded ? "" : "text-neutral-900 dark:text-neutral-100"}>{fmtTime(row.actIn, tz)}</strong>}
                                    {" – "}
                                    {row.outState?.kind === "noOut"
                                      ? <span className="text-red-600 dark:text-red-400 font-semibold">no clock-out</span>
                                      : row.outState?.kind === "past" && !excluded
                                      ? <strong className="text-red-600 dark:text-red-400">{fmtTime(row.actOut, tz)}</strong>
                                      : fmtTime(row.actOut, tz)}
                                  </>
                                ) : (
                                  <>
                                    <ClockInText state={row.inState} text={row.actInText} muted={excluded} fallbackBold />
                                    {" → "}
                                    {!excluded && (row.outState?.kind === "past" || row.outState?.kind === "noOut")
                                      ? <strong className="text-red-600 dark:text-red-400">{row.actOutText}</strong>
                                      : row.actOutText}
                                  </>
                                )}
                              </p>
                              {!excluded && (row.chips.length > 0 || row.lunchMin > 0) && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {row.chips.map((c, ci) => <Chip key={ci} kind={c.kind}>{c.label}</Chip>)}
                                  {row.lunchMin > 0 && <Chip kind="neutral">Lunch {row.lunchMin}m</Chip>}
                                </div>
                              )}
                            </td>
                            {/* Pay on */}
                            <td className="px-4 py-3 align-top">
                              {rec.isApproving ? (
                                <span className="text-xs text-neutral-500">Saving…</span>
                              ) : rec.isFixedHours ? (
                                <span className="text-xs text-neutral-500">Not counted · fixed hours</span>
                              ) : excluded ? (
                                <span className="text-sm text-neutral-400">—</span>
                              ) : row.matches || (st && paidSchedule == null) ? (
                                <span className="text-sm">
                                  <strong>{fmtH(st ? rec.hours : (row.hours.schedule ?? row.hours.actual))}</strong>
                                  <span className="text-neutral-500"> · {row.matches ? row.matchText : "approved"}</span>
                                </span>
                              ) : (
                                <div>
                                  <div className="inline-flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5 gap-0.5">
                                    {(st ? ["schedule", "actual"].filter((o) => row.hours[o] != null) : row.options).map((o) => (
                                      <PayOption
                                        key={o}
                                        label={o === "schedule" ? row.scheduleLabel : OPTION_LABEL[o]}
                                        hours={o === "schedule" && row.hours.schedule == null ? null : row.hours[o]}
                                        selected={st ? (o === "schedule") === paidSchedule : pick === o}
                                        disabled={!!st || !isOpenPeriod}
                                        onSelect={() => choose(rec.id, o)}
                                      />
                                    ))}
                                  </div>
                                  {!st && row.helper[pick] && <p className="text-[11px] text-neutral-500 mt-1">{row.helper[pick]}</p>}
                                </div>
                              )}
                            </td>
                            {/* Decision */}
                            <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                              {rec.isApproving || rec.isFixedHours ? null : st ? (
                                <span className="inline-flex items-center gap-3">
                                  <span className={`text-xs font-semibold ${excluded ? "text-neutral-500" : "text-green-700 dark:text-green-400"}`}>{excluded ? "Excluded" : "✓ Approved"}</span>
                                  {isOpenPeriod && <TextLink disabled={PREVIEW} title={PREVIEW ? PREVIEW_TIP : ""} onClick={() => doReset(rec.id)}>Reset</TextLink>}
                                </span>
                              ) : isOpenPeriod ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={PREVIEW ? undefined : () => approveOne(row)}
                                    disabled={PREVIEW || (!row.matches && pick === "hold")}
                                    title={PREVIEW ? PREVIEW_TIP : !row.matches && pick === "hold" ? "Fix the punch first, or choose Schedule" : ""}
                                    className="ml-1.5 px-2.5 py-1 rounded-md border border-green-300 bg-white text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-green-800 dark:bg-neutral-900 dark:text-green-400"
                                  >
                                    ✓ Approve
                                  </button>
                                  {rec.actions?.includes("exclude") && (
                                    <button
                                      type="button"
                                      onClick={PREVIEW ? undefined : () => openExclude(row, row.earlyRegular ? "early_regular" : null)}
                                      disabled={PREVIEW}
                                      title={PREVIEW ? PREVIEW_TIP : "Exclude"}
                                      aria-label="Exclude"
                                      className="w-7 h-7 rounded-md border border-neutral-300 bg-white text-xs text-neutral-600 hover:border-red-300 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-neutral-300 disabled:hover:text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </span>
                              ) : <span className="text-xs text-neutral-500">Pending</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                {isOpenPeriod && dayModel.pending.length > 0 && (
                  <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                    <p className="text-xs text-neutral-500">Pick how to pay each flagged segment, then approve. Undecided segments stay pending.</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={PREVIEW ? undefined : approveRemaining} disabled={PREVIEW || bulkBusy} title={PREVIEW ? PREVIEW_TIP : ""} className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5">
                        {bulkBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Approve remaining · pay {fmtH(remainingPay)}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(isBNC || emp.fixedHours) && (
              <p className="text-xs text-neutral-500">
                {emp.fixedHours
                  ? "Fixed-hours employees: the flat hours and their edit are on the List view for now."
                  : "B&C companies: the shift picker opens from Schedule…; the full B&C layout comes in the next phase."}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Exclude (Calendar page) ── */}
      <Dialog open={!!exTarget} onOpenChange={(open) => { if (!open && !exBusy) setExTarget(null); }}>
        <DialogContent className="w-[92vw] sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          {exTarget && (() => {
            const row = exTarget.row;
            // Only this segment/punch is excluded — the rest of the day may still be undecided,
            // so the dialog shows this record's pay, not a day total.
            const segPay = dayModel ? dayModel.payOf(row) : 0;
            const punches = row.kind === "segment"
              ? `${fmtTime(row.actIn, tz)} – ${row.actOut ? fmtTime(row.actOut, tz) : "no clock-out"}`
              : `${row.actInText} – ${row.actOutText}`;
            const choices = [
              ...EXCLUDE_CHOICES.filter((c) => c.id === exTarget.suggested),
              ...EXCLUDE_CHOICES.filter((c) => c.id !== exTarget.suggested && (c.id !== "early_regular" || row.earlyRegular)),
            ];
            return (
              <>
                <DialogHeader>
                  <div className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-lg border border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0 font-bold">✕</span>
                    <div className="min-w-0 text-left">
                      <DialogTitle className="text-base">Exclude {row.label}?</DialogTitle>
                      <DialogDescription className="mt-0.5">
                        {emp?.name} · {fmtIsoDay(selectedDay)} · this {row.kind === "segment" ? "segment" : "punch"} won't be paid. The reason goes to the audit log.
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-3 rounded-lg border border-neutral-200 dark:border-neutral-800 divide-x divide-neutral-200 dark:divide-neutral-800 text-sm">
                  <div className="px-3 py-2"><p className="text-xs text-neutral-500">Window</p><p className="font-semibold">{row.windowText}</p></div>
                  <div className="px-3 py-2"><p className="text-xs text-neutral-500">Punches</p><p className="font-semibold">{punches}</p></div>
                  <div className="px-3 py-2"><p className="text-xs text-neutral-500">This {row.kind === "segment" ? "segment" : "punch"}</p><p className="font-semibold">{fmtH(segPay)} → <span className="text-red-600 dark:text-red-400">0h</span></p></div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Reason <span className="text-red-600">*</span></p>
                  {choices.map((c) => {
                    const sel = exChoice === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setExChoice(c.id)}
                        className={`w-full text-left rounded-lg border px-3 py-2.5 flex items-start gap-2.5 transition-colors ${
                          sel ? "border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/20" : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800"
                        }`}
                      >
                        <span className={`mt-0.5 w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${sel ? "border-red-600" : "border-neutral-400"}`}>
                          {sel && <span className="w-1.5 h-1.5 rounded-full bg-red-600" />}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{c.label}</span>
                            {c.id === exTarget.suggested && <Chip kind="grace">Suggested</Chip>}
                          </span>
                          <span className="block text-xs text-neutral-500 mt-0.5">{c.desc(row)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-semibold">Note {exChoice === "other"
                    ? <span className="text-red-600">*</span>
                    : <span className="font-normal text-neutral-500">(optional)</span>}</p>
                  <Textarea value={exNote} onChange={(e) => setExNote(e.target.value)} placeholder="Anything the audit log should know" rows={3} />
                </div>

                <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3 space-y-3">
                  <p className="text-xs text-neutral-500">Logged with your name and time · can be undone</p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setExTarget(null)} disabled={exBusy}>Cancel</Button>
                    <Button onClick={submitExclude} disabled={!exChoice || exBusy || (exChoice === "other" && !exNote.trim())} className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
                      {exBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Exclude {row.label}
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <CutoffReviewDialogs r={r} skip={["exclude"]} />
    </div>
  );
}
