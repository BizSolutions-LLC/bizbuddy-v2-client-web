// components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/cutoffPeriodsShared.jsx
// BB-121: data, actions and dialogs shared by the two cutoff list pages —
// List Type (EmployeeCutoff.jsx) and Calendar Type (CutoffPeriodsCalendar.jsx).
// Moved out of EmployeeCutoff.jsx unchanged; behaviour is the same on both pages.
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Eye,
  Lock,
  CheckCircle2,
  Search,
  Check,
  Settings,
  Zap,
  Loader2,
  CircleDot,
  Pencil,
  Download,
  RotateCcw,
  AlertTriangle,
  History,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import useAccountRole from "@/lib/hooks/useAccountRole";
import { isSystemAgentToken } from "@/lib/systemAgent";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
export const FREQUENCY_LABELS = {
  "bi-weekly":  "Bi-Weekly",
  "bi-monthly": "Bi-Monthly",
  "monthly":    "Monthly",
};

export const STATUS_CONFIG = {
  open:      { label: "Open",      color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",  icon: CircleDot },
  locked:    { label: "Locked",    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",  icon: Lock },
  processed: { label: "Processed", color: "bg-blue-100  text-blue-700  dark:bg-blue-900/30  dark:text-blue-400",   icon: CheckCircle2 },
};

const GENERATE_MODES = [
  { value: "future",     label: "Next 3 Months (Future Only)" },
  { value: "historical", label: "Jan 2026 – Today (Backfill)" },
  { value: "range",      label: "Custom Date Range" },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export const formatDate = (d) => {
  if (!d) return "—";
  const [year, month, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
};

/** "YYYY-MM-DD..." → local Date at midnight (dates are calendar dates, not instants). */
export const dateOnly = (d) => {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day);
};

export const initConfigForm = () => ({
  departmentId: "",
  frequency: "bi-weekly",
  startDate: "",
  paymentOffsetDays: 5,
});

export const initManualForm = () => ({
  departmentId: "",
  periodStart: "",
  periodEnd: "",
  paymentDate: "",
  frequency: "bi-weekly",
});

// ─────────────────────────────────────────────────────────────────────────────
// SMALL SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Status badge */
export const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  const Icon = cfg.icon;
  return (
    <Badge className={`${cfg.color} gap-1`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BB-149 follow-up: reopen a processed cutoff — badge, history, outdated export
// Server: POST /api/cutoff-periods/:id/reopen; list adds reopenCount / lastReopen and
// payrollExport.outdated(+Departments); detail adds statusHistory[] (oldest first).
// History starts with that server release (earlier changes aren't recorded).
// ─────────────────────────────────────────────────────────────────────────────

/** Reason limits — same as the server (REOPEN_REASON_REQUIRED). */
export const REOPEN_REASON_MIN = 5;
export const REOPEN_REASON_MAX = 500;

/** "Nov 25, 2026, 3:42 PM" — an instant (when a status changed), in the viewer's time. */
export const formatStamp = (at) => {
  if (!at) return "—";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
};

/** Who did it. Support events: the server's name, "B. Buddy (123)" (older events: "B. Buddy"). */
export const actorLabel = (e) => (e?.bySupport ? e?.by?.name || "B. Buddy" : e?.by?.name || "Unknown user");

const STATUS_WORD = { open: "Open", locked: "Locked", processed: "Processed" };

/** "Reopened ×N" — hover shows the last reopen (who, when, reason). Nothing if never reopened. */
export const ReopenedBadge = ({ period }) => {
  const n = period?.reopenCount || 0;
  if (!n) return null;
  const last = period.lastReopen;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-300 cursor-help whitespace-nowrap">
            <RotateCcw className="w-3 h-3" /> Reopened ×{n}
          </Badge>
        </TooltipTrigger>
        {last && (
          <TooltipContent side="bottom" className="max-w-xs text-xs space-y-0.5">
            <p className="font-semibold">Last reopened {formatStamp(last.at)}</p>
            <p>By {actorLabel(last)}</p>
            {last.reason && <p className="opacity-80">“{last.reason}”</p>}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};

/** "Outdated: Kitchen reopened, process again to update" — next to the payroll export. */
export const OutdatedExportNote = ({ exp, className = "" }) => {
  if (!exp?.outdated) return null;
  const depts = (exp.outdatedDepartments || []).filter(Boolean);
  return (
    <p className={`flex items-start gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 ${className}`}>
      <AlertTriangle className="w-3.5 h-3.5 mt-px flex-shrink-0" />
      <span>Outdated: {depts.length ? depts.join(", ") : "a department"} reopened, process again to update.</span>
    </p>
  );
};

/** Status history (newest first), each move with its timestamp, who, and the reason. */
export const StatusHistoryList = ({ history }) => {
  const rows = Array.isArray(history) ? [...history].reverse() : [];
  if (rows.length === 0) {
    return <p className="text-xs text-neutral-500">No status changes recorded yet. History starts with the reopen release.</p>;
  }
  return (
    <ol className="space-y-2.5">
      {rows.map((e, i) => (
        <li key={i} className="border-l-2 border-neutral-200 dark:border-neutral-700 pl-3">
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
            {/* action: "status" (Lock / Unlock / Mark Processed), "finalize" (Finalize Cutoff → locked), "reopen" */}
            {e.action === "reopen"
              ? "Reopened"
              : e.action === "finalize"
                ? "Finalized"
                : `${STATUS_WORD[e.fromStatus] || e.fromStatus} → ${STATUS_WORD[e.toStatus] || e.toStatus}`}
            {e.action !== "status" && e.fromStatus && e.toStatus && (
              <span className="ml-1.5 text-xs font-normal text-neutral-400">
                {STATUS_WORD[e.fromStatus] || e.fromStatus} → {STATUS_WORD[e.toStatus] || e.toStatus}
              </span>
            )}
          </p>
          <p className="text-xs text-neutral-500">
            {formatStamp(e.at)} · {actorLabel(e)}
          </p>
          {e.reason && <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">“{e.reason}”</p>}
        </li>
      ))}
    </ol>
  );
};

/** Review page header: "Reopened ×N" + a History button listing every status move with its timestamp. */
export const CutoffHistoryButton = ({ cutoff }) => {
  if (!cutoff) return null;
  const history = cutoff.statusHistory || [];
  return (
    <div className="flex items-center gap-2">
      <ReopenedBadge period={cutoff} />
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="gap-1.5 text-neutral-600 dark:text-neutral-300">
            <History className="w-3.5 h-3.5" /> History
            {history.length > 0 && <span className="text-xs text-neutral-400">{history.length}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 max-h-[60vh] overflow-y-auto">
          <p className="text-sm font-bold text-neutral-800 dark:text-neutral-100 mb-3">Status history</p>
          <StatusHistoryList history={history} />
        </PopoverContent>
      </Popover>
    </div>
  );
};

/** Department config panel — schedule info, generate periods, upcoming periods */
export const DeptConfigPanel = ({
  dept,
  setting,
  upcomingPeriods,
  isGenerating,
  onGenerate,
  onEditConfig,
  formatDate,
  readOnly = false, // BB-121: Calendar preview — no Configure / Edit / Generate
}) => {
  const [mode, setMode] = useState("future");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo,   setRangeTo]   = useState("");

  const handleGenerate = () => {
    if (mode === "range") onGenerate(dept.id, "range", rangeFrom, rangeTo);
    else onGenerate(dept.id, mode);
  };

  if (!setting) {
    return (
      <div className="mt-4 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl p-10 text-center">
        <Settings className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
        <h3 className="font-semibold text-base mb-1">No configuration found</h3>
        <p className="text-sm text-neutral-500 mb-4">
          Set up automatic cutoff generation for <strong>{dept.name}</strong>
        </p>
        <Button onClick={onEditConfig} disabled={readOnly} className="bg-orange-500 hover:bg-orange-600 gap-2">
          <Settings className="w-4 h-4" /> Configure Now
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      {/* Configuration Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wide text-neutral-500">
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-neutral-400">Frequency</p>
            <p className="font-semibold">{FREQUENCY_LABELS[setting.frequency] || setting.frequency}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Starting Date</p>
            <p className="font-semibold">{formatDate(setting.startDate)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Payment Offset</p>
            <p className="font-semibold">{setting.paymentOffsetDays} days</p>
            <p className="text-xs text-neutral-400">after cutoff ends</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2 mt-1"
            onClick={onEditConfig}
            disabled={readOnly}
          >
            <Pencil className="w-3 h-3" /> Edit Settings
          </Button>
        </CardContent>
      </Card>

      {/* Generate Periods */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wide text-neutral-500">
            Generate Periods
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GENERATE_MODES.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {mode === "historical" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-300">
              Generates all periods from <strong>Jan 1, 2026</strong> to today.
              Past periods will be marked as processed.
            </div>
          )}

          {mode === "range" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" className="text-xs h-8" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" className="text-xs h-8" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} max={new Date().toISOString().split("T")[0]} />
              </div>
            </div>
          )}

          <Button
            size="sm"
            className="w-full gap-2 bg-orange-500 hover:bg-orange-600"
            onClick={handleGenerate}
            disabled={readOnly || isGenerating || (mode === "range" && (!rangeFrom || !rangeTo))}
          >
            {isGenerating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Zap className="w-3 h-3" />
            )}
            {mode === "future"     && "Generate Next 3 Months"}
            {mode === "historical" && "Backfill Jan 2026 – Today"}
            {mode === "range"      && "Generate Custom Range"}
          </Button>
        </CardContent>
      </Card>

      {/* Upcoming Periods */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wide text-neutral-500">
            Upcoming Periods
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingPeriods.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-6">No upcoming periods</p>
          ) : (
            <div className="space-y-2">
              {upcomingPeriods.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                  <div>
                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                    </p>
                    <p className="text-xs text-neutral-400">Pay: {formatDate(p.paymentDate)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DATA + ACTIONS HOOK
// ─────────────────────────────────────────────────────────────────────────────
// Options:
//   useCompanyName — periods with no department are company-wide; label them with the
//                    company's name (from GET /api/account/profile, open to every role)
//                    instead of "No Department". Used by the Calendar page only.
export function useCutoffPeriods({ useCompanyName = false } = {}) {
  const { token } = useAuthStore();
  // useAuthStore has no `role` — it comes from /api/account/profile (useAccountRole, BB-151).
  const { isAdmin } = useAccountRole();
  const [companyName, setCompanyName] = useState("");
  // BB-120: B. Buddy has no payroll access, so the payroll export preview is hidden
  const isSupport = isSystemAgentToken(token);
  // BB-149 follow-up: reopening a processed cutoff is admin / superadmin only (B. Buddy too)
  const canReopen = isAdmin;

  // ── Data state ──
  const [departments,         setDepartments]         = useState([]);
  const [departmentSettings,  setDepartmentSettings]  = useState([]);
  const [cutoffPeriods,       setCutoffPeriods]       = useState([]);

  // ── UI state ──
  const [isLoading,           setIsLoading]           = useState(true);
  const [isGenerating,        setIsGenerating]        = useState({});
  const [isConfigModalOpen,   setIsConfigModalOpen]   = useState(false);
  const [isManualModalOpen,   setIsManualModalOpen]   = useState(false);
  const [isSaving,            setIsSaving]            = useState(false);
  const [statusConfirm,       setStatusConfirm]       = useState(null); // { periodId, departmentId, newStatus }
  const [isUpdatingStatus,    setIsUpdatingStatus]    = useState(false);
  const [isReportPreviewOpen, setIsReportPreviewOpen] = useState(false);
  const [loadingAction,       setLoadingAction]       = useState(null); // { periodId, type: "view" | "download" }
  const [viewingPayload,      setViewingPayload]      = useState(null); // { payload, label }
  // BB-149 follow-up: Reopen dialog (shared with the Calendar review page)
  const fetchCutoffPeriodsRef = useRef(null);
  const reopen = useReopenCutoff({ token, onDone: () => fetchCutoffPeriodsRef.current?.() });
  // Delete confirm (in-app dialog)
  const [deleteTarget, setDeleteTarget] = useState(null); // period
  const [isDeleting,   setIsDeleting]   = useState(false);

  // ── Form state ──
  const [configForm, setConfigForm] = useState(initConfigForm());
  const [manualForm, setManualForm] = useState(initManualForm());

  // ── Fetching ──
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/departments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.data || []);
      }
    } catch (err) {
      console.error("fetchDepartments:", err);
    }
  }, [token]);

  const fetchDepartmentSettings = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff/cutoff-settings/departments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setDepartmentSettings(data.data || []);
      }
    } catch (err) {
      console.error("fetchDepartmentSettings:", err);
    }
  }, [token]);

  const fetchCutoffPeriods = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      setCutoffPeriods(data.data || []);
    } catch (err) {
      console.error("fetchCutoffPeriods:", err);
      toast.error("Failed to load cutoff periods");
    } finally {
      setIsLoading(false);
    }
  }, [token]);
  fetchCutoffPeriodsRef.current = fetchCutoffPeriods;

  useEffect(() => {
    fetchDepartments();
    fetchDepartmentSettings();
  }, [fetchDepartments, fetchDepartmentSettings]);

  useEffect(() => {
    if (!useCompanyName || !token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCompanyName(d?.data?.company?.name || ""))
      .catch(() => {});
  }, [useCompanyName, token]);

  useEffect(() => {
    if (token) fetchCutoffPeriods();
  }, [token, fetchCutoffPeriods]);

  const stats = useMemo(() => ({
    total:     cutoffPeriods.length,
    open:      cutoffPeriods.filter((p) => p.status === "open").length,
    locked:    cutoffPeriods.filter((p) => p.status === "locked").length,
    processed: cutoffPeriods.filter((p) => p.status === "processed").length,
  }), [cutoffPeriods]);

  // ── Actions ──
  const fetchPayrollExportPayload = async (period) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/payroll-export/by-cutoff-period/${period.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "No payroll export has been generated for this period yet");
    }
    return data.data.payload;
  };

  const handleDownloadPayrollExport = async (period) => {
    setLoadingAction({ periodId: period.id, type: "download" });
    try {
      const payload = await fetchPayrollExportPayload(period);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll-export_${period.periodStart.slice(0, 10)}_${period.periodEnd.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Payroll export downloaded");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleViewPayrollExport = async (period) => {
    setLoadingAction({ periodId: period.id, type: "view" });
    try {
      const payload = await fetchPayrollExportPayload(period);
      setViewingPayload({
        payload,
        label: `${formatDate(period.periodStart)} – ${formatDate(period.periodEnd)}`,
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveConfig = async () => {
    if (!configForm.departmentId || !configForm.startDate) {
      toast.error("Please select a department and start date");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff/cutoff-settings/departments`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(configForm),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Configuration saved");
        setIsConfigModalOpen(false);
        setConfigForm(initConfigForm());
        fetchDepartmentSettings();
      } else {
        toast.error(data.message || "Failed to save settings");
      }
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateManual = async () => {
    if (!manualForm.periodStart || !manualForm.periodEnd || !manualForm.paymentDate) {
      toast.error("Please fill in all required dates");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/create`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            ...manualForm,
            departmentId: manualForm.departmentId === "none" ? null : manualForm.departmentId || null,
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Cutoff period created");
        setIsManualModalOpen(false);
        setManualForm(initManualForm());
        fetchCutoffPeriods();
      } else {
        toast.error(data.message || "Failed to create cutoff period");
      }
    } catch (err) {
      toast.error("Failed to create cutoff period");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async (departmentId, mode, fromDate, toDate) => {
    setIsGenerating((prev) => ({ ...prev, [departmentId]: true }));
    try {
      const payload = { departmentId };
      if (mode === "future")     Object.assign(payload, { months: 3, includeHistorical: false });
      if (mode === "historical") Object.assign(payload, { fromDate: "2026-01-01", toDate: new Date().toISOString().split("T")[0], includeHistorical: true });
      if (mode === "range")      Object.assign(payload, { fromDate, toDate, includeHistorical: true });

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff/cutoff-periods/generate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Periods generated");
        fetchCutoffPeriods();
      } else {
        toast.error(data.message || "Failed to generate periods");
      }
    } catch (err) {
      toast.error("Failed to generate periods");
    } finally {
      setIsGenerating((prev) => ({ ...prev, [departmentId]: false }));
    }
  };

  const handleUpdateStatus = async (cutoffId, newStatus) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}/status`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `Cutoff period ${newStatus}`);
        fetchCutoffPeriods();
      } else {
        toast.error(data.message || "Failed to update status");
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const confirmStatusChange = async () => {
    if (!statusConfirm) return;
    setIsUpdatingStatus(true);
    await handleUpdateStatus(statusConfirm.periodId, statusConfirm.newStatus);
    setIsUpdatingStatus(false);
    setStatusConfirm(null);
  };

  // Delete: opens the in-app confirm dialog (never the browser's confirm()); confirmDelete sends it
  const handleDelete = (cutoffId) => {
    const period = cutoffPeriods.find((p) => p.id === cutoffId);
    setDeleteTarget(period || { id: cutoffId });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${deleteTarget.id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        toast.success("Cutoff period deleted");
        setDeleteTarget(null);
        fetchCutoffPeriods();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to delete");
      }
    } catch (err) {
      toast.error("Failed to delete cutoff period");
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Derived ──
  const getDepartmentName = useCallback(
    (id) => {
      if (!id) return useCompanyName ? (companyName || "Company-wide") : "No Department";
      return departments.find((d) => d.id === id)?.name || "Unknown";
    },
    [departments, useCompanyName, companyName]
  );

  const getDepartmentSetting = useCallback(
    (id) => departmentSettings.find((s) => s.departmentId === id),
    [departmentSettings]
  );

  // Report preview: PayrollExportBatch is keyed by companyId + periodStart +
  // periodEnd only (no departmentId) — one batch already covers every
  // department for that date range. So this dedupes cutoffPeriods down to
  // unique period date-ranges instead of one row per department.
  const reportPreviewPeriods = useMemo(() => {
    const seen = new Map();
    cutoffPeriods.forEach((p) => {
      const key = `${p.periodStart.slice(0, 10)}_${p.periodEnd.slice(0, 10)}`;
      if (!seen.has(key)) seen.set(key, p);
    });
    return Array.from(seen.values());
  }, [cutoffPeriods]);

  /** Opens the Configure dialog for a department, pre-filled from its saved schedule if any. */
  const openConfigFor = useCallback((departmentId) => {
    const s = departmentId ? departmentSettings.find((x) => x.departmentId === departmentId) : null;
    setConfigForm(
      s
        ? { departmentId: s.departmentId, frequency: s.frequency, startDate: s.startDate?.split("T")[0] || "", paymentOffsetDays: s.paymentOffsetDays }
        : { ...initConfigForm(), departmentId: departmentId || "" }
    );
    setIsConfigModalOpen(true);
  }, [departmentSettings]);

  const openManual = useCallback(() => {
    setManualForm(initManualForm());
    setIsManualModalOpen(true);
  }, []);

  return {
    token, isSupport, canReopen, companyName,
    ...reopen,
    departments, departmentSettings, cutoffPeriods, stats,
    isLoading, isGenerating,
    isConfigModalOpen, setIsConfigModalOpen,
    isManualModalOpen, setIsManualModalOpen,
    isSaving,
    statusConfirm, setStatusConfirm, isUpdatingStatus,
    isReportPreviewOpen, setIsReportPreviewOpen,
    loadingAction, viewingPayload, setViewingPayload,
    configForm, setConfigForm, manualForm, setManualForm,
    fetchCutoffPeriods,
    handleDownloadPayrollExport, handleViewPayrollExport,
    handleSaveConfig, handleCreateManual, handleGenerate,
    handleUpdateStatus, confirmStatusChange, handleDelete,
    deleteTarget, setDeleteTarget, isDeleting, confirmDelete,
    getDepartmentName, getDepartmentSetting, reportPreviewPeriods,
    openConfigFor, openManual,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DIALOGS (Configure, Manual cutoff, Status confirm, Report preview, Payload view)
// ─────────────────────────────────────────────────────────────────────────────
export function CutoffPeriodDialogs({ cp }) {
  const {
    departments,
    isConfigModalOpen, setIsConfigModalOpen,
    isManualModalOpen, setIsManualModalOpen,
    isSaving,
    statusConfirm, setStatusConfirm, isUpdatingStatus,
    isReportPreviewOpen, setIsReportPreviewOpen,
    loadingAction, viewingPayload, setViewingPayload,
    configForm, setConfigForm, manualForm, setManualForm,
    handleDownloadPayrollExport, handleViewPayrollExport,
    handleSaveConfig, handleCreateManual, confirmStatusChange,
    getDepartmentName, reportPreviewPeriods,
    deleteTarget, setDeleteTarget, isDeleting, confirmDelete,
  } = cp;

  return (
    <>
      {/* ── Configure Modal ── */}
      <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
        <DialogContent className="w-[90vw] sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-orange-500" /> Configure Department Cutoff
            </DialogTitle>
            <DialogDescription>
              Set up automatic cutoff period generation for a department
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Department</Label>
              <Select
                value={configForm.departmentId}
                onValueChange={(v) => setConfigForm((f) => ({ ...f, departmentId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Payment Frequency</Label>
              <Select
                value={configForm.frequency}
                onValueChange={(v) => setConfigForm((f) => ({ ...f, frequency: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bi-weekly">Bi-Weekly (every 2 weeks)</SelectItem>
                  <SelectItem value="bi-monthly">Bi-Monthly (twice a month)</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Starting Date</Label>
                <Input
                  type="date"
                  value={configForm.startDate}
                  onChange={(e) => setConfigForm((f) => ({ ...f, startDate: e.target.value }))}
                />
                <p className="text-xs text-neutral-400">Anchor date for periods</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Payment Offset (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={configForm.paymentOffsetDays}
                  onChange={(e) => setConfigForm((f) => ({ ...f, paymentOffsetDays: parseInt(e.target.value) || 1 }))}
                />
                <p className="text-xs text-neutral-400">Days after cutoff ends</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsConfigModalOpen(false)}>Cancel</Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 gap-2"
                onClick={handleSaveConfig}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Configuration
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Manual Cutoff Modal ── */}
      <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
        <DialogContent className="w-[90vw] sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-orange-500" /> Create Manual Cutoff Period
            </DialogTitle>
            <DialogDescription>
              Manually create a cutoff period for a specific department
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Department (optional)</Label>
              <Select
                value={manualForm.departmentId}
                onValueChange={(v) => setManualForm((f) => ({ ...f, departmentId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No Department (Company-wide)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department (Company-wide)</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Period Start</Label>
                <Input type="date" value={manualForm.periodStart} onChange={(e) => setManualForm((f) => ({ ...f, periodStart: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Period End</Label>
                <Input type="date" value={manualForm.periodEnd} onChange={(e) => setManualForm((f) => ({ ...f, periodEnd: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Payment Date</Label>
                <Input type="date" value={manualForm.paymentDate} onChange={(e) => setManualForm((f) => ({ ...f, paymentDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Frequency</Label>
                <Select value={manualForm.frequency} onValueChange={(v) => setManualForm((f) => ({ ...f, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                    <SelectItem value="bi-monthly">Bi-Monthly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsManualModalOpen(false)}>Cancel</Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 gap-2"
                onClick={handleCreateManual}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Cutoff
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Status Change Confirm Modal ── */}
      <Dialog open={!!statusConfirm} onOpenChange={(open) => !open && setStatusConfirm(null)}>
        <DialogContent className="w-[90vw] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {statusConfirm?.newStatus === "locked" ? (
                <Lock className="w-4 h-4 text-orange-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-orange-500" />
              )}
              {statusConfirm?.newStatus === "locked" ? "Lock Cutoff Period" : "Mark Cutoff Period Processed"}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {statusConfirm?.newStatus === "locked" ? "lock" : "mark as processed"} this
              cutoff period for <strong>{statusConfirm && getDepartmentName(statusConfirm.departmentId)}</strong>?
              {statusConfirm?.newStatus === "processed" && " Processed periods are read-only. An admin can reopen one later with a reason."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setStatusConfirm(null)} disabled={isUpdatingStatus}>
              Cancel
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 gap-2"
              onClick={confirmStatusChange}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : statusConfirm?.newStatus === "locked" ? (
                <Lock className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {statusConfirm?.newStatus === "locked" ? "Lock Period" : "Mark Processed"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── BB-149 follow-up: Reopen a processed cutoff ── */}
      <ReopenCutoffDialog r={cp} getDepartmentName={getDepartmentName} />

      {/* ── Delete a cutoff (in-app, never the browser's confirm()) ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <DialogContent className="w-[90vw] sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-600" /> Delete this cutoff?
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.periodStart ? (
                <>
                  <strong>{getDepartmentName(deleteTarget.departmentId)}</strong> · {formatDate(deleteTarget.periodStart)} – {formatDate(deleteTarget.periodEnd)}
                </>
              ) : "This cutoff period"}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            The cutoff is removed. Its timesheets will need another cutoff before they can be reviewed and paid. This can't be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white gap-2" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete cutoff
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Report Preview Modal ── */}
      <Dialog open={isReportPreviewOpen} onOpenChange={setIsReportPreviewOpen}>
        <DialogContent className="w-[90vw] sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-4 h-4 text-orange-500" /> Payroll Report Preview
            </DialogTitle>
            <DialogDescription>
              Cutoff periods and whether their payroll export has been generated
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pt-2 max-h-[60vh] overflow-y-auto">
            {reportPreviewPeriods.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-6">No cutoff periods found</p>
            ) : (
              reportPreviewPeriods.map((period) => {
                const generated = period.payrollExport?.generated;
                return (
                  <div
                    key={period.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${generated ? "" : "opacity-50"}`}
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                        {formatDate(period.periodStart)} – {formatDate(period.periodEnd)}
                      </span>
                      <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                        {generated ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                            Generated {formatDate(period.payrollExport.generatedAt)} · {period.payrollExport.employeeCount} employees
                          </>
                        ) : (
                          "Not generated yet"
                        )}
                      </p>
                      {generated && <OutdatedExportNote exp={period.payrollExport} className="mt-1" />}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={loadingAction?.periodId === period.id}
                        onClick={() => handleViewPayrollExport(period)}
                        title="View"
                      >
                        {loadingAction?.periodId === period.id && loadingAction.type === "view" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={loadingAction?.periodId === period.id}
                        onClick={() => handleDownloadPayrollExport(period)}
                        title="Download"
                      >
                        {loadingAction?.periodId === period.id && loadingAction.type === "download" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── View Payroll Export Modal ── */}
      <Dialog open={!!viewingPayload} onOpenChange={(open) => !open && setViewingPayload(null)}>
        <DialogContent className="w-[90vw] sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-orange-500" /> Payroll Export — {viewingPayload?.label}
            </DialogTitle>
            <DialogDescription>Raw JSON payload for this period</DialogDescription>
          </DialogHeader>
          <pre className="text-xs font-mono whitespace-pre overflow-auto max-h-[60vh] bg-neutral-50 dark:bg-neutral-900 p-3 rounded-lg border">
            {viewingPayload ? JSON.stringify(viewingPayload.payload, null, 2) : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BB-149 follow-up: reopen a processed cutoff — shared by the cutoff list pages and the
// Calendar review page. onDone runs after a reopen (or a status change) to reload data.
// ─────────────────────────────────────────────────────────────────────────────
export function useReopenCutoff({ token, onDone }) {
  const [reopenTarget,      setReopenTarget]      = useState(null); // period
  const [reopenReason,      setReopenReason]      = useState("");
  const [reopenError,       setReopenError]       = useState("");   // reason field error
  const [reopenPaidWarning, setReopenPaidWarning] = useState(null); // message when payment date reached
  const [isReopening,       setIsReopening]       = useState(false);

  const paidWarningFor = (period) =>
    `This cutoff's payment date (${formatDate(period.paymentDate)}) has been reached, so it may already be paid. ` +
    "Changes after reopening can differ from what was paid.";

  const openReopen = useCallback((period) => {
    setReopenTarget(period);
    setReopenReason("");
    setReopenError("");
    // Warn up front when the payment date has passed (the server checks again in the company zone)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    setReopenPaidWarning(period.paymentDate && dateOnly(period.paymentDate) <= today ? paidWarningFor(period) : null);
  }, []);

  const closeReopen = () => {
    if (isReopening) return;
    setReopenTarget(null);
  };

  const submitReopen = async () => {
    if (!reopenTarget) return;
    const reason = reopenReason.trim();
    if (reason.length < REOPEN_REASON_MIN || reason.length > REOPEN_REASON_MAX) {
      setReopenError(`Give a reason for reopening (${REOPEN_REASON_MIN}–${REOPEN_REASON_MAX} characters).`);
      return;
    }
    setReopenError("");
    setIsReopening(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${reopenTarget.id}/reopen`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          // The paid warning is on screen, so this click is the confirmation
          body: JSON.stringify({ reason, confirmPaid: !!reopenPaidWarning }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data.message || "Cutoff reopened");
        setReopenTarget(null);
        onDone?.();
        return;
      }
      switch (data.code) {
        case "REOPEN_REASON_REQUIRED":
          setReopenError(data.message || "Give a reason for reopening.");
          break;
        case "REOPEN_CONFIRM_PAID":
          // Payment date reached in the company zone — show the warning, next click confirms
          setReopenPaidWarning(data.message || paidWarningFor(reopenTarget));
          break;
        case "REOPEN_STATUS_CHANGED":
          toast.error(data.message || "The cutoff's status changed meanwhile. Reload and try again.");
          setReopenTarget(null);
          onDone?.();
          break;
        default: // REOPEN_NOT_PROCESSED, REOPEN_NOT_READY, others
          toast.error(data.message || "Failed to reopen the cutoff");
      }
    } catch (err) {
      toast.error("Failed to reopen the cutoff");
    } finally {
      setIsReopening(false);
    }
  };

  return {
    reopenTarget, reopenReason, setReopenReason, reopenError, reopenPaidWarning, isReopening,
    openReopen, closeReopen, submitReopen,
  };
}

export function ReopenCutoffDialog({ r, getDepartmentName }) {
  const { reopenTarget, reopenReason, setReopenReason, reopenError, reopenPaidWarning, isReopening, closeReopen, submitReopen } = r;
  return (
      <Dialog open={!!reopenTarget} onOpenChange={(open) => !open && closeReopen()}>
        <DialogContent className="w-[90vw] sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-orange-500" /> Reopen this cutoff?
            </DialogTitle>
            <DialogDescription>
              {reopenTarget && (
                <>
                  <strong>{getDepartmentName(reopenTarget.departmentId)}</strong> · {formatDate(reopenTarget.periodStart)} – {formatDate(reopenTarget.periodEnd)} goes back to Open.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="reopen-reason" className="text-xs font-bold uppercase tracking-wide text-neutral-500">Reason</Label>
              <Textarea
                id="reopen-reason"
                rows={3}
                maxLength={REOPEN_REASON_MAX}
                placeholder="e.g. Training day hours corrected (Nov 14)"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                disabled={isReopening}
                aria-invalid={!!reopenError}
              />
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-red-600 dark:text-red-400">{reopenError}</p>
                <p className="text-xs text-neutral-400 flex-shrink-0">{reopenReason.trim().length}/{REOPEN_REASON_MAX}</p>
              </div>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Approvals stay as they are. The payroll export will show as outdated until you process it again.
            </p>

            {reopenPaidWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300">{reopenPaidWarning}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeReopen} disabled={isReopening}>
              Cancel
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              onClick={submitReopen}
              disabled={isReopening}
            >
              {isReopening ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              {reopenPaidWarning ? "Reopen anyway" : "Reopen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

  );
}
