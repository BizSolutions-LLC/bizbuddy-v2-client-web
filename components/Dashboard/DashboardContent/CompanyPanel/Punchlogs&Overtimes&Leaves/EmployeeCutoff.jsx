// components/Dashboard/DashboardContent/CompanyPanel/PunchlogsB&OvertimesB&Leaves/EmployeeCutoff.jsx
// BB-121: List Type cutoff list. Data, actions and dialogs live in ./cutoffPeriodsShared
// (shared with the Calendar Type page, CutoffPeriodsCalendar.jsx).
"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Plus,
  Eye,
  Lock,
  Unlock,
  CheckCircle2,
  MoreVertical,
  Search,
  Clock,
  AlertCircle,
  Check,
  X,
  Building2,
  Settings,
  CircleDot,
  LayoutGrid,
  LayoutList,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  FREQUENCY_LABELS,
  formatDate,
  initConfigForm,
  initManualForm,
  StatusBadge,
  DeptConfigPanel,
  useCutoffPeriods,
  CutoffPeriodDialogs,
} from "./cutoffPeriodsShared";

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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function EmployeeCutoff() {
  const router = useRouter();
  const cp = useCutoffPeriods();
  const {
    isSupport,
    departments, cutoffPeriods, stats,
    isLoading, isGenerating,
    setIsConfigModalOpen, setIsManualModalOpen,
    setStatusConfirm, setIsReportPreviewOpen,
    setConfigForm, setManualForm,
    handleGenerate, handleUpdateStatus, handleDelete,
    getDepartmentName, getDepartmentSetting,
  } = cp;

  // ── List-page UI state ──
  const [selectedDepartment,  setSelectedDepartment]  = useState("all");

  // ── Table filter state ──
  const [searchPeriod,    setSearchPeriod]    = useState("");
  const [statusFilter,    setStatusFilter]    = useState("all");
  const [showCurrentOnly, setShowCurrentOnly] = useState(true);

  // ─────────────────────────────────────────────────────────────────────
  // DERIVED DATA
  // ─────────────────────────────────────────────────────────────────────

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
      const matchDept =
        selectedDepartment === "all" ? true :
        selectedDepartment === "none" ? !p.departmentId :
        p.departmentId === selectedDepartment;

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

      return matchDept && matchSearch && matchStatus && matchDate;
    });
  }, [cutoffPeriods, selectedDepartment, searchPeriod, statusFilter, showCurrentOnly, getDepartmentName]);

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
          {!isSupport && (
            <Button
              variant="outline"
              size="icon"
              title="Preview Payroll Reports"
              onClick={() => setIsReportPreviewOpen(true)}
            >
              <Search className="w-4 h-4" />
            </Button>
          )}
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
                    <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-red-500 text-white text-[9px] font-extrabold flex items-center justify-center border-2 border-white dark:border-neutral-900">
                      {pending}
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
                  {filteredPeriods.map((period, i) => {
                    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
                    const [sy, sm, sd] = period.periodStart.slice(0, 10).split("-").map(Number);
                    const isFuture = new Date(sy, sm - 1, sd) > today0;
                    return (
                    <motion.tr
                      key={period.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`border-b last:border-b-0 transition-colors ${isFuture ? "opacity-40 bg-neutral-50/50 dark:bg-neutral-900/20" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40"}`}
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
                            disabled={isFuture}
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
                              <Button size="sm" variant="ghost" className="w-8 h-8 p-0" disabled={period.status === "processed"}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {period.status === "open" && (
                                <DropdownMenuItem onClick={() => setStatusConfirm({ periodId: period.id, departmentId: period.departmentId, newStatus: "locked" })}>
                                  <Lock className="w-3.5 h-3.5 mr-2" /> Lock Period
                                </DropdownMenuItem>
                              )}
                              {period.status === "locked" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(period.id, "open")}>
                                    <Unlock className="w-3.5 h-3.5 mr-2" /> Unlock Period
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setStatusConfirm({ periodId: period.id, departmentId: period.departmentId, newStatus: "processed" })}>
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Mark Processed
                                  </DropdownMenuItem>
                                </>
                              )}
                              {period.status === "open" && (
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
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CutoffPeriodDialogs cp={cp} />

    </div>
  );
}
