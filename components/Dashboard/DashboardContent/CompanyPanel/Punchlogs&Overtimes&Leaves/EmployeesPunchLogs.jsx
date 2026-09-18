/* components/Dashboard/DashboardContent/CompanyPanel/PunchLogs&Overtime&Leaves/EmployeesPunchLogs.jsx */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { Fragment, useEffect, useMemo, useState, useCallback } from "react";
import {
  Clock,
  Filter,
  BookOpen,
  RefreshCw,
  Download,
  FileText,
  Calendar,
  Info,
  Globe,
  MapPin,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Pencil,
  Edit3,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Timer,
  Coffee,
  Users,
  Building,
  MapPinIcon,
  AlarmClockPlus,
  User,
  AlertTriangle,
  Car,
  UserCheck,
  LayoutTemplate,
  Trash2,
  Tag,
  X,
  Upload,
  History,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import YearlyTotalHoursReportTrigger from "./YearlyTotalHoursReportTrigger";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import IconBtn from "@/components/common/IconBtn";
import MultiSelect from "@/components/common/MultiSelect";
import ColumnSelector from "@/components/common/ColumnSelector";
import CutoffDateRangeFilter, { periodRangeKey, groupPeriodsByRange, groupStatus } from "@/components/common/CutoffDateRangeFilter";
import TableSkeleton from "@/components/common/TableSkeleton";
import { Textarea } from "@/components/ui/textarea";
import ImportPunchLogs from "./ImportPunchLogs";
import ImportBacktrackPunchLogs from "./ImportBacktrackPunchLogs";

// ── D-2: DA hour constants ─────────────────────────────────────────────────────
const DRIVER_AIDE_AM_HOURS      = 1.25;   // fixed always
const DRIVER_AIDE_REGULAR_HOURS = 5.5;    // fixed always
const DRIVER_AIDE_PM_HOURS      = 1.25;   // base for complete punch

// ── Utility helpers ────────────────────────────────────────────────────────────
const MAX_DEV_CHARS = 12;
const truncate = (s = "", L = MAX_DEV_CHARS) => (s.length > L ? s.slice(0, L) + "…" : s);
const fmtLastFirst = (firstName = "", lastName = "") => {
  if (!firstName && !lastName) return "—";
  if (!lastName) return firstName;
  if (!firstName) return lastName;
  return `${lastName}, ${firstName}`;
};

const safeDate = (d, timezone = "UTC") =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone }) : "—";
// For date-only values (e.g. a requested calendar date) — avoids off-by-one shifts from converting midnight UTC into a behind-UTC timezone.
const safeCalendarDate = (d) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12)).toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" });
};
const safeTime = (d, timezone = "UTC") =>
  d ? new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: timezone }) : "—";
const safeDateTime = (d, timezone = "UTC") =>
  d ? new Date(d).toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: timezone }) : "—";
const getTimezoneName = (tz) => { const p = tz.split("/"); return p[p.length - 1].replace(/_/g, " "); };

const diffMins = (a, b) => (new Date(b) - new Date(a)) / 60000;
const toHour   = (m) => (m / 60).toFixed(2);
const fmtUTCTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const toLocalDateStr = (d, tz) => d ? new Date(d).toLocaleDateString("en-CA", { timeZone: tz || "UTC" }) : null;

const toLocalMinutes = (isoStr, tz) => {
  if (!isoStr) return -1;
  const str = new Date(isoStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz || "UTC" });
  if (str === "24:00") return 0;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + (m || 0);
};
const getDefaultFrom = (tz = "UTC") => new Date().toLocaleDateString("en-CA", { timeZone: tz });
const getDefaultTo   = (tz = "UTC") => new Date().toLocaleDateString("en-CA", { timeZone: tz });

// ── NULL-SAFE break helpers ────────────────────────────────────────────────────
const coffeeMinutes = (arr) => {
  const safe = Array.isArray(arr) ? arr : [];
  return toHour(safe.reduce((m, b) => (b.start && b.end ? m + diffMins(b.start, b.end) : m), 0));
};
const lunchMinutesStr = (l) => (!l || !l.start || !l.end ? "0.00" : toHour(diffMins(l.start, l.end)));
const lunchMinutesNum = (l) => (!l || !l.start || !l.end ? 0 : diffMins(l.start, l.end));

