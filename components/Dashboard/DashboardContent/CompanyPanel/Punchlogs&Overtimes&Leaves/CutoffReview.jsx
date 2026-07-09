// components/Dashboard/DashboardContent/CompanyPanel/PunchlogsB&OvertimesB&Leaves/CutoffReview.jsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Car,
  ChevronRight,
  CircleDot,
  Lock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Timer,
  Check,
  X,
  Pencil,
  XCircle,
  Zap,
  GitMerge,
  CalendarCheck,
  ChevronDown,
  Search,
  Loader2,
  LayoutList,
  AlertCircle,
  CalendarX,
  Info,
  FileText,
  RefreshCw,
  RotateCcw,
  GraduationCap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { fromZonedTime } from "date-fns-tz";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  open:      { label: "Open",      icon: CircleDot,    color: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400" },
  locked:    { label: "Locked",    icon: Lock,         color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400" },
  processed: { label: "Processed", icon: CheckCircle2, color: "bg-blue-100  text-blue-700  border-blue-200  dark:bg-blue-900/30  dark:text-blue-400"  },
};

const ROW_TYPE_CONFIG = {
  punch:       { label: "Punch",    icon: Clock,         rowBg: "bg-white dark:bg-neutral-900",                     typeColor: "text-blue-600",    typeBg: "bg-blue-50  dark:bg-blue-900/20"   },
  leave:       { label: "Leave",    icon: CalendarCheck, rowBg: "bg-green-50 dark:bg-green-900/10",                 typeColor: "text-green-600",   typeBg: "bg-green-50 dark:bg-green-900/30"  },
  rest:        { label: "Rest",     icon: X,             rowBg: "bg-neutral-50 dark:bg-neutral-800/40",             typeColor: "text-neutral-400", typeBg: "bg-neutral-100 dark:bg-neutral-800" },
  unscheduled: { label: "Punch",    icon: AlertTriangle, rowBg: "bg-amber-50  dark:bg-amber-900/10",                typeColor: "text-amber-600",   typeBg: "bg-amber-50 dark:bg-amber-900/30"  },
  conflict:    { label: "Conflict", icon: GitMerge,      rowBg: "bg-red-50    dark:bg-red-900/10",                  typeColor: "text-red-600",     typeBg: "bg-red-50   dark:bg-red-900/30"    },
  approved:    { label: "Punch",    icon: CheckCircle2,  rowBg: "bg-green-50  dark:bg-green-900/10",                typeColor: "text-green-600",   typeBg: "bg-green-50 dark:bg-green-900/30"  },
  excluded:    { label: "Punch",    icon: XCircle,       rowBg: "bg-neutral-50 dark:bg-neutral-800/40 opacity-60", typeColor: "text-neutral-400", typeBg: "bg-neutral-100"                     },
  absent:      { label: "Absent",   icon: CalendarX,     rowBg: "bg-neutral-50/60 dark:bg-neutral-900/20",          typeColor: "text-neutral-300", typeBg: "bg-neutral-100 dark:bg-neutral-800" },
  unsynced:    { label: "Punch",    icon: Clock,         rowBg: "bg-amber-50/50 dark:bg-amber-900/5",               typeColor: "text-amber-500",   typeBg: "bg-amber-50 dark:bg-amber-900/20"  },
};

const EXCLUDE_REASONS = [
  "Unscheduled punch — non-working day",
  "Duplicate entry",
  "Suspected invalid punch",
  "Leave takes precedence",
  "Data / system error",
  "Other",
];

const TAG_TOOLTIPS = {
  snap: "Clock-in will snap to scheduled start — within the grace period.",
  late: "Clocked in after the grace period ended. Late minutes flagged for review.",
  flag: "This record has been flagged and needs attention.",
  ot:   "Approved overtime included. Extra hours added to total payable.",
  auto: "System auto clock-out triggered — no manual clock-out recorded.",
};

const SEGMENT_LABELS = { driver_am: "Driver AM", regular: "Regular", driver_pm: "Driver PM" };
const SEGMENT_ORDER  = { driver_am: 0, regular: 1, driver_pm: 2 };

const formatDate = (d) => {
  if (!d) return "—";
  const [year, month, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
};

/** Inline info tooltip — renders below the icon to avoid overflow clipping */
const InfoTooltip = ({ text, side = "bottom" }) => (
  <span className="relative group inline-flex items-center ml-0.5 cursor-help align-middle">
    <Info className="w-3 h-3 text-neutral-300 group-hover:text-neutral-500 transition-colors duration-100" />
    <span className={`
      pointer-events-none absolute z-[9999]
      ${side === "top"
        ? "bottom-full left-1/2 -translate-x-1/2 mb-2"
        : "top-full left-1/2 -translate-x-1/2 mt-2"}
      w-52 rounded-xl bg-neutral-900 text-white text-[11px] font-normal leading-relaxed
      px-3 py-2.5 shadow-2xl
      opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100
      transition-all duration-150 origin-top
      whitespace-normal break-words
    `}>
      {text}
      <span className={`
        absolute left-1/2 -translate-x-1/2
        ${side === "top"
          ? "top-full border-4 border-transparent border-t-neutral-900"
          : "bottom-full border-4 border-transparent border-b-neutral-900"}
      `} />
    </span>
  </span>
);

const formatDateTime = (d, tz = "UTC") =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }) : "—";

/** Converts a UTC ISO string to a "YYYY-MM-DDTHH:mm" value in the company timezone for datetime-local inputs. */
const toCompanyTzInput = (isoStr, tz) => {
  if (!isoStr || !tz) return isoStr?.slice(0, 16) ?? "";
  try {
    const d = new Date(isoStr);
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const p = Object.fromEntries(fmt.formatToParts(d).map(({ type, value }) => [type, value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
  } catch {
    return isoStr?.slice(0, 16) ?? "";
  }
};

/** Converts a "YYYY-MM-DDTHH:mm" input value (in the company timezone) back to a UTC ISO string. */
const fromCompanyTzInput = (localStr, tz) => {
  if (!localStr || !tz) return new Date(localStr).toISOString();
  try {
    return fromZonedTime(localStr, tz).toISOString();
  } catch {
    return new Date(localStr).toISOString();
  }
};

const fmtShiftTime = (d) => {
  if (!d) return null;
  // "HH:mm" time-only strings (from availableShifts) — parse locally, no timezone conversion needed
  if (/^\d{1,2}:\d{2}$/.test(d)) {
    const [h, m] = d.split(":").map(Number);
    return new Date(1970, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });
};

/** Returns [{isoDate, label}] for every day from periodStart to periodEnd (inclusive), labels in company timezone. */
const enumeratePeriodDays = (periodStart, periodEnd, tz = "UTC") => {
  if (!periodStart || !periodEnd) return [];
  const [sy, sm, sd] = periodStart.slice(0, 10).split("-").map(Number);
  const [ey, em, ed] = periodEnd.slice(0, 10).split("-").map(Number);
  const days = [];
  let cur = new Date(Date.UTC(sy, sm - 1, sd, 12));
  const endUtc = new Date(Date.UTC(ey, em - 1, ed, 12));
  while (cur <= endUtc) {
    const isoDate = cur.toISOString().slice(0, 10);
    const label   = cur.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz });
    days.push({ isoDate, label });
    cur = new Date(cur.getTime() + 86400000);
  }
  return days;
};

/**
 * Formats a bare "YYYY-MM-DD" date-only string (e.g. leaveDate) as a day label in the
 * company timezone. Anchors at noon UTC like enumeratePeriodDays — `new Date(dateStr +
 * "T00:00:00")` instead reinterprets the string as local midnight in the runtime's own
 * timezone, which can roll the label back a day once reformatted into a negative-UTC tz.
 */
const dateOnlyToLabel = (dateStr, tz = "UTC") => {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz });
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Sticky page header */
const PageHeader = ({ cutoff, status, onFinalize, finalizeReady, getDepartmentName, onSync, syncing, otBasis, dailyOtThresholdHours, cutoffOtThresholdHours, refreshingOT, cutoffId }) => {
  const StatusIcon = STATUS_CONFIG[status]?.icon || CircleDot;
  return (
    <div className="sticky top-0 z-30 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 shadow-sm">
      {/* Top row */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-neutral-500 hover:text-neutral-800"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <span className="text-neutral-300 dark:text-neutral-600 text-lg font-light">/</span>
          <nav className="flex items-center gap-1.5 text-sm">
            <span className="text-neutral-500">Cutoff Periods</span>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
            <span className="text-neutral-500">{getDepartmentName(cutoff?.departmentId)}</span>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              {formatDate(cutoff?.periodStart)} – {formatDate(cutoff?.periodEnd)}
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Badge className={`gap-1.5 border ${STATUS_CONFIG[status]?.color || ""}`}>
            <StatusIcon className="w-3 h-3" />
            {STATUS_CONFIG[status]?.label || status}
          </Badge>
          <span className="text-xs text-neutral-400">
            Payment: <strong className="text-neutral-700 dark:text-neutral-300">{formatDate(cutoff?.paymentDate)}</strong>
          </span>

          {/* ✅ Sync button — picks up new employees/punches added after cutoff was created */}
          {status === "open" && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSync}
              disabled={syncing}
              className="gap-2 border-neutral-200 text-neutral-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync Records"}
            </Button>
          )}

          <Button
            size="sm"
            disabled={!finalizeReady}
            onClick={onFinalize}
            className={`gap-2 transition-all ${
              finalizeReady
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> Finalize Cutoff
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-0 px-6 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
        {[
          { label: "Total Records", value: null, id: "total",     icon: LayoutList,   color: "text-neutral-800 dark:text-neutral-200" },
          { label: "Approved",      value: null, id: "approved",   icon: CheckCircle2, color: "text-green-600" },
          { label: "Unreviewed",    value: null, id: "unreviewed", icon: Clock,        color: "text-neutral-700 dark:text-neutral-300" },
          { label: "Flagged",       value: null, id: "flagged",    icon: AlertTriangle,color: "text-red-600" },
          { label: "Total Hours",   value: null, id: "hours",      icon: Timer,        color: "text-blue-600" },
        ].map((s, i) => (
          <div key={s.id} className={`flex items-center gap-2.5 pr-6 mr-6 ${i < 4 ? "border-r border-neutral-200 dark:border-neutral-700" : ""}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0`}
              style={{ background: "var(--stat-bg)" }}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{s.label}</div>
              <div className={`text-lg font-extrabold leading-none ${s.color}`} id={`stat-${s.id}`}>—</div>
            </div>
          </div>
        ))}
        {/* OT config indicator — shows threshold normally; pulses "Computing OT…" while refreshOTBlocks is in flight */}
        {(otBasis || refreshingOT) && (
          <div className="ml-auto flex items-center gap-2.5 border-l border-neutral-200 dark:border-neutral-700 pl-6 ml-6">
            {refreshingOT ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-500 flex-shrink-0" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">OT Basis</div>
                  <div className="text-sm font-bold text-purple-500 animate-pulse leading-none">Computing OT…</div>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">OT Basis</div>
                <div className="text-lg font-extrabold leading-none text-purple-600 dark:text-purple-400">
                  {otBasis === "cutoff"
                    ? `${cutoffOtThresholdHours ?? "—"}h / period`
                    : `${dailyOtThresholdHours ?? 8}h / day`
                  }
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div id="progress-wrap" className="h-0.5 bg-neutral-100 dark:bg-neutral-800">
        <div
          id="progress-fill"
          className="h-full bg-orange-500 transition-all duration-500"
          style={{ width: "0%" }}
        />
      </div>
    </div>
  );
};

/** Filter bar */
const FilterBar = ({ tabs, activeTab, onTab, search, onSearch, chips, onChip }) => (
  <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6">
    {/* Tabs */}
    <div className="flex items-center gap-1 border-b border-neutral-100 dark:border-neutral-800">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all
            ${activeTab === t.id
              ? "text-orange-500 border-orange-500 font-bold"
              : "text-neutral-500 border-transparent hover:text-neutral-800"
            }`}
        >
          {t.label}
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full
            ${activeTab === t.id ? "bg-orange-100 text-orange-500" : "bg-neutral-100 text-neutral-500"}`}>
            {t.count}
          </span>
        </button>
      ))}
    </div>
    {/* Chips */}
    <div className="flex items-center gap-2 py-2.5 flex-wrap">
      <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 max-w-[240px]">
        <Search className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search employees..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="bg-transparent text-sm outline-none text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400 w-full"
        />
      </div>
      {chips.map((c) => (
        <button
          key={c.id}
          onClick={() => onChip(c.id)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
            ${c.active
              ? "bg-orange-500 border-orange-500 text-white"
              : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-orange-400 hover:text-orange-500"
            }`}
        >
          <c.icon className="w-3 h-3" /> {c.label}
        </button>
      ))}
    </div>
  </div>
);

/** Tag pill with tooltip */
const TagPill = ({ cls, label, tooltip }) => {
  const styles = {
    snap:     "bg-emerald-50 text-emerald-700 border border-emerald-200",
    late:     "bg-red-50    text-red-600    border border-red-200",
    flag:     "bg-amber-50  text-amber-700  border border-amber-200",
    ot:       "bg-violet-50 text-violet-700 border border-violet-200",
    auto:     "bg-sky-50    text-sky-700    border border-sky-200",
    tooEarly: "bg-orange-50 text-orange-700 border border-orange-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
      ${styles[cls] || "bg-neutral-100 text-neutral-500 border border-neutral-200"}`}>
      {label}
      {tooltip && <InfoTooltip text={tooltip} />}
    </span>
  );
};

/** Action button */
const ActionBtn = ({ color, icon: Icon, label, onClick }) => {
  const variants = {
    green:   "text-emerald-600 border-emerald-200 hover:bg-emerald-500 hover:text-white hover:border-emerald-500",
    purple:  "text-violet-600  border-violet-200  hover:bg-violet-500  hover:text-white hover:border-violet-500",
    blue:    "text-blue-600    border-blue-200    hover:bg-blue-500    hover:text-white hover:border-blue-500",
    neutral: "text-neutral-600 border-neutral-200 hover:bg-neutral-100",
    red:     "text-red-500     border-red-200     hover:bg-red-500     hover:text-white hover:border-red-500",
    amber:   "text-amber-600   border-amber-200   hover:bg-amber-500   hover:text-white hover:border-amber-500",
  };
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-white transition-all duration-150 ${variants[color] || variants.neutral}`}>
      <Icon className="w-3 h-3" /> {label}
    </button>
  );
};

