// components/Dashboard/DashboardContent/CompanyPanel/PunchlogsB&OvertimesB&Leaves/EmployeeCutoff.jsx
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Plus,
  Eye,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Search,
  Clock,
  AlertCircle,
  Check,
  X,
  Building2,
  Settings,
  Zap,
  Loader2,
  CircleDot,
  LayoutGrid,
  LayoutList,
  Pencil,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const FREQUENCY_LABELS = {
  "bi-weekly":  "Bi-Weekly",
  "bi-monthly": "Bi-Monthly",
  "monthly":    "Monthly",
};

const STATUS_CONFIG = {
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
const formatDate = (d) => {
  if (!d) return "—";
  const [year, month, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
};

const initConfigForm = () => ({
  departmentId: "",
  frequency: "bi-weekly",
  startDate: "",
  paymentOffsetDays: 5,
});

const initManualForm = () => ({
  departmentId: "",
  periodStart: "",
  periodEnd: "",
  paymentDate: "",
  frequency: "bi-weekly",
});

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Single stat card with animated entrance */
const StatCard = ({ label, value, color, Icon, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
  >
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
              {label}
            </p>
            <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color} bg-opacity-15`}
            style={{ background: "inherit" }}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

/** Approval pill group shown in the table row */
const ApprovalPills = ({ approved = 0, pending = 0, excluded = 0 }) => (
  <div className="flex items-center gap-1.5">
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-700">
      <Check className="w-2.5 h-2.5" /> {approved}
    </span>
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">
      <Clock className="w-2.5 h-2.5" /> {pending}
    </span>
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">
      <X className="w-2.5 h-2.5" /> {excluded}
    </span>
  </div>
);

/** Status badge */
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  const Icon = cfg.icon;
  return (
    <Badge className={`${cfg.color} gap-1`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
};

/** Department config panel — shown when a specific dept tab is selected */
const DeptConfigPanel = ({
  dept,
  setting,
  upcomingPeriods,
  isGenerating,
  onGenerate,
  onEditConfig,
  formatDate,
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
        <Button onClick={onEditConfig} className="bg-orange-500 hover:bg-orange-600 gap-2">
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
            disabled={isGenerating || (mode === "range" && (!rangeFrom || !rangeTo))}
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
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function EmployeeCutoff() {
  const { token } = useAuthStore();
  const router = useRouter();

  // ── Data state ──
  const [departments,         setDepartments]         = useState([]);
  const [departmentSettings,  setDepartmentSettings]  = useState([]);
  const [cutoffPeriods,       setCutoffPeriods]       = useState([]);
  const [stats,               setStats]               = useState({ total: 0, open: 0, locked: 0, processed: 0 });

  // ── UI state ──
  const [selectedDepartment,  setSelectedDepartment]  = useState("all");
  const [isLoading,           setIsLoading]           = useState(true);
  const [isGenerating,        setIsGenerating]        = useState({});
  const [isConfigModalOpen,   setIsConfigModalOpen]   = useState(false);
  const [isManualModalOpen,   setIsManualModalOpen]   = useState(false);
  const [isSaving,            setIsSaving]            = useState(false);

  // ── Form state ──
  const [configForm, setConfigForm] = useState(initConfigForm());
  const [manualForm, setManualForm] = useState(initManualForm());

  // ── Table filter state ──
  const [searchPeriod,    setSearchPeriod]    = useState("");
  const [statusFilter,    setStatusFilter]    = useState("all");
  const [showCurrentOnly, setShowCurrentOnly] = useState(true);

  // ─────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────

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
      const base = `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods`;
      const url =
        selectedDepartment === "all" || selectedDepartment === "none"
          ? base
          : `${base}?departmentId=${selectedDepartment}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      let periods = data.data || [];

      if (selectedDepartment === "none") {
        periods = periods.filter((p) => !p.departmentId);
      }

      setCutoffPeriods(periods);
      setStats({
        total:     periods.length,
        open:      periods.filter((p) => p.status === "open").length,
        locked:    periods.filter((p) => p.status === "locked").length,
        processed: periods.filter((p) => p.status === "processed").length,
      });
    } catch (err) {
      console.error("fetchCutoffPeriods:", err);
      toast.error("Failed to load cutoff periods");
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedDepartment]);

  useEffect(() => {
    fetchDepartments();
    fetchDepartmentSettings();
  }, [fetchDepartments, fetchDepartmentSettings]);

  useEffect(() => {
    if (token) fetchCutoffPeriods();
  }, [token, fetchCutoffPeriods]);

  // ─────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────

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
        toast.success(`Cutoff period ${newStatus}`);
        fetchCutoffPeriods();
      } else {
        toast.error(data.message || "Failed to update status");
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (cutoffId) => {
    if (!confirm("Are you sure you want to delete this cutoff period?")) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cutoff-periods/${cutoffId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        toast.success("Cutoff period deleted");
        fetchCutoffPeriods();
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to delete");
      }
    } catch (err) {
      toast.error("Failed to delete cutoff period");
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // DERIVED DATA
  // ─────────────────────────────────────────────────────────────────────

  const getDepartmentName = useCallback(
    (id) => {
      if (!id) return "No Department";
      return departments.find((d) => d.id === id)?.name || "Unknown";
    },
    [departments]
  );

  const getDepartmentSetting = useCallback(
    (id) => departmentSettings.find((s) => s.departmentId === id),
    [departmentSettings]
  );

  // Pending count per department tab (for red dot)
  const deptPendingCounts = useMemo(() => {
    const counts = {};
    departments.forEach((d) => {
      counts[d.id] = cutoffPeriods
        .filter((p) => p.departmentId === d.id)
        .reduce((sum, p) => sum + (p.approvalStats?.pending || 0), 0);
    });
    return counts;
  }, [cutoffPeriods, departments]);

  const deptTotalCounts = useMemo(() => {
    const counts = { all: cutoffPeriods.length, none: 0 };
    departments.forEach((d) => {
      counts[d.id] = cutoffPeriods.filter((p) => p.departmentId === d.id).length;
    });
    counts.none = cutoffPeriods.filter((p) => !p.departmentId).length;
    return counts;
  }, [cutoffPeriods, departments]);

  const filteredPeriods = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return cutoffPeriods.filter((p) => {
      const deptName = getDepartmentName(p.departmentId).toLowerCase();
      const matchSearch =
        !searchPeriod ||
        deptName.includes(searchPeriod.toLowerCase()) ||
        p.frequency.toLowerCase().includes(searchPeriod.toLowerCase());
      const matchStatus = statusFilter === "all" || p.status === statusFilter;

      // Current-period toggle: only show periods that contain today
      const matchDate = (() => {
        if (!showCurrentOnly) return true;
        const [sy, sm, sd] = p.periodStart.slice(0, 10).split("-").map(Number);
        const [ey, em, ed] = p.periodEnd.slice(0, 10).split("-").map(Number);
        const start = new Date(sy, sm - 1, sd);
        const end   = new Date(ey, em - 1, ed);
        return today >= start && today <= end;
      })();

      return matchSearch && matchStatus && matchDate;
    });
  }, [cutoffPeriods, searchPeriod, statusFilter, showCurrentOnly, getDepartmentName]);

  // Upcoming periods for the selected dept config panel
  const upcomingForSelectedDept = useMemo(
    () =>
      cutoffPeriods
        .filter(
          (p) =>
            p.departmentId === selectedDepartment &&
            new Date(p.periodStart) >= new Date()
        )
        .slice(0, 3),
    [cutoffPeriods, selectedDepartment]
  );

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────

  const showDeptPanel =
    selectedDepartment !== "all" && selectedDepartment !== "none";

  return (
    <div className="space-y-6 p-6">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-800 dark:text-neutral-100 tracking-tight">
            Cutoff Period Management
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            Automated payroll cutoff periods per department
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setConfigForm(initConfigForm());
              setIsConfigModalOpen(true);
            }}
          >
            <Settings className="w-4 h-4" /> Configure
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600 gap-2"
            onClick={() => {
              setManualForm(initManualForm());
              setIsManualModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" /> Manual Cutoff
          </Button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Cutoffs" value={stats.total}     color="text-neutral-800 dark:text-neutral-200" Icon={Calendar}      delay={0.05} />
        <StatCard label="Open"          value={stats.open}      color="text-green-600"                         Icon={CircleDot}     delay={0.10} />
        <StatCard label="Locked"        value={stats.locked}    color="text-amber-600"                         Icon={Lock}          delay={0.15} />
        <StatCard label="Processed"     value={stats.processed} color="text-blue-600"                          Icon={CheckCircle2}  delay={0.20} />
      </div>

      {/* ── Departments Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-4 h-4 text-neutral-500" /> Departments
          </CardTitle>
        </CardHeader>
        <CardContent>

          {/* Department Tabs */}
          <div className="flex flex-wrap gap-2">
            {/* All */}
            <button
              onClick={() => setSelectedDepartment("all")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all
                ${selectedDepartment === "all"
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-white border-neutral-200 text-neutral-600 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300"
                }`}
            >
              <LayoutGrid className="w-3 h-3" />
              All Departments
              <span className={`px-1.5 py-0 rounded-full text-xs font-bold
                ${selectedDepartment === "all" ? "bg-white/25 text-white" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-700"}`}>
                {deptTotalCounts.all}
              </span>
            </button>

            {/* Per-department tabs */}
            {departments.map((dept) => {
              const isActive  = selectedDepartment === dept.id;
              const setting   = getDepartmentSetting(dept.id);
              const pending   = deptPendingCounts[dept.id] || 0;
              const total     = deptTotalCounts[dept.id] || 0;
              return (
                <div key={dept.id} className="relative">
                  <button
                    onClick={() => setSelectedDepartment(dept.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all
                      ${isActive
                        ? "bg-orange-500 border-orange-500 text-white"
                        : "bg-white border-neutral-200 text-neutral-600 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300"
                      }`}
                  >
                    {dept.name}
                    <span className={`px-1.5 py-0 rounded-full text-xs font-bold
                      ${isActive ? "bg-white/25 text-white" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-700"}`}>
                      {total}
                    </span>
                    {setting && (
                      <span className={`px-1.5 py-0 rounded text-xs font-semibold
                        ${isActive ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-400 dark:bg-neutral-700"}`}>
                        {setting.frequency}
                      </span>
                    )}
                  </button>
                  {pending > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-extrabold flex items-center justify-center border-2 border-white dark:border-neutral-900">
                      {pending > 9 ? "9+" : pending}
                    </span>
                  )}
                </div>
              );
            })}

            {/* No Department */}
            <button
              onClick={() => setSelectedDepartment("none")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all
                ${selectedDepartment === "none"
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-white border-neutral-200 text-neutral-600 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300"
                }`}
            >
              <AlertCircle className="w-3 h-3" />
              No Department
              <span className={`px-1.5 py-0 rounded-full text-xs font-bold
                ${selectedDepartment === "none" ? "bg-white/25 text-white" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-700"}`}>
                {deptTotalCounts.none}
              </span>
            </button>
          </div>

          {/* Dept Config Panel */}
          <AnimatePresence mode="wait">
            {showDeptPanel && (() => {
              const dept    = departments.find((d) => d.id === selectedDepartment);
              const setting = getDepartmentSetting(selectedDepartment);
              if (!dept) return null;
              return (
                <DeptConfigPanel
                  key={selectedDepartment}
                  dept={dept}
                  setting={setting}
                  upcomingPeriods={upcomingForSelectedDept}
                  isGenerating={!!isGenerating[selectedDepartment]}
                  onGenerate={handleGenerate}
                  onEditConfig={() => {
                    const s = getDepartmentSetting(selectedDepartment);
                    setConfigForm(
                      s
                        ? { departmentId: s.departmentId, frequency: s.frequency, startDate: s.startDate?.split("T")[0] || "", paymentOffsetDays: s.paymentOffsetDays }
                        : { ...initConfigForm(), departmentId: selectedDepartment }
                    );
                    setIsConfigModalOpen(true);
                  }}
                  formatDate={formatDate}
                />
              );
            })()}
          </AnimatePresence>

        </CardContent>
      </Card>

      {/* ── Cutoff Periods Table ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutList className="w-4 h-4 text-neutral-500" /> Cutoff Periods
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Current / All toggle */}
              <div className="inline-flex items-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 p-0.5 gap-0.5">
                <button
                  onClick={() => setShowCurrentOnly(true)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    showCurrentOnly
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  }`}
                >
                  Current Period
                </button>
                <button
                  onClick={() => setShowCurrentOnly(false)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    !showCurrentOnly
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  }`}
                >
                  All
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                <Input
                  placeholder="Search by department or frequency..."
                  value={searchPeriod}
                  onChange={(e) => setSearchPeriod(e.target.value)}
                  className="pl-9 w-60 text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : filteredPeriods.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-14 h-14 mx-auto text-neutral-200 mb-4" />
              <p className="font-semibold text-neutral-500">No cutoff periods found</p>
              <p className="text-sm text-neutral-400 mt-1">
                {showCurrentOnly
                  ? "No period covers today's date. Switch to \"All\" to see all periods."
                  : "Try adjusting your filters or create a new period."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-neutral-50 dark:bg-neutral-800/50">
                    {["Department", "Period", "Payment Date", "Frequency", "Status", "Approvals", ""].map((h) => (
                      <th key={h} className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 ${h === "" ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPeriods.map((period, i) => (
                    <motion.tr
                      key={period.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      {/* Department */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="gap-1 font-medium">
                            <Building2 className="w-3 h-3" />
                            {getDepartmentName(period.departmentId)}
                          </Badge>
                          {period.isAutoGenerated && (
                            <Badge className="bg-blue-100 text-blue-700 text-xs border-0">Auto</Badge>
                          )}
                        </div>
                      </td>

                      {/* Period */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                          {formatDate(period.periodStart)} – {formatDate(period.periodEnd)}
                        </span>
                      </td>

                      {/* Payment Date */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          {formatDate(period.paymentDate)}
                        </span>
                      </td>

                      {/* Frequency */}
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {FREQUENCY_LABELS[period.frequency] || period.frequency}
                        </Badge>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={period.status} />
                      </td>

                      {/* Approvals */}
                      <td className="px-4 py-3">
                        <ApprovalPills
                          approved={period.approvalStats?.approved || 0}
                          pending={period.approvalStats?.pending   || 0}
                          excluded={period.approvalStats?.excluded || period.approvalStats?.rejected || 0}
                        />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs"
                            onClick={() =>
                              router.push(
                                `/dashboard/company/cutoff-periods/${period.id}/review`
                              )
                            }
                          >
                            <Eye className="w-3.5 h-3.5" /> Review
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="w-8 h-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {period.status === "open" && (
                                <DropdownMenuItem onClick={() => handleUpdateStatus(period.id, "locked")}>
                                  <Lock className="w-3.5 h-3.5 mr-2" /> Lock Period
                                </DropdownMenuItem>
                              )}
                              {period.status === "locked" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(period.id, "open")}>
                                    <Unlock className="w-3.5 h-3.5 mr-2" /> Unlock Period
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(period.id, "processed")}>
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Mark Processed
                                  </DropdownMenuItem>
                                </>
                              )}
                              {period.status !== "processed" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(period.id)}
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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

    </div>
  );
}