const fmtDevice = (d) => {
  if (!d) return "—";
  if (typeof d === "string") return d;
  const b = d.manufacturer || d.brand;
  const m = d.deviceName || d.model;
  return [b, m].filter(Boolean).join(", ");
};
const fmtLoc = (loc) => {
  if (!loc || loc.latitude == null || loc.longitude == null) return { txt: "—", lat: null, lng: null };
  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  return { txt: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
};

const toCompanyInputValue = (iso, tz = "UTC") => {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type) => parts.find(p => p.type === type)?.value ?? "00";
  const h = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${h}:${get("minute")}`;
};
const fromCompanyInputToISO = (localStr, tz = "UTC") => {
  if (!localStr) return null;
  const [datePart, timePart] = localStr.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart || "00:00").split(":").map(Number);
  const nominalUTC = Date.UTC(year, month - 1, day, hour, minute, 0);
  const tzParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(nominalUTC));
  const g = (type) => Number(tzParts.find(p => p.type === type)?.value ?? 0);
  const tzH = g("hour") === 24 ? 0 : g("hour");
  const tzNominal = Date.UTC(g("year"), g("month") - 1, g("day"), tzH, g("minute"), 0);
  return new Date(nominalUTC + (nominalUTC - tzNominal)).toISOString();
};

// ── FIX 2: PunchTypeBadge — config-map for all 4 punch types ──────────────────
const PunchTypeBadge = ({ punchType, size = "sm" }) => {
  if (!punchType) return null;

  const config = {
    DRIVER_AIDE:    { label: "Driver/Aide", icon: Car,       color: "blue"   },
    DRIVER_AIDE_AM: { label: "Driver AM",   icon: Car,       color: "blue"   },
    DRIVER_AIDE_PM: { label: "Driver PM",   icon: Car,       color: "blue"   },
    REGULAR:        { label: "Regular",     icon: UserCheck, color: "purple" },
    TRAINING:       { label: "Training",    icon: BookOpen,  color: "green"  },
  };

  const meta = config[punchType] ?? config.REGULAR;
  const Icon = meta.icon;
  const colorClass =
    meta.color === "blue"   ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
    meta.color === "green"  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" :
                              "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
      size === "sm" ? "text-xs" : "text-sm"
    } ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
};

// ── CutoffApprovalBadge ────────────────────────────────────────────────────────
const CutoffApprovalBadge = ({ cutoffApproval, dayCutoffStatus, onClick }) => {
  // dayCutoffStatus is the server-computed day-level aggregate (accounts for
  // mixed approved/excluded segments); cutoffApproval.status is the older
  // single-record field, kept only as a fallback and for the period tooltip.
  const status = dayCutoffStatus ?? cutoffApproval?.status ?? null;

  if (!status) {
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

  const { cutoffPeriod } = cutoffApproval || {};

  const config = {
    approved: {
      icon: <CheckCircle className="w-3 h-3 mr-1" />,
      label: "Approved",
      cls: "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      tip: "Approved for payroll processing.",
    },
    pending: {
      icon: <AlertCircle className="w-3 h-3 mr-1" />,
      label: "Pending",
      cls: "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      tip: "Awaiting review in the cutoff period.",
    },
    rejected: {
      icon: <XCircle className="w-3 h-3 mr-1" />,
      label: "Rejected",
      cls: "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      tip: "Rejected during cutoff review. May require correction.",
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
          <Badge
            variant="outline"
            className={`text-xs cursor-pointer hover:opacity-80 ${meta.cls}`}
            onClick={onClick}
          >
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

// ── Status Badge ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        {status === "active" ? (
          <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 cursor-help">
            <Timer className="w-3 h-3 mr-1" />Active
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700 cursor-help">
            <CheckCircle className="w-3 h-3 mr-1" />Complete
          </Badge>
        )}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="text-sm">
          {status === "active"
            ? "Active: Employee is currently clocked in."
            : "Completed: Employee has clocked out."}
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// ── Overtime Badge ─────────────────────────────────────────────────────────────
const OvertimeBadge = ({ otStatus, overtimeRec, onClick }) => {
  const defs = {
    approved:      "Approved: Extra hours will be paid at overtime rate.",
    Approved:      "Approved: Period overtime has been reviewed and approved.",
    pending:       "Pending: Awaiting supervisor approval.",
    Included:      "Included: Overtime has been computed for this period and is pending admin approval.",
    rejected:      "Rejected: Request was denied.",
    "No Approval": "No Approval: Employee worked extra hours without a request.",
    "—":           "No overtime recorded for this shift.",
    "-":           "No overtime detected for this employee this period.",
  };
  const getConfig = (s) => {
    switch (s) {
      case "Approved":
      case "approved":  return { variant: "default",      icon: <CheckCircle className="w-3 h-3 mr-1" />, cls: "" };
      case "Included":  return { variant: "outline",      icon: <Clock className="w-3 h-3 mr-1" />,       cls: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
      case "pending":   return { variant: "secondary",    icon: <AlertCircle className="w-3 h-3 mr-1" />, cls: "" };
      case "rejected":  return { variant: "destructive",  icon: <XCircle className="w-3 h-3 mr-1" />,     cls: "" };
      default:          return { variant: "outline",      icon: <Timer className="w-3 h-3 mr-1" />,       cls: "" };
    }
  };
  const { variant, icon, cls } = getConfig(otStatus);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className={`cursor-pointer hover:opacity-80 capitalize text-xs ${cls}`} onClick={onClick}>
            {icon}{otStatus}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="text-sm">{defs[otStatus] || defs["—"]}</div>
          {overtimeRec && <div className="text-xs text-muted-foreground mt-1 pt-1 border-t">Click to view OT details</div>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ── Schedule Badge ─────────────────────────────────────────────────────────────
const ScheduleBadge = ({ isScheduled, onClick }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={isScheduled ? "default" : "secondary"} className="cursor-pointer hover:opacity-80 text-xs" onClick={onClick}>
          {isScheduled ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
          {isScheduled ? "Scheduled" : "Unscheduled"}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="text-sm">
          {isScheduled
            ? "Scheduled: Shift follows a predefined schedule."
            : "Unscheduled: Uses default company settings."}
        </div>
        <div className="text-xs text-muted-foreground mt-1 pt-1 border-t">Click to view schedule details</div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// ── Location Badge ─────────────────────────────────────────────────────────────
const LocationBadge = ({ isRestricted, onClick }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={isRestricted ? "default" : "secondary"}
          className={`cursor-pointer text-xs ${!isRestricted ? "opacity-50" : "hover:opacity-80"}`}
          onClick={isRestricted ? onClick : undefined}
        >
          <MapPinIcon className="w-3 h-3 mr-1" />
          {isRestricted ? "Required" : "None"}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="text-sm">
          {isRestricted
            ? "Location Required: GPS verified against approved work sites."
            : "No Location Restriction: Can clock in from any location."}
        </div>
        {isRestricted && <div className="text-xs text-muted-foreground mt-1 pt-1 border-t">Click to view allowed locations</div>}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// ── Time display with tooltip ──────────────────────────────────────────────────
const TimeDisplayWithTooltip = ({ time, type, className = "" }) => {
  const defs = {
    duration: "Duration: Total time between clock in and clock out, including breaks.",
    period:   "Period Hours: Productive work time excluding lunch and unauthorized OT.",
    late:     "Late Hours: Time the employee was late vs their scheduled start.",
    coffee:   "Coffee Breaks: Total time on coffee/short breaks.",
    lunch:    "Lunch Break: Time on lunch. Minimum may be auto-deducted.",
    overtime: "Overtime: Additional hours beyond the regular shift.",
  };
  if (!time || time === "—" || time === "0.00")
    return <span className={`text-muted-foreground text-xs ${className}`}>—</span>;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`cursor-help border-b border-dotted border-muted-foreground ${className}`}>
            {time}{type !== "coffee" ? " hrs" : ""}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs"><div className="text-sm">{defs[type] || ""}</div></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ── Dual time display ──────────────────────────────────────────────────────────
const DualTimeDisplay = ({ datetime, userTz, companyTz }) => {
  if (!datetime) return <span className="text-muted-foreground text-xs">—</span>;
  if (userTz === companyTz) return (
    <div className="text-xs">
      <div className="font-mono font-semibold">{safeDate(datetime, userTz)}</div>
      <div className="font-mono">{safeTime(datetime, userTz)}</div>
    </div>
  );
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="text-xs cursor-help">
            <div className="font-mono font-semibold text-primary">{safeDate(datetime, companyTz)} {safeTime(datetime, companyTz)}</div>
            <div className="font-mono text-muted-foreground text-[10px]">Detected time: {safeTime(datetime, userTz)}</div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          <div><strong>Company HQ ({getTimezoneName(companyTz)}):</strong> {safeDate(datetime, companyTz)} {safeTime(datetime, companyTz)}</div>
          <div className="text-muted-foreground">Detected time ({getTimezoneName(userTz)}): {safeDate(datetime, userTz)} {safeTime(datetime, userTz)}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ── Location display ───────────────────────────────────────────────────────────
const LocationDisplay = ({ location }) => {
  if (location.lat == null) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <a href={`https://www.google.com/maps?q=${location.lat},${location.lng}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline">
            <MapPin className="w-3 h-3" />View
          </a>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <div>Lat: {location.lat.toFixed(5)}</div>
            <div>Lng: {location.lng.toFixed(5)}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ── Device display ─────────────────────────────────────────────────────────────
const DeviceDisplay = ({ device }) => {
  if (!device || device === "—") return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs cursor-help border-b border-dotted border-muted-foreground">{truncate(device)}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs"><div className="text-xs whitespace-pre-wrap">{device}</div></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

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

// ── Summary Stats ──────────────────────────────────────────────────────────────
const SummaryStats = ({ data }) => {
  const stats = useMemo(() => ({
    active:    data.filter((d) => d.status === "active").length,
    completed: data.filter((d) => d.status === "completed").length,
    scheduled: data.filter((d) => d.isScheduled).length,
    avgHours:  data.length ? (data.reduce((s, d) => s + (parseFloat(d.periodHours) || 0), 0) / data.length).toFixed(1) : "0.0",
  }), [data]);

  const cards = [
    { key: "active",    label: "Active",    value: stats.active,    Icon: Timer,       cls: "blue",   def: "Employees currently clocked in." },
    { key: "completed", label: "Completed", value: stats.completed, Icon: CheckCircle, cls: "green",  def: "Finished work sessions ready for payroll." },
    { key: "scheduled", label: "Scheduled", value: stats.scheduled, Icon: Calendar,    cls: "orange", def: "Sessions following a predefined shift schedule." },
    { key: "avgHours",  label: "Avg Hours", value: stats.avgHours,  Icon: Clock,       cls: "purple", def: "Mean productive hours per session." },
  ];

  const clsMap = {
    blue:   { bg: "bg-blue-50 dark:bg-blue-950/20",     txt: "text-blue-600",   icon: "bg-blue-500/10"   },
    green:  { bg: "bg-green-50 dark:bg-green-950/20",   txt: "text-green-600",  icon: "bg-green-500/10"  },
    orange: { bg: "bg-orange-50 dark:bg-orange-950/20", txt: "text-orange-600", icon: "bg-orange-500/10" },
    purple: { bg: "bg-purple-50 dark:bg-purple-950/20", txt: "text-purple-600", icon: "bg-purple-500/10" },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map(({ key, label, value, Icon, cls, def }) => {
        const c = clsMap[cls];
        return (
          <TooltipProvider key={key} delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`flex items-center gap-3 p-3 rounded-lg ${c.bg} cursor-help transition-colors`}>
                  <div className={`p-2 rounded-full ${c.icon}`}>
                    <Icon className={`h-4 w-4 ${c.txt}`} />
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${c.txt}`}>{label}</div>
                    <div className="text-lg font-bold">{value}</div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs"><div className="text-sm">{def}</div></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
};

// ── FIX 4: DriverAideBreakdown — conditional AM/PM rows based on punch type ───
const DriverAideBreakdown = ({ log, companyTimezone }) => {
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
    <div className="space-y-2 text-sm">
      {/* Pre-schedule gap note */}
      {preScheduleGapMins > 0 && schedStartStr && (
        <p className="text-xs text-muted-foreground mb-2">
          Clock-in {safeTime(log.timeIn, companyTimezone)} · {preScheduleGapMins} min before schedule ({schedStartStr}), excluded
        </p>
      )}
      {/* AM row — only for DRIVER_AIDE and DRIVER_AIDE_AM */}
      {(log.isDA || log.isDA_AM) && (
        <div className="flex justify-between items-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
          <span className="text-blue-700 dark:text-blue-300 flex items-center gap-1">
            <Car className="h-3 w-3" /> Driver/Aide AM
            <span className="ml-1 text-xs text-muted-foreground font-normal">(fixed)</span>
          </span>
          <span className="font-bold text-blue-700 dark:text-blue-300">{log.daAMHours?.toFixed(2)}h</span>
        </div>
      )}
      {/* Regular row — always shown */}
      <div className="flex justify-between items-center p-2 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
        <span className="text-purple-700 dark:text-purple-300 flex items-center gap-1 flex-wrap">
          <UserCheck className="h-3 w-3" /> Regular Hours
          <span className="ml-1 text-xs text-muted-foreground font-normal">(fixed)</span>
          {schedStartStr && schedEndStr && (
            <span className="text-xs text-muted-foreground/60">{schedStartStr} → {schedEndStr}</span>
          )}
        </span>
        <span className="font-bold text-purple-700 dark:text-purple-300">{log.daRegularHours?.toFixed(2)}h</span>
      </div>
      {/* PM row — only for DRIVER_AIDE and DRIVER_AIDE_PM */}
      {(log.isDA || log.isDA_PM) && (
        <div className="flex justify-between items-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
          <span className="text-blue-700 dark:text-blue-300 flex items-center gap-1 flex-wrap">
            <Car className="h-3 w-3" /> Driver/Aide PM
            {/* D-3: show "actual" when clock-out was before PM end */}
            {log.daPMHours < (DRIVER_AIDE_PM_HOURS + (log.daApprovedOT || 0)) && (
              <span className="ml-1 text-xs text-amber-500 font-normal">(actual)</span>
            )}
            {log.daApprovedOT > 0 && (
              <span className="ml-1 text-xs text-green-600 dark:text-green-400">(+{log.daApprovedOT.toFixed(2)}h OT)</span>
            )}
            {schedEndStr && driverPMEndStr && (
              <span className="text-xs text-muted-foreground/60">{schedEndStr} → {driverPMEndStr}</span>
            )}
          </span>
          <span className="font-bold text-blue-700 dark:text-blue-300">{log.daPMHours?.toFixed(2)}h</span>
        </div>
      )}
      {/* OT row — only for DA/DA_PM when raw OT detected */}
      {(log.isDA || log.isDA_PM) && log.daRawOtHours > 0 && (
        <div className="flex justify-between items-center p-2 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
          <span className="text-orange-700 dark:text-orange-300 flex items-center gap-1">
            <AlarmClockPlus className="h-3 w-3" /> Overtime
            {driverPMEndStr && log.timeOut && (
              <span className="ml-1 text-xs text-muted-foreground/60">{driverPMEndStr} → {safeTime(log.timeOut, companyTimezone)}</span>
            )}
          </span>
          <span className="font-bold text-orange-700 dark:text-orange-300">{log.daRawOtHours.toFixed(2)}h</span>
        </div>
      )}
      {/* Total */}
      <div className="flex justify-between items-center p-2 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 font-bold">
        <span className="text-orange-700 dark:text-orange-300">Total Clock Hours</span>
        <span className="text-orange-700 dark:text-orange-300">{log.duration}h</span>
      </div>
      <div className="pt-1 border-t text-xs space-y-1">
        <div className="flex justify-between"><span className="text-muted-foreground">Coffee Break:</span><span>{log.coffeeMins}h</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Lunch Break:</span><span>{log.lunchMins}h</span></div>
      </div>
    </div>
  );
};

// ── ScheduleDialog ─────────────────────────────────────────────────────────────
const SHIFT_STYLE = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("am") || (n.includes("driver") && n.includes("am")))
    return { bg: "bg-blue-50 dark:bg-blue-950", border: "border-blue-300 dark:border-blue-700", dot: "bg-blue-500", text: "text-blue-700 dark:text-blue-300", label: "Driver / Aide AM" };
  if (n.includes("pm") || (n.includes("driver") && n.includes("pm")))
    return { bg: "bg-indigo-50 dark:bg-indigo-950", border: "border-indigo-300 dark:border-indigo-700", dot: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-300", label: "Driver / Aide PM" };
  if (n.includes("driver") || n.includes("aide"))
    return { bg: "bg-blue-50 dark:bg-blue-950", border: "border-blue-300 dark:border-blue-700", dot: "bg-blue-500", text: "text-blue-700 dark:text-blue-300", label: "Driver / Aide" };
  return { bg: "bg-orange-50 dark:bg-orange-950", border: "border-orange-300 dark:border-orange-700", dot: "bg-orange-500", text: "text-orange-700 dark:text-orange-300", label: "Regular Shift" };
};

const ScheduleDialog = ({ open, onOpenChange, scheduleList }) => {
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const sorted = [...scheduleList].sort((a, b) => {
    const aH = a.shift?.startTime ? new Date(a.shift.startTime).getUTCHours() * 60 + new Date(a.shift.startTime).getUTCMinutes() : 0;
    const bH = b.shift?.startTime ? new Date(b.shift.startTime).getUTCHours() * 60 + new Date(b.shift.startTime).getUTCMinutes() : 0;
    return aH - bH;
  });

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
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{sorted[0].shift?.startTime ? fmtUTCTime(sorted[0].shift.startTime) : "—"}</span>
                  <span>{sorted[sorted.length - 1].shift?.endTime ? fmtUTCTime(sorted[sorted.length - 1].shift.endTime) : "—"}</span>
                </div>
                <div className="relative h-5 rounded-full bg-muted overflow-hidden flex">
                  {allMins.map((m, i) => {
                    const style = SHIFT_STYLE(sorted[i].shift?.shiftName);
                    const left  = ((m.start - dayStart) / daySpan) * 100;
                    const width = ((m.end - m.start) / daySpan) * 100;
                    return (
                      <div key={sorted[i].id} className={`absolute h-full ${style.dot} opacity-80`}
                        style={{ left: `${left}%`, width: `${width}%` }} />
                    );
                  })}
                </div>
                <p className="text-xs text-center text-muted-foreground">Total: {toHour(dayEnd - dayStart)}h</p>
              </div>

              <div className="relative">
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
                    const daysLabel = Array.isArray(s.daysOfWeek)
                      ? s.daysOfWeek.map(Number).map((d) => DAY_NAMES[d] ?? "?").join(", ")
                      : null;
                    const periodStr = s.startDate
                      ? `${new Date(s.startDate).toLocaleDateString()}${s.endDate ? ` → ${new Date(s.endDate).toLocaleDateString()}` : " → Ongoing"}`
                      : null;

                    return (
                      <div key={s.id} className="flex items-start gap-3">
                        <div className={`mt-3.5 h-4 w-4 rounded-full border-2 border-white dark:border-neutral-900 shadow-sm flex-shrink-0 ${style.dot}`} />
                        <div className={`flex-1 rounded-xl border ${style.bg} ${style.border} p-3`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className={`font-semibold text-sm ${style.text}`}>{s.shift?.shiftName || style.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{startStr} — {endStr}</p>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>{durStr}</span>
                          </div>
                          {(periodStr || daysLabel) && (
                            <div className="mt-2 pt-2 border-t border-current/10 space-y-0.5">
                              {periodStr && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-2.5 w-2.5" /> {periodStr}
                                </p>
                              )}
                              {daysLabel && <p className="text-xs text-muted-foreground">Days: {daysLabel}</p>}
                            </div>
                          )}
                          {i < sorted.length - 1 && sorted[i + 1].shift?.startTime && (
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                              <span className="inline-block w-3 border-t border-dashed border-muted-foreground/40" />
                              Continues at {fmtUTCTime(sorted[i + 1].shift.startTime)}
                            </p>
                          )}
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
            <p className="text-sm">No schedule details available</p>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="bg-orange-500 hover:bg-orange-600 text-white">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Module-level export column map (shared by main + modal) ───────────────────
const COLUMN_MAP_FOR_EXPORT = {
  id: "Log ID", schedule: "Scheduled", locationRestricted: "Location Required",
  employee: "Employee", dateTimeIn: "Time In", dateTimeOut: "Time Out",
  duration: "Duration", gross: "Gross Hours", coffee: "Coffee Break", lunch: "Lunch Break",
  ot: "Overtime", otStatus: "OT Status", late: "Late Hours", undertime: "Undertime Hours",
  deviceIn: "Device In", deviceOut: "Device Out",
  locationIn: "Location In", locationOut: "Location Out",
  period: "Period Hours", status: "Status", punchType: "Punch Type",
  cutoffApproval: "Cutoff Status",
};

// ── Timelog enrichment (shared by fetchTimelogs + handleGenerateReport) ────────
function enrichTimelogs(rawData, { companyTimezone, isDayCare, otBasis, locMap, defaultHours }) {
  return rawData.map((t) => {
    const coffeeMinsStr = coffeeMinutes(t.coffeeBreaks);
    const lunchMinsStr  = (!t.lunchBreak?.start && (t.lunchDeductionMinutes ?? 0) > 0)
      ? (t.lunchDeductionMinutes / 60).toFixed(2)
      : lunchMinutesStr(t.lunchBreak);

    const dateKey   = toLocalDateStr(t.timeIn, companyTimezone) ?? "";
    const punchType = t.punchType ?? "REGULAR";
    const isDA    = punchType === "DRIVER_AIDE";
    const isDA_AM = punchType === "DRIVER_AIDE_AM";
    const isDA_PM = punchType === "DRIVER_AIDE_PM";
    const isAnyDA = isDA || isDA_AM || isDA_PM;

    const netWorkedHours = parseFloat(t.netWorkedHours ?? 0);
    const rawOtMins      = parseFloat(t.rawOtMinutes   ?? 0);

    const daAMHours      = isAnyDA ? (t.driverAmSegmentHours != null ? parseFloat(t.driverAmSegmentHours) : null) : null;
    const daRegularHours = isAnyDA ? (t.regularSegmentHours  != null ? parseFloat(t.regularSegmentHours)  : null) : null;
    const daPMHours      = isAnyDA ? (t.driverPmSegmentHours != null ? parseFloat(t.driverPmSegmentHours) : null) : null;
    const daRawOtHours   = rawOtMins / 60;
    const daTotalHours   = isAnyDA && daAMHours != null && daRegularHours != null && daPMHours != null
      ? +((daAMHours) + (daRegularHours) + (daPMHours)).toFixed(2) : null;

    const overtimeArr     = Array.isArray(t.overtime) ? t.overtime : [];
    const approvedOTHours = overtimeArr
      .filter((ot) => ot.status === "approved")
      .reduce((sum, ot) => sum + (parseFloat(ot.requestedHours) || 0), 0);
    const hasPendingOT    = overtimeArr.some((ot) => ot.status === "pending");
    const daApprovedOT    = approvedOTHours;

    const duration = t.netWorkedHours != null
      ? (isAnyDA && daTotalHours != null ? String(daTotalHours) : netWorkedHours.toFixed(2))
      : t.grossHours != null
        ? parseFloat(t.grossHours).toFixed(2)
        : toHour(t.timeIn && t.timeOut ? diffMins(t.timeIn, t.timeOut) : 0);

    const otHours = (rawOtMins / 60).toFixed(2);

    const otStatus = t.otStatus != null
      ? t.otStatus
      : approvedOTHours > 0 ? `Approved ${approvedOTHours.toFixed(2)}h`
      : hasPendingOT        ? "pending"
      : rawOtMins > 0       ? "No Approval"
      : "—";

    const periodHours    = t.scheduledHours != null ? parseFloat(t.scheduledHours).toFixed(2) : "0.00";
    const lateHours      = t.lateHours      != null ? parseFloat(t.lateHours).toFixed(2)      : "0.00";
    const undertimeHours = t.undertimeHours != null ? parseFloat(t.undertimeHours).toFixed(2) : "0.00";
    const grossHours     = t.grossHours     != null ? parseFloat(t.grossHours).toFixed(2)     : null;

    const isMissingClockOut = (() => {
      if (!isDayCare || t.status !== "active") return false;
      const expectedEndMs = new Date(t.timeIn).getTime() + defaultHours * 60 * 60 * 1000;
      return Date.now() > expectedEndMs;
    })();

    const locList = locMap[t.userId] ?? [];

    return {
      ...t,
      // Raw /api/timelogs rows carry the HR employee code as `employeeCode` (server-side
      // alias); normalize to `employeeId` here so both this path and buildRowsFromApprovals
      // feed the report's "ID" column the same field name.
      employeeId: t.employeeId ?? t.employeeCode ?? t.userId,
      dateKey, punchType,
      isDA, isDA_AM, isDA_PM, isAnyDA,
      scheduleList: (() => {
        const raw = t.userShifts?.length ? t.userShifts : (t.userShift ? [t.userShift] : []);
        const seen = new Set();
        return raw.filter((s) => {
          const key = s.shift?.id ?? s.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      })(),
      isScheduled:    !!(t.userShifts?.length || t.userShift),
      duration, lateHours, undertimeHours, grossHours, otHours, otStatus, periodHours,
      coffeeMins:  coffeeMinsStr,
      lunchMins:   lunchMinsStr,
      locIn:       fmtLoc(t.locIn),
      locOut:      fmtLoc(t.locOut),
      overtimeRec: overtimeArr[0] ?? null,
      fullDevIn:   fmtDevice(t.deviceIn)  || "—",
      fullDevOut:  fmtDevice(t.deviceOut) || "—",
      shiftName:   t.userShift?.shift?.shiftName ?? "—",
      schedOut:    "—",
      isLocRestricted: locList.length > 0,
      locList,
      daAMHours, daPMHours, daRegularHours, daApprovedOT, daTotalHours, daRawOtHours,
      pmStartDT: null, pmEndDT: null, isD4Flag: false,
      isDailyBasis: otBasis === "daily",
      otBasis,
      isMissingClockOut,
      isAutoClockOut: t.autoClockOut === true,
      cutoffApproval: t.cutoffApproval ?? null,
      dayCutoffStatus: t.dayCutoffStatus ?? null,
    };
  });
}

// ── Approved-cutoff report rows ─────────────────────────────────────────────
// Builds rows shaped like raw /api/timelogs records from GET /cutoff-periods/:id/approvals,
// so they can be fed through the same enrichTimelogs() + export functions used for the
// live path — no downstream changes needed. Only approval.status === "approved" (or
// "resolved", the punch-vs-leave-conflict outcome) segments/punches count toward hours;
// "excluded" contribute 0. This is what makes a locked cutoff's report match what was
// actually reviewed, instead of re-deriving live/raw punch data that doesn't reflect
// exclusions, overrides, or OT decisions made during review.
//
// approvalsData can be a single fetch's envelope, or a manually merged one (data/otBlocks
// concatenated across every department's approvals for the same pay period).
function buildRowsFromApprovals(approvalsData, companyTimezone) {
  const groups = new Map(); // `${userId}|${dateKey}` -> accumulator

  for (const approval of approvalsData.data || []) {
    const tl     = approval.timeLog || {};
    const user   = tl.user;
    const userId = user?.id;
    if (!userId || !tl.timeIn) continue;

    const dateKey = toLocalDateStr(tl.timeIn, companyTimezone);
    const key = `${userId}|${dateKey}`;
    if (!groups.has(key)) {
      groups.set(key, {
        userId,
        timeIn:  tl.timeIn,
        timeOut: tl.timeOut,
        employeeName: `${user.profile?.firstName || ""} ${user.profile?.lastName || user.username || ""}`.trim() || user.email || userId,
        // The canonical field on the User record is `employeeId` (see Employees.jsx,
        // "Company Employee ID") — `employeeCode` (used by the raw /api/timelogs path)
        // is an alias that endpoint adds, not a field on the User object itself, so it's
        // never present here. Reading the wrong name silently fell back to the raw
        // userId (a UUID), which is why only approved-path employees looked like they
        // were "missing" their ID.
        employeeId: user.employeeId ?? user.employeeCode ?? userId,
        employeeRole: user.role || "—",
        punchType: tl.punchType || "REGULAR",
        netWorkedHours: 0,
        driverAmSegmentHours: null,
        regularSegmentHours:  null,
        driverPmSegmentHours: null,
      });
    }
    const g = groups.get(key);
    if (tl.timeOut && (!g.timeOut || new Date(tl.timeOut) > new Date(g.timeOut))) g.timeOut = tl.timeOut;

    const isApproved   = approval.status === "approved" || approval.status === "resolved";
    const calc         = approval.calculatedData || {};
    const payroll      = approval.payrollSummary || {};
    const payableHours = isApproved ? (payroll.totalPayableHours ?? calc.payableHours ?? 0) : 0;

    if (approval.segmentType) {
      // Any DA punchType is enough to make enrichTimelogs() treat this as a driver/aide row
      // and read the three *SegmentHours fields below.
      g.punchType = "DRIVER_AIDE";
      if (approval.segmentType === "driver_am") g.driverAmSegmentHours = (g.driverAmSegmentHours || 0) + payableHours;
      if (approval.segmentType === "regular")   g.regularSegmentHours  = (g.regularSegmentHours  || 0) + payableHours;
      if (approval.segmentType === "driver_pm") g.driverPmSegmentHours = (g.driverPmSegmentHours || 0) + payableHours;
    } else {
      g.netWorkedHours += payableHours;
      // A day can have more than one non-segment approval record; if any of them is a
      // Training punch, the whole day must be classified Training regardless of which
      // record happened to be processed first — otherwise whichever record created the
      // group "wins" arbitrarily and Training hours silently get counted as Regular.
      if (tl.punchType === "TRAINING") g.punchType = "TRAINING";
      else if (g.punchType !== "TRAINING" && g.punchType !== "DRIVER_AIDE") g.punchType = tl.punchType || "REGULAR";
    }
  }

  // OT approval lives on otBlocks (approved/excluded per employee via the Cutoff Review
  // page's "Approve OT" action), NOT on each punch/segment approval's calculatedData —
  // that field is only a display tag ("this day has OT"), not the actual approval state.
  const approvedOtUserIds = new Set(
    (approvalsData.otBlocks || [])
      .filter((b) => b.status === "approved")
      .map((b) => b.userId)
  );

  return Array.from(groups.values()).map((g) => {
    const isDA = g.punchType === "DRIVER_AIDE";
    const segTotal = (g.driverAmSegmentHours || 0) + (g.regularSegmentHours || 0) + (g.driverPmSegmentHours || 0);
    return {
      ...g,
      netWorkedHours: isDA ? segTotal : g.netWorkedHours,
      otStatus: approvedOtUserIds.has(g.userId) ? "Approved" : "—",
    };
  });
}

// The approvals envelope's own `leaves` array — standalone approved-leave days for this
// specific cutoff (no punch on that day) — is the authoritative, period-scoped source for
// SL, not the generic company-wide GET /api/leaves list the payroll CSV was using before.
// Same shape exportEmployeePunchLogsCSV_v2 already expects for a Leave record; omitting
// requestedHours lets it fall back to defaultShiftHours for this single day, same as the
// Cutoff Review page's own 8h default for a standalone leave card.
//
// isPaid/actualPaidHours are synthesized here (same payableHours ?? scheduledHours default
// CutoffReview.jsx already uses for its own Paid/Unpaid tag) so the CSV's paid-only SL filter
// can read this record the same way it reads a raw GET /api/leaves record.
function buildLeavesFromApprovals(approvalsData) {
  return (approvalsData.leaves || [])
    .filter((leaveRow) => leaveRow.user?.id && leaveRow.leaveDate && leaveRow.leave?.leaveType)
    .map((leaveRow) => {
      const scheduledHours = leaveRow.hours ?? 8;
      const payableHours   = leaveRow.payableHours ?? scheduledHours;
      return {
        leaveType: leaveRow.leave.leaveType,
        userId:    leaveRow.user.id,
        startDate: leaveRow.leaveDate,
        endDate:   leaveRow.leaveDate,
        status:          "approved",
        isPaid:          payableHours > 0,
        actualPaidHours: payableHours,
      };
    });
}

// ── GenerateReportModal ────────────────────────────────────────────────────────
const REPORT_EXCLUDED_COLS = new Set(["deviceIn", "deviceOut", "locationIn", "locationOut", "locationRestricted"]);

const REPORT_GROUPS = [
  { key: "basic",    label: "Basic Info" },
  { key: "schedule", label: "Schedule"   },
  { key: "time",     label: "Time"       },
  { key: "breaks",   label: "Breaks"     },
  { key: "location", label: "Location"   },
  { key: "device",   label: "Device"     },
  { key: "meta",     label: "Other"      },
];

const BNC_FORCED_COLS = [
  { value: "ot",         label: "OT (Daily)"  },
  { value: "lunchStart", label: "Lunch Start" },
  { value: "lunchEnd",   label: "Lunch End"   },
];

const GenerateReportModal = ({
  open, onOpenChange,
  isDayCare,
  columnOptions,
  defaultFrom,
  defaultTo,
  defaultColumns,
  defaultCutoffId = "all",
  cutoffPeriods = [],
  generating,
  onGenerate,
}) => {
  const [reportType,    setReportType]    = useState("csv-detail");
  const [reportFrom,    setReportFrom]    = useState(defaultFrom);
  const [reportTo,      setReportTo]      = useState(defaultTo);
  const [selectedCols,  setSelectedCols]  = useState(defaultColumns || []);
  const [cutoffId,      setCutoffId]      = useState(defaultCutoffId); // periodRangeKey, or "all"

  const cutoffGroups = useMemo(() => groupPeriodsByRange(cutoffPeriods), [cutoffPeriods]);
  const selectedGroup = useMemo(
    () => cutoffId !== "all" ? cutoffGroups.find((g) => g.key === cutoffId) : null,
    [cutoffGroups, cutoffId]
  );

  useEffect(() => {
    if (open) {
      setReportType("csv-detail");
      setSelectedCols((defaultColumns || []).filter((v) => !REPORT_EXCLUDED_COLS.has(v)));
      // Inherit whatever cutoff the main table is currently filtered to — the report's
      // own dropdown used to always reset to "all", silently ignoring a locked cutoff
      // the admin had already selected on the page, which was the actual bug: the report
      // always fell back to raw/live data because it never knew a cutoff was selected.
      const group = defaultCutoffId !== "all" ? cutoffGroups.find((g) => g.key === defaultCutoffId) : null;
      if (group) {
        setCutoffId(defaultCutoffId);
        setReportFrom(group.periodStart.slice(0, 10));
        setReportTo(group.periodEnd.slice(0, 10));
        return;
      }
      setCutoffId("all");
      setReportFrom(defaultFrom);
      setReportTo(defaultTo);
    }
  }, [open]);

  const handleCutoffSelect = (value) => {
    setCutoffId(value);
    if (value === "all") return;
    const group = cutoffGroups.find((g) => g.key === value);
    if (!group) return;
    setReportFrom(group.periodStart.slice(0, 10));
    setReportTo(group.periodEnd.slice(0, 10));
  };

  const fmtCutoffDate = (iso) => {
    if (!iso) return "—";
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const selectableCols = useMemo(
    () => columnOptions.filter((c) => c.value !== "actions" && !REPORT_EXCLUDED_COLS.has(c.value)),
    [columnOptions]
  );

  const forcedCols = isDayCare ? [] : BNC_FORCED_COLS;

  const toggleCol = (val) =>
    setSelectedCols((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );

  const toggleGroup = (groupKey) => {
    const vals = selectableCols.filter((c) => c.group === groupKey).map((c) => c.value);
    const allOn = vals.every((v) => selectedCols.includes(v));
    setSelectedCols((prev) =>
      allOn ? prev.filter((v) => !vals.includes(v)) : [...new Set([...prev, ...vals])]
    );
  };

  const isPayroll = reportType === "csv-payroll";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-2 dark:border-white/10">
        <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500 text-white shadow">
              <Download className="h-4 w-4" />
            </div>
            Generate Report
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-1 pb-2 space-y-5">

            {/* Report Type */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Report Type
              </p>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv-detail">
                    <span className="flex items-center gap-2">
                      <Download className="h-3.5 w-3.5 text-green-600" /> CSV — Detail
                    </span>
                  </SelectItem>
                  <SelectItem value="pdf">
                    <span className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-red-500" /> PDF
                    </span>
                  </SelectItem>
                  <SelectItem value="csv-payroll">
                    <span className="flex items-center gap-2">
                      <LayoutTemplate className="h-3.5 w-3.5 text-blue-500" /> CSV — Payroll Grid
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {isPayroll && (
                <p className="text-xs bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded px-2 py-1.5">
                  Payroll Grid uses a fixed format — column selection does not apply.
                </p>
              )}
            </div>

            {/* Date Range */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Date Range
              </p>

              {/* Cutoff period quick-select */}
              {cutoffGroups.length > 0 && (
                <div className="space-y-1">
                  <Select value={cutoffId} onValueChange={handleCutoffSelect}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Quick-select cutoff period…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="all">Custom range</SelectItem>
                      {cutoffGroups
                        .filter((g) => (g.periodStart?.slice(0, 10) ?? "") <= new Date().toLocaleDateString("en-CA"))
                        .map((g) => (
                          <SelectItem key={g.key} value={g.key}>
                            {fmtCutoffDate(g.periodStart)} – {fmtCutoffDate(g.periodEnd)}
                            {` (${groupStatus(g)}${g.periods.length > 1 ? `, ${g.periods.length} depts` : ""})`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedGroup && groupStatus(selectedGroup) === "partial" ? (
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Only {selectedGroup.periods.filter((p) => ["locked", "processed"].includes(p.status)).length} of {selectedGroup.periods.length} departments for this period are locked — the report will use approved data for those and live data for the rest.
                    </p>
                  ) : selectedGroup && ["locked", "processed"].includes(groupStatus(selectedGroup)) ? (
                    <p className="text-[10px] text-green-700 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> This cutoff is {groupStatus(selectedGroup)}{selectedGroup.periods.length > 1 ? ` for all ${selectedGroup.periods.length} departments` : ""} — the report will use the reviewed/approved figures, not live punch data.
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">Selecting a period auto-fills the dates below.</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <Input
                    type="date"
                    value={reportFrom}
                    onChange={(e) => { setReportFrom(e.target.value); setCutoffId("all"); }}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">End Date</p>
                  <Input
                    type="date"
                    value={reportTo}
                    onChange={(e) => { setReportTo(e.target.value); setCutoffId("all"); }}
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            {/* Column Selection */}
            {!isPayroll && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Columns to Include
                  </p>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => setSelectedCols(selectableCols.map((c) => c.value))}
                      className="text-orange-600 hover:text-orange-700 hover:underline"
                    >
                      All
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      onClick={() => setSelectedCols(selectableCols.filter((c) => c.essential).map((c) => c.value))}
                      className="text-orange-600 hover:text-orange-700 hover:underline"
                    >
                      Essential only
                    </button>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden divide-y">
                  {REPORT_GROUPS.map((g) => {
                    const cols = selectableCols.filter((c) => c.group === g.key);
                    if (!cols.length) return null;
                    const allGroupOn = cols.every((c) => selectedCols.includes(c.value));
                    return (
                      <div key={g.key} className="px-3 py-2.5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{g.label}</span>
                          <button
                            onClick={() => toggleGroup(g.key)}
                            className="text-[10px] text-orange-600 hover:text-orange-700 hover:underline"
                          >
                            {allGroupOn ? "Deselect all" : "Select all"}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {cols.map((c) => {
                            const on = selectedCols.includes(c.value);
                            return (
                              <button
                                key={c.value}
                                onClick={() => toggleCol(c.value)}
                                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                                  on
                                    ? "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-950/40 dark:border-orange-700 dark:text-orange-300"
                                    : "bg-transparent border-muted-foreground/30 text-muted-foreground hover:border-orange-300 hover:text-orange-600"
                                }`}
                              >
                                {on && <CheckCircle className="w-2.5 h-2.5" />}
                                {c.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* BNC forced columns */}
                  {forcedCols.length > 0 && (
                    <div className="px-3 py-2.5 bg-muted/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Always Included</span>
                        <span className="text-[10px] text-muted-foreground">Required for BNC</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {forcedCols.map((c) => (
                          <span
                            key={c.value}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-300 cursor-not-allowed opacity-80"
                          >
                            <CheckCircle className="w-2.5 h-2.5" />
                            {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  {selectedCols.length} of {selectableCols.length} columns selected
                  {forcedCols.length > 0 && ` · +${forcedCols.length} always included`}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t pt-3 space-y-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Info className="w-3 h-3 shrink-0" />
            {selectedGroup && ["locked", "processed", "partial"].includes(groupStatus(selectedGroup))
              ? "Reviewed/approved cutoff data is used for locked departments in this period (live data for any not yet locked) — Employee / Status filters still apply."
              : "Fresh data is fetched for the exact dates above, using your current Employee / Department / Status filters."}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>Cancel</Button>
            <Button
              onClick={() => onGenerate({ type: reportType, from: reportFrom, to: reportTo, columns: selectedCols, cutoffId, cutoffPeriodIds: selectedGroup?.periods.map((p) => p.id) })}
              disabled={generating || !reportFrom || !reportTo}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {generating
                ? <><RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />Generating…</>
                : <><Download className="h-4 w-4 mr-1.5" />Generate Report</>}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════════════════
export default function EmployeesPunchLogs() {
  const { token } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [userTimezone,    setUserTimezone]    = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [companyTimezone, setCompanyTimezone] = useState("UTC");

  const [companyId, setCompanyId] = useState(null);
  const [companyType, setCompanyType] = useState(null);
  const isDayCare = companyType === "DAYCARE";
  const [bncOtBlocks,         setBncOtBlocks]         = useState([]);
  const [bncDailyOtThreshold, setBncDailyOtThreshold] = useState(8);
  const [cutoffPeriods,    setCutoffPeriods]    = useState([]);
  const [selectedCutoffId, setSelectedCutoffId] = useState("all");
  const [approvedLeaves,   setApprovedLeaves]   = useState([]);

  const [timelogs,       setTimelogs]       = useState([]);
  const [departments,    setDepartments]    = useState([]);
  const [employees,      setEmployees]      = useState([]);
  const [locMap,         setLocMap]         = useState({});
  const [defaultHours,   setDefaultHours]   = useState(8);
  const [minLunchMins,   setMinLunchMins]   = useState(60);
  const [otBasis,          setOtBasis]          = useState("daily");
  const [dailyOtThreshold, setDailyOtThreshold] = useState(8);
  const [weeklyOtThreshold,setWeeklyOtThreshold]= useState(40);
  const [cutoffOtThreshold,setCutoffOtThreshold]= useState(80);
  // ── G-2: Grace period from company settings ────────────────────────────────
  const [gracePeriodMins,        setGracePeriodMins]        = useState(15);
  const [earlyClockInGraceMins,  setEarlyClockInGraceMins]  = useState(0);
  const [companyName,    setCompanyName]    = useState("");
  const [currentUserName,  setCurrentUserName]  = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [currentUserRole,  setCurrentUserRole]  = useState("");

  const [loading,           setLoading]           = useState(false);
  const [refreshing,        setRefreshing]        = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generating,        setGenerating]        = useState(false);
  const [importModalOpen,   setImportModalOpen]   = useState(false);
  const [backtrackImportModalOpen, setBacktrackImportModalOpen] = useState(false);
  const [expandedRow,       setExpandedRow]       = useState(null);

  const [totalRows, setTotalRows] = useState(0);

  // Punch-log requests
  const [pendingRequests,     setPendingRequests]     = useState([]);
  const [requestsExpanded,    setRequestsExpanded]    = useState(true);
  const [loadingRequests,     setLoadingRequests]     = useState(false);
  const [requestStatusFilter, setRequestStatusFilter] = useState("PENDING");
  const [approvingRequest,    setApprovingRequest]    = useState(null);
  const [rejectDialogOpen,    setRejectDialogOpen]    = useState(false);
  const [rejectingRequest,    setRejectingRequest]    = useState(null);
  const [rejectionReason,     setRejectionReason]     = useState("");

  // Edit dialog
  const [editDialogOpen,     setEditDialogOpen]     = useState(false);
  const [editLog,            setEditLog]            = useState(null);
  const [editTimeIn,         setEditTimeIn]         = useState("");
  const [editTimeOut,        setEditTimeOut]        = useState("");
  const [clearingAutoBreaks, setClearingAutoBreaks] = useState(false);

  // Edit punch type dialog (DayCare only)
  const [editPunchTypeOpen, setEditPunchTypeOpen] = useState(false);
  const [editPunchTypeLog,  setEditPunchTypeLog]  = useState(null);
  const [editPunchTypeVal,  setEditPunchTypeVal]  = useState("REGULAR");
  const [savingPunchType,   setSavingPunchType]   = useState(false);

  // Delete confirmation dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLog,         setDeleteLog]         = useState(null);
  const [deletingLog,       setDeletingLog]       = useState(false);

  // View dialogs
  const [schedDialogOpen,    setSchedDialogOpen]    = useState(false);
  const [scheduleList,       setScheduleList]       = useState([]);
  const [otDialogOpen,       setOtDialogOpen]       = useState(false);
  const [otViewData,         setOtViewData]         = useState(null);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationDialogList, setLocationDialogList] = useState([]);

  // Filters
  const resetFilters = { search: "", employeeIds: ["all"], departmentId: "all", from: getDefaultFrom(), to: getDefaultTo(), status: "all", punchType: "all" };
  const [filters,      setFilters]      = useState(resetFilters);
  const [pendingDates, setPendingDates] = useState({ from: getDefaultFrom(), to: getDefaultTo() });
  const [sortConfig, setSortConfig] = useState({ key: "dateTimeIn", direction: "descending" });
  const [multiSelectEmployees, setMultiSelectEmployees] = useState(false);

  const toggleNameSort = () =>
    setSortConfig((prev) => {
      if (prev.key !== "employee") return { key: "employee", direction: "ascending" };
      if (prev.direction === "ascending") return { key: "employee", direction: "descending" };
      return { key: "dateTimeIn", direction: "descending" };
    });

  const toggleListFilter = (key, val) =>
    setFilters((prev) => {
      if (val === "all") return { ...prev, [key]: ["all"] };
      let list = prev[key].filter((x) => x !== "all");
      list = list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
      if (!list.length) list = ["all"];
      return { ...prev, [key]: list };
    });

  const toggleEmployeeFilter = (val) => {
    if (!multiSelectEmployees) {
      setFilters((prev) => ({ ...prev, employeeIds: val === "all" ? ["all"] : [val] }));
      return;
    }
    toggleListFilter("employeeIds", val);
  };

  const handleMultiSelectEmployeesChange = (checked) => {
    setMultiSelectEmployees(checked);
    if (!checked) {
      setFilters((prev) =>
        prev.employeeIds.includes("all") ? prev : { ...prev, employeeIds: [prev.employeeIds[0]] }
      );
    }
  };

  const anyFilterActive =
    filters.search || !filters.employeeIds.includes("all") || filters.departmentId !== "all" ||
    filters.from !== getDefaultFrom() || filters.to !== getDefaultTo() ||
    filters.status !== "all" || filters.punchType !== "all";
  const clearAllFilters = () => {
    setFilters(resetFilters);
    setPendingDates({ from: getDefaultFrom(), to: getDefaultTo() });
    setSelectedCutoffId("all");
    setMultiSelectEmployees(false);
  };
  const datesAreDirty = pendingDates.from !== filters.from || pendingDates.to !== filters.to;
  const applyDates = () => setFilters((prev) => ({ ...prev, from: pendingDates.from, to: pendingDates.to }));

  const canEdit = ["superadmin", "admin", "supervisor"].includes((currentUserRole || "").toLowerCase());
  // Backtrack import is DayCare-only — B&C companies are rejected server-side (400), so hide
  // the entry point entirely rather than let the admin hit that error, same as other
  // Driver/Aide-only features gated by isDayCare elsewhere in this file.
  const canBacktrackImport = canEdit && isDayCare;

  const employeeNameMap = useMemo(() => {
    const map = {};
    employees.forEach((e) => {
      if (e.id) map[e.id] = { firstName: e.profile?.firstName || "", lastName: e.profile?.lastName || "" };
    });
    return map;
  }, [employees]);

  // GET /api/employee?all=1 (same source as the Employees list page) is the authoritative
  // record for the HR employee code — the `employeeId` embedded on a timelog/approval's
  // nested `user` isn't always populated, which silently fell back to the raw userId in
  // the report's "ID" column even though the real code exists on the employee record.
  const employeeIdMap = useMemo(() => {
    const map = {};
    employees.forEach((e) => {
      if (e.id && e.employeeId) map[e.id] = e.employeeId;
    });
    return map;
  }, [employees]);

  // Job title (position), not the auth account role — needed because the locked-cutoff
  // report path's `user.role` is "admin"/"employee"/etc, not a job title. Same source
  // (`GET /api/employee?all=1`) the Employees list page reads `employmentDetail.jobTitle`
  // from, so this is authoritative for both the live and locked-cutoff report paths.
  const employeeRoleMap = useMemo(() => {
    const map = {};
    employees.forEach((e) => {
      if (e.id && e.employmentDetail?.jobTitle) map[e.id] = e.employmentDetail.jobTitle;
    });
    return map;
  }, [employees]);

  // ── Column config ─────────────────────────────────────────────────────────────
  const columnOptions = useMemo(() => [
    { value: "employee",           label: "Employee",           essential: true,  group: "basic"    },
    { value: "dateTimeIn",         label: "Time In",            essential: true,  group: "basic"    },
    { value: "dateTimeOut",        label: "Time Out",           essential: true,  group: "basic"    },
    { value: "duration",           label: "Duration",           essential: false, group: "basic"    },
    ...(!isDayCare ? [{ value: "gross", label: "Gross Hours", essential: false, group: "basic" }] : []),
    { value: "status",             label: "Status",             essential: true,  group: "basic"    },
    { value: "punchType",          label: "Punch Type",         essential: false, group: "basic"    },
    { value: "cutoffApproval",     label: "Cutoff Status",      essential: false, group: "basic"    },
    { value: "schedule",           label: "Scheduled",          essential: false, group: "schedule" },
    { value: "period",             label: "Period Hours",       essential: false, group: "schedule" },
    ...(isDayCare ? [
      { value: "ot",       label: "Overtime", essential: false, group: "time" },
      { value: "otStatus", label: "OT Status", essential: false, group: "time" },
    ] : []),
    { value: "late",               label: "Late",               essential: false, group: "time"     },
    { value: "undertime",          label: "Undertime",          essential: false, group: "time"     },
    { value: "coffee",             label: "Coffee",             essential: false, group: "breaks"   },
    { value: "lunch",              label: "Lunch",              essential: false, group: "breaks"   },
    { value: "locationRestricted", label: "Location Required",  essential: false, group: "location" },
    { value: "locationIn",         label: "Check-in Location",  essential: false, group: "location" },
    { value: "locationOut",        label: "Check-out Location", essential: false, group: "location" },
    { value: "deviceIn",           label: "Device In",          essential: false, group: "device"   },
    { value: "deviceOut",          label: "Device Out",         essential: false, group: "device"   },
    { value: "id",                 label: "ID",                 essential: false, group: "meta"     },
    { value: "actions",            label: "Actions",            essential: true,  group: "basic"    },
  ], [isDayCare]);

  const columnMapForExport = COLUMN_MAP_FOR_EXPORT;

  const [columnVisibility, setColumnVisibility] = useState(
    columnOptions.filter((c) => c.essential).map((c) => c.value)
  );

  useEffect(() => {
    if (companyType === null) return;
    if (!isDayCare) {
      setColumnVisibility((prev) =>
        prev.filter((v) => v !== "ot" && v !== "otStatus")
      );
    }
    if (isDayCare) {
      setColumnVisibility((prev) =>
        prev.filter((v) => v !== "gross")
      );
    }
  }, [isDayCare, companyType]);

  // ── Bootstrap ─────────────────────────────────────────────────────────────────
  const bootstrap = useCallback(async () => {
    try {
      const [cSet, prof, emps, depts, locs] = await Promise.all([
        fetch(`${API_URL}/api/company-settings/`,    { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/account/profile`,      { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/employee?all=1`,       { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/departments`,          { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/location`,             { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [cJ, pJ, eJ, dJ, lJ] = await Promise.all([
        cSet.json(), prof.json(), emps.json(), depts.json(), locs.json(),
      ]);

      if (cSet.ok) {
        setDefaultHours(cJ.data?.defaultShiftHours ?? 8);
        const raw = cJ.data?.minimumLunchMinutes;
        setMinLunchMins(raw === null ? 0 : raw ?? 60);
        const tz = cJ.data?.timezone || cJ.data?.companyTimezone || "America/Los_Angeles";
        setCompanyTimezone(tz);
        const from = getDefaultFrom(tz);
        const to   = getDefaultTo(tz);
        setFilters((prev) => ({ ...prev, from, to }));
        setPendingDates({ from, to });
        if (cJ.data?.id) setCompanyId(cJ.data.id);
        // ── G-2: Read grace period from settings ──────────────────────────────
        setGracePeriodMins(cJ.data?.gracePeriodMinutes ?? 15);
        setEarlyClockInGraceMins(cJ.data?.earlyClockInGraceMinutes ?? 0);
        setOtBasis(cJ.data?.otBasis ?? "daily");
        setDailyOtThreshold(parseFloat(cJ.data?.dailyOtThresholdHours  ?? 8));
        setWeeklyOtThreshold(parseFloat(cJ.data?.weeklyOtThresholdHours ?? 40));
        setCutoffOtThreshold(parseFloat(cJ.data?.cutoffOtThresholdHours ?? 80));
      }

      if (pJ?.data?.company?.name) setCompanyName(pJ.data.company.name.replace(/\s+/g, "_"));
      if (pJ?.data) {
        const profObj = pJ.data.profile ?? {};
        const user    = pJ.data.user ?? {};
        setCurrentUserEmail(user.email || "");
        setCurrentUserRole(user.role  || "");
        setCurrentUserName(user.fullName || `${profObj.firstName ?? ""} ${profObj.lastName ?? ""}`.trim() || user.email || "");
        setUserTimezone(user.timezone || pJ.data?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      }

      if (eJ?.data) setEmployees(eJ.data);
      if (dJ?.data) setDepartments(dJ.data);

      if (lJ?.data) {
        const map = {};
        lJ.data.forEach((loc) => {
          (loc.LocationRestriction || []).forEach((lr) => {
            if (lr.restrictionStatus) {
              map[lr.userId] = map[lr.userId] || [];
              map[lr.userId].push(loc);
            }
          });
        });
        setLocMap(map);
      }
    } catch { toast.error("Initialization failed"); }
  }, [API_URL, token]);

  // ── Fetch punch-log requests ──────────────────────────────────────────────────
  const fetchPendingRequests = useCallback(async () => {
    if (!token) return;
    setLoadingRequests(true);
    try {
      const res = await fetch(`${API_URL}/api/request-punch-log/all-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (res.ok) {
        const requests = j.data || [];
        setPendingRequests(requests);
        setRequestsExpanded(requests.some((r) => r.status === "PENDING"));
      }
    } catch (err) { console.error(err); }
    finally { setLoadingRequests(false); }
  }, [token, API_URL]);

  const fetchCutoffPeriods = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/cutoff-periods`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      // Keep every department's period record — do NOT dedupe by date range here.
      // A pay period commonly has one record per department; dropdowns group them
      // for display via groupPeriodsByRange(), but report generation needs every
      // sibling id to pull all departments' approved data, not just one.
      if (res.ok) setCutoffPeriods((j.data || []).sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart)));
    } catch { /* silent */ }
  }, [token, API_URL]);

  const fetchApprovedLeaves = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/leaves`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (res.ok) setApprovedLeaves((j.data || []).filter((l) => l.status === "approved"));
    } catch { /* silent */ }
  }, [token, API_URL]);

  const handleCutoffSelect = (value) => {
    setSelectedCutoffId(value);
    if (value === "all") return;
    // value is a periodRangeKey ("YYYY-MM-DD|YYYY-MM-DD"), not a single period id —
    // any sibling department record for that range gives the same dates.
    const period = cutoffPeriods.find((p) => periodRangeKey(p) === value);
    if (!period) return;
    const from = period.periodStart.slice(0, 10);
    const to   = period.periodEnd.slice(0, 10);
    setPendingDates({ from, to });
    setFilters((prev) => ({ ...prev, from, to }));
  };

  const handleApproveRequest = async (requestId) => {
    setApprovingRequest(requestId);
    try {
      const res = await fetch(`${API_URL}/api/request-punch-log/approve/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Approval failed");
      toast.success("Punch log request approved and time log created!");
      await Promise.all([fetchPendingRequests(), fetchTimelogs()]);
    } catch (err) { toast.error(err.message); }
    finally { setApprovingRequest(null); }
  };

  const handleRejectRequest = async () => {
    if (!rejectingRequest || !rejectionReason.trim()) { toast.error("Please provide a reason"); return; }
    try {
      const res = await fetch(`${API_URL}/api/request-punch-log/reject/${rejectingRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rejectionReason }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Rejection failed");
      toast.success("Punch log request rejected");
      setRejectDialogOpen(false); setRejectingRequest(null); setRejectionReason("");
      await fetchPendingRequests();
    } catch (err) { toast.error(err.message); }
  };

  // ── Fetch timelogs ────────────────────────────────────────────────────────────
  const fetchTimelogs = useCallback(
    async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.append("page", 1);
        qs.append("limit", 10000);
        if (filters.departmentId !== "all") qs.append("departmentId", filters.departmentId);
        if (filters.from)   qs.append("from",   filters.from);
        if (filters.to)     qs.append("to",     filters.to);
        if (filters.status !== "all") qs.append("status", filters.status);
        if (filters.employeeIds.length === 1 && filters.employeeIds[0] !== "all")
          qs.append("employeeId", filters.employeeIds[0]);

        const tlRes = await fetch(`${API_URL}/api/timelogs?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
        const tlJ = await tlRes.json();
        if (!tlRes.ok) throw new Error(tlJ.error || "Punch Logs fetch failed");
        if (tlJ.companyType) setCompanyType(tlJ.companyType);
        setBncOtBlocks(tlJ.otBlocks || []);
        if (tlJ.dailyOtThresholdHours != null) setBncDailyOtThreshold(tlJ.dailyOtThresholdHours);

        const enriched = enrichTimelogs(tlJ.data || [], {
          companyTimezone, isDayCare, otBasis, locMap, defaultHours,
        });

        setTotalRows(tlJ.meta?.total || enriched.length);
        setTimelogs(enriched);
      } catch (err) { toast.error(err.message); }
      setLoading(false);
    },
    [API_URL, token, filters, defaultHours, locMap, otBasis, isDayCare, companyTimezone]
  );

  useEffect(() => {
    if (token) { bootstrap(); fetchPendingRequests(); fetchCutoffPeriods(); fetchApprovedLeaves(); }
  }, [token, bootstrap, fetchPendingRequests, fetchCutoffPeriods, fetchApprovedLeaves]);

  useEffect(() => {
    if (!token) return;
    setTimelogs([]);
    fetchTimelogs();
  }, [token, filters.departmentId, filters.from, filters.to, filters.status,
    defaultHours, locMap, otBasis, companyTimezone]);

  // ── Displayed (client-side filters + sort) ────────────────────────────────────
  const displayed = useMemo(() => {
    let data = [...timelogs];
    if (!filters.employeeIds.includes("all"))
      data = data.filter((t) => filters.employeeIds.includes(t.userId));
    if (filters.search) {
      const q = filters.search.toLowerCase();
      data = data.filter((t) => t.employeeName?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q));
    }
    if (isDayCare && filters.punchType !== "all")
      data = data.filter((t) => t.punchType === filters.punchType);

    data.sort((a, b) => {
      if (sortConfig.key === "employee") {
        const dir = sortConfig.direction === "ascending" ? 1 : -1;
        const aN = employeeNameMap[a.userId] ?? {};
        const bN = employeeNameMap[b.userId] ?? {};
        const aLast = (aN.lastName  || "").toLowerCase(), bLast = (bN.lastName  || "").toLowerCase();
        const aFirst = (aN.firstName || "").toLowerCase(), bFirst = (bN.firstName || "").toLowerCase();
        if (aLast !== bLast) return aLast.localeCompare(bLast) * dir;
        return aFirst.localeCompare(bFirst) * dir;
      }
      const getVal = (item, key) => {
        if (key === "dateTimeIn") return item.timeIn ? new Date(item.timeIn).getTime() : 0;
        return 0;
      };
      const aVal = getVal(a, sortConfig.key);
      const bVal = getVal(b, sortConfig.key);
      if (aVal < bVal) return sortConfig.direction === "ascending" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "ascending" ? 1  : -1;
      return 0;
    });
    return data;
  }, [timelogs, filters, sortConfig, isDayCare, employeeNameMap]);

  const totalPeriodHours = useMemo(
    () => displayed.reduce((s, r) => s + (parseFloat(r.periodHours || "0") || 0), 0).toFixed(2),
    [displayed]
  );

  const totalDurationHours = useMemo(
    () => displayed.reduce((s, r) => s + (parseFloat(r.duration || "0") || 0), 0).toFixed(2),
    [displayed]
  );

  // ── Generate report (modal handler) ──────────────────────────────────────────
  // Plain /api/timelogs fetch — shared by the "no cutoff selected" path and the
  // per-department fallback for cutoffs that aren't locked yet within a mixed group.
  const fetchRawTimelogs = async ({ departmentId, from, to, employeeId, status }) => {
    const qs = new URLSearchParams();
    qs.append("page", 1);
    qs.append("limit", 10000);
    if (departmentId && departmentId !== "all") qs.append("departmentId", departmentId);
    if (from) qs.append("from", from);
    if (to)   qs.append("to",   to);
    if (status && status !== "all") qs.append("status", status);
    if (employeeId) qs.append("employeeId", employeeId);
    const res = await fetch(`${API_URL}/api/timelogs?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Fetch failed");
    return j;
  };

  const handleGenerateReport = async ({ type, from, to, columns, cutoffId, cutoffPeriodIds }) => {
    setGenerating(true);
    try {
      const selectedPeriods = (cutoffPeriodIds || [])
        .map((id) => cutoffPeriods.find((p) => p.id === id))
        .filter(Boolean);
      const lockedPeriods = selectedPeriods.filter((p) => ["locked", "processed"].includes(p.status));
      const openPeriods   = selectedPeriods.filter((p) => !["locked", "processed"].includes(p.status));

      let rawRows = [], freshOtBlocks = [], freshOtThreshold, freshIsDayCare;
      // SL: leave rows sourced from the locked cutoff's own approvals (period-scoped,
      // authoritative), replacing the generic company-wide list for whichever employees
      // are covered by a locked department — so it never double-counts the same leave.
      let approvalLeaves = [];
      const lockedUserIds = new Set();

      if (cutoffId && cutoffId !== "all" && selectedPeriods.length) {
        // One cutoff period per department can share the same pay-period range — pull
        // approved data for every department that's locked, and fall back to live data
        // (scoped to just that department) for any that aren't, so the report always
        // covers every department in the period instead of only whichever record the
        // dropdown happened to resolve to.
        const [approvalResults, rawResults] = await Promise.all([
          Promise.all(lockedPeriods.map((p) =>
            fetch(`${API_URL}/api/cutoff-periods/${p.id}/approvals`, { headers: { Authorization: `Bearer ${token}` } })
              .then(async (res) => {
                const j = await res.json();
                if (!res.ok) throw new Error(j.message || `Failed to fetch approved data for one department`);
                return j;
              })
          )),
          Promise.all(openPeriods.map((p) =>
            fetchRawTimelogs({ departmentId: p.departmentId, from: p.periodStart.slice(0, 10), to: p.periodEnd.slice(0, 10) })
          )),
        ]);

        for (const j of approvalResults) {
          rawRows.push(...buildRowsFromApprovals(j, companyTimezone));
          freshOtBlocks.push(...(j.otBlocks || []));
          approvalLeaves.push(...buildLeavesFromApprovals(j));
          for (const approval of j.data || []) {
            const uid = approval.timeLog?.user?.id;
            if (uid) lockedUserIds.add(uid);
          }
        }
        for (const j of rawResults) {
          rawRows.push(...(j.data || []));
          freshOtBlocks.push(...(j.otBlocks || []));
        }

        const envelope       = approvalResults[0] || rawResults[0] || {};
        freshOtThreshold = envelope.dailyOtThresholdHours ?? bncDailyOtThreshold;
        freshIsDayCare   = approvalResults[0]
          ? (approvalResults[0].isBNC != null ? approvalResults[0].isBNC === false : isDayCare)
          : (rawResults[0]?.companyType ? rawResults[0].companyType === "DAYCARE" : isDayCare);

        if (openPeriods.length) {
          toast.message(`${openPeriods.length} of ${selectedPeriods.length} department(s) for this period aren't locked yet — using live data for those.`);
        }
      } else {
        const j = await fetchRawTimelogs({
          departmentId: filters.departmentId, from, to, status: filters.status,
          employeeId: filters.employeeIds.length === 1 && filters.employeeIds[0] !== "all" ? filters.employeeIds[0] : null,
        });
        rawRows          = j.data || [];
        freshOtBlocks    = j.otBlocks || [];
        freshOtThreshold = j.dailyOtThresholdHours ?? bncDailyOtThreshold;
        freshIsDayCare   = j.companyType ? j.companyType === "DAYCARE" : isDayCare;
      }

      let enriched = enrichTimelogs(rawRows, {
        companyTimezone, isDayCare: freshIsDayCare, otBasis, locMap, defaultHours,
      });

      // Prefer the employee-record employeeId (authoritative) over whatever came embedded
      // on the timelog/approval row, which can be missing for some employees. Same for
      // employeeRole: the locked-cutoff path's `employeeRole` is the auth account role
      // (e.g. "employee"), not a job title — employeeRoleMap (job title) is authoritative
      // for both report paths.
      enriched = enriched.map((t) => ({
        ...t,
        employeeId:   employeeIdMap[t.userId]   ?? t.employeeId,
        employeeRole: employeeRoleMap[t.userId] ?? t.employeeRole,
      }));

      if (!filters.employeeIds.includes("all"))
        enriched = enriched.filter((t) => filters.employeeIds.includes(t.userId));
      if (filters.search) {
        const q = filters.search.toLowerCase();
        enriched = enriched.filter((t) =>
          t.employeeName?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q)
        );
      }

      // Sort: Last name → First name → date asc
      enriched.sort((a, b) => {
        const aN = employeeNameMap[a.userId] ?? {};
        const bN = employeeNameMap[b.userId] ?? {};
        const aLast  = (aN.lastName  || "").toLowerCase();
        const bLast  = (bN.lastName  || "").toLowerCase();
        const aFirst = (aN.firstName || "").toLowerCase();
        const bFirst = (bN.firstName || "").toLowerCase();
        if (aLast  !== bLast)  return aLast.localeCompare(bLast);
        if (aFirst !== bFirst) return aFirst.localeCompare(bFirst);
        return new Date(a.timeIn || 0) - new Date(b.timeIn || 0);
      });

      const exportFilters = { ...filters, from, to };
      // Company-wide approvedLeaves still covers open-department/no-cutoff employees;
      // drop entries for anyone whose leave already came from a locked cutoff's own
      // approvals above so the same day can't be counted twice.
      const finalApprovedLeaves = [
        ...approvedLeaves.filter((l) => !lockedUserIds.has(l.userId || l.requester?.id || l.User?.id)),
        ...approvalLeaves,
      ];

      if (type === "pdf") {
        const { exportEmployeePunchLogsPDF } = await import("@/lib/exports/employeePunchLogs");
        const result = await exportEmployeePunchLogsPDF({
          data: enriched, visibleColumns: columns, columnMap: columnMapForExport,
          filters: exportFilters, userTimezone, companyTimezone, isDayCare: freshIsDayCare,
          bncOtBlocks: freshOtBlocks, bncDailyOtThreshold: freshOtThreshold,
          otBasis, cutoffOtThreshold, employeeNameMap,
        });
        if (result.success) toast.success(result.filename);
      } else if (type === "csv-detail") {
        const { exportEmployeePunchLogsCSV } = await import("@/lib/exports/employeePunchLogs");
        const result = await exportEmployeePunchLogsCSV({
          data: enriched, visibleColumns: columns, columnMap: columnMapForExport,
          filters: exportFilters, userTimezone, companyTimezone, isDayCare: freshIsDayCare,
          bncOtBlocks: freshOtBlocks, bncDailyOtThreshold: freshOtThreshold,
          otBasis, cutoffOtThreshold, employeeNameMap,
        });
        if (result.success) toast.success(result.filename);
      } else if (type === "csv-payroll") {
        const { exportEmployeePunchLogsCSV_v2 } = await import("@/lib/exports/employeePunchLogs");
        const result = await exportEmployeePunchLogsCSV_v2({
          data: enriched, companyTimezone, employeeNameMap,
          approvedLeaves: finalApprovedLeaves, defaultShiftHours: defaultHours,
          fromDate: from, toDate: to,
          cutoffOtThreshold,
        });
        if (result.success) toast.success(result.filename);
      }

      setGenerateModalOpen(false);
    } catch (e) {
      toast.error(`Report generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([bootstrap(), fetchTimelogs(), fetchPendingRequests()]);
    toast.message("Data refreshed");
    setRefreshing(false);
  };

  // ── Edit dialog ───────────────────────────────────────────────────────────────
  const openEditDialog = (log) => {
    setEditLog(log);
    setEditTimeIn(toCompanyInputValue(log.timeIn, companyTimezone));
    setEditTimeOut(toCompanyInputValue(log.timeOut, companyTimezone));
    setEditDialogOpen(true);
  };

  const submitEdit = async () => {
    try {
      if (!editLog) return;
      const payload = {
        timeIn:  fromCompanyInputToISO(editTimeIn,  companyTimezone),
        timeOut: fromCompanyInputToISO(editTimeOut, companyTimezone),
      };
      const res = await fetch(`${API_URL}/api/timelogs/${editLog.id}/datetime`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Update failed");
      toast.success("Date/Time updated successfully");
      setEditDialogOpen(false); setEditLog(null);
      await fetchTimelogs();
    } catch (e) { toast.error(e.message); }
  };

  const clearAutoBreaks = async () => {
    try {
      if (!editLog) return;
      setClearingAutoBreaks(true);
      const res = await fetch(`${API_URL}/api/time-logs/${editLog.id}/auto-breaks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lunch:  editLog.autoLunchApplied  || false,
          coffee: editLog.autoCoffeeApplied || false,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Failed to clear auto-breaks");
      toast.success("Auto-breaks cleared and flags reset");
      setEditDialogOpen(false); setEditLog(null);
      await fetchTimelogs();
    } catch (e) { toast.error(e.message); }
    finally { setClearingAutoBreaks(false); }
  };

  const submitEditPunchType = async () => {
    if (!editPunchTypeLog) return;
    setSavingPunchType(true);
    try {
      const res = await fetch(`${API_URL}/api/timelogs/${editPunchTypeLog.id}/punch-type`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ punchType: editPunchTypeVal }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Update failed");
      toast.success("Punch type updated");
      setEditPunchTypeOpen(false); setEditPunchTypeLog(null);
      await fetchTimelogs();
    } catch (e) { toast.error(e.message); }
    finally { setSavingPunchType(false); }
  };

  const confirmDelete = async () => {
    if (!deleteLog) return;
    setDeletingLog(true);
    try {
      const res = await fetch(`${API_URL}/api/timelogs/${deleteLog.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Delete failed");
      toast.success("Punch log deleted");
      setDeleteConfirmOpen(false); setDeleteLog(null);
      await fetchTimelogs();
    } catch (e) { toast.error(e.message); }
    finally { setDeletingLog(false); }
  };


  // ═════════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500 text-white shadow-lg">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight">
              Employee Punch Logs
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-0.5 text-sm">Track and manage employee time tracking and attendance</p>
          </div>
        </div>
        <div className="flex gap-2">
          <IconBtn icon={RefreshCw} tooltip="Refresh data" spinning={refreshing} onClick={refreshAll} />
          <IconBtn icon={Download} tooltip="Generate Report" onClick={() => setGenerateModalOpen(true)} />
          <YearlyTotalHoursReportTrigger
            companyId={companyId}
            companyName={companyName}
            canDownload={canEdit}
          />
          {canEdit && (
            <IconBtn icon={Upload} tooltip="Import Punch Logs" onClick={() => setImportModalOpen(true)} />
          )}
          {canBacktrackImport && (
            <IconBtn icon={History} tooltip="Import Backtrack Punch Logs" onClick={() => setBacktrackImportModalOpen(true)} />
          )}
          <IconBtn
            icon={BookOpen}
            tooltip="Punch Log Rules Guide"
            onClick={() => window.open(
              isDayCare
                ? "/docs/punch_log_rules_v1_0_0.html"
                : "/docs/general_rules_v1_0_0.html",
              "_blank"
            )}
          />
        </div>
      </motion.div>

      {/* Summary */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <SummaryStats data={displayed} />
      </motion.div>

      {/* Filters */}
      <Card className="border-2 border-orange-200 dark:border-orange-900/50 shadow-lg overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-950/20 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-orange-500 text-white shadow-lg"><Filter className="h-4 w-4" /></div>
              Filters &amp; Controls
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{displayed.length} of {totalRows} records</span>
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
        <CardContent className="space-y-5 pt-4">
          {/* Columns */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />Columns
            </p>
            <ColumnSelector options={columnOptions} visible={columnVisibility} setVisible={setColumnVisibility} />
          </div>

          {/* Filter grid */}
          <div className={`grid gap-3 grid-cols-1 sm:grid-cols-2 ${isDayCare ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {/* Employee */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 h-4">
                <p className="h-4 leading-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />Employee
                </p>
                <label className="h-4 leading-4 flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <Checkbox
                    checked={multiSelectEmployees}
                    onCheckedChange={handleMultiSelectEmployeesChange}
                    className="h-3.5 w-3.5"
                  />
                  Select multiple
                </label>
              </div>
              <MultiSelect
                options={employees.map((e) => {
                  const name = `${e.profile?.firstName || ""} ${e.profile?.lastName || ""}`.trim();
                  return { value: e.id, label: name || e.email.split("@")[0] };
                })}
                selected={filters.employeeIds}
                onChange={toggleEmployeeFilter}
                allLabel="All employees"
                width={0}
                className="w-full"
                searchable
                sortable
                singleSelect={!multiSelectEmployees}
              />
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5" />Department
              </p>
              <Select value={filters.departmentId} onValueChange={(v) => setFilters({ ...filters, departmentId: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All departments" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5" />Status
              </p>
              <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Punch Type — DayCare only */}
            {isDayCare && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />Punch Type
                </p>
                <Select value={filters.punchType} onValueChange={(v) => setFilters({ ...filters, punchType: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="REGULAR">Regular</SelectItem>
                    <SelectItem value="DRIVER_AIDE">Driver / Aide</SelectItem>
                    <SelectItem value="DRIVER_AIDE_AM">Driver AM</SelectItem>
                    <SelectItem value="DRIVER_AIDE_PM">Driver PM</SelectItem>
                    <SelectItem value="TRAINING">Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Date range */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />Date Range
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <CutoffDateRangeFilter
                cutoffPeriods={cutoffPeriods}
                selectedCutoffId={selectedCutoffId}
                onSelectCutoff={handleCutoffSelect}
                from={pendingDates.from}
                to={pendingDates.to}
                onFromChange={(v) => { setPendingDates((prev) => ({ ...prev, from: v })); setSelectedCutoffId("all"); }}
                onToChange={(v) => { setPendingDates((prev) => ({ ...prev, to: v })); setSelectedCutoffId("all"); }}
                onApply={applyDates}
                isDirty={datesAreDirty}
                maxDate={getDefaultTo()}
              />
              {anyFilterActive && (
                <Button variant="outline" size="sm" onClick={clearAllFilters}
                  className="border-orange-500/30 text-orange-700 hover:bg-orange-500/10">
                  Clear All Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card className="border-2 border-orange-200 dark:border-orange-900/50 shadow-lg overflow-hidden">
          <CardHeader className="pb-4 cursor-pointer bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-950/20 border-b hover:from-orange-100 dark:hover:from-orange-950/30 transition-colors" onClick={() => setRequestsExpanded(!requestsExpanded)}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500 text-white shadow-lg"><AlarmClockPlus className="h-4 w-4" /></div>
                Punch Log Requests Pending Approval
                {pendingRequests.filter((r) => r.status === "PENDING").length > 0 && (
                  <Badge className="ml-2 bg-red-500 hover:bg-red-600 text-white">
                    {pendingRequests.filter((r) => r.status === "PENDING").length} Pending
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-3">
                <Select value={requestStatusFilter} onValueChange={setRequestStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[140px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending Only</SelectItem>
                    <SelectItem value="ALL">All Requests</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {requestsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <AnimatePresence>
            {requestsExpanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                <CardContent className="pb-4">
                  {loadingRequests ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="h-8 w-8 animate-spin text-orange-500 mx-auto mb-2" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingRequests
                        .filter((r) => requestStatusFilter === "ALL" || r.status === requestStatusFilter)
                        .map((req) => {
                          const isApproving = approvingRequest === req.id;
                          const daysAgo     = Math.floor((Date.now() - new Date(req.submittedAt)) / 86400000);
                          const isUrgent    = daysAgo >= 3 && req.status === "PENDING";
                          return (
                            <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              className={`p-4 border-2 rounded-lg transition-all hover:shadow-md ${
                                req.status === "PENDING"  ? "bg-orange-50/50 dark:bg-orange-950/10 border-orange-200 dark:border-orange-900"  :
                                req.status === "APPROVED" ? "bg-green-50/50  dark:bg-green-950/10  border-green-200  dark:border-green-900"   :
                                                            "bg-red-50/50    dark:bg-red-950/10    border-red-200    dark:border-red-900"
                              }`}>
                              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 rounded-full bg-orange-500/10"><User className="h-5 w-5 text-orange-600" /></div>
                                      <div>
                                        <div className="font-semibold text-base">{req.userDisplayName}</div>
                                        <div className="text-xs text-muted-foreground">Request ID: {req.id.slice(0, 8)}</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <PunchTypeBadge punchType={req.requestedPunchType} />
                                      {isUrgent && <Badge variant="destructive" className="animate-pulse">{daysAgo}d overdue</Badge>}
                                      <Badge className={
                                        req.status === "PENDING"  ? "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400" :
                                        req.status === "APPROVED" ? "bg-green-100  text-green-800  border-green-300  dark:bg-green-900/30  dark:text-green-400"  :
                                                                    "bg-red-100    text-red-800    border-red-300    dark:bg-red-900/30    dark:text-red-400"
                                      }>
                                        {req.status}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div className="space-y-1">
                                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Date</div>
                                      <div className="font-medium">{safeCalendarDate(req.requestedDate)}</div>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Time In</div>
                                      <div className="font-medium font-mono text-xs">{safeTime(req.requestedClockIn, companyTimezone)}</div>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Time Out</div>
                                      <div className="font-medium font-mono text-xs">{safeTime(req.requestedClockOut, companyTimezone)}</div>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Timer className="h-3 w-3" />Duration</div>
                                      <div className="font-semibold text-orange-600">{req.estimatedNetHours?.toFixed(2) || "0.00"}h</div>
                                    </div>
                                  </div>
                                  <div className="space-y-2 pt-2 border-t">
                                    <div className="flex items-start gap-2">
                                      <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                      <div className="flex-1">
                                        <span className="text-xs font-medium text-muted-foreground">Reason: </span>
                                        <span className="text-sm font-medium capitalize">{req.reason?.replace(/_/g, " ") || "Not specified"}</span>
                                      </div>
                                    </div>
                                    {req.description && (
                                      <div className="flex items-start gap-2">
                                        <FileText className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-muted-foreground flex-1 line-clamp-2">{req.description}</p>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t flex-wrap gap-1">
                                    <span>Submitted: {new Date(req.submittedAt).toLocaleDateString()}</span>
                                    {req.createdByDisplayName && (
                                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                                        <UserCheck className="h-3 w-3" />Filed by {req.createdByDisplayName}
                                      </span>
                                    )}
                                    <span>Approver: {req.approverDisplayName || "Not assigned"}</span>
                                  </div>
                                </div>
                                {req.status === "PENDING" && (
                                  <div className="flex md:flex-col gap-2 md:min-w-[140px]">
                                    <TooltipProvider><Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white flex-1 md:flex-none"
                                          onClick={() => handleApproveRequest(req.id)} disabled={isApproving}>
                                          {isApproving ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Approving...</> : <><CheckCircle className="h-3 w-3 mr-1" />Approve</>}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Approve and create time log entry</TooltipContent>
                                    </Tooltip></TooltipProvider>
                                    <TooltipProvider><Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="sm" variant="destructive" className="flex-1 md:flex-none"
                                          onClick={() => { setRejectingRequest(req); setRejectDialogOpen(true); }}>
                                          <XCircle className="h-3 w-3 mr-1" />Reject
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Reject with reason</TooltipContent>
                                    </Tooltip></TooltipProvider>
                                  </div>
                                )}
                              </div>
                              {req.status === "REJECTED" && req.rejectionReason && (
                                <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded text-xs">
                                  <span className="font-medium text-red-800 dark:text-red-400">Rejection Reason: </span>
                                  <span className="text-red-700 dark:text-red-300">{req.rejectionReason}</span>
                                </div>
                              )}
                            </motion.div>
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

      {/* Main Table */}
      <Card className="border-2 border-orange-200 dark:border-orange-900/50 shadow-lg overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-950/20 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-orange-500 text-white shadow-lg"><Clock className="h-4 w-4" /></div>
              Punch Logs
              {isDayCare && (
                <span className="text-xs font-normal text-muted-foreground flex items-center gap-1 ml-2">
                  <Car className="h-3 w-3 text-blue-500" />Driver/Aide: 1.25 AM + 5.5 Regular + PM (derived)
                </span>
              )}
            </CardTitle>
            <div className="flex flex-col md:flex-row items-end md:items-center gap-2 md:gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>Total Duration: <span className="font-semibold text-gray-900 dark:text-gray-100">{totalDurationHours}</span></span>
              <span>Total Period Hours: <span className="font-semibold text-gray-900 dark:text-gray-100">{totalPeriodHours}</span></span>
              <TooltipProvider delayDuration={200}><Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 text-xs cursor-help">
                    <Globe className="w-3 h-3" />
                    <span className="font-medium text-primary">{getTimezoneName(companyTimezone)}</span>
                    {userTimezone !== companyTimezone && (
                      <span className="text-muted-foreground opacity-60">· Detected: {getTimezoneName(userTimezone)}</span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <div>Company HQ: {companyTimezone}</div>
                  <div className="text-muted-foreground">Detected timezone: {userTimezone}</div>
                </TooltipContent>
              </Tooltip></TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10"></TableHead>
                  {columnOptions
                    .filter((c) => columnVisibility.includes(c.value))
                    .map(({ value, label }) => {
                      if (value === "employee") {
                        const isActive = sortConfig.key === "employee";
                        return (
                          <TableHead
                            key={value}
                            className="text-center text-nowrap font-semibold cursor-pointer select-none hover:bg-muted/80 transition-colors"
                            onClick={toggleNameSort}
                          >
                            <span className="inline-flex items-center justify-center gap-1">
                              {label}
                              {isActive
                                ? (sortConfig.direction === "ascending"
                                    ? <ChevronUp className="h-3.5 w-3.5" />
                                    : <ChevronDown className="h-3.5 w-3.5" />)
                                : <ChevronUp className="h-3.5 w-3.5 opacity-25" />}
                            </span>
                          </TableHead>
                        );
                      }
                      return <TableHead key={value} className="text-center text-nowrap font-semibold">{label}</TableHead>;
                    })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeleton rows={6} cols={columnVisibility.length + 1} />
                ) : displayed.length ? (
                  <AnimatePresence>
                    {displayed.map((t, index) => {
                      const isExpanded = expandedRow === t.id;
                      const renderCell = (colKey) => {
                        switch (colKey) {
                          case "id":
                            return <TableCell key="id" className="font-mono text-xs text-center"><Badge variant="outline" className="font-mono">{t.id}</Badge></TableCell>;
                          case "schedule":
                            return <TableCell key="schedule" className="text-center"><ScheduleBadge isScheduled={t.isScheduled} onClick={() => { setScheduleList(t.scheduleList); setSchedDialogOpen(true); }} /></TableCell>;
                          case "locationRestricted":
                            return <TableCell key="locationRestricted" className="text-center"><LocationBadge isRestricted={t.isLocRestricted} onClick={() => { setLocationDialogList(t.locList); setLocationDialogOpen(true); }} /></TableCell>;

                          // ── G-1 + D-4: Employee cell with flag icons ───────────
                          case "employee":
                            return (
                              <TableCell key="employee" className="text-left text-sm font-medium">
                                <div className="flex items-center gap-1.5">
                                  {/* G-1: Unscheduled punch */}
                                  {!t.isScheduled && (
                                    <TooltipProvider delayDuration={200}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                          <div className="text-sm font-semibold text-amber-700">Unscheduled Punch (G-1)</div>
                                          <div className="text-xs mt-1">No shift assigned for this date. Flagged for SV review.</div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {/* D-4: Regular into PM territory */}
                                  {t.isD4Flag && (
                                    <TooltipProvider delayDuration={200}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                          <div className="text-sm font-semibold text-red-700">Late Clock-Out (D-4)</div>
                                          <div className="text-xs mt-1">Regular employee clocked out past scheduled end by more than {gracePeriodMins} min. SV review required.</div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {/* G-6: Auto clock-out icon */}
                                  {t.isAutoClockOut && t.dayCutoffStatus !== "approved" && (
                                    <TooltipProvider delayDuration={200}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Timer className="h-3.5 w-3.5 text-purple-500 flex-shrink-0 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                          <div className="text-sm font-semibold text-purple-700">Auto Clock-Out (G-6)</div>
                                          <div className="text-xs mt-1">
                                            Session exceeded the maximum active duration. System auto-closed this record.
                                            Clock-out was set to scheduled end time. Mandatory SV review required.
                                          </div>
                                          {t.autoClockOutAt && (
                                            <div className="text-xs mt-1 text-muted-foreground">
                                              Triggered at: {safeDateTime(t.autoClockOutAt)}
                                            </div>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  <span className="max-w-[180px] truncate" title={t.employeeName}>
                                    {fmtLastFirst(employeeNameMap[t.userId]?.firstName, employeeNameMap[t.userId]?.lastName) || t.employeeName}
                                  </span>
                                </div>
                              </TableCell>
                            );

                          case "dateTimeIn":
                            return (
                              <TableCell key="dateTimeIn" className="text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <DualTimeDisplay datetime={t.dayApprovedClockIn ?? t.timeIn} userTz={userTimezone} companyTz={companyTimezone} />
                                  {t.isTooEarlyPunch && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                      Too Early
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            );
                          case "dateTimeOut":
                            return <TableCell key="dateTimeOut" className="text-center"><DualTimeDisplay datetime={t.dayApprovedClockOut ?? t.timeOut} userTz={userTimezone} companyTz={companyTimezone} /></TableCell>;
                          case "duration":
                            return <TableCell key="duration" className="text-center text-sm font-medium"><TimeDisplayWithTooltip time={t.duration} type="duration" /></TableCell>;
                          case "gross":
                            return <TableCell key="gross" className="text-center text-sm">{t.grossHours != null ? <TimeDisplayWithTooltip time={t.grossHours} type="duration" /> : <span className="text-muted-foreground">—</span>}</TableCell>;
                          case "coffee": {
                            const coffeeAuto = t.autoCoffeeApplied || t.coffeeBreaks?.some(b => b.auto);
                            const coffeeDeductible = t.coffeeBreaks?.find(b => b.auto)?.deductible ?? true;
                            const autoBreak = t.coffeeBreaks?.find(b => b.auto && b.start && b.end);
                            const coffeeWindow = autoBreak
                              ? `${safeTime(autoBreak.start, companyTimezone)} – ${safeTime(autoBreak.end, companyTimezone)}`
                              : null;
                            return (
                              <TableCell key="coffee" className="text-center text-sm">
                                <div className="flex flex-col items-center gap-0.5">
                                  <div className="flex items-center justify-center gap-1">
                                    <Coffee className="w-3 h-3 text-amber-600" />
                                    <TimeDisplayWithTooltip time={t.coffeeMins} type="coffee" />
                                    {coffeeAuto && <AutoBreakBadge deductible={coffeeDeductible} />}
                                  </div>
                                  {coffeeWindow && (
                                    <span className="text-[10px] font-mono text-muted-foreground">{coffeeWindow}</span>
                                  )}
                                </div>
                              </TableCell>
                            );
                          }
                          case "lunch": {
                            const lunchAuto = t.autoLunchApplied || t.lunchBreak?.auto || (!t.lunchBreak?.start && (t.lunchDeductionMinutes ?? 0) > 0);
                            const lunchDeductible = t.lunchBreak?.deductible ?? true;
                            const lunchWindow = (lunchAuto && t.lunchBreak?.start && t.lunchBreak?.end)
                              ? `${safeTime(t.lunchBreak.start, companyTimezone)} – ${safeTime(t.lunchBreak.end, companyTimezone)}`
                              : null;
                            return (
                              <TableCell key="lunch" className="text-center text-sm">
                                <div className="flex flex-col items-center gap-0.5">
                                  <div className="flex items-center justify-center gap-1">
                                    <TimeDisplayWithTooltip time={t.lunchMins} type="lunch" />
                                    {lunchAuto && <AutoBreakBadge deductible={lunchDeductible} />}
                                  </div>
                                  {lunchWindow && (
                                    <span className="text-[10px] font-mono text-muted-foreground">{lunchWindow}</span>
                                  )}
                                </div>
                              </TableCell>
                            );
                          }
                          case "ot":
                            return <TableCell key="ot" className="text-center text-sm font-medium"><TimeDisplayWithTooltip time={parseFloat(t.otHours) > 0 ? t.otHours : null} type="overtime" /></TableCell>;
                          case "otStatus":
                            return (
                              <TableCell key="otStatus" className="text-center">
                                {!t.isDailyBasis ? (
                                  <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          variant="outline"
                                          className="text-xs text-muted-foreground border-dashed cursor-help"
                                        >
                                          <Timer className="w-3 h-3 mr-1 opacity-50" />
                                          {t.otBasis === "weekly" ? "Weekly" : "Cutoff"} basis
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <div className="text-sm font-semibold">
                                          {t.otBasis === "weekly" ? "Weekly" : "Cutoff period"} OT basis
                                        </div>
                                        <div className="text-xs mt-1">
                                          OT for this company is calculated across multiple records.
                                          Per-punch detection is not available — review cumulative
                                          hours during cutoff approval.
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <OvertimeBadge
                                    otStatus={t.otStatus}
                                    overtimeRec={t.overtimeRec}
                                    onClick={() => {
                                      if (t.overtimeRec) {
                                        setOtViewData({ ot: t.overtimeRec, log: t });
                                        setOtDialogOpen(true);
                                      }
                                    }}
                                  />
                                )}
                              </TableCell>
                            );
                          case "late":
                            return <TableCell key="late" className="text-center text-sm">{t.dayCutoffStatus !== "approved" && parseFloat(t.lateHours) > 0 ? <TimeDisplayWithTooltip time={t.lateHours} type="late" className="text-red-600 font-medium" /> : <span className="text-muted-foreground">—</span>}</TableCell>;
                          case "undertime":
                            return <TableCell key="undertime" className="text-center text-sm">{t.dayCutoffStatus !== "approved" && parseFloat(t.undertimeHours) > 0 ? <TimeDisplayWithTooltip time={t.undertimeHours} type="late" className="text-amber-600 font-medium" /> : <span className="text-muted-foreground">—</span>}</TableCell>;
                          case "deviceIn":
                            return <TableCell key="deviceIn" className="text-center"><DeviceDisplay device={t.fullDevIn} /></TableCell>;
                          case "deviceOut":
                            return <TableCell key="deviceOut" className="text-center"><DeviceDisplay device={t.fullDevOut} /></TableCell>;
                          case "locationIn":
                            return <TableCell key="locationIn" className="text-center"><LocationDisplay location={t.locIn} /></TableCell>;
                          case "locationOut":
                            return <TableCell key="locationOut" className="text-center"><LocationDisplay location={t.locOut} /></TableCell>;
                          case "period":
                            return <TableCell key="period" className="text-center text-sm font-semibold"><TimeDisplayWithTooltip time={t.periodHours} type="period" /></TableCell>;

                          // ── D-5: Status cell with missing clock-out badge ──────
                          case "status":
                            return (
                              <TableCell key="status" className="text-center">
                                {t.isMissingClockOut ? (
                                  <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          variant="outline"
                                          className="bg-red-50 border-red-300 text-red-700 dark:bg-red-950/30 dark:text-red-400 cursor-help animate-pulse"
                                        >
                                          <AlertTriangle className="w-3 h-3 mr-1" />
                                          Missing Out
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <div className="text-sm font-semibold text-red-700">Missing Clock-Out (D-5)</div>
                                        <div className="text-xs mt-1">
                                          Active session past scheduled shift end. Employee has not clocked out.
                                          Record cannot be approved until clock-out is provided or manually entered by SV.
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <StatusBadge status={t.status} />
                                )}
                              </TableCell>
                            );

                          case "punchType":
                            return <TableCell key="punchType" className="text-center"><PunchTypeBadge punchType={t.punchType} /></TableCell>;
                          case "cutoffApproval":
                            return (
                              <TableCell key="cutoffApproval" className="text-center">
                                <CutoffApprovalBadge cutoffApproval={t.cutoffApproval} dayCutoffStatus={t.dayCutoffStatus} />
                              </TableCell>
                            );
                          case "actions":
                            return (
                              <TableCell key="actions" className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {canEdit && t.status !== "active" && t.dayCutoffStatus !== "approved" ? (
                                    <>
                                      {/* Edit Time In/Out */}
                                      <TooltipProvider delayDuration={200}><Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(t)} className="h-8 w-8 p-0 hover:bg-orange-50 hover:text-orange-600">
                                            <Edit3 className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Edit Time In/Out</TooltipContent>
                                      </Tooltip></TooltipProvider>

                                      {/* Edit Punch Type — DayCare only */}
                                      {isDayCare && (
                                        <TooltipProvider delayDuration={200}><Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button variant="ghost" size="sm" onClick={() => { setEditPunchTypeLog(t); setEditPunchTypeVal(t.punchType || "REGULAR"); setEditPunchTypeOpen(true); }} className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600">
                                              <Tag className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Edit Punch Type</TooltipContent>
                                        </Tooltip></TooltipProvider>
                                      )}

                                      {/* Delete */}
                                      <TooltipProvider delayDuration={200}><Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="sm" onClick={() => { setDeleteLog(t); setDeleteConfirmOpen(true); }} className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600">
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Delete Punch Log</TooltipContent>
                                      </Tooltip></TooltipProvider>
                                    </>
                                  ) : <span className="text-muted-foreground text-xs">—</span>}
                                </div>
                              </TableCell>
                            );
                          default: return null;
                        }
                      };

                      return (
                        <Fragment key={t.id}>
                          <motion.tr
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.02 }}
                            // ── G-1 + D-4: Row color coding ──────────────────
                            className={`border-b transition-all cursor-pointer ${
                              isExpanded
                                ? "bg-muted/30 hover:bg-muted/40"
                                : t.isAutoClockOut && t.dayCutoffStatus !== "approved"
                                ? "bg-purple-50/40 dark:bg-purple-950/10 hover:bg-purple-50/60 border-l-2 border-l-purple-400"
                                : t.isD4Flag
                                ? "bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50/70 dark:hover:bg-red-950/20 border-l-2 border-l-red-400"
                                : !t.isScheduled
                                ? "bg-amber-50/50 dark:bg-amber-950/10 hover:bg-amber-100/50 dark:hover:bg-amber-950/20 border-l-2 border-l-amber-400"
                                : "hover:bg-muted/50"
                            }`}
                            onClick={() => setExpandedRow(isExpanded ? null : t.id)}
                          >
                            <TableCell className="w-10">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              </Button>
                            </TableCell>
                            {columnOptions
                              .filter((col) => columnVisibility.includes(col.value))
                              .map((col) => renderCell(col.value))}
                          </motion.tr>

                          {/* Expanded row */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.tr
                                key={`${t.id}-expand`}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="bg-muted/20"
                              >
                                <TableCell colSpan={columnVisibility.length + 1} className="p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Column 1: Break Times / Hours Breakdown */}
                                    <div className="space-y-3">
                                      <h4 className="font-semibold text-sm flex items-center gap-2">
                                        {t.isAnyDA ? (
                                          <Car className="h-4 w-4 text-blue-500" />
                                        ) : (
                                          <Clock className="h-4 w-4 text-orange-500" />
                                        )}
                                        {t.isAnyDA
                                          ? t.isDA
                                            ? "Driver/Aide Hours Breakdown"
                                            : t.isDA_AM
                                            ? "Driver AM Hours Breakdown"
                                            : "Driver PM Hours Breakdown"
                                          : "Break Times"}
                                      </h4>

                                      {t.isAnyDA ? (
                                        <DriverAideBreakdown log={t} companyTimezone={companyTimezone} />
                                      ) : (
                                        <div className="space-y-2 text-sm">
                                          <div className="flex justify-between items-start">
                                            <span className="text-muted-foreground">Coffee Break:</span>
                                            <span className="font-medium flex flex-col items-end gap-0.5">
                                              <span className="flex items-center gap-1">
                                                {t.coffeeMins}h
                                                {(t.autoCoffeeApplied || t.coffeeBreaks?.some(b => b.auto)) && <AutoBreakBadge deductible={t.coffeeBreaks?.find(b => b.auto)?.deductible ?? true} />}
                                              </span>
                                              {t.coffeeBreaks?.filter(b => b.auto && b.start && b.end).map((b, i) => (
                                                <span key={i} className="text-[10px] font-mono text-muted-foreground">
                                                  {safeTime(b.start, companyTimezone)} – {safeTime(b.end, companyTimezone)}
                                                </span>
                                              ))}
                                            </span>
                                          </div>
                                          <div className="flex justify-between items-start">
                                            <span className="text-muted-foreground">Lunch Break:</span>
                                            <span className="font-medium flex flex-col items-end gap-0.5">
                                              <span className="flex items-center gap-1">
                                                {t.lunchMins}h
                                                {(t.autoLunchApplied || t.lunchBreak?.auto || (!t.lunchBreak?.start && (t.lunchDeductionMinutes ?? 0) > 0)) && <AutoBreakBadge deductible={t.lunchBreak?.deductible ?? true} />}
                                              </span>
                                              {(t.autoLunchApplied || t.lunchBreak?.auto) && t.lunchBreak?.start && t.lunchBreak?.end && (
                                                <span className="text-[10px] font-mono text-muted-foreground">
                                                  {safeTime(t.lunchBreak.start, companyTimezone)} – {safeTime(t.lunchBreak.end, companyTimezone)}
                                                </span>
                                              )}
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Late Hours:</span>
                                            <span className="font-medium">{t.dayCutoffStatus !== "approved" && parseFloat(t.lateHours) > 0 ? `${t.lateHours}h` : "—"}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Period Hours:</span>
                                            <span className="font-medium">{t.periodHours}h</span>
                                          </div>
                                          <div className="flex justify-between pt-2 border-t">
                                            <span className="text-muted-foreground font-medium">Duration:</span>
                                            <span className="font-bold text-orange-600">{t.duration}h</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Column 2: Device & Location */}
                                    <div className="space-y-3">
                                      <h4 className="font-semibold text-sm flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-orange-500" />
                                        Device &amp; Location
                                      </h4>
                                      <div className="space-y-2 text-sm">
                                        <div>
                                          <span className="text-muted-foreground block mb-1">Device In:</span>
                                          <code className="text-xs bg-muted px-2 py-1 rounded block truncate" title={t.fullDevIn}>{t.fullDevIn}</code>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground block mb-1">Device Out:</span>
                                          <code className="text-xs bg-muted px-2 py-1 rounded block truncate" title={t.fullDevOut}>{t.fullDevOut}</code>
                                        </div>
                                        {t.locIn?.lat && (
                                          <div>
                                            <span className="text-muted-foreground block mb-1">Location In:</span>
                                            <a href={`https://www.google.com/maps?q=${t.locIn.lat},${t.locIn.lng}`} target="_blank" rel="noopener noreferrer"
                                              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                              <MapPin className="h-3 w-3" />{t.locIn.txt}
                                            </a>
                                          </div>
                                        )}
                                        {t.locOut?.lat && (
                                          <div>
                                            <span className="text-muted-foreground block mb-1">Location Out:</span>
                                            <a href={`https://www.google.com/maps?q=${t.locOut.lat},${t.locOut.lng}`} target="_blank" rel="noopener noreferrer"
                                              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                              <MapPin className="h-3 w-3" />{t.locOut.txt}
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Column 3: Employee Details */}
                                    <div className="space-y-3">
                                      <h4 className="font-semibold text-sm flex items-center gap-2">
                                        <User className="h-4 w-4 text-orange-500" />
                                        Employee Details
                                      </h4>
                                      <div className="space-y-1.5 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Employee:</span>
                                          <span className="font-medium">
                                            {fmtLastFirst(employeeNameMap[t.userId]?.firstName, employeeNameMap[t.userId]?.lastName) || t.employeeName}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Department:</span>
                                          <span>{t.department || "—"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Shift:</span>
                                          <span>{t.shiftName}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Punch Type:</span>
                                          <PunchTypeBadge punchType={t.punchType} />
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">OT Status:</span>
                                          <span>{t.otStatus}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Grace Period:</span>
                                          <span className="text-xs text-muted-foreground">{gracePeriodMins} min</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Early Clock-In Grace:</span>
                                          <span className="text-xs text-muted-foreground">{earlyClockInGraceMins} min</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Cutoff:</span>
                                          <CutoffApprovalBadge cutoffApproval={t.cutoffApproval} dayCutoffStatus={t.dayCutoffStatus} />
                                        </div>
                                      </div>

                                      {/* D-4 warning */}
                                      {t.isD4Flag && (
                                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-red-700 dark:text-red-400">
                                            <strong>D-4:</strong> Regular employee clocked out into PM territory — more than {gracePeriodMins} min past scheduled end.
                                            PM hours not credited. SV review required.
                                          </p>
                                        </div>
                                      )}

                                      {/* D-5 warning */}
                                      {t.isMissingClockOut && (
                                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-red-700 dark:text-red-400">
                                            <strong>D-5:</strong> Session is active past scheduled shift end. Clock-out is missing.
                                            Record cannot be approved until clock-out is provided or manually entered by SV.
                                          </p>
                                        </div>
                                      )}

                                      {/* G-6 auto clock-out warning */}
                                      {t.isAutoClockOut && t.dayCutoffStatus !== "approved" && (
                                        <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg flex items-start gap-2">
                                          <Timer className="h-3.5 w-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-purple-700 dark:text-purple-400">
                                            <strong>G-6:</strong> This session was automatically closed by the system after exceeding
                                            the maximum active duration. Clock-out was recorded at the scheduled end time.
                                            Mandatory SV review — cannot advance to payroll without approval.
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                              </motion.tr>
                            )}
                          </AnimatePresence>
                        </Fragment>
                      );
                    })}
                  </AnimatePresence>
                ) : (
                  <TableRow>
                    <TableCell colSpan={columnVisibility.length + 1} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                          <Clock className="h-8 w-8 text-orange-500/50" />
                        </div>
                        <h3 className="font-medium mb-2">No punch logs found</h3>
                        <p className="text-sm">No records match your current filter criteria.</p>
                        {anyFilterActive && (
                          <Button variant="link" onClick={clearAllFilters} className="text-orange-600 hover:text-orange-700 mt-2">
                            Clear all filters to see more data
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        {/* Record count footer */}
        {displayed.length > 0 && (
          <div className="border-t bg-muted/30 px-4 py-3 text-sm text-muted-foreground text-right">
            Showing {displayed.length} of {totalRows} records
          </div>
        )}
      </Card>

      {/* ── Dialogs ── */}

      <GenerateReportModal
        open={generateModalOpen}
        onOpenChange={setGenerateModalOpen}
        isDayCare={isDayCare}
        columnOptions={columnOptions}
        defaultFrom={filters.from}
        defaultTo={filters.to}
        defaultColumns={columnOptions.filter((c) => c.value !== "actions").map((c) => c.value)}
        defaultCutoffId={selectedCutoffId}
        cutoffPeriods={cutoffPeriods}
        generating={generating}
        onGenerate={handleGenerateReport}
      />

      <ImportPunchLogs
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        isDayCare={isDayCare}
        currentUserRole={currentUserRole}
        onImportComplete={refreshAll}
      />

      <ImportBacktrackPunchLogs
        open={backtrackImportModalOpen}
        onOpenChange={setBacktrackImportModalOpen}
        cutoffPeriods={cutoffPeriods}
        departments={departments}
        employees={employees}
        currentUserRole={currentUserRole}
        companyTimezone={companyTimezone}
        onImportComplete={refreshAll}
        onCutoffPeriodCreated={fetchCutoffPeriods}
      />

      <ScheduleDialog open={schedDialogOpen} onOpenChange={setSchedDialogOpen} scheduleList={scheduleList} />

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md border-2 dark:border-white/10">
          <div className="h-1 w-full bg-red-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-600" />Reject Punch Log Request</DialogTitle>
          </DialogHeader>
          {rejectingRequest && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg space-y-2 text-sm">
                <div><span className="font-medium">Employee:</span> {rejectingRequest.userDisplayName}</div>
                <div><span className="font-medium">Date:</span> {safeCalendarDate(rejectingRequest.requestedDate)}</div>
                <div><span className="font-medium">Time:</span> {safeTime(rejectingRequest.requestedClockIn)} - {safeTime(rejectingRequest.requestedClockOut)}</div>
                {rejectingRequest.requestedPunchType && (
                  <div className="flex items-center gap-1.5"><span className="font-medium">Shift type:</span> <PunchTypeBadge punchType={rejectingRequest.requestedPunchType} /></div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason for Rejection *</label>
                <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a clear reason..." className="min-h-[100px] resize-none" maxLength={500} />
                <div className="text-xs text-muted-foreground text-right">{rejectionReason.length}/500</div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectingRequest(null); setRejectionReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleRejectRequest} disabled={!rejectionReason.trim()}>Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OT Details Dialog */}
      <Dialog open={otDialogOpen} onOpenChange={setOtDialogOpen}>
        <DialogContent className="sm:max-w-md border-2 dark:border-white/10">
          <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-orange-500" />Overtime Request Details</DialogTitle>
          </DialogHeader>
          {otViewData ? (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div><span className="font-medium">Request ID:</span> {otViewData.ot.id}</div>
                    <div><span className="font-medium">Status:</span><Badge variant="outline" className="ml-2 capitalize">{otViewData.ot.status}</Badge></div>
                    <div><span className="font-medium">OT Hours:</span> {otViewData.log.otHours}</div>
                  </div>
                  <div className="space-y-2">
                    <div><span className="font-medium">Time In:</span>  {safeTime(otViewData.log.timeIn)}</div>
                    <div><span className="font-medium">Time Out:</span> {safeTime(otViewData.log.timeOut)}</div>
                    <div><span className="font-medium">Requested:</span> {safeDate(otViewData.ot.createdAt)}</div>
                  </div>
                </div>
                {otViewData.ot.requesterReason && (
                  <div><span className="font-medium text-sm">Requester Reason:</span><p className="text-sm bg-muted p-2 rounded mt-1">{otViewData.ot.requesterReason}</p></div>
                )}
                {otViewData.ot.approverComments && (
                  <div><span className="font-medium text-sm">Approver Comments:</span><p className="text-sm bg-muted p-2 rounded mt-1">{otViewData.ot.approverComments}</p></div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Info className="h-8 w-8 mb-2 opacity-50" /><p>No overtime data available</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="sm:max-w-md border-2 dark:border-white/30">
          <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-orange-600" />Location Restrictions</DialogTitle>
          </DialogHeader>
          {locationDialogList.length ? (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                {locationDialogList.map((loc) => (
                  <div key={loc.id} className="p-3 border rounded-md bg-muted/50 space-y-2 text-sm">
                    <Badge variant="secondary">{loc.name}</Badge>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div><span className="font-medium">Latitude:</span>  {Number(loc.latitude).toFixed(5)}</div>
                      <div><span className="font-medium">Longitude:</span> {Number(loc.longitude).toFixed(5)}</div>
                      <div><span className="font-medium">Radius:</span>    {loc.radius}m</div>
                    </div>
                    <a href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <MapPin className="w-3 h-3" />View on Google Maps
                    </a>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MapPin className="h-8 w-8 mb-2 opacity-50" /><p>No location restrictions</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {/* ── Edit Punch Type Dialog (DayCare only) ───────────────────────────── */}
      <Dialog open={editPunchTypeOpen} onOpenChange={setEditPunchTypeOpen}>
        <DialogContent className="sm:max-w-sm border-2 dark:border-white/10">
          <div className="h-1 w-full bg-blue-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tag className="h-5 w-5 text-blue-500" />Edit Punch Type</DialogTitle>
          </DialogHeader>
          {editPunchTypeLog && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                <div className="font-medium">{editPunchTypeLog.employeeName}</div>
                <div className="text-muted-foreground">Log ID: {editPunchTypeLog.id}</div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Punch Type</label>
                <Select value={editPunchTypeVal} onValueChange={setEditPunchTypeVal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REGULAR"><span className="flex items-center gap-2"><UserCheck className="h-3.5 w-3.5 text-purple-500" />Regular</span></SelectItem>
                    <SelectItem value="DRIVER_AIDE"><span className="flex items-center gap-2"><Car className="h-3.5 w-3.5 text-blue-500" />Driver/Aide (Full)</span></SelectItem>
                    <SelectItem value="DRIVER_AIDE_AM"><span className="flex items-center gap-2"><Car className="h-3.5 w-3.5 text-blue-500" />Driver AM only</span></SelectItem>
                    <SelectItem value="DRIVER_AIDE_PM"><span className="flex items-center gap-2"><Car className="h-3.5 w-3.5 text-blue-500" />Driver PM only</span></SelectItem>
                    <SelectItem value="TRAINING"><span className="flex items-center gap-2"><BookOpen className="h-3.5 w-3.5 text-green-500" />Training</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPunchTypeOpen(false)}>Cancel</Button>
            <Button onClick={submitEditPunchType} disabled={savingPunchType} className="bg-blue-500 hover:bg-blue-600">
              {savingPunchType ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ───────────────────────────────────────── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-sm border-2 dark:border-white/10">
          <div className="h-1 w-full bg-red-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-red-500" />Delete Punch Log</DialogTitle>
          </DialogHeader>
          {deleteLog && (
            <div className="py-4 space-y-3">
              <p className="text-sm text-muted-foreground">This action cannot be undone. The following record will be permanently deleted.</p>
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm space-y-1">
                <div className="font-medium text-red-800 dark:text-red-300">{deleteLog.employeeName}</div>
                <div className="text-red-600 dark:text-red-400">
                  In: {safeDateTime(deleteLog.timeIn, companyTimezone)} — Out: {safeDateTime(deleteLog.timeOut, companyTimezone)}
                </div>
                <div className="text-xs text-muted-foreground">Log ID: {deleteLog.id}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button onClick={confirmDelete} disabled={deletingLog} variant="destructive">
              {deletingLog ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md border-2 dark:border-white/10">
          <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-orange-500" />Edit Time In / Time Out</DialogTitle>
          </DialogHeader>
          {editLog && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Time In</label>
                <Input type="datetime-local" value={editTimeIn} onChange={(e) => setEditTimeIn(e.target.value)} className="w-full" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Time Out</label>
                <Input type="datetime-local" value={editTimeOut} onChange={(e) => setEditTimeOut(e.target.value)} className="w-full" />
              </div>
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <div className="font-medium mb-1">Employee: {editLog.employeeName}</div>
                <div className="text-muted-foreground">Log ID: {editLog.id}</div>
                {editLog.isAnyDA && (
                  <div className="mt-2 flex items-center gap-1 text-xs">
                    <Car className="h-3 w-3 text-blue-500" />
                    <span className="text-blue-600 dark:text-blue-400">
                      {editLog.isDA    ? "Driver/Aide — AM (1.25h fixed) + Regular (5.5h fixed) + PM (derived)" :
                       editLog.isDA_AM ? "Driver/Aide AM — AM (1.25h fixed) + Regular (derived)" :
                                         "Driver/Aide PM — Regular (5.5h fixed) + PM (derived)"} — hours will recalculate on save
                    </span>
                  </div>
                )}
                {editLog.isAutoClockOut && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-purple-600">
                    <Timer className="h-3 w-3" />
                    This record was auto-closed by G-6. SV review required after edit.
                  </div>
                )}
              </div>
              {(editLog.autoLunchApplied || editLog.autoCoffeeApplied) && (
                <div className="border border-red-200 rounded-lg p-3 bg-red-50 dark:bg-red-950/20 dark:border-red-800 space-y-2">
                  <div className="text-sm font-medium text-red-700 dark:text-red-400">Auto-Injected Breaks</div>
                  <div className="text-xs text-red-600 dark:text-red-500 space-y-1">
                    {editLog.autoLunchApplied && (
                      <div>• Lunch: {editLog.lunchMins}h — {editLog.lunchBreak?.deductible === false ? "paid (paper-trail only)" : "deducted from pay"}</div>
                    )}
                    {editLog.autoCoffeeApplied && (
                      <div>• Coffee: {editLog.coffeeMins}h — {editLog.coffeeBreaks?.find(b => b.auto)?.deductible === false ? "paid (paper-trail only)" : "deducted from pay"}</div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                    onClick={clearAutoBreaks}
                    disabled={clearingAutoBreaks}
                  >
                    {clearingAutoBreaks ? "Clearing…" : "Clear Auto-Breaks & Reset Flags"}
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitEdit} className="bg-orange-500 hover:bg-orange-600">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}