// components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/cutoffReviewShared.jsx
// BB-121: data, record building, actions and dialogs shared by the two cutoff review pages —
// List Type (CutoffReview.jsx) and Calendar Type (CutoffReviewCalendar.jsx).
// Moved out of CutoffReview.jsx unchanged (plus segmentStartIso/segmentEndIso on segment records).
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Car, ChevronRight, CircleDot, Lock, CheckCircle2, Clock, AlertTriangle, Timer,
  Check, X, Pencil, XCircle, Zap, GitMerge, CalendarCheck, ChevronDown, Search, Loader2,
  LayoutList, AlertCircle, CalendarX, Info, FileText, RefreshCw, RotateCcw, GraduationCap,
  Plus, ShieldAlert,
} from "lucide-react";
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
import ModalPortal from "@/components/ui/modal-portal";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { fromZonedTime } from "date-fns-tz";
import { useCutoffFacePhotos } from "./cutoffFacePhotos"; // BB-141

// BB-146 — record `detail` strings are rendered as HTML (dangerouslySetInnerHTML in CutoffReview.jsx).
// Any text typed by users (e.g. leave type names) must go through escapeHtml before it's put in them,
// so it shows as text and can never run as a script.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  snap:         "Clock-in will snap to scheduled start — within the grace period.",
  late:         "Clocked in after the grace period ended. Late minutes flagged for review.",
  flag:         "This record has been flagged and needs attention.",
  ot:           "Approved overtime included. Extra hours added to total payable.",
  auto:         "System auto clock-out triggered — no manual clock-out recorded.",
  paidLeave:    "This leave day is fully paid — its hours are included in payable totals.",
  partialLeave: "Leave balance ran out mid-day — only part of this day's hours are paid and count toward payable totals.",
  unpaidLeave:  "This leave day is unpaid — no hours from it are included in payable totals.",
};

const SEGMENT_LABELS = { driver_am: "Driver AM", regular: "Regular", driver_pm: "Driver PM" };
const SEGMENT_ORDER  = { driver_am: 0, regular: 1, driver_pm: 2 };
const PUNCH_TYPE_LABELS = {
  DRIVER_AIDE:    "Driver/Aide",
  DRIVER_AIDE_AM: "Driver AM Only",
  DRIVER_AIDE_PM: "Driver PM Only",
  REGULAR:        "Regular",
  TRAINING:       "Training",
};