/** Single timeline row inside an employee card */
const TimelineRow = ({ rec, onApprove, onApproveOT, onApproveSchedule, onApproveRaw, onEdit, onExclude, onConflict, onReset, onSetPunchType }) => {
  if (rec.type === "absent") {
    return (
      <tr className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 bg-neutral-50/60 dark:bg-neutral-900/20">
        <td className="px-4 py-2.5 w-20 align-middle">
          <span className="font-mono text-[11px] font-medium text-neutral-300 dark:text-neutral-600">{rec.date}</span>
        </td>
        <td className="px-3 py-2.5 w-24 align-middle">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-neutral-100 dark:bg-neutral-800">
            <CalendarX className="w-3 h-3 text-neutral-300 dark:text-neutral-600" />
            <span className="text-neutral-300 dark:text-neutral-600">Absent</span>
          </div>
        </td>
        <td className="px-3 py-2.5 align-middle">
          <span className="text-[11px] text-neutral-300 dark:text-neutral-600 italic">No punch record</span>
        </td>
        <td className="px-3 py-2.5 w-24 text-right align-middle">
          <span className="text-neutral-300 text-sm">—</span>
        </td>
        <td className="px-3 py-2.5 w-72" />
      </tr>
    );
  }

  if (rec.type === "unsynced") {
    return (
      <tr className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 bg-amber-50/50 dark:bg-amber-900/5">
        <td className="px-4 py-3 w-20 align-top">
          <span className="font-mono text-[11px] font-medium text-neutral-400">{rec.date}</span>
        </td>
        <td className="px-3 py-3 w-24 align-top">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-900/20">
            <Clock className="w-3 h-3 text-amber-500" />
            <span className="text-amber-600">Punch</span>
          </div>
        </td>
        <td className="px-3 py-3 align-top">
          <div className="mb-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              <AlertCircle className="w-2.5 h-2.5" />
              Not in cutoff — run Sync to include
            </span>
          </div>
          <div className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300"
            dangerouslySetInnerHTML={{ __html: rec.detail }} />
        </td>
        <td className="px-3 py-3 w-24 text-right align-top">
          <span className="text-neutral-300 text-sm">—</span>
        </td>
        <td className="px-3 py-3 w-72 align-top">
          <div className="flex justify-end">
            <span className="text-[11px] text-amber-500 font-semibold">Sync needed</span>
          </div>
        </td>
      </tr>
    );
  }

  const cfg = ROW_TYPE_CONFIG[rec.localStatus || rec.type] || ROW_TYPE_CONFIG.punch;
  const TypeIcon = cfg.icon;
  const isLocked         = ["approved", "excluded", "resolved"].includes(rec.localStatus);
  const isRestOrPreApproved = rec.type === "rest" || rec.actions?.includes("pre-approved");

  return (
    <tr className={`border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 transition-colors ${cfg.rowBg}`}>

      {/* Date */}
      <td className="px-4 py-3 w-20 align-top">
        <span className="font-mono text-[11px] font-medium text-neutral-400">{rec.date}</span>
      </td>

      {/* Type badge */}
      <td className="px-3 py-3 w-24 align-top">
        <div className="flex flex-col gap-1">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${cfg.typeBg}`}>
            <TypeIcon className={`w-3 h-3 ${cfg.typeColor}`} />
            <span className={cfg.typeColor}>{cfg.label}</span>
          </div>
          {rec.punchType === "TRAINING" && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <GraduationCap className="w-2.5 h-2.5" />
              Training
            </div>
          )}
        </div>
      </td>

      {/* Detail column */}
      <td className="px-3 py-3 align-top">

        {/* Schedule strip */}
        {rec.scheduleInfo && (
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-neutral-500">
              {rec.scheduleInfo.scheduledHours}h scheduled
              <InfoTooltip text="Total hours in this shift. Payable hours are calculated from this baseline after applying snap rules and break deductions." />
            </span>
            {rec.scheduleInfo.shiftStart && rec.scheduleInfo.shiftEnd && (
              <span className="font-mono text-[10px] text-neutral-400">
                {fmtShiftTime(rec.scheduleInfo.shiftStart)} – {fmtShiftTime(rec.scheduleInfo.shiftEnd)}
              </span>
            )}
          </div>
        )}

        {/* No schedule warning + employee remark */}
        {!rec.scheduleInfo && rec.type !== "leave" && rec.type !== "rest" && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-2.5 h-2.5" />
              No schedule for this day
              <InfoTooltip text="No shift assigned. If approved, actual clocked hours will be used as payable hours." />
            </span>
          </div>
        )}

        {/* Employee reason — shown whenever a no_schedule remark exists,
            regardless of whether a schedule was matched (timezone mismatches
            can cause a wrong shift to be found even for unscheduled punches) */}
        {rec.noScheduleRemark && (
          <div className="mb-2 flex items-start gap-2 px-2.5 py-2 rounded-xl bg-neutral-50 border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 max-w-md">
            <FileText className="w-3.5 h-3.5 text-neutral-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-0.5">Employee Reason</p>
              <p className="text-[11px] text-neutral-700 dark:text-neutral-300 leading-relaxed break-words">
                {rec.noScheduleRemark.message}
              </p>
            </div>
          </div>
        )}

        {/* Pending leave warning */}
        {rec.pendingLeave && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
              <CalendarCheck className="w-2.5 h-2.5" />
              Pending {rec.pendingLeave.leaveType} leave
              <InfoTooltip text="A pending leave request exists for this day. Review and approve or reject the leave before finalizing this punch." />
            </span>
          </div>
        )}

        {/* Punch times */}
        {rec.isApproving ? (
          <div className="flex items-center gap-1.5 text-neutral-400 text-[12px] mb-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirming…
          </div>
        ) : (
          <div className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
            dangerouslySetInnerHTML={{ __html: rec.detail }} />
        )}

        {/* Tag pills */}
        {rec.tags?.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {rec.tags.map((t, i) => (
              <TagPill key={i} cls={t.cls} label={t.label} tooltip={t.tooltip ?? TAG_TOOLTIPS[t.cls]} />
            ))}
          </div>
        )}
      </td>

      {/* Hours */}
      <td className="px-3 py-3 w-24 text-right align-top">
        {rec.isApproving ? (
          <Skeleton className="h-5 w-12 ml-auto rounded" />
        ) : rec.hours > 0 ? (
          <div>
            <div className="inline-flex items-center gap-0.5 justify-end">
              <span className={`font-mono text-sm font-extrabold
                ${rec.type === "leave"    ? "text-emerald-600" :
                  rec.type === "conflict" ? "text-red-500"     :
                  rec.type === "rest"     ? "text-neutral-300" :
                  "text-neutral-800 dark:text-neutral-100"}`}>
                {parseFloat(rec.hours).toFixed(2).replace(/\.?0+$/, "")}h
              </span>
              <InfoTooltip text="Payable hours after snap rules and break deductions. This goes to payroll on approval." />
            </div>
            {rec.scheduledHours > 0 && (
              <div className="text-[10px] text-neutral-400 mt-0.5 tabular-nums">
                / {rec.scheduledHours}h sched.
              </div>
            )}
          </div>
        ) : (
          <span className="text-neutral-300 text-sm">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-3 w-72 align-top">
        {rec.isApproving ? (
          <div className="flex justify-end">
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
        ) : (
          <>
            {isLocked && (
              <div className="flex items-center justify-end gap-2">
                {rec.localStatus === "excluded"
                  ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-400 border border-neutral-200"><XCircle className="w-3 h-3" /> Excluded</span>
                  : <>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200"><Check className="w-3 h-3" /> Approved</span>
                      <ActionBtn color="neutral" icon={RotateCcw} label="Reset" onClick={(e) => { e.stopPropagation(); onReset(rec.id); }} />
                    </>
                }
              </div>
            )}
            {isRestOrPreApproved && !isLocked && (
              <div className="flex justify-end">
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Pre-approved
                </span>
              </div>
            )}
            {!isLocked && !isRestOrPreApproved && (
              <div className="flex items-center justify-end gap-1.5">
                {rec.actions?.includes("approve")          && <ActionBtn color="green"   icon={Check}         label="Approve"      onClick={() => onApprove(rec.id)} />}
                {rec.actions?.includes("approve-ot")       && <ActionBtn color="purple"  icon={Zap}           label="+ OT"         onClick={() => onApproveOT(rec.id)} />}
                {rec.actions?.includes("approve-schedule") && <ActionBtn color="green"   icon={Check}         label="Schedule"     onClick={() => onApproveSchedule(rec)} />}
                {rec.actions?.includes("approve-raw")      && <ActionBtn color="blue"    icon={Clock}         label="Raw"          onClick={() => onApproveRaw(rec.id)} />}
                {rec.actions?.includes("honor-punch")      && <ActionBtn color="blue"    icon={Clock}         label="Honor Punch"  onClick={() => onConflict(rec.id, "punch")} />}
                {rec.actions?.includes("honor-leave")      && <ActionBtn color="green"   icon={CalendarCheck} label="Honor Leave"  onClick={() => onConflict(rec.id, "leave")} />}
                {rec.actions?.includes("toggle-training")  && <ActionBtn
                  color={rec.punchType === "TRAINING" ? "neutral" : "amber"}
                  icon={GraduationCap}
                  label={rec.punchType === "TRAINING" ? "Regular" : "Training"}
                  onClick={(e) => { e.stopPropagation(); onSetPunchType(rec.id, rec.punchType === "TRAINING" ? "REGULAR" : "TRAINING"); }}
                />}
                {rec.actions?.includes("edit")             && <ActionBtn color="neutral" icon={Pencil}        label="Edit"         onClick={(e) => { e.stopPropagation(); onEdit(rec); }} />}
                {rec.actions?.includes("exclude")          && <ActionBtn color="red"     icon={X}             label="Exclude"      onClick={(e) => { e.stopPropagation(); onExclude(rec.id); }} />}
              </div>
            )}
          </>
        )}
      </td>
    </tr>
  );
};

/** Sub-row for a regular punch inside a multi-shift day group */
const PunchSubRow = ({ rec, onApprove, onApproveOT, onApproveSchedule, onApproveRaw, onEdit, onExclude, onConflict, onReset, onSetPunchType }) => {
  const cfg = ROW_TYPE_CONFIG[rec.localStatus || rec.type] || ROW_TYPE_CONFIG.punch;
  const TypeIcon = cfg.icon;
  const isLocked         = ["approved", "excluded", "resolved"].includes(rec.localStatus);
  const isRestOrPreApproved = rec.type === "rest" || rec.actions?.includes("pre-approved");

  return (
    <tr className={`border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 transition-colors ${cfg.rowBg}`}>
      <td className="px-4 py-3 w-20 align-top">
        <span className="font-mono text-[10px] text-neutral-300 pl-2">└</span>
      </td>
      <td className="px-3 py-3 w-24 align-top">
        <div className="flex flex-col gap-1">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${cfg.typeBg}`}>
            <TypeIcon className={`w-3 h-3 ${cfg.typeColor}`} />
            <span className={cfg.typeColor}>{cfg.label}</span>
          </div>
          {rec.punchType === "TRAINING" && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <GraduationCap className="w-2.5 h-2.5" />
              Training
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        {rec.scheduleInfo && (
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-neutral-500">
              {rec.scheduleInfo.scheduledHours}h scheduled
              <InfoTooltip text="Total hours in this shift. Payable hours are calculated from this baseline after applying snap rules and break deductions." />
            </span>
            {rec.scheduleInfo.shiftStart && rec.scheduleInfo.shiftEnd && (
              <span className="font-mono text-[10px] text-neutral-400">
                {fmtShiftTime(rec.scheduleInfo.shiftStart)} – {fmtShiftTime(rec.scheduleInfo.shiftEnd)}
              </span>
            )}
          </div>
        )}
        {!rec.scheduleInfo && rec.type !== "leave" && rec.type !== "rest" && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-2.5 h-2.5" />
              No schedule for this day
              <InfoTooltip text="No shift assigned. If approved, actual clocked hours will be used as payable hours." />
            </span>
          </div>
        )}
        {rec.noScheduleRemark && (
          <div className="mb-2 flex items-start gap-2 px-2.5 py-2 rounded-xl bg-neutral-50 border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 max-w-md">
            <FileText className="w-3.5 h-3.5 text-neutral-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-0.5">Employee Reason</p>
              <p className="text-[11px] text-neutral-700 dark:text-neutral-300 leading-relaxed break-words">
                {rec.noScheduleRemark.message}
              </p>
            </div>
          </div>
        )}
        {rec.pendingLeave && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
              <CalendarCheck className="w-2.5 h-2.5" />
              Pending {rec.pendingLeave.leaveType} leave
              <InfoTooltip text="A pending leave request exists for this day. Review and approve or reject the leave before finalizing this punch." />
            </span>
          </div>
        )}
        {rec.isApproving ? (
          <div className="flex items-center gap-1.5 text-neutral-400 text-[12px] mb-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirming…
          </div>
        ) : (
          <div className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
            dangerouslySetInnerHTML={{ __html: rec.detail }} />
        )}
        {rec.tags?.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {rec.tags.map((t, i) => (
              <TagPill key={i} cls={t.cls} label={t.label} tooltip={t.tooltip ?? TAG_TOOLTIPS[t.cls]} />
            ))}
          </div>
        )}
      </td>
      <td className="px-3 py-3 w-24 text-right align-top">
        {rec.isApproving ? (
          <Skeleton className="h-5 w-12 ml-auto rounded" />
        ) : rec.hours > 0 ? (
          <div>
            <div className="inline-flex items-center gap-0.5 justify-end">
              <span className={`font-mono text-sm font-extrabold
                ${rec.type === "leave"    ? "text-emerald-600" :
                  rec.type === "conflict" ? "text-red-500"     :
                  rec.type === "rest"     ? "text-neutral-300" :
                  "text-neutral-800 dark:text-neutral-100"}`}>
                {parseFloat(rec.hours).toFixed(2).replace(/\.?0+$/, "")}h
              </span>
              <InfoTooltip text="Payable hours after snap rules and break deductions. This goes to payroll on approval." />
            </div>
            {rec.scheduledHours > 0 && (
              <div className="text-[10px] text-neutral-400 mt-0.5 tabular-nums">
                / {rec.scheduledHours}h sched.
              </div>
            )}
          </div>
        ) : (
          <span className="text-neutral-300 text-sm">—</span>
        )}
      </td>
      <td className="px-3 py-3 w-72 align-top">
        {rec.isApproving ? (
          <div className="flex justify-end">
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
        ) : (
          <>
            {isLocked && (
              <div className="flex items-center justify-end gap-2">
                {rec.localStatus === "excluded"
                  ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-400 border border-neutral-200"><XCircle className="w-3 h-3" /> Excluded</span>
                  : <>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200"><Check className="w-3 h-3" /> Approved</span>
                      <ActionBtn color="neutral" icon={RotateCcw} label="Reset" onClick={(e) => { e.stopPropagation(); onReset(rec.id); }} />
                    </>
                }
              </div>
            )}
            {isRestOrPreApproved && !isLocked && (
              <div className="flex justify-end">
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Pre-approved
                </span>
              </div>
            )}
            {!isLocked && !isRestOrPreApproved && (
              <div className="flex items-center justify-end gap-1.5">
                {rec.actions?.includes("approve")          && <ActionBtn color="green"   icon={Check}         label="Approve"      onClick={() => onApprove(rec.id)} />}
                {rec.actions?.includes("approve-ot")       && <ActionBtn color="purple"  icon={Zap}           label="+ OT"         onClick={() => onApproveOT(rec.id)} />}
                {rec.actions?.includes("approve-schedule") && <ActionBtn color="green"   icon={Check}         label="Schedule"     onClick={() => onApproveSchedule(rec)} />}
                {rec.actions?.includes("approve-raw")      && <ActionBtn color="blue"    icon={Clock}         label="Raw"          onClick={() => onApproveRaw(rec.id)} />}
                {rec.actions?.includes("honor-punch")      && <ActionBtn color="blue"    icon={Clock}         label="Honor Punch"  onClick={() => onConflict(rec.id, "punch")} />}
                {rec.actions?.includes("honor-leave")      && <ActionBtn color="green"   icon={CalendarCheck} label="Honor Leave"  onClick={() => onConflict(rec.id, "leave")} />}
                {rec.actions?.includes("toggle-training")  && <ActionBtn
                  color={rec.punchType === "TRAINING" ? "neutral" : "amber"}
                  icon={GraduationCap}
                  label={rec.punchType === "TRAINING" ? "Regular" : "Training"}
                  onClick={(e) => { e.stopPropagation(); onSetPunchType(rec.id, rec.punchType === "TRAINING" ? "REGULAR" : "TRAINING"); }}
                />}
                {rec.actions?.includes("edit")             && <ActionBtn color="neutral" icon={Pencil}        label="Edit"         onClick={(e) => { e.stopPropagation(); onEdit(rec); }} />}
                {rec.actions?.includes("exclude")          && <ActionBtn color="red"     icon={X}             label="Exclude"      onClick={(e) => { e.stopPropagation(); onExclude(rec.id); }} />}
              </div>
            )}
          </>
        )}
      </td>
    </tr>
  );
};

