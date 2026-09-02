/* components/Dashboard/DashboardContent/TimeKeeping/PunchLogs.jsx */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Clock,
  Calendar,
  Download,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Send,
  FileText,
  ChevronsLeft,
  ChevronsRight,
  MapPin,
  AlertTriangle,
  User,
  AlertCircle,
  AlarmClockPlus,
  Car,
  UserCheck,
  CheckCircle,
  XCircle,
  TrendingUp,
  LayoutTemplate,
  Plus,
  Check,
  Info,
  LogIn,
  LogOut,
  ArrowLeft,
  ArrowRight,
  X,
  Coffee,
  MapPin as MapPinIcon,
  SlidersHorizontal,
  Flag,
  TimerOff,
  BarChart3,
  GraduationCap,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import useAuthStore from "@/store/useAuthStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import TableSkeleton from "@/components/common/TableSkeleton";
import CutoffDateRangeFilter, { periodRangeKey } from "@/components/common/CutoffDateRangeFilter";
import { Skeleton } from "@/components/ui/skeleton";
import { ContestDialog } from "./ContestDialog";
import FormDialog from "@/components/common/FormDialog";
import OrangeLoadingSpinner from "@/components/common/Spinner";
import MultiSelect from "@/components/common/MultiSelect";

// ── Constants ──────────────────────────────────────────────────────────────────
const DAYCARE_COMPANY_IDS = (process.env.NEXT_PUBLIC_DAYCARE_COMPANY_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const DRIVER_AIDE_AM_HOURS = 1.25;
const DRIVER_AIDE_PM_HOURS = 1.25;

// ── Utility helpers ────────────────────────────────────────────────────────────
const MAX_DEV_CHARS = 15;
const truncate = (s = "", L = MAX_DEV_CHARS) => (s.length > L ? s.slice(0, L) + "…" : s);
export const safeDate = (d, tz) =>
  d
    ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", ...(tz ? { timeZone: tz } : {}) })
    : "—";
export const safeTime = (d, tz) =>
  d ? new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, ...(tz ? { timeZone: tz } : {}) }) : "—";
export const safeDateTime = (d, tz) => (d ? `${safeDate(d, tz)} ${safeTime(d, tz)}` : "—");
const getTimezoneName = (tz) => { const p = (tz || "UTC").split("/"); return p[p.length - 1].replace(/_/g, " "); };
const getTzAbbr = (d, tz) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(d));
    return parts.find((p) => p.type === "timeZoneName")?.value || tz;
  } catch { return tz; }
};
/** Extract YYYY-MM-DD in the given timezone (avoids UTC-slice bugs) */
const toLocalDateStr = (d, tz) => d ? new Date(d).toLocaleDateString("en-CA", { timeZone: tz || "UTC" }) : null;
/** Convert an ISO timestamp to minutes-since-midnight in the given timezone */
const toLocalMinutes = (isoStr, tz) => {
  if (!isoStr) return -1;
  const str = new Date(isoStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz || "UTC" });
  if (str === "24:00") return 0;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + (m || 0);
};
const toHour    = (m) => (m / 60).toFixed(2);
const diffMins  = (a, b) => (new Date(b) - new Date(a)) / 60000;
const rawDuration = (tin, tout) => (!tin || !tout ? "—" : toHour(diffMins(tin, tout)));

// ── NULL-SAFE break helpers ────────────────────────────────────────────────────
export const coffeeMinutes = (arr) => {
  const safe = Array.isArray(arr) ? arr : [];
  return toHour(safe.reduce((m, b) => (b.start && b.end ? m + diffMins(b.start, b.end) : m), 0));
};
export const lunchMinutesStr = (l) => (!l || !l.start || !l.end ? "0.00" : toHour(diffMins(l.start, l.end)));
export const lunchMinutesNum = (l) => (!l || !l.start || !l.end ? 0 : diffMins(l.start, l.end));

const deepParse = (v) => {
  if (typeof v === "string" && /^\s*[{[]/.test(v)) {
    try { return deepParse(JSON.parse(v)); } catch { return v; }
  }
  if (Array.isArray(v)) return v.map(deepParse);
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = deepParse(val);
    return o;
  }
  return v;
};

const findProp = (obj, names, depth = 0) => {
  if (obj == null || depth > 8) return null;
  if (Array.isArray(obj)) {
    for (const el of obj) { const r = findProp(el, names, depth + 1); if (r != null) return r; }
    return null;
  }
  if (typeof obj === "object") {
    for (const n of names) if (obj[n] != null) return obj[n];
    for (const v of Object.values(obj)) { const r = findProp(v, names, depth + 1); if (r != null) return r; }
  }
  return null;
};

const DEV_IN_KEYS  = ["deviceIn",  "deviceInfoStart", "deviceStart",  "deviceInfoIn"];
const DEV_OUT_KEYS = ["deviceOut", "deviceInfoEnd",   "deviceEnd",    "deviceInfoOut"];
const LOC_IN_KEYS  = ["locIn",  "locationIn",  "locationStart", "locStart"];
const LOC_OUT_KEYS = ["locOut", "locationOut", "locationEnd",   "locEnd"];
const firstField = (log, keys) => keys.map((k) => log[k]).find(Boolean);
const chooseStartEnd = (log, dir, base) => (dir === "in" ? log?.[base]?.start : log?.[base]?.end);

const getDevice = (log, dir) => {
  let obj = firstField(log, dir === "in" ? DEV_IN_KEYS : DEV_OUT_KEYS);
  if (!obj) obj = chooseStartEnd(log, dir, "deviceInfo");
  if (!obj) return "—";
  obj = deepParse(obj);
  if (typeof obj === "string") return obj;
  const brand = findProp(obj, ["manufacturer", "brand"]);
  const name  = findProp(obj, ["deviceName",   "model"]);
  return [brand, name].filter(Boolean).join(", ") || JSON.stringify(obj);
};

const getLocation = (log, dir) => {
  let obj = firstField(log, dir === "in" ? LOC_IN_KEYS : LOC_OUT_KEYS);
  if (!obj) obj = chooseStartEnd(log, dir, "location");
  if (!obj) return { txt: "—", lat: null, lng: null };
  obj = deepParse(obj);
  if (typeof obj === "string") {
    const [latS, lngS] = obj.split(/[, ]+/);
    const lat = +latS, lng = +lngS;
    return isFinite(lat) && isFinite(lng)
      ? { txt: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng }
      : { txt: obj, lat: null, lng: null };
  }
  const lat = findProp(obj, ["latitude",  "lat"]);
  const lng = findProp(obj, ["longitude", "lng"]);
  return lat != null && lng != null
    ? { txt: `${(+lat).toFixed(5)}, ${(+lng).toFixed(5)}`, lat: +lat, lng: +lng }
    : { txt: "—", lat: null, lng: null };
};

const NUM2DAY = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const parseRRuleDays = (str) => { const m = str.match(/BYDAY=([^;]+)/i); return m ? m[1].split(",") : []; };
const fmtUTCTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const getDefaultFrom = (tz = "UTC") => new Date().toLocaleDateString("en-CA", { timeZone: tz }).slice(0, 7) + "-01";
const getDefaultTo   = (tz = "UTC") => new Date().toLocaleDateString("en-CA", { timeZone: tz });

// ── FIX 1: PunchTypeBadge — supports all 4 punch types ────────────────────────
function PunchTypeBadge({ punchType, size = "sm" }) {
  if (!punchType) return null;

  const config = {
    DRIVER_AIDE:    { label: "Driver/Aide", icon: Car,            color: "blue"   },
    DRIVER_AIDE_AM: { label: "Driver AM",   icon: Car,            color: "blue"   },
    DRIVER_AIDE_PM: { label: "Driver PM",   icon: Car,            color: "blue"   },
    REGULAR:        { label: "Regular",     icon: UserCheck,      color: "purple" },
    TRAINING:       { label: "Training",    icon: GraduationCap,  color: "green"  },
  };

  const meta = config[punchType] ?? config.REGULAR;
  const Icon = meta.icon;
  const colorClass =
    meta.color === "blue"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
      : meta.color === "green"
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
      : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
      size === "sm" ? "text-xs" : "text-sm"
    } ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

// ── V3CutoffBadge (table cell — soft rectangular) ─────────────────────────────
function V3CutoffBadge({ cutoffApproval }) {
  if (!cutoffApproval) return <span className="text-muted-foreground text-sm">—</span>;
  const { status } = cutoffApproval;
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle className="h-3 w-3" />Approved
      </span>
    );
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <Clock className="h-3 w-3" />Awaiting
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <XCircle className="h-3 w-3" />Rejected
      </span>
    );
  return <span className="text-muted-foreground text-sm">—</span>;
}

// ── V3CutoffBox (side-panel block) ────────────────────────────────────────────
function V3CutoffBox({ cutoffApproval }) {
  if (!cutoffApproval)
    return <p className="text-xs text-muted-foreground">Not included in any cutoff period yet.</p>;
  const { status, cutoffPeriod } = cutoffApproval;
  const range = cutoffPeriod
    ? `${new Date(cutoffPeriod.periodStart).toLocaleDateString()} – ${new Date(cutoffPeriod.periodEnd).toLocaleDateString()}`
    : null;
  return (
    <div className="space-y-1.5">
      <V3CutoffBadge cutoffApproval={cutoffApproval} />
      {range && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Cutoff</span>
          <span className="text-xs">{range}</span>
        </div>
      )}
      {cutoffPeriod?.status && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Period</span>
          <span className="text-xs capitalize">{cutoffPeriod.status}</span>
        </div>
      )}
    </div>
  );
}