const formatDate = (d) => {
  if (!d) return "—";
  const [year, month, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
};

/**
 * Single source of truth for what counts as "Flagged" — a record needs attention if it's
 * unscheduled (or, when includeConflict, a conflict) or carries a tag actually classed "flag"
 * (e.g. "Left Xmin early", "Possible duplicate") — not merely informational tags like OT/late/
 * snap/auto. Conflict is opt-in since some UI (the card badge) shows conflicts as their own
 * separate red "Conflict" badge and would otherwise double up.
 */
const isRecordFlagged = (r, { includeConflict = false } = {}) => {
  const hasFlagTag = (item) => item.tags?.some((t) => t.cls === "flag");
  const itemNeedsAttention = (item, unresolvedType) =>
    !item.localStatus && (item.type === unresolvedType || (includeConflict && item.type === "conflict") || hasFlagTag(item));

  if (r.type === "driver_group") return r.segments.some((s) => !s.localStatus && hasFlagTag(s));
  if (r.type === "punch_group")  return r.punches.some((p) => itemNeedsAttention(p, "unscheduled"));
  return itemNeedsAttention(r, "unscheduled");
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

/** Classifies a leave day's pay status from its scheduled vs. actually-payable hours. */
const resolveLeavePayStatus = (payableHours, scheduledHours) => {
  if (payableHours <= 0) return "unpaid";
  if (payableHours >= scheduledHours) return "paid";
  return "partial";
};

// BB-104: B&C regular punches approve against a picked shift; with no shift on that date
// there's nothing to pick, so the Schedule button is disabled instead of doing nothing.
const NO_SHIFT_TOOLTIP = "No schedule assigned for this day. Assign a shift first, or use Approve Raw / Edit.";

// BB-105: "Left X min early" is suspended — the server's earlyMinutes reads misleadingly
// (e.g. "301.8min" with no schedule). Flip back to true once the server figure is fixed.
const SHOW_LEFT_EARLY_TAG = false;

// BB-105: "Too Early" and "Auto clock-out triggered" read inaccurately, so they were hidden.
// Display only — neither tag drives the Flagged badge or any filter. ("min late" is
// accurate and stays.)
// BB-130: "Auto clock-out triggered" is shown again in Cutoff Review only. "Too Early" stays
// hidden, and Employees Punch Logs keeps its own SHOW_AUTO_CLOCKOUT_FLAG off.
const SHOW_TOO_EARLY_TAG = false;
const SHOW_AUTO_CLOCKOUT_TAG = true;

// Records "Approve All Raw" would approve for one employee — shared by the bulk action
// and its BB-104 no-schedule confirmation so both always count the same set.
function collectBulkApprovable(emp, requiredAction) {
  const isApprovable = (r) =>
    !r.localStatus &&
    r.actions?.includes(requiredAction) &&
    !["conflict", "unscheduled"].includes(r.type);
  const out = [];
  emp.records.forEach((r) => {
    if (r.type === "driver_group") r.segments.forEach((s) => { if (isApprovable(s)) out.push(s); });
    else if (r.type === "punch_group") r.punches.forEach((p) => { if (isApprovable(p)) out.push(p); });
    else if (isApprovable(r)) out.push(r);
  });
  return out;
}

/**
 * BB-121: { [timeLogId]: { start, end } } — each punch's assigned shift times from GET /api/timelogs
 * (already loaded here for unsynced punches). /approvals sends only scheduledHours for regular punches,
 * so the Calendar page reads Staff shift times (e.g. 8:00 – 1:30) from here. customStart/EndTime wins.
 */
function buildShiftMap(rawLogs) {
  const map = {};
  (rawLogs || []).forEach((t) => {
    const list = t.userShifts?.length ? t.userShifts : t.userShift ? [t.userShift] : [];
    const us = list.find((x) => x?.shift?.shiftName?.toLowerCase().includes("regular")) || list.find((x) => x?.shift?.startTime) || null;
    const start = us?.customStartTime || us?.shift?.startTime;
    const end   = us?.customEndTime   || us?.shift?.endTime;
    if (t.id && start && end) map[t.id] = { start, end };
  });
  return map;
}

export {
  STATUS_CONFIG,
  ROW_TYPE_CONFIG,
  EXCLUDE_REASONS,
  TAG_TOOLTIPS,
  SEGMENT_LABELS,
  SEGMENT_ORDER,
  PUNCH_TYPE_LABELS,
  formatDate,
  isRecordFlagged,
  InfoTooltip,
  formatDateTime,
  toCompanyTzInput,
  fromCompanyTzInput,
  fmtShiftTime,
  enumeratePeriodDays,
  dateOnlyToLabel,
  resolveLeavePayStatus,
  NO_SHIFT_TOOLTIP,
  SHOW_LEFT_EARLY_TAG,
  SHOW_TOO_EARLY_TAG,
  SHOW_AUTO_CLOCKOUT_TAG,
  collectBulkApprovable,
};

// ─────────────────────────────────────────────────────────────────────────────
// DATA + ACTIONS HOOK
// ─────────────────────────────────────────────────────────────────────────────
export function useCutoffReview(cutoffId) {
  const { token } = useAuthStore();
  const router = useRouter();

  // BB-141: face photos per punch (timeLogId). Reloaded with the page and after approve / reset.
  const facePhotos = useCutoffFacePhotos(cutoffId, token);
  const reloadFacePhotos = facePhotos.reload;

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
  const [fixedHoursRows,         setFixedHoursRows]         = useState([]); // BB-089: GET /approvals `fixedHours`
  // BB-051: read-only — once on, an auto-resolved conflict never surfaces here as a
  // pending hasLeaveConflict row (it comes back already approved/cancelled), so this
  // is purely informational, not a gate on the Honor Punch/Honor Leave buttons below.
  const [leaveConflictAutoRevert, setLeaveConflictAutoRevert] = useState(false);
  const [gracePeriodMinutes,      setGracePeriodMinutes]      = useState(null); // BB-121: Calendar legend
  const [earlyClockInGraceMinutes, setEarlyClockInGraceMinutes] = useState(null); // BB-121: Calendar "Early Regular?"
  const [shiftByTimeLog, setShiftByTimeLog] = useState({}); // BB-121: Calendar Staff shift times (from /api/timelogs)

  // ── Local action state (optimistic UI) ──
  const [localStatus,         setLocalStatus]         = useState({}); // { [recId]: 'approved'|'excluded'|'resolved' }
  const [localApprovedTimes,  setLocalApprovedTimes]  = useState({}); // { [recId]: { timeIn, timeOut } } — snapped/edited times from PATCH response
  const [approvingIds,        setApprovingIds]        = useState(new Set()); // recIds with PATCH in flight — shows spinner in detail cell only
  const [localOTBlockStatus,  setLocalOTBlockStatus]  = useState({}); // { [blockId]: 'approved'|'excluded' }
  const [resetIds,            setResetIds]            = useState(new Set()); // recIds reset this session — overrides buildDetails "approved"
  const [localPunchType,      setLocalPunchType]      = useState({}); // { [recId]: 'TRAINING'|'REGULAR' } — optimistic punchType overrides
  const [refreshingOT,        setRefreshingOT]        = useState(false); // true while refreshOTBlocks fetch is in flight

  // BB-075: admin-assigned driver designation ({ [userId]: boolean }) — a stable value
  // fetched once per load, kept in a ref (not state) so refreshApprovals can read the
  // latest map without needing to be a Promise.all dependency or re-fetch it itself.
  const driverMapRef = useRef({});

  // ── Modals ──
  const [editModal,       setEditModal]       = useState(null); // { rec }
  const [editedClockIn,   setEditedClockIn]   = useState("");
  const [editedClockOut,  setEditedClockOut]  = useState("");
  const [editNotes,       setEditNotes]       = useState("");
  const [excludeModal,    setExcludeModal]    = useState(null); // { recId }
  const [rawConfirm,      setRawConfirm]      = useState(null); // BB-104: { recId, … } single or { empId, total, unscheduled } bulk
  const [finalizeModal,   setFinalizeModal]   = useState(false);
  const [shiftPickerModal,setShiftPickerModal]= useState(null); // { recId, shifts, usedShiftIds }
  const [usedShifts,      setUsedShifts]      = useState({});   // { [recId]: shiftId } — tracks which shift was used per approval
  const [isSaving,        setIsSaving]        = useState(false);
  const [excludeReason,   setExcludeReason]   = useState("");
  const [excludeNote,     setExcludeNote]     = useState("");
  const [fixedHoursModal, setFixedHoursModal] = useState(null); // BB-089: fixedHours row being edited
  const [fixedHoursInput, setFixedHoursInput] = useState("");
  const [fixedHoursNotes, setFixedHoursNotes] = useState("");
  const [trainingDayModal,  setTrainingDayModal]  = useState(false); // BB-095: whole-day Training dialog
  const [trainingDayDate,   setTrainingDayDate]   = useState("");
  const [trainingDaySaving, setTrainingDaySaving] = useState(null);  // "TRAINING" | "REGULAR" while in flight
  const [openEmpId,         setOpenEmpId]         = useState(null);  // BB-096: only one employee card open at a time

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
      const [cutoffRes, deptRes, approvalsRes, settingsRes, employeesRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}`,         { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/departments`,                         { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/approvals`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/company-settings/`,                   { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/employee?all=1`,                      { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [cutoffData, deptData, approvalsData, settingsData, employeesData] = await Promise.all([
        cutoffRes.ok    ? cutoffRes.json()    : { data: null },
        deptRes.ok      ? deptRes.json()      : { data: [] },
        approvalsRes.ok ? approvalsRes.json() : { data: [] },
        settingsRes.ok  ? settingsRes.json()  : { data: {} },
        employeesRes.ok ? employeesRes.json() : { data: [] },
      ]);

      // BB-075: build the stable driver-designation map from admin-assigned
      // employmentDetail.isDriver (same field/source the Employees list page reads),
      // instead of inferring it from this period's punch segmentType.
      const driverMap = {};
      (employeesData.data || []).forEach((e) => {
        if (e?.id) driverMap[e.id] = e.employmentDetail?.isDriver === true;
      });
      driverMapRef.current = driverMap;

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
      setLeaveConflictAutoRevert(settingsData.data?.leaveConflictAutoRevert === true);
      setGracePeriodMinutes(settingsData.data?.gracePeriodMinutes ?? null);
      setEarlyClockInGraceMinutes(settingsData.data?.earlyClockInGraceMinutes ?? null);
      setOtBasis(approvalsData.otBasis || null);
      setOTBlocks(approvalsData.otBlocks || []);
      setFixedHoursRows(approvalsData.fixedHours || []);
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

      setShiftByTimeLog(buildShiftMap(rawLogsData.data));

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
            hasBulkRaw: false,
            hasBulkSchedule: false,
            isDriver:  driverMap[userId] === true,
          };
        }

        const emp     = empMap[userId];
        const details = buildDetails(approval, tz, isBNCLocal);
        emp.records.push(details);
        if (details.hasOT) emp.hasOT = true;
        if (!["conflict", "unscheduled"].includes(details.type)) {
          if (details.actions?.some((a) => ["approve", "approve-schedule", "approve-raw"].includes(a))) {
            emp.hasBulkRaw = true;
          }
          // Schedule-mode bulk approve is DayCare-only — BNC's schedule-eligible records
          // (regular, non-segment punches) require a manual shift picker per row (no single
          // unambiguous matched shift), so there's nothing safely bulkable for them here.
          if (!isBNCLocal && details.actions?.includes("approve-schedule")) {
            emp.hasBulkSchedule = true;
          }
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
            hasBulkRaw: false,
            hasBulkSchedule: false,
            isDriver:  driverMap[userId] === true,
          };
        }

        const leaveScheduledHours = leaveRow.hours ?? 8;
        const leavePayableHours   = leaveRow.payableHours ?? leaveScheduledHours;
        const leavePayStatus      = resolveLeavePayStatus(leavePayableHours, leaveScheduledHours);
        const leavePayTag =
          leavePayStatus === "unpaid"  ? { cls: "unpaidLeave",  label: "Unpaid" } :
          leavePayStatus === "partial" ? { cls: "partialLeave", label: "Partially Paid" } :
                                          { cls: "paidLeave",    label: "Paid" };

        empMap[userId].records.push({
          id:           leaveRow.id,
          timeLogId:    null,
          segmentType:  null,
          date:         dateOnlyToLabel(leaveRow.leaveDate, tz),
          type:         "leave",
          detail:       `${escapeHtml(leaveRow.leave.leaveType)} — <strong>Approved</strong>`,
          tags:         [leavePayTag],
          actions:      ["pre-approved"],
          hours:        leaveScheduledHours,
          payableHours: leavePayableHours,
          payStatus:    leavePayStatus,
          scheduledHours: 0,
          scheduleInfo: null,
          hasOT:        false,
          timeIn:       "—",
          timeOut:      "—",
          localStatus:  null,
          pendingLeave: null,
        });
      });

      // BB-089: fixed-hours (SV) employees get a card even with no punches or leaves
      (approvalsData.fixedHours || []).forEach((fh) => {
        const user   = fh.user;
        const userId = fh.userId || user?.id;
        if (!userId || empMap[userId]) return;
        const initials = ((user?.profile?.firstName?.[0] || "") + (user?.profile?.lastName?.[0] || "") || user?.username?.[0] || "?").toUpperCase();
        empMap[userId] = {
          id:       userId,
          name:     `${user?.profile?.firstName || ""} ${user?.profile?.lastName || user?.username || ""}`.trim(),
          email:    user?.email || "",
          initials,
          color:    COLORS[colorIdx++ % COLORS.length],
          records:  [],
          hasOT:    false,
          hasBulkRaw: false,
          hasBulkSchedule: false,
          isDriver: driverMapRef.current[userId] === true,
        };
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
            hasBulkRaw: false,
            hasBulkSchedule: false,
          };
        }

        empMap[userId].records.push(buildUnsyncedRecord(rawLog, tz));
      });

      setEmployees(Object.values(empMap).map((emp) => ({
        ...emp,
        records: groupRecordsByDate(emp.records, ps, pe, tz),
      })));
      reloadFacePhotos(); // BB-141: not awaited; the rows show icons once it lands
    } catch (err) {
      console.error("CutoffReview fetchData:", err);
      toast.error("Failed to load review data");
    } finally {
      setIsLoading(false);
    }
  }, [token, cutoffId, reloadFacePhotos]);

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
      if (rawLogsRes.ok) setShiftByTimeLog(buildShiftMap(rawLogsData.data));

      setOTBlocks(approvalsData.otBlocks || []);
      setFixedHoursRows(approvalsData.fixedHours || []);
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
            hasBulkRaw: false,
            hasBulkSchedule: false,
            isDriver: driverMapRef.current[userId] === true,
          };
        }
        const emp     = empMap[userId];
        const details = buildDetails(approval, companyTimezone, isBNC);
        emp.records.push(details);
        if (details.hasOT) emp.hasOT = true;
        if (!["conflict", "unscheduled"].includes(details.type)) {
          if (details.actions?.some((a) => ["approve", "approve-schedule", "approve-raw"].includes(a))) emp.hasBulkRaw = true;
          if (!isBNC && details.actions?.includes("approve-schedule")) emp.hasBulkSchedule = true;
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
            hasBulkRaw: false,
            hasBulkSchedule: false,
            isDriver: driverMapRef.current[userId] === true,
          };
        }
        const leaveScheduledHours = leaveRow.hours ?? 8;
        const leavePayableHours   = leaveRow.payableHours ?? leaveScheduledHours;
        const leavePayStatus      = resolveLeavePayStatus(leavePayableHours, leaveScheduledHours);
        const leavePayTag =
          leavePayStatus === "unpaid"  ? { cls: "unpaidLeave",  label: "Unpaid" } :
          leavePayStatus === "partial" ? { cls: "partialLeave", label: "Partially Paid" } :
                                          { cls: "paidLeave",    label: "Paid" };

        empMap[userId].records.push({
          id:             leaveRow.id,
          timeLogId:      null,
          segmentType:    null,
          date:           dateOnlyToLabel(leaveRow.leaveDate, companyTimezone),
          type:           "leave",
          detail:         `${escapeHtml(leaveRow.leave.leaveType)} — <strong>Approved</strong>`,
          tags:           [leavePayTag],
          actions:        ["pre-approved"],
          hours:          leaveScheduledHours,
          payableHours:   leavePayableHours,
          payStatus:      leavePayStatus,
          scheduledHours: 0,
          scheduleInfo:   null,
          hasOT:          false,
          timeIn:         "—",
          timeOut:        "—",
          localStatus:    null,
          pendingLeave:   null,
        });
      });

      // BB-089: fixed-hours (SV) employees get a card even with no punches or leaves
      (approvalsData.fixedHours || []).forEach((fh) => {
        const user   = fh.user;
        const userId = fh.userId || user?.id;
        if (!userId || empMap[userId]) return;
        const initials = ((user?.profile?.firstName?.[0] || "") + (user?.profile?.lastName?.[0] || "") || user?.username?.[0] || "?").toUpperCase();
        empMap[userId] = {
          id:       userId,
          name:     `${user?.profile?.firstName || ""} ${user?.profile?.lastName || user?.username || ""}`.trim(),
          email:    user?.email || "",
          initials,
          color:    COLORS[colorIdx++ % COLORS.length],
          records:  [],
          hasOT:    false,
          hasBulkRaw: false,
          hasBulkSchedule: false,
          isDriver: driverMapRef.current[userId] === true,
        };
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
            hasBulkRaw: false,
            hasBulkSchedule: false,
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
      reloadFacePhotos(); // BB-141: approved → photo hidden, reset to pending → viewable again
    } catch {
      // silent — stale data stays; resolves on next full reload
    } finally {
      setApprovingIds((s) => { const n = new Set(s); n.delete(recId); return n; });
    }
  }, [token, cutoffId, companyTimezone, isBNC, cutoff, reloadFacePhotos]);

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
      detail = `<strong>Punch:</strong> ${inTime} &rarr; ${outTime} &nbsp;|&nbsp; <strong>Leave:</strong> ${escapeHtml(approval.leaveRecord.leaveType)} (${approval.leaveRecord.status === "reverted" ? "Reverted" : "Approved"})`;
    }

    // Tags
    // Resolve shift window for tag tooltips — available here before scheduleInfo block below
    const schedShiftStart = schedule?.shift?.startTime || schedule?.startTime || null;
    const schedShiftEnd   = schedule?.shift?.endTime   || schedule?.endTime   || null;
    const shiftStartStr   = schedShiftStart ? fmtShiftTime(schedShiftStart) : null;
    const shiftEndStr     = schedShiftEnd   ? fmtShiftTime(schedShiftEnd)   : null;
    const scheduledHrs    = schedule?.scheduledHours || null;

    const tags = [];
    if (SHOW_TOO_EARLY_TAG && tl.isTooEarlyPunch) tags.push({ cls: "tooEarly", label: "Too Early" });
    if (isLate && !tl.isApproved)      tags.push({ cls: "late", label: `${calc.lateMinutes}min late` });
    if (withinGrace) tags.push({ cls: "snap", label: "Within grace — snaps to schedule" });
    if (SHOW_LEFT_EARLY_TAG && leftEarly && !tl.isApproved) {
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
    if (SHOW_AUTO_CLOCKOUT_TAG && tl.autoClockOut && !tl.isApproved)  tags.push({ cls: "auto", label: "Auto clock-out triggered" });
    if (approval.isDuplicate && !tl.isApproved) tags.push({ cls: "flag", label: "Possible duplicate" });

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

    // BB-089: fixed-hours (SV) punches on a scheduled day are covered by the flat hours —
    // excluded server-side and never actionable. Off-day punches (rework) are pending
    // like any other punch and paid as OT on top of the flat hours if approved.
    const isOffDay     = approval.isFixedHoursEmployee === true && approval.isOffDay === true;
    const isFixedHours = approval.isFixedHoursEmployee === true && !isOffDay;
    if (isFixedHours) actions.length = 0;
    if (isOffDay) tags.push({ cls: "ot", label: "Off-day · OT", tooltip: "Fixed-hours employee working a day off. Paid as OT on top of the fixed hours if approved." });

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
      // BB-104: only B&C regular punches use the shift picker (DayCare and B&C segments don't)
      noShiftToPick:   isBNC && approval.segmentType == null && !(approval.availableShifts || []).length,
      // BB-104: regular punch with no schedule that day — Approve Raw asks first.
      // B&C: no shift to pick; DayCare: no scheduled shift on the approval.
      noSchedule:      approval.segmentType == null && (isBNC ? !(approval.availableShifts || []).length : !schedule),
      rawTimeIn:       tl.timeIn  || null,
      rawTimeOut:      tl.timeOut || null,
      originalTimeIn:  tl.originalTimeIn  || null,
      originalTimeOut: tl.originalTimeOut || null,
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
      // BB-121: raw window bounds (ISO) — Calendar page computes minutes past the window
      segmentStartIso:   approval.segmentStart || null,
      segmentEndIso:     approval.segmentEnd   || null,
      // BB-121: the punch's lunch ({ start, end, auto, deductible }) — Calendar deducts it like the server (BB-092)
      lunchBreak:        tl.lunchBreak || null,
      // BB-121: server's clock-in lateness vs the company grace period (Calendar colours the time)
      lateMinutes:       Number(calc.lateMinutes) || 0,
      lateStatus:        calc.lateStatus || null, // "within_grace" | "beyond_grace" | null (on time / early)
      pendingLeave:      approval.pendingLeave || null,
      noScheduleRemark,
      punchType:   tl.punchType || "REGULAR",
      isFixedHours,
      isOffDay,
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
        const driverKey = `${rec.date}::${rec.timeLogId}`;
        if (!driverGroupMap[driverKey]) {
          const group = { id: `driver-group-${driverKey}`, type: "driver_group", date: rec.date, timeLogId: rec.timeLogId, segments: [], hours: 0 };
          driverGroupMap[driverKey] = group;
          addToDate(rec.date, group);
        }
        driverGroupMap[driverKey].segments.push(rec);
        driverGroupMap[driverKey].hours += rec.hours || 0;
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
        const newDetail  = t ? `<strong>In: ${escapeHtml(newTimeIn)}</strong> &rarr; <strong>Out: ${escapeHtml(newTimeOut)}</strong>` : rec.detail;
        return { ...rec, timeIn: newTimeIn, timeOut: newTimeOut, detail: newDetail, isApproving, ...(ptOverride && { punchType: ptOverride }) };
      };

      const records = emp.records.map((r) => {
        if (r.type === "driver_group") {
          const segments = r.segments.map((s) => patchTimes({ ...s, localStatus: effectiveStatus(s.id, s.localStatus) }));
          return { ...r, segments, hours: segments.reduce((sum, s) => !s.isFixedHours && (s.localStatus === "approved" || s.localStatus === "resolved") ? sum + (s.hours || 0) : sum, 0), isApproving: segments.some((s) => s.isApproving) };
        }
        if (r.type === "punch_group") {
          const punches = r.punches.map((p) => patchTimes({ ...p, localStatus: effectiveStatus(p.id, p.localStatus) }));
          return { ...r, punches, hours: punches.reduce((sum, p) => !p.isFixedHours && (p.localStatus === "approved" || p.localStatus === "resolved") ? sum + (p.hours || 0) : sum, 0) };
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
      const leaveHours = records.filter((r) => r.type === "leave").reduce((s, r) => s + (r.payableHours ?? r.hours ?? 0), 0);
      // BB-089: SV payable is the fixed row (already includes paid leave) plus approved
      // off-day OT blocks — not punches + leaves. OT is taken from the blocks, not the
      // approved off-day punches, which carry the same hours. The fixed row counts as one
      // approved item.
      const fixedHours = fixedHoursRows.find((f) => (f.userId || f.user?.id) === emp.id) || null;
      if (fixedHours) {
        const otHours = empOTBlocks
          .filter((b) => (localOTBlockStatus[b.id] || b.status) === "approved")
          .reduce((s, b) => s + (Number(b.breakdown?.otHours ?? b.otHours) || 0), 0);
        return {
          ...emp, records, approved: approved + 1, pending, unsyncedCount,
          totalHours: (Number(fixedHours.hours) || 0) + otHours,
          punchHours: Number(fixedHours.regularHours) || 0,
          leaveHours: Number(fixedHours.leaveHours) || 0,
          otHours,
          otBlocks: empOTBlocks, fixedHours,
        };
      }
      return { ...emp, records, approved, pending, unsyncedCount, totalHours: punchHours + leaveHours, punchHours, leaveHours, otBlocks: empOTBlocks, fixedHours: null };
    });
  }, [employees, localStatus, localApprovedTimes, approvingIds, resetIds, otBlocks, localOTBlockStatus, localPunchType, fixedHoursRows]);

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

  // BB-095: punches eligible for whole-day Training designation, grouped by date across ALL
  // employees (unfiltered). Server only accepts pending REGULAR/TRAINING punches, so anything
  // approved/excluded or mid-approval is skipped here rather than sent and rejected.
  const trainingDayPunchesByDate = useMemo(() => {
    const byDate = new Map();
    const add = (empId, p) => {
      if (!p.date || p.date === "—") return;
      if (!p.actions?.includes("toggle-training") || p.localStatus || p.isApproving) return;
      if (!byDate.has(p.date)) byDate.set(p.date, { date: p.date, punches: [], employeeIds: new Set() });
      const entry = byDate.get(p.date);
      entry.punches.push(p);
      entry.employeeIds.add(empId);
    };
    for (const emp of mergedEmployees) {
      for (const r of emp.records) {
        if (r.type === "punch_group") r.punches.forEach((p) => add(emp.id, p));
        else add(emp.id, r);
      }
    }
    return byDate;
  }, [mergedEmployees]);

  // Sorted chronologically by earliest raw timeIn — the `date` key is a display label ("Oct 7").
  const trainingDayCandidates = useMemo(() =>
    [...trainingDayPunchesByDate.values()].map((e) => ({
      date:            e.date,
      sortKey:         Math.min(...e.punches.map((p) => (p.rawTimeIn ? new Date(p.rawTimeIn).getTime() : Infinity))),
      employeeCount:   e.employeeIds.size,
      regularPending:  e.punches.filter((p) => p.punchType !== "TRAINING").length,
      trainingPending: e.punches.filter((p) => p.punchType === "TRAINING").length,
    })).sort((a, b) => a.sortKey - b.sortKey),
  [trainingDayPunchesByDate]);

  // Global stats
  const globalStats = useMemo(() => {
    const totalActionable = mergedEmployees.reduce((s, e) => s + e.approved + e.pending, 0);
    const totalApproved   = mergedEmployees.reduce((s, e) => s + e.approved, 0);
    const totalPending    = mergedEmployees.reduce((s, e) => s + e.pending, 0);
    const totalHours      = mergedEmployees.reduce((s, e) => s + e.totalHours, 0);
    const totalFlagged    = mergedEmployees.filter((e) =>
      e.records.some((r) => isRecordFlagged(r, { includeConflict: true }))
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
      if (activeTab === "flagged"  && !emp.records.some((r) => isRecordFlagged(r, { includeConflict: true }))) return false;
      if (activeTab === "approved" && emp.pending > 0) return false;
      if (activeTab === "excluded" && !emp.records.some((r) => {
        if (r.type === "punch_group") return r.punches.some((p) => p.localStatus === "excluded" && !p.isFixedHours);
        return r.localStatus === "excluded" && !r.isFixedHours;
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
    { id: "flagged",  label: "Flagged",  count: mergedEmployees.filter((e) => e.records.some((r) => isRecordFlagged(r, { includeConflict: true }))).length },
    { id: "approved", label: "Approved", count: mergedEmployees.filter((e) => e.pending === 0 && e.approved > 0).length },
    { id: "excluded", label: "Excluded", count: mergedEmployees.filter((e) => e.records.some((r) => {
      if (r.type === "punch_group") return r.punches.some((p) => p.localStatus === "excluded" && !p.isFixedHours);
      return r.localStatus === "excluded" && !r.isFixedHours;
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
      // BB-105: no "Approved" toast — the row's status change is confirmation enough.
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
      // BB-125: the server's message says how many hours were returned (or asks for a
      // manual review if the revert failed) — prefer it over the generic fallback.
      const body = await res.json().catch(() => null);
      toast.success(body?.message || (choice === "punch" ? "Punch honored — leave day reverted" : "Leave honored — punch excluded"));
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
      toast.success("Record excluded");
      setExcludeModal(null);
      setExcludeReason("");
      setExcludeNote("");
      await refreshApprovals(recId);
      if (isBNC || otBasis === "cutoff") refreshOTBlocks();
    } catch {
      setLocalStatus((s) => { const n = { ...s }; delete n[recId]; return n; });
      toast.error("Failed to exclude record");
    } finally {
      setIsSaving(false);
    }
  }, [token, cutoffId, excludeModal, excludeReason, excludeNote, findRecord, refreshApprovals, isBNC, otBasis, refreshOTBlocks]);

  // BB-089: PATCH /cutoff-periods/:id/fixed-hours/:fixedHoursId — open cutoffs only
  const openFixedHoursEdit = useCallback((row) => {
    setFixedHoursModal(row);
    setFixedHoursInput(row.hours != null ? String(row.hours) : "");
    setFixedHoursNotes(row.notes || "");
  }, []);

  const confirmFixedHoursEdit = useCallback(async () => {
    if (!fixedHoursModal) return;
    const hours = Number(fixedHoursInput);
    if (fixedHoursInput.trim() === "" || !Number.isFinite(hours) || hours < 0 || hours > 999) {
      toast.error("Hours must be between 0 and 999");
      return;
    }
    setIsSaving(true);
    try {
      const body = { hours };
      if (fixedHoursNotes.trim()) body.notes = fixedHoursNotes.trim();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/fixed-hours/${fixedHoursModal.id}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to update fixed hours");
      setFixedHoursRows((rows) => rows.map((r) => (r.id === fixedHoursModal.id ? { ...r, ...data.data } : r)));
      toast.success(data.message || "Fixed hours updated");
      setFixedHoursModal(null);
    } catch (err) {
      toast.error(err.message || "Failed to update fixed hours");
    } finally {
      setIsSaving(false);
    }
  }, [token, cutoffId, fixedHoursModal, fixedHoursInput, fixedHoursNotes]);

  const doBulkApprove = useCallback(async (empId, approvalMode) => {
    const emp = mergedEmployees.find((e) => e.id === empId);
    if (!emp) return;

    const requiredAction = approvalMode === "schedule" ? "approve-schedule" : "approve-raw";
    const toApprove = collectBulkApprovable(emp, requiredAction).map((r) => ({ recId: r.id, timeLogId: r.timeLogId }));

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
          body: JSON.stringify({ action: "approve", approvalMode, timeLogIds }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Bulk approve failed");
      toast.success(`${data.data?.approved ?? toApprove.length} record(s) approved`);
      if (isBNC || otBasis === "cutoff") refreshOTBlocks();
      reloadFacePhotos(); // BB-141: approved punches hide their photos
    } catch (err) {
      setLocalStatus((s) => {
        const n = { ...s };
        recIds.forEach((id) => { delete n[id]; });
        return n;
      });
      toast.error(err.message || "Bulk approve failed");
    }
  }, [token, cutoffId, mergedEmployees, isBNC, otBasis, refreshOTBlocks, reloadFacePhotos]);

  const doBulkApproveRaw      = useCallback((empId) => doBulkApprove(empId, "raw"),      [doBulkApprove]);

  // BB-104: approving raw hours on a punch with no schedule that day asks first.
  const requestApproveRaw = useCallback((recId) => {
    const rec = findRecord(recId);
    if (!rec?.noSchedule) { doApprove(recId, { approvalMode: "raw" }); return; }
    const emp = mergedEmployees.find((e) => e.records.some((r) =>
      r.id === recId || r.punches?.some((p) => p.id === recId) || r.segments?.some((s) => s.id === recId)));
    setRawConfirm({ recId, employeeName: emp?.name || "This employee", date: rec.date, timeIn: rec.timeIn, timeOut: rec.timeOut });
  }, [findRecord, doApprove, mergedEmployees]);

  const requestBulkApproveRaw = useCallback((empId) => {
    const emp = mergedEmployees.find((e) => e.id === empId);
    if (!emp) return;
    const recs = collectBulkApprovable(emp, "approve-raw");
    const unscheduled = recs.filter((r) => r.noSchedule).length;
    if (unscheduled === 0) { doBulkApproveRaw(empId); return; }
    setRawConfirm({ empId, employeeName: emp.name, total: recs.length, unscheduled });
  }, [mergedEmployees, doBulkApproveRaw]);

  const confirmRawApproval = () => {
    if (!rawConfirm) return;
    if (rawConfirm.empId) doBulkApproveRaw(rawConfirm.empId);
    else doApprove(rawConfirm.recId, { approvalMode: "raw" });
    setRawConfirm(null);
  };
  const doBulkApproveSchedule = useCallback((empId) => doBulkApprove(empId, "schedule"), [doBulkApprove]);

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

  // BB-095: whole-day Training designation across all employees.
  // Returns { ok, failed } so the Training Day dialog knows whether to close.
  const doSetPunchTypeForDate = useCallback(async (date, targetType) => {
    // Only pending punches not already at the target type — the server rejects anything else
    const targets = (trainingDayPunchesByDate.get(date)?.punches ?? [])
      .filter((p) => (targetType === "TRAINING") !== (p.punchType === "TRAINING"));
    if (targets.length === 0) {
      toast.info("No eligible punches on this date to update");
      return { ok: 0, failed: 0 };
    }

    // Optimistic update — remember previous overrides so failed ones can be restored individually
    const prevOverrides = Object.fromEntries(targets.map((r) => [r.id, localPunchType[r.id]]));
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

    // Successful PATCHes are already persisted server-side — roll back only the ones that failed
    const failedIds = targets.filter((_, i) => results[i].status === "rejected").map((r) => r.id);
    const failed = failedIds.length;
    const ok     = targets.length - failed;
    if (failed > 0) {
      setLocalPunchType((s) => {
        const n = { ...s };
        failedIds.forEach((id) => {
          if (prevOverrides[id] != null) n[id] = prevOverrides[id]; else delete n[id];
        });
        return n;
      });
    }

    const label   = targetType === "TRAINING" ? "marked as Training" : "reset to Regular";
    const punches = (n) => `${n} ${n === 1 ? "punch" : "punches"}`;
    if (ok === 0)        toast.error(`Failed to update ${punches(failed)} on ${date} — no changes saved`);
    else if (failed > 0) toast.warning(`${ok} of ${punches(targets.length)} on ${date} ${label} — ${failed} failed`);
    else                 toast.success(`${punches(ok)} on ${date} ${label}`);

    // Refresh when the server auto-excluded DA segments, or when a partial failure may have
    // left local state out of sync with the server
    const anyExcluded = targetType === "TRAINING" && results.some(
      (r) => r.status === "fulfilled" && (r.value?.data?.excludedSegmentCount ?? 0) > 0
    );
    if (anyExcluded || (failed > 0 && ok > 0)) await refreshApprovals(targets[0]?.id);

    return { ok, failed };
  }, [token, cutoffId, trainingDayPunchesByDate, localPunchType, refreshApprovals]);

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

  return {
    cutoffId,
    token,
    router,
    facePhotos, // BB-141
    cutoff,
    setCutoff,
    departments,
    setDepartments,
    employees,
    setEmployees,
    isLoading,
    setIsLoading,
    syncing,
    setSyncing,
    companyTimezone,
    setCompanyTimezone,
    isBNC,
    setIsBNC,
    otBasis,
    setOtBasis,
    otBlocks,
    setOTBlocks,
    dailyOtThresholdHours,
    setDailyOtThresholdHours,
    cutoffOtThresholdHours,
    setCutoffOtThresholdHours,
    fixedHoursRows,
    setFixedHoursRows,
    gracePeriodMinutes,
    earlyClockInGraceMinutes,
    shiftByTimeLog,
    leaveConflictAutoRevert,
    setLeaveConflictAutoRevert,
    localStatus,
    setLocalStatus,
    localApprovedTimes,
    setLocalApprovedTimes,
    approvingIds,
    setApprovingIds,
    localOTBlockStatus,
    setLocalOTBlockStatus,
    resetIds,
    setResetIds,
    localPunchType,
    setLocalPunchType,
    refreshingOT,
    setRefreshingOT,
    driverMapRef,
    editModal,
    setEditModal,
    editedClockIn,
    setEditedClockIn,
    editedClockOut,
    setEditedClockOut,
    editNotes,
    setEditNotes,
    excludeModal,
    setExcludeModal,
    rawConfirm,
    setRawConfirm,
    finalizeModal,
    setFinalizeModal,
    shiftPickerModal,
    setShiftPickerModal,
    usedShifts,
    setUsedShifts,
    isSaving,
    setIsSaving,
    excludeReason,
    setExcludeReason,
    excludeNote,
    setExcludeNote,
    fixedHoursModal,
    setFixedHoursModal,
    fixedHoursInput,
    setFixedHoursInput,
    fixedHoursNotes,
    setFixedHoursNotes,
    trainingDayModal,
    setTrainingDayModal,
    trainingDayDate,
    setTrainingDayDate,
    trainingDaySaving,
    setTrainingDaySaving,
    openEmpId,
    setOpenEmpId,
    activeTab,
    setActiveTab,
    search,
    setSearch,
    chips,
    setChips,
    fetchData,
    refreshOTBlocks,
    refreshApprovals,
    doSync,
    buildDetails,
    buildUnsyncedRecord,
    groupRecordsByDate,
    mergedEmployees,
    trainingDates,
    trainingDayPunchesByDate,
    trainingDayCandidates,
    globalStats,
    filteredEmployees,
    tabs,
    getDepartmentName,
    findRecord,
    doApprove,
    handleApproveSchedule,
    doConflict,
    confirmExclude,
    openFixedHoursEdit,
    confirmFixedHoursEdit,
    doBulkApprove,
    doBulkApproveRaw,
    requestApproveRaw,
    requestBulkApproveRaw,
    confirmRawApproval,
    doBulkApproveSchedule,
    doOTBlock,
    doReset,
    doSetPunchType,
    doSetPunchTypeForDate,
    confirmFinalize,
    finalizeReady,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
export function SyncOverlay({ syncing }) {
  return (
    <>
      {/* ── Sync overlay — blocks all interaction while sync + re-fetch is in flight ── */}
      {/* Portaled to document.body so `fixed inset-0` centers on the actual viewport
          instead of DashboardLayoutClient's transformed (framer-motion `y`) content wrapper. */}
      <ModalPortal>
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
      </ModalPortal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DIALOGS — Edit, Exclude, Fixed hours, Training day, Shift picker, Raw confirm, Finalize
// ─────────────────────────────────────────────────────────────────────────────
// skip: dialogs a page renders itself (Calendar page: ["exclude"])
export function CutoffReviewDialogs({ r, skip = [] }) {
  const {
    token,
    router,
    cutoff,
    setCutoff,
    departments,
    setDepartments,
    employees,
    setEmployees,
    isLoading,
    setIsLoading,
    syncing,
    setSyncing,
    companyTimezone,
    setCompanyTimezone,
    isBNC,
    setIsBNC,
    otBasis,
    setOtBasis,
    otBlocks,
    setOTBlocks,
    dailyOtThresholdHours,
    setDailyOtThresholdHours,
    cutoffOtThresholdHours,
    setCutoffOtThresholdHours,
    fixedHoursRows,
    setFixedHoursRows,
    leaveConflictAutoRevert,
    setLeaveConflictAutoRevert,
    localStatus,
    setLocalStatus,
    localApprovedTimes,
    setLocalApprovedTimes,
    approvingIds,
    setApprovingIds,
    localOTBlockStatus,
    setLocalOTBlockStatus,
    resetIds,
    setResetIds,
    localPunchType,
    setLocalPunchType,
    refreshingOT,
    setRefreshingOT,
    driverMapRef,
    editModal,
    setEditModal,
    editedClockIn,
    setEditedClockIn,
    editedClockOut,
    setEditedClockOut,
    editNotes,
    setEditNotes,
    excludeModal,
    setExcludeModal,
    rawConfirm,
    setRawConfirm,
    finalizeModal,
    setFinalizeModal,
    shiftPickerModal,
    setShiftPickerModal,
    usedShifts,
    setUsedShifts,
    isSaving,
    setIsSaving,
    excludeReason,
    setExcludeReason,
    excludeNote,
    setExcludeNote,
    fixedHoursModal,
    setFixedHoursModal,
    fixedHoursInput,
    setFixedHoursInput,
    fixedHoursNotes,
    setFixedHoursNotes,
    trainingDayModal,
    setTrainingDayModal,
    trainingDayDate,
    setTrainingDayDate,
    trainingDaySaving,
    setTrainingDaySaving,
    openEmpId,
    setOpenEmpId,
    activeTab,
    setActiveTab,
    search,
    setSearch,
    chips,
    setChips,
    fetchData,
    refreshOTBlocks,
    refreshApprovals,
    doSync,
    buildDetails,
    buildUnsyncedRecord,
    groupRecordsByDate,
    mergedEmployees,
    trainingDates,
    trainingDayPunchesByDate,
    trainingDayCandidates,
    globalStats,
    filteredEmployees,
    tabs,
    getDepartmentName,
    findRecord,
    doApprove,
    handleApproveSchedule,
    doConflict,
    confirmExclude,
    openFixedHoursEdit,
    confirmFixedHoursEdit,
    doBulkApprove,
    doBulkApproveRaw,
    requestApproveRaw,
    requestBulkApproveRaw,
    confirmRawApproval,
    doBulkApproveSchedule,
    doOTBlock,
    doReset,
    doSetPunchType,
    doSetPunchTypeForDate,
    confirmFinalize,
    finalizeReady,
  } = r;
  return (
    <>
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
      <Dialog open={!!excludeModal && !skip.includes("exclude")} onOpenChange={() => setExcludeModal(null)}>
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

      {/* ── Fixed Hours Edit Modal (BB-089) ── */}
      <Dialog open={!!fixedHoursModal} onOpenChange={(v) => !v && !isSaving && setFixedHoursModal(null)}>
        <DialogContent className="w-[90vw] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-blue-500" /> Edit Fixed Hours
            </DialogTitle>
            <DialogDescription>
              Set this employee's hours for this cutoff. Paid leave is included in this total.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Hours *</Label>
              <Input
                type="number" min="0" max="999" step="0.5"
                className="font-mono"
                value={fixedHoursInput}
                onChange={(e) => setFixedHoursInput(e.target.value)}
              />
              <p className="text-[11px] text-neutral-400">Between 0 and 999.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Notes (optional)</Label>
              <Input
                placeholder="e.g. Hired mid-cutoff"
                value={fixedHoursNotes}
                onChange={(e) => setFixedHoursNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFixedHoursModal(null)} disabled={isSaving}>Cancel</Button>
              <Button
                className="gap-2 bg-blue-500 hover:bg-blue-600 text-white"
                onClick={confirmFixedHoursEdit}
                disabled={isSaving || fixedHoursInput.trim() === ""}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Training Day Modal (BB-095) — whole-day Training designation across all employees ── */}
      {(() => {
        const sel = trainingDayCandidates.find((c) => c.date === trainingDayDate) || null;
        const run = async (targetType) => {
          setTrainingDaySaving(targetType);
          const res = await doSetPunchTypeForDate(trainingDayDate, targetType);
          setTrainingDaySaving(null);
          if (res && res.failed === 0 && res.ok > 0) setTrainingDayModal(false);
        };
        return (
          <Dialog open={trainingDayModal} onOpenChange={(v) => !v && !trainingDaySaving && setTrainingDayModal(false)}>
            <DialogContent className="w-[90vw] sm:max-w-[500px] grid-cols-[minmax(0,1fr)]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-amber-500" /> Training Day
                </DialogTitle>
                <DialogDescription>
                  Apply the Training punch type to every employee who punched on a date. Only pending punches are updated.
                </DialogDescription>
              </DialogHeader>
              <div className="min-w-0 space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Date *</Label>
                  <Select value={trainingDayDate} onValueChange={setTrainingDayDate} disabled={!!trainingDaySaving}>
                    <SelectTrigger><SelectValue placeholder="Select a date..." /></SelectTrigger>
                    <SelectContent>
                      {trainingDayCandidates.map((c) => (
                        <SelectItem key={c.date} value={c.date}>
                          <span className="flex items-center gap-2">
                            {c.date}
                            {trainingDates.has(c.date) && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                <GraduationCap className="w-2.5 h-2.5" /> Training Day
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {sel && (
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 px-3 py-2.5 text-xs text-neutral-600 dark:text-neutral-300 space-y-1">
                    <p><span className="font-semibold">{sel.employeeCount}</span> {sel.employeeCount === 1 ? "employee" : "employees"} with pending punches on {sel.date}</p>
                    <p>
                      <span className="font-semibold">{sel.regularPending}</span> Regular ·{" "}
                      <span className={`font-semibold ${sel.trainingPending > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{sel.trainingPending}</span> Training
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Marking as Training also auto-excludes pending driver/aide segments for those employees on that day.
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setTrainingDayModal(false)} disabled={!!trainingDaySaving}>Cancel</Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => run("REGULAR")}
                    disabled={!!trainingDaySaving || !sel || sel.trainingPending === 0}
                  >
                    {trainingDaySaving === "REGULAR" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    Revert to Regular{sel?.trainingPending ? ` (${sel.trainingPending})` : ""}
                  </Button>
                  <Button
                    className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={() => run("TRAINING")}
                    disabled={!!trainingDaySaving || !sel || sel.regularPending === 0}
                  >
                    {trainingDaySaving === "TRAINING" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
                    Mark as Training{sel?.regularPending ? ` (${sel.regularPending})` : ""}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

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

      {/* ── BB-104: Approve Raw with no schedule — confirmation ── */}
      <Dialog open={!!rawConfirm} onOpenChange={(v) => !v && setRawConfirm(null)}>
        <DialogContent className="w-[90vw] sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Approve raw hours without a schedule?
            </DialogTitle>
            <DialogDescription>
              {rawConfirm?.empId
                ? `${rawConfirm.unscheduled} of the ${rawConfirm.total} punches for ${rawConfirm.employeeName} have no shift assigned for their day. They'll be approved as recorded, with no schedule to snap to.`
                : `${rawConfirm?.employeeName} has no shift assigned for this day. The punch will be approved as recorded, with no schedule to snap to.`}
            </DialogDescription>
          </DialogHeader>
          {rawConfirm && !rawConfirm.empId && (
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-1.5">{rawConfirm.employeeName} · {rawConfirm.date}</p>
              <p className="font-mono text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                {rawConfirm.timeIn} → {rawConfirm.timeOut}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRawConfirm(null)}>Cancel</Button>
            <Button onClick={confirmRawApproval} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Clock className="w-4 h-4 mr-1.5" />
              {rawConfirm?.empId ? `Approve All ${rawConfirm.total} Raw` : "Approve Raw Hours"}
            </Button>
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
    </>
  );
}