/** Single segment row inside a driver day group */
const DriverSegmentRow = ({ seg, onApprove, onApproveOT, onApproveSchedule, onApproveRaw, onExclude, onReset }) => {
  const isLocked = ["approved", "excluded", "resolved"].includes(seg.localStatus);
  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 bg-white dark:bg-neutral-900">
      <td className="px-4 py-2.5 w-20 align-top">
        <span className="font-mono text-[10px] text-neutral-300 pl-2">└</span>
      </td>
      <td className="px-3 py-2.5 w-28 align-top">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-violet-50 dark:bg-violet-900/20 whitespace-nowrap">
          <Clock className="w-3 h-3 text-violet-600" />
          <span className="text-violet-600">{SEGMENT_LABELS[seg.segmentType] || seg.segmentType}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 align-top">
        {seg.segmentWindow && (
          <div className="mb-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200 font-mono">
              Segment window: {seg.segmentWindow}
            </span>
          </div>
        )}
        {seg.isApproving ? (
          <div className="flex items-center gap-1.5 text-neutral-400 text-[12px] mb-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirming…
          </div>
        ) : (
          <div className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
            dangerouslySetInnerHTML={{ __html: seg.detail }} />
        )}
        {seg.tags?.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {seg.tags.map((t, i) => (
              <TagPill key={i} cls={t.cls} label={t.label} tooltip={t.tooltip ?? TAG_TOOLTIPS[t.cls]} />
            ))}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 w-24 text-right align-top">
        {seg.isApproving ? (
          <Skeleton className="h-5 w-12 ml-auto rounded" />
        ) : seg.hours > 0 ? (
          <span className="font-mono text-sm font-extrabold text-neutral-800 dark:text-neutral-100">
            {parseFloat(seg.hours).toFixed(2).replace(/\.?0+$/, "")}h
          </span>
        ) : (
          <span className="text-neutral-300 text-sm">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 w-72 align-top">
        {seg.isApproving ? (
          <div className="flex justify-end">
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
        ) : isLocked ? (
          <div className="flex items-center justify-end gap-2">
            {seg.localStatus === "excluded"
              ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-400 border border-neutral-200"><XCircle className="w-3 h-3" /> Excluded</span>
              : <>
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200"><Check className="w-3 h-3" /> Approved</span>
                  <ActionBtn color="neutral" icon={RotateCcw} label="Reset" onClick={() => onReset(seg.id)} />
                </>
            }
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1.5">
            {seg.actions?.includes("approve")          && <ActionBtn color="green"  icon={Check} label="Approve"  onClick={() => onApprove(seg.id)} />}
            {seg.actions?.includes("approve-ot")       && <ActionBtn color="purple" icon={Zap}   label="+ OT"    onClick={() => onApproveOT(seg.id)} />}
            {seg.actions?.includes("approve-schedule") && <ActionBtn color="green"  icon={Check} label="Schedule" onClick={() => onApproveSchedule(seg)} />}
            {seg.actions?.includes("approve-raw")      && <ActionBtn color="blue"   icon={Clock} label="Raw"      onClick={() => onApproveRaw(seg.id)} />}
            {seg.actions?.includes("exclude")          && <ActionBtn color="red"    icon={X}     label="Exclude"  onClick={() => onExclude(seg.id)} />}
          </div>
        )}
      </td>
    </tr>
  );
};

/** Driver day group — header row + one DriverSegmentRow per segment */
const DriverGroupRow = ({ group, onApprove, onApproveOT, onApproveSchedule, onApproveRaw, onExclude, onReset, companyTimezone }) => {
  const rawIn  = group.segments[0]?.rawTimeIn;
  const rawOut = group.segments[0]?.rawTimeOut;
  return (
    <>
      <tr className="bg-violet-50/40 dark:bg-violet-900/10 border-b border-violet-100 dark:border-violet-900/20">
        <td className="px-4 py-2 w-20 align-middle">
          <span className="font-mono text-[11px] font-medium text-neutral-400">{group.date}</span>
        </td>
        <td colSpan={3} className="px-3 py-2 align-middle">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-violet-600">
              <Timer className="w-3 h-3" /> Driver Day — {group.segments.length} segments
            </span>
            {rawIn && (
              <span className="font-mono text-[10px] text-neutral-400">
                {formatDateTime(rawIn, companyTimezone)} → {rawOut ? formatDateTime(rawOut, companyTimezone) : "Not clocked out"}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-right align-middle">
          {group.isApproving ? (
            <Skeleton className="h-5 w-20 ml-auto rounded" />
          ) : (
            <span className="font-mono text-sm font-extrabold text-neutral-600 dark:text-neutral-300">
              {parseFloat(group.hours).toFixed(2).replace(/\.?0+$/, "")}h total
            </span>
          )}
        </td>
      </tr>
      {group.segments.map((seg) => (
        <DriverSegmentRow key={seg.id} seg={seg} onApprove={onApprove} onApproveOT={onApproveOT} onApproveSchedule={onApproveSchedule} onApproveRaw={onApproveRaw} onExclude={onExclude} onReset={onReset} />
      ))}
    </>
  );
};

/** Multi-shift day group for regular punches */
const PunchGroupRow = ({ group, onApprove, onApproveOT, onApproveSchedule, onApproveRaw, onEdit, onExclude, onConflict, onReset, onSetPunchType }) => (
  <>
    <tr className="bg-blue-50/40 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20">
      <td className="px-4 py-2 w-20 align-middle">
        <span className="font-mono text-[11px] font-medium text-neutral-400">{group.date}</span>
      </td>
      <td colSpan={3} className="px-3 py-2 align-middle">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-600">
          <Clock className="w-3 h-3" /> {group.punches.length} shift{group.punches.length !== 1 ? "s" : ""}
        </span>
      </td>
      <td className="px-3 py-2 text-right align-middle">
        <span className="font-mono text-sm font-extrabold text-neutral-600 dark:text-neutral-300">
          {parseFloat(group.hours).toFixed(2).replace(/\.?0+$/, "")}h total
        </span>
      </td>
    </tr>
    {group.punches.map((punch) => (
      <PunchSubRow
        key={punch.id}
        rec={punch}
        onApprove={onApprove}
        onApproveOT={onApproveOT}
        onApproveSchedule={onApproveSchedule}
        onApproveRaw={onApproveRaw}
        onEdit={onEdit}
        onExclude={onExclude}
        onConflict={onConflict}
        onReset={onReset}
        onSetPunchType={onSetPunchType}
      />
    ))}
  </>
);

/** OT block row — rendered after the last punch row for a given date (B&C), or as a period summary (DayCare) */
const OTBlockRow = ({ block, onOTBlock, localOTBlockStatus, threshold, isCutoffBasis }) => {
  const [expanded, setExpanded] = useState(false);
  const status    = localOTBlockStatus[block.id] || block.status;
  const isPending = status === "pending";
  const bd        = block.breakdown;
  const hasBreakdown = isCutoffBasis && bd?.days?.length > 0;

  return (
    <>
      <tr className="bg-purple-50/40 dark:bg-purple-900/5 border-t border-purple-100 dark:border-purple-800/30">
        <td className="px-3 py-2.5 w-24" />
        <td className="px-3 py-2.5">
          <span className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
            <Zap className="w-2.5 h-2.5" /> OT
          </span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {isCutoffBasis
                ? `Period OT · ${bd?.totalHours ?? block.otHours}h total / ${bd?.threshold ?? threshold}h threshold`
                : `Overtime · ${block.otHours}h over ${threshold}h daily threshold`
              }
            </span>
            {hasBreakdown && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
              >
                <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} />
                {expanded ? "Hide" : "Days"}
              </button>
            )}
            {status === "approved" && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400 px-1.5 py-0.5 rounded">
                <Check className="w-2.5 h-2.5" /> Approved
              </span>
            )}
            {status === "excluded" && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                <X className="w-2.5 h-2.5" /> Excluded
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5">
          <span className={`font-mono text-sm font-bold ${isPending ? "text-purple-600 dark:text-purple-400" : "text-neutral-400"}`}>
            {isCutoffBasis
              ? `+${parseFloat(bd?.otHours ?? block.otHours).toFixed(2).replace(/\.?0+$/, "")}h`
              : `${block.otHours}h`}
          </span>
        </td>
        <td className="px-3 py-2.5 w-72 text-right">
          {isPending && (
            <div className="flex items-center justify-end gap-1.5">
              <ActionBtn color="purple" icon={Zap}  label="Approve OT" onClick={() => onOTBlock(block.id, "approve")} />
              <ActionBtn color="red"    icon={X}    label="Exclude"    onClick={() => onOTBlock(block.id, "exclude")} />
            </div>
          )}
        </td>
      </tr>
      {expanded && hasBreakdown && (
        <tr className="bg-purple-50/40 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-800/30">
          <td colSpan={5} className="px-3 pb-3 pt-1">
            <div className="flex justify-end">
              <div className="w-80 rounded-lg border border-purple-200 dark:border-purple-800/50 overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    {bd.days.map((d) => (
                      <tr key={d.date} className="border-b border-purple-100/60 dark:border-purple-900/20 last:border-0">
                        <td className="px-3 py-1 text-neutral-500 dark:text-neutral-400">
                          <span>{formatDate(d.date)}</span>
                          {d.isTraining && (
                            <span className="ml-2 text-[10px] text-amber-600 dark:text-amber-400 font-medium">Training</span>
                          )}
                        </td>
                        <td className="px-3 py-1 text-right font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                          {parseFloat(d.hours).toFixed(2).replace(/\.?0+$/, "")}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-purple-200 dark:border-purple-700 bg-purple-50/80 dark:bg-purple-900/20">
                      <td className="px-3 py-1.5 font-bold text-neutral-700 dark:text-neutral-200">Total</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-neutral-800 dark:text-neutral-100">
                        {parseFloat(bd.totalHours).toFixed(2).replace(/\.?0+$/, "")}h
                      </td>
                    </tr>
                    <tr className="bg-purple-100/50 dark:bg-purple-900/30">
                      <td colSpan={2} className="px-3 py-1.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                        {parseFloat(bd.totalHours).toFixed(2).replace(/\.?0+$/, "")}h − {bd.threshold}h threshold = +{parseFloat(bd.otHours).toFixed(2).replace(/\.?0+$/, "")}h OT
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

/** Employee card */
const EmployeeCard = ({ emp, onApprove, onApproveOT, onApproveSchedule, onApproveRaw, onEdit, onExclude, onConflict, onBulkApprove, onOTBlock, localOTBlockStatus, companyTimezone, dailyOtThresholdHours, cutoffOtThresholdHours, otBasis, onReset, onSetPunchType, trainingDates, onTrainingDay, refreshingOT }) => {
  const [expanded, setExpanded] = useState(false);
  const isCutoffBasis = otBasis === "cutoff";

  // B&C: build a map of formatted-date → OT block so we can inject OT rows after the last
  // punch row for each date without a second pass.
  // DayCare: one block per employee rendered as a period summary after all rows — skip the map.
  const otBlockByDate = useMemo(() => {
    if (isCutoffBasis) return {};
    const map = {};
    (emp.otBlocks || []).forEach((block) => {
      const [y, m, d] = block.date.slice(0, 10).split("-").map(Number);
      const safeDate  = new Date(Date.UTC(y, m - 1, d, 12));
      const formatted = safeDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: companyTimezone || "UTC" });
      map[formatted] = block;
    });
    return map;
  }, [emp.otBlocks, companyTimezone, isCutoffBasis]);

  // DayCare only: single period-level OT block rendered at the bottom of the card
  const periodOTBlock = isCutoffBasis ? (emp.otBlocks?.[0] ?? null) : null;

  const hasConflict  = emp.records.some((r) => {
    if (r.type === "punch_group") return r.punches.some((p) => p.type === "conflict" && !p.localStatus);
    return r.type === "conflict" && !r.localStatus;
  });
  const hasFlag      = emp.records.some((r) => {
    if (r.type === "driver_group") return r.segments.some((s) => s.tags?.length && !s.localStatus);
    if (r.type === "punch_group")  return r.punches.some((p) => (p.type === "unscheduled" || p.tags?.length) && !p.localStatus);
    return (r.type === "unscheduled" || r.tags?.length) && !r.localStatus;
  });
  const allDone      = emp.pending === 0;
  const punchCount   = emp.records.reduce((n, r) => {
    if (r.type === "driver_group") return n + r.segments.length;
    if (r.type === "punch_group")  return n + r.punches.length;
    return ["rest", "leave", "absent"].includes(r.type) ? n : n + 1;
  }, 0);
  const leaveCount   = emp.records.filter((r) => r.type === "leave").length;

  const cardBorder = hasConflict
    ? "border-red-200 dark:border-red-800"
    : hasFlag
    ? "border-amber-200 dark:border-amber-800"
    : allDone
    ? "border-green-200 dark:border-green-800"
    : "border-neutral-200 dark:border-neutral-800";

  return (
    <div className={`bg-white dark:bg-neutral-900 rounded-xl border ${cardBorder} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold text-white flex-shrink-0"
          style={{ background: emp.color }}
        >
          {emp.initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-neutral-800 dark:text-neutral-200 truncate">{emp.name}</span>
            {emp.isDriver && <Car className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
          </div>
          <div className="text-xs text-neutral-400 truncate">{emp.email}</div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {hasConflict  && <Badge className="bg-red-100    text-red-600    border-red-200    text-[10px] gap-1"><GitMerge className="w-2.5 h-2.5" /> Conflict</Badge>}
          {hasFlag && !hasConflict && <Badge className="bg-amber-100  text-amber-600  border-amber-200  text-[10px] gap-1"><AlertTriangle className="w-2.5 h-2.5" /> Flagged</Badge>}
          {emp.unsyncedCount > 0 && <Badge className="bg-amber-100 text-amber-600 border-amber-200 text-[10px] gap-1"><AlertCircle className="w-2.5 h-2.5" /> {emp.unsyncedCount} unsynced</Badge>}
          {emp.hasOT    && <Badge className="bg-purple-100 text-purple-600 border-purple-200 text-[10px] gap-1"><Zap className="w-2.5 h-2.5" /> OT</Badge>}
          {allDone      && <Badge className="bg-green-100  text-green-600  border-green-200  text-[10px] gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> Done</Badge>}
          {/* Shown while the server is computing OT blocks after an approval — only for cutoff-basis companies where an OT block may still be incoming */}
          {refreshingOT && isCutoffBasis && allDone && !periodOTBlock && (
            <Badge className="bg-purple-50 text-purple-500 border-purple-200 text-[10px] gap-1 animate-pulse">
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Computing OT…
            </Badge>
          )}
        </div>

        {/* Pills */}
        <div className="flex items-center gap-2 ml-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            <Check className="w-2.5 h-2.5" /> {emp.approved}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
            <Clock className="w-2.5 h-2.5" /> {emp.pending}
          </span>
        </div>

        {/* Total */}
        <div className="text-right ml-2 min-w-[52px]">
          <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wide">Payable</div>
          <div className={`text-base font-extrabold font-mono ${emp.pending > 0 ? "text-orange-500" : "text-neutral-800 dark:text-neutral-200"}`}>
            {parseFloat(emp.totalHours).toFixed(2).replace(/\.?0+$/, "")}h
          </div>
        </div>

        {/* Expand icon */}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-6 h-6 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0"
        >
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
        </motion.div>
      </div>

      {/* Body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-neutral-100 dark:border-neutral-800"
          >
            {/* Conflict banner */}
            {hasConflict && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-xs text-red-600 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Conflict detected — a punch and an approved leave exist on the same day. Resolve before approving.</span>
              </div>
            )}

            {/* Timeline table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-800">
                    {["Date", "Type", "Details", "Hours", ""].map((h) => (
                      <th key={h} className={`px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-400 ${h === "" ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {emp.records.map((rec, idx) => {
                    const recDate  = rec.date || rec.punches?.[0]?.date || rec.segments?.[0]?.date;
                    const prevDate = idx > 0
                      ? (emp.records[idx - 1].date || emp.records[idx - 1].punches?.[0]?.date || emp.records[idx - 1].segments?.[0]?.date)
                      : null;
                    const nextDate = idx < emp.records.length - 1
                      ? (emp.records[idx + 1].date || emp.records[idx + 1].punches?.[0]?.date || emp.records[idx + 1].segments?.[0]?.date)
                      : null;
                    const isFirstForDate = recDate && recDate !== prevDate;
                    const isLastForDate  = recDate && recDate !== nextDate;
                    const otBlock = isLastForDate ? otBlockByDate[recDate] : null;
                    // Training Day sub-header — non-driver employees only; skip absent and driver_group rows
                    const showTrainingHeader =
                      !emp.isDriver &&
                      isFirstForDate &&
                      rec.type !== "absent" &&
                      rec.type !== "driver_group" &&
                      recDate && recDate !== "—";
                    return (
                      <React.Fragment key={rec.id}>
                        {showTrainingHeader && (
                          <tr className="bg-neutral-50/80 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800">
                            <td colSpan={5} className="px-4 py-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[10px] font-bold text-neutral-400 uppercase tracking-wide">{recDate}</span>
                                <div className="flex items-center gap-2">
                                  {trainingDates.has(recDate) && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                      <GraduationCap className="w-2.5 h-2.5" /> Training Day
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        {rec.type === "driver_group" ? (
                          <DriverGroupRow
                            group={rec}
                            onApprove={onApprove}
                            onApproveOT={onApproveOT}
                            onApproveSchedule={onApproveSchedule}
                            onApproveRaw={onApproveRaw}
                            onExclude={onExclude}
                            onReset={onReset}
                            companyTimezone={companyTimezone}
                          />
                        ) : rec.type === "punch_group" ? (
                          <PunchGroupRow
                            group={rec}
                            onApprove={onApprove}
                            onApproveOT={onApproveOT}
                            onApproveSchedule={onApproveSchedule}
                            onApproveRaw={onApproveRaw}
                            onEdit={onEdit}
                            onExclude={onExclude}
                            onConflict={onConflict}
                            onReset={onReset}
                            onSetPunchType={onSetPunchType}
                          />
                        ) : (
                          <TimelineRow
                            rec={rec}
                            onApprove={onApprove}
                            onApproveOT={onApproveOT}
                            onApproveSchedule={onApproveSchedule}
                            onApproveRaw={onApproveRaw}
                            onEdit={onEdit}
                            onExclude={onExclude}
                            onConflict={onConflict}
                            onReset={onReset}
                            onSetPunchType={onSetPunchType}
                          />
                        )}
                        {otBlock && (
                          <OTBlockRow
                            block={otBlock}
                            onOTBlock={onOTBlock}
                            localOTBlockStatus={localOTBlockStatus}
                            threshold={dailyOtThresholdHours}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                  {periodOTBlock && (
                    <OTBlockRow
                      block={periodOTBlock}
                      onOTBlock={onOTBlock}
                      localOTBlockStatus={localOTBlockStatus}
                      threshold={cutoffOtThresholdHours ?? dailyOtThresholdHours}
                      isCutoffBasis
                    />
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800">
              <span className="text-xs text-neutral-500">
                {punchCount} punch {punchCount !== 1 ? "records" : "record"} · {leaveCount} leave {leaveCount !== 1 ? "records" : "record"}
              </span>
              <div className="flex items-center gap-3">
                {emp.hasBulk && emp.pending > 0 && (
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 gap-1.5 text-xs h-7" onClick={() => onBulkApprove(emp.id)}>
                    <CheckCircle2 className="w-3 h-3" /> Approve All Clean
                  </Button>
                )}
                <div className="text-right">
                  <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wide">Total Payable</div>
                  <div className="text-lg font-extrabold font-mono text-neutral-800 dark:text-neutral-200">{parseFloat(emp.totalHours).toFixed(2).replace(/\.?0+$/, "")}h</div>
                  <div className="text-[10px] text-neutral-400">{parseFloat(emp.punchHours).toFixed(2).replace(/\.?0+$/, "")}h punch · {parseFloat(emp.leaveHours).toFixed(2).replace(/\.?0+$/, "")}h leave</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CutoffReview({ cutoffId }) {
  const { token } = useAuthStore();
  const router = useRouter();

  // ── Server data ──
  const [cutoff,           setCutoff]           = useState(null);
  const [departments,      setDepartments]      = useState([]);
  const [employees,        setEmployees]        = useState([]); // processed employee objects
  const [isLoading,        setIsLoading]        = useState(true);
  const [syncing,          setSyncing]          = useState(false);
  const [companyTimezone,       setCompanyTimezone]       = useState("UTC");
  const [isBNC,                  setIsBNC]                  = useState(false);
  const [otBasis,                setOtBasis]                = useState(null);
  const [otBlocks,               setOTBlocks]               = useState([]);
  const [dailyOtThresholdHours,  setDailyOtThresholdHours]  = useState(8);
  const [cutoffOtThresholdHours, setCutoffOtThresholdHours] = useState(null);

  // ── Local action state (optimistic UI) ──
  const [localStatus,         setLocalStatus]         = useState({}); // { [recId]: 'approved'|'excluded'|'resolved' }
  const [localApprovedTimes,  setLocalApprovedTimes]  = useState({}); // { [recId]: { timeIn, timeOut } } — snapped/edited times from PATCH response
  const [approvingIds,        setApprovingIds]        = useState(new Set()); // recIds with PATCH in flight — shows spinner in detail cell only
  const [localOTBlockStatus,  setLocalOTBlockStatus]  = useState({}); // { [blockId]: 'approved'|'excluded' }
  const [resetIds,            setResetIds]            = useState(new Set()); // recIds reset this session — overrides buildDetails "approved"
  const [localPunchType,      setLocalPunchType]      = useState({}); // { [recId]: 'TRAINING'|'REGULAR' } — optimistic punchType overrides
  const [refreshingOT,        setRefreshingOT]        = useState(false); // true while refreshOTBlocks fetch is in flight

  // ── Modals ──
  const [editModal,       setEditModal]       = useState(null); // { rec }
  const [editedClockIn,   setEditedClockIn]   = useState("");
  const [editedClockOut,  setEditedClockOut]  = useState("");
  const [editNotes,       setEditNotes]       = useState("");
  const [excludeModal,    setExcludeModal]    = useState(null); // { recId }
  const [finalizeModal,   setFinalizeModal]   = useState(false);
  const [shiftPickerModal,setShiftPickerModal]= useState(null); // { recId, shifts, usedShiftIds }
  const [usedShifts,      setUsedShifts]      = useState({});   // { [recId]: shiftId } — tracks which shift was used per approval
  const [isSaving,        setIsSaving]        = useState(false);
  const [excludeReason,   setExcludeReason]   = useState("");
  const [excludeNote,     setExcludeNote]     = useState("");

  // ── Filters ──
  const [activeTab,    setActiveTab]    = useState("all");
  const [search,       setSearch]       = useState("");
  const [chips, setChips] = useState([
    { id: "late",       label: "Late Arrivals",  icon: Clock,          active: false },
    { id: "unscheduled",label: "No Schedule",    icon: CalendarX,      active: false },
    { id: "ot",         label: "Has OT",         icon: Zap,            active: false },
    { id: "conflict",   label: "Conflicts",      icon: GitMerge,       active: false },
    { id: "leave",      label: "Has Leave",      icon: CalendarCheck,  active: false },
    { id: "training",   label: "Training",       icon: GraduationCap,  active: false },
  ]);

  // ─────────────────────────────────────────────────────────────────────
  // FETCH
  // ─────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!token || !cutoffId) return;
    try {
      setIsLoading(true);
      const [cutoffRes, deptRes, approvalsRes, settingsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}`,         { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/departments`,                         { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/approvals`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/company-settings/`,                   { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [cutoffData, deptData, approvalsData, settingsData] = await Promise.all([
        cutoffRes.ok    ? cutoffRes.json()    : { data: null },
        deptRes.ok      ? deptRes.json()      : { data: [] },
        approvalsRes.ok ? approvalsRes.json() : { data: [] },
        settingsRes.ok  ? settingsRes.json()  : { data: {} },
      ]);

      setCutoff(cutoffData.data);
      setDepartments(deptData.data || []);
      // Resolve timezone and isBNC as local constants — both are used synchronously
      // inside buildDetails during this same fetch cycle. Reading state here would give
      // stale values since setCompanyTimezone / setIsBNC are async.
      const tz =
        approvalsData.companyTimezone ||
        settingsData.data?.timezone ||
        settingsData.data?.companyTimezone ||
        "UTC";
      // isBNC: prefer company-settings (authoritative); fall back to approvals envelope
      const isBNCLocal = settingsData.data?.isBNC === true || approvalsData.isBNC === true;
      setCompanyTimezone(tz);
      setIsBNC(isBNCLocal);
      setOtBasis(approvalsData.otBasis || null);
      setOTBlocks(approvalsData.otBlocks || []);
      setDailyOtThresholdHours(approvalsData.dailyOtThresholdHours ?? 8);
      setCutoffOtThresholdHours(approvalsData.cutoffOtThresholdHours ?? null);

      // Fetch raw punch logs for the full period — surfaces records not yet synced into cutoff approvals
      const ps     = cutoffData.data?.periodStart;
      const pe     = cutoffData.data?.periodEnd;
      const deptId = cutoffData.data?.departmentId;
      let rawLogsData = { data: [] };
      if (ps && pe) {
        const rlParams = new URLSearchParams({ from: ps, to: pe, limit: "10000" });
        if (deptId) rlParams.set("departmentId", deptId);
        const rlRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/timelogs?${rlParams}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (rlRes.ok) rawLogsData = await rlRes.json();
      }

      // Transform approvals into employee-grouped records
      const empMap = {};
      const COLORS = ["#f97316","#8b5cf6","#2563eb","#ec4899","#0891b2","#16a34a","#7c3aed","#0d9488","#db2777","#b45309","#be185d","#0369a1","#ca8a04"];
      let colorIdx = 0;

      // Process punch approval records
      (approvalsData.data || []).forEach((approval) => {
        const user   = approval.timeLog?.user;
        const userId = user?.id;
        if (!userId) return;

        if (!empMap[userId]) {
          const initials = ((user.profile?.firstName?.[0] || "") + (user.profile?.lastName?.[0] || "") || user.username?.[0] || "?").toUpperCase();
          empMap[userId] = {
            id:        userId,
            name:      `${user.profile?.firstName || ""} ${user.profile?.lastName || user.username || ""}`.trim(),
            email:     user.email,
            initials,
            color:     COLORS[colorIdx++ % COLORS.length],
            records:   [],
            hasOT:     false,
            hasBulk:   false,
            isDriver:  false,
          };
        }

        const emp     = empMap[userId];
        const details = buildDetails(approval, tz, isBNCLocal);
        emp.records.push(details);
        if (details.hasOT) emp.hasOT = true;
        if (details.segmentType !== null) emp.isDriver = true;
        if (
          details.actions?.some((a) => ["approve", "approve-schedule", "approve-raw"].includes(a)) &&
          !["conflict", "unscheduled"].includes(details.type)
        ) {
          emp.hasBulk = true;
        }
      });

      // ✅ Process standalone leave rows (approved leaves with no punch on same day)
      (approvalsData.leaves || []).forEach((leaveRow) => {
        const user   = leaveRow.user;
        const userId = user?.id;
        if (!userId) return;

        if (!empMap[userId]) {
          const initials = ((user.profile?.firstName?.[0] || "") + (user.profile?.lastName?.[0] || "") || user.username?.[0] || "?").toUpperCase();
          empMap[userId] = {
            id:        userId,
            name:      `${user.profile?.firstName || ""} ${user.profile?.lastName || user.username || ""}`.trim(),
            email:     user.email,
            initials,
            color:     COLORS[colorIdx++ % COLORS.length],
            records:   [],
            hasOT:     false,
            hasBulk:   false,
          };
        }

        empMap[userId].records.push({
          id:           leaveRow.id,
          timeLogId:    null,
          segmentType:  null,
          date:         dateOnlyToLabel(leaveRow.leaveDate, tz),
          type:         "leave",
          detail:       `${leaveRow.leave.leaveType} — <strong>Approved</strong>`,
          tags:         [],
          actions:      ["pre-approved"],
          hours:        leaveRow.hours ?? 8,
          scheduledHours: 0,
          scheduleInfo: null,
          hasOT:        false,
          timeIn:       "—",
          timeOut:      "—",
          localStatus:  null,
          pendingLeave: null,
        });
      });

      // Identify timelog IDs already represented by an approval record
      const syncedTimeLogIds = new Set(
        (approvalsData.data || []).map((a) => a.timeLog?.id).filter(Boolean)
      );

      // Add unsynced punch records — exist in raw punch logs but not yet in this cutoff
      (rawLogsData.data || []).forEach((rawLog) => {
        if (syncedTimeLogIds.has(rawLog.id)) return;
        const userId = rawLog.userId;
        if (!userId) return;

        if (!empMap[userId]) {
          const nameStr  = rawLog.employeeName || rawLog.email || "Unknown";
          const parts    = nameStr.trim().split(/\s+/);
          const initials = ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase() || "?";
          empMap[userId] = {
            id:       userId,
            name:     nameStr,
            email:    rawLog.email || "",
            initials,
            color:    COLORS[colorIdx++ % COLORS.length],
            records:  [],
            hasOT:    false,
            hasBulk:  false,
          };
        }

        empMap[userId].records.push(buildUnsyncedRecord(rawLog, tz));
      });

      setEmployees(Object.values(empMap).map((emp) => ({
        ...emp,
        records: groupRecordsByDate(emp.records, ps, pe, tz),
      })));
    } catch (err) {
      console.error("CutoffReview fetchData:", err);
      toast.error("Failed to load review data");
    } finally {
      setIsLoading(false);
    }
  }, [token, cutoffId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Re-fetch only the approvals envelope to get updated otBlocks after a punch approval.
  // Does not trigger the full loading skeleton — OT block rows update silently.
  const refreshOTBlocks = useCallback(async () => {
    if (!token || !cutoffId) return;
    setRefreshingOT(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/approvals`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      setOTBlocks(data.otBlocks || []);
      setDailyOtThresholdHours(data.dailyOtThresholdHours ?? 8);
      setCutoffOtThresholdHours(data.cutoffOtThresholdHours ?? null);
    } catch {
      // silent — blocks will refresh on next full reload
    } finally {
      setRefreshingOT(false);
    }
  }, [token, cutoffId]);

  // Re-fetch GET /approvals and rebuild employees so the skeleton resolves to enriched
  // hours from enrichApprovals (approvedClockOut − approvedClockIn) rather than stale
  // values from the initial load. The PATCH response returns a raw approval record —
  // enriched hours only exist after enrichApprovals runs on GET.
  // Keeps approvingIds[recId] active until the GET completes so both the hours skeleton
  // and the actions skeleton hold until the correct data lands.
  const refreshApprovals = useCallback(async (recId) => {
    if (!token || !cutoffId) return;
    try {
      const ps     = cutoff?.periodStart;
      const pe     = cutoff?.periodEnd;
      const deptId = cutoff?.departmentId;

      const rlParams = new URLSearchParams({ from: ps || "", to: pe || "", limit: "10000" });
      if (deptId) rlParams.set("departmentId", deptId);

      const [approvalsRes, rawLogsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/approvals`,
          { headers: { Authorization: `Bearer ${token}` } }),
        ps && pe
          ? fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/timelogs?${rlParams}`,
              { headers: { Authorization: `Bearer ${token}` } })
          : Promise.resolve({ ok: false }),
      ]);

      if (!approvalsRes.ok) return;
      const approvalsData = await approvalsRes.json();
      const rawLogsData   = rawLogsRes.ok ? await rawLogsRes.json() : { data: [] };

      setOTBlocks(approvalsData.otBlocks || []);
      setDailyOtThresholdHours(approvalsData.dailyOtThresholdHours ?? 8);
      setCutoffOtThresholdHours(approvalsData.cutoffOtThresholdHours ?? null);

      const empMap = {};
      const COLORS = ["#f97316","#8b5cf6","#2563eb","#ec4899","#0891b2","#16a34a","#7c3aed","#0d9488","#db2777","#b45309","#be185d","#0369a1","#ca8a04"];
      let colorIdx = 0;

      (approvalsData.data || []).forEach((approval) => {
        const user   = approval.timeLog?.user;
        const userId = user?.id;
        if (!userId) return;
        if (!empMap[userId]) {
          const initials = ((user.profile?.firstName?.[0] || "") + (user.profile?.lastName?.[0] || "") || user.username?.[0] || "?").toUpperCase();
          empMap[userId] = {
            id:       userId,
            name:     `${user.profile?.firstName || ""} ${user.profile?.lastName || user.username || ""}`.trim(),
            email:    user.email,
            initials,
            color:    COLORS[colorIdx++ % COLORS.length],
            records:  [],
            hasOT:    false,
            hasBulk:  false,
            isDriver: false,
          };
        }
        const emp     = empMap[userId];
        const details = buildDetails(approval, companyTimezone, isBNC);
        emp.records.push(details);
        if (details.hasOT) emp.hasOT = true;
        if (details.segmentType !== null) emp.isDriver = true;
        if (details.actions?.some((a) => ["approve", "approve-schedule", "approve-raw"].includes(a)) && !["conflict", "unscheduled"].includes(details.type)) {
          emp.hasBulk = true;
        }
      });

      (approvalsData.leaves || []).forEach((leaveRow) => {
        const user   = leaveRow.user;
        const userId = user?.id;
        if (!userId) return;
        if (!empMap[userId]) {
          const initials = ((user.profile?.firstName?.[0] || "") + (user.profile?.lastName?.[0] || "") || user.username?.[0] || "?").toUpperCase();
          empMap[userId] = {
            id:       userId,
            name:     `${user.profile?.firstName || ""} ${user.profile?.lastName || user.username || ""}`.trim(),
            email:    user.email,
            initials,
            color:    COLORS[colorIdx++ % COLORS.length],
            records:  [],
            hasOT:    false,
            hasBulk:  false,
          };
        }
        empMap[userId].records.push({
          id:             leaveRow.id,
          timeLogId:      null,
          segmentType:    null,
          date:           dateOnlyToLabel(leaveRow.leaveDate, companyTimezone),
          type:           "leave",
          detail:         `${leaveRow.leave.leaveType} — <strong>Approved</strong>`,
          tags:           [],
          actions:        ["pre-approved"],
          hours:          leaveRow.hours ?? 8,
          scheduledHours: 0,
          scheduleInfo:   null,
          hasOT:          false,
          timeIn:         "—",
          timeOut:        "—",
          localStatus:    null,
          pendingLeave:   null,
        });
      });

      const syncedTimeLogIds = new Set((approvalsData.data || []).map((a) => a.timeLog?.id).filter(Boolean));
      (rawLogsData.data || []).forEach((rawLog) => {
        if (syncedTimeLogIds.has(rawLog.id)) return;
        const userId = rawLog.userId;
        if (!userId) return;
        if (!empMap[userId]) {
          const nameStr  = rawLog.employeeName || rawLog.email || "Unknown";
          const parts    = nameStr.trim().split(/\s+/);
          const initials = ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase() || "?";
          empMap[userId] = {
            id:       userId,
            name:     nameStr,
            email:    rawLog.email || "",
            initials,
            color:    COLORS[colorIdx++ % COLORS.length],
            records:  [],
            hasOT:    false,
            hasBulk:  false,
          };
        }
        empMap[userId].records.push(buildUnsyncedRecord(rawLog, companyTimezone));
      });

      setEmployees(Object.values(empMap).map((emp) => ({
        ...emp,
        records: groupRecordsByDate(emp.records, ps, pe, companyTimezone),
      })));

      // Server data is now authoritative — clear optimistic overrides for this record
      setLocalStatus((s) => { const n = { ...s }; delete n[recId]; return n; });
      setLocalApprovedTimes((s) => { const n = { ...s }; delete n[recId]; return n; });
      setResetIds((s) => { const n = new Set(s); n.delete(recId); return n; });
    } catch {
      // silent — stale data stays; resolves on next full reload
    } finally {
      setApprovingIds((s) => { const n = new Set(s); n.delete(recId); return n; });
    }
  }, [token, cutoffId, companyTimezone, isBNC, cutoff]);

  // ─────────────────────────────────────────────────────────────────────
  // SYNC — picks up new employees / punch records added after cutoff creation
  // ─────────────────────────────────────────────────────────────────────
  const doSync = useCallback(async () => {
    if (!token || !cutoffId || syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/sync`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Sync failed");

      if (data.data?.created > 0) {
        toast.success(`Synced — ${data.data.created} new record(s) added`);
        await fetchData(); // refresh the full list
      } else {
        toast.info("Already up to date — no new records found");
      }
    } catch (err) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [token, cutoffId, syncing, fetchData]);

  // ─────────────────────────────────────────────────────────────────────
  // BUILD RECORD DETAILS FROM API APPROVAL OBJECT
  // ─────────────────────────────────────────────────────────────────────
  function buildDetails(approval, tz, isBNC) {
    const tl       = approval.timeLog || {};
    const schedule = approval.schedule;
    const calc     = approval.calculatedData || {};
    const payroll  = approval.payrollSummary || {};
    const date     = tl.timeIn ? new Date(tl.timeIn).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz }) : "—";

    const isSegment     = approval.segmentType !== null;
    const isLate        = calc.lateMinutes > 0 && calc.lateStatus === "beyond_grace";
    const withinGrace   = calc.lateMinutes > 0 && calc.lateStatus === "within_grace";
    const leftEarly     = calc.earlyMinutes > 0;
    const hasOT         = calc.hasApprovedOT || false;
    const isUnscheduled = !schedule;
    const isConflict    = approval.hasLeaveConflict || false;

    // Determine type
    let type = "punch";
    if (isConflict)      type = "conflict";
    else if (isUnscheduled) type = "unscheduled";

    // Build detail HTML — for driver/aide segments, show status-aware times:
    // pending/excluded → segmentStart/segmentEnd (each segment has its own window; raw punch
    //   is identical across all 3 segments so it's shown once in the day header instead).
    // approved → approvedClockIn/approvedClockOut (cleaned times set by the server on approval).
    // segmentStart/segmentEnd are also stored as segmentWindow for the reference strip.
    let inTime, outTime;
    if (approval.segmentType !== null) {
      if (approval.status === "approved") {
        inTime  = approval.approvedClockIn  ? formatDateTime(approval.approvedClockIn,  tz) : "—";
        outTime = approval.approvedClockOut ? formatDateTime(approval.approvedClockOut, tz) : "—";
      } else {
        // pending / excluded — show the segment window (unique per segment)
        inTime  = approval.segmentStart ? formatDateTime(approval.segmentStart, tz) : "—";
        outTime = approval.segmentEnd   ? formatDateTime(approval.segmentEnd,   tz) : "—";
      }
    } else {
      inTime  = tl.timeIn  ? formatDateTime(tl.timeIn,  tz) : "—";
      outTime = tl.timeOut ? formatDateTime(tl.timeOut, tz) : "Not clocked out";
    }
    let detail = `<strong>In: ${inTime}</strong> &rarr; <strong>Out: ${outTime}</strong>`;
    if (isConflict && approval.leaveRecord) {
      detail = `<strong>Punch:</strong> ${inTime} &rarr; ${outTime} &nbsp;|&nbsp; <strong>Leave:</strong> ${approval.leaveRecord.leaveType} (Approved)`;
    }

    // Tags
    // Resolve shift window for tag tooltips — available here before scheduleInfo block below
    const schedShiftStart = schedule?.shift?.startTime || schedule?.startTime || null;
    const schedShiftEnd   = schedule?.shift?.endTime   || schedule?.endTime   || null;
    const shiftStartStr   = schedShiftStart ? fmtShiftTime(schedShiftStart) : null;
    const shiftEndStr     = schedShiftEnd   ? fmtShiftTime(schedShiftEnd)   : null;
    const scheduledHrs    = schedule?.scheduledHours || null;

    const tags = [];
    if (tl.isTooEarlyPunch) tags.push({ cls: "tooEarly", label: "Too Early" });
    if (isLate && !tl.isApproved)      tags.push({ cls: "late", label: `${calc.lateMinutes}min late` });
    if (withinGrace) tags.push({ cls: "snap", label: "Within grace — snaps to schedule" });
    if (leftEarly && !tl.isApproved) {
      const earlyHours = (calc.earlyMinutes / 60).toFixed(1);
      const lines = [`Left ${earlyHours}h (${calc.earlyMinutes} min) before the scheduled shift end.`];
      if (shiftStartStr && shiftEndStr) {
        lines.push(`Scheduled: ${shiftStartStr} – ${shiftEndStr}${scheduledHrs ? ` (${scheduledHrs}h)` : ""}.`);
      } else if (shiftEndStr) {
        lines.push(`Scheduled end: ${shiftEndStr}.`);
      }
      lines.push(`Actual clock-out: ${outTime}.`);
      lines.push("Computed server-side from (scheduled end − actual clock-out).");
      tags.push({ cls: "flag", label: `Left ${calc.earlyMinutes}min early`, tooltip: lines.join(" ") });
    }
    // OT tag — DayCare only (BNC rawOtMinutes is always null by server design)
    if (!isBNC && hasOT) tags.push({ cls: "ot", label: `+${calc.overtimeHours}h OT` });
    if (calc.willSnapIn)  tags.push({ cls: "snap", label: "Clock-in will snap" });
    if (calc.willSnapOut) tags.push({ cls: "snap", label: "Clock-out will snap" });
    if (tl.autoClockOut && !tl.isApproved)  tags.push({ cls: "auto", label: "Auto clock-out triggered" });
    if (approval.isDuplicate) tags.push({ cls: "flag", label: "Possible duplicate" });

    // Actions — both BNC and DayCare use the four-button model.
    // BNC segments skip the shift picker (segment times are authoritative).
    // DayCare (segments and regular punches) also skip the picker — schedule is already known.
    const actions = [];
    if (isConflict) {
      actions.push("honor-punch", "honor-leave");
    } else if (isBNC && isSegment) {
      actions.push("approve-raw", "edit", "exclude");
    } else if (isBNC) {
      actions.push("approve-schedule", "approve-raw", "edit", "exclude");
    } else if (isSegment) {
      // DayCare driver/aide segments — four-button model
      actions.push("approve-schedule", "approve-raw", "edit", "exclude");
    } else {
      // DayCare regular punch — same four-button model; no OT button (handled server-side)
      actions.push("approve-schedule", "approve-raw", "edit", "exclude");
      // Training designation toggle — only for REGULAR/TRAINING punchTypes (not DRIVER_AIDE etc.)
      const pt = tl.punchType || "REGULAR";
      if (pt === "REGULAR" || pt === "TRAINING") actions.push("toggle-training");
    }

    const payableHours = payroll.payableRegularHours || calc.payableHours || 0;
    const totalPayable = payroll.totalPayableHours   || payableHours;

    const scheduleInfo = schedule
      ? {
          scheduledHours: schedule.scheduledHours || 0,
          shiftStart: schedule.shift?.startTime || schedule.startTime || null,
          shiftEnd:   schedule.shift?.endTime   || schedule.endTime   || null,
        }
      : null;

    // Extract no_schedule remark from TimeLog.remarks JSON array
    const remarks = Array.isArray(tl.remarks) ? tl.remarks : [];
    const noScheduleRemark = remarks.find((r) => r.type === "no_schedule") || null;

    return {
      id:              approval.id,
      timeLogId:       tl.id,
      segmentType:     approval.segmentType ?? null,
      availableShifts: approval.availableShifts || [],
      rawTimeIn:       tl.timeIn  || null,
      rawTimeOut:      tl.timeOut || null,
      date,
      type,
      detail,
      tags,
      actions,
      hours:          parseFloat(totalPayable) || 0,
      scheduledHours: schedule?.scheduledHours || 0,
      scheduleInfo,
      hasOT,
      timeIn:         inTime,
      timeOut:        outTime,
      segmentWindow:  approval.segmentType !== null && approval.segmentStart && approval.segmentEnd
        ? `${formatDateTime(approval.segmentStart, tz)} – ${formatDateTime(approval.segmentEnd, tz)}`
        : null,
      pendingLeave:      approval.pendingLeave || null,
      noScheduleRemark,
      punchType:   tl.punchType || "REGULAR",
      localStatus: approval.status === "approved" ? "approved" : approval.status === "excluded" ? "excluded" : null,
    };
  }

  function buildUnsyncedRecord(rawLog, tz) {
    const date    = rawLog.timeIn ? new Date(rawLog.timeIn).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz }) : "—";
    const inTime  = rawLog.timeIn  ? formatDateTime(rawLog.timeIn,  tz) : "—";
    const outTime = rawLog.timeOut ? formatDateTime(rawLog.timeOut, tz) : "Not clocked out";
    return {
      id:               `unsynced-${rawLog.id}`,
      rawTimeLogId:     rawLog.id,
      segmentType:      null,
      date,
      type:             "unsynced",
      detail:           `<strong>In: ${inTime}</strong> &rarr; <strong>Out: ${outTime}</strong>`,
      tags:             [],
      actions:          [],
      hours:            0,
      scheduledHours:   0,
      scheduleInfo:     null,
      hasOT:            false,
      timeIn:           inTime,
      timeOut:          outTime,
      localStatus:      null,
      pendingLeave:     null,
      noScheduleRemark: null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // RECORD GROUPING — driver segments by date + regular multi-shift by date
  // ─────────────────────────────────────────────────────────────────────
  function groupRecordsByDate(records, periodStart, periodEnd, tz = "UTC") {
    const PUNCHABLE = new Set(["punch", "unscheduled", "conflict", "approved", "excluded"]);

    // Count punchable records per date to know which dates need multi-shift grouping
    const punchCountPerDate = {};
    for (const rec of records) {
      if (rec.segmentType === null && PUNCHABLE.has(rec.type)) {
        punchCountPerDate[rec.date] = (punchCountPerDate[rec.date] || 0) + 1;
      }
    }

    // Build a date-label → [grouped items] map so we can enumerate days in order
    const byDate        = {};
    const driverGroupMap = {};
    const punchGroupMap  = {};

    const addToDate = (label, item) => {
      if (!byDate[label]) byDate[label] = [];
      byDate[label].push(item);
    };

    for (const rec of records) {
      if (rec.segmentType !== null) {
        if (!driverGroupMap[rec.date]) {
          const group = { id: `driver-group-${rec.date}`, type: "driver_group", date: rec.date, segments: [], hours: 0 };
          driverGroupMap[rec.date] = group;
          addToDate(rec.date, group);
        }
        driverGroupMap[rec.date].segments.push(rec);
        driverGroupMap[rec.date].hours += rec.hours || 0;
      } else if (PUNCHABLE.has(rec.type) && punchCountPerDate[rec.date] > 1) {
        if (!punchGroupMap[rec.date]) {
          const group = { id: `punch-group-${rec.date}`, type: "punch_group", date: rec.date, punches: [], hours: 0 };
          punchGroupMap[rec.date] = group;
          addToDate(rec.date, group);
        }
        punchGroupMap[rec.date].punches.push(rec);
        punchGroupMap[rec.date].hours += rec.hours || 0;
      } else {
        addToDate(rec.date, rec);
      }
    }

    for (const group of Object.values(driverGroupMap)) {
      group.segments.sort((a, b) => (SEGMENT_ORDER[a.segmentType] ?? 99) - (SEGMENT_ORDER[b.segmentType] ?? 99));
    }

    // Enumerate every day in the period in chronological order.
    // Days with data → emit those records; days without → emit an absent placeholder.
    const allDays = enumeratePeriodDays(periodStart, periodEnd, tz);
    if (allDays.length === 0) {
      // No period bounds available — fall back to whatever order we built above
      return Object.values(byDate).flat();
    }

    const result = [];
    for (const { isoDate, label } of allDays) {
      if (byDate[label]) {
        result.push(...byDate[label]);
      } else {
        result.push({ id: `absent-${isoDate}`, type: "absent", date: label, hours: 0, actions: [], localStatus: null, tags: [] });
      }
    }
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────
  // DERIVED — MERGE LOCAL STATUS INTO EMPLOYEE RECORDS
  // ─────────────────────────────────────────────────────────────────────
  const mergedEmployees = useMemo(() => {
    // resetIds forces localStatus → null regardless of what buildDetails baked in,
    // allowing a just-reset record to show its action buttons again.
    const effectiveStatus = (id, baked) => resetIds.has(id) ? null : (localStatus[id] ?? baked);

    return employees.map((emp) => {
      const patchTimes = (rec) => {
        const t           = localApprovedTimes[rec.id];
        const isApproving = approvingIds.has(rec.id);
        const ptOverride  = localPunchType[rec.id];
        if (!t && !isApproving && !ptOverride) return rec;
        const newTimeIn  = t?.timeIn  ?? rec.timeIn;
        const newTimeOut = t?.timeOut ?? rec.timeOut;
        const newDetail  = t ? `<strong>In: ${newTimeIn}</strong> &rarr; <strong>Out: ${newTimeOut}</strong>` : rec.detail;
        return { ...rec, timeIn: newTimeIn, timeOut: newTimeOut, detail: newDetail, isApproving, ...(ptOverride && { punchType: ptOverride }) };
      };

      const records = emp.records.map((r) => {
        if (r.type === "driver_group") {
          const segments = r.segments.map((s) => patchTimes({ ...s, localStatus: effectiveStatus(s.id, s.localStatus) }));
          return { ...r, segments, hours: segments.reduce((sum, s) => s.localStatus === "approved" ? sum + (s.hours || 0) : sum, 0), isApproving: segments.some((s) => s.isApproving) };
        }
        if (r.type === "punch_group") {
          const punches = r.punches.map((p) => patchTimes({ ...p, localStatus: effectiveStatus(p.id, p.localStatus) }));
          return { ...r, punches, hours: punches.reduce((sum, p) => p.localStatus === "approved" ? sum + (p.hours || 0) : sum, 0) };
        }
        return patchTimes({ ...r, localStatus: effectiveStatus(r.id, r.localStatus) });
      });

      // Flatten actionable records — driver segments and punch sub-rows counted individually
      // Absent and unsynced rows are display-only and not counted as actionable.
      const actionableFlat = [];
      let unsyncedCount = 0;
      records.forEach((r) => {
        if (r.type === "driver_group") {
          r.segments.forEach((s) => actionableFlat.push(s));
        } else if (r.type === "punch_group") {
          r.punches.forEach((p) => actionableFlat.push(p));
        } else if (r.type === "unsynced") {
          unsyncedCount++;
        } else if (!["rest", "leave", "absent"].includes(r.type) && !r.actions?.includes("pre-approved")) {
          actionableFlat.push(r);
        }
      });

      const approved   = actionableFlat.filter((r) => r.localStatus === "approved" || r.localStatus === "resolved").length;
      const empOTBlocks     = otBlocks.filter((b) => b.userId === emp.id);
      const pendingOTBlocks = empOTBlocks.filter((b) => (localOTBlockStatus[b.id] || b.status) === "pending").length;
      const pending    = actionableFlat.filter((r) => !r.localStatus).length + pendingOTBlocks;
      const punchHours = records.reduce((s, r) => {
        if (r.type === "leave") return s;
        if (r.type === "punch_group" || r.type === "driver_group") return s + (r.hours || 0);
        return r.localStatus === "approved" ? s + (r.hours || 0) : s;
      }, 0);
      const leaveHours = records.filter((r) => r.type === "leave").reduce((s, r) => s + (r.hours || 0), 0);
      return { ...emp, records, approved, pending, unsyncedCount, totalHours: punchHours + leaveHours, punchHours, leaveHours, otBlocks: empOTBlocks };
    });
  }, [employees, localStatus, localApprovedTimes, approvingIds, resetIds, otBlocks, localOTBlockStatus, localPunchType]);

  // Dates that have at least one TRAINING punch across all employees — used to show the
  // Training Day badge/toggle on date sub-headers in non-driver employee cards.
  const trainingDates = useMemo(() => {
    const s = new Set();
    for (const emp of mergedEmployees) {
      for (const r of emp.records) {
        if (r.type === "punch_group") {
          if (r.punches.some((p) => p.punchType === "TRAINING")) s.add(r.date);
        } else if (r.punchType === "TRAINING") {
          s.add(r.date);
        }
      }
    }
    return s;
  }, [mergedEmployees]);

  // Global stats
  const globalStats = useMemo(() => {
    const totalActionable = mergedEmployees.reduce((s, e) => s + e.approved + e.pending, 0);
    const totalApproved   = mergedEmployees.reduce((s, e) => s + e.approved, 0);
    const totalPending    = mergedEmployees.reduce((s, e) => s + e.pending, 0);
    const totalHours      = mergedEmployees.reduce((s, e) => s + e.totalHours, 0);
    const totalFlagged    = mergedEmployees.filter((e) =>
      e.records.some((r) => {
        if (r.type === "driver_group") return r.segments.some((s) => s.tags?.length && !s.localStatus);
        if (r.type === "punch_group")  return r.punches.some((p) => (p.type === "conflict" || p.type === "unscheduled" || p.tags?.length) && !p.localStatus);
        return (r.type === "conflict" || r.type === "unscheduled" || r.tags?.length) && !r.localStatus;
      })
    ).length;
    const pct = totalActionable > 0 ? Math.round(((totalApproved) / totalActionable) * 100) : 0;
    return { totalActionable, totalApproved, totalPending, totalHours, totalFlagged, pct };
  }, [mergedEmployees]);

  // Update DOM stats imperatively to avoid re-renders of the sticky header
  useEffect(() => {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("stat-total",     globalStats.totalActionable);
    set("stat-approved",  globalStats.totalApproved);
    set("stat-unreviewed",globalStats.totalPending);
    set("stat-flagged",   globalStats.totalFlagged);
    set("stat-hours",     globalStats.totalHours.toFixed(1) + "h");
    const fill = document.getElementById("progress-fill");
    if (fill) fill.style.width = globalStats.pct + "%";
  }, [globalStats]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    const activeChips = chips.filter((c) => c.active).map((c) => c.id);
    return mergedEmployees.filter((emp) => {
      // Tab filter
      if (activeTab === "flagged"  && !emp.records.some((r) => {
        if (r.type === "punch_group") return r.punches.some((p) => ["conflict","unscheduled"].includes(p.type) && !p.localStatus);
        return ["conflict","unscheduled"].includes(r.type) && !r.localStatus;
      })) return false;
      if (activeTab === "approved" && emp.pending > 0) return false;
      if (activeTab === "excluded" && !emp.records.some((r) => {
        if (r.type === "punch_group") return r.punches.some((p) => p.localStatus === "excluded");
        return r.localStatus === "excluded";
      })) return false;
      // Search
      if (search && !emp.name.toLowerCase().includes(search.toLowerCase()) && !emp.email.toLowerCase().includes(search.toLowerCase())) return false;
      // Chips
      if (activeChips.includes("late")        && !emp.records.some((r) => {
        if (r.type === "driver_group") return r.segments.some((s) => s.tags?.some((t) => t.cls === "late"));
        if (r.type === "punch_group")  return r.punches.some((p) => p.tags?.some((t) => t.cls === "late"));
        return r.tags?.some((t) => t.cls === "late");
      })) return false;
      if (activeChips.includes("unscheduled") && !emp.records.some((r) => {
        if (r.type === "punch_group") return r.punches.some((p) => p.type === "unscheduled");
        return r.type === "unscheduled";
      })) return false;
      if (activeChips.includes("ot")          && !emp.hasOT && !(emp.otBlocks?.length > 0))                        return false;
      if (activeChips.includes("conflict")    && !emp.records.some((r) => {
        if (r.type === "punch_group") return r.punches.some((p) => p.type === "conflict");
        return r.type === "conflict";
      })) return false;
      if (activeChips.includes("leave")       && !emp.records.some((r) => r.type === "leave"))                      return false;
      if (activeChips.includes("training") && !emp.records.some((r) => {
        if (r.type === "punch_group") return r.punches.some((p) => p.punchType === "TRAINING");
        return r.punchType === "TRAINING";
      })) return false;
      return true;
    }).sort((a, b) => b.totalHours - a.totalHours);
  }, [mergedEmployees, activeTab, search, chips]);

  const tabs = useMemo(() => [
    { id: "all",      label: "All",      count: mergedEmployees.length },
    { id: "flagged",  label: "Flagged",  count: mergedEmployees.filter((e) => e.records.some((r) => {
      if (r.type === "punch_group") return r.punches.some((p) => ["conflict","unscheduled"].includes(p.type) && !p.localStatus);
      return ["conflict","unscheduled"].includes(r.type) && !r.localStatus;
    })).length },
    { id: "approved", label: "Approved", count: mergedEmployees.filter((e) => e.pending === 0 && e.approved > 0).length },
    { id: "excluded", label: "Excluded", count: mergedEmployees.filter((e) => e.records.some((r) => {
      if (r.type === "punch_group") return r.punches.some((p) => p.localStatus === "excluded");
      return r.localStatus === "excluded";
    })).length },
  ], [mergedEmployees]);

  const getDepartmentName = useCallback(
    (id) => departments.find((d) => d.id === id)?.name || "No Department",
    [departments]
  );

  // ─────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────
  const findRecord = useCallback((recId) => {
    for (const emp of mergedEmployees) {
      for (const r of emp.records) {
        if (r.type === "driver_group") {
          const seg = r.segments.find((s) => s.id === recId);
          if (seg) return seg;
        } else if (r.type === "punch_group") {
          const punch = r.punches.find((p) => p.id === recId);
          if (punch) return punch;
        } else if (r.id === recId) {
          return r;
        }
      }
    }
    return null;
  }, [mergedEmployees]);

  const doApprove = useCallback(async (recId, options = {}) => {
    const { withOT = false, approvalMode, shiftId, editedClockIn, editedClockOut, notes } = options;
    setLocalStatus((s) => ({ ...s, [recId]: "approved" }));
    setApprovingIds((s) => { const n = new Set(s); n.add(recId); return n; });
    if (approvalMode === "schedule" && shiftId) {
      setUsedShifts((s) => ({ ...s, [recId]: shiftId }));
    }
    try {
      const rec = findRecord(recId);
      if (!rec) return;

      const payload = { action: "approve" };
      if (approvalMode) {
        payload.approvalMode = approvalMode;
        if (approvalMode === "schedule" && shiftId) payload.shiftId = shiftId;
        if (approvalMode === "edit") {
          if (editedClockIn)  payload.editedClockIn  = editedClockIn;
          if (editedClockOut) payload.editedClockOut = editedClockOut;
        }
      }
      // withOT is DayCare-only; harmlessly ignored by server for BNC
      if (withOT) payload.withOT = true;
      if (notes)  payload.notes  = notes;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/approvals/${rec.id}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error();
      toast.success("Approved");
      // Keep approvingIds active — refreshApprovals clears it once the GET /approvals
      // completes and employees are rebuilt with enriched hours from enrichApprovals.
      await refreshApprovals(recId);
    } catch {
      setLocalStatus((s) => { const n = { ...s }; delete n[recId]; return n; });
      setApprovingIds((s) => { const n = new Set(s); n.delete(recId); return n; });
      if (approvalMode === "schedule" && shiftId) {
        setUsedShifts((s) => { const n = { ...s }; delete n[recId]; return n; });
      }
      toast.error("Failed to approve");
    }
  }, [token, cutoffId, findRecord, refreshApprovals]);

  const handleApproveSchedule = useCallback((rec) => {
    // DayCare (any punch type) — no shift picker needed; schedule is already known server-side.
    // BNC segments also bypass the picker; their segment window is authoritative.
    // Sends { action: "approve", approvalMode: "schedule" } with no shiftId in both cases.
    if (!isBNC || rec.segmentType !== null) {
      doApprove(rec.id, { approvalMode: "schedule" });
      return;
    }
    // BNC regular punches — shift picker required (admin selects which shift to snap to)
    const shifts = rec.availableShifts || [];
    if (shifts.length === 0) {
      toast.warning("No shift assigned for this date — use Approve Raw Time instead.");
      return;
    }
    // Collect shiftIds already used by sibling records on the same date so the
    // picker can gray them out and prevent double-booking the same shift.
    const usedShiftIds = new Set();
    for (const emp of mergedEmployees) {
      for (const r of emp.records) {
        const candidates =
          r.type === "punch_group"  ? r.punches  :
          r.type === "driver_group" ? r.segments :
          [r];
        for (const candidate of candidates) {
          if (
            candidate.id !== rec.id &&
            candidate.date === rec.date &&
            (localStatus[candidate.id] === "approved" || candidate.localStatus === "approved") &&
            usedShifts[candidate.id]
          ) {
            usedShiftIds.add(usedShifts[candidate.id]);
          }
        }
      }
    }

    setShiftPickerModal({ recId: rec.id, shifts, usedShiftIds, timeIn: rec.timeIn, timeOut: rec.timeOut });
  }, [doApprove, mergedEmployees, localStatus, usedShifts]);

  const doConflict = useCallback(async (recId, choice) => {
    setLocalStatus((s) => ({ ...s, [recId]: "resolved" }));
    try {
      const rec = findRecord(recId);
      if (!rec) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/approvals/${rec.id}/conflict`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ choice }),
        }
      );
      if (!res.ok) throw new Error();
      toast.success(choice === "punch" ? "Punch honored — leave credit returned" : "Leave honored — punch excluded");
    } catch {
      setLocalStatus((s) => { const n = { ...s }; delete n[recId]; return n; });
      toast.error("Failed to resolve conflict");
    }
  }, [token, cutoffId, findRecord]);

  const confirmExclude = useCallback(async () => {
    if (!excludeReason) { toast.error("Please select a reason"); return; }
    const { recId } = excludeModal;
    setIsSaving(true);
    setLocalStatus((s) => ({ ...s, [recId]: "excluded" }));
    try {
      const rec = findRecord(recId);
      if (!rec) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/approvals/${rec.id}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "exclude", reason: excludeReason, notes: excludeNote }),
        }
      );
      if (!res.ok) throw new Error();
      // Server cascades exclude to all segments in the same driver group — mirror that
      // client-side so siblings show as locked immediately and don't trigger stale PATCHes.
      if (rec.segmentType !== null) {
        const siblingIds = [];
        for (const emp of mergedEmployees) {
          for (const r of emp.records) {
            if (r.type === "driver_group" && r.segments.some((s) => s.id === recId)) {
              r.segments.forEach((s) => { if (s.id !== recId) siblingIds.push(s.id); });
            }
          }
        }
        if (siblingIds.length > 0) {
          setLocalStatus((s) => {
            const n = { ...s };
            siblingIds.forEach((id) => { n[id] = "excluded"; });
            return n;
          });
        }
      }
      toast.success("Record excluded");
      setExcludeModal(null);
      setExcludeReason("");
      setExcludeNote("");
      if (isBNC || otBasis === "cutoff") refreshOTBlocks();
    } catch {
      setLocalStatus((s) => { const n = { ...s }; delete n[recId]; return n; });
      toast.error("Failed to exclude record");
    } finally {
      setIsSaving(false);
    }
  }, [token, cutoffId, excludeModal, excludeReason, excludeNote, findRecord, mergedEmployees, isBNC, otBasis, refreshOTBlocks]);

  const doBulkApprove = useCallback(async (empId) => {
    const emp = mergedEmployees.find((e) => e.id === empId);
    if (!emp) return;

    const APPROVABLE_ACTIONS = ["approve", "approve-schedule", "approve-raw"];
    const isApprovable = (r) =>
      !r.localStatus &&
      r.actions?.some((a) => APPROVABLE_ACTIONS.includes(a)) &&
      !["conflict", "unscheduled"].includes(r.type);

    const toApprove = []; // [{ recId, timeLogId }]
    emp.records.forEach((r) => {
      if (r.type === "driver_group") {
        r.segments.forEach((s) => { if (isApprovable(s)) toApprove.push({ recId: s.id, timeLogId: s.timeLogId }); });
      } else if (r.type === "punch_group") {
        r.punches.forEach((p) => { if (isApprovable(p)) toApprove.push({ recId: p.id, timeLogId: p.timeLogId }); });
      } else if (isApprovable(r)) {
        toApprove.push({ recId: r.id, timeLogId: r.timeLogId });
      }
    });

    if (toApprove.length === 0) return;

    const recIds     = toApprove.map((x) => x.recId);
    const timeLogIds = toApprove.map((x) => x.timeLogId).filter(Boolean);

    // Optimistic update
    setLocalStatus((s) => {
      const n = { ...s };
      recIds.forEach((id) => { n[id] = "approved"; });
      return n;
    });

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/approvals/bulk`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve", approvalMode: "raw", timeLogIds }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Bulk approve failed");
      toast.success(`${data.data?.approved ?? toApprove.length} record(s) approved`);
      if (isBNC || otBasis === "cutoff") refreshOTBlocks();
    } catch (err) {
      setLocalStatus((s) => {
        const n = { ...s };
        recIds.forEach((id) => { delete n[id]; });
        return n;
      });
      toast.error(err.message || "Bulk approve failed");
    }
  }, [token, cutoffId, mergedEmployees, isBNC, otBasis, refreshOTBlocks]);

  const doOTBlock = useCallback(async (blockId, action) => {
    setLocalOTBlockStatus((s) => ({ ...s, [blockId]: action === "approve" ? "approved" : "excluded" }));
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/ot-blocks/${blockId}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      if (!res.ok) throw new Error();
      toast.success(action === "approve" ? "OT block approved" : "OT block excluded");
    } catch {
      setLocalOTBlockStatus((s) => { const n = { ...s }; delete n[blockId]; return n; });
      toast.error(`Failed to ${action} OT block`);
    }
  }, [token, cutoffId]);

  const doReset = useCallback(async (recId) => {
    setResetIds((s) => new Set([...s, recId]));
    setLocalStatus((s) => { const n = { ...s }; delete n[recId]; return n; });
    setApprovingIds((s) => { const n = new Set(s); n.add(recId); return n; });
    try {
      const rec = findRecord(recId);
      if (!rec) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/approvals/${rec.id}/reset`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        }
      );
      if (!res.ok) throw new Error();
      toast.success("Approval reset — record returned to pending");
      // Keep approvingIds active — refreshApprovals clears it once the GET /approvals
      // completes and employees are rebuilt with the restored pending-state hours.
      await refreshApprovals(recId);
    } catch {
      setResetIds((s) => { const n = new Set(s); n.delete(recId); return n; });
      setApprovingIds((s) => { const n = new Set(s); n.delete(recId); return n; });
      toast.error("Failed to reset approval");
    }
  }, [token, cutoffId, findRecord, refreshApprovals]);

  const doSetPunchType = useCallback(async (recId, targetType) => {
    const prevType = localPunchType[recId];
    setLocalPunchType((s) => ({ ...s, [recId]: targetType }));
    try {
      const rec = findRecord(recId);
      if (!rec) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/approvals/${rec.id}/set-punch-type`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ punchType: targetType }),
        }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(targetType === "TRAINING" ? "Punch marked as Training" : "Punch marked as Regular");
      if (targetType === "TRAINING" && (data.data?.excludedSegmentCount ?? 0) > 0) {
        await refreshApprovals(recId);
      }
    } catch {
      setLocalPunchType((s) => {
        const n = { ...s };
        if (prevType != null) n[recId] = prevType; else delete n[recId];
        return n;
      });
      toast.error("Failed to update punch type");
    }
  }, [token, cutoffId, findRecord, localPunchType, refreshApprovals]);

  const doSetPunchTypeForDate = useCallback(async (date, targetType) => {
    // Collect all eligible records for this date across ALL employees
    const targets = [];
    for (const emp of mergedEmployees) {
      for (const r of emp.records) {
        if (r.type === "punch_group") {
          r.punches.forEach((p) => {
            if (p.date === date && p.actions?.includes("toggle-training")) targets.push(p);
          });
        } else if (r.date === date && r.actions?.includes("toggle-training")) {
          targets.push(r);
        }
      }
    }
    if (targets.length === 0) {
      toast.info("No eligible punches on this date to update");
      return;
    }

    // Optimistic update
    setLocalPunchType((s) => {
      const n = { ...s };
      targets.forEach((r) => { n[r.id] = targetType; });
      return n;
    });

    // Fire all API calls in parallel — one per approval record
    const results = await Promise.allSettled(
      targets.map((rec) =>
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/approvals/${rec.id}/set-punch-type`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ punchType: targetType }),
          }
        ).then(async (r) => { if (!r.ok) throw new Error(); return r.json(); })
      )
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      // Roll back all on any failure
      setLocalPunchType((s) => {
        const n = { ...s };
        targets.forEach((r) => { delete n[r.id]; });
        return n;
      });
      toast.error(`${failed} of ${targets.length} update(s) failed — no changes saved`);
    } else {
      toast.success(
        targetType === "TRAINING"
          ? `${targets.length} punch(es) on ${date} marked as Training`
          : `${targets.length} punch(es) on ${date} reset to Regular`
      );
      const anyExcluded = targetType === "TRAINING" && results.some(
        (r) => r.status === "fulfilled" && (r.value?.data?.excludedSegmentCount ?? 0) > 0
      );
      if (anyExcluded) await refreshApprovals(targets[0]?.id);
    }
  }, [token, cutoffId, mergedEmployees, refreshApprovals]);

  const confirmFinalize = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/finalize`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        }
      );
      if (!res.ok) throw new Error();
      toast.success("Cutoff period finalized and locked");
      setFinalizeModal(false);
      router.push("/dashboard/company/cutoff-periods");
    } catch {
      toast.error("Failed to finalize cutoff period");
    } finally {
      setIsSaving(false);
    }
  }, [token, cutoffId, router]);

  const finalizeReady = globalStats.totalPending === 0 && mergedEmployees.length > 0;

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-10 w-full" />
        {[1,2,3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 dark:bg-neutral-950">

      {/* ── Sync overlay — blocks all interaction while sync + re-fetch is in flight ── */}
      <AnimatePresence>
        {syncing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 8 }}
              animate={{ scale: 1,    opacity: 1, y: 0 }}
              exit={{    scale: 0.92, opacity: 0, y: 8 }}
              transition={{ duration: 0.22, delay: 0.06 }}
              className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 px-8 py-8 max-w-sm w-full mx-4 flex flex-col items-center gap-5 text-center"
            >
              {/* Pulsing icon ring */}
              <div className="relative w-16 h-16 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-blue-400/30 animate-ping" />
                <span className="absolute inset-1.5 rounded-full bg-blue-100 dark:bg-blue-900/40" />
                <RefreshCw className="relative w-7 h-7 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>

              {/* Copy */}
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Syncing Records</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Scanning for new employees and punch records added after this cutoff was created.
                </p>
              </div>

              {/* Indeterminate progress bar */}
              <div className="w-full h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full w-1/2 bg-blue-500 rounded-full"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>

              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                Please wait — this may take a moment
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Header */}
      <PageHeader
        cutoff={cutoff}
        status={cutoff?.status || "open"}
        onFinalize={() => setFinalizeModal(true)}
        finalizeReady={finalizeReady}
        getDepartmentName={getDepartmentName}
        onSync={doSync}
        syncing={syncing}
        otBasis={otBasis}
        dailyOtThresholdHours={dailyOtThresholdHours}
        cutoffOtThresholdHours={cutoffOtThresholdHours}
        refreshingOT={refreshingOT}
        cutoffId={cutoffId}
      />

      {/* Filter Bar */}
      <FilterBar
        tabs={tabs}
        activeTab={activeTab}
        onTab={setActiveTab}
        search={search}
        onSearch={setSearch}
        chips={chips}
        onChip={(id) => setChips((c) => c.map((chip) => chip.id === id ? { ...chip, active: !chip.active } : chip))}
      />

      {/* Employee Cards */}
      <div className="flex-1 p-6 space-y-3">
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-24">
            <AlertCircle className="w-14 h-14 mx-auto text-neutral-200 mb-4" />
            <p className="font-semibold text-neutral-500">No employees match your filters</p>
            <button onClick={() => { setSearch(""); setActiveTab("all"); setChips((c) => c.map((ch) => ({ ...ch, active: false }))); }}
              className="mt-3 text-sm text-orange-500 hover:underline">
              Clear all filters
            </button>
          </div>
        ) : (
          filteredEmployees.map((emp, i) => (
            <motion.div
              key={emp.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <EmployeeCard
                emp={emp}
                onApprove={(id) => doApprove(id)}
                onApproveOT={(id) => doApprove(id, { withOT: true })}
                onApproveSchedule={handleApproveSchedule}
                onApproveRaw={(id) => doApprove(id, { approvalMode: "raw" })}
                onEdit={(rec) => {
                  setEditModal({ rec });
                  setEditedClockIn(rec.rawTimeIn ? toCompanyTzInput(rec.rawTimeIn, companyTimezone) : "");
                  setEditedClockOut(rec.rawTimeOut ? toCompanyTzInput(rec.rawTimeOut, companyTimezone) : "");
                  setEditNotes("");
                }}
                onExclude={(id) => setExcludeModal({ recId: id })}
                onConflict={doConflict}
                onBulkApprove={doBulkApprove}
                onOTBlock={doOTBlock}
                localOTBlockStatus={localOTBlockStatus}
                companyTimezone={companyTimezone}
                dailyOtThresholdHours={dailyOtThresholdHours}
                cutoffOtThresholdHours={cutoffOtThresholdHours}
                otBasis={otBasis}
                onReset={doReset}
                onSetPunchType={doSetPunchType}
                trainingDates={trainingDates}
                onTrainingDay={doSetPunchTypeForDate}
                refreshingOT={refreshingOT}
              />
            </motion.div>
          ))
        )}
      </div>

      {/* ── Edit Modal ── */}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="w-[90vw] sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-amber-500" /> Edit Punch Log
            </DialogTitle>
            <DialogDescription>
              {editModal?.rec?.date} — corrections will be applied on approval
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-neutral-400">Original Clock-In</span><span className="font-semibold">{editModal?.rec?.timeIn}</span></div>
              <div className="flex justify-between"><span className="text-neutral-400">Original Clock-Out</span><span className="font-semibold">{editModal?.rec?.timeOut}</span></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Corrected Clock-In</Label>
                <Input
                  type="datetime-local"
                  value={editedClockIn}
                  onChange={(e) => setEditedClockIn(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Corrected Clock-Out</Label>
                <Input
                  type="datetime-local"
                  value={editedClockOut}
                  onChange={(e) => setEditedClockOut(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-neutral-400">Times are in the company timezone: <span className="font-medium text-neutral-600">{companyTimezone}</span></p>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Reason for Edit</Label>
              <Input
                placeholder="Brief reason for this correction (audit trail)..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditModal(null)}>Cancel</Button>
              <Button
                className="bg-green-500 hover:bg-green-600 gap-2"
                onClick={() => {
                  doApprove(editModal.rec.id, {
                    approvalMode:   "edit",
                    editedClockIn:  editedClockIn  ? fromCompanyTzInput(editedClockIn,  companyTimezone) : undefined,
                    editedClockOut: editedClockOut ? fromCompanyTzInput(editedClockOut, companyTimezone) : undefined,
                    notes:          editNotes || undefined,
                  });
                  setEditModal(null);
                }}
              >
                <Check className="w-4 h-4" /> Save & Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Exclude Modal ── */}
      <Dialog open={!!excludeModal} onOpenChange={() => setExcludeModal(null)}>
        <DialogContent className="w-[90vw] sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" /> Exclude Record
            </DialogTitle>
            <DialogDescription>
              This record will be removed from payroll. A reason is required for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Reason *</Label>
              <Select value={excludeReason} onValueChange={setExcludeReason}>
                <SelectTrigger><SelectValue placeholder="Select a reason..." /></SelectTrigger>
                <SelectContent>
                  {EXCLUDE_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Additional Notes (optional)</Label>
              <Input
                placeholder="Any additional context for the audit log..."
                value={excludeNote}
                onChange={(e) => setExcludeNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setExcludeModal(null)}>Cancel</Button>
              <Button
                variant="destructive"
                className="gap-2"
                onClick={confirmExclude}
                disabled={isSaving || !excludeReason}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                Confirm Exclusion
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Shift Picker Modal (B&C — Approve Schedule) ── */}
      <Dialog open={!!shiftPickerModal} onOpenChange={() => setShiftPickerModal(null)}>
        <DialogContent className="w-[90vw] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" /> Select Shift
            </DialogTitle>
            <DialogDescription>
              Choose the shift to approve this punch against. The server will snap clock-in to shift start and cap clock-out at shift end.
            </DialogDescription>
          </DialogHeader>
          {(shiftPickerModal?.timeIn || shiftPickerModal?.timeOut) && (
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-1.5">Punch Time</p>
              <p className="font-mono text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                {shiftPickerModal.timeIn} → {shiftPickerModal.timeOut}
              </p>
            </div>
          )}
          <div className="space-y-2 pt-2">
            {shiftPickerModal?.shifts.map((shift) => {
              const isUsed = shiftPickerModal.usedShiftIds?.has(shift.id);
              return (
                <button
                  key={shift.id}
                  disabled={isUsed}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all
                    ${isUsed
                      ? "border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 cursor-not-allowed"
                      : "border-neutral-200 dark:border-neutral-700 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10"
                    }`}
                  onClick={() => {
                    if (isUsed) return;
                    doApprove(shiftPickerModal.recId, { approvalMode: "schedule", shiftId: shift.id });
                    setShiftPickerModal(null);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className={`font-semibold text-sm ${isUsed ? "text-neutral-400 dark:text-neutral-600" : "text-neutral-800 dark:text-neutral-200"}`}>
                      {shift.shiftName}
                    </p>
                    {isUsed && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500">
                        Already used
                      </span>
                    )}
                  </div>
                  <p className={`font-mono text-xs mt-0.5 ${isUsed ? "text-neutral-300 dark:text-neutral-600" : "text-neutral-400"}`}>
                    {fmtShiftTime(shift.startTime)} – {fmtShiftTime(shift.endTime)}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setShiftPickerModal(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Finalize Modal ── */}
      <Dialog open={finalizeModal} onOpenChange={setFinalizeModal}>
        <DialogContent className="w-[90vw] sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-orange-500" /> Finalize Cutoff Period
            </DialogTitle>
            <DialogDescription>
              {getDepartmentName(cutoff?.departmentId)} &nbsp;·&nbsp; {formatDate(cutoff?.periodStart)} – {formatDate(cutoff?.periodEnd)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
                This action is <strong>permanent and non-reversible.</strong> Once finalized, all records will be locked and passed to payroll. No further edits are possible.
              </p>
            </div>
            <div className="space-y-2">
              {[
                { pass: globalStats.totalPending === 0, label: "All punch logs reviewed" },
                { pass: !mergedEmployees.some((e) => e.records.some((r) => r.type === "conflict" && !r.localStatus)), label: "All conflicts resolved" },
                { pass: true, label: "OT flags actioned" },
              ].map((item) => (
                <div key={item.label} className={`flex items-center gap-2.5 text-sm ${item.pass ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>
                  {item.pass
                    ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 flex-shrink-0" />}
                  {item.label}
                </div>
              ))}
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-neutral-400">Department</span><span className="font-semibold">{getDepartmentName(cutoff?.departmentId)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-400">Period</span><span className="font-semibold">{formatDate(cutoff?.periodStart)} – {formatDate(cutoff?.periodEnd)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-400">Payment Date</span><span className="font-semibold">{formatDate(cutoff?.paymentDate)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-400">Total Approved Hours</span><span className="font-semibold">{globalStats.totalHours.toFixed(1)}h</span></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFinalizeModal(false)}>Cancel</Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 gap-2"
                onClick={confirmFinalize}
                disabled={isSaving || !finalizeReady}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Finalize &amp; Lock
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}