/* components/Dashboard/DashboardContent/TimeKeeping/PunchLogs.jsx */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Clock,
  Calendar,
  Download,
  Filter,
  Badge,
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
  CheckCircle2,
  Activity,
  ChevronRight,
  MoreHorizontal,
  AlarmClockPlus,
  Car,
  UserCheck,
  CheckCircle,
  XCircle,
  TrendingUp,
  Info,
  LayoutTemplate,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import useAuthStore from "@/store/useAuthStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import TableSkeleton from "@/components/common/TableSkeleton";
import { ContestDialog } from "./ContestDialog";
import FormDialog from "@/components/common/FormDialog";
import OrangeLoadingSpinner from "@/components/common/Spinner";

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
    DRIVER_AIDE:    { label: "Driver/Aide", icon: Car,       color: "blue"   },
    DRIVER_AIDE_AM: { label: "Driver AM",   icon: Car,       color: "blue"   },
    DRIVER_AIDE_PM: { label: "Driver PM",   icon: Car,       color: "blue"   },
    REGULAR:        { label: "Regular",     icon: UserCheck, color: "purple" },
  };

  const meta = config[punchType] ?? config.REGULAR;
  const Icon = meta.icon;
  const isBlue = meta.color === "blue";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
      size === "sm" ? "text-xs" : "text-sm"
    } ${
      isBlue
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
    }`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
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

// ── CutoffApprovalBadge ────────────────────────────────────────────────────────
const CutoffApprovalBadge = ({ cutoffApproval }) => {
  if (!cutoffApproval) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs text-muted-foreground border-dashed cursor-default">
              <Clock className="w-3 h-3 mr-1 opacity-50" />
              Not in cutoff
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="text-sm">This log has not been included in any payroll cutoff period yet.</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const { status, cutoffPeriod } = cutoffApproval;

  const config = {
    approved: {
      icon: <CheckCircle className="w-3 h-3 mr-1" />,
      label: "Approved",
      cls: "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      tip: "This log has been approved for payroll.",
    },
    pending: {
      icon: <AlertCircle className="w-3 h-3 mr-1" />,
      label: "Pending Review",
      cls: "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      tip: "Awaiting admin review in the cutoff period.",
    },
    rejected: {
      icon: <XCircle className="w-3 h-3 mr-1" />,
      label: "Rejected",
      cls: "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      tip: "This log was rejected during cutoff review. Contact your supervisor.",
    },
  };

  const meta = config[status] ?? config.pending;
  const periodLabel = cutoffPeriod
    ? `Cutoff: ${new Date(cutoffPeriod.periodStart).toLocaleDateString()} – ${new Date(cutoffPeriod.periodEnd).toLocaleDateString()}`
    : null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-xs cursor-default ${meta.cls}`}>
            {meta.icon}
            {meta.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="text-sm">{meta.tip}</div>
          {periodLabel && <div className="text-xs text-muted-foreground mt-1 pt-1 border-t">{periodLabel}</div>}
          {cutoffPeriod && <div className="text-xs text-muted-foreground">Period status: {cutoffPeriod.status}</div>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PunchLogs() {
  const { token, user } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [companyId, setCompanyId] = useState(user?.companyId ?? null);
  const isDayCare = DAYCARE_COMPANY_IDS.includes(companyId);

  const [logs,       setLogs]       = useState([]);
  const [smartLogs,  setSmartLogs]  = useState([]);
  const [viewMode,   setViewMode]   = useState("all");
  const [defaultHours,  setDefaultHours]  = useState(8);
  const [minLunchMins,  setMinLunchMins]  = useState(60);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [expandedRow,   setExpandedRow]   = useState(null);

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
  const [activeCutoffPeriod, setActiveCutoffPeriod]  = useState(null);

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
  const [myRequests,      setMyRequests]      = useState([]);
  const [requestsExpanded,setRequestsExpanded]= useState(true);
  const [loadingRequests, setLoadingRequests] = useState(false);

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
  const [requestApproverId,      setRequestApproverId]      = useState("");
  const [requestReason,          setRequestReason]          = useState("");
  const [requestDescription,     setRequestDescription]     = useState("");
  const [requestSubmitting,      setRequestSubmitting]      = useState(false);
  const [requestErrors,          setRequestErrors]          = useState({});
  const [requestStep,            setRequestStep]            = useState(1);

  const columnOptions = useMemo(() => [
    { value: "date",      label: "Date"       },
    { value: "timeIn",    label: "Clock In"   },
    { value: "timeOut",   label: "Clock Out"  },
    { value: "duration",  label: "Duration"   },
    { value: "ot",        label: "OT"         },
    { value: "punchType",     label: "Punch Type"    },
    { value: "cutoffApproval",label: "Cutoff Status" },
    { value: "status",        label: "Status"        },
  ], []);

  const [columnVisibility, setColumnVisibility] = useState(() =>
    isDayCare
      ? columnOptions.map((c) => c.value)
      : columnOptions.map((c) => c.value).filter((v) => v !== "punchType")
  );

  useEffect(() => {
    setColumnVisibility((prev) => {
      if (isDayCare && !prev.includes("punchType")) return [...prev, "punchType"];
      return prev;
    });
  }, [isDayCare]);

  // filters removed — now driven by queryParams (server-side)

  const isValidTimeFormat = (t) => /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/.test(t);
  const convertTimeToDecimal = (t) => {
    if (!isValidTimeFormat(t)) return 0;
    const [h, m] = t.split(":").map(Number);
    return h + m / 60;
  };

  const [sortConfig, setSortConfig] = useState({ key: "timeRange", direction: "descending" });
  const requestSort = (k) =>
    setSortConfig((p) => ({
      key: k,
      direction: p.key === k && p.direction === "ascending" ? "descending" : "ascending",
    }));

  // ── Fetch helpers ────────────────────────────────────────────────────────────
  const fetchCompanySettings = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/company-settings/`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (r.ok) {
        setDefaultHours(j.data?.defaultShiftHours ?? 8);
        const raw = j.data?.minimumLunchMinutes;
        setMinLunchMins(raw === null ? 0 : raw ?? 60);
        if (j.data?.id) setCompanyId(j.data.id);
        // ── OT configuration — all three bases ────────────────
        setOtBasis(j.data?.otBasis ?? "daily");
        setDailyOtThreshold(parseFloat(j.data?.dailyOtThresholdHours   ?? 8));
        setWeeklyOtThreshold(parseFloat(j.data?.weeklyOtThresholdHours ?? 40));
        setCutoffOtThreshold(parseFloat(j.data?.cutoffOtThresholdHours ?? 80));
        // ── Timezone — reset date defaults once with correct tz ─
        const tz = j.data?.timezone || j.data?.companyTimezone || "America/Los_Angeles";
        setCompanyTimezone(tz);
        if (!tzInitialized.current) {
          tzInitialized.current = true;
          const from = getDefaultFrom(tz);
          const to   = getDefaultTo(tz);
          setPendingDates({ from, to });
          setQueryParams((p) => ({ ...p, from, to, page: 1 }));
        }
      }
    } catch { setDefaultHours(8); setMinLunchMins(60); }
  }, [API_URL, token]);

  const fetchEmployeeDetails = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/employment-details/me`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok) {
        const dept = j.data?.department;
        setEmployeeDeptId(j.data?.departmentId || dept?.id || null);
        setEmployeeDeptName(dept?.name || null);
      }
    } catch {}
  }, [token, API_URL]);

  const fetchActiveCutoffPeriod = useCallback(async (deptId) => {
    if (!deptId) return;
    try {
      const res = await fetch(`${API_URL}/api/cutoff-periods?departmentId=${deptId}&status=open`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok && Array.isArray(j.data) && j.data.length > 0) {
        const p = j.data[0];
        setActiveCutoffPeriod({ id: p.id, periodStart: p.periodStart, periodEnd: p.periodEnd });
      } else {
        setActiveCutoffPeriod(null);
      }
    } catch {}
  }, [token, API_URL]);

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

  const fetchApprovers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/leaves/approvers`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok) setApprovers((j.data || []).filter((u) => ["admin", "superadmin"].includes((u.role || "").toLowerCase())));
    } catch (err) { toast.message(err.message); }
  }, [token, API_URL]);

  const fetchLocations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/location/assigned`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok && Array.isArray(j.data)) setLocList(j.data);
    } catch {}
  }, [token, API_URL]);

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

  const fetchSupervisors = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/account/approver`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok) {
        setSupervisors((j.data || []).map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          department: s.jobTitle || s.role,
          role: s.role,
        })));
      } else { setSupervisors([]); }
    } catch { setSupervisors([]); }
  }, [token, API_URL]);

  const fetchThresholdStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/overtime/threshold-status`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok) setThresholdStatus(j);
    } catch {}
  }, [token, API_URL]);

  useEffect(() => {
    if (!token) return;
    fetchCompanySettings();
    fetchApprovers();
    fetchLocations();
    fetchSupervisors();
    fetchMyRequests();
    fetchUserShifts();
    fetchEmployeeDetails();
    fetchThresholdStatus();
  }, [token, fetchApprovers, fetchCompanySettings, fetchLocations, fetchEmployeeDetails, fetchThresholdStatus]);

  // Re-fetch logs whenever queryParams changes (filter change, page change, etc.)
  useEffect(() => {
    if (!token) return;
    fetchLogs(queryParams);
  }, [token, queryParams, fetchLogs]);

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
      let otStatus;
      if (approvedOTHours > 0) otStatus = `Approved ${approvedOTHours.toFixed(2)}h`;
      else if (hasPendingOT)   otStatus = "Pending";
      else if (otEligible)     otStatus = "No Approval";
      else                     otStatus = "—";

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

  // ── Auto-fetch active cutoff period once otBasis + departmentId are known ────
  useEffect(() => {
    if (otBasis === "cutoff" && employeeDeptId) fetchActiveCutoffPeriod(employeeDeptId);
  }, [otBasis, employeeDeptId, fetchActiveCutoffPeriod]);

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

  // Filtering is now server-side; client only sorts the current page
  const filteredSorted = useMemo(() => {
    const data = [...logsWithSchedule];
    data.sort((a, b) => {
      const aVal = getSortableValue(a, sortConfig.key);
      const bVal = getSortableValue(b, sortConfig.key);
      if (aVal < bVal) return sortConfig.direction === "ascending" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "ascending" ? 1  : -1;
      return 0;
    });
    return data;
  }, [logsWithSchedule, sortConfig]);

  // Stats come from the server summary (reflects full filtered dataset, not just current page)
  const stats = serverSummary;

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
    const promises = [fetchLogs(queryParams), fetchCompanySettings(), fetchLocations(), fetchEmployeeDetails()];
    if (viewMode === "smart") promises.push(fetchSmartDetectsOT());
    if (otBasis === "cutoff" && employeeDeptId) promises.push(fetchActiveCutoffPeriod(employeeDeptId));
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
      let otStatus;
      if (approvedOTHours > 0) otStatus = `Approved ${approvedOTHours.toFixed(2)}h`;
      else if (hasPendingOT)   otStatus = "Pending";
      else if (rawOtMins > 0)  otStatus = "No Approval";
      else                     otStatus = "—";

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
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Clock className="h-7 w-7 text-orange-500" />
              Punch Logs
            </h2>
            <p className="text-sm text-muted-foreground mt-1">View and manage your time tracking records</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" asChild>
              <Link href="/dashboard/employee/punch">Punch</Link>
            </Button>

            <div className="flex gap-1 border rounded-md p-1">
              <Button size="sm" variant={viewMode === "all"   ? "default" : "ghost"} onClick={() => setViewMode("all")}   className="h-8">All Logs</Button>
              <Button size="sm" variant={viewMode === "smart" ? "default" : "ghost"} onClick={() => { setViewMode("smart"); if (!smartLogs.length) fetchSmartDetectsOT(); }} className="h-8">Smart OT</Button>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => filteredSorted.length ? setContestDialogOpen(true) : toast.message("No logs available")}>
                  <AlertTriangle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Contest Times</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => setRequestPunchLogsDialog(true)}>
                  <AlarmClockPlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Request Punch Logs</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={refresh} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={exportCSV} disabled={exporting}>
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export CSV (Detail)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={exportPDF} disabled={exporting}>
                  <FileText className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export PDF</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={exportGridCSV} disabled={exporting}>
                  <LayoutTemplate className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export Grid CSV (Payroll)</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-2 dark:border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Logs</p>
                  <p className="text-3xl font-bold mt-2">{stats.total}</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 dark:border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active</p>
                  <p className="text-3xl font-bold mt-2 text-green-600 dark:text-green-400">{stats.active}</p>
                </div>
                <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <Activity className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 dark:border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-3xl font-bold mt-2 text-orange-600 dark:text-orange-400">{stats.completed}</p>
                </div>
                <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 dark:border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
                  <p className="text-3xl font-bold mt-2">{stats.totalHours}</p>
                </div>
                <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* OT Configuration & Consumption Panel */}
        <Card className="border-2 dark:border-white/10 overflow-hidden">
          <div className={`h-1 w-full ${
            otBasis === "daily"  ? "bg-blue-500"   :
            otBasis === "weekly" ? "bg-purple-500" :
            "bg-orange-500"
          }`} />
          <CardContent className="p-4 space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border ${
                  otBasis === "daily"  ? "bg-blue-50   border-blue-200   text-blue-600"   :
                  otBasis === "weekly" ? "bg-purple-50 border-purple-200 text-purple-600" :
                  "bg-orange-50 border-orange-200 text-orange-600"
                }`}>
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold">
                    {otBasis === "daily"  && "Daily OT Configuration"}
                    {otBasis === "weekly" && "Weekly OT Configuration"}
                    {otBasis === "cutoff" && "Cutoff OT Configuration"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {otBasis === "daily"  && `Sessions exceeding ${dailyOtThreshold}h are eligible for OT`}
                    {otBasis === "weekly" && `Cumulative weekly hours exceeding ${weeklyOtThreshold}h are eligible for OT`}
                    {otBasis === "cutoff" && `Cumulative cutoff-period hours exceeding ${cutoffOtThreshold}h are eligible for OT`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {employeeDeptName && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    Dept: {employeeDeptName}
                  </span>
                )}
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  otBasis === "daily"  ? "bg-blue-100   text-blue-700"   :
                  otBasis === "weekly" ? "bg-purple-100 text-purple-700" :
                  "bg-orange-100 text-orange-700"
                }`}>
                  {otBasis === "daily" ? "Daily OT" : otBasis === "weekly" ? "Weekly OT" : "Cutoff OT"}
                </span>
              </div>
            </div>

            {/* Consumption meter — weekly / cutoff only */}
            {otConsumptionData.type !== "daily" && (
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">{otConsumptionData.label || "Current window"}</span>
                  <span className="font-mono font-bold">
                    {otConsumptionData.accumulatedHours}h <span className="text-muted-foreground font-normal">/ {otConsumptionData.threshold}h</span>
                  </span>
                </div>
                <div className="h-2 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      otConsumptionData.pct >= 100 ? "bg-red-500"   :
                      otConsumptionData.pct >= 80  ? "bg-amber-500" :
                      "bg-green-500"
                    }`}
                    style={{ width: `${otConsumptionData.pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {otConsumptionData.accumulatedHours >= otConsumptionData.threshold
                      ? otConsumptionData.approvedHours === 0
                        ? "Threshold met — no approved OT yet"
                        : `${otConsumptionData.approvedHours}h approved`
                      : `${otConsumptionData.accumulatedHours}h accumulated`}
                    {otConsumptionData.pendingHours > 0 && (
                      <span className="ml-2 text-amber-600 font-semibold">· {otConsumptionData.pendingHours}h pending</span>
                    )}
                  </span>
                  <span>
                    {otConsumptionData.accumulatedHours >= otConsumptionData.threshold
                      ? `${(otConsumptionData.accumulatedHours - otConsumptionData.threshold).toFixed(2)}h over threshold`
                      : `${(otConsumptionData.threshold - otConsumptionData.accumulatedHours).toFixed(2)}h to threshold`}
                  </span>
                </div>
              </div>
            )}

            {/* Smart OT detection note */}
            {viewMode === "smart" && (
              <div className="pt-2 border-t flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground">
                  Smart OT detected logs where hours exceeded the&nbsp;
                  <strong>
                    {otBasis === "daily"  && `${dailyOtThreshold}h daily threshold`}
                    {otBasis === "weekly" && `${weeklyOtThreshold}h weekly cap`}
                    {otBasis === "cutoff" && `${cutoffOtThreshold}h cutoff cap`}
                  </strong>
                  {otBasis === "cutoff" && activeCutoffPeriod && (
                    <> &nbsp;({safeDate(activeCutoffPeriod.periodStart, companyTimezone)} – {safeDate(activeCutoffPeriod.periodEnd, companyTimezone)})</>
                  )}
                  .
                </p>
              </div>
            )}
          </CardContent>
        </Card>


        {/* Filters */}
        <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
          <div className="h-1 w-full bg-orange-500" />
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-orange-500" />
                Table Controls
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {filteredSorted.length} shown · {serverSummary.total} total
                </span>
                {companyTimezone !== "UTC" && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    {getTimezoneName(companyTimezone)}
                    {userTimezone !== companyTimezone && (
                      <span className="ml-1 opacity-60">· Detected Time Zone: {getTimezoneName(userTimezone)}</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-center">
              <span className="text-sm font-medium text-muted-foreground">Filter:</span>

              {/* Status — auto-applies on change */}
              <Select value={queryParams.status} onValueChange={(v) => setQueryParams((p) => ({ ...p, status: v, page: 1 }))}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="All status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              {/* DayCare punch type — auto-applies on change */}
              {isDayCare && (
                <Select value={queryParams.punchType} onValueChange={(v) => setQueryParams((p) => ({ ...p, punchType: v, page: 1 }))}>
                  <SelectTrigger className="w-[170px]"><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="REGULAR">Regular</SelectItem>
                    <SelectItem value="DRIVER_AIDE">Driver / Aide</SelectItem>
                    <SelectItem value="DRIVER_AIDE_AM">Driver AM</SelectItem>
                    <SelectItem value="DRIVER_AIDE_PM">Driver PM</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Date range — pending until Apply is clicked */}
              <Input
                type="date"
                value={pendingDates.from}
                onChange={(e) => setPendingDates((p) => ({ ...p, from: e.target.value }))}
                className="w-[160px]"
              />
              <Input
                type="date"
                value={pendingDates.to}
                onChange={(e) => setPendingDates((p) => ({ ...p, to: e.target.value }))}
                className="w-[160px]"
              />
              <Button
                size="sm"
                onClick={() => setQueryParams((p) => ({ ...p, from: pendingDates.from, to: pendingDates.to, page: 1 }))}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Apply
              </Button>
              {(pendingDates.from !== queryParams.from || pendingDates.to !== queryParams.to) && (
                <span className="text-xs text-amber-500 font-medium">Unsaved date range</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* My Requests */}
        {myRequests.length > 0 && (
          <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
            <div className="h-1 w-full bg-orange-500" />
            <CardHeader
              className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setRequestsExpanded(!requestsExpanded)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <AlarmClockPlus className="h-5 w-5 text-orange-500 shrink-0" />
                  <CardTitle className="text-base truncate">My Punch Log Requests</CardTitle>
                  {myRequests.filter((r) => r.status === "PENDING").length > 0 && (
                    <span className="shrink-0 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {myRequests.filter((r) => r.status === "PENDING").length} Pending
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:inline">{myRequests.length} total</span>
                  {requestsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </CardHeader>

            <AnimatePresence>
              {requestsExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <CardContent className="pt-0 pb-4">
                    {loadingRequests ? (
                      <div className="flex items-center justify-center py-8 gap-2">
                        <OrangeLoadingSpinner />
                        <span className="text-sm text-muted-foreground">Loading requests...</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {myRequests.map((req) => {
                          const statusMeta = {
                            PENDING:  { border: "border-l-amber-400", bg: "bg-amber-50 dark:bg-amber-900/10",  badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",  dot: "bg-amber-400",  label: "Pending"  },
                            APPROVED: { border: "border-l-green-500", bg: "bg-green-50 dark:bg-green-900/10",  badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",  dot: "bg-green-500",  label: "Approved" },
                            REJECTED: { border: "border-l-red-500",   bg: "bg-red-50   dark:bg-red-900/10",    badge: "bg-red-100   text-red-800   dark:bg-red-900/30   dark:text-red-400",    dot: "bg-red-500",    label: "Rejected" },
                          }[req.status] ?? { border: "border-l-muted", bg: "", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground", label: req.status };

                          const approverName = req.approver?.profile
                            ? `${req.approver.profile.firstName} ${req.approver.profile.lastName}`
                            : req.approver?.email || "Not assigned";

                          return (
                            <div key={req.id} className={`rounded-xl border border-l-4 ${statusMeta.border} ${statusMeta.bg} overflow-hidden`}>

                              {/* Header row: date + status */}
                              <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Calendar className="h-4 w-4 text-orange-500 shrink-0" />
                                  <span className="font-semibold text-sm leading-snug">
                                    {new Date((req.requestedDate?.split("T")[0] ?? "") + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                </div>
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 ${statusMeta.badge}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusMeta.dot}`} />
                                  {statusMeta.label}
                                </span>
                              </div>

                              {/* Time row */}
                              <div className="flex items-center gap-1.5 px-3 pb-2 text-sm">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-muted-foreground">
                                  {safeTime(req.requestedClockIn, companyTimezone)} – {safeTime(req.requestedClockOut, companyTimezone)}
                                </span>
                                <span className="font-semibold text-foreground">({req.estimatedNetHours?.toFixed(2) || "0.00"}h)</span>
                              </div>

                              {/* Reason + description */}
                              <div className="px-3 pb-2 space-y-1.5">
                                <div className="flex items-center gap-1.5 text-sm flex-wrap">
                                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                  <span className="font-medium">Reason:</span>
                                  <span className="text-muted-foreground capitalize">{req.reason?.replace(/_/g, " ") || "Not specified"}</span>
                                </div>
                                {req.description && (
                                  <div className="flex items-start gap-1.5">
                                    <FileText className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-muted-foreground line-clamp-2">{req.description}</p>
                                  </div>
                                )}
                              </div>

                              {/* Footer: approver + submitted date */}
                              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 border-t border-black/5 dark:border-white/5 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  <User className="h-3 w-3 shrink-0" />
                                  <span className="truncate max-w-[180px]">{approverName}</span>
                                </div>
                                <span className="shrink-0">
                                  Submitted {new Date(req.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </span>
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        )}

        {/* Main table */}
        <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
          <div className="h-1 w-full bg-orange-500" />
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Punch Logs
              {isDayCare && (
                <span className="ml-2 text-xs font-normal text-muted-foreground flex items-center gap-1">
                  <Car className="h-3 w-3 text-blue-500" /> Driver/Aide hours: 1.25 AM + Regular + 1.25 PM
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    {columnOptions
                      .filter((c) => columnVisibility.includes(c.value))
                      .map(({ value, label }) => (
                        <TableHead key={value} className="cursor-pointer" onClick={() => requestSort(value)}>
                          <div className="flex items-center gap-1">
                            {label}
                            {sortConfig.key === value && (
                              sortConfig.direction === "ascending"
                                ? <ChevronUp className="h-4 w-4" />
                                : <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </TableHead>
                      ))}
                    <TableHead className="text-center w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableSkeleton rows={6} cols={columnVisibility.length + 2} />
                  ) : displayed.length ? (
                    <AnimatePresence>
                      {displayed.map((log) => (
                        <TimelogRow
                          key={log.id}
                          log={log}
                          columnVisibility={columnVisibility}
                          isDayCare={isDayCare}
                          companyTimezone={companyTimezone}
                          userTimezone={userTimezone}
                          expanded={expandedRow === log.id}
                          onToggleExpand={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                          onSchedule={(list) => { setSchedForDialog(list); setSchedDialogOpen(true); }}
                          onRequestOT={(l) => {
                            setOtForLog(l);
                            setOtSelectedLogId(l.id);
                            setOtApprover(""); setOtHoursEdit(""); setOtReason("");
                            setOtDialogOpen(true);
                          }}
                          onLocation={(list) => { setLocDialogList(list); setLocDialogOpen(true); }}
                        />
                      ))}
                    </AnimatePresence>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columnVisibility.length + 2} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <div className="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Clock className="h-8 w-8 text-orange-500/50" />
                          </div>
                          <p className="font-medium">No logs match the selected filters</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          {totalPages > 1 && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" disabled={queryParams.page === 1} onClick={() => setQueryParams((p) => ({ ...p, page: 1 }))}>
                  <ChevronsLeft className="h-4 w-4" /> First
                </Button>
                {[...Array(totalPages)].map((_, i) => {
                  const pg = i + 1;
                  if (pg === 1 || pg === totalPages || Math.abs(pg - queryParams.page) <= 1)
                    return <Button key={pg} size="sm" variant={pg === queryParams.page ? "default" : "outline"} onClick={() => setQueryParams((p) => ({ ...p, page: pg }))}>{pg}</Button>;
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
                  {supervisors.length > 0 ? (
                    <>{<div className="px-2 py-1 text-xs font-medium text-muted-foreground">Team Supervisors</div>}{supervisors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} - {s.department}</SelectItem>)}</>
                  ) : (
                    <>{<div className="px-2 py-1 text-xs font-medium text-muted-foreground">Approvers</div>}{approvers.map((a) => <SelectItem key={a.id} value={a.id}>{a.name || a.email}</SelectItem>)}</>
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

        {/* Request Punch Log — Multi-step Bottom Sheet */}
        <Sheet
          open={requestPunchLogsDialog}
          onOpenChange={(open) => {
            if (!open) {
              setRequestPunchLogsDialog(false);
              setRequestStep(1);
              setRequestPunchDate(""); setRequestClockIn(""); setRequestClockOut("");
              setRequestApproverId(""); setRequestReason(""); setRequestDescription("");
              setRequestErrors({});
            }
          }}
        >
          <SheetContent side="bottom" className="h-[88vh] rounded-t-2xl p-0 flex flex-col border-t-0 focus:outline-none">

            {/* Orange accent bar */}
            <div className="h-1.5 w-full bg-orange-500 rounded-t-2xl shrink-0" />

            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Header */}
            <div className="px-5 pt-2 pb-3 shrink-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                  <AlarmClockPlus className="h-4.5 w-4.5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base leading-tight">Request Punch Log Entry</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {["Date & Times", "Approver & Reason", "Review & Submit"][requestStep - 1]}
                  </p>
                </div>
                <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-full shrink-0">
                  {requestStep} / 3
                </span>
              </div>

              {/* Step progress bar */}
              <div className="flex gap-1.5">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                      s < requestStep  ? "bg-orange-400" :
                      s === requestStep ? "bg-orange-500" :
                      "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] font-medium text-muted-foreground">
                <span className={requestStep === 1 ? "text-orange-500" : ""}>Date & Times</span>
                <span className={requestStep === 2 ? "text-orange-500" : ""}>Approver</span>
                <span className={requestStep === 3 ? "text-orange-500" : ""}>Details</span>
              </div>
            </div>

            {/* Scrollable step content */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-5 pb-6">

                {/* ── Step 1: Date & Times ── */}
                {requestStep === 1 && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-orange-500" />
                        Date <span className="text-orange-500">*</span>
                      </label>
                      <Input
                        type="date"
                        value={requestPunchDate}
                        max={getDefaultTo(companyTimezone)}
                        onChange={(e) => {
                          const d = e.target.value;
                          setRequestPunchDate(d);
                          setRequestErrors((p) => ({ ...p, date: undefined }));
                          const existing = logs.find((l) => toLocalDateStr(l.timeIn, companyTimezone) === d);
                          if (existing) setRequestErrors((p) => ({ ...p, date: "A punch log already exists for this date" }));
                          if (d && defaultHours) { setRequestClockIn(`${d}T09:00`); setRequestClockOut(`${d}T${String(9 + defaultHours).padStart(2, "0")}:00`); }
                        }}
                        className={`h-12 text-base ${requestErrors.date ? "border-red-500" : ""}`}
                      />
                      {requestErrors.date && (
                        <p className="text-red-500 text-xs flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />{requestErrors.date}
                        </p>
                      )}
                    </div>

                    {requestPunchDate && !requestErrors.date && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-semibold flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-green-500" />
                              Clock In <span className="text-orange-500">*</span>
                            </label>
                            <Input
                              type="time"
                              value={requestClockIn.split("T")[1] || ""}
                              onChange={(e) => { setRequestClockIn(`${requestPunchDate}T${e.target.value}`); setRequestErrors((p) => ({ ...p, clockIn: undefined })); }}
                              className={`h-12 text-base ${requestErrors.clockIn ? "border-red-500" : ""}`}
                            />
                            {requestErrors.clockIn && (
                              <p className="text-red-500 text-xs flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />{requestErrors.clockIn}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-red-500" />
                              Clock Out <span className="text-orange-500">*</span>
                            </label>
                            <Input
                              type="time"
                              value={requestClockOut.split("T")[1] || ""}
                              onChange={(e) => { setRequestClockOut(`${requestPunchDate}T${e.target.value}`); setRequestErrors((p) => ({ ...p, clockOut: undefined })); }}
                              className={`h-12 text-base ${requestErrors.clockOut ? "border-red-500" : ""}`}
                            />
                            {requestErrors.clockOut && (
                              <p className="text-red-500 text-xs flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />{requestErrors.clockOut}
                              </p>
                            )}
                          </div>
                        </div>

                        {requestClockIn && requestClockOut && !requestErrors.clockIn && !requestErrors.clockOut && (
                          <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4 text-orange-500" />
                              Estimated Net Hours
                            </div>
                            <span className="text-xl font-bold text-orange-600">
                              {toHour(Math.max(0, diffMins(requestClockIn, requestClockOut) - minLunchMins))}h
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ── Step 2: Approver & Reason ── */}
                {requestStep === 2 && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-orange-500" />
                        Approver <span className="text-orange-500">*</span>
                      </label>
                      <Select value={requestApproverId} onValueChange={(v) => { setRequestApproverId(v); setRequestErrors((p) => ({ ...p, approverId: undefined })); }}>
                        <SelectTrigger className={`w-full h-12 text-base ${requestErrors.approverId ? "border-red-500" : ""}`}>
                          <SelectValue placeholder="Select approver" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {(supervisors.length > 0 ? supervisors : approvers).map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{a.name || a.email}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {requestErrors.approverId && (
                        <p className="text-red-500 text-xs flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />{requestErrors.approverId}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                        Reason <span className="text-orange-500">*</span>
                      </label>
                      <Select value={requestReason} onValueChange={(v) => { setRequestReason(v); setRequestErrors((p) => ({ ...p, reason: undefined })); }}>
                        <SelectTrigger className={`w-full h-12 text-base ${requestErrors.reason ? "border-red-500" : ""}`}>
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          {["forgot_to_clock", "system_malfunction", "network_issues", "emergency", "remote_work", "power_outage", "meeting_offsite", "other"].map((v) => (
                            <SelectItem key={v} value={v}>
                              {v.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {requestErrors.reason && (
                        <p className="text-red-500 text-xs flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />{requestErrors.reason}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Step 3: Details & Confirm ── */}
                {requestStep === 3 && (
                  <div className="space-y-5">
                    {/* Summary card */}
                    <div className="rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4 space-y-3">
                      <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">Request Summary</p>
                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Date</span>
                          <span className="font-semibold">
                            {requestPunchDate ? new Date(requestPunchDate + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-green-500" />Clock In</span>
                          <span className="font-semibold text-green-600">{requestClockIn.split("T")[1] || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-red-500" />Clock Out</span>
                          <span className="font-semibold text-red-600">{requestClockOut.split("T")[1] || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center border-t pt-2">
                          <span className="text-muted-foreground">Net Hours</span>
                          <span className="font-bold text-orange-600 text-base">
                            {toHour(Math.max(0, diffMins(requestClockIn, requestClockOut) - minLunchMins))}h
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Approver</span>
                          <span className="font-semibold truncate max-w-[55%] text-right">
                            {(supervisors.length > 0 ? supervisors : approvers).find((a) => a.id === requestApproverId)?.name || "—"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />Reason</span>
                          <span className="font-semibold capitalize">{requestReason.replace(/_/g, " ") || "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-orange-500" />
                        Detailed Explanation <span className="text-orange-500">*</span>
                      </label>
                      <Textarea
                        value={requestDescription}
                        onChange={(e) => { setRequestDescription(e.target.value); setRequestErrors((p) => ({ ...p, description: undefined })); }}
                        placeholder="Please explain why you need this entry..."
                        className={`min-h-[120px] resize-none text-base ${requestErrors.description ? "border-red-500" : ""}`}
                        maxLength={500}
                      />
                      <div className="flex justify-between text-xs">
                        <span className={requestDescription.trim().length < 20 ? "text-amber-500 font-medium" : "text-green-600 font-medium"}>
                          {requestDescription.length}/500
                          {requestDescription.trim().length < 20 && requestDescription.length > 0 && (
                            <span className="ml-1">({20 - requestDescription.trim().length} more needed)</span>
                          )}
                        </span>
                        {requestErrors.description && <span className="text-red-500">{requestErrors.description}</span>}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </ScrollArea>

            {/* Footer navigation */}
            <div className="px-5 py-4 border-t bg-background shrink-0 flex gap-3">
              {requestStep > 1 ? (
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => setRequestStep((s) => s - 1)}
                  disabled={requestSubmitting}
                >
                  ← Back
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => {
                    setRequestPunchLogsDialog(false);
                    setRequestStep(1);
                    setRequestPunchDate(""); setRequestClockIn(""); setRequestClockOut("");
                    setRequestApproverId(""); setRequestReason(""); setRequestDescription("");
                    setRequestErrors({});
                  }}
                  disabled={requestSubmitting}
                >
                  Cancel
                </Button>
              )}

              {requestStep < 3 ? (
                <Button
                  className="flex-1 h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                  disabled={requestStep === 1 && !!requestErrors.date}
                  onClick={() => {
                    const errors = {};
                    if (requestStep === 1) {
                      if (!requestPunchDate)  errors.date     = "Please select a date";
                      if (!requestClockIn)    errors.clockIn  = "Please provide clock-in time";
                      if (!requestClockOut)   errors.clockOut = "Please provide clock-out time";
                      if (requestClockIn && requestClockOut && requestClockIn >= requestClockOut) errors.clockIn = "Clock in must be before clock out";
                    }
                    if (requestStep === 2) {
                      if (!requestApproverId) errors.approverId = "Please select an approver";
                      if (!requestReason)     errors.reason     = "Please select a reason";
                    }
                    setRequestErrors(errors);
                    if (Object.keys(errors).length === 0) setRequestStep((s) => s + 1);
                  }}
                >
                  Next →
                </Button>
              ) : (
                <Button
                  className="flex-1 h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                  disabled={requestSubmitting}
                  onClick={async () => {
                    const errors = {};
                    if (!requestDescription.trim()) errors.description = "Please provide a detailed explanation";
                    else if (requestDescription.trim().length < 20) errors.description = "Please provide more detail (at least 20 chars)";
                    setRequestErrors(errors);
                    if (Object.keys(errors).length > 0) { toast.error("Please fill in all required fields"); return; }
                    setRequestSubmitting(true);
                    try {
                      const res = await fetch(`${API_URL}/api/request-punch-log/submit`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ requestedDate: requestPunchDate, requestedClockIn: requestClockIn, requestedClockOut: requestClockOut, approverId: requestApproverId, reason: requestReason, description: requestDescription, estimatedDuration: diffMins(requestClockIn, requestClockOut), estimatedNetHours: parseFloat(toHour(Math.max(0, diffMins(requestClockIn, requestClockOut) - minLunchMins))) }),
                      });
                      const result = await res.json();
                      if (res.ok) {
                        toast.success("Punch log request submitted!");
                        setRequestPunchLogsDialog(false);
                        setRequestStep(1);
                        setRequestPunchDate(""); setRequestClockIn(""); setRequestClockOut(""); setRequestApproverId(""); setRequestReason(""); setRequestDescription(""); setRequestErrors({});
                        fetchMyRequests();
                      } else { toast.error(result.message || "Failed to submit"); }
                    } catch { toast.error("Failed to submit. Please try again."); }
                    finally { setRequestSubmitting(false); }
                  }}
                >
                  {requestSubmitting ? <><OrangeLoadingSpinner /><span className="ml-2">Submitting...</span></> : "Submit Request"}
                </Button>
              )}
            </div>

          </SheetContent>
        </Sheet>

        <ContestDialog
          open={contestDialogOpen}
          onOpenChange={setContestDialogOpen}
          companyTimezone={companyTimezone}
          filteredSorted={filteredSorted}
          approvers={approvers}
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

// ── TimelogRow ─────────────────────────────────────────────────────────────────
function TimelogRow({ log, columnVisibility, isDayCare, companyTimezone, userTimezone, expanded, onToggleExpand, onSchedule, onRequestOT, onLocation }) {
  const locIn  = getLocation(log, "in");
  const locOut = getLocation(log, "out");

  // DA breakdown — schedule-derived time ranges and pre-schedule gap detection
  const regularShiftEntry  = log.scheduleList?.find((s) => s.shift?.shiftName?.toLowerCase().includes("regular"));
  const schedStartStr      = regularShiftEntry?.shift?.startTime ? fmtUTCTime(regularShiftEntry.shift.startTime) : null;
  const schedEndStr        = regularShiftEntry?.shift?.endTime   ? fmtUTCTime(regularShiftEntry.shift.endTime)   : null;
  const schedStartMins     = regularShiftEntry?.shift?.startTime
    ? new Date(regularShiftEntry.shift.startTime).getUTCHours() * 60 + new Date(regularShiftEntry.shift.startTime).getUTCMinutes()
    : null;
  const timeInLocalMins    = log.timeIn ? toLocalMinutes(log.timeIn, companyTimezone) : null;
  const preScheduleGapMins = (schedStartMins != null && timeInLocalMins != null && timeInLocalMins < schedStartMins)
    ? schedStartMins - timeInLocalMins
    : 0;
  const driverPMShiftEntry = log.scheduleList?.find((s) => s.shift?.shiftName?.toLowerCase().includes("pm"));
  const driverPMEndStr     = driverPMShiftEntry?.shift?.endTime ? fmtUTCTime(driverPMShiftEntry.shift.endTime) : null;

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="border-b hover:bg-muted/50 cursor-pointer group"
        onClick={onToggleExpand}
      >
        <TableCell className="w-12">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </Button>
        </TableCell>

        {columnVisibility.includes("date") && (
          <TableCell className="font-medium">
            <span className="text-sm">
              {log.timeIn ? new Date(log.timeIn).toLocaleDateString("en-US", {
                weekday: "short", year: "numeric", month: "long", day: "numeric",
                ...(companyTimezone ? { timeZone: companyTimezone } : {}),
              }) : "—"}
            </span>
          </TableCell>
        )}
        {columnVisibility.includes("timeIn")  && <TableCell><DualTime value={log.timeIn}  companyTz={companyTimezone} userTz={userTimezone} /></TableCell>}
        {columnVisibility.includes("timeOut") && <TableCell><DualTime value={log.timeOut} companyTz={companyTimezone} userTz={userTimezone} /></TableCell>}
        {columnVisibility.includes("duration") && <TableCell className="text-sm font-medium">{log.duration}h</TableCell>}

        {columnVisibility.includes("ot") && (
          <TableCell>
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium">{log.otHours}h</div>
              {log.otStatus === "No Approval" ? (
                <Button size="sm" variant="outline" className="h-6 text-xs" onClick={(e) => { e.stopPropagation(); onRequestOT(log); }}>
                  Request
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">{log.otStatus}</span>
              )}
            </div>
          </TableCell>
        )}

        {columnVisibility.includes("punchType") && (
          <TableCell>
            {isDayCare ? <PunchTypeBadge punchType={log.punchType} /> : null}
          </TableCell>
        )}

        {columnVisibility.includes("cutoffApproval") && (
          <TableCell className="text-center">
            <CutoffApprovalBadge cutoffApproval={log.cutoffApproval} />
          </TableCell>
        )}

        {columnVisibility.includes("status") && (
          <TableCell>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
              log.status
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-gray-100  text-gray-800  dark:bg-gray-900/30  dark:text-gray-400"
            }`}>
              {log.status ? "Active" : "Completed"}
            </span>
          </TableCell>
        )}

        <TableCell className="text-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSchedule(log.scheduleList); }}>
                <Calendar className="h-4 w-4 mr-2" /> View Schedule
              </DropdownMenuItem>
              {log.isLocRestricted && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onLocation(log.locList); }}>
                  <MapPin className="h-4 w-4 mr-2" /> View Location
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </motion.tr>

      {/* Expanded row */}
      {expanded && (
        <motion.tr
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="bg-muted/30"
        >
          <TableCell colSpan={columnVisibility.length + 2} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Break Times / Hours Breakdown */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  {log.isAnyDA ? "Hours Breakdown" : "Break Times"}
                </h4>

                {log.isAnyDA ? (
                  /* ── Driver/Aide breakdown — adapts to AM/PM/full variants ── */
                  <div className="space-y-1 text-sm">
                    {/* Pre-schedule inline note */}
                    {preScheduleGapMins > 0 && schedStartStr && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Clock-in {safeTime(log.timeIn, companyTimezone)} · {preScheduleGapMins} min before schedule ({schedStartStr}), excluded
                      </p>
                    )}
                    {/* AM row — only for DRIVER_AIDE and DRIVER_AIDE_AM */}
                    {(log.isDA || log.isDA_AM) && (
                      <div className="flex justify-between items-baseline py-1">
                        <span className="text-muted-foreground">Driver/Aide AM</span>
                        <span className="font-medium tabular-nums">
                          {log.driverAideAMHours != null ? `${log.driverAideAMHours.toFixed(2)}h` : "—"}
                        </span>
                      </div>
                    )}
                    {/* Regular row — always shown */}
                    <div className="flex justify-between items-baseline py-1">
                      <div>
                        <span className="text-muted-foreground">Regular</span>
                        {schedStartStr && schedEndStr && (
                          <span className="text-xs text-muted-foreground/60 ml-2">{schedStartStr} → {schedEndStr}</span>
                        )}
                      </div>
                      <span className="font-medium tabular-nums">
                        {log.regularHoursForLog != null ? `${log.regularHoursForLog.toFixed(2)}h` : "—"}
                      </span>
                    </div>
                    {/* PM row — only for DRIVER_AIDE and DRIVER_AIDE_PM */}
                    {(log.isDA || log.isDA_PM) && (
                      <div className="flex justify-between items-baseline py-1">
                        <div>
                          <span className="text-muted-foreground">Driver/Aide PM</span>
                          {schedEndStr && driverPMEndStr && (
                            <span className="text-xs text-muted-foreground/60 ml-2">{schedEndStr} → {driverPMEndStr}</span>
                          )}
                        </div>
                        <span className="font-medium tabular-nums">
                          {log.driverAidePMHours != null ? `${log.driverAidePMHours.toFixed(2)}h` : "—"}
                        </span>
                      </div>
                    )}
                    {/* OT row — only for DA/DA_PM when server-detected OT > 0 */}
                    {(log.isDA || log.isDA_PM) && log.daRawOtHours > 0 && (
                      <div className="flex justify-between items-baseline py-1">
                        <div>
                          <span className="text-muted-foreground">Overtime</span>
                          {driverPMEndStr && log.timeOut && (
                            <span className="text-xs text-muted-foreground/60 ml-2">{driverPMEndStr} → {safeTime(log.timeOut, companyTimezone)}</span>
                          )}
                        </div>
                        <span className="font-medium tabular-nums text-orange-500">{log.daRawOtHours.toFixed(2)}h</span>
                      </div>
                    )}
                    {/* Separator + Total */}
                    <div className="border-t pt-2 mt-1 flex justify-between items-baseline">
                      <span className="font-semibold">Total Net Hours</span>
                      <span className="font-bold tabular-nums text-orange-500">{log.duration}h</span>
                    </div>
                    {/* Deducted breaks */}
                    <div className="pt-2 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Coffee Break</span>
                        <span className="flex items-center gap-1">
                          {log.coffeeMins}h
                          {(log.autoCoffeeApplied || log.coffeeBreaks?.some(b => b.auto)) && <AutoBreakBadge deductible={log.coffeeBreaks?.find(b => b.auto)?.deductible ?? true} />}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Lunch Break</span>
                        <span className="flex items-center gap-1">
                          {log.lunchMins}h
                          {(log.autoLunchApplied || log.lunchBreak?.auto) && <AutoBreakBadge deductible={log.lunchBreak?.deductible ?? true} />}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Regular breakdown ── */
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between py-1"><span className="text-muted-foreground">Coffee Break</span><span className="font-medium tabular-nums flex items-center gap-1">{log.coffeeMins}h{(log.autoCoffeeApplied || log.coffeeBreaks?.some(b => b.auto)) && <AutoBreakBadge deductible={log.coffeeBreaks?.find(b => b.auto)?.deductible ?? true} />}</span></div>
                    <div className="flex justify-between py-1"><span className="text-muted-foreground">Lunch Break</span><span className="font-medium tabular-nums flex items-center gap-1">{log.lunchMins}h{(log.autoLunchApplied || log.lunchBreak?.auto) && <AutoBreakBadge deductible={log.lunchBreak?.deductible ?? true} />}</span></div>
                    <div className="flex justify-between py-1"><span className="text-muted-foreground">Late Hours</span><span className="font-medium tabular-nums">{parseFloat(log.lateHours) > 0 ? `${log.lateHours}h` : "—"}</span></div>
                    <div className="flex justify-between py-1"><span className="text-muted-foreground">Period Hours</span><span className="font-medium tabular-nums">{log.periodHours}h</span></div>
                  </div>
                )}
              </div>

              {/* Device & Location */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-orange-500" />
                  Device &amp; Location
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground block mb-1">Device In:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded block">{log.fullDevIn}</code>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Device Out:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded block">{log.fullDevOut}</code>
                  </div>
                  {locIn.lat && (
                    <div>
                      <span className="text-muted-foreground block mb-1">Location In:</span>
                      <a href={`https://www.google.com/maps?q=${locIn.lat},${locIn.lng}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-500 hover:underline">{locIn.txt}</a>
                    </div>
                  )}
                  {locOut.lat && (
                    <div>
                      <span className="text-muted-foreground block mb-1">Location Out:</span>
                      <a href={`https://www.google.com/maps?q=${locOut.lat},${locOut.lng}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-500 hover:underline">{locOut.txt}</a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TableCell>
        </motion.tr>
      )}
    </>
  );
}

// ── ScheduleDialog ─────────────────────────────────────────────────────────────
// Colour + label config keyed on shift name keywords
const SHIFT_STYLE = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("am") || n.includes("driver") && n.includes("am"))
    return { bg: "bg-blue-50 dark:bg-blue-950", border: "border-blue-300 dark:border-blue-700", dot: "bg-blue-500", text: "text-blue-700 dark:text-blue-300", label: "Driver / Aide AM" };
  if (n.includes("pm") || n.includes("driver") && n.includes("pm"))
    return { bg: "bg-indigo-50 dark:bg-indigo-950", border: "border-indigo-300 dark:border-indigo-700", dot: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-300", label: "Driver / Aide PM" };
  if (n.includes("driver") || n.includes("aide"))
    return { bg: "bg-blue-50 dark:bg-blue-950", border: "border-blue-300 dark:border-blue-700", dot: "bg-blue-500", text: "text-blue-700 dark:text-blue-300", label: "Driver / Aide" };
  // Default — regular shift
  return { bg: "bg-orange-50 dark:bg-orange-950", border: "border-orange-300 dark:border-orange-700", dot: "bg-orange-500", text: "text-orange-700 dark:text-orange-300", label: "Regular Shift" };
};

function ScheduleDialog({ open, onOpenChange, scheduleList }) {
  // Sort shifts chronologically by startTime UTC hours
  const sorted = [...scheduleList].sort((a, b) => {
    const aH = a.shift?.startTime ? new Date(a.shift.startTime).getUTCHours() * 60 + new Date(a.shift.startTime).getUTCMinutes() : 0;
    const bH = b.shift?.startTime ? new Date(b.shift.startTime).getUTCHours() * 60 + new Date(b.shift.startTime).getUTCMinutes() : 0;
    return aH - bH;
  });

  // Compute total day span for the progress bar
  const allMins = sorted.map((s) => {
    const start = s.shift?.startTime ? new Date(s.shift.startTime).getUTCHours() * 60 + new Date(s.shift.startTime).getUTCMinutes() : 0;
    const end   = s.shift?.endTime   ? new Date(s.shift.endTime).getUTCHours()   * 60 + new Date(s.shift.endTime).getUTCMinutes()   : 0;
    return { start, end };
  });
  const dayStart = allMins.length ? Math.min(...allMins.map((m) => m.start)) : 0;
  const dayEnd   = allMins.length ? Math.max(...allMins.map((m) => m.end))   : 0;
  const daySpan  = dayEnd - dayStart || 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-2 dark:border-white/30">
        <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-orange-600" />
            Schedule Details
          </DialogTitle>
        </DialogHeader>

        {sorted.length ? (
          <ScrollArea className="max-h-[65vh]">
            <div className="px-1 pb-2 space-y-5">

              {/* ── Visual timeline bar ── */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{fmtUTCTime(sorted[0].shift?.startTime)}</span>
                  <span>{fmtUTCTime(sorted[sorted.length - 1].shift?.endTime)}</span>
                </div>
                <div className="relative h-5 rounded-full bg-muted overflow-hidden flex">
                  {allMins.map((m, i) => {
                    const style = SHIFT_STYLE(sorted[i].shift?.shiftName);
                    const left  = ((m.start - dayStart) / daySpan) * 100;
                    const width = ((m.end - m.start) / daySpan) * 100;
                    return (
                      <div
                        key={sorted[i].id}
                        className={`absolute h-full ${style.dot} opacity-80`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    );
                  })}
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Total: {toHour(dayEnd - dayStart)}h
                </p>
              </div>

              {/* ── Shift cards with connector lines ── */}
              <div className="relative">
                {/* vertical connector */}
                {sorted.length > 1 && (
                  <div className="absolute left-[18px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-muted-foreground/20 to-muted-foreground/20 z-0" />
                )}

                <div className="space-y-3 relative z-10">
                  {sorted.map((s, i) => {
                    const style    = SHIFT_STYLE(s.shift?.shiftName);
                    const startStr = s.shift?.startTime ? fmtUTCTime(s.shift.startTime) : "—";
                    const endStr   = s.shift?.endTime   ? fmtUTCTime(s.shift.endTime)   : "—";
                    let durMins    = 0;
                    if (s.shift?.startTime && s.shift?.endTime) {
                      durMins = diffMins(s.shift.startTime, s.shift.endTime);
                      if (durMins < 0) durMins += 1440;
                    }
                    const durStr = durMins ? `${toHour(durMins)}h` : "—";

                    return (
                      <div key={s.id} className="flex items-start gap-3">
                        {/* Timeline dot */}
                        <div className={`mt-3.5 h-4 w-4 rounded-full border-2 border-white dark:border-neutral-900 shadow-sm flex-shrink-0 ${style.dot}`} />

                        {/* Card */}
                        <div className={`flex-1 rounded-xl border ${style.bg} ${style.border} p-3`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className={`font-semibold text-sm ${style.text}`}>
                                {s.shift?.shiftName || style.label}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {startStr} — {endStr}
                              </p>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
                              {durStr}
                            </span>
                          </div>

                          {/* Connector hint between cards */}
                          {i < sorted.length - 1 && (() => {
                            const nextStart = sorted[i + 1].shift?.startTime
                              ? fmtUTCTime(sorted[i + 1].shift.startTime) : null;
                            return nextStart ? (
                              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                <span className="inline-block w-3 border-t border-dashed border-muted-foreground/40" />
                                Continues at {nextStart}
                              </p>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <Calendar className="h-8 w-8 opacity-30" />
            <p className="text-sm">No schedule for this day</p>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="bg-orange-500 hover:bg-orange-600 text-white">
            Close
          </Button>
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