// ── AutoBreakBadge ─────────────────────────────────────────────────────────────
const AutoBreakBadge = ({ deductible }) => (
  <span className={`text-[9px] font-semibold px-1 py-0.5 rounded border leading-none ${
    deductible
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-green-100 text-green-700 border-green-200"
  }`}>
    {deductible ? "Auto · Deducted" : "Auto · Paid"}
  </span>
);

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PunchLogs() {
  const { token, user } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [companyId, setCompanyId] = useState(user?.companyId ?? null);
  const isDayCare = DAYCARE_COMPANY_IDS.includes(companyId);
  // Request Punch shift-type picker uses the API-driven signal (not the env-var list above)
  // per BB-065 follow-up: don't hardcode a company-id list for Driver/Aide gating.
  const [isDayCareCompany, setIsDayCareCompany] = useState(false);

  const [logs,       setLogs]       = useState([]);
  const [smartLogs,  setSmartLogs]  = useState([]);
  const [viewMode,   setViewMode]   = useState("all");
  const [defaultHours,  setDefaultHours]  = useState(8);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting,  setExporting]  = useState(false);

  const [otDialogOpen,  setOtDialogOpen]  = useState(false);
  const [otForLog,      setOtForLog]      = useState(null);
  const [otApprover,    setOtApprover]    = useState("");
  const [otReason,      setOtReason]      = useState("");
  const [otHoursEdit,   setOtHoursEdit]   = useState("");
  const [otSubmitting,  setOtSubmitting]  = useState(false);
  const [otBasis,            setOtBasis]            = useState("daily");
  const [dailyOtThreshold,   setDailyOtThreshold]   = useState(8);
  const [weeklyOtThreshold,  setWeeklyOtThreshold]  = useState(40);
  const [cutoffOtThreshold,  setCutoffOtThreshold]  = useState(80);
  const [employeeDeptId,     setEmployeeDeptId]      = useState(null);
  const [employeeDeptName,   setEmployeeDeptName]    = useState(null);
  const [cutoffPeriods,      setCutoffPeriods]       = useState([]);
  const [selectedCutoffId,   setSelectedCutoffId]    = useState("all");

  // Derived from cutoffPeriods (fetched alongside employment details) instead of its
  // own /api/cutoff-periods?status=open round-trip — same data, one fewer request.
  const activeCutoffPeriod = useMemo(() => {
    if (otBasis !== "cutoff" || !employeeDeptId) return null;
    const p = cutoffPeriods.find((cp) => cp.status === "open" && cp.departmentId === employeeDeptId);
    return p ? { id: p.id, periodStart: p.periodStart, periodEnd: p.periodEnd } : null;
  }, [cutoffPeriods, employeeDeptId, otBasis]);

  const [contestDialogOpen,         setContestDialogOpen]         = useState(false);
  const [contestLogId,              setContestLogId]              = useState("");
  const [contestApproverId,         setContestApproverId]         = useState("");
  const [contestReason,             setContestReason]             = useState("");
  const [contestDescription,        setContestDescription]        = useState("");
  const [contestRequestedClockIn,   setContestRequestedClockIn]   = useState("");
  const [contestRequestedClockOut,  setContestRequestedClockOut]  = useState("");
  const [contestSubmitting,         setContestSubmitting]         = useState(false);
  const [contestErrors,             setContestErrors]             = useState({});

  const [approvers,       setApprovers]       = useState([]);
  const [schedDialogOpen, setSchedDialogOpen] = useState(false);
  const [schedForDialog,  setSchedForDialog]  = useState([]);
  const [locDialogOpen,   setLocDialogOpen]   = useState(false);
  const [locDialogList,   setLocDialogList]   = useState([]);
  const [thresholdStatus, setThresholdStatus] = useState(null);
  const [otSelectedLogId, setOtSelectedLogId] = useState(null);
  const [supervisors,     setSupervisors]     = useState([]);
  const approverOptions = useMemo(() => {
    const supervisorIds = new Set(supervisors.map((s) => s.id));
    return { supervisors, approvers: approvers.filter((a) => !supervisorIds.has(a.id)) };
  }, [supervisors, approvers]);
  const [myRequests,      setMyRequests]      = useState([]);
  const [requestsV2Expanded,  setRequestsV2Expanded]  = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // V3 table — selected row for side detail panel
  const [selectedLogV3, setSelectedLogV3] = useState(null);

  const [totalPages,       setTotalPages]       = useState(1);
  const [locList,          setLocList]          = useState([]);
  const [userShifts,       setUserShifts]       = useState([]);
  const [companyTimezone,  setCompanyTimezone]  = useState("UTC");
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const tzInitialized = useRef(false);
  const [queryParams,   setQueryParams]   = useState({ from: getDefaultFrom(), to: getDefaultTo(), status: "all", punchType: "all", page: 1, limit: 10 });
  const [pendingDates,  setPendingDates]  = useState({ from: getDefaultFrom(), to: getDefaultTo() });
  const [serverSummary, setServerSummary] = useState({ total: 0, active: 0, completed: 0, totalHours: "0.00" });

  const [requestPunchLogsDialog, setRequestPunchLogsDialog] = useState(false);
  const [requestPunchDate,       setRequestPunchDate]       = useState("");
  const [requestClockIn,         setRequestClockIn]         = useState("");
  const [requestClockOut,        setRequestClockOut]        = useState("");
  const [requestPunchType,       setRequestPunchType]       = useState("REGULAR");
  const [requestApproverId,      setRequestApproverId]      = useState("");
  const [requestReason,          setRequestReason]          = useState("");
  const [requestDescription,     setRequestDescription]     = useState("");
  const [requestSubmitting,      setRequestSubmitting]      = useState(false);
  const [requestErrors,          setRequestErrors]          = useState({});
  const [requestStep,            setRequestStep]            = useState(1);
  const [isCheckingConflict,     setIsCheckingConflict]     = useState(false);

  // BB-080 — supervisor/admin filing a request on behalf of an employee
  const [requestOnBehalfMode,    setRequestOnBehalfMode]    = useState(false);
  const [requestTargetUserId,    setRequestTargetUserId]    = useState("");
  const [teamEmployees,          setTeamEmployees]          = useState([]);
  const [loadingTeamEmployees,   setLoadingTeamEmployees]   = useState(false);
  // useAuthStore().user is only the decoded JWT (userId/companyId/exp) — it does not
  // reliably carry role. Every other role-gated view in this codebase (sidebar.jsx,
  // UserMenu.jsx, EmployeesPunchLogs.jsx) fetches the live role from /api/account/profile
  // instead, so we do the same here rather than trust user?.role.
  const [currentUserRole,        setCurrentUserRole]        = useState("");

  // filters removed — now driven by queryParams (server-side)

  const isValidTimeFormat = (t) => /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/.test(t);
  const convertTimeToDecimal = (t) => {
    if (!isValidTimeFormat(t)) return 0;
    const [h, m] = t.split(":").map(Number);
    return h + m / 60;
  };

  const [cutoffStatusFilter, setCutoffStatusFilter] = useState("all");

  const [sortConfig, setSortConfig] = useState({ key: "timeRange", direction: "descending" });
  const requestSort = (k) =>
    setSortConfig((p) => ({
      key: k,
      direction: p.key === k && p.direction === "ascending" ? "descending" : "ascending",
    }));

  // ── Fetch helpers ────────────────────────────────────────────────────────────
  // GET /api/punch-logs/bootstrap replaces 6 separate mount-time requests — company
  // settings, employment details (+ cutoffPeriods, per BB-044), approvers, supervisors,
  // locations, and pending requests — with one round-trip. usershifts and
  // overtime/threshold-status stay as their own calls (see notes below); they're either
  // synced to the active date-range filter or live/computed, not load-once.
  const fetchBootstrap = useCallback(async () => {
    if (!token) return;
    setLoadingRequests(true);
    try {
      const res = await fetch(`${API_URL}/api/punch-logs/bootstrap`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (!res.ok) return;
      const d = j.data || {};

      const cs = d.companySettings || {};
      setDefaultHours(cs.defaultShiftHours ?? 8);
      if (cs.id) setCompanyId(cs.id);
      setOtBasis(cs.otBasis ?? "daily");
      setDailyOtThreshold(parseFloat(cs.dailyOtThresholdHours   ?? 8));
      setWeeklyOtThreshold(parseFloat(cs.weeklyOtThresholdHours ?? 40));
      setCutoffOtThreshold(parseFloat(cs.cutoffOtThresholdHours ?? 80));
      // ── Timezone — reset date defaults once with correct tz ─
      const tz = cs.timezone || "America/Los_Angeles";
      setCompanyTimezone(tz);
      if (!tzInitialized.current) {
        tzInitialized.current = true;
        const from = getDefaultFrom(tz);
        const to   = getDefaultTo(tz);
        setPendingDates({ from, to });
        setQueryParams((p) => ({ ...p, from, to, page: 1 }));
      }

      const emp = d.employmentDetails || {};
      setEmployeeDeptId(emp.departmentId || emp.department?.id || null);
      setEmployeeDeptName(emp.department?.name || null);
      setCutoffPeriods((d.cutoffPeriods || []).sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart)));

      setApprovers((d.approvers || []).filter((u) => ["admin", "superadmin"].includes((u.role || "").toLowerCase())));
      setSupervisors((d.supervisors || []).map((s) => ({
        id: s.id,
        name: s.name,
        department: s.jobTitle || s.role,
        role: s.role,
      })));

      setLocList(d.locations || []);

      const requests = d.pendingRequests || [];
      setMyRequests(requests);
      setRequestsExpanded(requests.some((r) => r.status === "PENDING"));
    } catch {
      setDefaultHours(8);
    } finally {
      setLoadingRequests(false);
    }
  }, [API_URL, token]);

  const fetchSmartDetectsOT = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      toast.message("Loading smart overtime logs...");
      const params = new URLSearchParams({ otBasis });
      if (otBasis === "daily")        params.set("threshold", dailyOtThreshold);
      else if (otBasis === "weekly")  params.set("threshold", weeklyOtThreshold);
      else if (otBasis === "cutoff") {
        params.set("threshold", cutoffOtThreshold);
        if (activeCutoffPeriod?.periodStart) params.set("periodStart", activeCutoffPeriod.periodStart);
        if (activeCutoffPeriod?.periodEnd)   params.set("periodEnd",   activeCutoffPeriod.periodEnd);
      }
      const res = await fetch(`${API_URL}/api/overtime/smart-detect?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok && Array.isArray(j.data)) {
        const transformed = j.data.map((d) => ({
          id: d.timeLogId,
          timeIn: d.actualStart,
          timeOut: d.actualEnd,
          duration: (d.elapsedMins / 60).toFixed(2),
          otHours: d.overtimeHours.toString(),
          otStatus: "Detected",
          status: false,
          coffeeMins: "0.00",
          lunchMins:  "0.00",
          _lunchNum: 0,
          coffeeBreaks: [],
          lunchBreak: null,
          overtime: [],
          punchType: "REGULAR",
          _smartDetection: {
            type: d.type,
            scheduledStart: d.scheduledStart,
            scheduledEnd: d.scheduledEnd,
            detectedAt: d.detectedAt,
            employeeName: d.employeeName,
            department: d.department,
          },
        }));
        setSmartLogs(transformed);
        toast.success(transformed.length ? `${transformed.length} OT log(s) detected!` : "No potential overtime detected.");
      } else {
        toast.error(j.message || "Failed to detect overtime");
      }
    } catch {
      toast.error("Failed to run smart overtime detection");
    } finally {
      setLoading(false);
    }
  }, [API_URL, token, otBasis, dailyOtThreshold, weeklyOtThreshold, cutoffOtThreshold, activeCutoffPeriod]);

  // Kept standalone (not part of the bootstrap) for the one place that needs a
  // targeted refresh of just this list — right after submitting a new punch-log
  // request — without re-fetching company settings/approvers/locations/etc. again.
  const fetchMyRequests = useCallback(async () => {
    if (!token) return;
    setLoadingRequests(true);
    try {
      const res = await fetch(`${API_URL}/api/request-punch-log/my-requests?limit=10&status=PENDING`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok) {
        const requests = j.data?.requests || [];
        setMyRequests(requests);
        setRequestsExpanded(requests.some((r) => r.status === "PENDING"));
      }
    } catch {}
    finally { setLoadingRequests(false); }
  }, [token, API_URL]);

  // BB-080 — employees the logged-in supervisor/admin/superadmin may file a
  // request on behalf of. Fetched lazily when the on-behalf picker is opened,
  // not on mount, since most visits to this page never use it.
  const fetchTeamEmployees = useCallback(async () => {
    if (!token) return;
    setLoadingTeamEmployees(true);
    try {
      const res = await fetch(`${API_URL}/api/employee/team`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok) setTeamEmployees(j.data || []);
    } catch {}
    finally { setLoadingTeamEmployees(false); }
  }, [token, API_URL]);

  useEffect(() => {
    if (!requestPunchLogsDialog || !requestOnBehalfMode) return;
    fetchTeamEmployees();
  }, [requestPunchLogsDialog, requestOnBehalfMode, fetchTeamEmployees]);

  const fetchLogs = useCallback(async (params) => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (params.from)                          p.set("from",      params.from);
      if (params.to)                            p.set("to",        params.to);
      if (params.status    && params.status    !== "all") p.set("status",    params.status);
      if (params.punchType && params.punchType !== "all") p.set("punchType", params.punchType);
      p.set("page",  params.page  ?? 1);
      p.set("limit", params.limit ?? 10);
      const res = await fetch(`${API_URL}/api/timelogs/user?${p}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Fetch failed");
      setLogs(
        (j.data || []).map((raw) => {
          const t = deepParse(raw);
          return { ...t, coffeeMins: coffeeMinutes(t.coffeeBreaks), lunchMins: lunchMinutesStr(t.lunchBreak), _lunchNum: lunchMinutesNum(t.lunchBreak) };
        })
      );
      if (j.pagination) setTotalPages(j.pagination.totalPages ?? 1);
      if (j.summary) setServerSummary({
        total:      j.summary.total      ?? 0,
        active:     j.summary.active     ?? 0,
        completed:  j.summary.completed  ?? 0,
        totalHours: Number(j.summary.totalHours ?? 0).toFixed(2),
      });
    } catch (err) { toast.message(err.message); }
    finally { setLoading(false); }
  }, [API_URL, token]);

  const fetchUserShifts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/usershifts/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (res.ok && Array.isArray(j.data)) setUserShifts(j.data);
    } catch {}
  }, [token, API_URL]);

  const fetchThresholdStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/overtime/threshold-status`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok) setThresholdStatus(j);
    } catch {}
  }, [token, API_URL]);

  // BB-080 — same /api/account/profile call EmployeesPunchLogs.jsx already uses to
  // read the logged-in user's real role (see note on currentUserRole above).
  const fetchCurrentUserRole = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/account/profile`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok) setCurrentUserRole(j.data?.user?.role || "");
    } catch {}
  }, [token, API_URL]);

  useEffect(() => {
    if (!token) return;
    fetchBootstrap();
    fetchUserShifts();
    fetchThresholdStatus();
    fetchCurrentUserRole();
  }, [token, fetchBootstrap, fetchUserShifts, fetchThresholdStatus, fetchCurrentUserRole]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/company-settings/`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        const data = j?.data || {};
        setIsDayCareCompany(data.isBNC === false || data.companyType === "DAYCARE");
      })
      .catch(() => {});
  }, [token, API_URL]);

  // Re-fetch logs whenever queryParams changes (filter change, page change, etc.)
  useEffect(() => {
    if (!token) return;
    fetchLogs(queryParams);
  }, [token, queryParams, fetchLogs]);

  const handleCutoffSelect = (value) => {
    setSelectedCutoffId(value);
    if (value === "all") return;
    const period = cutoffPeriods.find((p) => periodRangeKey(p) === value);
    if (!period) return;
    const from = period.periodStart.slice(0, 10);
    const to   = period.periodEnd.slice(0, 10);
    setPendingDates({ from, to });
    setQueryParams((p) => ({ ...p, from, to, page: 1 }));
  };

  // ── logsWithSchedule — server-driven enrichment ───────────────────────────────
  const logsWithSchedule = useMemo(() => {
    const sourceData = viewMode === "smart" ? smartLogs : logs;

    return sourceData.map((log) => {
      const fullDevIn  = getDevice(log, "in");
      const fullDevOut = getDevice(log, "out");

      // ── Punch type flags ───────────────────────────────────────────────────
      const punchType = log.punchType ?? "REGULAR";
      const isDA      = punchType === "DRIVER_AIDE";
      const isDA_AM   = punchType === "DRIVER_AIDE_AM";
      const isDA_PM   = punchType === "DRIVER_AIDE_PM";
      const isAnyDA   = isDA || isDA_AM || isDA_PM;

      // ── Server-computed hours — all punch types ────────────────────────────
      const netWorkedHours   = parseFloat(log.netWorkedHours ?? 0);
      const rawOtMins        = parseFloat(log.rawOtMinutes ?? 0);

      // Approved/pending OT from overtime relation
      const overtimeArr     = Array.isArray(log.overtime) ? log.overtime : [];
      const approvedOTHours = overtimeArr
        .filter((ot) => ot.status === "approved")
        .reduce((sum, ot) => sum + (parseFloat(ot.requestedHours) || 0), 0);
      const hasPendingOT    = overtimeArr.some((ot) => ot.status === "pending");

      // ── Period hours: net worked minus unapproved OT ───────────────────────
      const periodHours = log.scheduledHours != null ? parseFloat(log.scheduledHours).toFixed(2) : "0.00";

      // ── DA segment hours — server-computed ────────────────────────────────
      const driverAideAMHours  = isAnyDA ? (log.driverAmSegmentHours ?? null) : null;
      const regularHoursForLog = isAnyDA ? (log.regularSegmentHours  ?? null) : null;
      const driverAidePMHours  = isAnyDA ? (log.driverPmSegmentHours ?? null) : null;
      const daRawOtHours       = isAnyDA ? rawOtMins / 60 : 0;

      // ── OT — unified across all punch types ───────────────────────────────
      const inThresholdPeriod = thresholdStatus?.data?.logs?.some(l => l.timeLogId === log.id);
      const otEligible = otBasis === "daily"
        ? rawOtMins > 0
        : !!(thresholdStatus?.data?.eligible && inThresholdPeriod);
      const otHours    = (rawOtMins / 60).toFixed(2);

      // OT status display
      const otStatus = log.otStatus != null
        ? log.otStatus
        : approvedOTHours > 0 ? `Approved ${approvedOTHours.toFixed(2)}h`
        : hasPendingOT        ? "Pending"
        : otEligible          ? "No Approval"
        : "—";

      // ── Schedule for this day — for "View Schedule" dialog & DA hints ──────
      const logDate = log.timeIn ? toLocalDateStr(log.timeIn, companyTimezone) : null;
      const scheduleList = logDate
        ? userShifts.filter((s) => {
            const shiftDate = s.assignedDate ? toLocalDateStr(s.assignedDate, companyTimezone) : null;
            return shiftDate === logDate;
          })
        : [];

      return {
        ...log,
        punchType,
        isDA,
        isDA_AM,
        isDA_PM,
        isAnyDA,
        isScheduled: scheduleList.length > 0,
        isLocRestricted: locList.length > 0,
        locList,
        scheduleList,
        lateHours:  log.lateHours != null ? parseFloat(log.lateHours).toFixed(2) : "0.00",
        duration:   log.netWorkedHours != null ? parseFloat(log.netWorkedHours).toFixed(2) : log.grossHours != null ? parseFloat(log.grossHours).toFixed(2) : rawDuration(log.timeIn, log.timeOut),
        otHours,
        otStatus,
        periodHours,
        daRawOtHours,
        driverAideAMHours,
        driverAidePMHours,
        regularHoursForLog,
        approvedOTHours,
        hasPendingOT,
        fullDevIn,
        fullDevOut,
        cutoffApproval: log.cutoffApproval ?? null,
      };
    });
  }, [logs, smartLogs, viewMode, locList, userShifts, companyTimezone, thresholdStatus, otBasis]);

  // ── OT Consumption — computed from logs within the active window ─────────────
  const otConsumptionData = useMemo(() => {
    if (otBasis === "daily") {
      return { type: "daily", threshold: dailyOtThreshold, label: `${dailyOtThreshold}h per session`, approvedHours: 0, pendingHours: 0, pct: 0, window: null };
    }

    let windowStart, windowEnd, label;

    if (otBasis === "weekly") {
      const now = new Date();
      const day = now.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      windowStart = new Date(now);
      windowStart.setDate(now.getDate() + diffToMon);
      windowStart.setHours(0, 0, 0, 0);
      windowEnd = new Date(windowStart);
      windowEnd.setDate(windowStart.getDate() + 6);
      windowEnd.setHours(23, 59, 59, 999);
      label = `${safeDate(windowStart, companyTimezone)} – ${safeDate(windowEnd, companyTimezone)}`;
    } else if (activeCutoffPeriod) {
      windowStart = new Date(activeCutoffPeriod.periodStart);
      windowEnd   = new Date(activeCutoffPeriod.periodEnd);
      label = `${safeDate(activeCutoffPeriod.periodStart, companyTimezone)} – ${safeDate(activeCutoffPeriod.periodEnd, companyTimezone)}`;
    } else {
      label = "No active cutoff period";
    }

    const windowLogs = windowStart && windowEnd
      ? logs.filter((l) => {
          if (!l.timeIn) return false;
          const d = new Date(l.timeIn);
          return d >= windowStart && d <= windowEnd;
        })
      : logs;

    const approvedHours = parseFloat(windowLogs.reduce((sum, l) => {
      const ots = Array.isArray(l.overtime) ? l.overtime : [];
      return sum + ots.filter((ot) => ot.status === "approved").reduce((s, ot) => s + parseFloat(ot.requestedHours || 0), 0);
    }, 0).toFixed(2));

    const pendingHours = parseFloat(windowLogs.reduce((sum, l) => {
      const ots = Array.isArray(l.overtime) ? l.overtime : [];
      return sum + ots.filter((ot) => ot.status === "pending").reduce((s, ot) => s + parseFloat(ot.requestedHours || 0), 0);
    }, 0).toFixed(2));

    const accumulatedHours = parseFloat(windowLogs.reduce((sum, l) => {
      return sum + parseFloat(l.netWorkedHours ?? 0);
    }, 0).toFixed(2));

    const threshold = otBasis === "weekly" ? weeklyOtThreshold : cutoffOtThreshold;
    const pct = Math.min(100, (accumulatedHours / threshold) * 100);

    return { type: otBasis, threshold, label, accumulatedHours, approvedHours, pendingHours, pct, window: { start: windowStart, end: windowEnd } };
  }, [logs, otBasis, dailyOtThreshold, weeklyOtThreshold, cutoffOtThreshold, activeCutoffPeriod]);

  // ── FIX 3: getSortableValue — punchType sort covers all 4 values ──────────────
  const getSortableValue = (l, k) => {
    switch (k) {
      case "date":
      case "timeIn":    return new Date(l.timeIn).getTime();
      case "timeOut":   return new Date(l.timeOut).getTime();
      case "duration":  return parseFloat(l.duration) || 0;
      case "ot":        return parseFloat(l.otHours)  || 0;
      case "punchType": return l.isAnyDA ? 1 : 0;
      case "status":    return l.status ? 1 : 0;
      default:          return 0;
    }
  };

  // Client-side sort + optional cutoff-status filter
  const filteredSorted = useMemo(() => {
    let data = [...logsWithSchedule];
    if (cutoffStatusFilter === "none") {
      data = data.filter((l) => !l.cutoffApproval);
    } else if (cutoffStatusFilter !== "all") {
      data = data.filter((l) => l.cutoffApproval?.status === cutoffStatusFilter);
    }
    data.sort((a, b) => {
      const aVal = getSortableValue(a, sortConfig.key);
      const bVal = getSortableValue(b, sortConfig.key);
      if (aVal < bVal) return sortConfig.direction === "ascending" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "ascending" ? 1  : -1;
      return 0;
    });
    return data;
  }, [logsWithSchedule, sortConfig, cutoffStatusFilter]);

  // Cutoff-status counts from current page (reflect server-fetched batch)
  const cutoffStats = useMemo(() => {
    const awaiting = logsWithSchedule.filter((l) => l.cutoffApproval?.status === "pending").length;
    const approved = logsWithSchedule.filter((l) => l.cutoffApproval?.status === "approved").length;
    const totalOtHours = logsWithSchedule
      .reduce((s, l) => s + (parseFloat(l.otHours) || 0), 0)
      .toFixed(2);
    return { awaiting, approved, totalOtHours };
  }, [logsWithSchedule]);

  // All returned logs are displayed — pagination is server-side
  const displayed = filteredSorted;


  const submitContestPolicy = async (clockInISO, clockOutISO) => {
    const errors = {};
    if (!contestLogId)              errors.logId       = "Please select a punch log";
    if (!contestApproverId)         errors.approverId  = "Please select an approver";
    if (!contestReason.trim())      errors.reason      = "Please provide a reason";
    if (!contestDescription.trim()) errors.description = "Please provide a description";
    if (!clockInISO)                errors.clockIn     = "Please provide the correct clock-in time";
    if (!clockOutISO)               errors.clockOut    = "Please provide the correct clock-out time";
    setContestErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const selectedLog = filteredSorted.find((l) => l.id === contestLogId);
    setContestSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/contest-policy/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          timeLogId: contestLogId,
          approverId: contestApproverId,
          reason: contestReason,
          description: contestDescription,
          currentClockIn: selectedLog?.timeIn,
          currentClockOut: selectedLog?.timeOut,
          requestedClockIn: clockInISO,
          requestedClockOut: clockOutISO,
          submittedAt: new Date().toISOString(),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Contest submission failed");
      toast.message("Contest request submitted successfully");
      setContestDialogOpen(false);
      setContestLogId(""); setContestApproverId(""); setContestReason("");
      setContestDescription(""); setContestRequestedClockIn(""); setContestRequestedClockOut("");
      setContestErrors({});
    } catch (e) { toast.message(e.message); }
    setContestSubmitting(false);
  };

  const refresh = () => {
    setRefreshing(true);
    const promises = [fetchLogs(queryParams), fetchBootstrap()];
    if (viewMode === "smart") promises.push(fetchSmartDetectsOT());
    Promise.all(promises).finally(() => setRefreshing(false));
  };

  // Fetches ALL records matching current filters (no pagination cap) for export
  const fetchExportData = async () => {
    const p = new URLSearchParams();
    if (queryParams.from)                        p.set("from",      queryParams.from);
    if (queryParams.to)                          p.set("to",        queryParams.to);
    if (queryParams.status    !== "all")         p.set("status",    queryParams.status);
    if (queryParams.punchType !== "all")         p.set("punchType", queryParams.punchType);
    p.set("page", "1");
    p.set("limit", "10000");
    const res = await fetch(`${API_URL}/api/timelogs/user?${p}`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Export fetch failed");

    return (j.data || []).map((raw) => {
      const t   = deepParse(raw);
      const log = { ...t, coffeeMins: coffeeMinutes(t.coffeeBreaks), lunchMins: lunchMinutesStr(t.lunchBreak), _lunchNum: lunchMinutesNum(t.lunchBreak) };

      const punchType = log.punchType ?? "REGULAR";
      const isDA      = punchType === "DRIVER_AIDE";
      const isDA_AM   = punchType === "DRIVER_AIDE_AM";
      const isDA_PM   = punchType === "DRIVER_AIDE_PM";
      const isAnyDA   = isDA || isDA_AM || isDA_PM;

      const netWorkedHours  = parseFloat(log.netWorkedHours ?? 0);
      const rawOtMins       = parseFloat(log.rawOtMinutes ?? 0);
      const overtimeArr     = Array.isArray(log.overtime) ? log.overtime : [];
      const approvedOTHours = overtimeArr.filter((ot) => ot.status === "approved").reduce((s, ot) => s + (parseFloat(ot.requestedHours) || 0), 0);
      const hasPendingOT    = overtimeArr.some((ot) => ot.status === "pending");

      const periodHours = log.scheduledHours != null ? parseFloat(log.scheduledHours).toFixed(2) : "0.00";

      const otHours = (rawOtMins / 60).toFixed(2);
      const otStatus = log.otStatus != null
        ? log.otStatus
        : approvedOTHours > 0 ? `Approved ${approvedOTHours.toFixed(2)}h`
        : hasPendingOT        ? "Pending"
        : rawOtMins > 0       ? "No Approval"
        : "—";

      const driverAideAMHours  = isAnyDA ? (log.driverAmSegmentHours ?? null) : null;
      const regularHoursForLog = isAnyDA ? (log.regularSegmentHours  ?? null) : null;
      const driverAidePMHours  = isAnyDA ? (log.driverPmSegmentHours ?? null) : null;
      const daRawOtHours       = isAnyDA ? rawOtMins / 60 : 0;

      const duration = log.netWorkedHours != null
        ? parseFloat(log.netWorkedHours).toFixed(2)
        : log.grossHours != null
          ? parseFloat(log.grossHours).toFixed(2)
          : rawDuration(log.timeIn, log.timeOut);

      return { ...log, duration, otHours, otStatus, periodHours, lateHours: log.lateHours != null ? parseFloat(log.lateHours).toFixed(2) : "0.00", driverAideAMHours, driverAidePMHours, regularHoursForLog, daRawOtHours };
    });
  };

  const exportCSV = async () => {
    if (!serverSummary.total) { toast.error("No records to export"); return; }
    setExporting(true);
    try {
      toast.message("Fetching records for export…");
      const data = await fetchExportData();
      const { exportPunchLogsCSV } = await import("@/lib/exports/punchLogs");
      const result = await exportPunchLogsCSV({ data, timezone: companyTimezone });
      if (result.success) toast.success(result.filename);
    } catch (e) { toast.error(`Export failed: ${e.message}`); }
    finally { setExporting(false); }
  };

  const exportPDF = async () => {
    if (!serverSummary.total) { toast.error("No records to export"); return; }
    setExporting(true);
    try {
      toast.message("Fetching records for export…");
      const data = await fetchExportData();
      const { exportPunchLogsPDF } = await import("@/lib/exports/punchLogs");
      const result = await exportPunchLogsPDF({ data, timezone: companyTimezone });
      if (result.success) toast.success(result.filename);
    } catch (e) { toast.error(`Export failed: ${e.message}`); }
    finally { setExporting(false); }
  };

  const exportGridCSV = async () => {
    if (!serverSummary.total) { toast.error("No records to export"); return; }
    setExporting(true);
    try {
      toast.message("Fetching records for grid export…");
      const data = await fetchExportData();
      const { exportPunchLogsCSV_v2 } = await import("@/lib/exports/punchLogs");
      const result = await exportPunchLogsCSV_v2({ data, timezone: companyTimezone });
      if (result.success) toast.success(result.filename);
    } catch (e) { toast.error(`Grid export failed: ${e.message}`); }
    finally { setExporting(false); }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider delayDuration={300}>
      <div className="max-w-full mx-auto p-4 lg:px-10 px-2 space-y-6">
        <Toaster position="top-center" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
          {/* Left: title + subtitle */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 leading-tight">
              <Clock className="h-5 w-5 text-orange-500 flex-shrink-0" />
              Punch Logs
            </h2>
            <p className="text-sm text-muted-foreground">View and manage your time tracking records</p>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-start sm:justify-end">
            {/* Punch — desktop only, primary */}
            <Button asChild className="hidden sm:inline-flex h-8 text-xs rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-3 gap-1.5">
              <Link href="/dashboard/employee/punch">
                <Clock className="h-3.5 w-3.5" />
                Punch
              </Link>
            </Button>

            {/* Contest time — always visible, label abbreviated on mobile */}
            <Button variant="outline" className="h-8 text-xs rounded-lg px-2.5 gap-1.5"
              onClick={() => filteredSorted.length ? setContestDialogOpen(true) : toast.message("No logs available")}>
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Contest time</span>
              <span className="sm:hidden">Contest</span>
            </Button>

            {/* Request entry — always visible, label abbreviated on mobile */}
            <Button variant="outline" className="h-8 text-xs rounded-lg px-2.5 gap-1.5"
              onClick={() => setRequestPunchLogsDialog(true)}>
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Request entry</span>
              <span className="sm:hidden">Request</span>
            </Button>

            {/* File for employee — BB-080, supervisor/admin/superadmin only */}
            {["supervisor", "admin", "superadmin"].includes((currentUserRole || "").toLowerCase()) && (
              <Button variant="outline" className="h-8 text-xs rounded-lg px-2.5 gap-1.5"
                onClick={() => { setRequestOnBehalfMode(true); setRequestPunchLogsDialog(true); }}>
                <UserCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">File for employee</span>
                <span className="sm:hidden">For employee</span>
              </Button>
            )}

            {/* Export dropdown — desktop only */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hidden sm:inline-flex h-8 text-xs rounded-lg px-2.5 gap-1.5" disabled={exporting}>
                  <Download className="h-3.5 w-3.5" />
                  Export
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[210px]">
                <DropdownMenuItem onClick={exportCSV} disabled={exporting}>
                  <Download className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  Export CSV (Details)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportPDF} disabled={exporting}>
                  <FileText className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  Export PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportGridCSV} disabled={exporting}>
                  <LayoutTemplate className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  Export Grid CSV (Payroll)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Refresh — desktop only */}
            <Button variant="outline" size="icon" className="hidden sm:inline-flex h-8 w-8 rounded-lg"
              onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* My Requests */}
        {myRequests.length > 0 && (
          <div className="bg-card rounded-xl border overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none"
              onClick={() => setRequestsV2Expanded(!requestsV2Expanded)}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AlarmClockPlus className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <span className="font-semibold text-sm">Punch log entry requests</span>
                {myRequests.filter((r) => r.status === "PENDING").length > 0 && (
                  <span className="hidden sm:inline-flex text-xs px-2.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "#faeeda", color: "#633806" }}>
                    {myRequests.filter((r) => r.status === "PENDING").length} pending
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-xs text-muted-foreground">{myRequests.length} total</span>
                {requestsV2Expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>

            {/* Items */}
            <AnimatePresence>
              {requestsV2Expanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}>
                  {loadingRequests ? (
                    <div className="flex items-center justify-center py-8 gap-2 border-t">
                      <OrangeLoadingSpinner />
                      <span className="text-sm text-muted-foreground">Loading requests...</span>
                    </div>
                  ) : (
                    <div>
                      {myRequests.map((req) => {
                        const isPending  = req.status === "PENDING";
                        const isApproved = req.status === "APPROVED";
                        const isRejected = req.status === "REJECTED";

                        const statusPill = isPending
                          ? { background: "#faeeda", color: "#633806" }
                          : isApproved
                          ? { background: "#dcf5e2", color: "#1a5e2d" }
                          : isRejected
                          ? { background: "#fde8e8", color: "#b91c1c" }
                          : { background: "#f3f4f6", color: "#6b7280" };
                        const statusLabel = isPending ? "Pending" : isApproved ? "Approved" : isRejected ? "Rejected" : req.status;

                        const approverName = req.approver?.profile
                          ? `${req.approver.profile.firstName} ${req.approver.profile.lastName}`
                          : req.approver?.email || "Not assigned";

                        const dateLabel     = new Date((req.requestedDate?.split("T")[0] ?? "") + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                        const secondaryText = req.description || `${req.estimatedNetHours?.toFixed(2) || "0.00"}h`;
                        const submittedLabel = new Date(req.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

                        return (
                          <div key={req.id} className="border-t px-4 py-3.5 space-y-2">
                            {/* Row 1: date + hours pill + status badge */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Calendar className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                                <span className="font-semibold text-sm leading-tight">{dateLabel}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <PunchTypeBadge punchType={req.requestedPunchType} />
                                <span className="text-xs border rounded-full px-2.5 py-0.5 tabular-nums">
                                  {req.estimatedNetHours?.toFixed(2) || "0.00"}h
                                </span>
                                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={statusPill}>
                                  {statusLabel}
                                </span>
                              </div>
                            </div>

                            {/* Row 2: time range */}
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                              <span className="text-sm text-muted-foreground tabular-nums">
                                {safeTime(req.requestedClockIn, companyTimezone)} – {safeTime(req.requestedClockOut, companyTimezone)}
                              </span>
                            </div>

                            {/* Row 3: reason pill + secondary info */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs border rounded-lg px-2.5 py-0.5 capitalize text-muted-foreground shrink-0">
                                {req.reason?.replace(/_/g, " ") || "Not specified"}
                              </span>
                              <span className="text-xs text-muted-foreground">{secondaryText}</span>
                            </div>

                            {/* Row 4: approver + submitted */}
                            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <div className="flex items-center gap-2 min-w-0">
                                <User className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
                                <span className="truncate">{approverName}</span>
                              </div>
                              <span className="shrink-0">Submitted {submittedLabel}</span>
                            </div>

                            {/* Row 5 (BB-080): filed on your behalf by a supervisor/admin */}
                            {req.createdBy && (
                              <div className="flex items-center gap-2 text-xs" style={{ color: "#633806" }}>
                                <UserCheck className="h-3.5 w-3.5 flex-shrink-0" />
                                <span>
                                  Filed by {req.createdBy.profile ? `${req.createdBy.profile.firstName} ${req.createdBy.profile.lastName}` : req.createdBy.email} on your behalf
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Metric Cards ── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl border p-3 flex flex-col gap-2.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-10 mt-0.5" />
                <Skeleton className="h-3 w-20 mt-0.5" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-card rounded-xl border p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-orange-500" />Total logs
              </div>
              <div className="text-2xl font-medium leading-none mt-0.5">{serverSummary.total}</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">across date range</div>
            </div>
            <div className="bg-card rounded-xl border p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <TimerOff className="h-3.5 w-3.5" style={{ color: "#633806" }} />Awaiting
              </div>
              <div className="text-2xl font-medium leading-none mt-0.5" style={{ color: "#633806" }}>{cutoffStats.awaiting}</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">pending admin review</div>
            </div>
            <div className="bg-card rounded-xl border p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5" style={{ color: "#3b6d11" }} />Approved
              </div>
              <div className="text-2xl font-medium leading-none mt-0.5" style={{ color: "#3b6d11" }}>{cutoffStats.approved}</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">confirmed for payroll</div>
            </div>
            <div className="bg-card rounded-xl border p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5" style={{ color: "#3C3489" }} />Total hours
              </div>
              <div className="text-2xl font-medium leading-none mt-0.5" style={{ color: "#3C3489" }}>{serverSummary.totalHours}</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">incl. {cutoffStats.totalOtHours}h OT</div>
            </div>
          </div>
        )}

        {/* ── OT Banner ── */}
        {loading ? (
          <div className="bg-card rounded-xl border p-3.5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
            </div>
            <Skeleton className="h-[5px] w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ) : (
          <OTBanner
            otType={otBasis}
            dailyThreshold={dailyOtThreshold}
            weeklyThreshold={weeklyOtThreshold}
            cutoffThreshold={cutoffOtThreshold}
            threshold={otConsumptionData.threshold}
            accumulatedHours={otConsumptionData.accumulatedHours}
            pct={otConsumptionData.pct}
            label={otConsumptionData.label}
            deptName={employeeDeptName}
          />
        )}

        {/* ── Filters & Controls ── */}
        <div className="bg-card rounded-xl border p-3">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <SlidersHorizontal className="h-3.5 w-3.5 text-orange-500" />
              Filters &amp; controls
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{filteredSorted.length} shown · {serverSummary.total} total</span>
              {companyTimezone !== "UTC" && (
                <>
                  <span className="text-[11px] rounded-full px-2 py-0.5" style={{ background: "#faeeda", color: "#633806" }}>
                    {getTimezoneName(companyTimezone)}
                  </span>
                  {userTimezone !== companyTimezone && (
                    <span className="text-[11px] text-muted-foreground">· Detected: {getTimezoneName(userTimezone)}</span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end flex-wrap gap-2">
            <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
              <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <Flag className="h-2.5 w-2.5" />Cutoff status
              </div>
              <Select value={cutoffStatusFilter} onValueChange={setCutoffStatusFilter}>
                <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Awaiting</SelectItem>
                  <SelectItem value="none">Not included</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isDayCare && (
              <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <User className="h-2.5 w-2.5" />Punch type
                </div>
                <Select value={queryParams.punchType} onValueChange={(v) => setQueryParams((p) => ({ ...p, punchType: v, page: 1 }))}>
                  <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="REGULAR">Regular</SelectItem>
                    <SelectItem value="DRIVER_AIDE">Driver/Aide</SelectItem>
                    <SelectItem value="DRIVER_AIDE_AM">Driver AM</SelectItem>
                    <SelectItem value="DRIVER_AIDE_PM">Driver PM</SelectItem>
                    <SelectItem value="TRAINING">Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1 flex-1 min-w-[190px]">
              <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-2.5 w-2.5" />Date range
              </div>
              <CutoffDateRangeFilter
                mode="picker"
                cutoffPeriods={cutoffPeriods}
                selectedCutoffId={selectedCutoffId}
                onSelectCutoff={handleCutoffSelect}
                maxDate={getDefaultTo()}
                size="compact"
              />
            </div>
            <div className="flex flex-col gap-1 flex-[2] min-w-[200px]">
              <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-2.5 w-2.5" />Custom range
              </div>
              <CutoffDateRangeFilter
                mode="range"
                from={pendingDates.from}
                to={pendingDates.to}
                onFromChange={(v) => { setPendingDates((p) => ({ ...p, from: v })); setSelectedCutoffId("all"); }}
                onToChange={(v) => { setPendingDates((p) => ({ ...p, to: v })); setSelectedCutoffId("all"); }}
                onApply={() => setQueryParams((p) => ({ ...p, from: pendingDates.from, to: pendingDates.to, page: 1 }))}
                isDirty={pendingDates.from !== queryParams.from || pendingDates.to !== queryParams.to}
                maxDate={getDefaultTo()}
                size="compact"
              />
            </div>
          </div>
        </div>

        {/* Punch Logs table */}
        <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
          <div className="h-1 w-full bg-orange-500" />
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                Punch Logs
                {isDayCare && (
                  <span className="hidden sm:inline-flex ml-2 text-xs font-normal text-muted-foreground items-center gap-1">
                    <Car className="h-3 w-3 text-blue-500" /> Driver/Aide: 1.25 AM + Regular + 1.25 PM
                  </span>
                )}
              </CardTitle>
              <span className="hidden sm:inline text-sm text-muted-foreground">{filteredSorted.length} shown</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex">
              {/* ── Left: table ── */}
              <div className={`w-full ${selectedLogV3 ? "sm:flex-1 sm:min-w-0" : ""} overflow-x-auto transition-all duration-200`}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold pl-4 whitespace-nowrap sticky left-0 z-10 bg-muted sm:static sm:z-auto sm:bg-transparent">Date</TableHead>
                      <TableHead className="font-semibold">Clock In</TableHead>
                      <TableHead className="font-semibold">Clock Out</TableHead>
                      <TableHead className="text-right font-semibold">Duration</TableHead>
                      <TableHead className="text-right font-semibold">OT</TableHead>
                      {isDayCare && <TableHead className="text-center font-semibold">Punch Type</TableHead>}
                      <TableHead className="text-center font-semibold">Cutoff Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableSkeleton rows={10} cols={isDayCare ? 7 : 6} />
                    ) : displayed.length ? (
                      displayed.map((log) => {
                        const isSelected = selectedLogV3?.id === log.id;
                        const fullDate = log.timeIn
                          ? new Date(log.timeIn).toLocaleDateString("en-US", {
                              weekday: "short", month: "long", day: "numeric",
                              ...(companyTimezone ? { timeZone: companyTimezone } : {}),
                            })
                          : "—";
                        const locIn  = getLocation(log, "in");
                        const locOut = getLocation(log, "out");
                        return (
                          <TableRow
                            key={log.id}
                            className={`cursor-pointer border-b transition-colors ${
                              isSelected
                                ? "bg-orange-50 dark:bg-orange-950/20 border-l-2 border-l-orange-500"
                                : "hover:bg-muted/50"
                            }`}
                            onClick={() => setSelectedLogV3(isSelected ? null : { ...log, _locIn: locIn, _locOut: locOut })}
                          >
                            {/* Date */}
                            <TableCell className={`pl-4 py-4 font-medium text-sm whitespace-nowrap sticky left-0 z-10 sm:static sm:z-auto ${isSelected ? "bg-orange-50 dark:bg-orange-950/20" : "bg-background sm:bg-transparent"}`}>{fullDate}</TableCell>

                            {/* Clock In */}
                            <TableCell className="py-4">
                              <DualTime value={log.dayApprovedClockIn ?? log.timeIn} companyTz={companyTimezone} userTz={userTimezone} />
                            </TableCell>

                            {/* Clock Out */}
                            <TableCell className="py-4">
                              {(log.dayApprovedClockOut ?? log.timeOut)
                                ? <DualTime value={log.dayApprovedClockOut ?? log.timeOut} companyTz={companyTimezone} userTz={userTimezone} />
                                : <span className="text-xs text-muted-foreground italic">—</span>
                              }
                            </TableCell>

                            {/* Duration */}
                            <TableCell className="text-right py-4">
                              <span className="text-sm font-semibold">{log.duration}h</span>
                            </TableCell>

                            {/* OT */}
                            <TableCell className="text-right py-4" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-col items-end gap-1">
                                {parseFloat(log.otHours) > 0 ? (
                                  <span className="text-sm font-medium text-orange-600">{log.otHours}h</span>
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                                {log.otStatus === "No Approval" && (
                                  <button
                                    className="text-[10px] px-2 py-0.5 rounded border border-orange-300 text-orange-600 hover:bg-orange-50 transition-colors"
                                    onClick={() => { setOtForLog(log); setOtSelectedLogId(log.id); setOtApprover(""); setOtHoursEdit(""); setOtReason(""); setOtDialogOpen(true); }}
                                  >
                                    Request
                                  </button>
                                )}
                              </div>
                            </TableCell>

                            {/* Punch Type */}
                            {isDayCare && (
                              <TableCell className="text-center py-4">
                                <PunchTypeBadge punchType={log.punchType} />
                              </TableCell>
                            )}

                            {/* Cutoff Status */}
                            <TableCell className="text-center py-4">
                              <V3CutoffBadge cutoffApproval={log.cutoffApproval} />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={isDayCare ? 7 : 6} className="h-32 text-center">
                          <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                            <Clock className="h-8 w-8 text-orange-500/40" />
                            <span className="text-sm">No logs match the selected filters</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* ── Right: detail side panel (desktop) ── */}
              <AnimatePresence>
                {selectedLogV3 && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 288, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="hidden sm:block border-l bg-card flex-shrink-0 overflow-hidden"
                  >
                    <div className="w-72 h-full overflow-y-auto">
                      {/* Panel header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 sticky top-0 z-10">
                        <span className="text-sm font-semibold">Log Details</span>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedLogV3(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <LogDetailBody
                        log={selectedLogV3}
                        isDayCare={isDayCare}
                        companyTimezone={companyTimezone}
                        setOtForLog={setOtForLog}
                        setOtSelectedLogId={setOtSelectedLogId}
                        setOtApprover={setOtApprover}
                        setOtHoursEdit={setOtHoursEdit}
                        setOtReason={setOtReason}
                        setOtDialogOpen={setOtDialogOpen}
                        setSchedForDialog={setSchedForDialog}
                        setSchedDialogOpen={setSchedDialogOpen}
                        setLocDialogList={setLocDialogList}
                        setLocDialogOpen={setLocDialogOpen}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>

          {/* ── Detail panel (mobile bottom sheet) ── */}
          <Sheet open={!!selectedLogV3} onOpenChange={(open) => !open && setSelectedLogV3(null)}>
            <SheetContent side="bottom" className="sm:hidden p-0 gap-0 rounded-t-2xl max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 shrink-0">
                <span className="text-sm font-semibold">Log Details</span>
              </div>
              <div className="overflow-y-auto flex-1">
                {selectedLogV3 && (
                  <LogDetailBody
                    log={selectedLogV3}
                    isDayCare={isDayCare}
                    companyTimezone={companyTimezone}
                    setOtForLog={setOtForLog}
                    setOtSelectedLogId={setOtSelectedLogId}
                    setOtApprover={setOtApprover}
                    setOtHoursEdit={setOtHoursEdit}
                    setOtReason={setOtReason}
                    setOtDialogOpen={setOtDialogOpen}
                    setSchedForDialog={setSchedForDialog}
                    setSchedDialogOpen={setSchedDialogOpen}
                    setLocDialogList={setLocDialogList}
                    setLocDialogOpen={setLocDialogOpen}
                  />
                )}
              </div>
            </SheetContent>
          </Sheet>

          {/* Pagination — shared with main table via queryParams */}
          {totalPages > 1 && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border-t">
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" disabled={queryParams.page === 1} onClick={() => setQueryParams((p) => ({ ...p, page: 1 }))}>
                  <ChevronsLeft className="h-4 w-4" /> First
                </Button>
                {[...Array(totalPages)].map((_, i) => {
                  const pg = i + 1;
                  if (pg === 1 || pg === totalPages || Math.abs(pg - queryParams.page) <= 1)
                    return (
                      <Button
                        key={pg}
                        size="sm"
                        variant={pg === queryParams.page ? "default" : "outline"}
                        className={pg === queryParams.page ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500" : ""}
                        onClick={() => setQueryParams((p) => ({ ...p, page: pg }))}
                      >
                        {pg}
                      </Button>
                    );
                  if ((pg === queryParams.page - 2 && pg > 1) || (pg === queryParams.page + 2 && pg < totalPages))
                    return <span key={pg} className="px-1 text-muted-foreground">…</span>;
                  return null;
                })}
                <Button size="sm" variant="outline" disabled={queryParams.page === totalPages} onClick={() => setQueryParams((p) => ({ ...p, page: totalPages }))}>
                  Last <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
              <span className="text-sm text-muted-foreground">
                Page {queryParams.page} of {totalPages} · {serverSummary.total.toLocaleString()} records
              </span>
            </div>
          )}
        </Card>

        {/* ── Dialogs ── */}

        {/* OT Dialog */}
        <FormDialog
          open={otDialogOpen}
          setOpen={(open) => { setOtDialogOpen(open); if (!open) { setOtForLog(null); setOtSelectedLogId(null); setOtHoursEdit(""); setOtApprover(""); setOtReason(""); } }}
          icon={Send}
          title="Request Overtime Approval"
          subtitle={otForLog ? `For ${safeDate(otForLog.timeIn, companyTimezone)} — ${otForLog.isAnyDA ? "Driver/Aide PM segment" : "Overtime hours"}` : "Select a punch log"}
          loading={otSubmitting}
          primaryLabel="Submit Request"
          loadingLabel={<><span className="ml-2">Submitting...</span></>}
          onSubmit={async () => {
            try {
              setOtSubmitting(true);
              const decimalHours = convertTimeToDecimal(otHoursEdit);
              if (decimalHours <= 0) { toast.error("Please enter valid overtime hours"); setOtSubmitting(false); return; }
              const maxOtHours = thresholdStatus?.data?.otEligibleHours;
              if (maxOtHours != null && decimalHours > maxOtHours) {
                toast.error(`Cannot exceed eligible OT hours (${maxOtHours.toFixed(2)}h)`);
                setOtSubmitting(false);
                return;
              }
              const submitLogId = otSelectedLogId || otForLog?.id;
              const res = await fetch(`${API_URL}/api/overtime/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ timeLogId: submitLogId, approverId: otApprover, requestedHours: decimalHours, requesterReason: otReason || null }),
              });
              const result = await res.json();
              if (res.ok) {
                toast.success("Overtime request submitted!");
                setOtDialogOpen(false); setOtForLog(null); setOtSelectedLogId(null); setOtHoursEdit(""); setOtApprover(""); setOtReason("");
                fetchLogs(queryParams);
                fetchThresholdStatus();
              } else {
                if (result.message?.includes("already exists")) { toast.error("Already submitted an OT request for this log"); setOtDialogOpen(false); }
                else toast.error(result.message || "Failed to submit OT request");
              }
            } catch { toast.error("Failed to submit OT request. Please try again."); }
            finally { setOtSubmitting(false); }
          }}
          primaryDisabled={!otForLog || !otApprover || !otHoursEdit || !isValidTimeFormat(otHoursEdit)}
        >
          <div className="space-y-6 text-sm">
            {/* Driver/Aide PM context — shown for any DA variant */}
            {otForLog?.isAnyDA && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 flex items-start gap-3">
                <Car className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-700 dark:text-blue-300 text-xs">
                    {otForLog.isDA_PM ? "Driver / Aide PM — Overtime" :
                     otForLog.isDA_AM ? "Driver / Aide AM — Overtime" :
                     "Driver / Aide — PM Overtime"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">OT hours requested here will be added on top of the base 1.25h PM segment.</p>
                </div>
              </div>
            )}
            {/* Log selector — shown for weekly/cutoff basis when threshold data has multiple eligible logs */}
            {otBasis !== "daily" && thresholdStatus?.data?.logs?.length > 0 && (
              <div className="space-y-2">
                <label className="block font-medium">Punch Log <span className="text-orange-500">*</span></label>
                <Select value={otSelectedLogId || ""} onValueChange={setOtSelectedLogId}>
                  <SelectTrigger><SelectValue placeholder="Select punch log" /></SelectTrigger>
                  <SelectContent>
                    {thresholdStatus.data.logs.map((l) => {
                      const dayLabel = (() => {
                        try {
                          const [y, m, d] = l.date.split("-").map(Number);
                          return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                        } catch { return l.date; }
                      })();
                      const timeLabel = l.timeIn ? new Date(l.timeIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";
                      const typeLabel = l.punchType === "DRIVER_AIDE" ? "Driver/Aide" : l.punchType === "DRIVER_AIDE_AM" ? "DA AM" : l.punchType === "DRIVER_AIDE_PM" ? "DA PM" : "Regular";
                      return (
                        <SelectItem key={l.timeLogId} value={l.timeLogId}>
                          {dayLabel}{timeLabel ? ` · ${timeLabel}` : ""} · {typeLabel}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-3">
              <label className="block font-medium">
                OT Hours <span className="text-orange-500">*</span>
                {thresholdStatus?.data?.otEligibleHours != null && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    max {Number(thresholdStatus.data.otEligibleHours).toFixed(2)}h eligible
                  </span>
                )}
              </label>
              <Input
                type="text"
                value={otHoursEdit}
                onChange={(e) => { const v = e.target.value.replace(/[^\d:]/g, ""); const p = v.split(":"); if (p.length <= 2 && p[0].length <= 2 && (p[1] || "").length <= 2) setOtHoursEdit(v); }}
                placeholder="HH:MM (e.g., 02:30)"
                className={`w-full max-w-xs ${otHoursEdit && !isValidTimeFormat(otHoursEdit) ? "border-red-500" : ""}`}
                maxLength={5}
              />
              {otHoursEdit && !isValidTimeFormat(otHoursEdit) && <p className="text-xs text-red-500">Please enter valid time format (HH:MM)</p>}
            </div>
            <div className="space-y-2">
              <label className="font-medium">Approver</label>
              <Select value={otApprover} onValueChange={setOtApprover} disabled={!otForLog}>
                <SelectTrigger><SelectValue placeholder="Choose approver" /></SelectTrigger>
                <SelectContent>
                  {approverOptions.supervisors.length > 0 && (
                    <>{<div className="px-2 py-1 text-xs font-medium text-muted-foreground">Team Supervisors</div>}{approverOptions.supervisors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} - {s.department}</SelectItem>)}</>
                  )}
                  {approverOptions.approvers.length > 0 && (
                    <>{<div className="px-2 py-1 text-xs font-medium text-muted-foreground">Approvers</div>}{approverOptions.approvers.map((a) => <SelectItem key={a.id} value={a.id}>{a.name || a.email}</SelectItem>)}</>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="font-medium">Reason (optional)</label>
              <Textarea value={otReason} onChange={(e) => setOtReason(e.target.value)} placeholder="Brief reason for overtime request..." className="min-h-[80px]" disabled={!otForLog} />
            </div>
          </div>
        </FormDialog>

        {/* Request Punch Log — 3-step Dialog */}
        <Dialog
          open={requestPunchLogsDialog}
          onOpenChange={(open) => {
            if (!open) {
              setRequestPunchLogsDialog(false);
              setRequestStep(1);
              setRequestPunchDate(""); setRequestClockIn(""); setRequestClockOut("");
              setRequestPunchType("REGULAR");
              setRequestApproverId(""); setRequestReason(""); setRequestDescription("");
              setRequestErrors({});
              setRequestOnBehalfMode(false); setRequestTargetUserId("");
            }
          }}
        >
          <DialogContent className="sm:max-w-[500px] p-0 gap-0 rounded-2xl overflow-hidden [&>button]:hidden">
            <DialogTitle className="sr-only">Request punch log entry</DialogTitle>

            {/* Orange progress bar */}
            <div className="h-[3px] w-full bg-muted overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-300"
                style={{ width: `${(requestStep / 3) * 100}%` }}
              />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-sm bg-orange-500 flex-shrink-0" />
                  <span className="font-semibold text-[15px]">Request punch log entry</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 pl-6">
                  {["Step 1 of 3 — Date & times", "Step 2 of 3 — Approver", "Step 3 of 3 — Details"][requestStep - 1]}
                </p>
              </div>
              <button
                className="w-6 h-6 rounded-sm border border-muted-foreground/30 flex items-center justify-center text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground transition-colors flex-shrink-0 mt-0.5"
                onClick={() => setRequestPunchLogsDialog(false)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Stepper */}
            <div className="flex items-start gap-0 px-5 py-3.5 border-b">
              {[
                { n: 1, label: "Date &\ntimes" },
                { n: 2, label: "Approver" },
                { n: 3, label: "Details" },
              ].map(({ n, label }, idx) => {
                const isDone   = n < requestStep;
                const isActive = n === requestStep;
                return (
                  <div key={n} className="flex items-start flex-1">
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      {isDone ? (
                        <span className="w-6 h-6 rounded-sm flex items-center justify-center" style={{ background: "#dcf5e2" }}>
                          <Check className="h-3.5 w-3.5" style={{ color: "#1a5e2d" }} />
                        </span>
                      ) : (
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${isActive ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"}`}>
                          {n}
                        </span>
                      )}
                      <span className={`text-[10px] font-medium text-center leading-tight whitespace-pre-line ${isActive || isDone ? "text-foreground" : "text-muted-foreground"}`}>
                        {label}
                      </span>
                    </div>
                    {idx < 2 && (
                      <div className="flex-1 h-[1px] bg-border mt-3 mx-2" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step body */}
            <div className="px-5 py-5 space-y-4">

              {/* ── Step 1: Date & Times ── */}
              {requestStep === 1 && (
                <>
                  {requestOnBehalfMode && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <UserCheck className="h-3 w-3" />Employee <span className="text-orange-500">*</span>
                      </label>
                      <MultiSelect
                        options={teamEmployees.map((e) => ({
                          value: e.id,
                          label: `${e.profile?.firstName || ""} ${e.profile?.lastName || ""}`.trim() || e.email,
                        }))}
                        selected={requestTargetUserId ? [requestTargetUserId] : []}
                        onChange={(val) => {
                          setRequestTargetUserId(val === "all" ? "" : val);
                          setRequestErrors((p) => ({ ...p, targetUserId: undefined }));
                        }}
                        allLabel={loadingTeamEmployees ? "Loading employees…" : "Select an employee…"}
                        width={0}
                        className="w-full"
                        searchable
                        sortable
                        singleSelect
                      />
                      {requestErrors.targetUserId && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3" />{requestErrors.targetUserId}</p>}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />Date <span className="text-orange-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={requestPunchDate}
                      max={getDefaultTo(companyTimezone)}
                      onChange={(e) => {
                        const d = e.target.value;
                        setRequestPunchDate(d);
                        setRequestErrors((p) => ({ ...p, date: undefined, conflict: undefined }));
                        if (d && defaultHours) { setRequestClockIn(`${d}T09:00`); setRequestClockOut(`${d}T${String(9 + defaultHours).padStart(2, "0")}:00`); }
                      }}
                      className={`h-9 text-sm ${requestErrors.date ? "border-red-500" : ""}`}
                    />
                    {requestErrors.date && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3" />{requestErrors.date}</p>}
                  </div>

                  {isDayCareCompany && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Car className="h-3 w-3" />Shift type <span className="text-orange-500">*</span>
                      </label>
                      <Select value={requestPunchType} onValueChange={setRequestPunchType}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select shift type…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="REGULAR">Regular</SelectItem>
                          <SelectItem value="DRIVER_AIDE">Full Day (AM + Regular + PM)</SelectItem>
                          <SelectItem value="DRIVER_AIDE_AM">AM only</SelectItem>
                          <SelectItem value="DRIVER_AIDE_PM">PM only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <LogIn className="h-3 w-3" />Clock in <span className="text-orange-500">*</span>
                      </label>
                      <Input
                        type="time"
                        value={requestClockIn.split("T")[1] || ""}
                        onChange={(e) => {
                          const inTime = e.target.value;
                          setRequestClockIn(`${requestPunchDate}T${inTime}`);
                          if (requestClockOut) {
                            const outTime = requestClockOut.split("T")[1] || "";
                            const isCrossMidnight = outTime && inTime && outTime < inTime;
                            let outDate = requestPunchDate;
                            if (isCrossMidnight) { const d = new Date(`${requestPunchDate}T12:00`); d.setDate(d.getDate() + 1); outDate = d.toLocaleDateString("en-CA"); }
                            setRequestClockOut(`${outDate}T${outTime}`);
                          }
                          setRequestErrors((p) => ({ ...p, clockIn: undefined, conflict: undefined }));
                        }}
                        className={`h-9 text-sm ${requestErrors.clockIn ? "border-red-500" : ""}`}
                      />
                      {requestErrors.clockIn && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3" />{requestErrors.clockIn}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <LogOut className="h-3 w-3" />Clock out <span className="text-orange-500">*</span>
                      </label>
                      <Input
                        type="time"
                        value={requestClockOut.split("T")[1] || ""}
                        onChange={(e) => {
                          const outTime = e.target.value;
                          const inTime = requestClockIn.split("T")[1] || "";
                          const isCrossMidnight = outTime && inTime && outTime < inTime;
                          let outDate = requestPunchDate;
                          if (isCrossMidnight) { const d = new Date(`${requestPunchDate}T12:00`); d.setDate(d.getDate() + 1); outDate = d.toLocaleDateString("en-CA"); }
                          setRequestClockOut(`${outDate}T${outTime}`);
                          setRequestErrors((p) => ({ ...p, clockOut: undefined, conflict: undefined }));
                        }}
                        className={`h-9 text-sm ${requestErrors.clockOut ? "border-red-500" : ""}`}
                      />
                      {requestClockOut.split("T")[0] > requestPunchDate && (
                        <p className="text-amber-600 text-xs font-medium flex items-center gap-1">
                          <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">+1</span>
                          Next day
                        </p>
                      )}
                      {requestErrors.clockOut && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3" />{requestErrors.clockOut}</p>}
                    </div>
                  </div>

                  {requestClockIn && requestClockOut && !requestErrors.clockIn && !requestErrors.clockOut && (
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border" style={{ background: "#faeeda", borderColor: "#ef9f27" }}>
                      <span className="text-xs font-medium" style={{ color: "#633806" }}>Estimated net hours</span>
                      <span className="text-sm font-bold" style={{ color: "#633806" }}>
                        {toHour(diffMins(requestClockIn, requestClockOut))}h
                      </span>
                    </div>
                  )}
                  {requestErrors.conflict && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />{requestErrors.conflict}</p>}
                </>
              )}

              {/* ── Step 2: Approver ── */}
              {requestStep === 2 && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3 w-3" />Select approver <span className="text-orange-500">*</span>
                    </label>
                    <Select value={requestApproverId} onValueChange={(v) => { setRequestApproverId(v); setRequestErrors((p) => ({ ...p, approverId: undefined })); }}>
                      <SelectTrigger className={`h-9 text-sm ${requestErrors.approverId ? "border-red-500" : ""}`}>
                        <SelectValue placeholder="Choose an approver…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {approverOptions.supervisors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} — {s.department}</SelectItem>)}
                        {approverOptions.approvers.map((a) => <SelectItem key={a.id} value={a.id}>{a.name || a.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {requestErrors.approverId && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3" />{requestErrors.approverId}</p>}
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs" style={{ background: "#faeeda", border: "0.5px solid #ef9f27", color: "#633806" }}>
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#ef9f27" }} />
                    <span>The selected approver will review your request before it is added to your punch logs.</span>
                  </div>
                </>
              )}

              {/* ── Step 3: Details ── */}
              {requestStep === 3 && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Flag className="h-3 w-3" />Reason <span className="text-orange-500">*</span>
                    </label>
                    <Select value={requestReason} onValueChange={(v) => { setRequestReason(v); setRequestErrors((p) => ({ ...p, reason: undefined })); }}>
                      <SelectTrigger className={`h-9 text-sm ${requestErrors.reason ? "border-red-500" : ""}`}>
                        <SelectValue placeholder="Select a reason…" />
                      </SelectTrigger>
                      <SelectContent>
                        {["forgot_to_clock", "system_malfunction", "network_issues", "emergency", "remote_work", "power_outage", "meeting_offsite", "other"].map((v) => (
                          <SelectItem key={v} value={v}>
                            {v.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {requestErrors.reason && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3" />{requestErrors.reason}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3 w-3" />Notes
                    </label>
                    <Textarea
                      value={requestDescription}
                      onChange={(e) => { setRequestDescription(e.target.value); setRequestErrors((p) => ({ ...p, description: undefined })); }}
                      placeholder="Any additional context for your approver…"
                      className="min-h-[100px] resize-none text-sm"
                      maxLength={500}
                    />
                  </div>
                </>
              )}

            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t">
              {requestStep > 1 ? (
                <Button variant="outline" className="h-8 text-xs rounded-lg px-3 gap-1.5" onClick={() => setRequestStep((s) => s - 1)} disabled={requestSubmitting}>
                  <ArrowLeft className="h-3 w-3" />Back
                </Button>
              ) : (
                <Button variant="outline" className="h-8 text-xs rounded-lg px-3 gap-1.5" onClick={() => setRequestPunchLogsDialog(false)} disabled={requestSubmitting}>
                  <X className="h-3 w-3" />Cancel
                </Button>
              )}

              {requestStep < 3 ? (
                <Button
                  className="h-8 text-xs rounded-lg px-3 gap-1.5 bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={isCheckingConflict}
                  onClick={async () => {
                    const errors = {};
                    if (requestStep === 1) {
                      if (requestOnBehalfMode && !requestTargetUserId) errors.targetUserId = "Please select an employee";
                      if (!requestPunchDate)  errors.date     = "Please select a date";
                      if (!requestClockIn)    errors.clockIn  = "Please provide clock-in time";
                      if (!requestClockOut)   errors.clockOut = "Please provide clock-out time";
                      if (requestClockIn && requestClockOut && requestClockIn >= requestClockOut) errors.clockIn = "Clock in must be before clock out";
                    }
                    if (requestStep === 2) {
                      if (!requestApproverId) errors.approverId = "Please select an approver";
                    }
                    setRequestErrors(errors);
                    if (Object.keys(errors).length > 0) return;

                    if (requestStep === 1) {
                      setIsCheckingConflict(true);
                      try {
                        const res = await fetch(`${API_URL}/api/request-punch-log/check-conflict`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ requestedClockIn: requestClockIn, requestedClockOut: requestClockOut }),
                        });
                        const j = await res.json();
                        if (!res.ok) { setRequestErrors((p) => ({ ...p, conflict: j.message || "Could not verify availability. Please try again." })); return; }
                        if (j.hasConflict) {
                          const fmt = (iso) => iso ? safeTime(iso, companyTimezone) : "ongoing";
                          setRequestErrors((p) => ({ ...p, conflict: `Overlaps with an existing log (${fmt(j.conflictingTimeIn)} – ${fmt(j.conflictingTimeOut)}). Please adjust the times.` }));
                          return;
                        }
                      } catch {
                        setRequestErrors((p) => ({ ...p, conflict: "Could not verify availability. Please try again." }));
                        return;
                      } finally {
                        setIsCheckingConflict(false);
                      }
                    }
                    setRequestStep((s) => s + 1);
                  }}
                >
                  {isCheckingConflict ? <><OrangeLoadingSpinner /><span>Checking…</span></> : <>Next <ArrowRight className="h-3 w-3" /></>}
                </Button>
              ) : (
                <Button
                  className="h-8 text-xs rounded-lg px-3 gap-1.5 bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={requestSubmitting}
                  onClick={async () => {
                    const errors = {};
                    if (!requestReason) errors.reason = "Please select a reason";
                    setRequestErrors(errors);
                    if (Object.keys(errors).length > 0) return;
                    setRequestSubmitting(true);
                    try {
                      const res = await fetch(`${API_URL}/api/request-punch-log/submit`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ requestedDate: requestPunchDate, requestedClockIn: requestClockIn, requestedClockOut: requestClockOut, approverId: requestApproverId, reason: requestReason, description: requestDescription, ...(isDayCareCompany ? { punchType: requestPunchType } : {}), ...(requestOnBehalfMode && requestTargetUserId ? { targetUserId: requestTargetUserId } : {}) }),
                      });
                      const result = await res.json();
                      if (res.ok) {
                        toast.success(requestOnBehalfMode ? "Punch log request filed for employee!" : "Punch log request submitted!");
                        setRequestPunchLogsDialog(false);
                        setRequestStep(1);
                        setRequestPunchDate(""); setRequestClockIn(""); setRequestClockOut(""); setRequestPunchType("REGULAR"); setRequestApproverId(""); setRequestReason(""); setRequestDescription(""); setRequestErrors({});
                        setRequestOnBehalfMode(false); setRequestTargetUserId("");
                        fetchMyRequests();
                      } else if (res.status === 409) {
                        setRequestStep(1);
                        setRequestErrors({ conflict: result.message || "A conflict was detected. Please choose different times." });
                      } else { toast.error(result.message || "Failed to submit"); }
                    } catch { toast.error("Failed to submit. Please try again."); }
                    finally { setRequestSubmitting(false); }
                  }}
                >
                  {requestSubmitting ? <><OrangeLoadingSpinner /><span>Submitting…</span></> : <><Send className="h-3 w-3" />Submit request</>}
                </Button>
              )}
            </div>

          </DialogContent>
        </Dialog>

        <ContestDialog
          open={contestDialogOpen}
          onOpenChange={setContestDialogOpen}
          companyTimezone={companyTimezone}
          filteredSorted={filteredSorted}
          approvers={approvers}
          supervisors={supervisors}
          contestLogId={contestLogId}                     setContestLogId={setContestLogId}
          contestApproverId={contestApproverId}           setContestApproverId={setContestApproverId}
          contestReason={contestReason}                   setContestReason={setContestReason}
          contestDescription={contestDescription}         setContestDescription={setContestDescription}
          contestRequestedClockIn={contestRequestedClockIn}   setContestRequestedClockIn={setContestRequestedClockIn}
          contestRequestedClockOut={contestRequestedClockOut} setContestRequestedClockOut={setContestRequestedClockOut}
          contestSubmitting={contestSubmitting}
          contestErrors={contestErrors}                   setContestErrors={setContestErrors}
          onSubmit={submitContestPolicy}
          onCancel={() => {
            setContestDialogOpen(false);
            setContestLogId(""); setContestApproverId(""); setContestReason("");
            setContestDescription(""); setContestRequestedClockIn(""); setContestRequestedClockOut("");
            setContestErrors({});
          }}
        />

        <ScheduleDialog open={schedDialogOpen} onOpenChange={setSchedDialogOpen} scheduleList={schedForDialog} />
        <LocationDialog open={locDialogOpen}  onOpenChange={setLocDialogOpen}  list={locDialogList} />
      </div>
    </TooltipProvider>
  );
}

// ── LogDetailBody — shared between the desktop side panel and the mobile sheet ──
function LogDetailBody({
  log,
  isDayCare,
  companyTimezone,
  setOtForLog,
  setOtSelectedLogId,
  setOtApprover,
  setOtHoursEdit,
  setOtReason,
  setOtDialogOpen,
  setSchedForDialog,
  setSchedDialogOpen,
  setLocDialogList,
  setLocDialogOpen,
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Date + punch type */}
      <div>
        <p className="font-semibold text-sm">
          {log.timeIn
            ? new Date(log.timeIn).toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric", year: "numeric",
                ...(companyTimezone ? { timeZone: companyTimezone } : {}),
              })
            : "—"}
        </p>
        {isDayCare && (
          <div className="mt-1.5">
            <PunchTypeBadge punchType={log.punchType} />
          </div>
        )}
      </div>

      <div className="border-t" />

      {/* Time details */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Time Details</p>
        <div className="space-y-1.5">
          {[
            { label: "Clock In",   value: <span className="font-mono text-xs">{safeTime(log.dayApprovedClockIn ?? log.timeIn, companyTimezone)}</span> },
            { label: "Clock Out",  value: <span className="font-mono text-xs">{(log.dayApprovedClockOut ?? log.timeOut) ? safeTime(log.dayApprovedClockOut ?? log.timeOut, companyTimezone) : <span className="text-muted-foreground italic">—</span>}</span> },
            { label: "Duration",   value: <span className="font-semibold text-orange-600">{log.duration}h</span> },
            { label: "Period Hrs", value: `${log.periodHours}h` },
            ...(parseFloat(log.lateHours) > 0 ? [{ label: "Late", value: <span className="text-red-600 font-medium">{log.lateHours}h</span> }] : []),
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t" />

      {/* Breaks */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Breaks</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Coffee className="h-3 w-3" />Coffee
            </span>
            <span className="flex items-center gap-1">
              {log.coffeeMins}h
              {(log.autoCoffeeApplied || log.coffeeBreaks?.some(b => b.auto)) && (
                <AutoBreakBadge deductible={log.coffeeBreaks?.find(b => b.auto)?.deductible ?? true} />
              )}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Lunch</span>
            <span className="flex items-center gap-1">
              {log.lunchMins}h
              {(log.autoLunchApplied || log.lunchBreak?.auto) && (
                <AutoBreakBadge deductible={log.lunchBreak?.deductible ?? true} />
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t" />

      {/* Overtime */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Overtime</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">OT Hours</span>
            <span className={parseFloat(log.otHours) > 0 ? "font-semibold text-orange-600" : ""}>{log.otHours}h</span>
          </div>
          {isDayCare && log.otStatus != null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">OT Status</span>
              {log.otStatus === "Approved" ? (
                <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle className="h-3 w-3" />Approved
                </span>
              ) : log.otStatus === "Included" ? (
                <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <Clock className="h-3 w-3" />Included
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          )}
          {log.otStatus === "No Approval" && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs border-orange-300 text-orange-600 hover:bg-orange-50 mt-1"
              onClick={() => { setOtForLog(log); setOtSelectedLogId(log.id); setOtApprover(""); setOtHoursEdit(""); setOtReason(""); setOtDialogOpen(true); }}
            >
              <AlarmClockPlus className="h-3 w-3 mr-1" />Request OT Approval
            </Button>
          )}
        </div>
      </div>

      <div className="border-t" />

      {/* Payroll Cutoff */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payroll Cutoff</p>
        <V3CutoffBox cutoffApproval={log.cutoffApproval} />
      </div>

      {/* DA Breakdown — DayCare only */}
      {log.isAnyDA && (
        <>
          <div className="border-t" />
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Hours Breakdown</p>
            <div className="space-y-1.5 text-sm">
              {(log.isDA || log.isDA_AM) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Driver AM</span>
                  <span className="font-medium text-blue-600">{log.driverAideAMHours != null ? `${parseFloat(log.driverAideAMHours).toFixed(2)}h` : "—"}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Regular</span>
                <span className="font-medium text-purple-600">{log.regularHoursForLog != null ? `${parseFloat(log.regularHoursForLog).toFixed(2)}h` : "—"}</span>
              </div>
              {(log.isDA || log.isDA_PM) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Driver PM</span>
                  <span className="font-medium text-blue-600">{log.driverAidePMHours != null ? `${parseFloat(log.driverAidePMHours).toFixed(2)}h` : "—"}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1.5 font-semibold">
                <span>Total</span>
                <span className="text-orange-600">{log.duration}h</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Schedule */}
      <div className="border-t" />
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Schedule</p>
        {log.scheduleList?.length > 0 ? (
          <div className="space-y-1.5">
            {log.scheduleList.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate mr-2">{s.shift?.shiftName || "Shift"}</span>
                <span className="font-mono text-right shrink-0">
                  {s.shift?.startTime ? fmtUTCTime(s.shift.startTime) : "—"}
                  {" – "}
                  {s.shift?.endTime ? fmtUTCTime(s.shift.endTime) : "—"}
                </span>
              </div>
            ))}
            <Button
              size="sm" variant="outline"
              className="w-full h-7 text-xs mt-1"
              onClick={() => { setSchedForDialog(log.scheduleList); setSchedDialogOpen(true); }}
            >
              <Calendar className="h-3 w-3 mr-1" />View full schedule
            </Button>
          </div>
        ) : (
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />Unscheduled punch
          </p>
        )}
      </div>

      {/* Device */}
      {(log.fullDevIn !== "—" || log.fullDevOut !== "—") && (
        <>
          <div className="border-t" />
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Device</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              {log.fullDevIn !== "—" && (
                <div className="truncate" title={log.fullDevIn}>In: {log.fullDevIn}</div>
              )}
              {log.fullDevOut !== "—" && (
                <div className="truncate" title={log.fullDevOut}>Out: {log.fullDevOut}</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Location */}
      {(log._locIn?.lat || log._locOut?.lat) && (
        <>
          <div className="border-t" />
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Location</p>
            <div className="space-y-1.5 text-xs">
              {log._locIn?.lat && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">In</span>
                  <a
                    href={`https://www.google.com/maps?q=${log._locIn.lat},${log._locIn.lng}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-orange-500 hover:underline flex items-center gap-1"
                  >
                    <MapPinIcon className="h-3 w-3" />View map
                  </a>
                </div>
              )}
              {log._locOut?.lat && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Out</span>
                  <a
                    href={`https://www.google.com/maps?q=${log._locOut.lat},${log._locOut.lng}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-orange-500 hover:underline flex items-center gap-1"
                  >
                    <MapPinIcon className="h-3 w-3" />View map
                  </a>
                </div>
              )}
            </div>
            {log.locList?.length > 0 && (
              <Button
                size="sm" variant="outline"
                className="w-full h-7 text-xs mt-2"
                onClick={() => { setLocDialogList(log.locList); setLocDialogOpen(true); }}
              >
                <MapPin className="h-3 w-3 mr-1" />View location restrictions
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── OTBanner ───────────────────────────────────────────────────────────────────
function OTBanner({ otType, dailyThreshold, weeklyThreshold, cutoffThreshold, threshold, accumulatedHours, pct, label, deptName }) {
  const isDaily  = otType === "daily";
  const isWeekly = otType === "weekly";
  const isCutoff = otType === "cutoff";

  const accentColor = isCutoff ? "#f97316" : isWeekly ? "#7F77DD" : "#378ADD";
  const barClass    = isCutoff ? "bg-orange-500" : isWeekly ? "bg-[#7F77DD]" : "bg-[#378ADD]";
  const pillStyle   = isCutoff
    ? { background: "#faeeda", color: "#633806" }
    : isWeekly
    ? { background: "#EEEDFE", color: "#3C3489" }
    : { background: "#E6F1FB", color: "#0C447C" };
  const pillLabel = isCutoff ? "Cutoff OT" : isWeekly ? "Weekly OT" : "Daily OT";
  const titleText = isCutoff ? "Cutoff OT configuration" : isWeekly ? "Weekly OT configuration" : "Daily OT configuration";
  const subtitle  = isCutoff
    ? `Cumulative cutoff-period hours exceeding ${cutoffThreshold}h are eligible for OT`
    : isWeekly
    ? `Cumulative weekly hours exceeding ${weeklyThreshold}h are eligible for OT`
    : `Sessions exceeding ${dailyThreshold}h per session are eligible for OT`;

  const pctClamped  = Math.min(100, pct ?? 0);
  const accumulated = accumulatedHours ?? 0;
  const diff        = threshold - accumulated;

  return (
    <div className="bg-card rounded-xl border p-3.5 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2.5 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" style={{ color: accentColor }} />
            {titleText}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {isWeekly && deptName && (
            <span className="text-[11px] text-muted-foreground">Dept: {deptName}</span>
          )}
          <span className="text-[11px] font-medium rounded-full px-2.5 py-0.5 whitespace-nowrap" style={pillStyle}>
            {pillLabel}
          </span>
        </div>
      </div>

      {!isDaily ? (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{label || "No active period"}</span>
            <span className="font-mono tabular-nums">{accumulated}h / {threshold}h</span>
          </div>
          <div className="h-[5px] rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${pctClamped}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{accumulated}h accumulated</span>
            <span>{diff > 0 ? `${diff.toFixed(2)}h to threshold` : `${Math.abs(diff).toFixed(2)}h over threshold`}</span>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">OT is calculated per session, not accumulated.</p>
      )}
    </div>
  );
}

// ── DualTime ───────────────────────────────────────────────────────────────────
function DualTime({ value, companyTz, userTz }) {
  if (!value) return <span>—</span>;
  const companyTime = safeTime(value, companyTz);
  const showDual = companyTz && userTz && companyTz !== userTz;
  if (!showDual) return <span className="text-sm font-medium">{companyTime}</span>;
  const userTime = safeTime(value, userTz);
  const userAbbr = getTzAbbr(value, userTz);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-medium">{companyTime}</span>
      <span className="text-xs text-muted-foreground">{userTime} {userAbbr}</span>
    </div>
  );
}

// ── ScheduleDialog ─────────────────────────────────────────────────────────────
function ScheduleDialog({ open, onOpenChange, scheduleList }) {
  const sorted = [...scheduleList].sort((a, b) => {
    const toMins = (t) => t ? new Date(t).getUTCHours() * 60 + new Date(t).getUTCMinutes() : 0;
    return toMins(a.shift?.startTime) - toMins(b.shift?.startTime);
  });

  const allMins = sorted.map((s) => ({
    start: s.shift?.startTime ? new Date(s.shift.startTime).getUTCHours() * 60 + new Date(s.shift.startTime).getUTCMinutes() : 0,
    end:   s.shift?.endTime   ? new Date(s.shift.endTime).getUTCHours()   * 60 + new Date(s.shift.endTime).getUTCMinutes()   : 0,
  }));
  const dayStart   = allMins.length ? Math.min(...allMins.map((m) => m.start)) : 0;
  const dayEnd     = allMins.length ? Math.max(...allMins.map((m) => m.end))   : 0;
  const totalHours = toHour(dayEnd - dayStart);
  const startLabel = sorted[0]?.shift?.startTime ? fmtUTCTime(sorted[0].shift.startTime) : "—";
  const endLabel   = sorted[sorted.length - 1]?.shift?.endTime ? fmtUTCTime(sorted[sorted.length - 1].shift.endTime) : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-2xl border dark:border-white/10 gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <span className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center flex-shrink-0">
              <Calendar className="h-3.5 w-3.5 text-orange-500" />
            </span>
            Schedule details
          </DialogTitle>
        </DialogHeader>

        {sorted.length ? (
          <div className="space-y-4">
            {/* Timeline */}
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">{startLabel}</span>
                <div className="flex-1 relative flex items-center h-4">
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-orange-500 rounded-full" />
                  <div className="absolute left-0 w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <div className="absolute right-0 w-2.5 h-2.5 rounded-full bg-orange-500" />
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">{endLabel}</span>
              </div>
              <div className="flex justify-center mt-2">
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground border rounded-full px-2.5 py-1">
                  <Clock className="h-3 w-3" />{totalHours}h total
                </span>
              </div>
            </div>

            {/* Shifts */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2">Shifts</p>
              <ScrollArea className="max-h-64">
                <div className="space-y-2">
                  {sorted.map((s) => {
                    const isBreak  = /(lunch|break)/i.test(s.shift?.shiftName || "");
                    const startStr = s.shift?.startTime ? fmtUTCTime(s.shift.startTime) : "—";
                    const endStr   = s.shift?.endTime   ? fmtUTCTime(s.shift.endTime)   : "—";
                    let durMins    = 0;
                    if (s.shift?.startTime && s.shift?.endTime) {
                      durMins = diffMins(s.shift.startTime, s.shift.endTime);
                      if (durMins < 0) durMins += 1440;
                    }
                    const durStr = durMins ? `${toHour(durMins)}h` : "—";

                    return (
                      <div key={s.id} className="flex items-center justify-between rounded-xl bg-muted/50 dark:bg-muted/20 px-3 py-2.5 gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className={`mt-[3px] h-2 w-2 rounded-full flex-shrink-0 ${isBreak ? "bg-neutral-400 dark:bg-neutral-500" : "bg-orange-500"}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-tight truncate">{s.shift?.shiftName || "Shift"}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{startStr} — {endStr}</p>
                          </div>
                        </div>
                        {isBreak ? (
                          <span className="text-[11px] text-muted-foreground border rounded-full px-2 py-0.5 shrink-0 tabular-nums">{durStr}</span>
                        ) : (
                          <span className="text-sm font-semibold text-orange-500 dark:text-orange-400 shrink-0 tabular-nums">{durStr}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <Calendar className="h-8 w-8 opacity-30" />
            <p className="text-sm">No schedule for this day</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── LocationDialog ─────────────────────────────────────────────────────────────
function LocationDialog({ open, onOpenChange, list }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-2 dark:border-white/30">
        <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-orange-600" />Location Restriction Details</DialogTitle>
        </DialogHeader>
        {list.length ? (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4">
              {list.map((loc) => (
                <div key={loc.id} className="p-3 border rounded-md bg-muted/50 space-y-2 text-sm">
                  <div><strong>Name:</strong> <span className="capitalize">{loc.name}</span></div>
                  <div><strong>Coords:</strong> {Number(loc.latitude).toFixed(5)}, {Number(loc.longitude).toFixed(5)}</div>
                  <div><strong>Radius:</strong> {loc.radius} m</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-center text-muted-foreground py-4">No location restriction.</p>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="bg-orange-500 hover:bg-orange-600 text-white">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}